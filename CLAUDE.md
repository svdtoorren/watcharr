# Watcharr

A Spotweb automation tool in the spirit of Radarr/Sonarr. You create **Watches**
— saved filter rules — that periodically poll Spotweb and automatically send
matching spots to a download client (SABnzbd or NZBGet), deduplicating so the
same spot is never downloaded twice.

The wireframes this was built from live in `project/Watcharr Wireframes.dc.html`
(and the design chat in `chats/`).

## Architecture

```
┌──────────────┐   filters    ┌──────────────┐  dedup   ┌──────────────────┐
│   Spotweb    │ ───────────▶ │  Watch run   │ ───────▶ │  Download client  │
│ (API/MariaDB)│              │ (scheduler)  │          │ (SABnzbd/NZBGet)  │
└──────────────┘              └──────┬───────┘          └──────────────────┘
                                     │ logs every spot (sent/skipped/failed)
                                     ▼
                          Watcharr's own MariaDB schema
```

- **Backend**: Python 3.11 + FastAPI + async SQLAlchemy + APScheduler.
- **Frontend**: React 18 + Vite + TypeScript + React Router.
- **Database**: an external MariaDB (the same one Spotweb uses), with a
  dedicated `watcharr` schema. Tables are auto-created on startup.
- **Scheduling**: each active Watch gets an APScheduler interval job. Creating,
  editing, pausing or deleting a Watch reschedules it immediately.

## Layout

```
backend/app/
  main.py              FastAPI app, lifespan (init DB + scheduler), SPA serving
  config.py            env-driven settings (DATABASE_URL, STATIC_DIR …)
  database.py          async engine + session + init_db()
  models.py            Watch, Activity, Setting tables
  schemas.py           Pydantic v2 request/response models
  scheduler.py         APScheduler jobs, (re)schedule per Watch
  routers/             watches, activity, settings
  services/
    spotweb.py         SpotwebClient — API + direct-MariaDB modes, rule matching
    downloader.py      SABnzbdClient / NZBGetClient
    watcher.py         run_watch(): fetch → filter → dedup → send → log
    store.py           key/value Setting helpers (with secret masking)
frontend/src/
  pages/               WatchesPage, WatchDetailPage, ActivityPage, SettingsPage
  modals/              AddEditWatchModal (rule-builder UX)
  components/          Layout, Sidebar, StatusDot
  api.ts, types.ts, utils.ts, index.css
```

## Filter rules

A Watch holds a list of `{field, operator, value}` rules, ANDed together.
The rule-builder UI (Variant B from the wireframes) is the chosen UX.

| field    | operators                          |
|----------|------------------------------------|
| poster   | is · contains · not_contains       |
| title    | contains · not_contains · starts_with |
| category | in · not_in                        |
| size     | gt · lt · gte · lte (value in MB)  |
| date     | after · before (ISO date)          |

`not_*` operators render with a red outline (matching Spotweb's `~` exclude).

## Dedup

A spot is "already sent" for a Watch if an Activity row exists with that
`watch_id` + `spot_id` and status `sent`. On the next run such spots are logged
as `skipped_duplicate` instead of being re-sent.

## Running in development

Two terminals:

```bash
# Backend (http://localhost:8000)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL="mysql+aiomysql://user:pass@localhost:3306/watcharr"
uvicorn app.main:app --reload

# Frontend (http://localhost:5173, proxies /api to :8000)
cd frontend
npm install
npm run dev
```

## Running with Docker

A single container builds the frontend and serves it from the backend:

```bash
DB_HOST=192.168.1.20 DB_USER=watcharr DB_PASS=secret DB_NAME=watcharr \
  docker compose up --build
```

Then open http://localhost:8000. Configure the Spotweb and download-client
connections under **Settings**.

### Environment variables

| var          | default              | meaning                              |
|--------------|----------------------|--------------------------------------|
| `DATABASE_URL` | (compose builds it) | full SQLAlchemy async MySQL URL     |
| `DB_HOST`    | host.docker.internal | MariaDB host (compose convenience)   |
| `DB_PORT`    | 3306                 | MariaDB port                         |
| `DB_NAME`    | watcharr             | Watcharr's own database              |
| `DB_USER` / `DB_PASS` | watcharr    | credentials for that database        |
| `STATIC_DIR` | /app/static          | where the built SPA is served from   |

Spotweb and download-client connection details are **not** env vars — they're
configured in the UI under Settings and stored in the database.
