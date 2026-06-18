"""Watch execution: fetch from Spotweb → filter → dedup → send to client → log."""

import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import SessionLocal
from ..models import Activity, Watch
from ..schemas import WatchRule
from .downloader import DownloadClient
from .spotweb import SpotwebClient
from .store import get_settings_dict

logger = logging.getLogger("watcharr.watcher")


async def _already_sent(db: AsyncSession, watch_id: int, spot_id: str) -> bool:
    """A spot is a duplicate if it was previously *sent* for this watch."""
    stmt = select(Activity.id).where(
        Activity.watch_id == watch_id,
        Activity.spot_id == spot_id,
        Activity.status == "sent",
    )
    return (await db.execute(stmt)).first() is not None


async def run_watch(watch_id: int) -> dict:
    """Execute one watch run. Opens its own DB session so it can be called from
    the scheduler or a background task independently of a request."""
    async with SessionLocal() as db:
        watch = await db.get(Watch, watch_id)
        if watch is None:
            return {"error": "watch not found"}

        settings_dict = await get_settings_dict(db)
        rules = [WatchRule(**r) for r in (watch.rules or [])]

        sent = skipped = failed = 0

        try:
            spotweb = SpotwebClient.from_settings(settings_dict)
            matches = await spotweb.search(rules)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Watch %s: Spotweb fetch failed: %s", watch_id, exc)
            watch.last_run_at = datetime.utcnow()
            await db.commit()
            return {"error": str(exc), "sent": 0, "skipped": 0, "failed": 0}

        downloader = DownloadClient.from_settings(settings_dict)

        for spot in matches:
            if await _already_sent(db, watch.id, spot.id):
                db.add(
                    Activity(
                        watch_id=watch.id,
                        watch_name=watch.name,
                        spot_id=spot.id,
                        spot_title=spot.title,
                        spot_size_bytes=spot.filesize,
                        spot_category=spot.category,
                        status="skipped_duplicate",
                    )
                )
                skipped += 1
                continue

            try:
                ok = await downloader.send(spot)
                if ok:
                    db.add(
                        Activity(
                            watch_id=watch.id,
                            watch_name=watch.name,
                            spot_id=spot.id,
                            spot_title=spot.title,
                            spot_size_bytes=spot.filesize,
                            spot_category=spot.category,
                            status="sent",
                        )
                    )
                    sent += 1
                else:
                    raise RuntimeError("download-client weigerde het item")
            except Exception as exc:  # noqa: BLE001
                db.add(
                    Activity(
                        watch_id=watch.id,
                        watch_name=watch.name,
                        spot_id=spot.id,
                        spot_title=spot.title,
                        spot_size_bytes=spot.filesize,
                        spot_category=spot.category,
                        status="failed",
                        error_message=str(exc)[:500],
                    )
                )
                failed += 1

        watch.last_run_at = datetime.utcnow()
        watch.total_sent = (watch.total_sent or 0) + sent
        await db.commit()

        logger.info(
            "Watch %s '%s': sent=%d skipped=%d failed=%d",
            watch.id,
            watch.name,
            sent,
            skipped,
            failed,
        )
        return {"sent": sent, "skipped": skipped, "failed": failed}
