import { useMemo, useRef, useState } from "react";
import { T } from "./theme.js";
import { useApp } from "./ctx.js";
import { INCOME_CATS, BILL_PRESETS } from "./constants.js";
import {
  fmt, uid, ordinal, monthLabel, dueDateInMonth, todayStr, shiftMonth,
  loanRemaining, loanPaymentsLeft,
} from "./utils.js";
import { Card, SectionTitle, Empty, ProgressBar, btn, chip, focusField, inputStyle, numeral } from "./ui.jsx";

export function Bills({
  bills, month, paidMap, transactions, addBill, deleteBill, updateBill, markPaid, unmarkPaid,
  incomes, incomePaidMap, addIncome, deleteIncome, updateIncome, markIncome, unmarkIncome,
}) {
  const { expenseCats, catColor } = useApp();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(expenseCats[0]);
  const [dueDay, setDueDay] = useState("1");
  const [autoPay, setAutoPay] = useState(false);
  const [varies, setVaries] = useState(false);
  const [payingId, setPayingId] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [isLoan, setIsLoan] = useState(false);
  const [loanBalance, setLoanBalance] = useState("");
  const [loanApr, setLoanApr] = useState("");
  const [err, setErr] = useState("");
  const [editId, setEditId] = useState(null);

  // Payments actually recorded against each bill, so undoing one corrects
  // the payoff figures rather than leaving them adrift
  const paymentsByBill = useMemo(() => {
    const m = {};
    transactions.forEach((t) => { if (t.billId) m[t.billId] = (m[t.billId] || 0) + 1; });
    return m;
  }, [transactions]);

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
    const bal = parseFloat(loanBalance);
    if (isLoan && (!bal || bal <= 0)) { setErr("Enter what you still owe on the loan."); return; }
    // createdAt bounds auto-pay: it must never invent payments for months
    // before the bill existed
    addBill({
      id: uid(), name: name.trim(), amount: amt, category, dueDay: day,
      autoPay: varies ? false : autoPay, varies, createdAt: todayStr(),
      ...(isLoan ? { loanBalance: bal, loanApr: parseFloat(loanApr) || 0 } : {}),
    });
    setName(""); setAmount(""); setDueDay("1"); setAutoPay(false); setVaries(false);
    setIsLoan(false); setLoanBalance(""); setLoanApr(""); setErr("");
  };

  // A variable bill records what you were actually charged; the stored amount
  // stays as the typical figure used for budgeting.
  const confirmPay = (bill) => {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) return;
    markPaid(bill, amt);
    setPayingId(null);
  };

  const nameRef = useRef(null);
  const sorted = [...bills].sort((a, b) => a.dueDay - b.dueDay);
  const total = sorted.reduce((s, b) => s + b.amount, 0);
  const paidTotal = sorted.filter(isPaid).reduce((s, b) => s + b.amount, 0);

  return (
    <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
      <Card>
        <SectionTitle>Add a monthly bill</SectionTitle>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {BILL_PRESETS.map(([label, cat]) => (
            <button key={label}
              onClick={() => { setName(label); setCategory(cat); setErr(""); }}
              style={{
                padding: "6px 12px", borderRadius: 99, cursor: "pointer",
                border: `1px solid ${name === label ? T.brass : T.line}`,
                background: name === label ? T.brassSoft : "transparent",
                color: name === label ? T.ink : T.mute,
                fontFamily: T.sans, fontSize: 12.5, fontWeight: 500,
              }}>{label}</button>
          ))}
        </div>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
          <input ref={nameRef} value={name} placeholder="Bill name — pick above or type"
            onChange={(e) => { setName(e.target.value); setErr(""); }} style={inputStyle} />
          <input type="number" min="0" step="0.01" value={amount} placeholder="Amount"
            onChange={(e) => { setAmount(e.target.value); setErr(""); }} style={inputStyle} />
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
            {expenseCats.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input type="number" min="1" max="31" value={dueDay} placeholder="Due day (1–31)"
            onChange={(e) => { setDueDay(e.target.value); setErr(""); }} style={inputStyle} />
          <button onClick={create} style={btn(T.brass)}>Add bill</button>
        </div>
        <label style={{
          display: "inline-flex", alignItems: "center", gap: 8, marginTop: 12,
          fontSize: 13.5, color: T.ink, cursor: "pointer", userSelect: "none",
        }}>
          <input type="checkbox" checked={autoPay} disabled={varies}
            onChange={(e) => setAutoPay(e.target.checked)}
            style={{ accentColor: "var(--accent)" }} />
          <span>
            Auto-pay
            <span style={{ color: T.mute }}>
              {" "}— pays itself on the due day, no checking off. Best for fixed
              amounts like rent or a car loan.
            </span>
          </span>
        </label>
        <label style={{
          display: "flex", alignItems: "center", gap: 8, marginTop: 8,
          fontSize: 13.5, color: T.ink, cursor: "pointer", userSelect: "none",
        }}>
          <input type="checkbox" checked={varies}
            onChange={(e) => { setVaries(e.target.checked); if (e.target.checked) setAutoPay(false); }}
            style={{ accentColor: "var(--accent)" }} />
          <span>
            Amount varies
            <span style={{ color: T.mute }}>
              {" "}— for water, electric, phone. CASH asks what you were actually
              charged when you mark it paid, and treats the amount above as typical.
            </span>
          </span>
        </label>
        <label style={{
          display: "flex", alignItems: "center", gap: 8, marginTop: 8,
          fontSize: 13.5, color: T.ink, cursor: "pointer", userSelect: "none",
        }}>
          <input type="checkbox" checked={isLoan} onChange={(e) => setIsLoan(e.target.checked)}
            style={{ accentColor: "var(--accent)" }} />
          <span>
            Track payoff
            <span style={{ color: T.mute }}>
              {" "}— for a loan. Shows what is left and when it clears.
            </span>
          </span>
        </label>
        {isLoan && (
          <div style={{ display: "grid", gap: 10, marginTop: 10, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            <label style={{ fontSize: 12, color: T.mute }}>Balance still owed
              <input type="number" min="0" step="0.01" value={loanBalance} placeholder="18000"
                onChange={(e) => { setLoanBalance(e.target.value); setErr(""); }}
                style={{ ...inputStyle, marginTop: 4 }} />
            </label>
            <label style={{ fontSize: 12, color: T.mute }}>Interest rate % (optional)
              <input type="number" min="0" step="0.01" value={loanApr} placeholder="6.9"
                onChange={(e) => setLoanApr(e.target.value)}
                style={{ ...inputStyle, marginTop: 4 }} />
            </label>
          </div>
        )}
        {err && <div style={{ color: T.neg, fontSize: 13, marginTop: 8 }}>{err}</div>}
      </Card>

      {sorted.length === 0 ? (
        <Empty card
          text="No bills yet. Add your recurring bills — rent, utilities, subscriptions — and check them off each month."
          actionLabel="Add your first bill" onAction={() => focusField(nameRef)} />
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
            if (editId === b.id) {
              return <RecurringEditRow key={b.id} item={b} dayField="dueDay" cats={expenseCats} topBorder={i > 0}
                kind="bill"
                onSave={(patch) => { updateBill(b.id, patch); setEditId(null); }}
                onCancel={() => setEditId(null)} />;
            }
            const paid = isPaid(b);
            const overdue = !paid && dueDateInMonth(month, b.dueDay) < todayStr();
            return (
              <div key={b.id} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 2px",
                borderTop: i ? `1px solid ${T.line}` : "none", fontSize: 14,
                opacity: paid ? 0.65 : 1,
              }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, flexShrink: 0, background: catColor(b.category) }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 600, textDecoration: paid ? "line-through" : "none",
                    display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap",
                  }}>
                    {b.name}
                    {b.varies && (
                      <span title="Amount varies - CASH asks what you were charged" style={{
                        fontSize: 10.5, fontWeight: 600, letterSpacing: "0.04em",
                        padding: "1px 7px", borderRadius: 99, textDecoration: "none",
                        background: "transparent", color: T.mute, border: `1px solid ${T.line}`,
                      }}>VARIES</span>
                    )}
                    {b.autoPay && (
                      <span title="Pays itself on the due day" style={{
                        fontSize: 10.5, fontWeight: 600, letterSpacing: "0.04em",
                        padding: "1px 7px", borderRadius: 99, textDecoration: "none",
                        background: T.brassSoft, color: T.ink, border: `1px solid ${T.line}`,
                      }}>AUTO</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: overdue ? T.neg : T.mute }}>
                    {b.category} · {b.varies ? "typically " : ""}{fmt(b.amount)} · due the {ordinal(b.dueDay)}
                    {overdue && " — overdue"}
                    {b.autoPay && !paid && !overdue && " — will pay itself"}
                  </div>
                </div>
                <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, minWidth: 80, textAlign: "right" }}>
                  {fmt(b.amount)}
                </span>
                {payingId === b.id ? (
                  <>
                    <input type="number" min="0" step="0.01" autoFocus value={payAmount}
                      aria-label={`Amount charged for ${b.name}`}
                      onChange={(e) => setPayAmount(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") confirmPay(b);
                        if (e.key === "Escape") setPayingId(null);
                      }}
                      style={{ ...inputStyle, width: 100 }} />
                    <button onClick={() => confirmPay(b)} style={btn(T.pos)}>Log it</button>
                    <button onClick={() => setPayingId(null)}
                      style={{ ...btn("transparent", T.mute), padding: "8px 10px" }}>Cancel</button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      if (paid) return unmarkPaid(b);
                      if (b.varies) { setPayingId(b.id); setPayAmount(String(b.amount)); return; }
                      markPaid(b);
                    }}
                    title={b.autoPay && paid ? "Paid automatically — click to undo for this month" : undefined}
                    style={paid
                      ? { ...btn(T.paper, T.pos), border: `1px solid ${T.line}` }
                      : btn(T.pos)}>
                    {paid ? "Paid ✓" : b.varies ? "Mark paid…" : "Mark paid"}
                  </button>
                )}
                <button onClick={() => setEditId(b.id)} aria-label={`Edit ${b.name} bill`}
                  style={{ ...btn("transparent", T.mute), padding: "4px 6px", fontSize: 14 }}>✎</button>
                <button onClick={() => deleteBill(b.id)} aria-label={`Delete ${b.name} bill`}
                  style={{ ...btn("transparent", T.mute), padding: "4px 8px", fontSize: 16 }}>×</button>
              </div>
            );
          })}
        </Card>
      )}

      {sorted.some((b) => b.loanBalance > 0) && (
        <Card>
          <SectionTitle>Loan payoff</SectionTitle>
          <div style={{ display: "grid", gap: 18 }}>
            {sorted.filter((b) => b.loanBalance > 0).map((b) => (
              <LoanProgress key={b.id} bill={b} paymentsMade={paymentsByBill[b.id] || 0} />
            ))}
          </div>
        </Card>
      )}

      <IncomeSection incomes={incomes} month={month} paidMap={incomePaidMap}
        transactions={transactions} addIncome={addIncome} deleteIncome={deleteIncome}
        updateIncome={updateIncome} markIncome={markIncome} unmarkIncome={unmarkIncome} />
    </div>
  );
}

