import express from "express";

const app = express();

app.get("/api/health", (_, res) => {
  res.json({ status: "ok" });
});

app.listen(3000, () => {
  console.log("API server running on port 3000");
});