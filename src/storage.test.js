import { describe, it, expect, vi, afterEach } from "vitest";
import {
  STORE_KEY, loadLedger, saveLedger, isPlausibleLedger, withDefaults,
  listBackups, restoreBackup, quarantine,
} from "./storage.js";

// Minimal localStorage stand-in; only the migration path still touches it
function makeStore(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    get length() { return map.size; },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => { map.delete(k); },
  };
}

const ledger = (n = 1) => ({
  transactions: Array.from({ length: n }, (_, i) => ({
    id: "t" + i, type: "expense", amount: 10 + i, category: "Groceries",
    date: "2026-08-0" + ((i % 9) + 1),
  })),
  budgets: {}, goals: [], bills: [], billPaid: {}, incomes: [], incomePaid: {},
  budgetRollover: {}, customCats: [], accounts: [], categoryRules: {}, autoPaySkip: {},
});

// Stand in for the local server
function mockServer({ raw = null, getOk = true, putOk = true, backups = [] } = {}) {
  const state = { raw, puts: [] };
  global.fetch = vi.fn(async (url, opts = {}) => {
    const method = opts.method || "GET";
    if (url === "/api/ledger" && method === "GET") {
      return getOk
        ? { ok: true, json: async () => ({ ok: true, raw: state.raw }) }
        : { ok: false, json: async () => ({ ok: false, error: "EACCES" }) };
    }
    if (url === "/api/ledger" && method === "PUT") {
      if (!putOk) return { ok: false, json: async () => ({ ok: false, error: "EACCES" }) };
      state.puts.push(opts.body);
      state.raw = opts.body;
      return { ok: true, json: async () => ({ ok: true }) };
    }
    if (url === "/api/backups" && method === "GET") {
      return { ok: true, json: async () => ({ ok: true, backups, dir: "/x/backups" }) };
    }
    if (url === "/api/backups" && method === "POST") {
      const name = JSON.parse(opts.body).name;
      const hit = backups.find((b) => b.name === name);
      return hit
        ? { ok: true, json: async () => ({ ok: true, raw: JSON.stringify(ledger(2)) }) }
        : { ok: false, json: async () => ({ ok: false, error: "ENOENT" }) };
    }
    throw new Error("unexpected request " + method + " " + url);
  });
  return state;
}

const unreachable = () => { global.fetch = vi.fn(async () => { throw new Error("ECONNREFUSED"); }); };

afterEach(() => { vi.restoreAllMocks(); });

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
  });
});

describe("loadLedger", () => {
  it("returns defaults when the file does not exist yet", async () => {
    mockServer({ raw: null });
    const res = await loadLedger(makeStore());
    expect(res.ok).toBe(true);
    expect(res.data.transactions).toEqual([]);
  });

  it("reads the ledger the server holds and stamps the schema version", async () => {
    mockServer({ raw: JSON.stringify(ledger(2)) });
    const res = await loadLedger(makeStore());
    expect(res.ok).toBe(true);
    expect(res.data.transactions).toHaveLength(2);
    expect(res.data.version).toBe(1);
  });

  it("fills in keys missing from an older ledger", async () => {
    mockServer({ raw: '{"transactions":[]}' });
    const res = await loadLedger(makeStore());
    expect(res.data.customCats).toEqual([]);
    expect(res.data.accounts).toEqual([]);
  });

  // The important one: a bad read must be reported, never swallowed, so the
  // caller can refuse to overwrite the bytes still on disk.
  it("reports corrupt JSON without discarding the raw value", async () => {
    mockServer({ raw: '{"transactions":[{"amo' });
    const res = await loadLedger(makeStore());
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("corrupt");
    expect(res.raw).toBe('{"transactions":[{"amo');
  });

  it("reports well-formed JSON that is not a ledger", async () => {
    mockServer({ raw: '{"hello":"world"}' });
    const res = await loadLedger(makeStore());
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("unrecognized");
  });

  it("reports an unreachable server rather than pretending the ledger is empty", async () => {
    unreachable();
    const res = await loadLedger(makeStore());
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("server-unreachable");
  });

  it("adopts a pre-server ledger out of browser storage exactly once", async () => {
    const state = mockServer({ raw: null });
    const store = makeStore({ [STORE_KEY]: JSON.stringify(ledger(3)) });

    const first = await loadLedger(store);
    expect(first.ok).toBe(true);
    expect(first.migrated).toBe(true);
    expect(first.data.transactions).toHaveLength(3);
    expect(state.puts).toHaveLength(1); // written through to the file

    // Second run: the file wins and the browser copy is not re-imported
    const again = await loadLedger(store);
    expect(again.migrated).toBeUndefined();
    expect(again.data.transactions).toHaveLength(3);
  });

  it("ignores junk left in browser storage", async () => {
    mockServer({ raw: null });
    const res = await loadLedger(makeStore({ [STORE_KEY]: "{not json" }));
    expect(res.ok).toBe(true);
    expect(res.data.transactions).toEqual([]);
  });
});

