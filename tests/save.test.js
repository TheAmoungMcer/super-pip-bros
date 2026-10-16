import { test, expect } from 'bun:test';
import { writeSave, readSave, eraseSave, listSaves, exportSave, importSave, SAVE_VERSION } from '../src/game/save.js';

const fakeStorage = () => {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), _m: m };
};
const data = { v: SAVE_VERSION, world: 1, map: { x: 3, y: 1, cleared: { '3,1': true }, opened: {}, used: {} }, shared: { lives: 6, coins: 12, score: 4200 }, forms: ['big'], items: [['leaf']], cards: [[2]] };

test('write, read, list and erase', () => {
  const st = fakeStorage();
  expect(writeSave(st, 1, data)).toBe(true);
  expect(readSave(st, 1)).toEqual({ ok: true, data });
  const list = listSaves(st);
  expect(list[0]).toMatchObject({ slot: 0, ok: false, reason: 'empty' });
  expect(list[1]).toMatchObject({ slot: 1, ok: true, summary: { world: 1, lives: 6, cleared: 1 } });
  expect(eraseSave(st, 1)).toBe(true);
  expect(readSave(st, 1).reason).toBe('empty');
});

test('corrupt and wrong-version saves are reported, not thrown', () => {
  const st = fakeStorage();
  st.setItem('superpip.save.0', '{not json');
  st.setItem('superpip.save.2', JSON.stringify({ ...data, v: 99 }));
  expect(readSave(st, 0)).toEqual({ ok: false, reason: 'corrupt', raw: '{not json' });
  expect(readSave(st, 2).reason).toBe('version');
  expect(() => listSaves(st)).not.toThrow();
});

test('missing or throwing storage never throws', () => {
  expect(listSaves(null).every(s => s.reason === 'unavailable')).toBe(true);
  expect(writeSave(null, 0, data)).toBe(false);
  const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('x'); } };
  expect(readSave(throwing, 0).reason).toBe('unavailable');
  expect(writeSave(throwing, 0, data)).toBe(false);
  expect(eraseSave(throwing, 0)).toBe(false);
});

test('export and import round-trip; garbage import fails cleanly', () => {
  expect(importSave(exportSave(data))).toEqual({ ok: true, data });
  expect(importSave('%%%').ok).toBe(false);
});
