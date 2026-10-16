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
