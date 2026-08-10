// Replaced at build time from package.json (see vite.config.js). The fallback
// only applies if something imports this outside a Vite build, e.g. a test.
export const APP_VERSION =
  typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "0.0.0-dev";
