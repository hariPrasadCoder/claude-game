// UserPromptSubmit hook logic: make sure the game server is up, tell it
// this session is now "working", and open a browser tab unless one seems
// to already be open (recent heartbeat).
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const cfg = require('../config');
const { readHookPayload, httpRequest } = require('./hook-lib');

async function probeServer() {
  for (let i = 0; i < 3; i++) {
    try {
      return await httpRequest('GET', '/api/status', null, 300);
    } catch (_) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  return null;
}

function spawnServer() {
  fs.mkdirSync(cfg.RUN_DIR, { recursive: true });
  const logFd = fs.openSync(cfg.LOG_FILE, 'a');
  try {
    const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
      detached: true,
      stdio: ['ignore', logFd, logFd],
    });
    child.on('error', () => {}); // e.g. EACCES on a locked-down box — not fatal
    child.unref();
  } catch (_) {
    // node itself couldn't be spawned — nothing more we can do from here.
  }
}

// Picks a platform-appropriate "open a URL in the default browser" command.
// Must never throw or crash on a machine that doesn't have one available
// (headless boxes, CI, minimal containers) — the server still runs fine,
// the user just has to open the URL manually.
function openBrowser() {
  const url = `http://${cfg.HOST}:${cfg.PORT}/`;
  const [cmd, args] =
    process.platform === 'darwin' ? ['open', [url]] :
    process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url]] :
    ['xdg-open', [url]];
  try {
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
    child.on('error', () => {}); // no browser opener on this system — not fatal
    child.unref();
  } catch (_) {}
}

async function main() {
  const payload = await readHookPayload();
  const sessionId = payload.session_id || 'unknown-session';

  // Probe first, before we announce this event, so lastHeartbeatAt still
  // reflects whether a tab was already open prior to this prompt.
  let status = await probeServer();
  if (!status) {
    spawnServer();
    await new Promise((r) => setTimeout(r, 250));
    status = await probeServer();
  }

  await httpRequest('POST', '/api/event', { sessionId, event: 'prompt-submit' }, 500).catch(() => {});

  const heartbeatAge = status && status.lastHeartbeatAt ? Date.now() - status.lastHeartbeatAt : Infinity;
  if (heartbeatAge > cfg.HEARTBEAT_STALE_MS) {
    openBrowser();
  }
}

main()
  .catch(() => {})
  .finally(() => process.exit(0));
