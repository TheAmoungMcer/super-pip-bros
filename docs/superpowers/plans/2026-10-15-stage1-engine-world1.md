# Super Pip Bros. Stage 1 (Engine + World 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A playable SMB3-style browser game with a complete World 1 (map, 6 levels, fortress, Gift Hut, Slot Panel, airship boss), solo and 2-player online co-op, live on GitHub Pages.

**Architecture:** Plain ES modules, no build step. All game rules live in a pure, deterministic, structured-clone-able simulation (`src/game/`) stepped at 60 Hz with one button mask per player. Rendering (`src/draw/`), audio (`src/engine/audio.js`) and networking (`src/net/`) only read state or feed inputs. The host browser is authoritative; the guest predicts its own player.

**Tech Stack:** JavaScript (ES2022 modules), Canvas 2D at 256×240, Web Audio, Gamepad API, PeerJS 1.5.4 (only dependency), Bun for dev server and tests (`bun test`).

**Spec:** `docs/superpowers/specs/2026-10-15-super-pip-bros-design.md`

## Global Constraints

- No Nintendo names, sprites, music or text anywhere in the repo (it is public). Cast and enemy names come from the spec only.
- No build step. `index.html` + ES modules served as static files. Every relative import includes the `.js` extension.
- Only third-party code: PeerJS 1.5.4 via `<script src="https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js">`. The spec says cdnjs; unpkg serves the official npm build at an exact version. Use cdnjs instead only if it carries 1.5.4.
- Tooling is Bun only (`bun`, `bunx`). There is no Node or npm on this Mac.
- Internal resolution 256×240: play area is the top 200 px, status bar the bottom 40 px. Canvas is CSS-scaled by an integer factor with `image-rendering: pixelated`.
- Fixed 60 Hz simulation. Code under `src/game/` never calls `Math.random`, `Date`, `performance`, or DOM APIs. Randomness comes from `rand(state.rng)`.
- Sim state is plain data (objects, arrays, numbers, strings, booleans, typed arrays), so `structuredClone(state)` is a perfect copy.
- Units: 1 tile = 16 px; positions and velocities are integers in subpixels (1 px = 16 sub).
- Sprites use at most 3 colours plus transparency, drawn from the NES palette in `src/engine/palette.js`.
- Controls: arrows = move, Z or Space = A (jump), X = B (run/attack), Enter = Start, Shift = Select. Standard-mapping gamepads also work.
- Repo `TheAmoungMcer/super-pip-bros` (public), GitHub Pages from `main` branch root.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

1. **Keys held when the window loses focus** → the player must not keep running forever; input clears on `blur` (test in Task 3).
2. **Tab hidden or a long frame stall** → no spiral of death; at most 5 catch-up steps, and a hidden host keeps simulating so the guest is not frozen (test in Task 3).
3. **Both players die on the same frame, or one dies while the other touches the goal** → exactly one life lost, or none if the goal was touched; never two (test in Task 7).
4. **Guest joins while the host is on the map or mid-level** → the guest appears in the host's current scene next to the host, with tile state matching (test in Task 21).
5. **localStorage unavailable or holding a corrupt save** → the game still boots and offers a new game; it never throws (test in Task 17).

## Content tasks: what "complete" means

Pixel art, level layouts and music are content, not logic. For these, the plan gives the exact data format, one or more complete examples, and a precise spec table for each remaining item: size, palette, frames and silhouette for art; a beat-by-beat column layout for levels. The implementer authors the data to that spec. Acceptance is mechanical (sprite parser, level validator, autopilot beats every level), plus headless screenshots reviewed against the spec table.

## File Map

```
index.html                     canvas, styles, PeerJS tag, loads src/main.js
package.json                   bun scripts: dev, test, selftest
tools/serve.js                 static dev server (Bun.serve) on :5190
tools/autopilot.js             beam-search bot + route replay over sim.step
tools/routes/*.json            recorded winning input routes per level
tools/validate-levels.js       static level checks
tools/selftest.js              runs validator + replays all routes + co-op loopback
src/main.js                    browser boot: canvas, loop, input, scenes, audio, net
src/engine/loop.js             fixed-timestep accumulator + rAF/interval driver
src/engine/input.js            keyboard + gamepad -> button mask
src/engine/palette.js          NES palette (64 hex colours)
src/engine/sprites.js          text pixel grid -> indexed sprite; RGBA bake
src/engine/render.js           canvas setup, integer fit, sprite cache, blit helpers
src/engine/audio.js            4-voice chip, sequencer, sfx player
src/game/consts.js             TILE, SUB, BTN, screen sizes
src/game/rng.js                deterministic mulberry32 on {seed}
src/game/tiles.js              tile ids, legend chars, per-tile properties
src/game/level.js              parse level defs, tile get/set, tile events
src/game/physics.js            body vs tile collision incl. semisolids + slopes
src/game/player.js             player movement state machine
src/game/powerups.js           forms, damage ladder, item effects
src/game/sim.js                level simulation: createLevelSim, stepLevel
src/game/camera.js             per-player SMB3 camera
src/game/entities/index.js     type registry + spawn/update/collide dispatch
src/game/entities/*.js         one file per enemy family / item / projectile
src/game/session.js            whole-game state machine (scenes) + step
src/game/worldmap.js           map movement, nodes, locks
src/game/inventory.js          28-slot items, map-item effects
src/game/minigames.js          Gift Hut, Slot Panel, goal roulette
src/game/save.js               3 slots, versioned, safe load
src/content/sprites/*.js       pixel grids + palettes
src/content/levels/w1.js       World 1 level defs
src/content/maps/w1.js         World 1 map def
src/content/music.js           songs + sfx note data
src/game/areas.js              pipe/door area switching, cannon list
src/content/levels/dev.js      sandbox level with every tile and enemy
src/draw/*.js                  per-scene drawing (art mapping, level, map, hud, hut, slots, item bar, text, gallery, scenes, present)
src/ui/title.js                title screen, save-slot select, room-code entry
src/net/transport.js           fake in-memory transport + PeerJS adapter
src/net/protocol.js            message shapes, snapshot build/apply
src/net/host.js, guest.js      authority, prediction, reconciliation
src/net/peer.js                PeerJS rooms and 4-letter codes
src/selftest.js                window.__runSelfTest()
tools/levelkit.js              exact-width map authoring helpers
tests/*.test.js                bun test suites
```

---

### Task 1: Project scaffold, dev server, scaled canvas

**Files:**
- Create: `package.json`, `.gitignore`, `index.html`, `tools/serve.js`, `src/main.js`, `src/engine/render.js`
- Test: `tests/render.test.js`

**Interfaces:**
- Produces: `fitScale(winW: number, winH: number): number` (integer ≥ 1) and `createScreen(canvas): { ctx, canvas }` from `src/engine/render.js`. `bun run dev` serves the repo at `http://localhost:5190/`.

- [ ] **Step 1: Write the failing test**

`tests/render.test.js`:
```js
import { test, expect } from 'bun:test';
import { fitScale } from '../src/engine/render.js';

test('fitScale picks the largest integer scale that fits', () => {
  expect(fitScale(256, 240)).toBe(1);
  expect(fitScale(1920, 1080)).toBe(4);   // 1080/240 = 4.5
  expect(fitScale(800, 1200)).toBe(3);    // 800/256 = 3.1
});

test('fitScale never returns less than 1', () => {
  expect(fitScale(100, 100)).toBe(1);
  expect(fitScale(0, 0)).toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/render.test.js`
Expected: FAIL, cannot find module `../src/engine/render.js`.

- [ ] **Step 3: Write the scaffold**

`package.json`:
```json
{
  "name": "super-pip-bros",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bun tools/serve.js",
    "test": "bun test",
    "selftest": "bun tools/selftest.js"
  }
}
```

`.gitignore`:
```
.DS_Store
node_modules/
*.log
```

`tools/serve.js`:
```js
// Static dev server. ES modules cannot load from file://, so use this locally.
const root = new URL('..', import.meta.url).pathname;
const port = Number(process.env.PORT || 5190);
const TYPES = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.css': 'text/css' };

Bun.serve({
  port,
  async fetch(req) {
    let path = decodeURIComponent(new URL(req.url).pathname);
    if (path.endsWith('/')) path += 'index.html';
    if (path.includes('..')) return new Response('bad path', { status: 400 });
    const file = Bun.file(root + path.slice(1));
    if (!(await file.exists())) return new Response('not found', { status: 404 });
    const ext = path.slice(path.lastIndexOf('.'));
    return new Response(file, { headers: { 'content-type': TYPES[ext] || file.type, 'cache-control': 'no-store' } });
  },
});
console.log(`Super Pip Bros. running at http://localhost:${port}/`);
```

`src/engine/render.js`:
```js
import { SCREEN_W, SCREEN_H } from '../game/consts.js';

export function fitScale(winW, winH) {
  return Math.max(1, Math.floor(Math.min(winW / SCREEN_W, winH / SCREEN_H)));
}

export function createScreen(canvas) {
  canvas.width = SCREEN_W;
  canvas.height = SCREEN_H;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const fit = () => {
    const s = fitScale(window.innerWidth, window.innerHeight);
    canvas.style.width = `${SCREEN_W * s}px`;
    canvas.style.height = `${SCREEN_H * s}px`;
  };
  window.addEventListener('resize', fit);
  fit();
  return { ctx, canvas };
}
```

`src/game/consts.js`:
```js
export const TILE = 16;          // pixels per tile
export const SUB = 16;           // subpixels per pixel
export const TS = TILE * SUB;    // subpixels per tile
export const SCREEN_W = 256;
export const SCREEN_H = 240;
export const PLAY_H = 200;       // play area height; status bar is below
export const HUD_H = 40;
export const BTN = { LEFT: 1, RIGHT: 2, UP: 4, DOWN: 8, A: 16, B: 32, START: 64, SELECT: 128 };
```

`index.html`:
```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Super Pip Bros.</title>
<style>
  html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
  body { display: flex; align-items: center; justify-content: center; }
  canvas { image-rendering: pixelated; image-rendering: crisp-edges; display: block; }
  #msg { position: fixed; bottom: 8px; left: 0; right: 0; text-align: center; color: #888; font: 12px monospace; }
</style>
</head>
<body>
<canvas id="screen"></canvas>
<div id="msg"></div>
<script type="module" src="src/main.js"></script>
</body>
</html>
```

`src/main.js` (temporary; replaced in Task 14):
```js
import { createScreen } from './engine/render.js';

const { ctx } = createScreen(document.getElementById('screen'));
ctx.fillStyle = '#6888FC';
ctx.fillRect(0, 0, 256, 200);
ctx.fillStyle = '#000';
ctx.fillRect(0, 200, 256, 40);
```

- [ ] **Step 4: Run tests and the dev server**

Run: `bun test tests/render.test.js` → Expected: 2 pass.
Run: `bun run dev` (background), then `curl -s localhost:5190/ | head -3` → Expected: `<!doctype html>`. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: scaffold with dev server and integer-scaled canvas

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: RNG, NES palette and sprite decoder

**Files:**
- Create: `src/game/rng.js`, `src/engine/palette.js`, `src/engine/sprites.js`
- Test: `tests/sprites.test.js`, `tests/rng.test.js`

**Interfaces:**
- Produces:
  - `rand(rng: {seed:number}): number` in [0,1), mutates `rng.seed`; `randInt(rng, n): number` in [0,n).
  - `PALETTE: string[64]` of `#RRGGBB`; `hexToRgb(hex): [r,g,b]`.
  - `parseGrid(rows: string[], name='?'): { w, h, px: Uint8Array }` where px values are 0 (transparent) or 1..3. Throws `Error("sprite <name>: ...")` on a ragged row or a char other than `.123`.
  - `bakeRGBA(sprite, pal: [i1,i2,i3], flipX=false): Uint8ClampedArray` (w*h*4), where pal entries index `PALETTE`.

- [ ] **Step 1: Write the failing tests**

`tests/rng.test.js`:
```js
import { test, expect } from 'bun:test';
import { rand, randInt } from '../src/game/rng.js';

test('rand is deterministic per seed and in [0,1)', () => {
  const a = { seed: 42 }, b = { seed: 42 };
  const xs = Array.from({ length: 100 }, () => rand(a));
  const ys = Array.from({ length: 100 }, () => rand(b));
  expect(xs).toEqual(ys);
  expect(xs.every(x => x >= 0 && x < 1)).toBe(true);
});

test('randInt covers the whole range', () => {
  const r = { seed: 7 }; const seen = new Set();
  for (let i = 0; i < 500; i++) seen.add(randInt(r, 6));
  expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5]);
});
```

`tests/sprites.test.js`:
```js
import { test, expect } from 'bun:test';
import { parseGrid, bakeRGBA } from '../src/engine/sprites.js';
import { PALETTE, hexToRgb } from '../src/engine/palette.js';

test('parseGrid maps . to 0 and digits to slots', () => {
  const s = parseGrid(['.1', '23']);
  expect(s.w).toBe(2); expect(s.h).toBe(2);
  expect([...s.px]).toEqual([0, 1, 2, 3]);
});

test('parseGrid rejects ragged rows and bad chars', () => {
  expect(() => parseGrid(['..', '.'], 'x')).toThrow('sprite x');
  expect(() => parseGrid(['.4'], 'y')).toThrow('sprite y');
});

test('bakeRGBA colours pixels and supports flipX', () => {
  const s = parseGrid(['1.']);
  const red = PALETTE.indexOf('#F83800');
  const out = bakeRGBA(s, [red, 0, 0]);
  expect([...out.slice(0, 4)]).toEqual([...hexToRgb('#F83800'), 255]);
  expect(out[7]).toBe(0);                          // transparent
  const flipped = bakeRGBA(s, [red, 0, 0], true);
  expect(flipped[3]).toBe(0);
  expect(flipped[7]).toBe(255);
});

test('palette has 64 colours', () => {
  expect(PALETTE.length).toBe(64);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/rng.test.js tests/sprites.test.js`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/game/rng.js`:
```js
// mulberry32. State lives in plain data so sims can be cloned and replayed.
export function rand(rng) {
  let t = (rng.seed = (rng.seed + 0x6D2B79F5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(rng, n) {
  return Math.floor(rand(rng) * n);
}
```

`src/engine/palette.js`:
```js
// The common NES 2C02 palette, indexed $00-$3F.
export const PALETTE = [
  '#7C7C7C','#0000FC','#0000BC','#4428BC','#940084','#A80020','#A81000','#881400',
  '#503000','#007800','#006800','#005800','#004058','#000000','#000000','#000000',
  '#BCBCBC','#0078F8','#0058F8','#6844FC','#D800CC','#E40058','#F83800','#E45C10',
  '#AC7C00','#00B800','#00A800','#00A844','#008888','#000000','#000000','#000000',
  '#F8F8F8','#3CBCFC','#6888FC','#9878F8','#F878F8','#F85898','#F87858','#FCA044',
  '#F8B800','#B8F818','#58D854','#58F898','#00E8D8','#787878','#000000','#000000',
  '#FCFCFC','#A4E4FC','#B8B8F8','#D8B8F8','#F8B8F8','#F8A4C0','#F0D0B0','#FCE0A8',
  '#F8D878','#D8F878','#B8F8B8','#B8F8D8','#00FCFC','#F8D8F8','#000000','#000000',
];

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
```

`src/engine/sprites.js`:
```js
import { PALETTE, hexToRgb } from './palette.js';

const RGB = PALETTE.map(hexToRgb);

export function parseGrid(rows, name = '?') {
  const h = rows.length, w = rows[0].length;
  const px = new Uint8Array(w * h);
  rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`sprite ${name}: row ${y} has ${row.length} chars, expected ${w}`);
    for (let x = 0; x < w; x++) {
      const c = row[x];
      if (c === '.') continue;
      if (c < '1' || c > '3') throw new Error(`sprite ${name}: bad char '${c}' at ${x},${y}`);
      px[y * w + x] = c.charCodeAt(0) - 48;
    }
  });
  return { w, h, px };
}

export function bakeRGBA(sprite, pal, flipX = false) {
  const { w, h, px } = sprite;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = px[y * w + (flipX ? w - 1 - x : x)];
      if (!v) continue;
      const [r, g, b] = RGB[pal[v - 1]];
      const o = (y * w + x) * 4;
      out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255;
    }
  }
  return out;
}
```

- [ ] **Step 4: Run tests**

Run: `bun test` → Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: deterministic rng, NES palette, pixel-grid sprite decoder

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Fixed-timestep loop and input

**Files:**
- Create: `src/engine/loop.js`, `src/engine/input.js`
- Test: `tests/loop.test.js`, `tests/input.test.js`

**Interfaces:**
- Consumes: `BTN` from `src/game/consts.js`.
- Produces:
  - `STEP_MS = 1000/60`; `advance(acc: number, dtMs: number, maxSteps = 5): { acc, steps }`.
  - `startLoop({ step(): void, draw(): void, keepAliveHidden(): boolean })`. When the tab is hidden, rAF stops, so it falls back to a 50 ms `setInterval` that runs `step` (catching up via `advance`) whenever `keepAliveHidden()` is true.
  - `createInput(target = window): { read(): number, clear(): void }` returns the OR of keyboard and gamepad masks. It clears on `blur` and on `visibilitychange` to hidden.
  - `keyMask(code: string): number`; `gamepadMask(gp): number` (pure); `edges(prev, cur): { pressed, released }`.

- [ ] **Step 1: Write the failing tests**

`tests/loop.test.js`:
```js
import { test, expect } from 'bun:test';
import { advance, STEP_MS, startLoop } from '../src/engine/loop.js';

test('advance accumulates partial frames', () => {
  let r = advance(0, STEP_MS * 0.5);
  expect(r.steps).toBe(0);
  r = advance(r.acc, STEP_MS * 0.6);
  expect(r.steps).toBe(1);
  expect(r.acc).toBeCloseTo(STEP_MS * 0.1, 5);
});

test('advance caps catch-up after a long stall (no spiral of death)', () => {
  const r = advance(0, 10_000);
  expect(r.steps).toBe(5);
  expect(r.acc).toBe(0);
});

test('a hidden tab keeps stepping only when keepAliveHidden says so', () => {
  let now = 0, interval = null, steps = 0, alive = true;
  const g = globalThis;
  const saved = { raf: g.requestAnimationFrame, doc: g.document, si: g.setInterval, perf: g.performance };
  g.requestAnimationFrame = () => {};                 // hidden tabs get no animation frames
  g.document = { hidden: true };
  g.setInterval = (fn) => { interval = fn; return 1; };
  g.performance = { now: () => now };
  try {
    startLoop({ step: () => steps++, draw: () => {}, keepAliveHidden: () => alive });
    now += 51; interval();
    expect(steps).toBe(3);                           // 51 ms = 3 frames (50 ms is a hair under 3 * 1000/60)
    alive = false; now += 51; interval();
    expect(steps).toBe(3);
  } finally {
    Object.assign(g, { requestAnimationFrame: saved.raf, document: saved.doc, setInterval: saved.si, performance: saved.perf });
  }
});
```

`tests/input.test.js`:
```js
import { test, expect } from 'bun:test';
import { keyMask, gamepadMask, edges, createInput } from '../src/engine/input.js';
import { BTN } from '../src/game/consts.js';

test('keyboard map', () => {
  expect(keyMask('ArrowLeft')).toBe(BTN.LEFT);
  expect(keyMask('KeyZ')).toBe(BTN.A);
  expect(keyMask('Space')).toBe(BTN.A);
  expect(keyMask('KeyX')).toBe(BTN.B);
  expect(keyMask('Enter')).toBe(BTN.START);
  expect(keyMask('KeyQ')).toBe(0);
});

test('gamepad standard mapping with stick deadzone', () => {
  const b = (i) => Array.from({ length: 17 }, (_, k) => ({ pressed: k === i }));
  expect(gamepadMask({ buttons: b(0), axes: [0, 0] })).toBe(BTN.A);
  expect(gamepadMask({ buttons: b(2), axes: [0, 0] })).toBe(BTN.B);
  expect(gamepadMask({ buttons: b(9), axes: [0, 0] })).toBe(BTN.START);
  expect(gamepadMask({ buttons: b(-1), axes: [-0.9, 0.2] })).toBe(BTN.LEFT);
  expect(gamepadMask({ buttons: b(-1), axes: [0.3, 0.8] })).toBe(BTN.DOWN);
});

test('edges reports presses and releases', () => {
  const e = edges(BTN.A | BTN.LEFT, BTN.A | BTN.B);
  expect(e.pressed).toBe(BTN.B);
  expect(e.released).toBe(BTN.LEFT);
});

