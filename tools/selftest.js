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
