import { test, expect } from 'bun:test';
import { SPRITES, PALS, GALLERY_PAL } from '../src/content/sprites/index.js';
import { parseGrid } from '../src/engine/sprites.js';
import { tileArt, entityArt, playerArt, THEMES } from '../src/draw/art.js';
import { TYPES } from '../src/game/entities/index.js';
import '../src/game/entities/all.js';
import { T } from '../src/game/tiles.js';
import { lvl } from './helpers.js';
import { createPlayer } from '../src/game/player.js';

test('every sprite parses and uses at most 3 colours', () => {
  for (const [name, rows] of Object.entries(SPRITES)) {
    const s = parseGrid(rows, name);
    expect(s.w % 8 === 0 || s.w === 12).toBe(true);
    expect(Math.max(...s.px)).toBeLessThanOrEqual(3);
  }
});

test('every sprite has a gallery palette that exists', () => {
  for (const name of Object.keys(SPRITES)) expect(PALS[GALLERY_PAL[name]]).toBeDefined();
});

test('every palette has three valid NES indexes', () => {
  for (const [name, pal] of Object.entries(PALS)) {
    expect(pal.length).toBe(3);
    for (const i of pal) expect(i >= 0 && i < 64).toBe(true);
  }
});

const valid = (layers) => layers.every(l => SPRITES[l.name] && PALS[l.pal]);

test('every entity type and state maps to existing art', () => {
  const states = ['', 'walk', 'fly', 'shell', 'slide', 'carried', 'squished', 'flipped', 'emerge', 'move', 'rise', 'fall', 'pressed', 'collapsed', 'wait', 'up', 'leap'];
  for (const type of Object.keys(TYPES)) {
    for (const state of states) {
      for (let frame = 0; frame < 64; frame += 7) {
        const e = { type, state, x: 0, y: 0, w: 16, h: 16, dir: -1, t: frame, vx: 0, vy: 0, pts: 100, label: '100', owner: 0 };
        expect(valid(entityArt(e, frame))).toBe(true);
      }
    }
  }
});

test('every entity type except score popups draws something in its main state', () => {
  const mainState = { snapvine: 'up', firesnapvine: 'up', ember: 'wait' };
  for (const type of Object.keys(TYPES)) {
    if (type === 'popup') continue;
    const e = { type, state: mainState[type] || '', x: 0, y: 0, w: 16, h: 16, dir: -1, t: 3, vx: 0, vy: 0 };
    expect(entityArt(e, 0).length > 0 ? type : `${type} has no art`).toBe(type);
  }
});

test('every tile id maps to existing art (or nothing)', () => {
  const ids = Object.values(T);
  const lv = lvl('.'.repeat(ids.length));
  ids.forEach((id, i) => { lv.tiles[i] = id; });
  for (let i = 0; i < ids.length; i++) for (const f of [0, 9, 17, 33]) expect(valid(tileArt(lv, i, 0, f, false))).toBe(true);
});

test('every player form and animation maps to existing art', () => {
  const anims = ['stand', 'walk', 'run', 'jump', 'runjump', 'skid', 'crouch', 'slide'];
  for (const form of ['small', 'big', 'fire', 'leaf']) for (const idx of [0, 1]) for (const anim of anims) {
    const p = createPlayer(idx, 1, 1, form);
    p.anim = anim;
    for (const extra of [{}, { kickTimer: 5 }, { carry: 3 }, { tailTimer: 10 }, { starTimer: 50 }, { dead: true }, { pipe: { dir: 'down' } }, { growTimer: 10 }]) {
      Object.assign(p, extra);
      expect(valid(playerArt(p, 13))).toBe(true);
    }
  }
});

test('themes define a background colour', () => {
  for (const t of ['overworld', 'underground', 'fortress', 'sky', 'airship']) expect(typeof THEMES[t].bg).toBe('number');
});
