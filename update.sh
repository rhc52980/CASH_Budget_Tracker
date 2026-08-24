#!/usr/bin/env bash
# Fetches the newest version and rebuilds. Your ledger is untouched.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$HERE/cash-common.sh"
cd "$HERE"
LOG="$HERE/update-log.txt"
: > "$LOG"

echo "==============================================="
echo "  CASH - Update"
echo "==============================================="
echo

cash_need_node || exit 1
OLDVER=$(node -p "require('./package.json').version")
echo "Currently installed: v$OLDVER"
echo
echo "Your ledger lives in your browser, not in this folder,"
echo "so updating cannot affect it."
echo

# CASH holds files open while it runs, which makes npm fail partway through.
echo "[1/4] Stopping CASH if it is running..."
"$HERE/stop.sh" >/dev/null 2>&1 || true
echo "      done."
echo

if [ ! -d .git ]; then
  cat <<'MSG'
-----------------------------------------------
  This copy was not downloaded with git, so it
  cannot update itself automatically.

  To update:
    1. Download the latest archive from
       https://github.com/rhc52980/CASH_Budget_Tracker
    2. Extract it, then run ./install.sh

  Your ledger stays put either way - it is stored
  in your browser, not in these files.
-----------------------------------------------
MSG
  exit 0
fi

if ! command -v git >/dev/null 2>&1; then
  echo "Git is not installed, so this copy cannot pull updates."
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  cat <<'MSG'
-----------------------------------------------
  This folder has local changes, so the update
  was stopped rather than overwriting them.

  If you did not change anything on purpose, run
    git checkout .
  then run this updater again.
-----------------------------------------------
MSG
  exit 1
fi

echo "[2/4] Fetching the latest version..."
if ! git pull --ff-only >>"$LOG" 2>&1; then
  echo "      could not fetch - see update-log.txt"
  echo "      nothing was changed."
  exit 1
fi
echo "      now at: $(git log -1 --format=%s)"
echo

echo "[3/4] Updating dependencies..."
if ! npm install --no-fund --no-audit >>"$LOG" 2>&1; then
  echo "      FAILED - see update-log.txt"; exit 1
fi
echo "      done."
echo

echo "[4/4] Rebuilding the app..."
if ! npm run build >>"$LOG" 2>&1; then
  echo "      FAILED - see update-log.txt"; exit 1
fi
echo "      done."
echo

NEWVER=$(node -p "require('./package.json').version")
echo "==============================================="
if [ "$OLDVER" = "$NEWVER" ]; then
  echo "  Already on the latest version - v$NEWVER"
else
  echo "  Updated: v$OLDVER  to  v$NEWVER"
fi
echo
echo "  A full log is in update-log.txt"
echo "==============================================="
echo
read -r -p "Start CASH now? [y/N] " reply
case "$reply" in
  [Yy]*) "$HERE/start.sh" ;;
  *) echo "Start it any time from the applications menu." ;;
esac
