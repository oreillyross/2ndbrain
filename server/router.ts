import { router, publicProcedure } from "./trpc";
import { notesRouter, linksRouter, authRouter, themesRouter } from "./db/router";



export const appRouter = router({
  health: router({
    ping: publicProcedure.query(() => {
      return { status: "ok" };
    }),
  }),
  notes: notesRouter,
  links: linksRouter,
  auth: authRouter,
  themes: themesRouter,
  
});

export type AppRouter = typeof appRouter;
