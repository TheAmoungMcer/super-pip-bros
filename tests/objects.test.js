import { test, expect } from 'bun:test';
import { createLevelSim, stepLevel } from '../src/game/sim.js';
import { simOf, find, dropOn, steps } from './helpers.js';
import { BTN, SUB, TS } from '../src/game/consts.js';
import { tileAt } from '../src/game/level.js';
import { T } from '../src/game/tiles.js';

const main = {
  id: 'm', time: 300, start: [2, 5],
  map: String.raw`
....................
....................
....................
.....B..............
........[]..........
........{}..........
####################`,
  pipes: [{ at: [8, 4], dir: 'down', to: { level: 'sub', at: [3, 4], dir: 'up' } }],
};
const sub = {
  id: 'sub', time: 300, start: [1, 5],
  map: String.raw`
..........
..........
..........
....CC....
...[].....
...{}.....
##########`,
  pipes: [{ at: [3, 4], dir: 'down', to: { level: 'm', at: [8, 4], dir: 'up' } }],
};
const defs = { m: main, sub };
const run = (s, n, b) => { for (let i = 0; i < n; i++) stepLevel(s, typeof b === 'function' ? b(i) : b); };

test('pressing down on a pipe moves both players to the linked area', () => {
  const s = createLevelSim(main, { players: 2, defs });
  const p = s.players[0];
  p.x = 8 * TS + 10 * SUB; p.y = 4 * TS - p.h * SUB - 8 * SUB;
  run(s, 20, [0, 0]);
  run(s, 40, [BTN.DOWN, 0]);
  expect(s.lv.id).toBe('sub');
  expect(s.entities.length).toBe(0);
  run(s, 40, [0, 0]);
  expect(s.players[0].pipe).toBe(null);
  expect(Math.floor(s.players[0].x / TS)).toBe(3);
  expect(s.players[1].x).toBe(s.players[0].x);
});

test('areas keep their state when you come back', () => {
  const s = createLevelSim(main, { forms: ['big'], defs });
  const p = s.players[0];
  p.x = 5 * TS + 2 * SUB;
  run(s, 30, [BTN.A]);                                // break the brick
  expect(tileAt(s.lv, 5, 3)).toBe(T.EMPTY);
  run(s, 60, [0]);
  p.x = 8 * TS + 10 * SUB; p.y = 4 * TS - p.h * SUB - 8 * SUB; p.vy = 0;
  run(s, 20, [0]);
  run(s, 40, [BTN.DOWN]);
  expect(s.lv.id).toBe('sub');
  run(s, 40, [0]);
  const q = s.players[0];
  q.x = 3 * TS + 10 * SUB; q.y = 4 * TS - q.h * SUB - 8 * SUB; q.vy = 0;
  run(s, 20, [0]);
  run(s, 40, [BTN.DOWN]);
  expect(s.lv.id).toBe('m');
  expect(tileAt(s.lv, 5, 3)).toBe(T.EMPTY);
});

test('P-switch swaps bricks and coins, then swaps back', () => {
  const s = simOf(String.raw`
....................
....................
..P.BB..CC..........
....................
....................
....................
####################`);
  steps(s, 30, [BTN.A]);
  const sw = find(s, 'pswitch');
  expect(sw).toBeDefined();
  steps(s, 60, [0]);
  dropOn(s.players[0], sw);
  for (let i = 0; i < 10 && s.pswitch === 0; i++) steps(s, 1);
  expect(s.pswitch).toBeGreaterThan(0);
  expect(tileAt(s.lv, 4, 2)).toBe(T.PSWITCH_COIN);
  expect(tileAt(s.lv, 8, 2)).toBe(T.PSWITCH_BRICK);
  steps(s, 610);
  expect(tileAt(s.lv, 4, 2)).toBe(T.BRICK);
  expect(tileAt(s.lv, 8, 2)).toBe(T.COIN);
});

test('horizontal lift carries its rider and falls once ridden', () => {
  const s = simOf(String.raw`
....................
....................
....................
..........m.........
....................
....................
....................`, {}, [10, 0]);
  const lift = find(s, 'lift_h'), p = s.players[0];
  p.x = lift.x + 8 * SUB; p.y = lift.y - p.h * SUB - 4 * SUB; p.vy = 8;
  steps(s, 10);
  expect(p.ride).toBe(lift.id);
  expect(p.onGround).toBe(true);
  const x0 = p.x, y0 = lift.y;
  steps(s, 30);
  expect(p.x).toBeLessThan(x0);
  expect(lift.y).toBeGreaterThan(y0);
  expect(p.y + p.h * SUB).toBe(lift.y);
});

test('vertical lift lifts its rider', () => {
  const s = simOf(String.raw`
....................
....................
....................
....................
..........n.........
....................
####################`, {}, [10, 0]);
  const lift = find(s, 'lift_v'), p = s.players[0];
  p.x = lift.x + 8 * SUB; p.y = lift.y - p.h * SUB - 4 * SUB; p.vy = 8;
  let minFoot = Infinity;
  steps(s, 200, () => { minFoot = Math.min(minFoot, p.y + p.h * SUB); return []; });
  expect(p.ride).toBe(lift.id);
  expect((5 * TS - minFoot) / SUB).toBeGreaterThan(40);
});

test('pressing up at a door teleports to its target', () => {
  const s = simOf(String.raw`
....................
....................
....................
....................
...D..........D.....
...D..........D.....
####################`);
  s.lv.doors = [{ at: [3, 5], to: { at: [14, 5] } }];
  const p = s.players[0];
  p.x = 3 * TS + 2 * SUB;
  steps(s, 30, [BTN.UP]);
  expect(Math.floor(p.x / TS)).toBe(14);
});
