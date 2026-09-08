// ---------------------------------------------------------------------------
// LEVEL 2 - SNOWY TUNDRA
// New mechanic: ICE. Slipperiness 0.98 instead of 0.6, so you keep almost all
// your speed. You accelerate slowly, and you do not stop when you let go.
// Blue ice (0.989) is worse. The whole level is about NOT overshooting.
// ---------------------------------------------------------------------------
export default {
  name: 'Snowy Tundra',
  biome: 'snowy',
  parTime: 105,
  spawn: [0.5, 6, 0.5],
  hint: 'On ice you keep sliding. Stop pressing forward BEFORE the edge, or use Shift to sneak.',
  unlocks: ['Ice, packed ice, blue ice, snow layers and powder snow'],

  build(c, w, level) {
    c.at(0, 5, 0).facing(3).mat('snow_block');

    c.pad(7, 5); c.leg(4, 'stone'); c.step(4);

    // --- Meet the ice: short slides you can't overshoot -------------------
    for (let i = 0; i < 3; i++) {
      c.gap(2); c.pad(5, 4, 'ice'); c.leg(5, 'packed_ice'); c.step(3);
    }
    c.gap(2); c.pad(7, 5, 'snow_block'); c.leg(5, 'stone'); c.step(4);
    c.checkpoint();

    // --- A long ice runway, then a jump. Too much speed = you fly past ----
    c.gap(2); c.pad(3, 10, 'ice'); c.leg(6, 'packed_ice'); c.step(9);
    c.gap(3); c.pad(5, 5, 'snow_block'); c.leg(6, 'stone'); c.step(4);

    // --- Snow layers: only 1/8 of a block tall, you walk straight over ----
    c.gap(2); c.pad(3, 6, 'packed_ice'); c.leg(6, 'packed_ice');
    for (let i = 0; i < 6; i += 2) c.place('snow_layer', i, 0, 1);
    c.step(5);
    c.gap(2); c.pad(5, 4, 'snow_block'); c.leg(7, 'stone'); c.step(3);
    c.checkpoint();

    // --- Ice corners: turning while sliding is the hard part --------------
    c.gap(3); c.pad(4, 4, 'ice'); c.leg(7, 'packed_ice');
    c.turn('right'); c.step(1);
    c.gap(2); c.pad(4, 4, 'ice'); c.leg(7, 'packed_ice');
    c.turn('left'); c.step(1);
    c.gap(2); c.pad(4, 4, 'ice'); c.leg(7, 'packed_ice'); c.step(3);
    c.gap(2); c.pad(5, 5, 'snow_block'); c.leg(8, 'stone'); c.step(4);
    c.checkpoint();

    // --- Powder snow: you sink into it and fall slowly. A safety net. -----
    c.gap(2); c.pad(5, 3, 'snow_block'); c.leg(8, 'stone'); c.step(2);
    for (let i = 0; i < 5; i++)
      for (let b = -2; b <= 2; b++) c.place('powder_snow', 2 + i, b, 0);
    c.gap(1); c.pad(5, 3, 'snow_block'); c.leg(8, 'stone'); c.step(2);

    // --- Blue ice: the slipperiest block in the game (0.989) -------------
    c.gap(2); c.pad(3, 8, 'blue_ice'); c.leg(8, 'packed_ice'); c.step(7);
    c.gap(3); c.pad(3, 3, 'snow_block'); c.leg(8, 'stone');
    c.checkpoint();

    // --- Ice stairs upward, then the finish -------------------------------
    for (let i = 0; i < 3; i++) { c.gap(2, { rise: 1 }); c.pad(3, 3, 'packed_ice'); c.leg(9, 'stone'); }
    c.gap(3); c.pad(3, 3, 'ice'); c.leg(10, 'packed_ice');
    c.gap(4); c.pad(5, 5, 'quartz_block'); c.leg(10, 'stone'); c.step(2);
    c.goal();
    c.place('glowstone', 0, -2, 0); c.place('glowstone', 0, 2, 0);

    decorate(w);
  },
};

function decorate(w) {
  let s = 777;
  const rand = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 30; i++) {
    const x = Math.round((rand() - 0.5) * 90);
    const z = Math.round(-rand() * 130 + 10);
    const y = -6 + Math.round(rand() * 3);
    for (let dx = -4; dx <= 4; dx++)
      for (let dz = -4; dz <= 4; dz++)
        if (dx * dx + dz * dz < 15) w.set(x + dx, y, z + dz, 'snow_block');
    // Ice spikes, the signature of the biome
    if (rand() < 0.5) {
      const h = 5 + Math.round(rand() * 7);
      for (let k = 1; k <= h; k++) {
        const r = k < h * 0.6 ? 1 : 0;
        for (let dx = -r; dx <= r; dx++)
          for (let dz = -r; dz <= r; dz++) w.set(x + dx, y + k, z + dz, 'packed_ice');
      }
    }
  }
}
