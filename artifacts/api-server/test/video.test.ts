import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  resolveProvider,
  zoomRequestedButUnconfigured,
  zoomConfig,
  signZoomVideoToken,
  buildVideoTokenResponse,
  videoUserIdentity,
  newVideoSessionName,
  ZOOM_ROLE_HOST,
  ZOOM_ROLE_PARTICIPANT,
  type SessionLike,
  type ZoomConfig,
} from "../src/lib/video.ts";

// ---------------------------------------------------------------------------
// Pure unit tests for the PR 1 video-provider seam. No DB, no HTTP.
// Run: node --test artifacts/api-server/test/video.test.ts
// ---------------------------------------------------------------------------

function decodeSegment(seg: string): any {
  return JSON.parse(Buffer.from(seg, "base64url").toString("utf8"));
}

const CONFIGURED: ZoomConfig = {
  sdkKey: "test-key",
  sdkSecret: "test-secret",
  ttlSeconds: 7200,
};
const UNCONFIGURED: ZoomConfig = { sdkKey: "", sdkSecret: "", ttlSeconds: 7200 };

function zoomSession(over: Partial<SessionLike> = {}): SessionLike {
  return {
    id: 1,
    status: "active",
    userId: 10,
    interpreterId: 20,
    videoProvider: "zoom",
    videoSessionName: "access-topic-1",
    ...over,
  };
}

// --- resolveProvider -------------------------------------------------------

test("resolveProvider defaults to webrtc when unset", () => {
  assert.equal(resolveProvider({}), "webrtc");
});

test("resolveProvider stays webrtc for any non-zoom value", () => {
  assert.equal(resolveProvider({ VIDEO_PROVIDER: "anything" }), "webrtc");
  assert.equal(resolveProvider({ VIDEO_PROVIDER: "WEBRTC" }), "webrtc");
});

test("resolveProvider selects zoom only when configured", () => {
  assert.equal(
    resolveProvider({
      VIDEO_PROVIDER: "zoom",
      ZOOM_SDK_KEY: "k",
      ZOOM_SDK_SECRET: "s",
    }),
    "zoom",
  );
  // case-insensitive request
  assert.equal(
    resolveProvider({
      VIDEO_PROVIDER: "Zoom",
      ZOOM_SDK_KEY: "k",
      ZOOM_SDK_SECRET: "s",
    }),
    "zoom",
  );
});

test("resolveProvider degrades to webrtc when zoom requested but creds missing", () => {
  assert.equal(resolveProvider({ VIDEO_PROVIDER: "zoom" }), "webrtc");
  assert.equal(
    resolveProvider({ VIDEO_PROVIDER: "zoom", ZOOM_SDK_KEY: "k" }),
    "webrtc",
  );
  assert.equal(
    resolveProvider({ VIDEO_PROVIDER: "zoom", ZOOM_SDK_SECRET: "s" }),
    "webrtc",
  );
});

test("zoomRequestedButUnconfigured flags the misconfig case only", () => {
  assert.equal(zoomRequestedButUnconfigured({ VIDEO_PROVIDER: "zoom" }), true);
  assert.equal(
    zoomRequestedButUnconfigured({
      VIDEO_PROVIDER: "zoom",
      ZOOM_SDK_KEY: "k",
      ZOOM_SDK_SECRET: "s",
    }),
    false,
  );
  assert.equal(zoomRequestedButUnconfigured({}), false);
});

test("zoomConfig reads env with a sane default TTL", () => {
  assert.deepEqual(
    zoomConfig({ ZOOM_SDK_KEY: "k", ZOOM_SDK_SECRET: "s" }),
    { sdkKey: "k", sdkSecret: "s", ttlSeconds: 7200 },
  );
  assert.equal(
    zoomConfig({ ZOOM_TOKEN_TTL_SECONDS: "60" }).ttlSeconds,
    60,
  );
  assert.equal(
    zoomConfig({ ZOOM_TOKEN_TTL_SECONDS: "bad" }).ttlSeconds,
    7200,
  );
});

test("newVideoSessionName is an opaque access- topic, not a link", () => {
  const name = newVideoSessionName();
  assert.match(name, /^access-[0-9a-f-]{36}$/);
  assert.ok(!name.includes("http"));
  assert.notEqual(newVideoSessionName(), newVideoSessionName());
});

// --- signZoomVideoToken ----------------------------------------------------

