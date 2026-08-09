import { useState } from "react";
import { T } from "./theme.js";
import { useApp } from "./ctx.js";
import { INCOME_CATS } from "./constants.js";
import { fmt, todayStr, uid } from "./utils.js";
import { Card, btn, inputStyle } from "./ui.jsx";

export function AddEntry({ onAdd }) {
  const { expenseCats } = useApp();
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(expenseCats[1]);
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  // null = normal entry; an array = one receipt split across categories
  const [splits, setSplits] = useState(null);

  const cats = type === "expense" ? expenseCats : INCOME_CATS;

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
    setCategory(t === "expense" ? expenseCats[1] : INCOME_CATS[0]);
    setSplits(null);
  };

  const startSplit = () => setSplits([
    { category, amount },
    { category: expenseCats.find((c) => c !== category) || category, amount: "" },
  ]);
  const setSplit = (i, patch) => setSplits((s) => s.map((line, j) => (j === i ? { ...line, ...patch } : line)));
  const splitTotal = splits ? splits.reduce((s, line) => s + (parseFloat(line.amount) || 0), 0) : 0;

  return (
    <Card style={{ marginTop: 14 }}>
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
                {expenseCats.map((c) => <option key={c}>{c}</option>)}
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
            <button onClick={() => setSplits((s) => [...s, { category: expenseCats[0], amount: "" }])}
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
        <button onClick={submit} style={btn(T.ink, T.card)}>
          {splits ? `Save ${splits.length} entries` : "Save entry"}
        </button>
      </div>
    </Card>
  );
}