function LoanProgress({ bill, paymentsMade }) {
  const start = bill.loanBalance;
  const apr = bill.loanApr || 0;
  const left = loanRemaining(start, apr, bill.amount, paymentsMade);
  const cleared = start - left;
  const ratio = start > 0 ? cleared / start : 0;
  const toGo = loanPaymentsLeft(left, apr, bill.amount);
  const stuck = !Number.isFinite(toGo);
  const payoff = stuck || toGo === 0 ? null : monthLabel(shiftMonth(monthKeyToday(), toGo - 1));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 7 }}>
        <span style={{ fontWeight: 600, fontSize: 14, flex: 1, minWidth: 120 }}>{bill.name}</span>
        <span style={{ fontSize: 13, color: T.mute, fontVariantNumeric: "tabular-nums" }}>
          {fmt(left)} left of {fmt(start)}
        </span>
      </div>
      <ProgressBar ratio={ratio} over={false} />
      <div style={{ fontSize: 12.5, color: T.mute, marginTop: 7 }}>
        {left <= 0 ? (
          <span style={{ color: T.pos, fontWeight: 600 }}>Paid off ✓</span>
        ) : stuck ? (
          <span style={{ color: T.neg }}>
            {fmt(bill.amount)} a month does not cover the interest at {apr}% — the balance is growing.
          </span>
        ) : (
          <>
            {Math.round(ratio * 100)}% paid off · {toGo} payment{toGo === 1 ? "" : "s"} to go
            {payoff && <> · clear by {payoff}</>}
            {apr > 0 && <> · {apr}% APR</>}
          </>
        )}
      </div>
    </div>
  );
}

