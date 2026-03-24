import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const magicTokens = pgTable("magic_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});