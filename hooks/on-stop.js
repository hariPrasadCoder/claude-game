// Stop hook logic: tell the server this session is done. Never spawns the
// server — if it's not running, there's nothing to tell.
'use strict';

const { readHookPayload, httpRequest } = require('./hook-lib');

async function main() {
  const payload = await readHookPayload();
  const sessionId = payload.session_id || 'unknown-session';
  await httpRequest('POST', '/api/event', { sessionId, event: 'stop' }, 500).catch(() => {});
}

main()
  .catch(() => {})
  .finally(() => process.exit(0));