describe("saveLedger", () => {
  it("writes pretty JSON carrying the schema version", async () => {
    const state = mockServer({ raw: null });
    const res = await saveLedger(ledger(2));
    expect(res.ok).toBe(true);
    const written = JSON.parse(state.puts[0]);
    expect(written.transactions).toHaveLength(2);
    expect(written.version).toBe(1);
    expect(state.puts[0]).toContain("\n"); // readable in an editor
  });

  it("reports a write failure instead of throwing", async () => {
    mockServer({ putOk: false });
    const res = await saveLedger(ledger(1));
    expect(res.ok).toBe(false);
    expect(res.error).toBe("EACCES");
  });

  it("reports an unreachable server", async () => {
    unreachable();
    const res = await saveLedger(ledger(1));
    expect(res.ok).toBe(false);
    expect(res.error).toBe("server-unreachable");
  });
});

describe("backups", () => {
  it("lists what the server holds", async () => {
    mockServer({ backups: [{ name: "ledger-a.json", at: 2, size: 10, count: 4 }] });
    const res = await listBackups();
    expect(res.ok).toBe(true);
    expect(res.backups[0].count).toBe(4);
  });

  it("restores one and returns a usable ledger", async () => {
    mockServer({ backups: [{ name: "ledger-a.json", at: 1, size: 10, count: 2 }] });
    const res = await restoreBackup("ledger-a.json");
    expect(res.ok).toBe(true);
    expect(res.data.transactions).toHaveLength(2);
  });

  it("reports a backup that is not there", async () => {
    mockServer({ backups: [] });
    expect((await restoreBackup("ledger-missing.json")).ok).toBe(false);
  });

  it("survives an unreachable server", async () => {
    unreachable();
    expect((await listBackups()).ok).toBe(false);
    expect((await restoreBackup("ledger-a.json")).ok).toBe(false);
  });
});

describe("quarantine", () => {
  it("parks unreadable bytes under their own key", () => {
    const store = makeStore();
    expect(quarantine("{trunc", store, 1234)).toBe("cash-recovery-1234");
    expect(store.getItem("cash-recovery-1234")).toBe("{trunc");
  });

  it("reuses the key when the same bad value reappears", () => {
    const store = makeStore();
    const first = quarantine("{trunc", store, 1234);
    expect(quarantine("{trunc", store, 5678)).toBe(first);
  });

  it("is a no-op for empty input", () => {
    expect(quarantine("", makeStore())).toBeNull();
  });
});

describe("withDefaults", () => {
  it("never loses fields the ledger already has", () => {
    const merged = withDefaults({
      transactions: [{ id: "a", amount: 1, date: "2026-01-01" }],
      accounts: [{ id: "x" }],
    });
    expect(merged.transactions).toHaveLength(1);
    expect(merged.accounts).toHaveLength(1);
    expect(merged.budgets).toEqual({});
  });
});
