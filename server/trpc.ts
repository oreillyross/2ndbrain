import { initTRPC } from "@trpc/server";
import superjson from "superjson"
import type {Context} from "./context"


const t = initTRPC.context<Context>().create({transformer: superjson});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new Error("UNAUTHORIZED");
  }

  return next({
    ctx: {
      user: ctx.user,
    },
  });
});