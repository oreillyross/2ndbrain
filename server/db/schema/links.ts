import { uuid, text, pgTable } from "drizzle-orm/pg-core";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

export const links = pgTable("links", {
  id: uuid("id").defaultRandom().primaryKey(),

  fromNoteId: uuid("from_note_id").notNull(),

  toNoteId: uuid("to_note_id"), // nullable (unresolved links)

  toTitle: text("to_title").notNull(), // [[title]]
});

export type Link = InferSelectModel<typeof links>
export type NewLink = InferInsertModel<typeof links>
