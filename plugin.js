import { dirname, join } from "path"
import { fileURLToPath } from "url"

// opencode-focus-notify — Desktop notifications that focus the correct terminal.
// https://github.com/markarranz/opencode-focus-notify

export const plugin = async ({ $ }) => {
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const notify_hook_script =
    process.env.NOTIFY_HOOK_SCRIPT || join(__dirname, "notify.sh")
  const notify_permission_replied =
    process.env.NOTIFY_PERMISSION_REPLIED === "1"

  const is_idle_event = (event) => {
    if (event.type === "session.idle") return true
    if (event.type !== "session.status") return false

    const status = event.properties?.status
    return status === "idle" || status?.type === "idle"
  }

  const is_permission_event = (event) => {
    return (
      event.type === "permission.request" ||
      event.type === "permission.asked" ||
      event.type === "permission.updated" ||
      (event.type === "permission.replied" && notify_permission_replied)
    )
  }

  const sanitize = (value, pattern) => {
    if (!value) return ""
    return pattern.test(value) ? value : ""
  }

  const build_payload = (title, message, metadata = {}) => {
    const payload = { title, message }

    const kitty_window_id = sanitize(process.env.KITTY_WINDOW_ID, /^\d+$/)
    const kitty_listen_on = sanitize(
      process.env.KITTY_LISTEN_ON,
      /^[A-Za-z0-9:/@._-]+$/,
    )

    if (kitty_window_id) payload.kitty_window_id = kitty_window_id
    if (kitty_listen_on) payload.kitty_listen_on = kitty_listen_on
    if (metadata.session_path) payload.session_path = metadata.session_path
    if (metadata.session_id) payload.session_id = metadata.session_id
    if (metadata.event_type) payload.event_type = metadata.event_type

    return payload
  }

  const notify = async (title, message, metadata) => {
    const payload_json = JSON.stringify(build_payload(title, message, metadata))
    await $`sh ${notify_hook_script} ${payload_json} >/dev/null 2>&1`.nothrow()
  }

  return {
    event: async ({ event }) => {
      try {
        if (is_idle_event(event)) {
          await notify("OpenCode", "Session complete", {
            session_path: event.properties?.path,
            session_id: event.properties?.sessionID,
            event_type: event.type,
          })
        }


        if (event.type === "session.error") {
          await notify("OpenCode", "Session error", {
            session_path: event.properties?.path,
            session_id: event.properties?.sessionID,
            event_type: event.type,
          })
        }

        if (is_permission_event(event)) {
          const permission_message =
            event.type === "permission.replied"
              ? "Permission answered"
              : "Permission requested"

          await notify("OpenCode", permission_message, {
            session_path: event.properties?.path,
            session_id: event.properties?.sessionID,
            event_type: event.type,
          })
        }
      } catch (error) {
        if (process.env.NOTIFY_DEBUG === "1") {
          console.error("opencode-focus-notify error:", error)
        }
      }
    },
  }
}
