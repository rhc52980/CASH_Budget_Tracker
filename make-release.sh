#!/usr/bin/env bash
# Builds the release archives, and refuses to produce one that contains
# personal data. Run from the project folder:  ./make-release.sh [outdir]
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${1:-$HERE/release}"
VER=$(cd "$HERE" && node -p "require('./package.json').version")
STAGE="$OUT/CASH_Budget_Tracker"

rm -rf "$STAGE" "$OUT/CASH-v$VER.zip" "$OUT/CASH-v$VER-linux.tar.gz"
mkdir -p "$STAGE"

# Everything that is rebuilt, personal, or machine-local stays out. data/ is
# the important one: it holds the ledger and its backups. ARCHITECTURE.md is
# developer notes, not something a download needs.
tar --exclude=./node_modules \
    --exclude=./ARCHITECTURE.md \
    --exclude=./dist \
    --exclude=./.git \
    --exclude=./.vite \
    --exclude=./data \
    --exclude=./logs \
    --exclude=./release \
    --exclude='./*.log' \
    --exclude=./update-log.txt \
    -cf - -C "$HERE" . | tar -xf - -C "$STAGE"

chmod +x "$STAGE"/*.sh

# --- refuse to ship anything that looks like someone's ledger -------------
fail() { echo "RELEASE ABORTED: $1" >&2; exit 1; }

[ -e "$STAGE/data" ]           && fail "data/ made it into the staging folder"
[ -e "$STAGE/logs" ]           && fail "logs/ made it into the staging folder"
[ -e "$STAGE/update-log.txt" ] && fail "update-log.txt made it into the staging folder"
[ -e "$STAGE/ARCHITECTURE.md" ] && fail "ARCHITECTURE.md made it into the staging folder"

if find "$STAGE" -name 'ledger*.json' -o -name '*ledger*.json' | grep -q .; then
  fail "a ledger file is in the staging folder"
fi

# A shipped file should never contain a transactions array with entries in it.
while IFS= read -r f; do
  if node -e '
    const fs=require("fs");
    try {
      const d=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
      if (Array.isArray(d.transactions) && d.transactions.length) process.exit(1);
      if (Array.isArray(d.bills) && d.bills.length) process.exit(1);
    } catch {}
    process.exit(0);
  ' "$f"; then :; else
    fail "$f looks like it contains ledger entries"
  fi
done < <(find "$STAGE" -name '*.json' -not -path '*/node_modules/*')

echo "guard: no ledger data in the staging folder"

mkdir -p "$OUT"
tar -czf "$OUT/CASH-v$VER-linux.tar.gz" -C "$OUT" CASH_Budget_Tracker
if command -v powershell.exe >/dev/null 2>&1; then
  powershell.exe -NoProfile -Command \
    "Compress-Archive -Path '$(cygpath -w "$STAGE")\\*' -DestinationPath '$(cygpath -w "$OUT")\\CASH-v$VER.zip' -CompressionLevel Optimal -Force" >/dev/null
elif command -v zip >/dev/null 2>&1; then
  (cd "$STAGE" && zip -qr "$OUT/CASH-v$VER.zip" .)
fi

echo
echo "built in $OUT:"
ls -1shd "$OUT"/CASH-v$VER* | sed 's/^/  /'
echo "  files staged: $(find "$STAGE" -type f | wc -l)"
