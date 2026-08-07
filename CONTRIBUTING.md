# Contributing to claude-game

Thanks for considering it. This is a small, deliberately dependency-free
project — the bar for a change is "does it work, is it simple, does it
still look like the terminal."

## Project principles

- **Zero npm dependencies.** Server is plain Node `http`/`fs`; frontend is
  vanilla HTML/CSS/JS (native ES modules, no bundler). If a change seems
  to need a dependency, it's worth first asking whether it's really
  needed — that's usually a sign the feature should be simpler.
- **Local-only.** The server binds to `127.0.0.1` and nothing it does
  should ever call out to the network.
- **Hooks must never break Claude Code.** A non-zero exit from
  `UserPromptSubmit` blocks *and erases* the user's prompt; a non-zero
  exit from `Stop` traps Claude in a stop-loop. Every hook script
  (`hooks/*.sh` and the `.js` files they call) must always exit `0`, even
  on internal errors — wrap risky logic in `try/catch` and swallow
  failures rather than letting them propagate.

## Dev setup

No install step — just clone and run:

```sh
git clone https://github.com/hariPrasadCoder/claude-game.git
cd claude-game
node server.js
open http://127.0.0.1:47821/       # macOS
xdg-open http://127.0.0.1:47821/   # Linux
```

To test against your *actual* Claude Code hooks while developing, run
`node install.js` — it points the hooks at wherever you cloned the repo,
so `git pull` / local edits take effect immediately without reinstalling.

## Testing changes

There's no test framework — verify manually:

```sh
# syntax-check everything
find . -name "*.js" -not -path "./node_modules/*" -print0 | xargs -0 -n1 node -c

# simulate what Claude Code sends hooks on stdin
echo '{"session_id":"t1","hook_event_name":"UserPromptSubmit"}' | node hooks/on-prompt-submit.js
echo '{"session_id":"t1","hook_event_name":"Stop"}' | node hooks/on-stop.js
curl -s http://127.0.0.1:47821/api/status
```

If you change `server.js`'s session/status logic, also check the
multi-session case: fire `prompt-submit` for two different `sessionId`s,
`stop` only one, and confirm `/api/status` still reports `"working"`
until both are stopped. See the CI workflow
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) for the exact
commands that run on every PR.

## Adding a new game

Games live in `public/games/` and follow a small `mount`/`unmount`
contract — see [`public/games/tictactoe.js`](public/games/tictactoe.js)
for the simplest example:

```js
export function mount(containerEl) {
  // render into containerEl, attach any listeners/intervals
}

export function unmount() {
  // remove listeners, clear intervals — called when the user goes
  // back to the menu
}
```

To register it:
1. Add `public/games/yourgame.js` with `mount`/`unmount`.
2. Import it and add an entry to the `games` map in
   [`public/app.js`](public/app.js).
3. Add a menu button in [`public/index.html`](public/index.html)
   (`<button class="menu-btn" data-game="yourgame">`).
4. Style it in [`public/style.css`](public/style.css) — reuse the
   existing CSS variables (`--accent`, `--bg-panel`, `--mono`, etc.) so it
   stays visually consistent with the rest of the terminal theme.

Keep it keyboard-friendly where it makes sense (Wordle and Snake are both
`keydown`-driven) — this is meant to be playable one-handed while reading
Claude's output.

## Pull requests

- Keep PRs focused — one game, one fix, one improvement.
- Explain what you tested (there's no CI test suite beyond syntax/smoke
  checks, so manual verification notes in the PR description are genuinely
  useful).
- If you're adding a dependency, open an issue first to discuss — it's a
  high bar for a project this small, not a blanket "no."

## Reporting bugs / ideas

Open a GitHub issue. Logs at `~/.claude-game/run/server.log` and the
output of `curl -s http://127.0.0.1:47821/api/status` are useful to
include.
