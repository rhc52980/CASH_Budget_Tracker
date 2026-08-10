# CASH — Count All Spending Habits

Personal budgeting ledger. Track income and expenses by month, check off
monthly bills, set per-category budgets, and fund savings goals.

Your data stays in your browser — no account, no server, nothing uploaded.

## Getting started on Windows

1. Install [Node.js](https://nodejs.org) — download the **LTS** installer and
   accept the defaults. You only do this once.
2. Double-click **`Start-CASH.bat`**.

The first run takes a couple of minutes while it downloads what it needs; after
that it starts in a few seconds. A black window opens and your browser goes to
<http://localhost:4173>. **Leave that window open while you use CASH** — closing
it stops the app. Your data is not affected either way.

### Install it as a desktop app

With CASH open in Chrome or Edge, click the install icon at the right of the
address bar (a monitor with a downward arrow), or use the ⋮ menu →
*Cast, save, and share* → *Install page as app*. It then lives in your Start
menu and opens in its own window. You still need to run `Start-CASH.bat` first,
because the app is served from your own machine.

## For developers

```
npm install
npm run dev      # dev server on :5173
npm test         # unit tests
npm run build    # production bundle in dist/
npm run preview  # serve the production build on :4173
```

Built with React + Vite; charts by Recharts. Pushes to `main` deploy to GitHub
Pages via Actions. See `CLAUDE.md` for architecture notes.

## Features

- **Overview** — spending-by-category donut, recent entries, and a Trends chart
  with three views (in vs out, net, by category) over 3, 6, or 12 months
- **Bills** — recurring monthly bills with due days; mark them paid each month and the payment is logged as an expense
- **Expected income** — recurring paychecks with pay days; mark them received and the income is logged automatically
- **Budgets** — monthly limit per category with progress bars, over-budget warnings,
  and optional rollover that carries unspent budget (or overspending) into the next month
- **Insights** — category spending vs your recent average, end-of-month pace
  projection, largest expense, and savings rate
- **Goals** — savings goals you can fund incrementally
- **Transactions** — full monthly ledger with search, type/category filters, inline editing, and delete
- **Split entries** — divide one receipt across several categories in the add form
- **Backup & data panel** — export/restore backup files, browse automatic
  local snapshots and roll back to one, and see storage protection status
- **CSV import** — load a bank statement export; columns are auto-detected, categories
  guessed from merchant names, and likely duplicates flagged before anything is saved
- **Year view** — annual totals, net by month, category breakdown, and year notes
- **Custom categories** — add your own expense categories with a color of your choice
- **Appearance** — Light, Dark, Midnight (true black for OLED), High contrast, or
  Follow system, plus six accent colours (Goat green by default, sampled from the
  logo); each theme has its own chart palette validated for colourblind
  separation against that background
- **Mobile-first on phones** — bottom tab bar and a floating add button under 640px
- **Backup nudges** — a gentle reminder when your last export is more than 30 days old
- **Installable PWA** — add it to your phone or desktop; works offline (production build)
