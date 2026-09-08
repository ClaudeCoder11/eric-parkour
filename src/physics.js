// ---------------------------------------------------------------------------
// Axis-aligned box collision, resolved one axis at a time in Minecraft's own
// order (Y, then X, then Z) so that landings, headhitters and wall-slides all
// behave the way a Minecraft player expects.
// ---------------------------------------------------------------------------
import { STEP_HEIGHT } from './constants.js';

const EPS = 1e-7;

export class AABB {
  constructor(x0, y0, z0, x1, y1, z1) {
    this.x0 = x0; this.y0 = y0; this.z0 = z0;
    this.x1 = x1; this.y1 = y1; this.z1 = z1;
  }
  static fromFeet(x, y, z, width, height) {
    const h = width / 2;
    return new AABB(x - h, y, z - h, x + h, y + height, z + h);
  }
  clone() { return new AABB(this.x0, this.y0, this.z0, this.x1, this.y1, this.z1); }
  translate(dx, dy, dz) {
    this.x0 += dx; this.x1 += dx; this.y0 += dy; this.y1 += dy;
    this.z0 += dz; this.z1 += dz; return this;
  }
  expandBy(m) {
    return new AABB(this.x0 - m, this.y0 - m, this.z0 - m,
                    this.x1 + m, this.y1 + m, this.z1 + m);
  }
  // Box swept along a motion vector - used to gather candidate blocks.
  stretch(dx, dy, dz) {
    return new AABB(this.x0 + Math.min(dx, 0), this.y0 + Math.min(dy, 0), this.z0 + Math.min(dz, 0),
                    this.x1 + Math.max(dx, 0), this.y1 + Math.max(dy, 0), this.z1 + Math.max(dz, 0));
  }
  intersects(b) {
    return this.x0 < b[3] && this.x1 > b[0] &&
           this.y0 < b[4] && this.y1 > b[1] &&
           this.z0 < b[5] && this.z1 > b[2];
  }
  get cx() { return (this.x0 + this.x1) / 2; }
  get cz() { return (this.z0 + this.z1) / 2; }
}

// --- per-axis clipping ------------------------------------------------------
function clipY(box, dy, boxes) {
  if (dy === 0) return 0;
  for (const b of boxes) {
    if (box.x1 <= b[0] + EPS || box.x0 >= b[3] - EPS) continue;
    if (box.z1 <= b[2] + EPS || box.z0 >= b[5] - EPS) continue;
    if (dy > 0 && box.y1 <= b[1] + EPS) dy = Math.min(dy, b[1] - box.y1);
    else if (dy < 0 && box.y0 >= b[4] - EPS) dy = Math.max(dy, b[4] - box.y0);
  }
  return dy;
}
function clipX(box, dx, boxes) {
  if (dx === 0) return 0;
  for (const b of boxes) {
    if (box.y1 <= b[1] + EPS || box.y0 >= b[4] - EPS) continue;
    if (box.z1 <= b[2] + EPS || box.z0 >= b[5] - EPS) continue;
    if (dx > 0 && box.x1 <= b[0] + EPS) dx = Math.min(dx, b[0] - box.x1);
    else if (dx < 0 && box.x0 >= b[3] - EPS) dx = Math.max(dx, b[3] - box.x0);
  }
  return dx;
}
function clipZ(box, dz, boxes) {
  if (dz === 0) return 0;
  for (const b of boxes) {
    if (box.y1 <= b[1] + EPS || box.y0 >= b[4] - EPS) continue;
    if (box.x1 <= b[0] + EPS || box.x0 >= b[3] - EPS) continue;
    if (dz > 0 && box.z1 <= b[2] + EPS) dz = Math.min(dz, b[2] - box.z1);
    else if (dz < 0 && box.z0 >= b[5] - EPS) dz = Math.max(dz, b[5] - box.z0);
  }
  return dz;
}

/**
 * Move `box` by (dx, dy, dz) through the world, stopping at solid blocks.
 * Mutates `box`. Returns what happened, which the player uses to zero out
 * velocity components and to detect landing.
 */
export function moveAndCollide(box, dx, dy, dz, world, opts = {}) {
  const stepHeight = opts.stepHeight ?? STEP_HEIGHT;
  const canStep = opts.canStep !== false && (opts.onGround || opts.wasOnGround);

  const boxes = world.collisionBoxesIn(box.stretch(dx, dy, dz), 1);

  // 1. Vertical first: this is what makes landings and headhitters correct.
  const ady = clipY(box, dy, boxes);
  box.translate(0, ady, 0);
  const hitFloor = dy < 0 && ady !== dy;
  const hitCeiling = dy > 0 && ady !== dy;
  const onGround = hitFloor;

  // 2. Then horizontal, one axis at a time so you slide along walls.
  let adx = clipX(box, dx, boxes);
  box.translate(adx, 0, 0);
  let adz = clipZ(box, dz, boxes);
  box.translate(0, 0, adz);

  let hitWallX = adx !== dx;
  let hitWallZ = adz !== dz;

  // 3. Auto step-up (slabs, single blocks). Only from the ground, and only if
  //    we actually got blocked - exactly like Minecraft's step assist.
  if (canStep && (hitWallX || hitWallZ) && stepHeight > 0) {
    const trial = box.clone().translate(-adx, 0, -adz);
    const sBoxes = world.collisionBoxesIn(trial.stretch(dx, stepHeight, dz), 1);

    const up = clipY(trial, stepHeight, sBoxes);
    if (up > EPS) {
      trial.translate(0, up, 0);
      const sdx = clipX(trial, dx, sBoxes);
      trial.translate(sdx, 0, 0);
      const sdz = clipZ(trial, dz, sBoxes);
      trial.translate(0, 0, sdz);
      // Settle back down onto the step.
      const down = clipY(trial, -up, sBoxes);
      trial.translate(0, down, 0);

      const gainedMore = (sdx * sdx + sdz * sdz) > (adx * adx + adz * adz) + EPS;
      if (gainedMore) {
        box.x0 = trial.x0; box.x1 = trial.x1;
        box.y0 = trial.y0; box.y1 = trial.y1;
        box.z0 = trial.z0; box.z1 = trial.z1;
        adx = sdx; adz = sdz;
        hitWallX = sdx !== dx; hitWallZ = sdz !== dz;
      }
    }
  }

  return { dx: adx, dy: ady, dz: adz, onGround, hitFloor, hitCeiling, hitWallX, hitWallZ };
}

/** Is there solid ground directly under this box (within `reach`)? */
export function groundBelow(box, world, reach = 0.02) {
  const probe = new AABB(box.x0, box.y0 - reach, box.z0, box.x1, box.y0, box.z1);
  const boxes = world.collisionBoxesIn(probe, 1);
  for (const b of boxes) if (probe.intersects(b)) return true;
  return false;
}

/**
 * The block whose surface the player is standing on. Used for slipperiness,
 * soul sand slowdown, bounce and footstep sounds. Checks the four corners of
 * the player box so standing on an edge still counts.
 */
export function blockUnder(box, world) {
  const y = Math.floor(box.y0 - 0.02);
  const corners = [
    [box.x0 + 0.01, box.z0 + 0.01], [box.x1 - 0.01, box.z0 + 0.01],
    [box.x0 + 0.01, box.z1 - 0.01], [box.x1 - 0.01, box.z1 - 0.01],
    [box.cx, box.cz],
  ];
  for (const [x, z] of corners) {
    const b = world.get(Math.floor(x), y, Math.floor(z));
    if (b) return b;
  }
  return null;
}