test('held keys are cleared when the window loses focus', () => {
  const handlers = {};
  const target = { addEventListener: (t, f) => { handlers[t] = f; } };
  const input = createInput(target, () => []);
  handlers.keydown({ code: 'ArrowRight', preventDefault() {} });
  handlers.keydown({ code: 'KeyX', preventDefault() {} });
  expect(input.read()).toBe(BTN.RIGHT | BTN.B);
  handlers.blur();
  expect(input.read()).toBe(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/loop.test.js tests/input.test.js` → Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/engine/loop.js`:
```js
export const STEP_MS = 1000 / 60;

export function advance(acc, dtMs, maxSteps = 5) {
  acc += Math.min(Math.max(dtMs, 0), 1000);
  let steps = Math.floor(acc / STEP_MS);
  if (steps > maxSteps) { steps = maxSteps; acc = 0; }
  else acc -= steps * STEP_MS;
  return { acc, steps };
}

export function startLoop({ step, draw, keepAliveHidden = () => false }) {
  let acc = 0, last = performance.now();
  const tick = (now) => {
    const r = advance(acc, now - last);
    acc = r.acc; last = now;
    for (let i = 0; i < r.steps; i++) step();
    return r.steps;
  };
  const frame = (now) => { tick(now); draw(); requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
  // rAF stops in hidden tabs; a host must keep simulating for its guest.
  setInterval(() => {
    if (document.hidden && keepAliveHidden()) tick(performance.now());
  }, 50);
}
```

`src/engine/input.js`:
```js
import { BTN } from '../game/consts.js';

const KEYS = {
  ArrowLeft: BTN.LEFT, ArrowRight: BTN.RIGHT, ArrowUp: BTN.UP, ArrowDown: BTN.DOWN,
  KeyZ: BTN.A, Space: BTN.A, KeyX: BTN.B,
  Enter: BTN.START, ShiftLeft: BTN.SELECT, ShiftRight: BTN.SELECT,
};

export function keyMask(code) { return KEYS[code] || 0; }

export function gamepadMask(gp) {
  if (!gp) return 0;
  const on = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
  const [ax = 0, ay = 0] = gp.axes;
  let m = 0;
  if (on(0)) m |= BTN.A;
  if (on(1) || on(2) || on(3)) m |= BTN.B;
  if (on(9)) m |= BTN.START;
  if (on(8)) m |= BTN.SELECT;
  if (on(12) || ay < -0.5) m |= BTN.UP;
  if (on(13) || ay > 0.5) m |= BTN.DOWN;
  if (on(14) || ax < -0.5) m |= BTN.LEFT;
  if (on(15) || ax > 0.5) m |= BTN.RIGHT;
  return m;
}

export function edges(prev, cur) {
  return { pressed: cur & ~prev, released: prev & ~cur };
}

export function createInput(target = window, getPads = () => (navigator.getGamepads ? navigator.getGamepads() : [])) {
  let keys = 0;
  target.addEventListener('keydown', (e) => {
    const m = keyMask(e.code);
    if (m) { keys |= m; e.preventDefault(); }
  });
  target.addEventListener('keyup', (e) => { keys &= ~keyMask(e.code); });
  const clear = () => { keys = 0; };
  target.addEventListener('blur', clear);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); });
  }
  return {
    read() {
      let m = keys;
      for (const gp of getPads()) m |= gamepadMask(gp);
      return m;
    },
    clear,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `bun test` → Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: fixed-timestep loop and keyboard/gamepad input

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 4: Tiles and level parsing

**Files:**
- Create: `src/game/tiles.js`, `src/game/level.js`, `tests/helpers.js`
- Test: `tests/level.test.js`

**Interfaces:**
- Consumes: `TS` from consts.
- Produces:
  - `T` (tile id enum), `LEGEND` (char → tile id), `INFO[id]` → `{ solid, semi, slope, hidden, bump, breakable, coin, deadly, note, pipe }`, `slopeTop(id, lx): number` (px from tile top to the surface at local x 0..15).
  - `ENTITY_CHARS` (char → entity type string).
  - `parseLevel(def): Level` where `Level = { id, theme, music, time, w, h, tiles: Uint8Array, spawns: [{ i, type, tx, ty }], start: { tx, ty }, pipes, tileLog: [] }`.
  - `tileAt(lv, tx, ty): id`. Out of range left/right is `T.HARD` (level edges are walls). Above the top or below the bottom is `T.EMPTY`.
  - `setTile(lv, tx, ty, id)` writes the tile and appends `{ tx, ty, id }` to `lv.tileLog`, which is replayed to guests.
  - Test helper `lvl(map: string, extra = {})` in `tests/helpers.js`.

**Level def format** (used by every level file):
```js
{
  id: '1-1', theme: 'overworld', music: 'overworld', time: 300,
  start: [2, 11],                 // tile whose bottom edge the player's feet rest on
  pipes: [],                      // filled in Task 12
  map: String.raw`
....................
..??M?..............
....................
####################`,
}
```
`map` rows are padded on the right with `.` to the longest row. A leading and trailing blank line is ignored. Uppercase letters and symbols are tiles. Lowercase letters are entity spawn points (the tile there is empty).

**Tile legend:**

| char | tile | notes |
|---|---|---|
| `.` | EMPTY | |
| `#` | GROUND | solid; look depends on theme |
| `B` | BRICK | breaks if big, bumps if small |
| `V` | BRICK_COINS | brick giving up to 10 coins, then used |
| `P` | BRICK_PSWITCH | brick that releases a P-switch |
| `?` | Q_COIN | ? block with a coin |
| `M` | Q_POWER | ? block: Berry if small, else Fire Blossom |
| `L` | Q_LEAF | ? block: Berry if small, else Glide Leaf |
| `U` | Q_1UP | ? block with 1-Up Berry |
| `S` | Q_STAR | ? block with Star |
| `H` | HIDDEN_1UP | invisible; solid only when hit from below |
| `C` | COIN | collectible coin |
| `N` | NOTE | music block, bounces |
| `X` | USED | hard block (also what a used ? block becomes) |
| `W` | WOOD | solid wood block |
| `=` | SEMI | stand on from above, pass from below and sides |
| `O` | CLOUD | semi-solid cloud |
| `[` `]` | PIPE_TL / PIPE_TR | pipe mouth (solid) |
| `{` `}` | PIPE_L / PIPE_R | pipe body (solid) |
| `/` | SLOPE45_UP | rises to the right |
| `\` | SLOPE45_DN | falls to the right |
| `1` `2` | GENTLE_UP_LO / _HI | 22.5° rising, two tiles |
| `3` `4` | GENTLE_DN_HI / _LO | 22.5° falling, two tiles |
| `~` | LAVA | deadly |
| `K` | CANNON | solid; fires Boom Bolts (Task 11) |
| `G` | GOAL | goal roulette box (Task 12) |
| `D` | DOOR | door (Task 12) |

**Entity chars:** `c` chompkin, `p` parachompkin, `g` shellback_green, `r` shellback_red, `f` shellback_winged, `s` snapvine, `v` firesnapvine, `y` spikebug, `b` bumblebeetle, `d` boneshell, `e` ember, `o` rotodisc, `m` lift_h, `n` lift_v, `z` bonebrute, `q` grimling.

- [ ] **Step 1: Write the failing test**

`tests/helpers.js`:
```js
import { parseLevel } from '../src/game/level.js';
export const lvl = (map, extra = {}) => parseLevel({ id: 't', theme: 'overworld', time: 300, start: [1, 1], map, ...extra });
```

`tests/level.test.js`:
```js
import { test, expect } from 'bun:test';
import { lvl } from './helpers.js';
import { tileAt, setTile } from '../src/game/level.js';
import { T, INFO, slopeTop } from '../src/game/tiles.js';

test('parses tiles, pads rows, extracts spawns', () => {
  const lv = lvl(String.raw`
..c.
?B
####`);
  expect(lv.w).toBe(4); expect(lv.h).toBe(3);
  expect(tileAt(lv, 0, 1)).toBe(T.Q_COIN);
  expect(tileAt(lv, 1, 1)).toBe(T.BRICK);
  expect(tileAt(lv, 3, 1)).toBe(T.EMPTY);
  expect(tileAt(lv, 2, 0)).toBe(T.EMPTY);
  expect(lv.spawns).toEqual([{ i: 0, type: 'chompkin', tx: 2, ty: 0 }]);
});

test('edges are walls, top and bottom are open', () => {
  const lv = lvl('##');
  expect(tileAt(lv, -1, 0)).toBe(T.HARD);
  expect(tileAt(lv, 2, 0)).toBe(T.HARD);
  expect(tileAt(lv, 0, -1)).toBe(T.EMPTY);
  expect(tileAt(lv, 0, 5)).toBe(T.EMPTY);
});

test('unknown characters are rejected with position', () => {
  expect(() => lvl('#&#')).toThrow("level t: unknown char '&' at 1,0");
});

test('setTile logs changes for the network', () => {
  const lv = lvl('B.');
  setTile(lv, 0, 0, T.EMPTY);
  expect(tileAt(lv, 0, 0)).toBe(T.EMPTY);
  expect(lv.tileLog).toEqual([{ tx: 0, ty: 0, id: T.EMPTY }]);
});

test('slope surfaces', () => {
  expect(slopeTop(T.SLOPE45_UP, 0)).toBe(15);
  expect(slopeTop(T.SLOPE45_UP, 15)).toBe(0);
  expect(slopeTop(T.SLOPE45_DN, 0)).toBe(0);
  expect(slopeTop(T.GENTLE_UP_LO, 0)).toBe(15);
  expect(slopeTop(T.GENTLE_UP_HI, 15)).toBe(0);
  expect(INFO[T.SEMI].semi).toBe(true);
  expect(INFO[T.SEMI].solid).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/level.test.js` → Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`src/game/tiles.js`:
```js
const NAMES = [
  'EMPTY', 'GROUND', 'BRICK', 'BRICK_COINS', 'BRICK_PSWITCH', 'Q_COIN', 'Q_POWER', 'Q_LEAF',
  'Q_1UP', 'Q_STAR', 'HIDDEN_1UP', 'COIN', 'NOTE', 'USED', 'WOOD', 'SEMI', 'CLOUD',
  'PIPE_TL', 'PIPE_TR', 'PIPE_L', 'PIPE_R', 'SLOPE45_UP', 'SLOPE45_DN',
  'GENTLE_UP_LO', 'GENTLE_UP_HI', 'GENTLE_DN_HI', 'GENTLE_DN_LO', 'LAVA', 'CANNON',
  'GOAL', 'DOOR', 'HARD', 'PSWITCH_COIN',
];
export const T = Object.fromEntries(NAMES.map((n, i) => [n, i]));

export const LEGEND = {
  '.': T.EMPTY, '#': T.GROUND, 'B': T.BRICK, 'V': T.BRICK_COINS, 'P': T.BRICK_PSWITCH,
  '?': T.Q_COIN, 'M': T.Q_POWER, 'L': T.Q_LEAF, 'U': T.Q_1UP, 'S': T.Q_STAR,
  'H': T.HIDDEN_1UP, 'C': T.COIN, 'N': T.NOTE, 'X': T.USED, 'W': T.WOOD,
  '=': T.SEMI, 'O': T.CLOUD, '[': T.PIPE_TL, ']': T.PIPE_TR, '{': T.PIPE_L, '}': T.PIPE_R,
  '/': T.SLOPE45_UP, '\\': T.SLOPE45_DN, '1': T.GENTLE_UP_LO, '2': T.GENTLE_UP_HI,
  '3': T.GENTLE_DN_HI, '4': T.GENTLE_DN_LO, '~': T.LAVA, 'K': T.CANNON, 'G': T.GOAL, 'D': T.DOOR,
};

export const ENTITY_CHARS = {
  c: 'chompkin', p: 'parachompkin', g: 'shellback_green', r: 'shellback_red',
  f: 'shellback_winged', s: 'snapvine', v: 'firesnapvine', y: 'spikebug',
  b: 'bumblebeetle', d: 'boneshell', e: 'ember', o: 'rotodisc', m: 'lift_h', n: 'lift_v',
  z: 'bonebrute', q: 'grimling',
};

const base = { solid: false, semi: false, slope: false, hidden: false, bump: null, breakable: false, coin: false, deadly: false, note: false, pipe: false };
const solid = (extra = {}) => ({ ...base, solid: true, ...extra });
export const INFO = NAMES.map(() => base);
Object.assign(INFO, {
  [T.GROUND]: solid(), [T.USED]: solid(), [T.WOOD]: solid(), [T.HARD]: solid(), [T.CANNON]: solid(),
  [T.BRICK]: solid({ breakable: true }),
  [T.BRICK_COINS]: solid({ bump: 'multicoin' }),
  [T.BRICK_PSWITCH]: solid({ bump: 'pswitch' }),
  [T.Q_COIN]: solid({ bump: 'coin' }), [T.Q_POWER]: solid({ bump: 'power' }),
  [T.Q_LEAF]: solid({ bump: 'leaf' }), [T.Q_1UP]: solid({ bump: '1up' }), [T.Q_STAR]: solid({ bump: 'star' }),
  [T.HIDDEN_1UP]: { ...base, hidden: true, bump: '1up' },
  [T.COIN]: { ...base, coin: true }, [T.PSWITCH_COIN]: { ...base, coin: true },
  [T.NOTE]: solid({ note: true }),
  [T.SEMI]: { ...base, semi: true }, [T.CLOUD]: { ...base, semi: true },
  [T.PIPE_TL]: solid({ pipe: true }), [T.PIPE_TR]: solid({ pipe: true }),
  [T.PIPE_L]: solid({ pipe: true }), [T.PIPE_R]: solid({ pipe: true }),
  [T.SLOPE45_UP]: { ...base, slope: true }, [T.SLOPE45_DN]: { ...base, slope: true },
  [T.GENTLE_UP_LO]: { ...base, slope: true }, [T.GENTLE_UP_HI]: { ...base, slope: true },
  [T.GENTLE_DN_HI]: { ...base, slope: true }, [T.GENTLE_DN_LO]: { ...base, slope: true },
  [T.LAVA]: { ...base, deadly: true },
});

// Pixels from the tile's top edge down to the walkable surface at local x (0..15).
export function slopeTop(id, lx) {
  switch (id) {
    case T.SLOPE45_UP: return 15 - lx;
    case T.SLOPE45_DN: return lx;
    case T.GENTLE_UP_LO: return 15 - (lx >> 1);
    case T.GENTLE_UP_HI: return 7 - (lx >> 1);
    case T.GENTLE_DN_HI: return lx >> 1;
    case T.GENTLE_DN_LO: return 8 + (lx >> 1);
    default: return 0;
  }
}

// -1 if the slope goes down to the left, +1 if down to the right.
export function slopeDownDir(id) {
  if (id === T.SLOPE45_UP || id === T.GENTLE_UP_LO || id === T.GENTLE_UP_HI) return -1;
  if (id === T.SLOPE45_DN || id === T.GENTLE_DN_HI || id === T.GENTLE_DN_LO) return 1;
  return 0;
}
```

`src/game/level.js`:
```js
import { T, LEGEND, ENTITY_CHARS } from './tiles.js';

export function parseLevel(def) {
  const rows = def.map.split('\n');
  if (rows[0].trim() === '') rows.shift();
  if (rows.length && rows[rows.length - 1].trim() === '') rows.pop();
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const tiles = new Uint8Array(w * h);
  const spawns = [];
  rows.forEach((row, ty) => {
    for (let tx = 0; tx < w; tx++) {
      const c = row[tx] ?? '.';
      if (c in LEGEND) tiles[ty * w + tx] = LEGEND[c];
      else if (c in ENTITY_CHARS) spawns.push({ i: spawns.length, type: ENTITY_CHARS[c], tx, ty });
      else throw new Error(`level ${def.id}: unknown char '${c}' at ${tx},${ty}`);
    }
  });
  const [stx, sty] = def.start || [1, h - 2];
  return {
    id: def.id, theme: def.theme || 'overworld', music: def.music || def.theme || 'overworld',
    time: def.time ?? 300, w, h, tiles, spawns, start: { tx: stx, ty: sty },
    pipes: def.pipes || [], tileLog: [],
  };
}

export function tileAt(lv, tx, ty) {
  if (tx < 0 || tx >= lv.w) return T.HARD;
  if (ty < 0 || ty >= lv.h) return T.EMPTY;
  return lv.tiles[ty * lv.w + tx];
}

export function setTile(lv, tx, ty, id) {
  if (tx < 0 || tx >= lv.w || ty < 0 || ty >= lv.h) return;
  lv.tiles[ty * lv.w + tx] = id;
  lv.tileLog.push({ tx, ty, id });
}
```

- [ ] **Step 4: Run tests**

Run: `bun test` → Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: tile legend and text-grid level parser

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Body vs tile collision (walls, ceilings, semi-solids, slopes)

**Files:**
- Create: `src/game/physics.js`
- Test: `tests/physics.test.js`

**Interfaces:**
- Consumes: `tileAt`, `INFO`, `slopeTop`, `TS`, `SUB`.
- Produces: `moveBody(b, lv): { wall: -1|0|1, ceiling: {tx,ty}|null, landed: boolean, slope: tileId|0 }`. `b` is any object with `{ x, y, w, h, vx, vy, onGround }`: x,y are the top-left corner in subpixels, w,h are in pixels, and velocities are in subpixels per frame. It mutates `b`. Also `overlaps(a, b): boolean` for two bodies.

**Rules:**
- Move X first, then Y.
- Walls are `solid && !slope` tiles. While `onGround`, the bottom 8 px of the body are ignored for walls. This step tolerance lets bodies cross the seam where a slope meets a ground tile.
- Ceilings are walls, plus `hidden` tiles when the body's top was below the tile before the move. The reported ceiling tile is the one under the body's centre if solid, otherwise the other overlapped one.
- Floors: flat `solid` or `semi` tile tops crossed this frame, or slope surfaces sampled at the body's centre x. A body that was on the ground also snaps down by up to 8 px, so it stays glued while walking down slopes. It snaps up by up to 8 px only onto slopes.

- [ ] **Step 1: Write the failing test**

`tests/physics.test.js`:
```js
import { test, expect } from 'bun:test';
import { lvl } from './helpers.js';
import { moveBody } from '../src/game/physics.js';
import { TS, SUB } from '../src/game/consts.js';

const body = (px, py, w = 12, h = 15) => ({ x: px * SUB, y: py * SUB, w, h, vx: 0, vy: 0, onGround: false });
const run = (b, lv, n, fn = () => {}) => { let r; for (let i = 0; i < n; i++) { fn(b); r = moveBody(b, lv); } return r; };
const gravity = (b) => { b.vy = Math.min(b.vy + 5, 64); };

test('falls and lands on ground', () => {
  const lv = lvl(String.raw`
....
....
####`);
  const b = body(2, 0);
  run(b, lv, 60, gravity);
  expect(b.onGround).toBe(true);
  expect(b.y + b.h * SUB).toBe(2 * TS);
});

test('walls stop horizontal motion', () => {
  const lv = lvl(String.raw`
...#
...#
####`);
  const b = body(4, 17); b.onGround = true;
  run(b, lv, 60, (b) => { b.vx = 24; gravity(b); });
  expect(b.x + b.w * SUB).toBe(3 * TS);
});

test('ceiling stops a jump and reports the block', () => {
  const lv = lvl(String.raw`
.?..
....
....
####`);
  const b = body(18, 33); b.vy = -64;
  const r = moveBody(b, lv);
  expect(r.ceiling).toEqual({ tx: 1, ty: 0 });
  expect(b.y).toBe(TS);
  expect(b.vy).toBe(0);
});

test('semi-solid: pass through from below, land from above', () => {
  const lv = lvl(String.raw`
....
====
....
....
####`);
  const b = body(18, 60); b.vy = -48;
  run(b, lv, 4);
  expect(b.y).toBeLessThan(TS + 4 * SUB * 4);          // went up through the platform row
  const c = body(18, 0);
  run(c, lv, 60, gravity);
  expect(c.onGround).toBe(true);
  expect(c.y + c.h * SUB).toBe(TS);                    // standing on the semi-solid
});

test('hidden block is solid only from below', () => {
  const lv = lvl(String.raw`
.H..
....
####`);
  const b = body(18, 20); b.vy = -48;
  const r = moveBody(b, lv);
  expect(r.ceiling).toEqual({ tx: 1, ty: 0 });
  const c = body(18, -20);
  run(c, lv, 30, gravity);
  expect(c.y + c.h * SUB).toBe(2 * TS);                // fell through it from above
});

test('walks up and down a 45 degree hill without leaving the ground', () => {
  const hill = lvl(String.raw`
........
.../\...
../##\..
########`);
  const b = body(2, 3 * 16 - 15); b.onGround = true;
  let airborne = 0;
  run(b, hill, 80, (b) => { b.vx = 16; gravity(b); if (!b.onGround) airborne++; });
  expect(airborne).toBe(0);
  expect(b.x).toBeGreaterThan(6 * TS);
});

test('gentle slope surface is sampled at the body centre', () => {
  const lv = lvl(String.raw`
......
..12##
######`);
  const b = body(2 * 16 + 2, 0);
  run(b, lv, 60, gravity);
  // centre x = 2*16+2+6 = 40px -> tile 2, lx 8 -> surface 15 - 4 = 11px below row 1 top
  expect(b.y + b.h * SUB).toBe((16 + 11) * SUB);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/physics.test.js` → Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`src/game/physics.js`:
```js
import { TS, SUB } from './consts.js';
import { tileAt } from './level.js';
import { INFO, slopeTop } from './tiles.js';

const STEP = 8 * SUB;
const isWall = (id) => INFO[id].solid && !INFO[id].slope;

export function overlaps(a, b) {
  return a.x < b.x + b.w * SUB && b.x < a.x + a.w * SUB && a.y < b.y + b.h * SUB && b.y < a.y + a.h * SUB;
}

export function moveBody(b, lv) {
  const res = { wall: 0, ceiling: null, landed: false, slope: 0 };
  const W = b.w * SUB, H = b.h * SUB;
  const wasGround = b.onGround;

  // Horizontal
  if (b.vx !== 0) {
    b.x += b.vx;
    const ty0 = Math.floor(b.y / TS);
    const ty1 = Math.floor((b.y + H - 1 - (wasGround ? STEP : 0)) / TS);
    const dir = Math.sign(b.vx);
    const tx = Math.floor((dir > 0 ? b.x + W - 1 : b.x) / TS);
    for (let ty = ty0; ty <= ty1; ty++) {
      if (isWall(tileAt(lv, tx, ty))) {
        b.x = dir > 0 ? tx * TS - W : (tx + 1) * TS;
        b.vx = 0;
        res.wall = dir;
        break;
      }
    }
  }

  // Vertical
  const prevY = b.y;
  b.y += b.vy;
  const x0 = Math.floor((b.x + SUB) / TS), x1 = Math.floor((b.x + W - 1 - SUB) / TS);
  const cx = b.x + (W >> 1), ctx = Math.floor(cx / TS);

  if (b.vy < 0) {
    const ty = Math.floor(b.y / TS);
    let hit = null;
    for (let tx = x0; tx <= x1; tx++) {
      const id = tileAt(lv, tx, ty);
      const blocks = isWall(id) || (INFO[id].hidden && prevY >= (ty + 1) * TS);
      if (blocks && (!hit || tx === ctx)) hit = { tx, ty };
    }
    if (hit) { b.y = (hit.ty + 1) * TS; b.vy = 0; res.ceiling = hit; }
    b.onGround = false;
    return res;
  }

  const foot = b.y + H, prevFoot = prevY + H;
  const reach = foot + (wasGround ? STEP : 0);
  let surface = Infinity, slopeId = 0;

  // Flat tops crossed this frame (or within snap reach)
  for (let ty = Math.ceil(prevFoot / TS); ty <= Math.floor(reach / TS); ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const id = tileAt(lv, tx, ty);
      const info = INFO[id];
      if ((info.solid && !info.slope) || info.semi) {
        const top = ty * TS;
        if (top >= prevFoot && top < surface) { surface = top; slopeId = 0; }
      }
    }
  }
  // Slopes under the centre
  const lx = Math.floor((cx - ctx * TS) / SUB);
  for (let ty = Math.floor((prevFoot - STEP) / TS); ty <= Math.floor(reach / TS); ty++) {
    const id = tileAt(lv, ctx, ty);
    if (!INFO[id].slope) continue;
    const s = ty * TS + slopeTop(id, lx) * SUB;
    if (s >= prevFoot - (wasGround ? STEP : 0) && s <= reach && s <= surface) { surface = s; slopeId = id; }
  }

  if (surface <= reach) {
    b.y = surface - H;
    b.vy = 0;
    res.landed = !wasGround;
    res.slope = slopeId;
    b.onGround = true;
  } else {
    b.onGround = false;
  }
  return res;
}
```

The flat-tops loop only accepts `top >= prevFoot`, so a body never snaps up onto a flat tile. That is the "snap up only onto slopes" rule.

- [ ] **Step 4: Run tests**

Run: `bun test tests/physics.test.js` → Expected: all pass. If the hill test fails at the slope seam, print `b.x, b.y, b.onGround` per frame and check the seam against the STEP tolerance before changing anything else.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: tile collision with semi-solids, hidden blocks and slopes

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Player movement (walk, run, P-meter, jump, skid, crouch, slide)

**Files:**
- Create: `src/game/player.js`
- Test: `tests/player.test.js`

**Interfaces:**
- Consumes: `moveBody`, `BTN`, `TS`, `SUB`, `slopeDownDir`.
- Produces:
  - `PHYS` constants object (below). Tests pin these values.
  - `createPlayer(idx, tx, ty, form = 'small'): Player`; `placeAt(p, tx, ty)`; `setForm(p, form)`; `isBig(form)`.
  - `updatePlayer(p, buttons, lv, out)` where `out = { events: [], bumps: [] }`. It pushes `{ e: 'sfx', id }` to events and `{ tx, ty, by: p.idx, big }` to bumps.
  - Player fields used later: `idx, form, x, y, w, h, vx, vy, dir, onGround, crouch, sliding, pmeter (0..7), flyTimer, floatTimer, tailTimer, fireCooldown, hurtTimer, starTimer, growTimer, kickTimer, carry (-1 or entity id), dead, deathTimer, respawnTimer, finished, anim, animT, prev, lastSlope`.

```js
export const PHYS = {
  WALK_MAX: 24, RUN_MAX: 40, P_MAX: 48,   // 1.5 / 2.5 / 3.0 px per frame
  ACCEL: 1, SKID: 3, AIR_TURN: 2, FRICTION: 1,
  GRAV: 5, GRAV_HOLD: 1, HOLD_UNTIL: -32, FALL_MAX: 64,
  JUMP_STAND: 56, JUMP_RUN: 60, JUMP_P: 64,
  P_STEP: 8, P_DRAIN: 24, SLIDE_ACCEL: 2,
};
```

- [ ] **Step 1: Write the failing test**

`tests/player.test.js`:
```js
import { test, expect } from 'bun:test';
import { lvl } from './helpers.js';
import { createPlayer, updatePlayer, PHYS } from '../src/game/player.js';
import { BTN, TS, SUB } from '../src/game/consts.js';

const flat = () => lvl(String.raw`
${'.'.repeat(200)}
${'.'.repeat(200)}
${'.'.repeat(200)}
${'.'.repeat(200)}
${'.'.repeat(200)}
${'.'.repeat(200)}
${'.'.repeat(200)}
${'#'.repeat(200)}`);
const out = () => ({ events: [], bumps: [] });
const steps = (p, lv, n, buttons) => { for (let i = 0; i < n; i++) updatePlayer(p, typeof buttons === 'function' ? buttons(i) : buttons, lv, out()); };

test('idle player stays grounded', () => {
  const lv = flat(); const p = createPlayer(0, 2, 6);
  steps(p, lv, 60, 0);
  expect(p.onGround).toBe(true);
  expect(p.y + p.h * SUB).toBe(7 * TS);
});

test('walk caps at WALK_MAX, run at RUN_MAX, full P-meter reaches P_MAX', () => {
  const lv = flat(); const p = createPlayer(0, 2, 6);
  steps(p, lv, 60, BTN.RIGHT);
  expect(p.vx).toBe(PHYS.WALK_MAX);
  steps(p, lv, 30, BTN.RIGHT | BTN.B);
  expect(p.vx).toBe(PHYS.RUN_MAX);
  steps(p, lv, 70, BTN.RIGHT | BTN.B);
  expect(p.pmeter).toBe(7);
  expect(p.vx).toBe(PHYS.P_MAX);
});

test('P-meter drains after you stop running', () => {
  const lv = flat(); const p = createPlayer(0, 2, 6);
  steps(p, lv, 140, BTN.RIGHT | BTN.B);
  steps(p, lv, 7 * PHYS.P_DRAIN + 5, 0);
  expect(p.pmeter).toBe(0);
});

test('held jump from standstill rises 4-5 tiles; a tap only ~1 tile', () => {
  const lv = flat();
  const p = createPlayer(0, 2, 6); const ground = p.y;
  let top = p.y;
  steps(p, lv, 80, (i) => { top = Math.min(top, p.y); return BTN.A; });
  const held = (ground - top) / SUB;
  expect(held).toBeGreaterThan(64); expect(held).toBeLessThan(80);

  const q = createPlayer(0, 2, 6); top = q.y;
  steps(q, lv, 80, (i) => { top = Math.min(top, q.y); return i === 0 ? BTN.A : 0; });
  const tap = (ground - top) / SUB;
  expect(tap).toBeGreaterThan(14); expect(tap).toBeLessThan(26);
});

test('running jumps go higher', () => {
  const lv = flat();
  const p = createPlayer(0, 2, 6);
  steps(p, lv, 140, BTN.RIGHT | BTN.B);
  const ground = p.y; let top = p.y;
  steps(p, lv, 80, () => { top = Math.min(top, p.y); return BTN.RIGHT | BTN.B | BTN.A; });
  expect((ground - top) / SUB).toBeGreaterThan(90);
});

test('reversing on the ground skids', () => {
  const lv = flat(); const p = createPlayer(0, 2, 6);
  steps(p, lv, 60, BTN.RIGHT | BTN.B);
  const v = p.vx;
  updatePlayer(p, BTN.LEFT, lv, out());
  expect(p.vx).toBe(v - PHYS.SKID);
  expect(p.anim).toBe('skid');
});

test('releasing the stick applies friction to a stop', () => {
  const lv = flat(); const p = createPlayer(0, 2, 6);
  steps(p, lv, 30, BTN.RIGHT);
  steps(p, lv, 40, 0);
  expect(p.vx).toBe(0);
  expect(p.anim).toBe('stand');
});

test('big player crouches: shorter hitbox and no acceleration', () => {
  const lv = flat(); const p = createPlayer(0, 2, 6, 'big');
  expect(p.h).toBe(26);
  steps(p, lv, 10, BTN.DOWN | BTN.RIGHT);
  expect(p.crouch).toBe(true);
  expect(p.h).toBe(15);
  expect(p.vx).toBe(0);
  steps(p, lv, 2, 0);
  expect(p.h).toBe(26);
  expect(p.y + p.h * SUB).toBe(7 * TS);
});

test('small player cannot crouch', () => {
  const lv = flat(); const p = createPlayer(0, 2, 6);
  steps(p, lv, 5, BTN.DOWN);
  expect(p.crouch).toBe(false);
});

test('jumping into a block reports a bump', () => {
  const lv = lvl(String.raw`
.....
..?..
.....
.....
#####`);
  const p = createPlayer(0, 2, 3);
  const o = out();
  for (let i = 0; i < 30 && !o.bumps.length; i++) updatePlayer(p, BTN.A, lv, o);
  expect(o.bumps).toEqual([{ tx: 2, ty: 1, by: 0, big: false }]);
});

test('pressing down on a slope slides downhill', () => {
  const lv = lvl(String.raw`
.......
.......
...../#
..../##
#######`);
  const p = createPlayer(0, 5, 1);
  steps(p, lv, 30, 0);                  // settle onto the slope
  steps(p, lv, 20, BTN.DOWN);
  expect(p.sliding).toBe(true);
  expect(p.vx).toBeLessThan(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/player.test.js` → Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`src/game/player.js`:
```js
import { BTN, TS, SUB } from './consts.js';
import { moveBody } from './physics.js';
import { slopeDownDir } from './tiles.js';

export const PHYS = {
  WALK_MAX: 24, RUN_MAX: 40, P_MAX: 48,
  ACCEL: 1, SKID: 3, AIR_TURN: 2, FRICTION: 1,
  GRAV: 5, GRAV_HOLD: 1, HOLD_UNTIL: -32, FALL_MAX: 64,
  JUMP_STAND: 56, JUMP_RUN: 60, JUMP_P: 64,
  P_STEP: 8, P_DRAIN: 24, SLIDE_ACCEL: 2,
};

const SMALL_H = 15, BIG_H = 26, WIDTH = 12;

export const isBig = (form) => form !== 'small';

export function createPlayer(idx, tx, ty, form = 'small') {
  const p = {
    idx, form, x: 0, y: 0, w: WIDTH, h: SMALL_H, vx: 0, vy: 0, dir: 1, onGround: false,
    crouch: false, sliding: false, pmeter: 0, pTimer: 0, pRunning: false,
    flyTimer: 0, floatTimer: 0, tailTimer: 0, fireCooldown: 0, hurtTimer: 0, starTimer: 0,
    growTimer: 0, kickTimer: 0, carry: -1, dead: false, deathTimer: 0, respawnTimer: 0,
    finished: false, anim: 'stand', animT: 0, prev: 0, lastSlope: 0, skid: false, combo: 0,
  };
  setForm(p, form);
  placeAt(p, tx, ty);
  return p;
}

export function placeAt(p, tx, ty) {
  p.x = tx * TS + ((TS - p.w * SUB) >> 1);
  p.y = (ty + 1) * TS - p.h * SUB;
  p.vx = 0; p.vy = 0; p.onGround = false;
}

function setHeight(p, h) {
  const foot = p.y + p.h * SUB;
  p.h = h;
  p.y = foot - h * SUB;
}

export function setForm(p, form) {
  p.form = form;
  setHeight(p, isBig(form) && !p.crouch ? BIG_H : SMALL_H);
}

export function updatePlayer(p, buttons, lv, out) {
  const pressed = buttons & ~p.prev;
  p.prev = buttons;
  if (p.dead || p.finished) return;
  if (p.growTimer > 0) { p.growTimer--; return; }
  for (const k of ['hurtTimer', 'starTimer', 'fireCooldown', 'tailTimer', 'kickTimer']) if (p[k] > 0) p[k]--;

  const L = buttons & BTN.LEFT, R = buttons & BTN.RIGHT;
  const run = buttons & BTN.B, holdA = buttons & BTN.A, down = buttons & BTN.DOWN;
  const want = R && !L ? 1 : L && !R ? -1 : 0;

  // Crouch and slide (ground only)
  if (p.onGround) {
    if (down && p.lastSlope && p.carry < 0) p.sliding = true;
    if (p.sliding && (want !== 0 || (!p.lastSlope && p.vx === 0))) p.sliding = false;
    const crouch = !p.sliding && !!down && isBig(p.form);
    if (crouch !== p.crouch) { p.crouch = crouch; setHeight(p, crouch || !isBig(p.form) ? SMALL_H : BIG_H); }
  }

  // Horizontal
  const max = run ? (p.pmeter === 7 ? PHYS.P_MAX : PHYS.RUN_MAX) : PHYS.WALK_MAX;
  p.skid = false;
  if (p.sliding) {
    const d = slopeDownDir(p.lastSlope);
    if (d) p.vx = Math.max(-PHYS.P_MAX, Math.min(PHYS.P_MAX, p.vx + d * PHYS.SLIDE_ACCEL));
    else p.vx -= Math.sign(p.vx) * PHYS.FRICTION;
  } else if (want && !(p.crouch && p.onGround)) {
    if (p.vx * want < 0) {
      p.vx += want * (p.onGround ? PHYS.SKID : PHYS.AIR_TURN);
      if (p.vx * want > 0) p.vx = 0;
      p.skid = p.onGround;
    } else if (Math.abs(p.vx) < max) {
      p.vx = want > 0 ? Math.min(p.vx + PHYS.ACCEL, max) : Math.max(p.vx - PHYS.ACCEL, -max);
    } else if (Math.abs(p.vx) > max && p.onGround) {
      p.vx -= Math.sign(p.vx) * PHYS.FRICTION;
    }
    p.dir = want;
  } else if (p.onGround) {
    const f = Math.min(Math.abs(p.vx), PHYS.FRICTION);
    p.vx -= Math.sign(p.vx) * f;
  }

  // P-meter: fills while running flat-out on the ground, drains otherwise.
  if (p.onGround && p.flyTimer === 0) {
    const running = !!run && want !== 0 && Math.abs(p.vx) >= PHYS.RUN_MAX;
    if (running !== p.pRunning) { p.pRunning = running; p.pTimer = 0; }
    p.pTimer++;
    if (running && p.pTimer >= PHYS.P_STEP) { p.pTimer = 0; if (p.pmeter < 7) p.pmeter++; }
    else if (!running && p.pTimer >= PHYS.P_DRAIN) { p.pTimer = 0; if (p.pmeter > 0) p.pmeter--; }
  }

  // Jump
  if ((pressed & BTN.A) && p.onGround) {
    const s = Math.abs(p.vx);
    p.vy = -(s >= PHYS.P_MAX ? PHYS.JUMP_P : s >= PHYS.RUN_MAX ? PHYS.JUMP_RUN : PHYS.JUMP_STAND);
    p.onGround = false;
    p.sliding = false;
    out.events.push({ e: 'sfx', id: 'jump' });
  }

  // Gravity
  p.vy += p.vy < PHYS.HOLD_UNTIL && holdA ? PHYS.GRAV_HOLD : PHYS.GRAV;
  if (p.vy > PHYS.FALL_MAX) p.vy = PHYS.FALL_MAX;

  const r = moveBody(p, lv);
  p.lastSlope = p.onGround ? r.slope : 0;
  if (r.ceiling) {
    out.bumps.push({ tx: r.ceiling.tx, ty: r.ceiling.ty, by: p.idx, big: isBig(p.form) });
    out.events.push({ e: 'sfx', id: 'bump' });
  }

  // Animation
  p.anim = !p.onGround ? (p.pmeter === 7 ? 'runjump' : 'jump')
    : p.crouch ? 'crouch' : p.sliding ? 'slide' : p.skid ? 'skid'
    : p.vx === 0 ? 'stand' : p.pmeter === 7 ? 'run' : 'walk';
  if (p.onGround) p.animT += Math.max(1, Math.abs(p.vx) >> 3);
}
```

- [ ] **Step 4: Run tests**

Run: `bun test` → Expected: all pass. If a jump-height test is out of range, report the measured value and adjust only the `PHYS` jump/gravity constants, keeping the tests' ranges as the source of truth.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: SMB3-style player movement with P-meter, skid, crouch, slide

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 7: Camera, entity registry and the level simulation core

**Files:**
- Create: `src/game/camera.js`, `src/game/powerups.js`, `src/game/sim.js`, `src/game/entities/index.js`, `src/game/entities/common.js`, `src/game/entities/effects.js`, `src/game/entities/all.js`
- Test: `tests/camera.test.js`, `tests/sim.test.js`

**Interfaces:**
- Consumes: everything from Tasks 4–6.
- Produces:
  - `createCamera(p, lv): {x, y}` and `updateCamera(cam, p, lv)`. Units are pixels. The horizontal dead zone keeps the player's centre between screen x 112 and 144. Vertically the camera is locked to the bottom unless the player is flying or near the top edge.
  - Entity registry: `TYPES`, `register(name, def)`, `spawnEntity(s, type, x, y, props): Entity`, `updateEntities(s)`, `killEntity(s, e)` (permanent, marks its spawn point used), `flipKill(s, e, pts)`.
    - Entity def shape: `{ init?(e, s), update(e, s), stomp?(e, s, p), touch?(e, s, p), hit?(e, s, kind, src) }`, where `kind` is one of `'bump' | 'shell' | 'fire' | 'tail' | 'star' | 'hammer'`.
    - Entity fields: `{ id, type, x, y, w, h, vx, vy, dir, onGround, state, t, spawn, dead, harmful, stompable, solidTop }`.
  - `addScore(s, pts, x, y)` and `addCoins(s, n)`. 100 coins gives +1 life.
  - From `entities/common.js`: `walk(e, s, speed, { turnAtLedges, grav })`, `nearestPlayer(s, e)`, `face(e, s)`, `playerContacts(s)` (stomp / touch / hurt / star resolution, run once per step after entities update), `bounce(p)`, `comboScore(s, p, e)`, `COMBO`, `markKilled(s, e)`.
  - Contact rules: a stomp is when the player is moving down (`vy > 0`) and the player's feet are within the top 10 px of the entity. Star power calls `hit(e, s, 'star', p)` on any harmful entity. Otherwise `touch` runs if defined, else a harmful entity hurts the player.
  - `killPlayer(s, p)` and `hurtPlayer(s, p)`. Damage ladder: special suit → big → small → death. Being hurt gives 120 frames of invulnerability and a 30-frame freeze. Both live in `powerups.js`.
  - `createLevelSim(def, { players = 1, forms = [], seed = 1, shared = { coins: 0, lives: 5, score: 0 } }): LevelState`
  - `stepLevel(s, inputs: number[])`. `s.mode` is one of `'play' | 'clear' | 'fail' | 'done'`. `s.clear = { by, card }` where card 0 is Berry, 1 is Blossom, 2 is Star.
  - `levelResult(s): { cleared, card, forms }`.
  - Constants `DEATH_FRAMES = 150`, `RESPAWN_FRAMES = 180`, `CLEAR_FRAMES = 240`, `TIME_TICK = 40`.

- [ ] **Step 1: Write the failing tests**

`tests/camera.test.js`:
```js
import { test, expect } from 'bun:test';
import { lvl } from './helpers.js';
import { createCamera, updateCamera } from '../src/game/camera.js';
import { SUB } from '../src/game/consts.js';

const wide = () => lvl(Array.from({ length: 14 }, (_, y) => (y === 13 ? '#' : '.').repeat(100)).join('\n'));

test('camera starts clamped to the level and follows past the dead zone', () => {
  const lv = wide();
  const p = { x: 40 * SUB, y: 180 * SUB, w: 12, h: 15, onGround: true, flyTimer: 0, dead: false };
  const c = createCamera(p, lv);
  expect(c.x).toBe(0);
  expect(c.y).toBe(14 * 16 - 200);
  p.x = 400 * SUB; updateCamera(c, p, lv);
  expect(c.x).toBe(400 + 6 - 144);
  p.x = 300 * SUB; updateCamera(c, p, lv);
  expect(c.x).toBe(300 + 6 - 112);
});

test('camera clamps at the right edge', () => {
  const lv = wide();
  const p = { x: 1595 * SUB, y: 180 * SUB, w: 12, h: 15, onGround: true, flyTimer: 0, dead: false };
  const c = createCamera(p, lv);
  expect(c.x).toBe(1600 - 256);
});
```

`tests/sim.test.js`:
```js
import { test, expect } from 'bun:test';
import { createLevelSim, stepLevel, levelResult, DEATH_FRAMES, RESPAWN_FRAMES, CLEAR_FRAMES, TIME_TICK } from '../src/game/sim.js';
import { tileAt } from '../src/game/level.js';
import { T } from '../src/game/tiles.js';
import { BTN, TS, SUB } from '../src/game/consts.js';

const def = (map, extra = {}) => ({ id: 't', theme: 'overworld', time: 300, start: [2, 5], map, ...extra });
const room = String.raw`
..........
..?B.C....
..........
..........
..........
..........
##########`;
const run = (s, n, inputs = []) => { for (let i = 0; i < n; i++) stepLevel(s, typeof inputs === 'function' ? inputs(i) : inputs); };

test('bumping a ? block gives a coin and uses the block', () => {
  const s = createLevelSim(def(room));
  run(s, 40, [BTN.A]);
  expect(tileAt(s.lv, 2, 1)).toBe(T.USED);
  expect(s.shared.coins).toBe(1);
  expect(s.shared.score).toBe(50);
});

test('small players bounce bricks, big players break them', () => {
  const small = createLevelSim(def(room, { start: [3, 5] }));
  run(small, 40, [BTN.A]);
  expect(tileAt(small.lv, 3, 1)).toBe(T.BRICK);
  const big = createLevelSim(def(room, { start: [3, 5] }), { forms: ['big'] });
  run(big, 40, [BTN.A]);
  expect(tileAt(big.lv, 3, 1)).toBe(T.EMPTY);
});

test('free coins are collected on touch and 100 coins give a life', () => {
  const s = createLevelSim(def(room, { start: [5, 1] }), { shared: { coins: 99, lives: 3, score: 0 } });
  run(s, 2);
  expect(tileAt(s.lv, 5, 1)).toBe(T.EMPTY);
  expect(s.shared.coins).toBe(0);
  expect(s.shared.lives).toBe(4);
});

const pit = String.raw`
..........
..........
..........
..........
..........
..........
###....###`;

test('solo: falling in a pit fails the level once', () => {
  const s = createLevelSim(def(pit, { start: [4, 5] }));
  run(s, 400);
  expect(s.mode).toBe('fail');
  expect(levelResult(s).cleared).toBe(false);
});

test('co-op: a dead player respawns next to the living partner', () => {
  const s = createLevelSim(def(pit, { start: [4, 5] }), { players: 2 });
  s.players[1].x = 1 * TS; // partner stands on solid ground at tile 1
  run(s, 60);
  expect(s.players[0].dead).toBe(true);
  expect(s.players[1].dead).toBe(false);
  run(s, RESPAWN_FRAMES);
  expect(s.players[0].dead).toBe(false);
  expect(s.players[0].form).toBe('small');
  expect(s.players[0].hurtTimer).toBeGreaterThan(0);
  expect(s.mode).toBe('play');
});

test('co-op: both dying on the same frame fails exactly once', () => {
  const s = createLevelSim(def(pit, { start: [4, 5] }), { players: 2 });
  run(s, 60);
  expect(s.players.every(p => p.dead)).toBe(true);
  run(s, DEATH_FRAMES + 10);
  expect(s.mode).toBe('fail');
  run(s, 100);
  expect(s.mode).toBe('fail');
});

test('co-op: if the partner reaches the goal, a later death does not fail the level', () => {
  const map = String.raw`
..........
..........
..........
..........
.......G..
.......G..
###....###`;
  const s = createLevelSim(def(map, { start: [4, 5] }), { players: 2 });
  s.players[1].x = 7 * TS;  // partner starts inside the goal column
  run(s, 2);
  expect(s.mode).toBe('clear');
  run(s, CLEAR_FRAMES + 5);
  expect(s.mode).toBe('done');
  expect(levelResult(s).cleared).toBe(true);
  expect(levelResult(s).forms).toEqual(['small', 'small']);
});

test('timer runs out and kills the player', () => {
  const s = createLevelSim(def(room, { time: 2 }));
  run(s, 2 * TIME_TICK + 1);
  expect(s.players[0].dead).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/camera.test.js tests/sim.test.js` → Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/game/camera.js`:
```js
import { TILE, SUB, SCREEN_W, PLAY_H } from './consts.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function createCamera(p, lv) {
  const c = { x: 0, y: Math.max(0, lv.h * TILE - PLAY_H) };
  updateCamera(c, p, lv, true);
  return c;
}

export function updateCamera(c, p, lv, snap = false) {
  const maxX = Math.max(0, lv.w * TILE - SCREEN_W), maxY = Math.max(0, lv.h * TILE - PLAY_H);
  if (!p.dead) {
    const px = Math.floor((p.x + (p.w * SUB) / 2) / SUB);
    const top = Math.floor(p.y / SUB), bottom = top + p.h;
    if (px > c.x + 144) c.x = px - 144;
    else if (px < c.x + 112) c.x = px - 112;
    // Vertical: SMB3 keeps the view low unless you fly or climb up out of it.
    if ((p.flyTimer > 0 || !p.onGround) && top < c.y + 32) c.y = snap ? top - 32 : c.y - Math.min(4, c.y + 32 - top);
    else if (bottom > c.y + PLAY_H - 40) c.y = snap ? bottom - PLAY_H + 40 : c.y + Math.min(4, bottom - (c.y + PLAY_H - 40));
    else if (p.onGround && c.y < maxY && bottom + 40 <= maxY + PLAY_H) c.y = Math.min(maxY, c.y + 2);
  }
  c.x = clamp(c.x, 0, maxX);
  c.y = clamp(c.y, 0, maxY);
}
```

`src/game/entities/index.js`:
```js
import { SUB } from '../consts.js';

export const TYPES = {};

export function register(name, def) { TYPES[name] = def; }

export function spawnEntity(s, type, x, y, props = {}) {
  if (!TYPES[type]) throw new Error(`unknown entity type ${type}`);
  const e = {
    id: s.nextId++, type, x, y, w: 14, h: 14, vx: 0, vy: 0, dir: -1, onGround: false,
    state: '', t: 0, spawn: -1, dead: false, harmful: false, stompable: false, solidTop: false,
    ...props,
  };
  TYPES[type].init?.(e, s);
  s.entities.push(e);
  return e;
}

export function updateEntities(s) {
  // Index loop: entities spawned this frame (e.g. fireballs) update next frame.
  const n = s.entities.length;
  for (let i = 0; i < n; i++) {
    const e = s.entities[i];
    if (!e.dead) { e.t++; TYPES[e.type].update(e, s); }
  }
  s.entities = s.entities.filter(e => !e.dead);
}

export function killEntity(s, e) {
  e.dead = true;
  if (e.spawn >= 0) s.spawned[e.spawn] = 2;
}

// Classic "flip and fall off the screen" death. The entity stays alive as scenery until it leaves.
export function flipKill(s, e, pts = 100) {
  if (e.spawn >= 0) s.spawned[e.spawn] = 2;
  e.spawn = -1;
  e.state = 'flipped'; e.harmful = false; e.stompable = false; e.solidTop = false;
  e.vy = -48; e.vx = (e.vx >= 0 ? 1 : -1) * 8;
  s.events.push({ e: 'sfx', id: 'kick' });
  if (pts) s.events.push({ e: 'score', pts, x: e.x, y: e.y });
}

// Move a flipped entity; returns true if it handled the update.
export function updateFlipped(e, s) {
  if (e.state !== 'flipped') return false;
  e.vy = Math.min(e.vy + 4, 64);
  e.x += e.vx; e.y += e.vy;
  if (e.y > s.lv.h * 16 * SUB + 64 * SUB) e.dead = true;
  return true;
}
```

`src/game/entities/common.js`:
```js
import { SUB, TS, BTN } from '../consts.js';
import { moveBody, overlaps } from '../physics.js';
import { tileAt } from '../level.js';
import { INFO } from '../tiles.js';
import { TYPES } from './index.js';
import { hurtPlayer } from '../powerups.js';

export const COMBO = [100, 200, 400, 800, 1000, 2000, 4000, 8000];

export function markKilled(s, e) {
  if (e.spawn >= 0) s.spawned[e.spawn] = 2;
  e.spawn = -1;
}

export function nearestPlayer(s, e) {
  let best = null, bd = Infinity;
  for (const p of s.players) {
    if (p.dead) continue;
    const d = Math.abs(p.x - e.x);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

export function face(e, s) {
  const p = nearestPlayer(s, e);
  if (p) e.dir = p.x < e.x ? -1 : 1;
}

// Ground walker: gravity, wall turn, optional ledge turn, turn when bumping another walker.
export function walk(e, s, speed, { turnAtLedges = false, grav = 5 } = {}) {
  e.vx = e.dir * speed;
  e.vy = Math.min(e.vy + grav, 64);
  const r = moveBody(e, s.lv);
  if (r.wall) e.dir = -r.wall;
  if (turnAtLedges && e.onGround) {
    const aheadX = e.dir > 0 ? e.x + e.w * SUB : e.x - 1;
    const id = tileAt(s.lv, Math.floor(aheadX / TS), Math.floor((e.y + e.h * SUB) / TS));
    if (!INFO[id].solid && !INFO[id].semi && !INFO[id].slope) e.dir = -e.dir;
  }
  for (const o of s.entities) {
    if (o === e || !o.walker || o.dead || o.state === 'flipped' || !overlaps(e, o)) continue;
    if ((o.x - e.x) * e.dir > 0) e.dir = -e.dir;
  }
  return r;
}

export function bounce(p) {
  p.vy = p.prev & BTN.A ? -64 : -40;
  p.onGround = false;
}

export function comboScore(s, p, e) {
  if (p.combo >= COMBO.length) {
    s.shared.lives++;
    s.events.push({ e: 'sfx', id: '1up' }, { e: 'score', pts: 0, label: '1UP', x: e.x, y: e.y });
  } else {
    s.events.push({ e: 'score', pts: COMBO[p.combo], x: e.x, y: e.y });
  }
  p.combo++;
}

export function playerContacts(s) {
  for (const p of s.players) {
    if (p.dead || p.growTimer > 0) continue;
    if (p.onGround) p.combo = 0;
    for (const e of s.entities) {
      if (e.dead || e.state === 'flipped') continue;
      const def = TYPES[e.type];
      if (!(e.harmful || e.stompable || def.touch) || !overlaps(p, e)) continue;
      if (p.starTimer > 0 && e.harmful && def.hit) { def.hit(e, s, 'star', p); continue; }  // hit() scores via flipKill
      const stomp = p.vy > 0 && p.y + p.h * SUB <= e.y + 10 * SUB;
      if (stomp && e.stompable && def.stomp) { def.stomp(e, s, p); bounce(p); comboScore(s, p, e); }
      else if (def.touch) def.touch(e, s, p);
      else if (e.harmful) hurtPlayer(s, p);
    }
  }
}
```

`src/game/entities/effects.js` (visual-only entities):
```js
import { register } from './index.js';
import { SUB } from '../consts.js';

// Coin that pops out of a block, spins up and vanishes.
register('coinpop', {
  init(e) { e.vy = -64; e.w = 8; e.h = 14; },
  update(e) { e.vy += 4; e.y += e.vy; if (e.t > 28) e.dead = true; },
});

// Brick fragments: four pieces flying apart.
register('brickbit', {
  init(e) { e.w = 8; e.h = 8; },
  update(e, s) { e.vy = Math.min(e.vy + 4, 64); e.x += e.vx; e.y += e.vy; if (e.y > s.lv.h * 16 * SUB) e.dead = true; },
});

// Floating score number.
register('popup', {
  init(e) { e.vy = -16; },
  update(e) { e.y += e.vy; if (e.t > 40) e.dead = true; },
});
```

`src/game/entities/all.js`:
```js
// Importing a file registers its entity types. Later tasks add lines here.
import './effects.js';
```

`src/game/powerups.js`:
```js
import { setForm } from './player.js';

export function killPlayer(s, p) {
  if (p.dead) return;
  p.dead = true; p.deathTimer = 0; p.respawnTimer = 0;
  p.vx = 0; p.vy = -64; p.carry = -1; p.flyTimer = 0; p.starTimer = 0; p.pmeter = 0;
  p.crouch = false; p.sliding = false;
  setForm(p, 'small');
  s.events.push({ e: 'sfx', id: 'death', who: p.idx });
}

export function hurtPlayer(s, p) {
  if (p.dead || p.hurtTimer > 0 || p.starTimer > 0 || p.growTimer > 0) return;
  if (p.form === 'small') { killPlayer(s, p); return; }
  setForm(p, p.form === 'big' ? 'small' : 'big');
  p.hurtTimer = 120; p.growTimer = 30; p.flyTimer = 0;
  s.events.push({ e: 'sfx', id: 'shrink' });
}
```

`src/game/sim.js`:
```js
import { TS, SUB, BTN } from './consts.js';
import { parseLevel, tileAt, setTile } from './level.js';
import { INFO, T } from './tiles.js';
import { createPlayer, updatePlayer, isBig, setForm } from './player.js';
import { createCamera, updateCamera } from './camera.js';
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
```

The `emerge` items (`berry`, `blossom`, `leaf`, `oneup`, `star`) and `pswitch` are registered in Tasks 10 and 12. Until then the tests only bump coin blocks and bricks.

- [ ] **Step 4: Run tests**

Run: `bun test` → Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: level simulation core with blocks, coins, goal, timer and co-op death rules

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Chompkins (stomp, hurt, bump, star, combos, spawn rules)

**Files:**
- Create: `src/game/entities/chompkin.js`
- Modify: `src/game/entities/all.js` (add `import './chompkin.js';`), `tests/helpers.js`
- Test: `tests/chompkin.test.js`

**Interfaces:**
- Consumes: registry, `walk`, `face`, `markKilled`, `flipKill`, `updateFlipped`, `createLevelSim`, `stepLevel`.
- Produces: entity types `chompkin` and `parachompkin`. Every enemy sets `e.enemy = true`, which shells and projectiles use to pick targets (Task 9 onward). Test helpers `simOf(map, opts)` (creates and steps once so in-view spawns exist), `find(s, type)`, and `dropOn(p, e)`.

- [ ] **Step 1: Write the failing test**

Append to `tests/helpers.js`:
```js
import { createLevelSim, stepLevel } from '../src/game/sim.js';
import { SUB } from '../src/game/consts.js';
export const simOf = (map, opts = {}, start = [2, 5]) => {
  const s = createLevelSim({ id: 't', theme: 'overworld', time: 300, start, map }, opts);
  stepLevel(s, []);
  return s;
};
export const find = (s, type) => s.entities.find(e => e.type === type);
export const dropOn = (p, e) => { p.x = e.x; p.y = e.y - p.h * SUB - 6 * SUB; p.vy = 16; p.onGround = false; };
export const steps = (s, n, inputs = []) => { for (let i = 0; i < n; i++) stepLevel(s, typeof inputs === 'function' ? inputs(i) : inputs); };
```

`tests/chompkin.test.js`:
```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/chompkin.test.js` → Expected: FAIL, `unknown entity type chompkin`.

- [ ] **Step 3: Implement**

`src/game/entities/chompkin.js`:
```js
import { register, flipKill, updateFlipped } from './index.js';
import { walk, face, markKilled } from './common.js';

const base = (e, s) => {
  e.w = 14; e.h = 14; e.harmful = true; e.stompable = true; e.walker = true; e.enemy = true;
  face(e, s);
};

register('chompkin', {
  init: base,
  update(e, s) {
    if (updateFlipped(e, s)) return;
    if (e.state === 'squished') { if (++e.squish > 30) e.dead = true; return; }
    walk(e, s, 8);
  },
  stomp(e, s) {
    e.state = 'squished'; e.squish = 0;
    e.harmful = false; e.stompable = false; e.walker = false;
    markKilled(s, e);
    s.events.push({ e: 'sfx', id: 'stomp' });
  },
  hit(e, s) { flipKill(s, e, 100); },
});

// Small, small, small, big hop, always toward the nearest player.
register('parachompkin', {
  init(e, s) { base(e, s); e.hop = 0; e.hopWait = 20; },
  update(e, s) {
    if (updateFlipped(e, s)) return;
    if (e.onGround && --e.hopWait <= 0) {
      face(e, s);
      e.vy = e.hop < 3 ? -24 : -60;
      e.hop = (e.hop + 1) % 4;
      e.hopWait = e.hop === 0 ? 50 : 1;
      e.onGround = false;
    }
    walk(e, s, 8, { grav: 3 });
  },
  stomp(e, s) { e.type = 'chompkin'; e.vy = 0; s.events.push({ e: 'sfx', id: 'stomp' }); },
  hit(e, s) { flipKill(s, e, 100); },
});
```

- [ ] **Step 4: Run tests**

Run: `bun test` → Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: chompkin and parachompkin with stomp, combo and respawn rules

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Shellbacks, shells, Spikebug, Bumble Beetle

**Files:**
- Create: `src/game/entities/shellback.js`
- Modify: `src/game/entities/all.js` (add `import './shellback.js';`)
- Test: `tests/shellback.test.js`

**Interfaces:**
- Consumes: registry, common helpers, `hitBlock(s, {tx, ty, by, big})` from `sim.js` (a cyclic import is safe because it is a hoisted function declaration used only at runtime), `hurtPlayer`, `moveBody`, `overlaps`.
- Produces: types `shellback_green`, `shellback_red`, `shellback_winged`, `bumblebeetle`, `spikebug`.
  - Shell states: `'fly' | 'walk' | 'shell' | 'slide' | 'carried'`.
  - `SHELL_SPEED = 48`, `WAKE_FRAMES = 480`.
  - A sliding or carried shell calls `TYPES[o.type].hit(o, s, 'shell', e)` on any overlapping `o.enemy`.
  - Player field `carry` holds the carried shell's id. Releasing B kicks it.

**SMB3 rules being reproduced:** stomp a walker → shell. Stomp or touch an idle shell → kick it away from you. Hold B while touching an idle shell → carry it; let go → kick. Stomp a sliding shell → it stops. A sliding shell hurts on side contact, except during the 8 frames after you kick it. Sliding shells bounce off walls and bump the block they hit (coins come out). A carried shell that hits an enemy kills both. Shells wake up after 8 seconds. Red ones turn at ledges. Winged ones hop and lose their wings when stomped. Bumble Beetles are fireproof. Spikebugs cannot be stomped.

- [ ] **Step 1: Write the failing test**

`tests/shellback.test.js`:
```js
import { test, expect } from 'bun:test';
import { simOf, find, dropOn, steps } from './helpers.js';
import { SUB, TS, BTN } from '../src/game/consts.js';
import { tileAt } from '../src/game/level.js';
import { T } from '../src/game/tiles.js';
import { TYPES } from '../src/game/entities/index.js';

const row = (mid) => String.raw`
....................
....................
....................
....................
....................
${mid}
####################`;

const stompUntil = (s, e, cond) => { dropOn(s.players[0], e); for (let i = 0; i < 12 && !cond(); i++) steps(s, 1); };

test('stomp turns a walker into a shell; touching the shell kicks it', () => {
  const s = simOf(row('..........g.........'));
  const e = find(s, 'shellback_green');
  stompUntil(s, e, () => e.state === 'shell');
  expect(e.state).toBe('shell');
  expect(e.h).toBe(14);
  const p = s.players[0];
  steps(s, 20);                                  // land
  p.x = e.x - 12 * SUB; p.y = e.y + e.h * SUB - p.h * SUB;
  steps(s, 2);
  expect(e.state).toBe('slide');
  expect(Math.abs(e.vx)).toBe(48);
  expect(e.dir).toBe(1);
  expect(p.dead).toBe(false);
});

test('a sliding shell kills enemies in its path and bounces off walls', () => {
  const s = simOf(row('#.......g.......c..#'));
  const sh = find(s, 'shellback_green'), c = find(s, 'chompkin');
  stompUntil(s, sh, () => sh.state === 'shell');
  sh.state = 'slide'; sh.dir = 1; sh.harmful = true; sh.kickGrace = 0;
  s.players[0].x = 2 * TS; s.players[0].y = 5 * TS;  // keep the player out of the way
  for (let i = 0; i < 60 && c.state !== 'flipped'; i++) steps(s, 1);
  expect(c.state).toBe('flipped');
  for (let i = 0; i < 60 && sh.dir !== -1; i++) steps(s, 1);
  expect(sh.dir).toBe(-1);
});

test('a sliding shell bumps the block it hits', () => {
  const s = simOf(row('........g......?....'));
  const sh = find(s, 'shellback_green');
  stompUntil(s, sh, () => sh.state === 'shell');
  sh.state = 'slide'; sh.dir = 1; sh.harmful = true; sh.kickGrace = 0;
  s.players[0].x = 1 * TS;
  steps(s, 60);
  expect(tileAt(s.lv, 15, 5)).toBe(T.USED);
  expect(s.shared.coins).toBe(1);
});

test('holding B picks up a shell; releasing B kicks it forward', () => {
  const s = simOf(row('..........g.........'));
  const e = find(s, 'shellback_green'), p = s.players[0];
  stompUntil(s, e, () => e.state === 'shell');
  steps(s, 20);
  p.x = e.x - 12 * SUB; p.y = e.y + e.h * SUB - p.h * SUB; p.dir = 1;
  steps(s, 2, [BTN.B]);
  expect(e.state).toBe('carried');
  expect(p.carry).toBe(e.id);
  steps(s, 10, [BTN.B | BTN.LEFT]);
  steps(s, 2, [0]);
  expect(e.state).toBe('slide');
  expect(e.dir).toBe(-1);
  expect(p.carry).toBe(-1);
});

test('stomping a sliding shell stops it', () => {
  const s = simOf(row('..........g.........'));
  const e = find(s, 'shellback_green');
  stompUntil(s, e, () => e.state === 'shell');
  e.state = 'slide'; e.dir = 1; e.harmful = true; e.kickGrace = 0;
  stompUntil(s, e, () => e.state === 'shell');
  expect(e.state).toBe('shell');
  expect(e.vx).toBe(0);
});

test('shells wake up and walk again', () => {
  const s = simOf(row('..........g.........'));
  const e = find(s, 'shellback_green');
  stompUntil(s, e, () => e.state === 'shell');
  s.players[0].x = 1 * TS;
  steps(s, 500);
  expect(e.state).toBe('walk');
  expect(e.harmful).toBe(true);
});

test('red shellbacks turn at ledges', () => {
  const s = simOf(String.raw`
....................
....................
....................
.......r............
......#####.........
....................
####################`);
  const e = find(s, 'shellback_red');
  s.players[0].x = 18 * TS;
  steps(s, 400);
  expect(e.y + e.h * SUB).toBe(4 * TS);         // still on the platform
});

test('winged shellbacks lose their wings when stomped', () => {
  const s = simOf(row('..........f.........'));
  const e = find(s, 'shellback_winged');
  stompUntil(s, e, () => e.state === 'walk');
  expect(e.state).toBe('walk');
});

test('spikebugs hurt on a stomp', () => {
  const s = simOf(row('..........y.........'));
  const e = find(s, 'spikebug');
  dropOn(s.players[0], e);
  steps(s, 6);
  expect(s.players[0].dead).toBe(true);
});

test('bumble beetles ignore fire but shell like shellbacks', () => {
  const s = simOf(row('..........b.........'));
  const e = find(s, 'bumblebeetle');
  TYPES.bumblebeetle.hit(e, s, 'fire', null);
  expect(e.state).toBe('walk');
  stompUntil(s, e, () => e.state === 'shell');
  expect(e.state).toBe('shell');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/shellback.test.js` → Expected: FAIL, `unknown entity type shellback_green`.

- [ ] **Step 3: Implement**

`src/game/entities/shellback.js`:
```js
import { register, flipKill, updateFlipped, TYPES } from './index.js';
import { walk, face, comboScore, COMBO } from './common.js';
import { moveBody, overlaps } from '../physics.js';
import { hitBlock } from '../sim.js';
import { hurtPlayer } from '../powerups.js';
import { SUB, TS, BTN } from '../consts.js';

export const SHELL_SPEED = 48, WAKE_FRAMES = 480;
const SHELL_H = 14;

const VARIANTS = {
  shellback_green: { h: 24, ledges: false, wings: false, fireproof: false },
  shellback_red: { h: 24, ledges: true, wings: false, fireproof: false },
  shellback_winged: { h: 24, ledges: false, wings: true, fireproof: false },
  bumblebeetle: { h: 14, ledges: false, wings: false, fireproof: true },
};

const setHeight = (e, h) => { e.y += (e.h - h) * SUB; e.h = h; };

function toShell(e) {
  setHeight(e, SHELL_H);
  e.state = 'shell'; e.vx = 0; e.wake = 0;
  e.harmful = false; e.stompable = true; e.walker = false;
}

function kick(e, s, p, dir) {
  e.state = 'slide'; e.dir = dir; e.harmful = true; e.stompable = true;
  e.kickGrace = 8; e.combo = 0;
  if (p) p.kickTimer = 10;
  s.events.push({ e: 'sfx', id: 'kick' });
}

const awayFrom = (p, e) => (p.x + (p.w * SUB >> 1) < e.x + (e.w * SUB >> 1) ? 1 : -1);

function shellHits(e, s, carrier) {
  for (const o of s.entities) {
    if (o === e || o.dead || !o.enemy || o.state === 'flipped' || !overlaps(e, o)) continue;
    const pts = COMBO[Math.min(e.combo++, COMBO.length - 1)];
    TYPES[o.type].hit?.(o, s, 'shell', e);
    if (o.state === 'flipped' || o.dead) s.events.push({ e: 'score', pts, x: o.x, y: o.y });
    if (carrier) { carrier.carry = -1; flipKill(s, e, 0); return; }
  }
}

function makeShellback(name) {
  const V = VARIANTS[name];
  return {
    init(e, s) {
      e.w = 14; e.h = V.h; e.enemy = true; e.harmful = true; e.stompable = true; e.walker = true;
      e.state = V.wings ? 'fly' : 'walk';
      face(e, s);
    },
    update(e, s) {
      if (updateFlipped(e, s)) return;
      switch (e.state) {
        case 'fly':
          if (e.onGround) { e.vy = -56; e.onGround = false; }
          walk(e, s, 8, { grav: 3 });
          break;
        case 'walk':
          walk(e, s, 8, { turnAtLedges: V.ledges });
          break;
        case 'shell':
          e.vx = 0; e.vy = Math.min(e.vy + 5, 64); moveBody(e, s.lv);
          if (++e.wake > WAKE_FRAMES) {
            setHeight(e, V.h);
            e.state = 'walk'; e.harmful = true; e.walker = true;
            face(e, s);
          }
          break;
        case 'slide': {
          if (e.kickGrace > 0) e.kickGrace--;
          e.vx = e.dir * SHELL_SPEED; e.vy = Math.min(e.vy + 5, 64);
          const r = moveBody(e, s.lv);
          if (r.wall) {
            const tx = Math.floor((r.wall > 0 ? e.x + e.w * SUB : e.x - 1) / TS);
            const ty = Math.floor((e.y + (e.h * SUB >> 1)) / TS);
            hitBlock(s, { tx, ty, by: -1, big: true });
            e.dir = -r.wall;
            s.events.push({ e: 'sfx', id: 'bump' });
          }
          shellHits(e, s, null);
          break;
        }
        case 'carried': {
          const p = s.players.find(q => q.carry === e.id);
          if (!p || p.dead || p.growTimer > 0) { if (p) p.carry = -1; toShell(e); break; }
          e.x = p.dir > 0 ? p.x + (p.w - 4) * SUB : p.x - (e.w - 4) * SUB;
          e.y = p.y + (p.h - e.h) * SUB - (p.h > 16 ? 6 * SUB : 0);
          if (!(p.prev & BTN.B)) { p.carry = -1; kick(e, s, p, p.dir); break; }
          shellHits(e, s, p);
          break;
        }
      }
    },
    stomp(e, s, p) {
      s.events.push({ e: 'sfx', id: 'stomp' });
      if (e.state === 'fly') { e.state = 'walk'; e.vy = 0; }
      else if (e.state === 'walk') toShell(e);
      else if (e.state === 'slide') { e.state = 'shell'; e.vx = 0; e.wake = 0; e.harmful = false; }
      else if (e.state === 'shell') kick(e, s, p, awayFrom(p, e));
    },
    touch(e, s, p) {
      if (e.state === 'carried') return;
      if (e.state === 'shell') {
        if ((p.prev & BTN.B) && p.carry < 0) {
          p.carry = e.id; e.state = 'carried'; e.harmful = false; e.stompable = false;
        } else kick(e, s, p, awayFrom(p, e));
        return;
      }
      if (e.state === 'slide' && e.kickGrace > 0) return;
      hurtPlayer(s, p);
    },
    hit(e, s, kind) {
      if (kind === 'fire' && V.fireproof) return;
      if (e.state === 'carried') { const p = s.players.find(q => q.carry === e.id); if (p) p.carry = -1; }
      flipKill(s, e, 100);
    },
  };
}

for (const name of Object.keys(VARIANTS)) register(name, makeShellback(name));

register('spikebug', {
  init(e, s) { e.w = 14; e.h = 14; e.enemy = true; e.harmful = true; e.walker = true; face(e, s); },
  update(e, s) { if (!updateFlipped(e, s)) walk(e, s, 8); },
  hit(e, s) { flipKill(s, e, 100); },
});
```

The spikebug has no `stomp`, so `playerContacts` falls through to "harmful → hurt".

- [ ] **Step 4: Run tests**

Run: `bun test` → Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: shellbacks with kick, carry and block-bumping shells; spikebug and bumble beetle

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Power-ups — Berry, Fire Blossom, Glide Leaf (tail, float, flight), Star, 1-Up

**Files:**
- Create: `src/game/entities/items.js`, `src/game/entities/projectiles.js`
- Modify: `src/game/powerups.js` (add `givePower`, `formActions`), `src/game/player.js` (jump/gravity block, landing, `PHYS.FLY_FRAMES`), `src/game/sim.js` (call `formActions`), `src/game/entities/all.js`
- Test: `tests/powerups.test.js`

**Interfaces:**
- Consumes: `hitBlock`, registry, `overlaps`, `moveBody`, `walk`, `setForm`.
- Produces:
  - Item types `berry`, `blossom`, `leaf`, `star`, `oneup` (spawned by `hitBlock` with `state: 'emerge'`). Projectile type `fireball` (`owner` = player idx). Effect type `puff`.
  - `givePower(s, p, item: 'berry'|'blossom'|'leaf'|'star'|'oneup', at: {x,y})`
  - `formActions(s, p, pressed)`, called by `stepLevel` right after `updatePlayer`. `pressed` is the button mask newly pressed this frame, computed in `stepLevel` before `updatePlayer` overwrites `p.prev`.
  - `PHYS.FLY_FRAMES = 255`; `STAR_FRAMES = 600` exported from powerups.js.

**SMB3 rules:** a power-up block gives a Berry to a small player, otherwise the block's item. A Berry when already big just scores. A Blossom or Leaf turns any form into that suit. Fire: B throws a bouncing fireball, at most 2 per player on screen. Leaf: B spins the tail, which hits enemies and the block in front at waist height. A in the air slows the fall. Jumping with a full P-meter gives about 4.25 s of flight, where each A press lifts you. Star: 10 s of invincibility that flips enemies on contact.

- [ ] **Step 1: Write the failing test**

`tests/powerups.test.js`:
```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/powerups.test.js` → Expected: FAIL (`unknown entity type berry`, missing exports).

- [ ] **Step 3: Implement**

`src/game/entities/items.js`:
```js
import { register } from './index.js';
import { walk } from './common.js';
import { moveBody } from '../physics.js';
import { givePower } from '../powerups.js';

// Rise 16 px out of the block over 32 frames.
function emerging(e) {
  if (e.state !== 'emerge') return false;
  e.y -= 8;
  if (e.t >= 32) e.state = 'move';
  return true;
}

const collect = (item) => (e, s, p) => {
  if (e.state === 'emerge' && e.t < 8) return;
  e.dead = true;
  givePower(s, p, item, e);
};

const size = (e) => { e.w = 14; e.h = 16; e.dir = 1; };

register('berry', { init: size, update(e, s) { if (!emerging(e)) walk(e, s, 16); }, touch: collect('berry') });
register('oneup', { init: size, update(e, s) { if (!emerging(e)) walk(e, s, 16); }, touch: collect('oneup') });
register('blossom', { init: size, update(e) { emerging(e); }, touch: collect('blossom') });

register('star', {
  init: size,
  update(e, s) {
    if (emerging(e)) return;
    e.vx = e.dir * 16;
    e.vy = Math.min(e.vy + 3, 64);
    const r = moveBody(e, s.lv);
    if (r.wall) e.dir = -e.dir;
    if (e.onGround) { e.vy = -56; e.onGround = false; }
  },
  touch: collect('star'),
});

// Leaf pops up out of the block, then sways down side to side.
register('leaf', {
  init(e) { e.w = 14; e.h = 14; },
  update(e, s) {
    if (e.state === 'emerge') { e.vy = -64; e.state = 'rise'; }
    if (e.state === 'rise') {
      e.vy += 4; e.y += e.vy;
      if (e.vy >= 0) { e.state = 'fall'; e.t = 0; }
      return;
    }
    e.vx = (e.t & 63) < 32 ? 16 : -16;
    e.x += e.vx; e.y += 8;
    if (e.y > s.lv.h * 256 + 512) e.dead = true;
  },
  touch: collect('leaf'),
});
```

`src/game/entities/projectiles.js`:
```js
import { register, TYPES, spawnEntity } from './index.js';
import { moveBody, overlaps } from '../physics.js';

register('puff', { init(e) { e.w = 8; e.h = 8; }, update(e) { if (e.t > 12) e.dead = true; } });

register('fireball', {
  init(e) { e.w = 8; e.h = 8; e.vx = e.dir * 64; e.vy = 32; },
  update(e, s) {
    e.vx = e.dir * 64;
    e.vy = Math.min(e.vy + 6, 64);
    const r = moveBody(e, s.lv);
    if (r.wall || e.t > 180) {
      e.dead = true;
      spawnEntity(s, 'puff', e.x, e.y);
      s.events.push({ e: 'sfx', id: 'bump' });
      return;
    }
    if (e.onGround) { e.vy = -40; e.onGround = false; }
    for (const o of s.entities) {
      if (!o.enemy || o.dead || o.state === 'flipped' || !overlaps(e, o)) continue;
      TYPES[o.type].hit?.(o, s, 'fire', e);
      e.dead = true;
      spawnEntity(s, 'puff', e.x, e.y);
      break;
    }
  },
});
```

`src/game/entities/all.js` becomes:
```js
import './effects.js';
import './chompkin.js';
import './shellback.js';
import './items.js';
import './projectiles.js';
```

Add to `src/game/powerups.js`:
```js
import { BTN, SUB, TS } from './consts.js';
import { TYPES, spawnEntity } from './entities/index.js';
import { overlaps } from './physics.js';
import { tileAt } from './level.js';
import { INFO } from './tiles.js';
import { hitBlock } from './sim.js';

export const STAR_FRAMES = 600;

export function givePower(s, p, item, at) {
  const pos = { x: at.x, y: at.y };
  if (item === 'oneup') {
    s.shared.lives++;
    s.events.push({ e: 'sfx', id: '1up' }, { e: 'score', pts: 0, label: '1UP', ...pos });
    return;
  }
  s.events.push({ e: 'score', pts: 1000, ...pos });
  if (item === 'star') {
    p.starTimer = STAR_FRAMES;
    s.events.push({ e: 'music', id: 'star', who: p.idx });
    return;
  }
  const target = item === 'berry' ? (p.form === 'small' ? 'big' : p.form) : item === 'blossom' ? 'fire' : 'leaf';
  s.events.push({ e: 'sfx', id: item === 'leaf' ? 'puff' : 'powerup' });
  if (target === p.form) return;
  setForm(p, target);
  p.growTimer = 30;
}

export function formActions(s, p, pressed) {
  if (p.dead || p.growTimer > 0) return;
  if (pressed & BTN.B && p.carry < 0) {
    if (p.form === 'fire' && p.fireCooldown === 0 && !p.crouch) {
      const mine = s.entities.filter(e => e.type === 'fireball' && e.owner === p.idx).length;
      if (mine < 2) {
        spawnEntity(s, 'fireball', p.dir > 0 ? p.x + p.w * SUB : p.x - 8 * SUB, p.y + 4 * SUB, { dir: p.dir, owner: p.idx });
        p.fireCooldown = 10;
        s.events.push({ e: 'sfx', id: 'fire' });
      }
    } else if (p.form === 'leaf' && p.tailTimer === 0) {
      p.tailTimer = 18;
      s.events.push({ e: 'sfx', id: 'tail' });
    }
  }
  if (p.form === 'leaf' && p.tailTimer > 6) tailHits(s, p);
}

function tailHits(s, p) {
  const box = { x: p.dir > 0 ? p.x + p.w * SUB : p.x - 12 * SUB, y: p.y + (p.h - 12) * SUB, w: 12, h: 10 };
  for (const e of s.entities) {
    if (e.enemy && !e.dead && e.state !== 'flipped' && overlaps(box, e)) TYPES[e.type].hit?.(e, s, 'tail', p);
  }
  if (p.tailTimer === 17) {
    const tx = Math.floor((box.x + 6 * SUB) / TS), ty = Math.floor((box.y + 5 * SUB) / TS);
    if (INFO[tileAt(s.lv, tx, ty)].solid) hitBlock(s, { tx, ty, by: p.idx, big: true });
  }
}
```
Merge the existing `import { setForm } from './player.js';` line with these imports. `tailTimer` is decremented in `updatePlayer` before `formActions` runs, so the frame after the press sees 17. That is why the block check uses 17.

In `src/game/player.js`, add `FLY_FRAMES: 255` to `PHYS` and replace the `// Jump` and `// Gravity` sections with:
```js
  // Jump (with the Glide Leaf, a full P-meter jump starts flight)
  if ((pressed & BTN.A) && p.onGround) {
    const s = Math.abs(p.vx);
    p.vy = -(s >= PHYS.P_MAX ? PHYS.JUMP_P : s >= PHYS.RUN_MAX ? PHYS.JUMP_RUN : PHYS.JUMP_STAND);
    p.onGround = false;
    p.sliding = false;
    if (p.form === 'leaf' && p.pmeter === 7) p.flyTimer = PHYS.FLY_FRAMES;
    out.events.push({ e: 'sfx', id: 'jump' });
  } else if ((pressed & BTN.A) && !p.onGround && p.form === 'leaf') {
    p.floatTimer = 16;            // flap: rises while flying, otherwise slows the fall
  }

  // Gravity
  if (p.floatTimer > 0) p.floatTimer--;
  if (p.flyTimer > 0 && --p.flyTimer === 0) p.pmeter = 0;
  if (p.flyTimer > 0 && p.floatTimer > 0) {
    p.vy = -24;
  } else {
    p.vy += p.vy < PHYS.HOLD_UNTIL && holdA ? PHYS.GRAV_HOLD : PHYS.GRAV;
    const cap = p.floatTimer > 0 ? 16 : PHYS.FALL_MAX;
    if (p.vy > cap) p.vy = cap;
  }
```
After `const r = moveBody(p, lv);` add:
```js
  if (r.landed) p.flyTimer = 0;
```

In `src/game/sim.js` `stepLevel`, replace the per-player update lines with:
```js
    const buttons = s.mode === 'play' ? (inputs[p.idx] | 0) : BTN.RIGHT;
    const pressed = buttons & ~p.prev;
    const out = { events: s.events, bumps: [] };
    updatePlayer(p, buttons, s.lv, out);
    for (const b of out.bumps) hitBlock(s, b);
    formActions(s, p, pressed);
    afterMove(s, p, buttons);
```
and import `formActions` from `./powerups.js`.

- [ ] **Step 4: Run tests**

Run: `bun test` → Expected: all pass, including all earlier suites (player jump heights must be unchanged for non-leaf forms).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: berry, fire blossom, glide leaf flight and tail, star and 1-up

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Snapvines, Bolt Cannons, Embers, Rotodiscs, Bone Shells

**Files:**
- Create: `src/game/entities/hazards.js`
- Modify: `src/game/tiles.js` (add `ENTITY_TILE`), `src/game/level.js` (use it), `src/game/sim.js` (cannon list + `fireCannons`), `src/game/entities/all.js`
- Test: `tests/hazards.test.js`

**Interfaces:**
- Consumes: registry, common helpers, `setTile`, `T`.
- Produces:
  - Types `snapvine`, `firesnapvine`, `enemyfire`, `boombolt`, `ember`, `rotodisc`, `boneshell`.
  - `ENTITY_TILE = { o: T.USED }`: the tile placed under an entity char. A rotodisc's pivot is a solid block that exists from level load.
  - `s.cannons: [{ tx, ty }]`, built in `createLevelSim`. `fireCannons(s)` runs in `stepLevel` before `updateEntities`.
  - Timings: snapvine rises 24 frames, stays up 60, sinks 24, waits 90, and won't rise while a player's centre is within 24 px of the pipe centre. Cannons fire every 180 frames (offset per column), only when seen by a camera and no player is within 24 px horizontally. Boom Bolts fly at 24 sub/frame. Embers leap with vy −88 every 120 frames. Rotodiscs orbit at a 40 px radius, one turn per 128 frames. Bone Shells collapse for 240 frames when stomped.

- [ ] **Step 1: Write the failing test**

`tests/hazards.test.js`:
```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/hazards.test.js` → Expected: FAIL, unknown entity types.

- [ ] **Step 3: Implement**

In `src/game/tiles.js` add:
```js
// Tile placed underneath an entity char (default EMPTY).
export const ENTITY_TILE = { o: T.USED };
```
In `src/game/level.js`, import `ENTITY_TILE` and change the entity branch of `parseLevel` to:
```js
      else if (c in ENTITY_CHARS) {
        spawns.push({ i: spawns.length, type: ENTITY_CHARS[c], tx, ty });
        tiles[ty * w + tx] = ENTITY_TILE[c] ?? T.EMPTY;
      }
```

`src/game/entities/hazards.js`:
```js
import { register, spawnEntity, flipKill, updateFlipped } from './index.js';
import { walk, face, nearestPlayer, markKilled } from './common.js';
import { SUB, TS } from '../consts.js';

const PIPE_CLEAR = 24 * SUB;
const SIN = Array.from({ length: 64 }, (_, i) => Math.round(Math.sin((i * Math.PI) / 32) * 256));

function playerNear(s, cx, dist) {
  return s.players.some(p => !p.dead && Math.abs(p.x + (p.w * SUB >> 1) - cx) < dist);
}

function poof(s, e) {
  markKilled(s, e);
  e.dead = true;
  spawnEntity(s, 'puff', e.x, e.y);
  s.events.push({ e: 'sfx', id: 'kick' }, { e: 'score', pts: 100, x: e.x, y: e.y });
}

// Pipe plant. Cycle: hidden(wait) -> rising -> up -> sinking.
function snap(fires) {
  return {
    init(e) {
      e.w = 16; e.h = 24; e.enemy = true;
      e.x = Math.floor(e.x / TS) * TS + TS - 8 * SUB;    // centred on the 2-wide pipe
      e.state = 'wait'; e.timer = 60; e.persistent = false;
    },
    update(e, s) {
      if (e.baseY === undefined) { e.baseY = e.y; e.y = e.baseY + e.h * SUB; }
      const hiddenY = e.baseY + e.h * SUB;
      e.timer--;
      switch (e.state) {
        case 'wait':
          if (e.timer <= 0 && !playerNear(s, e.x + 8 * SUB, PIPE_CLEAR)) { e.state = 'rise'; }
          break;
        case 'rise':
          e.y = Math.max(e.baseY, e.y - e.h * SUB / 24);
          if (e.y === e.baseY) { e.state = 'up'; e.timer = 60; }
          break;
        case 'up':
          if (fires && e.timer === 30) {
            const p = nearestPlayer(s, e);
            if (p) {
              const dir = p.x < e.x ? -1 : 1;
              const vy = p.y < e.y ? -12 : 12;
              spawnEntity(s, 'enemyfire', e.x + 4 * SUB, e.y + 2 * SUB, { vx: dir * 24, vy });
            }
          }
          if (e.timer <= 0) e.state = 'sink';
          break;
        case 'sink':
          e.y = Math.min(hiddenY, e.y + e.h * SUB / 24);
          if (e.y === hiddenY) { e.state = 'wait'; e.timer = 90; }
          break;
      }
      e.harmful = e.y < hiddenY;
    },
    hit(e, s) { poof(s, e); },
  };
}
register('snapvine', snap(false));
register('firesnapvine', snap(true));

register('enemyfire', {
  init(e) { e.w = 8; e.h = 8; e.harmful = true; },
  update(e) { e.x += e.vx; e.y += e.vy; if (e.t > 300) e.dead = true; },
});

register('boombolt', {
  init(e) { e.w = 16; e.h = 14; e.harmful = true; e.stompable = true; e.enemy = true; },
  update(e, s) { if (updateFlipped(e, s)) return; e.x += e.vx; if (e.t > 600) e.dead = true; },
  stomp(e, s) { flipKill(s, e, 0); s.events.push({ e: 'sfx', id: 'stomp' }); },
  hit(e, s, kind) { if (kind !== 'fire') flipKill(s, e, 100); },
});

export function fireCannons(s) {
  for (const c of s.cannons) {
    if ((s.frame + c.tx * 37) % 180 !== 0) continue;
    const cx = c.tx * TS + 8 * SUB;
    const seen = s.cams.some(cam => c.tx * 16 + 16 > cam.x && c.tx * 16 < cam.x + 256);
    if (!seen || playerNear(s, cx, PIPE_CLEAR)) continue;
    const p = nearestPlayer(s, { x: cx });
    if (!p) continue;
    const dir = p.x < cx ? -1 : 1;
    spawnEntity(s, 'boombolt', dir < 0 ? c.tx * TS - 16 * SUB : (c.tx + 1) * TS, c.ty * TS + SUB, { vx: dir * 24, dir });
    s.events.push({ e: 'sfx', id: 'cannon' });
  }
}

register('ember', {
  init(e) { e.w = 12; e.h = 14; e.harmful = true; e.state = 'wait'; e.timer = 40; },
  update(e, s) {
    if (e.home === undefined) e.home = e.y;
    if (e.state === 'wait') {
      if (--e.timer <= 0) { e.state = 'leap'; e.vy = -88; }
      return;
    }
    e.vy = Math.min(e.vy + 3, 64);
    e.y += e.vy;
    if (e.vy > 0 && e.y >= e.home) { e.y = e.home; e.state = 'wait'; e.timer = 120; }
  },
});

register('rotodisc', {
  init(e) {
    e.w = 12; e.h = 12; e.harmful = true; e.persistent = false;
    e.cx = Math.floor(e.x / TS) * TS + 8 * SUB;
    e.phase = 0;
  },
  update(e, s) {
    if (e.cy === undefined) e.cy = Math.floor(e.y / TS) * TS + 8 * SUB;
    e.phase = (e.phase + 1) & 127;
    const i = e.phase >> 1;
    e.x = e.cx + Math.round((SIN[(i + 16) & 63] * 40 * SUB) / 256) - 6 * SUB;
    e.y = e.cy + Math.round((SIN[i] * 40 * SUB) / 256) - 6 * SUB;
  },
});

register('boneshell', {
  init(e, s) { e.w = 14; e.h = 24; e.enemy = true; e.harmful = true; e.stompable = true; e.walker = true; e.state = 'walk'; face(e, s); },
  update(e, s) {
    if (updateFlipped(e, s)) return;
    if (e.state === 'collapsed') {
      if (--e.timer <= 0) { e.state = 'walk'; e.harmful = true; e.stompable = true; face(e, s); }
      e.vy = Math.min(e.vy + 5, 64);
      return;
    }
    walk(e, s, 8, { turnAtLedges: true });
  },
  stomp(e, s) { collapse(e, s); },
  hit(e, s, kind) {
    if (kind === 'fire') return;
    if (kind === 'tail' || kind === 'bump') { collapse(e, s); return; }
    flipKill(s, e, 100);
  },
});

function collapse(e, s) {
  e.state = 'collapsed'; e.timer = 240; e.harmful = false; e.stompable = false;
  s.events.push({ e: 'sfx', id: 'stomp' });
}
```

The rotodisc's `y` is overwritten by `spawnInView` after `init`, so `cy` is captured on its first update from the spawn tile. In `spawnInView`, the spawn tile's bottom equals the pivot tile's bottom, so `Math.floor(e.y / TS)` is the pivot row.

`src/game/entities/all.js`: add `import './hazards.js';`.

In `src/game/sim.js`:
- import `{ fireCannons }` from `./entities/hazards.js`.
- in `createLevelSim`, after creating `s`, build the cannon list:
```js
  s.cannons = [];
  for (let ty = 0; ty < lv.h; ty++) for (let tx = 0; tx < lv.w; tx++) {
    if (lv.tiles[ty * lv.w + tx] === T.CANNON && lv.tiles[(ty - 1) * lv.w + tx] !== T.CANNON) s.cannons.push({ tx, ty });
  }
```
  (Only the top tile of a cannon stack fires.)
- in `stepLevel`, call `fireCannons(s);` immediately before `updateEntities(s);`.

- [ ] **Step 4: Run tests**

Run: `bun test` → Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: snapvines, bolt cannons, embers, rotodiscs and bone shells

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Pipes and areas, P-switch, lifts, doors

**Files:**
- Create: `src/game/entities/objects.js`, `src/game/areas.js`
- Modify: `src/game/tiles.js` (add `PSWITCH_BRICK`), `src/game/level.js` (`doors`), `src/game/sim.js` (pipe/door detection, pipe animation, platforms, P-switch timer), `src/game/entities/all.js`
- Test: `tests/objects.test.js`

**Interfaces:**
- Consumes: sim internals, `parseLevel`, `setTile`, `placeAt`.
- Produces:
  - Level def fields:
    - `pipes: [{ at: [tx, ty], dir: 'down'|'up'|'right'|'left', to: { level, at: [tx, ty], dir } }]`. `at` is the top-left tile of the pipe mouth. Vertical pipes are 2 wide; side pipes are 2 tall. `to.dir` is the direction the player moves while coming out.
    - `doors: [{ at: [tx, ty], to: { level?, at: [tx, ty] } }]`. `at` is the door's bottom tile. A missing `level` means the same area.
  - `createLevelSim(def, { ..., defs })`, where `defs` maps level id → def. It is needed for any pipe or door that changes area.
  - `enterArea(s, to)` in `areas.js` saves the current area's `{ tiles, spawned, multicoin }` in `s.areaStore[id]`, then loads or restores the target. All players move to the exit and play the exit animation. Entities are cleared, cameras snap, cannons are rebuilt.
  - Player field `pipe: null | { phase: 'enter'|'exit', dir, t, to }`. The pipe animation lasts 32 frames at 0.5 px/frame, and the player is drawn behind tiles.
  - P-switch: `s.pswitch` frames remaining (600). `swapPSwitch(s, on)` turns BRICK → PSWITCH_COIN and COIN → PSWITCH_BRICK, and back when it ends. Collected PSWITCH_COINs stay gone.
  - Platforms: entities with `solidTop: true` carry riders. `p.ride` is the id of the platform under the player, or -1. Types `lift_h` (drifts left at 0.5 px/frame and starts falling once ridden, like SMB3's 1-4 platforms), `lift_v` (bobs 48 px up and down), and `pswitch`.

- [ ] **Step 1: Write the failing test**

`tests/objects.test.js`:
```js
import { test, expect } from 'bun:test';
import { createLevelSim, stepLevel } from '../src/game/sim.js';
import { simOf, find, dropOn, steps } from './helpers.js';
import { BTN, SUB, TS } from '../src/game/consts.js';
import { tileAt } from '../src/game/level.js';
import { T } from '../src/game/tiles.js';

const main = {
  id: 'm', time: 300, start: [2, 5],
  map: String.raw`
....................
....................
....................
.....B..............
........[]..........
........{}..........
####################`,
  pipes: [{ at: [8, 4], dir: 'down', to: { level: 'sub', at: [3, 4], dir: 'up' } }],
};
const sub = {
  id: 'sub', time: 300, start: [1, 5],
  map: String.raw`
..........
..........
..........
....CC....
...[].....
...{}.....
##########`,
  pipes: [{ at: [3, 4], dir: 'down', to: { level: 'm', at: [8, 4], dir: 'up' } }],
};
const defs = { m: main, sub };
const run = (s, n, b) => { for (let i = 0; i < n; i++) stepLevel(s, typeof b === 'function' ? b(i) : b); };

test('pressing down on a pipe moves both players to the linked area', () => {
  const s = createLevelSim(main, { players: 2, defs });
  const p = s.players[0];
  p.x = 8 * TS + 10 * SUB; p.y = 4 * TS - p.h * SUB - 8 * SUB;
  run(s, 20, [0, 0]);
  run(s, 40, [BTN.DOWN, 0]);
  expect(s.lv.id).toBe('sub');
  expect(s.entities.length).toBe(0);
  run(s, 40, [0, 0]);
  expect(s.players[0].pipe).toBe(null);
  expect(Math.floor(s.players[0].x / TS)).toBe(3);
  expect(s.players[1].x).toBe(s.players[0].x);
});

test('areas keep their state when you come back', () => {
  const s = createLevelSim(main, { forms: ['big'], defs });
  const p = s.players[0];
  p.x = 5 * TS + 2 * SUB;
  run(s, 30, BTN.A);                                // break the brick
  expect(tileAt(s.lv, 5, 3)).toBe(T.EMPTY);
  run(s, 60, 0);
  p.x = 8 * TS + 10 * SUB; p.y = 4 * TS - p.h * SUB - 8 * SUB; p.vy = 0;
  run(s, 20, 0);
  run(s, 40, BTN.DOWN);
  expect(s.lv.id).toBe('sub');
  run(s, 40, 0);
  const q = s.players[0];
  q.x = 3 * TS + 10 * SUB; q.y = 4 * TS - q.h * SUB - 8 * SUB; q.vy = 0;
  run(s, 20, 0);
  run(s, 40, BTN.DOWN);
  expect(s.lv.id).toBe('m');
  expect(tileAt(s.lv, 5, 3)).toBe(T.EMPTY);
});

test('P-switch swaps bricks and coins, then swaps back', () => {
  const s = simOf(String.raw`
....................
....................
..P.BB..CC..........
....................
....................
....................
####################`);
  steps(s, 30, [BTN.A]);
  const sw = find(s, 'pswitch');
  expect(sw).toBeDefined();
  steps(s, 60, [0]);
  dropOn(s.players[0], sw);
  for (let i = 0; i < 10 && s.pswitch === 0; i++) steps(s, 1);
  expect(s.pswitch).toBeGreaterThan(0);
  expect(tileAt(s.lv, 4, 2)).toBe(T.PSWITCH_COIN);
  expect(tileAt(s.lv, 8, 2)).toBe(T.PSWITCH_BRICK);
  steps(s, 610);
  expect(tileAt(s.lv, 4, 2)).toBe(T.BRICK);
  expect(tileAt(s.lv, 8, 2)).toBe(T.COIN);
});

test('horizontal lift carries its rider and falls once ridden', () => {
  const s = simOf(String.raw`
....................
....................
....................
..........m.........
....................
....................
....................`, {}, [10, 0]);
  const lift = find(s, 'lift_h'), p = s.players[0];
  p.x = lift.x + 8 * SUB; p.y = lift.y - p.h * SUB - 4 * SUB; p.vy = 8;
  steps(s, 10);
  expect(p.ride).toBe(lift.id);
  expect(p.onGround).toBe(true);
  const x0 = p.x, y0 = lift.y;
  steps(s, 30);
  expect(p.x).toBeLessThan(x0);
  expect(lift.y).toBeGreaterThan(y0);
  expect(p.y + p.h * SUB).toBe(lift.y);
});

test('vertical lift lifts its rider', () => {
  const s = simOf(String.raw`
....................
....................
....................
....................
..........n.........
....................
####################`, {}, [10, 0]);
  const lift = find(s, 'lift_v'), p = s.players[0];
  p.x = lift.x + 8 * SUB; p.y = lift.y - p.h * SUB - 4 * SUB; p.vy = 8;
  let minFoot = Infinity;
  steps(s, 200, () => { minFoot = Math.min(minFoot, p.y + p.h * SUB); return []; });
  expect(p.ride).toBe(lift.id);
  expect((5 * TS - minFoot) / SUB).toBeGreaterThan(40);
});

test('pressing up at a door teleports to its target', () => {
  const s = simOf(String.raw`
....................
....................
....................
....................
...D..........D.....
...D..........D.....
####################`);
  s.lv.doors = [{ at: [3, 5], to: { at: [14, 5] } }];
  const p = s.players[0];
  p.x = 3 * TS + 2 * SUB;
  steps(s, 30, [BTN.UP]);
  expect(Math.floor(p.x / TS)).toBe(14);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/objects.test.js` → Expected: FAIL.

- [ ] **Step 3: Implement**

`src/game/tiles.js`: append `'PSWITCH_BRICK'` to `NAMES` and add `[T.PSWITCH_BRICK]: solid({ breakable: true })` to `INFO`.

`src/game/level.js` `parseLevel` return value: add `doors: def.doors || []`.

`src/game/areas.js`:
```js
import { TS, SUB } from './consts.js';
import { parseLevel } from './level.js';
import { T } from './tiles.js';
import { createCamera } from './camera.js';
import { placeAt } from './player.js';

export function buildCannons(lv) {
  const out = [];
  for (let ty = 0; ty < lv.h; ty++) for (let tx = 0; tx < lv.w; tx++) {
    if (lv.tiles[ty * lv.w + tx] === T.CANNON && (ty === 0 || lv.tiles[(ty - 1) * lv.w + tx] !== T.CANNON)) out.push({ tx, ty });
  }
  return out;
}

export function enterArea(s, to) {
  if (to.level && to.level !== s.lv.id) {
    s.areaStore[s.lv.id] = { tiles: s.lv.tiles.slice(), spawned: s.spawned.slice(), multicoin: { ...s.multicoin } };
    const def = s.defs && s.defs[to.level];
    if (!def) throw new Error(`area ${to.level} not found`);
    const lv = parseLevel(def);
    const saved = s.areaStore[to.level];
    if (saved) { lv.tiles.set(saved.tiles); }
    s.lv = lv;
    s.spawned = saved ? saved.spawned.slice() : new Uint8Array(lv.spawns.length);
    for (let i = 0; i < s.spawned.length; i++) if (s.spawned[i] !== 2) s.spawned[i] = 0;
    s.multicoin = saved ? { ...saved.multicoin } : {};
    s.entities = [];
    s.cannons = buildCannons(lv);
    s.events.push({ e: 'area', id: lv.id, music: lv.music });
  }
  const [tx, ty] = to.at;
  for (const p of s.players) {
    if (p.dead) continue;
    p.carry = -1; p.ride = -1; p.flyTimer = 0;
    if (to.dir === 'up') {           // come up out of a pipe whose mouth is at (tx..tx+1, ty)
      p.x = tx * TS + TS - (p.w * SUB >> 1);
      p.y = ty * TS + TS - p.h * SUB; // feet 16 px inside the pipe; rising 16 px lands them on the mouth
      p.pipe = { phase: 'exit', dir: 'up', t: 0 };
    } else if (to.dir === 'down') {
      p.x = tx * TS + TS - (p.w * SUB >> 1);
      p.y = (ty + 1) * TS - p.h * SUB - 2 * SUB;
      p.pipe = { phase: 'exit', dir: 'down', t: 0 };
    } else if (to.dir === 'left' || to.dir === 'right') {
      placeAt(p, tx, ty + 1);
      p.pipe = { phase: 'exit', dir: to.dir, t: 0 };
    } else {
      placeAt(p, tx, ty);             // doors
      p.pipe = null;
    }
  }
  s.players.forEach((p, i) => { s.cams[i] = createCamera(p, s.lv); });
}
```

`src/game/entities/objects.js`:
```js
import { register } from './index.js';
import { SUB, TS } from '../consts.js';
import { swapPSwitch } from '../sim.js';

register('pswitch', {
  init(e) { e.w = 16; e.h = 16; e.stompable = true; e.persistent = true; },
  update(e) { if (e.state === 'pressed' && e.t > 600) e.dead = true; },
  stomp(e, s) {
    if (e.state === 'pressed') return;
    e.state = 'pressed'; e.stompable = false; e.t = 0;
    s.pswitch = 600;
    swapPSwitch(s, true);
    s.events.push({ e: 'sfx', id: 'stomp' }, { e: 'music', id: 'pswitch' });
  },
  touch() {},
});

const liftBase = (e) => { e.w = 48; e.h = 8; e.solidTop = true; };

register('lift_h', {
  init: liftBase,
  update(e, s) {
    e.prevX = e.x; e.prevY = e.y;
    if (s.players.some(p => p.ride === e.id)) e.falling = true;
    if (e.falling) e.vy = Math.min(e.vy + 2, 32);
    e.x -= 8; e.y += e.vy;
    if (e.y > s.lv.h * TS + 64 * SUB) e.dead = true;
  },
});

register('lift_v', {
  init: liftBase,
  update(e) {
    e.prevX = e.x; e.prevY = e.y;
    if (e.home === undefined) e.home = e.y;
    const phase = e.t % 192;                        // 96 frames up, 96 down, 0.5 px/frame
    e.y = e.home - (phase < 96 ? phase : 192 - phase) * 8;
  },
});
```

In `src/game/sim.js`:
- `createLevelSim`: accept `defs` in the options and store `s.defs = defs || {}`, `s.areaStore = {}`. Replace the inline cannon loop from Task 11 with `s.cannons = buildCannons(lv);` (import from `./areas.js`). Add `ride: -1, pipe: null` to the player fields in `createPlayer` (player.js).
- Export the P-switch swap:
```js
export function swapPSwitch(s, on) {
  const lv = s.lv;
  const [a, b, c, d] = on ? [T.BRICK, T.PSWITCH_COIN, T.COIN, T.PSWITCH_BRICK] : [T.PSWITCH_COIN, T.BRICK, T.PSWITCH_BRICK, T.COIN];
  for (let ty = 0; ty < lv.h; ty++) for (let tx = 0; tx < lv.w; tx++) {
    const id = lv.tiles[ty * lv.w + tx];
    if (id === a) setTile(lv, tx, ty, b);
    else if (id === c) setTile(lv, tx, ty, d);
  }
}
```
- In `tickTimer`, replace the P-switch line with: `if (s.pswitch > 0 && --s.pswitch === 0) { swapPSwitch(s, false); s.events.push({ e: 'pswitch-end' }); }`
- In the per-player loop of `stepLevel`, before `updatePlayer`, add: `if (p.pipe) { stepPipe(s, p); continue; }`
- At the end of `afterMove`, add `checkPipesAndDoors(s, p, buttons);`
- After `updateEntities(s);`, add `ridePlatforms(s);`
- Add these functions:
```js
import { enterArea, buildCannons } from './areas.js';

const PIPE_FRAMES = 32;

function stepPipe(s, p) {
  const d = p.pipe.dir, step = 8;
  if (d === 'down') p.y += step; else if (d === 'up') p.y -= step;
  else if (d === 'right') p.x += step; else p.x -= step;
  if (++p.pipe.t < PIPE_FRAMES) return;
  if (p.pipe.phase === 'enter') { const to = p.pipe.to; p.pipe = null; enterArea(s, to); }
  else { p.pipe = null; p.vy = 0; }
}

function checkPipesAndDoors(s, p, buttons) {
  if (p.dead || p.pipe) return;
  const cx = p.x + (p.w * SUB >> 1), foot = p.y + p.h * SUB;
  for (const pp of s.lv.pipes) {
    const [tx, ty] = pp.at;
    let go = false;
    if (pp.dir === 'down') go = (buttons & BTN.DOWN) && p.onGround && foot === ty * TS && cx >= tx * TS + 4 * SUB && cx <= (tx + 2) * TS - 4 * SUB;
    else if (pp.dir === 'up') go = (buttons & BTN.UP) && p.y === (ty + 1) * TS && cx >= tx * TS + 4 * SUB && cx <= (tx + 2) * TS - 4 * SUB;
    else if (pp.dir === 'right') go = (buttons & BTN.RIGHT) && p.onGround && foot === (ty + 2) * TS && p.x + p.w * SUB === tx * TS;
    else if (pp.dir === 'left') go = (buttons & BTN.LEFT) && p.onGround && foot === (ty + 2) * TS && p.x === (tx + 1) * TS;
    if (go) {
      p.pipe = { phase: 'enter', dir: pp.dir, t: 0, to: pp.to };
      p.vx = 0; p.vy = 0; p.carry = -1;
      s.events.push({ e: 'sfx', id: 'pipe' });
      return;
    }
  }
  if (!(buttons & BTN.UP) || !p.onGround) return;
  for (const d of s.lv.doors) {
    const [tx, ty] = d.at;
    if (cx >= tx * TS && cx < (tx + 1) * TS && foot === (ty + 1) * TS) {
      if (d.to.level && d.to.level !== s.lv.id) enterArea(s, d.to);
      else {
        placeAt(p, d.to.at[0], d.to.at[1]);
        s.cams[p.idx] = createCamera(p, s.lv);
      }
      s.events.push({ e: 'sfx', id: 'door' });
      return;
    }
  }
}

function ridePlatforms(s) {
  for (const p of s.players) {
    if (p.dead || p.pipe) continue;
    const prevRide = p.ride;
    p.ride = -1;
    for (const e of s.entities) {
      if (!e.solidTop || e.dead) continue;
      const overX = p.x + p.w * SUB > e.x && p.x < e.x + e.w * SUB;
      if (!overX) continue;
      const foot = p.y + p.h * SUB;
      if (prevRide === e.id && p.vy >= 0) {
        p.x += e.x - (e.prevX ?? e.x);
        p.y = e.y - p.h * SUB;
      } else if (p.vy >= 0 && foot >= (e.prevY ?? e.y) - 2 * SUB && foot - p.vy <= (e.prevY ?? e.y) + 2 * SUB) {
        p.y = e.y - p.h * SUB;
      } else continue;
      p.vy = 0; p.onGround = true; p.ride = e.id;
      break;
    }
  }
}
```
Import `placeAt` from player.js and `createCamera` (already imported).

`src/game/entities/all.js`: add `import './objects.js';`.

- [ ] **Step 4: Run tests**

Run: `bun test` → Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: pipes between areas, P-switch, lifts and doors

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Sprite content, level renderer, font and status bar

**Files:**
- Create: `src/content/sprites/index.js`, `src/content/sprites/player.js`, `src/content/sprites/enemies.js`, `src/content/sprites/items.js`, `src/content/sprites/tiles.js`, `src/content/sprites/ui.js`, `src/draw/art.js`, `src/draw/level.js`, `src/draw/text.js`, `src/draw/hud.js`, `src/draw/gallery.js`
- Modify: `src/engine/render.js` (sprite cache + `blit`)
- Test: `tests/art.test.js`

**Interfaces:**
- Consumes: level state from `sim.js`, `parseGrid`, `bakeRGBA`, entity `TYPES`.
- Produces:
  - `SPRITES: { [name]: string[] }` and `PALS: { [palName]: [i1, i2, i3] }` (NES palette indexes) from `src/content/sprites/index.js`, which merges the per-group files. Each group file exports `{ sprites, pals }`.
  - `blit(ctx, name, palName, x, y, { flipX, flipY })` and `fillNES(ctx, nesIndex, x, y, w, h)` in render.js. Sprites are baked once per (name, palette, flip) and cached.
  - Pure mapping functions in `src/draw/art.js`. Each returns an array of `{ name, pal, dx, dy, flipX?, flipY? }` layers in pixels relative to the body's top-left (an empty array means draw nothing):
    - `tileArt(lv, tx, ty, frame, pswitchOn)`
    - `entityArt(e, frame)`
    - `playerArt(p, frame)`
  - `THEMES: { overworld, underground, fortress, sky, airship }` → `{ bg: nesIndex, ground: palName }`.
  - `drawLevel(ctx, s, camIdx)`: background, scenery, tiles, entities and players for one camera, into the top 200 px.
  - `drawText(ctx, str, x, y, palName = 'text')` using the 8×8 font.
  - `drawHud(ctx, hud)` with `hud = { world, pmeter, flying, coins, lives, score, time, cards: [-1|0|1|2 ×3], who }`, drawn into the bottom 40 px.
  - `index.html?gallery` shows every sprite with its name (for screenshot review).

**Art rules:** 3 colours plus transparency per sprite; facing right by default (the renderer flips); SMB3 style with chunky black outlines, round shapes and bold highlights. All designs are original: Pip and Pep have no moustache, wear a cap with a round leaf emblem and navy overalls; Chompkins are angry acorns; Shellbacks are round-shelled bugs with stubby legs.

**Format example:** `src/content/sprites/player.js` starts like this. Copy the structure for every group file. Every group exports `pals`, `sprites` and `defaultPal`, and optionally `palOf` (per-sprite gallery palette).
```js
export const defaultPal = 'pip';
export const palOf = { 'tail.down': 'tail', 'tail.mid': 'tail', 'tail.up': 'tail', 'tail.out': 'tail', ears: 'tail' };

export const pals = {
  pip: [0x02, 0x16, 0x37],        // navy outline/overalls, red cap/shirt, skin
  pep: [0x02, 0x1A, 0x37],        // green instead of red
  pipFire: [0x16, 0x30, 0x37],
  pepFire: [0x1A, 0x30, 0x37],
  tail: [0x0F, 0x17, 0x27],       // Glide Leaf tail and ears
  star0: [0x0F, 0x16, 0x37], star1: [0x0F, 0x2A, 0x37], star2: [0x0F, 0x28, 0x30], star3: [0x0F, 0x21, 0x37],
};

export const sprites = {
  'small.stand': [
    '................',
    '....111111......',
    '...12222221.....',
    '..1222222221....',
    '..12222111111...',
    '..1113333331....',
    '..1333313331....',
    '..1333313331....',
    '...13333333311..',
    '....1333331.....',
    '...112221111....',
    '..12111111121...',
    '..33111111133...',
    '...1111111111...',
    '...111....111...',
    '..1111....1111..',
  ],
  // ...every other key in the table below
};
```
`src/content/sprites/enemies.js` begins with:
```js
export const pals = {
  chompkin: [0x0F, 0x17, 0x27],
  shellGreen: [0x0F, 0x1A, 0x30], shellRed: [0x0F, 0x16, 0x30], beetle: [0x0F, 0x12, 0x21],
  spike: [0x0F, 0x16, 0x30], snap: [0x0F, 0x16, 0x30], snapStem: [0x0F, 0x1A, 0x2A],
  bone: [0x0F, 0x00, 0x30], ember: [0x16, 0x27, 0x30], disc: [0x0F, 0x16, 0x27], bolt: [0x0F, 0x00, 0x30],
  wing: [0x0F, 0x30, 0x30],
};
export const sprites = {
  'chompkin.walk': [
    '................',
    '.....111111.....',
    '...1122222211...',
    '..122222222221..',
    '..111111111111..',
    '..133333333331..',
    '.13113333331131.',
    '.13313333331331.',
    '.13333333333331.',
    '.13331111113331.',
    '..133313313331..',
    '...1333333331...',
    '....11111111....',
    '...1222..2221...',
    '..12222..22221..',
    '..11111..11111..',
  ],
};
```
`src/content/sprites/tiles.js` begins with the ? block. It animates by cycling the palette `q0..q3`, so one grid is enough:
```js
export const pals = {
  q0: [0x0F, 0x27, 0x30], q1: [0x0F, 0x27, 0x37], q2: [0x0F, 0x27, 0x28], q3: [0x0F, 0x27, 0x37],
  used: [0x0F, 0x17, 0x27], brick: [0x0F, 0x17, 0x27], ground_ow: [0x0F, 0x17, 0x2A],
  ground_ug: [0x0F, 0x12, 0x21], ground_fort: [0x0F, 0x00, 0x10], ground_sky: [0x0F, 0x17, 0x27],
  pipe: [0x0F, 0x1A, 0x2A], wood: [0x0F, 0x17, 0x27], semi: [0x0F, 0x26, 0x30], cloud: [0x0F, 0x30, 0x31],
  note: [0x0F, 0x30, 0x10], lava: [0x16, 0x27, 0x37], cannon: [0x0F, 0x00, 0x10], goal: [0x0F, 0x30, 0x27],
  coin: [0x0F, 0x28, 0x30], door: [0x0F, 0x17, 0x27], bush: [0x0F, 0x1A, 0x2A], hill: [0x0F, 0x1A, 0x39],
};
export const sprites = {
  'qblock': [
    '.11111111111111.',
    '1222222222222221',
    '1232222222222321',
    '1222223333222221',
    '1222233223322221',
    '1222222223322221',
    '1222222233222221',
    '1222222332222221',
    '1222222332222221',
    '1222222222222221',
    '1222222332222221',
    '1222222222222221',
    '1222222222222221',
    '1232222222222321',
    '1222222222222221',
    '.11111111111111.',
  ],
};
```

**Required sprites** (name — size — palette(s) — what it shows). Every name below must exist in `SPRITES`:

| Group | Names | Size | Palettes | Description |
|---|---|---|---|---|
| player | `small.stand`, `small.walk1`, `small.walk2`, `small.run1`, `small.run2`, `small.jump`, `small.skid`, `small.kick`, `small.hold`, `small.front`, `small.die` | 16×16 | pip, pep, star0-3 | Pip small. Walk has 3 poses (stand, walk1, walk2). Run is arms-out. Jump has a fist up. Skid leans back. Front is for pipes. Die faces front with arms up. |
| player | `big.stand`, `big.walk1`, `big.walk2`, `big.run1`, `big.run2`, `big.jump`, `big.skid`, `big.crouch`, `big.slide`, `big.kick`, `big.hold`, `big.throw`, `big.front`, `big.grow` | 16×32 | pip, pep, pipFire, pepFire, star0-3 | Same poses at 2 heads tall. Crouch is 16×32 with the body in the bottom 16 rows. Grow is the halfway frame shown while changing size. |
| player | `tail.down`, `tail.mid`, `tail.up`, `tail.out`, `ears` | 16×16 (ears 16×8) | tail | Glide Leaf squirrel tail, drawn behind the body. `out` is the spin-attack pose. Ears sit on the cap. |
| enemies | `chompkin.walk`, `chompkin.squish` (16×8) | 16×16 | chompkin | Walk animates by flipping every 8 frames. |
| enemies | `wing.up`, `wing.down` | 8×8 | wing | Wings for parachompkin and winged shellback. |
| enemies | `shellback.walk1`, `shellback.walk2` | 16×24 | shellGreen, shellRed | Upright bug with a dome shell, head on top. |
| enemies | `shell.idle`, `shell.spin1`, `shell.spin2`, `shell.spin3`, `shell.peek` | 16×16 | shellGreen, shellRed, beetle | Shell. Peek has legs poking out (last 60 frames before it wakes). |
| enemies | `beetle.walk1`, `beetle.walk2` | 16×16 | beetle | Bumble Beetle, a low dome. |
| enemies | `spikebug.walk1`, `spikebug.walk2` | 16×16 | spike | Spiked shell. |
| enemies | `snap.open`, `snap.closed`, `snap.stem` | 16×16 (stem 16×8) | snap, snapStem | Pipe plant head and stem. The fire version uses the same head tilted, flipped by aim. |
| enemies | `enemyfire.1`, `enemyfire.2` | 8×8 | ember | Plant fireball. |
| enemies | `boombolt` | 16×14 | bolt | Bullet with eyes and fists. |
| enemies | `ember.1`, `ember.2` | 16×16 | ember | Lava fireball with eyes. |
| enemies | `disc.1`, `disc.2` | 12×12 | disc | Rotodisc glow. |
| enemies | `bone.walk1`, `bone.walk2` (16×24), `bone.pile` (16×16) | — | bone | Bone Shell. |
| items | `berry`, `blossom.1`, `blossom.2`, `leaf`, `star.1`, `star.2`, `coin.1`…`coin.4`, `fireball.1`, `fireball.2`, `brickbit`, `puff.1`, `puff.2`, `pswitch`, `pswitch.pressed` | 16×16 (fireball/brickbit 8×8, pressed 16×8) | berry, oneup, blossom, leaf, star, coin, fire, brick, puff, pswitch | Power-ups and effects. The 1-Up uses `berry` with the `oneup` palette. |
| tiles | `ground.top`, `ground.fill`, `brick`, `qblock`, `used`, `wood`, `semi.top`, `semi.fill`, `cloud`, `pipe.tl`, `pipe.tr`, `pipe.l`, `pipe.r`, `pipe.side.t`, `pipe.side.b`, `pipe.sidebody.t`, `pipe.sidebody.b`, `slope45up`, `slope45dn`, `gentle.up.lo`, `gentle.up.hi`, `gentle.dn.hi`, `gentle.dn.lo`, `note`, `lava.1`, `lava.2`, `cannon.top`, `cannon.base`, `door.top`, `door.bottom`, `coin.tile` | 16×16 | per tile, see `pals` above | Slopes are drawn as their ground surface with fill below. The pipe side variants are used when a pipe tile's neighbours show it is horizontal. |
| tiles | `goal.frame` (32×32), `bush` (32×16), `hill` (48×32), `bgcloud` (32×24) | — | goal, bush, hill, cloud | Goal box with a card window. Striped SMB3-style scenery. |
| ui | `font.0`…`font.9`, `font.A`…`font.Z`, `font.!`, `font.?`, `font.-`, `font.x`, `font.$`, `font.:`, `font./`, `font..`, `font.,`, `font.'`, `font.heart` | 8×8 | text, textDark, textRed | Font. Digits and capitals; `x` is the lives "×". |
| ui | `hud.arrow`, `hud.arrowOn`, `hud.p`, `hud.pOn`, `card.empty`, `card.berry`, `card.blossom`, `card.star`, `face.pip`, `face.pep` | 8×8 (cards 24×24, faces 16×8) | hud, card | Status bar parts. |

- [ ] **Step 1: Write the failing test**

`tests/art.test.js`:
```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/art.test.js` → Expected: FAIL, modules not found.

- [ ] **Step 3: Implement code**

Add to `src/engine/render.js`:
```js
import { SPRITES, PALS } from '../content/sprites/index.js';
import { parseGrid, bakeRGBA } from './sprites.js';
import { PALETTE } from './palette.js';

const parsed = new Map(), baked = new Map();

function spriteCanvas(name, palName, flipX) {
  const key = `${name}|${palName}|${flipX ? 1 : 0}`;
  let c = baked.get(key);
  if (c) return c;
  let sp = parsed.get(name);
  if (!sp) { sp = parseGrid(SPRITES[name], name); parsed.set(name, sp); }
  c = document.createElement('canvas');
  c.width = sp.w; c.height = sp.h;
  c.getContext('2d').putImageData(new ImageData(bakeRGBA(sp, PALS[palName], flipX), sp.w, sp.h), 0, 0);
  baked.set(key, c);
  return c;
}

export function blit(ctx, name, palName, x, y, { flipX = false, flipY = false } = {}) {
  const c = spriteCanvas(name, palName, flipX);
  x = Math.round(x); y = Math.round(y);
  if (!flipY) { ctx.drawImage(c, x, y); return; }
  ctx.save(); ctx.translate(x, y + c.height); ctx.scale(1, -1); ctx.drawImage(c, 0, 0); ctx.restore();
}

export function fillNES(ctx, idx, x, y, w, h) {
  ctx.fillStyle = PALETTE[idx];
  ctx.fillRect(x, y, w, h);
}
```

`src/content/sprites/index.js`:
```js
import * as player from './player.js';
import * as enemies from './enemies.js';
import * as items from './items.js';
import * as tiles from './tiles.js';
import * as ui from './ui.js';

const groups = [player, enemies, items, tiles, ui];
export const SPRITES = Object.assign({}, ...groups.map(g => g.sprites));
export const PALS = Object.assign({}, ...groups.map(g => g.pals));
// Palette used to show each sprite in the gallery: the group's `palOf[name]`, else its `defaultPal`.
export const GALLERY_PAL = Object.fromEntries(groups.flatMap(g =>
  Object.keys(g.sprites).map(n => [n, (g.palOf && g.palOf[n]) || g.defaultPal])));
```

`src/draw/art.js`:
```js
import { T, INFO } from '../game/tiles.js';
import { tileAt } from '../game/level.js';
import { SUB } from '../game/consts.js';

export const THEMES = {
  overworld: { bg: 0x31, ground: 'ground_ow' },
  underground: { bg: 0x0F, ground: 'ground_ug' },
  fortress: { bg: 0x0F, ground: 'ground_fort' },
  sky: { bg: 0x21, ground: 'ground_sky' },
  airship: { bg: 0x01, ground: 'wood' },
};

const L = (name, pal, dx = 0, dy = 0, extra = {}) => ({ name, pal, dx, dy, ...extra });
const isGroundish = (id) => id === T.GROUND || INFO[id].slope;

export function tileArt(lv, tx, ty, frame, pswitchOn) {
  const id = tileAt(lv, tx, ty);
  const g = THEMES[lv.theme]?.ground || 'ground_ow';
  const q = `q${(frame >> 3) & 3}`;
  switch (id) {
    case T.EMPTY: case T.HIDDEN_1UP: case T.GOAL: return [];
    case T.GROUND: return [L(isGroundish(tileAt(lv, tx, ty - 1)) ? 'ground.fill' : 'ground.top', g)];
    case T.BRICK: case T.BRICK_COINS: case T.BRICK_PSWITCH: case T.PSWITCH_BRICK: return [L('brick', 'brick')];
    case T.Q_COIN: case T.Q_POWER: case T.Q_LEAF: case T.Q_1UP: case T.Q_STAR: return [L('qblock', q)];
    case T.USED: case T.HARD: return [L('used', 'used')];
    case T.WOOD: return [L('wood', 'wood')];
    case T.SEMI: return [L(tileAt(lv, tx, ty - 1) === T.SEMI ? 'semi.fill' : 'semi.top', 'semi')];
    case T.CLOUD: return [L('cloud', 'cloud')];
    case T.COIN: case T.PSWITCH_COIN: return [L(`coin.${1 + ((frame >> 3) & 3)}`, 'coin')];
    case T.NOTE: return [L('note', 'note')];
    case T.PIPE_TL: return [L('pipe.tl', 'pipe')];
    case T.PIPE_TR: return [L('pipe.tr', 'pipe')];
    case T.PIPE_L: return [L('pipe.l', 'pipe')];
    case T.PIPE_R: return [L('pipe.r', 'pipe')];
    case T.SLOPE45_UP: return [L('slope45up', g)];
    case T.SLOPE45_DN: return [L('slope45dn', g)];
    case T.GENTLE_UP_LO: return [L('gentle.up.lo', g)];
    case T.GENTLE_UP_HI: return [L('gentle.up.hi', g)];
    case T.GENTLE_DN_HI: return [L('gentle.dn.hi', g)];
    case T.GENTLE_DN_LO: return [L('gentle.dn.lo', g)];
    case T.LAVA: return [L(`lava.${1 + ((frame >> 4) & 1)}`, 'lava')];
    case T.CANNON: return [L(tileAt(lv, tx, ty - 1) === T.CANNON ? 'cannon.base' : 'cannon.top', 'cannon')];
    case T.DOOR: return [L(tileAt(lv, tx, ty - 1) === T.DOOR ? 'door.bottom' : 'door.top', 'door')];
    default: return [];
  }
}

const walkFrame = (e, frame) => ((frame >> 3) & 1) === 0;
const shellPal = (type) => (type === 'shellback_red' ? 'shellRed' : type === 'bumblebeetle' ? 'beetle' : 'shellGreen');

export function entityArt(e, frame) {
  const flipX = e.dir > 0;
  const flipY = e.state === 'flipped';
  const f2 = (a, b) => (((frame >> 3) & 1) ? b : a);
  switch (e.type) {
    case 'chompkin':
    case 'parachompkin': {
      if (e.state === 'squished') return [L('chompkin.squish', 'chompkin', -1, 8)];
      const body = L('chompkin.walk', 'chompkin', -1, -2, { flipX: walkFrame(e, frame), flipY });
      if (e.type !== 'parachompkin') return [body];
      const w = f2('wing.up', 'wing.down');
      return [L(w, 'wing', -6, -4), L(w, 'wing', 12, -4, { flipX: true }), body];
    }
    case 'shellback_green': case 'shellback_red': case 'shellback_winged': case 'bumblebeetle': {
      const pal = shellPal(e.type);
      if (e.state === 'walk' || e.state === 'fly') {
        const name = e.type === 'bumblebeetle' ? f2('beetle.walk1', 'beetle.walk2') : f2('shellback.walk1', 'shellback.walk2');
        const body = L(name, pal, -1, e.type === 'bumblebeetle' ? -2 : 0, { flipX, flipY });
        return e.state === 'fly' ? [L(f2('wing.up', 'wing.down'), 'wing', flipX ? -4 : 10, 2, { flipX: !flipX }), body] : [body];
      }
      if (e.state === 'slide') return [L(`shell.spin${1 + ((frame >> 2) % 3)}`, pal, -1, -2, { flipY })];
      const peek = e.state === 'shell' && e.wake > 420;
      return [L(peek ? 'shell.peek' : 'shell.idle', pal, -1, -2, { flipY })];
    }
    case 'spikebug': return [L(f2('spikebug.walk1', 'spikebug.walk2'), 'spike', -1, -2, { flipX, flipY })];
    case 'snapvine': case 'firesnapvine':
      return [L(e.type === 'snapvine' ? f2('snap.open', 'snap.closed') : 'snap.open', 'snap', 0, 0, { flipX }), L('snap.stem', 'snapStem', 0, 16)];
    case 'enemyfire': return [L(f2('enemyfire.1', 'enemyfire.2'), 'ember', 0, 0)];
    case 'boombolt': return [L('boombolt', 'bolt', 0, 0, { flipX: e.vx > 0, flipY })];
    case 'ember': return [L(f2('ember.1', 'ember.2'), 'ember', -2, -1, { flipY: e.vy > 0 })];
    case 'rotodisc': return [L(f2('disc.1', 'disc.2'), 'disc', 0, 0)];
    case 'boneshell':
      if (e.state === 'collapsed') return [L('bone.pile', 'bone', -1, 8)];
      return [L(f2('bone.walk1', 'bone.walk2'), 'bone', -1, 0, { flipX, flipY })];
    case 'berry': return [L('berry', 'berry', -1, 0)];
    case 'oneup': return [L('berry', 'oneup', -1, 0)];
    case 'blossom': return [L(f2('blossom.1', 'blossom.2'), 'blossom', -1, 0)];
    case 'leaf': return [L('leaf', 'leaf', -1, -1, { flipX: e.vx > 0 })];
    case 'star': return [L(f2('star.1', 'star.2'), 'star', -1, 0)];
    case 'coinpop': return [L(`coin.${1 + ((frame >> 2) & 3)}`, 'coin', -4, 0)];
    case 'brickbit': return [L('brickbit', 'brick', 0, 0, { flipX: ((frame >> 2) & 1) === 1 })];
    case 'fireball': return [L(f2('fireball.1', 'fireball.2'), 'fire', 0, 0, { flipX: ((frame >> 2) & 1) === 1 })];
    case 'puff': return [L(e.t < 6 ? 'puff.1' : 'puff.2', 'puff', -4, -4)];
    case 'pswitch': return [L(e.state === 'pressed' ? 'pswitch.pressed' : 'pswitch', 'pswitch', 0, e.state === 'pressed' ? 8 : 0)];
    case 'lift_h': case 'lift_v': return [0, 16, 32].map(dx => L('wood', 'wood', dx, -8));
    case 'popup': return [];          // drawn as text by drawLevel
    default: return [];
  }
}

export function playerArt(p, frame) {
  const pal = p.starTimer > 0 ? `star${(frame >> 1) & 3}`
    : (p.form === 'fire' ? (p.idx ? 'pepFire' : 'pipFire') : (p.idx ? 'pep' : 'pip'));
  if (p.hurtTimer > 0 && (frame & 2)) return [];             // flicker while invulnerable
  const big = p.form !== 'small';
  const size = big ? 'big' : 'small';
  const flipX = p.dir < 0;
  let pose;
  if (p.dead) pose = 'small.die';
  else if (p.growTimer > 0) pose = (frame >> 2) & 1 ? 'big.grow' : 'small.stand';
  else if (p.pipe) pose = `${size}.front`;
  else if (p.kickTimer > 0) pose = `${size}.kick`;
  else if (p.carry >= 0) pose = `${size}.hold`;
  else if (big && p.fireCooldown > 6) pose = 'big.throw';
  else {
    const cyc = (p.animT >> 3) % 3;
    const a = p.anim;
    pose = a === 'walk' ? `${size}.${['stand', 'walk1', 'walk2'][cyc]}`
      : a === 'run' ? `${size}.${(p.animT >> 2) & 1 ? 'run1' : 'run2'}`
      : a === 'jump' || a === 'runjump' ? `${size}.jump`
      : a === 'skid' ? `${size}.skid`
      : a === 'crouch' && big ? 'big.crouch'
      : a === 'slide' && big ? 'big.slide'
      : `${size}.stand`;
  }
  const dy = (p.h - (pose.startsWith('big') ? 32 : 16));
  const out = [];
  if (p.form === 'leaf' && !p.dead && p.growTimer === 0) {
    const tail = p.tailTimer > 6 ? 'tail.out' : p.flyTimer > 0 || p.floatTimer > 0 ? ((frame >> 2) & 1 ? 'tail.up' : 'tail.mid') : 'tail.down';
    out.push(L(tail, 'tail', flipX ? 8 : -10, dy + 14, { flipX }));
  }
  out.push(L(pose, pal, -2, dy, { flipX }));
  if (p.form === 'leaf' && !p.dead && p.growTimer === 0) out.push(L('ears', 'tail', -2, dy - 2, { flipX }));
  return out;
}

export const popupText = (e) => e.label || String(e.pts);
export const px = (sub) => Math.floor(sub / SUB);
```

`src/draw/text.js`:
```js
import { blit } from '../engine/render.js';
import { SPRITES } from '../content/sprites/index.js';

const NAMES = { 'x': 'font.x', '$': 'font.$', ':': 'font.:', '/': 'font./', '.': 'font..', ',': 'font.,', "'": 'font.\'', '!': 'font.!', '?': 'font.?', '-': 'font.-', '♥': 'font.heart' };

export function drawText(ctx, str, x, y, pal = 'text') {
  for (const ch of String(str)) {
    const name = NAMES[ch] || `font.${ch.toUpperCase()}`;
    if (ch !== ' ' && SPRITES[name]) blit(ctx, name, pal, x, y);
    x += 8;
  }
}
```

`src/draw/level.js`:
```js
import { blit, fillNES } from '../engine/render.js';
import { tileArt, entityArt, playerArt, THEMES, popupText } from './art.js';
import { drawText } from './text.js';
import { SUB, SCREEN_W, PLAY_H } from '../game/consts.js';
import { T } from '../game/tiles.js';
import { tileAt } from '../game/level.js';

const drawLayers = (ctx, layers, x, y) => {
  for (const l of layers) blit(ctx, l.name, l.pal, x + l.dx, y + l.dy, { flipX: l.flipX, flipY: l.flipY });
};

function drawScenery(ctx, lv, cam) {
  if (lv.theme !== 'overworld' && lv.theme !== 'sky') return;
  // Deterministic scenery: a hill or bush every 7-13 tiles on the lowest ground surface, clouds above.
  const groundRow = lv.h - 2;
  for (let tx = Math.floor(cam.x / 16) - 4; tx < (cam.x + SCREEN_W) / 16 + 1; tx++) {
    const h = (tx * 2654435761) >>> 0;
    const sx = tx * 16 - cam.x;
    if (h % 11 === 0) blit(ctx, 'bgcloud', 'cloud', sx, 24 + ((h >> 8) % 48) - cam.y);
    if (lv.theme === 'overworld' && h % 13 === 0) blit(ctx, 'hill', 'hill', sx, groundRow * 16 - 16 - cam.y);
    else if (lv.theme === 'overworld' && h % 7 === 0) blit(ctx, 'bush', 'bush', sx, groundRow * 16 - cam.y);
  }
}

export function drawLevel(ctx, s, camIdx) {
  const cam = s.cams[camIdx], lv = s.lv, frame = s.frame;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, SCREEN_W, PLAY_H); ctx.clip();
  fillNES(ctx, THEMES[lv.theme]?.bg ?? 0x31, 0, 0, SCREEN_W, PLAY_H);
  drawScenery(ctx, lv, cam);

  // Players inside pipes are drawn behind tiles.
  for (const p of s.players) if (p.pipe) drawLayers(ctx, playerArt(p, frame), p.x / SUB - cam.x, p.y / SUB - cam.y);

  const tx0 = Math.floor(cam.x / 16), ty0 = Math.floor(cam.y / 16);
  for (let ty = ty0; ty <= ty0 + 13; ty++) for (let tx = tx0; tx <= tx0 + 16; tx++) {
    const bump = s.bumps.find(b => b.tx === tx && b.ty === ty);
    const lift = bump ? Math.min(bump.t, 8 - bump.t) : 0;
    drawLayers(ctx, tileArt(lv, tx, ty, frame, s.pswitch > 0), tx * 16 - cam.x, ty * 16 - cam.y - lift);
  }
  // Goal box: first GOAL tile column draws the frame and a cycling card.
  for (let ty = ty0; ty <= ty0 + 13; ty++) for (let tx = tx0; tx <= tx0 + 16; tx++) {
    if (tileAt(lv, tx, ty) !== T.GOAL) continue;
    if (tileAt(lv, tx, ty - 1) === T.GOAL || tileAt(lv, tx - 1, ty) === T.GOAL) continue;
    const x = tx * 16 - cam.x, y = ty * 16 - cam.y;
    blit(ctx, 'goal.frame', 'goal', x, y);
    const card = s.clear ? s.clear.card : Math.floor(frame / 8) % 3;
    blit(ctx, ['card.berry', 'card.blossom', 'card.star'][card], 'card', x + 4, y + 4);
  }

  for (const e of s.entities) {
    const x = e.x / SUB - cam.x, y = e.y / SUB - cam.y;
    if (x < -48 || x > SCREEN_W + 48) continue;
    if (e.type === 'popup') { drawText(ctx, popupText(e), x, y, 'text'); continue; }
    drawLayers(ctx, entityArt(e, frame), x, y);
  }
  for (const p of s.players) if (!p.pipe) drawLayers(ctx, playerArt(p, frame), p.x / SUB - cam.x, p.y / SUB - cam.y);
  ctx.restore();
}
```

`src/draw/hud.js`:
```js
import { blit, fillNES } from '../engine/render.js';
import { drawText } from './text.js';

// SMB3-style status bar in the bottom 40 px.
export function drawHud(ctx, h) {
  fillNES(ctx, 0x0F, 0, 200, 256, 40);
  fillNES(ctx, 0x27, 8, 206, 168, 28);
  fillNES(ctx, 0x0F, 10, 208, 164, 24);
  drawText(ctx, `WORLD ${h.world}`, 14, 211);
  for (let i = 0; i < 6; i++) blit(ctx, h.pmeter > i ? 'hud.arrowOn' : 'hud.arrow', 'hud', 82 + i * 8, 211);
  const pOn = h.pmeter >= 7 && (h.flying ? true : (Date.now() >> 7) & 1);
  blit(ctx, pOn ? 'hud.pOn' : 'hud.p', 'hud', 130, 211);
  drawText(ctx, `$${String(h.coins).padStart(2, ' ')}`, 146, 211);
  blit(ctx, h.who ? 'face.pep' : 'face.pip', h.who ? 'pep' : 'pip', 14, 222);
  drawText(ctx, `x${String(h.lives).padStart(2, ' ')}`, 32, 222);
  drawText(ctx, String(h.score).padStart(7, '0'), 64, 222);
  drawText(ctx, String(h.time).padStart(3, '0'), 146, 222);
  for (let i = 0; i < 3; i++) {
    const c = h.cards[i];
    blit(ctx, c < 0 ? 'card.empty' : ['card.berry', 'card.blossom', 'card.star'][c], 'card', 180 + i * 24, 208);
  }
}
```
The P blink is presentation-only, so using `Date.now()` here is allowed (this is `src/draw/`, not `src/game/`).

`src/draw/gallery.js`:
```js
import { SPRITES, GALLERY_PAL } from '../content/sprites/index.js';
import { blit, fillNES } from '../engine/render.js';
import { drawText } from './text.js';

// Draws every sprite in a grid, 24 per page, for screenshot review.
export function drawGallery(ctx, page) {
  fillNES(ctx, 0x2D, 0, 0, 256, 240);
  const names = Object.keys(SPRITES), per = 24;
  names.slice(page * per, page * per + per).forEach((n, i) => {
    const x = (i % 6) * 42 + 4, y = Math.floor(i / 6) * 58 + 4;
    blit(ctx, n, GALLERY_PAL[n], x, y);
    drawText(ctx, n.slice(0, 5), x, y + 34);
  });
  drawText(ctx, `PAGE ${page + 1}/${Math.ceil(names.length / per)}`, 4, 228);
}
```

- [ ] **Step 4: Author the sprite content**

Write every sprite in the Required sprites table into its group file, plus palettes `berry`, `oneup`, `blossom`, `leaf`, `star`, `fire`, `puff`, `pswitch`, `text`, `textDark`, `textRed`, `hud`, `card`. Draw in the SMB3 style described above. Keep designs original: no moustache, no "M" emblems, no copied silhouettes.

Run: `bun test tests/art.test.js` → Expected: all pass. A failure names the missing sprite or palette; add it and re-run.

- [ ] **Step 5: Visual review**

Temporarily make `src/main.js` call `drawGallery(ctx, page)` when `location.search` contains `gallery`, with arrow keys changing the page. Then:
```bash
bun run dev &   # port 5190
B=~/.claude/skills/gstack/browse/dist/browse
$B goto "http://localhost:5190/?gallery&v=$RANDOM"
$B screenshot --viewport /tmp/claude-502/gallery-1.png
```
Read each page's screenshot. Check that every sprite reads clearly at 1× and stays within 3 colours, and that Pip/Pep look consistent across poses. Fix and re-shoot until it looks right. Keep the gallery hook (Task 15 wires it into the real `main.js`).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: SMB3-style sprite set, level renderer, font and status bar

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: Sound chip, original music and sound effects

**Files:**
- Create: `src/engine/audio.js`, `src/content/music.js`
- Test: `tests/audio.test.js`

**Interfaces:**
- Produces:
  - `noteFreq(name: 'C#5'): number`
  - `parseTrack(str): [{ beat, dur, note }]`. Durations are in quarter-note beats. `note` is a name, `null` for a rest, or a noise drum letter `k`/`s`/`h`.
  - `trackBeats(str): number`
  - `createAudio(): { unlock(), playSong(id), stopSong(), sfx(id), setTempoScale(x), setMuted(bool), get muted }`. It creates an AudioContext lazily on `unlock()`, which must be called from a key or click handler.
  - `SONGS: { [id]: { bpm, loop, p1, p2, tri, noise } }` (channel strings may be empty).
  - `SFX: { [id]: { sweep?: { from, to, dur, wave, duty }, notes?: string, bpm?, noise?: { dur, rate } } }`.
  - `SFX_IDS`: every sfx id the sim emits. Every one must exist in `SFX`.

**Notation:** tokens separated by spaces; `|` is a bar line and is ignored. A note is `NAME OCTAVE / DENOM`, for example `C#5/8` (an eighth note). `/4.` is dotted. `r/8` is a rest. Noise tokens are `k/8` (kick), `s/8` (snare), `h/16` (hat). The denominator can be any integer, so `/12` gives triplets.

- [ ] **Step 1: Write the failing test**

`tests/audio.test.js`:
```js
import { test, expect } from 'bun:test';
import { noteFreq, parseTrack, trackBeats } from '../src/engine/audio.js';
import { SONGS, SFX, SFX_IDS } from '../src/content/music.js';

test('note frequencies', () => {
  expect(noteFreq('A4')).toBeCloseTo(440, 5);
  expect(noteFreq('A5')).toBeCloseTo(880, 5);
  expect(noteFreq('C4')).toBeCloseTo(261.626, 2);
});

test('parseTrack handles rests, dots, bars and triplets', () => {
  const ev = parseTrack('C5/4 r/8 E5/8. | G5/12');
  expect(ev.map(e => e.note)).toEqual(['C5', null, 'E5', 'G5']);
  expect(ev.map(e => e.dur)).toEqual([1, 0.5, 0.75, 1 / 3]);
  expect(ev[2].beat).toBe(1.5);
  expect(trackBeats('C5/4 r/8 E5/8. | G5/12')).toBeCloseTo(2.5833, 3);
});

test('every song parses and looping channels line up on whole bars', () => {
  for (const [id, song] of Object.entries(SONGS)) {
    const lens = ['p1', 'p2', 'tri', 'noise'].filter(c => song[c]).map(c => trackBeats(song[c]));
    expect(lens.length).toBeGreaterThan(0);
    if (song.loop) {
      for (const l of lens) expect(l).toBeCloseTo(lens[0], 6);
      expect(lens[0] % 4).toBeCloseTo(0, 6);
    }
  }
});

test('every sound the game emits exists', () => {
  for (const id of SFX_IDS) expect(SFX[id]).toBeDefined();
});

test('songs needed by stage 1 exist', () => {
  for (const id of ['title', 'map1', 'overworld', 'underground', 'sky', 'fortress', 'airship', 'boss', 'star', 'pswitch', 'hut', 'clear', 'death', 'gameover', 'worldclear', 'fortressclear']) {
    expect(SONGS[id]).toBeDefined();
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/audio.test.js` → Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/content/music.js` (all compositions are original):
```js
const rep = (s, n) => Array(n).fill(s).join(' ');

export const SONGS = {
  title: { bpm: 120, loop: true,
    p1: 'G4/8 C5/8 E5/8 G5/8 E5/4 C5/4 | A4/8 D5/8 F5/8 A5/8 F5/2 | G4/8 C5/8 E5/8 G5/8 C6/4 B5/4 | A5/8 G5/8 F5/8 D5/8 C5/2',
    p2: 'E4/1 | F4/1 | E4/1 | F4/2 E4/2',
    tri: 'C3/2 G2/2 | D3/2 A2/2 | C3/2 E3/2 | F2/2 C3/2' },
  map1: { bpm: 110, loop: true,
    p1: 'C5/4 E5/8 D5/8 C5/4 G4/4 | A4/4 C5/8 B4/8 A4/4 E4/4 | F4/4 A4/8 G4/8 F4/4 C5/4 | B4/8 C5/8 D5/8 B4/8 C5/2',
    tri: 'C3/4 r/4 G2/4 r/4 | A2/4 r/4 E2/4 r/4 | F2/4 r/4 C3/4 r/4 | G2/4 r/4 C3/2',
    noise: rep('h/4', 16) },
  overworld: { bpm: 150, loop: true,
    p1: 'E5/8 G5/8 C6/4 B5/8 G5/8 A5/4 | F5/8 A5/8 D6/4 C6/8 A5/8 B5/4 | E5/8 G5/8 C6/8 E6/8 D6/8 C6/8 B5/8 A5/8 | G5/8 E5/8 F5/8 D5/8 C5/2',
    p2: 'C5/8 E5/8 G5/4 G5/8 E5/8 F5/4 | D5/8 F5/8 A5/4 A5/8 F5/8 G5/4 | C5/8 E5/8 G5/8 C6/8 B5/8 A5/8 G5/8 F5/8 | E5/8 C5/8 D5/8 B4/8 E4/2',
    tri: 'C3/4 G3/4 C3/4 G3/4 | D3/4 A3/4 G3/4 D3/4 | C3/4 G3/4 C3/4 G3/4 | G2/4 G3/4 C3/2',
    noise: rep('k/8 h/8 s/8 h/8', 8) },
  sky: { bpm: 140, loop: true,
    p1: 'G5/8 E5/8 C5/8 E5/8 G5/4 A5/4 | F5/8 D5/8 B4/8 D5/8 F5/4 G5/4 | E5/8 C5/8 A4/8 C5/8 E5/4 F5/4 | D5/8 E5/8 F5/8 D5/8 C5/2',
    tri: 'C3/2 E3/2 | B2/2 G2/2 | A2/2 C3/2 | G2/2 C3/2',
    noise: rep('h/8 h/8 s/8 h/8', 8) },
  underground: { bpm: 130, loop: true,
    p1: 'A4/8 r/8 A4/8 C5/8 r/8 E5/8 D5/8 C5/8 | G4/8 r/8 G4/8 B4/8 r/8 D5/8 C5/8 B4/8 | F4/8 r/8 F4/8 A4/8 r/8 C5/8 B4/8 A4/8 | E4/8 G#4/8 B4/8 E5/8 D5/4 r/4',
    tri: 'A2/4 r/4 A2/4 r/4 | G2/4 r/4 G2/4 r/4 | F2/4 r/4 F2/4 r/4 | E2/4 r/4 E2/4 E3/4',
    noise: rep('h/4', 16) },
  fortress: { bpm: 140, loop: true,
    p1: 'D5/8 D5/8 F5/8 D5/8 G#5/4 G5/4 | D5/8 D5/8 F5/8 D5/8 C#5/2 | D5/8 D5/8 F5/8 D5/8 A5/4 G#5/4 | F5/8 E5/8 D5/8 C#5/8 D5/2',
    tri: `${rep('D2/8 D3/8', 12)} ${rep('A1/8 A2/8', 4)}`,
    noise: rep('k/8 r/8 k/8 r/8 s/4 r/4', 4) },
  airship: { bpm: 160, loop: true,
    p1: 'G4/8 A#4/8 D5/8 A#4/8 G5/4 F5/4 | D#5/8 D5/8 C5/8 A#4/8 C5/2 | G4/8 A#4/8 D5/8 A#4/8 G5/4 A5/4 | A#5/8 A5/8 G5/8 F#5/8 G5/2',
    p2: 'D4/4 D4/4 D4/4 D4/4 | C4/4 C4/4 D4/4 D4/4 | D4/4 D4/4 D4/4 D4/4 | D4/4 C4/4 B3/2',
    tri: `${rep('G2/8 G2/8 G3/8 G2/8', 6)} ${rep('D2/8 D2/8 D3/8 D2/8', 2)}`,
    noise: rep('k/8 h/8 s/8 h/8', 8) },
  boss: { bpm: 180, loop: true,
    p1: 'E5/16 F5/16 E5/16 D#5/16 E5/8 B4/8 C5/8 B4/8 A4/8 G#4/8 | A4/16 B4/16 A4/16 G#4/16 A4/8 E4/8 F4/8 E4/8 D4/8 E4/8',
    tri: `${rep('E2/8 E3/8', 4)} ${rep('A1/8 A2/8', 4)}`,
    noise: rep('k/16 h/16 h/16 h/16', 8) },
  star: { bpm: 170, loop: true,
    p1: 'C5/8 C5/8 C5/8 D5/16 C5/16 r/8 C5/8 D5/8 E5/8 | B4/8 B4/8 B4/8 C5/16 B4/16 r/8 B4/8 C5/8 D5/8',
    tri: `${rep('C3/8 C4/8', 4)} ${rep('G2/8 G3/8', 4)}`,
    noise: rep('k/8 s/8', 8) },
  pswitch: { bpm: 150, loop: true,
    p1: 'C6/16 r/16 C6/16 r/16 A5/16 r/16 A5/16 r/16 B5/16 r/16 B5/16 r/16 G5/16 r/16 G5/16 r/16',
    tri: 'C3/4 A2/4 B2/4 G2/4',
    noise: rep('h/8', 8) },
  hut: { bpm: 130, loop: true,
    p1: 'E5/8 C5/8 G5/8 C5/8 A5/8 C5/8 G5/4 | F5/8 D5/8 E5/8 C5/8 D5/2',
    tri: 'C3/4 G3/4 C3/4 G3/4 | G2/4 D3/4 G2/2' },
  clear: { bpm: 150, loop: false,
    p1: 'C5/16 E5/16 G5/16 C6/16 E6/16 G6/16 E6/4 r/8 F5/16 A5/16 C6/16 F6/16 A6/16 C7/16 A6/4',
    tri: 'C3/2 r/8 F3/2' },
  fortressclear: { bpm: 140, loop: false,
    p1: 'D5/8 F5/8 A5/8 D6/4 r/8 C6/8 A#5/8 C6/8 D6/2',
    tri: 'D3/2 r/4 A#2/4 D3/2' },
  worldclear: { bpm: 140, loop: false,
    p1: 'G4/8 C5/8 E5/8 G5/8 C6/8 E6/8 G6/4 E6/4 | A5/8 C6/8 F6/8 A6/8 G6/2',
    tri: 'C3/2 E3/2 | F3/2 C3/2' },
  death: { bpm: 120, loop: false,
    p1: 'B4/16 F5/16 r/16 F5/16 F5/12 E5/12 D5/12 C5/4 E4/4 C4/4' },
  gameover: { bpm: 110, loop: false,
    p1: 'C5/4 G4/4 E4/4 A4/8 B4/8 A4/8 G#4/8 A#4/8 G#4/8 G4/8 D4/8 E4/2' },
};

export const SFX = {
  jump: { sweep: { from: 300, to: 900, dur: 0.1, wave: 'pulse', duty: 0.25 } },
  bump: { sweep: { from: 200, to: 110, dur: 0.07, wave: 'triangle' } },
  coin: { notes: 'B5/32 E6/8', bpm: 150 },
  '1up': { notes: 'E5/16 G5/16 E6/16 C6/16 D6/16 G6/16', bpm: 150 },
  stomp: { sweep: { from: 600, to: 180, dur: 0.08, wave: 'pulse', duty: 0.5 }, noise: { dur: 0.05, rate: 1 } },
  kick: { sweep: { from: 900, to: 300, dur: 0.06, wave: 'pulse', duty: 0.125 } },
  break: { noise: { dur: 0.22, rate: 0.5 } },
  powerup: { notes: 'C5/32 G5/32 C6/32 D5/32 A5/32 D6/32 E5/32 B5/32 E6/32 F5/32 C6/32 F6/32', bpm: 150 },
  shrink: { notes: 'E6/32 B5/32 E5/32 C6/32 G5/32 C5/32 A5/32 E5/32 A4/32', bpm: 150 },
  puff: { sweep: { from: 200, to: 1600, dur: 0.18, wave: 'pulse', duty: 0.5 }, noise: { dur: 0.1, rate: 2 } },
  fire: { sweep: { from: 800, to: 400, dur: 0.05, wave: 'pulse', duty: 0.25 }, noise: { dur: 0.03, rate: 2 } },
  tail: { noise: { dur: 0.12, rate: 2 } },
  pipe: { notes: 'C4/32 r/32 G3/32 r/32 C4/32 r/32 G3/32', bpm: 120 },
  note: { notes: 'C6/32 G6/16', bpm: 150 },
  cannon: { noise: { dur: 0.25, rate: 0.25 } },
  door: { sweep: { from: 150, to: 300, dur: 0.12, wave: 'triangle' } },
  respawn: { notes: 'G5/32 C6/32 E6/32 G6/16', bpm: 150 },
  hurry: { notes: 'C6/16 D6/16 E6/16 C6/16 D6/16 E6/16 F6/8', bpm: 160 },
  select: { notes: 'C6/32', bpm: 150 },
  pause: { notes: 'E6/32 C6/32 E6/32 C6/16', bpm: 150 },
  bossHit: { sweep: { from: 400, to: 100, dur: 0.2, wave: 'pulse', duty: 0.5 }, noise: { dur: 0.15, rate: 0.5 } },
  card: { notes: 'C6/32 E6/32 G6/16', bpm: 150 },
  map: { notes: 'G5/32', bpm: 150 },
  death: { notes: 'B4/16 F5/16', bpm: 120 },   // the full death tune is SONGS.death
};

export const SFX_IDS = ['jump', 'bump', 'coin', '1up', 'stomp', 'kick', 'break', 'powerup', 'shrink', 'puff', 'fire', 'tail', 'pipe', 'note', 'cannon', 'door', 'respawn', 'hurry', 'death', 'select', 'pause', 'bossHit', 'card', 'map'];
```
`src/engine/audio.js`:
```js
import { SONGS, SFX } from '../content/music.js';

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function noteFreq(name) {
  const m = /^([A-G]#?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  const midi = (Number(m[2]) + 1) * 12 + NAMES.indexOf(m[1]);
  return 440 * 2 ** ((midi - 69) / 12);
}

export function parseTrack(str) {
  const out = [];
  let beat = 0;
  for (const tok of str.split(/\s+/)) {
    if (!tok || tok === '|') continue;
    const [name, d] = tok.split('/');
    const dotted = d.endsWith('.');
    const dur = (4 / Number(dotted ? d.slice(0, -1) : d)) * (dotted ? 1.5 : 1);
    out.push({ beat, dur, note: name === 'r' ? null : name });
    beat += dur;
  }
  return out;
}

export const trackBeats = (str) => parseTrack(str).reduce((a, e) => a + e.dur, 0);

function pulseWave(ctx, duty) {
  const N = 256, H = 48, real = new Float32Array(H), imag = new Float32Array(H);
  for (let n = 1; n < H; n++) {
    let re = 0, im = 0;
    for (let k = 0; k < N; k++) {
      const x = k / N < duty ? 1 : -1;
      re += x * Math.cos((2 * Math.PI * n * k) / N);
      im += x * Math.sin((2 * Math.PI * n * k) / N);
    }
    real[n] = (2 * re) / N; imag[n] = (2 * im) / N;
  }
  return ctx.createPeriodicWave(real, imag);
}

function noiseBuffer(ctx) {
  const len = ctx.sampleRate, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  let lfsr = 1;
  for (let i = 0; i < len; i++) {
    if (i % 8 === 0) { const bit = (lfsr ^ (lfsr >> 1)) & 1; lfsr = (lfsr >> 1) | (bit << 14); }
    d[i] = lfsr & 1 ? 0.6 : -0.6;
  }
  return buf;
}

const DRUM = { k: { rate: 0.25, dur: 0.15 }, s: { rate: 1, dur: 0.12 }, h: { rate: 2, dur: 0.04 } };

export function createAudio() {
  let ctx = null, master = null, waves = {}, noise = null;
  let song = null, songId = null, songStart = 0, tempoScale = 1, muted = false;

  function voice(kind, freq, t, dur, vol, duty = 0.5) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.setValueAtTime(vol, t + Math.max(0.01, dur - 0.02));
    g.gain.linearRampToValueAtTime(0, t + dur);
    g.connect(master);
    if (kind === 'noise') {
      const src = ctx.createBufferSource();
      src.buffer = noise; src.loop = true; src.playbackRate.value = freq;
      src.connect(g); src.start(t); src.stop(t + dur);
      return src;
    }
    const o = ctx.createOscillator();
    if (kind === 'triangle') o.type = 'triangle';
    else o.setPeriodicWave(waves[duty] || (waves[duty] = pulseWave(ctx, duty)));
    o.frequency.setValueAtTime(freq, t);
    o.connect(g); o.start(t); o.stop(t + dur);
    return o;
  }

  function schedule() {
    if (!song) return;
    const spb = 60 / (song.bpm * tempoScale);
    const horizon = ctx.currentTime + 0.15;
    for (const ch of ['p1', 'p2', 'tri', 'noise']) {
      const ev = song.parsed[ch], pos = song.pos[ch];
      if (!ev.length) continue;
      for (;;) {
        if (pos.i >= ev.length) {
          if (!song.loop) break;
          pos.i = 0; pos.loop++;
        }
        const e = ev[pos.i];
        const t = songStart + (pos.loop * song.beats + e.beat) * spb;
        if (t > horizon) break;
        pos.i++;
        if (!e.note || t < ctx.currentTime - 0.05) continue;
        const dur = e.dur * spb * (ch === 'noise' ? 1 : 0.9);
        if (ch === 'noise') { const d = DRUM[e.note]; voice('noise', d.rate, t, Math.min(d.dur, dur), 0.12); }
        else if (ch === 'tri') voice('triangle', noteFreq(e.note), t, dur, 0.22);
        else voice('pulse', noteFreq(e.note), t, dur, ch === 'p1' ? 0.1 : 0.07, ch === 'p1' ? 0.5 : 0.25);
      }
    }
  }

  return {
    unlock() {
      if (ctx) { ctx.resume(); return; }
      ctx = new AudioContext();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
      noise = noiseBuffer(ctx);
      setInterval(schedule, 25);
      if (songId) this.playSong(songId);
    },
    playSong(id) {
      songId = id;
      if (!ctx) return;
      const def = SONGS[id];
      if (!def) return;
      const parsed = { p1: [], p2: [], tri: [], noise: [] };
      for (const ch of Object.keys(parsed)) if (def[ch]) parsed[ch] = parseTrack(def[ch]);
      const lead = Object.keys(parsed).find(ch => parsed[ch].length);
      const pos = Object.fromEntries(Object.keys(parsed).map(ch => [ch, { i: 0, loop: 0 }]));
      song = { ...def, parsed, pos, beats: trackBeats(def[lead]) };
      songStart = ctx.currentTime + 0.05;
    },
    stopSong() { song = null; songId = null; },
    sfx(id) {
      const d = SFX[id];
      if (!ctx || !d) return;
      const t = ctx.currentTime + 0.01;
      if (d.sweep) {
        const o = voice(d.sweep.wave === 'triangle' ? 'triangle' : 'pulse', d.sweep.from, t, d.sweep.dur, 0.12, d.sweep.duty || 0.5);
        o.frequency.exponentialRampToValueAtTime(d.sweep.to, t + d.sweep.dur);
      }
      if (d.noise) voice('noise', d.noise.rate, t, d.noise.dur, 0.15);
      if (d.notes) {
        const spb = 60 / (d.bpm || 150);
        for (const e of parseTrack(d.notes)) if (e.note) voice('pulse', noteFreq(e.note), t + e.beat * spb, e.dur * spb, 0.12, 0.5);
      }
    },
    // Like SMB3's "hurry up": the current song restarts at the new tempo.
    setTempoScale(x) { tempoScale = x; if (songId) this.playSong(songId); },
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.8; },
    get muted() { return muted; },
  };
}
```
Each channel keeps its own loop counter, and every looping song's channels are the same length (the test enforces this), so the voices stay aligned forever.

- [ ] **Step 4: Run tests, then listen**

Run: `bun test` → Expected: all pass.
Listening check (Task 15 wires the audio up; come back to this then): every song loops without a gap or drift after three loops, and no channel is clipping.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: 4-voice sound chip with original chiptunes and sound effects

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: Dev level runner, sandbox level, autopilot and level validator

**Files:**
- Create: `src/content/levels/dev.js`, `tools/autopilot.js`, `tools/validate-levels.js`, `tools/selftest.js`, `tools/routes/.gitkeep`
- Modify: `src/main.js` (dev runner), `src/game/sim.js` (export `cloneSim`)
- Test: `tests/tools.test.js`

**Interfaces:**
- Consumes: `createLevelSim`, `stepLevel`, `drawLevel`, `drawHud`, `createAudio`, `createInput`, `startLoop`, `createScreen`.
- Produces:
  - `cloneSim(s)`: a `structuredClone` that shares `s.defs` (static level data) instead of copying it.
  - `solve(defs, id, { width = 48, maxSteps = 900 }): { moves, frames } | null`, a beam search over 8-frame input macros. `MACROS` are exported.
  - `movesToRoute(id, moves): { level, inputs: [[mask, count], ...] }`; `replayRoute(defs, route, opts): LevelState`, which plays the route and then idles until the mode is `'done'` or `'fail'`.
  - `validateLevels(defs): string[]` (error messages; empty means valid).
  - Level def optional fields used by the tools:
    - `sub: true` marks a bonus or sub area. It isn't solved on its own.
    - `route: [areaIds]` lists the areas in the order the main path visits them. The bot scores later areas higher. Set it only when the main path *must* change area (fortress, airship); optional bonus rooms must not be listed, or the bot would prefer them over the goal.
    - `boss: true` means the level clears by defeating a boss, not by a goal tile.
  - CLI: `bun tools/autopilot.js <id...> | --all` writes `tools/routes/<id>.json`; `bun run selftest` validates every level and replays every route.
  - Dev URLs: `?level=<id>` plays a single level (keyboard, audio, HUD) and restarts it on clear or fail. `?level=<id>&form=leaf` starts with a form. `?gallery` shows the sprite gallery.

- [ ] **Step 1: Write the failing test**

`tests/tools.test.js`:
```js
import { test, expect } from 'bun:test';
import { solve, movesToRoute, replayRoute } from '../tools/autopilot.js';
import { validateLevels } from '../tools/validate-levels.js';

const tiny = {
  t1: {
    id: 't1', time: 300, start: [1, 10],
    map: String.raw`
..............................
..............................
..............................
..............................
..............................
..............................
..............................
..............................
..............................
.....................G........
..........c..........G........
#########...####...###########
#########...####...###########`,
  },
};

test('autopilot beats a level with gaps and an enemy, and the route replays', () => {
  const r = solve(tiny, 't1', { width: 24, maxSteps: 200 });
  expect(r).not.toBe(null);
  const route = movesToRoute('t1', r.moves);
  const s = replayRoute(tiny, route);
  expect(s.mode).toBe('done');
});

test('validator reports broken levels', () => {
  const bad = {
    a: { id: 'a', time: 0, start: [1, 0], map: '..\n..', pipes: [{ at: [0, 0], dir: 'down', to: { level: 'zzz', at: [0, 0], dir: 'up' } }] },
  };
  const errs = validateLevels(bad);
  expect(errs.some(e => e.includes('time'))).toBe(true);
  expect(errs.some(e => e.includes('goal'))).toBe(true);
  expect(errs.some(e => e.includes('zzz'))).toBe(true);
  expect(errs.some(e => e.includes('not a pipe'))).toBe(true);
  expect(errs.some(e => e.includes('start'))).toBe(true);
});

test('the dev sandbox is a valid level', async () => {
  const { LEVELS } = await import('../src/content/levels/dev.js');
  expect(validateLevels(LEVELS)).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/tools.test.js` → Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

Add to `src/game/sim.js`:
```js
// Clone for search/prediction. Level defs are static, so they are shared, not copied.
export function cloneSim(s) {
  const defs = s.defs;
  s.defs = null;
  const c = structuredClone(s);
  s.defs = defs; c.defs = defs;
  return c;
}
```

`tools/validate-levels.js`:
```js
import { parseLevel, tileAt } from '../src/game/level.js';
import { T, INFO } from '../src/game/tiles.js';

export function validateLevels(defs) {
  const errs = [];
  for (const [key, def] of Object.entries(defs)) {
    const where = `level ${key}`;
    let lv;
    try { lv = parseLevel(def); } catch (e) { errs.push(`${where}: ${e.message}`); continue; }
    if (def.id !== key) errs.push(`${where}: id '${def.id}' does not match key`);
    if (!(def.time > 0)) errs.push(`${where}: time must be > 0`);
    if (lv.h > 27) errs.push(`${where}: taller than 27 rows`);
    const hasGoal = lv.tiles.includes(T.GOAL);
    if (!def.sub && !def.boss && !hasGoal) errs.push(`${where}: no goal (G) and not a boss level`);
    const { tx, ty } = lv.start;
    const under = tileAt(lv, tx, ty + 1);
    if (!(INFO[under].solid || INFO[under].semi) || INFO[tileAt(lv, tx, ty)].solid) errs.push(`${where}: start ${tx},${ty} must be an empty tile on top of solid ground`);
    for (const p of lv.pipes) {
      const id = tileAt(lv, p.at[0], p.at[1]);
      if (!INFO[id].pipe) errs.push(`${where}: pipe at ${p.at} is not a pipe tile`);
      if (p.to.level && !defs[p.to.level]) errs.push(`${where}: pipe target level '${p.to.level}' missing`);
    }
    for (const d of lv.doors) {
      if (tileAt(lv, d.at[0], d.at[1]) !== T.DOOR) errs.push(`${where}: door at ${d.at} is not a door tile`);
      if (d.to.level && !defs[d.to.level]) errs.push(`${where}: door target level '${d.to.level}' missing`);
    }
    for (const r of def.route || []) if (!defs[r]) errs.push(`${where}: route area '${r}' missing`);
  }
  return errs;
}

if (import.meta.main) {
  const { LEVELS } = await import(`../src/content/levels/${process.argv[2] || 'w1'}.js`);
  const errs = validateLevels(LEVELS);
  console.log(errs.length ? errs.join('\n') : 'all levels valid');
  process.exit(errs.length ? 1 : 0);
}
```

`tools/autopilot.js`:
```js
import { createLevelSim, stepLevel, cloneSim } from '../src/game/sim.js';
import { BTN, SUB } from '../src/game/consts.js';

const { LEFT: L, RIGHT: R, A, B, DOWN: D, UP: U } = BTN;
const K = 8;
export const MACROS = [
  (i) => R, (i) => R | B, (i) => R | B | A, (i) => R | A, (i) => R | B | (i < 2 ? A : 0),
  (i) => A, (i) => 0, (i) => L | B, (i) => L | A, (i) => D, (i) => U,
  (i) => R | B | ((i & 3) === 0 ? A : 0),      // leaf flight flapping
  (i) => (i < 2 ? B : 0),                       // tail / fireball
];

function score(s, route) {
  const p = s.players[0];
  if (s.mode === 'clear' || s.mode === 'done') return 1e12;
  const area = Math.max(0, route.indexOf(s.lv.id));
  const boss = s.entities.find(e => e.boss);
  const bossBonus = boss ? (boss.maxHp - boss.hp) * 1e4 : 0;
  return area * 1e7 + bossBonus + p.x / SUB + (p.form !== 'small' ? 40 : 0);
}

export function solve(defs, id, { width = 48, maxSteps = 900 } = {}) {
  const def = defs[id];
  const route = def.route || [id];
  let beam = [{ s: createLevelSim(def, { defs, seed: 1 }), moves: [] }];
  for (let depth = 0; depth < maxSteps; depth++) {
    const next = [];
    for (const node of beam) {
      for (let m = 0; m < MACROS.length; m++) {
        const s = cloneSim(node.s);
        for (let i = 0; i < K; i++) stepLevel(s, [MACROS[m](i)]);
        if (s.players[0].dead || s.mode === 'fail') continue;
        const moves = node.moves.concat(m);
        if (s.mode === 'clear' || s.mode === 'done') return { moves, frames: moves.length * K };
        next.push({ s, moves, score: score(s, route) });
      }
    }
    next.sort((a, b) => b.score - a.score);
    const seen = new Set();
    beam = [];
    for (const n of next) {
      const p = n.s.players[0];
      const key = `${n.s.lv.id}|${p.x >> 7}|${p.y >> 7}|${p.form}|${p.vy > 0}|${p.pmeter === 7}`;
      if (seen.has(key)) continue;
      seen.add(key);
      beam.push(n);
      if (beam.length >= width) break;
    }
    if (!beam.length) return null;
  }
  return null;
}

export function movesToRoute(level, moves) {
  const inputs = [];
  for (const m of moves) for (let i = 0; i < K; i++) {
    const b = MACROS[m](i);
    const last = inputs[inputs.length - 1];
    if (last && last[0] === b) last[1]++; else inputs.push([b, 1]);
  }
  return { level, inputs };
}

export function replayRoute(defs, route, { maxIdle = 1200 } = {}) {
  const s = createLevelSim(defs[route.level], { defs, seed: 1 });
  for (const [b, n] of route.inputs) for (let i = 0; i < n; i++) stepLevel(s, [b]);
  for (let i = 0; i < maxIdle && s.mode !== 'done' && s.mode !== 'fail'; i++) stepLevel(s, [0]);
  return s;
}

if (import.meta.main) {
  const world = process.env.WORLD || 'w1';
  const { LEVELS } = await import(`../src/content/levels/${world}.js`);
  const args = process.argv.slice(2);
  const ids = args[0] === '--all' ? Object.keys(LEVELS).filter(k => !LEVELS[k].sub) : args;
  let failed = 0;
  for (const id of ids) {
    const t0 = performance.now();
    const r = solve(LEVELS, id);
    if (!r) { console.log(`${id}: NO ROUTE FOUND`); failed++; continue; }
    await Bun.write(new URL(`./routes/${id}.json`, import.meta.url), JSON.stringify(movesToRoute(id, r.moves)));
    console.log(`${id}: solved in ${r.frames} frames (${((performance.now() - t0) / 1000).toFixed(1)}s)`);
  }
  process.exit(failed ? 1 : 0);
}
```

`tools/selftest.js`:
```js
import { validateLevels } from './validate-levels.js';
import { replayRoute } from './autopilot.js';

const worlds = ['w1'];
let fail = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fail++; console.log(`FAIL ${msg}`); } };

for (const w of worlds) {
  const { LEVELS } = await import(`../src/content/levels/${w}.js`);
  const errs = validateLevels(LEVELS);
  ok(errs.length === 0, `${w} levels valid:\n  ${errs.join('\n  ')}`);
  for (const id of Object.keys(LEVELS).filter(k => !LEVELS[k].sub)) {
    const f = Bun.file(new URL(`./routes/${id}.json`, import.meta.url));
    if (!(await f.exists())) { ok(false, `${id}: no route recorded (run bun tools/autopilot.js ${id})`); continue; }
    const s = replayRoute(LEVELS, await f.json());
    ok(s.mode === 'done', `${id}: recorded route no longer beats the level (mode=${s.mode}); re-run the autopilot`);
  }
}
console.log(fail ? `${fail} of ${checks} checks failed` : `All ${checks} checks passed.`);
process.exit(fail ? 1 : 0);
```
Until Task 16 adds `src/content/levels/w1.js`, `bun run selftest` fails at the import. That is expected, and Task 16 is where it first goes green.

`src/content/levels/dev.js`: a sandbox exercising every tile and stage-1 enemy so all of it can be seen and played in one place.
```js
export const LEVELS = {
  dev: {
    id: 'dev', theme: 'overworld', music: 'overworld', time: 999, start: [2, 10],
    map: String.raw`
................................................................................................
................................................................................................
................................................................................................
................................................................................................
..........................................OOOO..................................................
..................................C.C.C.C.........NNN...........................................
................................................................o...............................
.....?MLUSV.P.H.............................................................p..f..........G.....
................BBB...................s............./#\.............K...=====.....v.......G.....
......................................[].........../###\............K...=====.....[]......G.....
..........................c..g.r.y....{}..b.d...12#######34.........K.............{}......G.....
####################....########################################################################
####################~~~~########################################################################`,
    pipes: [{ at: [38, 9], dir: 'down', to: { level: 'devsub', at: [3, 9], dir: 'up' } }],
  },
  devsub: {
    id: 'devsub', sub: true, theme: 'underground', music: 'underground', time: 999, start: [2, 9],
    map: String.raw`
######################
#....................#
#..CCCCCCCCCCCCCCCC..#
#....................#
#..BBBBBBBBBBBBBBBB..#
#....................#
#....................#
#....................#
#....................#
#..[]................#
###{}#################`,
    pipes: [{ at: [3, 9], dir: 'down', to: { level: 'dev', at: [38, 9], dir: 'up' } }],
  },
};
```

`src/main.js` (dev runner; Task 22 replaces this with the full game):
```js
import { createScreen } from './engine/render.js';
import { createInput, edges } from './engine/input.js';
import { startLoop } from './engine/loop.js';
import { createAudio } from './engine/audio.js';
import { createLevelSim, stepLevel } from './game/sim.js';
import { drawLevel } from './draw/level.js';
import { drawHud } from './draw/hud.js';
import { drawGallery } from './draw/gallery.js';
import { BTN } from './game/consts.js';
import { LEVELS as DEV } from './content/levels/dev.js';

const { ctx } = createScreen(document.getElementById('screen'));
const input = createInput();
const audio = createAudio();
window.addEventListener('keydown', () => audio.unlock());
const params = new URLSearchParams(location.search);

const loadWorld = async () => {
  try { return (await import('./content/levels/w1.js')).LEVELS; } catch { return {}; }
};

if (params.has('gallery')) {
  let page = 0, prev = 0;
  startLoop({
    step() { const m = input.read(); const { pressed } = edges(prev, m); prev = m; if (pressed & BTN.RIGHT) page++; if (pressed & BTN.LEFT) page = Math.max(0, page - 1); },
    draw() { drawGallery(ctx, page); },
  });
} else {
  const defs = { ...DEV, ...(await loadWorld()) };
  const id = params.get('level') || 'dev';
  const form = params.get('form') || 'small';
  let s = createLevelSim(defs[id], { defs, forms: [form] });
  let song = '';
  window.__sim = () => s;
  startLoop({
    step() {
      stepLevel(s, [input.read()]);
      for (const ev of s.events) {
        if (ev.e === 'sfx') audio.sfx(ev.id);
        if (ev.e === 'clear') audio.playSong('clear');
      }
      const want = s.mode !== 'play' ? (s.mode === 'fail' ? '' : 'clear')
        : s.players[0].dead ? 'death' : s.players[0].starTimer > 0 ? 'star' : s.pswitch > 0 ? 'pswitch' : s.lv.music;
      if (want !== song) { song = want; if (want) audio.playSong(want); }
      if (s.mode === 'done' || s.mode === 'fail') { s = createLevelSim(defs[id], { defs, forms: [form] }); song = ''; }
    },
    draw() {
      drawLevel(ctx, s, 0);
      drawHud(ctx, { world: 1, pmeter: s.players[0].pmeter, flying: s.players[0].flyTimer > 0, coins: s.shared.coins,
        lives: s.shared.lives, score: s.shared.score, time: s.time, cards: [-1, -1, -1], who: 0 });
    },
  });
}
```

- [ ] **Step 4: Run tests and play the sandbox**

Run: `bun test` → Expected: all pass.
Run `bun run dev`, open `http://localhost:5190/?level=dev`, and play it. Then take headless screenshots:
```bash
B=~/.claude/skills/gstack/browse/dist/browse
$B goto "http://localhost:5190/?level=dev&v=$RANDOM"
$B screenshot --viewport /tmp/claude-502/dev-start.png
$B js "(() => { const s = window.__sim(); s.players[0].x = 60*256; return 'ok' })()"
$B screenshot --viewport /tmp/claude-502/dev-mid.png
$B console --errors
```
Read the PNGs. Expected: tiles, enemies, Pip and the HUD all draw correctly, and there are no console errors. Then run `bun tools/autopilot.js dev` (with `WORLD=dev`). Expected: `dev: solved in N frames`. Delete `tools/routes/dev.json` afterwards; selftest only checks world levels.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: dev level runner, sandbox level, autopilot and level validator

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: World 1 levels 1-1, 1-2, 1-3

**Files:**
- Create: `src/content/levels/w1.js`, `tools/levelkit.js`, `tools/routes/1-1.json`, `1-2.json`, `1-3.json`
- Test: `tests/w1.test.js`

**Interfaces:**
- Consumes: level format (Task 4), pipes (Task 12), validator and autopilot (Task 15).
- Produces: `LEVELS` in `src/content/levels/w1.js`, mapping id → def for `1-1`, `1-1b`, `1-2`, `1-3` and any sub-areas they use. Tasks 17–19 add `1-4`, `1-5`, `1-6`, `1-F`, `1-Fb`, `1-A` and `1-Ab` to the same object.
- `tools/levelkit.js` is an authoring helper (`mk`, `put`, `col`, `gap`, `out`) for generating exact-width map text, which is then pasted into `w1.js`. Map strings in `w1.js` are always committed as literal text so they can be read and diffed.

**Authoring rules (all W1 levels):**
- 14 rows tall unless noted. Ground is rows 12–13, so the player stands in row 11. The start is `[2, 11]`.
- Every hazard can be seen before it can hurt you. Jumps are at most 4 tiles wide when walking and 6 when running. No blind drops.
- Every level hides at least one secret: a hidden `H` block, a pipe to a bonus room, or a coin trail reachable only by flying.
- The goal is a 2×4 `G` block (rows 8–11) about 14 tiles before the right edge, with flat ground around it.

`tools/levelkit.js`:
```js
export const mk = (w, h, fill = '.') => Array.from({ length: h }, () => Array(w).fill(fill));
export const put = (g, x, y, s) => { for (let i = 0; i < s.length; i++) g[y][x + i] = s[i]; };
export const col = (g, x, y0, y1, ch) => { for (let y = y0; y <= y1; y++) g[y][x] = ch; };
export const ground = (g, rows = [12, 13]) => { for (const y of rows) for (let x = 0; x < g[0].length; x++) g[y][x] = '#'; };
export const gap = (g, a, b, rows = [12, 13]) => { for (let x = a; x <= b; x++) for (const y of rows) g[y][x] = '.'; };
export const out = (g) => g.map(r => r.join('')).join('\n');
```

**1-1 "Meadow Start"** (complete):
```js
'1-1': {
  id: '1-1', theme: 'overworld', music: 'overworld', time: 300, start: [2, 11],
  pipes: [{ at: [116, 10], dir: 'down', to: { level: '1-1b', at: [2, 0], dir: 'down' } }],
  map: String.raw`
........................................................................................................................................................................................................
.................................................................................................U......................................................................................................
........................................................................................................................................................................................................
......................................................................................CCCCCCCC..........................................................................................................
..............................................................................................OOOOOO....................................................................................................
.........................................................................................................................CCCCCC.........................................................................
...........................................................................................................................................................W............................................
..................................CCCCCC..................................................................................................................WW............................................
..........?M?...........................BBVBB...........g............?L?..s..................................r...........BBBBPB..........................WWW..............................GG............
..................................======............../####\..............[]...............................======.......................................WWWW..............................GG............
......................[].......p..======............./######\.............{}...............................======...[]......................[].........WWWWW..............................GG............
..................c...{}...c......======............/########\..c.c.......{}...............................======...{}...........c..c..c....{}........WWWWWW............g.................GG............
###############################################..####################################################....#####################################################....######################################
###############################################..####################################################....#####################################################....######################################`,
},
'1-1b': {
  id: '1-1b', sub: true, theme: 'underground', music: 'underground', time: 300, start: [4, 10],
  pipes: [{ at: [12, 9], dir: 'down', to: { level: '1-1', at: [140, 10], dir: 'up' } }],
  map: String.raw`
##..############
#..............#
#..............#
#.CCCCCCCCCCCC.#
#..............#
#.CCCCCCCCCCCC.#
#..............#
#.CCCCCCCCCCCC.#
#..............#
#...........[].#
#...........{}.#
################`,
},
```
Beat summary for 1-1, for reviewers: two ? blocks and a Berry, Chompkins, a pipe, a Parachompkin, a coin-topped big block, a multi-coin brick, a 2-wide gap, a three-step hill with a Shellback (slide down into two Chompkins), a Leaf block, a pipe plant, a long runway for P-speed with sky coins and a cloud holding a 1-Up block, a 4-wide pit, a Red Shellback on a big block, a bonus pipe (coin room) that returns at column 140, a P-switch brick row, a trio of Chompkins, a wood staircase over a pit, the goal.

**1-2 "Rolling Hills"** (overworld, time 300, 190 wide, start `[2, 11]`). Lay out these beats left to right (columns are approximate; the autopilot decides playability):

| Columns | Beat |
|---|---|
| 0–14 | Flat start. `?M?` at row 8, columns 9–11. |
| 16–40 | Three gentle hills (`12`, a flat top, `34`), each 2 rows high, with a Parachompkin on the 1st and 3rd hilltop. Coins arc over the middle hill. |
| 42–53 | A 2-tall pipe with a Snapvine, then a 3-tall pipe with a Fire Snapvine. |
| 56–70 | A 3-row 45° hill whose long right slope ends at column 70. |
| 72–78 | Three Chompkins at the bottom of the slope (slide into them for a combo). |
| 80–84 | A 5-wide pit with an `OOOOO` cloud bridge at row 8 as the safe route. |
| 86–100 | A brick ceiling at row 8, with a hidden `H` 1-Up at column 93 in a gap of the brick row. |
| 102–120 | Semi-solid big blocks at heights 2, 3 and 4, with a green Shellback, a winged Shellback and a red Shellback (a shell-kicking playground). `?L?` at row 5 above the tallest. |
| 122–125 | A 4-wide pit. |
| 128–140 | `NNNN` music blocks at row 10 that launch you to a coin row at row 4. |
| 142–160 | Two pipes with Snapvines and a Parachompkin between them. |
| 165–171 | A wood staircase up 6 to a pit 3 wide. |
| 176–189 | The goal at columns 176–177. |

**1-3 "Block Garden"** (overworld, time 300, 180 wide, start `[2, 11]`):

| Columns | Beat |
|---|---|
| 0–12 | Flat start. `?L?` at row 8, columns 6–8 (a Leaf early, so flight is possible). |
| 14–40 | Stacked semi-solid big-block towers 2–6 rows tall with gaps in between. Red Shellbacks patrol two tops. Coins on the highest top. |
| 42–55 | A long flat run with a P-meter runway. A coin trail at row 2 leads to a hidden `U` at row 1, column 60 (reachable only by flying). |
| 58–64 | A pipe down to the bonus room `1-3b` (a 16×12 underground room with a `V` multi-coin brick and a `S` star block) that returns at column 70. |
| 66–74 | An `S` star block at row 8, followed by eight Chompkins at columns 76–92 for star-powered combos. |
| 95–110 | A `BBBBPBBBB` brick row over a pit (columns 100–106) with coins at row 11. The P-switch turns the coins into bricks, making a bridge. A safe alternative is a `OOO` cloud at row 7. |
| 112–140 | Alternating gentle slopes and semi-solid blocks, with green Shellbacks and a Parachompkin. A hidden `H` at row 8, column 130. |
| 142–160 | A wood staircase down and back up, with a Snapvine pipe in the dip. |
| 166–179 | The goal at columns 166–167. |

- [ ] **Step 1: Write the failing test**

`tests/w1.test.js`:
```js
import { test, expect } from 'bun:test';
import { LEVELS } from '../src/content/levels/w1.js';
import { validateLevels } from '../tools/validate-levels.js';
import { replayRoute } from '../tools/autopilot.js';

test('World 1 levels are valid', () => {
  expect(validateLevels(LEVELS)).toEqual([]);
});

for (const id of Object.keys(LEVELS).filter(k => !LEVELS[k].sub)) {
  test(`${id} is beaten by its recorded route`, async () => {
    const route = await Bun.file(new URL(`../tools/routes/${id}.json`, import.meta.url)).json();
    expect(replayRoute(LEVELS, route).mode).toBe('done');
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/w1.test.js` → Expected: FAIL (module not found).

- [ ] **Step 3: Author the levels**

Create `src/content/levels/w1.js` as `export const LEVELS = { ... }` containing `1-1` and `1-1b` exactly as above. Then generate `1-2`, `1-3` and `1-3b` from their beat tables with a throwaway script in the scratchpad that imports `tools/levelkit.js`, and paste the printed maps in as literal `String.raw` text. Run `bun tools/validate-levels.js` until it prints `all levels valid`.

- [ ] **Step 4: Prove each level is beatable**

Run: `bun tools/autopilot.js 1-1 1-2 1-3` → Expected: `solved` for each, which writes the route files.
If a level is not solved, find the beat where the best beam node stalls: temporarily log `p.x/256` of the best node every 50 steps. Then fix the level (widen a gap's landing, lower a block) rather than the bot. A level the bot can't beat is usually unfair to people too.
Run: `bun test tests/w1.test.js` → Expected: all pass. Run `bun run selftest` → Expected: `All N checks passed.`

- [ ] **Step 5: Play and screenshot**

Play each level at `?level=1-1` (and 1-2, 1-3) in the dev runner. Take screenshots at the start, middle and goal (set `window.__sim().players[0].x` as in Task 15), read them, and check that each beat reads clearly and nothing overlaps strangely.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: World 1 levels 1-1 to 1-3 with recorded autopilot routes

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 17: World 1 levels 1-4, 1-5, 1-6

**Files:**
- Modify: `src/content/levels/w1.js`
- Create: `tools/routes/1-4.json`, `1-5.json`, `1-6.json`
- Test: `tests/w1.test.js` (already loops over every non-sub level, so the new levels are covered automatically)

**Interfaces:**
- Consumes: Task 16's authoring rules and `tools/levelkit.js`.
- Produces: `1-4`, `1-5`, `1-6`, `1-6b` in `LEVELS`.

**1-4 "Sky Rafts"** (theme `sky`, music `sky`, time 300, 210 wide, start `[2, 11]`). Ground exists only at columns 0–12 and 192–209. Everything between is a bottomless sky.

| Columns | Beat |
|---|---|
| 0–12 | Start platform. `?M?` at row 8. |
| 14–60 | Five `m` lifts (drift left, fall once ridden) at rows 9, 8, 9, 7, 8, about 9 columns apart. A coin above each. A Parachompkin hopping between columns 30–40 on an `OOOO` cloud at row 10. |
| 62–74 | A cloud island (`OOOOOOOOOOOO` at row 9) with `?L?` above at row 5 and a winged Shellback. |
| 76–120 | Four `n` vertical lifts alternating with three `m` lifts. A coin trail at row 3 rewards flying. |
| 122–135 | A cloud island with a hidden `H` 1-Up at row 6, column 128. |
| 137–190 | Alternating single-tile `W` wood blocks (stepping stones at rows 10, 8, 9, 7, 10) and `m` lifts, with two Parachompkins. |
| 192–209 | Landing platform; goal at columns 196–197. |

**1-5 "Cannon Ridge"** (overworld, time 300, 190 wide, start `[2, 11]`):

| Columns | Beat |
|---|---|
| 0–14 | Flat start, `?M?`. |
| 16–30 | A 2-tall `K` cannon at column 20 and a 1-tall at column 28. A Spikebug walks between them. |
| 32–48 | A gentle-slope hill with a 3-tall cannon on its peak; bricks at row 7 give cover. |
| 50–54 | A 3-wide pit. |
| 56–80 | Raised semi-solid blocks (heights 2–3) with Bumble Beetles (fire won't work: teaches stomping and shells). `?L?` at row 6. |
| 82–96 | A pipe with a Fire Snapvine, then a pipe down to bonus `1-5b` (a coin room returning at column 104). |
| 98–130 | Cannons facing a long low ceiling of bricks at row 8 (hide under it), with a Spikebug pair. |
| 132–136 | A 4-wide pit with an `OOOO` bridge at row 9. |
| 138–160 | A tall 45° hill (4 rows) with cannons on both feet; a Red Shellback on top. |
| 162–175 | A wood staircase. |
| 176–189 | The goal at columns 176–177. |

**1-6 "Burrow"** (theme `underground`, music `underground`, time 300, 190 wide, start `[2, 11]`). Row 0 is a brick and ground ceiling across the whole level.

| Columns | Beat |
|---|---|
| 0–14 | Start. `?M?` at row 8. Ceiling `#` at rows 0–1. |
| 16–40 | Bumble Beetles and Chompkins under a low brick ceiling at row 7. Break bricks (when big) to reach coins in row 6. |
| 42–48 | A 5-wide pit bridged by a `BBBBB` row at row 11. A `V` multi-coin brick above. |
| 50–70 | Fire Snapvine pipes (2 and 3 tall) alternating with spikebugs. |
| 72–96 | A `BBBBPBBBB` row at row 8 over a 6-wide pit (columns 80–85) with coins at row 11. The P-switch makes a bridge. An alternative route crosses semi-solid blocks at row 6. |
| 98–120 | An `S` star block at row 8, then a swarm of 6 Chompkins and 2 Bumble Beetles. |
| 122–150 | Stacked brick walls (3 tall) that must be broken or jumped. A hidden `H` at row 9, column 140. |
| 152–158 | A pipe hanging from the ceiling (body `{}` rows 0–5, mouth `[]` at row 6, `dir: 'up'`, entered by jumping into it while holding UP) leading to area `1-6b`. |
| `1-6b` | A 40×14 overworld exit area: start by coming out of a pipe at column 2, a short run, the goal at columns 30–31. |

Add `route: ['1-6', '1-6b']` to `1-6` (its goal is in the second area) and `sub: true` to `1-6b`. Then update `tools/validate-levels.js` so a level counts as having a goal if any area in its `route` contains `G` tiles:
```js
    const routeHasGoal = (def.route || []).some(r => defs[r] && parseLevel(defs[r]).tiles.includes(T.GOAL));
    if (!def.sub && !def.boss && !hasGoal && !routeHasGoal) errs.push(`${where}: no goal (G) and not a boss level`);
```

- [ ] **Step 1: Author the levels.** Use the same generator workflow as Task 16. Run `bun tools/validate-levels.js` → `all levels valid`.
- [ ] **Step 2: Run the autopilot.** `bun tools/autopilot.js 1-4 1-5 1-6` → `solved` for each. 1-4 is the hardest for the bot (falling lifts); if it fails, space the lifts 1–2 columns closer rather than changing the bot.
- [ ] **Step 3: Run the tests.** `bun test` → all pass; `bun run selftest` → all checks pass.
- [ ] **Step 4: Play and screenshot** each level as in Task 16. In 1-5, check that cannons visibly point toward the player and that bolts never spawn inside a wall.
- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: World 1 levels 1-4 to 1-6

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 18: Fortress and the Bone Brute boss

**Files:**
- Create: `src/game/entities/bosses.js`, `tools/routes/1-F.json`
- Modify: `src/game/sim.js` (extract `clearLevel`), `src/game/entities/all.js`, `src/draw/art.js` (boss art), `src/content/sprites/enemies.js` (boss sprites), `src/content/levels/w1.js`
- Test: `tests/bosses.test.js`

**Interfaces:**
- Consumes: registry, `walk`, `face`, `flipKill`, `updateFlipped`, `moveBody`.
- Produces:
  - `clearLevel(s, by, card)` exported from sim.js. It is now the only way a level enters `'clear'`, and the goal-tile code calls it. Bosses pass `card = -1` (no roulette card).
  - Boss contract: `e.boss = true`, `e.hp`, `e.maxHp`, `e.persistent = true`. `damageBoss(s, e)` is shared by all bosses. A defeated boss flips off-screen and spawns an `orb` that falls and clears the level when touched.
  - Type `bonebrute` (char `z`): 24×24, hp 3. It runs at the nearest player and gets faster as it is hurt. It hops every 90 frames. After each hit it spins for 60 frames (harmful, cannot be stomped). Stomp, tail, shell and star each do 1 damage; every 4th fireball does 1 damage.
  - Type `orb`: 12×12, falls with gravity; `touch` calls `clearLevel(s, p.idx, -1)`.
  - Sprites `brute.run1`, `brute.run2`, `brute.spin` (24×24, palette `brute: [0x0F, 0x00, 0x30]`) and `orb` (16×16, palette `orb: [0x0F, 0x21, 0x30]`). entityArt cases `bonebrute` → run frames (spin when `state === 'spin'`), and `orb` → `orb`.
  - Levels `1-F` (fortress) and `1-Fb` (boss room).

In `sim.js`, replace the goal branch in `afterMove` with `else if (id === T.GOAL && s.mode === 'play') clearLevel(s, p.idx, Math.floor(s.frame / 8) % 3);` and add:
```js
export function clearLevel(s, by, card) {
  if (s.mode !== 'play') return;
  s.mode = 'clear'; s.modeTimer = 0;
  s.clear = { by, card };
  s.events.push({ e: 'clear', card, boss: card < 0 });
}
```

- [ ] **Step 1: Write the failing test**

`tests/bosses.test.js`:
```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/bosses.test.js` → Expected: FAIL, `unknown entity type bonebrute`.

- [ ] **Step 3: Implement**

`src/game/entities/bosses.js`:
```js
import { register, spawnEntity, flipKill, updateFlipped } from './index.js';
import { walk, face } from './common.js';
import { moveBody } from '../physics.js';
import { clearLevel } from '../sim.js';
import { SUB } from '../consts.js';

export function damageBoss(s, e) {
  if (e.state === 'spin' || e.state === 'intro' || e.state === 'flipped') return;
  e.hp--;
  s.events.push({ e: 'sfx', id: 'bossHit' });
  if (e.hp <= 0) {
    flipKill(s, e, 5000);
    spawnEntity(s, 'orb', e.x + 6 * SUB, e.y, { persistent: true, vy: -48, wand: e.type === 'grimling' });
    s.events.push({ e: 'boss-defeated' });
    return;
  }
  e.state = 'spin'; e.timer = 60; e.stompable = false; e.harmful = true;
}

function bossHit(e, s, kind) {
  if (kind === 'bump') return;
  if (kind === 'fire') { if (++e.fireHits % 4 === 0) damageBoss(s, e); return; }
  damageBoss(s, e);
}

register('bonebrute', {
  init(e, s) {
    e.w = 24; e.h = 24; e.enemy = true; e.harmful = true; e.stompable = true; e.walker = false;
    e.boss = true; e.hp = 3; e.maxHp = 3; e.persistent = true; e.fireHits = 0;
    e.state = 'intro'; e.timer = 60;
    face(e, s);
  },
  update(e, s) {
    if (updateFlipped(e, s)) return;
    if (e.state === 'intro') {
      e.vy = Math.min(e.vy + 5, 64); moveBody(e, s.lv);
      if (--e.timer <= 0) e.state = 'run';
      return;
    }
    if (e.state === 'spin') {
      e.vx = e.dir * 24; e.vy = Math.min(e.vy + 5, 64);
      const r = moveBody(e, s.lv);
      if (r.wall) e.dir = -r.wall;
      if (--e.timer <= 0) { e.state = 'run'; e.stompable = true; face(e, s); }
      return;
    }
    if (e.t % 30 === 0) face(e, s);
    if (e.onGround && e.t % 90 === 0) { e.vy = -64; e.onGround = false; }
    walk(e, s, 16 + (e.maxHp - e.hp) * 8);
  },
  stomp(e, s) { damageBoss(s, e); },
  hit: bossHit,
});

register('orb', {
  init(e) { e.w = 12; e.h = 12; },
  update(e, s) { e.vy = Math.min(e.vy + 3, 48); moveBody(e, s.lv); },
  touch(e, s, p) { e.dead = true; clearLevel(s, p.idx, -1); },
});
```
Add `import './bosses.js';` to `src/game/entities/all.js`. Add the sprites and entityArt cases listed under Interfaces.

**1-F "Meadow Keep"** (theme `fortress`, music `fortress`, time 300, 150 wide, `boss: true`, `route: ['1-F', '1-Fb']`, start `[2, 11]`):

| Columns | Beat |
|---|---|
| 0–10 | Stone entry hall; ceiling `#` rows 0–3. `?M?` at row 8. |
| 12–30 | Two lava pits (`~` in row 13, empty row 12) of 3 tiles with Embers, separated by 2-tile stone pillars. |
| 32–50 | A long corridor with a Rotodisc pivot (`o`) at row 7, column 40, and a Bone Shell patrolling. |
| 52–70 | Stepped stone platforms with a low ceiling (row 6) and two Bone Shells. `?L?` at row 9 in a safe alcove. |
| 72–90 | Two Rotodiscs at columns 76 and 86, row 8, with a lava pit and Embers between them. |
| 92–120 | A raised walkway (row 9) above lava with Bone Shells. A `U` 1-Up hidden as `H` at row 5, column 104. |
| 122–149 | A final hall with a `D` door (2 tall, bottom at row 11, column 140). `doors: [{ at: [140, 11], to: { level: '1-Fb', at: [2, 10] } }]`. |

`1-Fb` (complete):
```js
'1-Fb': {
  id: '1-Fb', sub: true, theme: 'fortress', music: 'boss', time: 300, start: [2, 10],
  map: String.raw`
################
#..............#
#..............#
#..............#
#..............#
#..............#
#..............#
#..............#
#..............#
#..............#
#.........z....#
################`,
},
```

- [ ] **Step 4: Run tests, solve, play**

Run: `bun test` → all pass (including `tests/art.test.js`, which now requires the boss art).
Run: `bun tools/autopilot.js 1-F` → `solved` (the bot's score rewards boss damage, see Task 15). Then `bun run selftest` → all pass.
Play `?level=1-F` through to the boss. Check that the boss music plays, that the spin is readable, and that the orb falls to the floor.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: Meadow Keep fortress and the Bone Brute boss

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 19: Airship and the first Grimling

**Files:**
- Modify: `src/game/entities/bosses.js`, `src/draw/art.js`, `src/content/sprites/enemies.js`, `src/content/levels/w1.js`
- Create: `tools/routes/1-A.json`
- Test: `tests/bosses.test.js` (append)

**Interfaces:**
- Produces:
  - Type `grimling` (char `q`): 24×24, hp 3. Every 120 frames it fires a `wandring` at the nearest player, and hops every 70 frames. When stomped it goes into a 60-frame shell spin (as with the brute, using `damageBoss`). On defeat it drops an `orb` (drawn as the wand: art case `orb` with `e.wand === true` → sprite `wand`).
  - Type `wandring`: 12×12, harmful, passes through walls, flies at 20 sub/frame toward where the target was when fired, and despawns after 240 frames.
  - Sprites `grim.stand`, `grim.hop`, `grim.shell` (24×24, palette `grim: [0x0F, 0x1A, 0x37]`), `wandring.1`, `wandring.2` (16×16, palette `ring: [0x0F, 0x28, 0x30]`), `wand` (16×16, palette `orb`).
  - Levels `1-A` and `1-Ab`.

- [ ] **Step 1: Write the failing test**

Append to `tests/bosses.test.js`:
```js
test('grimling fires wand rings at the player and falls to three stomps', () => {
  const s = simOf(arena('q'), {}, [2, 8]);
  const e = find(s, 'grimling');
  let ring = null;
  for (let i = 0; i < 300 && !ring; i++) { steps(s, 1); s.players[0].hurtTimer = 200; ring = find(s, 'wandring'); }
  expect(ring).toBeDefined();
  expect(ring.vx).toBeLessThan(0);
  for (let k = 0; k < 3; k++) { stompBoss(s, e); s.players[0].hurtTimer = 200; }
  expect(e.hp).toBe(0);
  steps(s, 60);
  expect(find(s, 'orb').wand).toBe(true);
});
```
- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/bosses.test.js` → Expected: FAIL, `unknown entity type grimling`.

- [ ] **Step 3: Implement**

In `src/game/entities/bosses.js`, change the common import to `import { walk, face, nearestPlayer } from './common.js';` and append:
```js
register('grimling', {
  init(e, s) {
    e.w = 24; e.h = 24; e.enemy = true; e.harmful = true; e.stompable = true;
    e.boss = true; e.hp = 3; e.maxHp = 3; e.persistent = true; e.fireHits = 0;
    e.state = 'intro'; e.timer = 60;
    face(e, s);
  },
  update(e, s) {
    if (updateFlipped(e, s)) return;
    e.vy = Math.min(e.vy + 4, 64);
    if (e.state === 'intro') { moveBody(e, s.lv); if (--e.timer <= 0) e.state = 'hop'; return; }
    if (e.state === 'spin') {
      e.vx = e.dir * 32;
      const r = moveBody(e, s.lv);
      if (r.wall) e.dir = -r.wall;
      if (--e.timer <= 0) { e.state = 'hop'; e.stompable = true; e.vx = 0; }
      return;
    }
    face(e, s);
    e.vx = e.onGround ? 0 : e.dir * 12;
    if (e.onGround && e.t % 70 === 0) { e.vy = -56; e.onGround = false; }
    if (e.t % 120 === 60) {
      const p = nearestPlayer(s, e);
      if (p) {
        const dx = p.x - e.x, dy = p.y - e.y, len = Math.max(1, Math.hypot(dx, dy));
        spawnEntity(s, 'wandring', e.x + 6 * SUB, e.y + 4 * SUB, { vx: Math.round((dx / len) * 20), vy: Math.round((dy / len) * 20) });
        s.events.push({ e: 'sfx', id: 'fire' });
      }
    }
    e.state = e.t % 120 > 40 && e.t % 120 < 70 ? 'aim' : 'hop';
    moveBody(e, s.lv);
  },
  stomp(e, s) { damageBoss(s, e); },
  hit: bossHit,
});

register('wandring', {
  init(e) { e.w = 12; e.h = 12; e.harmful = true; },
  update(e) { e.x += e.vx; e.y += e.vy; if (e.t > 240) e.dead = true; },
});
```
`damageBoss` (Task 18) already marks the grimling's orb with `wand: true`. `Math.hypot` and division here produce floats that are immediately rounded to integers. The result is deterministic within one engine, which is all the host needs; guests receive entity positions rather than simulating them.

**1-A "Grimling's Galleon"** (theme `airship`, music `airship`, time 200, 160 wide, `boss: true`, `route: ['1-A', '1-Ab']`, start `[2, 11]`). The deck is `W` wood rows. The sky below the hull is a bottomless pit.

| Columns | Beat |
|---|---|
| 0–14 | A wood deck at row 12 (hull `W` at rows 12–13). |
| 16–40 | Deck sections at rows 11, 9 and 10, with 2–3 tile gaps. `K` cannons (1 tall) on deck edges fire Boom Bolts. A `?M?` at row 6. |
| 42–70 | Two Rotodiscs on `o` pivots at row 7 (columns 48, 62), with Bone Shells on the deck between. |
| 72–100 | Stacked cannons (2 and 3 tall) at columns 80 and 92, and a deck that steps up to row 8 then back down. |
| 102–130 | A long deck at row 10 with three 1-tall cannons and an `?L?` at row 6. |
| 132–159 | Final deck. A pipe (2 tall, mouth at row 9, columns 150–151) goes down to the cabin: `pipes: [{ at: [150, 9], dir: 'down', to: { level: '1-Ab', at: [2, 1], dir: 'down' } }]`. |

`1-Ab` (complete):
```js
'1-Ab': {
  id: '1-Ab', sub: true, theme: 'airship', music: 'boss', time: 200, start: [5, 10],
  map: String.raw`
##{}############
#.[]...........#
#..............#
#..............#
#..............#
#..............#
#..............#
#..............#
#..............#
#..............#
#.........q....#
################`,
},
```

- [ ] **Step 4: Run tests, solve, play**

Run: `bun test` → all pass. Run: `bun tools/autopilot.js 1-A` → `solved`. Run: `bun run selftest` → all pass.
Play `?level=1-A`. Check that bolts fly across the decks, that the cabin drop lands safely, and that wand rings are dodgeable at 1× speed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: Grimling's Galleon airship and the first Grimling boss

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 20: World map

**Files:**
- Create: `src/game/worldmap.js`, `src/content/maps/w1.js`, `src/content/sprites/map.js`, `src/draw/map.js`
- Modify: `src/content/sprites/index.js` (add the `map` group)
- Test: `tests/worldmap.test.js`

**Interfaces:**
- Produces:
  - Map def `{ world, name, music, grid: string, nodes: { [char]: { kind, level?, opens? } } }`.
    - Grid chars: `.` grass, `t` tree, `-` and `|` paths, and node chars defined in `nodes`.
    - Kinds: `start`, `level`, `fortress` (has `opens: 'L'`), `lock`, `hut`, `slots`, `airship`.
  - `createMap(def): MapState` = `{ x, y, px, py, moving: null | { tx, ty, dx, dy }, from: [dx, dy] | null, cleared: {}, opened: {}, used: {}, prev: [0, 0] }`. x/y are grid coordinates; px/py are pixels.
  - `stepMap(m, def, inputs: number[]): null | { kind, level?, key }`. Either player can steer. It returns an action when A is pressed on an enterable node. `key` is `"x,y"`.
  - `markCleared(m, def, key)` (opens the locks of a cleared fortress), `markUsed(m, key)`, `nodeAt(def, x, y)`, `canEnter(m, def, x, y)`.
  - Rules (SMB3):
    - The marker stops at every node.
    - From an uncleared level, fortress or airship you can only go back the way you came.
    - An unopened lock blocks; an opened lock is just path.
    - Cleared levels and used huts or slots can't be entered.
    - The marker moves 2 px per frame.
  - `drawMap(ctx, def, m, players, frame)`.

**`src/content/maps/w1.js`** (complete):
```js
export const MAP_W1 = {
  world: 1, name: 'MEADOW VALE', music: 'map1',
  grid: String.raw`
................
.S-1-2-H......t.
t......|........
...4-P-3....tt..
...|..........t.
...F-L-5-6......
t........|...t..
t........J-A....
................`,
  nodes: {
    S: { kind: 'start' },
    1: { kind: 'level', level: '1-1' }, 2: { kind: 'level', level: '1-2' }, 3: { kind: 'level', level: '1-3' },
    4: { kind: 'level', level: '1-4' }, 5: { kind: 'level', level: '1-5' }, 6: { kind: 'level', level: '1-6' },
    H: { kind: 'hut' }, J: { kind: 'hut' }, P: { kind: 'slots' },
    F: { kind: 'fortress', level: '1-F', opens: 'L' }, L: { kind: 'lock' },
    A: { kind: 'airship', level: '1-A' },
  },
};
```

- [ ] **Step 1: Write the failing test**

`tests/worldmap.test.js`:
```js
import { test, expect } from 'bun:test';
import { createMap, stepMap, markCleared, markUsed } from '../src/game/worldmap.js';
import { MAP_W1 } from '../src/content/maps/w1.js';
import { BTN } from '../src/game/consts.js';

const press = (m, b, who = 0) => {
  const inputs = [0, 0]; inputs[who] = b;
  let act = stepMap(m, MAP_W1, inputs);
  for (let i = 0; i < 120 && (m.moving || !act); i++) {
    const a = stepMap(m, MAP_W1, [0, 0]);
    act = act || a;
    if (!m.moving) break;
  }
  return act;
};
const at = (m) => [m.x, m.y];

test('starts on S and walks to level 1, stopping there', () => {
  const m = createMap(MAP_W1);
  expect(at(m)).toEqual([1, 1]);
  press(m, BTN.RIGHT);
  expect(at(m)).toEqual([3, 1]);
  press(m, BTN.RIGHT);
  expect(at(m)).toEqual([3, 1]);          // uncleared level blocks forward travel
  press(m, BTN.LEFT);
  expect(at(m)).toEqual([1, 1]);          // but you can go back
});

test('A on a level enters it; cleared levels cannot be entered again', () => {
  const m = createMap(MAP_W1);
  press(m, BTN.RIGHT);
  const act = press(m, BTN.A);
  expect(act).toEqual({ kind: 'level', level: '1-1', key: '3,1' });
  markCleared(m, MAP_W1, '3,1');
  expect(press(m, BTN.A)).toBe(null);
  press(m, BTN.RIGHT);
  expect(at(m)).toEqual([5, 1]);
});

test('either player can steer', () => {
  const m = createMap(MAP_W1);
  press(m, BTN.RIGHT, 1);
  expect(at(m)).toEqual([3, 1]);
});

test('paths turn corners at nodes and huts are single use', () => {
  const m = createMap(MAP_W1);
  for (const k of ['3,1', '5,1']) markCleared(m, MAP_W1, k);
  press(m, BTN.RIGHT); press(m, BTN.RIGHT); press(m, BTN.RIGHT);
  expect(at(m)).toEqual([7, 1]);          // the hut
  expect(press(m, BTN.A)).toEqual({ kind: 'hut', key: '7,1' });
  markUsed(m, '7,1');
  expect(press(m, BTN.A)).toBe(null);
  press(m, BTN.DOWN);
  expect(at(m)).toEqual([7, 3]);          // level 3, via the vertical path
});

test('the lock blocks until the fortress is cleared', () => {
  const m = createMap(MAP_W1);
  m.x = 3; m.y = 5; m.px = 48; m.py = 80;   // stand on the fortress
  markCleared(m, MAP_W1, '3,5');
  m.opened = {};                             // pretend the lock is still shut
  press(m, BTN.RIGHT);
  expect(at(m)).toEqual([3, 5]);
  markCleared(m, MAP_W1, '3,5');
  press(m, BTN.RIGHT);
  expect(at(m)).toEqual([7, 5]);           // walked through the open lock to level 5
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/worldmap.test.js` → Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/game/worldmap.js`:
```js
import { BTN } from './consts.js';

const rows = (def) => {
  if (!def._rows) {
    const r = def.grid.split('\n');
    if (r[0].trim() === '') r.shift();
    if (r[r.length - 1].trim() === '') r.pop();
    Object.defineProperty(def, '_rows', { value: r, enumerable: false });
  }
  return def._rows;
};
export const cell = (def, x, y) => (rows(def)[y] || '')[x] || '.';
export const nodeAt = (def, x, y) => def.nodes[cell(def, x, y)] || null;
const key = (x, y) => `${x},${y}`;
const BLOCKING = new Set(['level', 'fortress', 'airship']);

export function createMap(def) {
  const r = rows(def);
  let sx = 0, sy = 0;
  r.forEach((row, y) => { const x = row.indexOf('S'); if (x >= 0) { sx = x; sy = y; } });
  return { x: sx, y: sy, px: sx * 16, py: sy * 16, moving: null, from: null, cleared: {}, opened: {}, used: {}, prev: [0, 0] };
}

export function canEnter(m, def, x, y) {
  const n = nodeAt(def, x, y);
  if (!n) return false;
  const k = key(x, y);
  if (BLOCKING.has(n.kind)) return !m.cleared[k];
  if (n.kind === 'hut' || n.kind === 'slots') return !m.used[k];
  return false;
}

function findTarget(m, def, dx, dy) {
  let x = m.x + dx, y = m.y + dy;
  for (let guard = 0; guard < 64; guard++) {
    const ch = cell(def, x, y);
    if ((ch === '-' && dx) || (ch === '|' && dy)) { x += dx; y += dy; continue; }
    const n = def.nodes[ch];
    if (!n) return null;
    if (n.kind === 'lock') {
      if (!m.opened[key(x, y)]) return null;
      x += dx; y += dy; continue;
    }
    return { x, y };
  }
  return null;
}

export function stepMap(m, def, inputs) {
  let pressed = 0;
  inputs.forEach((b, i) => { pressed |= b & ~(m.prev[i] | 0); m.prev[i] = b; });
  if (m.moving) {
    const mv = m.moving;
    m.px += mv.dx * 2; m.py += mv.dy * 2;
    if (m.px === mv.tx * 16 && m.py === mv.ty * 16) { m.x = mv.tx; m.y = mv.ty; m.moving = null; }
    return null;
  }
  if (pressed & BTN.A) {
    if (!canEnter(m, def, m.x, m.y)) return null;
    const n = nodeAt(def, m.x, m.y);
    return { kind: n.kind, ...(n.level ? { level: n.level } : {}), key: key(m.x, m.y) };
  }
  const dir = pressed & BTN.LEFT ? [-1, 0] : pressed & BTN.RIGHT ? [1, 0] : pressed & BTN.UP ? [0, -1] : pressed & BTN.DOWN ? [0, 1] : null;
  if (!dir) return null;
  const here = nodeAt(def, m.x, m.y);
  const stuck = here && BLOCKING.has(here.kind) && !m.cleared[key(m.x, m.y)];
  if (stuck && !(m.from && m.from[0] === -dir[0] && m.from[1] === -dir[1])) return null;
  const t = findTarget(m, def, dir[0], dir[1]);
  if (!t) return null;
  m.moving = { tx: t.x, ty: t.y, dx: dir[0], dy: dir[1] };
  m.from = dir;
  return null;
}

export function markCleared(m, def, k) {
  m.cleared[k] = true;
  const [x, y] = k.split(',').map(Number);
  const n = nodeAt(def, x, y);
  if (n && n.opens) {
    rows(def).forEach((row, ly) => { for (let lx = 0; lx < row.length; lx++) if (row[lx] === n.opens) m.opened[key(lx, ly)] = true; });
  }
}

export function markUsed(m, k) { m.used[k] = true; }
```
The "stuck" rule uses `m.from`, the direction you arrived from. Leaving an uncleared level is allowed only in the opposite direction. At the start node `m.from` is null, and S is not blocking.

`src/content/sprites/map.js`: group with `defaultPal = 'map'` and palettes `map: [0x0F, 0x27, 0x37]`, `mapGreen: [0x0F, 0x1A, 0x2A]`, `panel: [0x0F, 0x27, 0x30]`, `panelDone: [0x0F, 0x16, 0x30]`. Sprites (16×16):

| Name | Look |
|---|---|
| `map.grass` | cream ground with a few tufts (SMB3 W1 map background) |
| `map.tree` | round black-outlined bush-tree |
| `map.path.h`, `map.path.v` | orange dotted road |
| `node.start` | "START" sign block |
| `node.level` | orange panel. The digit is drawn on top with the font. |
| `node.cleared` | panel with Pip's face (`panelDone`) |
| `node.hut` | Gift Hut: a little house with a bow on the roof |
| `node.slots` | spade-card panel |
| `node.fort` | grey brick fortress tower |
| `node.lock` | a locked gate; `node.lock.open` is the gate swung open |
| `node.airship` | castle with the airship floating above |

`src/content/sprites/index.js`: add `import * as map from './map.js';` and include `map` in `groups`.

`src/draw/map.js`:
```js
import { blit, fillNES } from '../engine/render.js';
import { drawText } from './text.js';
import { cell, nodeAt } from '../game/worldmap.js';

const OX = 0, OY = 40;   // map grid drawn from y=40 so the title sits above it

export function drawMap(ctx, def, m, players, frame) {
  fillNES(ctx, 0x37, 0, 0, 256, 200);
  drawText(ctx, `WORLD ${def.world}  ${def.name}`, 8, 16);
  const lines = def.grid.split('\n').filter(l => l.trim() !== '');
  lines.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x], X = OX + x * 16, Y = OY + y * 16;
      blit(ctx, 'map.grass', 'map', X, Y);
      if (ch === 't') blit(ctx, 'map.tree', 'mapGreen', X, Y);
      else if (ch === '-') blit(ctx, 'map.path.h', 'map', X, Y);
      else if (ch === '|') blit(ctx, 'map.path.v', 'map', X, Y);
      else {
        const n = def.nodes[ch];
        if (!n) continue;
        const k = `${x},${y}`;
        if (n.kind === 'level') {
          if (m.cleared[k]) blit(ctx, 'node.cleared', 'panelDone', X, Y);
          else { blit(ctx, 'node.level', 'panel', X, Y); drawText(ctx, ch, X + 4, Y + 4, 'textDark'); }
        } else if (n.kind === 'start') blit(ctx, 'node.start', 'panel', X, Y);
        else if (n.kind === 'hut') { if (!m.used[k]) blit(ctx, 'node.hut', 'panel', X, Y); else blit(ctx, 'map.path.h', 'map', X, Y); }
        else if (n.kind === 'slots') { if (!m.used[k]) blit(ctx, 'node.slots', 'panel', X, Y); else blit(ctx, 'map.path.h', 'map', X, Y); }
        else if (n.kind === 'fortress') blit(ctx, m.cleared[k] ? 'node.cleared' : 'node.fort', m.cleared[k] ? 'panelDone' : 'map', X, Y);
        else if (n.kind === 'lock') blit(ctx, m.opened[k] ? 'node.lock.open' : 'node.lock', 'map', X, Y);
        else if (n.kind === 'airship') blit(ctx, 'node.airship', 'map', X, Y);
      }
    }
  });
  const bob = (frame >> 4) & 1;
  players.forEach((p, i) => blit(ctx, 'small.front', i ? 'pep' : 'pip', OX + m.px + i * 6 - (players.length > 1 ? 3 : 0), OY + m.py - 4 - bob));
}
```

- [ ] **Step 4: Run tests and look at it**

Run: `bun test` → Expected: all pass. Add a temporary `?map` hook to the dev runner that draws `drawMap(ctx, MAP_W1, map, [{}], frame)` and steps it with input. Screenshot it and read the PNG. It should be clearly SMB3-like: cream background, orange roads, black-outlined trees, readable panel numbers. Keep the hook (Task 23 replaces main.js).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: World 1 map with SMB3 movement rules, fortress locks and huts

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 21: Item inventory, Gift Hut, Slot Panel and goal cards

**Files:**
- Create: `src/game/inventory.js`, `src/game/minigames.js`, `src/draw/hut.js`, `src/draw/slots.js`, `src/draw/itembar.js`
- Modify: `src/content/sprites/ui.js` (chests, keeper, slot strips, item box, cursor)
- Test: `tests/inventory.test.js`, `tests/minigames.test.js`

**Interfaces:**
- Produces:
  - `MAX_ITEMS = 28`; `addItem(inv, item): boolean`.
  - `useItem(inv, idx, who: { form }): null | { form } | { star: true }`. It removes the item when used. Berry: small → big, otherwise not usable (returns null and keeps the item). Blossom → fire. Leaf → leaf. Star → star at the next level start.
  - `addCard(cards: number[], card): { cards, lives }`. With 3 cards: all Berry → 2 lives, all Blossom → 3, all Star → 5, mixed → 1, and the cards reset. Card −1 is ignored.
  - Gift Hut:
    - `createHut(rng): { chests: [item×3], cursor: 1, opened: -1, t: 0, done: false, winner: -1 }`, using a shuffled pool `['berry', 'blossom', 'leaf']`.
    - `stepHut(h, inputs): null | { give: item, to: playerIdx }`. Left/right moves the cursor and A opens a chest; it returns `give` once. `h.done` becomes true 90 frames after opening.
  - Slot Panel:
    - `createSlots(seed): { reels: [pos×3], stopped: 0, speeds: [3, 4, 5], t: 0, done: false, result: -1, lives: 0 }`.
    - `stepSlots(sl, inputs): null | { lives }`. Each A stops the next reel; the result is evaluated when the third stops. The picture index is `Math.floor(pos / 32) % 3` (0 Berry, 1 Blossom, 2 Star). Lives: 2 / 3 / 5 for a full match, else 0. `done` becomes true 120 frames after the result.
  - Draw functions:
    - `drawHut(ctx, h, frame)`
    - `drawSlots(ctx, sl, frame)`
    - `drawItemBar(ctx, inv, sel, who)`, an overlay over the status bar showing 7 slots around `sel`.

- [ ] **Step 1: Write the failing tests**

`tests/inventory.test.js`:
```js
import { test, expect } from 'bun:test';
import { addItem, useItem, addCard, MAX_ITEMS } from '../src/game/inventory.js';

test('inventory holds 28 items', () => {
  const inv = [];
  for (let i = 0; i < 30; i++) addItem(inv, 'berry');
  expect(inv.length).toBe(MAX_ITEMS);
});

test('using items changes form or grants a star', () => {
  const inv = ['berry', 'leaf', 'star', 'blossom'];
  expect(useItem(inv, 0, { form: 'big' })).toBe(null);
  expect(inv.length).toBe(4);
  expect(useItem(inv, 0, { form: 'small' })).toEqual({ form: 'big' });
  expect(useItem(inv, 0, { form: 'big' })).toEqual({ form: 'leaf' });
  expect(useItem(inv, 0, { form: 'leaf' })).toEqual({ star: true });
  expect(useItem(inv, 0, { form: 'small' })).toEqual({ form: 'fire' });
  expect(inv).toEqual([]);
});

test('three goal cards pay out lives and reset', () => {
  let r = addCard([], 2); r = addCard(r.cards, 2); r = addCard(r.cards, 2);
  expect(r).toEqual({ cards: [], lives: 5 });
  r = addCard([0, 1], 2);
  expect(r).toEqual({ cards: [], lives: 1 });
  r = addCard([0], -1);
  expect(r).toEqual({ cards: [0], lives: 0 });
  r = addCard([0, 0], 0);
  expect(r.lives).toBe(2);
  r = addCard([1, 1], 1);
  expect(r.lives).toBe(3);
});
```

`tests/minigames.test.js`:
```js
import { test, expect } from 'bun:test';
import { createHut, stepHut, createSlots, stepSlots } from '../src/game/minigames.js';
import { BTN } from '../src/game/consts.js';

test('gift hut: move, open a chest, get its item once, then finish', () => {
  const h = createHut({ seed: 5 });
  expect([...h.chests].sort()).toEqual(['berry', 'blossom', 'leaf']);
  stepHut(h, [BTN.RIGHT, 0]); stepHut(h, [0, 0]);
  expect(h.cursor).toBe(2);
  const r = stepHut(h, [0, BTN.A]);
  expect(r).toEqual({ give: h.chests[2], to: 1 });
  expect(stepHut(h, [0, BTN.A])).toBe(null);
  for (let i = 0; i < 95; i++) stepHut(h, [0, 0]);
  expect(h.done).toBe(true);
});

test('slot panel: three presses stop the reels and pay out matches', () => {
  const sl = createSlots(1);
  sl.reels = [0, 0, 0]; sl.speeds = [0, 0, 0];   // freeze on Berry for a deterministic match
  let out = null;
  for (let i = 0; i < 3; i++) { out = stepSlots(sl, [BTN.A, 0]) || out; stepSlots(sl, [0, 0]); }
  expect(out).toEqual({ lives: 2 });
  const miss = createSlots(1);
  miss.reels = [0, 32, 64]; miss.speeds = [0, 0, 0];
  let o2 = null;
  for (let i = 0; i < 3; i++) { o2 = stepSlots(miss, [BTN.A, 0]) || o2; stepSlots(miss, [0, 0]); }
  expect(o2).toEqual({ lives: 0 });
  for (let i = 0; i < 125; i++) stepSlots(miss, [0, 0]);
  expect(miss.done).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/inventory.test.js tests/minigames.test.js` → Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/game/inventory.js`:
```js
export const MAX_ITEMS = 28;

export function addItem(inv, item) {
  if (inv.length >= MAX_ITEMS) return false;
  inv.push(item);
  return true;
}

export function useItem(inv, idx, who) {
  const item = inv[idx];
  let effect = null;
  if (item === 'berry') effect = who.form === 'small' ? { form: 'big' } : null;
  else if (item === 'blossom') effect = who.form === 'fire' ? null : { form: 'fire' };
  else if (item === 'leaf') effect = who.form === 'leaf' ? null : { form: 'leaf' };
  else if (item === 'star') effect = { star: true };
  if (effect) inv.splice(idx, 1);
  return effect;
}

const PAYOUT = [2, 3, 5];
export function addCard(cards, card) {
  if (card < 0) return { cards, lives: 0 };
  const next = [...cards, card];
  if (next.length < 3) return { cards: next, lives: 0 };
  const same = next.every(c => c === next[0]);
  return { cards: [], lives: same ? PAYOUT[next[0]] : 1 };
}
```

`src/game/minigames.js`:
```js
import { BTN } from './consts.js';
import { randInt } from './rng.js';

const pressedOf = (state, inputs) => {
  let any = 0, who = -1;
  inputs.forEach((b, i) => {
    const p = b & ~(state.prev?.[i] | 0);
    if (p && who < 0) who = i;
    any |= p;
  });
  state.prev = [...inputs];
  return { any, who };
};

export function createHut(rng) {
  const pool = ['berry', 'blossom', 'leaf'];
  for (let i = pool.length - 1; i > 0; i--) { const j = randInt(rng, i + 1); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return { chests: pool, cursor: 1, opened: -1, t: 0, done: false, winner: -1, prev: [0, 0] };
}

export function stepHut(h, inputs) {
  const { any, who } = pressedOf(h, inputs);
  if (h.opened >= 0) { if (++h.t >= 90) h.done = true; return null; }
  if (any & BTN.LEFT) h.cursor = Math.max(0, h.cursor - 1);
  if (any & BTN.RIGHT) h.cursor = Math.min(2, h.cursor + 1);
  if (any & BTN.A) {
    h.opened = h.cursor; h.winner = who;
    return { give: h.chests[h.cursor], to: who };
  }
  return null;
}

export const SLOT_STRIDE = 32;
const PAY = [2, 3, 5];

export function createSlots(seed) {
  return { reels: [seed * 7 % 96, seed * 13 % 96, seed * 29 % 96], speeds: [3, 4, 5], stopped: 0, t: 0, done: false, result: -1, lives: 0, prev: [0, 0] };
}

export const slotPicture = (pos) => Math.floor(pos / SLOT_STRIDE) % 3;

export function stepSlots(sl, inputs) {
  const { any } = pressedOf(sl, inputs);
  if (sl.result >= 0) { if (++sl.t >= 120) sl.done = true; return null; }
  for (let i = sl.stopped; i < 3; i++) sl.reels[i] = (sl.reels[i] + sl.speeds[i]) % (SLOT_STRIDE * 3);
  if (!(any & BTN.A)) return null;
  // Snap the stopped reel to the picture it is showing.
  const i = sl.stopped;
  sl.reels[i] = slotPicture(sl.reels[i]) * SLOT_STRIDE;
  sl.stopped++;
  if (sl.stopped < 3) return null;
  const pics = sl.reels.map(slotPicture);
  sl.result = pics.every(p => p === pics[0]) ? pics[0] : 3;
  sl.lives = sl.result < 3 ? PAY[sl.result] : 0;
  return { lives: sl.lives };
}
```
In the slot test the speeds are 0, so the "advance reels" line does nothing and the snapped positions are exact.

`src/draw/hut.js`, `src/draw/slots.js` and `src/draw/itembar.js` draw these states:
- Hut: brown wood room. Nana Moss (`keeper`, 16×24) on the left with "PICK A CHEST!" in the font. Three `chest` sprites at x = 72, 120, 168, y = 120. The cursor sits above the selected chest. An opened chest shows `chest.open`, and its item's sprite rises above it over 30 frames.
- Slots: black background, "MATCH THE PICTURE!" title. Three reel windows (48×16 each) stacked at x = 104, y = 80/96/112, each blitting `slot.<berry|blossom|star>.<0|1|2>` for its current picture. Show "x2", "x3" or "x5" lives text on a win, or "SORRY!" on a miss.
- Item bar: draws over the status bar (y 200–240): a framed row of 7 `itembox` slots with item sprites and a blinking `cursor` under the selected one, plus "PIP'S ITEMS" or "PEP'S ITEMS".

Add these sprites to `src/content/sprites/ui.js`: `chest`, `chest.open` (16×16), `keeper` (16×24), `itembox` (16×16), `cursor` (8×8), and `slot.berry.0/1/2`, `slot.blossom.0/1/2`, `slot.star.0/1/2` (48×16 each: the three horizontal strips of a 48×48 picture). Palettes: `chest: [0x0F, 0x17, 0x28]`, `keeper: [0x0F, 0x2A, 0x37]`, `slot: [0x0F, 0x16, 0x30]`.

- [ ] **Step 4: Run tests**

Run: `bun test` → Expected: all pass (including the art test, which checks that new sprites parse).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: item inventory, Gift Hut, Slot Panel and goal-card bonuses

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 22: Save slots

**Files:**
- Create: `src/game/save.js`
- Test: `tests/save.test.js`

**Interfaces:**
- Produces:
  - `SAVE_VERSION = 1`, `SLOT_COUNT = 3`.
  - `safeStorage(): Storage | null`. Returns `null` if `localStorage` is missing or throws when accessed (private mode, blocked storage).
  - `writeSave(storage, slot, data): boolean`. Never throws.
  - `readSave(storage, slot): { ok: true, data } | { ok: false, reason: 'empty'|'corrupt'|'version'|'unavailable', raw? }`. Never throws, and keeps the raw text of a corrupt save in `raw`.
  - `eraseSave(storage, slot): boolean`.
  - `listSaves(storage): [{ slot, ok, summary?: { world, lives, cleared }, reason? }] ×3`.
  - `exportSave(data): string` (base64 JSON) and `importSave(str): { ok, data? }`.
  - Save data shape (`SaveData`), written by `makeSave(sess)` in Task 23: `{ v: 1, world, map: { x, y, cleared, opened, used }, shared: { lives, coins, score }, forms, items, cards }`.

- [ ] **Step 1: Write the failing test**

`tests/save.test.js`:
```js
import { test, expect } from 'bun:test';
import { writeSave, readSave, eraseSave, listSaves, exportSave, importSave, SAVE_VERSION } from '../src/game/save.js';

const fakeStorage = () => {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), _m: m };
};
const data = { v: SAVE_VERSION, world: 1, map: { x: 3, y: 1, cleared: { '3,1': true }, opened: {}, used: {} }, shared: { lives: 6, coins: 12, score: 4200 }, forms: ['big'], items: [['leaf']], cards: [[2]] };

test('write, read, list and erase', () => {
  const st = fakeStorage();
  expect(writeSave(st, 1, data)).toBe(true);
  expect(readSave(st, 1)).toEqual({ ok: true, data });
  const list = listSaves(st);
  expect(list[0]).toMatchObject({ slot: 0, ok: false, reason: 'empty' });
  expect(list[1]).toMatchObject({ slot: 1, ok: true, summary: { world: 1, lives: 6, cleared: 1 } });
  expect(eraseSave(st, 1)).toBe(true);
  expect(readSave(st, 1).reason).toBe('empty');
});

test('corrupt and wrong-version saves are reported, not thrown', () => {
  const st = fakeStorage();
  st.setItem('superpip.save.0', '{not json');
  st.setItem('superpip.save.2', JSON.stringify({ ...data, v: 99 }));
  expect(readSave(st, 0)).toEqual({ ok: false, reason: 'corrupt', raw: '{not json' });
  expect(readSave(st, 2).reason).toBe('version');
  expect(() => listSaves(st)).not.toThrow();
});

test('missing or throwing storage never throws', () => {
  expect(listSaves(null).every(s => s.reason === 'unavailable')).toBe(true);
  expect(writeSave(null, 0, data)).toBe(false);
  const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('x'); } };
  expect(readSave(throwing, 0).reason).toBe('unavailable');
  expect(writeSave(throwing, 0, data)).toBe(false);
  expect(eraseSave(throwing, 0)).toBe(false);
});

test('export and import round-trip; garbage import fails cleanly', () => {
  expect(importSave(exportSave(data))).toEqual({ ok: true, data });
  expect(importSave('%%%').ok).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/save.test.js` → Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`src/game/save.js`:
```js
export const SAVE_VERSION = 1;
export const SLOT_COUNT = 3;
const KEY = (slot) => `superpip.save.${slot}`;

export function safeStorage() {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    s.getItem('superpip.probe');
    return s;
  } catch { return null; }
}

function validShape(d) {
  return d && typeof d === 'object' && typeof d.world === 'number' && d.map && d.shared && Array.isArray(d.forms);
}

export function readSave(storage, slot) {
  if (!storage) return { ok: false, reason: 'unavailable' };
  let raw;
  try { raw = storage.getItem(KEY(slot)); } catch { return { ok: false, reason: 'unavailable' }; }
  if (raw == null) return { ok: false, reason: 'empty' };
  let data;
  try { data = JSON.parse(raw); } catch { return { ok: false, reason: 'corrupt', raw }; }
  if (!validShape(data)) return { ok: false, reason: 'corrupt', raw };
  if (data.v !== SAVE_VERSION) return { ok: false, reason: 'version', raw };
  return { ok: true, data };
}

export function writeSave(storage, slot, data) {
  if (!storage) return false;
  try { storage.setItem(KEY(slot), JSON.stringify(data)); return true; } catch { return false; }
}

export function eraseSave(storage, slot) {
  if (!storage) return false;
  try { storage.removeItem(KEY(slot)); return true; } catch { return false; }
}

export function listSaves(storage) {
  return Array.from({ length: SLOT_COUNT }, (_, slot) => {
    const r = readSave(storage, slot);
    if (!r.ok) return { slot, ok: false, reason: r.reason };
    const d = r.data;
    return { slot, ok: true, summary: { world: d.world, lives: d.shared.lives, cleared: Object.keys(d.map.cleared || {}).length } };
  });
}

export function exportSave(data) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
}

export function importSave(str) {
  try {
    const data = JSON.parse(decodeURIComponent(escape(atob(str.trim()))));
    return validShape(data) && data.v === SAVE_VERSION ? { ok: true, data } : { ok: false };
  } catch { return { ok: false }; }
}
```

- [ ] **Step 4: Run tests**

Run: `bun test` → Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: three save slots that survive corrupt data and blocked storage

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 23: Game session, title screen and the real main.js (solo game complete)

**Files:**
- Create: `src/game/session.js`, `src/ui/title.js`, `src/draw/scenes.js`, `src/draw/present.js`
- Modify: `src/main.js` (title → game; dev runner kept behind `?level=` / `?gallery`)
- Test: `tests/session.test.js`

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `WORLDS = { 1: { levels, map } }`, `START_LIVES = 4`, `LETTER_FRAMES = 240`.
  - `createSession({ players = 1, seed = 1, save = null }): Session`. Fields: `scene: 'map'|'level'|'hut'|'slots'|'letter'|'gameover'`, `t, players, world, rng, shared, forms[], stars[], items[][], cards[][], map, menus[], level, node, hut, slots, gameover, paused, quit, dirty, events, prev`.
  - `stepSession(sess, inputs: number[])` and `enterNode(sess, act)` (used by the map and by tests).
  - `makeSave(sess): SaveData` and `applySave(sess, data)`. Arrays are padded to the player count, so a solo save can be hosted in co-op.
  - Rules:
    - The level result updates forms, cards, lives, score (+50 per second of time left) and marks the map node cleared.
    - A failed level costs one shared life, all forms reset to small, and the run returns to the map. Lives below 0 → game over (CONTINUE restores 4 lives and keeps progress; END quits to the title).
    - The airship's clear goes to Princess Lumi's letter (each player also gets a Star item), then back to the map.
    - Solo only: START in a level pauses. In co-op START does nothing in levels (spec: the menu doesn't freeze the sim).
    - On the map, START opens that player's own item bar. While it's open, that player's input doesn't steer.
  - `songFor(sess): string` and `hudFor(sess, local): HudData` in `src/draw/present.js`.
  - `drawSession(ctx, sess, local)` in `src/draw/scenes.js`.
  - Title:
    - `TITLE_OPTIONS` (starts as `['1 PLAYER GAME']`; Task 25 adds the co-op entries).
    - `createTitle(saves)`.
    - `stepTitle(tt, buttons): null | { action: 'start', slot } | { action: 'erase', slot } | { action: 'option', name }`.
    - `drawTitle(ctx, tt)`.
  - `window.__game = { mode, sess, title }` for headless QA.

- [ ] **Step 1: Write the failing test**

`tests/session.test.js`:
```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/session.test.js` → Expected: FAIL, modules not found.

- [ ] **Step 3: Implement the session**

`src/game/session.js`:
```js
import { BTN } from './consts.js';
import { createLevelSim, stepLevel, levelResult } from './sim.js';
import { createMap, stepMap, markCleared, markUsed } from './worldmap.js';
import { addItem, useItem, addCard } from './inventory.js';
import { createHut, stepHut, createSlots, stepSlots } from './minigames.js';
import { randInt } from './rng.js';
import { STAR_FRAMES } from './powerups.js';
import { SAVE_VERSION } from './save.js';
import { LEVELS as W1 } from '../content/levels/w1.js';
import { MAP_W1 } from '../content/maps/w1.js';

export const WORLDS = { 1: { levels: W1, map: MAP_W1 } };
export const START_LIVES = 4;
export const LETTER_FRAMES = 240;

const pad = (arr, n, make) => Array.from({ length: n }, (_, i) => (arr && arr[i] !== undefined ? structuredClone(arr[i]) : make()));

export function createSession({ players = 1, seed = 1, save = null } = {}) {
  const sess = {
    scene: 'map', t: 0, players, world: 1, rng: { seed },
    shared: { lives: START_LIVES, coins: 0, score: 0 },
    forms: pad(null, players, () => 'small'), stars: pad(null, players, () => false),
    items: pad(null, players, () => []), cards: pad(null, players, () => []),
    map: createMap(WORLDS[1].map), menus: pad(null, players, () => null),
    level: null, node: null, hut: null, slots: null, gameover: null,
    paused: false, quit: false, dirty: false, events: [], prev: [0, 0],
  };
  if (save) applySave(sess, save);
  return sess;
}

export function makeSave(sess) {
  const m = sess.map;
  return {
    v: SAVE_VERSION, world: sess.world,
    map: { x: m.x, y: m.y, cleared: { ...m.cleared }, opened: { ...m.opened }, used: { ...m.used } },
    shared: { ...sess.shared }, forms: [...sess.forms], items: structuredClone(sess.items), cards: structuredClone(sess.cards),
  };
}

export function applySave(sess, d) {
  sess.world = d.world;
  sess.map = createMap(WORLDS[d.world].map);
  Object.assign(sess.map, { x: d.map.x, y: d.map.y, px: d.map.x * 16, py: d.map.y * 16, cleared: { ...d.map.cleared }, opened: { ...d.map.opened }, used: { ...d.map.used } });
  sess.shared = { ...d.shared };
  sess.forms = pad(d.forms, sess.players, () => 'small');
  sess.items = pad(d.items, sess.players, () => []);
  sess.cards = pad(d.cards, sess.players, () => []);
}

const toScene = (sess, scene) => { sess.scene = scene; sess.t = 0; };

export function stepSession(sess, inputs) {
  sess.events = [];
  sess.t++;
  const pressed = inputs.map((b, i) => b & ~(sess.prev[i] | 0));
  sess.prev = [...inputs];
  const w = WORLDS[sess.world];
  switch (sess.scene) {
    case 'map': return stepMapScene(sess, w, inputs, pressed);
    case 'level': return stepLevelScene(sess, w, inputs, pressed);
    case 'hut': {
      const r = stepHut(sess.hut, inputs.slice(0, sess.players));
      if (r) { addItem(sess.items[r.to], r.give); sess.events.push({ e: 'sfx', id: 'powerup' }); }
      if (sess.hut.done) { markUsed(sess.map, sess.node.key); sess.hut = null; sess.dirty = true; toScene(sess, 'map'); }
      return;
    }
    case 'slots': {
      const r = stepSlots(sess.slots, inputs.slice(0, sess.players));
      if (r) { sess.shared.lives += r.lives; sess.events.push({ e: 'sfx', id: r.lives ? '1up' : 'bump' }); }
      if (sess.slots.done) { markUsed(sess.map, sess.node.key); sess.slots = null; sess.dirty = true; toScene(sess, 'map'); }
      return;
    }
    case 'letter':
      if (sess.t > LETTER_FRAMES && pressed.some(p => p & (BTN.A | BTN.START))) toScene(sess, 'map');
      return;
    case 'gameover': {
      const any = pressed.reduce((a, b) => a | b, 0);
      if (any & (BTN.UP | BTN.DOWN)) { sess.gameover.sel ^= 1; sess.events.push({ e: 'sfx', id: 'select' }); }
      if (any & (BTN.A | BTN.START)) {
        if (sess.gameover.sel === 0) { sess.shared.lives = START_LIVES; sess.dirty = true; toScene(sess, 'map'); }
        else sess.quit = true;
      }
    }
  }
}

function stepMapScene(sess, w, inputs, pressed) {
  const steer = inputs.map((b, i) => {
    if (i >= sess.players) return 0;
    const menu = sess.menus[i];
    if (pressed[i] & BTN.START) { sess.menus[i] = menu ? null : { sel: 0 }; sess.events.push({ e: 'sfx', id: 'pause' }); return 0; }
    if (!menu) return b;
    const inv = sess.items[i];
    if (pressed[i] & BTN.LEFT) menu.sel = Math.max(0, menu.sel - 1);
    if (pressed[i] & BTN.RIGHT) menu.sel = Math.min(Math.max(0, inv.length - 1), menu.sel + 1);
    if (pressed[i] & BTN.A && inv.length) {
      const fx = useItem(inv, menu.sel, { form: sess.forms[i] });
      if (fx) {
        if (fx.form) sess.forms[i] = fx.form;
        if (fx.star) sess.stars[i] = true;
        sess.events.push({ e: 'sfx', id: 'powerup' });
        sess.menus[i] = null; sess.dirty = true;
        return 0;
      }
      sess.events.push({ e: 'sfx', id: 'bump' });
    }
    if (pressed[i] & BTN.B) sess.menus[i] = null;
    return 0;
  });
  const wasMoving = !!sess.map.moving;
  const act = stepMap(sess.map, w.map, steer);
  if (!wasMoving && sess.map.moving) sess.events.push({ e: 'sfx', id: 'map' });
  if (act) enterNode(sess, act);
}

export function enterNode(sess, act) {
  const w = WORLDS[sess.world];
  sess.node = act;
  sess.menus = sess.menus.map(() => null);
  if (act.kind === 'hut') { sess.hut = createHut(sess.rng); toScene(sess, 'hut'); return; }
  if (act.kind === 'slots') { sess.slots = createSlots(1 + randInt(sess.rng, 97)); toScene(sess, 'slots'); return; }
  sess.level = createLevelSim(w.levels[act.level], {
    players: sess.players, forms: sess.forms, seed: 1 + randInt(sess.rng, 1e9), shared: sess.shared, defs: w.levels,
  });
  sess.level.players.forEach((p, i) => { if (sess.stars[i]) { p.starTimer = STAR_FRAMES; sess.stars[i] = false; } });
  sess.paused = false;
  toScene(sess, 'level');
}

function stepLevelScene(sess, w, inputs, pressed) {
  const lv = sess.level;
  if (sess.players === 1 && (pressed[0] & BTN.START) && lv.mode === 'play') {
    sess.paused = !sess.paused;
    sess.events.push({ e: 'sfx', id: 'pause' });
  }
  if (sess.paused) return;
  stepLevel(lv, inputs.slice(0, sess.players));
  sess.events.push(...lv.events);
  sess.shared = lv.shared;
  if (lv.mode === 'done') finishLevel(sess, w);
  else if (lv.mode === 'fail') failLevel(sess);
}

function finishLevel(sess, w) {
  const lv = sess.level, r = levelResult(lv);
  sess.shared = { ...lv.shared, score: lv.shared.score + lv.time * 50 };
  sess.forms = r.forms.slice();
  if (r.card >= 0) {
    const by = lv.clear.by;
    const c = addCard(sess.cards[by], r.card);
    sess.cards[by] = c.cards;
    if (c.lives) { sess.shared.lives += c.lives; sess.events.push({ e: 'sfx', id: '1up' }); }
  }
  markCleared(sess.map, w.map, sess.node.key);
  sess.level = null;
  sess.dirty = true;
  if (sess.node.kind === 'airship') {
    sess.items.forEach(inv => addItem(inv, 'star'));
    toScene(sess, 'letter');
  } else toScene(sess, 'map');
}

function failLevel(sess) {
  sess.shared = { ...sess.level.shared, lives: sess.level.shared.lives - 1 };
  sess.forms = sess.forms.map(() => 'small');
  sess.level = null;
  sess.dirty = true;
  if (sess.shared.lives < 0) { sess.gameover = { sel: 0 }; toScene(sess, 'gameover'); }
  else toScene(sess, 'map');
}
```

`src/draw/present.js`:
```js
import { WORLDS } from '../game/session.js';

export function songFor(sess) {
  switch (sess.scene) {
    case 'map': return WORLDS[sess.world].map.music;
    case 'hut': case 'slots': return 'hut';
    case 'letter': return 'worldclear';
    case 'gameover': return 'gameover';
    case 'level': {
      const s = sess.level;
      if (s.mode === 'clear' || s.mode === 'done') return s.clear && s.clear.card < 0 ? 'fortressclear' : 'clear';
      if (s.players.every(p => p.dead)) return 'death';
      if (s.entities.some(e => e.boss && e.state !== 'flipped')) return 'boss';
      if (s.players.some(p => p.starTimer > 0)) return 'star';
      if (s.pswitch > 0) return 'pswitch';
      return s.lv.music;
    }
    default: return '';
  }
}

export function hudFor(sess, local) {
  const p = sess.level ? sess.level.players[local] : null;
  return {
    world: sess.world, pmeter: p ? p.pmeter : 0, flying: !!(p && p.flyTimer > 0),
    coins: sess.shared.coins, lives: Math.max(0, sess.shared.lives), score: sess.shared.score,
    time: sess.level ? sess.level.time : 0,
    cards: [0, 1, 2].map(i => (sess.cards[local] && sess.cards[local][i] !== undefined ? sess.cards[local][i] : -1)),
    who: local,
  };
}
```

`src/draw/scenes.js`:
```js
import { drawLevel } from './level.js';
import { drawHud } from './hud.js';
import { drawMap } from './map.js';
import { drawHut } from './hut.js';
import { drawSlots } from './slots.js';
import { drawItemBar } from './itembar.js';
import { drawText } from './text.js';
import { fillNES } from '../engine/render.js';
import { hudFor } from './present.js';
import { WORLDS } from '../game/session.js';

const LETTER = [
  'DEAR PIP AND PEP,', '', 'THANK YOU FOR SAVING', "THE MEADOW KING'S WAND!", '',
  "GRIMJAW'S KIDS HAVE FLOWN", 'ON TO THE DUNE SEA.', '', "I'M SENDING YOU A STAR.", '',
  '      - PRINCESS LUMI', '', '(WORLD 2 IS COMING SOON)',
];

export function drawSession(ctx, sess, local) {
  const f = sess.t;
  switch (sess.scene) {
    case 'map':
      drawMap(ctx, WORLDS[sess.world].map, sess.map, Array(sess.players).fill(0), f);
      drawHud(ctx, hudFor(sess, local));
      if (sess.menus[local]) drawItemBar(ctx, sess.items[local], sess.menus[local].sel, local);
      return;
    case 'level':
      drawLevel(ctx, sess.level, local);
      drawHud(ctx, hudFor(sess, local));
      if (sess.paused) { fillNES(ctx, 0x0F, 88, 88, 80, 24); drawText(ctx, 'PAUSED', 104, 96); }
      return;
    case 'hut': drawHut(ctx, sess.hut, f); drawHud(ctx, hudFor(sess, local)); return;
    case 'slots': drawSlots(ctx, sess.slots, f); drawHud(ctx, hudFor(sess, local)); return;
    case 'letter':
      fillNES(ctx, 0x0F, 0, 0, 256, 240);
      fillNES(ctx, 0x37, 16, 16, 224, 208);
      LETTER.forEach((line, i) => { if (f > i * 12) drawText(ctx, line, 24, 28 + i * 14, 'textDark'); });
      if (f > 240 && (f >> 4) & 1) drawText(ctx, 'PRESS A', 100, 214, 'textDark');
      return;
    case 'gameover':
      fillNES(ctx, 0x0F, 0, 0, 256, 240);
      drawText(ctx, 'GAME OVER', 92, 80);
      drawText(ctx, `${sess.gameover.sel === 0 ? '>' : ' '} CONTINUE`, 84, 112);
      drawText(ctx, `${sess.gameover.sel === 1 ? '>' : ' '} END`, 84, 128);
  }
}
```
Add a `font.>` glyph to the UI sprites and `'>': 'font.>'` to the `NAMES` map in `src/draw/text.js`.

`src/ui/title.js`:
```js
import { BTN } from '../game/consts.js';
import { blit, fillNES } from '../engine/render.js';
import { drawText } from '../draw/text.js';

export const TITLE_OPTIONS = ['1 PLAYER GAME'];

export function createTitle(saves) {
  return { t: 0, mode: 'menu', sel: 0, slot: 0, saves, confirm: false, prev: 0 };
}

export function stepTitle(tt, buttons) {
  const p = buttons & ~tt.prev;
  tt.prev = buttons;
  tt.t++;
  if (tt.t < 90) { if (p) tt.t = 90; return null; }   // any key skips the curtain
  if (tt.mode === 'menu') {
    if (p & BTN.UP) tt.sel = (tt.sel + TITLE_OPTIONS.length - 1) % TITLE_OPTIONS.length;
    if (p & BTN.DOWN) tt.sel = (tt.sel + 1) % TITLE_OPTIONS.length;
    if (p & (BTN.A | BTN.START)) {
      const name = TITLE_OPTIONS[tt.sel];
      if (name === '1 PLAYER GAME') { tt.mode = 'slots'; tt.next = 'solo'; return null; }
      return { action: 'option', name };
    }
    return null;
  }
  if (tt.mode === 'slots') {
    if (tt.confirm) {
      if (p & BTN.A) { tt.confirm = false; return { action: 'erase', slot: tt.slot }; }
      if (p & BTN.B) tt.confirm = false;
      return null;
    }
    if (p & BTN.UP) tt.slot = (tt.slot + 2) % 3;
    if (p & BTN.DOWN) tt.slot = (tt.slot + 1) % 3;
    if (p & BTN.B) tt.mode = 'menu';
    if (p & BTN.SELECT && tt.saves[tt.slot].ok) tt.confirm = true;
    if (p & (BTN.A | BTN.START)) return { action: 'start', slot: tt.slot, next: tt.next };
  }
  return null;
}

export function drawTitle(ctx, tt) {
  fillNES(ctx, 0x0F, 0, 0, 256, 240);
  for (let y = 192; y < 240; y += 8) for (let x = 0; x < 256; x += 8) if (((x + y) >> 3) & 1) fillNES(ctx, 0x30, x, y, 8, 8);
  ctx.save(); ctx.scale(2, 2);
  drawText(ctx, 'SUPER PIP', 29, 17, 'textDark');
  drawText(ctx, 'SUPER PIP', 28, 16, 'textRed');
  drawText(ctx, 'BROS.', 44, 33, 'textDark');
  drawText(ctx, 'BROS.', 43, 32, 'textRed');
  ctx.restore();
  blit(ctx, 'big.stand', 'pip', 96, 160);
  blit(ctx, 'big.stand', 'pep', 144, 160, { flipX: true });
  if (tt.mode === 'menu') {
    TITLE_OPTIONS.forEach((o, i) => drawText(ctx, `${i === tt.sel ? '>' : ' '} ${o}`, 64, 112 + i * 14));
  } else {
    tt.saves.forEach((s, i) => {
      const label = s.ok ? `WORLD ${s.summary.world} x${s.summary.lives}` : s.reason === 'unavailable' ? 'NO SAVING' : 'NEW GAME';
      drawText(ctx, `${i === tt.slot ? '>' : ' '} SLOT ${i + 1} ${label}`, 32, 104 + i * 14);
    });
    drawText(ctx, tt.confirm ? 'ERASE? A=YES B=NO' : 'SELECT=ERASE  B=BACK', 40, 150);
  }
  // Theatre curtain rising, SMB3-style.
  const h = Math.max(0, 240 - tt.t * 3);
  for (let x = 0; x < 256; x += 8) {
    fillNES(ctx, 0x16, x, 0, 8, h);
    fillNES(ctx, 0x06, x + 6, 0, 2, h);
  }
  if (h > 0) for (let x = 0; x < 256; x += 16) fillNES(ctx, 0x06, x, h - 4, 12, 4);
}
```

- [ ] **Step 4: Replace `src/main.js`**

Keep the dev runner and gallery from Tasks 13–20 behind `?level=` and `?gallery` (move their bodies into `devRunner()` and `gallery()` functions in the same file). The default path becomes:
```js
import { createSession, stepSession, makeSave } from './game/session.js';
import { songFor } from './draw/present.js';
import { drawSession } from './draw/scenes.js';
import { createTitle, stepTitle, drawTitle } from './ui/title.js';
import { safeStorage, listSaves, readSave, writeSave, eraseSave } from './game/save.js';

const storage = safeStorage();

function game() {
  let mode = 'title', title = createTitle(listSaves(storage)), sess = null, slot = 0, song = '';
  window.__game = { get mode() { return mode; }, get sess() { return sess; }, get title() { return title; } };
  const begin = (players, saveSlot) => {
    const r = readSave(storage, saveSlot);
    sess = createSession({ players, seed: (Math.random() * 1e9) | 0, save: r.ok ? r.data : null });
    slot = saveSlot; mode = 'game';
  };
  startLoop({
    step() {
      const m = input.read();
      if (mode === 'title') {
        const act = stepTitle(title, m);
        if (act?.action === 'start') begin(1, act.slot);
        else if (act?.action === 'erase') { eraseSave(storage, act.slot); title.saves = listSaves(storage); }
      } else {
        stepSession(sess, [m, 0]);
        for (const ev of sess.events) {
          if (ev.e === 'sfx') audio.sfx(ev.id);
          if (ev.e === 'sfx' && ev.id === 'hurry') audio.setTempoScale(1.25);
        }
        if (sess.dirty && sess.scene !== 'level') { writeSave(storage, slot, makeSave(sess)); sess.dirty = false; }
        if (sess.quit) { mode = 'title'; title = createTitle(listSaves(storage)); }
      }
      const want = mode === 'title' ? 'title' : songFor(sess);
      if (want !== song) { song = want; audio.setTempoScale(1); if (want) audio.playSong(want); else audio.stopSong(); }
    },
    draw() { if (mode === 'title') drawTitle(ctx, title); else drawSession(ctx, sess, 0); },
  });
}

if (params.has('gallery')) gallery();
else if (params.has('level')) devRunner();
else game();
```
`Math.random` is fine here because `main.js` is presentation, not `src/game/`.

- [ ] **Step 5: Run tests and play the whole world**

Run: `bun test` → Expected: all pass.
Play `http://localhost:5190/` start to finish: title → slot → map → every level, the hut, the slots, the fortress (opens the lock), the airship → letter. Check that reloading the page resumes from the save. Screenshot the title, the map, the item bar, the hut, the slots, the letter and the game over screen. Read each one.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: full solo game - title, save slots, map, levels, huts, slots, letter, game over

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 24: Co-op netcode core (host authority, guest prediction, join/leave anytime)

**Files:**
- Create: `src/net/transport.js`, `src/net/protocol.js`, `src/net/host.js`, `src/net/guest.js`
- Modify: `src/game/session.js` (`addPlayer`, `dropPlayer`, per-index form copy in `finishLevel`), `src/game/player.js` (jump event carries `who`)
- Test: `tests/net.test.js`

**Interfaces:**
- Produces:
  - Transport contract: `{ send(msg), onMessage(fn), onClose(fn), close() }`. `createLoopback({ latency = 0, jitter = 0, seed = 1 }): { a, b, tick() }` is an in-memory reliable, ordered pair. Every message goes through `JSON.parse(JSON.stringify(msg))`, so anything that isn't JSON-safe fails in tests. `tick()` advances one frame of simulated time.
  - `PROTOCOL_VERSION = 1`. Messages:
    - Guest → host: `{ t: 'hello', v }`, `{ t: 'in', f, b }`, `{ t: 'bye' }`.
    - Host → guest: `{ t: 'welcome', idx: 1 }`, `{ t: 'reject', reason }`, `{ t: 'snap', f, ack, hb, sess, level, ev }`.
  - `liteSession(sess)` (everything but `level`), `levelSnapshot(s, sent)` (JSON-safe; tiles are sent in full on an area change, otherwise as deltas from `lv.tileLog`), `b64(u8)` and `unb64(str)`.
  - `createHost(sess)` returns:
    - `attach(transport)`
    - `step(localButtons): events` (steps the session and returns events for local audio)
    - `connected: boolean`
  - The host consumes queued guest inputs one per frame, so quick taps survive jitter. A backlog over 6 inputs is collapsed by OR-ing the extra inputs together. A snapshot goes out every 3 frames.
  - `createGuest(transport, worlds)` returns:
    - `step(localButtons): events`. Local prediction runs only in the level scene.
    - `view(): Session-like` (for `drawSession` and `songFor`)
    - `status: 'connecting'|'playing'|'rejected'|'closed'`
    - `reason`
  - `addPlayer(sess)`: player 2 appears next to player 1 with 120 frames of invulnerability, even mid-level. `dropPlayer(sess)`: back to 1 player, with player 2's items and cards kept for when they return.

- [ ] **Step 1: Write the failing test**

`tests/net.test.js`:
```js
import { test, expect } from 'bun:test';
import { createLoopback } from '../src/net/transport.js';
import { createHost } from '../src/net/host.js';
import { createGuest } from '../src/net/guest.js';
import { createSession, enterNode, WORLDS } from '../src/game/session.js';
import { BTN, SUB } from '../src/game/consts.js';
import { PROTOCOL_VERSION } from '../src/net/protocol.js';

// A flat, enemy-free level with ? blocks, so tests are about netcode and not about dying.
const row = (ch) => ch.repeat(200);
WORLDS[1].levels.nt = {
  id: 'nt', time: 999, start: [2, 11],
  map: [row('.'), row('.'), row('.'), row('.'), row('.'), row('.'), row('.'), row('.'),
    '..' + '?.'.repeat(99), row('.'), row('.'), row('.'), row('#'), row('#')].join('\n'),
};

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/net.test.js` → Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

In `src/game/player.js`, change the jump event to `out.events.push({ e: 'sfx', id: 'jump', who: p.idx });`.

In `src/game/session.js`, add the following, and in `finishLevel` replace `sess.forms = r.forms.slice();` with `r.forms.forEach((f, i) => { sess.forms[i] = f; });`:
```js
import { createPlayer } from './player.js';
import { createCamera } from './camera.js';
import { SUB } from './consts.js';

export function addPlayer(sess) {
  if (sess.players >= 2) return;
  sess.players = 2;
  if (sess.forms.length < 2) sess.forms.push('small');
  if (sess.stars.length < 2) sess.stars.push(false);
  if (sess.items.length < 2) sess.items.push([]);
  if (sess.cards.length < 2) sess.cards.push([]);
  if (sess.menus.length < 2) sess.menus.push(null);
  if (sess.level) {
    const host = sess.level.players[0];
    const p = createPlayer(1, 0, 0, 'small');
    p.x = host.x; p.y = host.y + host.h * SUB - p.h * SUB; p.onGround = host.onGround; p.hurtTimer = 120;
    sess.level.players.push(p);
    sess.level.cams.push(createCamera(p, sess.level.lv));
  }
}

export function dropPlayer(sess) {
  if (sess.players < 2) return;
  sess.players = 1;
  sess.menus[1] = null;
  if (sess.level) { sess.level.players.length = 1; sess.level.cams.length = 1; }
}
```

`src/net/transport.js`:
```js
import { rand } from '../game/rng.js';

export function createLoopback({ latency = 0, jitter = 0, seed = 1 } = {}) {
  const rng = { seed };
  let now = 0;
  const mk = () => ({ inbox: [], handlers: [], closers: [], lastAt: 0, closed: false });
  const A = mk(), B = mk();
  const end = (me, other) => ({
    send(msg) {
      if (me.closed || other.closed) return;
      const at = Math.max(other.lastAt, now + latency + Math.floor(rand(rng) * (jitter + 1)));
      other.lastAt = at;
      other.inbox.push({ at, msg: JSON.parse(JSON.stringify(msg)) });
    },
    onMessage(fn) { me.handlers.push(fn); },
    onClose(fn) { me.closers.push(fn); },
    close() {
      if (me.closed) return;
      me.closed = true; other.closed = true;
      for (const f of [...me.closers, ...other.closers]) f();
    },
  });
  const a = end(A, B), b = end(B, A);
  return {
    a, b,
    tick() {
      now++;
      for (const side of [A, B]) {
        while (side.inbox.length && side.inbox[0].at <= now) {
          const { msg } = side.inbox.shift();
          for (const h of side.handlers) h(msg);
        }
      }
    },
  };
}

// Wrap a PeerJS DataConnection (serialization: 'json').
export function peerTransport(conn) {
  return {
    send(msg) { if (conn.open) conn.send(msg); },
    onMessage(fn) { conn.on('data', fn); },
    onClose(fn) { conn.on('close', fn); conn.on('error', fn); },
    close() { conn.close(); },
  };
}
```

`src/net/protocol.js`:
```js
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
```
On an area change the host's `lv.tileLog` starts empty (Task 12's `enterArea` creates a fresh `lv` and restores tiles with `set`), so `sent.n = lv.tileLog.length` after a full send is the correct baseline.

`src/net/host.js`:
```js
import { stepSession, addPlayer, dropPlayer } from '../game/session.js';
import { PROTOCOL_VERSION, SNAP_EVERY, liteSession, levelSnapshot, forGuest } from './protocol.js';

export function createHost(sess) {
  const h = {
    sess, conn: null, connected: false, queue: [], lastB: 0, ack: -1, frame: 0, sent: { area: null, n: 0 }, evBuf: [], localB: 0,
    attach(conn) {
      conn.onMessage((m) => {
        if (m.t === 'hello') {
          if (m.v !== PROTOCOL_VERSION) { conn.send({ t: 'reject', reason: 'version' }); return; }
          h.conn = conn; h.connected = true; h.queue = []; h.lastB = 0; h.ack = -1; h.sent = { area: null, n: 0 };
          addPlayer(h.sess);
          conn.send({ t: 'welcome', idx: 1 });
        } else if (m.t === 'in' && h.conn === conn) {
          h.queue.push(m);
        } else if (m.t === 'bye' && h.conn === conn) {
          conn.close();
        }
      });
      conn.onClose(() => {
        if (h.conn !== conn) return;
        h.conn = null; h.connected = false;
        dropPlayer(h.sess);
      });
    },
    step(localB) {
      h.localB = localB;
      let gb = h.lastB;
      if (h.queue.length > 6) {
        // Collapse a backlog but keep every press that happened in it.
        const extra = h.queue.splice(0, h.queue.length - 6);
        const ored = extra.reduce((a, m) => a | m.b, 0);
        h.queue[0] = { ...h.queue[0], b: h.queue[0].b | ored };
      }
      if (h.queue.length) { const m = h.queue.shift(); gb = m.b; h.ack = m.f; h.lastB = m.b; }
      stepSession(h.sess, h.connected ? [localB, gb] : [localB]);
      const events = h.sess.events;
      if (h.connected) {
        h.evBuf.push(...forGuest(events));
        if (++h.frame % SNAP_EVERY === 0) {
          h.conn.send({
            t: 'snap', f: h.frame, ack: h.ack, hb: localB,
            sess: liteSession(h.sess),
            level: h.sess.level ? levelSnapshot(h.sess.level, h.sent) : null,
            ev: h.evBuf.splice(0),
          });
          if (!h.sess.level) h.sent = { area: null, n: 0 };
        }
      }
      return events;
    },
  };
  return h;
}
```
`stepSession` already slices inputs to `sess.players`, so the guest input is ignored whenever player 2 isn't present.

`src/net/guest.js`:
```js
import { stepLevel } from '../game/sim.js';
import { parseLevel } from '../game/level.js';
import { PROTOCOL_VERSION, unb64 } from './protocol.js';

export function createGuest(conn, worlds) {
  const g = {
    status: 'connecting', reason: '', sess: null, level: null, baseLv: null,
    pending: [], f: 0, hostB: 0, inbound: [],
    step(localB) {
      if (g.status !== 'playing' && g.status !== 'connecting') return [];
      conn.send({ t: 'in', f: g.f, b: localB });
      g.pending.push({ f: g.f, b: localB });
      g.f++;
      const events = g.inbound.splice(0).filter(e => !(e.id === 'jump' && e.who === 1));
      if (g.sess && g.sess.scene === 'level' && g.level && g.level.mode === 'play') {
        stepLevel(g.level, [g.hostB, localB]);
        for (const e of g.level.events) if (e.e === 'sfx' && e.id === 'jump' && e.who === 1) events.push(e);
      }
      return events;
    },
    view() { return g.sess ? { ...g.sess, level: g.level } : null; },
  };

  const defsFor = (area) => worlds[g.sess.world].levels;

  function applySnapshot(m) {
    g.sess = m.sess;
    g.hostB = m.hb;
    g.inbound.push(...m.ev);
    g.pending = g.pending.filter(p => p.f > m.ack);
    if (!m.level) { g.level = null; g.baseLv = null; return; }
    const L = m.level, T = L.tiles, defs = defsFor(T.area);
    if (T.full) {
      g.baseLv = parseLevel(defs[T.area]);
      g.baseLv.tiles.set(unb64(T.full));
    } else if (g.baseLv && g.baseLv.id === T.area) {
      for (const op of T.ops) g.baseLv.tiles[op.ty * g.baseLv.w + op.tx] = op.id;
    } else return;
    const { tiles, ...rest } = L;
    const s = {
      ...rest,
      lv: { ...g.baseLv, tiles: g.baseLv.tiles.slice(), tileLog: [] },
      spawned: Uint8Array.from(L.spawned), defs, areaStore: {}, events: [],
    };
    for (const p of g.pending) stepLevel(s, [g.hostB, p.b]);   // replay unacknowledged inputs
    g.level = s;
  }

  conn.onMessage((m) => {
    if (m.t === 'welcome') g.status = 'playing';
    else if (m.t === 'reject') { g.status = 'rejected'; g.reason = m.reason; }
    else if (m.t === 'snap') applySnapshot(m);
  });
  conn.onClose(() => { if (g.status !== 'rejected') g.status = 'closed'; });
  conn.send({ t: 'hello', v: PROTOCOL_VERSION });
  return g;
}
```
The guest re-simulates the whole level (not just its own player) from each snapshot, so enemies move smoothly between snapshots and its own player responds instantly. Any disagreement, such as a stomp the host didn't see, is corrected by the next snapshot. Events produced while replaying are thrown away, so sounds play once: host events arrive in `ev`, and the guest plays its own jump immediately.

- [ ] **Step 4: Run tests**

Run: `bun test tests/net.test.js` → Expected: all pass. If the convergence test fails, log `mine.x - host1.x` per frame for the last 60 frames. A constant offset means an off-by-one between `ack` and `pending` (check `p.f > m.ack`); a drift means the guest steps a frame the host didn't.
Run: `bun test` → Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: co-op netcode core - host authority, guest prediction, join and leave mid-game

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 25: PeerJS rooms, Host/Join screens

**Files:**
- Create: `src/net/peer.js`
- Modify: `index.html` (PeerJS script tag), `src/ui/title.js` (co-op options, code entry), `src/main.js` (host and join modes), `src/engine/input.js` (`readKeys`/`readPads`)
- Test: `tests/peer.test.js`, `tests/input.test.js` (append)

**Interfaces:**
- Consumes: `createHost`, `createGuest`, `peerTransport`, PeerJS global `Peer` (from `<script src="https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js"></script>`, placed before the module script).
- Produces:
  - `CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'` (no I or O); `makeCode(rand = Math.random): string` (4 chars); `normalizeCode(str): string` (uppercase, drops other chars, max 4); `peerId(code) = 'superpip-' + code`.
  - `hostRoom({ onCode(code), onGuest(transport), onError(msg) }): { close() }`. If the id is taken (`unavailable-id`) it retries with a new code.
  - `joinRoom(code, { onConnected(transport), onError(msg) }): { close() }`. Error messages are `ROOM NOT FOUND` (PeerJS `peer-unavailable`) and `CAN'T REACH SERVER` (network or server errors).
  - Title:
    - `TITLE_OPTIONS = ['1 PLAYER GAME', 'HOST CO-OP', 'JOIN CO-OP']`.
    - Host goes through slot select and returns `{ action: 'start', slot, next: 'host' }`.
    - Join enters `mode: 'code'` and returns `{ action: 'join', code }` once 4 letters are entered and A/START is pressed. Typing is supported (`typeCode(tt, key)` handles letters and Backspace), and so is a gamepad (UP/DOWN cycles the letter, LEFT/RIGHT moves between letters).
    - `tt.msg` is shown under the menu (used for "HOST LEFT THE GAME", etc.).
  - main.js modes: `'title' | 'game' | 'host' | 'join'`.
    - Host draws a top banner `ROOM ABCD - SHARE THIS CODE` until the guest joins, then `PEP JOINED!` for 3 s.
    - Guest shows `CONNECTING TO ABCD...` until playing. It returns to the title with a message on close or reject.
    - `keepAliveHidden` is true in host mode.

- [ ] **Step 1: Write the failing test**

`tests/peer.test.js`:
```js
import { test, expect } from 'bun:test';
import { makeCode, normalizeCode, CODE_CHARS, peerId } from '../src/net/peer.js';
import { createTitle, stepTitle, typeCode, TITLE_OPTIONS } from '../src/ui/title.js';
import { BTN } from '../src/game/consts.js';

test('room codes are 4 unambiguous letters', () => {
  let i = 0; const seq = [0, 0.5, 0.99, 0.3];
  const c = makeCode(() => seq[i++ % 4]);
  expect(c).toMatch(/^[A-HJ-NP-Z]{4}$/);
  expect(CODE_CHARS.includes('I') || CODE_CHARS.includes('O')).toBe(false);
  expect(normalizeCode(' ab-c d9z ')).toBe('ABCD');
  expect(peerId('ABCD')).toBe('superpip-ABCD');
});

const saves = [{ slot: 0, ok: false, reason: 'empty' }, { slot: 1, ok: false, reason: 'empty' }, { slot: 2, ok: false, reason: 'empty' }];
const press = (tt, b) => { const r = stepTitle(tt, b); stepTitle(tt, 0); return r; };
const skipIntro = (tt) => { for (let i = 0; i < 100; i++) stepTitle(tt, 0); };

test('title offers solo, host and join', () => {
  expect(TITLE_OPTIONS).toEqual(['1 PLAYER GAME', 'HOST CO-OP', 'JOIN CO-OP']);
});

test('host goes through slot select and starts as host', () => {
  const tt = createTitle(saves); skipIntro(tt);
  press(tt, BTN.DOWN);
  press(tt, BTN.A);
  expect(tt.mode).toBe('slots');
  expect(press(tt, BTN.A)).toEqual({ action: 'start', slot: 0, next: 'host' });
});

test('join takes a typed code', () => {
  const tt = createTitle(saves); skipIntro(tt);
  press(tt, BTN.DOWN); press(tt, BTN.DOWN);
  press(tt, BTN.A);
  expect(tt.mode).toBe('code');
  for (const k of ['w', 'x', 'q', 'Backspace', 'k', 'z']) typeCode(tt, k);
  expect(tt.code).toBe('WXKZ');
  expect(press(tt, BTN.A)).toEqual({ action: 'join', code: 'WXKZ' });
});

test('join code can be entered with a gamepad', () => {
  const tt = createTitle(saves); skipIntro(tt);
  press(tt, BTN.DOWN); press(tt, BTN.DOWN); press(tt, BTN.A);
  press(tt, BTN.UP);                       // A -> B
  press(tt, BTN.RIGHT); press(tt, BTN.DOWN); // second letter A -> Z (wraps)
  expect(tt.code.slice(0, 2)).toBe('BZ');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/peer.test.js` → Expected: FAIL.

- [ ] **Step 3: Implement**

`src/net/peer.js`:
```js
import { peerTransport } from './transport.js';

export const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const makeCode = (rand = Math.random) => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(rand() * CODE_CHARS.length)]).join('');
export const normalizeCode = (str) => str.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
export const peerId = (code) => `superpip-${code}`;

const describe = (err) => (err && err.type === 'peer-unavailable' ? 'ROOM NOT FOUND' : "CAN'T REACH SERVER");

export function hostRoom({ onCode, onGuest, onError }) {
  let peer = null, closed = false;
  const open = (tries) => {
    const code = makeCode();
    peer = new Peer(peerId(code));
    peer.on('open', () => onCode(code));
    peer.on('connection', (conn) => conn.on('open', () => onGuest(peerTransport(conn))));
    peer.on('error', (err) => {
      if (closed) return;
      if (err.type === 'unavailable-id' && tries < 5) { peer.destroy(); open(tries + 1); }
      else onError(describe(err));
    });
  };
  open(0);
  return { close() { closed = true; peer && peer.destroy(); } };
}

export function joinRoom(code, { onConnected, onError }) {
  let closed = false;
  const peer = new Peer();
  peer.on('open', () => {
    const conn = peer.connect(peerId(code), { serialization: 'json', reliable: true });
    conn.on('open', () => onConnected(peerTransport(conn)));
  });
  peer.on('error', (err) => { if (!closed) onError(describe(err)); });
  return { close() { closed = true; peer.destroy(); } };
}
```

`src/ui/title.js` changes:
- `export const TITLE_OPTIONS = ['1 PLAYER GAME', 'HOST CO-OP', 'JOIN CO-OP'];`
- In the menu branch:
```js
      if (name === '1 PLAYER GAME') { tt.mode = 'slots'; tt.next = 'solo'; return null; }
      if (name === 'HOST CO-OP') { tt.mode = 'slots'; tt.next = 'host'; return null; }
      if (name === 'JOIN CO-OP') { tt.mode = 'code'; tt.code = 'AAAA'; tt.cursor = 0; tt.typed = false; return null; }
```
- New branch in `stepTitle`:
```js
  if (tt.mode === 'code') {
    if (p & BTN.B) { tt.mode = 'menu'; return null; }
    const i = tt.cursor, chars = CODE_CHARS;
    const cycle = (d) => {
      const k = (chars.indexOf(tt.code[i]) + d + chars.length) % chars.length;
      tt.code = tt.code.slice(0, i) + chars[k] + tt.code.slice(i + 1);
    };
    if (p & BTN.UP) cycle(1);
    if (p & BTN.DOWN) cycle(-1);
    if (p & BTN.RIGHT) tt.cursor = Math.min(3, i + 1);
    if (p & BTN.LEFT) tt.cursor = Math.max(0, i - 1);
    if (p & (BTN.A | BTN.START) && tt.code.length === 4) return { action: 'join', code: tt.code };
    return null;
  }
```
- Add:
```js
import { CODE_CHARS, normalizeCode } from '../net/peer.js';

export function typeCode(tt, key) {
  if (tt.mode !== 'code') return;
  if (!tt.typed) { tt.code = ''; tt.typed = true; }
  if (key === 'Backspace') tt.code = tt.code.slice(0, -1);
  else if (/^[a-z]$/i.test(key)) tt.code = normalizeCode(tt.code + key);
  tt.cursor = Math.min(3, tt.code.length);
}
```
- `drawTitle`: in `code` mode draw `ENTER ROOM CODE` and the 4 letters in boxes (cursor letter blinking). Draw `tt.msg` (if set) in `textRed` at y = 170 in any mode.

Letter keys Z, X and Space are also game buttons, so while typing a code the keyboard's A/B must not reach `stepTitle`. Otherwise typing "X" would act as B and leave the screen. Split the input reader in `src/engine/input.js` so `createInput` returns `{ read(), readKeys(), readPads(), clear() }`, where `read() === readKeys() | readPads()`. In code mode, main.js passes this to `stepTitle`:
```js
const NAV = BTN.UP | BTN.DOWN | BTN.LEFT | BTN.RIGHT | BTN.START;
const m = (mode === 'title' && title.mode === 'code') ? (input.readPads() | (input.readKeys() & NAV)) : input.read();
```
Keyboard players confirm with Enter and go back with Escape (`keydown` `Escape` in code mode sets `title.mode = 'menu'`). Gamepad A and B still work. Add this test to `tests/input.test.js`:
```js
test('keyboard and gamepad masks can be read separately', () => {
  const handlers = {};
  const target = { addEventListener: (t, f) => { handlers[t] = f; } };
  const pad = { buttons: Array.from({ length: 17 }, (_, k) => ({ pressed: k === 0 })), axes: [0, 0] };
  const input = createInput(target, () => [pad]);
  handlers.keydown({ code: 'KeyX', preventDefault() {} });
  expect(input.readKeys()).toBe(BTN.B);
  expect(input.readPads()).toBe(BTN.A);
  expect(input.read()).toBe(BTN.A | BTN.B);
});
```

`src/main.js`: extend `game()` with host and join modes:
```js
import { createHost } from './net/host.js';
import { createGuest } from './net/guest.js';
import { hostRoom, joinRoom } from './net/peer.js';
import { WORLDS } from './game/session.js';
import { typeCode } from './ui/title.js';

// inside game():
let host = null, guest = null, room = null, banner = '', bannerT = 0, joinCode = '';
window.addEventListener('keydown', (e) => { if (mode === 'title' && title.mode === 'code') typeCode(title, e.key); });
const backToTitle = (msg) => {
  room && room.close(); room = null; host = null; guest = null;
  mode = 'title'; title = createTitle(listSaves(storage)); title.msg = msg || '';
};

// in step(), title branch:
if (act?.action === 'start' && act.next === 'host') {
  begin(1, act.slot);
  mode = 'host';
  host = createHost(sess);
  banner = 'OPENING ROOM...';
  room = hostRoom({
    onCode: (c) => { banner = `ROOM ${c} - SHARE THIS CODE`; },
    onGuest: (t) => { host.attach(t); banner = 'PEP JOINED!'; bannerT = 180; },
    onError: (msg) => { banner = `${msg} - PLAYING SOLO`; },
  });
} else if (act?.action === 'join') {
  mode = 'join'; joinCode = act.code; banner = `CONNECTING TO ${act.code}...`;
  room = joinRoom(act.code, {
    onConnected: (t) => { guest = createGuest(t, WORLDS); },
    onError: (msg) => backToTitle(msg),
  });
}

// in step(), new branches:
if (mode === 'host') {
  const events = host.step(m);
  for (const ev of events) if (ev.e === 'sfx') audio.sfx(ev.id);
  if (!host.connected && banner === 'PEP JOINED!') banner = 'PEP LEFT - ROOM STILL OPEN';
  if (bannerT > 0 && --bannerT === 0 && host.connected) banner = '';
  if (sess.dirty && sess.scene !== 'level') { writeSave(storage, slot, makeSave(sess)); sess.dirty = false; }
  if (sess.quit) backToTitle();
}
if (mode === 'join' && guest) {
  for (const ev of guest.step(m)) if (ev.e === 'sfx') audio.sfx(ev.id);
  if (guest.status === 'closed') backToTitle('HOST LEFT THE GAME');
  else if (guest.status === 'rejected') backToTitle('VERSION MISMATCH - RELOAD THE PAGE');
}

// music:
const view = mode === 'join' ? guest && guest.view() : sess;
const want = mode === 'title' ? 'title' : view ? songFor(view) : '';

// draw():
if (mode === 'title') drawTitle(ctx, title);
else if (mode === 'join') {
  const v = guest && guest.view();
  if (v) drawSession(ctx, v, 1);
  else { fillNES(ctx, 0x0F, 0, 0, 256, 240); drawText(ctx, banner, 128 - banner.length * 4, 112); }
} else {
  drawSession(ctx, sess, 0);
  if (mode === 'host' && banner) { fillNES(ctx, 0x0F, 0, 0, 256, 12); drawText(ctx, banner, 128 - banner.length * 4, 2); }
}

// startLoop option:
keepAliveHidden: () => mode === 'host',
```
In the existing title branch, change `if (act?.action === 'start') begin(1, act.slot);` to `if (act?.action === 'start' && act.next !== 'host') begin(1, act.slot);`. That leaves the host flow to the new branch above.

- [ ] **Step 4: Run tests, then a real two-tab session**

Run: `bun test` → Expected: all pass.
Run `bun run dev`. In one gstack browse tab open `http://localhost:5190/`, choose HOST CO-OP and read the room code from a screenshot. Open a second tab (`$B newtab http://localhost:5190/`) and JOIN with that code, typing it with `$B type`. Drive both tabs with `$B press` and screenshot each. Expected:
- the guest sees the map and both markers;
- entering a level puts both heroes in it, each with their own camera;
- a block one breaks is broken for the other;
- closing the guest tab makes the host show `PEP LEFT - ROOM STILL OPEN` and keep playing.

If gstack browse cannot open a second tab, open two normal browser windows on the same machine (PeerJS works between tabs) and play-test by hand. Report which method was used.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: online co-op rooms with 4-letter codes, host and join screens

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 26: In-browser self-test, README, GitHub repo and Pages

**Files:**
- Create: `src/selftest.js`, `README.md`, `LICENSE`, `.nojekyll`
- Modify: `src/main.js` (expose `window.__runSelfTest`), `tools/selftest.js` (also run the co-op loopback)

**Interfaces:**
- Produces:
  - `window.__runSelfTest(): Promise<string>`. It validates all W1 levels, replays every recorded route, walks a session through map → level → map, draws every scene into an offscreen canvas while checking for exceptions, and runs one loopback co-op exchange. It resolves to `All N checks passed.` or a list of failures.
  - Public repo `TheAmoungMcer/super-pip-bros` with Pages serving `main` at `/`.

- [ ] **Step 1: Write `src/selftest.js`**

```js
import { LEVELS } from './content/levels/w1.js';
import { validateLevels } from '../tools/validate-levels.js';
import { createLevelSim, stepLevel } from './game/sim.js';
import { createSession, stepSession, enterNode, WORLDS } from './game/session.js';
import { drawSession } from './draw/scenes.js';
import { createHost } from './net/host.js';
import { createGuest } from './net/guest.js';
import { createLoopback } from './net/transport.js';
import { BTN } from './game/consts.js';

export async function runSelfTest() {
  const fails = []; let n = 0;
  const ok = (c, m) => { n++; if (!c) fails.push(m); };
  ok(validateLevels(LEVELS).length === 0, 'W1 levels valid');
  for (const id of Object.keys(LEVELS).filter(k => !LEVELS[k].sub)) {
    try {
      const route = await (await fetch(`tools/routes/${id}.json`)).json();
      const s = createLevelSim(LEVELS[id], { defs: LEVELS, seed: 1 });
      for (const [b, c] of route.inputs) for (let i = 0; i < c; i++) stepLevel(s, [b]);
      for (let i = 0; i < 1200 && s.mode !== 'done' && s.mode !== 'fail'; i++) stepLevel(s, [0]);
      ok(s.mode === 'done', `${id} route beats the level`);
    } catch (e) { ok(false, `${id} route: ${e.message}`); }
  }
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 240;
  const ctx = canvas.getContext('2d');
  const sess = createSession();
  const draw = (label) => { try { drawSession(ctx, sess, 0); ok(true); } catch (e) { ok(false, `draw ${label}: ${e.message}`); } };
  draw('map');
  enterNode(sess, { kind: 'level', level: '1-1', key: '3,1' }); for (let i = 0; i < 30; i++) stepSession(sess, [BTN.RIGHT]); draw('level');
  sess.level.mode = 'done'; sess.level.clear = { by: 0, card: 0 }; stepSession(sess, [0]); ok(sess.scene === 'map', 'level returns to map');
  enterNode(sess, { kind: 'hut', key: '7,1' }); draw('hut');
  for (let i = 0; i < 200 && sess.scene === 'hut'; i++) stepSession(sess, [i % 2 ? BTN.A : 0]);
  enterNode(sess, { kind: 'slots', key: '5,3' }); draw('slots');
  for (let i = 0; i < 400 && sess.scene === 'slots'; i++) stepSession(sess, [i % 20 === 0 ? BTN.A : 0]);
  ok(sess.scene === 'map', 'minigames return to map');
  // Co-op loopback
  const hs = createSession({ seed: 3 });
  enterNode(hs, { kind: 'level', level: '1-1', key: '3,1' });
  const host = createHost(hs), link = createLoopback({ latency: 5, jitter: 2 });
  host.attach(link.a);
  const guest = createGuest(link.b, WORLDS);
  for (let i = 0; i < 90; i++) { host.step(0); guest.step(i > 40 ? BTN.RIGHT : 0); link.tick(); }
  ok(guest.status === 'playing' && hs.players === 2, 'co-op loopback connects');
  ok(guest.view()?.level?.lv.id === '1-1', 'guest sees the level');
  return fails.length ? `${fails.length} of ${n} checks failed:\n${fails.join('\n')}` : `All ${n} checks passed.`;
}
```
In `src/main.js`, add `import { runSelfTest } from './selftest.js'; window.__runSelfTest = runSelfTest;`.

`tools/validate-levels.js` is imported by the browser here, so make sure it has no Bun-only code at module top level. The `import.meta.main` block is skipped in browsers because `import.meta.main` is undefined there.

- [ ] **Step 2: Run the in-browser self-test**

```bash
B=~/.claude/skills/gstack/browse/dist/browse
$B goto "http://localhost:5190/?v=$RANDOM"
$B js "window.__runSelfTest().then(r => { window.__R = r; })"
sleep 20
$B js "window.__R"
$B console --errors
```
Expected: `All N checks passed.` and no console errors. Add the expected count to the project memory once known.

- [ ] **Step 3: Write README, LICENSE, .nojekyll**

`README.md`:
```markdown
# Super Pip Bros.

A fan-made, retro platformer in the spirit of the NES classics. Pip and Pep cross the
Petal Kingdom to rescue Princess Lumi from King Grimjaw. All characters, art and music
are original. It plays in any modern browser, alone or with a friend online.

**Play:** https://theamoungmcer.github.io/super-pip-bros/

## Controls
| Action | Keyboard | Gamepad |
|---|---|---|
| Move | Arrow keys | D-pad / left stick |
| Jump (hold for higher) | Z or Space | A / bottom button |
| Run, throw, tail spin, carry shells | X (hold) | B / X / Y |
| Pause / item bar on the map | Enter | Start |

Run with X held until the P-meter fills, then jump: with the Glide Leaf you fly.

## Play together online
1. One player picks **HOST CO-OP** and a save slot. A 4-letter room code appears at the top.
2. The other player picks **JOIN CO-OP** and types the code.
3. You share the world map and lives. In levels each of you has your own camera.
   If one of you falls, you float back in next to your partner.

The friend can join or leave at any time. Progress is saved in the host's browser.

## Run locally
Needs [Bun](https://bun.sh).
    bun run dev        # http://localhost:5190
    bun test           # unit tests
    bun run selftest   # level validation + every level replayed by the autopilot

Dev URLs: `?level=1-1` plays one level, `?gallery` shows every sprite.

## Status
World 1 (Meadow Vale) is complete: 6 levels, a fortress, the airship, Gift Huts and the
Slot Panel. Worlds 2–8 are coming.
```
`LICENSE`: MIT, copyright 2026 TheAmoungMcer. `.nojekyll`: an empty file, so GitHub Pages serves the files as-is.

- [ ] **Step 4: Run every check**

Run: `bun test` → all pass. `bun run selftest` → `All N checks passed.` Report both outputs.

- [ ] **Step 5: Commit, create the repo, enable Pages**

```bash
git add -A
git commit -m "docs: README, license, in-browser self-test

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
gh repo create TheAmoungMcer/super-pip-bros --public --source . --remote origin --push \
  --description "Fan-made SMB3-style platformer with original characters and online co-op"
gh api -X POST repos/TheAmoungMcer/super-pip-bros/pages -f 'source[branch]=main' -f 'source[path]=/'
```
Then wait for the first Pages build:
```bash
gh api repos/TheAmoungMcer/super-pip-bros/pages/builds/latest --jq .status   # repeat until "built"
curl -sI https://theamoungmcer.github.io/super-pip-bros/ | head -1             # expect HTTP/2 200
```

- [ ] **Step 6: Verify the live site**

Open the Pages URL in gstack browse. Run `__runSelfTest()` there (routes are fetched relative to the page, so they must load from Pages). Screenshot the title and the map, and check `console --errors`. Then do one live two-tab co-op session against the Pages URL as in Task 25. Report the URL, the self-test output and what was verified.

---

## Self-Review Notes

Coverage check against the spec's Stage 1 scope:

| Spec item | Task |
|---|---|
| SMB3 physics: run, P-meter, variable jump, skid, slopes, slide | 5, 6 |
| Berry, Fire Blossom, Glide Leaf (tail, float, flight), Star, 1-Up | 10 |
| 12 stage-1 enemy roles | 8, 9, 11 |
| Blocks, pipes, P-switch, music blocks, hidden blocks, lifts, doors | 7, 12 |
| World 1 map, 6 levels, fortress + Bone Brute, Gift Huts, Slot Panel, airship + Grimling | 16–21 |
| Inventory (28 slots), goal roulette cards | 21 |
| Saves (3 slots, versioned, export/import, never crash) | 22 |
| Chiptune audio, original music and SFX | 14 |
| Title curtain, status bar, NES look | 13, 23 |
| Online co-op: room codes, host authority, guest prediction, separate cameras, join/leave, shared lives, respawn next to partner, either player clears | 7, 24, 25 |
| Autopilot proves every level beatable; co-op loopback test | 15–19, 24 |
| GitHub Pages | 26 |

Map items beyond the power-ups (Warp Flute, Map Hammer, Skip Cloud, Anchor, Music Box), wandering Hammer Kobolds, Card Match, and Stone Cloak / Frog / Hammer Helm / Star Wings / Hop Boot are Stage 2–3 per the spec's delivery stages, so they don't appear here.
