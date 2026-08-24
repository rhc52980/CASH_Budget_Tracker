#!/usr/bin/env bash
# Stops the CASH server. Your ledger is in your browser and is unaffected.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=cash-common.sh
. "$HERE/cash-common.sh"

if pid=$(cash_listener_pid); then
  kill "$pid" 2>/dev/null || true
  for _ in $(seq 1 20); do
    cash_listener_pid >/dev/null 2>&1 || break
    sleep 0.25
  done
  if cash_listener_pid >/dev/null 2>&1; then
    kill -9 "$pid" 2>/dev/null || true
  fi
  echo "CASH has been stopped."
else
  echo "CASH does not appear to be running."
fi
echo "Your ledger is saved in your browser and is unaffected."
