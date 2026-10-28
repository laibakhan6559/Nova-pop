import { COLS, MAXR } from './config.js';
import { emptyGrid, neighbors, connectedSet } from './grid.js';

// world: 0 Candy Meadow, 1 Ocean Deep, 2 Neon City, 3 Galaxy
export const WORLDS = ['Ember Ruins', 'Tide Temple', 'Storm Citadel', 'Shadow Void'];

// pat: full | pyramid | diamond | checker | columns | heart | ring | wave
// ice / stone: probability per bubble. gold / shift: count. drop: misses before ceiling falls.
// pu: starting power-ups. hints: hints available.
export const LEVELS = [
  { rows: 5, colors: 3, pat: 'full', drop: 9, tip: 'Match 3 or more bubbles of the same colour. Drag to aim, release to fire!' },
  { rows: 6, colors: 3, pat: 'pyramid', drop: 9, gold: 1, tip: 'Golden-star bubbles drop a free power-up when popped.' },
  { rows: 6, colors: 4, pat: 'full', drop: 8, gold: 1 },
  { rows: 7, colors: 4, pat: 'diamond', drop: 8, ice: 0.1, tip: 'Frozen bubbles crack when a neighbour pops - then they are normal.' },
  { rows: 7, colors: 4, pat: 'heart', drop: 8, ice: 0.06, gold: 2, pu: { bomb: 1 }, tip: 'You got a Bomb! Tap it below to load it.' },

  { rows: 7, colors: 4, pat: 'columns', drop: 7, ice: 0.12, gold: 1 },
  { rows: 8, colors: 5, pat: 'checker', drop: 7, ice: 0.1, stone: 0.05, tip: 'Stone blocks only fall when cut off from the ceiling.' },
  { rows: 8, colors: 5, pat: 'wave', drop: 7, ice: 0.1, stone: 0.06, gold: 2, pu: { lightning: 1 } },
  { rows: 8, colors: 5, pat: 'ring', drop: 6, ice: 0.1, stone: 0.08, gold: 1 },
  { rows: 8, colors: 5, pat: 'heart', drop: 6, ice: 0.12, stone: 0.06, gold: 2, pu: { bomb: 1, rainbow: 1 } },

  { rows: 8, colors: 5, pat: 'full', drop: 7, shift: 3, gold: 1, tip: 'Shifter bubbles change colour after every shot - watch the inner dot!' },
  { rows: 9, colors: 5, pat: 'diamond', drop: 6, shift: 4, ice: 0.1, stone: 0.05, gold: 1 },
  { rows: 9, colors: 6, pat: 'wave', drop: 6, shift: 4, ice: 0.08, stone: 0.06, gold: 2, pu: { rainbow: 1 } },
  { rows: 9, colors: 6, pat: 'checker', drop: 6, shift: 5, stone: 0.08, ice: 0.08, gold: 2 },
  { rows: 9, colors: 6, pat: 'pyramid', drop: 6, shift: 5, ice: 0.12, stone: 0.07, gold: 2, pu: { bomb: 1, lightning: 1 } },

  { rows: 9, colors: 6, pat: 'ring', drop: 6, shift: 5, ice: 0.12, stone: 0.08, gold: 2 },
  { rows: 9, colors: 6, pat: 'columns', drop: 5, shift: 6, ice: 0.12, stone: 0.08, gold: 2, pu: { rainbow: 1 } },
  { rows: 9, colors: 6, pat: 'heart', drop: 5, shift: 6, ice: 0.14, stone: 0.08, gold: 3, pu: { bomb: 1 } },
  { rows: 10, colors: 6, pat: 'diamond', drop: 5, shift: 7, ice: 0.14, stone: 0.09, gold: 3, pu: { bomb: 1, rainbow: 1 } },
  { rows: 10, colors: 6, pat: 'wave', drop: 5, shift: 8, ice: 0.16, stone: 0.1, gold: 3, pu: { bomb: 1, rainbow: 1, lightning: 1 }, tip: 'Final level! Use everything you have learned.' },
].map((l, i) => ({ ...l, world: Math.floor(i / 5), hints: 3 }));

