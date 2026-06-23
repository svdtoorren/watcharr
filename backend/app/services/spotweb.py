"""Spotweb integration — fetch spots either via the Spotweb API or by querying
the Spotweb MariaDB directly, then filter them client-side against Watch rules."""

from dataclasses import dataclass

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from ..schemas import WatchRule


@dataclass
class Spot:
    id: str
    title: str
    category: str
    poster: str
    filesize: int | None
    nzb_url: str
    stamp: int | None = None  # unix timestamp


def _matches(spot: Spot, rule: WatchRule) -> bool:
    """Evaluate a single rule against a spot. Unknown operators fail closed."""
    field = rule.field
    op = rule.operator
    val = (rule.value or "").strip()

    if field == "poster":
        poster = (spot.poster or "").lower()
        needle = val.lower()
        if op == "is":
            return poster == needle
        if op == "contains":
            return needle in poster
        if op == "not_contains":
            return needle not in poster
        return False

    if field == "title":
        title = (spot.title or "").lower()
        needle = val.lower()
        if op == "contains":
            return needle in title
        if op == "not_contains":
            return needle not in title
        if op == "starts_with":
            return title.startswith(needle)
        return False

    if field == "category":
        category = (spot.category or "").lower()
        needle = val.lower()
        if op == "in":
            return needle in category
        if op == "not_in":
            return needle not in category
        return False

    if field == "size":
        if spot.filesize is None:
            return False
        try:
            mb = float(val)
        except ValueError:
            return False
        size_mb = spot.filesize / (1024 * 1024)
        if op == "gt":
            return size_mb > mb
        if op == "lt":
            return size_mb < mb
        if op == "gte":
            return size_mb >= mb
        if op == "lte":
            return size_mb <= mb
        return False

    if field == "date":
        if spot.stamp is None:
            return False
        try:
            from datetime import datetime

            threshold = datetime.fromisoformat(val).timestamp()
        except ValueError:
            return False
        if op == "after":
            return spot.stamp >= threshold
        if op == "before":
            return spot.stamp <= threshold
        return False

    return False


class SpotwebClient:
    def __init__(self, config: dict):
        self.config = config
        self.mode = config.get("spotweb_connection_type", "api")

    @classmethod
    def from_settings(cls, settings_dict: dict) -> "SpotwebClient":
        return cls(settings_dict)

    def _nzb_url(self, messageid: str) -> str:
        """Build the Spotweb newznab URL that returns the actual NZB, so a
        download client can fetch it: ``{url}/api?t=g&id=<messageid>&apikey=…``.

        This is needed in BOTH modes — even when spots are read straight from
        MariaDB, the NZB itself is still retrieved over Spotweb's HTTP API. If no
        Spotweb URL is configured we fall back to a ``spotweb://`` placeholder
        that a download client can't fetch (surfaced as a failed activity)."""
        base = (self.config.get("spotweb_api_url") or "").rstrip("/")
        if not base:
            return f"spotweb://{messageid}"
        apikey = self.config.get("spotweb_api_key") or ""
        suffix = f"&apikey={apikey}" if apikey else ""
        return f"{base}/api?t=g&id={messageid}{suffix}"

    async def _fetch_api(self, limit: int = 200) -> list[Spot]:
        url = self.config.get("spotweb_api_url", "").rstrip("/")
        api_key = self.config.get("spotweb_api_key", "")
        if not url:
            raise ValueError("Geen Spotweb URL ingesteld")
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(
                f"{url}/api/v2/search",
                params={"limit": limit, "offset": 0},
                headers={"X-API-Key": api_key} if api_key else {},
            )
            resp.raise_for_status()
            data = resp.json()
        raw = data.get("spots", data) if isinstance(data, dict) else data
        spots: list[Spot] = []
        for item in raw or []:
            messageid = str(item.get("messageid") or item.get("id") or "")
            returned = item.get("nzb_url")
            # Prefer a directly-fetchable URL the API already gives us; otherwise
            # build the newznab NZB URL ourselves.
            nzb_url = (
                str(returned)
                if returned and str(returned).startswith(("http://", "https://"))
                else self._nzb_url(messageid)
            )
            spots.append(
                Spot(
                    id=str(item.get("id") or item.get("messageid") or ""),
                    title=item.get("title", ""),
                    category=str(item.get("category", "")),
                    poster=item.get("poster", ""),
                    filesize=_to_int(item.get("filesize")),
                    nzb_url=nzb_url,
                    stamp=_to_int(item.get("stamp")),
                )
            )
        return spots

    def _db_url(self) -> str:
        c = self.config
        host = c.get("spotweb_db_host", "")
        port = c.get("spotweb_db_port", "3306")
        name = c.get("spotweb_db_name", "")
        user = c.get("spotweb_db_user", "")
        pwd = c.get("spotweb_db_pass", "")
        if not host or not name:
            raise ValueError("MariaDB host en database zijn verplicht")
        return f"mysql+aiomysql://{user}:{pwd}@{host}:{port}/{name}"

    async def _fetch_db(self, limit: int = 200) -> list[Spot]:
        engine = create_async_engine(self._db_url(), pool_pre_ping=True)
        try:
            async with engine.connect() as conn:
                result = await conn.execute(
                    text(
                        "SELECT messageid, title, category, poster, filesize, stamp "
                        "FROM spots ORDER BY stamp DESC LIMIT :limit"
                    ),
                    {"limit": limit},
                )
                rows = result.mappings().all()
        finally:
            await engine.dispose()
        spots: list[Spot] = []
        for row in rows:
            spots.append(
                Spot(
                    id=str(row["messageid"]),
                    title=row["title"] or "",
                    category=str(row["category"] or ""),
                    poster=row["poster"] or "",
                    filesize=_to_int(row["filesize"]),
                    nzb_url=self._nzb_url(str(row["messageid"])),
                    stamp=_to_int(row["stamp"]),
                )
            )
        return spots

    async def _fetch_all(self, limit: int = 200) -> list[Spot]:
        if self.mode == "mariadb":
            return await self._fetch_db(limit)
        return await self._fetch_api(limit)

    async def search(self, rules: list[WatchRule]) -> list[Spot]:
        """Return spots matching ALL rules (AND semantics)."""
        spots = await self._fetch_all()
        if not rules:
            return spots
        return [s for s in spots if all(_matches(s, r) for r in rules)]

    async def test_connection(self) -> dict:
        try:
            spots = await self._fetch_all(limit=1000)
            return {
                "ok": True,
                "message": f"verbonden · {len(spots)} spots",
                "spot_count": len(spots),
            }
        except Exception as exc:  # noqa: BLE001 - surface any failure to the UI
            return {"ok": False, "message": str(exc), "spot_count": None}


def _to_int(value) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None
