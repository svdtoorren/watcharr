from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Activity
from ..schemas import ActivityOut, ActivityStats
from ..services.downloader import DownloadClient
from ..services.spotweb import Spot, SpotwebClient
from ..services.store import get_settings_dict

router = APIRouter(prefix="/activity", tags=["activity"])


@router.get("", response_model=list[ActivityOut])
async def list_activity(
    watch_id: int | None = None,
    status: str | None = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Activity).order_by(Activity.sent_at.desc())
    if watch_id is not None:
        stmt = stmt.where(Activity.watch_id == watch_id)
    if status:
        stmt = stmt.where(Activity.status == status)
    stmt = stmt.limit(limit).offset(offset)
    rows = (await db.execute(stmt)).scalars().all()
    return rows


@router.get("/stats", response_model=ActivityStats)
async def activity_stats(db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(
            select(Activity.status, func.count(Activity.id)).group_by(Activity.status)
        )
    ).all()
    counts = {status: count for status, count in rows}
    return ActivityStats(
        sent=counts.get("sent", 0),
        skipped_duplicate=counts.get("skipped_duplicate", 0),
        failed=counts.get("failed", 0),
        total=sum(counts.values()),
    )


@router.post("/{activity_id}/retry", response_model=ActivityOut)
async def retry_activity(
    activity_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Re-send a previously failed item to the download client."""
    item = await db.get(Activity, activity_id)
    if item is None:
        raise HTTPException(404, "Item niet gevonden")
    if item.status != "failed":
        raise HTTPException(400, "Alleen mislukte items kunnen opnieuw")

    settings_dict = await get_settings_dict(db)
    downloader = DownloadClient.from_settings(settings_dict)
    # Rebuild the NZB URL from the stored messageid (spot_id) with the current
    # Spotweb settings, so a retry uses the same fetchable URL as a fresh run.
    nzb_url = SpotwebClient.from_settings(settings_dict)._nzb_url(item.spot_id)
    spot = Spot(
        id=item.spot_id,
        title=item.spot_title,
        category=item.spot_category,
        poster="",
        filesize=item.spot_size_bytes,
        nzb_url=nzb_url,
    )
    try:
        ok = await downloader.send(spot)
        if ok:
            item.status = "sent"
            item.error_message = None
        else:
            item.error_message = "download-client weigerde het item"
    except Exception as exc:  # noqa: BLE001
        item.error_message = str(exc)[:500]
    await db.commit()
    await db.refresh(item)
    return item
