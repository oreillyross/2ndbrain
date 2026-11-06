import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../init";

const id = z.uuid();
const MAX_PROMPT_CHARS = 12_000;

export const themesRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(200),
        description: z.string().max(2_000).optional(),
      }),
    )
    .mutation(({ ctx, input }) => ctx.repo.themes.create(input)),

  list: protectedProcedure.query(({ ctx }) => ctx.repo.themes.list()),

  getById: protectedProcedure
    .input(z.object({ id }))
    .query(({ ctx, input }) => ctx.repo.themes.getById(input.id)),

  getNotes: protectedProcedure
    .input(z.object({ themeId: id }))
    .query(({ ctx, input }) => ctx.repo.notes.byTheme(input.themeId)),

  /** 2 DB round trips + 1 OpenAI subrequest. */
  summarise: protectedProcedure
    .input(z.object({ themeId: id }))
    .mutation(async ({ ctx, input }) => {
      const notes = await ctx.repo.themes.notesForSummary(input.themeId);
      if (notes.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No notes to summarise" });
      }
      const text = notes
        .map((n) => `${n.title}\n${n.content}`)
        .join("\n\n---\n\n")
        .slice(0, MAX_PROMPT_CHARS);

      let synopsis: string;
      try {
        synopsis = await ctx.ai.summarise(text);
      } catch (err) {
        console.error("themes.summarise: AI call failed", err);
        throw new TRPCError({ code: "BAD_GATEWAY", message: "Summary service failed" });
      }
      return ctx.repo.themes.setSynopsis({
        themeId: input.themeId,
        synopsis,
        model: ctx.ai.model,
      });
    }),
});
