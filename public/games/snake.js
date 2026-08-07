// Snake, rendered as a monospace character grid for the terminal feel.
// The edges wrap (Pac-Man style) rather than killing you — only running
// into your own body ends the game.
'use strict';

const COLS = 20;
const ROWS = 14;
const TICK_MS = 130;

let container = null;
let snake = [];
let dir = { x: 1, y: 0 };
let pendingDir = dir;
let food = { x: 0, y: 0 };
let over = false;
let score = 0;
let timer = null;
let keydownHandler = null;

function randCell(exclude) {
  let cell;
  do {
    cell = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
  } while (exclude.some((s) => s.x === cell.x && s.y === cell.y));
  return cell;
}

function reset() {
  snake = [{ x: 5, y: 7 }, { x: 4, y: 7 }, { x: 3, y: 7 }];
  dir = { x: 1, y: 0 };
  pendingDir = dir;
  food = randCell(snake);
  over = false;
  score = 0;
}

function tick() {
  dir = pendingDir;
  // Wrap around the edges instead of dying on the wall — adding COLS/ROWS
  // before the modulo keeps the result non-negative even when dir is -1
  // (JS's % can otherwise return a negative remainder).
  const head = {
    x: (snake[0].x + dir.x + COLS) % COLS,
    y: (snake[0].y + dir.y + ROWS) % ROWS,
  };

  const hitsSelf = snake.some((s) => s.x === head.x && s.y === head.y);
  if (hitsSelf) {
    over = true;
    clearInterval(timer);
    render();
    return;
  }

  snake.unshift(head);
  if (head.x === food.x && head.y === food.y) {
    score++;
    food = randCell(snake);
  } else {
    snake.pop();
  }
  render();
}

function render() {
  container.innerHTML = `
    <div class="snake-wrap">
      <div class="snake-status" id="snake-status"></div>
      <div class="snake-grid" id="snake-grid" style="grid-template-columns: repeat(${COLS}, 16px);"></div>
      <div class="snake-hint">${over ? 'press R to restart' : 'arrow keys to steer — wraps around the edges'}</div>
    </div>
  `;
  container.querySelector('#snake-status').textContent = over ? `game over — score ${score}` : `score ${score}`;

  const gridEl = container.querySelector('#snake-grid');
  const frag = document.createDocumentFragment();
  const snakeCells = new Map(snake.map((s, i) => [`${s.x},${s.y}`, i === 0 ? 'head' : 'body']));

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const key = `${x},${y}`;
      const cell = document.createElement('div');
      let cls = 'snake-cell';
      let glyph = '';
      if (snakeCells.has(key)) {
        const kind = snakeCells.get(key);
        cls += ' ' + kind;
        glyph = kind === 'head' ? '▶' : '█';
      } else if (food.x === x && food.y === y) {
        cls += ' food';
        glyph = '●';
      }
      cell.className = cls;
      cell.textContent = glyph;
      frag.appendChild(cell);
    }
  }
  gridEl.appendChild(frag);
}

const DIRS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

function handleKey(e) {
  if (DIRS[e.key]) {
    e.preventDefault();
    const next = DIRS[e.key];
    // Can't reverse directly into your own neck.
    if (next.x === -dir.x && next.y === -dir.y) return;
    pendingDir = next;
  } else if (over && (e.key === 'r' || e.key === 'R')) {
    start();
  }
}

function start() {
  reset();
  render();
  clearInterval(timer);
  timer = setInterval(tick, TICK_MS);
}

export function mount(el) {
  container = el;
  keydownHandler = handleKey;
  window.addEventListener('keydown', keydownHandler);
  start();
}

export function unmount() {
  clearInterval(timer);
  window.removeEventListener('keydown', keydownHandler);
  container = null;
}
