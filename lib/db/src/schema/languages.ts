import { pgTable, serial, text, varchar, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const languagesTable = pgTable("languages", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  flagEmoji: text("flag_emoji").notNull(),
});

export const interpreterLanguagesTable = pgTable("interpreter_languages", {
  id: serial("id").primaryKey(),
  interpreterId: integer("interpreter_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  languageId: integer("language_id")
    .notNull()
    .references(() => languagesTable.id, { onDelete: "cascade" }),
});

export type LanguageRow = typeof languagesTable.$inferSelect;
export type InsertLanguage = typeof languagesTable.$inferInsert;
export type InterpreterLanguageRow = typeof interpreterLanguagesTable.$inferSelect;
