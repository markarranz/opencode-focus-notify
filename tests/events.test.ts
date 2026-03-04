import { describe, test, expect, mock, jest, beforeEach, afterEach } from 'bun:test'
import { isNotifiableEvent, buildPayload, createEventProcessor } from '../src/events'
import type { KittyEnv } from '../src/types'

const emptyKittyEnv: KittyEnv = {}
const richKittyEnv: KittyEnv = { windowId: '42', listenOn: '/tmp/kitty-42.sock' }

// ---------------------------------------------------------------------------
// isNotifiableEvent
// ---------------------------------------------------------------------------

describe('isNotifiableEvent', () => {
  test.each([
    ['session.idle'],
    ['session.error'],
    ['permission.asked'],
    ['question.asked'],
  ])('returns true for %s', (type) => {
    expect(isNotifiableEvent({ type })).toBe(true)
  })

  test.each([
    ['session.busy'],
    ['session.running'],
    ['unknown.event'],
    [''],
  ])('returns false for %s', (type) => {
    expect(isNotifiableEvent({ type })).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// buildPayload
// ---------------------------------------------------------------------------

describe('buildPayload', () => {
  test('session.idle — title, eventType, sound, reads message field', () => {
    const payload = buildPayload(
      { type: 'session.idle', message: 'Task complete' },
      emptyKittyEnv,
    )
    expect(payload.title).toBe('OpenCode')
    expect(payload.eventType).toBe('idle')
    expect(payload.sound).toBe('Glass')
    expect(payload.message).toBe('Task complete')
  })

  test('session.error — title, eventType, sound, reads error field', () => {
    const payload = buildPayload(
      { type: 'session.error', error: 'Something went wrong' },
      emptyKittyEnv,
    )
    expect(payload.title).toBe('OpenCode Error')
    expect(payload.eventType).toBe('error')
    expect(payload.sound).toBe('Sosumi')
    expect(payload.message).toBe('Something went wrong')
  })

  test('permission.asked — title contains "Permission", eventType, sound', () => {
    const payload = buildPayload(
      { type: 'permission.asked', message: 'Allow file write?' },
      emptyKittyEnv,
    )
    expect(payload.title).toContain('Permission')
    expect(payload.eventType).toBe('permission')
    expect(payload.sound).toBe('Tink')
    expect(payload.message).toBe('Allow file write?')
  })

  test('question.asked — title contains "Question", eventType, sound, reads question field', () => {
    const payload = buildPayload(
      { type: 'question.asked', question: 'Proceed with delete?' },
      emptyKittyEnv,
    )
    expect(payload.title).toContain('Question')
    expect(payload.eventType).toBe('question')
    expect(payload.sound).toBe('Pop')
    expect(payload.message).toBe('Proceed with delete?')
  })

  test('kittyEnv windowId and listenOn are forwarded to payload', () => {
    const payload = buildPayload({ type: 'session.idle', message: 'done' }, richKittyEnv)
    expect(payload.kittyWindowId).toBe('42')
    expect(payload.kittyListenOn).toBe('/tmp/kitty-42.sock')
  })

  test('empty kittyEnv — kittyWindowId and kittyListenOn are undefined', () => {
    const payload = buildPayload({ type: 'session.idle', message: 'done' }, emptyKittyEnv)
    expect(payload.kittyWindowId).toBeUndefined()
    expect(payload.kittyListenOn).toBeUndefined()
  })

  test('missing message field for session.idle — falls back to event type string', () => {
    const payload = buildPayload({ type: 'session.idle' }, emptyKittyEnv)
    expect(payload.message).toBe('session.idle')
  })

  test('missing error field for session.error — falls back to event type string', () => {
    const payload = buildPayload({ type: 'session.error' }, emptyKittyEnv)
    expect(payload.message).toBe('session.error')
  })

  test('non-string message field — falls back to event type string', () => {
    const payload = buildPayload({ type: 'session.idle', message: 42 }, emptyKittyEnv)
    expect(payload.message).toBe('session.idle')
  })
})

// ---------------------------------------------------------------------------
// createEventProcessor — MessageAbortedError suppression
// ---------------------------------------------------------------------------

describe('createEventProcessor — MessageAbortedError suppression', () => {
  test('error string containing "MessageAbortedError" → send NOT called', () => {
    const send = mock(() => {})
    const process = createEventProcessor(send, emptyKittyEnv)
    process({ type: 'session.error', error: 'MessageAbortedError: request cancelled' })
    expect(send).not.toHaveBeenCalled()
  })

  test('error string containing "message was aborted" → send NOT called', () => {
    const send = mock(() => {})
    const process = createEventProcessor(send, emptyKittyEnv)
    process({ type: 'session.error', error: 'the message was aborted by the user' })
    expect(send).not.toHaveBeenCalled()
  })

  test('error object with name "MessageAbortedError" → send NOT called', () => {
    const send = mock(() => {})
    const process = createEventProcessor(send, emptyKittyEnv)
    process({ type: 'session.error', error: { name: 'MessageAbortedError' } })
    expect(send).not.toHaveBeenCalled()
  })

  test('session.error with a real error message → send IS called', () => {
    const send = mock(() => {})
    const process = createEventProcessor(send, emptyKittyEnv)
    process({ type: 'session.error', error: 'Network timeout after 30s' })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0].eventType).toBe('error')
    expect(send.mock.calls[0][0].message).toBe('Network timeout after 30s')
  })
})

// ---------------------------------------------------------------------------
// createEventProcessor — debounce (session.idle)
// ---------------------------------------------------------------------------

describe('createEventProcessor — debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('session.idle — send NOT called immediately', () => {
    const send = mock(() => {})
    const process = createEventProcessor(send, emptyKittyEnv)
    process({ type: 'session.idle', message: 'ready' })
    expect(send).not.toHaveBeenCalled()
  })

  test('session.idle — send IS called after 350ms', () => {
    const send = mock(() => {})
    const process = createEventProcessor(send, emptyKittyEnv)
    process({ type: 'session.idle', message: 'ready' })
    jest.advanceTimersByTime(350)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0].eventType).toBe('idle')
    expect(send.mock.calls[0][0].sound).toBe('Glass')
  })

  test('session.idle — NOT called if less than 350ms elapsed', () => {
    const send = mock(() => {})
    const process = createEventProcessor(send, emptyKittyEnv)
    process({ type: 'session.idle', message: 'ready' })
    jest.advanceTimersByTime(349)
    expect(send).not.toHaveBeenCalled()
  })

  test('session.busy after session.idle — cancels pending idle, send NOT called', () => {
    const send = mock(() => {})
    const process = createEventProcessor(send, emptyKittyEnv)
    process({ type: 'session.idle', message: 'ready' })
    process({ type: 'session.busy' })
    jest.advanceTimersByTime(350)
    expect(send).not.toHaveBeenCalled()
  })

  test('session.running after session.idle — cancels pending idle, send NOT called', () => {
    const send = mock(() => {})
    const process = createEventProcessor(send, emptyKittyEnv)
    process({ type: 'session.idle', message: 'ready' })
    process({ type: 'session.running' })
    jest.advanceTimersByTime(350)
    expect(send).not.toHaveBeenCalled()
  })

  test('second session.idle replaces the first debounce timer', () => {
    const send = mock(() => {})
    const process = createEventProcessor(send, emptyKittyEnv)
    process({ type: 'session.idle', message: 'first' })
    jest.advanceTimersByTime(200)
    process({ type: 'session.idle', message: 'second' })
    jest.advanceTimersByTime(350)
    // Only one notification fired, with the second message
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0].message).toBe('second')
  })
})

