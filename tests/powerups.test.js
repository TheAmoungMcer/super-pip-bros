import { test, expect } from 'bun:test';
import { simOf, find, steps } from './helpers.js';
import { BTN, SUB, TS } from '../src/game/consts.js';
import { tileAt } from '../src/game/level.js';
import { T } from '../src/game/tiles.js';
import { hurtPlayer, STAR_FRAMES } from '../src/game/powerups.js';
import { PHYS } from '../src/game/player.js';

const box = (block) => String.raw`
......................
......................
..${block}...................
......................
......................
......................
######################`;

const bumpAbove = (s) => { for (let i = 0; i < 40; i++) steps(s, 1, [i < 20 ? BTN.A : 0]); };

test('small player gets a Berry from a power block and grows', () => {
  const s = simOf(box('M'));
  bumpAbove(s);
  const b = find(s, 'berry');
  expect(b).toBeDefined();
  expect(tileAt(s.lv, 2, 2)).toBe(T.USED);
  const p = s.players[0];
  p.x = b.x; p.y = b.y + b.h * SUB - p.h * SUB;
  steps(s, 2);
  expect(p.form).toBe('big');
  expect(p.growTimer).toBeGreaterThan(0);
  expect(find(s, 'berry')).toBeUndefined();
});

test('big player gets a Blossom and becomes fire; fireballs cap at 2', () => {
  const s = simOf(box('M'), { forms: ['big'] });
  bumpAbove(s);
  const f = find(s, 'blossom');
  expect(f).toBeDefined();
  const p = s.players[0];
  p.x = f.x; p.y = f.y + f.h * SUB - p.h * SUB;
  steps(s, 40);
  expect(p.form).toBe('fire');
  for (let i = 0; i < 6; i++) { steps(s, 1, [BTN.B]); steps(s, 11, [0]); }
  expect(s.entities.filter(e => e.type === 'fireball').length).toBeLessThanOrEqual(2);
});

test('fireballs kill chompkins but not bumble beetles', () => {
  const s = simOf(String.raw`
......................
......................
......................
......................
......................
.........c......b.....
######################`, { forms: ['fire'] });
  for (let i = 0; i < 60; i++) steps(s, 1, [i % 12 === 0 ? BTN.B : 0]);
  const c = find(s, 'chompkin');
  expect(c === undefined || c.state === 'flipped').toBe(true);
  const b = find(s, 'bumblebeetle');
  steps(s, 120, (i) => [i % 12 === 0 ? BTN.B : 0]);
  expect(b.state).not.toBe('flipped');
});

test('leaf block gives a Leaf to a big player; tail spin flips enemies and breaks bricks', () => {
  const s = simOf(box('L'), { forms: ['big'] });
  bumpAbove(s);
  const leaf = find(s, 'leaf');
  expect(leaf).toBeDefined();
  const p = s.players[0];
  for (let i = 0; i < 200 && p.form !== 'leaf'; i++) { p.x = leaf.x; p.y = leaf.y; steps(s, 1); }
  expect(p.form).toBe('leaf');

  const t = simOf(String.raw`
......................
......................
......................
......................
......................
...B..................
######################`, { forms: ['leaf'] });
  t.players[0].dir = 1;
  steps(t, 1, [BTN.B]); steps(t, 10, [0]);
  expect(tileAt(t.lv, 3, 5)).toBe(T.EMPTY);
});

test('tail spin flips an adjacent chompkin', () => {
  const s = simOf(String.raw`
......................
......................
......................
......................
......................
...c..................
######################`, { forms: ['leaf'] });
  const c = find(s, 'chompkin'), p = s.players[0];
  p.x = c.x - 14 * SUB; p.dir = 1;
  steps(s, 1, [BTN.B]); steps(s, 3, [0]);
  expect(c.state).toBe('flipped');
  expect(p.dead).toBe(false);
});

test('leaf: tapping A while falling caps the fall at 1 px/frame', () => {
  const s = simOf(box('.'), { forms: ['leaf'] }, [2, 0]);
  const p = s.players[0];
  let maxFall = 0;
  steps(s, 40, (i) => { if (i > 10) maxFall = Math.max(maxFall, p.vy); return [i % 10 === 0 ? BTN.A : 0]; });
  expect(maxFall).toBeLessThanOrEqual(16);
});

test('leaf: full P-meter jump flies for FLY_FRAMES, then the meter empties', () => {
  const long = Array.from({ length: 14 }, (_, y) => (y === 13 ? '#' : '.').repeat(400)).join('\n');
  const s = simOf(long, { forms: ['leaf'] }, [2, 12]);
  const p = s.players[0];
  steps(s, 140, [BTN.RIGHT | BTN.B]);
  expect(p.pmeter).toBe(7);
  const ground = p.y; let top = p.y;
  steps(s, PHYS.FLY_FRAMES, (i) => { top = Math.min(top, p.y); return [BTN.RIGHT | BTN.B | (i % 8 === 0 ? BTN.A : 0)]; });
  expect((ground - top) / SUB).toBeGreaterThan(150);
  steps(s, 5, [BTN.RIGHT | BTN.B]);
  expect(p.flyTimer).toBe(0);
});

test('star makes the player invincible for STAR_FRAMES', () => {
  const s = simOf(box('S'));
  bumpAbove(s);
  const st = find(s, 'star');
  expect(st).toBeDefined();
  const p = s.players[0];
  for (let i = 0; i < 200 && p.starTimer === 0; i++) { p.x = st.x; p.y = st.y; steps(s, 1); }
  expect(p.starTimer).toBeGreaterThan(STAR_FRAMES - 5);
});

test('1-Up block adds a life', () => {
  const s = simOf(box('U'));
  const lives = s.shared.lives;
  bumpAbove(s);
  const u = find(s, 'oneup'); const p = s.players[0];
  for (let i = 0; i < 100 && find(s, 'oneup'); i++) { p.x = u.x; p.y = u.y; steps(s, 1); }
  expect(s.shared.lives).toBe(lives + 1);
});

test('damage ladder: suits drop to big, big drops to small', () => {
  for (const [from, to] of [['leaf', 'big'], ['fire', 'big'], ['big', 'small']]) {
    const s = simOf(box('.'), { forms: [from] });
    hurtPlayer(s, s.players[0]);
    expect(s.players[0].form).toBe(to);
  }
});
