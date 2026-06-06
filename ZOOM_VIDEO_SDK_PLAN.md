# Access — Zoom Video SDK Implementation Plan (FINAL)

> Status: **Plan only. No code changed.** Companion to ARCHITECTURE.md / PROJECT_STATE.md / NEXT_STEPS.md / PRODUCTION_READINESS.md.
> Decision date: 2026-06-06.

## Decision (confirmed — "Path B")

**Zoom Video SDK becomes the primary video engine for Access.** The existing
peer‑to‑peer WebRTC stack is demoted to a **fallback / local‑dev path only**.

Hard constraints that shape every choice below:

1. Zoom Video SDK is the **primary** provider.
2. WebRTC remains **fallback / dev mode only**.
3. The Access user flow is **unchanged**: login → select language → auto‑assign interpreter → live video **inside Access**.
4. Users **never see or open Zoom**.
5. **No Zoom meeting links.**
6. **No Zoom Meetings API** (this is the *Video* SDK, a different product).
7. Access keeps **its own UI and branding**.
8. Zoom handles **video, audio, media reliability, and (later) recording**.
9. **Recording is the next phase**, after Zoom calling works.
10. The **exact first PR** is identified at the end.

> Why Video SDK and not Meetings: the Video SDK is a *headless* media engine — you join a named "session" (topic) with a signed JWT and render the streams into **your own** DOM. There is no Zoom meeting object, no join URL, no Zoom chrome. That is exactly what requirements 4–7 demand. The Meetings SDK/API (meeting links, Zoom UI) is explicitly **out of scope**.

---

## 1. Updated architecture

### 1.1 Current state (today, in‑repo)

Pure peer‑to‑peer WebRTC:

- Frontend `call.tsx` → module singleton `artifacts/access/src/lib/webrtc-slot.ts` (RTCPeerConnection, getUserMedia, mic/cam toggle).
- Signaling over WebSocket `/api/ws` → `artifacts/api-server/src/lib/signaling.ts` (in‑memory rooms, offer/answer/ICE relay, abandoned‑session cleanup + sweeper).
- ICE = **Google STUN only, no TURN** → fails on strict NAT/firewalls.
- In‑memory rooms → **single‑instance only** (breaks on autoscale > 1).
- Session row drives everything (`artifacts/api-server/src/routes/sessions.ts`): `/sessions/request` claims an interpreter atomically and opens the session **directly `active`** (V1 has no accept/decline step).

### 1.2 Target state (Zoom primary, WebRTC fallback)

Introduce a **video‑provider seam** on both ends. The session/matchmaking/auth
machinery is untouched; only the **media transport** becomes pluggable.

```
            login → select language → POST /sessions/request
                         (unchanged: atomic interpreter claim, status=active)
                                        │
                                        ▼
                        session row now also carries:
                          video_provider      ('zoom' | 'webrtc')
                          video_session_name  (opaque Zoom topic, e.g. access-<uuid>)
                                        │
        client opens /call/:id  ───────┤
                                        ▼
                    POST /sessions/{id}/video-token   ← NEW endpoint
                                        │
                 ┌──────────────────────┴───────────────────────┐
          provider = 'zoom'                              provider = 'webrtc'
          server signs a Video SDK JWT                   server returns {provider:'webrtc'}
          (HS256, SDK Key/Secret, topic,                 → existing WS signaling path
           role, identity, exp)                            (unchanged, dev/fallback)
                 │                                                │
                 ▼                                                ▼
      Frontend ZoomVideoSession adapter              Frontend webrtc-slot (as today)
      @zoom/videosdk: createClient → init →          getUserMedia + RTCPeerConnection
      join(topic, jwt, name) → renders self +        over /api/ws
      remote into Access's OWN video DOM
                 │
                 ▼
            Zoom global media infrastructure
            (video, audio, reliability, TURN-equivalent, future cloud recording)
```

Key points:

- **One provider per session, decided at creation and stored on the row** so both
  participants always join the *same* transport and the same Zoom topic. No
  mid‑call provider switching in this phase.
