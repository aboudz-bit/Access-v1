import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Video provider seam (PR 1)
// ---------------------------------------------------------------------------
// Access supports two media transports behind a single seam:
//   - 'webrtc' : the built-in peer-to-peer signaling path (default; dev/fallback)
//   - 'zoom'   : the Zoom Video SDK (headless — rendered into Access's own UI;
//                no Zoom links, no Zoom Meetings API)
//
// This module owns the *pure* decision logic so it can be unit-tested without a
// database or HTTP layer:
//   - resolveProvider(env)         which provider a NEW session should use
//   - zoomConfig(env)              read Zoom Video SDK credentials/TTL from env
//   - signZoomVideoToken(...)      mint a Video SDK join JWT (HS256)
//   - buildVideoTokenResponse(...) authorize a participant and shape the response
//
// SECURITY: the Zoom SDK *secret* never leaves the backend. It is used only to
// sign the short-lived JWT here; it is never returned to the client or logged.

export type VideoProvider = "zoom" | "webrtc";

export const DEFAULT_VIDEO_PROVIDER: VideoProvider = "webrtc";

type Env = Record<string, string | undefined>;

export interface ZoomConfig {
  sdkKey: string;
  sdkSecret: string;
  ttlSeconds: number;
}

// Structural shapes (kept local so the pure logic does not depend on the DB row
// types at runtime, which keeps the unit tests free of any DB import).
export interface SessionLike {
  id: number;
  status: string;
  userId: number;
  interpreterId: number | null;
  videoProvider: string;
  videoSessionName: string | null;
}

export interface UserLike {
  id: number;
  role: string;
}

// Zoom Video SDK role_type: 1 = host (can later authorize cloud recording),
// 0 = participant. We make the interpreter the host and the user a participant.
export const ZOOM_ROLE_HOST = 1;
export const ZOOM_ROLE_PARTICIPANT = 0;

const DEFAULT_TTL_SECONDS = 7200;

/**
 * Decide which provider a newly created session should use.
 *
 * - VIDEO_PROVIDER unset / anything but "zoom" -> "webrtc" (safe default).
 * - VIDEO_PROVIDER=zoom AND both Zoom credentials present -> "zoom".
 * - VIDEO_PROVIDER=zoom but credentials missing -> "webrtc" (degrade, never
 *   crash). The caller is expected to log this fallback.
 *
 * Pure: depends only on its `env` argument.
 */
export function resolveProvider(env: Env = process.env): VideoProvider {
  const want = (env["VIDEO_PROVIDER"] ?? "").trim().toLowerCase();
  if (want === "zoom") {
    if (env["ZOOM_SDK_KEY"] && env["ZOOM_SDK_SECRET"]) return "zoom";
    return "webrtc";
  }
  return "webrtc";
}

/** True only when VIDEO_PROVIDER=zoom is requested but credentials are absent. */
export function zoomRequestedButUnconfigured(env: Env = process.env): boolean {
  const want = (env["VIDEO_PROVIDER"] ?? "").trim().toLowerCase();
  return want === "zoom" && !(env["ZOOM_SDK_KEY"] && env["ZOOM_SDK_SECRET"]);
}

export function zoomConfig(env: Env = process.env): ZoomConfig {
  const ttlRaw = Number(env["ZOOM_TOKEN_TTL_SECONDS"]);
  return {
    sdkKey: env["ZOOM_SDK_KEY"] ?? "",
    sdkSecret: env["ZOOM_SDK_SECRET"] ?? "",
    ttlSeconds:
      Number.isFinite(ttlRaw) && ttlRaw > 0 ? ttlRaw : DEFAULT_TTL_SECONDS,
  };
}

