// ---------------------------------------------------------------------------
// LEVEL 1 - PLAINS
// Teaches the whole foundation of Minecraft parkour: the 2-block walk jump,
// the 3- and 4-block sprint jumps, stepping up, slabs and stairs, the fence
// you can never jump, ladders, and cobwebs.
// ---------------------------------------------------------------------------
export default {
  name: 'Plains',
  biome: 'plains',
  parTime: 75,
  spawn: [0.5, 6, 0.5],
  spawnYaw: 0,
  hint: 'Hold Ctrl (or double-tap W) to sprint. A sprint jump clears 4 blocks.',
  unlocks: ['Sprinting, slabs, stairs, ladders and cobwebs'],

  build(c, w, level) {
    c.at(0, 5, 0).facing(3).mat('grass');       // facing -Z

    // --- Warm-up: a wide starting island -----------------------------------
    c.pad(7, 7);
    for (let i = 1; i <= 3; i++) w.fill(-3, 5 - i, -3, 3, 5 - i, 3, i === 1 ? 'dirt' : 'stone');
    c.step(3);

    // --- Easy 2-block walk jumps -------------------------------------------
    c.mat('grass');
    for (let i = 0; i < 3; i++) { c.gap(2); c.pad(3, 3); c.leg(3, 'dirt'); }

    // --- Step up and over ---------------------------------------------------
    c.gap(2, { rise: 1 }); c.pad(3, 3); c.leg(4, 'dirt');
    c.gap(2, { rise: 1 }); c.pad(3, 3); c.leg(5, 'dirt');
    c.checkpoint();

    // --- 3-block jumps: you now need to sprint ------------------------------
    c.mat('oak_planks');
    for (let i = 0; i < 3; i++) { c.gap(3); c.pad(3, 3); c.leg(6, 'oak_log'); }

    // --- A corner: jump, then turn ------------------------------------------
    c.gap(3); c.pad(3, 3); c.leg(6, 'oak_log');
    c.turn('right');
    c.gap(3); c.pad(3, 3); c.leg(6, 'oak_log');
    c.turn('left');
    c.checkpoint();

    // --- Slabs and stairs: half-height steps you walk straight up -----------
    c.gap(2); c.pad(3, 3, 'cobblestone'); c.leg(6, 'cobblestone');
    c.step(2); c.pad(3, 1, 'cobble_slab');
    c.step(1); c.pad(3, 1, 'cobblestone');
    c.step(1); c.up(1).pad(3, 1, 'cobble_slab');
    c.step(1); c.pad(3, 1, 'cobblestone');
    c.step(2); c.pad(3, 3, 'cobblestone'); c.leg(8, 'cobblestone');

    // --- The fence: 1.5 blocks tall, so you can NEVER jump it ---------------
    // The only way through is the 1-block gap on the right.
    c.gap(2); c.pad(5, 5, 'oak_planks'); c.leg(8, 'oak_log');
    c.place('oak_fence', 1, -2, 1); c.place('oak_fence', 1, -1, 1);
    c.place('oak_fence', 1,  0, 1); c.place('oak_fence', 1,  1, 1);
    c.step(3);
    c.checkpoint();

    // --- Cobweb crawl: you barely move, so line the jump up first -----------
    c.gap(2); c.pad(3, 3, 'oak_planks'); c.leg(8, 'oak_log');
    c.place('cobweb', 0, 0, 1); c.place('cobweb', 1, 0, 1);
    c.step(2); c.pad(3, 3, 'oak_planks');

    // --- Down a ladder, then the big one ------------------------------------
    c.gap(2); c.pad(3, 3, 'stone'); c.leg(10, 'stone');
    for (let h = 1; h <= 4; h++) c.place('ladder', 1, 0, h);
    c.step(1).up(4).pad(3, 3, 'stone');
    for (let i = 1; i <= 4; i++) w.set(c.x, c.y - i, c.z, 'stone');

    // --- The signature 4-block sprint jump ----------------------------------
    c.gap(4); c.pad(3, 3, 'gold_block'); c.leg(12, 'stone');
    c.checkpoint();
    c.gap(4); c.pad(3, 3, 'gold_block'); c.leg(12, 'stone');
    c.gap(4); c.pad(5, 5, 'gold_block'); c.leg(12, 'stone');

    // --- Goal ---------------------------------------------------------------
    c.step(1).goal();
    c.place('glowstone', 0, -2, 0); c.place('glowstone', 0, 2, 0);

    decorate(w);
  },
};

// A few trees and grass patches so it reads as the Plains rather than a void.
function decorate(w) {
  const rand = (() => { let s = 12345;
    return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; })();
  for (let i = 0; i < 26; i++) {
    const x = Math.round((rand() - 0.5) * 90);
    const z = Math.round(-rand() * 110 + 10);
    const y = -6 + Math.round(rand() * 3);
    // Ground patch
    for (let dx = -3; dx <= 3; dx++)
      for (let dz = -3; dz <= 3; dz++)
        if (dx * dx + dz * dz < 9) w.set(x + dx, y, z + dz, 'grass');
    if (rand() < 0.55) {
      const h = 4 + Math.round(rand() * 2);
      for (let k = 1; k <= h; k++) w.set(x, y + k, z, 'oak_log');
      for (let dx = -2; dx <= 2; dx++)
        for (let dz = -2; dz <= 2; dz++)
          for (let dy = 0; dy <= 2; dy++) {
            if (Math.abs(dx) + Math.abs(dz) + dy > 4) continue;
            if (dx === 0 && dz === 0 && dy < 2) continue;
            w.set(x + dx, y + h + dy, z + dz, 'oak_leaves');
          }
    }
  }
}
