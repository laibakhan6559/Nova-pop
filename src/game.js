import {
  R, W, H, TOP, ROW_H, MAXR, COLS, SHOOTER_X, SHOOTER_Y, DEAD_Y, NEXT_X, NEXT_Y, SPEED, COLORS, POWERS,
} from './config.js';
import { colsIn, neighbors, connectedSet } from './grid.js';
import { buildLevel } from './levels.js';
import { drawBubble, particleColor } from './render.js';
import { sfx, unlock } from './audio.js';

const TAU = Math.PI * 2;
const MIN_A = 0.18;
const MAX_A = Math.PI - 0.18;
const POP_T = 0.22;
const THEMES = ['#ff8a4a', '#4fb8ff', '#ffd21f', '#b78cff'];

export class Game {
  constructor(canvas, hooks) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.hooks = hooks;
    this.view = { S: 1, spriteS: 1 };
    this.t = 0;
    this.paused = false;
    this.state = 'idle'; // idle | ready | flying | won | lost
    this.angle = Math.PI / 2;
    this.keys = { left: false, right: false };
    this.aiming = false;
    this.level = 0;
    this.bokeh = Array.from({ length: 16 }, () => ({
      x: Math.random() * W, y: Math.random() * H, r: 10 + Math.random() * 38,
      v: 6 + Math.random() * 14, a: 0.04 + Math.random() * 0.08,
    }));
    this.clearFx();
    this.grid = Array.from({ length: MAXR }, () => Array(COLS).fill(null));
    this.cur = { c: 0 };
    this.next = { c: 0 };
    this.stash = null;
    this.inv = { bomb: 0, rainbow: 0, lightning: 0 };
    this.cfg = { drop: 8 };
    this.palette = [0, 1, 2];
    this.bindPointer();
  }

  // ---------------------------------------------------------------- setup
  clearFx() {
    this.pops = [];
    this.falling = [];
    this.parts = [];
    this.texts = [];
    this.rings = [];
    this.bolts = [];
    this.shake = 0;
  }

  loadLevel(i) {
    const L = buildLevel(i);
    this.level = i;
    this.cfg = L.cfg;
    this.grid = L.grid;
    this.palette = L.palette;
    this.par3 = L.par3;
    this.par2 = L.par2;
    this.total = L.count;
    this.offY = 0;
    this.offTarget = 0;
    this.miss = 0;
    this.shots = 0;
    this.score = 0;
    this.combo = 0;
    this.hints = L.cfg.hints;
    this.inv = { bomb: 0, rainbow: 0, lightning: 0, ...(L.cfg.pu || {}) };
    this.clearFx();
    this.proj = null;
    this.stash = null;
    this.hintUntil = 0;
    this.danger = 0;
    this.ended = false;
    this.endTimer = 0;
    this.cur = this.randBubble();
    this.next = this.randBubble();
    this.paused = false;
    this.state = 'ready';
    this.emit();
  }

  resize(availW, availH) {
    const scale = Math.max(0.1, Math.min(availW / W, availH / H));
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const cssW = Math.floor(W * scale);
    const cssH = Math.floor(H * scale);
    this.cv.style.width = cssW + 'px';
    this.cv.style.height = cssH + 'px';
    this.cv.width = Math.round(cssW * dpr);
    this.cv.height = Math.round(cssH * dpr);
    this.view.S = (cssW * dpr) / W;
    this.view.spriteS = this.view.S;
  }

  emit() {
    this.hooks.onHud?.({
      level: this.level,
      score: this.score,
      shots: this.shots,
      inv: { ...this.inv },
      hints: this.hints,
      active: this.cur?.sp || null,
    });
  }

  over() {
    return this.state === 'won' || this.state === 'lost' || this.state === 'idle';
  }

  // ---------------------------------------------------------------- geometry helpers
  xAt(r, c) {
    return R + c * 2 * R + (r & 1 ? R : 0);
  }
  yAt(r, off = this.offY) {
    return TOP + R + r * ROW_H + off;
  }
  pos(r, c) {
    return { x: this.xAt(r, c), y: this.yAt(r) };
  }

  presentColors() {
    const s = new Set();
    for (let r = 0; r < MAXR; r++)
      for (let c = 0; c < COLS; c++) {
        const b = this.grid[r][c];
        if (b && !b.stone && b.c >= 0) s.add(b.c);
      }
    return [...s];
  }

  randBubble() {
    const p = this.presentColors();
    const list = p.length ? p : this.palette;
    return { c: list[Math.floor(Math.random() * list.length)] };
  }

  fixColors() {
    const p = this.presentColors();
    if (!p.length) return;
    const fix = (b) => {
      if (b && !b.sp && !p.includes(b.c)) b.c = p[Math.floor(Math.random() * p.length)];
    };
    fix(this.cur);
    fix(this.next);
    fix(this.stash);
  }

  advance() {
    if (this.stash) {
      this.cur = this.stash;
      this.stash = null;
    } else {
      this.cur = this.next;
      this.next = this.randBubble();
    }
  }

  // ---------------------------------------------------------------- input
  local(e) {
    const rect = this.cv.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
  }

  bindPointer() {
    const cv = this.cv;
    cv.addEventListener('pointerdown', (e) => {
      if (this.paused || this.over()) return;
      unlock();
      const p = this.local(e);
      if (Math.hypot(p.x - NEXT_X, p.y - NEXT_Y) < 42) {
        this.swap();
        return;
      }
      this.aiming = true;
      try { cv.setPointerCapture(e.pointerId); } catch { /* noop */ }
      this.aimAt(p);
    });
    cv.addEventListener('pointermove', (e) => {
      if (this.paused || this.over()) return;
      if (this.aiming || e.pointerType === 'mouse') this.aimAt(this.local(e));
    });
    cv.addEventListener('pointerup', (e) => {
      if (!this.aiming) return;
      this.aiming = false;
      if (this.paused || this.over()) return;
      const p = this.local(e);
      this.aimAt(p);
      if (p.y > SHOOTER_Y + 52) return; // drag below the launcher to cancel
      this.fire();
    });
    cv.addEventListener('pointercancel', () => (this.aiming = false));
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  aimAt(p) {
    const dx = p.x - SHOOTER_X;
    const dy = SHOOTER_Y - p.y;
    let a = Math.atan2(dy, dx);
    if (a < 0) a = dx >= 0 ? 0 : Math.PI;
    this.angle = Math.min(MAX_A, Math.max(MIN_A, a));
  }

  swap() {
    if (this.over() || this.cur.sp || this.stash) return;
    [this.cur, this.next] = [this.next, this.cur];
    sfx.click();
    this.emit();
  }

  usePower(name) {
    if (this.state !== 'ready' || this.paused) return;
    unlock();
    if (this.cur.sp === name) {
      this.inv[name]++;
      this.cur = this.stash;
      this.stash = null;
      sfx.click();
      this.emit();
      return;
    }
    if (this.inv[name] <= 0) {
      sfx.deny();
      return;
    }
    if (this.cur.sp) this.inv[this.cur.sp]++;
    else this.stash = this.cur;
    this.inv[name]--;
    this.cur = { sp: name };
    sfx.power();
    this.emit();
  }

  useHint() {
    if (this.state !== 'ready' || this.paused) return;
    unlock();
    if (this.hints <= 0) {
      sfx.deny();
      return;
    }
    const best = this.suggest();
    if (!best) return;
    this.hints--;
    this.angle = best.angle;
    this.hintUntil = this.t + 3.5;
    sfx.power();
    this.hooks.onToast?.('Best shot highlighted');
    this.emit();
  }

  fire() {
    if (this.state !== 'ready' || this.paused) return;
    if (this.offY < this.offTarget - 0.5) return;
    unlock();
    const a = this.angle;
    const b = this.cur;
    this.proj = { x: SHOOTER_X, y: SHOOTER_Y, dx: Math.cos(a), dy: -Math.sin(a), b };
    this.advance();
    this.state = 'flying';
    this.shots++;
    this.hintUntil = 0;
    sfx.shoot();
    this.emit();
  }

  // ---------------------------------------------------------------- physics
  collides(x, y) {
    if (y <= TOP + this.offY + R) return true;
    const r0 = Math.round((y - TOP - R - this.offY) / ROW_H);
    const lim = (R * 1.76) * (R * 1.76);
    for (let r = Math.max(0, r0 - 2); r <= Math.min(MAXR - 1, r0 + 2); r++) {
      const row = this.grid[r];
      const n = colsIn(r);
      for (let c = 0; c < n; c++) {
        if (!row[c]) continue;
        const dx = x - this.xAt(r, c);
        const dy = y - this.yAt(r);
        if (dx * dx + dy * dy < lim) return true;
      }
    }
    return false;
  }

  // nearest empty cell (that is attached to something) for a point
  snap(x, y) {
    const r0 = Math.round((y - TOP - R - this.offY) / ROW_H);
    let best = null;
    let bd = Infinity;
    const scan = (rFrom, rTo) => {
      for (let r = Math.max(0, rFrom); r <= Math.min(MAXR - 1, rTo); r++) {
        const n = colsIn(r);
        for (let c = 0; c < n; c++) {
          if (this.grid[r][c]) continue;
          if (r > 0 && !neighbors(r, c).some(([rr, cc]) => this.grid[rr][cc])) continue;
          const dx = x - this.xAt(r, c);
          const dy = y - this.yAt(r);
          const d = dx * dx + dy * dy;
          if (d < bd) {
            bd = d;
            best = { r, c };
          }
        }
      }
    };
    scan(r0 - 2, r0 + 2);
    if (!best) scan(0, MAXR - 1);
    return best;
  }

  trace(angle) {
    let x = SHOOTER_X;
    let y = SHOOTER_Y;
    let dx = Math.cos(angle);
    const dy = -Math.sin(angle);
    const pts = [{ x, y }];
    for (let len = 0; len < 2600; len += 6) {
      x += dx * 6;
      y += dy * 6;
      if (x < R) {
        x = 2 * R - x;
        dx = -dx;
        pts.push({ x: R, y });
      } else if (x > W - R) {
        x = 2 * (W - R) - x;
        dx = -dx;
        pts.push({ x: W - R, y });
      }
      if (this.collides(x, y)) break;
    }
    pts.push({ x, y });
    return { pts, end: { x, y } };
  }

  stepProj(dt) {
    const p = this.proj;
    let dist = SPEED * dt;
    while (dist > 0 && this.state === 'flying') {
      const d = Math.min(5, dist);
      dist -= d;
      p.x += p.dx * d;
      p.y += p.dy * d;
      if (p.x < R) {
        p.x = 2 * R - p.x;
        p.dx = -p.dx;
      } else if (p.x > W - R) {
        p.x = 2 * (W - R) - p.x;
        p.dx = -p.dx;
      }
      if (this.collides(p.x, p.y)) {
        this.land(p);
        break;
      }
    }
  }

  // ---------------------------------------------------------------- resolution
  cluster(r, c, color) {
    const out = [];
    const seen = new Set([r * 16 + c]);
    const st = [[r, c]];
    while (st.length) {
      const [cr, cc] = st.pop();
      out.push([cr, cc]);
      for (const [rr, c2] of neighbors(cr, cc)) {
        const k = rr * 16 + c2;
        const b = this.grid[rr][c2];
        if (seen.has(k) || !b || b.stone || b.ice || b.c !== color) continue;
        seen.add(k);
        st.push([rr, c2]);
      }
    }
    return out;
  }

  ball(r, c, depth) {
    const seen = new Set([r * 16 + c]);
    let frontier = [[r, c]];
    const all = [[r, c]];
    for (let d = 0; d < depth; d++) {
      const nf = [];
      for (const [cr, cc] of frontier)
        for (const [rr, c2] of neighbors(cr, cc)) {
          const k = rr * 16 + c2;
          if (seen.has(k)) continue;
          seen.add(k);
          nf.push([rr, c2]);
          all.push([rr, c2]);
        }
      frontier = nf;
    }
    return all;
  }

  pickRainbow(r, c) {
    let bestCol = this.palette[0];
    let bestN = -1;
    const cols = this.presentColors();
    for (const col of cols.length ? cols : this.palette) {
      this.grid[r][c] = { c: col };
      const n = this.cluster(r, c, col).length;
      if (n > bestN) {
        bestN = n;
        bestCol = col;
      }
    }
    this.grid[r][c] = null;
    return bestCol;
  }

  land(p) {
    const cell = this.snap(p.x, p.y);
    this.proj = null;
    if (!cell) {
      this.state = 'ready';
      return;
    }
    const { r, c } = cell;
    const at = this.pos(r, c);
    this.lastX = at.x;
    this.lastY = at.y;
    const sp = p.b.sp;
    let removed = 0;
    if (sp === 'bomb') {
      removed = this.explode(r, c);
    } else if (sp === 'lightning') {
      removed = this.zap(r);
    } else {
      let col = p.b.c;
      if (sp === 'rainbow') {
        col = this.pickRainbow(r, c);
        sfx.rainbow();
        this.rings.push({ x: at.x, y: at.y, t: 0, life: 0.5, r1: R * 2.4, col: '#ffffff' });
      }
      this.grid[r][c] = { c: col };
      sfx.land();
      const cl = this.cluster(r, c, col);
      if (cl.length >= 3) removed = this.removeCells(cl);
    }
    this.afterShot(removed, sp);
  }

  explode(r, c) {
    const at = this.pos(r, c);
    this.rings.push({ x: at.x, y: at.y, t: 0, life: 0.55, r1: R * 4.2, col: '#ffb347' });
    this.rings.push({ x: at.x, y: at.y, t: 0, life: 0.35, r1: R * 2.6, col: '#ffffff' });
    this.shake = 12;
    sfx.bomb();
    for (let i = 0; i < 26; i++) this.spark(at.x, at.y, ['#ff7a2f', '#ffd32a', '#ff4757'][i % 3], 420);
    const cells = this.ball(r, c, 2).filter(([rr, cc]) => this.grid[rr][cc]);
    return this.removeCells(cells);
  }

  zap(r) {
    const y = this.yAt(r);
    const pts = [];
    for (let x = 0; x <= W; x += 32) pts.push([x, y + (Math.random() - 0.5) * 22]);
    this.bolts.push({ pts, t: 0, life: 0.45 });
    this.shake = 7;
    sfx.bolt();
    const cells = [];
    for (let c = 0; c < colsIn(r); c++) if (this.grid[r][c]) cells.push([r, c]);
    return this.removeCells(cells);
  }

  removeCells(cells) {
    let n = 0;
    const fire = [];
    cells.forEach(([r, c], i) => {
      const b = this.grid[r][c];
      if (!b) return;
      if (b.c === 0 && !b.stone) fire.push([r, c]);
      this.grid[r][c] = null;
      n++;
      const { x, y } = this.pos(r, c);
      this.pops.push({ x, y, b, delay: i * 0.03, t: 0, started: false, i });
      if (b.gold) this.awardPower();
    });
    for (const [r, c] of cells)
      for (const [rr, cc] of neighbors(r, c)) {
        const nb = this.grid[rr][cc];
        if (nb && nb.ice) {
          nb.ice = false;
          const q = this.pos(rr, cc);
          sfx.crack();
          for (let k = 0; k < 6; k++) this.spark(q.x, q.y, '#d8f4ff', 220);
        }
      }
    // Fire melts frozen bubbles up to two cells away
    for (const [r, c] of fire)
      for (const [rr, cc] of this.ball(r, c, 2)) {
        const nb = this.grid[rr][cc];
        if (nb && nb.ice) {
          nb.ice = false;
          const q = this.pos(rr, cc);
          sfx.crack();
          for (let k = 0; k < 6; k++) this.spark(q.x, q.y, '#ff9a4a', 220);
        }
      }
    return n;
  }

  dropFloating() {
    const conn = connectedSet(this.grid);
    let n = 0;
    for (let r = 0; r < MAXR; r++)
      for (let c = 0; c < colsIn(r); c++) {
        const b = this.grid[r][c];
        if (!b || conn.has(r * 16 + c)) continue;
        this.grid[r][c] = null;
        n++;
        const { x, y } = this.pos(r, c);
        this.falling.push({
          x, y, b, vx: (Math.random() - 0.5) * 140, vy: -120 - Math.random() * 160,
          rot: 0, vr: (Math.random() - 0.5) * 9, delay: 0.1 + Math.random() * 0.12,
        });
        if (b.gold) this.awardPower();
      }
    return n;
  }

  awardPower() {
    const name = POWERS[Math.floor(Math.random() * POWERS.length)];
    if (this.inv[name] < 9) this.inv[name]++;
    sfx.power();
    this.hooks.onToast?.('+1 ' + name[0].toUpperCase() + name.slice(1) + '!');
  }

  stepShifters() {
    const L = this.palette.length;
    for (let r = 0; r < MAXR; r++)
      for (let c = 0; c < colsIn(r); c++) {
        const b = this.grid[r][c];
        if (b && b.shift) {
          b.c = b.n;
          b.n = this.palette[(this.palette.indexOf(b.c) + 1) % L];
        }
      }
  }

  ceilingDrop() {
    this.offTarget += ROW_H;
    this.shake = 6;
    sfx.drop();
    this.hooks.onToast?.('The ceiling is coming down!');
  }

  afterShot(removed, sp) {
    let floatN = 0;
    if (removed > 0) floatN = this.dropFloating();
    if (removed > 0) this.combo++;
    else this.combo = 0;
    const mult = 1 + Math.max(0, this.combo - 1) * 0.5;
    const gain = Math.round(removed * 10 * mult + floatN * 25 * mult);
    if (gain > 0) {
      this.score += gain;
      this.texts.push({ x: this.lastX, y: this.lastY, txt: '+' + gain, t: 0, life: 1, col: '#ffffff', size: 22 });
    }
    if (this.combo >= 2) {
      this.texts.push({ x: W / 2, y: 190, txt: 'COMBO x' + this.combo, t: 0, life: 1.1, col: '#ffe066', size: 34 });
    }
    if (!sp && removed >= 7) this.awardPower();
    if (removed === 0) {
      this.miss++;
      if (this.miss >= this.cfg.drop) {
        this.miss = 0;
        this.ceilingDrop();
      }
    } else {
      this.miss = 0;
    }
    this.stepShifters();
    if (this.checkEnd()) {
      this.emit();
      return;
    }
    this.state = 'ready';
    this.fixColors();
    this.emit();
  }

  checkEnd() {
    let left = 0;
    let lowest = -1;
    for (let r = 0; r < MAXR; r++)
      for (let c = 0; c < colsIn(r); c++) {
        const b = this.grid[r][c];
        if (b) {
          if (!b.stone) left++;
          lowest = r;
        }
      }
    if (left === 0) {
      this.win();
      return true;
    }
    if (lowest >= 0 && this.yAt(lowest, this.offTarget) + R > DEAD_Y) {
      this.state = 'lost';
      this.endTimer = 0.9;
      return true;
    }
    return false;
  }

  win() {
    this.state = 'won';
    this.endTimer = 1.1;
    let i = 0;
    for (let r = 0; r < MAXR; r++)
      for (let c = 0; c < colsIn(r); c++) {
        const b = this.grid[r][c];
        if (!b) continue;
        this.grid[r][c] = null;
        const { x, y } = this.pos(r, c);
        this.falling.push({ x, y, b, vx: (Math.random() - 0.5) * 140, vy: -100, rot: 0, vr: (Math.random() - 0.5) * 8, delay: 0.05 * i++ });
      }
    this.score += Math.max(0, (this.par2 - this.shots)) * 15;
  }

  stars() {
    return this.shots <= this.par3 ? 3 : this.shots <= this.par2 ? 2 : 1;
  }

  // ---------------------------------------------------------------- hint / bot helper
  evalCell(r, c, b) {
    if (b.sp === 'bomb') {
      let n = 0;
      for (const [rr, cc] of this.ball(r, c, 2)) if (this.grid[rr][cc]) n++;
      return n * 5;
    }
    if (b.sp === 'lightning') {
      let n = 0;
      for (let cc = 0; cc < colsIn(r); cc++) if (this.grid[r][cc]) n++;
      return n * 5;
    }
    let col = b.c;
    if (b.sp === 'rainbow') col = this.pickRainbow(r, c);
    this.grid[r][c] = { c: col };
    const n = this.cluster(r, c, col).length;
    this.grid[r][c] = null;
    return n >= 3 ? n * 10 : n - r * 0.01;
  }

  suggest() {
    let best = null;
    for (let a = MIN_A; a <= MAX_A; a += 0.02) {
      const { end } = this.trace(a);
      const cell = this.snap(end.x, end.y);
      if (!cell) continue;
      const s = this.evalCell(cell.r, cell.c, this.cur);
      if (!best || s > best.score) best = { angle: a, score: s, cell };
    }
    return best;
  }

  // ---------------------------------------------------------------- fx
  spark(x, y, col, speed = 300) {
    const a = Math.random() * TAU;
    const v = speed * (0.3 + Math.random() * 0.7);
    this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life: 0.5 + Math.random() * 0.4, max: 0.9, col, size: 2 + Math.random() * 3.2 });
  }

  update(dt) {
    dt = Math.min(dt, 0.05);
    if (this.paused) return;
    this.t += dt;

    if (this.keys.left) this.angle = Math.min(MAX_A, this.angle + 1.6 * dt);
    if (this.keys.right) this.angle = Math.max(MIN_A, this.angle - 1.6 * dt);

    if (this.offY < this.offTarget) this.offY = Math.min(this.offTarget, this.offY + 300 * dt);
    if (this.state === 'flying' && this.proj) this.stepProj(dt);

    // pops
    for (const p of this.pops) {
      if (p.delay > 0) {
        p.delay -= dt;
        continue;
      }
      if (!p.started) {
        p.started = true;
        sfx.pop(p.i);
        const col = particleColor(p.b);
        for (let k = 0; k < 7; k++) this.spark(p.x, p.y, col, 320);
        if (p.b.gold) for (let k = 0; k < 8; k++) this.spark(p.x, p.y, '#ffd54a', 380);
      }
      p.t += dt;
    }
    this.pops = this.pops.filter((p) => p.t < POP_T);

    for (const f of this.falling) {
      if (f.delay > 0) {
        f.delay -= dt;
        continue;
      }
      f.vy += 2000 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rot += f.vr * dt;
    }
    this.falling = this.falling.filter((f) => f.y < H + 60);

    for (const p of this.parts) {
      p.life -= dt;
      p.vy += 900 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const x of this.texts) x.t += dt;
    this.texts = this.texts.filter((x) => x.t < x.life);
    for (const x of this.rings) x.t += dt;
    this.rings = this.rings.filter((x) => x.t < x.life);
    for (const x of this.bolts) x.t += dt;
    this.bolts = this.bolts.filter((x) => x.t < x.life);
    this.shake = Math.max(0, this.shake - dt * 36);
    for (const b of this.bokeh) {
      b.y -= b.v * dt;
      if (b.y < -b.r) {
        b.y = H + b.r;
        b.x = Math.random() * W;
      }
    }

    // danger
    let lowBottom = 0;
    for (let r = MAXR - 1; r >= 0; r--) {
      if (this.grid[r].some((b) => b)) {
        lowBottom = this.yAt(r) + R;
        break;
      }
    }
    const want = lowBottom > DEAD_Y - 2.2 * ROW_H ? 1 : 0;
    this.danger += (want - this.danger) * Math.min(1, dt * 6);

    if (this.state === 'won' || this.state === 'lost') {
      this.endTimer -= dt;
      if (this.endTimer <= 0 && !this.ended) {
        this.ended = true;
        if (this.state === 'won') this.hooks.onWin?.({ stars: this.stars(), score: this.score, shots: this.shots, level: this.level });
        else this.hooks.onLose?.({ level: this.level });
      }
    }
  }

  // ---------------------------------------------------------------- rendering
  render() {
    const ctx = this.ctx;
    const S = this.view.S;
    const sS = this.view.spriteS;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.cv.width, this.cv.height);
    let sx = 0;
    let sy = 0;
    if (this.shake > 0) {
      sx = (Math.random() - 0.5) * this.shake;
      sy = (Math.random() - 0.5) * this.shake;
    }
    ctx.setTransform(S, 0, 0, S, sx * S, sy * S);
    const t = this.t;

    // dark sanctum + rotating rune wheel + embers
    ctx.fillStyle = 'rgba(6,4,16,0.62)';
    ctx.fillRect(-20, -20, W + 40, H + 40);
    const tint = THEMES[this.cfg.world ?? 0];
    ctx.save();
    ctx.translate(W / 2, 330);
    ctx.rotate(t * 0.05);
    ctx.strokeStyle = tint;
    ctx.globalAlpha = 0.14;
    ctx.lineWidth = 2;
    for (const rr of [120, 190, 250]) {
      ctx.beginPath();
      ctx.arc(0, 0, rr, 0, TAU);
      ctx.stroke();
    }
    for (let i = 0; i < 60; i++) {
      const a2 = (i / 60) * TAU;
      const l = i % 5 === 0 ? 16 : 7;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a2) * 250, Math.sin(a2) * 250);
      ctx.lineTo(Math.cos(a2) * (250 + l), Math.sin(a2) * (250 + l));
      ctx.stroke();
    }
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a2 = (i / 6) * TAU;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a2) * 190, Math.sin(a2) * 190);
    }
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a2 = (i / 6) * TAU * 2;
      const x2 = Math.cos(a2) * 190;
      const y2 = Math.sin(a2) * 190;
      if (i) ctx.lineTo(x2, y2);
      else ctx.moveTo(x2, y2);
    }
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = tint;
    for (const b of this.bokeh) {
      ctx.globalAlpha = Math.min(0.7, b.a * 5);
      ctx.beginPath();
      ctx.arc(b.x, b.y, 1 + b.r * 0.06, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const launch = ctx.createLinearGradient(0, DEAD_Y, 0, H);
    launch.addColorStop(0, 'rgba(255,255,255,0)');
    launch.addColorStop(1, 'rgba(255,190,90,0.12)');
    ctx.fillStyle = launch;
    ctx.fillRect(0, DEAD_Y, W, H - DEAD_Y);

    // ceiling
    const ch = TOP + this.offY;
    const cg = ctx.createLinearGradient(0, 0, 0, ch);
    cg.addColorStop(0, '#3b3350');
    cg.addColorStop(1, '#1a1526');
    ctx.fillStyle = cg;
    ctx.fillRect(-20, -20, W + 40, ch + 20);
    ctx.fillStyle = '#e0b04a';
    for (let x = 0; x < W + 28; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, ch - 9);
      ctx.lineTo(x + 12, ch - 9);
      ctx.lineTo(x + 6, ch - 1);
      ctx.fill();
    }
    ctx.fillStyle = '#e0b04a';
    ctx.fillRect(0, ch - 3, W, 2);

    // deadline
    const dz = this.danger * (0.5 + 0.5 * Math.sin(t * 9));
    ctx.save();
    ctx.setLineDash([10, 9]);
    ctx.strokeStyle = `rgba(255,95,120,${0.3 + 0.6 * dz})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, DEAD_Y);
    ctx.lineTo(W, DEAD_Y);
    ctx.stroke();
    ctx.restore();
    if (dz > 0.05) {
      const g = ctx.createLinearGradient(0, DEAD_Y - 90, 0, DEAD_Y);
      g.addColorStop(0, 'rgba(255,60,90,0)');
      g.addColorStop(1, `rgba(255,60,90,${0.28 * dz})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, DEAD_Y - 90, W, 90);
    }

    // grid
    for (let r = 0; r < MAXR; r++) {
      const row = this.grid[r];
      const y = this.yAt(r);
      if (y - R > H) break;
      for (let c = 0; c < COLS; c++) {
        const b = row[c];
        if (b) drawBubble(ctx, sS, this.xAt(r, c), y, b, t);
      }
    }

    // pops
    for (const p of this.pops) {
      if (p.delay > 0) {
        drawBubble(ctx, sS, p.x, p.y, p.b, t);
        continue;
      }
      const k = Math.min(1, p.t / POP_T);
      ctx.globalAlpha = 1 - k;
      drawBubble(ctx, sS, p.x, p.y, p.b, t, 1 + k * 0.4);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - k)})`;
      ctx.lineWidth = 3 * (1 - k) + 0.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, R * (1 + k * 0.9), 0, TAU);
      ctx.stroke();
    }

    for (const f of this.falling) {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      drawBubble(ctx, sS, 0, 0, f.b, t);
      ctx.restore();
    }

    if (!this.over()) this.drawAim(ctx, t);
    this.drawShooter(ctx, sS, t);

    if (this.proj) drawBubble(ctx, sS, this.proj.x, this.proj.y, this.proj.b, t);

    // fx
    for (const x of this.rings) {
      const k = x.t / x.life;
      ctx.strokeStyle = x.col;
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = 6 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(x.x, x.y, R + (x.r1 - R) * k, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const b of this.bolts) {
      const k = 1 - b.t / b.life;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = `rgba(255,224,102,${k})`;
      ctx.lineWidth = 12 * k + 2;
      ctx.beginPath();
      b.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${k})`;
      ctx.lineWidth = 4 * k + 1;
      ctx.stroke();
    }
    for (const p of this.parts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max));
      ctx.fillStyle = p.col;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    for (const x of this.texts) {
      const k = x.t / x.life;
      ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      ctx.font = `700 ${x.size}px Fredoka, system-ui, sans-serif`;
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(30,10,70,0.85)';
      const yy = x.y - k * 46;
      ctx.strokeText(x.txt, x.x, yy);
      ctx.fillStyle = x.col;
      ctx.fillText(x.txt, x.x, yy);
    }
    ctx.globalAlpha = 1;
  }

  drawAim(ctx, t) {
    const hinted = t < this.hintUntil;
    const { pts, end } = this.trace(this.angle);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([0.1, 17]);
    ctx.lineDashOffset = -t * 40;
    ctx.lineWidth = 5;
    ctx.strokeStyle = hinted ? 'rgba(120,255,170,0.95)' : 'rgba(255,255,255,0.65)';
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    ctx.restore();
    const cell = this.snap(end.x, end.y);
    if (cell && this.state === 'ready') {
      const q = this.pos(cell.r, cell.c);
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = hinted ? 'rgba(120,255,170,0.95)' : 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(q.x, q.y, R - 3, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawShooter(ctx, sS, t) {
    // base
    const g = ctx.createRadialGradient(SHOOTER_X, SHOOTER_Y - 8, 6, SHOOTER_X, SHOOTER_Y, 46);
    g.addColorStop(0, '#5a4a76');
    g.addColorStop(1, '#14101f');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(SHOOTER_X, SHOOTER_Y, 40, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#e0b04a';
    ctx.lineWidth = 3;
    ctx.stroke();
    // barrel
    ctx.save();
    ctx.translate(SHOOTER_X, SHOOTER_Y);
    ctx.rotate(Math.PI / 2 - this.angle);
    const bg = ctx.createLinearGradient(-14, 0, 14, 0);
    bg.addColorStop(0, '#6b4a14');
    bg.addColorStop(0.5, '#f0cf7a');
    bg.addColorStop(1, '#6b4a14');
    ctx.fillStyle = bg;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-14, -66, 28, 64, 8);
    else ctx.rect(-14, -66, 28, 64);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    // loaded bubble
    if (this.cur) drawBubble(ctx, sS, SHOOTER_X, SHOOTER_Y, this.cur, t);
    // next bubble + swap pad
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.arc(NEXT_X, NEXT_Y, 34, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
    if (this.next) drawBubble(ctx, sS, NEXT_X, NEXT_Y, this.next, t, 0.8);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '700 12px Fredoka, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NEXT • TAP TO SWAP', NEXT_X, NEXT_Y + 50);

    // ceiling countdown pips
    const left = Math.max(0, this.cfg.drop - this.miss);
    const warn = left <= 2;
    ctx.textAlign = 'center';
    ctx.font = '700 12px Fredoka, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const px = SHOOTER_X + 100;
    ctx.fillText('MISSES UNTIL DROP', px, NEXT_Y + 50);
    const n = this.cfg.drop;
    const gap = 13;
    const x0 = px - ((n - 1) * gap) / 2;
    for (let i = 0; i < n; i++) {
      const on = i < left;
      ctx.fillStyle = on ? (warn ? `rgba(255,${90 + 60 * Math.sin(t * 9)},100,1)` : '#ffe066') : 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(x0 + i * gap, NEXT_Y + 2, 4.6, 0, TAU);
      ctx.fill();
    }
  }
}