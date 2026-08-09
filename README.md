# CASH — Count All Spending Habits

Personal budgeting / ledger app with a "bank passbook" look. Track income and
expenses by month, check off monthly bills, set per-category budgets, and fund
savings goals.

Built with React + Vite, charts by Recharts. Data is stored locally in the
browser (`localStorage`) — no backend, no account.

## Run it

```
npm install
npm run dev
```

Then open http://localhost:5173.

Run `npm test` for the unit tests (CSV parsing, rollover math, date helpers).
Pushes to `main` deploy automatically to GitHub Pages via Actions.

## Features

- **Overview** — spending-by-category donut, recent entries, and a Trends chart
  with three views (in vs out, net, by category) over 3, 6, or 12 months
- **Bills** — recurring monthly bills with due days; mark them paid each month and the payment is logged as an expense
- **Expected income** — recurring paychecks with pay days; mark them received and the income is logged automatically
- **Budgets** — monthly limit per category with progress bars, over-budget warnings,
  and optional rollover that carries unspent budget (or overspending) into the next month
- **Ledger notes** — automatic insights: category spending vs your recent average,
  end-of-month pace projection, largest expense, and savings rate
- **Goals** — savings goals you can fund incrementally
- **Transactions** — full monthly ledger with search, type/category filters, inline editing, and delete
- **Split entries** — divide one receipt across several categories in the add form
- **Export / Import** — download all data as a JSON backup, or restore from one
- **CSV import** — load a bank statement export; columns are auto-detected, categories
  guessed from merchant names, and likely duplicates flagged before anything is saved
- **Year view** — annual totals, net by month, category breakdown, and year notes
- **Custom categories** — add your own expense categories with a color of your choice
- **Dark mode** — banker's-lamp dark theme, toggled from the header and remembered
- **Mobile-first on phones** — bottom tab bar and a floating add button under 640px
- **Backup nudges** — a gentle reminder when your last export is more than 30 days old
- **Installable PWA** — add it to your phone or desktop; works offline (production build)
