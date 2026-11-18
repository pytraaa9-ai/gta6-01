// Traffic cars and pedestrians: the living city.
// Traffic cars cruise the road grid, turn at intersections and stop for
// nothing; pedestrians stroll the sidewalks and flee from crime.
import { CAR_COLORS, WORLD_SIZE, PITCH, ROAD_W } from './config.js';
import { createRandom, clamp, angleDiff } from './random.js';
import { createCar } from './player.js';
import { nearestRoadPoint, isRoad } from './world.js';
import { spawnParticles } from './effects.js';

const PED_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#2ecc71'];

export function spawnTraffic(state, count) {
  for (let i = 0; i < count; i++) {
    const p = state.city.randomRoadPoint();
    const angle = p.horizontal ? (Math.random() < 0.5 ? 0 : Math.PI) : (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const car = createCar(p.x, p.y, angle, CAR_COLORS[i % CAR_COLORS.length], 'traffic');
    car.speed = 90 + Math.random() * 90;
    car.health = 100;
    state.cars.push(car);
  }
}

export function spawnParkedCars(state, count) {
  for (let i = 0; i < count; i++) {
    const p = state.city.randomRoadPoint();
    const angle = p.horizontal ? (Math.random() < 0.5 ? 0 : Math.PI) : (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    // Park at the road edge, close enough to the kerb to leave the lane clear.
    const off = 18;
    const x = p.horizontal ? p.x : p.x + (Math.random() < 0.5 ? -off : off);
    const y = p.horizontal ? p.y + (Math.random() < 0.5 ? -off : off) : p.y;
    const car = createCar(x, y, angle, CAR_COLORS[(i * 3 + 2) % CAR_COLORS.length], 'parked');
    car.health = 100;
    state.cars.push(car);
  }
}

export function spawnPeds(state, count) {
  for (let i = 0; i < count; i++) {
    const p = state.city.randomSidewalkPoint();
    state.peds.push({
      x: p.x, y: p.y,
      angle: Math.random() * Math.PI * 2,
      speed: 28 + Math.random() * 30,
      color: PED_COLORS[i % PED_COLORS.length],
      health: 100, down: false, downTimer: 0,
      flee: 0, fleeAngle: 0, walkPhase: Math.random() * 6,
      target: null,
    });
  }
}

function carAheadBlocked(state, car) {
  // Cheap check: another car close ahead in the same lane direction.
  const ax = car.x + Math.cos(car.angle) * 70;
  const ay = car.y + Math.sin(car.angle) * 70;
  for (const other of state.cars) {
    if (other === car) continue;
    if ((other.x - ax) ** 2 + (other.y - ay) ** 2 < 46 * 46) return true;
  }
  return false;
}

export function stepTraffic(state, dt) {
  for (const car of state.cars) {
    if (car.kind !== 'traffic') continue;
    // At an intersection, sometimes turn onto the crossing road.
    const mx = ((car.x % PITCH) + PITCH) % PITCH;
    const my = ((car.y % PITCH) + PITCH) % PITCH;
    const atIntersection = mx < ROAD_W && my < ROAD_W;
    if (atIntersection && Math.random() < dt * 0.9) {
      const turn = (Math.random() - 0.5) * Math.PI;
      car.angle += Math.max(-Math.PI / 2, Math.min(Math.PI / 2, turn));
      car.angle = Math.round(car.angle / (Math.PI / 2)) * (Math.PI / 2);
    }
    // Stay in the road: if we drifted off, steer back toward the road centre.
    if (!isRoad(car.x, car.y)) {
      const rp = nearestRoadPoint(car.x, car.y);
      const want = Math.atan2(rp.y - car.y, rp.x - car.x);
      car.angle += clamp(angleDiff(car.angle, want), -1.6 * dt, 1.6 * dt);
    }
    const target = carAheadBlocked(state, car) ? 0 : car.cruise || 130;
    car.cruise = car.cruise || 110 + Math.random() * 70;
    car.speed += clamp(car.cruise - car.speed, -160 * dt, 90 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = clamp(car.x, 24, WORLD_SIZE - 24);
    car.y = clamp(car.y, 24, WORLD_SIZE - 24);
    // Bounce off the city edge instead of leaving the map.
    if (car.x <= 26 || car.x >= WORLD_SIZE - 26 || car.y <= 26 || car.y >= WORLD_SIZE - 26) {
      car.angle += Math.PI;
    }
  }
  // Keep the streets busy: replace traffic cars that wandered far away.
  if (state.cars.filter((c) => c.kind === 'traffic').length < 10) {
    spawnTraffic(state, 2);
  }
}

export function stepPeds(state, dt) {
  const p = state.player;
  for (const ped of state.peds) {
    if (ped.down) {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        // Gets up and walks away, shaken.
        ped.down = false;
        ped.health = 100;
        ped.flee = 3;
        ped.fleeAngle = Math.atan2(ped.y - p.y, ped.x - p.x);
      }
      continue;
    }
    ped.walkPhase += dt * 6;
    let dir = ped.angle;
    let speed = ped.speed;
    if (ped.flee > 0) {
      ped.flee -= dt;
      dir = ped.fleeAngle;
      speed = ped.speed * 2.6;
    } else if (state.wanted >= 2) {
      // Peds near a hot player scatter.
      const d2 = (ped.x - p.x) ** 2 + (ped.y - p.y) ** 2;
      if (d2 < 260 * 260) {
        ped.flee = 1.5;
        ped.fleeAngle = Math.atan2(ped.y - p.y, ped.x - p.x);
      }
    }
    // Wander: pick a new direction now and then.
    if (Math.random() < dt * 0.25 && ped.flee <= 0) {
      ped.angle = Math.random() * Math.PI * 2;
      dir = ped.angle;
    }
    const nx = ped.x + Math.cos(dir) * speed * dt;
    const ny = ped.y + Math.sin(dir) * speed * dt;
    // Peds stay out of buildings; they may cross roads.
    const blocked = state.city.buildings.some((b) => nx > b.x - 8 && nx < b.x + b.w + 8 && ny > b.y - 8 && ny < b.y + b.h + 8);
    if (!blocked) {
      ped.x = clamp(nx, 16, WORLD_SIZE - 16);
      ped.y = clamp(ny, 16, WORLD_SIZE - 16);
      ped.angle = dir;
    } else if (ped.flee <= 0) {
      ped.angle = Math.random() * Math.PI * 2;
    }
  }
  // Player car running over a ped: a crime, and the ped goes down.
  if (p.inCar && Math.abs(p.inCar.speed) > 60) {
    for (const ped of state.peds) {
      if (ped.down) continue;
      if ((ped.x - p.x) ** 2 + (ped.y - p.y) ** 2 < 40 * 40) {
        ped.down = true;
        ped.downTimer = 6;
        ped.health = 0;
        spawnParticles(state.particles, ped.x, ped.y, { count: 10, color: '#ff9d5c', speed: 150, life: 0.4, size: 3 });
        state.audio.crash();
        // One star per run-over, capped by the addWanted call itself.
        state.wanted = Math.min(5, state.wanted + 1);
        state.wantedTimer = 0;
        state.hudMessage = 'You ran someone over!';
      }
    }
  }
  // Respawn peds that ended up far from the player so streets stay alive.
  if (state.peds.filter((q) => !q.down).length < 14) spawnPeds(state, 4);
}
