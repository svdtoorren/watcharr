from datetime import datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Activity, Watch
from ..schemas import WatchCreate, WatchOut, WatchStats, WatchUpdate
from ..scheduler import reschedule_watch, unschedule_watch
from ..services.watcher import run_watch

router = APIRouter(prefix="/watches", tags=["watches"])


@router.get("", response_model=list[WatchOut])
async def list_watches(db: AsyncSession = Depends(get_db)):
    watches = (
        await db.execute(select(Watch).order_by(Watch.created_at.desc()))
    ).scalars().all()
    return watches


@router.post("", response_model=WatchOut, status_code=201)
async def create_watch(payload: WatchCreate, db: AsyncSession = Depends(get_db)):
    watch = Watch(
        name=payload.name,
        is_active=payload.is_active,
        rules=[r.model_dump() for r in payload.rules],
        interval_minutes=payload.interval_minutes,
        download_client=payload.download_client,
        category=payload.category,
    )
    db.add(watch)
    await db.commit()
    await db.refresh(watch)
    await reschedule_watch(watch.id)
    return watch


@router.get("/{watch_id}", response_model=WatchStats)
async def get_watch(watch_id: int, db: AsyncSession = Depends(get_db)):
    watch = await db.get(Watch, watch_id)
    if watch is None:
        raise HTTPException(404, "Watch niet gevonden")

    week_ago = datetime.utcnow() - timedelta(days=7)
    this_week = (
        await db.execute(
            select(func.count(Activity.id)).where(
                Activity.watch_id == watch_id,
                Activity.status == "sent",
                Activity.sent_at >= week_ago,
            )
        )
    ).scalar_one()

    avg_size = (
        await db.execute(
            select(func.avg(Activity.spot_size_bytes)).where(
                Activity.watch_id == watch_id,
                Activity.status == "sent",
            )
        )
    ).scalar()

    failed_count = (
        await db.execute(
            select(func.count(Activity.id)).where(
                Activity.watch_id == watch_id,
                Activity.status == "failed",
            )
        )
    ).scalar_one()

    base = WatchOut.model_validate(watch)
    return WatchStats(
        **base.model_dump(),
        this_week=int(this_week or 0),
        avg_size_mb=round((avg_size or 0) / (1024 * 1024), 1),
        failed_count=int(failed_count or 0),
    )


@router.put("/{watch_id}", response_model=WatchOut)
async def update_watch(
    watch_id: int, payload: WatchUpdate, db: AsyncSession = Depends(get_db)
):
    watch = await db.get(Watch, watch_id)
    if watch is None:
        raise HTTPException(404, "Watch niet gevonden")

    data = payload.model_dump(exclude_unset=True)
    if "rules" in data and data["rules"] is not None:
        data["rules"] = [r for r in data["rules"]]
    for key, value in data.items():
        setattr(watch, key, value)
    await db.commit()
    await db.refresh(watch)
    await reschedule_watch(watch.id)
    return watch


@router.delete("/{watch_id}", status_code=204)
async def delete_watch(watch_id: int, db: AsyncSession = Depends(get_db)):
    watch = await db.get(Watch, watch_id)
    if watch is None:
        raise HTTPException(404, "Watch niet gevonden")
    unschedule_watch(watch_id)
    await db.delete(watch)
    await db.commit()


@router.post("/{watch_id}/run")
async def run_watch_now(
    watch_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    watch = await db.get(Watch, watch_id)
    if watch is None:
        raise HTTPException(404, "Watch niet gevonden")
    background_tasks.add_task(run_watch, watch_id)
    return {"status": "started"}


@router.post("/{watch_id}/pause", response_model=WatchOut)
async def toggle_pause(watch_id: int, db: AsyncSession = Depends(get_db)):
    watch = await db.get(Watch, watch_id)
    if watch is None:
        raise HTTPException(404, "Watch niet gevonden")
    watch.is_active = not watch.is_active
    await db.commit()
    await db.refresh(watch)
    await reschedule_watch(watch.id)
    return watch
