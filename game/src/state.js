// Game state factory: one object every system reads and writes.
// main.js owns the loop; shots.js reuses this to stage screenshots.
import { START_MONEY } from './config.js';
import { createCity, nearestRoadPoint } from './world.js';
import { createPlayer } from './player.js';
import { spawnTraffic, spawnParkedCars, spawnPeds } from './traffic.js';
import { createAudio } from './audio.js';
import { createParticles } from './effects.js';

export function createGameState(seed, saveData) {
  const city = createCity(seed);
  const spawn = nearestRoadPoint(city.landmarks.hideout.x, city.landmarks.hideout.y);
  const player = createPlayer(spawn.x, spawn.y);
  player.money = saveData ? saveData.money : START_MONEY;
  const state = {
    seed,
    city,
    player,
    audio: createAudio(),
    particles: createParticles(),
    cars: [],
    peds: [],
    cops: [],
    bullets: [],
    pickups: [],
    wanted: 0,
    wantedTimer: 0,
    lastCrime: '',
    bustTimer: 0,
    busted: false,
    wasted: false,
    clockHours: 10.0, // 10:00 AM, a bright Solmar morning
    time: 0,
    camera: { x: player.x, y: player.y },
    mouse: { x: 0, y: 0 },
    objective: 'Press M to start your first job for Rosa.',
    hudMessage: '',
    hudMessageTimer: 0,
    mission: null,
    missionIndex: saveData ? saveData.missionIndex : 0,
    completedMissions: saveData ? [...saveData.completed] : [],
    bestMoney: saveData ? saveData.bestMoney : 0,
    nextMissionTimer: 0,
    saveTimer: 0,
    messageTimer: 0,
  };
  spawnTraffic(state, 14);
  spawnParkedCars(state, 10);
  spawnPeds(state, 26);
  // A few useful pickups scattered near the hideout.
  state.pickups.push(
    { x: spawn.x + 90, y: spawn.y - 40, kind: 'health', ttl: 120 },
    { x: spawn.x - 120, y: spawn.y + 60, kind: 'ammo', ttl: 120 },
    { x: spawn.x + 40, y: spawn.y + 130, kind: 'cash', amount: 50, ttl: 120 },
  );
  return state;
}

// Put the player (on foot) at a road point near x,y and clear police heat.
export function teleportPlayer(state, x, y) {
  const p = nearestRoadPoint(x, y);
  state.player.inCar = null;
  state.player.x = p.x;
  state.player.y = p.y;
  state.player.health = 100;
  state.camera.x = p.x;
  state.camera.y = p.y;
}
