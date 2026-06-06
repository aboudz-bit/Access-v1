import {
  db,
  usersTable,
  languagesTable,
  interpreterLanguagesTable,
  type LanguageRow,
  type SessionRow,
  type UserRow,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

export function toUser(row: UserRow) {
  return { id: row.id, email: row.email, name: row.name, role: row.role };
}

export function toLanguage(row: LanguageRow) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    nameAr: row.nameAr,
    flagEmoji: row.flagEmoji,
  };
}

export async function languagesForInterpreter(interpreterId: number) {
  const rows = await db
    .select({ lang: languagesTable })
    .from(interpreterLanguagesTable)
    .innerJoin(
      languagesTable,
      eq(interpreterLanguagesTable.languageId, languagesTable.id),
    )
    .where(eq(interpreterLanguagesTable.interpreterId, interpreterId));
  return rows.map((r) => toLanguage(r.lang));
}

export async function toSession(
  row: SessionRow,
  opts: { includeInterpreter?: boolean } = {},
) {
  // Privacy: the user-facing session payload must NOT expose interpreter
  // identity (id/name). Callers serving an end user pass
  // `includeInterpreter: false`; interpreter/admin views keep it (default).
  const includeInterpreter = opts.includeInterpreter ?? true;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, row.userId))
    .limit(1);

  const [lang] = await db
    .select()
    .from(languagesTable)
    .where(eq(languagesTable.id, row.languageId))
    .limit(1);

  const base = {
    id: row.id,
    userId: row.userId,
    userName: user?.name ?? "",
    languageId: row.languageId,
    language: lang ? toLanguage(lang) : null,
    status: row.status,
    videoProvider: row.videoProvider,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
  };

  if (!includeInterpreter) {
    return base;
  }

  let interpreterName: string | null = null;
  if (row.interpreterId != null) {
    const [interp] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, row.interpreterId))
      .limit(1);
    interpreterName = interp?.name ?? null;
  }

  return {
    ...base,
    interpreterId: row.interpreterId,
    interpreterName,
  };
}

export async function languagesByIds(ids: number[]) {
  if (ids.length === 0) return [] as ReturnType<typeof toLanguage>[];
  const rows = await db
    .select()
    .from(languagesTable)
    .where(inArray(languagesTable.id, ids));
  return rows.map(toLanguage);
}
