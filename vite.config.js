import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Rewrites the placeholders in the copied sw.js with this build's real asset
// list, so the app shell is cached on first visit and each build busts the
// previous cache.
function serviceWorkerPrecache() {
  return {
    name: "sw-precache",
    apply: "build",
    closeBundle() {
      const dist = join(process.cwd(), "dist");
      const swPath = join(dist, "sw.js");

      const walk = (dir) =>
        readdirSync(dir).flatMap((name) => {
          const full = join(dir, name);
          return statSync(full).isDirectory() ? walk(full) : [full];
        });

      const urls = walk(dist)
        .map((f) => "./" + relative(dist, f).split("\\").join("/"))
        .filter((u) => u !== "./sw.js" && !u.endsWith(".map"))
        .concat("./");

      const build = Date.now().toString(36);
      const src = readFileSync(swPath, "utf8")
        .replace("__BUILD__", build)
        .replace("__PRECACHE__", JSON.stringify(urls));
      writeFileSync(swPath, src);
      console.log(`sw-precache: ${urls.length} entries, cache cash-${build}`);
    },
  };
}

export default defineConfig({
  plugins: [react(), serviceWorkerPrecache()],
  // Relative base so the build works at any path — GitHub Pages serves the
  // app from /CASH_Budget_Tracker/, local preview from /
  base: "./",
});
