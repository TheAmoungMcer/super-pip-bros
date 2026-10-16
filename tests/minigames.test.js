import { test, expect } from 'bun:test';
import { createHut, stepHut, createSlots, stepSlots } from '../src/game/minigames.js';
import { BTN } from '../src/game/consts.js';

test('gift hut: move, open a chest, get its item once, then finish', () => {
  const h = createHut({ seed: 5 });
  expect([...h.chests].sort()).toEqual(['berry', 'blossom', 'leaf']);
  stepHut(h, [BTN.RIGHT, 0]); stepHut(h, [0, 0]);
  expect(h.cursor).toBe(2);
  const r = stepHut(h, [0, BTN.A]);
  expect(r).toEqual({ give: h.chests[2], to: 1 });
  expect(stepHut(h, [0, BTN.A])).toBe(null);
  for (let i = 0; i < 95; i++) stepHut(h, [0, 0]);
  expect(h.done).toBe(true);
});

test('slot panel: three presses stop the reels and pay out matches', () => {
  const sl = createSlots(1);
  sl.reels = [0, 0, 0]; sl.speeds = [0, 0, 0];   // freeze on Berry for a deterministic match
  let out = null;
  for (let i = 0; i < 3; i++) { out = stepSlots(sl, [BTN.A, 0]) || out; stepSlots(sl, [0, 0]); }
  expect(out).toEqual({ lives: 2 });
  const miss = createSlots(1);
  miss.reels = [0, 32, 64]; miss.speeds = [0, 0, 0];
  let o2 = null;
  for (let i = 0; i < 3; i++) { o2 = stepSlots(miss, [BTN.A, 0]) || o2; stepSlots(miss, [0, 0]); }
  expect(o2).toEqual({ lives: 0 });
  for (let i = 0; i < 125; i++) stepSlots(miss, [0, 0]);
  expect(miss.done).toBe(true);
});
