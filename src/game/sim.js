import { TS, SUB, BTN } from './consts.js';
import { parseLevel, tileAt, setTile } from './level.js';
import { INFO, T } from './tiles.js';
import { createPlayer, updatePlayer, isBig, setForm } from './player.js';
import { createCamera, updateCamera } from './camera.js';
import { moveBody } from './physics.js';
import { killPlayer } from './powerups.js';
import { TYPES, spawnEntity, updateEntities } from './entities/index.js';
import { playerContacts } from './entities/common.js';
import './entities/all.js';

export const DEATH_FRAMES = 150, RESPAWN_FRAMES = 180, CLEAR_FRAMES = 240, TIME_TICK = 40;
const SPAWN_MARGIN = 24, DESPAWN_MARGIN = 80;  // pixels beyond the screen edge

export function createLevelSim(def, { players = 1, forms = [], seed = 1, shared = { coins: 0, lives: 5, score: 0 } } = {}) {
  const lv = parseLevel(def);
  const s = {
    frame: 0, lv, players: [], cams: [], entities: [], nextId: 1, rng: { seed },
    spawned: new Uint8Array(lv.spawns.length), time: lv.time, timeSub: 0,
    bumps: [], multicoin: {}, pswitch: 0, mode: 'play', modeTimer: 0, clear: null,
    shared: { ...shared }, events: [],
  };
  for (let i = 0; i < players; i++) {
    const p = createPlayer(i, lv.start.tx + i, lv.start.ty, forms[i] || 'small');
    moveBody(p, lv);   // settle onto the ground so a press on frame 1 can jump
    s.players.push(p);
    s.cams.push(createCamera(p, lv));
  }
  return s;
}

// Score events are the single source of points: stepLevel adds them and shows a popup.
export function addScore(s, pts, x, y) {
  s.events.push({ e: 'score', pts, x, y });
}

export function addCoins(s, n = 1) {
  s.shared.coins += n;
  s.shared.score += 50 * n;
  s.events.push({ e: 'sfx', id: 'coin' });
  while (s.shared.coins >= 100) { s.shared.coins -= 100; s.shared.lives++; s.events.push({ e: 'sfx', id: '1up' }); }
}

export function stepLevel(s, inputs) {
  s.events = [];
  s.frame++;
  s.bumps = s.bumps.filter(b => --b.t > 0);
  for (const p of s.players) {
    if (p.dead) { stepDead(s, p); continue; }
    const buttons = s.mode === 'play' ? (inputs[p.idx] | 0) : BTN.RIGHT;
    const out = { events: s.events, bumps: [] };
    updatePlayer(p, buttons, s.lv, out);
    for (const b of out.bumps) hitBlock(s, b);
    afterMove(s, p, buttons);
  }
  s.players.forEach((p, i) => updateCamera(s.cams[i], p, s.lv));
  spawnInView(s);
  updateEntities(s);
  despawnOutOfView(s);
  playerContacts(s);
  for (const ev of s.events) {
    if (ev.e !== 'score') continue;
    s.shared.score += ev.pts;
    spawnEntity(s, 'popup', ev.x, ev.y, { pts: ev.pts, label: ev.label || String(ev.pts) });
  }
  tickTimer(s);
  resolveMode(s);
}

export function hitBlock(s, { tx, ty, by, big }) {
  const lv = s.lv, id = tileAt(lv, tx, ty), info = INFO[id];
  const px = tx * TS, py = ty * TS;
  const emerge = (type) => spawnEntity(s, type, px + SUB, py, { state: 'emerge', by });
  if (info.bump || info.breakable || id === T.NOTE) s.bumps.push({ tx, ty, t: 8 });
  switch (info.bump) {
    case 'coin': setTile(lv, tx, ty, T.USED); addCoins(s); spawnEntity(s, 'coinpop', px + 4 * SUB, py - TS); break;
    case 'multicoin': {
      const k = `${tx},${ty}`;
      s.multicoin[k] = (s.multicoin[k] ?? 10) - 1;
      addCoins(s); spawnEntity(s, 'coinpop', px + 4 * SUB, py - TS);
      if (s.multicoin[k] <= 0) setTile(lv, tx, ty, T.USED);
      break;
    }
    case 'power': setTile(lv, tx, ty, T.USED); emerge(big ? 'blossom' : 'berry'); break;
    case 'leaf': setTile(lv, tx, ty, T.USED); emerge(big ? 'leaf' : 'berry'); break;
    case '1up': setTile(lv, tx, ty, T.USED); emerge('oneup'); break;
    case 'star': setTile(lv, tx, ty, T.USED); emerge('star'); break;
    case 'pswitch': setTile(lv, tx, ty, T.USED); spawnEntity(s, 'pswitch', px, py - TS); break;
    default:
      if (info.breakable && big) {
        setTile(lv, tx, ty, T.EMPTY);
        s.shared.score += 10;
        for (const [dx, dy] of [[-12, -64], [12, -64], [-12, -40], [12, -40]]) {
          spawnEntity(s, 'brickbit', px + 4 * SUB, py + 4 * SUB, { vx: dx, vy: dy });
        }
        s.events.push({ e: 'sfx', id: 'break' });
      }
  }
  // Anything standing on the bumped block gets knocked.
  for (const e of s.entities) {
    if (e.dead || e.state === 'flipped' || !TYPES[e.type].hit) continue;
    const foot = e.y + e.h * SUB;
    if (foot >= py - 2 * SUB && foot <= py + 2 * SUB && e.x + e.w * SUB > px && e.x < px + TS) {
      TYPES[e.type].hit(e, s, 'bump', null);
    }
  }
}

