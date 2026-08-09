# CASH_Budget_Tracker

CASH — Count All Spending Habits. Personal budgeting / ledger application.

## Status

Stack: React 18 + Vite, Recharts for charts. Client-only SPA — data persists
in `localStorage` under the key `budget-book-v1`; there is no backend.

- App entry: `src/main.jsx` → `src/BudgetBook.jsx` (the whole app is one component file)
- Dev server: `npm run dev` (Vite, port 5173)

## Repository

- Remote: https://github.com/rhc52980/CASH_Budget_Tracker (private)
- Local `main` tracks `origin/main`.

## Conventions

- `.claude/` is gitignored — it holds machine-local Claude Code settings.
- Commit messages: short imperative subject line.
