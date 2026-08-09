import { useState, useEffect, useMemo } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, LineChart, Line, ReferenceLine,
} from "recharts";

// ---------- Design tokens: "bank passbook" palette ----------
const T = {
  paper: "#F2F4F0",
  card: "#FFFFFF",
  ink: "#1C2B24",
  pine: "#22493C",
  pineDeep: "#183429",
  brass: "#B98A2F",
  brassSoft: "#F3E8CE",
  pos: "#2E7D5B",
  neg: "#A94438",
  mute: "#6B7A72",
  line: "#DCE3DD",
  serif: "'Fraunces', 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif",
  sans: "'Inter', 'Avenir Next', 'Segoe UI', system-ui, sans-serif",
  chartIn: "#2F9E68", chartOut: "#96352D",
  shadow: "0 1px 2px rgba(28,43,36,0.05), 0 12px 28px -16px rgba(28,43,36,0.22)",
};

const EXPENSE_CATS = [
  "Housing", "Groceries", "Dining", "Transport", "Utilities",
  "Health", "Entertainment", "Shopping", "Subscriptions", "Other",
];
const INCOME_CATS = ["Salary", "Freelance", "Gifts", "Other income"];

// Common bills: [name, default category] — one click prefills the add-bill form
const BILL_PRESETS = [
  ["Rent", "Housing"], ["Mortgage", "Housing"],
  ["Electric", "Utilities"], ["Gas", "Utilities"], ["Water", "Utilities"],
  ["Trash", "Utilities"], ["Internet", "Utilities"], ["Mobile phone", "Utilities"],
  ["TV / Cable", "Subscriptions"], ["Streaming", "Subscriptions"],
  ["Auto payment", "Transport"], ["Auto insurance", "Transport"], ["Boat payment", "Transport"],
  ["Health insurance", "Health"], ["Gym", "Health"],
  ["Credit card", "Other"], ["Student loan", "Other"], ["Childcare", "Other"],
];

// Hue assignment is ordered so adjacent categories stay distinguishable under
// colorblindness — re-validate (dataviz six checks) before reshuffling
const CAT_COLORS = {
  Housing: "#1E7A4F", Groceries: "#DFA32B", Dining: "#5560C0",
  Transport: "#B5504A", Utilities: "#0E9488", Health: "#A87F35",
  Entertainment: "#3E7FB5", Shopping: "#C4703A", Subscriptions: "#8A5FA8",
  Other: "#D683A2",
};

const STORE_KEY = "budget-book-v1";
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const fmt = (n) => usd.format(n || 0);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const monthKey = (d) => d.slice(0, 7); // from 'YYYY-MM-DD'
const todayStr = () => new Date().toISOString().slice(0, 10);
const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
// Due date of a bill within a given month, clamped to the month's length
const dueDateInMonth = (ym, dueDay) => {
  const [y, m] = ym.split("-").map(Number);
  const day = Math.min(dueDay, new Date(y, m, 0).getDate());
  return `${ym}-${String(day).padStart(2, "0")}`;
};

