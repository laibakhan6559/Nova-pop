// Tiny WebAudio synth - no audio files needed.
let ctx = null;
let master = null;
let muted = false;

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.8;
}
export const isMuted = () => muted;

export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.8;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
      return;
    }
  }
  if (ctx.state === 'suspended') ctx.resume();
}

function tone(f, d, { to = null, type = 'sine', v = 0.18, at = 0 } = {}) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + d + 0.03);
}

function noise(d = 0.4, v = 0.3, freq = 900) {
  if (!ctx || muted) return;
  const n = Math.floor(ctx.sampleRate * d);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = v;
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start();
}

export const sfx = {
  click: () => tone(520, 0.07, { type: 'triangle', v: 0.12 }),
  deny: () => tone(160, 0.12, { type: 'square', v: 0.06 }),
  shoot: () => tone(340, 0.12, { to: 760, type: 'triangle', v: 0.14 }),
  land: () => tone(180, 0.08, { to: 120, type: 'sine', v: 0.18 }),
  pop: (i = 0) => {
    const f = 520 * Math.pow(2, Math.min(i, 14) / 12);
    tone(f, 0.12, { to: f * 1.5, type: 'sine', v: 0.14 });
  },
  crack: () => tone(900, 0.06, { to: 300, type: 'square', v: 0.05 }),
  drop: () => {
    tone(140, 0.25, { to: 70, type: 'sawtooth', v: 0.1 });
    noise(0.2, 0.1, 400);
  },
  bomb: () => {
    noise(0.55, 0.45, 700);
    tone(110, 0.4, { to: 40, type: 'sine', v: 0.3 });
  },
  bolt: () => {
    noise(0.3, 0.2, 5000);
    tone(1500, 0.25, { to: 200, type: 'sawtooth', v: 0.08 });
  },
  rainbow: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, { at: i * 0.05, v: 0.1 })),
  power: () => {
    tone(660, 0.1, { type: 'triangle', v: 0.14 });
    tone(990, 0.16, { type: 'triangle', v: 0.14, at: 0.08 });
  },
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.28, { at: i * 0.11, v: 0.14, type: 'triangle' })),
  lose: () => [440, 392, 330, 262].forEach((f, i) => tone(f, 0.3, { at: i * 0.16, v: 0.12, type: 'sawtooth' })),
};
