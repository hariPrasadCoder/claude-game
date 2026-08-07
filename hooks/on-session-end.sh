#!/bin/sh
# Claude Code SessionEnd hook: drop this session from the tracked set
# entirely (stronger signal than Stop — the CLI process is exiting).
DIR="$(cd "$(dirname "$0")" && pwd)"
. "$DIR/common-env.sh"
"$NODE_BIN" "$DIR/on-session-end.js"
exit 0
