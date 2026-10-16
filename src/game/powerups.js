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
