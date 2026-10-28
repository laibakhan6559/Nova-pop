const KEY = 'novapop-v1';
const DEFAULT = { unlocked: 0, stars: [], best: [], shapes: false, muted: false };

export function load() {
  try {
    const o = JSON.parse(localStorage.getItem(KEY));
    return { ...DEFAULT, ...(o && typeof o === 'object' ? o : {}) };
  } catch {
    return { ...DEFAULT };
  }
}

export function save(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable */
  }
}
