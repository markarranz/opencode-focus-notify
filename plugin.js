// opencode-focus-notify — Desktop notifications that focus the correct terminal.
//
// Install:
//   1. Copy this file to ~/.config/opencode/plugins/opencode-focus-notify.js
//   2. Set NOTIFY_HOOK_SCRIPT to the path of notify.sh (default: ~/.local/bin/opencode-focus-notify)

export const plugin = async ({ $ }) => {
  const notify_hook_script =
    process.env.NOTIFY_HOOK_SCRIPT ||
    `${process.env.HOME || ""}/.local/bin/opencode-focus-notify`

  const sanitize = (value, pattern) => {
    if (!value) return ""
    return pattern.test(value) ? value : ""
  }

  const build_payload = (title, message) => {
    const payload = { title, message }

    const kitty_window_id = sanitize(process.env.KITTY_WINDOW_ID, /^\d+$/)
    const kitty_listen_on = sanitize(
      process.env.KITTY_LISTEN_ON,
      /^[A-Za-z0-9:/@._-]+$/,
    )

    if (kitty_window_id) payload.kitty_window_id = kitty_window_id
    if (kitty_listen_on) payload.kitty_listen_on = kitty_listen_on

    return payload
  }

  const notify = async (title, message) => {
    const payload_json = JSON.stringify(build_payload(title, message))
    await $`sh ${notify_hook_script} ${payload_json} >/dev/null 2>&1`.nothrow()
  }

  return {
    event: async ({ event }) => {
      try {
        if (
          event.type === "session.status" &&
          event.properties?.status === "idle"
        ) {
          await notify("OpenCode", "Session complete")
        }


        if (event.type === "session.error") {
          await notify("OpenCode", "Session error")
        }

        if (event.type === "permission.request") {
          await notify("OpenCode", "Permission requested")
        }
      } catch {
        // Event dispatch is fire-and-forget; errors must not propagate.
      }
    },
  }
}
