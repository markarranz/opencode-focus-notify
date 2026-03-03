#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

echo "=== SCENARIO 1: notify.sh not executable ==="
cp notify.sh notify_test.sh
chmod 644 notify_test.sh
echo "File permissions: $(stat -f '%A' notify_test.sh)"
echo "Attempting to execute..."
sh notify_test.sh '{"message":"Test","title":"Test"}' 2>&1 || echo "Exit code: $?"
rm notify_test.sh

echo ""
echo "=== SCENARIO 2: NOTIFY_HOOK_SCRIPT points to non-existent file ==="
NOTIFY_HOOK_SCRIPT=/nonexistent/path/notify.sh NOTIFY_DRY_RUN=1 sh notify.sh '{"message":"Test","title":"Test"}' 2>&1 || echo "Exit code: $?"

echo ""
echo "=== SCENARIO 3: Missing jq (Kitty path fallback) ==="
KITTY_WINDOW_ID=1 KITTY_LISTEN_ON=unix:/tmp/test PATH=/usr/bin:/bin NOTIFY_DRY_RUN=1 sh notify.sh '{"message":"Test","title":"Test"}' 2>&1 || echo "Exit code: $?"

echo ""
echo "=== SCENARIO 4: Invalid KITTY_WINDOW_ID (non-numeric) ==="
KITTY_WINDOW_ID=invalid KITTY_LISTEN_ON=unix:/tmp/test NOTIFY_DRY_RUN=1 sh notify.sh '{"message":"Test","title":"Test"}' 2>&1 || echo "Exit code: $?"

echo ""
echo "=== SCENARIO 5: NOTIFY_DISABLE=1 (silent exit) ==="
NOTIFY_DISABLE=1 NOTIFY_DRY_RUN=1 sh notify.sh '{"message":"Test","title":"Test"}' 2>&1 || echo "Exit code: $?"

echo ""
echo "=== SCENARIO 6: Empty message (silent exit) ==="
NOTIFY_DRY_RUN=1 sh notify.sh '{"title":"Test"}' 2>&1 || echo "Exit code: $?"

echo ""
echo "=== SCENARIO 7: Invalid JSON (fallback parsing) ==="
NOTIFY_DRY_RUN=1 sh notify.sh 'not-json' 2>&1 || echo "Exit code: $?"

echo ""
echo "=== SCENARIO 8: Plugin path resolution (relative vs absolute) ==="
node tests/test_plugin_path.mjs 2>&1 || echo "Node test failed"
