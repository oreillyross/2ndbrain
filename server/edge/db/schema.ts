import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

const uuid = () => crypto.randomUUID();
const now = sql`(cast(unixepoch('subsec') * 1000 as integer))`;

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(uuid),
  email: text("email").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
});

export const themes = sqliteTable(
  "themes",
  {
    id: text("id").primaryKey().$defaultFn(uuid),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    synopsis: text("synopsis"),
    synopsisUpdatedAt: integer("synopsis_updated_at", { mode: "timestamp_ms" }),
    synopsisModel: text("synopsis_model"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (t) => [index("themes_user_idx").on(t.userId)],
);

export const notes = sqliteTable(
  "notes",
  {
    // Integer rowid for the FTS5 external-content table; never exposed.
    rid: integer("rid").primaryKey({ autoIncrement: true }),
    id: text("id").notNull().unique().$defaultFn(uuid),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull().default(""),
    themeId: text("theme_id").references(() => themes.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(now)
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("notes_user_title_uq").on(t.userId, t.title),
    index("notes_user_updated_idx").on(t.userId, t.updatedAt),
    index("notes_theme_idx").on(t.themeId),
  ],
);

export const links = sqliteTable(
  "links",
  {
    id: text("id").primaryKey().$defaultFn(uuid),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fromNoteId: text("from_note_id")
      .notNull()
      .references((): AnySQLiteColumn => notes.id, { onDelete: "cascade" }),
    // Null while the [[title]] does not resolve to a note.
    toNoteId: text("to_note_id").references((): AnySQLiteColumn => notes.id, {
      onDelete: "set null",
    }),
    toTitle: text("to_title").notNull(),
  },
  (t) => [
    index("links_user_from_idx").on(t.userId, t.fromNoteId),
    index("links_user_to_idx").on(t.userId, t.toNoteId),
  ],
);

export type User = typeof users.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type Theme = typeof themes.$inferSelect;
export type Link = typeof links.$inferSelect;
