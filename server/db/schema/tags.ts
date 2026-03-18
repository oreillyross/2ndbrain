import { pgTable, text,uuid } from "drizzle-orm/pg-core";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

export const tags = pgTable("tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique()
});

export type Tag = InferSelectModel<typeof tags>;
export type NewTag = InferInsertModel<typeof tags>;