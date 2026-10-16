import { test, expect } from 'bun:test';
import { keyMask, gamepadMask, edges, createInput } from '../src/engine/input.js';
import { BTN } from '../src/game/consts.js';

test('keyboard map', () => {
  expect(keyMask('ArrowLeft')).toBe(BTN.LEFT);
  expect(keyMask('KeyZ')).toBe(BTN.A);
  expect(keyMask('Space')).toBe(BTN.A);
  expect(keyMask('KeyX')).toBe(BTN.B);
  expect(keyMask('Enter')).toBe(BTN.START);
  expect(keyMask('KeyQ')).toBe(0);
});

test('gamepad standard mapping with stick deadzone', () => {
  const b = (i) => Array.from({ length: 17 }, (_, k) => ({ pressed: k === i }));
  expect(gamepadMask({ buttons: b(0), axes: [0, 0] })).toBe(BTN.A);
  expect(gamepadMask({ buttons: b(2), axes: [0, 0] })).toBe(BTN.B);
  expect(gamepadMask({ buttons: b(9), axes: [0, 0] })).toBe(BTN.START);
  expect(gamepadMask({ buttons: b(-1), axes: [-0.9, 0.2] })).toBe(BTN.LEFT);
  expect(gamepadMask({ buttons: b(-1), axes: [0.3, 0.8] })).toBe(BTN.DOWN);
});

test('edges reports presses and releases', () => {
  const e = edges(BTN.A | BTN.LEFT, BTN.A | BTN.B);
  expect(e.pressed).toBe(BTN.B);
  expect(e.released).toBe(BTN.LEFT);
});

test('held keys are cleared when the window loses focus', () => {
  const handlers = {};
  const target = { addEventListener: (t, f) => { handlers[t] = f; } };
  const input = createInput(target, () => []);
  handlers.keydown({ code: 'ArrowRight', preventDefault() {} });
  handlers.keydown({ code: 'KeyX', preventDefault() {} });
  expect(input.read()).toBe(BTN.RIGHT | BTN.B);
  handlers.blur();
  expect(input.read()).toBe(0);
});
