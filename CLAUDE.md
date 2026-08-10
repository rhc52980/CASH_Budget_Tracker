# CASH_Budget_Tracker

CASH — Count All Spending Habits. Personal budgeting / ledger application.

## Status

Stack: React 18 + Vite, Recharts for charts. Client-only SPA — data persists
in `localStorage` under the key `budget-book-v1`; there is no backend.

- Persistence lives in `src/storage.js` and is deliberately defensive: a
  failed/corrupt read is reported (never swallowed), the caller then refuses to
  auto-save so the original bytes survive, and unreadable data is quarantined
  under a `cash-recovery-*` key. Rolling snapshots (`cash-snap-*`, max 5, one
  per 6h) give a rollback path; the live ledger outranks them under quota
  pressure. Don't reintroduce a bare `localStorage.setItem` for ledger data.
- App entry: `src/main.jsx` → `src/BudgetBook.jsx` (state + orchestration).
  Tabs live in `src/*Tab.jsx`; shared pieces in `ui.jsx`, `theme.js` (CSS-var
  tokens; charts use concrete per-theme colors from `CHART`), `constants.js`,
  `utils.js` (pure helpers incl. rollover math), `csv.js` (bank import).
- Theming: light/dark via `data-theme` on `<html>`; tokens are CSS variables
  in `index.css`, surfaced as `T.*` in theme.js. Visual language is flat and
  modern: one accent (emerald), Inter only, hairline borders, 16px radii,
  tight tracking on large numerals. No display serif, textures, or gradients.
- Chart colors live in `CHART.light/.dark` in theme.js — each set is validated
  for colorblind separation against its own surface. Re-run the dataviz
  `validate_palette.js` six checks before changing any of them.
- Dev server: `npm run dev` (Vite, port 5173). Tests: `npm test` (vitest).
- Deploys to GitHub Pages on push to main (`.github/workflows/deploy.yml`).

## Repository

- Remote: https://github.com/rhc52980/CASH_Budget_Tracker (private)
- Local `main` tracks `origin/main`.

## Conventions

- `.claude/` is gitignored — it holds machine-local Claude Code settings.
- Commit messages: short imperative subject line.
