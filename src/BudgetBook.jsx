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
const monthDiff = (a, b) => {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
};
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
        backgroundColor: over ? T.neg : ratio > 0.85 ? T.brass : T.pos,
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

// ---------- CSV import ----------
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

function parseCsvDate(s) {
  s = (s || "").trim();
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)))
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))) {
    const y = m[3].length === 2 ? "20" + m[3] : m[3];
    return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  return null;
}

const CAT_KEYWORDS = [
  [/krog|walmart|wal-mart|aldi|costco|grocer|wegman|safeway|publix|trader joe|whole foods|\bheb\b|meijer|food lion/i, "Groceries"],
  [/mcdonald|starbucks|chipotle|restaurant|pizza|taco|burger|wendy|dunkin|subway|doordash|grubhub|uber eats|cafe|diner|chick-fil|sonic|kfc|panera/i, "Dining"],
  [/shell|exxon|chevron|\bbp\b|speedway|gas station|fuel|\buber\b|\blyft\b|parking|toll|car wash|jiffy|oil change|autozone|o'reilly/i, "Transport"],
  [/electric|power co|water|sewer|utility|comcast|xfinity|spectrum|verizon|at&t|t-mobile|internet|duke energy|dominion/i, "Utilities"],
  [/netflix|spotify|hulu|disney\+|hbo|paramount|prime video|youtube prem|apple\.com\/bill|subscription|patreon|audible/i, "Subscriptions"],
  [/rent|mortgage|\bhoa\b|landlord|apartment/i, "Housing"],
  [/cvs|walgreens|pharmacy|doctor|dental|clinic|hospital|gym|fitness|medical|optometr/i, "Health"],
  [/amazon|amzn|target|best buy|ebay|etsy|clothing|shoe|home depot|lowe's|lowes|marshalls|tj maxx/i, "Shopping"],
  [/movie|cinema|theater|steam|playstation|xbox|nintendo|ticketmaster|concert|bowling/i, "Entertainment"],
];

function guessCategory(desc, isIncome) {
  if (isIncome) return /payroll|salary|direct dep|paycheck|\bdd\b/i.test(desc) ? "Salary" : "Other income";
  for (const [re, cat] of CAT_KEYWORDS) if (re.test(desc)) return cat;
  return "Other";
}

function buildCsvPreview(text, existingTx) {
  const grid = parseCsv(text);
  if (grid.length < 2) return { error: "Couldn't find any data rows in that file." };

  const header = grid[0].map((h) => h.toLowerCase().trim());
  const find = (re) => header.findIndex((h) => re.test(h));
  let iDate = find(/date/);
  let iDesc = find(/desc|memo|payee|merchant|name|detail/);
  let iAmt = find(/amount|^amt$/);
  const iDebit = find(/debit|withdraw/);
  const iCredit = find(/credit|deposit/);
  let dataRows = grid.slice(1);

  if (iDate === -1) {
    // No recognizable header — treat every row as data and sniff the columns
    dataRows = grid;
    const sample = grid[0];
    iDate = sample.findIndex((c) => parseCsvDate(c));
    iAmt = sample.findIndex((c, j) => j !== iDate && c.trim() !== "" && !isNaN(parseFloat(c.replace(/[$,]/g, ""))));
    iDesc = sample.findIndex((c, j) => j !== iDate && j !== iAmt && c.trim() !== "" && isNaN(parseFloat(c.replace(/[$,]/g, ""))));
  }
  if (iDate === -1 || (iAmt === -1 && iDebit === -1 && iCredit === -1)) {
    return { error: "Couldn't detect the date and amount columns. The file needs headers like Date, Description, and Amount (or Debit/Credit)." };
  }

  const dupKeys = new Set(existingTx.map((t) => `${t.date}|${t.amount.toFixed(2)}|${t.type}`));
  const rows = [];
  dataRows.forEach((r) => {
    const date = parseCsvDate(r[iDate]);
    if (!date) return;
    let amount = null, type = "expense";
    if (iDebit !== -1 || iCredit !== -1) {
      const deb = iDebit !== -1 ? parseFloat((r[iDebit] || "").replace(/[$,()]/g, "")) : NaN;
      const cred = iCredit !== -1 ? parseFloat((r[iCredit] || "").replace(/[$,()]/g, "")) : NaN;
      if (deb > 0) { amount = deb; type = "expense"; }
      else if (cred > 0) { amount = cred; type = "income"; }
    } else {
      const raw = (r[iAmt] || "").trim();
      const v = parseFloat(raw.replace(/[$,()]/g, ""));
      if (isNaN(v) || v === 0) return;
      type = (/^\(.*\)$/.test(raw) || v < 0) ? "expense" : "income";
      amount = Math.abs(v);
    }
    if (!amount) return;
    const note = (iDesc !== -1 ? r[iDesc] || "" : "").trim().slice(0, 80);
    const dup = dupKeys.has(`${date}|${amount.toFixed(2)}|${type}`);
    rows.push({ date, amount, type, note, category: guessCategory(note, type === "income"), dup, include: !dup });
  });

  if (!rows.length) return { error: "No usable rows found — check that the file has date and amount values." };
  return { rows };
}

// ---------- Main app ----------
export default function BudgetBook() {
  const [data, setData] = useState({
    transactions: [], budgets: {}, goals: [], bills: [], billPaid: {}, incomes: [], incomePaid: {},
    budgetRollover: {},
  });
  const [loaded, setLoaded] = useState(false);
  const [month, setMonth] = useState(monthKey(todayStr()));
  const [tab, setTab] = useState("overview");
  const [showAdd, setShowAdd] = useState(false);
  const [trendRange, setTrendRange] = useState(6);
  const [trendKind, setTrendKind] = useState("flow");
  const [csvPreview, setCsvPreview] = useState(null);

  // Load once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) setData({
        transactions: [], budgets: {}, goals: [], bills: [], billPaid: {}, incomes: [], incomePaid: {},
        budgetRollover: {},
        ...JSON.parse(raw),
      });
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

  // Short observations about the viewed month, shown on the overview
  const insights = useMemo(() => {
    const out = [];
    // Category spending vs the average of up to 6 prior months with activity
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
    // Pace projection, only for the real current month and once it's underway
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

  // Surplus (or deficit) carried into the viewed month for categories with
  // rollover on. Accrues from the first recorded transaction, capped at 24
  // months back, using the current budget amount for every month.
  const carryByCat = useMemo(() => {
    const carry = {};
    const txMonths = data.transactions.map((t) => monthKey(t.date));
    const firstYm = txMonths.length ? txMonths.reduce((a, b) => (a < b ? a : b)) : null;
    EXPENSE_CATS.forEach((cat) => {
      const base = data.budgets[cat] || 0;
      if (!data.budgetRollover[cat] || base <= 0 || !firstYm) { carry[cat] = 0; return; }
      const span = Math.min(24, monthDiff(firstYm, month));
      let c = 0;
      for (let i = span; i >= 1; i--) {
        const ym = shiftMonth(month, -i);
        const spent = data.transactions.reduce((s, t) =>
          (t.type === "expense" && t.category === cat && monthKey(t.date) === ym) ? s + t.amount : s, 0);
        c += base - spent;
      }
      carry[cat] = c;
    });
    return carry;
  }, [data.transactions, data.budgets, data.budgetRollover, month]);

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

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cash-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importCsv = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = buildCsvPreview(String(reader.result), data.transactions);
      if (res.error) window.alert(res.error);
      else setCsvPreview(res);
    };
    reader.readAsText(file);
  };

  const importData = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || !Array.isArray(parsed.transactions)) throw new Error("bad shape");
        if (window.confirm("Replace your current ledger with this backup? All existing data will be overwritten.")) {
          setData({
            transactions: [], budgets: {}, goals: [], bills: [], billPaid: {}, incomes: [], incomePaid: {},
            budgetRollover: {},
            ...parsed,
          });
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
          <label title="Import transactions from a bank CSV export"
            style={{ ...btn(T.card, T.mute), border: `1px solid ${T.line}`, borderRadius: 99, display: "inline-block" }}>
            Import CSV
            <input type="file" accept=".csv,text/csv" style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files[0]) importCsv(e.target.files[0]);
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

        {showAdd && <AddEntry onAdd={(txs) => { addTxs(txs); setShowAdd(false); }} />}

        {tab === "overview" && (
          <Overview spentByCat={spentByCat} budgets={data.budgets}
            trendRows={trendRows} trendCats={trendCats}
            trendKind={trendKind} setTrendKind={setTrendKind}
            trendRange={trendRange} setTrendRange={setTrendRange}
            monthTx={monthTx} expenses={expenses} insights={insights} />
        )}
        {tab === "bills" && (
          <Bills bills={data.bills} month={month} paidMap={data.billPaid[month] || {}}
            transactions={data.transactions} addBill={addBill} deleteBill={deleteBill}
            markPaid={markBillPaid} unmarkPaid={unmarkBillPaid}
            incomes={data.incomes} incomePaidMap={data.incomePaid[month] || {}}
            addIncome={addIncome} deleteIncome={deleteIncome}
            markIncome={markIncomeReceived} unmarkIncome={unmarkIncomeReceived} />
        )}
        {tab === "budgets" && (
          <Budgets budgets={data.budgets} spentByCat={spentByCat} setBudget={setBudget}
            rollover={data.budgetRollover} toggleRollover={toggleRollover} carryByCat={carryByCat} />
        )}
        {tab === "goals" && (
          <Goals goals={data.goals} addGoal={addGoal} fundGoal={fundGoal} deleteGoal={deleteGoal} />
        )}
        {tab === "transactions" && (
          <Transactions monthTx={monthTx} deleteTx={deleteTx} updateTx={updateTx} />
        )}
      </div>

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
  );
}

