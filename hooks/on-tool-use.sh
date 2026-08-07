#!/bin/sh
# Claude Code PreToolUse hook (fires before every tool call): re-marks
# this session as "working". This is what catches Claude resuming work
# without a fresh UserPromptSubmit — e.g. after a background subagent
# finishes, a scheduled wake-up, or a task notification — cases where the
# Stop hook already fired once (marking the session "done") but Claude is
# now actively working again.
#
# Deliberately plain curl instead of node here: this fires on *every*
# tool call, so it needs to add ~nothing to each one. The request is
# backgrounded and detached — this script returns immediately without
# waiting on the network round trip, and if curl isn't available it just
# no-ops (the UserPromptSubmit/Stop hooks still work fine on their own,
# this is a supplementary resync signal, not the primary one).
# Always exits 0 — never block or slow down a tool call.

IN="$(cat)"
SESSION_ID=$(printf '%s' "$IN" | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
[ -n "$SESSION_ID" ] || SESSION_ID="unknown-session"

if command -v curl >/dev/null 2>&1; then
  ( curl -s -m 1 -X POST "http://127.0.0.1:47821/api/event" \
      -H 'Content-Type: application/json' \
      -d "{\"sessionId\":\"$SESSION_ID\",\"event\":\"prompt-submit\"}" \
      >/dev/null 2>&1 & )
fi

exit 0
