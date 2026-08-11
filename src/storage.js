// Persistence layer. Deliberately defensive: this is the only copy of the
// user's ledger, so a bad read must never lead to overwriting good bytes.
export const STORE_KEY = "budget-book-v1";
export const SCHEMA_VERSION = 1;

const SNAP_PREFIX = "cash-snap-";
const LAST_EXPORT_KEY = "cash-last-export";
export const MAX_SNAPSHOTS = 5;
const MIN_SNAPSHOT_GAP_MS = 6 * 60 * 60 * 1000; // 6 hours

export const DEFAULTS = {
  version: SCHEMA_VERSION,
  transactions: [], budgets: {}, goals: [], bills: [], billPaid: {},
  incomes: [], incomePaid: {}, budgetRollover: {}, customCats: [], accounts: [],
  // month -> billId -> true. Records that the user undid an auto-pay for that
  // month, so it is not immediately re-applied.
  autoPaySkip: {},
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
 * Read the ledger.
 * Returns { data, ok, raw, reason }. When ok is false the caller MUST NOT
 * write — `raw` still holds whatever was there, and quarantine() can save it.
 */
export function loadLedger(store = localStorage) {
  let raw = null;
  try {
    raw = store.getItem(STORE_KEY);
  } catch (e) {
    return { data: withDefaults({}), ok: false, raw: null, reason: "unreadable" };
  }
  if (raw === null || raw === "") return { data: withDefaults({}), ok: true, raw: null };

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

/**
 * Write the ledger. If the quota is hit, give up snapshots one at a time to
 * make room — the live ledger always outranks its own backups.
 */
export function saveLedger(data, store = localStorage) {
  const payload = JSON.stringify({ ...data, version: SCHEMA_VERSION });
  let lastErr;
  for (let attempt = 0; attempt <= MAX_SNAPSHOTS; attempt++) {
    try {
      store.setItem(STORE_KEY, payload);
      return { ok: true };
    } catch (e) {
      lastErr = e;
      if (!dropOldestSnapshot(store)) break;
    }
  }
  return { ok: false, error: lastErr && lastErr.name === "QuotaExceededError" ? "quota" : "blocked" };
}

/* ---------- rolling local snapshots ---------- */

export function listSnapshots(store = localStorage) {
  const out = [];
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (!key || !key.startsWith(SNAP_PREFIX)) continue;
    const at = Number(key.slice(SNAP_PREFIX.length));
    if (!Number.isFinite(at)) continue;
    let size = 0, count = null;
    try {
      const v = store.getItem(key);
      size = v ? v.length : 0;
      const parsed = JSON.parse(v);
      count = Array.isArray(parsed.transactions) ? parsed.transactions.length : null;
    } catch { /* keep the row; it just shows no entry count */ }
    out.push({ key, at, size, count });
  }
  return out.sort((a, b) => b.at - a.at);
}

/**
 * Copy the current stored value aside, at most once every few hours, keeping
 * the newest MAX_SNAPSHOTS. Only ever snapshots bytes that parse.
 */
export function takeSnapshot(store = localStorage, now = Date.now()) {
  let raw;
  try {
    raw = store.getItem(STORE_KEY);
  } catch { return false; }
  if (!raw) return false;
  try {
    if (!isPlausibleLedger(JSON.parse(raw))) return false;
  } catch { return false; }

  const existing = listSnapshots(store);
  if (existing.length && now - existing[0].at < MIN_SNAPSHOT_GAP_MS) return false;
  if (existing.length && store.getItem(existing[0].key) === raw) return false;

  try {
    store.setItem(SNAP_PREFIX + now, raw);
  } catch {
    return false;
  }
  pruneSnapshots(0, store);
  return true;
}

/** Trim to MAX_SNAPSHOTS - extra. Returns how many were removed. */
export function pruneSnapshots(extra = 0, store = localStorage) {
  const snaps = listSnapshots(store);
  const keep = Math.max(0, MAX_SNAPSHOTS - extra);
  let removed = 0;
  snaps.slice(keep).forEach((s) => {
    try { store.removeItem(s.key); removed++; } catch { /* ignore */ }
  });
  return removed;
}

/** Remove the single oldest snapshot. Returns false when there are none. */
export function dropOldestSnapshot(store = localStorage) {
  const snaps = listSnapshots(store);
  if (!snaps.length) return false;
  try {
    store.removeItem(snaps[snaps.length - 1].key);
    return true;
  } catch {
    return false;
  }
}

export function readSnapshot(key, store = localStorage) {
  try {
    const parsed = JSON.parse(store.getItem(key));
    return isPlausibleLedger(parsed) ? withDefaults(parsed) : null;
  } catch {
    return null;
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
