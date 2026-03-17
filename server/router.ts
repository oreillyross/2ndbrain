import { router, publicProcedure } from "./trpc";
import {notesRouter} from "./db/router"


export const appRouter = router({
  health: router({
    ping: publicProcedure.query(() => {
      return { status: "ok" };
    }),
  }),
notes: notesRouter, 
  
});

export type AppRouter = typeof appRouter;