const monthKeyToday = () => todayStr().slice(0, 7);

// Shared inline editor for bills (dueDay) and expected income (payDay).
// `kind` picks which extra fields apply: a bill can vary or track a loan
// payoff; income instead carries an optional gross figure.
function RecurringEditRow({ item, dayField, cats, topBorder, onSave, onCancel, kind }) {
  const isBill = kind === "bill";
  const isIncome = kind === "income";
  const [name, setName] = useState(item.name);
  const [amount, setAmount] = useState(String(item.amount));
  const [category, setCategory] = useState(item.category);
  const [day, setDay] = useState(String(item[dayField]));
  const [autoPay, setAutoPay] = useState(Boolean(item.autoPay));
  const [varies, setVaries] = useState(Boolean(item.varies));
  const [gross, setGross] = useState(item.gross ? String(item.gross) : "");
  const [bal, setBal] = useState(item.loanBalance ? String(item.loanBalance) : "");
  const [apr, setApr] = useState(item.loanApr ? String(item.loanApr) : "");

  const save = () => {
    const amt = parseFloat(amount);
    const d = parseInt(day, 10);
    if (!name.trim() || !amt || amt <= 0 || !d || d < 1 || d > 31) return;
    const patch = { name: name.trim(), amount: amt, category, [dayField]: d };
    if (isBill) {
      patch.varies = varies;
      patch.autoPay = varies ? false : autoPay;
      const b = parseFloat(bal);
      patch.loanBalance = b > 0 ? b : undefined;
      patch.loanApr = b > 0 ? (parseFloat(apr) || 0) : undefined;
    }
    if (isIncome) {
      patch.autoPay = autoPay;
      const g = parseFloat(gross);
      patch.gross = g > 0 ? g : undefined;
      // This is now an exact new monthly figure rather than one derived from
      // an annual entry, so any stored annual total would be stale.
      patch.annualAmount = undefined;
      patch.annualGross = undefined;
    }
    onSave(patch);
  };

  return (
    <div style={{
      padding: "10px 2px", borderTop: topBorder ? `1px solid ${T.line}` : "none",
      display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center",
    }}>
      <input value={name} onChange={(e) => setName(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 130 }} />
      <input type="number" min="0" step="0.01" value={amount}
        onChange={(e) => setAmount(e.target.value)} style={{ ...inputStyle, width: 100 }} />
      <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...inputStyle, width: 140 }}>
        {cats.map((c) => <option key={c}>{c}</option>)}
      </select>
      <input type="number" min="1" max="31" value={day}
        onChange={(e) => setDay(e.target.value)} style={{ ...inputStyle, width: 70 }} />
      {isIncome && (
        <input type="number" min="0" step="0.01" value={gross} placeholder="Gross (optional)"
          title="Before deductions — shown alongside the take-home figure"
          onChange={(e) => setGross(e.target.value)} style={{ ...inputStyle, width: 130 }} />
      )}
      {(isBill || isIncome) && (
        <label style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 13, color: T.mute, cursor: "pointer", userSelect: "none",
        }}>
          <input type="checkbox" checked={autoPay} disabled={varies}
            onChange={(e) => setAutoPay(e.target.checked)}
            style={{ accentColor: "var(--accent)" }} />
          {isBill ? "auto-pay" : "auto-receive"}
        </label>
      )}
      {isBill && (
        <label style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 13, color: T.mute, cursor: "pointer", userSelect: "none",
        }}>
          <input type="checkbox" checked={varies}
            onChange={(e) => { setVaries(e.target.checked); if (e.target.checked) setAutoPay(false); }}
            style={{ accentColor: "var(--accent)" }} />
          varies
        </label>
      )}
      {isBill && (
        <>
          <input type="number" min="0" step="0.01" value={bal} placeholder="Owed"
            title="Balance still owed — leave blank if this is not a loan"
            onChange={(e) => setBal(e.target.value)} style={{ ...inputStyle, width: 100 }} />
          <input type="number" min="0" step="0.01" value={apr} placeholder="APR %"
            title="Interest rate"
            onChange={(e) => setApr(e.target.value)} style={{ ...inputStyle, width: 80 }} />
        </>
      )}
      <button onClick={save} style={{ ...btn(T.pos), padding: "8px 14px" }}>Save</button>
      <button onClick={onCancel} style={{ ...btn("transparent", T.mute), padding: "8px 10px" }}>Cancel</button>
    </div>
  );
}

