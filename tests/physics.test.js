import { test, expect } from 'bun:test';
import { lvl } from './helpers.js';
import { moveBody } from '../src/game/physics.js';
import { TS, SUB } from '../src/game/consts.js';

const body = (px, py, w = 12, h = 15) => ({ x: px * SUB, y: py * SUB, w, h, vx: 0, vy: 0, onGround: false });
const run = (b, lv, n, fn = () => {}) => { let r; for (let i = 0; i < n; i++) { fn(b); r = moveBody(b, lv); } return r; };
const gravity = (b) => { b.vy = Math.min(b.vy + 5, 64); };

test('falls and lands on ground', () => {
  const lv = lvl(String.raw`
....
....
####`);
  const b = body(2, 0);
  run(b, lv, 60, gravity);
  expect(b.onGround).toBe(true);
  expect(b.y + b.h * SUB).toBe(2 * TS);
});

test('walls stop horizontal motion', () => {
  const lv = lvl(String.raw`
...#
...#
####`);
  const b = body(4, 17); b.onGround = true;
  run(b, lv, 60, (b) => { b.vx = 24; gravity(b); });
  expect(b.x + b.w * SUB).toBe(3 * TS);
});

test('ceiling stops a jump and reports the block', () => {
  const lv = lvl(String.raw`
.?..
....
....
####`);
  const b = body(18, 17); b.vy = -64;
  const r = moveBody(b, lv);
  expect(r.ceiling).toEqual({ tx: 1, ty: 0 });
  expect(b.y).toBe(TS);
  expect(b.vy).toBe(0);
});

test('semi-solid: pass through from below, land from above', () => {
  const lv = lvl(String.raw`
....
====
....
....
####`);
  const b = body(18, 60); b.vy = -48;
  run(b, lv, 10);                                       // 30 px up: now inside the platform row
  expect(b.y).toBe((60 - 30) * SUB);
  expect(b.vy).toBe(-48);                               // never hit a ceiling
  const c = body(18, 0);
  run(c, lv, 60, gravity);
  expect(c.onGround).toBe(true);
  expect(c.y + c.h * SUB).toBe(TS);
});

test('hidden block is solid only from below', () => {
  const lv = lvl(String.raw`
.H..
....
####`);
  const b = body(18, 18); b.vy = -48;
  const r = moveBody(b, lv);
  expect(r.ceiling).toEqual({ tx: 1, ty: 0 });
  const c = body(18, -20);
  run(c, lv, 30, gravity);
  expect(c.y + c.h * SUB).toBe(2 * TS);
});

test('walks up and down a 45 degree hill without leaving the ground', () => {
  const hill = lvl(String.raw`
........
.../\...
../##\..
########`);
  const b = body(2, 3 * 16 - 15); b.onGround = true;
  let airborne = 0;
  run(b, hill, 120, (b) => { b.vx = 16; gravity(b); if (!b.onGround) airborne++; });
  expect(airborne).toBe(0);
  expect(b.x).toBeGreaterThan(6 * TS);
});

test('gentle slope surface is sampled at the body centre', () => {
  const lv = lvl(String.raw`
......
..12##
######`);
  const b = body(2 * 16 + 2, 0);
  run(b, lv, 60, gravity);
  expect(b.y + b.h * SUB).toBe((16 + 11) * SUB);
});
