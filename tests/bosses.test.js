import { test, expect } from 'bun:test';
import { simOf, find, dropOn, steps } from './helpers.js';
import { SUB } from '../src/game/consts.js';
import { TYPES } from '../src/game/entities/index.js';
import { CLEAR_FRAMES, levelResult } from '../src/game/sim.js';

const arena = (ch) => String.raw`
################
#..............#
#..............#
#..............#
#..............#
#..............#
#..............#
#..............#
#..............#
#..........${ch}...#
################`;

const stompBoss = (s, e) => {
  for (let i = 0; i < 200 && ['spin', 'intro'].includes(e.state); i++) steps(s, 1);
  const before = e.hp;
  for (let tries = 0; tries < 5 && e.hp === before; tries++) {
    dropOn(s.players[0], e);
    for (let i = 0; i < 8 && e.hp === before; i++) steps(s, 1);
  }
  s.players[0].hurtTimer = 0;
};

test('bone brute: three stomps, an orb, and the level clears without a card', () => {
  const s = simOf(arena('z'), {}, [2, 8]);
  const e = find(s, 'bonebrute');
  expect(e.hp).toBe(3);
  for (let k = 0; k < 3; k++) { stompBoss(s, e); s.players[0].hurtTimer = 200; }
  expect(e.hp).toBe(0);
  s.players[0].x = 2 * 16 * SUB;          // step away so the orb isn't collected the instant it appears
  steps(s, 60);
  const orb = find(s, 'orb');
  expect(orb).toBeDefined();
  const p = s.players[0];
  p.x = orb.x; p.y = orb.y; p.dead = false;
  steps(s, 2);
  expect(s.mode).toBe('clear');
  steps(s, CLEAR_FRAMES + 2);
  expect(levelResult(s)).toMatchObject({ cleared: true, card: -1 });
});

test('bone brute: every 4th fireball hurts it', () => {
  const s = simOf(arena('z'), {}, [2, 8]);
  const e = find(s, 'bonebrute');
  steps(s, 70);
  for (let i = 0; i < 4; i++) TYPES.bonebrute.hit(e, s, 'fire', null);
  expect(e.hp).toBe(2);
});

test('bone brute: stomping it while it spins hurts the player', () => {
  const s = simOf(arena('z'), { forms: ['big'] }, [2, 8]);
  const e = find(s, 'bonebrute');
  stompBoss(s, e);
  expect(e.state).toBe('spin');
  const p = s.players[0];
  p.hurtTimer = 0;
  dropOn(p, e);
  steps(s, 4);
  expect(p.form).toBe('small');
  expect(e.hp).toBe(2);
});
test('grimling fires wand rings at the player and falls to three stomps', () => {
  const s = simOf(arena('q'), {}, [2, 8]);
  const e = find(s, 'grimling');
  let ring = null;
  for (let i = 0; i < 300 && !ring; i++) { steps(s, 1); s.players[0].hurtTimer = 200; ring = find(s, 'wandring'); }
  expect(ring).toBeDefined();
  expect(ring.vx).toBeLessThan(0);
  for (let k = 0; k < 3; k++) { stompBoss(s, e); s.players[0].hurtTimer = 200; }
  expect(e.hp).toBe(0);
  s.players[0].x = 2 * 16 * SUB;          // step away so the wand isn't collected straight away
  steps(s, 60);
  expect(find(s, 'orb').wand).toBe(true);
});
