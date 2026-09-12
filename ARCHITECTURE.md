# CASH_Budget_Tracker

CASH — Count All Spending Habits. Personal budgeting / ledger application.

## Status

Stack: React 18 + Vite, Recharts for charts. The app runs locally against a
small dependency-free Node server (`server.js`) that owns the ledger file and
serves the built `dist/`. It binds `127.0.0.1` only — the ledger is never
exposed to the network. Nothing is hosted and nothing leaves the machine.

- Data lives in `data/ledger.json` beside the app, with rotating copies in
  `data/backups/` (max 30, at most one per 6h). `data/` is gitignored and must
  stay that way. Set `CASH_DATA_DIR` to point a test instance somewhere else;
  `CASH_PORT` moves it off 4173.
- Launchers: `CASH.vbs` (what the desktop shortcut targets) runs
  `Start-CASH.bat` with a hidden window; `Start-CASH.bat` only serves the
  existing `dist/`, so it starts instantly and needs no interaction. Building
  belongs to `Install-CASH.bat` / `Update-CASH.bat`. `Stop-CASH.bat` kills
  whatever is listening on 4173. Never use `timeout` in these scripts — it
  fails under redirected input; use `ping -n`.
- Linux has the same set: `install.sh`, `start.sh`, `stop.sh`, `update.sh`,
  shared helpers in `cash-common.sh`, and an XDG entry from `cash.desktop.in`.
  `.gitattributes` pins LF for `.sh` and CRLF for `.bat`/`.vbs`/`.ps1`; don't
  let an editor renormalise them.
