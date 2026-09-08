// ---------------------------------------------------------------------------
// LEVEL 3 - JUNGLE
// New mechanics: SLIME (bounces you back with the speed you landed at) and
// HONEY (slows you to 40%, halves your jump, and sticks you to walls).
// Plus vines and scaffolding to climb.
// ---------------------------------------------------------------------------
export default {
  name: 'Jungle',
  biome: 'jungle',
  parTime: 130,
  spawn: [0.5, 6, 0.5],
  hint: 'Slime bounces you as high as you fell. Hold Shift when you land to NOT bounce.',
  unlocks: ['Slime blocks, honey blocks, vines and scaffolding'],
  tint: { oak_leaves: [0.72, 1.0, 0.62] },

  build(c, w, level) {
    c.at(0, 5, 0).facing(3).mat('jungle_planks');

    c.pad(7, 5); c.leg(4, 'jungle_planks'); c.step(4);

    // --- First bounce: land on slime, get thrown to the next platform -----
    c.gap(2); c.pad(3, 3, 'slime_block'); c.leg(5, 'jungle_planks');
    c.gap(2, { rise: 1 }); c.pad(3, 3); c.leg(6, 'jungle_planks'); c.step(2);
    c.gap(2); c.pad(3, 3, 'slime_block'); c.leg(6, 'jungle_planks');
    c.gap(3, { rise: 1 }); c.pad(5, 4); c.leg(7, 'jungle_planks'); c.step(3);
    c.checkpoint();

    // --- Bounce chain: three slimes in a row, don't lose your line --------
    for (let i = 0; i < 3; i++) { c.gap(3); c.pad(3, 3, 'slime_block'); c.leg(8, 'jungle_planks'); }
    c.gap(3); c.pad(5, 4); c.leg(8, 'jungle_planks'); c.step(3);
    c.checkpoint();

    // --- Honey: you crawl and your jump is halved. Short hops only. ------
    c.gap(2); c.pad(3, 6, 'honey_block'); c.leg(8, 'jungle_planks');
    c.step(5);
    c.gap(1); c.pad(3, 3, 'jungle_planks'); c.leg(8, 'jungle_planks');
    c.gap(2); c.pad(3, 5, 'honey_block'); c.leg(9, 'jungle_planks'); c.step(4);
    c.gap(1); c.pad(5, 4, 'jungle_planks'); c.leg(9, 'jungle_planks'); c.step(3);
    c.checkpoint();

    // --- Climb: vines up a trunk, then a scaffolding tower ----------------
    c.gap(2); c.pad(3, 3, 'oak_log'); c.leg(9, 'oak_log');
    for (let h = 1; h <= 6; h++) { w.set(c.x, c.y + h, c.z, 'oak_log'); c.place('vine', 0, 1, h); }
    c.step(1).up(6).pad(3, 3, 'jungle_planks');
    for (let i = 1; i <= 6; i++) w.set(c.x, c.y - i, c.z, 'oak_log');

    c.gap(3); c.pad(3, 3, 'jungle_planks'); c.leg(12, 'oak_log');
    for (let h = 1; h <= 4; h++) c.place('scaffolding', 0, 1, h);
    c.gap(3, { rise: 1 }); c.pad(3, 3, 'jungle_planks'); c.leg(14, 'oak_log');
    c.checkpoint();

    // --- Water landing: a safe way down, then back up ---------------------
    c.gap(3); c.pad(5, 5, 'jungle_planks'); c.leg(14, 'oak_log');
    c.step(4);
    c.gap(2); c.down(4).pad(5, 5, 'stone');
    for (let dx = -2; dx <= 2; dx++)
      for (let dz = -2; dz <= 2; dz++) w.set(c.x + dx, c.y + 1, c.z + dz, 'water');
    c.leg(10, 'stone'); c.step(4);

    // --- Slime + honey combined, then the finish --------------------------
    c.gap(2, { rise: 1 }); c.pad(3, 3, 'slime_block'); c.leg(12, 'oak_log');
    c.gap(3, { rise: 1 }); c.pad(3, 4, 'honey_block'); c.leg(12, 'oak_log'); c.step(3);
    c.gap(1); c.pad(3, 3, 'slime_block'); c.leg(12, 'oak_log');
    c.gap(4); c.pad(5, 5, 'emerald_block'); c.leg(13, 'oak_log'); c.step(2);
    c.goal();
    c.place('glowstone', 0, -2, 0); c.place('glowstone', 0, 2, 0);

    decorate(w);
  },
};

function decorate(w) {
  let s = 4242;
  const rand = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 34; i++) {
    const x = Math.round((rand() - 0.5) * 86);
    const z = Math.round(-rand() * 135 + 10);
    const y = -6 + Math.round(rand() * 2);
    for (let dx = -3; dx <= 3; dx++)
      for (let dz = -3; dz <= 3; dz++)
        if (dx * dx + dz * dz < 10) w.set(x + dx, y, z + dz, 'grass');
    const h = 7 + Math.round(rand() * 8);       // tall jungle trees
    for (let k = 1; k <= h; k++) {
      w.set(x, y + k, z, 'oak_log');
      if (k > 3 && rand() < 0.5) w.set(x + 1, y + k, z, 'vine');
    }
    for (let dx = -3; dx <= 3; dx++)
      for (let dz = -3; dz <= 3; dz++)
        for (let dy = 0; dy <= 2; dy++) {
          if (Math.abs(dx) + Math.abs(dz) + dy > 5) continue;
          w.set(x + dx, y + h + dy, z + dz, 'oak_leaves');
        }
  }
}
