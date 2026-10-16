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

test('a level whose goal is in a routed sub-area is valid', () => {
  const defs = {
    a: { id: 'a', time: 300, start: [1, 1], route: ['a', 'b'], map: '....\n....\n####' },
    b: { id: 'b', sub: true, time: 300, start: [1, 1], map: '..G.\n..G.\n####' },
  };
  expect(validateLevels(defs)).toEqual([]);
});

test('autopilot heads for the pipe that leads to the next routed area', () => {
  const row = (s) => s.padEnd(30, '.');
  const defs = {
    a: {
      id: 'a', time: 300, start: [2, 11], route: ['a', 'b'],
      pipes: [{ at: [10, 6], dir: 'up', to: { level: 'b', at: [2, 10], dir: 'up' } }],
      map: ['#'.repeat(30), '#'.repeat(30), row('..........{}'), row('..........{}'), row('..........{}'), row('..........{}'),
        row('..........[]'), row(''), row(''), row(''), row(''), row(''), '#'.repeat(30), '#'.repeat(30)].join('\n'),
    },
    b: {
      id: 'b', sub: true, time: 300, start: [5, 11],
      map: [row(''), row(''), row(''), row(''), row(''), row(''), row(''), row(''), row('....................GG'),
        row('....................GG'), row('..[]................GG'), row('..{}................GG'), '#'.repeat(30), '#'.repeat(30)].join('\n'),
    },
  };
  const r = solve(defs, 'a', { width: 32, maxSteps: 200 });
  expect(r).not.toBe(null);
  expect(replayRoute(defs, movesToRoute('a', r.moves)).mode).toBe('done');
});
