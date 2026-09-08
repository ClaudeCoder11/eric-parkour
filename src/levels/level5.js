// ---------------------------------------------------------------------------
// LEVEL 5 - NETHER WASTES
// The finale. New mechanics: SOUL SAND (40% speed, and it sits slightly low),
// MAGMA (burns you after about a second), LAVA (instant death), and POTIONS.
//
// Jump Boost genuinely changes the jump physics, so the potion sections open
// up jumps that are impossible anywhere else in the game.
// ---------------------------------------------------------------------------
export default {
  name: 'Nether Wastes',
  biome: 'nether',
  parTime: 200,
  spawn: [0.5, 6, 0.5],
  hint: 'Walk through a potion to drink it. Jump Boost really does make you jump further.',
  unlocks: ['You beat the game — endless mode is now open'],

  build(c, w, level) {
    c.at(0, 5, 0).facing(3).mat('netherrack');

    c.pad(7, 5); c.leg(5, 'netherrack'); c.step(4);

    // --- Soul sand: 40% speed, so no sprint jumps from it ------------------
    c.gap(2); c.pad(3, 5, 'soul_sand'); c.leg(6, 'soul_soil'); c.step(4);
    c.gap(1); c.pad(3, 3, 'nether_bricks'); c.leg(6, 'netherrack');
    c.gap(2); c.pad(3, 4, 'soul_sand'); c.leg(7, 'soul_soil'); c.step(3);
    c.gap(1); c.pad(5, 4, 'nether_bricks'); c.leg(7, 'netherrack'); c.step(3);
    c.checkpoint();

    // --- A lava lake. Touching it is instant death. -----------------------
    lavaLake(w, c.x, c.y - 6, c.z - 16, 11, 26);
    for (let i = 0; i < 4; i++) { c.gap(3); c.pad(3, 3, 'nether_bricks'); c.leg(5, 'nether_bricks'); }
    c.gap(3); c.pad(5, 4, 'nether_bricks'); c.leg(6, 'netherrack'); c.step(3);
    c.checkpoint();

    // --- SPEED potion, then a run that needs the extra speed --------------
    c.place('potion_speed', 1, 0, 1);
    c.step(2);
    c.gap(2); c.pad(3, 3, 'crimson_planks'); c.leg(8, 'netherrack');
    c.gap(4); c.pad(3, 3, 'crimson_planks'); c.leg(8, 'netherrack');
    c.gap(4); c.pad(3, 3, 'crimson_planks'); c.leg(8, 'netherrack');
    c.gap(4); c.pad(5, 4, 'nether_bricks'); c.leg(9, 'netherrack'); c.step(3);
    c.checkpoint();

    // --- Magma: it burns you after ~1 second, so keep moving --------------
    c.gap(2); c.pad(3, 3, 'nether_bricks'); c.leg(9, 'netherrack');
    for (let i = 0; i < 6; i++) {
      c.gap(1);
      c.pad(3, 1, i % 2 === 0 ? 'magma_block' : 'nether_bricks');
      c.leg(6, 'netherrack');
    }
    c.gap(2); c.pad(5, 4, 'nether_bricks'); c.leg(10, 'netherrack'); c.step(3);
    c.checkpoint();

    // --- JUMP BOOST: gaps here are 5 and 6 blocks. Impossible without it. --
    c.place('potion_jump', 1, 0, 1);
    c.step(2);
    c.gap(5, { boosted: true }); c.pad(3, 3, 'glowstone'); c.leg(10, 'netherrack');
    c.gap(5, { boosted: true }); c.pad(3, 3, 'glowstone'); c.leg(10, 'netherrack');
    c.gap(5, { boosted: true }); c.pad(5, 4, 'nether_bricks'); c.leg(11, 'netherrack'); c.step(3);
    c.checkpoint();

    // --- SLOW FALLING: drop off the edge and drift down safely ------------
    c.place('potion_slowfall', 1, 0, 1);
    c.step(2);
    c.gap(2); c.down(9).pad(5, 5, 'nether_bricks'); c.leg(10, 'netherrack'); c.step(4);
    lavaLake(w, c.x, c.y - 4, c.z - 10, 9, 18);

    // --- Final run to the portal ------------------------------------------
    c.gap(3); c.pad(3, 3, 'nether_bricks'); c.leg(6, 'nether_bricks');
    c.gap(3); c.pad(3, 3, 'nether_bricks'); c.leg(6, 'nether_bricks');
    c.gap(4); c.pad(5, 6, 'obsidian'); c.leg(8, 'obsidian'); c.step(3);

    // The nether portal: obsidian frame, purple middle. That's the finish.
    c.goal('obsidian');
    const gx = c.x, gy = c.y + 1, gz = c.z;
    for (let h = 0; h < 4; h++)
      for (let b = -1; b <= 1; b++) {
        const edge = (h === 0 || h === 3 || b === -1 || b === 1);
        w.set(gx + b, gy + h, gz, edge ? 'obsidian' : 'nether_portal');
      }
    w.set(gx, gy + 1, gz, 'nether_portal');
    w.set(gx, gy + 2, gz, 'nether_portal');
    level.goal = { x: gx + 0.5, y: gy, z: gz + 0.5 };

    decorate(w);
  },
};

function lavaLake(w, cx, y, cz, halfW, halfD) {
  for (let dx = -halfW; dx <= halfW; dx++)
    for (let dz = -halfD; dz <= halfD; dz++) {
      w.set(cx + dx, y, cz + dz, 'lava');
      w.set(cx + dx, y - 1, cz + dz, 'netherrack');
    }
}

function decorate(w) {
  let s = 5150;
  const rand = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  // A netherrack ceiling and floor so it feels enclosed, like the real Nether.
  for (let i = 0; i < 26; i++) {
    const x = Math.round((rand() - 0.5) * 80);
    const z = Math.round(-rand() * 165 + 10);
    const h = 3 + Math.round(rand() * 9);
    const r = 3 + Math.round(rand() * 3);
    for (let k = 0; k < h; k++)
      for (let dx = -r; dx <= r; dx++)
        for (let dz = -r; dz <= r; dz++)
          if (dx * dx + dz * dz <= (r - k * 0.3) * (r - k * 0.3))
            w.set(x + dx, -12 + k, z + dz, rand() < 0.06 ? 'glowstone' : 'netherrack');
  }
  for (let i = 0; i < 14; i++) {           // ceiling chunks
    const x = Math.round((rand() - 0.5) * 80);
    const z = Math.round(-rand() * 165 + 10);
    const r = 4 + Math.round(rand() * 4);
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++)
        if (dx * dx + dz * dz <= r * r)
          for (let k = 0; k < 3; k++) w.set(x + dx, 26 + k, z + dz, 'netherrack');
  }
}
