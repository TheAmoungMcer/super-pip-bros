import { test, expect } from 'bun:test';
import { createSession, stepSession, enterNode, makeSave, START_LIVES, LETTER_FRAMES } from '../src/game/session.js';
import { songFor, hudFor } from '../src/draw/present.js';
import { BTN } from '../src/game/consts.js';

const tap = (sess, b, who = 0) => { const i = [0, 0]; i[who] = b; stepSession(sess, i); stepSession(sess, [0, 0]); };
const settle = (sess) => { for (let i = 0; i < 60 && sess.map.moving; i++) stepSession(sess, [0, 0]); };

test('a new game starts on the World 1 map with 4 lives', () => {
  const s = createSession();
  expect(s.scene).toBe('map');
  expect(s.shared.lives).toBe(START_LIVES);
  expect([s.map.x, s.map.y]).toEqual([1, 1]);
});

test('walking to 1-1 and pressing A starts the level', () => {
  const s = createSession();
  tap(s, BTN.RIGHT); settle(s);
  tap(s, BTN.A);
  expect(s.scene).toBe('level');
  expect(s.level.lv.id).toBe('1-1');
});

test('clearing a level returns to the map with the card, the node cleared, and a time bonus', () => {
  const s = createSession();
  tap(s, BTN.RIGHT); settle(s); tap(s, BTN.A);
  const time = s.level.time, score = s.level.shared.score;
  s.level.mode = 'done'; s.level.clear = { by: 0, card: 2 };
  stepSession(s, [0, 0]);
  expect(s.scene).toBe('map');
  expect(s.map.cleared['3,1']).toBe(true);
  expect(s.cards[0]).toEqual([2]);
  expect(s.shared.score).toBe(score + time * 50);
  expect(s.dirty).toBe(true);
});

test('failing costs a life; below zero is game over; continue restores lives', () => {
  const s = createSession();
  tap(s, BTN.RIGHT); settle(s); tap(s, BTN.A);
  s.level.mode = 'fail';
  stepSession(s, [0, 0]);
  expect(s.scene).toBe('map');
  expect(s.shared.lives).toBe(START_LIVES - 1);
  tap(s, BTN.A);
  s.level.shared.lives = 0; s.level.mode = 'fail';
  stepSession(s, [0, 0]);
  expect(s.scene).toBe('gameover');
  tap(s, BTN.A);
  expect(s.scene).toBe('map');
  expect(s.shared.lives).toBe(START_LIVES);
});

test('using an item on the map sets the form for the next level', () => {
  const s = createSession();
  s.items[0] = ['blossom'];
  tap(s, BTN.START);
  expect(s.menus[0]).toEqual({ sel: 0 });
  tap(s, BTN.A);
  expect(s.forms[0]).toBe('fire');
  expect(s.menus[0]).toBe(null);
  tap(s, BTN.RIGHT); settle(s); tap(s, BTN.A);
  expect(s.level.players[0].form).toBe('fire');
});

test('co-op: one player browsing items does not stop the other steering', () => {
  const s = createSession({ players: 2 });
  tap(s, BTN.START, 1);
  expect(s.menus[1]).not.toBe(null);
  tap(s, BTN.RIGHT, 0); settle(s);
  expect([s.map.x, s.map.y]).toEqual([3, 1]);
});

test('gift hut gives the chosen item to whoever opened it, then closes', () => {
  const s = createSession({ players: 2 });
  enterNode(s, { kind: 'hut', key: '7,1' });
  expect(s.scene).toBe('hut');
  tap(s, BTN.A, 1);
  expect(s.items[1].length).toBe(1);
  for (let i = 0; i < 100; i++) stepSession(s, [0, 0]);
  expect(s.scene).toBe('map');
  expect(s.map.used['7,1']).toBe(true);
});

test('beating the airship shows the letter, grants stars, then returns to the map', () => {
  const s = createSession();
  enterNode(s, { kind: 'airship', level: '1-A', key: '11,7' });
  s.level.mode = 'done'; s.level.clear = { by: 0, card: -1 };
  stepSession(s, [0, 0]);
  expect(s.scene).toBe('letter');
  expect(s.items[0]).toContain('star');
  for (let i = 0; i < LETTER_FRAMES + 1; i++) stepSession(s, [0, 0]);
  tap(s, BTN.A);
  expect(s.scene).toBe('map');
});

test('solo pause freezes the level', () => {
  const s = createSession();
  tap(s, BTN.RIGHT); settle(s); tap(s, BTN.A);
  tap(s, BTN.START);
  const f = s.level.frame;
  for (let i = 0; i < 10; i++) stepSession(s, [0, 0]);
  expect(s.level.frame).toBe(f);
  tap(s, BTN.START);
  stepSession(s, [0, 0]);
  expect(s.level.frame).toBeGreaterThan(f);
});

test('saves round-trip through a new session', () => {
  const s = createSession();
  s.map.cleared['3,1'] = true; s.items[0] = ['leaf']; s.shared.lives = 7;
  const t = createSession({ players: 2, save: makeSave(s) });
  expect(t.map.cleared['3,1']).toBe(true);
  expect(t.items).toEqual([['leaf'], []]);
  expect(t.shared.lives).toBe(7);
  expect(t.forms.length).toBe(2);
});

test('music follows the scene', () => {
  const s = createSession();
  expect(songFor(s)).toBe('map1');
  tap(s, BTN.RIGHT); settle(s); tap(s, BTN.A);
  expect(songFor(s)).toBe('overworld');
  s.level.players[0].starTimer = 100;
  expect(songFor(s)).toBe('star');
  expect(hudFor(s, 0).lives).toBe(START_LIVES);
});