function overlappedTiles(lv, p, fn) {
  const tx0 = Math.floor(p.x / TS), tx1 = Math.floor((p.x + p.w * SUB - 1) / TS);
  const ty0 = Math.floor(p.y / TS), ty1 = Math.floor((p.y + p.h * SUB - 1) / TS);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) fn(tx, ty, tileAt(lv, tx, ty));
}

function afterMove(s, p, buttons) {
  const lv = s.lv;
  // Music blocks bounce you; holding A bounces higher.
  if (p.onGround) {
    const tx = Math.floor((p.x + (p.w * SUB >> 1)) / TS), ty = Math.floor((p.y + p.h * SUB) / TS);
    if (tileAt(lv, tx, ty) === T.NOTE) {
      p.vy = buttons & BTN.A ? -88 : -48; p.onGround = false;
      s.bumps.push({ tx, ty, t: 8 });
      s.events.push({ e: 'sfx', id: 'note' });
    }
  }
  overlappedTiles(lv, p, (tx, ty, id) => {
    const info = INFO[id];
    if (info.coin) { setTile(lv, tx, ty, T.EMPTY); addCoins(s); }
    else if (info.deadly) killPlayer(s, p);
    else if (id === T.GOAL && s.mode === 'play') {
      s.mode = 'clear'; s.modeTimer = 0;
      s.clear = { by: p.idx, card: Math.floor(s.frame / 8) % 3 };
      s.events.push({ e: 'clear', card: s.clear.card });
    }
  });
  if (p.y > lv.h * TS + 32 * SUB) killPlayer(s, p);
}

function stepDead(s, p) {
  p.deathTimer++;
  if (p.deathTimer > 30) { p.vy = Math.min(p.vy + 3, 64); p.y += p.vy; }
  const partner = s.players.find(o => o !== p && !o.dead);
  if (partner && s.mode === 'play' && ++p.respawnTimer >= RESPAWN_FRAMES) {
    p.dead = false; p.deathTimer = 0; p.respawnTimer = 0;
    setForm(p, 'small');
    p.x = partner.x;
    p.y = partner.y + partner.h * SUB - p.h * SUB;
    p.vx = 0; p.vy = 0; p.onGround = partner.onGround;
    p.hurtTimer = 120;
    s.events.push({ e: 'sfx', id: 'respawn', who: p.idx });
  }
}

function inRange(s, px, margin) {
  return s.cams.some(c => px >= c.x - margin && px <= c.x + 256 + margin);
}

function spawnInView(s) {
  s.lv.spawns.forEach((sp, i) => {
    const px = sp.tx * 16 + 8;
    if (s.spawned[i] === 3 && !inRange(s, px, SPAWN_MARGIN)) s.spawned[i] = 0;
    if (s.spawned[i] !== 0 || !inRange(s, px, SPAWN_MARGIN)) return;
    s.spawned[i] = 1;
    const e = spawnEntity(s, sp.type, sp.tx * TS + SUB, sp.ty * TS + 2 * SUB, { spawn: i });
    // Entities stand on the bottom of their spawn tile.
    e.y = (sp.ty + 1) * TS - e.h * SUB;
  });
}

function despawnOutOfView(s) {
  for (const e of s.entities) {
    if (e.dead || e.persistent) continue;
    const px = Math.floor(e.x / SUB) + e.w / 2;
    if (inRange(s, px, DESPAWN_MARGIN)) continue;
    e.dead = true;
    if (e.spawn >= 0 && s.spawned[e.spawn] === 1) {
      const sp = s.lv.spawns[e.spawn];
      s.spawned[e.spawn] = inRange(s, sp.tx * 16 + 8, SPAWN_MARGIN) ? 3 : 0;
    }
  }
  s.entities = s.entities.filter(e => !e.dead);
}

function tickTimer(s) {
  if (s.mode !== 'play') return;
  if (s.pswitch > 0 && --s.pswitch === 0) s.events.push({ e: 'pswitch-end' });
  if (++s.timeSub < TIME_TICK) return;
  s.timeSub = 0;
  s.time--;
  if (s.time === 100) s.events.push({ e: 'sfx', id: 'hurry' });
  if (s.time <= 0) { s.time = 0; for (const p of s.players) killPlayer(s, p); }
}

function resolveMode(s) {
  if (s.mode === 'play') {
    if (s.players.every(p => p.dead) && s.players.every(p => p.deathTimer >= DEATH_FRAMES)) s.mode = 'fail';
  } else if (s.mode === 'clear') {
    if (++s.modeTimer >= CLEAR_FRAMES) s.mode = 'done';
  }
}

export function levelResult(s) {
  return {
    cleared: s.mode === 'done' || s.mode === 'clear',
    card: s.clear ? s.clear.card : -1,
    forms: s.players.map(p => (p.dead ? 'small' : p.form)),
  };
}
