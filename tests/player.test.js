import { test, expect } from 'bun:test';
import { lvl } from './helpers.js';
import { createPlayer, updatePlayer, PHYS } from '../src/game/player.js';
import { BTN, TS, SUB } from '../src/game/consts.js';

const flat = () => lvl(String.raw`
${'.'.repeat(200)}
${'.'.repeat(200)}
${'.'.repeat(200)}
${'.'.repeat(200)}
${'.'.repeat(200)}
${'.'.repeat(200)}
${'.'.repeat(200)}
${'#'.repeat(200)}`);
const out = () => ({ events: [], bumps: [] });
const steps = (p, lv, n, buttons) => { for (let i = 0; i < n; i++) updatePlayer(p, typeof buttons === 'function' ? buttons(i) : buttons, lv, out()); };

test('idle player stays grounded', () => {
  const lv = flat(); const p = createPlayer(0, 2, 6);
  steps(p, lv, 60, 0);
  expect(p.onGround).toBe(true);
  expect(p.y + p.h * SUB).toBe(7 * TS);
});

test('walk caps at WALK_MAX, run at RUN_MAX, full P-meter reaches P_MAX', () => {
  const lv = flat(); const p = createPlayer(0, 2, 6);
  steps(p, lv, 60, BTN.RIGHT);
  expect(p.vx).toBe(PHYS.WALK_MAX);
  steps(p, lv, 30, BTN.RIGHT | BTN.B);
  expect(p.vx).toBe(PHYS.RUN_MAX);
  steps(p, lv, 70, BTN.RIGHT | BTN.B);
  expect(p.pmeter).toBe(7);
  expect(p.vx).toBe(PHYS.P_MAX);
});

test('P-meter drains after you stop running', () => {
  const lv = flat(); const p = createPlayer(0, 2, 6);
  steps(p, lv, 140, BTN.RIGHT | BTN.B);
  steps(p, lv, 7 * PHYS.P_DRAIN + 5, 0);
  expect(p.pmeter).toBe(0);
});

test('held jump from standstill rises 4-5 tiles; a tap only ~1 tile', () => {
  const lv = flat();
  const p = createPlayer(0, 2, 6); steps(p, lv, 1, 0); const ground = p.y;
  let top = p.y;
  steps(p, lv, 80, (i) => { top = Math.min(top, p.y); return BTN.A; });
  const held = (ground - top) / SUB;
  expect(held).toBeGreaterThan(64); expect(held).toBeLessThan(80);

  const q = createPlayer(0, 2, 6); steps(q, lv, 1, 0); top = q.y;
  steps(q, lv, 80, (i) => { top = Math.min(top, q.y); return i === 0 ? BTN.A : 0; });
  const tap = (ground - top) / SUB;
  expect(tap).toBeGreaterThan(14); expect(tap).toBeLessThan(26);
});

test('running jumps go higher', () => {
  const lv = flat();
  const p = createPlayer(0, 2, 6);
  steps(p, lv, 140, BTN.RIGHT | BTN.B);
  const ground = p.y; let top = p.y;
  steps(p, lv, 80, () => { top = Math.min(top, p.y); return BTN.RIGHT | BTN.B | BTN.A; });
  expect((ground - top) / SUB).toBeGreaterThan(90);
});

test('reversing on the ground skids', () => {
  const lv = flat(); const p = createPlayer(0, 2, 6);
  steps(p, lv, 60, BTN.RIGHT | BTN.B);
  const v = p.vx;
  updatePlayer(p, BTN.LEFT, lv, out());
  expect(p.vx).toBe(v - PHYS.SKID);
  expect(p.anim).toBe('skid');
});

test('releasing the stick applies friction to a stop', () => {
  const lv = flat(); const p = createPlayer(0, 2, 6);
  steps(p, lv, 30, BTN.RIGHT);
  steps(p, lv, 40, 0);
  expect(p.vx).toBe(0);
  expect(p.anim).toBe('stand');
});

test('big player crouches: shorter hitbox and no acceleration', () => {
  const lv = flat(); const p = createPlayer(0, 2, 6, 'big');
  expect(p.h).toBe(26);
  steps(p, lv, 10, BTN.DOWN | BTN.RIGHT);
  expect(p.crouch).toBe(true);
  expect(p.h).toBe(15);
  expect(p.vx).toBe(0);
  steps(p, lv, 2, 0);
  expect(p.h).toBe(26);
  expect(p.y + p.h * SUB).toBe(7 * TS);
});

test('small player cannot crouch', () => {
  const lv = flat(); const p = createPlayer(0, 2, 6);
  steps(p, lv, 5, BTN.DOWN);
  expect(p.crouch).toBe(false);
});

test('jumping into a block reports a bump', () => {
  const lv = lvl(String.raw`
.....
..?..
.....
.....
#####`);
  const p = createPlayer(0, 2, 3);
  steps(p, lv, 1, 0);                    // land first: a jump needs a fresh press while grounded
  const o = out();
  for (let i = 0; i < 30 && !o.bumps.length; i++) updatePlayer(p, BTN.A, lv, o);
  expect(o.bumps).toEqual([{ tx: 2, ty: 1, by: 0, big: false }]);
});

test('pressing down on a slope slides downhill', () => {
  const lv = lvl(String.raw`
.......
.......
...../#
..../##
#######`);
  const p = createPlayer(0, 5, 1);
  steps(p, lv, 30, 0);
  steps(p, lv, 20, BTN.DOWN);
  expect(p.sliding).toBe(true);
  expect(p.vx).toBeLessThan(0);
});
