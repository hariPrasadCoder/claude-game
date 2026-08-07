#!/usr/bin/env node
// Removes claude-game's hook entries from ~/.claude/settings.json,
// leaving everything else (your other hooks, model config, plugins,
// etc.) untouched. Does not delete ~/.claude-game runtime/app state —
// see README.md if you want that gone too.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const SETTINGS_FILE = path.join(os.homedir(), '.claude', 'settings.json');
const EVENTS = ['UserPromptSubmit', 'PreToolUse', 'Notification', 'Stop', 'SessionEnd'];

// Matched by filename rather than by directory: hook commands can point
// at a manual git clone, the stable ~/.claude-game/app copy (from an npx
// install), or — if someone's upgrading from an older version of this
// tool — a stale npx cache path. All of those are still unambiguously
// "ours" by filename; matching this way means uninstall always finds
// them regardless of where the app was actually running from.
const SCRIPT_NAMES = new Set(['on-prompt-submit.sh', 'on-tool-use.sh', 'on-notification.sh', 'on-stop.sh', 'on-session-end.sh']);

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
      const isOurs = (group.hooks || []).some((h) => typeof h.command === 'string' && SCRIPT_NAMES.has(path.basename(h.command)));
      return !isOurs;
    });
    removed += before - settings.hooks[name].length;
    if (settings.hooks[name].length === 0) delete settings.hooks[name];
  }

  if (Object.keys(settings.hooks).length === 0) delete settings.hooks;

  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2) + '\n');
  console.log(`✓ removed ${removed} claude-game hook entr${removed === 1 ? 'y' : 'ies'} from ${SETTINGS_FILE}`);
  console.log('  (a backup of the previous file was saved alongside it)');
  console.log(`\nTo also remove app/runtime state, run: rm -rf ${path.join(os.homedir(), '.claude-game')}`);
}

main();
