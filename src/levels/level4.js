// ---------------------------------------------------------------------------
// LEVEL 4 - BADLANDS
// The technical level. New mechanics: PISTONS (moving platforms that carry you)
// and NEOS - landing on the narrow side edge of a block instead of its top.
// Plus headhitters: ceilings low enough that you cannot jump under them.
// ---------------------------------------------------------------------------
export default {
  name: 'Badlands',
  biome: 'badlands',
  parTime: 165,
  spawn: [0.5, 6, 0.5],
  hint: 'Pistons carry you while you stand on them. Wait for the timing — do not rush.',
  unlocks: ['Pistons, trapdoors, headhitters and neo jumps'],

  build(c, w, level) {
    c.at(0, 5, 0).facing(3).mat('terracotta');

    c.pad(7, 5); c.leg(4, 'terracotta'); c.step(4);

    // --- Narrow beams: 1 block wide, no room for error --------------------
    c.gap(2); c.pad(1, 5, 'deepslate'); c.leg(5, 'deepslate'); c.step(4);
    c.gap(3); c.pad(1, 5, 'deepslate'); c.leg(6, 'deepslate'); c.step(4);
    c.gap(2); c.pad(5, 4, 'terracotta'); c.leg(6, 'terracotta'); c.step(3);
    c.checkpoint();

    // --- Headhitters: the ceiling is 2 above, so you CANNOT jump here -----
    c.gap(2); c.pad(3, 8, 'red_sand'); c.leg(7, 'terracotta');
    for (let i = 0; i < 8; i++)
      for (let b = -1; b <= 1; b++) c.place('deepslate', i, b, 3);
    c.step(7);
    c.gap(2); c.pad(5, 4, 'terracotta'); c.leg(8, 'terracotta'); c.step(3);

    // --- Neos: land on the SIDE edge of a block, not the top --------------
    // Each pillar is 1x1 with its top exactly one block up, so you clip the
    // corner and stand on the lip.
    for (let i = 0; i < 4; i++) {
      c.gap(2, { side: i % 2 ? 1 : -1 });
      c.pad(1, 1, 'iron_block');
      c.leg(9, 'deepslate');
    }
    c.gap(2); c.pad(5, 4, 'terracotta'); c.leg(9, 'terracotta'); c.step(3);
    c.checkpoint();

    // --- Pistons: platforms that push you up and carry you ----------------
    c.gap(2); c.pad(3, 3, 'redstone_block'); c.leg(9, 'deepslate'); c.step(2);
    c.gap(3); c.piston({ w: 3, d: 3, reach: 4, dir: 'up', period: 80, phase: 0 });
    c.step(2);
    c.gap(3); c.up(4).pad(3, 3, 'terracotta'); c.leg(14, 'terracotta'); c.step(2);

    // A piston that slides sideways: step on, ride across, step off.
    c.gap(2); c.pad(3, 3, 'redstone_block'); c.leg(14, 'deepslate'); c.step(2);
    c.gap(2); c.piston({ w: 3, d: 3, reach: 6, dir: 'right', period: 110, phase: 20 });
    c.step(2);
    // the piston carries you the 6 blocks across; you just step off
    c.gap(2, { side: 6, carried: true });
    c.pad(5, 4, 'terracotta'); c.leg(15, 'terracotta'); c.step(3);
    c.checkpoint();

    // --- Two pistons out of phase: hop from one to the other --------------
    c.gap(2); c.piston({ w: 3, d: 3, reach: 3, dir: 'up', period: 70, phase: 0 });
    c.gap(3); c.piston({ w: 3, d: 3, reach: 3, dir: 'up', period: 70, phase: 35 });
    c.gap(3); c.up(3).pad(5, 4, 'terracotta'); c.leg(17, 'terracotta'); c.step(3);
    c.checkpoint();

    // --- Trapdoors: the top eighth of a block, easy to miss ---------------
    c.gap(2); c.pad(3, 3, 'terracotta'); c.leg(17, 'terracotta');
    for (let i = 0; i < 4; i++) {
      c.gap(1); w.set(c.x, c.y, c.z, 'trapdoor');
      for (let k = 1; k <= 3; k++) w.set(c.x, c.y - k, c.z, 'deepslate');
    }
    c.gap(2); c.pad(5, 5, 'gold_block'); c.leg(18, 'terracotta'); c.step(2);
    c.goal();
    c.place('glowstone', 0, -2, 0); c.place('glowstone', 0, 2, 0);

    decorate(w);
  },
};

function decorate(w) {
  let s = 909;
  const rand = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const layers = ['terracotta', 'red_sand', 'terracotta', 'sand', 'red_sand'];
  for (let i = 0; i < 20; i++) {
    const x = Math.round((rand() - 0.5) * 96);
    const z = Math.round(-rand() * 150 + 10);
    const y = -8;
    const h = 6 + Math.round(rand() * 12);              // banded mesa plateaus
    const rad = 4 + Math.round(rand() * 4);
    for (let k = 0; k <= h; k++) {
      const r = Math.max(1, rad - Math.floor(k / 5));
      for (let dx = -r; dx <= r; dx++)
        for (let dz = -r; dz <= r; dz++)
          if (dx * dx + dz * dz <= r * r) w.set(x + dx, y + k, z + dz, layers[k % layers.length]);
    }
  }
}
