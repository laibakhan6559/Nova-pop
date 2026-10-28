import { R, COLORS } from './config.js';

const TAU = Math.PI * 2;
const PAD = 5;
const LW = (R + PAD) * 2; // logical sprite size

// kept for compatibility: emblems are always shown now (every element has its own symbol)
export const view = { shapes: true };

// ---------- sprite cache ----------
const cache = new Map();
let cacheS = 0;

function sprite(key, S, draw) {
  if (S !== cacheS) {
    cache.clear();
    cacheS = S;
  }
  let s = cache.get(key);
  if (!s) {
    const size = Math.ceil(LW * S);
    s = document.createElement('canvas');
    s.width = s.height = size;
    const g = s.getContext('2d');
    g.scale(size / LW, size / LW);
    g.translate(LW / 2, LW / 2);
    draw(g);
    cache.set(key, s);
  }
  return s;
}

function blit(ctx, s, x, y, k) {
  const w = LW * k;
  ctx.drawImage(s, x - w / 2, y - w / 2, w, w);
}

function circle(g, r) {
  g.beginPath();
  g.arc(0, 0, r, 0, TAU);
}

// ---------- element emblems (drawn around 0,0, size s) ----------
function emblem(g, i, s) {
  g.beginPath();
  switch (i) {
    case 0: // fire - flame
      g.moveTo(0, -1.05 * s);
      g.bezierCurveTo(0.35 * s, -0.55 * s, 0.95 * s, -0.1 * s, 0.8 * s, 0.5 * s);
      g.bezierCurveTo(0.7 * s, 0.95 * s, 0.2 * s, 1.05 * s, 0, 1.05 * s);
      g.bezierCurveTo(-0.7 * s, 1.0 * s, -1.0 * s, 0.4 * s, -0.55 * s, -0.25 * s);
      g.bezierCurveTo(-0.5 * s, 0.05 * s, -0.3 * s, 0.1 * s, -0.2 * s, -0.1 * s);
      g.bezierCurveTo(-0.15 * s, -0.5 * s, -0.1 * s, -0.8 * s, 0, -1.05 * s);
      break;
    case 1: // lightning - bolt
      [[0.25, -1.1], [-0.65, 0.12], [-0.08, 0.12], [-0.3, 1.1], [0.7, -0.2], [0.1, -0.2]].forEach(([x, y], k) =>
        k ? g.lineTo(x * s, y * s) : g.moveTo(x * s, y * s),
      );
      g.closePath();
      break;
    case 2: // earth - leaf
      g.moveTo(-0.85 * s, 0.9 * s);
      g.quadraticCurveTo(-1.1 * s, -0.8 * s, 0.95 * s, -1.0 * s);
      g.quadraticCurveTo(1.1 * s, 0.8 * s, -0.85 * s, 0.9 * s);
      break;
    case 3: // water - drop
      g.moveTo(0, -1.1 * s);
      g.bezierCurveTo(0.25 * s, -0.6 * s, 0.9 * s, -0.05 * s, 0.9 * s, 0.35 * s);
      g.arc(0, 0.35 * s, 0.9 * s, 0, Math.PI);
      g.bezierCurveTo(-0.9 * s, -0.05 * s, -0.25 * s, -0.6 * s, 0, -1.1 * s);
      break;
    case 4: // shadow - crescent
      g.arc(0, 0, 1.0 * s, 0, TAU);
      g.moveTo(0.95 * s, -0.25 * s);
      g.arc(0.45 * s, -0.2 * s, 0.85 * s, 0, TAU, true);
      break;
    default: // spirit - four point star
      g.moveTo(0, -1.15 * s);
      g.quadraticCurveTo(0.12 * s, -0.12 * s, 1.15 * s, 0);
      g.quadraticCurveTo(0.12 * s, 0.12 * s, 0, 1.15 * s);
      g.quadraticCurveTo(-0.12 * s, 0.12 * s, -1.15 * s, 0);
      g.quadraticCurveTo(-0.12 * s, -0.12 * s, 0, -1.15 * s);
  }
  g.closePath();
}