const HEART = [
  '0110000110',
  '1111001111',
  '1111111111',
  '1111111111',
  '0111111110',
  '0011111100',
  '0001111000',
  '0000110000',
];

function pattern(name, r, c, rows) {
  switch (name) {
    case 'full':
      return r < rows;
    case 'pyramid': {
      const s = Math.floor(r * 0.55);
      return r < rows && c >= s && c <= COLS - 1 - s;
    }
    case 'diamond': {
      const half = (rows - 1) / 2;
      const w = 5.2 - (Math.abs(r - half) * 5) / (half + 1.2);
      return r < rows && Math.abs(c - 4.5) < w;
    }
    case 'checker':
      return r < rows && (r < 2 || (r + c) % 2 === 0);
    case 'columns':
      return r < rows && (r < 2 || c % 3 !== 1);
    case 'heart':
      return r < HEART.length && c < COLS && HEART[r][c] === '1';
    case 'ring':
      return r < rows && !(r >= 2 && r <= rows - 2 && c >= 3 && c <= 6);
    case 'wave':
      return r < rows + Math.round(2 * Math.sin(c * 0.9));
    default:
      return r < rows;
  }
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildLevel(i) {
  const cfg = LEVELS[i];
  const rnd = rng(1000 + i * 7919);
  const grid = emptyGrid();

  // palette: seeded shuffle of the 6 colours, first N used
  const all = [0, 1, 2, 3, 4, 5];
  for (let k = all.length - 1; k > 0; k--) {
    const j = Math.floor(rnd() * (k + 1));
    [all[k], all[j]] = [all[j], all[k]];
  }
  const palette = all.slice(0, cfg.colors);

  const cells = [];
  const maxRow = Math.min(MAXR, cfg.rows + 3);
  for (let r = 0; r < maxRow; r++) {
    const n = r & 1 ? COLS - 1 : COLS;
    for (let c = 0; c < n; c++) {
      if (!pattern(cfg.pat, r, c, cfg.rows)) continue;
      let col;
      const roll = rnd();
      const left = c > 0 ? grid[r][c - 1] : null;
      const ups = neighbors(r, c).filter(([rr, cc]) => rr < r && grid[rr][cc]);
      if (left && roll < 0.42) col = left.c;
      else if (ups.length && roll < 0.75) {
        const [rr, cc] = ups[Math.floor(rnd() * ups.length)];
        col = grid[rr][cc].c;
      } else col = palette[Math.floor(rnd() * palette.length)];
      grid[r][c] = { c: col };
      cells.push([r, c]);
    }
  }

  const pick = () => {
    for (let t = 0; t < 40; t++) {
      const [r, c] = cells[Math.floor(rnd() * cells.length)];
      const b = grid[r][c];
      if (b && !b.stone && !b.ice && !b.gold && !b.shift) return b;
    }
    return null;
  };

  for (const [r, c] of cells) {
    const b = grid[r][c];
    if (r >= 1 && cfg.stone && rnd() < cfg.stone) {
      grid[r][c] = { c: -1, stone: true };
    } else if (cfg.ice && rnd() < cfg.ice) {
      b.ice = true;
    }
  }
  for (let k = 0; k < (cfg.gold || 0); k++) {
    const b = pick();
    if (b) b.gold = true;
  }
  for (let k = 0; k < (cfg.shift || 0); k++) {
    const b = pick();
    if (b) {
      b.shift = true;
      b.n = palette[(palette.indexOf(b.c) + 1) % palette.length];
    }
  }

  // remove anything not connected to the ceiling
  const conn = connectedSet(grid);
  for (let r = 0; r < MAXR; r++)
    for (let c = 0; c < COLS; c++) if (grid[r][c] && !conn.has(r * 16 + c)) grid[r][c] = null;

  let count = 0;
  for (let r = 0; r < MAXR; r++) for (let c = 0; c < COLS; c++) if (grid[r][c] && !grid[r][c].stone) count++;

  return {
    cfg,
    grid,
    palette,
    count,
    par3: Math.ceil(count / 3.2),
    par2: Math.ceil(count / 2.2),
  };
}