// ---------- CSV import preview ----------
function CsvImportModal({ preview, onConfirm, onClose }) {
  const [rows, setRows] = useState(preview.rows);
  const setRow = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const included = rows.filter((r) => r.include);
  // Some banks export expenses as positive numbers; one click fixes the whole file
  const swapAll = () => setRows((rs) => rs.map((r) => {
    const type = r.type === "income" ? "expense" : "income";
    return { ...r, type, category: guessCategory(r.note, type === "income") };
  }));

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(24,52,41,0.45)", zIndex: 50,
      display: "grid", placeItems: "center", padding: 16,
    }}>
      <Card style={{ width: "min(780px, 100%)", maxHeight: "86vh", display: "flex", flexDirection: "column" }}>
        <SectionTitle right={
          <button onClick={swapAll} style={pill(false)} title="Use this if expenses came in as income (or vice versa)">
            Swap income/expense
          </button>
        }>Import from CSV</SectionTitle>
        <p style={{ margin: "0 0 10px", fontSize: 13, color: T.mute }}>
          {rows.length} {rows.length === 1 ? "row" : "rows"} found. Rows that look like duplicates
          of existing entries start unchecked. Adjust categories, then import.
        </p>
        <div style={{ overflowY: "auto", flex: 1, minHeight: 0, border: `1px solid ${T.line}`, borderRadius: 10, padding: "0 10px" }}>
          {rows.map((r, i) => (
            <div key={i} style={{
              display: "flex", gap: 8, alignItems: "center", padding: "8px 0",
              borderTop: i ? `1px solid ${T.line}` : "none", fontSize: 13,
              opacity: r.include ? 1 : 0.55,
            }}>
              <input type="checkbox" checked={r.include}
                onChange={(e) => setRow(i, { include: e.target.checked })} style={{ accentColor: T.pine }} />
              <span style={{ width: 76, color: T.mute, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{r.date}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.note || "(no description)"}
                {r.dup && <span style={{ color: T.brass }}> · duplicate?</span>}
              </span>
              <span style={{
                fontVariantNumeric: "tabular-nums", fontWeight: 600, width: 82, textAlign: "right",
                color: r.type === "income" ? T.pos : T.ink, flexShrink: 0,
              }}>
                {r.type === "income" ? "+" : "−"}{fmt(r.amount)}
              </span>
              <select value={r.category} onChange={(e) => setRow(i, { category: e.target.value })}
                style={{ ...inputStyle, width: 132, padding: "5px 8px", fontSize: 13, flexShrink: 0 }}>
                {(r.type === "income" ? INCOME_CATS : EXPENSE_CATS).map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: T.mute }}>{included.length} selected</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={btn(T.paper, T.mute)}>Cancel</button>
          <button onClick={() => included.length && onConfirm(included)}
            style={{ ...btn(T.brass), opacity: included.length ? 1 : 0.5 }}>
            Import {included.length} {included.length === 1 ? "entry" : "entries"}
          </button>
        </div>
      </Card>
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
  // null = normal entry; an array = one receipt split across categories
  const [splits, setSplits] = useState(null);

  const cats = type === "expense" ? EXPENSE_CATS : INCOME_CATS;

  const submit = () => {
    if (!date) { setErr("Pick a date."); return; }
    if (splits) {
      const lines = splits.map((s) => ({ ...s, amt: parseFloat(s.amount) }));
      if (lines.some((s) => !s.amt || s.amt <= 0)) { setErr("Every split line needs an amount greater than zero."); return; }
      onAdd(lines.map((s) => ({ id: uid(), type, amount: s.amt, category: s.category, date, note: note.trim() })));
      return;
    }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setErr("Enter an amount greater than zero."); return; }
    onAdd([{ id: uid(), type, amount: amt, category, date, note: note.trim() }]);
  };

  const switchType = (t) => {
    setType(t);
    setCategory(t === "expense" ? EXPENSE_CATS[1] : INCOME_CATS[0]);
    setSplits(null);
  };

  const startSplit = () => setSplits([
    { category, amount },
    { category: EXPENSE_CATS.find((c) => c !== category) || category, amount: "" },
  ]);
  const setSplit = (i, patch) => setSplits((s) => s.map((line, j) => (j === i ? { ...line, ...patch } : line)));
  const splitTotal = splits ? splits.reduce((s, line) => s + (parseFloat(line.amount) || 0), 0) : 0;

  return (
    <Card style={{ marginTop: 14, borderColor: T.brass, background: "#FDFBF5" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={() => switchType("expense")}
          style={btn(type === "expense" ? T.neg : T.paper, type === "expense" ? "#fff" : T.mute)}>Expense</button>
        <button onClick={() => switchType("income")}
          style={btn(type === "income" ? T.pos : T.paper, type === "income" ? "#fff" : T.mute)}>Income</button>
        <div style={{ flex: 1 }} />
        {type === "expense" && !splits && (
          <button onClick={startSplit} style={{ ...btn("transparent", T.mute), border: `1px solid ${T.line}`, borderRadius: 99, fontSize: 13 }}>
            Split across categories
          </button>
        )}
      </div>

      {splits ? (
        <div style={{ display: "grid", gap: 8 }}>
          {splits.map((line, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <select value={line.category} onChange={(e) => setSplit(i, { category: e.target.value })}
                style={{ ...inputStyle, width: 160 }}>
                {EXPENSE_CATS.map((c) => <option key={c}>{c}</option>)}
              </select>
              <input type="number" min="0" step="0.01" value={line.amount} placeholder="0.00"
                onChange={(e) => { setSplit(i, { amount: e.target.value }); setErr(""); }}
                style={{ ...inputStyle, width: 120 }} />
              {splits.length > 2 && (
                <button onClick={() => setSplits((s) => s.filter((_, j) => j !== i))}
                  aria-label="Remove split line"
                  style={{ ...btn("transparent", T.mute), padding: "4px 8px", fontSize: 16 }}>×</button>
              )}
            </div>
          ))}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={() => setSplits((s) => [...s, { category: EXPENSE_CATS[0], amount: "" }])}
              style={{ ...btn("transparent", T.mute), border: `1px solid ${T.line}`, borderRadius: 99, fontSize: 13 }}>
              + Add line
            </button>
            <button onClick={() => setSplits(null)}
              style={{ ...btn("transparent", T.mute), fontSize: 13 }}>Cancel split</button>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 13, color: T.mute, fontVariantNumeric: "tabular-nums" }}>
              Total {fmt(splitTotal)}
            </span>
          </div>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            <label style={{ fontSize: 12, color: T.mute }}>Date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, marginTop: 4 }} />
            </label>
            <label style={{ fontSize: 12, color: T.mute }}>Note (optional, shared by all lines)
              <input value={note} placeholder="e.g. Costco run" onChange={(e) => setNote(e.target.value)}
                style={{ ...inputStyle, marginTop: 4 }} />
            </label>
          </div>
        </div>
      ) : (
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
      )}
      {err && <div style={{ color: T.neg, fontSize: 13, marginTop: 8 }}>{err}</div>}
      <div style={{ marginTop: 12 }}>
        <button onClick={submit} style={btn(T.ink)}>
          {splits ? `Save ${splits.length} entries` : "Save entry"}
        </button>
      </div>
    </Card>
  );
}

