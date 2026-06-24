from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# ----- Watch rules -----

RuleField = Literal["poster", "title", "category", "size", "date"]


class WatchRule(BaseModel):
    field: RuleField
    operator: str
    value: str


# ----- Watch -----


class WatchBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    is_active: bool = True
    rules: list[WatchRule] = Field(default_factory=list)
    interval_minutes: int = Field(default=60, ge=1)
    download_client: str = "sabnzbd"
    category: str = Field(default="", max_length=200)


class WatchCreate(WatchBase):
    pass


class WatchUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    is_active: bool | None = None
    rules: list[WatchRule] | None = None
    interval_minutes: int | None = Field(default=None, ge=1)
    download_client: str | None = None
    category: str | None = Field(default=None, max_length=200)


class WatchOut(WatchBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    last_run_at: datetime | None
    total_sent: int


class WatchStats(WatchOut):
    this_week: int
    avg_size_mb: float
    failed_count: int


# ----- Activity -----


class ActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    watch_id: int | None
    watch_name: str
    spot_id: str
    spot_title: str
    spot_size_bytes: int | None
    spot_category: str
    status: str
    error_message: str | None
    sent_at: datetime


class ActivityStats(BaseModel):
    sent: int
    skipped_duplicate: int
    failed: int
    total: int


# ----- Settings -----


class TestResult(BaseModel):
    ok: bool
    message: str
    spot_count: int | None = None
