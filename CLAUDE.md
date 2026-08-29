# CASH_Budget_Tracker

CASH — Count All Spending Habits. Personal budgeting / ledger application.

## Status

Stack: React 18 + Vite, Recharts for charts. Client-only SPA — data persists
in `localStorage` under the key `budget-book-v1`; there is no backend.

- Launchers: `CASH.vbs` (what the desktop shortcut targets) runs
  `Start-CASH.bat` with a hidden window; `Start-CASH.bat` only serves the
  existing `dist/`, so it starts instantly and needs no interaction. Building
  belongs to `Install-CASH.bat` / `Update-CASH.bat`. `Stop-CASH.bat` kills
  whatever is listening on 4173. Never use `timeout` in these scripts — it
  fails under redirected input; use `ping -n`.
- Version: `package.json` `version` is the single source of truth. Vite injects
  it as `__APP_VERSION__`; read it via `src/version.js`. It shows in the page
  footer, the Backup & data panel, the launcher banner, and is stamped into
  exported backups as `appVersion`. To release, bump `package.json` and commit.
  This is separate from `SCHEMA_VERSION` in storage.js, which versions the data
  shape — bump that only when the stored ledger structure changes.
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
- Theming: `data-theme` on `<html>` is one of light/dark/midnight/contrast;
  the stored preference may also be `auto`, resolved from `prefers-color-scheme`
  and kept live via a media-query listener. Accent is applied separately as an
  inline custom property (`applyAccent` in theme.js) so themes and accents
  compose without a CSS block per combination. `--pos`/`--neg` are semantic and
  must never follow the accent. Accent/ink pairs are chosen to clear WCAG AA.
- Tokens are CSS variables
  in `index.css`, surfaced as `T.*` in theme.js. Visual language is flat and
  modern: one accent (emerald), Inter only, hairline borders, 16px radii,
  tight tracking on large numerals. No display serif, textures, or gradients.
- Chart colors live in `CHART.light/.dark` in theme.js — each set is validated
  for colorblind separation against its own surface. Re-run the dataviz
  `validate_palette.js` six checks before changing any of them.
- Dev server: `npm run dev` (Vite, port 5173). Tests: `npm test` (vitest).
- Deploys to GitHub Pages on push to main (`.github/workflows/deploy.yml`).

## Repository

- Remote: https://github.com/rhc52980/CASH_Budget_Tracker
- Local `main` tracks `origin/main`.

## Conventions

- `.claude/` is gitignored — it holds machine-local Claude Code settings.
- Commit messages: short imperative subject line.
