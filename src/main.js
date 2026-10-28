import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/cinzel/700.css';
import './style.css';
import confetti from 'canvas-confetti';
import { Game } from './game.js';
import { LEVELS, WORLDS } from './levels.js';
import { drawBubble, view } from './render.js';
import { sfx, unlock, setMuted, isMuted } from './audio.js';
import { load, save } from './storage.js';

const $ = (id) => document.getElementById(id);
const prog = load();
setMuted(!!prog.muted);
view.shapes = !!prog.shapes;

let screen = 'home';
let modalOpen = false;

// ------------------------------------------------------------------ helpers
function show(name) {
  screen = name;
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === name));
  if (name !== 'game') document.body.dataset.world = '0';
  if (name === 'levels') buildLevels();
  if (name === 'home') refreshHome();
  if (name === 'game') requestAnimationFrame(resizeStage);
}

let toastTimer = 0;
function toast(msg, ms = 1800) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

function soundIcons() {
  const icon = isMuted() ? '🔇' : '🔊';
  $('btn-sound').textContent = icon;
  $('g-sound').textContent = icon;
}
function toggleSound() {
  unlock();
  prog.muted = !isMuted();
  setMuted(prog.muted);
  save(prog);
  soundIcons();
  sfx.click();
}

function totalStars() {
  return LEVELS.reduce((a, _, i) => a + (prog.stars[i] || 0), 0);
}

function refreshHome() {
  const next = Math.min(prog.unlocked, LEVELS.length - 1);
  $('btn-play').textContent = next > 0 ? `Continue - Level ${next + 1}` : 'Play';
}

// ------------------------------------------------------------------ floating background orbs
(function orbs() {
  const host = $('orbs');
  for (let i = 0; i < 14; i++) {
    const el = document.createElement('i');
    const s = 3 + Math.random() * 7;
    el.style.cssText = `width:${s}px;height:${s}px;left:${Math.random() * 100}%;animation-duration:${9 + Math.random() * 16}s;animation-delay:${-Math.random() * 30}s;opacity:${0.4 + Math.random() * 0.6}`;
    host.appendChild(el);
  }
})();

// ------------------------------------------------------------------ modal
function openModal(html, wire) {
  const m = $('modal');
  $('modal-card').innerHTML = html;
  m.classList.remove('hidden');
  modalOpen = true;
  wire?.($('modal-card'));
}
function closeModal() {
  $('modal').classList.add('hidden');
  modalOpen = false;
}

function legendHTML() {
  return `<div class="legend">${LEGEND.map((l, i) => `<div><canvas data-i="${i}" width="84" height="84"></canvas><span><b>${l.name}</b>${l.d}</span></div>`).join('')}</div>`;
}
function paintLegend(root) {
  root.querySelectorAll('canvas[data-i]').forEach((cv) => {
    const g = cv.getContext('2d');
    g.setTransform(84 / 56, 0, 0, 84 / 56, 0, 0);
    drawBubble(g, 2, 28, 28, LEGEND[+cv.dataset.i].b, 0.6);
  });
}
const LEGEND = [
  { b: { c: 0 }, name: 'Six elements', d: 'Fire, Lightning, Earth, Water, Shadow, Spirit. Match 3+ of the same rune. Orbs left hanging fall!' },
  { b: { c: 3, ice: true }, name: 'Frozen orb', d: 'Cracks when a neighbour pops. A popped Fire rune melts frost up to two orbs away!' },
  { b: { stone: true, c: -1 }, name: 'Cursed obsidian', d: 'Can\u2019t be matched. Falls only when cut off from the ceiling.' },
  { b: { c: 1, gold: true }, name: 'Crowned orb', d: 'Pop or drop it to win a free power-up.' },
  { b: { c: 2, shift: true, n: 4 }, name: 'Shifter', d: 'Changes element every shot. The small dot shows what it becomes.' },
  { b: { sp: 'bomb' }, name: 'Meteor', d: 'Smashes everything around where it lands - even stone and ice.' },
  { b: { sp: 'rainbow' }, name: 'Prism', d: 'Becomes the element that makes the biggest pop.' },
  { b: { sp: 'lightning' }, name: 'Storm', d: 'Strikes the entire row it lands in.' },
];

function openHelp(fromPause = false) {
  game.paused = true;
  openModal(
    `<h2>How to play</h2>
     <p>Drag to aim, release to shoot. Walls bounce! Drag down below the launcher to cancel. Tap the <b>NEXT</b> bubble to swap. Every few missed shots the ceiling drops - don’t let bubbles reach the red line.</p>
     ${legendHTML()}
     <p style="font-size:.85rem;opacity:.7">Keys: &larr; &rarr; aim &middot; Space shoot &middot; S swap &middot; 1/2/3 power-ups &middot; H hint &middot; P pause</p>
     <div class="btns"><button class="btn primary" id="m-ok">Got it</button></div>`,
    (root) => {
      paintLegend(root);
      root.querySelector('#m-ok').onclick = () => {
        sfx.click();
        closeModal();
        if (fromPause) openPause();
        else game.paused = screen !== 'game' ? false : false;
      };
    },
  );
}

