import { Router, type IRouter } from "express";
import { db, languagesTable } from "@workspace/db";
import { asc } from "drizzle-orm";
import { toLanguage } from "../lib/mappers";

const router: IRouter = Router();

router.get("/languages", async (_req, res) => {
  const rows = await db
    .select()
    .from(languagesTable)
    .orderBy(asc(languagesTable.id));
  res.json(rows.map(toLanguage));
});

export default router;
