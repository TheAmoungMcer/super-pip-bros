import { test, expect } from 'bun:test';
import { solve, movesToRoute, replayRoute } from '../tools/autopilot.js';
import { validateLevels } from '../tools/validate-levels.js';

const tiny = {
  t1: {
    id: 't1', time: 300, start: [1, 10],
    map: String.raw`
..............................
..............................
..............................
..............................
..............................
..............................
..............................
..............................
..............................
.....................G........
..........c..........G........
#########...####...###########
#########...####...###########`,
  },
};

test('autopilot beats a level with gaps and an enemy, and the route replays', () => {
  const r = solve(tiny, 't1', { width: 24, maxSteps: 200 });
  expect(r).not.toBe(null);
  const route = movesToRoute('t1', r.moves);
  const s = replayRoute(tiny, route);
  expect(s.mode).toBe('done');
});

test('validator reports broken levels', () => {
  const bad = {
    a: { id: 'a', time: 0, start: [1, 0], map: '..\n..', pipes: [{ at: [0, 0], dir: 'down', to: { level: 'zzz', at: [0, 0], dir: 'up' } }] },
  };
  const errs = validateLevels(bad);
  expect(errs.some(e => e.includes('time'))).toBe(true);
  expect(errs.some(e => e.includes('goal'))).toBe(true);
  expect(errs.some(e => e.includes('zzz'))).toBe(true);
  expect(errs.some(e => e.includes('not a pipe'))).toBe(true);
  expect(errs.some(e => e.includes('start'))).toBe(true);
});

test('the dev sandbox is a valid level', async () => {
  const { LEVELS } = await import('../src/content/levels/dev.js');
  expect(validateLevels(LEVELS)).toEqual([]);
});
