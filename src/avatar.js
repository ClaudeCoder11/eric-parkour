// ---------------------------------------------------------------------------
// The third-person character.
//
// Built from boxes in Minecraft's own proportions: 32 "pixels" from feet to the
// top of the head, which here is scaled to PLAYER_HEIGHT so the model matches
// the hitbox the physics actually uses. Arms stick out past the 0.6-wide
// hitbox, exactly as they do in Minecraft.
//
// There are no lights in this scene - the world is drawn with flat, unlit
// materials and fakes its shape with per-face shading - so the model does the
// same thing, using the mesher's shade values so it sits in the same light.
// ---------------------------------------------------------------------------
import * as THREE from '../lib/three.module.js';
import * as C from './constants.js';

// Same numbers as world/mesher.js, in BoxGeometry's face order: +X -X +Y -Y +Z -Z
const FACE_SHADE = [0.6, 0.6, 1.0, 0.5, 0.8, 0.8];

const U = C.PLAYER_HEIGHT / 32;        // one skin pixel, in blocks

const SKIN   = 0xe8b98a;
const HAIR   = 0x3b2616;
const SHIRT  = 0x2fb6c4;   // cyan: stands out against grass, snow, sand and netherrack alike
const SLEEVE = 0x27a0ad;
const PANTS  = 0x35478c;
const EYE    = 0x21202a;

/** A flat-shaded box, dark on the underside and sides like every world block. */
function box(w, h, d, color) {
  const g = new THREE.BoxGeometry(w, h, d);
  const c = new THREE.Color(color);
  const col = new Float32Array(24 * 3);
  for (let f = 0; f < 6; f++) {
    const s = FACE_SHADE[f];
    for (let v = 0; v < 4; v++) {
      const i = (f * 4 + v) * 3;
      col[i] = c.r * s; col[i + 1] = c.g * s; col[i + 2] = c.b * s;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true }));
}

/** A limb that swings from its top end, so the pivot is the shoulder or hip. */
function limb(w, h, d, color) {
  const pivot = new THREE.Group();
  const mesh = box(w, h, d, color);
  mesh.position.y = -h / 2;
  pivot.add(mesh);
  return pivot;
}

export class Avatar {
  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false;

    const hipY = 12 * U;

    // --- legs: hung from the hips ------------------------------------------
    this.legL = limb(4 * U, 12 * U, 4 * U, PANTS);
    this.legR = limb(4 * U, 12 * U, 4 * U, PANTS);
    this.legL.position.set(-2 * U, hipY, 0);
    this.legR.position.set(2 * U, hipY, 0);
    this.group.add(this.legL, this.legR);

    // --- everything above the hips, so sneaking can lean it as one ---------
    this.upper = new THREE.Group();
    this.upper.position.y = hipY;
    this.group.add(this.upper);

    const body = box(8 * U, 12 * U, 4 * U, SHIRT);
    body.position.y = 6 * U;
    this.upper.add(body);

    const shoulderY = 12 * U;
    this.armL = limb(4 * U, 12 * U, 4 * U, SLEEVE);
    this.armR = limb(4 * U, 12 * U, 4 * U, SLEEVE);
    this.armL.position.set(-6 * U, shoulderY, 0);
    this.armR.position.set(6 * U, shoulderY, 0);
    this.upper.add(this.armL, this.armR);

    // --- head: pivots at the neck so it can look up and down ---------------
    this.head = new THREE.Group();
    this.head.position.y = shoulderY;
    this.upper.add(this.head);

    const skull = box(8 * U, 8 * U, 8 * U, SKIN);
    skull.position.y = 4 * U;
    this.head.add(skull);

    const hair = box(8.4 * U, 2 * U, 8.4 * U, HAIR);
    hair.position.y = 7.2 * U;
    this.head.add(hair);

    // Eyes on the -Z face. Yaw 0 faces -Z, so this is the model's front.
    for (const sx of [-1, 1]) {
      const eye = box(1.6 * U, 1.6 * U, 0.4 * U, EYE);
      eye.position.set(sx * 1.8 * U, 4.6 * U, -4.1 * U);
      this.head.add(eye);
    }

    this.phase = 0;
  }

  /**
   * `pos` is the interpolated feet position - the same one the camera uses, so
   * the model never lags a frame behind the view.
   */
  update({ pos, yaw, pitch, player, dt, visible }) {
    this.group.visible = !!visible && !!player && !player.dead;
    if (!this.group.visible) return;

    this.group.position.set(pos.x, pos.y, pos.z);
    this.group.rotation.y = yaw;

    const speed = Math.hypot(player.vel.x, player.vel.z) * C.TPS;   // blocks/s
    const moving = speed > 0.25;

    // Stride keeps pace with how fast you are actually travelling.
    if (moving && player.onGround) this.phase += dt * (2.2 + speed * 1.15);
    else if (!moving) this.phase += dt * 0.9;                        // idle sway

    const amount = Math.min(1, speed / 5.6);
    const swing = Math.sin(this.phase) * (player.onGround ? 0.95 * amount : 0.25);

    if (player.onLadder) {
      // Climbing: reach hand over hand, legs tucked under.
      const climb = Math.sin(this.phase * 1.6);
      this.armL.rotation.x = -2.5 + climb * 0.5;
      this.armR.rotation.x = -2.5 - climb * 0.5;
      this.legL.rotation.x = 0.35 + climb * 0.3;
      this.legR.rotation.x = 0.35 - climb * 0.3;
    } else if (!player.onGround) {
      // Airborne: legs split and arms come up, so a jump reads at a glance.
      this.legL.rotation.x = 0.45 + swing;
      this.legR.rotation.x = -0.30 - swing;
      this.armL.rotation.x = -0.75 - swing;
      this.armR.rotation.x = -0.75 + swing;
    } else {
      this.legL.rotation.x = swing;
      this.legR.rotation.x = -swing;
      this.armL.rotation.x = -swing * 0.85;
      this.armR.rotation.x = swing * 0.85;
    }

    // Arms drift slightly away from the body as you speed up, like a run.
    this.armL.rotation.z = 0.06 + amount * 0.10;
    this.armR.rotation.z = -0.06 - amount * 0.10;

    // Sneaking: lean over the knees and drop, the way the eye height does.
    const lean = player.sneaking ? 0.5 : 0;
    this.upper.rotation.x += (lean - this.upper.rotation.x) * Math.min(1, dt * 14);
    const drop = player.sneaking ? (C.PLAYER_EYE - C.SNEAK_EYE) * 0.5 : 0;
    this.upper.position.y += ((12 * U - drop) - this.upper.position.y) * Math.min(1, dt * 14);

    // The head looks where the camera looks, minus whatever the torso is doing.
    this.head.rotation.x = Math.max(-1.2, Math.min(1.2, pitch)) - this.upper.rotation.x;
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }
}
