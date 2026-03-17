import { router, publicProcedure } from "../../trpc";
import { z } from "zod";
import { db } from "../";
import { notes } from "../schema";
import { randomUUID } from "crypto";

export const notesRouter = router({
  list: publicProcedure.query(async () => {
    return await db.select().from(notes);
  }),

  create: publicProcedure
    .input(z.object({ content: z.string() }))
    .mutation(async ({ input }) => {
      const note = {
        id: randomUUID(),
        content: input.content,
      };

      await db.insert(notes).values(note);

      return note;
    }),
});