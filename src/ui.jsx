import { useEffect, useRef, useState } from "react";
import { T } from "./theme.js";

export const btn = (bg, color = "#fff") => ({
  padding: "9px 16px", borderRadius: 9, border: "none", cursor: "pointer",
  background: bg, color, fontFamily: T.sans, fontSize: 14, fontWeight: 600,
});

export const pill = (active) => ({
  padding: "4px 11px", borderRadius: 99, cursor: "pointer", fontFamily: T.sans,
  fontSize: 12, fontWeight: 600, border: `1px solid ${active ? T.pine : T.line}`,
  background: active ? T.pine : T.card, color: active ? T.goldInk : T.mute,
});

export const inputStyle = {
  width: "100%", padding: "9px 11px", borderRadius: 8, boxSizing: "border-box",
  border: `1px solid ${T.line}`, background: T.inputBg, color: T.ink,
  fontFamily: T.sans, fontSize: 14, outline: "none",
};

export const tooltipStyle = {
  background: T.card, border: `1px solid ${T.line}`, borderRadius: 10,
  boxShadow: T.shadow, fontFamily: T.sans, fontSize: 13, color: T.ink,
};

export function Card({ children, style }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.line}`, borderRadius: 14,
      padding: 20, boxShadow: T.shadow, animation: "fadeUp 300ms ease both",
      ...style,
    }}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, right }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12, gap: 10 }}>
      <h3 style={{
        margin: 0, fontFamily: T.serif, fontSize: 17, fontWeight: 600,
        color: T.ink, letterSpacing: "0.01em",
      }}>{children}</h3>
      {right}
    </div>
  );
}

export function ProgressBar({ ratio, over }) {
  const pct = Math.min(ratio * 100, 100);
  return (
    <div style={{
      height: 10, background: T.track, borderRadius: 99, overflow: "hidden",
      border: `1px solid ${T.line}`, boxShadow: "inset 0 1px 2px rgba(28,43,36,0.08)",
    }}>
      <div style={{
        width: `${pct}%`, height: "100%", borderRadius: 99,
        backgroundColor: over ? T.neg : ratio > 0.85 ? T.brass : T.pos,
        backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.28), rgba(255,255,255,0) 60%)",
        transition: "width 400ms cubic-bezier(.22,.9,.35,1)",
      }} />
    </div>
  );
}

export function Empty({ text, card }) {
  const inner = (
    <div style={{ color: T.mute, fontSize: 14, padding: "20px 6px", textAlign: "center", fontFamily: T.serif, fontStyle: "italic" }}>
      <div aria-hidden style={{ color: T.brass, fontSize: 14, fontStyle: "normal", letterSpacing: "0.4em", marginBottom: 7 }}>✦ ✦ ✦</div>
      {text}
    </div>
  );
  return card ? <Card>{inner}</Card> : inner;
}

// Animates a number toward its target — used by the passbook header stats
export function useCountUp(value, duration = 450) {
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
