#!/bin/sh
# opencode-focus-notify -- Desktop notifications for OpenCode that focus the correct terminal.
#
# Uses Kitty's OSC 99 protocol. Clicking the notification focuses the exact
# originating tab, split, and OS window -- not just the most recent one.
#
# Usage:
#   As an OpenCode plugin (receives JSON via plugin.js):
#     NOTIFY_HOOK_SCRIPT=/path/to/notify.sh
#
#   As a standalone command:
#     ./notify.sh '{"message":"Build done","title":"CI"}'
#
# JSON fields:
#   message          (required)  Notification body text
#   title            (optional)  Notification title (default: $NOTIFY_DEFAULT_TITLE)
#   kitty_window_id  (optional)  Target kitty window ID (default: $KITTY_WINDOW_ID)
#   kitty_listen_on  (optional)  Kitty listen socket (default: $KITTY_LISTEN_ON)

set -eu

: "${NOTIFY_DISABLE:=0}"
: "${NOTIFY_DEFAULT_TITLE:=OpenCode}"
: "${NOTIFY_TITLE_PREFIX:=}"
: "${NOTIFY_DRY_RUN:=0}"

has_cmd() {
	command -v "$1" >/dev/null 2>&1
}

resolve_kitty_bin() {
	if [ -n "${NOTIFY_KITTY_BIN-}" ] && [ -x "$NOTIFY_KITTY_BIN" ]; then
		printf '%s\n' "$NOTIFY_KITTY_BIN"
		return 0
	fi

	kitty_path=$(command -v kitty 2>/dev/null || true)
	if [ -n "$kitty_path" ] && [ -x "$kitty_path" ]; then
		printf '%s\n' "$kitty_path"
		return 0
	fi

	if [ -n "${KITTY_INSTALLATION_DIR-}" ] && [ -x "${KITTY_INSTALLATION_DIR}/kitty" ]; then
		printf '%s\n' "${KITTY_INSTALLATION_DIR}/kitty"
		return 0
	fi

	for candidate in /Applications/kitty.app/Contents/MacOS/kitty /opt/homebrew/bin/kitty /usr/local/bin/kitty; do
		if [ -x "$candidate" ]; then
			printf '%s\n' "$candidate"
			return 0
		fi
	done

	return 1
}

discover_tty_generic() {
	pid=$$
	hops=0

	while [ "$pid" -gt 1 ] && [ "$hops" -lt 50 ]; do
		tty_dev=$(ps -o tty= -p "$pid" 2>/dev/null | tr -d ' ')
		case "$tty_dev" in
		tty*)
			printf '%s\n' "$tty_dev"
			return 0
			;;
		esac

		pid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
		if [ -z "$pid" ]; then
			return 1
		fi
		case "$pid" in
		*[!0-9]*)
			return 1
			;;
		esac

		hops=$((hops + 1))
	done

	return 1
}

extract_json_string_fallback() {
	key=$1
	printf '%s' "$input" |
		sed -n "s/.*\"${key}\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p"
}

if [ "$NOTIFY_DISABLE" = "1" ]; then
	exit 0
fi

if [ -t 0 ]; then
	input="${1-}"
else
	input=$(cat)
	if [ -z "$input" ]; then
		input="${1-}"
	fi
fi

if [ -z "$input" ]; then
	exit 0
fi

msg=''
title="$NOTIFY_DEFAULT_TITLE"
kitty_window_id=''
kitty_listen_on=''

if has_cmd jq; then
	msg=$(printf '%s' "$input" | jq -r '.message // empty')
	title=$(printf '%s' "$input" | jq -r --arg default_title "$NOTIFY_DEFAULT_TITLE" '.title // $default_title')
	kitty_window_id=$(printf '%s' "$input" | jq -r '.kitty_window_id // empty')
	kitty_listen_on=$(printf '%s' "$input" | jq -r '.kitty_listen_on // empty')
else
	msg=$(extract_json_string_fallback message)
	title_fallback=$(extract_json_string_fallback title)
	if [ -n "$title_fallback" ]; then
		title="$title_fallback"
	fi
fi

if [ -z "$kitty_window_id" ] && [ -n "${KITTY_WINDOW_ID-}" ]; then
	kitty_window_id="$KITTY_WINDOW_ID"
fi
if [ -z "$kitty_listen_on" ] && [ -n "${KITTY_LISTEN_ON-}" ]; then
	kitty_listen_on="$KITTY_LISTEN_ON"
fi

case "$kitty_window_id" in
"" | *[!0-9]*)
	kitty_window_id=''
	;;
esac

case "$kitty_listen_on" in
"" | *[!A-Za-z0-9:/@._-]*)
	kitty_listen_on=''
	;;
esac

if [ -z "$msg" ]; then
	exit 0
fi

if [ -n "$NOTIFY_TITLE_PREFIX" ]; then
	title="${NOTIFY_TITLE_PREFIX}${title}"
fi

path_used=''
tty_dev=''

if [ -n "${KITTY_WINDOW_ID-}" ] && [ -n "${KITTY_LISTEN_ON-}" ]; then
	if ! has_cmd jq; then
		exit 0
	fi

	kitty_bin=$(resolve_kitty_bin 2>/dev/null || true)
	if [ -z "$kitty_bin" ]; then
		exit 0
	fi

	if [ -z "$kitty_window_id" ] || [ -z "$kitty_listen_on" ]; then
		exit 0
	fi

	window_pid=$(
		"$kitty_bin" @ --to "$kitty_listen_on" ls 2>/dev/null |
			jq -r --argjson wid "$kitty_window_id" \
				'.[].tabs[].windows[] | select(.id == $wid) | .pid' 2>/dev/null
	)

	if [ -z "$window_pid" ]; then
		if [ "$NOTIFY_DRY_RUN" = "1" ]; then
			path_used='kitty'
			tty_dev='unknown'
		else
			exit 0
		fi
	fi

	if [ -n "$window_pid" ]; then
		tty_dev=$(ps -o tty= -p "$window_pid" 2>/dev/null | tr -d ' ')
	fi
	path_used='kitty'
else
	tty_dev=$(discover_tty_generic 2>/dev/null || true)
	if [ -z "$tty_dev" ]; then
		if [ "$NOTIFY_DRY_RUN" = "1" ]; then
			tty_dev='unknown'
		else
			exit 0
		fi
	fi
	path_used='generic'
fi

if [ "$NOTIFY_DRY_RUN" != "1" ] && { [ -z "$tty_dev" ] || [ "$tty_dev" = "?" ] || [ ! -w "/dev/$tty_dev" ]; }; then
	exit 0
fi

if [ "$NOTIFY_DRY_RUN" = "1" ]; then
	if [ "$path_used" = 'kitty' ]; then
		printf '%s\n' "notify.sh dry-run path=kitty kitty=$kitty_bin tty=/dev/$tty_dev title=$title kitty_window_id=$kitty_window_id message=$msg" >&2
	else
		printf '%s\n' "notify.sh dry-run path=generic tty=/dev/$tty_dev title=$title message=$msg" >&2
	fi
	exit 0
fi

exec >/dev/null 2>&1

notify_id="notify-$$-$(date +%s 2>/dev/null || echo 0)"

printf "\033]99;i=%s:d=1:a=focus:p=title:o=unfocused;%s\033\\" "$notify_id" "$title" >"/dev/$tty_dev"
printf "\033]99;i=%s:d=0:a=focus:p=body;%s\033\\" "$notify_id" "$msg" >"/dev/$tty_dev"

exit 0
