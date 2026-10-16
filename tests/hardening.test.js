// Regression tests for the final whole-branch review findings.
import { test, expect, afterAll } from 'bun:test';
import { createSession, stepSession, enterNode, makeSave, addPlayer, autoPause, START_LIVES, WORLDS } from '../src/game/session.js';
import { createLevelSim } from '../src/game/sim.js';
import { createHost } from '../src/net/host.js';
import { createGuest } from '../src/net/guest.js';
import { createLoopback } from '../src/net/transport.js';
import { hostRoom, joinRoom } from '../src/net/peer.js';
import { advance, startLoop } from '../src/engine/loop.js';
import { BTN, SUB } from '../src/game/consts.js';

const ORIGINAL_W1 = WORLDS[1];
afterAll(() => { WORLDS[1] = ORIGINAL_W1; });
const row = (ch) => ch.repeat(200);
WORLDS[1] = { ...ORIGINAL_W1, levels: { ...ORIGINAL_W1.levels, hz: {
  id: 'hz', time: 999, start: [2, 11],
  map: [row('.'), row('.'), row('.'), row('.'), row('.'), row('.'), row('.'), row('.'),
    '..' + '?.'.repeat(99), row('.'), row('.'), row('.'), row('#'), row('#')].join('\n'),
} } };

function rig() {
  const sess = createSession({ seed: 7 });
  enterNode(sess, { kind: 'level', level: 'hz', key: '0,0' });
  const host = createHost(sess), link = createLoopback({ latency: 4, jitter: 2, seed: 5 });
  host.attach(link.a);
  const guest = createGuest(link.b, WORLDS);
  const frame = (hb = 0, gb = 0) => { host.step(hb); guest.step(gb); link.tick(); };
  return { sess, host, guest, link, frame };
}

test('a guest joining a paused solo game unpauses it (no soft-lock)', () => {
  const s = createSession();
  enterNode(s, { kind: 'level', level: 'hz', key: '0,0' });
  s.paused = true;
  addPlayer(s);
  const f = s.level.frame;
  stepSession(s, [BTN.RIGHT, BTN.RIGHT]);
  expect(s.paused).toBe(false);
  expect(s.level.frame).toBeGreaterThan(f);
});

test('re-entering the same level gives the guest fresh tiles', () => {
  const r = rig();
  for (let i = 0; i < 40; i++) r.frame(i % 30 < 15 ? BTN.A | BTN.RIGHT : BTN.RIGHT);   // bump some ? blocks
  for (let i = 0; i < 30; i++) r.frame();
  expect(r.sess.level.lv.tileLog.length).toBeGreaterThan(0);
  // Same level id, brand-new instance, with no level-less snapshot in between.
  r.sess.level = createLevelSim(WORLDS[1].levels.hz, { players: 2, seed: 9, defs: WORLDS[1].levels });
  for (let i = 0; i < 30; i++) r.frame();
  expect(Array.from(r.guest.view().level.lv.tiles)).toEqual(Array.from(r.sess.level.lv.tiles));
});

test("player 2's items and cards survive a solo reload and rejoin", () => {
  const s = createSession({ players: 2 });
  s.items[1] = ['leaf', 'star']; s.cards[1] = [2];
  const t = createSession({ players: 1, save: makeSave(s) });
  addPlayer(t);
  expect(t.items[1]).toEqual(['leaf', 'star']);
  expect(t.cards[1]).toEqual([2]);
});

test('the host stops replaying a starved guest input after a few frames', () => {
  const r = rig();
  for (let i = 0; i < 30; i++) r.frame();
  for (let i = 0; i < 20; i++) r.frame(0, BTN.RIGHT | BTN.B);
  // Guest tab hidden: no more input arrives.
  for (let i = 0; i < 60; i++) { r.host.step(0); r.link.tick(); }
  const x = r.sess.level.players[1].x;
  for (let i = 0; i < 30; i++) { r.host.step(0); r.link.tick(); }
  expect(Math.abs(r.sess.level.players[1].x - x)).toBeLessThan(4 * SUB);
});

test('a guest that times out reports a lost connection, not a host exit', () => {
  const r = rig();
  for (let i = 0; i < 30; i++) r.frame();
  for (let i = 0; i < 320; i++) { r.guest.step(0); r.link.tick(); }
  expect(r.guest.status).toBe('closed');
  expect(r.guest.reason).toBe('timeout');
});

