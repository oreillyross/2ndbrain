import express from "express";
import * as trpcExpress from "@trpc/server/adapters/express";

import { appRouter } from "./trpc/router";
import { createContext } from "./trpc/context";

const app = express();

app.use(
  "/trpc",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

app.listen(3000, () => {
  console.log("server running on port 3000");
});