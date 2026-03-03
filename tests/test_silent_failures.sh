#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

echo "=== Testing Silent Failure Handling (ESM-safe) ==="

run_event() {
	local event_json="$1"
	node -e "
import { plugin } from './plugin.js';
import { spawnSync } from 'node:child_process';

const event = JSON.parse(process.argv[1]);

const $ = (strings, ...values) => ({
  nothrow: async () => {
    const cmd = String.raw({ raw: strings }, ...values);
    return spawnSync('bash', ['-lc', cmd], { stdio: 'ignore' });
  },
});

const p = await plugin({ $ });
await p.event({ event });
console.log('ok');
" "$event_json"
}

echo
echo "Case 1: Invalid hook script still does not crash"
cat >/tmp/bad_notify_hook.sh <<'HOOK'
#!/bin/bash
exit 1
HOOK
chmod +x /tmp/bad_notify_hook.sh
NOTIFY_HOOK_SCRIPT=/tmp/bad_notify_hook.sh run_event '{"type":"session.status","properties":{"status":{"type":"idle"}}}' >/dev/null
echo "PASS"

echo
echo "Case 2: Missing hook script path does not crash"
NOTIFY_HOOK_SCRIPT=/nonexistent/path.sh run_event '{"type":"session.status","properties":{"status":{"type":"idle"}}}' >/dev/null
echo "PASS"

echo
echo "Case 3: Plugin path fallback resolves bundled notify.sh"
node -e "
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const resolved = process.env.NOTIFY_HOOK_SCRIPT || join(__dirname, 'notify.sh');
if (!existsSync(resolved)) {
  console.error('notify.sh not found at', resolved);
  process.exit(1);
}
console.log('PASS');
"

echo
echo "=== Silent failure tests completed ==="
