import { useState, useEffect, useMemo, useCallback } from "react";
import { T, CHART, DARK_THEMES, applyAccent } from "./theme.js";
import { AppearanceMenu } from "./AppearanceMenu.jsx";
import { AppCtx } from "./ctx.js";
import { EXPENSE_CATS, INCOME_CATS } from "./constants.js";
import {
  DEFAULTS, loadLedger, saveLedger, takeSnapshot, quarantine,
  requestPersistence, markExported,
} from "./storage.js";
import {
  fmt, uid, monthKey, todayStr, monthLabel, shiftMonth, dueDateInMonth, computeCarry,
} from "./utils.js";
import { buildCsvPreview } from "./csv.js";
import { btn, ghostBtn, pill, numeral, useCountUp } from "./ui.jsx";
import { AddEntry } from "./AddEntry.jsx";
import { Overview } from "./OverviewTab.jsx";
import { Bills } from "./BillsTab.jsx";
import { Budgets } from "./BudgetsTab.jsx";
import { Goals } from "./GoalsTab.jsx";
import { Transactions } from "./TransactionsTab.jsx";
import { YearTab } from "./YearTab.jsx";
import { CsvImportModal } from "./CsvImportModal.jsx";
import { BackupPanel } from "./BackupPanel.jsx";
import logoUrl from "./assets/logo.png";

const VALID_THEMES = ["auto", "light", "dark", "midnight", "contrast"];
const systemPrefersDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