function paintRuneOrb(g, i) {
  const col = COLORS[i];
  // outer bezel (dark metal)
  const m = g.createRadialGradient(-R * 0.4, -R * 0.5, 2, 0, 0, R);
  m.addColorStop(0, '#6a5d80');
  m.addColorStop(0.6, '#241d33');
  m.addColorStop(1, '#0c0913');
  g.fillStyle = m;
  circle(g, R);
  g.fill();
  // coloured rim light
  g.strokeStyle = col.base;
  g.lineWidth = 2.4;
  g.beginPath();
  g.arc(0, 0, R - 1.6, 0, TAU);
  g.stroke();
  // rim studs
  g.fillStyle = col.light;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + 0.2;
    g.beginPath();
    g.arc(Math.cos(a) * (R - 1.6), Math.sin(a) * (R - 1.6), 1.3, 0, TAU);
    g.fill();
  }
  // glowing core
  const core = g.createRadialGradient(-R * 0.15, -R * 0.2, 1, 0, 0, R - 4.5);
  core.addColorStop(0, col.light);
  core.addColorStop(0.35, col.base);
  core.addColorStop(1, col.dark);
  g.fillStyle = core;
  circle(g, R - 5);
  g.fill();
  // inner shadow ring
  g.strokeStyle = 'rgba(0,0,0,0.45)';
  g.lineWidth = 1.6;
  g.beginPath();
  g.arc(0, 0, R - 5.8, 0, TAU);
  g.stroke();
  // emblem: dark relief + bright face
  g.save();
  g.translate(0, 0.6);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.translate(1, 1.4);
  emblem(g, i, R * 0.44);
  g.fill('evenodd');
  g.restore();
  g.fillStyle = '#fff';
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 1;
  g.save();
  g.translate(0, 0.6);
  emblem(g, i, R * 0.44);
  g.fill('evenodd');
  g.stroke();
  g.restore();
  // glass glint
  g.strokeStyle = 'rgba(255,255,255,0.7)';
  g.lineWidth = 2.4;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(0, 0, R - 8.2, Math.PI * 1.1, Math.PI * 1.45);
  g.stroke();
  g.strokeStyle = 'rgba(0,0,0,0.6)';
  g.lineWidth = 1.2;
  g.beginPath();
  g.arc(0, 0, R - 0.6, 0, TAU);
  g.stroke();
}

const orbSprite = (c, S) => sprite(`r${c}`, S, (g) => paintRuneOrb(g, c));

const stoneSprite = (S) =>
  sprite('stone', S, (g) => {
    const grd = g.createRadialGradient(-R * 0.35, -R * 0.4, 2, 0, 0, R);
    grd.addColorStop(0, '#5a5566');
    grd.addColorStop(0.55, '#1e1a28');
    grd.addColorStop(1, '#07050b');
    g.fillStyle = grd;
    circle(g, R);
    g.fill();
    g.strokeStyle = '#ff3d2e';
    g.shadowColor = '#ff3d2e';
    g.shadowBlur = 6;
    g.lineWidth = 1.8;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(-R * 0.5, -R * 0.2);
    g.lineTo(-R * 0.1, -R * 0.05);
    g.lineTo(-R * 0.2, R * 0.45);
    g.moveTo(-R * 0.1, -R * 0.05);
    g.lineTo(R * 0.35, R * 0.1);
    g.lineTo(R * 0.5, R * 0.5);
    g.moveTo(R * 0.12, -R * 0.55);
    g.lineTo(R * 0.15, -R * 0.15);
    g.stroke();
    g.shadowBlur = 0;
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    g.lineWidth = 1.4;
    g.beginPath();
    g.arc(0, 0, R - 2, Math.PI * 1.05, Math.PI * 1.4);
    g.stroke();
    g.strokeStyle = '#000';
    g.lineWidth = 1.6;
    g.beginPath();
    g.arc(0, 0, R - 0.8, 0, TAU);
    g.stroke();
  });

