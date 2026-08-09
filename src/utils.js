export const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export const fmt = (n) => usd.format(n || 0);
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const monthKey = (d) => d.slice(0, 7); // from 'YYYY-MM-DD'
export const todayStr = () => new Date().toISOString().slice(0, 10);

export const monthDiff = (a, b) => {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
};

export const monthLabel = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

export const shiftMonth = (ym, delta) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// Due date of a bill within a given month, clamped to the month's length
export const dueDateInMonth = (ym, dueDay) => {
  const [y, m] = ym.split("-").map(Number);
  const day = Math.min(dueDay, new Date(y, m, 0).getDate());
  return `${ym}-${String(day).padStart(2, "0")}`;
};

export const kFmt = (v) => {
  const a = Math.abs(v);
  return (v < 0 ? "−" : "") + (a >= 1000 ? `$${(a / 1000).toFixed(1)}k` : `$${a}`);
};

// Surplus (or deficit) carried into `month` for categories with rollover on.
// Accrues from the first recorded transaction, capped at 24 months back,
// using the current budget amount for every month.
export function computeCarry(transactions, budgets, rollover, month, cats) {
  const carry = {};
  const txMonths = transactions.map((t) => monthKey(t.date));
  const firstYm = txMonths.length ? txMonths.reduce((a, b) => (a < b ? a : b)) : null;
  cats.forEach((cat) => {
    const base = budgets[cat] || 0;
    if (!rollover[cat] || base <= 0 || !firstYm) { carry[cat] = 0; return; }
    const span = Math.min(24, monthDiff(firstYm, month));
    let c = 0;
    for (let i = span; i >= 1; i--) {
      const ym = shiftMonth(month, -i);
      const spent = transactions.reduce((s, t) =>
        (t.type === "expense" && t.category === cat && monthKey(t.date) === ym) ? s + t.amount : s, 0);
      c += base - spent;
    }
    carry[cat] = c;
  });
  return carry;
}