const monthLabel = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
};
const shiftMonth = (ym, delta) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// ---------- Small building blocks ----------
function Card({ children, style }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.line}`, borderRadius: 14,
      padding: 20, boxShadow: T.shadow, ...style,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ children, right }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
      <h3 style={{
        margin: 0, fontFamily: T.serif, fontSize: 17, fontWeight: 600,
        color: T.ink, letterSpacing: "0.01em",
      }}>{children}</h3>
      {right}
    </div>
  );
}

function ProgressBar({ ratio, over }) {
  const pct = Math.min(ratio * 100, 100);
  return (
    <div style={{
      height: 10, background: "#E9EDE7", borderRadius: 99, overflow: "hidden",
      border: `1px solid ${T.line}`, boxShadow: "inset 0 1px 2px rgba(28,43,36,0.08)",
    }}>
      <div style={{
        width: `${pct}%`, height: "100%", borderRadius: 99,
        background: over ? T.neg : ratio > 0.85 ? T.brass : T.pos,
        backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.28), rgba(255,255,255,0) 60%)",
        transition: "width 400ms cubic-bezier(.22,.9,.35,1)",
      }} />
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "9px 11px", borderRadius: 8, boxSizing: "border-box",
  border: `1px solid ${T.line}`, background: "#FDFDFC", color: T.ink,
  fontFamily: T.sans, fontSize: 14, outline: "none",
};
const btn = (bg, color = "#fff") => ({
  padding: "9px 16px", borderRadius: 9, border: "none", cursor: "pointer",
  background: bg, color, fontFamily: T.sans, fontSize: 14, fontWeight: 600,
});

const tooltipStyle = {
  background: T.card, border: `1px solid ${T.line}`, borderRadius: 10,
  boxShadow: "0 8px 24px -10px rgba(28,43,36,0.3)", fontFamily: T.sans, fontSize: 13,
};

const pill = (active) => ({
  padding: "4px 11px", borderRadius: 99, cursor: "pointer", fontFamily: T.sans,
  fontSize: 12, fontWeight: 600, border: `1px solid ${active ? T.pine : T.line}`,
  background: active ? T.pine : T.card, color: active ? "#F0DCA8" : T.mute,
});

const kFmt = (v) => {
  const a = Math.abs(v);
  return (v < 0 ? "−" : "") + (a >= 1000 ? `$${(a / 1000).toFixed(1)}k` : `$${a}`);
};

// ---------- Main app ----------
export default function BudgetBook() {
  const [data, setData] = useState({ transactions: [], budgets: {}, goals: [], bills: [], billPaid: {} });
  const [loaded, setLoaded] = useState(false);
  const [month, setMonth] = useState(monthKey(todayStr()));
  const [tab, setTab] = useState("overview");
  const [showAdd, setShowAdd] = useState(false);
  const [trendRange, setTrendRange] = useState(6);
  const [trendKind, setTrendKind] = useState("flow");

  // Load once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) setData({ transactions: [], budgets: {}, goals: [], bills: [], billPaid: {}, ...JSON.parse(raw) });
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

  const addTx = (tx) => setData((d) => ({ ...d, transactions: [...d.transactions, tx] }));
  const deleteTx = (id) => setData((d) => ({ ...d, transactions: d.transactions.filter((t) => t.id !== id) }));
  const setBudget = (cat, amt) => setData((d) => ({ ...d, budgets: { ...d.budgets, [cat]: amt } }));
  const addGoal = (g) => setData((d) => ({ ...d, goals: [...d.goals, g] }));
  const fundGoal = (id, amt) => setData((d) => ({
    ...d, goals: d.goals.map((g) => (g.id === id ? { ...g, saved: g.saved + amt } : g)),
  }));
  const deleteGoal = (id) => setData((d) => ({ ...d, goals: d.goals.filter((g) => g.id !== id) }));

  const addBill = (b) => setData((d) => ({ ...d, bills: [...d.bills, b] }));
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

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cash-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || !Array.isArray(parsed.transactions)) throw new Error("bad shape");
        if (window.confirm("Replace your current ledger with this backup? All existing data will be overwritten.")) {
          setData({ transactions: [], budgets: {}, goals: [], bills: [], billPaid: {}, ...parsed });
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
  ];

  return (
    <div style={{
      minHeight: "100vh", background: T.paper, fontFamily: T.sans, color: T.ink, paddingBottom: 60,
      backgroundImage: "radial-gradient(rgba(28,43,36,0.04) 1px, transparent 1px)",
      backgroundSize: "22px 22px",
    }}>
      {/* ----- Passbook header ----- */}
      <header style={{
        background: `repeating-linear-gradient(90deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 7px), linear-gradient(175deg, #275544 0%, ${T.pine} 45%, ${T.pineDeep} 100%)`,
        color: "#EFF3EE", padding: "30px 20px 0",
        borderBottom: `3px solid ${T.brass}`,
        boxShadow: "inset 0 -16px 32px -20px rgba(0,0,0,0.5)",
      }}>
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div aria-hidden style={{
                width: 46, height: 46, borderRadius: "50%", flexShrink: 0,
                border: "1.5px solid rgba(240,220,168,0.75)",
                boxShadow: "inset 0 0 0 3px rgba(240,220,168,0.16)",
                display: "grid", placeItems: "center",
                fontFamily: T.serif, fontSize: 22, color: "#F0DCA8",
              }}>¢</div>
              <div>
                <div style={{ fontFamily: T.sans, fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", color: "#A9C0B2" }}>
                  Count All Spending Habits
                </div>
                <h1 style={{
                  margin: "2px 0 0", fontFamily: T.serif, fontWeight: 600, fontSize: 34,
                  letterSpacing: "0.05em", textShadow: "0 1px 0 rgba(0,0,0,0.3)",
                }}>
                  CASH
                </h1>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Previous month"
                style={{
                  ...btn("rgba(0,0,0,0.28)", "#EFF3EE"), width: 34, height: 34, padding: 0,
                  borderRadius: "50%", border: "1px solid rgba(255,255,255,0.22)", fontSize: 16,
                }}>‹</button>
              <div style={{ fontFamily: T.serif, fontSize: 18, minWidth: 160, textAlign: "center", letterSpacing: "0.02em" }}>
                {monthLabel(month)}
              </div>
              <button onClick={() => setMonth((m) => shiftMonth(m, 1))} aria-label="Next month"
                style={{
                  ...btn("rgba(0,0,0,0.28)", "#EFF3EE"), width: 34, height: 34, padding: 0,
                  borderRadius: "50%", border: "1px solid rgba(255,255,255,0.22)", fontSize: 16,
                }}>›</button>
            </div>
          </div>

          {/* Ledger line */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr", marginTop: 22,
            borderTop: "1px solid rgba(255,255,255,0.25)",
          }}>
            {[
              ["Money in", fmt(income), "#A9D8BC"],
              ["Money out", fmt(expenses), "#E8B7A9"],
              ["Net this month", (net >= 0 ? "+" : "−") + fmt(Math.abs(net)), net >= 0 ? "#F0DCA8" : "#E8B7A9"],
            ].map(([label, val, color], i) => (
              <div key={label} style={{
                padding: "14px 4px 18px",
                borderLeft: i ? "1px solid rgba(255,255,255,0.25)" : "none",
                textAlign: "center",
              }}>
                <div style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "#A9C0B2" }}>{label}</div>
                <div style={{
                  fontFamily: T.serif, fontSize: 26, marginTop: 4, color,
                  fontVariantNumeric: "tabular-nums", textShadow: "0 1px 0 rgba(0,0,0,0.25)",
                }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ----- Tabs + add ----- */}
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "0 20px" }}>
        <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap", marginTop: 14 }}>
          {tabs.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              ...btn(tab === id ? T.pine : T.card, tab === id ? "#F0DCA8" : T.mute),
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
          <button onClick={() => setShowAdd((s) => !s)} style={{
            ...btn(T.brass), borderRadius: 99,
            boxShadow: "0 6px 14px -8px rgba(185,138,47,0.7)",
          }}>
            {showAdd ? "Close" : "+ Add entry"}
          </button>
        </div>

        {showAdd && <AddEntry onAdd={(tx) => { addTx(tx); setShowAdd(false); }} />}

        {tab === "overview" && (
          <Overview spentByCat={spentByCat} budgets={data.budgets}
            trendRows={trendRows} trendCats={trendCats}
            trendKind={trendKind} setTrendKind={setTrendKind}
            trendRange={trendRange} setTrendRange={setTrendRange}
            monthTx={monthTx} expenses={expenses} />
        )}
        {tab === "bills" && (
          <Bills bills={data.bills} month={month} paidMap={data.billPaid[month] || {}}
            transactions={data.transactions} addBill={addBill} deleteBill={deleteBill}
            markPaid={markBillPaid} unmarkPaid={unmarkBillPaid} />
        )}
        {tab === "budgets" && (
          <Budgets budgets={data.budgets} spentByCat={spentByCat} setBudget={setBudget} />
        )}
        {tab === "goals" && (
          <Goals goals={data.goals} addGoal={addGoal} fundGoal={fundGoal} deleteGoal={deleteGoal} />
        )}
        {tab === "transactions" && (
          <Transactions monthTx={monthTx} deleteTx={deleteTx} />
        )}
      </div>
    </div>
  );
}

