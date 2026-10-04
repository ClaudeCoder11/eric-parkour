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
    this.x = 0; this.y = 0; this.z = 0; this.dir = 3;
    this.spawn = { x: 0.5, y: 1, z: 0.5 };
    this.biomeId = 'plains';

    this.lastDepth = 1;
    this.lastWidth = 7;
    this.world.fill(-3, 0, -3, 3, 0, 3, 'grass');       // starting island
    this.world.fill(-3, -1, -3, 3, -1, 3, 'stone');
    this.z = -3;
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

    for (let i = 0; i < PLATFORMS_PER_SEGMENT; i++) {
      const n = this.platformCount;
      const biome = this.biomeForPlatform(n);
      this.biomeId = biome;
      const pal = PALETTE[biome];
      const d = this.difficulty(n);

      if (n > 0) {
        if (this.rand() < d.turnChance) {
          this.dir = (this.dir + (this.rand() < 0.5 ? 1 : 3)) % 4;
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
      this.lastDepth = dep;
      this.lastWidth = w;

      if (this.jumps.length) this.jumps[this.jumps.length - 1].block = block;
      if (isCheckpoint) this.checkpoints.push({ x: this.x + 0.5, y: this.y + 1, z: this.z + 0.5 });
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
    this.segments.push({ mesh, keys, startPlatform, endPlatform: this.platformCount });
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

  /** Keep roughly `ahead` segments built in front of the player. */
  update(playerPos, ahead = 3, behind = 2) {
    while (this.segments.length < ahead) this.buildSegment();

    // How far along is the player? Use the nearest generated platform.
    const dist = Math.hypot(playerPos.x - this.x, playerPos.z - this.z);
    if (dist < 80 && this.segments.length < ahead + 4) this.buildSegment();

    // Drop segments well behind the player.
    while (this.segments.length > ahead + behind + 2) {
      const old = this.segments.shift();
      this.scene.remove(old.mesh);
      old.mesh.userData.dispose();
      for (const k of old.keys) this.world.blocks.delete(k);
    }
  }

  get biome() { return BIOMES[this.biomeId] || BIOMES.plains; }

  dispose() {
    for (const s of this.segments) { this.scene.remove(s.mesh); s.mesh.userData.dispose(); }
    this.segments = [];
  }
}
