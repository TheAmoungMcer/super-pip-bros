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