// ---------------------------------------------------------------------------
// createEventProcessor — immediate events
// ---------------------------------------------------------------------------

describe('createEventProcessor — immediate events', () => {
  test('session.error (non-aborted) → send called immediately', () => {
    const send = mock(() => {})
    const process = createEventProcessor(send, emptyKittyEnv)
    process({ type: 'session.error', error: 'Rate limit exceeded' })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0].eventType).toBe('error')
  })

  test('permission.asked → send called immediately with permission payload', () => {
    const send = mock(() => {})
    const process = createEventProcessor(send, emptyKittyEnv)
    process({ type: 'permission.asked', message: 'Allow shell command?' })
    expect(send).toHaveBeenCalledTimes(1)
    const payload = send.mock.calls[0][0]
    expect(payload.eventType).toBe('permission')
    expect(payload.sound).toBe('Tink')
    expect(payload.message).toBe('Allow shell command?')
  })

  test('question.asked → send called immediately with question payload', () => {
    const send = mock(() => {})
    const process = createEventProcessor(send, emptyKittyEnv)
    process({ type: 'question.asked', question: 'Overwrite existing file?' })
    expect(send).toHaveBeenCalledTimes(1)
    const payload = send.mock.calls[0][0]
    expect(payload.eventType).toBe('question')
    expect(payload.sound).toBe('Pop')
    expect(payload.message).toBe('Overwrite existing file?')
  })

  test('session.busy → send NOT called, no error thrown', () => {
    const send = mock(() => {})
    const process = createEventProcessor(send, emptyKittyEnv)
    expect(() => process({ type: 'session.busy' })).not.toThrow()
    expect(send).not.toHaveBeenCalled()
  })

  test('session.running → send NOT called, no error thrown', () => {
    const send = mock(() => {})
    const process = createEventProcessor(send, emptyKittyEnv)
    expect(() => process({ type: 'session.running' })).not.toThrow()
    expect(send).not.toHaveBeenCalled()
  })

  test('unknown event type → send NOT called', () => {
    const send = mock(() => {})
    const process = createEventProcessor(send, emptyKittyEnv)
    process({ type: 'tool.called' })
    expect(send).not.toHaveBeenCalled()
  })

  test('kittyEnv is forwarded to the payload on immediate send', () => {
    const send = mock(() => {})
    const process = createEventProcessor(send, richKittyEnv)
    process({ type: 'permission.asked', message: 'Confirm?' })
    const payload = send.mock.calls[0][0]
    expect(payload.kittyWindowId).toBe('42')
    expect(payload.kittyListenOn).toBe('/tmp/kitty-42.sock')
  })
})
