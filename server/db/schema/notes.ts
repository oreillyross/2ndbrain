import { pgTable, text, timestamp,uuid } from "drizzle-orm/pg-core";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";


export const notes = pgTable("notes", {
  id: uuid("id").defaultRandom().primaryKey(),

  content: text("content").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  searchVector: text("search_vector") 
});


export type Note = InferSelectModel<typeof notes>;
export type NewNote = InferInsertModel<typeof notes>;