- Version: `package.json` `version` is the single source of truth. Vite injects
  it as `__APP_VERSION__`; read it via `src/version.js`. It shows in the page
  footer, the Backup & data panel, the launcher banner, and is stamped into
  exported backups as `appVersion`. To release, bump `package.json`, run
  `npm install --package-lock-only` (CI's `npm ci` fails on a stale lockfile),
  and commit both.
  This is separate from `SCHEMA_VERSION` in storage.js, which versions the data
  shape — bump that only when the stored ledger structure changes.
- The service worker (`public/sw.js`) precaches the app shell and is
  cache-first for hashed assets, and must never intercept `/api/`. It once
  did: a cached `GET /api/ledger` meant a reload showed a stale ledger and the
  save-on-change effect wrote it back over the real file. `storage.js` also
  appends a unique query to every API read (`fresh`) so a worker from before
  the exclusion cannot serve one from cache during the update hand-over.
- Persistence spans `server.js` and `src/storage.js`, and is deliberately
  defensive: this is the only copy of the ledger. The server writes to a temp
  file and renames, so a crash mid-write leaves the previous ledger intact, and
  it refuses a `PUT` whose body will not parse. On the client a failed or
  corrupt read is reported rather than swallowed (`loadLedger` returns `ok:
  false`), and the caller then refuses to auto-save so the original bytes
  survive; unreadable data is quarantined under a `cash-recovery-*` key. A
  pre-server ledger in `localStorage` (`budget-book-v1`) is migrated out once on
  first load. Don't reintroduce a bare `localStorage.setItem` for ledger data.
- App entry: `src/main.jsx` → `src/BudgetBook.jsx` (state + orchestration).
  Tabs live in `src/*Tab.jsx`; shared pieces in `ui.jsx`, `theme.js` (CSS-var
  tokens; charts use concrete per-theme colors from `CHART`), `constants.js`,
  `utils.js` (pure helpers incl. rollover math), `csv.js` (bank import).
- Navigation is four destinations: Overview, Bills, Transactions, More.
  Accounts, budgets, goals, and the year view sit behind More (`MoreTab.jsx`
  owns the menu, the section list, and the back header). More stays lit while
  you are inside one of its sections.
- Empty states take an optional action (`Empty` in `ui.jsx`) and should always
  have one — an empty state with no way forward is a dead end. Where the add
  form is already on screen above it, `focusField` puts the caret in the first
  field; it focuses before scrolling, because the other order cancels the
  in-flight smooth scroll and strands the field off-screen.
- Recurring bills and expected income (`BillsTab.jsx`) are added once and
  auto-pay/auto-receive on their due day thereafter — `isAutoPayDue` in
  `utils.js` is the shared eligibility rule (never the future, never before
  the item existed, never re-applied after the user undoes it), fed a
  `dueDay`/`payDay` under the same name so one function serves both. Each
  side tracks its own per-month skip map (`autoPaySkip` / `incomeAutoPaySkip`)
  so an undone auto-payment stays undone until the next month, not forever.
  `RecurringEditRow`'s `kind` prop ("bill" | "income") picks which extra
  fields show — a bill can vary or track a loan payoff; income instead carries
  an optional `gross` figure, shown next to the take-home amount but never fed
  into a transaction, and a pay `schedule`.
- Income `amount` is always per paycheck. `schedule` is monthly (`payDay`),
  semimonthly (`payDay`+`payDay2`), or biweekly/weekly (`anchor`, one known
  pay date that `payDatesInMonth` steps from in UTC — it can land three times
  in a month, and 26 a year is not 24). `monthlyEquivalent`/`annualEquivalent`
  scale it for planning; `incomePaid` and `incomeAutoPaySkip` are keyed per
  occurrence as `id:date` (`payKey`), with a bare `id` from before schedules
  honoured for the first date. "Enter annual" divides by paychecks-per-year,
  but keeps the typed figure (`annualAmount`/`annualGross`) so the household
  summary reads back exactly what was entered; editing the amount afterward
  clears both, since they'd otherwise go stale.
- `leftToBudget` (Budgets tab) is take-home minus commitments, where a
  category with both a budget and bills counts the larger once: a bill's
  payment lands in its category, so a limit below its bills is a limit that
  will be blown, not extra spending on top.
- `monthOutlook` feeds the "This month" card at the top of Overview: overdue
  and due-within-7-days bills (reaching into next month when the horizon
  crosses it), paychecks this month not yet received, and the left-to-budget
  figure. It is only rendered for the current month — "due in 7 days" means
  nothing when you are looking at March. Paid/received uses the same
  live-transaction rule as the Bills tab, so deleting a payment brings the
  bill back here too.
- Theming: `data-theme` on `<html>` is one of light/dark/midnight/contrast;
  the stored preference may also be `auto`, resolved from `prefers-color-scheme`
  and kept live via a media-query listener. Accent is applied separately as an
  inline custom property (`applyAccent` in theme.js) so themes and accents
  compose without a CSS block per combination. `--pos`/`--neg` are semantic and
  must never follow the accent. Accent/ink pairs are chosen to clear WCAG AA.
- Tokens are CSS variables
  in `index.css`, surfaced as `T.*` in theme.js. Visual language is flat and
  modern: one accent (lime, sampled from the logo artwork), Inter only, hairline
  borders, 16px radii, tight tracking on large numerals. No display serif,
  textures, or gradients.
- Chart colors live in `CHART.light/.dark/.midnight/.contrast` in theme.js —
  each set is validated for colorblind separation against its own surface.
  Re-run the dataviz `validate_palette.js` six checks before changing any of
  them.
- Dev server: `npm run dev` (Vite, port 5173) has no `/api/ledger` behind it;
  to exercise real persistence run `npm run build && npm run serve` (port 4173).
  Tests: `npm test` (vitest, jsdom); `release/` is excluded so staged copies of
  the test files are not collected twice.
- Two layers of tests. `utils.test.js`/`storage.test.js`/`csv.test.js` cover
  the pure rules. `*.test.jsx` render real components with Testing Library:
  `AddEntry` and `BillsTab` in isolation, and `BudgetBook` end to end through
  the real storage layer with only `fetch` stood in for the server. The
  BudgetBook tests exist because the two worst shipped bugs — a crash opening
  Backup & data, and a reload writing a stale ledger over the file — both
  passed a suite that only tested pure functions; they pin "load then write
  back unchanged", the backup panel opening, and both reconnect paths.
  `src/test/setup.js` stubs the browser APIs jsdom lacks (matchMedia,
  ResizeObserver, scrollIntoView, localStorage); add to it rather than
  mocking inside a test.
- Releases: `./make-release.sh` stages the tree, aborts if anything
  ledger-shaped got in, and writes a zip plus a Linux tarball into `release/`.
- CI (`.github/workflows/ci.yml`) only runs `npm ci`, `npm test`, and
  `npm run build`. CASH runs locally, so there is no deploy step.

## Repository

- Remote: https://github.com/rhc52980/CASH_Budget_Tracker
- Local `main` tracks `origin/main`.

## Conventions

- `.claude/` is gitignored — machine-local editor and tooling settings.
- Commit messages: short imperative subject line, no attribution trailers.
- Never commit anything from `data/`, and never put real ledger figures into
  code, tests, or fixtures.
