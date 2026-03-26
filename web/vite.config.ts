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
    host: true,
    port: 5173,
    allowedHosts: true,
    proxy: {
      "/api": "http://localhost:3000",
      "/trpc": "http://localhost:3000",
    },
  },
});