// Shared constants for server.js and the hook scripts. Single source of
// truth so the port/paths/timeouts never drift between the two sides.
'use strict';

const os = require('os');
const path = require('path');

const RUN_DIR = path.join(os.homedir(), '.claude-game', 'run');

module.exports = {
  PORT: 47821,
  HOST: '127.0.0.1',
  RUN_DIR,
  PID_FILE: path.join(RUN_DIR, 'server.pid'),
  STATE_FILE: path.join(RUN_DIR, 'state.json'),
  LOG_FILE: path.join(RUN_DIR, 'server.log'),
  PUBLIC_DIR: path.join(__dirname, 'public'),

  // How long a browser tab's heartbeat can go quiet before we consider it
  // "closed" and worth re-opening on the next prompt.
  HEARTBEAT_STALE_MS: 6_000,
  // How often the client sends a heartbeat while the tab is open.
  HEARTBEAT_INTERVAL_MS: 3_000,
  // How often the client polls for status changes.
  STATUS_POLL_MS: 1_000,

  // A session (Claude Code prompt/turn) not heard from in this long is
  // treated as abandoned (crash, force-quit) and garbage-collected so it
  // can't wedge the aggregate status at "working" forever.
  STALE_SESSION_MS: 30 * 60 * 1000,
  // The server only shuts itself down once nobody is working AND no tab
  // has sent a heartbeat in this long (i.e. everyone's actually gone).
  IDLE_TIMEOUT_MS: 10 * 60 * 1000,
  // How often the server checks whether it should reap itself.
  REAPER_INTERVAL_MS: 30_000,
};
