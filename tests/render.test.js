import { test, expect } from 'bun:test';
import { fitScale } from '../src/engine/render.js';

test('fitScale picks the largest integer scale that fits', () => {
  expect(fitScale(256, 240)).toBe(1);
  expect(fitScale(1920, 1080)).toBe(4);   // 1080/240 = 4.5
  expect(fitScale(800, 1200)).toBe(3);    // 800/256 = 3.1
});

test('fitScale never returns less than 1', () => {
  expect(fitScale(100, 100)).toBe(1);
  expect(fitScale(0, 0)).toBe(1);
});
