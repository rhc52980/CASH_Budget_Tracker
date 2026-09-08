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

/**
 * Current balance of one account.
 * Liabilities (credit cards) simply hold a negative balance, so net worth is
 * the plain sum of every account and needs no special-casing.
 * Transfers move value between accounts without being income or spending.
 */
export function accountBalance(accountId, startingBalance, transactions) {
  let b = Number(startingBalance) || 0;
  for (const t of transactions) {
    if (t.type === "transfer") {
      if (t.accountId === accountId) b -= t.amount;
      if (t.toAccountId === accountId) b += t.amount;
    } else if (t.accountId === accountId) {
      b += t.type === "income" ? t.amount : -t.amount;
    }
  }
  return b;
}

/**
 * Balance counting only transactions you have ticked off against a statement.
 * Reconciling means making this match what the bank says; anything left over
 * is the discrepancy worth investigating.
 */
export function clearedBalance(accountId, startingBalance, transactions) {
  return accountBalance(accountId, startingBalance, transactions.filter((t) => t.cleared));
}

/** Everything owned minus everything owed. */
export function netWorth(accounts, transactions) {
  return accounts.reduce(
    (sum, a) => sum + accountBalance(a.id, a.startingBalance, transactions),
    0
  );
}

/**
 * Balance left on an amortising loan after `paymentsMade` payments.
 * Each payment covers that month's interest first; only the remainder
 * reduces the balance. An APR of 0 makes it plain subtraction.
 * Derived from the original balance and payment count rather than stored,
 * so undoing a payment corrects the figure instead of leaving it adrift.
 */
export function loanRemaining(balance, apr, payment, paymentsMade) {
  const r = (apr || 0) / 100 / 12;
  let b = balance;
  for (let i = 0; i < paymentsMade && b > 0; i++) {
    const interest = b * r;
    const principal = payment - interest;
    if (principal <= 0) return b; // payment does not even cover the interest
    b = Math.max(0, b - principal);
  }
  return b;
}

/** Payments still needed to clear `balance`. Infinity if it never will. */
export function loanPaymentsLeft(balance, apr, payment) {
  if (balance <= 0) return 0;
  if (!payment || payment <= 0) return Infinity;
  const r = (apr || 0) / 100 / 12;
  if (r === 0) return Math.ceil(balance / payment);
  if (payment <= balance * r) return Infinity;
  return Math.ceil(-Math.log(1 - (balance * r) / payment) / Math.log(1 + r));
}


/**
 * Should this bill be logged automatically for `month` yet?
 * Pulled out of the effect so the rule can be tested: auto-pay writes money
 * into the ledger without being asked, so getting this wrong is expensive.
 * A bill whose amount varies never qualifies - the stored figure is only a
 * typical value, not what was actually charged.
 */
export function isAutoPayDue(bill, { month, today, paidTxId, liveTxIds, skipped }) {
  if (!bill.autoPay || bill.varies) return false;
  if (skipped) return false;
  if (paidTxId && liveTxIds.has(paidTxId)) return false;
  const nowYm = monthKey(today);
  if (month > nowYm) return false;                       // never the future
  const startYm = bill.createdAt ? monthKey(bill.createdAt) : nowYm;
  if (month < startYm) return false;                     // never before it existed
  return dueDateInMonth(month, bill.dueDay) <= today;
}

/**
 * Label for the date chip on the entry form. Nearly every entry is for today
 * or yesterday, so those read as words; anything else shows the date, and the
 * year appears only when it is not the current one.
 */
export function dateChipLabel(date, today = todayStr()) {
  if (!date) return "Pick a date";
  if (date === today) return "Today";
  const [ty, tm, td] = today.split("-").map(Number);
  // Day 0 of a month rolls back into the previous one, so this is safe across
  // month and year boundaries.
  const prev = new Date(ty, tm - 1, td - 1);
  const pad = (n) => String(n).padStart(2, "0");
  if (date === `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}-${pad(prev.getDate())}`) {
    return "Yesterday";
  }
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", y === ty
    ? { month: "short", day: "numeric" }
    : { month: "short", day: "numeric", year: "numeric" });
}

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
