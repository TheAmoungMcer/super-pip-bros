export const PROTOCOL_VERSION = 1;
export const SNAP_EVERY = 3;

export function b64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}
export function unb64(str) {
  const s = atob(str), u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
}

export function liteSession(sess) {
  const { level, events, rng, prev, dirty, quit, ...rest } = sess;
  return rest;
}

// `sent` remembers what this guest already has: { area, n } (tileLog length sent so far).
export function levelSnapshot(s, sent) {
  const lv = s.lv;
  let tiles;
  if (sent.area !== lv.id) {
    tiles = { area: lv.id, full: b64(lv.tiles) };
  } else {
    tiles = { area: lv.id, ops: lv.tileLog.slice(sent.n) };
  }
  sent.area = lv.id; sent.n = lv.tileLog.length;
  const { lv: _lv, defs, areaStore, spawned, events, ...rest } = s;
  return { ...rest, spawned: Array.from(spawned), tiles };
}

const LOUD = new Set(['sfx', 'clear', 'music']);
export const forGuest = (events) => events.filter(e => LOUD.has(e.e));
