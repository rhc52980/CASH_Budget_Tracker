import { useState } from "react";
import { T } from "./theme.js";
import { useApp } from "./ctx.js";
import { CUSTOM_CAT_COLORS } from "./constants.js";
import { fmt } from "./utils.js";
import { Card, SectionTitle, ProgressBar, btn, inputStyle } from "./ui.jsx";

export function Budgets({
  budgets, spentByCat, setBudget, rollover, toggleRollover, carryByCat,
  customCats, addCustomCat, deleteCustomCat,
}) {
  const { expenseCats, catColor } = useApp();
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
          {expenseCats.map((cat) => {
            const budget = budgets[cat] || 0;
            const carry = rollover[cat] ? (carryByCat[cat] || 0) : 0;
            const effective = Math.max(budget + carry, 0);
            const spent = spentByCat[cat] || 0;
            const over = budget > 0 && spent > effective;
            return (
              <div key={cat}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: catColor(cat) }} />
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

      <CustomCategories customCats={customCats} addCustomCat={addCustomCat} deleteCustomCat={deleteCustomCat} />
    </div>
  );
}

function CustomCategories({ customCats, addCustomCat, deleteCustomCat }) {
  const { expenseCats } = useApp();
  const [name, setName] = useState("");
  const [color, setColor] = useState(CUSTOM_CAT_COLORS[0]);
  const [err, setErr] = useState("");

  const create = () => {
    const n = name.trim();
    if (!n) { setErr("Give the category a name."); return; }
    if (n.length > 24) { setErr("Keep the name under 24 characters."); return; }
    if (expenseCats.some((c) => c.toLowerCase() === n.toLowerCase()) || n === "All else") {
      setErr("A category with that name already exists."); return;
    }
    addCustomCat({ name: n, color });
    setName(""); setErr("");
  };

  return (
    <Card>
      <SectionTitle>Custom categories</SectionTitle>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: T.mute }}>
        Add your own expense categories — Pets, Travel, whatever your ledger needs.
        Deleting one keeps its old entries; they just show a gray dot.
      </p>
      {customCats.length > 0 && (
        <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
          {customCats.map((c) => (
            <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: c.color }} />
              <span style={{ flex: 1, fontWeight: 600 }}>{c.name}</span>
              <button onClick={() => deleteCustomCat(c.name)} aria-label={`Delete ${c.name} category`}
                style={{ ...btn("transparent", T.mute), padding: "4px 8px", fontSize: 16 }}>×</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input value={name} placeholder="Category name — e.g. Pets"
          onChange={(e) => { setName(e.target.value); setErr(""); }}
          style={{ ...inputStyle, flex: 1, minWidth: 160 }} />
        <div style={{ display: "flex", gap: 5 }}>
          {CUSTOM_CAT_COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)} aria-label={`Use color ${c}`}
              style={{
                width: 24, height: 24, borderRadius: 6, cursor: "pointer", background: c,
                border: color === c ? `2px solid ${T.ink}` : `2px solid transparent`,
                padding: 0,
              }} />
          ))}
        </div>
        <button onClick={create} style={btn(T.brass)}>Add category</button>
      </div>
      {err && <div style={{ color: T.neg, fontSize: 13, marginTop: 8 }}>{err}</div>}
    </Card>
  );
}
