import { describe, it, expect, beforeEach } from "vitest";
import {
  STORE_KEY, MAX_SNAPSHOTS, loadLedger, saveLedger, isPlausibleLedger,
  takeSnapshot, listSnapshots, readSnapshot, pruneSnapshots, quarantine,
} from "./storage.js";

// Minimal localStorage stand-in with the index API listSnapshots relies on
function makeStore(initial = {}, opts = {}) {
  const map = new Map(Object.entries(initial));
  return {
    get length() { return map.size; },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      if (opts.full && !map.has(k)) {
        const err = new Error("quota"); err.name = "QuotaExceededError"; throw err;
      }
      map.set(k, String(v));
    },
    removeItem: (k) => { map.delete(k); },
    _map: map,
  };
}

const ledger = (n = 1) => ({
  transactions: Array.from({ length: n }, (_, i) => ({
    id: "t" + i, type: "expense", amount: 10 + i, category: "Groceries", date: "2026-08-0" + ((i % 9) + 1),
  })),
  budgets: {}, goals: [], bills: [], billPaid: {}, incomes: [], incomePaid: {},
  budgetRollover: {}, customCats: [],
});

describe("isPlausibleLedger", () => {
  it("accepts a real ledger and an empty one", () => {
    expect(isPlausibleLedger(ledger(3))).toBe(true);
    expect(isPlausibleLedger({ transactions: [] })).toBe(true);
  });

  it("rejects junk, arrays, and malformed transactions", () => {
    expect(isPlausibleLedger(null)).toBe(false);
    expect(isPlausibleLedger([])).toBe(false);
    expect(isPlausibleLedger({ transactions: "nope" })).toBe(false);
    expect(isPlausibleLedger({ transactions: [{ amount: "12", date: "2026-08-01" }] })).toBe(false);
    expect(isPlausibleLedger({ transactions: [{ amount: 12 }] })).toBe(false);
  });
});

describe("loadLedger", () => {
  it("returns defaults and ok on an empty store", () => {
    const res = loadLedger(makeStore());
    expect(res.ok).toBe(true);
    expect(res.data.transactions).toEqual([]);
  });

  it("round-trips a saved ledger and stamps the schema version", () => {
    const store = makeStore();
    saveLedger(ledger(2), store);
    const res = loadLedger(store);
    expect(res.ok).toBe(true);
    expect(res.data.transactions).toHaveLength(2);
    expect(res.data.version).toBe(1);
  });

  it("fills in keys missing from an older ledger", () => {
    const store = makeStore({ [STORE_KEY]: JSON.stringify({ transactions: [] }) });
    const res = loadLedger(store);
    expect(res.ok).toBe(true);
    expect(res.data.customCats).toEqual([]);
    expect(res.data.billPaid).toEqual({});
  });

  // The important one: a bad read must be reported, not silently swallowed,
  // so the caller can refuse to overwrite the bytes still on disk.
  it("reports corrupt JSON without discarding the raw value", () => {
    const store = makeStore({ [STORE_KEY]: '{"transactions":[{"amo' });
    const res = loadLedger(store);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("corrupt");
    expect(res.raw).toBe('{"transactions":[{"amo');
  });

  it("reports well-formed JSON that isn't a ledger", () => {
    const store = makeStore({ [STORE_KEY]: '{"hello":"world"}' });
    const res = loadLedger(store);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("unrecognized");
  });
});

describe("saveLedger", () => {
  it("reports quota failures instead of throwing", () => {
    const res = saveLedger(ledger(1), makeStore({}, { full: true }));
    expect(res.ok).toBe(false);
    expect(res.error).toBe("quota");
  });

  it("frees a snapshot and retries when the quota is hit", () => {
    const map = { [`cash-snap-${Date.now() - 99999}`]: JSON.stringify(ledger(1)) };
    let allow = false;
    const store = makeStore(map);
    const realSet = store.setItem;
    store.setItem = (k, v) => {
      if (k === STORE_KEY && !allow) {
        allow = true; // fail once, succeed after a prune
        const err = new Error("quota"); err.name = "QuotaExceededError"; throw err;
      }
      realSet(k, v);
    };
    const res = saveLedger(ledger(2), store);
    expect(res.ok).toBe(true);
    expect(listSnapshots(store)).toHaveLength(0);
  });
});

describe("snapshots", () => {
  let store;
  beforeEach(() => {
    store = makeStore();
    saveLedger(ledger(3), store);
  });

  it("captures the stored ledger and can read it back", () => {
    expect(takeSnapshot(store, 1_000_000)).toBe(true);
    const snaps = listSnapshots(store);
    expect(snaps).toHaveLength(1);
    expect(snaps[0].count).toBe(3);
    expect(readSnapshot(snaps[0].key, store).transactions).toHaveLength(3);
  });

  it("throttles to one snapshot per interval", () => {
    expect(takeSnapshot(store, 1_000_000)).toBe(true);
    saveLedger(ledger(4), store);
    expect(takeSnapshot(store, 1_000_000 + 60_000)).toBe(false);
    expect(takeSnapshot(store, 1_000_000 + 7 * 60 * 60 * 1000)).toBe(true);
    expect(listSnapshots(store)).toHaveLength(2);
  });

  it("skips a snapshot when nothing changed", () => {
    const t = 1_000_000;
    expect(takeSnapshot(store, t)).toBe(true);
    expect(takeSnapshot(store, t + 7 * 60 * 60 * 1000)).toBe(false);
  });

  it("keeps only the newest MAX_SNAPSHOTS", () => {
    const gap = 7 * 60 * 60 * 1000;
    for (let i = 0; i < MAX_SNAPSHOTS + 3; i++) {
      saveLedger(ledger(i + 1), store);
      takeSnapshot(store, 1_000_000 + i * gap);
    }
    const snaps = listSnapshots(store);
    expect(snaps).toHaveLength(MAX_SNAPSHOTS);
    expect(snaps[0].at).toBeGreaterThan(snaps[snaps.length - 1].at);
  });

  it("refuses to snapshot corrupt bytes", () => {
    const bad = makeStore({ [STORE_KEY]: "{oops" });
    expect(takeSnapshot(bad, 1_000_000)).toBe(false);
    expect(listSnapshots(bad)).toHaveLength(0);
  });

  it("prune reports how many it removed", () => {
    const gap = 7 * 60 * 60 * 1000;
    for (let i = 0; i < MAX_SNAPSHOTS; i++) {
      saveLedger(ledger(i + 1), store);
      takeSnapshot(store, 1_000_000 + i * gap);
    }
    expect(pruneSnapshots(2, store)).toBe(2);
    expect(listSnapshots(store)).toHaveLength(MAX_SNAPSHOTS - 2);
  });
});

describe("quarantine", () => {
  it("parks unreadable bytes under their own key", () => {
    const store = makeStore();
    const key = quarantine("{trunc", store, 1234);
    expect(key).toBe("cash-recovery-1234");
    expect(store.getItem(key)).toBe("{trunc");
  });

  it("is a no-op for empty input", () => {
    expect(quarantine("", makeStore())).toBeNull();
  });

  it("reuses the existing key when the same bad value reappears", () => {
    const store = makeStore();
    const first = quarantine("{trunc", store, 1234);
    const second = quarantine("{trunc", store, 5678);
    expect(second).toBe(first);
    expect(Object.keys(store._map).filter((k) => k.startsWith("cash-recovery-"))).toHaveLength(0);
    expect([...store._map.keys()].filter((k) => k.startsWith("cash-recovery-"))).toHaveLength(1);
  });
});
