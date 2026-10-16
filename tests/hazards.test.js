import { test, expect } from 'bun:test';
import { simOf, find, dropOn, steps } from './helpers.js';
import { SUB, TS } from '../src/game/consts.js';
import { tileAt } from '../src/game/level.js';
import { T } from '../src/game/tiles.js';
import { TYPES } from '../src/game/entities/index.js';

const pipe = (who) => String.raw`
....................
....................
....................
.........${who}..........
.........[].........
.........{}.........
####################`;

test('snapvine rises out of its pipe and sinks again', () => {
  const s = simOf(pipe('s'));
  const e = find(s, 'snapvine');
  let up = false, downAgain = false;
  for (let i = 0; i < 300; i++) {
    steps(s, 1);
    if (e.y === e.baseY) up = true;
    if (up && e.y === e.baseY + e.h * SUB) downAgain = true;
  }
  expect(up).toBe(true);
  expect(downAgain).toBe(true);
});

test('snapvine stays hidden while a player stands next to the pipe', () => {
  const s = simOf(pipe('s'), {}, [11, 5]);
  const e = find(s, 'snapvine');
  s.players[0].x = 11 * TS;             // standing against the pipe's right side, centre 22 px from the pipe centre
  steps(s, 300);
  expect(e.y).toBe(e.baseY + e.h * SUB);
});

test('fireballs kill snapvines', () => {
  const s = simOf(pipe('s'));
  const e = find(s, 'snapvine');
  TYPES.snapvine.hit(e, s, 'fire', null);
  steps(s, 1);
  expect(find(s, 'snapvine')).toBeUndefined();
  expect(s.spawned[0]).toBe(2);
});

test('fire snapvine spits fire toward the player', () => {
  const s = simOf(pipe('v'));
  let shot = null;
  for (let i = 0; i < 300 && !shot; i++) { steps(s, 1); shot = find(s, 'enemyfire'); }
  expect(shot).toBeDefined();
  expect(shot.vx).toBeLessThan(0);   // player is to the left
});

test('cannons fire boom bolts toward the player; stomping one flips it', () => {
  const s = simOf(String.raw`
....................
....................
....................
....................
..............K.....
..............K.....
####################`);
  let bolt = null;
  for (let i = 0; i < 400 && !bolt; i++) { steps(s, 1); bolt = find(s, 'boombolt'); }
  expect(bolt).toBeDefined();
  expect(bolt.vx).toBe(-24);
  dropOn(s.players[0], bolt);
  for (let i = 0; i < 10 && bolt.state !== 'flipped'; i++) steps(s, 1);
  expect(bolt.state).toBe('flipped');
});

test('embers leap out of lava and fall back', () => {
  const s = simOf(String.raw`
....................
....................
....................
....................
....................
##.......e.......###
###~~~~~~~~~~~~~~###`);
  const e = find(s, 'ember');
  const home = e.y; let peak = home;
  steps(s, 200, () => { peak = Math.min(peak, e.y); return []; });
  expect((home - peak) / SUB).toBeGreaterThan(48);
  expect(e.y).toBeGreaterThanOrEqual(home - 2 * SUB);
});

test('rotodisc orbits its solid pivot', () => {
  const s = simOf(String.raw`
....................
....................
..........o.........
....................
....................
....................
####################`);
  expect(tileAt(s.lv, 10, 2)).toBe(T.USED);
  const e = find(s, 'rotodisc');
  const cx = 10 * TS + 8 * SUB, cy = 2 * TS + 8 * SUB;
  for (let i = 0; i < 128; i += 16) {
    steps(s, 16);
    const dx = (e.x + 6 * SUB - cx) / SUB, dy = (e.y + 6 * SUB - cy) / SUB;
    expect(Math.round(Math.hypot(dx, dy))).toBeGreaterThanOrEqual(38);
    expect(Math.round(Math.hypot(dx, dy))).toBeLessThanOrEqual(42);
  }
});

test('bone shells collapse when stomped, rebuild later and ignore fire', () => {
  const s = simOf(String.raw`
....................
....................
....................
....................
....................
..........d.........
####################`);
  const e = find(s, 'boneshell');
  TYPES.boneshell.hit(e, s, 'fire', null);
  expect(e.state).toBe('walk');
  dropOn(s.players[0], e);
  for (let i = 0; i < 10 && e.state !== 'collapsed'; i++) steps(s, 1);
  expect(e.state).toBe('collapsed');
  expect(e.harmful).toBe(false);
  s.players[0].x = 1 * TS;
  steps(s, 260);
  expect(e.state).toBe('walk');
  expect(e.harmful).toBe(true);
});
