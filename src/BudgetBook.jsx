import { useState, useEffect, useMemo, useCallback } from "react";
import { T, CHART } from "./theme.js";
import { AppCtx } from "./ctx.js";
import { STORE_KEY, EXPENSE_CATS, INCOME_CATS, CAT_COLORS } from "./constants.js";
import {
  fmt, uid, monthKey, todayStr, monthLabel, shiftMonth, dueDateInMonth, computeCarry,
} from "./utils.js";
import { buildCsvPreview } from "./csv.js";
import { btn, useCountUp } from "./ui.jsx";
import { AddEntry } from "./AddEntry.jsx";
import { Overview } from "./OverviewTab.jsx";
import { Bills } from "./BillsTab.jsx";
import { Budgets } from "./BudgetsTab.jsx";
import { Goals } from "./GoalsTab.jsx";
import { Transactions } from "./TransactionsTab.jsx";
import { YearTab } from "./YearTab.jsx";
import { CsvImportModal } from "./CsvImportModal.jsx";

const DEFAULTS = {
  transactions: [], budgets: {}, goals: [], bills: [], billPaid: {},
  incomes: [], incomePaid: {}, budgetRollover: {}, customCats: [],
};

const initialDark = () => {
  const saved = localStorage.getItem("cash-theme");
  if (saved) return saved === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
};