function IncomeSection({ incomes, month, paidMap, transactions, addIncome, deleteIncome, updateIncome, markIncome, unmarkIncome }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [gross, setGross] = useState("");
  const [category, setCategory] = useState(INCOME_CATS[0]);
  const [payDay, setPayDay] = useState("1");
  // Whichever figure you actually know — a lot of people think of a salary
  // per year, not per paycheck. Both write the same monthly amount underneath.
  const [period, setPeriod] = useState("monthly");
  const [autoPay, setAutoPay] = useState(false);
  const [err, setErr] = useState("");
  const [editId, setEditId] = useState(null);

  const txIds = useMemo(() => new Set(transactions.map((t) => t.id)), [transactions]);
  const isReceived = (x) => Boolean(paidMap[x.id] && txIds.has(paidMap[x.id]));

  const create = () => {
    const rawAmt = parseFloat(amount);
    const day = parseInt(payDay, 10);
    if (!name.trim()) { setErr("Give it a name — e.g. Paycheck."); return; }
    if (!rawAmt || rawAmt <= 0) { setErr("Enter an amount greater than zero."); return; }
    if (!day || day < 1 || day > 31) { setErr("Pay day must be between 1 and 31."); return; }
    const rawGross = gross.trim() ? parseFloat(gross) : null;
    const annual = period === "annual";
    const amt = Math.round((annual ? rawAmt / 12 : rawAmt) * 100) / 100;
    const grossAmt = rawGross > 0 ? Math.round((annual ? rawGross / 12 : rawGross) * 100) / 100 : undefined;
    addIncome({
      id: uid(), name: name.trim(), amount: amt, gross: grossAmt, category, payDay: day,
      autoPay, createdAt: todayStr(),
      // Keep the figure you actually typed for the household total, so a
      // $85,000 salary reads back as $85,000/yr rather than 12x a rounded
      // monthly amount.
      ...(annual ? { annualAmount: rawAmt, annualGross: rawGross > 0 ? rawGross : undefined } : {}),
    });
    setName(""); setAmount(""); setGross(""); setPayDay("1"); setAutoPay(false); setErr("");
  };

  const nameRef = useRef(null);
  const sorted = [...incomes].sort((a, b) => a.payDay - b.payDay);
  const total = sorted.reduce((s, x) => s + x.amount, 0);
  const receivedTotal = sorted.filter(isReceived).reduce((s, x) => s + x.amount, 0);

  // The running household total this section exists for — set once per
  // income source, never re-entered, and unaffected by what's been checked
  // off this month.
  const annualTakeHome = sorted.reduce((s, x) => s + (x.annualAmount ?? x.amount * 12), 0);
  const hasGross = sorted.some((x) => x.gross > 0);
  const annualGross = sorted.reduce((s, x) => s + (x.annualGross ?? (x.gross ? x.gross * 12 : 0)), 0);

  return (
    <>
      {sorted.length > 0 && (
        <Card>
          <SectionTitle>Household income</SectionTitle>
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
            <div>
              <div style={{ fontSize: 12, color: T.mute }}>Take-home / year</div>
              <div style={numeral(22)}>{fmt(annualTakeHome)}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: T.mute }}>Take-home / month</div>
              <div style={numeral(22)}>{fmt(total)}</div>
            </div>
            {hasGross && (
              <div>
                <div style={{ fontSize: 12, color: T.mute }}>Gross / year</div>
                <div style={numeral(22)}>{fmt(annualGross)}</div>
              </div>
            )}
            {hasGross && (
              <div>
                <div style={{ fontSize: 12, color: T.mute }}>Gross / month</div>
                <div style={numeral(22)}>{fmt(sorted.reduce((s, x) => s + (x.gross || 0), 0))}</div>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle>Add expected income</SectionTitle>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {[["monthly", "Enter monthly"], ["annual", "Enter annual"]].map(([id, label]) => (
            <button key={id} onClick={() => setPeriod(id)} style={chip(period === id)}>{label}</button>
          ))}
        </div>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
          <input ref={nameRef} value={name} placeholder="Name — e.g. Paycheck"
            onChange={(e) => { setName(e.target.value); setErr(""); }} style={inputStyle} />
          <input type="number" min="0" step="0.01" value={amount}
            placeholder={period === "annual" ? "Take-home per year" : "Take-home per paycheck"}
            onChange={(e) => { setAmount(e.target.value); setErr(""); }} style={inputStyle} />
          <input type="number" min="0" step="0.01" value={gross}
            placeholder={(period === "annual" ? "Gross per year" : "Gross per paycheck") + " (optional)"}
            onChange={(e) => setGross(e.target.value)} style={inputStyle} />
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
            {INCOME_CATS.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input type="number" min="1" max="31" value={payDay} placeholder="Pay day (1–31)"
            onChange={(e) => { setPayDay(e.target.value); setErr(""); }} style={inputStyle} />
          <button onClick={create} style={btn(T.pos)}>Add income</button>
        </div>
        <label style={{
          display: "flex", alignItems: "center", gap: 8, marginTop: 12,
          fontSize: 13.5, color: T.ink, cursor: "pointer", userSelect: "none",
        }}>
          <input type="checkbox" checked={autoPay} onChange={(e) => setAutoPay(e.target.checked)}
            style={{ accentColor: "var(--accent)" }} />
          <span>
            Auto-receive
            <span style={{ color: T.mute }}>
              {" "}— logs itself on pay day, no checking off. Best for a salary
              that is the same every time.
            </span>
          </span>
        </label>
        {err && <div style={{ color: T.neg, fontSize: 13, marginTop: 8 }}>{err}</div>}
      </Card>

      {sorted.length === 0 ? (
        <Empty card
          text="No expected income yet. Add your paycheck and check it off each month when it lands."
          actionLabel="Add your paycheck" onAction={() => focusField(nameRef)} />
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
            if (editId === x.id) {
              return <RecurringEditRow key={x.id} item={x} dayField="payDay" cats={INCOME_CATS} topBorder={i > 0}
                kind="income"
                onSave={(patch) => { updateIncome(x.id, patch); setEditId(null); }}
                onCancel={() => setEditId(null)} />;
            }
            const received = isReceived(x);
            return (
              <div key={x.id} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 2px",
                borderTop: i ? `1px solid ${T.line}` : "none", fontSize: 14,
                opacity: received ? 0.65 : 1,
              }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, flexShrink: 0, background: T.pos }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 600, display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap",
                  }}>
                    {x.name}
                    {x.autoPay && (
                      <span title="Arrives automatically on pay day" style={{
                        fontSize: 10.5, fontWeight: 600, letterSpacing: "0.04em",
                        padding: "1px 7px", borderRadius: 99,
                        background: T.brassSoft, color: T.ink, border: `1px solid ${T.line}`,
                      }}>AUTO</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: T.mute }}>
                    {x.category}{x.gross > 0 && <> · gross {fmt(x.gross)}</>} · arrives the {ordinal(x.payDay)}
                    {x.autoPay && !received && " — will arrive automatically"}
                  </div>
                </div>
                <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, minWidth: 80, textAlign: "right", color: T.pos }}>
                  +{fmt(x.amount)}
                </span>
                <button onClick={() => (received ? unmarkIncome(x) : markIncome(x))}
                  title={x.autoPay && received ? "Received automatically — click to undo for this month" : undefined}
                  style={received
                    ? { ...btn(T.paper, T.pos), border: `1px solid ${T.line}` }
                    : btn(T.pos)}>
                  {received ? "Received ✓" : "Mark received"}
                </button>
                <button onClick={() => setEditId(x.id)} aria-label={`Edit ${x.name} income`}
                  style={{ ...btn("transparent", T.mute), padding: "4px 6px", fontSize: 14 }}>✎</button>
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
