"""Helpers for reading/writing the key/value Setting table as a flat dict."""

import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Setting

# Defaults returned for any key not yet stored. Mirrors the frontend Settings type.
DEFAULTS: dict = {
    "spotweb_connection_type": "api",
    "spotweb_api_url": "",
    "spotweb_api_key": "",
    "spotweb_db_host": "",
    "spotweb_db_port": "3306",
    "spotweb_db_name": "",
    "spotweb_db_user": "",
    "spotweb_db_pass": "",
    "download_client_type": "sabnzbd",
    "download_client_host": "",
    "download_client_port": "",
    "download_client_api_key": "",
    "download_client_username": "",
    "download_client_password": "",
    "download_client_category": "watcharr",
}


async def get_settings_dict(db: AsyncSession) -> dict:
    rows = (await db.execute(select(Setting))).scalars().all()
    stored = {}
    for row in rows:
        try:
            stored[row.key] = json.loads(row.value)
        except (json.JSONDecodeError, TypeError):
            stored[row.key] = row.value
    return {**DEFAULTS, **stored}


async def save_settings(db: AsyncSession, values: dict) -> dict:
    for key, value in values.items():
        encoded = json.dumps(value)
        existing = await db.get(Setting, key)
        if existing:
            existing.value = encoded
        else:
            db.add(Setting(key=key, value=encoded))
    await db.commit()
    return await get_settings_dict(db)
