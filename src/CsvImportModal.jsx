import { useState } from "react";
import { T } from "./theme.js";
import { useApp } from "./ctx.js";
import { INCOME_CATS } from "./constants.js";
import { guessCategory } from "./csv.js";
import { fmt } from "./utils.js";
import { Card, SectionTitle, btn, pill, inputStyle } from "./ui.jsx";

export function CsvImportModal({ preview, onConfirm, onClose }) {
  const { expenseCats } = useApp();
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
      position: "fixed", inset: 0, background: "var(--overlay)", zIndex: 50,
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
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: T.ink }}>
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
                {(r.type === "income" ? INCOME_CATS : expenseCats).map((c) => <option key={c}>{c}</option>)}
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