const iceSprite = (S) =>
  sprite('ice', S, (g) => {
    g.fillStyle = 'rgba(205,238,255,0.5)';
    circle(g, R);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.95)';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(0, 0, R - 1.5, 0, TAU);
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = 1.5;
    g.beginPath();
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI) / 3 + 0.3;
      g.moveTo(Math.cos(a) * R * 0.8, Math.sin(a) * R * 0.8);
      g.lineTo(-Math.cos(a) * R * 0.8, -Math.sin(a) * R * 0.8);
    }
    g.stroke();
  });

const goldStarSprite = (S) =>
  sprite('gold', S, (g) => {
    // little golden crown at the top of the orb
    g.translate(0, -R * 0.62);
    g.beginPath();
    g.moveTo(-8, 4);
    g.lineTo(-9, -4);
    g.lineTo(-4, 0);
    g.lineTo(0, -6);
    g.lineTo(4, 0);
    g.lineTo(9, -4);
    g.lineTo(8, 4);
    g.closePath();
    g.fillStyle = '#ffd54a';
    g.fill();
    g.strokeStyle = '#7a4a00';
    g.lineWidth = 1.4;
    g.stroke();
  });

// Meteor (bomb): molten rock with lava cracks
const meteorSprite = (S) =>
  sprite('bomb', S, (g) => {
    const grd = g.createRadialGradient(-R * 0.3, -R * 0.35, 2, 0, 0, R);
    grd.addColorStop(0, '#7a5440');
    grd.addColorStop(0.55, '#2c1a14');
    grd.addColorStop(1, '#0b0504');
    g.fillStyle = grd;
    g.beginPath();
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * TAU;
      const rr = R - 1 - (k % 2 ? 2.5 : 0);
      k ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
    g.strokeStyle = '#ff8a2a';
    g.shadowColor = '#ff5a00';
    g.shadowBlur = 8;
    g.lineWidth = 2.2;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(-R * 0.6, -R * 0.1);
    g.lineTo(-R * 0.2, R * 0.05);
    g.lineTo(0, -R * 0.4);
    g.lineTo(R * 0.3, -R * 0.1);
    g.lineTo(R * 0.6, R * 0.2);
    g.moveTo(-R * 0.2, R * 0.05);
    g.lineTo(-R * 0.1, R * 0.55);
    g.moveTo(R * 0.3, -R * 0.1);
    g.lineTo(R * 0.25, R * 0.5);
    g.stroke();
    g.shadowBlur = 0;
  });

// Storm (lightning): dark thundercloud orb with a golden bolt
const stormSprite = (S) =>
  sprite('bolt', S, (g) => {
    const grd = g.createRadialGradient(-R * 0.3, -R * 0.35, 2, 0, 0, R);
    grd.addColorStop(0, '#5b6fc0');
    grd.addColorStop(0.55, '#1a2150');
    grd.addColorStop(1, '#070a1c');
    g.fillStyle = grd;
    circle(g, R);
    g.fill();
    g.strokeStyle = '#8fb4ff';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(0, 0, R - 2, 0, TAU);
    g.stroke();
    g.shadowColor = '#ffe14a';
    g.shadowBlur = 8;
    g.fillStyle = '#ffe14a';
    emblemBolt(g);
    g.shadowBlur = 0;
    g.strokeStyle = '#7a5000';
    g.lineWidth = 1.2;
    emblemBolt(g);
    g.stroke();
  });
function emblemBolt(g) {
  const s = R * 0.62;
  g.beginPath();
  [[0.25, -1.1], [-0.65, 0.12], [-0.08, 0.12], [-0.3, 1.1], [0.7, -0.2], [0.1, -0.2]].forEach(([x, y], k) =>
    k ? g.lineTo(x * s, y * s) : g.moveTo(x * s, y * s),
  );
  g.closePath();
  g.fill();
}

