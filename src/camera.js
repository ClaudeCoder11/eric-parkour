// First-person <-> third-person camera. Third person pulls back along the view
// ray and stops short of any solid block so the camera never ends up inside a wall.
import * as THREE from '../lib/three.module.js';
import { AABB } from './physics.js';

export class PlayerCamera {
  constructor(fov = 78) {
    this.cam = new THREE.PerspectiveCamera(fov, 1, 0.05, 400);
    this.mode = 'first';            // 'first' | 'third'
    this.distance = 4.2;
    this.baseFov = fov;
    this.shake = 0;
  }

  toggle() {
    this.mode = this.mode === 'first' ? 'third' : 'first';
    return this.mode;
  }

  resize(w, h) {
    this.cam.aspect = w / h;
    this.cam.updateProjectionMatrix();
  }

  /** `pos` is the interpolated feet position. */
  update(pos, eyeHeight, yaw, pitch, world, dt, speedBps = 0) {
    const eye = new THREE.Vector3(pos.x, pos.y + eyeHeight, pos.z);

    // Sprinting nudges the FOV out, like Minecraft's speed effect.
    const wantFov = this.baseFov + Math.min(8, Math.max(0, speedBps - 4.4) * 2.6);
    this.cam.fov += (wantFov - this.cam.fov) * Math.min(1, dt * 8);
    this.cam.updateProjectionMatrix();

    if (this.mode === 'first') {
      this.cam.position.copy(eye);
    } else {
      const dir = new THREE.Vector3(
        -Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
      let dist = this.distance;
      // Walk backwards from the eye until we would enter a block.
      const step = 0.2;
      for (let d = step; d <= this.distance; d += step) {
        const p = eye.clone().addScaledVector(dir, -d);
        const box = new AABB(p.x - 0.16, p.y - 0.16, p.z - 0.16,
                             p.x + 0.16, p.y + 0.16, p.z + 0.16);
        const hits = world.collisionBoxesIn(box, 0);
        if (hits.some((b) => box.intersects(b))) { dist = Math.max(0.6, d - step); break; }
      }
      this.cam.position.copy(eye).addScaledVector(dir, -dist);
    }

    this.cam.rotation.set(0, 0, 0, 'YXZ');
    this.cam.rotation.order = 'YXZ';
    this.cam.rotation.y = yaw;
    this.cam.rotation.x = pitch;

    if (this.shake > 0) {
      this.cam.position.x += (Math.random() - 0.5) * this.shake;
      this.cam.position.y += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 1.4);
    }
  }
}
