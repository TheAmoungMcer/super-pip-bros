import { createScreen } from './engine/render.js';
import { createInput, edges } from './engine/input.js';
import { startLoop } from './engine/loop.js';
import { drawGallery } from './draw/gallery.js';
import { BTN } from './game/consts.js';

const { ctx } = createScreen(document.getElementById('screen'));
const input = createInput();
const params = new URLSearchParams(location.search);
let page = Number(params.get('page') || 0), prev = 0;
window.__page = (p) => { page = p; };
startLoop({
  step() { const m = input.read(); const { pressed } = edges(prev, m); prev = m; if (pressed & BTN.RIGHT) page++; if (pressed & BTN.LEFT) page = Math.max(0, page - 1); },
  draw() { drawGallery(ctx, page); },
});
