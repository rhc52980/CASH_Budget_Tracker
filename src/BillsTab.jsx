import { useMemo, useState } from "react";
import { T } from "./theme.js";
import { useApp } from "./ctx.js";
import { INCOME_CATS, BILL_PRESETS } from "./constants.js";
import { fmt, uid, ordinal, monthLabel, dueDateInMonth, todayStr } from "./utils.js";
import { Card, SectionTitle, Empty, ProgressBar, btn, inputStyle } from "./ui.jsx";

export function Bills({
  bills, month, paidMap, transactions, addBill, deleteBill, updateBill, markPaid, unmarkPaid,
  incomes, incomePaidMap, addIncome, deleteIncome, updateIncome, markIncome, unmarkIncome,
}) {
  const { expenseCats, catColor } = useApp();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(expenseCats[0]);
  const [dueDay, setDueDay] = useState("1");
  const [err, setErr] = useState("");
  const [editId, setEditId] = useState(null);

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
          <input value={name} placeholder="Bill name — pick above or type"
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
            if (editId === b.id) {
              return <RecurringEditRow key={b.id} item={b} dayField="dueDay" cats={expenseCats} topBorder={i > 0}
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
                <button onClick={() => setEditId(b.id)} aria-label={`Edit ${b.name} bill`}
                  style={{ ...btn("transparent", T.mute), padding: "4px 6px", fontSize: 14 }}>✎</button>
                <button onClick={() => deleteBill(b.id)} aria-label={`Delete ${b.name} bill`}
                  style={{ ...btn("transparent", T.mute), padding: "4px 8px", fontSize: 16 }}>×</button>
              </div>
            );
          })}
        </Card>
      )}

      <IncomeSection incomes={incomes} month={month} paidMap={incomePaidMap}
        transactions={transactions} addIncome={addIncome} deleteIncome={deleteIncome}
        updateIncome={updateIncome} markIncome={markIncome} unmarkIncome={unmarkIncome} />
    </div>
  );
}

// Shared inline editor for bills (dueDay) and expected income (payDay)
function RecurringEditRow({ item, dayField, cats, topBorder, onSave, onCancel }) {
  const [name, setName] = useState(item.name);
  const [amount, setAmount] = useState(String(item.amount));
  const [category, setCategory] = useState(item.category);
  const [day, setDay] = useState(String(item[dayField]));

  const save = () => {
    const amt = parseFloat(amount);
    const d = parseInt(day, 10);
    if (!name.trim() || !amt || amt <= 0 || !d || d < 1 || d > 31) return;
    onSave({ name: name.trim(), amount: amt, category, [dayField]: d });
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
      <button onClick={save} style={{ ...btn(T.pos), padding: "8px 14px" }}>Save</button>
      <button onClick={onCancel} style={{ ...btn("transparent", T.mute), padding: "8px 10px" }}>Cancel</button>
    </div>
  );
}

function IncomeSection({ incomes, month, paidMap, transactions, addIncome, deleteIncome, updateIncome, markIncome, unmarkIncome }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(INCOME_CATS[0]);
  const [payDay, setPayDay] = useState("1");
  const [err, setErr] = useState("");
  const [editId, setEditId] = useState(null);

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
      <Card>
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
            if (editId === x.id) {
              return <RecurringEditRow key={x.id} item={x} dayField="payDay" cats={INCOME_CATS} topBorder={i > 0}
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
