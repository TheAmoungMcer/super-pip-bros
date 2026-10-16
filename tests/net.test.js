import { test, expect, afterAll } from 'bun:test';
import { createLoopback } from '../src/net/transport.js';
import { createHost } from '../src/net/host.js';
import { createGuest } from '../src/net/guest.js';
import { createSession, enterNode, WORLDS } from '../src/game/session.js';
import { BTN, SUB } from '../src/game/consts.js';
import { PROTOCOL_VERSION } from '../src/net/protocol.js';

// A flat, enemy-free level with ? blocks, so tests are about netcode and not about dying.
const row = (ch) => ch.repeat(200);
// Use a private copy of World 1 so this test level never leaks into other test files.
const ORIGINAL_W1 = WORLDS[1];
afterAll(() => { WORLDS[1] = ORIGINAL_W1; });
const NT = {
  id: 'nt', time: 999, start: [2, 11],
  map: [row('.'), row('.'), row('.'), row('.'), row('.'), row('.'), row('.'), row('.'),
    '..' + '?.'.repeat(99), row('.'), row('.'), row('.'), row('#'), row('#')].join('\n'),
};
WORLDS[1] = { ...ORIGINAL_W1, levels: { ...ORIGINAL_W1.levels, nt: NT } };

function rig({ latency = 6, jitter = 3, scene = 'level' } = {}) {
  const sess = createSession({ players: 1, seed: 7 });
  if (scene === 'level') enterNode(sess, { kind: 'level', level: 'nt', key: '0,0' });
  const host = createHost(sess);
  const link = createLoopback({ latency, jitter, seed: 3 });
  const frame = (hb = 0, gb = 0) => { host.step(hb); guest && guest.step(gb); link.tick(); };
  let guest = null;
  return {
    sess, host, link, frame,
    join() { host.attach(link.a); guest = createGuest(link.b, WORLDS); return guest; },
    get guest() { return guest; },
  };
}

test('guest joining mid-level appears next to the host with matching tiles', () => {
  const r = rig();
  for (let i = 0; i < 120; i++) r.frame(BTN.RIGHT | (i % 40 < 20 ? BTN.A : 0));
  const g = r.join();
  for (let i = 0; i < 40; i++) r.frame();
  expect(g.status).toBe('playing');
  expect(r.sess.players).toBe(2);
  const hp = r.sess.level.players, v = g.view();
  expect(v.scene).toBe('level');
  expect(v.level.lv.id).toBe('nt');
  expect(r.sess.level.lv.tileLog.length).toBeGreaterThan(0);   // the host changed tiles before the guest joined
  expect(Math.abs(hp[1].x - hp[0].x)).toBeLessThan(32 * SUB);
  expect(Array.from(v.level.lv.tiles)).toEqual(Array.from(r.sess.level.lv.tiles));
});

test('guest prediction converges on the host position once inputs stop', () => {
  const r = rig();
  const g = r.join();
  for (let i = 0; i < 30; i++) r.frame();
  for (let i = 0; i < 90; i++) r.frame(0, BTN.RIGHT | BTN.B | (i % 30 < 12 ? BTN.A : 0));
  for (let i = 0; i < 60; i++) r.frame();
  const host1 = r.sess.level.players[1], mine = g.view().level.players[1];
  expect(Math.abs(mine.x - host1.x)).toBeLessThanOrEqual(2 * SUB);
  expect(Math.abs(mine.y - host1.y)).toBeLessThanOrEqual(2 * SUB);
  expect(host1.x).toBeGreaterThan(r.sess.level.players[0].x + 16 * SUB);   // the guest really moved
});

test('one-frame taps from the guest are not lost to jitter', () => {
  const r = rig({ latency: 4, jitter: 4 });
  const g = r.join();
  for (let i = 0; i < 30; i++) r.frame();
  const y0 = r.sess.level.players[1].y;
  r.frame(0, BTN.A);
  let minY = y0;
  for (let i = 0; i < 40; i++) { r.frame(); minY = Math.min(minY, r.sess.level.players[1].y); }
  expect(minY).toBeLessThan(y0 - 8 * SUB);
});

test('guest sees the map scene when joining on the map', () => {
  const r = rig({ scene: 'map' });
  const g = r.join();
  for (let i = 0; i < 20; i++) r.frame();
  r.frame(BTN.RIGHT);
  for (let i = 0; i < 40; i++) r.frame();
  const v = g.view();
  expect(v.scene).toBe('map');
  expect([v.map.x, v.map.y]).toEqual([r.sess.map.x, r.sess.map.y]);
});

test('disconnect drops player 2 and the host carries on', () => {
  const r = rig();
  const g = r.join();
  for (let i = 0; i < 30; i++) r.frame();
  r.sess.items[1] = ['leaf'];
  r.link.b.close();
  for (let i = 0; i < 20; i++) r.frame();
  expect(r.host.connected).toBe(false);
  expect(r.sess.players).toBe(1);
  expect(r.sess.level.players.length).toBe(1);
  expect(r.sess.items[1]).toEqual(['leaf']);
  for (let i = 0; i < 30; i++) r.frame(BTN.RIGHT);
  expect(r.sess.level.frame).toBeGreaterThan(50);
});

test('a guest with the wrong protocol version is rejected', () => {
  const sess = createSession();
  const host = createHost(sess);
  const link = createLoopback({});
  host.attach(link.a);
  let got = null;
  link.b.onMessage(m => { got = m; });
  link.b.send({ t: 'hello', v: PROTOCOL_VERSION + 1 });
  for (let i = 0; i < 3; i++) { host.step(0); link.tick(); }
  expect(got).toEqual({ t: 'reject', reason: 'version' });
  expect(sess.players).toBe(1);
});

test('a guest that goes silent is dropped after 5 seconds', () => {
  const r = rig();
  r.join();
  for (let i = 0; i < 30; i++) r.frame();
  expect(r.sess.players).toBe(2);
  for (let i = 0; i < 320; i++) { r.host.step(0); r.link.tick(); }    // guest tab vanished: no messages, no close event
  expect(r.host.connected).toBe(false);
  expect(r.sess.players).toBe(1);
});

test('a guest whose host goes silent gives up after 5 seconds', () => {
  const r = rig();
  const g = r.join();
  for (let i = 0; i < 30; i++) r.frame();
  for (let i = 0; i < 320; i++) { g.step(0); r.link.tick(); }        // host vanished
  expect(g.status).toBe('closed');
});
