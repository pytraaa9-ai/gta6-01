// The player: on foot (walk/run, punch, shoot) and behind the wheel.
// Cars are plain objects shared with traffic.js / police.js:
// { x, y, angle, speed, color, kind: 'parked'|'traffic'|'police', driver }
import { PLAYER_RADIUS, WALK_SPEED, RUN_SPEED, CAR_MAX_SPEED, CAR_ACCEL, CAR_REVERSE, WORLD_SIZE, PISTOL_MAG, BULLET_SPEED, BULLET_DAMAGE, PUNCH_RANGE, PUNCH_DAMAGE } from './config.js';
import { clamp, resolveCircleRect, angleDiff } from './random.js';
import { hitsBuilding, isRoad } from './world.js';
import { spawnParticles } from './effects.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, health: 100, money: 150,
    inCar: null, // car object or null
    ammo: PISTOL_MAG, reserve: 60,
    aimAngle: 0, punchCooldown: 0, shootCooldown: 0,
    speed: 0, // on-foot speed, for animation
    hurtFlash: 0, dead: false,
  };
}

export function createCar(x, y, angle, color, kind) {
  return { x, y, angle, speed: 0, color, kind: kind || 'parked', driver: null, steer: 0, stuck: 0 };
}

// --- On foot ---------------------------------------------------------------
export function stepOnFoot(state, move, running, dt) {
  const p = state.player;
  const speed = running ? RUN_SPEED : WALK_SPEED;
  let nx = p.x + move.x * speed * dt;
  let ny = p.y + move.y * speed * dt;
  nx = clamp(nx, 16, WORLD_SIZE - 16);
  ny = clamp(ny, 16, WORLD_SIZE - 16);
  // Slide along buildings.
  const b = hitsBuilding(state.city, nx, ny, PLAYER_RADIUS);
  if (b) {
    const fixed = resolveCircleRect(nx, ny, PLAYER_RADIUS, b);
    if (fixed) { nx = fixed.x; ny = fixed.y; }
  }
  p.speed = Math.hypot(nx - p.x, ny - p.y) / Math.max(dt, 0.001);
  p.x = nx;
  p.y = ny;
  if (move.x !== 0 || move.y !== 0) p.angle = Math.atan2(move.y, move.x);
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt);
}

// Punch: hits the nearest ped / cop / driver in front of the player.
export function punch(state) {
  const p = state.player;
  if (p.punchCooldown > 0 || p.inCar) return false;
  p.punchCooldown = 0.45;
  state.audio.punch();
  const px = p.x + Math.cos(p.angle) * (PLAYER_RADIUS + 12);
  const py = p.y + Math.sin(p.angle) * (PLAYER_RADIUS + 12);
  spawnParticles(state.particles, px, py, { count: 6, color: '#ffffff', speed: 120, life: 0.25, size: 3 });
  let hit = false;
  for (const ped of state.peds) {
    if (ped.down) continue;
    const d2 = (ped.x - px) ** 2 + (ped.y - py) ** 2;
    if (d2 < PUNCH_RANGE * PUNCH_RANGE) {
      hurtPed(state, ped, PUNCH_DAMAGE, p.angle);
      hit = true;
    }
  }
  for (const cop of state.cops) {
    const d2 = (cop.x - px) ** 2 + (cop.y - py) ** 2;
    if (d2 < PUNCH_RANGE * PUNCH_RANGE) {
      cop.health -= PUNCH_DAMAGE;
      spawnParticles(state.particles, cop.x, cop.y, { count: 8, color: '#ffd23d', speed: 140, life: 0.3, size: 3 });
      state.audio.hit();
      if (cop.health <= 0) downCop(state, cop);
      hit = true;
    }
  }
  if (hit) addWanted(state, 1, 'assault');
  return hit;
}

export function hurtPed(state, ped, damage, fromAngle) {
  ped.health -= damage;
  ped.flee = 3;
  ped.fleeAngle = fromAngle;
  spawnParticles(state.particles, ped.x, ped.y, { count: 8, color: '#ff9d5c', speed: 130, life: 0.35, size: 3 });
  state.audio.hit();
  if (ped.health <= 0 && !ped.down) {
    ped.down = true;
    ped.downTimer = 6;
    addWanted(state, 1, 'ped down');
    if (Math.random() < 0.5) {
      state.pickups.push({ x: ped.x, y: ped.y, kind: 'cash', amount: 10 + Math.floor(Math.random() * 25), ttl: 20 });
    }
  }
}

function downCop(state, cop) {
  cop.down = true;
  cop.downTimer = 8;
  spawnParticles(state.particles, cop.x, cop.y, { count: 14, color: '#4d7dff', speed: 160, life: 0.5, size: 4 });
  addWanted(state, 1, 'cop down');
}