test('a throttled hidden host still simulates in real time (1 s ticks)', () => {
  let now = 0, interval = null, steps = 0;
  const g = globalThis;
  const saved = { raf: g.requestAnimationFrame, doc: g.document, si: g.setInterval, perf: g.performance };
  Object.assign(g, { requestAnimationFrame: () => {}, document: { hidden: true }, setInterval: (fn) => { interval = fn; return 1; }, performance: { now: () => now } });
  try {
    startLoop({ step: () => steps++, draw: () => {}, keepAliveHidden: () => true });
    for (let i = 0; i < 10; i++) { now += 1000; interval(); }
    expect(steps).toBeGreaterThan(590);
  } finally {
    Object.assign(g, { requestAnimationFrame: saved.raf, document: saved.doc, setInterval: saved.si, performance: saved.perf });
  }
  expect(advance(0, 10_000).steps).toBe(5);          // the visible-tab cap is unchanged
});

test('a game-over save never stores negative lives', () => {
  const s = createSession();
  s.shared.lives = -1;
  expect(makeSave(s).shared.lives).toBe(START_LIVES);
});

test('a save for a world that does not exist starts a new game instead of throwing', () => {
  const bad = { v: 1, world: 2, map: { x: 1, y: 1, cleared: {}, opened: {}, used: {} }, shared: { lives: 3, coins: 0, score: 0 }, forms: ['big'], items: [[]], cards: [[]] };
  let s;
  expect(() => { s = createSession({ save: bad }); }).not.toThrow();
  expect(s.world).toBe(1);
  expect(s.shared.lives).toBe(START_LIVES);
  const nanMap = { ...bad, world: 1, map: {} };
  expect(() => { s = createSession({ save: nanMap }); }).not.toThrow();
  expect([s.map.x, s.map.y]).toEqual([1, 1]);
});

test('online play reports an error instead of throwing when PeerJS failed to load', () => {
  const saved = globalThis.Peer;
  delete globalThis.Peer;
  try {
    const errs = [];
    expect(() => hostRoom({ onCode() {}, onGuest() {}, onError: (m) => errs.push(m) })).not.toThrow();
    expect(() => joinRoom('ABCD', { onConnected() {}, onError: (m) => errs.push(m) })).not.toThrow();
    expect(errs).toEqual(['ONLINE PLAY UNAVAILABLE', 'ONLINE PLAY UNAVAILABLE']);
  } finally { globalThis.Peer = saved; }
});

test('a signalling-server error after joining does not end a connected session', () => {
  const peers = [];
  class FakePeer {
    constructor() { this.h = {}; peers.push(this); }
    on(t, f) { this.h[t] = f; }
    emit(t, ...a) { this.h[t] && this.h[t](...a); }
    connect() { const c = { h: {}, on(t, f) { this.h[t] = f; }, open: true, send() {}, close() {} }; this.conn = c; return c; }
    destroy() {} reconnect() { this.reconnected = true; }
  }
  const saved = globalThis.Peer;
  globalThis.Peer = FakePeer;
  try {
    const errs = []; let connected = false;
    joinRoom('ABCD', { onConnected: () => { connected = true; }, onError: (m) => errs.push(m) });
    const p = peers[0];
    p.emit('open'); p.conn.h.open();
    expect(connected).toBe(true);
    p.emit('error', { type: 'network' });
    expect(errs).toEqual([]);
    // Host: a dropped signalling socket reconnects so the room code keeps working.
    hostRoom({ onCode() {}, onGuest() {}, onError: (m) => errs.push(m) });
    peers[1].emit('disconnected');
    expect(peers[1].reconnected).toBe(true);
  } finally { globalThis.Peer = saved; }
});

test('an exception in a frame is reported and the loop keeps running', () => {
  let rafs = 0, errors = 0, now = 0, steps = 0;
  const g = globalThis;
  const saved = { raf: g.requestAnimationFrame, doc: g.document, si: g.setInterval, perf: g.performance };
  let frameFn = null;
  Object.assign(g, { requestAnimationFrame: (f) => { rafs++; frameFn = f; }, document: { hidden: false }, setInterval: () => 1, performance: { now: () => now } });
  try {
    startLoop({ step: () => { steps++; if (steps === 1) throw new Error('boom'); }, draw: () => {}, onError: () => errors++ });
    now += 20; frameFn(now);
    now += 20; frameFn(now);
    expect(errors).toBe(1);
    expect(rafs).toBe(3);
    expect(steps).toBeGreaterThan(1);
  } finally {
    Object.assign(g, { requestAnimationFrame: saved.raf, document: saved.doc, setInterval: saved.si, performance: saved.perf });
  }
});

test('losing window focus pauses a solo level, but never co-op', () => {
  const s = createSession();
  enterNode(s, { kind: 'level', level: 'hz', key: '0,0' });
  autoPause(s);
  expect(s.paused).toBe(true);
  const c = createSession({ players: 2 });
  enterNode(c, { kind: 'level', level: 'hz', key: '0,0' });
  autoPause(c);
  expect(c.paused).toBe(false);
});