/** Generate an opaque, unique Zoom topic. Never a meeting link. */
export function newVideoSessionName(): string {
  return `access-${crypto.randomUUID()}`;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export interface SignZoomTokenArgs {
  sdkKey: string;
  sdkSecret: string;
  topic: string;
  roleType: number;
  userIdentity: string;
  ttlSeconds: number;
  /** Seconds since epoch; injectable for deterministic tests. */
  nowSec?: number;
}

/**
 * Mint a Zoom Video SDK JWT (HS256). This is the Video SDK token format — it
 * carries the SDK key, the session topic, the role, and an opaque user
 * identity. It is NOT a Zoom Meetings JWT and produces no meeting link.
 */
export function signZoomVideoToken(args: SignZoomTokenArgs): string {
  const iat = args.nowSec ?? Math.floor(Date.now() / 1000);
  const exp = iat + args.ttlSeconds;

  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    app_key: args.sdkKey,
    tpc: args.topic,
    role_type: args.roleType,
    user_identity: args.userIdentity,
    version: 1,
    iat,
    exp,
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = base64url(
    crypto.createHmac("sha256", args.sdkSecret).update(signingInput).digest(),
  );
  return `${signingInput}.${signature}`;
}

// Response body returned by the /sessions/:id/video-token endpoint. For a
// webrtc session every Zoom-specific field is null and the client uses the
// existing WebSocket signaling path.
export interface VideoTokenBody {
  provider: VideoProvider;
  token: string | null;
  sessionName: string | null;
  sdkKey: string | null;
  role: number | null;
  userIdentity: string | null;
  expiresIn: number | null;
}

export type VideoTokenResult =
  | { ok: true; body: VideoTokenBody }
  | { ok: false; status: number; message: string };

/**
 * Privacy-safe identity for the *caller*: role + own id only. Never a name or
 * email, so an interpreter's personal info is never embedded in a token handed
 * to a user (and vice-versa).
 */
export function videoUserIdentity(user: UserLike): string {
  return `${user.role}-${user.id}`;
}

/**
 * Core authorization + shaping for the video-token endpoint. Pure: no DB, no
 * HTTP. The route loads the session row and the authenticated user, then calls
 * this.
 *
 * Rules:
 *  - Only the session's user or its assigned interpreter may obtain a token
 *    (admins are NOT call participants -> 403).
 *  - The session must be 'active' (else 409).
 *  - A 'zoom' session with missing credentials -> 503 (never sign with an empty
 *    secret).
 *  - 'webrtc' sessions return a provider marker with null Zoom fields.
 */
export function buildVideoTokenResponse(input: {
  session: SessionLike;
  user: UserLike;
  zoom: ZoomConfig;
  nowSec?: number;
}): VideoTokenResult {
  const { session, user, zoom } = input;

  const isParticipant =
    session.userId === user.id || session.interpreterId === user.id;
  if (!isParticipant) {
    return { ok: false, status: 403, message: "Forbidden" };
  }

  if (session.status !== "active") {
    return { ok: false, status: 409, message: "Session is not active" };
  }

  const userIdentity = videoUserIdentity(user);

  if (session.videoProvider === "zoom") {
    if (!zoom.sdkKey || !zoom.sdkSecret) {
      return {
        ok: false,
        status: 503,
        message: "Video provider not configured",
      };
    }
    if (!session.videoSessionName) {
      return {
        ok: false,
        status: 503,
        message: "Video session not provisioned",
      };
    }

    const roleType =
      session.interpreterId != null && user.id === session.interpreterId
        ? ZOOM_ROLE_HOST
        : ZOOM_ROLE_PARTICIPANT;

    const token = signZoomVideoToken({
      sdkKey: zoom.sdkKey,
      sdkSecret: zoom.sdkSecret,
      topic: session.videoSessionName,
      roleType,
      userIdentity,
      ttlSeconds: zoom.ttlSeconds,
      nowSec: input.nowSec,
    });

    return {
      ok: true,
      body: {
        provider: "zoom",
        token,
        sessionName: session.videoSessionName,
        sdkKey: zoom.sdkKey,
        role: roleType,
        userIdentity,
        expiresIn: zoom.ttlSeconds,
      },
    };
  }

  // webrtc (default / fallback): the client uses the existing /api/ws path.
  return {
    ok: true,
    body: {
      provider: "webrtc",
      token: null,
      sessionName: null,
      sdkKey: null,
      role: null,
      userIdentity: null,
      expiresIn: null,
    },
  };
}
