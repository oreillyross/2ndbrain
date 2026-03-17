import express from "express";
import {appRouter} from "./router"
import * as trpcExpress from "@trpc/server/adapters/express"

const app = express();

app.get("/api/health", (_, res) => {
  res.json({ status: "ok" });
});

app.use(
  "/trpc",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext: () => ({}),
  })
);

app.listen(3000, () => {
  console.log("API server running on port 3000");
});