// ---------- Add entry ----------
function AddEntry({ onAdd }) {
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(EXPENSE_CATS[1]);
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  const cats = type === "expense" ? EXPENSE_CATS : INCOME_CATS;

  const submit = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setErr("Enter an amount greater than zero."); return; }
    if (!date) { setErr("Pick a date."); return; }
    onAdd({ id: uid(), type, amount: amt, category, date, note: note.trim() });
  };

  const switchType = (t) => {
    setType(t);
    setCategory(t === "expense" ? EXPENSE_CATS[1] : INCOME_CATS[0]);
  };

  return (
    <Card style={{ marginTop: 14, borderColor: T.brass, background: "#FDFBF5" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={() => switchType("expense")}
          style={btn(type === "expense" ? T.neg : T.paper, type === "expense" ? "#fff" : T.mute)}>Expense</button>
        <button onClick={() => switchType("income")}
          style={btn(type === "income" ? T.pos : T.paper, type === "income" ? "#fff" : T.mute)}>Income</button>
      </div>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <label style={{ fontSize: 12, color: T.mute }}>Amount
          <input type="number" min="0" step="0.01" value={amount} placeholder="0.00"
            onChange={(e) => { setAmount(e.target.value); setErr(""); }} style={{ ...inputStyle, marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 12, color: T.mute }}>Category
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...inputStyle, marginTop: 4 }}>
            {cats.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12, color: T.mute }}>Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 12, color: T.mute }}>Note (optional)
          <input value={note} placeholder="e.g. Farmers market" onChange={(e) => setNote(e.target.value)}
            style={{ ...inputStyle, marginTop: 4 }} />
        </label>
      </div>
      {err && <div style={{ color: T.neg, fontSize: 13, marginTop: 8 }}>{err}</div>}
      <div style={{ marginTop: 12 }}>
        <button onClick={submit} style={btn(T.ink)}>Save entry</button>
      </div>
    </Card>
  );
}

