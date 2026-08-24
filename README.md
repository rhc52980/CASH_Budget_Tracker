# CASH — Count All Spending Habits

Personal budgeting ledger. Track income and expenses by month, check off
monthly bills, set per-category budgets, and fund savings goals.

CASH runs on your own machine. Your data stays in your browser — no account,
no server, nothing uploaded.

## Getting started on Windows

1. Install [Node.js](https://nodejs.org) — download the **LTS** installer and
   accept the defaults. You only do this once.
2. Download this project (green **Code** button → **Download ZIP**) and extract
   it anywhere — Downloads is fine.
3. Double-click **`Install-CASH.bat`**.

It doesn't matter where you extracted it. The installer **copies CASH to
`C:\CASH`**, builds it there, and puts an icon on your desktop. Once it
finishes you can delete the folder you downloaded.

To install somewhere else, pass a path:

```
Install-CASH.bat D:\Apps\CASH
```

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

## Getting started on Linux

1. Install Node.js — `sudo apt install nodejs npm` on Debian/Ubuntu,
   `sudo dnf install nodejs npm` on Fedora, `sudo pacman -S nodejs npm` on Arch.
2. Extract the archive anywhere and run:

```
./install.sh
```

It copies CASH to `~/.local/share/cash`, builds it, installs the icon and adds
CASH to your applications menu. Then delete the folder you downloaded.

| Script | What it does |
| --- | --- |
| `install.sh` | First-time setup. Run once. Takes an optional install path. |
| `start.sh` | Starts CASH in the background and opens it. Same as the menu entry. |
| `stop.sh` | Shuts it down. |
| `update.sh` | Fetches the newest version and rebuilds. |

CASH uses **port 4173** deliberately — browser storage is keyed to the exact
address, so running it elsewhere would show an empty ledger. Set `CASH_PORT` if
you genuinely need a different one, but be aware it is a different ledger.

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

Built with React + Vite; charts by Recharts. CASH is not hosted — pushes to
`main` only run the tests and build. See `CLAUDE.md` for architecture notes.

## Features

- **Overview** — spending-by-category donut, recent entries, and a Trends chart
  with three views (in vs out, net, by category) over 3, 6, or 12 months
- **Bills** — recurring monthly bills with due days; mark them paid each month and
  the payment is logged as an expense. Tick **auto-pay** for bills that leave your
  account on their own — a car loan, rent, a subscription — and CASH logs them for
  you on the due day instead of waiting to be checked off.
- **Loan payoff** — tick **track payoff** on a bill and give it the balance owed
  and interest rate. CASH shows what is left, how many payments remain, and the
  month it clears — interest is charged before principal, so the figures are real
  rather than a plain subtraction.
- **Expected income** — recurring paychecks with pay days; mark them received and the income is logged automatically
- **Budgets** — monthly limit per category with progress bars, over-budget warnings,
  and optional rollover that carries unspent budget (or overspending) into the next month
- **Accounts** — checking, savings, cash, credit cards and loans, each with a live
  balance, plus your net worth. Transfers move money between your own accounts
  without counting as income or spending.
- **Reconcile** — press **Check** on an account, tick off what has appeared on your
  statement and enter the bank's balance. The difference tells you whether anything
  is missing or double-counted.
- **Insights** — category spending vs your recent average, end-of-month pace
  projection, largest expense, and savings rate
- **Goals** — savings goals you can fund incrementally
- **Transactions** — full monthly ledger with search, type/category filters, inline editing, and delete
- **Split entries** — divide one receipt across several categories in the add form
- **Backup & data panel** — export/restore backup files, browse automatic
  local snapshots and roll back to one, and see storage protection status
- **CSV import** — load a bank statement export; columns are auto-detected, categories
  guessed from merchant names, and likely duplicates flagged before anything is saved.
  Corrections are remembered per merchant, so each statement lands better sorted than
  the last — and store numbers are ignored, so KROGER #442 and KROGER #118 count as one shop.
- **Undo** — deletions, restores and imports show an Undo button for a few seconds
- **Year view** — annual totals, net by month, category breakdown, and year notes
- **Custom categories** — add your own expense categories with a color of your choice
- **Appearance** — Light, Dark, Midnight (true black for OLED), High contrast, or
  Follow system, plus seven accent colours (Lime by default, sampled from the
  logo artwork); each theme has its own chart palette validated for colourblind
  separation against that background
- **Mobile-first on phones** — bottom tab bar and a floating add button under 640px
- **Backup nudges** — a gentle reminder when your last export is more than 30 days old
- **Installable PWA** — add it to your phone or desktop; works offline (production build)
