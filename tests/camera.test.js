import { test, expect } from 'bun:test';
import { lvl } from './helpers.js';
import { createCamera, updateCamera } from '../src/game/camera.js';
import { SUB } from '../src/game/consts.js';

const wide = () => lvl(Array.from({ length: 14 }, (_, y) => (y === 13 ? '#' : '.').repeat(100)).join('\n'));

test('camera starts clamped to the level and follows past the dead zone', () => {
  const lv = wide();
  const p = { x: 40 * SUB, y: 180 * SUB, w: 12, h: 15, onGround: true, flyTimer: 0, dead: false };
  const c = createCamera(p, lv);
  expect(c.x).toBe(0);
  expect(c.y).toBe(14 * 16 - 200);
  p.x = 400 * SUB; updateCamera(c, p, lv);
  expect(c.x).toBe(400 + 6 - 144);
  p.x = 300 * SUB; updateCamera(c, p, lv);
  expect(c.x).toBe(300 + 6 - 112);
});

test('camera clamps at the right edge', () => {
  const lv = wide();
  const p = { x: 1595 * SUB, y: 180 * SUB, w: 12, h: 15, onGround: true, flyTimer: 0, dead: false };
  const c = createCamera(p, lv);
  expect(c.x).toBe(1600 - 256);
});
