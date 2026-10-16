import { test, expect } from 'bun:test';
import { simOf, find, dropOn, steps } from './helpers.js';
import { SUB, TS, BTN } from '../src/game/consts.js';
import { tileAt } from '../src/game/level.js';
import { T } from '../src/game/tiles.js';
import { TYPES } from '../src/game/entities/index.js';

const row = (mid) => String.raw`
....................
....................
....................
....................
....................
${mid}
####################`;

const stompUntil = (s, e, cond) => { dropOn(s.players[0], e); for (let i = 0; i < 12 && !cond(); i++) steps(s, 1); };
// After a stomp the player bounces and would land on the shell again; move them clear first.
const stepClear = (s, e, n) => { s.players[0].x = e.x - 48 * SUB; steps(s, n); };

test('stomp turns a walker into a shell; touching the shell kicks it', () => {
  const s = simOf(row('..........g.........'));
  const e = find(s, 'shellback_green');
  stompUntil(s, e, () => e.state === 'shell');
  expect(e.state).toBe('shell');
  expect(e.h).toBe(14);
  const p = s.players[0];
  stepClear(s, e, 20);                           // land away from the shell
  p.x = e.x - 10 * SUB; p.y = e.y + e.h * SUB - p.h * SUB;
  steps(s, 2);
  expect(e.state).toBe('slide');
  expect(Math.abs(e.vx)).toBe(48);
  expect(e.dir).toBe(1);
  expect(p.dead).toBe(false);
});

test('a sliding shell kills enemies in its path and bounces off walls', () => {
  const s = simOf(row('#.......g.......c..#'));
  const sh = find(s, 'shellback_green'), c = find(s, 'chompkin');
  stompUntil(s, sh, () => sh.state === 'shell');
  sh.state = 'slide'; sh.dir = 1; sh.harmful = true; sh.kickGrace = 0;
  s.players[0].x = 2 * TS; s.players[0].y = 5 * TS;  // keep the player out of the way
  for (let i = 0; i < 60 && c.state !== 'flipped'; i++) steps(s, 1);
  expect(c.state).toBe('flipped');
  for (let i = 0; i < 60 && sh.dir !== -1; i++) steps(s, 1);
  expect(sh.dir).toBe(-1);
});

test('a sliding shell bumps the block it hits', () => {
  const s = simOf(row('........g......?....'));
  const sh = find(s, 'shellback_green');
  stompUntil(s, sh, () => sh.state === 'shell');
  sh.state = 'slide'; sh.dir = 1; sh.harmful = true; sh.kickGrace = 0;
  s.players[0].x = 1 * TS;
  steps(s, 60);
  expect(tileAt(s.lv, 15, 5)).toBe(T.USED);
  expect(s.shared.coins).toBe(1);
});

test('holding B picks up a shell; releasing B kicks it forward', () => {
  const s = simOf(row('..........g.........'));
  const e = find(s, 'shellback_green'), p = s.players[0];
  stompUntil(s, e, () => e.state === 'shell');
  stepClear(s, e, 20);
  p.x = e.x - 10 * SUB; p.y = e.y + e.h * SUB - p.h * SUB; p.dir = 1;
  steps(s, 2, [BTN.B]);
  expect(e.state).toBe('carried');
  expect(p.carry).toBe(e.id);
  steps(s, 10, [BTN.B | BTN.LEFT]);
  steps(s, 2, [0]);
  expect(e.state).toBe('slide');
  expect(e.dir).toBe(-1);
  expect(p.carry).toBe(-1);
});

test('stomping a sliding shell stops it', () => {
  const s = simOf(row('..........g.........'));
  const e = find(s, 'shellback_green');
  stompUntil(s, e, () => e.state === 'shell');
  e.state = 'slide'; e.dir = 1; e.harmful = true; e.kickGrace = 0;
  const p = s.players[0];                        // a sliding shell outruns a slow drop, so start just above it
  p.x = e.x; p.y = e.y - p.h * SUB - 2 * SUB; p.vy = 32; p.onGround = false;
  for (let i = 0; i < 4 && e.state !== 'shell'; i++) steps(s, 1);
  expect(e.state).toBe('shell');
  expect(e.vx).toBe(0);
});

test('shells wake up and walk again', () => {
  const s = simOf(row('..........g.........'));
  const e = find(s, 'shellback_green');
  stompUntil(s, e, () => e.state === 'shell');
  s.players[0].x = 1 * TS;
  steps(s, 500);
  expect(e.state).toBe('walk');
  expect(e.harmful).toBe(true);
});

test('red shellbacks turn at ledges', () => {
  const s = simOf(String.raw`
....................
....................
....................
.......r............
......#####.........
....................
####################`);
  const e = find(s, 'shellback_red');
  s.players[0].x = 18 * TS;
  steps(s, 400);
  expect(e.y + e.h * SUB).toBe(4 * TS);         // still on the platform
});

test('winged shellbacks lose their wings when stomped', () => {
  const s = simOf(row('..........f.........'));
  const e = find(s, 'shellback_winged');
  stompUntil(s, e, () => e.state === 'walk');
  expect(e.state).toBe('walk');
});

test('spikebugs hurt on a stomp', () => {
  const s = simOf(row('..........y.........'));
  const e = find(s, 'spikebug');
  dropOn(s.players[0], e);
  steps(s, 6);
  expect(s.players[0].dead).toBe(true);
});

test('bumble beetles ignore fire but shell like shellbacks', () => {
  const s = simOf(row('..........b.........'));
  const e = find(s, 'bumblebeetle');
  TYPES.bumblebeetle.hit(e, s, 'fire', null);
  expect(e.state).toBe('walk');
  stompUntil(s, e, () => e.state === 'shell');
  expect(e.state).toBe('shell');
});
