import { useState } from "react";
import { T } from "./theme.js";
import { fmt, uid } from "./utils.js";
import { Card, SectionTitle, Empty, ProgressBar, btn, inputStyle } from "./ui.jsx";

export function Goals({ goals, addGoal, fundGoal, deleteGoal }) {
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
      <Card style={{ background: T.cardTint, borderColor: T.brass }}>
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
              <h3 style={{ margin: 0, fontFamily: T.serif, fontSize: 17, flex: 1, color: T.ink }}>
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
