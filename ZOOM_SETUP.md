# Zoom Video SDK — Developer Setup Guide

> **Status:** Backend seam shipped (PR 1). Frontend integration **not yet built** (PR 2, blocked on credentials).
> **Today the app runs 100% on WebRTC.** Zoom is dormant and cannot affect runtime until you explicitly enable it.
> Companion to [ZOOM_VIDEO_SDK_PLAN.md](ZOOM_VIDEO_SDK_PLAN.md). Decision context: "Path B" — Zoom is the future primary engine, WebRTC the fallback/dev path.

This guide explains how to obtain Zoom Video SDK credentials, what is already wired,
how to flip the provider to Zoom later, and how PR 2 will consume it.

---

## TL;DR

- You do **not** need Zoom to run, develop, or demo Access today. Leave the Zoom
  env vars unset and everything uses WebRTC.
- When credentials exist: set `VIDEO_PROVIDER=zoom` + the two Zoom secrets, and
  **new** sessions start minting Zoom join tokens. The frontend that consumes
  those tokens is PR 2 (not built yet) — so until PR 2 lands, only the backend
  reflects the change.

---

## 1. What Zoom account / product is required

**Zoom Video SDK** — this is the *developer* product, **not** a Zoom Meetings
paid plan and **not** the Meetings SDK/API.

- It is a headless media engine: you join a named "session" (topic) with a signed
  JWT and render the audio/video into **your own** UI.
- It produces **no meeting links**, **no Zoom UI**, and uses **no Meetings API** —
  exactly what Access requires (users never see or open Zoom).

You need a company‑owned Zoom account with Video SDK enabled (so credentials,
billed minutes, and future recordings belong to the org, not a personal login).

> Out of scope on purpose: OAuth apps, Meetings scopes, per‑employee Zoom
> accounts. Interpreters and users only ever authenticate to **Access**.

---

## 2. How to get the SDK Key and Secret

1. Sign in at the **Zoom App Marketplace** (`marketplace.zoom.us`) with the
   company Zoom account.
2. **Develop → Build App → Video SDK** → create a Video SDK app.
3. From the app's credentials page, copy:
   - **SDK Key**  → `ZOOM_SDK_KEY`
   - **SDK Secret** → `ZOOM_SDK_SECRET`
4. Store both in the team password manager **and** the deployment secret store
   (Replit secrets for prod). Never commit them; the secret stays backend‑only.

> The **SDK Secret never leaves the backend.** Access uses it only to sign
> short‑lived join JWTs server‑side; it is never sent to the browser or logged.

**Cloud Recording** (Phase 3 / later): recording for Video SDK must be enabled on
the account and is billed separately. **Not needed** for calling — ignore it until
the recording phase.

---

## 3. Required environment variables

All are already documented in [.env.example](.env.example) and read by the API
server. Defaults keep Zoom off.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `VIDEO_PROVIDER` | no | `webrtc` | `webrtc` or `zoom`. Selects the engine for **new** sessions. |
| `ZOOM_SDK_KEY` | only when `zoom` | — | Video SDK key (public‑ish; embedded in the join token + returned to the client). |
| `ZOOM_SDK_SECRET` | only when `zoom` | — | Video SDK secret. **Backend‑only.** Signs the join JWT. Never returned or logged. |
| `ZOOM_TOKEN_TTL_SECONDS` | no | `7200` | Join‑token lifetime in seconds. Must outlive the longest call. |

**Safety net:** if `VIDEO_PROVIDER=zoom` is set but either credential is missing,
the server logs a warning and **degrades to `webrtc`** instead of crashing. So a
half‑configured environment still runs.

---

## 4. How to enable Zoom later (when credentials exist)

> Backend‑only flip. Until PR 2 ships the frontend adapter, enabling this makes
> new sessions *carry* a Zoom token, but the call screen still runs WebRTC. Enable
> in a **dev/staging** environment first.

1. Set the env vars (e.g. local `.env`, or Replit secrets in prod):
   ```
   VIDEO_PROVIDER=zoom
   ZOOM_SDK_KEY=<your key>
   ZOOM_SDK_SECRET=<your secret>
   # ZOOM_TOKEN_TTL_SECONDS=7200   # optional
   ```
2. Apply the DB columns if not already applied in that environment
   (additive; PR 1 added `video_provider` + `video_session_name`):
   ```
   pnpm --filter @workspace/db run push      # dev; postMerge does this on Replit
   ```
3. Restart the API server. On boot it resolves the provider from env.
4. **New** sessions created from this point get `videoProvider: "zoom"` and a
   provisioned `video_session_name`. Existing/old sessions are unaffected.
5. To roll back: unset `VIDEO_PROVIDER` (or set `=webrtc`) and restart. New
   sessions return to WebRTC immediately. No data migration needed.

