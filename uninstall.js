#!/usr/bin/env node
// Removes claude-game's hook entries from ~/.claude/settings.json,
// leaving everything else (your other hooks, model config, plugins,
// etc.) untouched. Does not delete the repo or ~/.claude-game runtime
// state — see README.md if you want those gone too.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = __dirname;
const HOOKS_DIR = path.join(REPO_ROOT, 'hooks');
const SETTINGS_FILE = path.join(os.homedir(), '.claude', 'settings.json');

const EVENTS = ['UserPromptSubmit', 'Stop', 'SessionEnd'];

function main() {
  if (!fs.existsSync(SETTINGS_FILE)) {
    console.log('No ~/.claude/settings.json found — nothing to uninstall.');
    return;
  }

  const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  if (!settings.hooks) {
    console.log('No hooks configured — nothing to uninstall.');
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(SETTINGS_FILE, `${SETTINGS_FILE}.bak-${stamp}`);

  let removed = 0;
  for (const name of EVENTS) {
    if (!Array.isArray(settings.hooks[name])) continue;
    const before = settings.hooks[name].length;
    settings.hooks[name] = settings.hooks[name].filter((group) => {
      const isOurs = (group.hooks || []).some((h) => typeof h.command === 'string' && h.command.startsWith(HOOKS_DIR));
      return !isOurs;
    });
    removed += before - settings.hooks[name].length;
    if (settings.hooks[name].length === 0) delete settings.hooks[name];
  }

  if (Object.keys(settings.hooks).length === 0) delete settings.hooks;

  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2) + '\n');
  console.log(`✓ removed ${removed} claude-game hook entr${removed === 1 ? 'y' : 'ies'} from ${SETTINGS_FILE}`);
  console.log('  (a backup of the previous file was saved alongside it)');
  console.log(`\nTo also remove runtime state, run: rm -rf ${path.join(os.homedir(), '.claude-game')}`);
}

main();
