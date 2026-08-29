// Serves the built app and keeps the ledger in a plain JSON file next to it,
// rather than inside browser storage. A browser page cannot write to disk on
// its own, so this small server is what makes the folder the source of truth.
//
// No dependencies on purpose: node's own http/fs only.
import { createServer } from "node:http";
import { readFile, writeFile, rename, mkdir, readdir, stat, copyFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, "dist");
const DATA_DIR = process.env.CASH_DATA_DIR || join(HERE, "data");
const LEDGER = join(DATA_DIR, "ledger.json");
const BACKUP_DIR = join(DATA_DIR, "backups");
const PORT = Number(process.env.CASH_PORT || 4173);
const HOST = "127.0.0.1"; // never expose the ledger to the network
const MAX_BACKUPS = 30;
const BACKUP_EVERY_MS = 6 * 60 * 60 * 1000;

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".woff2": "font/woff2", ".map": "application/json",
};

const json = (res, code, body) => {
  const s = JSON.stringify(body);
  res.writeHead(code, { "content-type": MIME[".json"], "cache-control": "no-store" });
  res.end(s);
};

async function readLedger() {
  try {
    return { ok: true, raw: await readFile(LEDGER, "utf8") };
  } catch (e) {
    if (e.code === "ENOENT") return { ok: true, raw: null };   // first run
    return { ok: false, error: e.code || "unreadable" };
  }
}

// Write to a temp file then rename: a crash mid-write leaves the previous
// ledger intact instead of a half-written one.
async function writeLedger(text) {
  await mkdir(DATA_DIR, { recursive: true });
  const tmp = LEDGER + ".tmp";
  await writeFile(tmp, text, "utf8");
  await rename(tmp, LEDGER);
}

async function rotateBackups() {
  try {
    await mkdir(BACKUP_DIR, { recursive: true });
    const files = (await readdir(BACKUP_DIR)).filter((f) => f.startsWith("ledger-")).sort();
    const newest = files[files.length - 1];
    if (newest) {
      const age = Date.now() - (await stat(join(BACKUP_DIR, newest))).mtimeMs;
      if (age < BACKUP_EVERY_MS) return;
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await copyFile(LEDGER, join(BACKUP_DIR, `ledger-${stamp}.json`));
    const all = (await readdir(BACKUP_DIR)).filter((f) => f.startsWith("ledger-")).sort();
    for (const old of all.slice(0, Math.max(0, all.length - MAX_BACKUPS))) {
      await unlink(join(BACKUP_DIR, old)).catch(() => {});
    }
  } catch {
    // A failed backup must never block a successful save.
  }
}

async function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split("?")[0]);
  if (rel === "/" || rel === "") rel = "/index.html";
  // Keep the request inside dist/
  const target = normalize(join(DIST, rel));
  if (!target.startsWith(DIST)) { res.writeHead(403); return res.end("Forbidden"); }
  try {
    const body = await readFile(target);
    res.writeHead(200, {
      "content-type": MIME[extname(target).toLowerCase()] || "application/octet-stream",
      "cache-control": rel === "/index.html" ? "no-store" : "public, max-age=3600",
    });
    res.end(body);
  } catch {
    // SPA fallback
    try {
      const body = await readFile(join(DIST, "index.html"));
      res.writeHead(200, { "content-type": MIME[".html"], "cache-control": "no-store" });
      res.end(body);
    } catch {
      res.writeHead(404); res.end("Not found");
    }
  }
}

const server = createServer(async (req, res) => {
  const url = req.url || "/";

  if (url.startsWith("/api/ledger")) {
    if (req.method === "GET") {
      const r = await readLedger();
      if (!r.ok) return json(res, 500, { ok: false, error: r.error });
      return json(res, 200, { ok: true, raw: r.raw, path: LEDGER });
    }
    if (req.method === "PUT") {
      let body = "";
      req.on("data", (c) => {
        body += c;
        if (body.length > 32 * 1024 * 1024) { req.destroy(); }
      });
      req.on("end", async () => {
        try {
          JSON.parse(body);           // refuse to persist anything unparseable
        } catch {
          return json(res, 400, { ok: false, error: "not valid JSON" });
        }
        try {
          await writeLedger(body);
          await rotateBackups();
          return json(res, 200, { ok: true, path: LEDGER });
        } catch (e) {
          return json(res, 500, { ok: false, error: e.code || "write failed" });
        }
      });
      return;
    }
    return json(res, 405, { ok: false, error: "method not allowed" });
  }

  if (url.startsWith("/api/backups")) {
    if (req.method === "GET") {
      try {
        await mkdir(BACKUP_DIR, { recursive: true });
        const names = (await readdir(BACKUP_DIR)).filter((f) => f.startsWith("ledger-")).sort().reverse();
        const rows = [];
        for (const name of names) {
          const full = join(BACKUP_DIR, name);
          const st = await stat(full);
          let count = null;
          try { count = JSON.parse(await readFile(full, "utf8")).transactions?.length ?? null; } catch { /* keep row */ }
          rows.push({ name, at: st.mtimeMs, size: st.size, count });
        }
        return json(res, 200, { ok: true, backups: rows, dir: BACKUP_DIR });
      } catch (e) {
        return json(res, 500, { ok: false, error: e.code || "unreadable" });
      }
    }
    // POST /api/backups/restore  { name }
    if (req.method === "POST") {
      let body = "";
      req.on("data", (c) => { body += c; if (body.length > 1e6) req.destroy(); });
      req.on("end", async () => {
        let name;
        try { name = JSON.parse(body).name; } catch { return json(res, 400, { ok: false, error: "bad request" }); }
        // Never let a name escape the backups folder
        if (!name || !/^ledger-[\w.\-]+\.json$/.test(name)) {
          return json(res, 400, { ok: false, error: "bad backup name" });
        }
        try {
          const text = await readFile(join(BACKUP_DIR, name), "utf8");
          JSON.parse(text);
          await writeLedger(text);
          return json(res, 200, { ok: true, raw: text });
        } catch (e) {
          return json(res, 500, { ok: false, error: e.code || "restore failed" });
        }
      });
      return;
    }
    return json(res, 405, { ok: false, error: "method not allowed" });
  }

  if (url.startsWith("/api/health")) {
    return json(res, 200, { ok: true, dataDir: DATA_DIR, ledger: LEDGER });
  }

  return serveStatic(req, res, url);
});

if (!existsSync(DIST)) {
  console.error("dist/ is missing - run the installer or `npm run build` first.");
  process.exit(1);
}

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. CASH is probably already running.`);
    process.exit(1);
  }
  console.error(e);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`CASH serving http://localhost:${PORT}`);
  console.log(`Ledger file: ${LEDGER}`);
});
