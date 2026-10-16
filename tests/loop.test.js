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
  g.requestAnimationFrame = () => {};
  g.document = { hidden: true };
  g.setInterval = (fn) => { interval = fn; return 1; };
  g.performance = { now: () => now };
  try {
    startLoop({ step: () => steps++, draw: () => {}, keepAliveHidden: () => alive });
    now += 51; interval();
    expect(steps).toBe(3);
    alive = false; now += 51; interval();
    expect(steps).toBe(3);
  } finally {
    Object.assign(g, { requestAnimationFrame: saved.raf, document: saved.doc, setInterval: saved.si, performance: saved.perf });
  }
});
