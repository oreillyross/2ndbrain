import { router, publicProcedure } from "../trpc/trpc";
import { z } from "zod";
import { db } from "../db";
import { notes } from "../db/schema";
import { desc, eq, sql } from "drizzle-orm";

export const notesRouter = router({

  list: publicProcedure.query(async () => {
    return db.select().from(notes).orderBy(desc(notes.createdAt));
  }),

  create: publicProcedure
    .input(z.object({
      content: z.string(),
    }))
    .mutation(async ({ input }) => {

      const [note] = await db
        .insert(notes)
        .values({
          content: input.content,
        })
        .returning();

      return note;
    }),

  update: publicProcedure
    .input(z.object({
      id: z.string(),
      content: z.string(),
    }))
    .mutation(async ({ input }) => {

      const [note] = await db
        .update(notes)
        .set({
          content: input.content,
          updatedAt: new Date(),
        })
        .where(eq(notes.id, input.id))
        .returning();

      return note;
    }),

  search: publicProcedure
    .input(z.object({
      query: z.string(),
    }))
    .query(async ({ input }) => {

      return db
        .select()
        .from(notes)
        .where(sql`content ILIKE ${"%" + input.query + "%"}`)
        .limit(20);

    }),

});