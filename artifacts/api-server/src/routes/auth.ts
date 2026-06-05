import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  verifyPassword,
  setAuthCookie,
  clearAuthCookie,
  signToken,
  loadUser,
} from "../lib/auth";
import { toUser } from "../lib/mappers";

const router: IRouter = Router();

router.post("/auth/login", async (req, res) => {
  const { email, password } = (req.body ?? {}) as {
    email?: string;
    password?: string;
  };
  if (!email || !password) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase().trim()))
    .limit(1);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }
  setAuthCookie(res, user.id);
  res.json({ token: signToken(user.id), user: toUser(user) });
});

router.post("/auth/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ status: "ok" });
});

router.get("/auth/me", async (req, res) => {
  const user = await loadUser(req);
  if (!user) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  res.json(toUser(user));
});

export default router;
