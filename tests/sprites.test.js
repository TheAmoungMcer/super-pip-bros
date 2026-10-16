import { test, expect } from 'bun:test';
import { parseGrid, bakeRGBA } from '../src/engine/sprites.js';
import { PALETTE, hexToRgb } from '../src/engine/palette.js';

test('parseGrid maps . to 0 and digits to slots', () => {
  const s = parseGrid(['.1', '23']);
  expect(s.w).toBe(2); expect(s.h).toBe(2);
  expect([...s.px]).toEqual([0, 1, 2, 3]);
});

test('parseGrid rejects ragged rows and bad chars', () => {
  expect(() => parseGrid(['..', '.'], 'x')).toThrow('sprite x');
  expect(() => parseGrid(['.4'], 'y')).toThrow('sprite y');
});

test('bakeRGBA colours pixels and supports flipX', () => {
  const s = parseGrid(['1.']);
  const red = PALETTE.indexOf('#F83800');
  const out = bakeRGBA(s, [red, 0, 0]);
  expect([...out.slice(0, 4)]).toEqual([...hexToRgb('#F83800'), 255]);
  expect(out[7]).toBe(0);
  const flipped = bakeRGBA(s, [red, 0, 0], true);
  expect(flipped[3]).toBe(0);
  expect(flipped[7]).toBe(255);
});

test('palette has 64 colours', () => {
  expect(PALETTE.length).toBe(64);
});
