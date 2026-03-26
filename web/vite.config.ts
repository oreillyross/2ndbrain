import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],

  root: __dirname,

  build: {
    outDir: path.resolve(__dirname, "../dist"),
    emptyOutDir: true,
  },

  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true,
    proxy: {
      "/api": "http://localhost:8080",
      "/trpc": "http://localhost:8080",
    },
  },
});