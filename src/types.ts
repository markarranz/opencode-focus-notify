/**
 * Payload built by the TypeScript plugin and sent to terminal-notifier.
 */
export interface NotificationPayload {
  title: string
  message: string
  /** Which opencode event triggered this notification */
  eventType: 'idle' | 'error' | 'permission' | 'question'
  /** macOS system sound name */
  sound: string
  /** KITTY_WINDOW_ID env var value — for focused window targeting */
  kittyWindowId?: string
  /** KITTY_LISTEN_ON env var value — socket path for kitten @ commands */
  kittyListenOn?: string
}

/**
 * Kitty environment context read from process.env at plugin startup.
 */
export interface KittyEnv {
  windowId?: string
  listenOn?: string
}

/**
 * Result of a notification send attempt.
 */
export type NotificationResult =
  | { ok: true }
  | { ok: false; reason: string }
