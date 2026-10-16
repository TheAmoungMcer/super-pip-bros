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
