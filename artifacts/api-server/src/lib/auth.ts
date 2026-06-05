import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { db, usersTable, type UserRow } from "@workspace/db";
import { eq } from "drizzle-orm";

const SECRET = process.env["SESSION_SECRET"] ?? "access-dev-secret-change-me";
export const AUTH_COOKIE = "access_token";
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7;

if (
  process.env["NODE_ENV"] === "production" &&
  !process.env["SESSION_SECRET"]
) {
  throw new Error("SESSION_SECRET must be set in production");
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(derived, "hex");
  const b = Buffer.from(key, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function signToken(userId: number): string {
  const payload = base64url(JSON.stringify({ uid: userId, iat: Date.now() }));
  const sig = base64url(
    crypto.createHmac("sha256", SECRET).update(payload).digest(),
  );
  return `${payload}.${sig}`;
}

export function verifyToken(token: string): number | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = base64url(
    crypto.createHmac("sha256", SECRET).update(payload).digest(),
  );
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const decoded = JSON.parse(
      Buffer.from(payload, "base64").toString("utf8"),
    ) as { uid?: number; iat?: number };
    if (typeof decoded.uid !== "number") return null;
    if (typeof decoded.iat !== "number") return null;
    if (Date.now() - decoded.iat > TOKEN_TTL_MS) return null;
    return decoded.uid;
  } catch {
    return null;
  }
}

export function setAuthCookie(res: Response, userId: number): void {
  res.cookie(AUTH_COOKIE, signToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE, { path: "/" });
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserRow;
    }
  }
}

export async function loadUser(req: Request): Promise<UserRow | null> {
  const token = (req.cookies as Record<string, string> | undefined)?.[
    AUTH_COOKIE
  ];
  if (!token) return null;
  const uid = verifyToken(token);
  if (uid == null) return null;
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, uid))
    .limit(1);
  return rows[0] ?? null;
}

export function requireAuth(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = await loadUser(req);
    if (!user) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }
    if (roles.length > 0 && !roles.includes(user.role)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    req.user = user;
    next();
  };
}
