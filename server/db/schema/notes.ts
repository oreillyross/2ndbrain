import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

export const notes = pgTable("notes", {
  id: text("id").primaryKey(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});


export type Note = InferSelectModel<typeof notes>;
export type NewNote = InferInsertModel<typeof notes>;