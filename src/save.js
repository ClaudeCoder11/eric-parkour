// Progress and settings, stored in the browser. Nothing leaves the device.
const KEY = 'parkour3d.save.v1';

const DEFAULT = {
  unlocked: 1,                 // highest level number unlocked
  best: {},                    // levelId -> best time in seconds
  deaths: {},                  // levelId -> death count
  endlessBest: 0,              // furthest platform reached
  totalDeaths: 0,
  settings: {
    assist: true,
    sensitivity: 1.0,
    camera: 'first',
    sound: true,
    fov: 78,
    showHints: true,
  },
};

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT);
    const data = JSON.parse(raw);
    return { ...structuredClone(DEFAULT), ...data,
             settings: { ...DEFAULT.settings, ...(data.settings || {}) } };
  } catch { return structuredClone(DEFAULT); }
}

let state = read();

export const save = {
  get data() { return state; },
  get settings() { return state.settings; },

  flush() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
  },
  set(path, value) {
    const parts = path.split('.');
    let o = state;
    for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    o[parts[parts.length - 1]] = value;
    this.flush();
  },
  unlock(levelNumber) {
    if (levelNumber > state.unlocked) { state.unlocked = levelNumber; this.flush(); }
  },
  recordTime(levelId, seconds) {
    const prev = state.best[levelId];
    const isBest = prev === undefined || seconds < prev;
    if (isBest) { state.best[levelId] = seconds; this.flush(); }
    return isBest;
  },
  recordDeath(levelId) {
    state.deaths[levelId] = (state.deaths[levelId] || 0) + 1;
    state.totalDeaths++;
    this.flush();
  },
  recordEndless(platforms) {
    if (platforms > state.endlessBest) { state.endlessBest = platforms; this.flush(); }
  },
  reset() { state = structuredClone(DEFAULT); this.flush(); },
};

export const fmtTime = (s) => {
  if (s === undefined || s === null) return '--:--';
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(2).padStart(5, '0');
  return `${m}:${sec}`;
};
