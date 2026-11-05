import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../../../shared/trpc";
import superjson from "superjson";

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/trpc",
      transformer: superjson,
      // Server rejects batches over 10 (one Worker invocation per batch).
      maxItems: 10,
    }),
  ],
});
