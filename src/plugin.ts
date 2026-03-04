import type { Plugin } from '@opencode-ai/plugin'
import { createEventProcessor } from './events.js'
import { createProcessManager } from './process-manager.js'
import type { KittyEnv } from './types.js'

const KITTY_BUNDLE_ID = 'net.kovidgoyal.kitty'

const kittyEnv: KittyEnv = {
  windowId: process.env.KITTY_WINDOW_ID,
  listenOn: process.env.KITTY_LISTEN_ON,
}

const manager = createProcessManager(KITTY_BUNDLE_ID)

const processEvent = createEventProcessor(
  (payload) => {
    manager.send(payload)
  },
  kittyEnv,
)

const plugin: Plugin = async (_input) => {
  return {
    event: async ({ event }) => {
      processEvent(event as { type: string; [key: string]: unknown })
    },
  }
}

export default plugin
