// ---------------------------------------------------------------------------
// ENDLESS MODE
//
// The course is generated ahead of you and thrown away behind you, so you can
// run forever without the memory climbing. Everything comes from a SEED: the
// same number always produces the same course, so you can share a run with a
// friend and race the identical layout.
//
// Difficulty ramps by widening gaps and narrowing platforms, and only uses
// mechanics from levels you have actually unlocked.
// ---------------------------------------------------------------------------
import * as THREE from '../../lib/three.module.js';
import { World } from '../world/world.js';
import { buildWorldMesh } from '../world/mesher.js';
import { BIOMES } from '../world/level.js';

const PLATFORMS_PER_SEGMENT = 8;
const BIOME_ORDER = ['plains', 'snowy', 'jungle', 'badlands', 'nether'];
const PLATFORMS_PER_BIOME = 25;
const CHECKPOINT_EVERY = 10;

// Which blocks each biome builds with, and which are unlocked by which level.
const PALETTE = {
  plains:   { pad: ['grass', 'oak_planks', 'stone'], special: [], unlockedBy: 1 },
  snowy:    { pad: ['snow_block', 'packed_ice'], special: ['ice', 'blue_ice'], unlockedBy: 2 },
  jungle:   { pad: ['jungle_planks', 'oak_log'], special: ['slime_block', 'honey_block'], unlockedBy: 3 },
  badlands: { pad: ['terracotta', 'red_sand', 'deepslate'], special: ['iron_block'], unlockedBy: 4 },
  nether:   { pad: ['netherrack', 'nether_bricks', 'crimson_planks'],
              special: ['soul_sand', 'magma_block'], unlockedBy: 5 },
};

// Small, fast, seedable RNG (mulberry32). Same seed -> same numbers, always.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function parseSeed(text) {
  if (text === undefined || text === null || text === '') return (Math.random() * 1e9) | 0;
  const n = Number(text);
  if (Number.isFinite(n) && text !== '') return Math.abs(n | 0);
  let h = 2166136261;                                  // hash words into a number
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i); h = Math.imul(h, 16777619);
  }
  return Math.abs(h | 0);
}

const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const MAIN_DIR = 3;              // the course heads this way overall (-z)

export class EndlessCourse {
  constructor(scene, { seed, unlocked = 5 } = {}) {
    this.scene = scene;
    this.seed = seed;
    this.unlocked = unlocked;
    this.world = new World();
    this.rand = mulberry32(seed);
    this.segments = [];
    this.checkpoints = [];
    this.platformCount = 0;
    this.jumps = [];       // every gap generated, for the reachability test

    // cursor
    this.x = 0; this.y = 0; this.z = 0; this.dir = MAIN_DIR;
    this.spawn = { x: 0.5, y: 1, z: 0.5 };
    this.biomeId = 'plains';

    this.lastDepth = 1;
    this.lastWidth = 7;
    // Starting island. It is a segment like any other, so it gets drawn (it
    // used to be solid but invisible - you spawned floating on nothing) and
    // is thrown away once you are well past it.
    const island = new World();
    island.fill(-3, 0, -3, 3, 0, 3, 'grass');
    island.fill(-3, -1, -3, 3, -1, 3, 'dirt');
    island.fill(-2, -2, -2, 2, -2, 2, 'stone');
    island.fill(-1, -3, -1, 1, -3, 1, 'stone');
    for (const b of island.blocks.values()) this.world.set(b.x, b.y, b.z, b.id);
    const islandMesh = buildWorldMesh(island);
    this.scene.add(islandMesh);
    this.segments.push({ mesh: islandMesh, keys: [...island.blocks.keys()],
                         pads: [{ x: 0, y: 0, z: 0 }], startPlatform: 0, endPlatform: 0 });

    this.z = -3;              // cursor on the island's front row
    this.checkpoints.push({ ...this.spawn });
  }

  availableBiomes() {
    return BIOME_ORDER.filter((b) => PALETTE[b].unlockedBy <= this.unlocked);
  }

  biomeForPlatform(n) {
    const avail = this.availableBiomes();
    return avail[Math.floor(n / PLATFORMS_PER_BIOME) % avail.length];
  }

  /** Gaps grow and platforms narrow as you get further. */
  difficulty(n) {
    const t = Math.min(1, n / 120);
    return {
      minGap: n < 4 ? 2 : 2 + Math.round(t),           // 2 -> 3
      maxGap: n < 4 ? 2 : 3 + Math.round(t),           // 3 -> 4 (4 = max sprint jump)
      width:  n < 8 ? 5 : n < 25 ? 3 : this.rand() < 0.3 ? 1 : 3,
      depth:  n < 8 ? 3 : this.rand() < 0.35 ? 1 : 2,
      turnChance: n < 8 ? 0 : 0.16,
      riseChance: n < 8 ? 0 : 0.2,
      specialChance: n < 6 ? 0 : Math.min(0.35, t * 0.5),
    };
  }

