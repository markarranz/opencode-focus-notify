import type { NotificationPayload, KittyEnv } from './types.js'

type SupportedEventType = 'session.idle' | 'session.error' | 'permission.asked' | 'question.asked'

interface EventConfig {
  title: string
  messageKey: string
  sound: string
  eventType: NotificationPayload['eventType']
}

const EVENT_CONFIG: Record<SupportedEventType, EventConfig> = {
  'session.idle': {
    title: 'OpenCode',
    messageKey: 'message',
    sound: 'Glass',
    eventType: 'idle',
  },
  'session.error': {
    title: 'OpenCode Error',
    messageKey: 'error',
    sound: 'Sosumi',
    eventType: 'error',
  },
  'permission.asked': {
    title: 'OpenCode — Permission Required',
    messageKey: 'message',
    sound: 'Tink',
    eventType: 'permission',
  },
  'question.asked': {
    title: 'OpenCode — Question',
    messageKey: 'question',
    sound: 'Pop',
    eventType: 'question',
  },
}

export function isNotifiableEvent(
  event: { type: string },
): event is { type: SupportedEventType; [key: string]: unknown } {
  return event.type in EVENT_CONFIG
}

export function buildPayload(
  event: { type: SupportedEventType; [key: string]: unknown },
  kittyEnv: KittyEnv,
): NotificationPayload {
  const config = EVENT_CONFIG[event.type]
  const rawMessage = event[config.messageKey]
  const message = typeof rawMessage === 'string' ? rawMessage : event.type

  return {
    title: config.title,
    message,
    eventType: config.eventType,
    sound: config.sound,
    kittyWindowId: kittyEnv.windowId,
    kittyListenOn: kittyEnv.listenOn,
  }
}

function isMessageAbortedError(event: { type: string; [key: string]: unknown }): boolean {
  if (event.type !== 'session.error') return false
  const error = event.error
  if (typeof error === 'string') {
    return error.includes('MessageAbortedError') || error.includes('message was aborted')
  }
  if (error !== null && typeof error === 'object' && 'name' in error) {
    return (error as { name: string }).name === 'MessageAbortedError'
  }
  return false
}

export function createEventProcessor(
  send: (payload: NotificationPayload) => void,
  kittyEnv: KittyEnv,
): (event: { type: string; [key: string]: unknown }) => void {
  let idleTimer: ReturnType<typeof setTimeout> | null = null

  return function processEvent(event: { type: string; [key: string]: unknown }): void {
    if (isMessageAbortedError(event)) return

    if (event.type === 'session.busy' || event.type === 'session.running') {
      if (idleTimer !== null) {
        clearTimeout(idleTimer)
        idleTimer = null
      }
      return
    }

    if (!isNotifiableEvent(event)) return

    if (event.type === 'session.idle') {
      if (idleTimer !== null) clearTimeout(idleTimer)
      idleTimer = setTimeout(() => {
        idleTimer = null
        send(buildPayload(event, kittyEnv))
      }, 350)
      return
    }

    send(buildPayload(event, kittyEnv))
  }
}
