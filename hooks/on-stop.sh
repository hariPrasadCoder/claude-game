#!/bin/sh
# Claude Code Stop hook: mark this session as done. Never touches the
# server process itself. Always exits 0 — a non-zero exit here traps
# Claude in a stop-loop.
DIR="$(cd "$(dirname "$0")" && pwd)"
. "$DIR/common-env.sh"
"$NODE_BIN" "$DIR/on-stop.js"
exit 0
