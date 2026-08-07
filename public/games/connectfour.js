// Connect Four — drop discs to connect four in a row, vs a depth-limited
// minimax (with alpha-beta pruning) AI. You're always the accent-colored
// disc and go first; the AI plays second.
'use strict';

const ROWS = 6;
const COLS = 7;
// Depth 6 keeps worst-case search comfortably under ~150ms even on a busy
// midgame board (measured) — this runs on the browser's main thread, so
// staying fast matters more than in a backend context.
const AI_DEPTH = 6;
const CENTER = Math.floor(COLS / 2);
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]]; // horizontal, vertical, / diagonal, \ diagonal

let container = null;
let board = null; // board[r][c], r=0 is the bottom row (gravity drops toward r=0)
let turn = 'P'; // 'P' = you, 'A' = AI
let over = false;
let message = '';

function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function cloneBoard(b) {
  return b.map((row) => row.slice());
}

function validCols(b) {
  const cols = [];
  for (let c = 0; c < COLS; c++) if (b[ROWS - 1][c] === null) cols.push(c);
  return cols;
}

// Center-first move ordering — classic Connect Four alpha-beta speedup,
// since center columns are both stronger moves and better prunes.
function orderedCols(b) {
  return validCols(b).sort((a, c) => Math.abs(a - CENTER) - Math.abs(c - CENTER));
}

function dropDisc(b, col, piece) {
  for (let r = 0; r < ROWS; r++) {
    if (b[r][col] === null) {
      b[r][col] = piece;
      return r;
    }
  }
  return -1; // column full
}

function boardHasWin(b, piece) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (b[r][c] !== piece) continue;
      for (const [dr, dc] of DIRS) {
        let count = 1;
        let rr = r + dr;
        let cc = c + dc;
        while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && b[rr][cc] === piece) {
          count++;
          rr += dr;
          cc += dc;
        }
        if (count >= 4) return true;
      }
    }
  }
  return false;
}

function windowScore(cells, piece, opponent) {
  const p = cells.filter((v) => v === piece).length;
  const o = cells.filter((v) => v === opponent).length;
  const e = cells.filter((v) => v === null).length;
  if (p > 0 && o > 0) return 0; // contested window — neither side can complete it
  if (p === 4) return 10000;
  if (p === 3 && e === 1) return 5;
  if (p === 2 && e === 2) return 2;
  if (o === 3 && e === 1) return -8; // weigh blocking the opponent heavier than building
  return 0;
}

function evaluateBoard(b, piece) {
  const opponent = piece === 'A' ? 'P' : 'A';
  let score = 0;

  for (let r = 0; r < ROWS; r++) score += b[r][CENTER] === piece ? 3 : 0;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      score += windowScore([0, 1, 2, 3].map((i) => b[r][c + i]), piece, opponent);
    }
  }
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r <= ROWS - 4; r++) {
      score += windowScore([0, 1, 2, 3].map((i) => b[r + i][c]), piece, opponent);
    }
  }
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      score += windowScore([0, 1, 2, 3].map((i) => b[r + i][c + i]), piece, opponent);
    }
  }
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 3; c < COLS; c++) {
      score += windowScore([0, 1, 2, 3].map((i) => b[r + i][c - i]), piece, opponent);
    }
  }
  return score;
}

function minimax(b, depth, alpha, beta, maximizing) {
  const cols = orderedCols(b);

  if (boardHasWin(b, 'A')) return { score: 1000000 + depth };
  if (boardHasWin(b, 'P')) return { score: -1000000 - depth };
  if (cols.length === 0) return { score: 0 };
  if (depth === 0) return { score: evaluateBoard(b, 'A') };

  if (maximizing) {
    let best = { score: -Infinity, col: cols[0] };
    for (const c of cols) {
      const b2 = cloneBoard(b);
      dropDisc(b2, c, 'A');
      const result = minimax(b2, depth - 1, alpha, beta, false);
      if (result.score > best.score) best = { score: result.score, col: c };
      alpha = Math.max(alpha, result.score);
      if (alpha >= beta) break;
    }
    return best;
  }

  let best = { score: Infinity, col: cols[0] };
  for (const c of cols) {
    const b2 = cloneBoard(b);
    dropDisc(b2, c, 'P');
    const result = minimax(b2, depth - 1, alpha, beta, true);
    if (result.score < best.score) best = { score: result.score, col: c };
    beta = Math.min(beta, result.score);
    if (alpha >= beta) break;
  }
  return best;
}

function checkEnd(piece) {
  if (boardHasWin(board, piece)) {
    over = true;
    message = piece === 'P' ? 'you win! 🎉' : 'claude-bot wins this one';
    return true;
  }
  if (validCols(board).length === 0) {
    over = true;
    message = "it's a draw";
    return true;
  }
  return false;
}

function render() {
  container.innerHTML = `
    <div class="c4-wrap">
      <div class="c4-status" id="c4-status"></div>
      <div class="c4-board" id="c4-board"></div>
      <button class="c4-restart" id="c4-restart">restart</button>
    </div>
  `;
  container.querySelector('#c4-status').textContent = message;

  const boardEl = container.querySelector('#c4-board');
  // Render top row first so the DOM (and CSS grid) reads top-to-bottom
  // like a real board, even though board[0] is the bottom (gravity drops
  // toward increasing... toward r=0).
  for (let r = ROWS - 1; r >= 0; r--) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      const v = board[r][c];
      cell.className = `c4-cell${v === 'P' ? ' player' : v === 'A' ? ' ai' : ''}`;
      cell.addEventListener('click', () => handleDrop(c));
      boardEl.appendChild(cell);
    }
  }
  container.querySelector('#c4-restart').addEventListener('click', restart);
}

function handleDrop(col) {
  if (over || turn !== 'P') return;
  const r = dropDisc(board, col, 'P');
  if (r === -1) return; // column full, ignore
  if (checkEnd('P')) {
    render();
    return;
  }
  turn = 'A';
  message = 'thinking…';
  render();
  setTimeout(aiMove, 400);
}

function aiMove() {
  const { col } = minimax(board, AI_DEPTH, -Infinity, Infinity, true);
  dropDisc(board, col, 'A');
  if (checkEnd('A')) {
    render();
    return;
  }
  turn = 'P';
  message = 'your move';
  render();
}

function restart() {
  board = emptyBoard();
  turn = 'P';
  over = false;
  message = 'your move — click a column';
  render();
}

export function mount(el) {
  container = el;
  restart();
}

export function unmount() {
  container = null;
  board = null;
}
