import { existsSync, writeFileSync, chmodSync } from 'fs'
import { spawn } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import type { NotificationPayload, NotificationResult } from './types.js'

export interface ProcessManager {
  send(payload: NotificationPayload): NotificationResult
  stop(): void
}

function findFirstExistingPath(paths: string[]): string | null {
  return paths.find((path) => existsSync(path)) ?? null
}

function findTerminalNotifier(): string | null {
  return findFirstExistingPath([
    '/opt/homebrew/bin/terminal-notifier',
    '/usr/local/bin/terminal-notifier',
  ])
}

function findKitten(): string | null {
  return findFirstExistingPath([
    '/Applications/kitty.app/Contents/MacOS/kitten',
    '/opt/homebrew/bin/kitten',
    '/usr/local/bin/kitten',
  ])
}

function createFocusScript(kittenPath: string, payload: NotificationPayload): string | null {
  if (!payload.kittyWindowId || !payload.kittyListenOn) return null

  const scriptPath = join(tmpdir(), `opencode-click-${Math.random().toString(36).slice(2)}.sh`)
  const scriptContent = `#!/usr/bin/env bash
echo "$(date '+%Y-%m-%d %H:%M:%S') click: windowId=${payload.kittyWindowId} listenOn=${payload.kittyListenOn}" >> /tmp/opencode-click-exec.log
# Small delay to let macOS finish activating terminal-notifier, then re-take focus
sleep 0.3
/usr/bin/open -a kitty
"${kittenPath}" @ --to "${payload.kittyListenOn}" focus-window --match "id:${payload.kittyWindowId}"
echo "$(date '+%Y-%m-%d %H:%M:%S') exit: $?" >> /tmp/opencode-click-exec.log
rm -- "$0"
`

  writeFileSync(scriptPath, scriptContent)
  chmodSync(scriptPath, 0o700)
  return scriptPath
}

export function createProcessManager(kittyBundleId: string): ProcessManager {
  const notifierPath = findTerminalNotifier()
  const kittenPath = findKitten()

  if (!notifierPath) {
    process.stderr.write('[notifier] terminal-notifier not found in standard locations\n')
  }

  return {
    send(payload: NotificationPayload): NotificationResult {
      if (!notifierPath) return { ok: false, reason: 'terminal-notifier not found' }

      const args = [
        '-title',
        payload.title,
        '-message',
        payload.message,
        '-sound',
        payload.sound,
      ]

      const focusScript = kittenPath ? createFocusScript(kittenPath, payload) : null
      if (focusScript) {
        args.push('-execute', focusScript)
      }

      try {
        const child = spawn(notifierPath, args, {
          stdio: 'ignore',
        })
        child.unref()
        return { ok: true }
      } catch (err) {
        return { ok: false, reason: String(err) }
      }
    },

    stop(): void {
      return
    },
  }
}
