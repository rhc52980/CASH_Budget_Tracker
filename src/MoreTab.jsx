import { T } from "./theme.js";
import { Card } from "./ui.jsx";

// The four sections that used to be top-level tabs. They are the ones you
// visit occasionally — setting a budget, checking a balance — so they sit one
// tap deeper and leave the daily loop uncluttered.
export const MORE_SECTIONS = [
  ["accounts", "Accounts", "Balances, transfers, and reconciling against a statement"],
  ["budgets", "Budgets", "Monthly limits, rollover, and your own categories"],
  ["goals", "Goals", "Savings targets and what you have put aside"],
  ["year", "Year", "Twelve months of income and spending at a glance"],
];

export function MoreMenu({ onPick }) {
  return (
    <Card style={{ marginTop: 14, padding: 6 }}>
      {MORE_SECTIONS.map(([id, title, blurb], i) => (
        <button key={id} onClick={() => onPick(id)} style={{
          display: "flex", alignItems: "center", gap: 12, width: "100%",
          padding: "14px 14px", cursor: "pointer", textAlign: "left",
          background: "transparent", border: "none",
          borderTop: i === 0 ? "none" : `1px solid ${T.line}`,
          fontFamily: T.sans, color: T.ink,
        }}>
          <span style={{ flex: 1 }}>
            <span style={{
              display: "block", fontSize: 15, fontWeight: 600, letterSpacing: "-0.015em",
            }}>{title}</span>
            <span style={{
              display: "block", fontSize: 13, color: T.mute, marginTop: 2, lineHeight: 1.4,
            }}>{blurb}</span>
          </span>
          <span aria-hidden style={{ color: T.mute, fontSize: 18, flexShrink: 0 }}>›</span>
        </button>
      ))}
    </Card>
  );
}

// Shown above a section reached through More, so there is always a way back
// that does not depend on the browser's own back button.
export function SectionHeader({ title, onBack }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, marginTop: 18,
    }}>
      <button onClick={onBack} style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "6px 12px 6px 9px", borderRadius: 99, cursor: "pointer",
        background: "transparent", border: `1px solid ${T.line}`, color: T.mute,
        fontFamily: T.sans, fontSize: 13, fontWeight: 500,
      }}>
        <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>‹</span> More
      </button>
      <h2 style={{
        margin: 0, fontFamily: T.sans, fontSize: 17, fontWeight: 650,
        letterSpacing: "-0.02em", color: T.ink,
      }}>{title}</h2>
    </div>
  );
}