export default function BudgetBook() {
  const [data, setData] = useState(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [month, setMonth] = useState(monthKey(todayStr()));
  const [tab, setTab] = useState("overview");
  const [showAdd, setShowAdd] = useState(false);
  const [trendRange, setTrendRange] = useState(6);
  const [trendKind, setTrendKind] = useState("flow");
  const [csvPreview, setCsvPreview] = useState(null);
  const [dark, setDark] = useState(initialDark);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 640px)").matches);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const onReady = () => setUpdateReady(true);
    window.addEventListener("cash:update-ready", onReady);
    return () => window.removeEventListener("cash:update-ready", onReady);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("cash-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Load once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) setData({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch (e) {
      // No saved data yet - start fresh
    }
    setLoaded(true);
  }, []);

  // Save on change
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); }
    catch (e) { console.error("Save failed", e); }
  }, [data, loaded]);

  const customMap = useMemo(() => new Map(data.customCats.map((c) => [c.name, c.color])), [data.customCats]);
  const expenseCats = useMemo(() => [...EXPENSE_CATS, ...data.customCats.map((c) => c.name)], [data.customCats]);
  const allCats = useMemo(() => [...expenseCats, ...INCOME_CATS], [expenseCats]);
  const catColor = useCallback(
    (cat) => CAT_COLORS[cat] || customMap.get(cat) || "#8B948C",
    [customMap]
  );

  const monthTx = useMemo(
    () => data.transactions.filter((t) => monthKey(t.date) === month)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [data.transactions, month]
  );
  const income = monthTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expenses = monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const net = income - expenses;

  const spentByCat = useMemo(() => {
    const m = {};
    monthTx.filter((t) => t.type === "expense").forEach((t) => {
      m[t.category] = (m[t.category] || 0) + t.amount;
    });
    return m;
  }, [monthTx]);

  // Short observations about the viewed month, shown on the overview
  const insights = useMemo(() => {
    const out = [];
    const catPrev = {};
    let activeMonths = 0;
    for (let i = 1; i <= 6; i++) {
      const ym = shiftMonth(month, -i);
      const txs = data.transactions.filter((t) => t.type === "expense" && monthKey(t.date) === ym);
      if (!txs.length) continue;
      activeMonths++;
      txs.forEach((t) => { catPrev[t.category] = (catPrev[t.category] || 0) + t.amount; });
    }
    if (activeMonths >= 2) {
      const deviations = Object.entries(spentByCat)
        .map(([cat, amt]) => {
          const avg = (catPrev[cat] || 0) / activeMonths;
          return { cat, amt, avg, ratio: avg > 0 ? amt / avg : null };
        })
        .filter((d) => d.avg >= 20 && d.ratio !== null && (d.ratio >= 1.25 || d.ratio <= 0.6))
        .sort((a, b) => Math.abs(b.ratio - 1) - Math.abs(a.ratio - 1))
        .slice(0, 2);
      deviations.forEach((d) => {
        out.push(d.ratio >= 1.25
          ? `${d.cat} is ${Math.round((d.ratio - 1) * 100)}% above your ${activeMonths}-month average of ${fmt(d.avg)}.`
          : `${d.cat} is well below your ${activeMonths}-month average of ${fmt(d.avg)} — nice.`);
      });
    }
    if (month === monthKey(todayStr()) && expenses > 0) {
      const day = Number(todayStr().slice(8, 10));
      const [y, m] = month.split("-").map(Number);
      const daysInMonth = new Date(y, m, 0).getDate();
      if (day >= 5 && day < daysInMonth) {
        out.push(`At this pace you'll spend about ${fmt((expenses / day) * daysInMonth)} by month's end.`);
      }
    }
    const biggest = monthTx.filter((t) => t.type === "expense").sort((a, b) => b.amount - a.amount)[0];
    if (biggest) {
      out.push(`Largest expense: ${fmt(biggest.amount)} on ${biggest.category}${biggest.note ? ` (${biggest.note})` : ""}.`);
    }
    if (income > 0) {
      const rate = Math.round((net / income) * 100);
      out.push(rate >= 0
        ? `You kept ${rate}% of what you earned this month.`
        : `You spent ${Math.abs(rate)}% more than you earned this month.`);
    }
    return out.slice(0, 5);
  }, [data.transactions, month, spentByCat, expenses, income, net, monthTx]);

  const carryByCat = useMemo(
    () => computeCarry(data.transactions, data.budgets, data.budgetRollover, month, expenseCats),
    [data.transactions, data.budgets, data.budgetRollover, month, expenseCats]
  );

  // Rows for the trend chart over the selected range, ending at the viewed
  // month. Spending is folded to the top 5 categories + "All else" so the
  // stacked view never exceeds a readable series count.
  const { trendRows, trendCats } = useMemo(() => {
    const rows = [];
    const catTotals = {};
    for (let i = trendRange - 1; i >= 0; i--) {
      const ym = shiftMonth(month, -i);
      const row = { name: monthLabel(ym).split(" ")[0].slice(0, 3), In: 0, Out: 0, cats: {} };
      data.transactions.forEach((t) => {
        if (monthKey(t.date) !== ym) return;
        if (t.type === "income") row.In += t.amount;
        else {
          row.Out += t.amount;
          row.cats[t.category] = (row.cats[t.category] || 0) + t.amount;
          catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
        }
      });
      row.Net = row.In - row.Out;
      rows.push(row);
    }
    const top = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c);
    let hasRest = false;
    rows.forEach((row) => {
      let rest = 0;
      Object.entries(row.cats).forEach(([c, v]) => {
        if (top.includes(c)) row[c] = v;
        else rest += v;
      });
      if (rest > 0) { row["All else"] = rest; hasRest = true; }
      delete row.cats;
    });
    return { trendRows: rows, trendCats: hasRest ? [...top, "All else"] : top };
  }, [data.transactions, month, trendRange]);

  const addTxs = (txs) => setData((d) => ({ ...d, transactions: [...d.transactions, ...txs] }));
  const deleteTx = (id) => setData((d) => ({ ...d, transactions: d.transactions.filter((t) => t.id !== id) }));
  const updateTx = (id, patch) => setData((d) => ({
    ...d, transactions: d.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  }));
  const setBudget = (cat, amt) => setData((d) => ({ ...d, budgets: { ...d.budgets, [cat]: amt } }));
  const toggleRollover = (cat) => setData((d) => ({
    ...d, budgetRollover: { ...d.budgetRollover, [cat]: !d.budgetRollover[cat] },
  }));
  const addGoal = (g) => setData((d) => ({ ...d, goals: [...d.goals, g] }));
  const fundGoal = (id, amt) => setData((d) => ({
    ...d, goals: d.goals.map((g) => (g.id === id ? { ...g, saved: g.saved + amt } : g)),
  }));
  const deleteGoal = (id) => setData((d) => ({ ...d, goals: d.goals.filter((g) => g.id !== id) }));

  const addBill = (b) => setData((d) => ({ ...d, bills: [...d.bills, b] }));
  const updateBill = (id, patch) => setData((d) => ({
    ...d, bills: d.bills.map((b) => (b.id === id ? { ...b, ...patch } : b)),
  }));
  const deleteBill = (id) => setData((d) => {
    const billPaid = {};
    Object.entries(d.billPaid).forEach(([ym, m]) => {
      const { [id]: _, ...rest } = m;
      billPaid[ym] = rest;
    });
    return { ...d, bills: d.bills.filter((b) => b.id !== id), billPaid };
  });
  // Paying a bill writes a real expense transaction, so it flows into totals and budgets
  const markBillPaid = (bill) => setData((d) => {
    const tx = {
      id: uid(), type: "expense", amount: bill.amount, category: bill.category,
      date: dueDateInMonth(month, bill.dueDay), note: bill.name, billId: bill.id,
    };
    return {
      ...d,
      transactions: [...d.transactions, tx],
      billPaid: { ...d.billPaid, [month]: { ...(d.billPaid[month] || {}), [bill.id]: tx.id } },
    };
  });
  const unmarkBillPaid = (bill) => setData((d) => {
    const monthMap = { ...(d.billPaid[month] || {}) };
    const txId = monthMap[bill.id];
    delete monthMap[bill.id];
    return {
      ...d,
      transactions: d.transactions.filter((t) => t.id !== txId),
      billPaid: { ...d.billPaid, [month]: monthMap },
    };
  });

  const addIncome = (inc) => setData((d) => ({ ...d, incomes: [...d.incomes, inc] }));
  const updateIncome = (id, patch) => setData((d) => ({
    ...d, incomes: d.incomes.map((x) => (x.id === id ? { ...x, ...patch } : x)),
  }));
  const deleteIncome = (id) => setData((d) => {
    const incomePaid = {};
    Object.entries(d.incomePaid).forEach(([ym, m]) => {
      const { [id]: _, ...rest } = m;
      incomePaid[ym] = rest;
    });
    return { ...d, incomes: d.incomes.filter((x) => x.id !== id), incomePaid };
  });
  const markIncomeReceived = (inc) => setData((d) => {
    const tx = {
      id: uid(), type: "income", amount: inc.amount, category: inc.category,
      date: dueDateInMonth(month, inc.payDay), note: inc.name, incomeId: inc.id,
    };
    return {
      ...d,
      transactions: [...d.transactions, tx],
      incomePaid: { ...d.incomePaid, [month]: { ...(d.incomePaid[month] || {}), [inc.id]: tx.id } },
    };
  });
  const unmarkIncomeReceived = (inc) => setData((d) => {
    const monthMap = { ...(d.incomePaid[month] || {}) };
    const txId = monthMap[inc.id];
    delete monthMap[inc.id];
    return {
      ...d,
      transactions: d.transactions.filter((t) => t.id !== txId),
      incomePaid: { ...d.incomePaid, [month]: monthMap },
    };
  });

  const addCustomCat = (c) => setData((d) => ({ ...d, customCats: [...d.customCats, c] }));
  const deleteCustomCat = (name) => setData((d) => ({
    ...d, customCats: d.customCats.filter((c) => c.name !== name),
  }));

  const importCsv = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = buildCsvPreview(String(reader.result), data.transactions);
      if (res.error) window.alert(res.error);
      else setCsvPreview(res);
    };
    reader.readAsText(file);
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cash-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    localStorage.setItem("cash-last-export", String(Date.now()));
  };

  const importData = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || !Array.isArray(parsed.transactions)) throw new Error("bad shape");
        if (window.confirm("Replace your current ledger with this backup? All existing data will be overwritten.")) {
          setData({ ...DEFAULTS, ...parsed });
        }
      } catch {
        window.alert("That file doesn't look like a CASH backup.");
      }
    };
    reader.readAsText(file);
  };

  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", background: T.paper, display: "grid", placeItems: "center", fontFamily: T.serif, color: T.mute }}>
        Opening your ledger…
      </div>
    );
  }

  const tabs = [
    ["overview", "Overview"],
    ["bills", "Bills"],
    ["budgets", "Budgets"],
    ["goals", "Goals"],
    ["transactions", "Transactions"],
    ["year", "Year"],
  ];

  const ctxValue = { dark, chart: CHART[dark ? "dark" : "light"], expenseCats, allCats, catColor };

  return (
    <AppCtx.Provider value={ctxValue}>
    <div style={{
      minHeight: "100vh", background: T.paper, fontFamily: T.sans, color: T.ink,
      paddingBottom: isMobile ? 110 : 60,
      backgroundImage: "var(--dotgrid)", backgroundSize: "22px 22px",
    }}>
      {/* ----- Passbook header ----- */}
      <header style={{
        background: "var(--header-grad)",
        color: T.headerInk, padding: "30px 20px 0",
        borderBottom: `3px solid ${T.brass}`,
        boxShadow: "inset 0 -16px 32px -20px rgba(0,0,0,0.5)",
      }}>
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div aria-hidden style={{
                width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
                background: "radial-gradient(circle at 36% 30%, #F7E8C1, #E7CC8F 55%, #CDA95C)",
                boxShadow: "inset 0 0 0 2px rgba(168,127,53,0.55), inset 0 0 0 7px rgba(168,127,53,0.18), 0 2px 8px rgba(0,0,0,0.35)",
                display: "grid", placeItems: "center",
                fontFamily: T.serif, fontSize: 25, fontWeight: 700, color: "#1E4234",
              }}>¢</div>
              <div>
                <div style={{ fontFamily: T.sans, fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", color: T.headerSub }}>
                  Count All Spending Habits
                </div>
                <h1 style={{
                  margin: "2px 0 0", fontFamily: T.serif, fontWeight: 600, fontSize: 34,
                  letterSpacing: "0.05em", textShadow: "0 1px 0 rgba(0,0,0,0.3)",
                }}>
                  <span style={{ color: T.goldInk }}>¢</span>ASH
                </h1>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Previous month"
                style={{
                  ...btn("rgba(0,0,0,0.28)", T.headerInk), width: 34, height: 34, padding: 0,
                  borderRadius: "50%", border: "1px solid rgba(255,255,255,0.22)", fontSize: 16,
                }}>‹</button>
              <div style={{ fontFamily: T.serif, fontSize: 18, minWidth: 160, textAlign: "center", letterSpacing: "0.02em" }}>
                {monthLabel(month)}
              </div>
              <button onClick={() => setMonth((m) => shiftMonth(m, 1))} aria-label="Next month"
                style={{
                  ...btn("rgba(0,0,0,0.28)", T.headerInk), width: 34, height: 34, padding: 0,
                  borderRadius: "50%", border: "1px solid rgba(255,255,255,0.22)", fontSize: 16,
                }}>›</button>
              <button onClick={() => setDark((v) => !v)} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
                title={dark ? "Light mode" : "Dark mode"}
                style={{
                  ...btn("rgba(0,0,0,0.28)", T.goldInk), width: 34, height: 34, padding: 0,
                  borderRadius: "50%", border: "1px solid rgba(255,255,255,0.22)", fontSize: 15, marginLeft: 4,
                }}>{dark ? "☀" : "☾"}</button>
            </div>
          </div>

          {/* Ledger line */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr", marginTop: 22,
            borderTop: "1px solid rgba(255,255,255,0.25)",
          }}>
            <HeaderStat label="Money in" value={income} color="#A9D8BC" prefix="" />
            <HeaderStat label="Money out" value={expenses} color="#E8B7A9" prefix="" divider />
            <HeaderStat label="Net this month" value={net} color={net >= 0 ? "#F0DCA8" : "#E8B7A9"} signed divider />
          </div>
        </div>
      </header>

      {/* ----- Tabs + toolbar ----- */}
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "0 20px" }}>
        <BackupNudge transactions={data.transactions} onExport={exportData} />

        <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap", marginTop: 14 }}>
          {!isMobile && tabs.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              ...btn(tab === id ? T.pine : T.card, tab === id ? T.goldInk : T.mute),
              border: `1px solid ${tab === id ? T.pine : T.line}`, borderRadius: 99,
              boxShadow: tab === id ? "inset 0 1px 0 rgba(255,255,255,0.12)" : "none",
            }}>{label}</button>
          ))}
          <div style={{ flex: 1 }} />
          <button onClick={exportData} title="Download a JSON backup of all your data"
            style={{ ...btn(T.card, T.mute), border: `1px solid ${T.line}`, borderRadius: 99 }}>Export</button>
          <label title="Restore from a JSON backup"
            style={{ ...btn(T.card, T.mute), border: `1px solid ${T.line}`, borderRadius: 99, display: "inline-block" }}>
            Import
            <input type="file" accept=".json,application/json" style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files[0]) importData(e.target.files[0]);
                e.target.value = "";
              }} />
          </label>
          <label title="Import transactions from a bank CSV export"
            style={{ ...btn(T.card, T.mute), border: `1px solid ${T.line}`, borderRadius: 99, display: "inline-block" }}>
            Import CSV
            <input type="file" accept=".csv,text/csv" style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files[0]) importCsv(e.target.files[0]);
                e.target.value = "";
              }} />
          </label>
          {!isMobile && (
            <button onClick={() => setShowAdd((s) => !s)} style={{
              ...btn(T.brass), borderRadius: 99,
              boxShadow: "0 6px 14px -8px rgba(185,138,47,0.7)",
            }}>
              {showAdd ? "Close" : "+ Add entry"}
            </button>
          )}
        </div>

        {showAdd && <AddEntry onAdd={(txs) => { addTxs(txs); setShowAdd(false); }} />}

        {tab === "overview" && (
          <Overview spentByCat={spentByCat}
            trendRows={trendRows} trendCats={trendCats}
            trendKind={trendKind} setTrendKind={setTrendKind}
            trendRange={trendRange} setTrendRange={setTrendRange}
            monthTx={monthTx} expenses={expenses} insights={insights} />
        )}
        {tab === "bills" && (
          <Bills bills={data.bills} month={month} paidMap={data.billPaid[month] || {}}
            transactions={data.transactions} addBill={addBill} deleteBill={deleteBill}
            updateBill={updateBill} markPaid={markBillPaid} unmarkPaid={unmarkBillPaid}
            incomes={data.incomes} incomePaidMap={data.incomePaid[month] || {}}
            addIncome={addIncome} deleteIncome={deleteIncome} updateIncome={updateIncome}
            markIncome={markIncomeReceived} unmarkIncome={unmarkIncomeReceived} />
        )}
        {tab === "budgets" && (
          <Budgets budgets={data.budgets} spentByCat={spentByCat} setBudget={setBudget}
            rollover={data.budgetRollover} toggleRollover={toggleRollover} carryByCat={carryByCat}
            customCats={data.customCats} addCustomCat={addCustomCat} deleteCustomCat={deleteCustomCat} />
        )}
        {tab === "goals" && (
          <Goals goals={data.goals} addGoal={addGoal} fundGoal={fundGoal} deleteGoal={deleteGoal} />
        )}
        {tab === "transactions" && (
          <Transactions monthTx={monthTx} deleteTx={deleteTx} updateTx={updateTx} />
        )}
        {tab === "year" && (
          <YearTab transactions={data.transactions} month={month} />
        )}
      </div>

      {/* ----- Mobile: bottom tab bar + floating add button ----- */}
      {isMobile && (
        <>
          <button onClick={() => { setShowAdd((s) => !s); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            aria-label={showAdd ? "Close entry form" : "Add entry"}
            style={{
              position: "fixed", right: 16, bottom: 66, zIndex: 41,
              width: 54, height: 54, borderRadius: "50%", border: "none", cursor: "pointer",
              background: T.brass, color: "#fff", fontSize: 26, lineHeight: 1,
              boxShadow: "0 8px 20px -6px rgba(185,138,47,0.8)",
            }}>{showAdd ? "×" : "+"}</button>
          <nav style={{
            position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40,
            display: "flex", background: T.card, borderTop: `1px solid ${T.line}`,
            boxShadow: "0 -6px 18px -12px rgba(0,0,0,0.35)",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}>
            {tabs.map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} style={{
                flex: 1, padding: "11px 0 12px", border: "none", cursor: "pointer",
                background: "transparent", fontFamily: T.sans, fontSize: 11,
                fontWeight: tab === id ? 700 : 500,
                color: tab === id ? T.brass : T.mute,
              }}>{label}</button>
            ))}
          </nav>
        </>
      )}

      {updateReady && (
        <div style={{
          position: "fixed", left: "50%", transform: "translateX(-50%)",
          bottom: isMobile ? 118 : 20, zIndex: 45,
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 14px", borderRadius: 99, fontSize: 13,
          background: T.pine, color: T.headerInk, boxShadow: T.shadow,
          animation: "fadeUp 300ms ease both",
        }}>
          <span>A new version of CASH is ready.</span>
          <button onClick={() => window.location.reload()}
            style={{ ...btn(T.brass), padding: "6px 12px", fontSize: 13, borderRadius: 99 }}>
            Refresh
          </button>
          <button onClick={() => setUpdateReady(false)} aria-label="Dismiss update notice"
            style={{ ...btn("transparent", T.headerSub), padding: "2px 6px", fontSize: 15 }}>×</button>
        </div>
      )}

      {csvPreview && (
        <CsvImportModal preview={csvPreview}
          onConfirm={(rows) => {
            addTxs(rows.map((r) => ({
              id: uid(), type: r.type, amount: r.amount, category: r.category, date: r.date, note: r.note,
            })));
            setCsvPreview(null);
          }}
          onClose={() => setCsvPreview(null)} />
      )}
    </div>
    </AppCtx.Provider>
  );
}

