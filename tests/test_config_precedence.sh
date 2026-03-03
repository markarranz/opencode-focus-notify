#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

echo "=== Configuration Precedence Analysis ==="
echo ""

echo "1. NOTIFY_HOOK_SCRIPT precedence (plugin.js line 10)"
echo "   Code: process.env.NOTIFY_HOOK_SCRIPT || join(__dirname, 'notify.sh')"
echo ""
echo "   Test A: With env var set"
NOTIFY_HOOK_SCRIPT=/custom/path node -e "
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const notify_hook_script = process.env.NOTIFY_HOOK_SCRIPT || join(__dirname, 'notify.sh');
console.log('Result:', notify_hook_script);
" 2>&1
echo ""

echo "   Test B: Without env var (falls back to __dirname)"
node -e "
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const notify_hook_script = process.env.NOTIFY_HOOK_SCRIPT || join(__dirname, 'notify.sh');
console.log('Result:', notify_hook_script);
" 2>&1
echo ""

echo "2. KITTY_WINDOW_ID precedence (notify.sh lines 128-133)"
echo "   Priority: JSON payload > env var > empty"
echo ""
echo "   Test A: JSON payload has kitty_window_id"
env -u KITTY_WINDOW_ID -u KITTY_LISTEN_ON NOTIFY_DRY_RUN=1 sh notify.sh '{"message":"test","title":"test","kitty_window_id":"99"}' 2>&1 | grep kitty_window_id
echo ""

echo "   Test B: Env var set, no JSON payload"
env -u KITTY_LISTEN_ON KITTY_WINDOW_ID=88 NOTIFY_DRY_RUN=1 sh notify.sh '{"message":"test","title":"test"}' 2>&1 | grep kitty_window_id
echo ""

echo "   Test C: Both set, JSON takes precedence"
env -u KITTY_LISTEN_ON KITTY_WINDOW_ID=88 NOTIFY_DRY_RUN=1 sh notify.sh '{"message":"test","title":"test","kitty_window_id":"99"}' 2>&1 | grep kitty_window_id
echo ""

echo "3. NOTIFY_DEFAULT_TITLE precedence (notify.sh lines 23, 117)"
echo "   Priority: JSON title > env var > hardcoded 'OpenCode'"
echo ""
echo "   Test A: JSON title"
env -u KITTY_WINDOW_ID -u KITTY_LISTEN_ON NOTIFY_DRY_RUN=1 sh notify.sh '{"message":"test","title":"Custom"}' 2>&1 | grep title
echo ""

echo "   Test B: Env var"
env -u KITTY_WINDOW_ID -u KITTY_LISTEN_ON NOTIFY_DEFAULT_TITLE="EnvTitle" NOTIFY_DRY_RUN=1 sh notify.sh '{"message":"test"}' 2>&1 | grep title
echo ""

echo "   Test C: Default"
env -u KITTY_WINDOW_ID -u KITTY_LISTEN_ON NOTIFY_DRY_RUN=1 sh notify.sh '{"message":"test"}' 2>&1 | grep title
echo ""

echo "4. Path selection logic (notify.sh lines 158-201)"
echo "   Kitty mode: BOTH KITTY_WINDOW_ID AND KITTY_LISTEN_ON must be set"
echo "   Generic mode: fallback if Kitty mode unavailable"
echo ""
echo "   Test A: Only KITTY_WINDOW_ID set (falls back to generic)"
env -u KITTY_LISTEN_ON KITTY_WINDOW_ID=1 NOTIFY_DRY_RUN=1 sh notify.sh '{"message":"test","title":"test"}' 2>&1 | grep path
echo ""

echo "   Test B: Only KITTY_LISTEN_ON set (falls back to generic)"
env -u KITTY_WINDOW_ID KITTY_LISTEN_ON=unix:/tmp/test NOTIFY_DRY_RUN=1 sh notify.sh '{"message":"test","title":"test"}' 2>&1 | grep path
echo ""

echo "   Test C: Both set (uses Kitty mode)"
env KITTY_WINDOW_ID=1 KITTY_LISTEN_ON=unix:/tmp/test NOTIFY_DRY_RUN=1 sh notify.sh '{"message":"test","title":"test"}' 2>&1 | grep path
echo ""