function openPause() {
  if (screen !== 'game' || game.over()) return;
  game.paused = true;
  const tg = (id, label, on) => `<div class="toggle" id="${id}">${label}<b class="${on ? 'on' : ''}">${on ? 'ON' : 'OFF'}</b></div>`;
  openModal(
    `<h2>Paused</h2>
     <div class="btns">
       <button class="btn good" id="m-resume">Resume</button>
       ${tg('t-sound', 'Sound', !isMuted())}
       <button class="btn" id="m-help">How to play</button>
       <button class="btn" id="m-restart">Restart level</button>
       <button class="btn" id="m-levels">Levels</button>
     </div>`,
    (root) => {
      root.querySelector('#m-resume').onclick = () => {
        sfx.click();
        closeModal();
        game.paused = false;
      };
      root.querySelector('#t-sound').onclick = () => {
        toggleSound();
        openPause();
      };
      root.querySelector('#m-help').onclick = () => openHelp(true);
      root.querySelector('#m-restart').onclick = () => {
        closeModal();
        startLevel(game.level);
      };
      root.querySelector('#m-levels').onclick = () => {
        closeModal();
        game.paused = false;
        show('levels');
      };
    },
  );
}

// ------------------------------------------------------------------ level select
function buildLevels() {
  const host = $('level-grid');
  host.innerHTML = '';
  for (let w = 0; w < WORLDS.length; w++) {
    const sec = document.createElement('div');
    sec.className = 'world';
    sec.innerHTML = `<h3>World ${w + 1} &middot; ${WORLDS[w]}</h3>`;
    const grid = document.createElement('div');
    grid.className = 'lv-grid';
    for (let k = 0; k < 5; k++) {
      const i = w * 5 + k;
      const locked = i > prog.unlocked;
      const st = prog.stars[i] || 0;
      const b = document.createElement('button');
      b.className = 'lv' + (locked ? ' locked' : '') + (i === prog.unlocked ? ' cur' : '');
      b.innerHTML = locked
        ? '<span>&#128274;</span>'
        : `<span>${i + 1}</span><small class="${st ? 'on' : ''}">${'★'.repeat(st)}${'☆'.repeat(3 - st)}</small>`;
      b.setAttribute('aria-label', `Level ${i + 1}${locked ? ' locked' : ''}`);
      b.onclick = () => {
        unlock();
        if (locked) {
          sfx.deny();
          return;
        }
        sfx.click();
        startLevel(i);
      };
      grid.appendChild(b);
    }
    sec.appendChild(grid);
    host.appendChild(sec);
  }
  $('stars-total').textContent = `${totalStars()}/${LEVELS.length * 3} ★`;
}

// ------------------------------------------------------------------ game wiring
const game = new Game($('cv'), {
  onHud(d) {
    $('h-level').textContent = d.level + 1;
    $('h-score').textContent = d.score;
    $('h-shots').textContent = d.shots;
    document.querySelectorAll('.pw[data-pw]').forEach((b) => {
      const n = d.inv[b.dataset.pw] || 0;
      b.querySelector('i').textContent = n;
      b.classList.toggle('empty', n === 0 && d.active !== b.dataset.pw);
      b.classList.toggle('active', d.active === b.dataset.pw);
    });
    const h = $('pw-hint');
    h.querySelector('i').textContent = d.hints;
    h.classList.toggle('empty', d.hints === 0);
  },
  onToast: (m) => toast(m),
  onWin({ stars, score, shots, level }) {
    sfx.win();
    confetti({ particleCount: 140, spread: 85, origin: { y: 0.55 }, zIndex: 100 });
    setTimeout(() => confetti({ particleCount: 90, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, zIndex: 100 }), 250);
    setTimeout(() => confetti({ particleCount: 90, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, zIndex: 100 }), 450);
    const prevBest = prog.best[level] || 0;
    prog.stars[level] = Math.max(prog.stars[level] || 0, stars);
    prog.best[level] = Math.max(prevBest, score);
    prog.unlocked = Math.max(prog.unlocked, Math.min(level + 1, LEVELS.length - 1));
    save(prog);
    const last = level >= LEVELS.length - 1;
    const starHTML = [0, 1, 2].map((i) => `<span class="${i < stars ? 'on' : 'off'}" style="--d:${0.25 + i * 0.25}s">★</span>`).join('');
    openModal(
      `<h2>${last ? 'You did it!' : 'Level clear!'}</h2>
       <div class="stars">${starHTML}</div>
       <div class="big-score">${score}</div>
       <p>${score > prevBest ? '\u{1F3C6} New best score!' : 'Best: ' + prevBest}</p>
       ${last ? '<p>All 20 levels complete. You are a Rune Pop legend!</p>' : ''}
       <div class="btns">
         ${last ? '' : '<button class="btn primary" id="m-next">Next level</button>'}
         <button class="btn" id="m-again">Play again</button>
         <button class="btn" id="m-levels">Levels</button>
       </div>`,
      (root) => {
        root.querySelector('#m-next')?.addEventListener('click', () => { closeModal(); startLevel(level + 1); });
        root.querySelector('#m-again').onclick = () => { closeModal(); startLevel(level); };
        root.querySelector('#m-levels').onclick = () => { closeModal(); show('levels'); };
      },
    );
  },
  onLose({ level }) {
    sfx.lose();
    openModal(
      `<h2>Game over</h2>
       <p>The bubbles reached the line. Try a different angle - bombs and hints can help!</p>
       <div class="btns">
         <button class="btn primary" id="m-retry">Try again</button>
         <button class="btn" id="m-levels">Levels</button>
       </div>`,
      (root) => {
        root.querySelector('#m-retry').onclick = () => { closeModal(); startLevel(level); };
        root.querySelector('#m-levels').onclick = () => { closeModal(); show('levels'); };
      },
    );
  },
});
game.cfg.world = 0;

