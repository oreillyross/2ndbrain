import { router, protectedProcedure } from "../../trpc";
import {eq, sql} from "drizzle-orm"
import { z } from "zod";
import { links, notes } from "../schema";

export const linksRouter = router({
  create: protectedProcedure
  .input(
    z.object({
      fromId: z.string(),
      toId: z.string(),
      toTitle: z.string(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    // ensure BOTH notes belong to user
    const valid = await ctx.db
      .select()
      .from(notes)
      .where(sql`
        ${notes.id} IN (${input.fromId}, ${input.toId})
        AND ${notes.userId} = ${ctx.user.id}
      `);

    if (valid.length !== 2) {
      throw new Error("Invalid link");
    }

    await ctx.db.insert(links).values({
      fromNoteId: input.fromId,
      toNoteId: input.toId,
      toTitle: input.toTitle,
    });
  }),
  getLinked: protectedProcedure
  .input(z.object({ noteId: z.string() }))
  .query(async ({ ctx, input }) => {
    return ctx.db
      .select()
      .from(links)
      .innerJoin(notes, eq(links.fromNoteId, notes.id))
      .where(sql`
        ${links.fromNoteId} = ${input.noteId}
        AND ${notes.userId} = ${ctx.user.id}
      `);
  }),
  delete: protectedProcedure
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    await ctx.db
      .delete(links)
      .where(sql`
        ${links.id} = ${input.id}
        AND EXISTS (
          SELECT 1 FROM notes
          WHERE notes.id = links.from_note_id
          AND notes.user_id = ${ctx.user.id}
        )
      `);
  }),
  getBacklinks: protectedProcedure
  .input(z.object({ noteId: z.string() }))
  .query(async ({ ctx, input }) => {
    return ctx.db
      .select({
        id: links.id,
        fromNoteId: links.fromNoteId,
        fromTitle: notes.title,
      })
      .from(links)
      .innerJoin(notes, eq(links.fromNoteId, notes.id))
      .where(sql`
        ${links.toNoteId} = ${input.noteId}
        AND ${notes.userId} = ${ctx.user.id}
      `);
  }),
});
