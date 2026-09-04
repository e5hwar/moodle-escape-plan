import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages serves this app from a /moodle-escape-plan/ subpath, but
  // Vercel serves it from the domain root. Vercel sets VERCEL=1 during its
  // build automatically, so branch on that instead of an extra env var.
  base: process.env.VERCEL ? "/" : "/moodle-escape-plan/",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
  },
});
