#!/usr/bin/env bash
# First-time setup. Run from anywhere - Downloads, a USB stick, wherever the
# ZIP was extracted. Installs CASH under your home directory and adds it to the
# applications menu. Install elsewhere with:  ./install.sh /path/to/dir
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$HERE/cash-common.sh"

DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
TARGET="${1:-$DATA_HOME/cash}"

echo "==============================================="
echo "  CASH - Count All Spending Habits"
echo "  First-time setup"
echo "==============================================="
echo

cash_need_node || exit 1
echo "Node.js $(node -v) found."
echo

# Relocate unless we are already living at the install location.
if [ "$HERE" != "$(cd "$(dirname "$TARGET")" 2>/dev/null && pwd)/$(basename "$TARGET")" ]; then
  echo "Installing CASH to $TARGET"
  echo "  (copying from $HERE)"
  mkdir -p "$TARGET"
  # node_modules and dist are rebuilt below; .git is kept so update.sh can pull
  tar --exclude=./node_modules --exclude=./dist --exclude=./logs \
      -cf - -C "$HERE" . | tar -xf - -C "$TARGET"
  echo "  files copied."
  echo
  echo "Continuing setup in $TARGET ..."
  echo
  exec "$TARGET/install.sh" "$TARGET"
fi

cd "$TARGET"

echo "[1/4] Downloading what the app needs..."
echo "      This takes a minute or two and only happens once."
npm install --no-fund --no-audit
echo

echo "[2/4] Building CASH..."
npm run build
echo

echo "[3/4] Installing the icon..."
for size in 32 64 128 256 512; do
  dir="$DATA_HOME/icons/hicolor/${size}x${size}/apps"
  mkdir -p "$dir"
  [ -f "public/icon-${size}.png" ] && cp "public/icon-${size}.png" "$dir/cash.png"
done
command -v gtk-update-icon-cache >/dev/null 2>&1 &&
  gtk-update-icon-cache -f -t "$DATA_HOME/icons/hicolor" >/dev/null 2>&1 || true
echo "      done."
echo

echo "[4/4] Adding CASH to your applications menu..."
APPS="$DATA_HOME/applications"
mkdir -p "$APPS"
chmod +x "$TARGET"/*.sh
sed "s|@TARGET@|$TARGET|g" "$TARGET/cash.desktop.in" > "$APPS/cash.desktop"
chmod +x "$APPS/cash.desktop"
command -v update-desktop-database >/dev/null 2>&1 &&
  update-desktop-database "$APPS" >/dev/null 2>&1 || true
echo "      done."
echo

VER=$(node -p "require('./package.json').version")
cat <<MSG
===============================================
  Setup complete - CASH v$VER
  Installed at: $TARGET

  Launch it from your applications menu, or run
  $TARGET/start.sh

  Stop it with $TARGET/stop.sh
  Update it with $TARGET/update.sh

  You can now delete the folder you downloaded.

  Your ledger is a file in the CASH folder
  (data/ledger.json). It is not uploaded anywhere,
  and updating the app never touches it.
===============================================
MSG
echo
read -r -p "Start CASH now? [y/N] " reply
case "$reply" in
  [Yy]*) "$TARGET/start.sh" ;;
  *) echo "Start it any time from the applications menu." ;;
esac
