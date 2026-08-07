// Tiny local game server. No dependencies — just `http`/`fs`/`path`.
//
// Owns all shared state (which Claude Code sessions are "working", when a
// browser tab last said hello) so hook scripts never need to read/write
// state.json themselves and race each other.
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile, spawn } = require('child_process');
const cfg = require('./config');

const REPO_URL_SPEC = 'github:hariPrasadCoder/claude-game';

// ---------------------------------------------------------------------
// State
// ---------------------------------------------------------------------

const sessions = new Map(); // sessionId -> { lastEventAt, state: "working"|"waiting"|"done" }
const startedAt = Date.now();
// null means "no browser tab has ever sent a heartbeat" — deliberately
// NOT initialized to startedAt. If it were, a freshly spawned server
// would look like it just had a tab open (heartbeat age ~0), which
// tricks on-prompt-submit.js's "is a tab already open?" check into
// skipping the browser open on the very first prompt — exactly the one
// time we most need it to open.
let lastHeartbeatAt = null;

function gcStaleSessions() {
  const now = Date.now();
  for (const [id, s] of sessions) {
    const staleAfterMs = s.state === 'working' ? cfg.WORKING_STALE_MS : cfg.STALE_SESSION_MS;
    if (now - s.lastEventAt > staleAfterMs) sessions.delete(id);
  }
}

function deriveStatus() {
  gcStaleSessions();
  const states = [...sessions.values()].map((s) => s.state);
  if (states.includes('working')) return 'working';
  // "waiting" (Claude blocked on a permission prompt, AskUserQuestion, or
  // an idle nudge) takes priority over "done" — if any session needs you,
  // that's more actionable than "everything's finished".
  if (states.includes('waiting')) return 'waiting';
  if (states.length > 0) return 'done';
  return 'idle';
}

function snapshotState() {
  const snapshot = {
    status: deriveStatus(),
    sessionCount: sessions.size,
    lastHeartbeatAt,
    serverStartedAt: startedAt,
  };
  fs.writeFile(cfg.STATE_FILE, JSON.stringify(snapshot, null, 2), () => {});
}

// ---------------------------------------------------------------------
// Static file serving
// ---------------------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
};

function serveStatic(req, res, urlPath) {
  let rel = urlPath === '/' ? '/index.html' : urlPath;
  rel = rel.split('?')[0];
  const filePath = path.normalize(path.join(cfg.PUBLIC_DIR, rel));

  // Guard against path traversal outside public/.
  if (!filePath.startsWith(cfg.PUBLIC_DIR)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// ---------------------------------------------------------------------
// API
// ---------------------------------------------------------------------

function readJsonBody(req, cb) {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > 1e5) req.destroy(); // guard against absurd bodies
  });
  req.on('end', () => {
    try {
      cb(null, body ? JSON.parse(body) : {});
    } catch (e) {
      cb(e);
    }
  });
}

function handleStatus(req, res) {
  const payload = {
    status: deriveStatus(),
    sessionCount: sessions.size,
    lastHeartbeatAt,
  };
  res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(payload));
}

function handleHeartbeat(req, res) {
  lastHeartbeatAt = Date.now();
  res.writeHead(204).end();
}

function handleEvent(req, res) {
  readJsonBody(req, (err, data) => {
    if (err || !data || !data.sessionId || !data.event) {
      res.writeHead(400, { 'Content-Type': 'application/json' }).end('{"error":"bad request"}');
      return;
    }
    const now = Date.now();
    switch (data.event) {
      case 'prompt-submit':
        sessions.set(data.sessionId, { lastEventAt: now, state: 'working' });
        break;
      case 'stop':
        sessions.set(data.sessionId, { lastEventAt: now, state: 'done' });
        break;
      case 'notification':
        // Claude hit a permission prompt, an AskUserQuestion-style
        // question, or an idle nudge — it's blocked on you, not working.
        sessions.set(data.sessionId, { lastEventAt: now, state: 'waiting' });
        break;
      case 'session-end':
        sessions.delete(data.sessionId);
        break;
      default:
        res.writeHead(400, { 'Content-Type': 'application/json' }).end('{"error":"unknown event"}');
        return;
    }
    snapshotState();
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ status: deriveStatus() }));
  });
}

function handleVersion(req, res) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ version: pkg.version }));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' }).end('{"error":"could not read local version"}');
  }
}

