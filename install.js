#!/usr/bin/env node
// Wires claude-game's hooks into ~/.claude/settings.json for whoever runs
// this, from wherever they cloned the repo. No dependencies, no network
// calls — just a careful, idempotent JSON merge with a backup first.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = __dirname;
const HOOKS_DIR = path.join(REPO_ROOT, 'hooks');
const SETTINGS_DIR = path.join(os.homedir(), '.claude');
const SETTINGS_FILE = path.join(SETTINGS_DIR, 'settings.json');

const EVENTS = [
  { name: 'UserPromptSubmit', script: 'on-prompt-submit.sh', timeout: 5 },
  // Fires before every tool call — re-marks the session "working" so
  // status doesn't stay stuck on "done" when Claude resumes without a
  // fresh UserPromptSubmit (e.g. after a background subagent finishes).
  // matcher "*" = every tool; timeout kept short since this is hot-path.
  { name: 'PreToolUse', script: 'on-tool-use.sh', matcher: '*', timeout: 3 },
  { name: 'Stop', script: 'on-stop.sh', timeout: 5 },
  { name: 'SessionEnd', script: 'on-session-end.sh', timeout: 5 },
];

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

function ensureExecutable() {
  for (const { script } of EVENTS) {
    const p = path.join(HOOKS_DIR, script);
    try {
      fs.chmodSync(p, 0o755);
    } catch (e) {
      console.warn(`⚠ couldn't chmod +x ${p}: ${e.message}`);
    }
  }
}

function main() {
  fs.mkdirSync(SETTINGS_DIR, { recursive: true });
  const settings = readSettings();
  const backupPath = backupSettings();

  settings.hooks = settings.hooks || {};
  let added = 0;
  let alreadyPresent = 0;

  for (const { name, script, matcher, timeout } of EVENTS) {
    const command = path.join(HOOKS_DIR, script);
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
  ensureExecutable();

  console.log(`✓ claude-game hooks installed from ${REPO_ROOT}`);
  if (backupPath) console.log(`  (backed up your previous settings to ${backupPath})`);
  if (added) console.log(`  added ${added} hook entr${added === 1 ? 'y' : 'ies'} to ${SETTINGS_FILE}`);
  if (alreadyPresent) console.log(`  ${alreadyPresent} hook entr${alreadyPresent === 1 ? 'y was' : 'ies were'} already installed, left as-is`);
  console.log('\nNext: start a Claude Code session anywhere and submit a prompt — a browser tab should open.');
  console.log('If nothing happens, see the Troubleshooting section in README.md.');
}

main();
