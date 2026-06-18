import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import settings
from .database import init_db
from .routers import activity, settings as settings_router, watches
from .scheduler import load_all_watches, shutdown_scheduler, start_scheduler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("watcharr")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    start_scheduler()
    await load_all_watches()
    logger.info("Watcharr started")
    yield
    shutdown_scheduler()


app = FastAPI(title="Watcharr", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(watches.router, prefix=settings.API_PREFIX)
app.include_router(activity.router, prefix=settings.API_PREFIX)
app.include_router(settings_router.router, prefix=settings.API_PREFIX)


@app.get(f"{settings.API_PREFIX}/health")
async def health():
    return {"status": "ok"}


# ----- Serve the built frontend (SPA) -----

_static_dir = settings.STATIC_DIR
if os.path.isdir(_static_dir):
    _assets = os.path.join(_static_dir, "assets")
    if os.path.isdir(_assets):
        app.mount("/assets", StaticFiles(directory=_assets), name="assets")

    @app.exception_handler(StarletteHTTPException)
    async def spa_fallback(request, exc):
        # For client-side routes, return index.html on 404s outside the API.
        if exc.status_code == 404 and not request.url.path.startswith(
            settings.API_PREFIX
        ):
            index = os.path.join(_static_dir, "index.html")
            if os.path.isfile(index):
                return FileResponse(index)
        from fastapi.responses import JSONResponse

        return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)

    @app.get("/")
    async def serve_index():
        return FileResponse(os.path.join(_static_dir, "index.html"))
else:
    logger.warning("Static dir %s not found — frontend will not be served", _static_dir)
