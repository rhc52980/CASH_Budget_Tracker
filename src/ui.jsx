import { useEffect, useRef, useState } from "react";
import { T } from "./theme.js";

export const btn = (bg, color = "var(--accent-ink)") => ({
  padding: "9px 16px", borderRadius: 10, border: "1px solid transparent",
  cursor: "pointer", background: bg, color,
  fontFamily: T.sans, fontSize: 14, fontWeight: 550, letterSpacing: "-0.01em",
});

export const ghostBtn = {
  padding: "9px 14px", borderRadius: 10, cursor: "pointer",
  background: "transparent", color: T.ink, border: `1px solid ${T.line}`,
  fontFamily: T.sans, fontSize: 14, fontWeight: 500, letterSpacing: "-0.01em",
};

export const pill = (active) => ({
  padding: "6px 13px", borderRadius: 8, cursor: "pointer",
  fontFamily: T.sans, fontSize: 13, fontWeight: 550, letterSpacing: "-0.01em",
  border: "1px solid transparent",
  background: active ? T.card : "transparent",
  color: active ? T.ink : T.mute,
  borderColor: active ? T.line : "transparent",
  boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
});

// A tappable choice. On a phone a <select> opens a modal wheel, so anything
// with a handful of options is a row of these instead.
export const chip = (active) => ({
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "7px 12px", borderRadius: 99, cursor: "pointer",
  fontFamily: T.sans, fontSize: 13, letterSpacing: "-0.01em",
  fontWeight: active ? 600 : 500,
  border: `1px solid ${active ? T.ink : T.line}`,
  background: active ? T.ink : "transparent",
  color: active ? T.card : T.ink,
});

export const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 10, boxSizing: "border-box",
  border: `1px solid ${T.line}`, background: T.inputBg, color: T.ink,
  fontFamily: T.sans, fontSize: 14, outline: "none",
};

export const label = { fontSize: 12, color: T.mute, fontWeight: 500 };

export const tooltipStyle = {
  background: T.card, border: `1px solid ${T.line}`, borderRadius: 12,
  boxShadow: T.shadow, fontFamily: T.sans, fontSize: 13, color: T.ink,
  padding: "8px 10px",
};

// Big numbers get tight tracking; that alone does most of the "modern" work
export const numeral = (size, weight = 600) => ({
  fontFamily: T.sans, fontSize: size, fontWeight: weight,
  letterSpacing: size >= 28 ? "-0.035em" : "-0.02em",
  fontVariantNumeric: "tabular-nums",
});

export function Card({ children, style }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.line}`, borderRadius: 16,
      padding: 20, boxShadow: T.shadow, animation: "riseIn 260ms ease both",
      ...style,
    }}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, right }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      marginBottom: 14, gap: 12,
    }}>
      <h3 style={{
        margin: 0, fontFamily: T.sans, fontSize: 15, fontWeight: 600,
        color: T.ink, letterSpacing: "-0.015em",
      }}>{children}</h3>
      {right}
    </div>
  );
}

export function ProgressBar({ ratio, over }) {
  const pct = Math.min(Math.max(ratio, 0) * 100, 100);
  return (
    <div style={{ height: 6, background: T.track, borderRadius: 99, overflow: "hidden" }}>
      <div style={{
        width: `${pct}%`, height: "100%", borderRadius: 99,
        backgroundColor: over ? T.neg : T.pos,
        transition: "width 420ms cubic-bezier(.22,.9,.35,1)",
      }} />
    </div>
  );
}

// An empty state should say what to do and let you do it. Without an action
// it is a dead end, which is how a fresh ledger ended up with no accounts and
// no budgets: nothing on the page led anywhere.
export function Empty({ text, card, actionLabel, onAction }) {
  const inner = (
    <div style={{
      color: T.mute, fontSize: 14, padding: "28px 16px", textAlign: "center",
      lineHeight: 1.55, maxWidth: 380, margin: "0 auto",
    }}>
      {text}
      {actionLabel && onAction && (
        <div style={{ marginTop: 16 }}>
          <button onClick={onAction} style={btn(T.brass)}>{actionLabel}</button>
        </div>
      )}
    </div>
  );
  return card ? <Card>{inner}</Card> : inner;
}

// Animates a number toward its target — used by the summary stats
export function useCountUp(value, duration = 420) {
  const [disp, setDisp] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current, to = value;
    prev.current = value;
    if (from === to) return;
    let raf;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min((t - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisp(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return disp;
}
