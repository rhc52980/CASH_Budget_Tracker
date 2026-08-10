# CASH — Count All Spending Habits

Personal budgeting ledger. Track income and expenses by month, check off
monthly bills, set per-category budgets, and fund savings goals.

Your data stays in your browser — no account, no server, nothing uploaded.

CASH runs on your own machine. Nothing is hosted, nothing is uploaded, and
there is no account.

## Getting started on Windows

1. Install [Node.js](https://nodejs.org) — download the **LTS** installer and
   accept the defaults. You only do this once.
2. Double-click **`Install-CASH.bat`**.

That downloads what the app needs, builds it, and puts a CASH icon on your
desktop. It only has to be run once.

| Double-click | What it does |
| --- | --- |
| `Install-CASH.bat` | First-time setup. Run once. |
| **desktop icon** / `CASH.vbs` | Starts CASH silently — no window. |
| `Stop-CASH.bat` | Shuts CASH down. |
| `Update-CASH.bat` | Fetches the newest version and rebuilds. |
| `Start-CASH.bat` | Same as the icon, but shows a window. Useful if something breaks. |
| `Create-Shortcut.bat` | Re-creates the desktop icon if you move the folder. |

Using the desktop icon, CASH starts in the background with no console window and
your browser opens at <http://localhost:4173>. It keeps running until you run
`Stop-CASH.bat`, sign out, or restart — closing the browser tab does not stop it,
so you can come back to the tab any time.

CASH always uses **port 4173** deliberately. Browsers store data per web
address, so running it on a different port would show an empty ledger. If the
port is busy the launcher stops with an explanation rather than quietly moving.

Updating never touches your ledger: it lives in your browser, not in these
files. After an update the app may offer a **Refresh** button — click it to load
the new version.

### Install it as a desktop app

With CASH open in Chrome or Edge, click the install icon at the right of the
address bar (a monitor with a downward arrow), or use the ⋮ menu →
*Cast, save, and share* → *Install page as app*. It then lives in your Start
menu and opens in its own window. You still need to run `Start-CASH.bat` first,
because the app is served from your own machine.

## Versioning

The version shown in the bottom-right corner of the app comes from
`package.json`. Bump it there when you make a change worth marking; it flows to
the footer, the Backup & data panel, the launcher banner, and every exported
backup file.

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
