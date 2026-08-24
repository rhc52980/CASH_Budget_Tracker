#!/usr/bin/env bash
# Shared helpers for the Linux scripts. Sourced, not run.

CASH_PORT="${CASH_PORT:-4173}"

# Is something already serving on our port?
cash_is_running() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsS -o /dev/null --max-time 2 "http://localhost:${CASH_PORT}" 2>/dev/null && return 0
  fi
  cash_listener_pid >/dev/null 2>&1
}

# PID listening on CASH_PORT, via whichever tool the distro ships.
cash_listener_pid() {
  local pid=""
  if command -v ss >/dev/null 2>&1; then
    pid=$(ss -lptnH "sport = :${CASH_PORT}" 2>/dev/null | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)
  fi
  if [ -z "$pid" ] && command -v lsof >/dev/null 2>&1; then
    pid=$(lsof -tiTCP:"${CASH_PORT}" -sTCP:LISTEN 2>/dev/null | head -1)
  fi
  if [ -z "$pid" ] && command -v fuser >/dev/null 2>&1; then
    pid=$(fuser "${CASH_PORT}/tcp" 2>/dev/null | tr -d ' ' | head -1)
  fi
  [ -n "$pid" ] || return 1
  printf '%s\n' "$pid"
}

cash_open_browser() {
  local url="http://localhost:${CASH_PORT}"
  if command -v xdg-open >/dev/null 2>&1; then xdg-open "$url" >/dev/null 2>&1 &
  elif command -v gio >/dev/null 2>&1; then gio open "$url" >/dev/null 2>&1 &
  else printf 'Open %s in your browser.\n' "$url"
  fi
}

cash_need_node() {
  if ! command -v node >/dev/null 2>&1; then
    cat <<'MSG'
Node.js is required but was not found.

  Debian/Ubuntu : sudo apt install nodejs npm
  Fedora        : sudo dnf install nodejs npm
  Arch          : sudo pacman -S nodejs npm

Then run this script again.
MSG
    return 1
  fi
}
