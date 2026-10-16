import { test, expect } from 'bun:test';
import { simOf, find, dropOn, steps } from './helpers.js';
import { SUB, TS, BTN } from '../src/game/consts.js';

const field = String.raw`
................
................
................
................
................
..........c.....
################`;

test('spawns in view and walks toward the player at 0.5 px/frame', () => {
  const s = simOf(field);
  const e = find(s, 'chompkin');
  expect(e.dir).toBe(-1);
  const x = e.x; steps(s, 30);
  expect(x - e.x).toBe(30 * 8);
});

test('stomp squishes, bounces the player, scores 100, never respawns', () => {
  const s = simOf(field);
  const e = find(s, 'chompkin'), p = s.players[0];
  dropOn(p, e);
  for (let i = 0; i < 10 && e.state !== 'squished'; i++) steps(s, 1);
  expect(e.state).toBe('squished');
  expect(p.vy).toBeLessThan(0);
  expect(s.shared.score).toBe(100);
  steps(s, 40);
  expect(find(s, 'chompkin')).toBeUndefined();
  expect(s.spawned[0]).toBe(2);
});

test('side contact kills small, shrinks big', () => {
  const s = simOf(field);
  const e = find(s, 'chompkin');
  s.players[0].x = e.x - 10 * SUB; s.players[0].y = e.y + e.h * SUB - s.players[0].h * SUB;
  steps(s, 2);
  expect(s.players[0].dead).toBe(true);

  const b = simOf(field, { forms: ['big'] });
  const eb = find(b, 'chompkin'), p = b.players[0];
  p.x = eb.x - 10 * SUB;
  steps(b, 2);
  expect(p.dead).toBe(false);
  expect(p.form).toBe('small');
  expect(p.hurtTimer).toBeGreaterThan(0);
});

test('bumping the block under it flips it', () => {
  const s = simOf(String.raw`
................
................
.........c......
........BBB.....
................
................
################`, {}, [9, 5]);
  const e = find(s, 'chompkin');
  for (let i = 0; i < 30 && e.state !== 'flipped'; i++) steps(s, 1, [BTN.A]);
  expect(e.state).toBe('flipped');
});

test('parachompkin loses its wings when stomped', () => {
  const s = simOf(field.replace('c', 'p'));
  const e = find(s, 'parachompkin');
  steps(s, 5);
  dropOn(s.players[0], e);
  for (let i = 0; i < 10 && e.type !== 'chompkin'; i++) steps(s, 1);
  expect(e.type).toBe('chompkin');
});

test('star power flips enemies on contact', () => {
  const s = simOf(field);
  const e = find(s, 'chompkin'), p = s.players[0];
  p.starTimer = 300; p.x = e.x - 10 * SUB;
  steps(s, 2);
  expect(e.state).toBe('flipped');
  expect(p.dead).toBe(false);
});

test('chained stomps climb the combo ladder', () => {
  const s = simOf(field.replace('..........c.....', '........c...c...'));
  const [a, b] = s.entities.filter(e => e.type === 'chompkin');
  const p = s.players[0];
  dropOn(p, a);
  for (let i = 0; i < 10 && a.state !== 'squished'; i++) steps(s, 1);
  dropOn(p, b);
  for (let i = 0; i < 10 && b.state !== 'squished'; i++) steps(s, 1);
  expect(s.shared.score).toBe(100 + 200);
});

test('walked-off enemies respawn when scrolled back; killed ones do not', () => {
  const wide = field.split('\n').map(r => r + (r.includes('#') ? '#' : '.').repeat(50)).join('\n');
  const s = simOf(wide);
  const p = s.players[0];
  p.x = 60 * TS; steps(s, 2);
  expect(find(s, 'chompkin')).toBeUndefined();
  expect(s.spawned[0]).toBe(0);
  p.x = 2 * TS; steps(s, 2);
  expect(find(s, 'chompkin')).toBeDefined();
});
