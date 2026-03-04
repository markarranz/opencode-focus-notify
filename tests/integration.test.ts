import { test, expect } from 'bun:test'
import { existsSync, accessSync, constants } from 'fs'
import { createProcessManager } from '../src/process-manager'
import { createEventProcessor, isNotifiableEvent, buildPayload } from '../src/events'

const terminalNotifierPaths = [
  '/opt/homebrew/bin/terminal-notifier',
  '/usr/local/bin/terminal-notifier',
]

function findTerminalNotifier(): string | null {
  return terminalNotifierPaths.find((path) => existsSync(path)) ?? null
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

test('terminal-notifier exists and is executable', () => {
  const binaryPath = findTerminalNotifier()
  expect(binaryPath).not.toBeNull()

  if (!binaryPath) {
    throw new Error('terminal-notifier not found')
  }

  // throws if not executable
  accessSync(binaryPath, constants.X_OK)
})

// ---------------------------------------------------------------------------
// TypeScript module imports
// ---------------------------------------------------------------------------

test('TypeScript modules import correctly', () => {
  expect(typeof createProcessManager).toBe('function')
  expect(typeof createEventProcessor).toBe('function')
  expect(typeof isNotifiableEvent).toBe('function')
  expect(typeof buildPayload).toBe('function')
})

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

test('process manager spawns terminal-notifier and accepts payload', () => {
  const manager = createProcessManager('net.kovidgoyal.kitty')
  const result = manager.send({
    title: 'Integration Test',
    message: 'Testing process manager',
    eventType: 'idle',
    sound: 'Glass',
    kittyWindowId: '38',
    kittyListenOn: 'unix:/tmp/mykitty-94504',
  })

  expect(result.ok).toBe(true)
  manager.stop()
})
