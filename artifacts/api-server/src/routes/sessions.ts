import { Router, type IRouter } from "express";
import { db, sessionsTable, usersTable, interpreterLanguagesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { toSession } from "../lib/mappers";

const router: IRouter = Router();

// User requests an interpreter for a language
router.post("/sessions/request", requireAuth("user"), async (req, res) => {
  const user = req.user!;
  const { languageId } = (req.body ?? {}) as { languageId?: number };
  if (!languageId) {
    res.status(404).json({ message: "No available interpreter" });
    return;
  }

  // Find an available interpreter who speaks this language
  const candidates = await db
    .select({ interpreter: usersTable })
    .from(interpreterLanguagesTable)
    .innerJoin(
      usersTable,
      eq(interpreterLanguagesTable.interpreterId, usersTable.id),
    )
    .where(
      and(
        eq(interpreterLanguagesTable.languageId, languageId),
        eq(usersTable.role, "interpreter"),
        eq(usersTable.status, "available"),
      ),
    );

  // Atomically reserve the first interpreter we can claim (guards against
  // double-assignment when two users request at the same time).
  let interpreterId: number | null = null;
  for (const candidate of candidates) {
    const [claimed] = await db
      .update(usersTable)
      .set({ status: "busy" })
      .where(
        and(
          eq(usersTable.id, candidate.interpreter.id),
          eq(usersTable.status, "available"),
        ),
      )
      .returning();
    if (claimed) {
      interpreterId = claimed.id;
      break;
    }
  }

  if (interpreterId == null) {
    res.status(404).json({ message: "No available interpreter for that language" });
    return;
  }

  const [created] = await db
    .insert(sessionsTable)
    .values({
      userId: user.id,
      interpreterId,
      languageId,
      status: "pending",
    })
    .returning();

  res.status(201).json(await toSession(created!));
});

router.get("/sessions/:id", requireAuth(), async (req, res) => {
  const id = Number(req.params.id);
  const me = req.user!;
  const [row] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, id))
    .limit(1);
  if (!row) {
    res.status(404).json({ message: "Not found" });
    return;
  }
  // Only the session's user, its assigned interpreter, or an admin may view it.
  if (
    me.role !== "admin" &&
    row.userId !== me.id &&
    row.interpreterId !== me.id
  ) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }
  res.json(await toSession(row));
});

// Interpreter accepts or declines (only their own, only while pending)
router.post("/sessions/:id/respond", requireAuth("interpreter"), async (req, res) => {
  const id = Number(req.params.id);
  const me = req.user!;
  const { action } = (req.body ?? {}) as { action?: "accept" | "decline" };
  if (action !== "accept" && action !== "decline") {
    res.status(400).json({ message: "Invalid action" });
    return;
  }

  const [row] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, id))
    .limit(1);
  if (!row) {
    res.status(404).json({ message: "Not found" });
    return;
  }
  if (row.interpreterId !== me.id) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  if (action === "accept") {
    const [updated] = await db
      .update(sessionsTable)
      .set({ status: "active", startedAt: new Date() })
      .where(and(eq(sessionsTable.id, id), eq(sessionsTable.status, "pending")))
      .returning();
    if (!updated) {
      res.status(409).json({ message: "Session is no longer pending" });
      return;
    }
    res.json(await toSession(updated));
    return;
  }

  const [updated] = await db
    .update(sessionsTable)
    .set({ status: "declined", endedAt: new Date() })
    .where(and(eq(sessionsTable.id, id), eq(sessionsTable.status, "pending")))
    .returning();
  if (!updated) {
    res.status(409).json({ message: "Session is no longer pending" });
    return;
  }
  // Free the interpreter again since they declined.
  await db
    .update(usersTable)
    .set({ status: "available" })
    .where(eq(usersTable.id, me.id));
  res.json(await toSession(updated));
});

router.post("/sessions/:id/end", requireAuth(), async (req, res) => {
  const id = Number(req.params.id);
  const me = req.user!;
  const [row] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, id))
    .limit(1);
  if (!row) {
    res.status(404).json({ message: "Not found" });
    return;
  }
  // Only a participant or admin may end the session.
  if (
    me.role !== "admin" &&
    row.userId !== me.id &&
    row.interpreterId !== me.id
  ) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const [updated] = await db
    .update(sessionsTable)
    .set({ status: "ended", endedAt: new Date() })
    .where(and(eq(sessionsTable.id, id), eq(sessionsTable.status, "active")))
    .returning();
  if (!updated) {
    res.status(409).json({ message: "Session is not active" });
    return;
  }
  if (row.interpreterId != null) {
    await db
      .update(usersTable)
      .set({ status: "available" })
      .where(eq(usersTable.id, row.interpreterId));
  }
  res.json(await toSession(updated));
});

export default router;