const initialThemePref = () => {
  const saved = localStorage.getItem("cash-theme");
  // "dark"/"light" also happen to be valid new values, so older prefs carry over
  return VALID_THEMES.includes(saved) ? saved : "auto";
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
  const [themePref, setThemePref] = useState(initialThemePref);
  const [accent, setAccent] = useState(() => localStorage.getItem("cash-accent") || "goat");
  const [sysDark, setSysDark] = useState(systemPrefersDark);
  const [showAppearance, setShowAppearance] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 640px)").matches);

  const resolvedTheme = themePref === "auto" ? (sysDark ? "dark" : "light") : themePref;
  const dark = DARK_THEMES.has(resolvedTheme);
  const [updateReady, setUpdateReady] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [loadProblem, setLoadProblem] = useState(null);
  const [persistence, setPersistence] = useState(null);
  const [showBackup, setShowBackup] = useState(false);

  useEffect(() => {
    const onReady = () => setUpdateReady(true);
    window.addEventListener("cash:update-ready", onReady);
    return () => window.removeEventListener("cash:update-ready", onReady);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    applyAccent(document.documentElement, accent, resolvedTheme);
    localStorage.setItem("cash-theme", themePref);
    localStorage.setItem("cash-accent", accent);
    // Match the phone's browser/status bar to the page
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.content = getComputedStyle(document.documentElement)
        .getPropertyValue("--bg").trim() || "#f6f7f9";
    }
  }, [resolvedTheme, themePref, accent]);

  // Keep following the OS while the preference is "auto"
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setSysDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Load once. If the stored bytes can't be read, we park them and refuse to
  // write anything until the user decides — overwriting them would destroy
  // the only copy of their ledger.
  useEffect(() => {
    const res = loadLedger();
    setData(res.data);
    if (!res.ok) {
      setLoadProblem({ reason: res.reason, key: quarantine(res.raw) });
    } else {
      takeSnapshot();
      requestPersistence().then(setPersistence);
    }
    setLoaded(true);
  }, []);

  // Save on change
  useEffect(() => {
    if (!loaded || loadProblem) return;
    const res = saveLedger(data);
    setSaveError(res.ok ? null : res.error);
  }, [data, loaded, loadProblem]);

  const chart = CHART[resolvedTheme] || CHART.light;
  const customMap = useMemo(() => new Map(data.customCats.map((c) => [c.name, c.color])), [data.customCats]);
  const expenseCats = useMemo(() => [...EXPENSE_CATS, ...data.customCats.map((c) => c.name)], [data.customCats]);
  const allCats = useMemo(() => [...expenseCats, ...INCOME_CATS], [expenseCats]);
  const catColor = useCallback(
    (cat) => chart.cats[cat] || customMap.get(cat) || chart.rest,
    [customMap, chart]
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
    markExported();
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
      <div style={{
        minHeight: "100vh", background: T.paper, display: "grid", placeItems: "center",
        fontFamily: T.sans, fontSize: 14, color: T.mute,
      }}>
        Loading…
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

  const ctxValue = { dark, chart, expenseCats, allCats, catColor };
  const iconBtn = {
    width: 32, height: 32, padding: 0, borderRadius: 8, cursor: "pointer",
    display: "grid", placeItems: "center", fontSize: 15,
    background: "transparent", color: T.mute, border: `1px solid ${T.line}`,
  };

  return (
    <AppCtx.Provider value={ctxValue}>
    <div style={{
      minHeight: "100vh", background: T.paper, fontFamily: T.sans, color: T.ink,
      paddingBottom: isMobile ? 110 : 64, letterSpacing: "-0.011em",
    }}>
      {/* ----- Top bar ----- */}
      <header style={{
        position: "sticky", top: 0, zIndex: 30,
        background: T.paper, borderBottom: `1px solid ${T.line}`,
        padding: "0 20px",
      }}>
        <div style={{
          maxWidth: 1000, margin: "0 auto", height: 60,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <img src={logoUrl} alt="" width="30" height="30" style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "block",
          }} />
          <span style={{ fontSize: 16, fontWeight: 650, letterSpacing: "-0.02em" }}>CASH</span>

          <div style={{ flex: 1 }} />

          <div style={{
            display: "flex", alignItems: "center", gap: 2,
            background: T.cardTint, border: `1px solid ${T.line}`,
            borderRadius: 10, padding: 2,
          }}>
            <button onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Previous month"
              style={{ ...iconBtn, width: 28, height: 28, border: "none", background: "transparent" }}>‹</button>
            <div style={{
              fontSize: 13.5, fontWeight: 550, minWidth: isMobile ? 96 : 132, textAlign: "center",
            }}>
              {isMobile ? monthLabel(month).replace(/(\w{3})\w*\s/, "$1 ") : monthLabel(month)}
            </div>
            <button onClick={() => setMonth((m) => shiftMonth(m, 1))} aria-label="Next month"
              style={{ ...iconBtn, width: 28, height: 28, border: "none", background: "transparent" }}>›</button>
          </div>

          <div style={{ position: "relative" }}>
            <button onClick={() => setShowAppearance((v) => !v)}
              aria-label="Appearance settings" aria-expanded={showAppearance}
              title="Appearance"
              style={{
                ...iconBtn,
                background: showAppearance ? T.cardTint : "transparent",
                color: showAppearance ? T.ink : T.mute,
              }}>{dark ? "☾" : "☀"}</button>
            {showAppearance && (
              <AppearanceMenu
                themePref={themePref} setThemePref={setThemePref}
                accent={accent} setAccent={setAccent}
                resolved={resolvedTheme}
                onClose={() => setShowAppearance(false)} />
            )}
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 20px" }}>
        {loadProblem && (
          <Banner tone="danger"
            text={`Your saved ledger couldn't be read (${loadProblem.reason}), so CASH has stopped saving to avoid overwriting it. The original data is still on this device${loadProblem.key ? "" : ""} — restore a snapshot or a backup file to continue.`}
            actionLabel="Open backup & data"
            onAction={() => setShowBackup(true)} />
        )}
        {saveError && !loadProblem && (
          <Banner tone="danger"
            text={saveError === "quota"
              ? "This browser is out of storage space, so your latest changes are not being saved. Export a backup now, then free up space."
              : "This browser is blocking storage, so your changes are not being saved. Private browsing can cause this. Export a backup to keep your data."}
            actionLabel="Export backup"
            onAction={exportData} />
        )}
        <BackupNudge transactions={data.transactions} onExport={exportData} />

        {/* ----- Summary ----- */}
        <div style={{
          display: "grid", gap: 12, marginTop: 20,
          gridTemplateColumns: isMobile ? "1fr" : "1.3fr 1fr 1fr",
        }}>
          <Stat label="Net this month" value={net} signed emphasis
            color={net >= 0 ? T.pos : T.neg} />
          <Stat label="Money in" value={income} />
          <Stat label="Money out" value={expenses} />
        </div>

        {/* ----- Nav + actions ----- */}
        <div style={{
          display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
          marginTop: 22,
        }}>
          {!isMobile && (
            <div style={{
              display: "flex", gap: 2, background: T.cardTint,
              border: `1px solid ${T.line}`, borderRadius: 10, padding: 3,
            }}>
              {tabs.map(([id, label]) => (
                <button key={id} onClick={() => setTab(id)} style={pill(tab === id)}>{label}</button>
              ))}
            </div>
          )}
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={() => setShowBackup(true)}
              title="Backups, snapshots, and imports"
              style={{ ...ghostBtn, padding: "8px 12px", fontSize: 13, color: T.mute }}>
              Backup &amp; data
            </button>
            {!isMobile && (
              <button onClick={() => setShowAdd((s) => !s)} style={btn(T.brass)}>
                {showAdd ? "Close" : "New entry"}
              </button>
            )}
          </div>
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
              width: 52, height: 52, borderRadius: 18, border: "none", cursor: "pointer",
              background: T.brass, color: T.goldInk, fontSize: 26, fontWeight: 400, lineHeight: 1,
              boxShadow: "0 10px 24px -8px rgba(0,0,0,0.45)",
            }}>{showAdd ? "×" : "+"}</button>
          <nav style={{
            position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40,
            display: "flex", background: T.card, borderTop: `1px solid ${T.line}`,
            paddingBottom: "env(safe-area-inset-bottom)",
          }}>
            {tabs.map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} style={{
                flex: 1, padding: "12px 0 13px", border: "none", cursor: "pointer",
                background: "transparent", fontFamily: T.sans, fontSize: 11,
                fontWeight: tab === id ? 650 : 500, letterSpacing: "-0.01em",
                color: tab === id ? T.ink : T.mute,
                borderTop: `2px solid ${tab === id ? T.brass : "transparent"}`,
                marginTop: -1,
              }}>{label}</button>
            ))}
          </nav>
        </>
      )}

      {updateReady && (
        <div style={{
          position: "fixed", left: "50%", transform: "translateX(-50%)",
          bottom: isMobile ? 118 : 20, zIndex: 45,
          display: "flex", alignItems: "center", gap: 10, whiteSpace: "nowrap",
          padding: "10px 10px 10px 16px", borderRadius: 14, fontSize: 13.5,
          background: T.card, color: T.ink, border: `1px solid ${T.line}`,
          boxShadow: "0 12px 32px -12px rgba(0,0,0,0.4)",
          animation: "riseIn 260ms ease both",
        }}>
          <span>A new version is ready.</span>
          <button onClick={() => window.location.reload()}
            style={{ ...btn(T.brass), padding: "7px 13px", fontSize: 13 }}>
            Refresh
          </button>
          <button onClick={() => setUpdateReady(false)} aria-label="Dismiss update notice"
            style={{ ...btn("transparent", T.mute), padding: "4px 8px", fontSize: 16 }}>×</button>
        </div>
      )}

      {showBackup && (
        <BackupPanel data={data} persistence={persistence}
          onExport={exportData}
          onImportJson={(f) => { importData(f); setShowBackup(false); }}
          onImportCsv={(f) => { importCsv(f); setShowBackup(false); }}
          onRestore={(snap) => { setLoadProblem(null); setData(snap); }}
          onClose={() => setShowBackup(false)} />
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

function Stat({ label, value, color, signed, emphasis }) {
  const disp = useCountUp(value);
  const text = signed ? (disp >= 0 ? "+" : "−") + fmt(Math.abs(disp)) : fmt(disp);
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.line}`, borderRadius: 16,
      padding: emphasis ? "18px 20px" : "16px 18px", minWidth: 0,
      boxShadow: T.shadow, animation: "riseIn 260ms ease both",
    }}>
      <div style={{ fontSize: 13, color: T.mute, fontWeight: 500 }}>{label}</div>
      <div style={{
        ...numeral(emphasis ? "clamp(28px, 7vw, 38px)" : "clamp(21px, 5vw, 26px)", emphasis ? 650 : 600),
        marginTop: 6, color: color || T.ink,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>{text}</div>
    </div>
  );
}

function Banner({ text, actionLabel, onAction, tone }) {
  const danger = tone === "danger";
  return (
    <div style={{
      marginTop: 16, padding: "12px 14px", borderRadius: 12,
      border: `1px solid ${danger ? T.neg : T.line}`,
      background: danger ? "transparent" : T.brassSoft,
      display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      fontSize: 13.5, color: T.ink, lineHeight: 1.5,
    }}>
      <span style={{ flex: 1, minWidth: 200 }}>{text}</span>
      <button onClick={onAction}
        style={{ ...btn(danger ? T.neg : T.brass, "#fff"), padding: "7px 13px", fontSize: 13 }}>
        {actionLabel}
      </button>
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
      marginTop: 16, padding: "12px 14px", borderRadius: 12,
      border: `1px solid ${T.line}`, background: T.brassSoft,
      display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 13.5, color: T.ink,
    }}>
      <span style={{ flex: 1, minWidth: 160 }}>
        {days === null
          ? "Your ledger has never been backed up — one click keeps it safe."
          : `It's been ${days} days since your last backup.`}
      </span>
      <button onClick={() => { onExport(); setDismissed(true); }} style={{ ...btn(T.brass), padding: "7px 13px", fontSize: 13 }}>
        Export backup
      </button>
      <button onClick={() => { localStorage.setItem("cash-backup-snooze", String(Date.now())); setDismissed(true); }}
        style={{ ...btn("transparent", T.mute), padding: "7px 10px", fontSize: 13 }}>
        Later
      </button>
    </div>
  );
}
