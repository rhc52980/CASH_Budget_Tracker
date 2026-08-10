// Design tokens. DOM styles reference CSS variables (see index.css) so the
// theme switch is a single data-theme attribute on <html>.
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

// Appearance choices offered in the menu. `auto` follows the OS.
export const THEMES = [
  { id: "auto", label: "Follow system", hint: "Matches your device" },
  { id: "light", label: "Light", hint: "Bright, neutral grey" },
  { id: "dark", label: "Dark", hint: "Soft charcoal" },
  { id: "midnight", label: "Midnight", hint: "True black — easier on OLED" },
  { id: "contrast", label: "High contrast", hint: "Stronger text and edges" },
];

export const DARK_THEMES = new Set(["dark", "midnight"]);

/**
 * Accent options. Every pair below clears WCAG AA (4.5:1) between the fill and
 * the ink placed on it — buttons carry 14px text, so 3:1 is not enough.
 * Light column: white text. Dark column: near-black text.
 */
export const ACCENTS = [
  { id: "emerald", label: "Emerald",
    light: { accent: "#0A7D57", ink: "#FFFFFF", soft: "#E4F3EC" },
    dark: { accent: "#34D39A", ink: "#08110D", soft: "#16302A" } },
  { id: "blue", label: "Blue",
    light: { accent: "#1668C4", ink: "#FFFFFF", soft: "#E4EEFA" },
    dark: { accent: "#5AA9F0", ink: "#08110D", soft: "#152634" } },
  { id: "violet", label: "Violet",
    light: { accent: "#6A44C4", ink: "#FFFFFF", soft: "#EDE7FA" },
    dark: { accent: "#A18BF5", ink: "#08110D", soft: "#241E38" } },
  { id: "amber", label: "Amber",
    light: { accent: "#9A6800", ink: "#FFFFFF", soft: "#F7EEDC" },
    dark: { accent: "#E0A93C", ink: "#08110D", soft: "#332711" } },
  { id: "rose", label: "Rose",
    light: { accent: "#C0356A", ink: "#FFFFFF", soft: "#FAE7EE" },
    dark: { accent: "#EE7AA6", ink: "#08110D", soft: "#341A24" } },
];

/** Write the chosen accent onto the root element for the resolved theme. */
export function applyAccent(root, accentId, resolvedTheme) {
  const a = ACCENTS.find((x) => x.id === accentId) || ACCENTS[0];
  const set = DARK_THEMES.has(resolvedTheme) ? a.dark : a.light;
  root.style.setProperty("--accent", set.accent);
  root.style.setProperty("--accent-ink", set.ink);
  root.style.setProperty("--accent-soft", set.soft);
}

// Charts render SVG attributes, which can't resolve CSS variables — these are
// concrete per-theme values. Every categorical set and in/out pair below is
// validated (dataviz six checks) against the surface it actually renders on.
// Re-run scripts/validate_palette.js before changing any of them.
const LIGHT_CATS = {
  Housing: "#1E7A4F", Groceries: "#DFA32B", Dining: "#5560C0",
  Transport: "#B5504A", Utilities: "#0E9488", Health: "#A87F35",
  Entertainment: "#3E7FB5", Shopping: "#C4703A", Subscriptions: "#8A5FA8",
  Other: "#D683A2",
};
const DARK_CATS = {
  Housing: "#1FA070", Groceries: "#C08A1F", Dining: "#7B84E0",
  Transport: "#D46B60", Utilities: "#23A89B", Health: "#A87F3A",
  Entertainment: "#5391C9", Shopping: "#CB7640", Subscriptions: "#8778E8",
  Other: "#C95E90",
};
// Darker still, so every swatch clears 3:1 on white (the default light set has
// two that don't) — the point of the high-contrast theme.
const CONTRAST_CATS = {
  Housing: "#0C6539", Groceries: "#BA8100", Dining: "#3F47B0",
  Transport: "#A83A32", Utilities: "#008E7F", Health: "#845A00",
  Entertainment: "#16649F", Shopping: "#B2500F", Subscriptions: "#5B3E9E",
  Other: "#BC3A6C",
};

export const CHART = {
  light: {
    ink: "#0E1116", mute: "#6C7480", line: "#E8EAEE", card: "#FFFFFF",
    in: "#2F9E68", out: "#96352D", netLine: "#0E9E6E",
    cursor: "rgba(14,17,22,0.04)", rest: "#8A929C", cats: LIGHT_CATS,
  },
  dark: {
    ink: "#F2F5F8", mute: "#98A2AE", line: "#262B31", card: "#181B1F",
    in: "#2CAE7A", out: "#BE5245", netLine: "#34D39A",
    cursor: "rgba(255,255,255,0.05)", rest: "#79828D", cats: DARK_CATS,
  },
  midnight: {
    ink: "#F4F6F8", mute: "#96A0AB", line: "#22262A", card: "#0D0D0D",
    in: "#2CAE7A", out: "#BE5245", netLine: "#34D39A",
    cursor: "rgba(255,255,255,0.06)", rest: "#79828D", cats: DARK_CATS,
  },
  contrast: {
    ink: "#000000", mute: "#3F464E", line: "#8C939B", card: "#FFFFFF",
    in: "#2F9E68", out: "#96352D", netLine: "#0C6539",
    cursor: "rgba(0,0,0,0.07)", rest: "#5A6169", cats: CONTRAST_CATS,
  },
};
