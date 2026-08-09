import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative base so the build works at any path — GitHub Pages serves the
  // app from /CASH_Budget_Tracker/, local preview from /
  base: "./",
});
