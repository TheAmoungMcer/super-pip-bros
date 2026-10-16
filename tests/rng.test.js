import { test, expect } from 'bun:test';
import { rand, randInt } from '../src/game/rng.js';

test('rand is deterministic per seed and in [0,1)', () => {
  const a = { seed: 42 }, b = { seed: 42 };
  const xs = Array.from({ length: 100 }, () => rand(a));
  const ys = Array.from({ length: 100 }, () => rand(b));
  expect(xs).toEqual(ys);
  expect(xs.every(x => x >= 0 && x < 1)).toBe(true);
});

test('randInt covers the whole range', () => {
  const r = { seed: 7 }; const seen = new Set();
  for (let i = 0; i < 500; i++) seen.add(randInt(r, 6));
  expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5]);
});
