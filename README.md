# claude-game

**You know the dinosaur game you play when your wifi dies? This is that — but for Claude Code.**

Every time you submit a prompt, a terminal-styled game pops up in your browser: Tic-Tac-Toe, Wordle, Snake, or Connect Four. Play while Claude works. The moment it's done, the game tells you — instead of you nervously alt-tabbing back every four seconds to check.

> **Unofficial, community-built.** Not made or endorsed by Anthropic — it just talks to Claude Code's public [hooks](https://code.claude.com/docs/en/hooks) system, same as any other hook script.

```sh
npx github:hariPrasadCoder/claude-game
```

No clone, no config, no npm install. Run that, submit your next prompt, and a tab opens.

![claude-game demo — a terminal-styled menu pops up with Tic-Tac-Toe, Wordle, Snake, and Connect Four, then plays Wordle while the status bar shows Claude is working](docs/demo.gif)

*(GIF a little soft? [Watch the MP4](docs/demo.mp4) instead.)*

## Why

I kept tabbing away from Claude Code while it worked — Twitter, Slack, back, still working, repeat. So I had it build something to do *instead*: a game that shows up exactly when it starts thinking, and gets out of the way exactly when it's done. Built with Claude Code, running inside Claude Code, actively enabling you to procrastinate on the thing Claude Code is doing for you.

## Features

- 🎮 **The loading-screen game, for Claude Code.** Tic-Tac-Toe, Wordle, Snake, Connect Four — pick one, or hit Random.
- 🟠 **Looks like it belongs there.** Dark theme, monospace, terminal chrome — not some random webpage that popped up.
- 🪶 **Zero dependencies.** Plain Node `http` server, vanilla JS frontend. No npm install, no bundler.
- 🔌 **Install once, works everywhere.** Fires for every Claude Code session on your machine, any project.
- 🤝 **Plays nice with multiple sessions.** Two terminals running Claude Code at once? Status only clears once both are actually done.
- ✋ **Knows when Claude's actually waiting on you.** A permission prompt or a question doesn't get lumped in with "working" — status says so honestly.
- 🔒 **Nothing leaves your laptop, with one opt-in exception.** Binds to `127.0.0.1`, no accounts, no telemetry — the only network call this makes is checking GitHub for a newer version, and only when you click the button.
- 🔄 **Updates itself when you ask it to.** Click "check for updates" in the UI — no re-running install commands by hand.

## Install

```sh
npx github:hariPrasadCoder/claude-game
```

