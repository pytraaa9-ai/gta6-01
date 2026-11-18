// Screenshot staging: deterministic, rich scenes for ?shot=.
// Each stage arranges the live game state (real systems, no fake overlays)
// and returns the scene name. main.js paints it twice and sets __shotReady.
import { createCar } from './player.js';
import { startMission } from './missions.js';
import { teleportPlayer } from './state.js';
import { spawnTraffic } from './traffic.js';
import { nearestRoadPoint } from './world.js';

function putPlayerInCar(state, x, y, angle) {
  const car = createCar(x, y, angle, '#d64545', 'player');
  car.speed = 220;
  car.health = 100;
  state.cars.push(car);
  state.player.inCar = car;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
  state.camera.x = x;
  state.camera.y = y;
  return car;
}

function addPoliceChase(state, n) {
  const p = state.player;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.6;
    const rp = nearestRoadPoint(p.x + Math.cos(a) * 260, p.y + Math.sin(a) * 260);
    const car = createCar(rp.x, rp.y, Math.atan2(p.y - rp.y, p.x - rp.x), '#1e2a4a', 'police');
    car.speed = 300;
    car.health = 150;
    state.cars.push(car);
  }
  for (let i = 0; i < 2; i++) {
    state.cops.push({ x: p.x + 180 + i * 60, y: p.y + 120, angle: 0, health: 100, down: false, downTimer: 0 });
  }
}

export function stageShot(name, state) {
  const L = state.city.landmarks;
  state.time = 12;
  if (name === 'cover') {
    // Daytime drive down a busy Solmar street, mission 0 live, HUD + minimap.
    state.clockHours = 10.5;
    putPlayerInCar(state, 448, 620, 0);
    state.player.money = 1250;
    startMission(state, 0);
    state.hudMessage = 'Pick up the package at the Night Market';
    state.hudMessageTimer = 3;
    spawnTraffic(state, 4);
  } else if (name === 'chase') {
    // Sunset getaway: 3 wanted stars, SPD cars and foot cops in pursuit.
    state.clockHours = 17.8;
    putPlayerInCar(state, 848, 448, 0);
    state.player.money = 2450;
    state.wanted = 3;
    state.wantedTimer = 0;
    addPoliceChase(state, 3);
    startMission(state, 3);
    state.mission.stage = 1;
    state.mission.text = 'Heat is on! Now lose the cops (lay low until 0 stars)';
    state.objective = 'Hot Pursuit: Heat is on! Now lose the cops (lay low until 0 stars)';
    state.hudMessage = 'The SPD is on your tail — lose them!';
    state.hudMessageTimer = 3;
    spawnTraffic(state, 4);
  } else if (name === 'mission') {
    // Debt Collection at Palm Plaza: the marked debtor, objective on the HUD.
    state.clockHours = 13.0;
    teleportPlayer(state, L.plaza.x, L.plaza.y);
    state.player.money = 1980;
    state.player.ammo = 9;
    startMission(state, 2);
    state.mission.stage = 1;
    const rp = nearestRoadPoint(L.plaza.x, L.plaza.y);
    const ped = {
      x: rp.x + 60, y: rp.y + 10, angle: 0, speed: 40,
      color: '#ff2d78', health: 100, down: false, downTimer: 0,
      flee: 0, fleeAngle: 0, walkPhase: 0, target: true,
    };
    state.peds.push(ped);
    state.mission.targetPed = ped;
    state.mission.target = { x: ped.x, y: ped.y, label: 'The debtor — collect the debt' };
    state.mission.text = 'There he is (pink). Knock him down and take the cash';
    state.objective = 'Debt Collection: There he is (pink). Knock him down and take the cash';
    state.mouse = { x: 700, y: 300 };
    state.player.aimAngle = Math.atan2(300 - 360, 700 - 640);
  } else if (name === 'night') {
    // Night combat in Old Town: 2 stars, cops closing in, pistol out.
    state.clockHours = 22.0;
    teleportPlayer(state, 620, 1420);
    state.player.money = 3120;
    state.player.ammo = 7;
    state.player.health = 82;
    state.wanted = 2;
    state.wantedTimer = 0;
    state.cops.push(
      { x: 760, y: 1500, angle: Math.PI, health: 100, down: false, downTimer: 0 },
      { x: 520, y: 1560, angle: -Math.PI / 2, health: 60, down: false, downTimer: 0 },
    );
    state.bullets.push({ x: 700, y: 1460, vx: 700, vy: -120, life: 0.5, fromPlayer: true });
    startMission(state, 4);
    state.objective = 'The Big Score: Get to Solmar Bank';
    state.hudMessage = 'Night in Old Town — the SPD wants you';
    state.hudMessageTimer = 3;
    state.mouse = { x: 760, y: 280 };
  } else {
    // Unknown shot name: plain daytime street.
    state.clockHours = 10.5;
    teleportPlayer(state, 620, 620);
  }
  return { name };
}