> Provider is decided **once per session, at creation, and stored on the row**, so
> both participants always join the same engine — no mid‑call switching.

---

## 5. The video‑token endpoint (already implemented, PR 1)

`POST /api/sessions/:id/video-token`

- **Auth:** participant‑only — the session's **user** or its assigned
  **interpreter**. Admins are not call participants → `403`.
- **State:** the session must be `active` → otherwise `409`. Unknown id → `404`.
- **Provider not configured** for a zoom session → `503` (never signs with an
  empty secret).

**Response (zoom session):**
```jsonc
{
  "provider": "zoom",
  "token": "<short-lived Zoom Video SDK JWT>",
  "sessionName": "access-<uuid>",   // opaque topic; NOT a meeting link
  "sdkKey": "<ZOOM_SDK_KEY>",
  "role": 1,                         // 1 = host (interpreter), 0 = participant (user)
  "userIdentity": "user-10",         // role + id only — never a name/email
  "expiresIn": 7200
}
```

**Response (webrtc session — default today):**
```jsonc
{
  "provider": "webrtc",
  "token": null, "sessionName": null, "sdkKey": null,
  "role": null, "userIdentity": null, "expiresIn": null
}
```

Generated client hook: `useGetVideoToken` (in `@workspace/api-client-react`),
plus the `VideoToken` / `VideoProvider` types and Zod schemas — all already
regenerated from `openapi.yaml`.

**Privacy guarantee:** `userIdentity` is the *caller's own* `role-id`. No
participant's name or email is ever embedded in a token. This preserves the
existing interpreter‑identity scrub.

---

## 6. What PR 2 will implement (frontend integration)

PR 2 is the **frontend‑only** consumption of the token endpoint above. Planned
scope (see [ZOOM_VIDEO_SDK_PLAN.md](ZOOM_VIDEO_SDK_PLAN.md) §5 for detail):

1. Add the `@zoom/videosdk` dependency (pinned, respecting `.npmrc`
   `minimumReleaseAge`). **Not installed yet** — this guide does not add it.
2. A provider‑agnostic `VideoSession` interface, with two adapters:
   - `zoom-session.ts` — `@zoom/videosdk`: `createClient → init → join(topic,
     jwt, userIdentity)`, rendering self/remote into **Access's existing call
     UI** (full‑bleed remote video + local PIP), mic/cam/end mapped to SDK calls.
   - `webrtc-session.ts` — a thin wrapper around today's `webrtc-slot.ts` (no
     behavior change).
3. Refactor `call.tsx` to: fetch the token via `useGetVideoToken`, branch on
   `provider`, and wire the chosen adapter — **keeping the current UI/branding,
   RTL, and controls identical**.
4. Validate the Web SDK's cross‑origin‑isolation (COOP/COEP) header needs against
   the static frontend serving config.

What PR 2 will **not** do: change the user flow, make Zoom the default in prod, or
add recording.

---

## 7. How to test once credentials exist

**Backend smoke (no frontend needed):**

1. Start the API with `VIDEO_PROVIDER=zoom` + credentials (see §4).
2. Log in as the seeded user, request an interpreter for a language, then call the
   token endpoint for that session:
   - Confirm `provider: "zoom"`, a 3‑part JWT in `token`, `sdkKey` present, and
     **no** `sdkSecret` / name / email anywhere in the body.
   - Confirm the interpreter receives `role: 1` (host) and the user `role: 0`.
   - Confirm a non‑participant gets `403`, an ended session `409`.
3. The PR 1 unit tests already assert all of the above logic:
   ```
   pnpm --filter @workspace/api-server run test
   ```

**End‑to‑end (after PR 2 lands):**

- Two browsers, full flow: login → select language → auto‑assign → both land in
  the **in‑Access** call screen with bidirectional Zoom audio/video; mic/cam
  toggle and End work; ending frees the interpreter.
- **Network resilience check (the whole reason for Zoom):** put one participant on
  a restrictive network (mobile/4G, corporate NAT) where the STUN‑only WebRTC path
  fails, and confirm Zoom still connects.
- Verify a **user never** sees the interpreter's real name.

---

## 8. Current state checklist

- [x] DB columns `video_provider` (default `webrtc`) + `video_session_name`.
- [x] `POST /sessions/:id/video-token` (participant‑only, active‑only, privacy‑safe).
- [x] Backend Zoom JWT signer (secret backend‑only) + provider resolution with safe fallback.
- [x] OpenAPI + generated client/zod updated; unit tests green.
- [x] `.env.example` documents all Zoom vars.
- [ ] Zoom credentials provisioned (**blocked — pending account**).
- [ ] `@zoom/videosdk` installed (PR 2).
- [ ] Frontend `VideoSession` adapters + `call.tsx` wiring (PR 2).
- [ ] Recording (later phase).
