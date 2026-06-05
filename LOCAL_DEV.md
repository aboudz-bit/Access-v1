# Local Development (Windows)

How to run Access locally on Windows, off-Replit. Verified on Windows 11, Node 24, pnpm 10.

## Prerequisites

- **Node.js 24** (`node -v`).
- **pnpm 10** — not required globally; these instructions invoke it via `corepack pnpm@10`.
  (Optional: in an **Administrator** terminal run `corepack enable pnpm` once to get a plain `pnpm` command.)
- **Docker Desktop** (for Postgres). Any Postgres 16 also works if you set `DATABASE_URL` to it.
- **Git for Windows** — provides the `sh` that the root `preinstall` script needs.

## One-time setup

```powershell
# 1. From the project root: make Git's Unix tools available for this shell
#    (the root preinstall script uses `sh`), then install dependencies.
$env:PATH = "C:\Program Files\Git\bin;C:\Program Files\Git\usr\bin;" + $env:PATH
corepack pnpm@10 install

# 2. Create your local .env from the template
Copy-Item .env.example .env

# 3. Start a Postgres 16 container on host port 5433 (5432 is often taken)
docker run -d --name access-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=access -p 5433:5432 postgres:16

# 4. Apply the schema and seed demo data
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/access"
corepack pnpm@10 --filter "@workspace/db" run push
corepack pnpm@10 --filter "@workspace/api-server" run seed
```

If the Postgres container already exists later, just start it: `docker start access-pg`.

## Running (two terminals)

```powershell
# Terminal 1 — API server (REST + WebRTC signaling) on http://localhost:8080
.\dev-api.ps1

# Terminal 2 — Frontend (Vite) on http://localhost:24510
.\dev-web.ps1
```

Then open **http://localhost:24510**.

The helper scripts load `.env`, set the per-service `PORT` (and `BASE_PATH` for the
frontend), and start each service. The frontend proxies `/api` (REST) and `/api/ws`
(WebRTC signaling) to `http://localhost:8080` — see `artifacts/access/vite.config.ts`.

> Raw equivalent (no helper scripts), if you prefer:
> ```powershell
> # API
> $env:DATABASE_URL="postgresql://postgres:postgres@localhost:5433/access"; $env:SESSION_SECRET="local-dev-secret-change-me"; $env:NODE_ENV="development"; $env:PORT="8080"
> corepack pnpm@10 --filter "@workspace/api-server" run build
> node --enable-source-maps artifacts/api-server/dist/index.mjs
> # Frontend
> $env:PORT="24510"; $env:BASE_PATH="/"
> corepack pnpm@10 --filter "@workspace/access" run dev
> ```

## URLs

| What | URL |
|------|-----|
| Frontend (open this) | http://localhost:24510 |
| API (direct) | http://localhost:8080/api |
| Health check | http://localhost:8080/api/healthz |

## Demo accounts (from the seed)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@access.app` | `Admin123` |
| User | `user@access.app` | `User123` |
| Interpreter | `interpreter@access.app` | `Inter123` |

## Environment variables

| Var | Used by | Local value | Notes |
|-----|---------|-------------|-------|
| `DATABASE_URL` | api-server, db, seed | `postgresql://postgres:postgres@localhost:5433/access` | Required. |
| `SESSION_SECRET` | api-server (auth) | any string | Optional in dev; **required in production**. |
| `NODE_ENV` | both | `development` | Pretty logs + dev plugins. |
| `PORT` | each service | API `8080`, web `24510` | Set per-service by the helper scripts. |
| `BASE_PATH` | frontend (Vite) | `/` | Required by `vite.config.ts`. |
| `API_PROXY_TARGET` | frontend (Vite) | `http://localhost:8080` | Optional proxy override. |
| `LOG_LEVEL` | api-server | `info` | Optional. |

## Notes / gotchas

- **Postgres on 5433, not 5432** — chosen to avoid colliding with any other Postgres
  already bound to 5432. Change `.env` and the Vite proxy target together if you move it.
- **`sh` for install** — the root `preinstall` guard runs `sh -c ...`; put Git's
  `bin`/`usr\bin` on `PATH` (as in setup step 1) or run installs from Git Bash.
- **Native binaries on Windows** — `pnpm-workspace.yaml` previously excluded all
  non-Linux native binaries; the Windows-x64 builds of rollup, lightningcss, and
  tailwind-oxide are now kept so Vite/Tailwind run here. They are platform-gated, so
  Linux/Replit installs are unaffected.
- **WebRTC** — getting actual video flowing requires two browsers and (across networks)
  a TURN server. STUN-only is configured today; see NEXT_STEPS.md. Local same-machine
  testing of the *call screen UI* works; media may not negotiate without TURN off-LAN.
