// SessionEnd hook logic: drop this session from the tracked set entirely.
// Kept intentionally fast — this event's default hook timeout budget is
// tiny, though we override it explicitly in settings.json.
'use strict';

const { readHookPayload, httpRequest } = require('./hook-lib');

async function main() {
  const payload = await readHookPayload();
  const sessionId = payload.session_id || 'unknown-session';
  await httpRequest('POST', '/api/event', { sessionId, event: 'session-end' }, 400).catch(() => {});
}

main()
  .catch(() => {})
  .finally(() => process.exit(0));
