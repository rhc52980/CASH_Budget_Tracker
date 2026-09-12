// Shared setup for component tests. jsdom lacks the handful of browser APIs
// the app touches on mount; each is stubbed just enough for a render.
import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  try { localStorage.clear(); } catch { /* not in jsdom */ }
});

if (typeof window !== "undefined") {
  // This jsdom build leaves localStorage undefined; the app reads the theme
  // and the last-export time from it on mount.
  let hasStorage = false;
  try { hasStorage = typeof window.localStorage?.getItem === "function"; } catch { hasStorage = false; }
  if (!hasStorage) {
    const make = () => {
      const m = new Map();
      return {
        get length() { return m.size; },
        key: (i) => [...m.keys()][i] ?? null,
        getItem: (k) => (m.has(k) ? m.get(k) : null),
        setItem: (k, v) => { m.set(String(k), String(v)); },
        removeItem: (k) => { m.delete(k); },
        clear: () => { m.clear(); },
      };
    };
    // vi.stubGlobal is the supported way past the read-only globals vitest sets up
    vi.stubGlobal("localStorage", make());
    vi.stubGlobal("sessionStorage", make());
  }
  // Theme and layout queries. Default: light, desktop, motion allowed.
  window.matchMedia = window.matchMedia || ((query) => ({
    matches: false, media: query, onchange: null,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent() { return false; },
  }));
  window.scrollTo = () => {};
  window.HTMLElement.prototype.scrollIntoView = function () {};
  // Recharts' ResponsiveContainer measures itself with this
  window.ResizeObserver = window.ResizeObserver || class {
    observe() {} unobserve() {} disconnect() {}
  };
  // The count-up animation on the summary stats
  window.requestAnimationFrame = window.requestAnimationFrame || ((cb) => setTimeout(() => cb(performance.now()), 16));
  window.cancelAnimationFrame = window.cancelAnimationFrame || ((id) => clearTimeout(id));
}
