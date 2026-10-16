import { test, expect } from 'bun:test';
import { lvl } from './helpers.js';
import { tileAt, setTile } from '../src/game/level.js';
import { T, INFO, slopeTop } from '../src/game/tiles.js';

test('parses tiles, pads rows, extracts spawns', () => {
  const lv = lvl(String.raw`
..c.
?B
####`);
  expect(lv.w).toBe(4); expect(lv.h).toBe(3);
  expect(tileAt(lv, 0, 1)).toBe(T.Q_COIN);
  expect(tileAt(lv, 1, 1)).toBe(T.BRICK);
  expect(tileAt(lv, 3, 1)).toBe(T.EMPTY);
  expect(tileAt(lv, 2, 0)).toBe(T.EMPTY);
  expect(lv.spawns).toEqual([{ i: 0, type: 'chompkin', tx: 2, ty: 0 }]);
});

test('edges are walls, top and bottom are open', () => {
  const lv = lvl('##');
  expect(tileAt(lv, -1, 0)).toBe(T.HARD);
  expect(tileAt(lv, 2, 0)).toBe(T.HARD);
  expect(tileAt(lv, 0, -1)).toBe(T.EMPTY);
  expect(tileAt(lv, 0, 5)).toBe(T.EMPTY);
});

test('unknown characters are rejected with position', () => {
  expect(() => lvl('#&#')).toThrow("level t: unknown char '&' at 1,0");
});

test('setTile logs changes for the network', () => {
  const lv = lvl('B.');
  setTile(lv, 0, 0, T.EMPTY);
  expect(tileAt(lv, 0, 0)).toBe(T.EMPTY);
  expect(lv.tileLog).toEqual([{ tx: 0, ty: 0, id: T.EMPTY }]);
});

test('slope surfaces', () => {
  expect(slopeTop(T.SLOPE45_UP, 0)).toBe(15);
  expect(slopeTop(T.SLOPE45_UP, 15)).toBe(0);
  expect(slopeTop(T.SLOPE45_DN, 0)).toBe(0);
  expect(slopeTop(T.GENTLE_UP_LO, 0)).toBe(15);
  expect(slopeTop(T.GENTLE_UP_HI, 15)).toBe(0);
  expect(INFO[T.SEMI].semi).toBe(true);
  expect(INFO[T.SEMI].solid).toBe(false);
});