- The **frontend renders Zoom streams into the existing Access call UI** (same
  layout as `call.tsx`: full‑bleed remote video, local PIP, Access logo,
  mic/cam/end controls). Users never perceive Zoom.
- The **provider abstraction** is the entire architectural change. Everything
  else (auth cookie, role gating, language selection, interpreter claim, session
  lifecycle, sweeper) stays as‑is.
- WebRTC signaling (`/api/ws`, `signaling.ts`) and `webrtc-slot.ts` remain in the
  tree as the **fallback** path, selected when `video_provider='webrtc'`.

### 1.3 Provider selection logic

Server decides at `/sessions/request` time and writes `video_provider`:

- `VIDEO_PROVIDER=zoom` (production default once live) → `'zoom'`.
- `VIDEO_PROVIDER=webrtc` (local dev default) → `'webrtc'`.
- If `VIDEO_PROVIDER=zoom` but Zoom credentials are missing/invalid at boot →
  log a loud warning and **fall back to `'webrtc'`** (degrade, don't crash).
- (Future) per‑request fallback if Zoom token minting fails — out of scope for
  the first phase; the sticky column makes it easy to add later.

---

## 2. Required Zoom accounts / credentials

1. **A Zoom account** with **Video SDK** enabled (this is *not* a regular Zoom
   Meetings paid plan — it is the developer "Video SDK" product on the Zoom App
   Marketplace).
2. In the **Zoom App Marketplace → Develop → Build App → Video SDK**, create a
   Video SDK app. This yields:
   - **SDK Key**
   - **SDK Secret**
   These are the only credentials needed to mint join JWTs and to use the web SDK.
3. **Cloud Recording entitlement** (Phase 2 only): cloud recording for Video SDK
   must be **enabled on the account** and is billed separately. Not required to
   get calling working — defer until recording phase.
4. **Account ownership / billing**: a company‑owned Zoom Video SDK account (not a
   personal one), so credentials, minutes, and recordings belong to the org.
   Capture who owns it and where the secret is stored.

> No OAuth app, no Meetings scopes, no user‑level Zoom accounts for employees.
> Interpreters and users authenticate to **Access**, never to Zoom.

---

## 3. Required environment variables

Add to `.env.example` (documented) and provision in Replit secrets for prod.

| Variable | Scope | Required | Purpose / default |
|---|---|---|---|
| `VIDEO_PROVIDER` | api‑server | no | `zoom` or `webrtc`. **Default `webrtc`** (so nothing changes until explicitly switched). Set to `zoom` in prod once verified. |
| `ZOOM_SDK_KEY` | api‑server | when `zoom` | Video SDK Key. Used to sign join JWTs. |
| `ZOOM_SDK_SECRET` | api‑server | when `zoom` | Video SDK Secret. **Secret** — never sent to the client, never logged. |
| `ZOOM_TOKEN_TTL_SECONDS` | api‑server | no | JWT lifetime, default e.g. `7200`. Token must outlive a max call. |
| `VITE_*` (none) | frontend | no | The frontend gets **no Zoom secrets**. It receives a short‑lived signed JWT from `/sessions/{id}/video-token` at call time only. |

Notes:
- `ZOOM_SDK_SECRET` must be added to the existing pino redaction list and must
  not appear in any response body.
- Boot validation: if `VIDEO_PROVIDER=zoom` and either key/secret is empty, warn
  and fall back to `webrtc` rather than refusing to boot.

---

## 4. Backend changes (`artifacts/api-server`, `lib/db`, `lib/api-spec`)

### 4.1 New: Zoom JWT signing helper
- `artifacts/api-server/src/lib/zoom.ts` (new): signs the Video SDK JWT
  (HS256 with `ZOOM_SDK_SECRET`) containing the documented Video SDK payload:
  `app_key` (SDK key), `tpc` (topic = `video_session_name`), `role_type`
  (1 = host, 0 = participant), `user_identity`, `version`, `iat`, `exp`.
  - Assign **interpreter = host (role 1)**, **user = participant (role 0)**.
    Host role is what later authorizes cloud recording, so this choice is
    forward‑compatible with Phase 2.
  - No new heavy dependency required (HMAC‑SHA256 is already used for the auth
    cookie); a tiny JWT encode can reuse the existing crypto utilities or a
    minimal `jsonwebtoken`‑style helper.

### 4.2 New: provider abstraction
- `artifacts/api-server/src/lib/video-provider.ts` (new): `resolveProvider()`
  reads `VIDEO_PROVIDER` + credential presence and returns `'zoom' | 'webrtc'`.
  Single source of truth used by `/sessions/request` and the token endpoint.

### 4.3 New endpoint: `POST /sessions/{id}/video-token`
- File: extend `artifacts/api-server/src/routes/sessions.ts`.
- Auth: `requireAuth()` + same participant/admin check already used by
  `GET /sessions/:id` and `/end` (only the session's user, its interpreter, or an
  admin). Reject if session not `active` (409).
- Behavior:
  - Load the session row; read its stored `video_provider` + `video_session_name`.
  - If `'zoom'`: mint a JWT scoped to that topic and the caller's role
    (interpreter→host, user→participant), return
    `{ provider:'zoom', token, sessionName, userIdentity, role, sdkKey }`.
    - `userIdentity` should be **privacy‑safe** (e.g. `user-<id>` /
      `interpreter-<id>`), never the interpreter's real name to a user — this
      preserves the existing interpreter‑identity scrub.
  - If `'webrtc'`: return `{ provider:'webrtc' }` (client uses the existing WS path).
- Never returns the SDK **secret**.

### 4.4 `/sessions/request` change (set provider at creation)
- In the existing handler (`sessions.ts`, the atomic‑claim block), when creating
  the session row, also set:
  - `videoProvider = resolveProvider()`
  - `videoSessionName = "access-" + <uuid>` (opaque, unique topic; use
    `crypto.randomUUID()`).
- No change to matchmaking, status, or the interpreter‑identity rules.

### 4.5 Mappers / DTO
- `artifacts/api-server/src/lib/mappers.ts` `toSession`: include `videoProvider`
  in the DTO (so the client can branch without a second call if desired). Do
  **not** put `videoSessionName` or any token in the generic session DTO — those
  come only from the dedicated token endpoint.

### 4.6 Contract (source of truth) + codegen
- `lib/api-spec/openapi.yaml`:
  - Add `videoProvider` (enum `zoom|webrtc`) to the `Session` schema.
  - Add path `POST /sessions/{id}/video-token` with a new `VideoToken` response
    schema (`provider`, `token?`, `sessionName?`, `sdkKey?`, `role?`,
    `userIdentity?`).
  - (Recommended cleanup) fix `/sessions/request` `404`→ keep, but this is the
    moment to also document the existing flow accurately.
- Regenerate: `pnpm --filter @workspace/api-spec run codegen` (Orval →
  `api-client-react` hooks + `api-zod` schemas). This produces a typed
  `useGetVideoToken`/`useVideoToken` hook for the frontend.

### 4.7 Logging / security
- Add `ZOOM_SDK_SECRET` to pino redaction.
- Apply the (planned) Zod request validation to the new endpoint params.

### 4.8 WebRTC path — **left intact**
- `signaling.ts`, `/api/ws`, the sweeper, and `endAbandonedSession` stay exactly
  as they are; they simply only get exercised when `video_provider='webrtc'`.

---

## 5. Frontend changes (`artifacts/access`)

### 5.1 New dependency
- `@zoom/videosdk` (Zoom Video SDK for Web) added to `artifacts/access`.
  - Respect the hardened `.npmrc` (`minimumReleaseAge`); pin an allowed version
    in the `pnpm-workspace.yaml` catalog.
  - Note SDK web requirements: secure context (HTTPS) in prod, and the SDK may
    need specific COOP/COEP headers / SharedArrayBuffer for some features — see
    Deployment §7.

### 5.2 New: provider‑agnostic call session abstraction
- `artifacts/access/src/lib/video/types.ts` (new): a small `VideoSession`
  interface — `join()`, `leave()`, `toggleMic()`, `toggleCamera()`, plus
  callbacks `onRemoteConnectedChange` and element binders
  (`bindLocalEl`, `bindRemoteEl`/container).
- `artifacts/access/src/lib/video/zoom-session.ts` (new): implements
  `VideoSession` with `@zoom/videosdk`:
  - `ZoomVideo.createClient()` → `client.init(...)` → `client.join(topic, jwt,
    userIdentity)` → `client.getMediaStream()` → `startVideo` / `startAudio`.
  - Render **into Access's own DOM** (self‑view into the existing local PIP
    `<video>`/container; remote participant into the full‑bleed area) using the
    SDK's `attachVideo`/video‑player elements (or canvas, per SDK version).
  - Map events: first remote participant video render →
    `onRemoteConnectedChange(true)`; participant leave → `(false)` (drives the
    existing "Connecting…" overlay).
  - `toggleMic`/`toggleCamera` → `stream.muteAudio/unmuteAudio`,
    `stream.stopVideo/startVideo`.
  - `leave()` → `client.leave()` + dispose.
