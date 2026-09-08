import { useState } from "react";
import { T } from "./theme.js";
import { useApp } from "./ctx.js";
import { INCOME_CATS } from "./constants.js";
import { fmt } from "./utils.js";
import { Card, SectionTitle, Empty, btn, inputStyle } from "./ui.jsx";

export function Transactions({ monthTx, deleteTx, updateTx, onAddEntry }) {
  const { allCats } = useApp();
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
  // Transfers move money between your own accounts, so they net to nothing
  const net = list.reduce(
    (s, t) => (t.type === "transfer" ? s : s + (t.type === "income" ? t.amount : -t.amount)),
    0
  );

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
          <option value="transfer">Transfers</option>
        </select>
        <select value={fcat} onChange={(e) => setFcat(e.target.value)} style={{ ...inputStyle, width: 160 }}>
          <option value="all">All categories</option>
          {allCats.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      {list.length === 0 ? (
        monthTx.length === 0 ? (
          <Empty text="No entries for this month. Switch months with the arrows above, or add one."
            actionLabel="Add an entry" onAction={onAddEntry} />
        ) : (
          // Only filters can empty a month that has entries in it, so the way
          // out is to drop them rather than to add anything.
          <Empty text="Nothing matches those filters."
            actionLabel="Clear filters"
            onAction={() => { setQ(""); setFtype("all"); setFcat("all"); }} />
        )
      ) : <TxList list={list} onDelete={deleteTx} onEdit={updateTx} />}
    </Card>
  );
}

export function TxList({ list, onDelete, onEdit }) {
  const { catColor, accounts } = useApp();
  const [editingId, setEditingId] = useState(null);
  const accName = (id) => accounts.find((a) => a.id === id)?.name;
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
            background: t.type === "transfer" ? T.mute : t.type === "income" ? T.pos : catColor(t.category),
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>
              {t.type === "transfer"
                ? `${accName(t.accountId) || "?"} → ${accName(t.toAccountId) || "?"}`
                : t.category}
            </div>
            {(t.note || (t.type !== "transfer" && accName(t.accountId))) && (
              <div style={{ fontSize: 12, color: T.mute, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {[t.note, t.type !== "transfer" ? accName(t.accountId) : null].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
          <span style={{ fontSize: 12, color: T.mute, fontVariantNumeric: "tabular-nums" }}>
            {new Date(t.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
          <span style={{
            fontVariantNumeric: "tabular-nums", fontWeight: 600, minWidth: 90, textAlign: "right",
            color: t.type === "transfer" ? T.mute : t.type === "income" ? T.pos : T.ink,
          }}>
            {t.type === "transfer" ? "" : t.type === "income" ? "+" : "−"}{fmt(t.amount)}
          </span>
          {onEdit && t.type !== "transfer" && (
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
  const { expenseCats } = useApp();
  const [type, setType] = useState(t.type);
  const [amount, setAmount] = useState(String(t.amount));
  const [category, setCategory] = useState(t.category);
  const [date, setDate] = useState(t.date);
  const [note, setNote] = useState(t.note || "");
  const cats = type === "expense" ? expenseCats : INCOME_CATS;

  const switchType = (newType) => {
    setType(newType);
    const newCats = newType === "expense" ? expenseCats : INCOME_CATS;
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
