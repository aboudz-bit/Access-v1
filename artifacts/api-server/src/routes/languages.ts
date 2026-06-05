import { Router, type IRouter } from "express";
import {
  db,
  languagesTable,
  interpreterLanguagesTable,
  usersTable,
} from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import { toLanguage } from "../lib/mappers";

const router: IRouter = Router();

router.get("/languages", async (req, res) => {
  // `?assigned=true` (the user-facing picker) returns only languages that have
  // at least one interpreter assigned — regardless of whether that interpreter
  // is currently available — so the list does not flicker as interpreters go
  // Busy/Offline. Without the flag (e.g. admin) all languages are returned so
  // they can still be managed.
  if (req.query.assigned === "true") {
    const rows = await db
      .selectDistinct({ lang: languagesTable })
      .from(languagesTable)
      .innerJoin(
        interpreterLanguagesTable,
        eq(interpreterLanguagesTable.languageId, languagesTable.id),
      )
      .innerJoin(
        usersTable,
        eq(usersTable.id, interpreterLanguagesTable.interpreterId),
      )
      .where(eq(usersTable.role, "interpreter"))
      .orderBy(asc(languagesTable.id));
    res.json(rows.map((r) => toLanguage(r.lang)));
    return;
  }

  const rows = await db
    .select()
    .from(languagesTable)
    .orderBy(asc(languagesTable.id));
  res.json(rows.map(toLanguage));
});

export default router;
