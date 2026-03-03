#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

echo "=== Analyzing all exit paths in notify.sh ==="
echo ""

echo "Exit path 1: NOTIFY_DISABLE=1"
NOTIFY_DISABLE=1 sh notify.sh '{"message":"test","title":"test"}' 2>&1
echo "Exit code: $?"
echo ""

echo "Exit path 2: No input"
echo "" | sh notify.sh 2>&1
echo "Exit code: $?"
echo ""

echo "Exit path 3: Empty message"
sh notify.sh '{"title":"test"}' 2>&1
echo "Exit code: $?"
echo ""

echo "Exit path 4: Invalid JSON (jq parse error)"
sh notify.sh 'invalid-json' 2>&1
echo "Exit code: $?"
echo ""

echo "Exit path 5: Kitty mode but missing jq"
KITTY_WINDOW_ID=1 KITTY_LISTEN_ON=unix:/tmp/test PATH=/usr/bin:/bin sh notify.sh '{"message":"test","title":"test"}' 2>&1
echo "Exit code: $?"
echo ""

echo "Exit path 6: Kitty mode with jq but invalid window ID"
KITTY_WINDOW_ID=invalid KITTY_LISTEN_ON=unix:/tmp/test sh notify.sh '{"message":"test","title":"test"}' 2>&1
echo "Exit code: $?"
echo ""

echo "Exit path 7: Generic mode but no TTY found"
sh notify.sh '{"message":"test","title":"test"}' </dev/null 2>&1
echo "Exit code: $?"
echo ""

echo "Exit path 8: TTY not writable"
sh notify.sh '{"message":"test","title":"test"}' 2>&1 | head -1
echo "Exit code: $?"
