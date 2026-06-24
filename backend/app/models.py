from datetime import datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class Watch(Base):
    __tablename__ = "watches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # List of {field, operator, value} dicts.
    rules: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    interval_minutes: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    download_client: Mapped[str] = mapped_column(String(50), default="sabnzbd")
    # Download-client category/folder to drop matching spots into.
    category: Mapped[str] = mapped_column(
        String(200), default="", server_default="", nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    total_sent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class Activity(Base):
    __tablename__ = "activity"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    watch_id: Mapped[int | None] = mapped_column(
        ForeignKey("watches.id", ondelete="SET NULL"), nullable=True
    )
    # Snapshot of the watch name so history survives watch deletion.
    watch_name: Mapped[str] = mapped_column(String(255), nullable=False)
    # Spotweb spot identifier — the key used for dedup.
    spot_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    spot_title: Mapped[str] = mapped_column(String(500), nullable=False)
    spot_size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    spot_category: Mapped[str] = mapped_column(String(200), default="")
    # sent | skipped_duplicate | failed
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    sent_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False, index=True
    )


class Setting(Base):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    # JSON-encoded value.
    value: Mapped[str] = mapped_column(Text, nullable=False)
