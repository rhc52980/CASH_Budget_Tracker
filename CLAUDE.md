# CASH_Budget_Tracker

CASH — Count All Spending Habits. Personal budgeting / ledger application.

## Status

Stack: React 18 + Vite, Recharts for charts. Client-only SPA — data persists
in `localStorage` under the key `budget-book-v1`; there is no backend.

- App entry: `src/main.jsx` → `src/BudgetBook.jsx` (state + orchestration).
  Tabs live in `src/*Tab.jsx`; shared pieces in `ui.jsx`, `theme.js` (CSS-var
  tokens; charts use concrete per-theme colors from `CHART`), `constants.js`,
  `utils.js` (pure helpers incl. rollover math), `csv.js` (bank import).
- Theming: light/dark via `data-theme` on `<html>`; tokens are CSS variables
  in `index.css`. Category colors are colorblind-validated — see constants.js.
- Dev server: `npm run dev` (Vite, port 5173). Tests: `npm test` (vitest).
- Deploys to GitHub Pages on push to main (`.github/workflows/deploy.yml`).

## Repository

- Remote: https://github.com/rhc52980/CASH_Budget_Tracker (private)
- Local `main` tracks `origin/main`.

## Conventions

- `.claude/` is gitignored — it holds machine-local Claude Code settings.
- Commit messages: short imperative subject line.
