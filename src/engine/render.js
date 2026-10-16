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
