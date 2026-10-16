import { parseLevel } from '../src/game/level.js';
export const lvl = (map, extra = {}) => parseLevel({ id: 't', theme: 'overworld', time: 300, start: [1, 1], map, ...extra });
