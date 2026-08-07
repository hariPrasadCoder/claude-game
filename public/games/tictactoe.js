// Tic-Tac-Toe. You're always X and move first; the AI (O) plays perfect
// minimax, so it never loses — the search space (9 cells) is tiny enough
// that a brute-force minimax is instant.
'use strict';

let container = null;
let state = null;

function emptyBoard() {
  return Array(9).fill(null);
}

function winner(board) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  if (board.every(Boolean)) return 'draw';
  return null;
}

function minimax(board, player) {
  const result = winner(board);
  if (result === 'X') return { score: -1 };
  if (result === 'O') return { score: 1 };
  if (result === 'draw') return { score: 0 };

  const moves = [];
  for (let i = 0; i < 9; i++) {
    if (board[i]) continue;
    board[i] = player;
    const outcome = minimax(board, player === 'O' ? 'X' : 'O');
    moves.push({ index: i, score: outcome.score });
    board[i] = null;
  }

  return player === 'O'
    ? moves.reduce((best, m) => (m.score > best.score ? m : best))
    : moves.reduce((best, m) => (m.score < best.score ? m : best));
}

function statusFor() {
  if (state.over) return state.message;
  return state.turn === 'X' ? 'your move (X)' : 'thinking…';
}

function render() {
  container.innerHTML = `
    <div class="ttt-wrap">
      <div class="ttt-status" id="ttt-status"></div>
      <div class="ttt-board" id="ttt-board"></div>
      <button class="ttt-restart" id="ttt-restart">restart</button>
    </div>
  `;
  const boardEl = container.querySelector('#ttt-board');
  state.board.forEach((val, i) => {
    const cell = document.createElement('div');
    cell.className = `ttt-cell${val ? ' filled ' + val.toLowerCase() : ''}`;
    cell.textContent = val || '';
    cell.addEventListener('click', () => handleMove(i));
    boardEl.appendChild(cell);
  });
  container.querySelector('#ttt-status').textContent = statusFor();
  container.querySelector('#ttt-restart').addEventListener('click', restart);
}

function checkEnd() {
  const result = winner(state.board);
  if (result === 'X') {
    state.over = true;
    state.message = 'you win! 🎉';
  } else if (result === 'O') {
    state.over = true;
    state.message = 'claude-bot wins this one';
  } else if (result === 'draw') {
    state.over = true;
    state.message = "it's a draw";
  }
}

function handleMove(i) {
  if (state.over || state.board[i] || state.turn !== 'X') return;
  state.board[i] = 'X';
  checkEnd();
  state.turn = 'O';
  render();
  if (!state.over) setTimeout(aiMove, 300);
}

function aiMove() {
  const { index } = minimax(state.board, 'O');
  state.board[index] = 'O';
  checkEnd();
  state.turn = 'X';
  render();
}

function restart() {
  state = { board: emptyBoard(), turn: 'X', over: false, message: '' };
  render();
}

export function mount(el) {
  container = el;
  restart();
}

export function unmount() {
  container = null;
  state = null;
}
