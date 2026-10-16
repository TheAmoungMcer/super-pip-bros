import { test, expect } from 'bun:test';
import { makeCode, normalizeCode, CODE_CHARS, peerId } from '../src/net/peer.js';
import { createTitle, stepTitle, typeCode, TITLE_OPTIONS } from '../src/ui/title.js';
import { BTN } from '../src/game/consts.js';

test('room codes are 4 unambiguous letters', () => {
  let i = 0; const seq = [0, 0.5, 0.99, 0.3];
  const c = makeCode(() => seq[i++ % 4]);
  expect(c).toMatch(/^[A-HJ-NP-Z]{4}$/);
  expect(CODE_CHARS.includes('I') || CODE_CHARS.includes('O')).toBe(false);
  expect(normalizeCode(' ab-c d9z ')).toBe('ABCD');
  expect(peerId('ABCD')).toBe('superpip-ABCD');
});

const saves = [{ slot: 0, ok: false, reason: 'empty' }, { slot: 1, ok: false, reason: 'empty' }, { slot: 2, ok: false, reason: 'empty' }];
const press = (tt, b) => { const r = stepTitle(tt, b); stepTitle(tt, 0); return r; };
const skipIntro = (tt) => { for (let i = 0; i < 100; i++) stepTitle(tt, 0); };

test('title offers solo, host and join', () => {
  expect(TITLE_OPTIONS).toEqual(['1 PLAYER GAME', 'HOST CO-OP', 'JOIN CO-OP']);
});

test('host goes through slot select and starts as host', () => {
  const tt = createTitle(saves); skipIntro(tt);
  press(tt, BTN.DOWN);
  press(tt, BTN.A);
  expect(tt.mode).toBe('slots');
  expect(press(tt, BTN.A)).toEqual({ action: 'start', slot: 0, next: 'host' });
});

test('join takes a typed code', () => {
  const tt = createTitle(saves); skipIntro(tt);
  press(tt, BTN.DOWN); press(tt, BTN.DOWN);
  press(tt, BTN.A);
  expect(tt.mode).toBe('code');
  for (const k of ['w', 'x', 'q', 'Backspace', 'k', 'z']) typeCode(tt, k);
  expect(tt.code).toBe('WXKZ');
  expect(press(tt, BTN.A)).toEqual({ action: 'join', code: 'WXKZ' });
});

test('join code can be entered with a gamepad', () => {
  const tt = createTitle(saves); skipIntro(tt);
  press(tt, BTN.DOWN); press(tt, BTN.DOWN); press(tt, BTN.A);
  press(tt, BTN.UP);                       // A -> B
  press(tt, BTN.RIGHT); press(tt, BTN.DOWN); // second letter A -> Z (wraps)
  expect(tt.code.slice(0, 2)).toBe('BZ');
});
