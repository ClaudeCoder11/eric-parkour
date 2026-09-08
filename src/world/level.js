// ---------------------------------------------------------------------------
// Level format.
//
// A level is DATA: a biome, a spawn, and a list of build ops. Most ops are
// course-builder moves - "pad", "gap 4", "turn right", "up 1" - which is how
// parkour is actually designed, and which keeps every jump expressed in the
// same units the physics tests verify (a gap of 4 = a 4-block sprint jump).
// ---------------------------------------------------------------------------
import { World } from './world.js';
import { getBlock } from './blocks.js';

export const BIOMES = {
  // fogNear/fogFar are pushed out far enough that the course ahead stays legible.
  // The Nether is deliberately tight and dark - that is what it looks like.
  plains:  { sky: 0x87ceeb, fog: 0xc2e2f5, fogNear: 60,  fogFar: 240, light: 1.0,
             name: 'Plains' },
  snowy:   { sky: 0x8fb6cf, fog: 0xcfe2ef, fogNear: 55,  fogFar: 230, light: 0.98,
             name: 'Snowy Tundra' },
  jungle:  { sky: 0x5fa8d8, fog: 0x9ec9a2, fogNear: 40,  fogFar: 170, light: 0.9,
             name: 'Jungle' },
  badlands:{ sky: 0x9ec5e8, fog: 0xe6cda2, fogNear: 55,  fogFar: 230, light: 1.0,
             name: 'Badlands' },
  nether:  { sky: 0x2a0808, fog: 0x5a1710, fogNear: 14,  fogFar: 95,  light: 0.85,
             name: 'Nether Wastes' },
};
// Facing: 0 = +X, 1 = +Z, 2 = -X, 3 = -Z
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

/**
 * Walks a cursor through the world laying down platforms and gaps.
 * `c.pad(3, 3)` puts a 3x3 platform under the cursor; `c.gap(4)` leaves four
 * blocks of air and moves on; `c.turn('right')` rotates the course.
 */
class Course {
  constructor(world, level) {
    this.w = world;
    this.level = level;
    this.x = 0; this.y = 0; this.z = 0;
    this.dir = 0;
    this.block = 'stone';
    this.lastDepth = 1;       // solid rows ahead of the cursor
    this.lastWidth = 1;
    this.jumps = [];          // recorded for the difficulty validator
  }
  get fwd() { return DIRS[this.dir]; }
  get right() { return DIRS[(this.dir + 1) % 4]; }

