import { Router, type IRouter } from "express";
import {
  db,
  usersTable,
  sessionsTable,
  languagesTable,
  interpreterLanguagesTable,
} from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { requireAuth, hashPassword } from "../lib/auth";
import {
  toUser,
  toSession,
  toLanguage,
  languagesForInterpreter,
} from "../lib/mappers";

const router: IRouter = Router();

router.get("/admin/stats", requireAuth("admin"), async (_req, res) => {
  const [{ count: totalUsers }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usersTable)
    .where(eq(usersTable.role, "user"));
  const [{ count: totalInterpreters }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usersTable)
    .where(eq(usersTable.role, "interpreter"));
  const [{ count: availableInterpreters }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usersTable)
    .where(and(eq(usersTable.role, "interpreter"), eq(usersTable.status, "available")));
  const [{ count: activeSessions }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sessionsTable)
    .where(eq(sessionsTable.status, "active"));
  const [{ count: completedSessions }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sessionsTable)
    .where(eq(sessionsTable.status, "ended"));
  res.json({
    totalUsers,
    totalInterpreters,
    availableInterpreters,
    activeSessions,
    completedSessions,
  });
});

router.get("/admin/users", requireAuth("admin"), async (_req, res) => {
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.role, "user"))
    .orderBy(desc(usersTable.id));
  res.json(rows.map(toUser));
});

router.post("/admin/users", requireAuth("admin"), async (req, res) => {
  const { name, email, password } = (req.body ?? {}) as {
    name?: string;
    email?: string;
    password?: string;
  };
  if (!name || !email || !password) {
    res.status(400).json({ message: "Missing fields" });
    return;
  }
  const [created] = await db
    .insert(usersTable)
    .values({
      name,
      email: email.toLowerCase().trim(),
      passwordHash: hashPassword(password),
      role: "user",
    })
    .returning();
  res.status(201).json(toUser(created!));
});

async function buildInterpreter(id: number, name: string, email: string, status: string) {
  return {
    id,
    name,
    email,
    status,
    languages: await languagesForInterpreter(id),
  };
}

router.get("/admin/interpreters", requireAuth("admin"), async (_req, res) => {
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.role, "interpreter"))
    .orderBy(desc(usersTable.id));
  res.json(
    await Promise.all(
      rows.map((r) => buildInterpreter(r.id, r.name, r.email, r.status)),
    ),
  );
});

router.post("/admin/interpreters", requireAuth("admin"), async (req, res) => {
  const { name, email, password, languageIds } = (req.body ?? {}) as {
    name?: string;
    email?: string;
    password?: string;
    languageIds?: number[];
  };
  if (!name || !email || !password) {
    res.status(400).json({ message: "Missing fields" });
    return;
  }
  const [created] = await db
    .insert(usersTable)
    .values({
      name,
      email: email.toLowerCase().trim(),
      passwordHash: hashPassword(password),
      role: "interpreter",
      status: "offline",
    })
    .returning();
  if (Array.isArray(languageIds) && languageIds.length > 0) {
    await db.insert(interpreterLanguagesTable).values(
      languageIds.map((lid) => ({ interpreterId: created!.id, languageId: lid })),
    );
  }
  res
    .status(201)
    .json(await buildInterpreter(created!.id, created!.name, created!.email, created!.status));
});

router.put("/admin/interpreters/:id/status", requireAuth("admin"), async (req, res) => {
  const id = Number(req.params.id);
  const { status } = (req.body ?? {}) as { status?: string };
  const allowed = ["available", "busy", "offline"];
  if (!status || !allowed.includes(status)) {
    res.status(400).json({ message: "Invalid status" });
    return;
  }
  const [updated] = await db
    .update(usersTable)
    .set({ status })
    .where(and(eq(usersTable.id, id), eq(usersTable.role, "interpreter")))
    .returning();
  if (!updated) {
    res.status(404).json({ message: "Not found" });
    return;
  }
  res.json(await buildInterpreter(updated.id, updated.name, updated.email, updated.status));
});

router.put("/admin/interpreters/:id/languages", requireAuth("admin"), async (req, res) => {
  const id = Number(req.params.id);
  const { languageIds } = (req.body ?? {}) as { languageIds?: number[] };
  const [interp] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.id, id), eq(usersTable.role, "interpreter")))
    .limit(1);
  if (!interp) {
    res.status(404).json({ message: "Not found" });
    return;
  }
  await db
    .delete(interpreterLanguagesTable)
    .where(eq(interpreterLanguagesTable.interpreterId, id));
  if (Array.isArray(languageIds) && languageIds.length > 0) {
    await db.insert(interpreterLanguagesTable).values(
      languageIds.map((lid) => ({ interpreterId: id, languageId: lid })),
    );
  }
  res.json(await buildInterpreter(interp.id, interp.name, interp.email, interp.status));
});

function isUniqueViolation(err: unknown): boolean {
  const code = (e: unknown): string | undefined =>
    typeof e === "object" && e !== null && "code" in e
      ? (e as { code?: string }).code
      : undefined;
  const cause =
    typeof err === "object" && err !== null && "cause" in err
      ? (err as { cause?: unknown }).cause
      : undefined;
  return code(err) === "23505" || code(cause) === "23505";
}

router.post("/admin/languages", requireAuth("admin"), async (req, res) => {
  const { code, name, nameAr, flagEmoji } = (req.body ?? {}) as {
    code?: string;
    name?: string;
    nameAr?: string;
    flagEmoji?: string;
  };
  if (!code || !name || !nameAr || !flagEmoji) {
    res.status(400).json({ message: "Missing fields" });
    return;
  }
  try {
    const [created] = await db
      .insert(languagesTable)
      .values({ code: code.trim(), name, nameAr, flagEmoji })
      .returning();
    res.status(201).json(toLanguage(created!));
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(409).json({ message: "Language code already exists" });
      return;
    }
    throw err;
  }
});

router.put("/admin/languages/:id", requireAuth("admin"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ message: "Invalid id" });
    return;
  }
  const { code, name, nameAr, flagEmoji } = (req.body ?? {}) as {
    code?: string;
    name?: string;
    nameAr?: string;
    flagEmoji?: string;
  };
  if (!code || !name || !nameAr || !flagEmoji) {
    res.status(400).json({ message: "Missing fields" });
    return;
  }
  try {
    const [updated] = await db
      .update(languagesTable)
      .set({ code: code.trim(), name, nameAr, flagEmoji })
      .where(eq(languagesTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    res.json(toLanguage(updated));
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(409).json({ message: "Language code already exists" });
      return;
    }
    throw err;
  }
});

router.delete("/admin/languages/:id", requireAuth("admin"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ message: "Invalid id" });
    return;
  }
  const [{ count: sessionCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sessionsTable)
    .where(eq(sessionsTable.languageId, id));
  if (sessionCount > 0) {
    res.status(409).json({
      message:
        "Cannot delete a language that is referenced by existing sessions",
    });
    return;
  }
  await db
    .delete(interpreterLanguagesTable)
    .where(eq(interpreterLanguagesTable.languageId, id));
  await db.delete(languagesTable).where(eq(languagesTable.id, id));
  res.status(204).end();
});

router.get("/admin/sessions", requireAuth("admin"), async (req, res) => {
  const status = req.query.status as string | undefined;
  const rows = status
    ? await db
        .select()
        .from(sessionsTable)
        .where(eq(sessionsTable.status, status))
        .orderBy(desc(sessionsTable.createdAt))
    : await db.select().from(sessionsTable).orderBy(desc(sessionsTable.createdAt));
  res.json(await Promise.all(rows.map(toSession)));
});

export default router;
