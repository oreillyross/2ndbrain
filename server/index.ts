import express from "express";
import path from "path";
import { appRouter } from "./router";
import * as trpcExpress from "@trpc/server/adapters/express";
import { createContext } from "./context";

const app = express();


// ✅ middleware
app.use(express.json());

// ✅ health check
app.get("/api/health", (_, res) => {
  res.json({ status: "ok" });
});

// ✅ tRPC
app.use(
  "/trpc",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);


if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "..");

  console.log("Serving static from:", distPath);

  // static files first
  app.use(express.static(distPath));
  

  // ✅ fallback WITHOUT path matching
  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    if (req.path.startsWith("/trpc")) return next();
    if (req.path.startsWith("/api")) return next();
    if (req.path.startsWith("/assets")) return next();
    
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// ✅ dynamic port for Railway
const PORT = Number(process.env.PORT) || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});