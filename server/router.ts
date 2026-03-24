import { router, publicProcedure } from "./trpc";
import { notesRouter } from "./db/router";
import { linksRouter } from "./db/router";
import { authRouter } from "./db/router";


export const appRouter = router({
  health: router({
    ping: publicProcedure.query(() => {
      return { status: "ok" };
    }),
  }),
  notes: notesRouter,
  links: linksRouter,
  auth: authRouter,
  
});

export type AppRouter = typeof appRouter;
