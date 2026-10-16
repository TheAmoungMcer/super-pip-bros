import { parseLevel } from '../src/game/level.js';
export const lvl = (map, extra = {}) => parseLevel({ id: 't', theme: 'overworld', time: 300, start: [1, 1], map, ...extra });
import { createLevelSim, stepLevel } from '../src/game/sim.js';
import { SUB } from '../src/game/consts.js';
export const simOf = (map, opts = {}, start = [2, 5]) => {
  const s = createLevelSim({ id: 't', theme: 'overworld', time: 300, start, map }, opts);
  stepLevel(s, []);
  return s;
};
export const find = (s, type) => s.entities.find(e => e.type === type);
export const dropOn = (p, e) => { p.x = e.x; p.y = e.y - p.h * SUB - 6 * SUB; p.vy = 16; p.onGround = false; };
export const steps = (s, n, inputs = []) => { for (let i = 0; i < n; i++) stepLevel(s, typeof inputs === 'function' ? inputs(i) : inputs); };
