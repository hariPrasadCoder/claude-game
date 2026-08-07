// Wordle-lite. 6 guesses at a random 5-letter word. Guesses only need to
// be 5 letters — kept intentionally simple, no second dictionary to
// validate against.
'use strict';

import { WORDS } from './wordlist.js';

const MAX_GUESSES = 6;
const WORD_LEN = 5;

let container = null;
let target = '';
let guesses = [];
let current = '';
let over = null; // null | 'won' | 'lost'
let keydownHandler = null;

function pickWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

// Two-pass scoring: greens first (decrementing a per-letter count map),
// then ambers against whatever counts remain — this handles repeated
// letters correctly (e.g. guessing "sassy" against target "gassy").
function scoreGuess(guess) {
  const result = Array(WORD_LEN).fill('absent');
  const counts = {};
  for (const ch of target) counts[ch] = (counts[ch] || 0) + 1;

  for (let i = 0; i < WORD_LEN; i++) {
    if (guess[i] === target[i]) {
      result[i] = 'green';
      counts[guess[i]]--;
    }
  }
  for (let i = 0; i < WORD_LEN; i++) {
    if (result[i] === 'green') continue;
    const ch = guess[i];
    if (counts[ch] > 0) {
      result[i] = 'amber';
      counts[ch]--;
    }
  }
  return result;
}

function statusMessage() {
  if (over === 'won') return `you got it! (${guesses.length}/${MAX_GUESSES}) — the word was "${target}"`;
  if (over === 'lost') return `out of guesses — the word was "${target}"`;
  return `guess ${guesses.length + 1} of ${MAX_GUESSES}`;
}

function render() {
  container.innerHTML = `
    <div class="wordle-wrap">
      <div class="wordle-status" id="wordle-status"></div>
      <div class="wordle-grid" id="wordle-grid"></div>
      <div class="wordle-hint">type letters, enter to submit, backspace to edit</div>
    </div>
  `;
  const grid = container.querySelector('#wordle-grid');
  const frag = document.createDocumentFragment();
  for (let r = 0; r < MAX_GUESSES; r++) {
    const rowEl = document.createElement('div');
    rowEl.className = 'wordle-row';
    const rowData = guesses[r];
    const word = rowData ? rowData.word : r === guesses.length ? current : '';
    for (let c = 0; c < WORD_LEN; c++) {
      const tile = document.createElement('div');
      const letter = word[c] || '';
      let cls = 'wordle-tile';
      if (letter) cls += ' filled';
      if (rowData) cls += ' ' + rowData.colors[c];
      tile.className = cls;
      tile.textContent = letter;
      rowEl.appendChild(tile);
    }
    frag.appendChild(rowEl);
  }
  grid.appendChild(frag);
  container.querySelector('#wordle-status').textContent = statusMessage();
}

function submitGuess() {
  if (over || current.length !== WORD_LEN) return;
  const colors = scoreGuess(current);
  guesses.push({ word: current, colors });
  if (current === target) {
    over = 'won';
  } else if (guesses.length >= MAX_GUESSES) {
    over = 'lost';
  }
  current = '';
  render();
}

function handleKey(e) {
  if (over) return;
  if (e.key === 'Enter') {
    submitGuess();
  } else if (e.key === 'Backspace') {
    current = current.slice(0, -1);
    render();
  } else if (/^[a-zA-Z]$/.test(e.key) && current.length < WORD_LEN) {
    current += e.key.toLowerCase();
    render();
  }
}

export function mount(el) {
  container = el;
  target = pickWord();
  guesses = [];
  current = '';
  over = null;
  render();
  keydownHandler = handleKey;
  window.addEventListener('keydown', keydownHandler);
}

export function unmount() {
  window.removeEventListener('keydown', keydownHandler);
  container = null;
}
