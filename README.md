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

## Features

- **Overview** — spending-by-category donut, recent entries, and a Trends chart
  with three views (in vs out, net, by category) over 3, 6, or 12 months
- **Bills** — recurring monthly bills with due days; mark them paid each month and the payment is logged as an expense
- **Budgets** — monthly limit per category with progress bars and over-budget warnings
- **Goals** — savings goals you can fund incrementally
- **Transactions** — full monthly ledger with delete
- **Export / Import** — download all data as a JSON backup, or restore from one
