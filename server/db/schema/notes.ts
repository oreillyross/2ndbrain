import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import {themes} from "./themes"

export const notes = pgTable("notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull().unique(),
  content: text("content").default(""),
  userId: uuid("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  themeId: uuid("theme_id").references(() => themes.id, {
    onDelete: "set null",
  }),

  searchVector: text("search_vector").$type<string>().notNull().default(""),
});

export type Note = InferSelectModel<typeof notes>;
export type NoteUI = Omit<typeof notes.$inferSelect, "searchVector">;
export type NewNote = InferInsertModel<typeof notes>;