function startLevel(i) {
  i = Math.max(0, Math.min(LEVELS.length - 1, i));
  document.body.dataset.world = String(LEVELS[i].world);
  closeModal();
  show('game');
  game.loadLevel(i);
  resizeStage();
  if (LEVELS[i].tip) toast(LEVELS[i].tip, 4800);
  else toast(`Level ${i + 1}`, 1200);
}

function resizeStage() {
  const st = $('stage');
  const w = st.clientWidth - 16;
  const h = st.clientHeight - 8;
  if (w > 40 && h > 40) game.resize(w, h);
}
new ResizeObserver(resizeStage).observe($('stage'));
window.addEventListener('resize', resizeStage);

// tray icons
const iconCtx = {};
document.querySelectorAll('.pw[data-pw]').forEach((b) => {
  const cv = b.querySelector('canvas');
  iconCtx[b.dataset.pw] = cv.getContext('2d');
  b.addEventListener('click', () => game.usePower(b.dataset.pw));
});
function paintIcons(t) {
  for (const [name, g] of Object.entries(iconCtx)) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, 88, 88);
    g.setTransform(88 / 56, 0, 0, 88 / 56, 0, 0);
    drawBubble(g, 2, 28, 28, { sp: name }, t);
  }
}
$('pw-hint').onclick = () => game.useHint();
$('pw-swap').onclick = () => game.swap();

// ------------------------------------------------------------------ buttons
$('btn-play').onclick = () => { unlock(); sfx.click(); startLevel(Math.min(prog.unlocked, LEVELS.length - 1)); };
$('btn-levels').onclick = () => { unlock(); sfx.click(); show('levels'); };
$('btn-help').onclick = () => { unlock(); sfx.click(); openHelp(false); };
$('btn-sound').onclick = toggleSound;
$('g-sound').onclick = toggleSound;
$('lv-back').onclick = () => { sfx.click(); show('home'); };
$('g-pause').onclick = () => { sfx.click(); openPause(); };
$('modal').addEventListener('click', (e) => {
  if (e.target.id === 'modal' && screen === 'home') {
    closeModal();
  }
});
soundIcons();
refreshHome();

// ------------------------------------------------------------------ keyboard
window.addEventListener('keydown', (e) => {
  if (screen !== 'game' || modalOpen) {
    if (e.key === 'Escape' && modalOpen && screen === 'home') closeModal();
    return;
  }
  const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') game.keys.left = true;
  else if (k === 'arrowright' || k === 'd') game.keys.right = true;
  else if (k === ' ' || k === 'enter' || k === 'arrowup') { e.preventDefault(); game.fire(); }
  else if (k === 's' || k === 'x') game.swap();
  else if (k === '1') game.usePower('bomb');
  else if (k === '2') game.usePower('rainbow');
  else if (k === '3') game.usePower('lightning');
  else if (k === 'h') game.useHint();
  else if (k === 'p' || k === 'escape') openPause();
});
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') game.keys.left = false;
  if (k === 'arrowright' || k === 'd') game.keys.right = false;
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === 'game' && !modalOpen && !game.over()) openPause();
});

// ------------------------------------------------------------------ loop
let last = performance.now();
function frame(now) {
  const dt = (now - last) / 1000;
  last = now;
  if (screen === 'game') {
    game.update(dt);
    game.render();
    paintIcons(now / 1000);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (location.search.includes('debug')) window.__game = game;