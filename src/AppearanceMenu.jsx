import { useEffect, useRef } from "react";
import { T, THEMES, ACCENTS, DARK_THEMES } from "./theme.js";

// Small swatch showing what a theme actually looks like: page, card, accent
function ThemePreview({ id, resolved, accentId }) {
  const shown = id === "auto" ? resolved : id;
  const swatch = {
    light: { bg: "#f6f7f9", card: "#ffffff", line: "#e8eaee" },
    dark: { bg: "#0c0e11", card: "#181b1f", line: "#262b31" },
    midnight: { bg: "#000000", card: "#0d0d0d", line: "#22262a" },
    contrast: { bg: "#ffffff", card: "#ffffff", line: "#8c939b" },
  }[shown];
  const a = ACCENTS.find((x) => x.id === accentId) || ACCENTS[0];
  const dot = DARK_THEMES.has(shown) ? a.dark.accent : a.light.accent;
  return (
    <span aria-hidden style={{
      width: 34, height: 24, borderRadius: 6, flexShrink: 0,
      background: swatch.bg, border: `1px solid ${swatch.line}`,
      display: "flex", alignItems: "center", gap: 3, padding: 3, boxSizing: "border-box",
    }}>
      <span style={{ flex: 1, height: "100%", borderRadius: 3, background: swatch.card, border: `1px solid ${swatch.line}` }} />
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot, flexShrink: 0 }} />
    </span>
  );
}

export function AppearanceMenu({ themePref, setThemePref, accent, setAccent, resolved, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const row = (active) => ({
    display: "flex", alignItems: "center", gap: 10, width: "100%",
    padding: "8px 10px", borderRadius: 9, cursor: "pointer", textAlign: "left",
    background: active ? T.brassSoft : "transparent",
    border: `1px solid ${active ? T.brass : "transparent"}`,
    color: T.ink, fontFamily: T.sans, fontSize: 13.5, fontWeight: 500,
  });

  return (
    <div ref={ref} role="dialog" aria-label="Appearance" style={{
      position: "absolute", top: 46, right: 0, zIndex: 60, width: 268,
      background: T.card, border: `1px solid ${T.line}`, borderRadius: 14,
      boxShadow: "0 16px 40px -12px rgba(0,0,0,0.35)", padding: 10,
      animation: "riseIn 160ms ease both",
    }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: T.mute, padding: "2px 4px 6px" }}>
        Appearance
      </div>
      <div style={{ display: "grid", gap: 2 }}>
        {THEMES.map((t) => (
          <button key={t.id} onClick={() => setThemePref(t.id)} style={row(themePref === t.id)}>
            <ThemePreview id={t.id} resolved={resolved} accentId={accent} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block" }}>{t.label}</span>
              <span style={{ display: "block", fontSize: 11.5, color: T.mute, fontWeight: 400 }}>
                {t.hint}
              </span>
            </span>
            {themePref === t.id && <span aria-hidden style={{ color: T.brass, fontWeight: 700 }}>✓</span>}
          </button>
        ))}
      </div>

      <div style={{
        fontSize: 11.5, fontWeight: 600, color: T.mute,
        padding: "12px 4px 8px", borderTop: `1px solid ${T.line}`, marginTop: 8,
      }}>
        Accent
      </div>
      <div style={{ display: "flex", gap: 8, padding: "0 4px 4px" }}>
        {ACCENTS.map((a) => {
          const swatch = DARK_THEMES.has(resolved) ? a.dark.accent : a.light.accent;
          const on = accent === a.id;
          return (
            <button key={a.id} onClick={() => setAccent(a.id)} title={a.label}
              aria-label={`${a.label} accent`} aria-pressed={on}
              style={{
                width: 30, height: 30, borderRadius: "50%", cursor: "pointer", padding: 0,
                background: swatch,
                border: on ? `2px solid ${T.ink}` : `2px solid transparent`,
                boxShadow: on ? `0 0 0 2px ${T.card} inset` : "none",
              }} />
          );
        })}
      </div>
    </div>
  );
}
