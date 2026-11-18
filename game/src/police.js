// Wanted level and the Solmar Police Department.
// Foot cops chase and try to arrest you; police cars spawn by wanted level,
// ram your car, and at high heat their officers shoot.
import { MAX_WANTED, WORLD_SIZE } from './config.js';
import { clamp, angleDiff } from './random.js';
import { createCar } from './player.js';
import { nearestRoadPoint } from './world.js';
import { spawnParticles } from './effects.js';

export function copsWanted(state) {
  // How many police units the current heat calls for.
  return [0, 1, 2, 3, 4, 6][state.wanted] || 0;
}

export function stepPolice(state, dt) {
  const want = copsWanted(state);
  // Spawn units near (but not on top of) the player until the quota is met.
  const active = state.cops.filter((c) => !c.down).length + state.cars.filter((c) => c.kind === 'police').length;
  if (active < want) {
    spawnCopUnit(state);
  }
  const p = state.player;
  for (const cop of state.cops) {
    if (cop.down) {
      cop.downTimer -= dt;
      if (cop.downTimer <= 0) {
        cop.down = false;
        cop.health = 100;
        // Dragged off by colleagues: respawn at the edge.
        cop.x = clamp(p.x + (Math.random() < 0.5 ? -600 : 600), 40, WORLD_SIZE - 40);
        cop.y = clamp(p.y + (Math.random() < 0.5 ? -600 : 600), 40, WORLD_SIZE - 40);
      }
      continue;
    }
    const d = Math.hypot(p.x - cop.x, p.y - cop.y);
    const chaseSpeed = state.wanted >= 3 ? 250 : 210;
    if (d < 26 && !p.inCar) {
      // Arrest! The bust timer fills while a cop holds you.
      state.bustTimer += dt;
      state.hudMessage = 'The cops are cuffing you — BREAK FREE (wiggle WASD)!';
      if (state.bustTimer > 1.6) {
        state.busted = true;
        return;
      }
    } else {
      state.bustTimer = Math.max(0, state.bustTimer - dt * 2);
    }
    const wantAngle = Math.atan2(p.y - cop.y, p.x - cop.x);
    cop.angle += clamp(angleDiff(cop.angle, wantAngle), -3.2 * dt, 3.2 * dt);
    cop.x += Math.cos(cop.angle) * chaseSpeed * dt;
    cop.y += Math.sin(cop.angle) * chaseSpeed * dt;
    cop.x = clamp(cop.x, 16, WORLD_SIZE - 16);
    cop.y = clamp(cop.y, 16, WORLD_SIZE - 16);
    // High heat: cops open fire at range.
    if (state.wanted >= 4 && d < 420 && Math.random() < dt * 0.9) {
      state.bullets.push({
        x: cop.x, y: cop.y,
        vx: Math.cos(wantAngle) * 620 + (Math.random() - 0.5) * 120,
        vy: Math.sin(wantAngle) * 620 + (Math.random() - 0.5) * 120,
        life: 0.8, fromPlayer: false,
      });
      spawnParticles(state.particles, cop.x, cop.y, { count: 3, color: '#ffe27a', speed: 160, life: 0.1, size: 3 });
      state.audio.shoot();
    }
  }
  // Cop bullets can hurt the player.
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    if (b.fromPlayer) continue;
    if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 < 20 * 20) {
      p.health -= 8;
      p.hurtFlash = 0.3;
      spawnParticles(state.particles, p.x, p.y, { count: 6, color: '#ff5c5c', speed: 140, life: 0.3, size: 3 });
      state.bullets.splice(i, 1);
      if (p.health <= 0) state.wasted = true;
    }
  }
  // Police cars ram the player's car; on foot they drop off a foot cop.
  for (const car of state.cars) {
    if (car.kind !== 'police') continue;
    const d = Math.hypot(p.x - car.x, p.y - car.y);
    const wantAngle = Math.atan2(p.y - car.y, p.x - car.x);
    car.angle += clamp(angleDiff(car.angle, wantAngle), -2.2 * dt, 2.2 * dt);
    const target = d < 900 ? 400 : 300;
    car.speed += clamp(target - car.speed, -260 * dt, 200 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = clamp(car.x, 24, WORLD_SIZE - 24);
    car.y = clamp(car.y, 24, WORLD_SIZE - 24);
    if (p.inCar && d < 62) {
      // Ram: shove the player's car and damage the player a little.
      p.inCar.speed *= 0.55;
      p.inCar.x += Math.cos(car.angle) * 26;
      p.inCar.y += Math.sin(car.angle) * 26;
      p.health = Math.max(1, p.health - 3);
      p.hurtFlash = 0.25;
      state.audio.crash();
      spawnParticles(state.particles, car.x, car.y, { count: 8, color: '#cccccc', speed: 150, life: 0.4, size: 4 });
    }
    if (!p.inCar && d < 120 && state.cops.filter((c) => !c.down).length < 4 && Math.random() < dt * 0.5) {
      state.cops.push({ x: car.x, y: car.y, angle: car.angle, health: 100, down: false, downTimer: 0 });
    }
  }
  // Wanted falls to zero: police give up and drive away.
  if (state.wanted === 0) {
    for (const car of state.cars) if (car.kind === 'police') car.kind = 'parked';
    state.cops.length = 0;
  }
}

function spawnCopUnit(state) {
  const p = state.player;
  const angle = Math.random() * Math.PI * 2;
  const x = clamp(p.x + Math.cos(angle) * 520, 40, WORLD_SIZE - 40);
  const y = clamp(p.y + Math.sin(angle) * 520, 40, WORLD_SIZE - 40);
  if (state.wanted >= 2 && state.cars.filter((c) => c.kind === 'police').length < Math.ceil(copsWanted(state) / 2)) {
    // Police cars arrive on the road, never inside a building.
    const rp = nearestRoadPoint(x, y);
    const car = createCar(rp.x, rp.y, Math.atan2(p.y - rp.y, p.x - rp.x), '#1e2a4a', 'police');
    car.speed = 200;
    car.health = 150;
    state.cars.push(car);
  } else {
    state.cops.push({ x, y, angle: Math.atan2(p.y - y, p.x - x), health: 100, down: false, downTimer: 0 });
  }
  if (Math.random() < 0.4) state.audio.sirenBlip();
}
