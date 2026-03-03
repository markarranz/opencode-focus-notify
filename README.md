# opencode-focus-notify

Desktop notifications for [OpenCode](https://opencode.ai) that focus the exact terminal tab, split, and OS window when clicked. It uses OSC 99 and works with any terminal that supports the OSC 99 desktop notification protocol, with an enhanced path for Kitty.

## How It Works

When OpenCode completes a task or requires attention, the plugin sends a desktop notification through OSC 99. Clicking the notification asks the terminal to focus the window where OpenCode is running.

The notification engine has two paths:

**Kitty enhanced mode** (when Kitty IDs are available in payload or env): `notify.sh` resolves the kitty binary, uses `kitty @ ls` to locate the exact Kitty window PID, discovers that window's PTY via `ps -o tty=`, then writes OSC 99 directly to that PTY. It also uses OpenCode session path metadata to remap stale Kitty window IDs when possible. This gives more reliable targeting across tabs, splits, and OS windows.

**Generic mode** (all other OSC 99 terminals): `notify.sh` walks the macOS process tree from the current process upward, discovers a terminal PTY, then writes OSC 99 with `a=focus` to that PTY. The terminal handles click-to-focus behavior natively.

## Requirements

- macOS
- An OSC 99-capable terminal (see [Terminal Compatibility](#terminal-compatibility))
- Works with the [OpenCode CLI](https://opencode.ai), not the desktop application

For Kitty enhanced mode (optional):
- Kitty 0.36.0+ with remote control enabled
- `jq` installed (`brew install jq`)

Add to `~/.config/kitty/kitty.conf`:

```conf
allow_remote_control yes
listen_on unix:/tmp/mykitty-{kitty_pid}
```

> `{kitty_pid}` is a built-in Kitty variable — Kitty replaces it with its own process ID at startup. Use the literal string as shown.

## Install

Add to your `opencode.json`:

```json
{
  "plugins": ["@markarranz/opencode-focus-notify"]
}
```

OpenCode installs the plugin automatically on next launch.

## Terminal Compatibility

Works with terminals that implement OSC 99 desktop notifications. Click-to-focus (`a=focus`) behavior is provided by each terminal's OSC 99 implementation.

| Terminal | OSC 99 Support | Notes |
|---|---|---|
| Kitty | ✅ Full | Enhanced mode via remote control when Kitty env vars are present |
| Ghostty | 🚧 In progress | [PR open](https://github.com/ghostty-org/ghostty/pull/10467), milestone 1.4.0 |
| WezTerm | ❌ No | Not supported — notifications will not be sent |
| Alacritty | ❌ No | Not supported — notifications will not be sent |
| foot | ✅ Full | Since v1.18.0 |
| VS Code | ✅ Full | Integrated terminal, since Feb 2026 |
| Contour | 🚧 Planned | OSC 99 in unreleased v0.6.3 |

## Known Limitations

**Terminal multiplexers (tmux, screen, Zellij):** Multiplexers can intercept OSC 99 escape sequences before they reach the outer terminal, so notifications may not work when OpenCode runs inside a multiplexer session.

**macOS only:** PTY discovery relies on macOS process and terminal behavior (`ps` with TTY lookup). Linux is not currently supported.

## Notification Events

| Event | Description |
|---|---|
| `session.status` (idle) | OpenCode session became idle |
| `session.idle` | Deprecated compatibility event for session idle |
| `session.error` | Session error occurred |
| `permission.asked` | Permission requested |
| `permission.replied` | Permission was answered (optional, only when `NOTIFY_PERMISSION_REPLIED=1`) |

Note: `permission.updated` and `permission.request` are tolerated in code as compatibility fallbacks.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `NOTIFY_HOOK_SCRIPT` | Bundled `notify.sh` | Path to `notify.sh` |
| `NOTIFY_DISABLE` | `0` | Set to `1` to disable notifications |
| `NOTIFY_DRY_RUN` | `0` | Set to `1` to print details without sending notifications |
| `NOTIFY_KITTY_BIN` | Auto-detected | Explicit kitty binary path (Kitty enhanced mode only) |
| `NOTIFY_DEFAULT_TITLE` | `OpenCode` | Title used when payload has no title |
| `NOTIFY_TITLE_PREFIX` | Empty | Prefix prepended to all notification titles |
| `NOTIFY_DEBUG` | `0` | Set to `1` to log plugin errors to stderr |
| `NOTIFY_PERMISSION_REPLIED` | `0` | Set to `1` to notify when a permission request is answered |

When `NOTIFY_DEBUG=1`, `notify.sh` also logs selected Kitty/generic routing decisions to stderr.

## Testing

Run automated plugin event tests:

```sh
npm test
```

These tests verify:
- Idle notifications for `session.status` and `session.idle` compatibility
- `permission.asked` notifications
- Default suppression of `permission.replied`
- Opt-in `permission.replied` notifications when `NOTIFY_PERMISSION_REPLIED=1`

Use dry-run mode to verify payload handling and path selection.

```sh
# Kitty enhanced path dry run:
KITTY_WINDOW_ID=1 KITTY_LISTEN_ON=unix:/tmp/mykitty-XXXXX NOTIFY_DRY_RUN=1 \
  sh ~/.local/bin/opencode-focus-notify '{"message":"Test complete","title":"OpenCode"}'

# Generic OSC 99 path dry run (any OSC 99 terminal):
NOTIFY_DRY_RUN=1 \
  sh ~/.local/bin/opencode-focus-notify '{"message":"Test complete","title":"OpenCode"}'
```

Expected output includes `path=kitty` or `path=generic` and the discovered TTY device.

## License

MIT - [Mark Arranz](https://github.com/markarranz)

```sh
git clone https://github.com/markarranz/opencode-focus-notify.git
```
