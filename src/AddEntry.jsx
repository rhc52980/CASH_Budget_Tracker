import { useState, useRef, useEffect } from "react";
import { T } from "./theme.js";
import { useApp } from "./ctx.js";
import { INCOME_CATS } from "./constants.js";
import { fmt, todayStr, uid, dateChipLabel } from "./utils.js";
import { Card, btn, chip, inputStyle } from "./ui.jsx";

export function AddEntry({ onAdd }) {
  const { expenseCats, accounts, catColor } = useApp();
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(expenseCats[1]);
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [showDate, setShowDate] = useState(false);
  const [showMore, setShowMore] = useState(false);
  // null = normal entry; an array = one receipt split across categories
  const [splits, setSplits] = useState(null);

  const cats = type === "expense" ? expenseCats : INCOME_CATS;

  // The form only appears when you ask for it, so the amount is what you came
  // to type. Landing in it saves a tap and, on a phone, opens the keypad.
  const amountRef = useRef(null);
  useEffect(() => { amountRef.current?.focus(); }, []);

  const submit = () => {
    if (!date) { setErr("Pick a date."); return; }
    if (splits) {
      const lines = splits.map((s) => ({ ...s, amt: parseFloat(s.amount) }));
      if (lines.some((s) => !s.amt || s.amt <= 0)) { setErr("Every split line needs an amount greater than zero."); return; }
      onAdd(lines.map((s) => ({
        id: uid(), type, amount: s.amt, category: s.category, date, note: note.trim(),
        ...(accountId ? { accountId } : {}),
      })));
      return;
    }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setErr("Enter an amount greater than zero."); return; }
    onAdd([{
      id: uid(), type, amount: amt, category, date, note: note.trim(),
      ...(accountId ? { accountId } : {}),
    }]);
  };

  const switchType = (t) => {
    setType(t);
    setCategory(t === "expense" ? expenseCats[1] : INCOME_CATS[0]);
    setSplits(null);
  };

  const startSplit = () => {
    setSplits([
      { category, amount },
      { category: expenseCats.find((c) => c !== category) || category, amount: "" },
    ]);
    setShowMore(true);
  };
  const setSplit = (i, patch) => setSplits((s) => s.map((line, j) => (j === i ? { ...line, ...patch } : line)));
  const splitTotal = splits ? splits.reduce((s, line) => s + (parseFloat(line.amount) || 0), 0) : 0;

  // Anything folded away still leaves a mark on the toggle, so no field is
  // quietly set behind a collapsed panel.
  const hidden = [note.trim(), accountId && accounts.length > 0].filter(Boolean).length;

  const segment = (active, tone) => ({
    flex: 1, padding: "8px 0", borderRadius: 8, cursor: "pointer",
    border: "1px solid transparent",
    background: active ? T.card : "transparent",
    color: active ? tone : T.mute,
    fontFamily: T.sans, fontSize: 14, fontWeight: active ? 650 : 500,
    letterSpacing: "-0.01em",
    boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
  });

  return (
    <Card style={{ marginTop: 14 }}>
      <div style={{
        display: "flex", gap: 2, padding: 3, borderRadius: 10,
        background: T.cardTint, border: `1px solid ${T.line}`, maxWidth: 260,
      }}>
        <button onClick={() => switchType("expense")}
          style={segment(type === "expense", T.neg)}>Expense</button>
        <button onClick={() => switchType("income")}
          style={segment(type === "income", T.pos)}>Income</button>
      </div>

      {splits ? (
        <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
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
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "20px 0 6px" }}>
            <span aria-hidden style={{
              fontSize: 26, fontWeight: 500, color: T.mute, letterSpacing: "-0.02em",
            }}>$</span>
            <input ref={amountRef} className="amount-field" type="number" min="0" step="0.01"
              value={amount} placeholder="0.00" aria-label="Amount"
              onChange={(e) => { setAmount(e.target.value); setErr(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              style={{
                flex: 1, minWidth: 0, padding: 0, border: "none", outline: "none",
                background: "transparent", color: T.ink, fontFamily: T.sans,
                fontSize: 38, fontWeight: 650, letterSpacing: "-0.035em",
                fontVariantNumeric: "tabular-nums",
              }} />
          </div>

          <div role="group" aria-label="Category"
            style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
            {cats.map((c) => {
              const on = c === category;
              return (
                <button key={c} onClick={() => setCategory(c)} aria-pressed={on} style={chip(on)}>
                  <span aria-hidden style={{
                    width: 8, height: 8, borderRadius: 3, flexShrink: 0,
                    background: catColor(c),
                    outline: on ? `1px solid ${T.card}` : "none",
                  }} />
                  {c}
                </button>
              );
            })}
          </div>
        </>
      )}

      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 14 }}>
        <button onClick={() => setShowDate((v) => !v)} aria-expanded={showDate}
          style={chip(date !== todayStr())}>{dateChipLabel(date)}</button>
        <button onClick={() => setShowMore((v) => !v)} aria-expanded={showMore}
          style={chip(false)}>
          {showMore ? "Fewer details" : "More details"}
          {!showMore && hidden > 0 && (
            <span aria-label={`${hidden} already set`} style={{
              width: 6, height: 6, borderRadius: "50%", background: T.brass,
            }} />
          )}
        </button>
      </div>

      {showDate && (
        <div style={{ marginTop: 10, maxWidth: 200 }}>
          <input type="date" value={date} aria-label="Date"
            onChange={(e) => { setDate(e.target.value); setErr(""); }} style={inputStyle} />
        </div>
      )}

      {showMore && (
        <div style={{
          display: "grid", gap: 10, marginTop: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}>
          <label style={{ fontSize: 12, color: T.mute }}>Note (optional)
            <input value={note} placeholder="e.g. Farmers market"
              onChange={(e) => setNote(e.target.value)} style={{ ...inputStyle, marginTop: 4 }} />
          </label>
          {accounts.length > 0 && (
            <label style={{ fontSize: 12, color: T.mute }}>Account
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)}
                style={{ ...inputStyle, marginTop: 4 }}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                <option value="">— none —</option>
              </select>
            </label>
          )}
          {type === "expense" && !splits && (
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button onClick={startSplit} style={{ ...chip(false), padding: "9px 14px" }}>
                Split across categories
              </button>
            </div>
          )}
        </div>
      )}

      {err && <div style={{ color: T.neg, fontSize: 13, marginTop: 10 }}>{err}</div>}
      <div style={{ marginTop: 14 }}>
        <button onClick={submit} style={btn(T.ink, T.card)}>
          {splits ? `Save ${splits.length} entries` : "Save entry"}
        </button>
      </div>
    </Card>
  );
}
