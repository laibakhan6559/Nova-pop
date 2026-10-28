// Shared constants. Logical game space is W x H; the canvas is scaled to fit any screen.
export const R = 24; // bubble radius
export const COLS = 10;
export const W = COLS * 2 * R; // 480
export const H = 740;
export const TOP = 16; // ceiling thickness at start
export const ROW_H = R * Math.sqrt(3);
export const MAXR = 24;
export const SHOOTER_X = W / 2;
export const SHOOTER_Y = H - 62;
export const DEAD_Y = SHOOTER_Y - 70;
export const NEXT_X = SHOOTER_X - 100;
export const NEXT_Y = SHOOTER_Y + 8;
export const SPEED = 1150;

// Six elements: Fire, Lightning, Earth, Water, Shadow, Spirit
export const COLORS = [
  { name: 'fire', base: '#ff5a2c', light: '#ffc07a', dark: '#7a1708' },
  { name: 'lightning', base: '#ffd21f', light: '#fff6a8', dark: '#8a6200' },
  { name: 'earth', base: '#4fbf5a', light: '#c4f5b8', dark: '#175c25' },
  { name: 'water', base: '#2fa8ff', light: '#b6e6ff', dark: '#0a3f8a' },
  { name: 'shadow', base: '#9b5cff', light: '#dcc4ff', dark: '#33127a' },
  { name: 'spirit', base: '#ff6fb5', light: '#ffd0e8', dark: '#8a1a5a' },
];

export const POWERS = ['bomb', 'rainbow', 'lightning'];