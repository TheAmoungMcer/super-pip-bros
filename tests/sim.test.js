import { test, expect } from 'bun:test';
import { createLevelSim, stepLevel, levelResult, DEATH_FRAMES, RESPAWN_FRAMES, CLEAR_FRAMES, TIME_TICK } from '../src/game/sim.js';
import { tileAt } from '../src/game/level.js';
import { T } from '../src/game/tiles.js';
import { BTN, TS, SUB } from '../src/game/consts.js';

const def = (map, extra = {}) => ({ id: 't', theme: 'overworld', time: 300, start: [2, 5], map, ...extra });
const room = String.raw`
..........
..?B.C....
..........
..........
..........
..........
##########`;
const run = (s, n, inputs = []) => { for (let i = 0; i < n; i++) stepLevel(s, typeof inputs === 'function' ? inputs(i) : inputs); };

test('bumping a ? block gives a coin and uses the block', () => {
  const s = createLevelSim(def(room));
  run(s, 40, [BTN.A]);
  expect(tileAt(s.lv, 2, 1)).toBe(T.USED);
  expect(s.shared.coins).toBe(1);
  expect(s.shared.score).toBe(50);
});

test('small players bounce bricks, big players break them', () => {
  const small = createLevelSim(def(room, { start: [3, 5] }));
  run(small, 40, [BTN.A]);
  expect(tileAt(small.lv, 3, 1)).toBe(T.BRICK);
  const big = createLevelSim(def(room, { start: [3, 5] }), { forms: ['big'] });
  run(big, 40, [BTN.A]);
  expect(tileAt(big.lv, 3, 1)).toBe(T.EMPTY);
});

test('free coins are collected on touch and 100 coins give a life', () => {
  const s = createLevelSim(def(room, { start: [5, 1] }), { shared: { coins: 99, lives: 3, score: 0 } });
  run(s, 2);
  expect(tileAt(s.lv, 5, 1)).toBe(T.EMPTY);
  expect(s.shared.coins).toBe(0);
  expect(s.shared.lives).toBe(4);
});

const pit = String.raw`
..........
..........
..........
..........
..........
..........
###....###`;

test('solo: falling in a pit fails the level once', () => {
  const s = createLevelSim(def(pit, { start: [4, 5] }));
  run(s, 400);
  expect(s.mode).toBe('fail');
  expect(levelResult(s).cleared).toBe(false);
});

test('co-op: a dead player respawns next to the living partner', () => {
  const s = createLevelSim(def(pit, { start: [4, 5] }), { players: 2 });
  s.players[1].x = 1 * TS; // partner stands on solid ground at tile 1
  run(s, 60);
  expect(s.players[0].dead).toBe(true);
  expect(s.players[1].dead).toBe(false);
  run(s, RESPAWN_FRAMES);
  expect(s.players[0].dead).toBe(false);
  expect(s.players[0].form).toBe('small');
  expect(s.players[0].hurtTimer).toBeGreaterThan(0);
  expect(s.mode).toBe('play');
});

test('co-op: both dying on the same frame fails exactly once', () => {
  const s = createLevelSim(def(pit, { start: [4, 5] }), { players: 2 });
  run(s, 60);
  expect(s.players.every(p => p.dead)).toBe(true);
  run(s, DEATH_FRAMES + 10);
  expect(s.mode).toBe('fail');
  run(s, 100);
  expect(s.mode).toBe('fail');
});

test('co-op: if the partner reaches the goal, a later death does not fail the level', () => {
  const map = String.raw`
..........
..........
..........
..........
.......G..
.......G..
###....###`;
  const s = createLevelSim(def(map, { start: [4, 5] }), { players: 2 });
  s.players[1].x = 7 * TS;  // partner starts inside the goal column
  run(s, 2);
  expect(s.mode).toBe('clear');
  run(s, CLEAR_FRAMES + 5);
  expect(s.mode).toBe('done');
  expect(levelResult(s).cleared).toBe(true);
  expect(levelResult(s).forms).toEqual(['small', 'small']);
});

test('timer runs out and kills the player', () => {
  const s = createLevelSim(def(room, { time: 2 }));
  run(s, 2 * TIME_TICK + 1);
  expect(s.players[0].dead).toBe(true);
});
