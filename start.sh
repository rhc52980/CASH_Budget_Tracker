#!/usr/bin/env bash
# Serves the already-built app. install.sh / update.sh do the building, so this
# starts in about a second. Runs the server in the background and returns.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=cash-common.sh
. "$HERE/cash-common.sh"
cd "$HERE"

cash_need_node || exit 1

# Already up? Just show it. Clicking the icon should mean "open CASH".
if cash_is_running; then
  echo "CASH is already running - opening it."
  cash_open_browser
  exit 0
fi

if [ ! -d node_modules ] || [ ! -f dist/index.html ]; then
  echo "CASH has not been set up in this folder yet. Run ./install.sh first."
  exit 1
fi

# server.js binds this port only and refuses to move: the ledger file is
# reached through this address, so a fallback port would look empty.
mkdir -p "$HERE/logs"
CASH_PORT="$CASH_PORT" nohup node server.js >"$HERE/logs/server.log" 2>&1 &

for _ in $(seq 1 40); do
  if cash_is_running; then
    echo "CASH is running at http://localhost:${CASH_PORT}"
    cash_open_browser
    exit 0
  fi
  sleep 0.25
done

echo "CASH did not come up. Last lines of logs/server.log:"
tail -n 15 "$HERE/logs/server.log" || true
exit 1