  at(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  facing(d) { this.dir = ((d % 4) + 4) % 4; return this; }
  turn(which) {
    this.dir = (this.dir + (which === 'right' ? 1 : which === 'left' ? 3 : 2)) % 4;
    return this;
  }
  mat(id) { this.block = id; return this; }

  /**
   * Place a platform `w` wide and `d` deep. It starts AT the cursor and extends
   * forward, so the cursor always sits on the platform's landing edge - the
   * block you actually touch down on.
   */
  pad(w = 1, d = 1, block = null) {
    const id = block || this.block;
    const f = this.fwd, r = this.right;
    const hw = (w - 1) / 2;
    for (let a = 0; a < d; a++)
      for (let b = -hw; b <= hw; b++) {
        const x = Math.round(this.x + f[0] * a + r[0] * b);
        const z = Math.round(this.z + f[1] * a + r[1] * b);
        this.w.set(x, this.y, z, id);
      }
    this.lastDepth = d;      // solid rows ahead of the cursor, incl. the cursor row
    this.lastWidth = w;
    return this;
  }

  /**
   * Leave exactly `n` blocks of AIR, then land on the next platform.
   * gap(4) is the 4-block sprint jump the physics tests verify. The depth of
   * the platform you are standing on is accounted for automatically.
   */
  gap(n, { rise = 0, side = 0, boosted = false, carried = false } = {}) {
    const f = this.fwd, r = this.right;
    const advance = this.lastDepth + n;
    this.x += f[0] * advance + r[0] * side;
    this.z += f[1] * advance + r[1] * side;
    this.y += rise;
    this.lastDepth = 1;
    this.jumps.push({ gap: n, rise, side, boosted, carried });
    return this;
  }

  /** Walk forward `n` blocks over solid ground (no jump involved). */
  step(n = 1, { rise = 0 } = {}) {
    const f = this.fwd;
    this.x += f[0] * n; this.z += f[1] * n; this.y += rise;
    this.lastDepth = 1;
    return this;
  }

  /** A walkway `n` blocks long; the cursor ends on its last row. */
  run(n, w = 1, block = null) {
    this.pad(w, n, block);
    if (n > 1) { this.step(n - 1); this.lastDepth = 1; }
    return this;
  }

  up(n = 1) { this.y += n; return this; }
  down(n = 1) { this.y -= n; return this; }

  /** Put a block relative to the cursor (a = forward, b = right, h = up). */
  place(id, a = 0, b = 0, h = 1, facing = null) {
    const f = this.fwd, r = this.right;
    this.w.set(Math.round(this.x + f[0] * a + r[0] * b), this.y + h,
               Math.round(this.z + f[1] * a + r[1] * b), id, facing);
    return this;
  }

  /** Mark a checkpoint one block above the cursor. */
  checkpoint() {
    this.level.checkpoints.push({ x: this.x + 0.5, y: this.y + 1, z: this.z + 0.5 });
    this.w.set(this.x, this.y, this.z, 'checkpoint');
    return this;
  }

  goal(block = 'goal') {
    this.level.goal = { x: this.x + 0.5, y: this.y + 1, z: this.z + 0.5 };
    this.w.set(this.x, this.y, this.z, block);
    return this;
  }

  /**
   * A piston-driven moving platform. `reach` is how far it travels and `dir`
   * is 'up' | 'forward' | 'right'. Offsets are relative to the cursor.
   */
  piston({ w = 3, d = 3, reach = 3, dir = 'up', period = 70, phase = 0,
           block = 'piston_head', ahead = 0 } = {}) {
    const f = this.fwd, r = this.right;
    const hw = (w - 1) / 2;
    const blocks = [];
    for (let a = 0; a < d; a++)
      for (let b = -hw; b <= hw; b++)
        blocks.push([Math.round(f[0] * a + r[0] * b), 0, Math.round(f[1] * a + r[1] * b), block]);
    const ox = Math.round(this.x + f[0] * ahead), oz = Math.round(this.z + f[1] * ahead);
    const from = [ox, this.y, oz];
    const to = dir === 'up'      ? [ox, this.y + reach, oz]
             : dir === 'forward' ? [ox + f[0] * reach, this.y, oz + f[1] * reach]
             :                     [ox + r[0] * reach, this.y, oz + r[1] * reach];
    this.level.platforms.push({ blocks, from, to, period, phase });
    return this;
  }

  /** Pillars under the last platform, so it doesn't look like it floats. */
  leg(depth = 3, block = null) {
    const id = block || this.block;
    const f = this.fwd, r = this.right;
    const hw = ((this.lastWidth || 1) - 1) / 2;
    for (const b of [-hw, hw]) {
      const x = Math.round(this.x + r[0] * b), z = Math.round(this.z + r[1] * b);
      for (let i = 1; i <= depth; i++) this.w.set(x, this.y - i, z, id);
    }
    return this;
  }
}

export class Level {
  constructor(def) {
    this.def = def;
    this.name = def.name;
    this.biome = BIOMES[def.biome] || BIOMES.plains;
    this.biomeId = def.biome;
    this.parTime = def.parTime || 120;
    this.hint = def.hint || '';
    this.unlocks = def.unlocks || [];
    this.tint = def.tint || {};
    this.checkpoints = [];
    this.platforms = [];
    this.goal = null;
    this.world = new World();
    this.spawn = { x: 0.5, y: 2, z: 0.5 };
    this.spawnYaw = def.spawnYaw ?? 0;
    this.build();
  }

  build() {
    const c = new Course(this.world, this);
    if (typeof this.def.build === 'function') this.def.build(c, this.world, this);
    // Raw block lists (what the level editor exports) are also accepted.
    if (Array.isArray(this.def.blocks))
      for (const b of this.def.blocks) this.world.set(b[0], b[1], b[2], b[3], b[4] || null);
    if (Array.isArray(this.def.checkpoints))
      for (const cp of this.def.checkpoints)
        this.checkpoints.push({ x: cp[0], y: cp[1], z: cp[2] });
    if (this.def.goalAt)
      this.goal = { x: this.def.goalAt[0], y: this.def.goalAt[1], z: this.def.goalAt[2] };
    this.jumps = c.jumps;
    if (this.def.spawn) {
      this.spawn = { x: this.def.spawn[0], y: this.def.spawn[1], z: this.def.spawn[2] };
    }
    // The first checkpoint is always the spawn point.
    this.checkpoints.unshift({ ...this.spawn });
  }

  /**
   * Sanity-check every jump against the verified physics limits. Catches a
   * level that has become impossible before a player ever loads it.
   */
  validate() {
    const problems = [];
    this.jumps.forEach((j, i) => {
      // Verified in tests.html: 4 flat, 3 when rising a block, 6 with Jump Boost II.
      const maxGap = j.boosted ? 6 : j.rise > 0 ? 3 : 4;
      if (j.gap > maxGap)
        problems.push(`jump ${i + 1}: gap of ${j.gap} with rise ${j.rise} is not reachable`);
      if (j.rise > 1)
        problems.push(`jump ${i + 1}: rise of ${j.rise} exceeds the 1.2522 block jump apex`);
      // `carried` means a piston does the travelling, so the offset is fine.
      if (Math.abs(j.side) > 2 && !j.carried)
        problems.push(`jump ${i + 1}: sideways offset of ${j.side} is very hard`);
    });
    if (!this.goal) problems.push('level has no goal block');
    return problems;
  }
}

export function loadLevel(def) {
  const lvl = new Level(def);
  const problems = lvl.validate();
  if (problems.length) console.warn(`[${lvl.name}] level warnings:\n  ` + problems.join('\n  '));
  return lvl;
}
