#!/usr/bin/env node
// Wires claude-game's hooks into ~/.claude/settings.json for whoever runs
// this. No dependencies, no network calls — just a careful, idempotent
// JSON merge with a backup first.
//
// Hook commands need a *stable* file path — Claude Code will call that
// exact path forever, on every prompt. That's fine for `git clone` +
// `node install.js`, but `npx github:hariPrasadCoder/claude-game` runs
// from npm's own temp/npx cache, which can be evicted at any time
// (`npm cache clean`, disk pressure, ...) and would silently break the
// hooks. So: if we detect we're running from somewhere ephemeral, copy
// the app to a stable home under ~/.claude-game first, and install hooks
// pointing there instead.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = __dirname;
const STABLE_APP_DIR = path.join(os.homedir(), '.claude-game', 'app');
const SETTINGS_DIR = path.join(os.homedir(), '.claude');
const SETTINGS_FILE = path.join(SETTINGS_DIR, 'settings.json');

const EVENTS = [
  { name: 'UserPromptSubmit', script: 'on-prompt-submit.sh', timeout: 5 },
  // Fires before every tool call — re-marks the session "working" so
  // status doesn't stay stuck on "done" when Claude resumes without a
  // fresh UserPromptSubmit (e.g. after a background subagent finishes).
  // matcher "*" = every tool; timeout kept short since this is hot-path.
  { name: 'PreToolUse', script: 'on-tool-use.sh', matcher: '*', timeout: 3 },
  // Fires when Claude is blocked on you: a permission prompt, an
  // AskUserQuestion-style question, or an idle nudge. Without this,
  // status stays stuck on "working" the whole time you're just staring
  // at an unanswered question.
  { name: 'Notification', script: 'on-notification.sh', matcher: 'permission_prompt|agent_needs_input|idle_prompt', timeout: 5 },
  { name: 'Stop', script: 'on-stop.sh', timeout: 5 },
  { name: 'SessionEnd', script: 'on-session-end.sh', timeout: 5 },
];

function isEphemeralLocation(dir) {
  const normalized = fs.realpathSync(dir);
  const tempRoots = [os.tmpdir(), '/tmp', '/var/folders']
    .filter(Boolean)
    .map((p) => {
      try {
        return fs.realpathSync(p);
      } catch (_) {
        return p;
      }
    });
  return (
    tempRoots.some((root) => normalized.startsWith(root + path.sep)) ||
    // npx (npm), dlx (pnpm), and dlx (yarn) all cache fetched packages
    // under a directory literally named one of these.
    /[/\\](_npx|\.npm[/\\]_npx|\.pnpm-store|_dlx)[/\\]/.test(normalized)
  );
}

// Copies the app (everything needed to run it) into a stable, permanent
// location, skipping .git and other directories that don't matter at
// runtime. Re-running this (e.g. `npx` on a newer commit) just replaces
// the previous copy, so hook commands keep pointing at the same path.
function copyToStableLocation() {
  const SKIP = new Set(['.git', 'node_modules', '.github', '.playwright-mcp']);
  fs.rmSync(STABLE_APP_DIR, { recursive: true, force: true });
  fs.mkdirSync(STABLE_APP_DIR, { recursive: true });
  fs.cpSync(REPO_ROOT, STABLE_APP_DIR, {
    recursive: true,
    filter: (src) => !SKIP.has(path.basename(src)),
  });
}

function resolveInstallRoot() {
  if (!isEphemeralLocation(REPO_ROOT)) return REPO_ROOT;
  console.log(`Running from a temporary location (${REPO_ROOT}).`);
  console.log(`Copying to ${STABLE_APP_DIR} so the hooks keep working after this cache is cleared…`);
  copyToStableLocation();
  return STABLE_APP_DIR;
}

function readSettings() {
  if (!fs.existsSync(SETTINGS_FILE)) return {};
  const raw = fs.readFileSync(SETTINGS_FILE, 'utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error(`✗ ${SETTINGS_FILE} exists but isn't valid JSON — fix it manually before installing.`);
    process.exit(1);
  }
}

function backupSettings() {
  if (!fs.existsSync(SETTINGS_FILE)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${SETTINGS_FILE}.bak-${stamp}`;
  fs.copyFileSync(SETTINGS_FILE, backupPath);
  return backupPath;
}

function hasOurEntry(hookGroupArray, command) {
  return hookGroupArray.some((group) => (group.hooks || []).some((h) => h.command === command));
}

function ensureExecutable(hooksDir) {
  for (const { script } of EVENTS) {
    const p = path.join(hooksDir, script);
    try {
      fs.chmodSync(p, 0o755);
    } catch (e) {
      console.warn(`⚠ couldn't chmod +x ${p}: ${e.message}`);
    }
  }
}

function main() {
  const installRoot = resolveInstallRoot();
  const hooksDir = path.join(installRoot, 'hooks');

  fs.mkdirSync(SETTINGS_DIR, { recursive: true });
  const settings = readSettings();
  const backupPath = backupSettings();

  settings.hooks = settings.hooks || {};
  let added = 0;
  let alreadyPresent = 0;

  for (const { name, script, matcher, timeout } of EVENTS) {
    const command = path.join(hooksDir, script);
    settings.hooks[name] = settings.hooks[name] || [];

    if (hasOurEntry(settings.hooks[name], command)) {
      alreadyPresent++;
      continue;
    }

    const group = { hooks: [{ type: 'command', command, timeout }] };
    if (matcher !== undefined) group.matcher = matcher;
    settings.hooks[name].push(group);
    added++;
  }

  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2) + '\n');
  ensureExecutable(hooksDir);

  console.log(`✓ claude-game hooks installed from ${installRoot}`);
  if (backupPath) console.log(`  (backed up your previous settings to ${backupPath})`);
  if (added) console.log(`  added ${added} hook entr${added === 1 ? 'y' : 'ies'} to ${SETTINGS_FILE}`);
  if (alreadyPresent) console.log(`  ${alreadyPresent} hook entr${alreadyPresent === 1 ? 'y was' : 'ies were'} already installed, left as-is`);
  console.log('\nNext: start a Claude Code session anywhere and submit a prompt — a browser tab should open.');
  console.log('If nothing happens, see the Troubleshooting section in README.md.');
}

main();
