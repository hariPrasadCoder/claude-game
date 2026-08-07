#!/usr/bin/env node
// Entry point for `npx github:hariPrasadCoder/claude-game [install|uninstall]`.
// Lets people try this without cloning the repo first — npx fetches the
// repo into its own cache and runs this directly. Defaults to "install"
// so the bare one-liner (no args) does the thing people actually want.
'use strict';

const path = require('path');

const action = process.argv[2] || 'install';
const scripts = {
  install: '../install.js',
  uninstall: '../uninstall.js',
};

if (!scripts[action]) {
  console.error(`Unknown command: "${action}"`);
  console.error('Usage: npx github:hariPrasadCoder/claude-game [install|uninstall]');
  process.exit(1);
}

require(path.join(__dirname, scripts[action]));