This is the whole install. Behind the scenes it:
- Adds `UserPromptSubmit`, `PreToolUse`, `Notification`, `Stop`, and `SessionEnd` hooks to `~/.claude/settings.json`
- Copies itself to a stable home at `~/.claude-game/app` (so hooks keep working even after npm clears its temp cache — see [How it works](#how-it-works))
- Backs up your existing `settings.json` first (`settings.json.bak-<timestamp>`)
- Only ever *adds* to your hooks config — never touches your other settings, plugins, or existing hooks
- Is safe to re-run any time — it won't create duplicate entries

**Prefer to clone it?** Works the same way, and is the better option if you want to read the code or contribute:

```sh
git clone https://github.com/hariPrasadCoder/claude-game.git
cd claude-game
node install.js
```

**Requirements:** Node.js 18+, macOS or Linux (Windows works under WSL or Git Bash — see [Troubleshooting](#troubleshooting)), and [Claude Code](https://claude.com/claude-code) itself.

## Usage

Just use Claude Code normally. When you submit a prompt, a tab opens (or an existing one gets reused) showing a small terminal-styled menu:

- pick **Tic-Tac-Toe**, **Wordle**, **Snake**, or **Connect Four**, or hit **Random**
- the status line up top shows `● Claude is working…` while Claude's on your prompt, `⏸ Claude needs your input` when it's blocked on a permission prompt or a question, and `✔ Claude is done` the moment it finishes — none of it interrupts whatever you're mid-game on
- closing the tab is fine; it reopens next time you submit a prompt

## How it works

- `server.js` is a plain Node `http` server (no dependencies) that serves the game and tracks whether any Claude Code session is currently "working". It listens only on `127.0.0.1:47821`.
- `UserPromptSubmit` makes sure the server is running (starting it as a detached background process if not) and opens a browser tab unless one already seems to be open (based on a recent heartbeat from the page).
- `Stop` marks that session as done. **It never kills the server** — instead the server watches its own idle state and shuts itself down once nobody's working *and* no browser tab has sent a heartbeat in ~10 minutes. Multiple concurrent Claude Code sessions safely share one server without racing to kill it out from under each other — aggregate status only reads "done" once every tracked session has finished.
- `PreToolUse` (fires before every tool call) re-marks the session "working". This is what keeps status correct when Claude resumes without a fresh `UserPromptSubmit` — e.g. after a background subagent finishes. It's a plain backgrounded `curl` rather than a Node script since it fires constantly and needs to add ~nothing to tool call latency.
- `Notification` marks the session "waiting" — Claude hit a permission prompt, an `AskUserQuestion`-style question, or an idle nudge, and is blocked on you, not working. Without this, status would just say "working" the entire time you're staring at an unanswered question.
- `SessionEnd` drops a session from the tracked set entirely when you exit `claude`.
- Runtime state (pidfile, logs) lives at `~/.claude-game/run/`; the app itself (when installed via `npx`) lives at `~/.claude-game/app/` — both outside the repo, so it survives independent of where you cloned it or npm's own cache lifecycle.

See [`install.js`](install.js), [`server.js`](server.js), and [`hooks/`](hooks) for the actual implementation — it's short and meant to be read.

## Configuration

Everything tunable lives in [`config.js`](config.js) — port, timeouts, polling intervals. Port and run-directory are also overridable via `CLAUDE_GAME_PORT`/`CLAUDE_GAME_RUN_DIR` env vars, mainly useful for running a second isolated instance. If you change the port, restart the server:

```sh
kill "$(cat ~/.claude-game/run/server.pid)"
```

It'll be respawned automatically on your next prompt.

## Updating

Click **check for updates** in the bottom-left of the app. If a newer version is available, click **update now** — it pulls the latest code and restarts itself, no re-running install commands by hand. This is the one thing in claude-game that talks to the network, and only when you click it:

- git clone install → runs `git pull --ff-only`
- npx install → re-runs the npx one-liner, refreshing `~/.claude-game/app`

Prefer to do it yourself:

```sh
cd claude-game && git pull && node install.js      # git clone
npx github:hariPrasadCoder/claude-game               # npx
```

## Uninstall

```sh
node uninstall.js         # from a clone
npx github:hariPrasadCoder/claude-game uninstall   # via npx
```

This removes claude-game's hook entries from `~/.claude/settings.json` (backing the file up first) and leaves everything else untouched. To also remove app/runtime state:

```sh
rm -rf ~/.claude-game
```

## Troubleshooting

**Nothing happens when I submit a prompt.**
Check `~/.claude-game/run/server.log` for errors. Confirm the hooks are present: `cat ~/.claude/settings.json` should show a `hooks` key with entries pointing at `hooks/`. Confirm `node` is on your `PATH` — hook subprocesses sometimes inherit a minimal `PATH` that doesn't include nvm/homebrew installs (see [`hooks/common-env.sh`](hooks/common-env.sh), which tries to work around this).

**Status says "done" but Claude is clearly still working.**
This happens if Claude resumes work without a fresh `UserPromptSubmit` (e.g. after a background subagent finishes). The `PreToolUse` hook (`hooks/on-tool-use.sh`) is what re-syncs status the moment any tool runs — it needs `curl` on your `PATH`. Check it's installed (`command -v curl`).

**Port 47821 is already in use by something else.**
Change `PORT` in `config.js`, then kill any running instance (`kill "$(cat ~/.claude-game/run/server.pid)"`) so it restarts with the new port.

**"update now" fails.**
For a git clone, `git pull --ff-only` refuses if you've made local edits — commit or stash them first. For an npx install, it needs network access to GitHub and `npx` on your `PATH`. Either way, the error message from the failed command shows up right in the UI.

**Windows.**
The hook scripts are POSIX shell (`hooks/*.sh`) — they work under WSL or Git Bash, but not plain `cmd.exe`/PowerShell today. A native Windows hook dispatcher would be a welcome contribution — see [CONTRIBUTING.md](CONTRIBUTING.md).

**I want to see it working without touching real hooks.**
```sh
node server.js &
open http://127.0.0.1:47821/          # macOS
xdg-open http://127.0.0.1:47821/      # Linux

# simulate a hook call the way Claude Code does (JSON on stdin):
echo '{"session_id":"test-1","hook_event_name":"UserPromptSubmit"}' | node hooks/on-prompt-submit.js
echo '{"session_id":"test-1","hook_event_name":"Stop"}' | node hooks/on-stop.js
curl -s http://127.0.0.1:47821/api/status
```

## Contributing

New games, a Windows-native hook dispatcher, bug fixes — all welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for how the project is structured and how to add a game. It's a small, readable codebase on purpose; if you've ever wanted a low-stakes first PR to make, this is a good one.

## Star History

If this is saving your sanity during a long refactor, a ⭐ helps other people building with Claude Code actually find it.

[![Star History Chart](https://api.star-history.com/svg?repos=hariPrasadCoder/claude-game&type=Date)](https://star-history.com/#hariPrasadCoder/claude-game&Date)

## License

[MIT](LICENSE)