function HeaderStat({ label, value, color, signed, divider }) {
  const disp = useCountUp(value);
  const text = signed ? (disp >= 0 ? "+" : "−") + fmt(Math.abs(disp)) : fmt(disp);
  return (
    <div style={{
      padding: "14px 4px 18px",
      borderLeft: divider ? "1px solid rgba(255,255,255,0.25)" : "none",
      textAlign: "center", minWidth: 0, overflow: "hidden",
    }}>
      <div style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: T.headerSub }}>{label}</div>
      <div style={{
        fontFamily: T.serif, fontSize: "clamp(16px, 5.5vw, 26px)", marginTop: 4, color,
        fontVariantNumeric: "tabular-nums", textShadow: "0 1px 0 rgba(0,0,0,0.25)",
      }}>{text}</div>
    </div>
  );
}

const DAY = 24 * 60 * 60 * 1000;

function BackupNudge({ transactions, onExport }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || transactions.length === 0) return null;
  const last = Number(localStorage.getItem("cash-last-export")) || 0;
  const snooze = Number(localStorage.getItem("cash-backup-snooze")) || 0;
  const now = Date.now();
  if (now - last < 30 * DAY || now - snooze < 7 * DAY) return null;
  const days = last ? Math.floor((now - last) / DAY) : null;

  return (
    <div style={{
      marginTop: 14, padding: "10px 14px", borderRadius: 10,
      border: `1px solid ${T.brass}`, background: T.brassSoft,
      display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 13, color: T.ink,
    }}>
      <span aria-hidden style={{ color: T.brass }}>✦</span>
      <span style={{ flex: 1, minWidth: 160 }}>
        {days === null
          ? "Your ledger has never been backed up — one click keeps it safe."
          : `It's been ${days} days since your last backup.`}
      </span>
      <button onClick={() => { onExport(); setDismissed(true); }} style={{ ...btn(T.brass), padding: "6px 12px", fontSize: 13 }}>
        Export backup
      </button>
      <button onClick={() => { localStorage.setItem("cash-backup-snooze", String(Date.now())); setDismissed(true); }}
        style={{ ...btn("transparent", T.mute), padding: "6px 8px", fontSize: 13 }}>
        Later
      </button>
    </div>
  );
}
