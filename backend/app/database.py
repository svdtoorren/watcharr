import asyncio
import logging
from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from .config import settings

logger = logging.getLogger("watcharr")

# NB: no pool_pre_ping — SQLAlchemy's pre-ping calls aiomysql's ping() without
# the `reconnect` arg it requires, which raises a TypeError on checkout. We rely
# on pool_recycle to drop connections before MySQL's wait_timeout closes them;
# SQLAlchemy also invalidates the pool automatically on a disconnect error.
engine = create_async_engine(settings.DATABASE_URL, pool_recycle=1800, echo=False)

SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


async def init_db(retries: int = 10, delay: float = 2.0) -> None:
    """Create Watcharr's tables if they don't exist yet.

    Retries on connection errors so a database that isn't ready yet (e.g. a
    MariaDB container still starting up) doesn't crash the app on boot.
    """
    # Import models so they're registered on Base.metadata before create_all.
    from . import models  # noqa: F401

    for attempt in range(1, retries + 1):
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
                await _run_migrations(conn)
            return
        except OperationalError as exc:
            if attempt == retries:
                logger.error(
                    "Database unreachable after %d attempts: %s", retries, exc
                )
                raise
            logger.warning(
                "Database not ready (attempt %d/%d), retrying in %.0fs…",
                attempt,
                retries,
                delay,
            )
            await asyncio.sleep(delay)


# Columns added after a table may already exist in a deployment. create_all only
# creates missing *tables*, never alters existing ones, so add new columns here.
# MariaDB supports ADD COLUMN IF NOT EXISTS, making these idempotent.
_MIGRATIONS = [
    "ALTER TABLE watches ADD COLUMN IF NOT EXISTS category VARCHAR(200) "
    "NOT NULL DEFAULT ''",
]


async def _run_migrations(conn) -> None:
    for stmt in _MIGRATIONS:
        try:
            await conn.execute(text(stmt))
        except Exception as exc:  # noqa: BLE001 — a failed migration shouldn't crash boot
            logger.warning("Migration skipped (%s): %s", stmt, exc)