// The one deliberate exception to "nothing leaves your machine" — only
// runs on an explicit click of "update now" in the UI, never automatically.
// Two install shapes, two update mechanisms:
//   - a real git clone (has .git) -> `git pull --ff-only`
//   - the npx-installed stable copy (no .git, see install.js) -> re-run
//     the npx one-liner, which re-fetches and overwrites this same
//     ~/.claude-game/app location it's already running from
function handleSelfUpdate(req, res) {
  const isGitClone = fs.existsSync(path.join(__dirname, '.git'));
  const [cmd, args, timeout] = isGitClone
    ? ['git', ['pull', '--ff-only'], 30_000]
    : ['npx', ['--yes', REPO_URL_SPEC, 'install'], 90_000];

  execFile(cmd, args, { cwd: __dirname, timeout }, (err, stdout, stderr) => {
    if (err) {
      const message = (stderr || err.message || 'update failed').toString().slice(0, 500);
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: false, error: message }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, method: isGitClone ? 'git' : 'npx' }));

    // Give the response time to actually flush to the client before we
    // pull the rug out from under this process. The new code is already
    // on disk at this point — we just need a fresh Node process to load
    // it, since Node caches modules in memory.
    setTimeout(() => {
      server.close(() => {
        try {
          const logFd = fs.openSync(cfg.LOG_FILE, 'a');
          const child = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
            detached: true,
            stdio: ['ignore', logFd, logFd],
          });
          child.on('error', () => {});
          child.unref();
        } catch (_) {
          // Even if respawning fails here, the next UserPromptSubmit hook
          // will spawn a fresh (now-updated) server anyway.
        }
        cleanupAndExit(0);
      });
    }, 200);
  });
}

// ---------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------

const server = http.createServer((req, res) => {
  const url = req.url || '/';
  if (req.method === 'GET' && url.startsWith('/api/status')) return handleStatus(req, res);
  if (req.method === 'GET' && url.startsWith('/api/version')) return handleVersion(req, res);
  if (req.method === 'POST' && url.startsWith('/api/heartbeat')) return handleHeartbeat(req, res);
  if (req.method === 'POST' && url.startsWith('/api/event')) return handleEvent(req, res);
  if (req.method === 'POST' && url.startsWith('/api/self-update')) return handleSelfUpdate(req, res);
  if (req.method === 'GET') return serveStatic(req, res, url);
  res.writeHead(405).end('Method not allowed');
});

function cleanupAndExit(code) {
  try {
    if (fs.existsSync(cfg.PID_FILE) && fs.readFileSync(cfg.PID_FILE, 'utf8').trim() === String(process.pid)) {
      fs.unlinkSync(cfg.PID_FILE);
    }
  } catch (_) {}
  process.exit(code);
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    // Another instance is already serving — expected when hook invocations
    // race to spawn a server. Not a crash, just yield to the existing one.
    console.log(`[claude-game] port ${cfg.PORT} already in use, assuming another instance owns it`);
    process.exit(0);
  }
  console.error('[claude-game] server error', err);
  cleanupAndExit(1);
});

server.listen(cfg.PORT, cfg.HOST, () => {
  fs.mkdirSync(cfg.RUN_DIR, { recursive: true });
  fs.writeFileSync(cfg.PID_FILE, String(process.pid));
  snapshotState();
  console.log(`[claude-game] listening on http://${cfg.HOST}:${cfg.PORT} (pid ${process.pid})`);
});

// Self-reaper: only exit once nobody is working AND no tab has heartbeat in
// a long while. Nothing external ever has to kill this process.
setInterval(() => {
  const status = deriveStatus();
  // If no heartbeat has ever arrived, measure idleness from server start
  // (not from `null`, which would coerce to epoch 0 and make a
  // brand-new server look maximally idle before a tab even had a
  // chance to open).
  const idleFor = Date.now() - (lastHeartbeatAt || startedAt);
  if (status !== 'working' && idleFor > cfg.IDLE_TIMEOUT_MS) {
    console.log('[claude-game] idle timeout reached, shutting down');
    cleanupAndExit(0);
  }
}, cfg.REAPER_INTERVAL_MS).unref();

process.on('SIGTERM', () => cleanupAndExit(0));
process.on('SIGINT', () => cleanupAndExit(0));
