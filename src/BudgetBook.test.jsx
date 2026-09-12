// End-to-end through the real components and the real storage layer, with
// only fetch stood in for the server. These exist because the two worst bugs
// this app has shipped — a crash opening Backup & data, and a reload writing
// a stale ledger over the real file — both passed a test suite that only
// exercised pure functions.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BudgetBook from "./BudgetBook.jsx";

const ledger = () => ({
  version: 1,
  transactions: [
    { id: "t1", type: "income", amount: 3000, category: "Salary", date: "2026-09-01", note: "Paycheck" },
    { id: "t2", type: "expense", amount: 84.12, category: "Groceries", date: "2026-09-03", note: "Weekly shop" },
  ],
  budgets: {}, goals: [], bills: [{ id: "b1", name: "Rent", amount: 1500, category: "Housing", dueDay: 1 }],
  billPaid: {}, incomes: [], incomePaid: {}, budgetRollover: {}, customCats: [], accounts: [],
  categoryRules: {}, autoPaySkip: {}, incomeAutoPaySkip: {},
});

// A fake server: GET returns `raw`, PUT stores it. `down` fails everything;
// `writesFail` fails only writes.
function server({ raw = JSON.stringify(ledger()), down = false, writesFail = false } = {}) {
  const s = { raw, puts: [], down, writesFail };
  global.fetch = vi.fn(async (url, opts = {}) => {
    if (s.down) throw new TypeError("Failed to fetch");
    const path = String(url).split("?")[0];
    const method = opts.method || "GET";
    const json = (body, ok = true) => ({ ok, json: async () => body });
    if (path === "/api/ledger" && method === "GET") return json({ ok: true, raw: s.raw });
    if (path === "/api/ledger" && method === "PUT") {
      if (s.writesFail) throw new TypeError("Failed to fetch");
      s.puts.push(opts.body); s.raw = opts.body;
      return json({ ok: true });
    }
    if (path === "/api/backups" && method === "GET") return json({ ok: true, backups: [], dir: "C:\\CASH\\data\\backups" });
    throw new Error("unexpected " + method + " " + path);
  });
  return s;
}

const lastPut = (s) => JSON.parse(s.puts[s.puts.length - 1]);

beforeEach(() => {
  // Bills in the ledger have no createdAt, and the pinned date keeps the
  // due-in-7-days card deterministic.
  vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date("2026-09-12T12:00:00") });
});

describe("BudgetBook", () => {
  it("loads the ledger and writes it back unchanged", async () => {
    const s = server();
    render(<BudgetBook />);
    await screen.findByText("Weekly shop");
    await waitFor(() => expect(s.puts.length).toBeGreaterThan(0));
    const written = lastPut(s);
    expect(written.transactions).toEqual(ledger().transactions);
    expect(written.bills).toEqual(ledger().bills);
  });

  it("opens Backup & data without crashing and shows where the ledger lives", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    server();
    render(<BudgetBook />);
    await screen.findByText("Weekly shop");
    await user.click(screen.getByRole("button", { name: "Backup & data" }));
    expect(await screen.findByRole("heading", { name: "Backup & data" })).toBeInTheDocument();
    // The panel derives the ledger path from the backups folder it was told about
    expect(await screen.findByText(/CASH\\data\\ledger\.json/)).toBeInTheDocument();
  });

  it("opened before the server is up, it says so and fills in when the server appears", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const s = server({ down: true });
    render(<BudgetBook />);
    expect(await screen.findByText(/your ledger hasn't loaded yet/)).toBeInTheDocument();
    expect(s.puts).toHaveLength(0); // never writes over a ledger it could not read
    s.down = false;
    await user.click(screen.getByRole("button", { name: "Retry now" }));
    expect(await screen.findByText("Weekly shop")).toBeInTheDocument();
    expect(screen.queryByText(/hasn't loaded yet/)).not.toBeInTheDocument();
  });

  it("keeps an edit made while the server was down and saves it once the server is back", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const s = server();
    render(<BudgetBook />);
    await screen.findByText("Weekly shop");
    await waitFor(() => expect(s.puts.length).toBeGreaterThan(0));
    s.writesFail = true;
    await user.click(screen.getByRole("button", { name: "New entry" }));
    await user.type(screen.getByLabelText("Amount"), "25{Enter}");
    expect(await screen.findByText(/latest changes are not saved yet/)).toBeInTheDocument();
    s.writesFail = false;
    await user.click(screen.getByRole("button", { name: "Retry now" }));
    await waitFor(() => expect(screen.queryByText(/not saved yet/)).not.toBeInTheDocument());
    expect(lastPut(s).transactions.map((t) => t.amount)).toContain(25);
  });

  it("the home screen says what is due and what is left", async () => {
    server();
    render(<BudgetBook />);
    await screen.findByText("Weekly shop");
    expect(screen.getByText("This month")).toBeInTheDocument();
    // Rent was due on the 1st and is unpaid on the 12th
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText(/was due Sep 1/)).toBeInTheDocument();
  });
});
