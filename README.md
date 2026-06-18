# Watcharr

A Spotweb automation tool in the spirit of Radarr/Sonarr. You create
**Watches** — saved filter rules — that periodically poll Spotweb and
automatically send matching spots to a download client (SABnzbd or NZBGet),
deduplicating so the same spot is never downloaded twice.

- **Backend:** Python 3.11 + FastAPI + async SQLAlchemy + APScheduler
- **Frontend:** React 18 + Vite + TypeScript (built and served by the backend)
- **Database:** an external MariaDB — the same one Spotweb uses — with a
  dedicated `watcharr` schema. Tables are created automatically on startup.

The single Docker image builds the frontend and serves it from the backend, so
deploying Watcharr means running **one container** that talks to your existing
MariaDB.

---

## Requirements

- Docker + Docker Compose
- A reachable **MariaDB / MySQL** server with:
  - an empty database/schema for Watcharr (default name `watcharr`), and
  - a user that can create tables in it (Watcharr auto-creates its schema on
    first start).
- A running **Spotweb** instance (reached via its API or directly via its
  MariaDB database).
- A running **download client** — SABnzbd or NZBGet.

> Watcharr does **not** run its own database. Point it at a MariaDB you already
> have. The same server that hosts Spotweb is the natural choice; just give
> Watcharr its own database so its tables don't collide with Spotweb's.

---

## Quick start (Docker Compose)

The repository ships with a `docker-compose.yml` that builds the image and wires
up the database connection from `DB_*` variables.

```bash
DB_HOST=192.168.1.20 \
DB_PORT=3306 \
DB_NAME=watcharr \
DB_USER=watcharr \
DB_PASS=secret \
  docker compose up --build -d
```

Then open <http://localhost:8000> and finish the configuration under
**Settings** (Spotweb + download client — see [Configuration](#configuration)).

### Using a `.env` file

Instead of inlining the variables, drop a `.env` file next to
`docker-compose.yml` (Compose reads it automatically):

```dotenv
# .env
DB_HOST=192.168.1.20
DB_PORT=3306
DB_NAME=watcharr
DB_USER=watcharr
DB_PASS=secret
```

```bash
docker compose up --build -d
```

### Connecting to a MariaDB on the Docker host

If MariaDB runs on the **same host** as Docker (not in another container), use
`host.docker.internal` as the host — the compose file already maps it to the
host gateway:

```bash
DB_HOST=host.docker.internal docker compose up --build -d
```

This is also the default if you don't set `DB_HOST` at all.

---

## Configuration

Watcharr is configured in two layers.

### 1. Deployment configuration — environment variables

These are read at container startup and define how Watcharr reaches **its own**
database and how the app is hosted. Set them via Compose (`DB_*` convenience
vars) or pass a full `DATABASE_URL` directly.

| Variable       | Default                  | Meaning                                              |
|----------------|--------------------------|------------------------------------------------------|
| `DATABASE_URL` | *(built from `DB_*`)*     | Full SQLAlchemy async MySQL URL. Overrides `DB_*`.  |
| `DB_HOST`      | `host.docker.internal`   | MariaDB host (Compose convenience).                  |
| `DB_PORT`      | `3306`                   | MariaDB port.                                        |
| `DB_NAME`      | `watcharr`               | Watcharr's own database.                             |
| `DB_USER`      | `watcharr`               | Credentials for that database.                       |
| `DB_PASS`      | `watcharr`               | Credentials for that database.                       |
| `STATIC_DIR`   | `/app/static`            | Where the built SPA is served from inside the image. |
| `API_PREFIX`   | `/api`                   | URL prefix for the JSON API.                         |

The Compose file assembles `DATABASE_URL` from the `DB_*` variables:

```
mysql+aiomysql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}
```

If you'd rather set the connection string yourself (e.g. a non-default driver or
extra parameters), set `DATABASE_URL` directly and ignore the `DB_*` vars:

```bash
DATABASE_URL="mysql+aiomysql://watcharr:secret@db.local:3306/watcharr" \
  docker compose up -d
```

> **Spotweb and download-client connection details are _not_ environment
> variables.** They're configured in the UI (next section) and stored in the
> database, so they survive restarts and can be changed without redeploying.

### 2. Application configuration — the Settings page

After the container is up, open <http://localhost:8000> and go to **Settings**.
Secrets (API keys, passwords) are masked once saved.

**Spotweb connection** — choose one of two modes:

- **API** — provide the Spotweb **API URL** and **API key**.
- **Direct database** — provide the Spotweb MariaDB **host, port, database name,
  user and password** (Watcharr reads Spotweb's tables directly).

**Download client** — choose **SABnzbd** or **NZBGet** and provide:

- **host** and **port**
- **SABnzbd:** API key
- **NZBGet:** username and password
- a **category** to tag downloads with (default `watcharr`).

Once both are configured you can create **Watches** (filter rules) that poll
Spotweb on an interval and forward matching spots to the download client.

---

## Updating

Pull the latest code and rebuild the image; your data lives in MariaDB, not in
the container, so nothing is lost:

```bash
git pull
docker compose up --build -d
```

## Logs & lifecycle

```bash
docker compose logs -f watcharr   # follow logs
docker compose restart watcharr   # restart
docker compose down               # stop and remove the container
```

---

## Running without Compose

You can build and run the image directly:

```bash
docker build -t watcharr .
docker run -d --name watcharr -p 8000:8000 \
  --add-host host.docker.internal:host-gateway \
  -e DATABASE_URL="mysql+aiomysql://watcharr:secret@host.docker.internal:3306/watcharr" \
  watcharr
```

---

## Local development

Run the backend and frontend separately (two terminals):

```bash
# Backend — http://localhost:8000
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL="mysql+aiomysql://user:pass@localhost:3306/watcharr"
uvicorn app.main:app --reload
```

```bash
# Frontend — http://localhost:5173 (proxies /api to :8000)
cd frontend
npm install
npm run dev
```

See [`CLAUDE.md`](CLAUDE.md) for the full architecture overview and code layout.
