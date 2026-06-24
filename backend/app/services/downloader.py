"""Download-client integration — send NZBs to SABnzbd or NZBGet."""

from abc import ABC, abstractmethod

import httpx

from .spotweb import Spot


class DownloadClient(ABC):
    @abstractmethod
    async def send(self, spot: Spot) -> bool:
        ...

    @abstractmethod
    async def test_connection(self) -> dict:
        ...

    @abstractmethod
    async def list_categories(self) -> list[str]:
        """Return the categories configured in the download client."""
        ...

    @staticmethod
    def from_settings(settings_dict: dict, category: str | None = None) -> "DownloadClient":
        client_type = settings_dict.get("download_client_type", "sabnzbd")
        host = settings_dict.get("download_client_host", "")
        port = settings_dict.get("download_client_port", "")
        # Category is per-watch now; fall back to a (legacy) stored setting only
        # when no explicit category is supplied.
        if category is None:
            category = settings_dict.get("download_client_category", "")
        if client_type == "nzbget":
            return NZBGetClient(
                host=host,
                port=port,
                username=settings_dict.get("download_client_username", ""),
                password=settings_dict.get("download_client_password", ""),
                category=category,
            )
        return SABnzbdClient(
            host=host,
            port=port,
            api_key=settings_dict.get("download_client_api_key", ""),
            category=category,
        )


def _base_url(host: str, port: str) -> str:
    host = host.rstrip("/")
    if not host:
        raise ValueError("Geen host ingesteld voor de download-client")
    if "://" not in host:
        host = f"http://{host}"
    return f"{host}:{port}" if port else host


class SABnzbdClient(DownloadClient):
    def __init__(self, host: str, port: str, api_key: str, category: str):
        self.host = host
        self.port = port
        self.api_key = api_key
        self.category = category

    @property
    def _url(self) -> str:
        return f"{_base_url(self.host, self.port)}/api"

    async def send(self, spot: Spot) -> bool:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                self._url,
                params={
                    "mode": "addurl",
                    "name": spot.nzb_url,
                    "nzbname": spot.title,
                    "cat": self.category,
                    "apikey": self.api_key,
                    "output": "json",
                },
            )
            resp.raise_for_status()
            data = resp.json()
        return bool(data.get("status", False))

    async def test_connection(self) -> dict:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    self._url,
                    params={
                        "mode": "version",
                        "apikey": self.api_key,
                        "output": "json",
                    },
                )
                resp.raise_for_status()
                data = resp.json()
            version = data.get("version", "?")
            return {"ok": True, "message": f"SABnzbd {version} bereikbaar"}
        except Exception as exc:  # noqa: BLE001
            return {"ok": False, "message": str(exc)}

    async def list_categories(self) -> list[str]:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                self._url,
                params={"mode": "get_cats", "apikey": self.api_key, "output": "json"},
            )
            resp.raise_for_status()
            data = resp.json()
        # SABnzbd returns "*" for the implicit Default category — drop it.
        return [c for c in data.get("categories", []) if c and c != "*"]


class NZBGetClient(DownloadClient):
    def __init__(self, host: str, port: str, username: str, password: str, category: str):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.category = category

    @property
    def _url(self) -> str:
        return f"{_base_url(self.host, self.port)}/jsonrpc"

    async def _rpc(self, method: str, params: list) -> dict:
        async with httpx.AsyncClient(
            timeout=30.0,
            auth=(self.username, self.password) if self.username else None,
        ) as client:
            resp = await client.post(
                self._url,
                json={"method": method, "params": params, "id": 1, "jsonrpc": "2.0"},
            )
            resp.raise_for_status()
            return resp.json()

    async def send(self, spot: Spot) -> bool:
        # appendurl(NZBFilename, NZBContent(url), Category, Priority, AddToTop,
        #           AddPaused, DupeKey, DupeScore, DupeMode)
        data = await self._rpc(
            "append",
            [
                f"{spot.title}.nzb",
                spot.nzb_url,
                self.category,
                0,
                False,
                False,
                "",
                0,
                "SCORE",
            ],
        )
        return bool(data.get("result"))

    async def test_connection(self) -> dict:
        try:
            data = await self._rpc("version", [])
            return {"ok": True, "message": f"NZBGet {data.get('result', '?')} bereikbaar"}
        except Exception as exc:  # noqa: BLE001
            return {"ok": False, "message": str(exc)}

    async def list_categories(self) -> list[str]:
        # NZBGet exposes categories as CategoryX.Name entries in its config.
        data = await self._rpc("config", [])
        cats = []
        for opt in data.get("result", []):
            name = opt.get("Name", "")
            if name.startswith("Category") and name.endswith(".Name"):
                value = opt.get("Value", "")
                if value:
                    cats.append(value)
        return cats
