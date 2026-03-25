import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const themes = pgTable("themes", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  userId: uuid("user_id").notNull(),
  // 🆕 AI summary fields
  synopsis: text("synopsis"),
  synopsisUpdatedAt: timestamp("synopsis_updated_at").$onUpdate(() => new Date()),
  synopsisModel: text("synopsis_model"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});