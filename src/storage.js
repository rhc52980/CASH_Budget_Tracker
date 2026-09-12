// Persistence layer. Deliberately defensive: this is the only copy of the
// user's ledger, so a bad read must never lead to overwriting good bytes.
export const STORE_KEY = "budget-book-v1";
// The ledger now lives in a file the local server owns; STORE_KEY is kept only
// so a pre-server ledger can be migrated out of browser storage once.
export const LEDGER_API = "/api/ledger";
export const MIGRATED_KEY = "cash-migrated-at";
// A unique query string per read. The service worker matches its cache by
// URL, so this can never hit a cached copy of the ledger — even a worker
// from before /api/ was excluded from caching. `cache: "no-store"` alone
// does not reach the worker's cache.
export const fresh = (url) => `${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}`;
export const SCHEMA_VERSION = 1;

const LAST_EXPORT_KEY = "cash-last-export";

export const DEFAULTS = {
  version: SCHEMA_VERSION,
  transactions: [], budgets: {}, goals: [], bills: [], billPaid: {},
  incomes: [], incomePaid: {}, budgetRollover: {}, customCats: [], accounts: [],
  // merchant key -> category, learned from what you pick during CSV import
  categoryRules: {},
  // month -> billId -> true. Records that the user undid an auto-pay for that
  // month, so it is not immediately re-applied.
  autoPaySkip: {},
  // Same idea, for expected income marked auto-receive.
  incomeAutoPaySkip: {},
};

// Shape check that's strict enough to catch corruption but loose enough to
// accept ledgers written by older versions of the app.
export function isPlausibleLedger(o) {
  return Boolean(
    o && typeof o === "object" && !Array.isArray(o) &&
    Array.isArray(o.transactions) &&
    o.transactions.every((t) => t && typeof t.amount === "number" && typeof t.date === "string")
  );
}

export function withDefaults(parsed) {
  return { ...DEFAULTS, ...parsed, version: SCHEMA_VERSION };
}

/**
 * Read the ledger from the server's file.
 * Returns { data, ok, raw, reason }. When ok is false the caller MUST NOT
 * write - `raw` still holds whatever was there, and quarantine() can save it.
 * On a very first run it also adopts anything left in browser storage by an
 * older version, so upgrading does not look like data loss.
 */
export async function loadLedger(store = localStorage) {
  let res;
  try {
    res = await fetch(fresh(LEDGER_API), { cache: "no-store" });
  } catch {
    return { data: withDefaults({}), ok: false, raw: null, reason: "server-unreachable" };
  }
  if (!res.ok) return { data: withDefaults({}), ok: false, raw: null, reason: "server-error" };

  const body = await res.json();
  if (!body.ok) return { data: withDefaults({}), ok: false, raw: null, reason: body.error || "unreadable" };

  let raw = body.raw;

  // Nothing on disk yet: adopt a pre-server ledger if one is sitting in the browser.
  if (raw === null || raw === "") {
    let legacy = null;
    try { legacy = store.getItem(STORE_KEY); } catch { /* ignore */ }
    if (legacy) {
      try {
        if (isPlausibleLedger(JSON.parse(legacy))) {
          const migrated = withDefaults(JSON.parse(legacy));
          await saveLedger(migrated);
          try { store.setItem(MIGRATED_KEY, new Date().toISOString()); } catch { /* ignore */ }
          return { data: migrated, ok: true, raw: legacy, migrated: true };
        }
      } catch { /* fall through to an empty ledger */ }
    }
    return { data: withDefaults({}), ok: true, raw: null };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { data: withDefaults({}), ok: false, raw, reason: "corrupt" };
  }
  if (!isPlausibleLedger(parsed)) {
    return { data: withDefaults({}), ok: false, raw, reason: "unrecognized" };
  }
  return { data: withDefaults(parsed), ok: true, raw };
}

/** Write the ledger through the server. */
export async function saveLedger(data) {
  const payload = JSON.stringify({ ...data, version: SCHEMA_VERSION }, null, 2);
  try {
    const res = await fetch(LEDGER_API, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: payload,
    });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: body.error || "blocked" };
  } catch {
    return { ok: false, error: "server-unreachable" };
  }
}

/* ---------- backups, kept on disk by the server ---------- */

export const BACKUPS_API = "/api/backups";

/** Timestamped copies the server keeps beside the ledger file. */
export async function listBackups() {
  try {
    const res = await fetch(fresh(BACKUPS_API), { cache: "no-store" });
    if (!res.ok) return { ok: false, backups: [] };
    const body = await res.json();
    return body.ok ? { ok: true, backups: body.backups, dir: body.dir } : { ok: false, backups: [] };
  } catch {
    return { ok: false, backups: [] };
  }
}

/** Roll the ledger file back to one of those copies. */
export async function restoreBackup(name) {
  try {
    const res = await fetch(BACKUPS_API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) return { ok: false, error: body.error || "restore failed" };
    const parsed = JSON.parse(body.raw);
    return isPlausibleLedger(parsed)
      ? { ok: true, data: withDefaults(parsed) }
      : { ok: false, error: "backup is not a ledger" };
  } catch {
    return { ok: false, error: "server-unreachable" };
  }
}

/** Park unreadable bytes under their own key so nothing overwrites them. */
export function quarantine(raw, store = localStorage, now = Date.now()) {
  if (!raw) return null;
  try {
    // Don't pile up duplicates if the same bad value is seen again
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k && k.startsWith("cash-recovery-") && store.getItem(k) === raw) return k;
    }
    const key = `cash-recovery-${now}`;
    store.setItem(key, raw);
    return key;
  } catch {
    return null;
  }
}

/* ---------- browser storage durability ---------- */

export async function requestPersistence() {
  if (!navigator.storage || !navigator.storage.persist) return "unsupported";
  try {
    if (await navigator.storage.persisted()) return "persisted";
    return (await navigator.storage.persist()) ? "persisted" : "best-effort";
  } catch {
    return "unsupported";
  }
}

export async function storageUsage() {
  if (!navigator.storage || !navigator.storage.estimate) return null;
  try {
    const { usage, quota } = await navigator.storage.estimate();
    return { usage, quota };
  } catch {
    return null;
  }
}

export const lastExportAt = (store = localStorage) => Number(store.getItem(LAST_EXPORT_KEY)) || 0;
export const markExported = (store = localStorage, now = Date.now()) =>
  store.setItem(LAST_EXPORT_KEY, String(now));
