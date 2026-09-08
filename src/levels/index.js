import level1 from './level1.js';
import level2 from './level2.js';
import level3 from './level3.js';
import level4 from './level4.js';
import level5 from './level5.js';

// The five main levels, in order. Beating one unlocks the next.
export const LEVELS = [level1, level2, level3, level4, level5];

export const levelById = (id) => LEVELS.find((l) => l.name === id) || LEVELS[0];
