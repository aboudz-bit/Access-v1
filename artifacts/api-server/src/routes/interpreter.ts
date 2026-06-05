import { Router, type IRouter } from "express";
import { db, usersTable, sessionsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { languagesForInterpreter, toSession } from "../lib/mappers";

const router: IRouter = Router();

router.put("/interpreter/status", requireAuth("interpreter"), async (req, res) => {
  const { status } = (req.body ?? {}) as { status?: string };
  const allowed = ["available", "busy", "offline"];
  if (!status || !allowed.includes(status)) {
    res.status(400).json({ message: "Invalid status" });
    return;
  }
  const [updated] = await db
    .update(usersTable)
    .set({ status })
    .where(eq(usersTable.id, req.user!.id))
    .returning();
  res.json({
    id: updated!.id,
    name: updated!.name,
    email: updated!.email,
    status: updated!.status,
    languages: await languagesForInterpreter(updated!.id),
  });
});

router.get("/interpreter/me", requireAuth("interpreter"), async (req, res) => {
  const u = req.user!;
  res.json({
    id: u.id,
    name: u.name,
    email: u.email,
    status: u.status,
    languages: await languagesForInterpreter(u.id),
  });
});

router.get("/interpreter/sessions", requireAuth("interpreter"), async (req, res) => {
  const rows = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.interpreterId, req.user!.id))
    .orderBy(desc(sessionsTable.createdAt));
  res.json(await Promise.all(rows.map((r) => toSession(r))));
});

export default router;
