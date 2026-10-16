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
