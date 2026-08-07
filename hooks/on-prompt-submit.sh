#!/bin/sh
# Claude Code UserPromptSubmit hook: ensure the game server is running and
# open a browser tab if one doesn't already seem to be open. Always exits 0
# — a non-zero exit here would block and erase the user's prompt.
DIR="$(cd "$(dirname "$0")" && pwd)"
. "$DIR/common-env.sh"
"$NODE_BIN" "$DIR/on-prompt-submit.js"
exit 0
