"""APScheduler wiring — one interval job per active watch."""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select

from .database import SessionLocal
from .models import Watch
from .services.watcher import run_watch

logger = logging.getLogger("watcharr.scheduler")

scheduler = AsyncIOScheduler()


def _job_id(watch_id: int) -> str:
    return f"watch-{watch_id}"


async def _run_job(watch_id: int) -> None:
    await run_watch(watch_id)


def schedule_watch(watch: Watch) -> None:
    """(Re)schedule a single watch. Removes any existing job first."""
    job_id = _job_id(watch.id)
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
    if not watch.is_active:
        return
    scheduler.add_job(
        _run_job,
        trigger=IntervalTrigger(minutes=max(1, watch.interval_minutes)),
        args=[watch.id],
        id=job_id,
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )
    logger.info(
        "Scheduled watch %s '%s' every %d min",
        watch.id,
        watch.name,
        watch.interval_minutes,
    )


async def reschedule_watch(watch_id: int) -> None:
    """Reload one watch from the DB and (re)apply its schedule."""
    async with SessionLocal() as db:
        watch = await db.get(Watch, watch_id)
        if watch is None:
            unschedule_watch(watch_id)
            return
        schedule_watch(watch)


def unschedule_watch(watch_id: int) -> None:
    job_id = _job_id(watch_id)
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)


async def load_all_watches() -> None:
    """Schedule every active watch on startup."""
    async with SessionLocal() as db:
        watches = (await db.execute(select(Watch))).scalars().all()
        for watch in watches:
            schedule_watch(watch)


def start_scheduler() -> None:
    if not scheduler.running:
        scheduler.start()
        logger.info("Scheduler started")


def shutdown_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
