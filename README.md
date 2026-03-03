# opencode-focus-notify

Desktop notifications for [OpenCode](https://opencode.ai) that focus the exact terminal tab, split, and OS window when clicked. It uses OSC 99 and works with any terminal that supports the OSC 99 desktop notification protocol, with an enhanced path for Kitty.

## How It Works

When OpenCode completes a task or requires attention, the plugin sends a desktop notification through OSC 99. Clicking the notification asks the terminal to focus the window where OpenCode is running.

The notification engine has two paths:

**Kitty enhanced mode** (when `KITTY_WINDOW_ID` and `KITTY_LISTEN_ON` are set): `notify.sh` resolves the kitty binary, uses `kitty @ ls` to locate the exact Kitty window PID, discovers that window's PTY via `ps -o tty=`, then writes OSC 99 directly to that PTY. This gives precise targeting across tabs, splits, and OS windows.

**Generic mode** (all other OSC 99 terminals): `notify.sh` walks the macOS process tree from the current process upward, discovers a terminal PTY, then writes OSC 99 with `a=focus` to that PTY. The terminal handles click-to-focus behavior natively.

## Requirements

- macOS
- An OSC 99-capable terminal (see [Terminal Compatibility](#terminal-compatibility))

For Kitty enhanced mode (optional):
- Kitty 0.36.0+ with remote control enabled
- `jq` installed (`brew install jq`)

Add to `~/.config/kitty/kitty.conf`:

```conf
allow_remote_control yes
listen_on unix:/tmp/mykitty-{kitty_pid}
```

## Install

1. Copy `notify.sh` to your PATH:

   ```sh
   mkdir -p ~/.local/bin
   cp notify.sh ~/.local/bin/opencode-focus-notify
   chmod +x ~/.local/bin/opencode-focus-notify
   ```

2. Copy `plugin.js` to your OpenCode plugins directory:

   ```sh
   mkdir -p ~/.config/opencode/plugins
   cp plugin.js ~/.config/opencode/plugins/opencode-focus-notify.js
   ```

3. Restart OpenCode.

## Terminal Compatibility

Works with terminals that implement OSC 99 desktop notifications. Click-to-focus (`a=focus`) behavior is provided by each terminal's OSC 99 implementation.

| Terminal | OSC 99 Support | Notes |
|---|---|---|
| Kitty | Yes | Enhanced mode via remote control when Kitty env vars are present |
| foot | Yes | OSC 99 support available |
| VS Code | Yes | OSC 99 support available |
| Contour | Planned | Not yet released |
| Ghostty | In progress | Under active development |

## Known Limitations

**Terminal multiplexers (tmux, screen, Zellij):** Multiplexers can intercept OSC 99 escape sequences before they reach the outer terminal, so notifications may not work when OpenCode runs inside a multiplexer session.

**macOS only:** PTY discovery relies on macOS process and terminal behavior (`ps` with TTY lookup). Linux is not currently supported.

## Notification Events

| Event | Description |
|---|---|
| `session.status` (idle) | OpenCode session became idle |
| `session.error` | Session error occurred |
| `permission.request` | Permission requested |

## Configuration

| Variable | Default | Description |
|---|---|---|
| `NOTIFY_HOOK_SCRIPT` | `~/.local/bin/opencode-focus-notify` | Path to `notify.sh` |
| `NOTIFY_DISABLE` | `0` | Set to `1` to disable notifications |
| `NOTIFY_DRY_RUN` | `0` | Set to `1` to print details without sending notifications |
| `NOTIFY_KITTY_BIN` | Auto-detected | Explicit kitty binary path (Kitty enhanced mode only) |
| `NOTIFY_DEFAULT_TITLE` | `OpenCode` | Title used when payload has no title |
| `NOTIFY_TITLE_PREFIX` | Empty | Prefix prepended to all notification titles |

## Testing

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

MIT - [Mark Arranz](https://github.com/MarkArranz)

```sh
git clone https://github.com/MarkArranz/opencode-focus-notify.git
```
