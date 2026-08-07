#!/bin/sh
# Claude Code Notification hook: Claude is blocked on you — a permission
# prompt, an AskUserQuestion-style question, or an idle nudge. Marks the
# session "waiting" so status doesn't misleadingly say "working" while
# it's actually just sitting there. Always exits 0.
DIR="$(cd "$(dirname "$0")" && pwd)"
. "$DIR/common-env.sh"
"$NODE_BIN" "$DIR/on-notification.js"
exit 0
