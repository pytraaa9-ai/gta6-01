// Particles: exhaust puffs, muzzle flashes, impact sparks, blood-free
// "poof" hits, cash sparkles and skid smoke. Pure data, drawn by render.js.
export function createParticles() {
  return [];
}

export function spawnParticles(list, x, y, opts) {
  const n = opts.count || 8;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (opts.speed || 90) * (0.4 + Math.random() * 0.8);
    list.push({
      x, y,
      vx: Math.cos(a) * sp + (opts.vx || 0),
      vy: Math.sin(a) * sp + (opts.vy || 0),
      life: 0,
      maxLife: (opts.life || 0.5) * (0.6 + Math.random() * 0.8),
      size: (opts.size || 4) * (0.6 + Math.random() * 0.8),
      color: opts.color || '#ffcc55',
      gravity: opts.gravity || 0,
      shrink: opts.shrink !== false,
    });
  }
  if (list.length > 400) list.splice(0, list.length - 400);
}

export function updateParticles(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life += dt;
    if (p.life >= p.maxLife) {
      list.splice(i, 1);
      continue;
    }
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
  }
}