// ---------- Overview ----------
function Overview({
  spentByCat, budgets, trendRows, trendCats, trendKind, setTrendKind,
  trendRange, setTrendRange, monthTx, expenses,
}) {
  const pieData = Object.entries(spentByCat)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const recent = monthTx.slice(0, 6);

  return (
    <div style={{ display: "grid", gap: 14, marginTop: 14, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
      <Card>
        <SectionTitle>Where the money went</SectionTitle>
        {pieData.length === 0 ? (
          <Empty text="No spending recorded this month yet. Add an expense to see the breakdown." />
        ) : (
          <>
            <div style={{ height: 210 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={85}
                    paddingAngle={2} cornerRadius={3} stroke={T.card} strokeWidth={2}>
                    {pieData.map((d) => <Cell key={d.name} fill={CAT_COLORS[d.name] || T.mute} />)}
                  </Pie>
                  <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle"
                    style={{ fontFamily: T.serif, fontSize: 21, fill: T.ink }}>{fmt(expenses)}</text>
                  <text x="50%" y="46%" dy={20} textAnchor="middle" dominantBaseline="middle"
                    style={{ fontFamily: T.sans, fontSize: 10, letterSpacing: "0.16em", fill: T.mute }}>SPENT</text>
                  <Tooltip formatter={(v) => fmt(v)} contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {pieData.slice(0, 5).map((d) => (
                <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: CAT_COLORS[d.name] || T.mute, flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{d.name}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums", color: T.mute }}>
                    {fmt(d.value)} · {expenses ? Math.round((d.value / expenses) * 100) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <Card>
        <SectionTitle right={
          <div style={{ display: "flex", gap: 4 }}>
            {[3, 6, 12].map((n) => (
              <button key={n} onClick={() => setTrendRange(n)} style={pill(trendRange === n)}>{n}m</button>
            ))}
          </div>
        }>Trends</SectionTitle>
        <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
          {[["flow", "In vs out"], ["net", "Net"], ["cats", "By category"]].map(([id, label]) => (
            <button key={id} onClick={() => setTrendKind(id)} style={pill(trendKind === id)}>{label}</button>
          ))}
        </div>
        <div style={{ height: 205 }}>
          <ResponsiveContainer width="100%" height="100%">
            {trendKind === "net" ? (
              <LineChart data={trendRows}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: T.mute }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: T.mute }} axisLine={false} tickLine={false}
                  tickFormatter={kFmt} width={48} />
                <ReferenceLine y={0} stroke={T.line} />
                <Tooltip formatter={(v) => fmt(v)} contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="Net" stroke={T.pine} strokeWidth={2}
                  dot={false} activeDot={{ r: 4.5 }} />
              </LineChart>
            ) : trendKind === "cats" ? (
              <BarChart data={trendRows} barGap={2}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: T.mute }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: T.mute }} axisLine={false} tickLine={false}
                  tickFormatter={kFmt} width={48} />
                <Tooltip formatter={(v) => fmt(v)} contentStyle={tooltipStyle}
                  cursor={{ fill: "rgba(28,43,36,0.05)" }} />
                <Legend wrapperStyle={{ fontSize: 12, fontFamily: T.sans }} iconType="circle" iconSize={9} />
                {trendCats.map((c, i) => (
                  <Bar key={c} dataKey={c} stackId="spend" maxBarSize={30}
                    fill={c === "All else" ? "#8B948C" : CAT_COLORS[c]}
                    stroke={T.card} strokeWidth={1.5}
                    radius={i === trendCats.length - 1 ? [4, 4, 0, 0] : 0} />
                ))}
              </BarChart>
            ) : (
              <BarChart data={trendRows} barGap={2}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: T.mute }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: T.mute }} axisLine={false} tickLine={false}
                  tickFormatter={kFmt} width={48} />
                <Tooltip formatter={(v) => fmt(v)} contentStyle={tooltipStyle}
                  cursor={{ fill: "rgba(28,43,36,0.05)" }} />
                <Legend wrapperStyle={{ fontSize: 12, fontFamily: T.sans }} iconType="circle" iconSize={9} />
                <Bar dataKey="In" fill={T.chartIn} radius={[4, 4, 0, 0]} maxBarSize={26} />
                <Bar dataKey="Out" fill={T.chartOut} radius={[4, 4, 0, 0]} maxBarSize={26} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </Card>

      <Card style={{ gridColumn: "1 / -1" }}>
        <SectionTitle>Recent entries</SectionTitle>
        {recent.length === 0
          ? <Empty text="Nothing recorded this month. Use “+ Add entry” to write your first line." />
          : <TxList list={recent} />}
      </Card>
    </div>
  );
}

// ---------- Bills ----------
function Bills({ bills, month, paidMap, transactions, addBill, deleteBill, markPaid, unmarkPaid }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(EXPENSE_CATS[0]);
  const [dueDay, setDueDay] = useState("1");
  const [err, setErr] = useState("");

  // A bill counts as paid only if its payment transaction still exists —
  // deleting the transaction from the ledger unmarks the bill
  const txIds = useMemo(() => new Set(transactions.map((t) => t.id)), [transactions]);
  const isPaid = (b) => Boolean(paidMap[b.id] && txIds.has(paidMap[b.id]));

  const create = () => {
    const amt = parseFloat(amount);
    const day = parseInt(dueDay, 10);
    if (!name.trim()) { setErr("Give the bill a name."); return; }
    if (!amt || amt <= 0) { setErr("Enter an amount greater than zero."); return; }
    if (!day || day < 1 || day > 31) { setErr("Due day must be between 1 and 31."); return; }
    addBill({ id: uid(), name: name.trim(), amount: amt, category, dueDay: day });
    setName(""); setAmount(""); setDueDay("1"); setErr("");
  };

  const sorted = [...bills].sort((a, b) => a.dueDay - b.dueDay);
  const total = sorted.reduce((s, b) => s + b.amount, 0);
  const paidTotal = sorted.filter(isPaid).reduce((s, b) => s + b.amount, 0);

  return (
    <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
      <Card style={{ background: "#FDFBF5", borderColor: T.brass }}>
        <SectionTitle>Add a monthly bill</SectionTitle>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {BILL_PRESETS.map(([label, cat]) => (
            <button key={label}
              onClick={() => { setName(label); setCategory(cat); setErr(""); }}
              style={{
                padding: "5px 11px", borderRadius: 99, cursor: "pointer",
                border: `1px solid ${name === label ? T.brass : T.line}`,
                background: name === label ? T.brassSoft : "#fff",
                color: T.ink, fontFamily: T.sans, fontSize: 12,
              }}>{label}</button>
          ))}
        </div>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
          <input value={name} placeholder="Bill name — pick above or type"
            onChange={(e) => { setName(e.target.value); setErr(""); }} style={inputStyle} />
          <input type="number" min="0" step="0.01" value={amount} placeholder="Amount"
            onChange={(e) => { setAmount(e.target.value); setErr(""); }} style={inputStyle} />
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
            {EXPENSE_CATS.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input type="number" min="1" max="31" value={dueDay} placeholder="Due day (1–31)"
            onChange={(e) => { setDueDay(e.target.value); setErr(""); }} style={inputStyle} />
          <button onClick={create} style={btn(T.brass)}>Add bill</button>
        </div>
        {err && <div style={{ color: T.neg, fontSize: 13, marginTop: 8 }}>{err}</div>}
      </Card>

      {sorted.length === 0 ? (
        <Empty text="No bills yet. Add your recurring bills — rent, utilities, subscriptions — and check them off each month." card />
      ) : (
        <Card>
          <SectionTitle right={
            <span style={{ fontSize: 13, color: T.mute, fontVariantNumeric: "tabular-nums" }}>
              {fmt(paidTotal)} paid of {fmt(total)}
            </span>
          }>Bills for {monthLabel(month)}</SectionTitle>
          <div style={{ margin: "2px 0 14px" }}>
            <ProgressBar ratio={total ? paidTotal / total : 0} over={false} />
          </div>
          {sorted.map((b, i) => {
            const paid = isPaid(b);
            const overdue = !paid && dueDateInMonth(month, b.dueDay) < todayStr();
            return (
              <div key={b.id} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 2px",
                borderTop: i ? `1px solid ${T.line}` : "none", fontSize: 14,
                opacity: paid ? 0.65 : 1,
              }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, flexShrink: 0, background: CAT_COLORS[b.category] || T.mute }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, textDecoration: paid ? "line-through" : "none" }}>{b.name}</div>
                  <div style={{ fontSize: 12, color: overdue ? T.neg : T.mute }}>
                    {b.category} · due the {ordinal(b.dueDay)}{overdue && " — overdue"}
                  </div>
                </div>
                <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, minWidth: 80, textAlign: "right" }}>
                  {fmt(b.amount)}
                </span>
                <button onClick={() => (paid ? unmarkPaid(b) : markPaid(b))}
                  style={paid
                    ? { ...btn(T.paper, T.pos), border: `1px solid ${T.line}` }
                    : btn(T.pos)}>
                  {paid ? "Paid ✓" : "Mark paid"}
                </button>
                <button onClick={() => deleteBill(b.id)} aria-label={`Delete ${b.name} bill`}
                  style={{ ...btn("transparent", T.mute), padding: "4px 8px", fontSize: 16 }}>×</button>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

// ---------- Budgets ----------
function Budgets({ budgets, spentByCat, setBudget }) {
  return (
    <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
      <Card>
        <SectionTitle>Monthly budgets by category</SectionTitle>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: T.mute }}>
          Set a limit for each category. The bar shows this month's spending against it.
        </p>
        <div style={{ display: "grid", gap: 14 }}>
          {EXPENSE_CATS.map((cat) => {
            const budget = budgets[cat] || 0;
            const spent = spentByCat[cat] || 0;
            const over = budget > 0 && spent > budget;
            return (
              <div key={cat}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: CAT_COLORS[cat] }} />
                  <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{cat}</span>
                  <span style={{ fontSize: 13, color: over ? T.neg : T.mute, fontVariantNumeric: "tabular-nums" }}>
                    {fmt(spent)}{budget > 0 && <> of {fmt(budget)}{over && " — over"}</>}
                  </span>
                  <input type="number" min="0" step="10" placeholder="Set limit"
                    value={budget || ""}
                    onChange={(e) => setBudget(cat, parseFloat(e.target.value) || 0)}
                    style={{ ...inputStyle, width: 110 }} />
                </div>
                {budget > 0 && <ProgressBar ratio={spent / budget} over={over} />}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ---------- Goals ----------
function Goals({ goals, addGoal, fundGoal, deleteGoal }) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [err, setErr] = useState("");
  const [fundAmts, setFundAmts] = useState({});

  const create = () => {
    const t = parseFloat(target);
    if (!name.trim()) { setErr("Give the goal a name."); return; }
    if (!t || t <= 0) { setErr("Enter a target greater than zero."); return; }
    addGoal({ id: uid(), name: name.trim(), target: t, saved: 0 });
    setName(""); setTarget(""); setErr("");
  };

  return (
    <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
      <Card style={{ background: "#FDFBF5", borderColor: T.brass }}>
        <SectionTitle>Start a savings goal</SectionTitle>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <input value={name} placeholder="Goal name — e.g. Emergency fund"
            onChange={(e) => { setName(e.target.value); setErr(""); }} style={inputStyle} />
          <input type="number" min="0" step="50" value={target} placeholder="Target amount"
            onChange={(e) => { setTarget(e.target.value); setErr(""); }} style={inputStyle} />
          <button onClick={create} style={btn(T.brass)}>Create goal</button>
        </div>
        {err && <div style={{ color: T.neg, fontSize: 13, marginTop: 8 }}>{err}</div>}
      </Card>

      {goals.length === 0 && <Empty text="No goals yet. A goal turns leftover money into progress you can see." card />}

      {goals.map((g) => {
        const ratio = g.target ? g.saved / g.target : 0;
        const done = g.saved >= g.target;
        return (
          <Card key={g.id}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontFamily: T.serif, fontSize: 17, flex: 1 }}>
                {g.name} {done && <span style={{ color: T.brass }}>✦ reached</span>}
              </h3>
              <span style={{ fontSize: 13, color: T.mute, fontVariantNumeric: "tabular-nums" }}>
                {fmt(g.saved)} of {fmt(g.target)} · {Math.min(Math.round(ratio * 100), 100)}%
              </span>
            </div>
            <div style={{ margin: "10px 0" }}>
              <ProgressBar ratio={ratio} over={false} />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input type="number" min="0" step="10" placeholder="Amount"
                value={fundAmts[g.id] || ""}
                onChange={(e) => setFundAmts((f) => ({ ...f, [g.id]: e.target.value }))}
                style={{ ...inputStyle, width: 120 }} />
              <button style={btn(T.pos)} onClick={() => {
                const amt = parseFloat(fundAmts[g.id]);
                if (amt > 0) { fundGoal(g.id, amt); setFundAmts((f) => ({ ...f, [g.id]: "" })); }
              }}>Add funds</button>
              <div style={{ flex: 1 }} />
              <button style={btn("transparent", T.neg)} onClick={() => deleteGoal(g.id)}>Remove</button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ---------- Transactions ----------
function Transactions({ monthTx, deleteTx }) {
  return (
    <Card style={{ marginTop: 14 }}>
      <SectionTitle>All entries this month</SectionTitle>
      {monthTx.length === 0
        ? <Empty text="No entries for this month. Switch months with the arrows above, or add one." />
        : <TxList list={monthTx} onDelete={deleteTx} />}
    </Card>
  );
}

function TxList({ list, onDelete }) {
  return (
    <div>
      {list.map((t, i) => (
        <div key={t.id} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "10px 2px",
          borderTop: i ? `1px solid ${T.line}` : "none", fontSize: 14,
        }}>
          <span style={{
            width: 10, height: 10, borderRadius: 3, flexShrink: 0,
            background: t.type === "income" ? T.pos : (CAT_COLORS[t.category] || T.mute),
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{t.category}</div>
            {t.note && <div style={{ fontSize: 12, color: T.mute, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.note}</div>}
          </div>
          <span style={{ fontSize: 12, color: T.mute, fontVariantNumeric: "tabular-nums" }}>
            {new Date(t.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
          <span style={{
            fontVariantNumeric: "tabular-nums", fontWeight: 600, minWidth: 90, textAlign: "right",
            color: t.type === "income" ? T.pos : T.ink,
          }}>
            {t.type === "income" ? "+" : "−"}{fmt(t.amount)}
          </span>
          {onDelete && (
            <button onClick={() => onDelete(t.id)} aria-label={`Delete ${t.category} entry`}
              style={{ ...btn("transparent", T.mute), padding: "4px 8px", fontSize: 16 }}>×</button>
          )}
        </div>
      ))}
    </div>
  );
}

function Empty({ text, card }) {
  const inner = (
    <div style={{ color: T.mute, fontSize: 14, padding: "20px 6px", textAlign: "center", fontFamily: T.serif, fontStyle: "italic" }}>
      <div aria-hidden style={{ color: T.brass, fontSize: 14, fontStyle: "normal", letterSpacing: "0.4em", marginBottom: 7 }}>✦ ✦ ✦</div>
      {text}
    </div>
  );
  return card ? <Card>{inner}</Card> : inner;
}