- `artifacts/access/src/lib/video/webrtc-session.ts` (new, thin): wraps the
  **existing** `webrtc-slot.ts` behind the same `VideoSession` interface (no
  behavior change — just an adapter so `call.tsx` is provider‑agnostic).

### 5.3 `call.tsx` refactor (keep UI identical)
- File: `artifacts/access/src/pages/call.tsx`.
- On mount: call the new `/sessions/{id}/video-token` hook. Branch on
  `provider`:
  - `'zoom'` → construct `ZoomVideoSession` with the returned `{token,
    sessionName, sdkKey, userIdentity, role}` and `join()`.
  - `'webrtc'` → construct the WebRTC adapter (today's path).
- Keep the **exact same JSX/branding**: Access logo, language pill, full‑bleed
  remote video, local PIP, mic/cam/end buttons, RTL/i18n. Only the wiring behind
  the refs changes.
- Keep the existing session‑status poll (`refetchInterval: 3000`) to leave when
  the session ends/declines — provider‑independent.
- `handleEndCall` still calls `POST /sessions/{id}/end`; additionally call the
  provider `leave()` in cleanup.

### 5.4 No user‑facing Zoom anything
- No Zoom branding, no SDK‑provided UI, no links. The SDK is used in **headless**
  mode and rendered into Access components only. (Requirements 4–7.)

---

## 6. Database changes (`lib/db`)

Add two columns to `sessions` (`lib/db/src/schema/sessions.ts`):

| Column | Type | Null | Default | Purpose |
|---|---|---|---|---|
| `video_provider` | `varchar(16)` | not null | `'webrtc'` | Sticky transport for the session. |
| `video_session_name` | `varchar(64)` | null | — | Opaque Zoom topic (e.g. `access-<uuid>`). Null for webrtc sessions. |

- Enum enforced in app code (consistent with the existing `status` pattern —
  plain varchars, no PG enums).
- **Migration discipline:** the repo currently uses `drizzle-kit push` (no
  versioned migrations). Adding nullable/defaulted columns is additive and safe,
  but per PRODUCTION_READINESS §9 this is the right moment to **introduce
  `drizzle-kit generate` + `migrate`** so the prod schema change is a checked‑in,
  reversible migration rather than a `push`. (Can be done in the same PR or the
  one just before it.)
- No data backfill needed: existing/old sessions are historical; new sessions get
  the columns set at creation.

---

## 7. Deployment requirements

- **HTTPS / secure context**: the Web Video SDK requires a secure context for
  camera/mic; Replit serves HTTPS in prod — fine. Local dev over `http://localhost`
  is treated as secure by browsers — fine.
- **Cross‑origin isolation headers**: some Web Video SDK features (e.g. certain
  video rendering / SharedArrayBuffer paths) need `Cross-Origin-Opener-Policy:
  same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. Verify against
  the SDK version chosen; if required, add these headers to the static frontend
  serving config (Replit web artifact) **and** confirm they don't break the
  existing app. This is a known Video‑SDK‑on‑web gotcha — validate early.
- **Secrets**: `ZOOM_SDK_KEY` / `ZOOM_SDK_SECRET` provisioned as Replit secrets,
  never in the repo.
- **CORS**: unchanged (same‑origin behind the Replit router). The token endpoint
  is same‑origin.
- **Autoscale**: **Zoom adoption removes the single‑instance WebRTC‑signaling
  blocker** for Zoom sessions — Zoom carries the media, so `/api/ws` rooms are no
  longer on the call path. (Keep single‑instance only if you still serve WebRTC
  fallback in prod; cleanest is `VIDEO_PROVIDER=zoom` in prod and webrtc for
  dev.) The session **sweeper** still runs and still correctly ends abandoned
  sessions by row status (provider‑independent).
- **Build**: `@zoom/videosdk` is a client dep bundled by Vite — confirm bundle
  builds and the SDK's web worker/wasm assets are emitted into `dist/public`.
- **Health**: `/api/healthz` unchanged. Add an optional startup log line
  reporting the resolved `VIDEO_PROVIDER`.

---

## 8. Testing plan

**Unit / server**
- JWT signing helper: payload fields, role mapping (interpreter→host,
  user→participant), expiry, signature verifies with the secret.
- `resolveProvider()`: matrix of `VIDEO_PROVIDER` × credential presence →
  expected provider + fallback behavior.
- `/sessions/{id}/video-token`: authz (participant/interpreter/admin allow;
  stranger 403; non‑active 409; unknown id 404); zoom vs webrtc response shapes;
  secret never present in the body; `userIdentity` privacy‑safe.

**Contract**
- OpenAPI lints; Orval codegen runs clean; generated `VideoToken` type matches
  the handler. `pnpm run typecheck` green across packages.

**Integration / manual (two‑browser)**
- Full flow with `VIDEO_PROVIDER=zoom`: user login → select language →
  auto‑assign → both land in‑Access call → **bidirectional audio+video** renders
  inside Access UI → mic/cam toggle works → End frees the interpreter
  (`status → available`).
- Fallback: `VIDEO_PROVIDER=webrtc` → existing path still works unchanged.
- Network resilience: a participant on a restrictive network (mobile/4G,
  corporate NAT) connects with Zoom where the **STUN‑only WebRTC path failed** —
  this is the core reason for the migration; verify explicitly.
- Abandonment: close a tab mid‑call → sweeper/`/end` still frees the interpreter.
- Privacy: confirm a **user** never receives the interpreter's real name via the
  token endpoint or DTO.
- i18n/RTL: Arabic‑first UI and controls unchanged on the call screen.

**Pre‑prod**
- Verify cross‑origin‑isolation headers (if needed) don't regress the app.
- Confirm Zoom minutes are being consumed against the expected account (cost
  sanity check) and watch for token/role errors in logs.

---

## 9. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Web Video SDK COOP/COEP header requirement breaks the static app | High | Validate header needs against the chosen SDK version in PR that wires the client; gate behind a test build before prod. |
| Rendering integration (self/remote into Access DOM) is fiddly per SDK version (canvas vs video‑player element) | Medium | Pin a known SDK version; build a tiny standalone spike page first; keep the `VideoSession` interface stable so the renderer can change without touching `call.tsx`. |
| Token role/identity mistakes leak interpreter identity to users | High | `userIdentity = role-<id>` only; reuse existing interpreter‑scrub rule; unit‑test the token endpoint. |
| Secret leakage (`ZOOM_SDK_SECRET`) | High | Server‑only signing; pino redaction; never in DTO or client bundle; Replit secret store. |
| Cost overrun (per‑minute billing, runaway/abandoned sessions) | Medium | Sweeper already ends abandoned sessions; add max‑call‑duration guard later; monitor minutes; alert on spend. |
| `drizzle-kit push` mishandles the column add in prod | Medium | Switch to `generate`+`migrate` for this change (see §6). |
| Provider drift between the two participants | Medium | Provider is decided once and **stored on the row**; both read the same value. |
| Vendor lock‑in to Zoom | Low/Accepted | The `VideoSession` + token‑endpoint seam keeps WebRTC (and any future SFU) swappable; this is a deliberate, reversible boundary. |
| SDK bundle size / wasm assets bloat the frontend | Low | Lazy‑load the Zoom session module only on the `/call` route. |

---

## 10. Cost considerations

> Figures are **directional** and must be confirmed against current Zoom Video
> SDK pricing before launch — do not treat as quotes.

- **Calling (Phase 1):** Zoom Video SDK is billed **per participant‑minute**
  after a monthly free allotment (historically a free monthly minute bundle, then
  pay‑as‑you‑go). A 1:1 Access call consumes 2 participant‑minutes per wall‑clock
  minute. Estimate monthly cost = `expected sessions × avg duration × 2 ×
  per‑minute rate`, minus the free tier.
- **Recording (Phase 2):** **cloud recording is an additional charge** (recording
  minutes + storage), and storage accrues over the 30‑day retention window
  required by the spec. Budget separately when that phase is planned.
- **Operational levers:** the sweeper and a future max‑duration cap bound
  worst‑case minutes; abandoned sessions are already auto‑ended. Add spend
  monitoring/alerts.
- **Offsetting saving:** Zoom removes the need to **run and pay for a TURN
  server** (coturn/managed) that the production WebRTC path would otherwise
  require, and removes self‑hosted SFU/scale‑out work.

---

## 11. Step‑by‑step PR sequence

> Each PR is independently shippable, typechecks, and (until the cutover PR) leaves
> production behavior unchanged because `VIDEO_PROVIDER` defaults to `webrtc`.

- **PR 0 — Prerequisite (no code):** create the company Zoom **Video SDK** app;
  obtain `SDK Key` / `SDK Secret`; store them in the Replit secret store and the
  team password manager. Decide account ownership. *(Enables everything below.)*

- **PR 1 — Backend provider seam + Zoom token endpoint (server only, flag‑off).**
  ⭐ *The exact first implementation PR — see §12.*
  - DB: add `video_provider` (default `webrtc`) + `video_session_name`; introduce
    `generate`+`migrate` for this change.
  - `lib/zoom.ts` (JWT signing) + `lib/video-provider.ts` (`resolveProvider`).
  - `/sessions/request` sets provider + topic at creation.
  - New `POST /sessions/{id}/video-token` (authz‑gated, privacy‑safe identity).
  - `openapi.yaml` + Orval/Zod regen; mappers include `videoProvider`.
  - Env: `VIDEO_PROVIDER` (default `webrtc`), `ZOOM_SDK_KEY`, `ZOOM_SDK_SECRET`,
    `ZOOM_TOKEN_TTL_SECONDS`; `.env.example` + redaction.
  - Tests: JWT helper, `resolveProvider`, token endpoint authz/shape.
  - **Net effect: zero behavior change** (default provider still webrtc; no
    client wiring yet).

- **PR 2 — Frontend provider abstraction + WebRTC adapter (no Zoom yet).**
  - Add `VideoSession` interface; wrap existing `webrtc-slot.ts` as
    `webrtc-session.ts`; refactor `call.tsx` to consume the abstraction and the
    token endpoint. Still selects webrtc. Pure refactor, UI identical.

- **PR 3 — Zoom Web SDK integration behind the flag.**
  - Add `@zoom/videosdk`; implement `zoom-session.ts` (join, render into Access
    DOM, mic/cam/end, remote‑connected events).
  - Lazy‑load on `/call`. Validate COOP/COEP header needs.
  - Verified in dev/staging with `VIDEO_PROVIDER=zoom`; webrtc still default in
    prod.

- **PR 4 — Production cutover.**
  - Set `VIDEO_PROVIDER=zoom` in prod secrets; smoke‑test the full flow on a
    restrictive network; confirm interpreter‑free‑on‑end; monitor minutes/errors.
  - WebRTC remains the documented fallback/dev path.

- **PR 5+ — Phase 2: Recording (separate plan).**
  - Enable Video SDK cloud recording (host role already assigned to interpreter);
    add `recordings` table; capture recording via Zoom webhook; 30‑day
    retention/auto‑delete; admin metadata + playback; employee consent notice.
  - *Not started until Zoom calling (PR 1–4) is verified in production.*

---

## 12. The exact first PR to implement

**PR 1 — "Backend video‑provider seam + Zoom Video SDK join‑token endpoint
(default provider unchanged)."**

**Scope (server + contract + schema only; no frontend, flag defaults to
`webrtc`):**

1. **DB** (`lib/db/src/schema/sessions.ts`): add `video_provider varchar(16) NOT
   NULL DEFAULT 'webrtc'` and `video_session_name varchar(64) NULL`; introduce
   `drizzle-kit generate` + `migrate` for this additive change.
2. **`artifacts/api-server/src/lib/video-provider.ts`** (new): `resolveProvider()`
   from `VIDEO_PROVIDER` + credential presence, with safe fallback to `webrtc`.
3. **`artifacts/api-server/src/lib/zoom.ts`** (new): sign a Video SDK JWT (topic,
   role, identity, exp) with `ZOOM_SDK_SECRET`.
4. **`artifacts/api-server/src/routes/sessions.ts`**: set `videoProvider` +
   `videoSessionName` (`access-<uuid>`) at creation in `/sessions/request`; add
   `POST /sessions/{id}/video-token` (same participant/admin authz as
   `GET /sessions/:id`, `409` if not active, privacy‑safe `userIdentity`,
   interpreter→host / user→participant; never return the secret).
5. **`artifacts/api-server/src/lib/mappers.ts`**: include `videoProvider` in the
   session DTO.
6. **`lib/api-spec/openapi.yaml`**: add `videoProvider` to `Session`; add the
   `/sessions/{id}/video-token` path + `VideoToken` schema; run Orval codegen
   (`api-client-react` + `api-zod`).
7. **Env + security**: `VIDEO_PROVIDER` (default `webrtc`), `ZOOM_SDK_KEY`,
   `ZOOM_SDK_SECRET`, `ZOOM_TOKEN_TTL_SECONDS` in `.env.example`; add
   `ZOOM_SDK_SECRET` to pino redaction.
8. **Tests**: JWT payload/role/expiry; `resolveProvider` matrix; token‑endpoint
   authz + response shape + secret‑absence.

**Why this is the right first PR**

- **Additive and reversible** — adds a seam without touching the working WebRTC
  call path; default `webrtc` means production behavior is unchanged after merge.
- **Establishes the contract** (`openapi.yaml` → generated hooks) that the
  frontend PR consumes, so the two ends can proceed in parallel afterward.
- **Server‑side and testable in isolation** — no browser/SDK rendering
  complexity yet; the riskiest UI integration (PR 3) is de‑risked by having a
  proven, tested token endpoint first.
- **Forward‑compatible with recording** — assigning the interpreter the Zoom
  **host** role now is exactly what Phase 2 cloud recording needs.

---

## 13. What explicitly does NOT change

- Login, role gating, auth cookie/token, `requireAuth`.
- Language selection and the **auto‑assign / atomic interpreter claim** in
  `/sessions/request` (still opens `active`, no accept/decline).
- Session lifecycle, `/end`, the sweeper, and abandoned‑session cleanup.
- Access UI, branding, Arabic‑first RTL, i18n.
- Interpreter‑identity privacy scrub (reinforced in the token endpoint).
- The WebRTC stack stays in the repo as the fallback/dev transport.