test("signZoomVideoToken mints a valid HS256 JWT with the expected claims", () => {
  const token = signZoomVideoToken({
    sdkKey: "test-key",
    sdkSecret: "test-secret",
    topic: "access-topic-1",
    roleType: ZOOM_ROLE_HOST,
    userIdentity: "interpreter-20",
    ttlSeconds: 7200,
    nowSec: 1_000_000,
  });

  const [h, p, sig] = token.split(".");
  assert.ok(h && p && sig);

  const header = decodeSegment(h);
  assert.deepEqual(header, { alg: "HS256", typ: "JWT" });

  const payload = decodeSegment(p);
  assert.equal(payload.app_key, "test-key");
  assert.equal(payload.tpc, "access-topic-1");
  assert.equal(payload.role_type, ZOOM_ROLE_HOST);
  assert.equal(payload.user_identity, "interpreter-20");
  assert.equal(payload.iat, 1_000_000);
  assert.equal(payload.exp, 1_000_000 + 7200);

  // Signature verifies with the secret (and only with the secret).
  const expected = crypto
    .createHmac("sha256", "test-secret")
    .update(`${h}.${p}`)
    .digest("base64url");
  assert.equal(sig, expected);
  const wrong = crypto
    .createHmac("sha256", "WRONG")
    .update(`${h}.${p}`)
    .digest("base64url");
  assert.notEqual(sig, wrong);
});

// --- buildVideoTokenResponse: authorization --------------------------------

test("non-participant cannot get a token (403)", () => {
  const r = buildVideoTokenResponse({
    session: zoomSession(),
    user: { id: 999, role: "admin" }, // admin is NOT a call participant
    zoom: CONFIGURED,
  });
  assert.equal(r.ok, false);
  assert.equal((r as any).status, 403);
});

test("inactive session cannot get a token (409)", () => {
  for (const status of ["pending", "ended", "declined"]) {
    const r = buildVideoTokenResponse({
      session: zoomSession({ status }),
      user: { id: 10, role: "user" },
      zoom: CONFIGURED,
    });
    assert.equal(r.ok, false, `status=${status}`);
    assert.equal((r as any).status, 409, `status=${status}`);
  }
});

// --- buildVideoTokenResponse: webrtc ---------------------------------------

test("webrtc session returns a provider marker with null zoom fields", () => {
  const r = buildVideoTokenResponse({
    session: zoomSession({ videoProvider: "webrtc", videoSessionName: null }),
    user: { id: 10, role: "user" },
    zoom: UNCONFIGURED,
  });
  assert.equal(r.ok, true);
  const body = (r as any).body;
  assert.equal(body.provider, "webrtc");
  assert.equal(body.token, null);
  assert.equal(body.sessionName, null);
  assert.equal(body.sdkKey, null);
  assert.equal(body.role, null);
});

// --- buildVideoTokenResponse: zoom -----------------------------------------

test("zoom session returns a token only when configured; else 503", () => {
  const unconfigured = buildVideoTokenResponse({
    session: zoomSession(),
    user: { id: 10, role: "user" },
    zoom: UNCONFIGURED,
  });
  assert.equal(unconfigured.ok, false);
  assert.equal((unconfigured as any).status, 503);

  const configured = buildVideoTokenResponse({
    session: zoomSession(),
    user: { id: 10, role: "user" },
    zoom: CONFIGURED,
  });
  assert.equal(configured.ok, true);
  assert.ok((configured as any).body.token);
  assert.equal((configured as any).body.provider, "zoom");
  assert.equal((configured as any).body.sdkKey, "test-key");
});

test("interpreter is host (role 1), user is participant (role 0)", () => {
  const asUser = buildVideoTokenResponse({
    session: zoomSession(),
    user: { id: 10, role: "user" },
    zoom: CONFIGURED,
  });
  const asInterpreter = buildVideoTokenResponse({
    session: zoomSession(),
    user: { id: 20, role: "interpreter" },
    zoom: CONFIGURED,
  });
  assert.equal((asUser as any).body.role, ZOOM_ROLE_PARTICIPANT);
  assert.equal((asInterpreter as any).body.role, ZOOM_ROLE_HOST);
});

test("token identity is role+id only — never exposes name/email", () => {
  assert.equal(videoUserIdentity({ id: 7, role: "user" }), "user-7");

  const r = buildVideoTokenResponse({
    session: zoomSession(),
    user: { id: 10, role: "user" },
    zoom: CONFIGURED,
  });
  const body = (r as any).body;
  assert.equal(body.userIdentity, "user-10");

  // The minted JWT must not embed any human-identifying field.
  const payload = decodeSegment(body.token.split(".")[1]);
  assert.equal(payload.user_identity, "user-10");
  const serialized = JSON.stringify(payload);
  assert.ok(!/@/.test(serialized), "no email in token");
  assert.ok(!/name/i.test(serialized), "no name field in token");
});

test("zoom session missing a topic is 503 (not signed without a topic)", () => {
  const r = buildVideoTokenResponse({
    session: zoomSession({ videoSessionName: null }),
    user: { id: 10, role: "user" },
    zoom: CONFIGURED,
  });
  assert.equal(r.ok, false);
  assert.equal((r as any).status, 503);
});