// Shoot toward the mouse (world coordinates). Returns true if a shot fired.
export function shoot(state, worldX, worldY) {
  const p = state.player;
  if (p.inCar || p.shootCooldown > 0 || p.ammo <= 0) {
    if (p.ammo <= 0) state.hudMessage = 'Out of ammo — press R to reload';
    return false;
  }
  p.ammo -= 1;
  p.shootCooldown = 0.22;
  p.aimAngle = Math.atan2(worldY - p.y, worldX - p.x);
  const mx = p.x + Math.cos(p.aimAngle) * 22;
  const my = p.y + Math.sin(p.aimAngle) * 22;
  state.bullets.push({
    x: mx, y: my,
    vx: Math.cos(p.aimAngle) * BULLET_SPEED,
    vy: Math.sin(p.aimAngle) * BULLET_SPEED,
    life: 0.9, fromPlayer: true,
  });
  spawnParticles(state.particles, mx, my, { count: 5, color: '#ffe27a', speed: 200, life: 0.12, size: 3 });
  state.audio.shoot();
  addWanted(state, 1, 'shots fired');
  return true;
}

export function reload(state) {
  const p = state.player;
  if (p.inCar || p.ammo >= PISTOL_MAG || p.reserve <= 0) return;
  const need = PISTOL_MAG - p.ammo;
  const take = Math.min(need, p.reserve);
  p.ammo += take;
  p.reserve -= take;
  state.hudMessage = `Reloaded — ${p.ammo}/${PISTOL_MAG}`;
}

// --- Cars ------------------------------------------------------------------
export function nearestCar(state, maxDist) {
  const p = state.player;
  let best = null;
  let bestD = maxDist * maxDist;
  for (const car of state.cars) {
    const d2 = (car.x - p.x) ** 2 + (car.y - p.y) ** 2;
    if (d2 < bestD) { bestD = d2; best = car; }
  }
  return best;
}

// Enter a car (stealing a traffic car is a crime; a parked one is too).
export function enterCar(state, car) {
  const p = state.player;
  if (!car || p.inCar) return false;
  const wasTraffic = car.kind === 'traffic';
  car.kind = 'player';
  car.driver = 'player';
  p.inCar = car;
  p.x = car.x;
  p.y = car.y;
  state.audio.engine(0, true);
  // Every car in Solmar belongs to someone else: taking one is grand theft.
  addWanted(state, 1, 'carjacking');
  state.hudMessage = wasTraffic ? 'You jacked the car! The cops noticed.' : 'You stole the parked car!';
  return true;
}

export function exitCar(state) {
  const p = state.player;
  if (!p.inCar) return;
  const car = p.inCar;
  car.kind = 'parked';
  car.driver = null;
  car.speed = 0;
  // Step out to the side of the car.
  const sx = Math.cos(car.angle + Math.PI / 2);
  const sy = Math.sin(car.angle + Math.PI / 2);
  p.x = clamp(car.x + sx * 42, 20, WORLD_SIZE - 20);
  p.y = clamp(car.y + sy * 42, 20, WORLD_SIZE - 20);
  p.inCar = null;
  state.audio.engine(0, false);
}

function crashIntoBuilding(state, speedAbs, x, y) {
  if (speedAbs <= 140) return;
  state.audio.crash();
  spawnParticles(state.particles, x, y, { count: 12, color: '#cccccc', speed: 180, life: 0.5, size: 4 });
  state.player.health = Math.max(1, state.player.health - 4);
}

