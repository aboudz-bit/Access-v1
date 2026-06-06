import { pgTable, serial, integer, varchar, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { languagesTable } from "./languages";

export const sessionsTable = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  interpreterId: integer("interpreter_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  languageId: integer("language_id")
    .notNull()
    .references(() => languagesTable.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  // Video transport for this session. Decided once at creation and stored so
  // both participants always join the same engine. 'webrtc' (default) uses the
  // built-in peer-to-peer signaling; 'zoom' uses the Zoom Video SDK. Enum is
  // enforced in application code (consistent with `status`).
  videoProvider: varchar("video_provider", { length: 16 })
    .notNull()
    .default("webrtc"),
  // Opaque Zoom Video SDK session topic (e.g. "access-<uuid>"). Null for
  // webrtc sessions. Never a Zoom meeting link — this is a bare topic string.
  videoSessionName: varchar("video_session_name", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export type SessionRow = typeof sessionsTable.$inferSelect;
export type InsertSession = typeof sessionsTable.$inferInsert;