// ---------- Overview ----------
function Overview({
  spentByCat, budgets, trendRows, trendCats, trendKind, setTrendKind,
  trendRange, setTrendRange, monthTx, expenses, insights,
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

      {insights.length > 0 && (
        <Card style={{ gridColumn: "1 / -1", background: "#FDFBF5" }}>
          <SectionTitle>Ledger notes</SectionTitle>
          <div style={{ display: "grid", gap: 8 }}>
            {insights.map((line) => (
              <div key={line} style={{ display: "flex", gap: 9, fontSize: 14, alignItems: "baseline" }}>
                <span aria-hidden style={{ color: T.brass, fontSize: 12, flexShrink: 0 }}>✦</span>
                <span>{line}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

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
function Bills({
  bills, month, paidMap, transactions, addBill, deleteBill, markPaid, unmarkPaid,
  incomes, incomePaidMap, addIncome, deleteIncome, markIncome, unmarkIncome,
}) {
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

      <IncomeSection incomes={incomes} month={month} paidMap={incomePaidMap}
        transactions={transactions} addIncome={addIncome} deleteIncome={deleteIncome}
        markIncome={markIncome} unmarkIncome={unmarkIncome} />
    </div>
  );
}

// ---------- Expected income ----------
function IncomeSection({ incomes, month, paidMap, transactions, addIncome, deleteIncome, markIncome, unmarkIncome }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(INCOME_CATS[0]);
  const [payDay, setPayDay] = useState("1");
  const [err, setErr] = useState("");

  const txIds = useMemo(() => new Set(transactions.map((t) => t.id)), [transactions]);
  const isReceived = (x) => Boolean(paidMap[x.id] && txIds.has(paidMap[x.id]));

  const create = () => {
    const amt = parseFloat(amount);
    const day = parseInt(payDay, 10);
    if (!name.trim()) { setErr("Give it a name — e.g. Paycheck."); return; }
    if (!amt || amt <= 0) { setErr("Enter an amount greater than zero."); return; }
    if (!day || day < 1 || day > 31) { setErr("Pay day must be between 1 and 31."); return; }
    addIncome({ id: uid(), name: name.trim(), amount: amt, category, payDay: day });
    setName(""); setAmount(""); setPayDay("1"); setErr("");
  };

  const sorted = [...incomes].sort((a, b) => a.payDay - b.payDay);
  const total = sorted.reduce((s, x) => s + x.amount, 0);
  const receivedTotal = sorted.filter(isReceived).reduce((s, x) => s + x.amount, 0);

  return (
    <>
      <Card style={{ background: "#F5FAF6", borderColor: T.pos }}>
        <SectionTitle>Add expected income</SectionTitle>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
          <input value={name} placeholder="Name — e.g. Paycheck"
            onChange={(e) => { setName(e.target.value); setErr(""); }} style={inputStyle} />
          <input type="number" min="0" step="0.01" value={amount} placeholder="Amount"
            onChange={(e) => { setAmount(e.target.value); setErr(""); }} style={inputStyle} />
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
            {INCOME_CATS.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input type="number" min="1" max="31" value={payDay} placeholder="Pay day (1–31)"
            onChange={(e) => { setPayDay(e.target.value); setErr(""); }} style={inputStyle} />
          <button onClick={create} style={btn(T.pos)}>Add income</button>
        </div>
        {err && <div style={{ color: T.neg, fontSize: 13, marginTop: 8 }}>{err}</div>}
      </Card>

      {sorted.length === 0 ? (
        <Empty text="No expected income yet. Add your paycheck and check it off each month when it lands." card />
      ) : (
        <Card>
          <SectionTitle right={
            <span style={{ fontSize: 13, color: T.mute, fontVariantNumeric: "tabular-nums" }}>
              {fmt(receivedTotal)} received of {fmt(total)}
            </span>
          }>Expected income for {monthLabel(month)}</SectionTitle>
          <div style={{ margin: "2px 0 14px" }}>
            <ProgressBar ratio={total ? receivedTotal / total : 0} over={false} />
          </div>
          {sorted.map((x, i) => {
            const received = isReceived(x);
            return (
              <div key={x.id} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 2px",
                borderTop: i ? `1px solid ${T.line}` : "none", fontSize: 14,
                opacity: received ? 0.65 : 1,
              }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, flexShrink: 0, background: T.pos }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{x.name}</div>
                  <div style={{ fontSize: 12, color: T.mute }}>
                    {x.category} · arrives the {ordinal(x.payDay)}
                  </div>
                </div>
                <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, minWidth: 80, textAlign: "right", color: T.pos }}>
                  +{fmt(x.amount)}
                </span>
                <button onClick={() => (received ? unmarkIncome(x) : markIncome(x))}
                  style={received
                    ? { ...btn(T.paper, T.pos), border: `1px solid ${T.line}` }
                    : btn(T.pos)}>
                  {received ? "Received ✓" : "Mark received"}
                </button>
                <button onClick={() => deleteIncome(x.id)} aria-label={`Delete ${x.name} income`}
                  style={{ ...btn("transparent", T.mute), padding: "4px 8px", fontSize: 16 }}>×</button>
              </div>
            );
          })}
        </Card>
      )}
    </>
  );
}

// ---------- Budgets ----------
function Budgets({ budgets, spentByCat, setBudget, rollover, toggleRollover, carryByCat }) {
  return (
    <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
      <Card>
        <SectionTitle>Monthly budgets by category</SectionTitle>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: T.mute }}>
          Set a limit for each category. The bar shows this month's spending against it.
          Turn on roll over to carry unspent budget into the next month (overspending
          carries too) — handy for saving up in a category like car repairs.
        </p>
        <div style={{ display: "grid", gap: 14 }}>
          {EXPENSE_CATS.map((cat) => {
            const budget = budgets[cat] || 0;
            const carry = rollover[cat] ? (carryByCat[cat] || 0) : 0;
            const effective = Math.max(budget + carry, 0);
            const spent = spentByCat[cat] || 0;
            const over = budget > 0 && spent > effective;
            return (
              <div key={cat}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: CAT_COLORS[cat] }} />
                  <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{cat}</span>
                  <span style={{ fontSize: 13, color: over ? T.neg : T.mute, fontVariantNumeric: "tabular-nums" }}>
                    {fmt(spent)}{budget > 0 && <> of {fmt(effective)}{over && " — over"}</>}
                  </span>
                  <label style={{
                    display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: T.mute,
                    cursor: "pointer", userSelect: "none",
                  }}>
                    <input type="checkbox" checked={!!rollover[cat]} onChange={() => toggleRollover(cat)}
                      style={{ accentColor: T.pine }} />
                    roll over
                  </label>
                  <input type="number" min="0" step="10" placeholder="Set limit"
                    value={budget || ""}
                    onChange={(e) => setBudget(cat, parseFloat(e.target.value) || 0)}
                    style={{ ...inputStyle, width: 110 }} />
                </div>
                {budget > 0 && rollover[cat] && carry !== 0 && (
                  <div style={{ fontSize: 12, color: carry > 0 ? T.pos : T.neg, marginBottom: 5 }}>
                    {carry > 0
                      ? `${fmt(carry)} carried in from earlier months`
                      : `${fmt(Math.abs(carry))} borrowed from earlier overspending`}
                  </div>
                )}
                {budget > 0 && <ProgressBar ratio={effective > 0 ? spent / effective : 1} over={over} />}
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
function Transactions({ monthTx, deleteTx, updateTx }) {
  const [q, setQ] = useState("");
  const [ftype, setFtype] = useState("all");
  const [fcat, setFcat] = useState("all");

  const list = monthTx.filter((t) => {
    if (ftype !== "all" && t.type !== ftype) return false;
    if (fcat !== "all" && t.category !== fcat) return false;
    if (q && !(t.category + " " + (t.note || "")).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const filtering = q !== "" || ftype !== "all" || fcat !== "all";
  const net = list.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);

  return (
    <Card style={{ marginTop: 14 }}>
      <SectionTitle right={filtering && (
        <span style={{ fontSize: 13, color: T.mute, fontVariantNumeric: "tabular-nums" }}>
          {list.length} {list.length === 1 ? "match" : "matches"} · net {(net >= 0 ? "+" : "−") + fmt(Math.abs(net))}
        </span>
      )}>All entries this month</SectionTitle>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes and categories"
          style={{ ...inputStyle, flex: 1, minWidth: 170 }} />
        <select value={ftype} onChange={(e) => setFtype(e.target.value)} style={{ ...inputStyle, width: 120 }}>
          <option value="all">All types</option>
          <option value="expense">Expenses</option>
          <option value="income">Income</option>
        </select>
        <select value={fcat} onChange={(e) => setFcat(e.target.value)} style={{ ...inputStyle, width: 160 }}>
          <option value="all">All categories</option>
          {[...EXPENSE_CATS, ...INCOME_CATS].map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      {list.length === 0
        ? <Empty text={monthTx.length === 0
            ? "No entries for this month. Switch months with the arrows above, or add one."
            : "Nothing matches those filters."} />
        : <TxList list={list} onDelete={deleteTx} onEdit={updateTx} />}
    </Card>
  );
}

function TxList({ list, onDelete, onEdit }) {
  const [editingId, setEditingId] = useState(null);
  return (
    <div>
      {list.map((t, i) => (
        editingId === t.id ? (
          <TxEditRow key={t.id} t={t} topBorder={i > 0}
            onSave={(patch) => { onEdit(t.id, patch); setEditingId(null); }}
            onCancel={() => setEditingId(null)} />
        ) : (
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
          {onEdit && (
            <button onClick={() => setEditingId(t.id)} aria-label={`Edit ${t.category} entry`}
              style={{ ...btn("transparent", T.mute), padding: "4px 6px", fontSize: 14 }}>✎</button>
          )}
          {onDelete && (
            <button onClick={() => onDelete(t.id)} aria-label={`Delete ${t.category} entry`}
              style={{ ...btn("transparent", T.mute), padding: "4px 8px", fontSize: 16 }}>×</button>
          )}
        </div>
        )
      ))}
    </div>
  );
}

function TxEditRow({ t, topBorder, onSave, onCancel }) {
  const [type, setType] = useState(t.type);
  const [amount, setAmount] = useState(String(t.amount));
  const [category, setCategory] = useState(t.category);
  const [date, setDate] = useState(t.date);
  const [note, setNote] = useState(t.note || "");
  const cats = type === "expense" ? EXPENSE_CATS : INCOME_CATS;

  const switchType = (newType) => {
    setType(newType);
    const newCats = newType === "expense" ? EXPENSE_CATS : INCOME_CATS;
    if (!newCats.includes(category)) setCategory(newCats[0]);
  };

  const save = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || !date) return;
    onSave({ type, amount: amt, category, date, note: note.trim() });
  };

  return (
    <div style={{
      padding: "10px 2px", borderTop: topBorder ? `1px solid ${T.line}` : "none",
      display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center",
    }}>
      <select value={type} onChange={(e) => switchType(e.target.value)} style={{ ...inputStyle, width: 105 }}>
        <option value="expense">Expense</option>
        <option value="income">Income</option>
      </select>
      <input type="number" min="0" step="0.01" value={amount}
        onChange={(e) => setAmount(e.target.value)} style={{ ...inputStyle, width: 100 }} />
      <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...inputStyle, width: 140 }}>
        {cats.map((c) => <option key={c}>{c}</option>)}
      </select>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, width: 150 }} />
      <input value={note} placeholder="Note" onChange={(e) => setNote(e.target.value)}
        style={{ ...inputStyle, flex: 1, minWidth: 120 }} />
      <button onClick={save} style={{ ...btn(T.pos), padding: "8px 14px" }}>Save</button>
      <button onClick={onCancel} style={{ ...btn("transparent", T.mute), padding: "8px 10px" }}>Cancel</button>
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