// Arcade driving: W/S throttle, A/D steer, Space handbrake.
export function stepDriving(state, move, dt) {  const p = state.player;
  const car = p.inCar;
  if (!car) return;
  const forward = move.y < 0 ? 1 : move.y > 0 ? -0.6 : 0; // W = forward
  const steering = move.x; // A/D
  const speedAbs = Math.abs(car.speed);
  const steerAmount = steering * 2.4 * (speedAbs > 5 ? Math.min(1, speedAbs / 120) : 0);
  car.angle += steerAmount * dt * (car.speed >= 0 ? 1 : -1);
  if (forward > 0) car.speed += CAR_ACCEL * dt;
  else if (forward < 0) car.speed -= CAR_ACCEL * 0.7 * dt;
  else car.speed *= Math.pow(0.4, dt); // coast drag
  // Handbrake (Space held is read as punch action; use S while moving as brake too).
  if (move.y > 0 && car.speed > 0) car.speed -= CAR_ACCEL * 1.4 * dt;
  car.speed = clamp(car.speed, -CAR_REVERSE, CAR_MAX_SPEED);
  // Axis-separated movement so the car slides along buildings instead of
  // wedging into a corner. Collision radius 22 fits the 96px roads.
  const dx = Math.cos(car.angle) * car.speed * dt;
  const dy = Math.sin(car.angle) * car.speed * dt;
  let nx = clamp(car.x + dx, 24, WORLD_SIZE - 24);
  let ny = car.y;
  if (hitsBuilding(state.city, nx, ny, 22)) {
    nx = car.x;
    if (speedAbs > 140) crashIntoBuilding(state, speedAbs, nx, ny);
    car.speed *= 0.6;
  }
  ny = clamp(car.y + dy, 24, WORLD_SIZE - 24);
  if (hitsBuilding(state.city, nx, ny, 22)) {
    ny = car.y;
    if (speedAbs > 140) crashIntoBuilding(state, speedAbs, nx, ny);
    car.speed *= 0.6;
  }
  car.x = nx;
  car.y = ny;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  // Skid smoke + sound on hard steering at speed.
  if (Math.abs(steering) > 0.6 && speedAbs > 240 && Math.random() < 0.5) {
    spawnParticles(state.particles, car.x - Math.cos(car.angle) * 30, car.y - Math.sin(car.angle) * 30, { count: 1, color: '#bbbbbb', speed: 20, life: 0.5, size: 6 });
  }
  // Exhaust puffs.
  if (Math.random() < 0.25) {
    spawnParticles(state.particles, car.x - Math.cos(car.angle) * 40, car.y - Math.sin(car.angle) * 40, { count: 1, color: '#999999', speed: 25, life: 0.4, size: 4 });
  }
  state.audio.engine(speedAbs / CAR_MAX_SPEED, true);
}

// Bullets: move, hit peds / cops / cars / buildings.
export function stepBullets(state, dt) {
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD_SIZE || b.y > WORLD_SIZE;
    if (!dead && hitsBuilding(state.city, b.x, b.y, 2)) {
      spawnParticles(state.particles, b.x, b.y, { count: 5, color: '#ffd23d', speed: 150, life: 0.25, size: 3 });
      dead = true;
    }
    if (!dead && b.fromPlayer) {
      for (const ped of state.peds) {
        if (ped.down) continue;
        if ((ped.x - b.x) ** 2 + (ped.y - b.y) ** 2 < 18 * 18) {
          hurtPed(state, ped, BULLET_DAMAGE, Math.atan2(b.vy, b.vx));
          dead = true;
          break;
        }
      }
      if (!dead) {
        for (const cop of state.cops) {
          if (cop.down) continue;
          if ((cop.x - b.x) ** 2 + (cop.y - b.y) ** 2 < 18 * 18) {
            cop.health -= BULLET_DAMAGE;
            state.audio.hit();
            spawnParticles(state.particles, cop.x, cop.y, { count: 8, color: '#4d7dff', speed: 150, life: 0.3, size: 3 });
            if (cop.health <= 0) downCop(state, cop);
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const car of state.cars) {
          if (car === state.player.inCar) continue;
          const dx = car.x - b.x;
          const dy = car.y - b.y;
          // Rough car hitbox in car-local space.
          const ca = Math.cos(-car.angle);
          const sa = Math.sin(-car.angle);
          const lx = dx * ca - dy * sa;
          const ly = dx * sa + dy * ca;
          if (Math.abs(lx) < 42 && Math.abs(ly) < 26) {
            car.health = (car.health || 100) - BULLET_DAMAGE;
            spawnParticles(state.particles, b.x, b.y, { count: 6, color: '#ffd23d', speed: 160, life: 0.3, size: 3 });
            if (car.health <= 0 && car.kind === 'traffic') {
              car.kind = 'parked';
              car.speed = 0;
              addWanted(state, 1, 'shot a car');
            }
            dead = true;
            break;
          }
        }
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }
}

// Wanted level: 0..5, with a "heat" meter that decays while you lay low.
export function addWanted(state, stars, reason) {
  if (stars <= 0) return;
  const before = state.wanted;
  state.wanted = Math.min(5, state.wanted + stars);
  state.wantedTimer = 0; // reset the lay-low clock
  state.lastCrime = reason || 'crime';
  if (state.wanted > before && state.wanted >= 2) state.audio.sirenBlip();
}

export function decayWanted(state, dt) {
  if (state.wanted <= 0) return;
  state.wantedTimer += dt;
  if (state.wantedTimer >= 18) {
    state.wanted -= 1;
    state.wantedTimer = 0;
    state.hudMessage = state.wanted > 0 ? 'Heat is cooling off…' : 'You lost the cops.';
  }
}