// ---------- live (animated) bits ----------
// Prism (rainbow): faceted crystal with rotating spectrum
function prism(ctx, x, y, t, k) {
  const r = R * k;
  if (ctx.createConicGradient) {
    const g = ctx.createConicGradient(t * 2.2, x, y);
    ['#ff4757', '#ffd32a', '#2ed573', '#18dcff', '#8c52ff', '#ff4fd8', '#ff4757'].forEach((c, i) => g.addColorStop(i / 6, c));
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = '#c9a0ff';
  }
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + Math.PI / 6;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i < 6; i += 2) {
    const a = (i / 6) * TAU + Math.PI / 6;
    ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    ctx.lineTo(x + Math.cos(a + Math.PI) * r, y + Math.sin(a + Math.PI) * r);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.5, y - r * 0.2);
  ctx.lineTo(x, y - r * 0.8);
  ctx.lineTo(x + r * 0.4, y - r * 0.3);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw any bubble kind.
 * b: { c, stone?, ice?, gold?, shift?, n?, sp? }   sp = 'bomb' | 'rainbow' | 'lightning'
 */
export function drawBubble(ctx, S, x, y, b, t = 0, k = 1) {
  const sS = Math.max(1, Math.round(S * 4) / 4);
  if (b.sp === 'bomb') {
    blit(ctx, meteorSprite(sS), x, y, k);
    for (let i = 0; i < 3; i++) {
      const f = 0.5 + 0.5 * Math.sin(t * 22 + i * 2.1);
      ctx.fillStyle = i === 1 ? '#ffe36a' : '#ff7a1a';
      ctx.beginPath();
      const fx = x + (i - 1) * 7 * k;
      ctx.moveTo(fx - 3 * k, y - R * 0.8 * k);
      ctx.quadraticCurveTo(fx, y - (R + 6 + 9 * f) * k, fx + 3 * k, y - R * 0.8 * k);
      ctx.fill();
    }
    return;
  }
  if (b.sp === 'lightning') {
    blit(ctx, stormSprite(sS), x, y, k);
    ctx.strokeStyle = `rgba(255,236,120,${0.45 + 0.45 * Math.sin(t * 16)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, (R + 2) * k, 0, TAU);
    ctx.stroke();
    return;
  }
  if (b.sp === 'rainbow') {
    prism(ctx, x, y, t, k);
    return;
  }
  if (b.stone) {
    blit(ctx, stoneSprite(sS), x, y, k);
    return;
  }
  blit(ctx, orbSprite(b.c, sS), x, y, k);
  // living glow
  ctx.strokeStyle = COLORS[b.c].light;
  ctx.globalAlpha = 0.18 + 0.18 * Math.sin(t * 2.4 + x * 0.05 + y * 0.037);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, (R - 4) * k, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 1;
  if (b.ice) blit(ctx, iceSprite(sS), x, y, k);
  if (b.gold) {
    blit(ctx, goldStarSprite(sS), x, y, k);
    ctx.strokeStyle = `rgba(255,214,64,${0.6 + 0.4 * Math.sin(t * 5)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, (R - 1.2) * k, 0, TAU);
    ctx.stroke();
  }
  if (b.shift) {
    ctx.save();
    ctx.setLineDash([5 * k, 5 * k]);
    ctx.lineDashOffset = -t * 18;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(x, y, (R - 2.5) * k, 0, TAU);
    ctx.stroke();
    ctx.restore();
    const nc = COLORS[b.n ?? 0];
    ctx.fillStyle = nc.base;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + R * 0.5 * k, y + R * 0.5 * k, R * 0.26 * k, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
}

export function particleColor(b) {
  if (b.sp === 'bomb') return '#ff7a2f';
  if (b.stone) return '#ff3d2e';
  if (b.c >= 0) return COLORS[b.c].base;
  return '#ffffff';
}