import { test, expect } from 'bun:test';
import { createMap, stepMap, markCleared, markUsed } from '../src/game/worldmap.js';
import { MAP_W1 } from '../src/content/maps/w1.js';
import { BTN } from '../src/game/consts.js';

const press = (m, b, who = 0) => {
  const inputs = [0, 0]; inputs[who] = b;
  let act = stepMap(m, MAP_W1, inputs);
  for (let i = 0; i < 120 && (m.moving || !act); i++) {
    const a = stepMap(m, MAP_W1, [0, 0]);
    act = act || a;
    if (!m.moving) break;
  }
  return act;
};
const at = (m) => [m.x, m.y];

test('starts on S and walks to level 1, stopping there', () => {
  const m = createMap(MAP_W1);
  expect(at(m)).toEqual([1, 1]);
  press(m, BTN.RIGHT);
  expect(at(m)).toEqual([3, 1]);
  press(m, BTN.RIGHT);
  expect(at(m)).toEqual([3, 1]);          // uncleared level blocks forward travel
  press(m, BTN.LEFT);
  expect(at(m)).toEqual([1, 1]);          // but you can go back
});

test('A on a level enters it; cleared levels cannot be entered again', () => {
  const m = createMap(MAP_W1);
  press(m, BTN.RIGHT);
  const act = press(m, BTN.A);
  expect(act).toEqual({ kind: 'level', level: '1-1', key: '3,1' });
  markCleared(m, MAP_W1, '3,1');
  expect(press(m, BTN.A)).toBe(null);
  press(m, BTN.RIGHT);
  expect(at(m)).toEqual([5, 1]);
});

test('either player can steer', () => {
  const m = createMap(MAP_W1);
  press(m, BTN.RIGHT, 1);
  expect(at(m)).toEqual([3, 1]);
});

test('paths turn corners at nodes and huts are single use', () => {
  const m = createMap(MAP_W1);
  for (const k of ['3,1', '5,1']) markCleared(m, MAP_W1, k);
  press(m, BTN.RIGHT); press(m, BTN.RIGHT); press(m, BTN.RIGHT);
  expect(at(m)).toEqual([7, 1]);          // the hut
  expect(press(m, BTN.A)).toEqual({ kind: 'hut', key: '7,1' });
  markUsed(m, '7,1');
  expect(press(m, BTN.A)).toBe(null);
  press(m, BTN.DOWN);
  expect(at(m)).toEqual([7, 3]);          // level 3, via the vertical path
});

test('the lock blocks until the fortress is cleared', () => {
  const m = createMap(MAP_W1);
  m.x = 3; m.y = 5; m.px = 48; m.py = 80;   // stand on the fortress
  markCleared(m, MAP_W1, '3,5');
  m.opened = {};                             // pretend the lock is still shut
  press(m, BTN.RIGHT);
  expect(at(m)).toEqual([3, 5]);
  markCleared(m, MAP_W1, '3,5');
  press(m, BTN.RIGHT);
  expect(at(m)).toEqual([7, 5]);           // walked through the open lock to level 5
});
