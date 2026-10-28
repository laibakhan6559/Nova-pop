import { COLS, MAXR } from './config.js';

// Even rows have COLS cells, odd rows are shifted right by R and have COLS-1 cells.
export const colsIn = (r) => (r & 1 ? COLS - 1 : COLS);

export function neighbors(r, c) {
  const cand =
    r & 1
      ? [[r, c - 1], [r, c + 1], [r - 1, c], [r - 1, c + 1], [r + 1, c], [r + 1, c + 1]]
      : [[r, c - 1], [r, c + 1], [r - 1, c - 1], [r - 1, c], [r + 1, c - 1], [r + 1, c]];
  const out = [];
  for (const [rr, cc] of cand) {
    if (rr >= 0 && rr < MAXR && cc >= 0 && cc < colsIn(rr)) out.push([rr, cc]);
  }
  return out;
}

export const emptyGrid = () => Array.from({ length: MAXR }, () => Array(COLS).fill(null));

// Returns set of keys (r*16+c) of cells connected to the ceiling.
export function connectedSet(grid) {
  const seen = new Set();
  const stack = [];
  for (let c = 0; c < COLS; c++) {
    if (grid[0][c]) {
      seen.add(c);
      stack.push([0, c]);
    }
  }
  while (stack.length) {
    const [r, c] = stack.pop();
    for (const [rr, cc] of neighbors(r, c)) {
      const k = rr * 16 + cc;
      if (grid[rr][cc] && !seen.has(k)) {
        seen.add(k);
        stack.push([rr, cc]);
      }
    }
  }
  return seen;
}
