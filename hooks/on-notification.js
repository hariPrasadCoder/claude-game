// Notification hook logic: tell the server this session is blocked
// waiting on the user (permission prompt / AskUserQuestion / idle
// nudge — see the matcher in install.js for exactly which notification
// types trigger this). Never spawns the server — if it's not running,
// there's no status to correct.
'use strict';

const { readHookPayload, httpRequest } = require('./hook-lib');

async function main() {
  const payload = await readHookPayload();
  const sessionId = payload.session_id || 'unknown-session';
  await httpRequest('POST', '/api/event', { sessionId, event: 'notification' }, 500).catch(() => {});
}

main()
  .catch(() => {})
  .finally(() => process.exit(0));
