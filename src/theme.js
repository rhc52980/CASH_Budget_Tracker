// Design tokens. DOM styles reference CSS variables (see index.css) so the
// light/dark switch is a single data-theme attribute on <html>.
export const T = {
  paper: "var(--bg)", card: "var(--card)", ink: "var(--text)",
  mute: "var(--muted)", line: "var(--border)",
  // `brass` and `pine` are the accent roles (names kept from earlier revisions);
  // goldInk is the ink that sits on top of an accent fill.
  brass: "var(--accent)", pine: "var(--accent)", goldInk: "var(--accent-ink)",
  brassSoft: "var(--accent-soft)",
  pos: "var(--pos)", neg: "var(--neg)",
  cardTint: "var(--card-2)", incomeTint: "var(--card-2)", track: "var(--track)",
  inputBg: "var(--input-bg)", headerInk: "var(--text)", headerSub: "var(--muted)",
  shadow: "var(--shadow)",
  sans: "'Inter', -apple-system, 'Segoe UI', system-ui, sans-serif",
  // No display face — one grotesque throughout, differentiated by size/weight
  serif: "'Inter', -apple-system, 'Segoe UI', system-ui, sans-serif",
};

// Charts render SVG attributes, which can't resolve CSS variables — these are
// concrete per-theme values. Both categorical sets and both in/out pairs are
// validated (dataviz six checks) against their own surface; re-run the
// validator before changing any of them.
export const CHART = {
  light: {
    ink: "#0E1116", mute: "#6C7480", line: "#E8EAEE", card: "#FFFFFF",
    in: "#2F9E68", out: "#96352D", netLine: "#0E9E6E",
    cursor: "rgba(14,17,22,0.04)", rest: "#8A929C",
    cats: {
      Housing: "#1E7A4F", Groceries: "#DFA32B", Dining: "#5560C0",
      Transport: "#B5504A", Utilities: "#0E9488", Health: "#A87F35",
      Entertainment: "#3E7FB5", Shopping: "#C4703A", Subscriptions: "#8A5FA8",
      Other: "#D683A2",
    },
  },
  dark: {
    ink: "#F2F5F8", mute: "#98A2AE", line: "#262B31", card: "#181B1F",
    in: "#2CAE7A", out: "#BE5245", netLine: "#34D39A",
    cursor: "rgba(255,255,255,0.05)", rest: "#79828D",
    cats: {
      Housing: "#1FA070", Groceries: "#C08A1F", Dining: "#7B84E0",
      Transport: "#D46B60", Utilities: "#23A89B", Health: "#A87F3A",
      Entertainment: "#5391C9", Shopping: "#CB7640", Subscriptions: "#8778E8",
      Other: "#C95E90",
    },
  },
};
