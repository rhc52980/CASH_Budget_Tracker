// Design tokens. DOM styles reference CSS variables (see index.css) so the
// light/dark switch is a single data-theme attribute on <html>.
export const T = {
  paper: "var(--paper)", card: "var(--card)", ink: "var(--ink)",
  pine: "var(--pine)", pineDeep: "var(--pine-deep)",
  brass: "var(--brass)", brassSoft: "var(--brass-soft)",
  pos: "var(--pos)", neg: "var(--neg)", mute: "var(--mute)", line: "var(--line)",
  cardTint: "var(--card-tint)", incomeTint: "var(--income-tint)", track: "var(--track)",
  inputBg: "var(--input-bg)", headerInk: "var(--header-ink)", headerSub: "var(--header-sub)",
  goldInk: "var(--gold-ink)", shadow: "var(--shadow)",
  serif: "'Fraunces', 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif",
  sans: "'Inter', 'Avenir Next', 'Segoe UI', system-ui, sans-serif",
};

// Charts render SVG attributes, which can't resolve CSS variables — these are
// concrete per-theme values. The in/out pairs are validated (dataviz six
// checks) against their surface; keep the deutan lightness gap if changing.
export const CHART = {
  light: {
    ink: "#1C2B24", mute: "#6B7A72", line: "#DCE3DD", card: "#FFFFFF",
    in: "#2F9E68", out: "#96352D", netLine: "#22493C",
    cursor: "rgba(28,43,36,0.05)", rest: "#8B948C",
  },
  dark: {
    ink: "#E8EDE6", mute: "#93A69B", line: "#32423A", card: "#1C2822",
    in: "#3FB57C", out: "#B54C40", netLine: "#A9C7B4",
    cursor: "rgba(255,255,255,0.06)", rest: "#6E7A72",
  },
};
