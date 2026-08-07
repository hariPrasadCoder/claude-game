// Menu/router shell + status polling & heartbeat. No dependencies.
// (Poll/heartbeat intervals are duplicated from config.js by design —
// config.js is a Node/CommonJS module and isn't loadable in the browser
// without a bundler, which we're deliberately avoiding.)
import * as tictactoe from './games/tictactoe.js';
import * as wordle from './games/wordle.js';
import * as snake from './games/snake.js';
import * as connectfour from './games/connectfour.js';

const STATUS_POLL_MS = 1000;
const HEARTBEAT_INTERVAL_MS = 3000;

const games = {
  tictactoe: { ...tictactoe, title: 'tic-tac-toe' },
  wordle: { ...wordle, title: 'wordle' },
  snake: { ...snake, title: 'snake' },
  connectfour: { ...connectfour, title: 'connect-four' },
};

const root = document.getElementById('game-root');
const menu = document.getElementById('menu');
const backBtn = document.getElementById('back-btn');
const titleText = document.getElementById('title-text');

let currentGame = null;

function showMenu() {
  if (currentGame) {
    games[currentGame].unmount();
    currentGame = null;
  }
  root.innerHTML = '';
  root.appendChild(menu);
  backBtn.classList.add('hidden');
  titleText.textContent = 'claude-game — menu';
}

function playGame(name) {
  if (name === 'random') {
    const keys = Object.keys(games);
    name = keys[Math.floor(Math.random() * keys.length)];
  }
  currentGame = name;
  root.innerHTML = '';
  backBtn.classList.remove('hidden');
  titleText.textContent = `claude-game — ${games[name].title}`;
  games[name].mount(root);
}

document.querySelectorAll('.menu-btn').forEach((btn) => {
  btn.addEventListener('click', () => playGame(btn.dataset.game));
});
backBtn.addEventListener('click', showMenu);

// ---------------- status polling / heartbeat ----------------

const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const doneBanner = document.getElementById('done-banner');

let lastStatus = null;

function applyStatus(status) {
  if (status === lastStatus) return;
  lastStatus = status;
  statusDot.className = `status-dot ${status}`;
  doneBanner.classList.remove('waiting');
  if (status === 'working') {
    statusText.textContent = '● Claude is working…';
    doneBanner.classList.add('hidden');
  } else if (status === 'waiting') {
    // Claude is blocked on a permission prompt, a question, or an idle
    // nudge — not working, not done, just waiting on you.
    statusText.textContent = '⏸ Claude needs your input';
    doneBanner.textContent = '⏸ Claude is waiting on you — check your terminal';
    doneBanner.classList.add('waiting');
    doneBanner.classList.remove('hidden');
  } else if (status === 'done') {
    statusText.textContent = '✔ Claude is done';
    doneBanner.textContent = '✔ Claude is done — nice game!';
    doneBanner.classList.remove('hidden');
  } else {
    statusText.textContent = '○ idle';
    doneBanner.classList.add('hidden');
  }
}

async function pollStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    applyStatus(data.status);
  } catch (_) {
    // Server briefly unreachable (e.g. mid-restart) — just try again next tick.
  }
}

async function sendHeartbeat() {
  try {
    await fetch('/api/heartbeat', { method: 'POST' });
  } catch (_) {}
}

pollStatus();
sendHeartbeat();
setInterval(pollStatus, STATUS_POLL_MS);
setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
