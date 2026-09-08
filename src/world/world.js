// ---------------------------------------------------------------------------
// Sparse block storage. Only blocks that exist are stored, so a level costs
// memory proportional to its block count, not its bounding box.
// ---------------------------------------------------------------------------
import { getBlock, collisionBoxes } from './blocks.js';

const key = (x, y, z) => x + ',' + y + ',' + z;

export class World {
  constructor() {
    this.blocks = new Map();     // "x,y,z" -> { id, facing, x, y, z, meta }
    this.dynamic = [];           // collision boxes from moving platforms (pistons)
    this.dirty = true;
    this.version = 0;
  }

  set(x, y, z, id, facing = null, meta = null) {
    x |= 0; y |= 0; z |= 0;
    if (!id || id === 'air') { this.remove(x, y, z); return; }
    this.blocks.set(key(x, y, z), { id, facing, meta, x, y, z });
    this.dirty = true; this.version++;
  }

  remove(x, y, z) {
    if (this.blocks.delete(key(x | 0, y | 0, z | 0))) {
      this.dirty = true; this.version++;
    }
  }

  get(x, y, z) { return this.blocks.get(key(x | 0, y | 0, z | 0)) || null; }
  getId(x, y, z) { const b = this.get(x, y, z); return b ? b.id : 'air'; }
  getDef(x, y, z) { return getBlock(this.getId(x, y, z)); }
  has(x, y, z) { return this.blocks.has(key(x | 0, y | 0, z | 0)); }
  get size() { return this.blocks.size; }
  clear() { this.blocks.clear(); this.dirty = true; this.version++; }

  // Fill a solid cuboid (inclusive bounds) - the workhorse for level building.
  fill(x0, y0, z0, x1, y1, z1, id, facing = null) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
        for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++)
          this.set(x, y, z, id, facing);
  }

  // Every collision box overlapping the given AABB, expanded by a margin.
  collisionBoxesIn(box, margin = 0) {
    const out = [];
    const x0 = Math.floor(box.x0 - margin), x1 = Math.ceil(box.x1 + margin);
    const y0 = Math.floor(box.y0 - margin - 1), y1 = Math.ceil(box.y1 + margin);
    const z0 = Math.floor(box.z0 - margin), z1 = Math.ceil(box.z1 + margin);
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++) {
          const b = this.blocks.get(key(x, y, z));
          if (!b) continue;
          const def = getBlock(b.id);
          if (!def.solid) continue;
          for (const cb of collisionBoxes(b.id, x, y, z, b.facing)) out.push(cb);
        }
    // Moving platforms live outside the block grid, so add them by hand.
    for (const d of this.dynamic) {
      if (d[3] < box.x0 - margin || d[0] > box.x1 + margin) continue;
      if (d[4] < box.y0 - margin - 1 || d[1] > box.y1 + margin) continue;
      if (d[5] < box.z0 - margin || d[2] > box.z1 + margin) continue;
      out.push(d);
    }
    return out;
  }

  // Every non-solid block whose cube overlaps the AABB (water, cobweb, ladder,
  // lava, portal...). These affect movement without blocking it.
  overlappingNonSolid(box) {
    const out = [];
    for (let x = Math.floor(box.x0); x < Math.ceil(box.x1); x++)
      for (let y = Math.floor(box.y0); y < Math.ceil(box.y1); y++)
        for (let z = Math.floor(box.z0); z < Math.ceil(box.z1); z++) {
          const b = this.blocks.get(key(x, y, z));
          if (b && !getBlock(b.id).solid) out.push(b);
        }
    return out;
  }

  bounds() {
    let x0 = Infinity, y0 = Infinity, z0 = Infinity;
    let x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (const b of this.blocks.values()) {
      if (b.x < x0) x0 = b.x; if (b.x > x1) x1 = b.x;
      if (b.y < y0) y0 = b.y; if (b.y > y1) y1 = b.y;
      if (b.z < z0) z0 = b.z; if (b.z > z1) z1 = b.z;
    }
    return { x0, y0, z0, x1, y1, z1 };
  }
}
