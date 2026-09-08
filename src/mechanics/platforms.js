// ---------------------------------------------------------------------------
// Piston-driven moving platforms.
//
// A real Minecraft piston shoves its head out over about 3 ticks, holds, then
// pulls back. These platforms do the same, and they CARRY you: if you are
// standing on one when it moves, you move with it. That is what makes a piston
// jump work instead of the platform sliding out from under your feet.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { World } from '../world/world.js';
import { buildWorldMesh } from '../world/mesher.js';

const TRAVEL_TICKS = 3;      // how long the piston takes to push

export class MovingPlatform {
  /**
   * blocks: [[dx,dy,dz,'block_id'], ...] shape, relative to `from`
   * from/to: [x,y,z] world positions the platform slides between
   * period:  full out-and-back cycle length, in ticks (20 = 1 second)
   */
  constructor({ blocks, from, to, period = 60, phase = 0, hold = null }) {
    this.blocks = blocks;
    this.from = from;
    this.to = to;
    this.period = period;
    this.phase = phase;
    this.hold = hold ?? Math.max(4, period / 2 - TRAVEL_TICKS);
    this.pos = [...from];
    this.delta = [0, 0, 0];
    this.mesh = null;
  }

  /** 0 = fully retracted, 1 = fully extended. */
  _progress(tick) {
    const t = ((tick + this.phase) % this.period + this.period) % this.period;
    const out = TRAVEL_TICKS, held = this.hold;
    if (t < out) return t / out;                                   // pushing out
    if (t < out + held) return 1;                                  // held out
    if (t < out + held + out) return 1 - (t - out - held) / out;   // pulling back
    return 0;                                                      // held in
  }

  update(tick) {
    const s = this._progress(tick);
    const next = [0, 1, 2].map((i) => this.from[i] + (this.to[i] - this.from[i]) * s);
    this.delta = [next[0] - this.pos[0], next[1] - this.pos[1], next[2] - this.pos[2]];
    this.pos = next;
    if (this.mesh) this.mesh.position.set(this.pos[0], this.pos[1], this.pos[2]);
  }

  boxes() {
    const [ox, oy, oz] = this.pos;
    return this.blocks.map(([dx, dy, dz]) =>
      [ox + dx, oy + dy, oz + dz, ox + dx + 1, oy + dy + 1, oz + dz + 1]);
  }

  /** True if the player's feet are resting on this platform right now. */
  carries(playerBox) {
    for (const b of this.boxes()) {
      if (playerBox.x1 <= b[0] + 0.001 || playerBox.x0 >= b[3] - 0.001) continue;
      if (playerBox.z1 <= b[2] + 0.001 || playerBox.z0 >= b[5] - 0.001) continue;
      if (playerBox.y0 - b[4] > -0.02 && playerBox.y0 - b[4] < 0.25) return true;
    }
    return false;
  }

  /** The top surface under the player, or null if they are not over this one. */
  topUnder(playerBox) {
    let top = null;
    for (const b of this.boxes()) {
      if (playerBox.x1 <= b[0] + 0.001 || playerBox.x0 >= b[3] - 0.001) continue;
      if (playerBox.z1 <= b[2] + 0.001 || playerBox.z0 >= b[5] - 0.001) continue;
      // Only count it if the player is inside or just above the box, never if
      // they are far below it (you should be able to walk under a raised piston).
      if (playerBox.y0 < b[4] && playerBox.y1 > b[1] + 0.1)
        top = top === null ? b[4] : Math.max(top, b[4]);
    }
    return top;
  }

  buildMesh() {
    const w = new World();
    for (const [dx, dy, dz, id] of this.blocks) w.set(dx, dy, dz, id);
    this.mesh = buildWorldMesh(w);
    this.mesh.position.set(this.pos[0], this.pos[1], this.pos[2]);
    return this.mesh;
  }
}

/**
 * Advance every platform, publish their collision boxes to the world, and
 * return how far the platform under the player moved (so the player rides it).
 */
export function updatePlatforms(platforms, world, tick, player) {
  const playerBox = player ? player.box : null;
  let carry = [0, 0, 0];
  const rising = [];

  for (const p of platforms) {
    const wasCarrying = playerBox ? p.carries(playerBox) : false;
    p.update(tick);
    if (wasCarrying) carry = [carry[0] + p.delta[0], carry[1] + p.delta[1], carry[2] + p.delta[2]];
    if (p.delta[1] > 0) rising.push(p);
  }
  world.dynamic = platforms.flatMap((p) => p.boxes());

  // A piston that rises into you must LIFT you, not swallow you. Without this
  // the head passes through the player and they fall out the bottom.
  if (player && rising.length) {
    const box = player.box;
    let lift = null;
    for (const p of rising) {
      const top = p.topUnder(box);
      if (top !== null) lift = lift === null ? top : Math.max(lift, top);
    }
    if (lift !== null && lift > player.pos.y) {
      player.pos.y = lift;
      player.prev.y = lift;
      if (player.vel.y < 0) player.vel.y = 0;
      player.onGround = true;
      carry[1] = 0;                   // the snap already moved them
    }
  }
  return carry;
}