  buildSegment() {
    const before = new Set(this.world.blocks.keys());
    const startPlatform = this.platformCount;
    const pads = [];                    // where each platform sits, to find the player

    for (let i = 0; i < PLATFORMS_PER_SEGMENT; i++) {
      const n = this.platformCount;
      const biome = this.biomeForPlatform(n);
      this.biomeId = biome;
      const pal = PALETTE[biome];
      const d = this.difficulty(n);

      {                       // every platform, the first too, is a jump away
        if (this.rand() < d.turnChance) {
          // Turn off the main heading to one side, or back onto it - never
          // round to face the way you came. That keeps the course always moving
          // forward overall, so on a long run it can never cross over itself.
          const side = this.rand() < 0.5 ? 1 : 3;
          this.dir = this.dir === MAIN_DIR ? (MAIN_DIR + side) % 4 : MAIN_DIR;
          // After a turn the platform extends sideways, not forwards, so the
          // distance still to clear is half its WIDTH, not its depth.
          this.lastDepth = Math.floor(((this.lastWidth || 1) - 1) / 2) + 1;
        }
        const rise = this.rand() < d.riseChance ? (this.rand() < 0.75 ? 1 : -1) : 0;
        // A rising jump can only reach 3 blocks - the physics tests prove it.
        let gap = d.minGap + Math.floor(this.rand() * (d.maxGap - d.minGap + 1));
        if (rise > 0) gap = Math.min(gap, 3);
        const f = DIRS[this.dir];
        this.x += f[0] * (this.lastDepth || 1) + f[0] * gap;
        this.z += f[1] * (this.lastDepth || 1) + f[1] * gap;
        this.y += rise;
        this.jumps.push({ n, gap, rise, block: null });
      }

      const isCheckpoint = n > 0 && n % CHECKPOINT_EVERY === 0;
      let block = pal.pad[Math.floor(this.rand() * pal.pad.length)];
      if (!isCheckpoint && pal.special.length && this.rand() < d.specialChance)
        block = pal.special[Math.floor(this.rand() * pal.special.length)];
      // Never make the platform you respawn on a hazard.
      if (isCheckpoint) block = 'checkpoint';

      const w = isCheckpoint ? 3 : d.width;
      const dep = isCheckpoint ? 3 : d.depth;
      this._pad(w, dep, block);
      pads.push({ x: this.x, y: this.y, z: this.z });
      this.lastDepth = dep;
      this.lastWidth = w;

      if (this.jumps.length) this.jumps[this.jumps.length - 1].block = block;
      // The pad grows forward from the cursor, so its middle is one block ahead.
      if (isCheckpoint) {
        const f = DIRS[this.dir];
        this.checkpoints.push({ x: this.x + f[0] + 0.5, y: this.y + 1, z: this.z + f[1] + 0.5 });
      }
      this.platformCount++;
    }

    // Collect just this segment's blocks into their own mesh.
    const segWorld = new World();
    const keys = [];
    for (const [k, b] of this.world.blocks) {
      if (before.has(k)) continue;
      keys.push(k);
      segWorld.set(b.x, b.y, b.z, b.id, b.facing);
    }
    const mesh = buildWorldMesh(segWorld);
    this.scene.add(mesh);
    this.segments.push({ mesh, keys, pads, startPlatform, endPlatform: this.platformCount });
    return this.segments[this.segments.length - 1];
  }

  _pad(w, d, block) {
    const f = DIRS[this.dir], r = DIRS[(this.dir + 1) % 4];
    const hw = (w - 1) / 2;
    for (let a = 0; a < d; a++)
      for (let b = -hw; b <= hw; b++)
        this.world.set(Math.round(this.x + f[0] * a + r[0] * b), this.y,
                       Math.round(this.z + f[1] * a + r[1] * b), block);
    // A short leg so platforms don't look like they're floating in nothing.
    const legBlock = block === 'checkpoint' ? 'stone' : block;
    for (let k = 1; k <= 2; k++)
      this.world.set(this.x, this.y - k, this.z, legBlock);
  }

  /** Which segment is the player on? The one holding the nearest platform. */
  currentSegment(playerPos) {
    let best = 0, bestD = Infinity;
    this.segments.forEach((seg, i) => {
      for (const p of seg.pads) {
        const d = (playerPos.x - p.x) ** 2 + (playerPos.z - p.z) ** 2
                + ((playerPos.y ?? p.y) - p.y) ** 2;
        if (d <= bestD) { bestD = d; best = i; }     // ties go to the newer one
      }
    });
    return best;
  }

  /**
   * Keep `ahead` segments built in front of the player and `behind` behind.
   * Counting from where the player IS (not the total) is what makes it endless:
   * only ~6 segments ever exist at once, so memory and lag stay flat forever.
   */
  update(playerPos, ahead = 3, behind = 2) {
    while (this.segments.length < ahead + 1) this.buildSegment();   // first call
    let cur = this.currentSegment(playerPos);

    // At most one new segment per tick so a slow computer never hitches.
    if (this.segments.length - 1 - cur < ahead) this.buildSegment();

    // Drop segments well behind the player.
    while (cur > behind) {
      const old = this.segments.shift();
      this.scene.remove(old.mesh);
      old.mesh.userData.dispose();
      // On a long run the path can wander back over itself, so keep any
      // block a newer segment also uses.
      const keep = new Set(this.segments.flatMap((sg) => sg.keys));
      for (const k of old.keys) if (!keep.has(k)) this.world.blocks.delete(k);
      cur--;
    }
  }

  get biome() { return BIOMES[this.biomeId] || BIOMES.plains; }

  dispose() {
    for (const s of this.segments) { this.scene.remove(s.mesh); s.mesh.userData.dispose(); }
    this.segments = [];
  }
}
