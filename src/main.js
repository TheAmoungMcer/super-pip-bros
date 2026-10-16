import { createScreen } from './engine/render.js';

const { ctx } = createScreen(document.getElementById('screen'));
ctx.fillStyle = '#6888FC';
ctx.fillRect(0, 0, 256, 200);
ctx.fillStyle = '#000';
ctx.fillRect(0, 200, 256, 40);
