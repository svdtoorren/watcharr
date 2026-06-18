from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..schemas import TestResult
from ..services.downloader import DownloadClient
from ..services.spotweb import SpotwebClient
from ..services.store import get_settings_dict, save_settings

router = APIRouter(prefix="/settings", tags=["settings"])

# Keys that hold secrets — masked when read back so they don't leak to the UI.
SECRET_KEYS = {
    "spotweb_api_key",
    "spotweb_db_pass",
    "download_client_api_key",
    "download_client_password",
}
MASK = "••••••••"


@router.get("")
async def read_settings(db: AsyncSession = Depends(get_db)) -> dict:
    values = await get_settings_dict(db)
    return {k: (MASK if k in SECRET_KEYS and v else v) for k, v in values.items()}


@router.put("")
async def update_settings(payload: dict, db: AsyncSession = Depends(get_db)) -> dict:
    current = await get_settings_dict(db)
    # Don't overwrite a stored secret with the mask placeholder.
    to_save = {
        k: v
        for k, v in payload.items()
        if not (k in SECRET_KEYS and v == MASK)
    }
    await save_settings(db, to_save)
    merged = {**current, **to_save}
    return {k: (MASK if k in SECRET_KEYS and v else v) for k, v in merged.items()}


@router.post("/test-spotweb", response_model=TestResult)
async def test_spotweb(payload: dict, db: AsyncSession = Depends(get_db)):
    config = await _merge_for_test(db, payload)
    result = await SpotwebClient.from_settings(config).test_connection()
    return TestResult(**result)


@router.post("/test-download-client", response_model=TestResult)
async def test_download_client(payload: dict, db: AsyncSession = Depends(get_db)):
    config = await _merge_for_test(db, payload)
    result = await DownloadClient.from_settings(config).test_connection()
    return TestResult(ok=result["ok"], message=result["message"])


async def _merge_for_test(db: AsyncSession, payload: dict) -> dict:
    """Merge the posted (live form) values over stored ones, keeping stored
    secrets when the form still shows the mask."""
    stored = await get_settings_dict(db)
    merged = dict(stored)
    for k, v in (payload or {}).items():
        if k in SECRET_KEYS and v == MASK:
            continue
        merged[k] = v
    return merged
