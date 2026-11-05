// server/routers/themes.ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../trpc";
import { themes, notes } from "../schema";
import { eq, count, and } from "drizzle-orm";

export const themesRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [theme] = await ctx.db
        .insert(themes)
        .values({
          ...input,
          userId: ctx.user.id,
        })
        .returning();

      return theme;
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const result = await ctx.db
      .select({
        id: themes.id,
        name: themes.name,
        description: themes.description,
        createdAt: themes.createdAt,
        noteCount: count(notes.id),
        synopsis: themes.synopsis,
        synopsisUpdatedAt: themes.synopsisUpdatedAt,
        synopsisModel: themes.synopsisModel,
      })
      .from(themes)
      .leftJoin(notes, eq(notes.themeId, themes.id))
      .where(eq(themes.userId, ctx.user.id))
      .groupBy(themes.id);

    return result;
  }),

  // ✅ FIXED: id must NOT be nullable
  getById: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const [theme] = await ctx.db
        .select()
        .from(themes)
        .where(and(eq(themes.id, input.id), eq(themes.userId, ctx.user.id)))
        .limit(1);

      return theme ?? null;
    }),

  getNotes: protectedProcedure
    .input(z.object({ themeId: z.uuid() }))
    .query(async ({ input, ctx }) => {
      return ctx.db.query.notes.findMany({
        where: and(
          eq(notes.themeId, input.themeId),
          eq(notes.userId, ctx.user.id),
        ),
        orderBy: (n, { desc }) => [desc(n.createdAt)],
      });
    }),

  summarise: protectedProcedure
    .input(z.object({ themeId: z.uuid() }))
    .mutation(async ({ input, ctx }) => {
      const [theme] = await ctx.db
        .select({ id: themes.id })
        .from(themes)
        .where(
          and(eq(themes.id, input.themeId), eq(themes.userId, ctx.user.id)),
        )
        .limit(1);
      if (!theme) throw new TRPCError({ code: "NOT_FOUND" });

      // ✅ FIX: avoid shadowing "notes"
      const themeNotes = await ctx.db.query.notes.findMany({
        where: and(
          eq(notes.themeId, input.themeId),
          eq(notes.userId, ctx.user.id),
        ),
        columns: {
          title: true,
          content: true,
        },
      });

      if (themeNotes.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No notes to summarise",
        });
      }

      // build prompt
      const text = themeNotes
        .map((n) => `${n.title}\n${n.content ?? ""}`)
        .join("\n\n---\n\n")
        .slice(0, 12000);

      // call OpenAI
      const res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          input: [
            {
              role: "system",
              content: `You are an expert thinking assistant. 
Summarise the key ideas, themes, and insights from a collection of notes.
Be concise but insightful.`,
            },
            {
              role: "user",
              content: text,
            },
          ],
        }),
      });

      const json = await res.json();
      const summary =
        json.output?.[0]?.content?.[0]?.text ?? "No summary generated";

      // store result
      const [updated] = await ctx.db
        .update(themes)
        .set({
          synopsis: summary,
          synopsisUpdatedAt: new Date(),
          synopsisModel: "gpt-4.1-mini",
        })
        .where(
          and(eq(themes.id, input.themeId), eq(themes.userId, ctx.user.id)),
        )
        .returning();

      return updated;
    }),
});
