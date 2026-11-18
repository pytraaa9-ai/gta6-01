// Solmar Nights — boot, screens and the main loop.
// Screens: title -> play -> paused / busted / wasted.
// ?shot=cover|chase|mission|night (&seed=N) stages a scene for screenshots
// instead of running the loop, paints it twice and sets window.__shotReady.
import { STEP, PISTOL_MAG } from './config.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER_CAR, ACTION_PUNCH, ACTION_RELOAD, ACTION_MISSION } from './input.js';
import { createRenderer, drawWorld } from './render.js';
import { drawHUD, drawTitle, drawOverlay } from './hud.js';
import { createGameState, teleportPlayer } from './state.js';
import { stepOnFoot, stepDriving, stepBullets, punch, shoot, reload, enterCar, exitCar, nearestCar, decayWanted } from './player.js';
import { stepTraffic, stepPeds } from './traffic.js';
import { stepPolice } from './police.js';
import { updateMission, startMission } from './missions.js';
import { updateParticles } from './effects.js';
import { loadSave, writeSave } from './save.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const saveData = loadSave();

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function runShot(name) {
  const state = createGameState(seed, null);
  const scene = stageShot(name, state);
  let painted = 0;
  function paint() {
    drawWorld(renderer, state, state.camera);
    drawHUD(renderer.ctx, canvas, state);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
  return scene;
}

function runGame() {
  const input = createInput(canvas);
  let screen = 'title';
  let state = createGameState(seed, saveData);
  let accumulator = 0;
  let last = performance.now();
  // Test/debug handle (read-only state access for play-tests).
  window.__solmar = { state: () => state, screen: () => screen };

  function announce(message) {
    status.textContent = message;
  }

  function startGame(fresh) {
    if (fresh) {
      state = createGameState(seed, null);
    } else {
      state = createGameState(seed, saveData);
    }
    screen = 'play';
    state.audio.unlock();
    startMission(state, state.missionIndex);
    announce(`Playing. Mission: ${state.objective}`);
  }

  function respawnAfterEnd() {
    const lost = Math.floor(state.player.money * 0.2);
    state.player.money -= lost;
    state.player.health = 100;
    state.wanted = 0;
    state.wantedTimer = 0;
    state.busted = false;
    state.wasted = false;
    state.bustTimer = 0;
    state.cops.length = 0;
    for (const car of state.cars) if (car.kind === 'police') car.kind = 'parked';
    state.audio.engine(0, false);
    teleportPlayer(state, state.city.landmarks.hideout.x, state.city.landmarks.hideout.y);
    writeSave(state);
    screen = 'play';
    announce('Back on the streets of Solmar.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) {
      if (screen === 'title') startGame(false);
      else if (screen === 'busted' || screen === 'wasted') respawnAfterEnd();
      else if (screen === 'paused') screen = 'play';
    }
    if (actions & ACTION_PAUSE) {
      if (screen === 'play') screen = 'paused';
      else if (screen === 'paused') screen = 'play';
    }
    if (screen !== 'play') return;
    if (actions & ACTION_ENTER_CAR) {
      if (state.player.inCar) exitCar(state);
      else {
        const car = nearestCar(state, 95);
        if (car) enterCar(state, car);
        else state.hudMessage = 'No car close enough — walk up to one and press E';
      }
    }
    if (actions & ACTION_PUNCH) punch(state);
    if (actions & ACTION_RELOAD) reload(state);
    if (actions & ACTION_MISSION) {
      if (!state.mission && state.missionIndex < 5) startMission(state, state.missionIndex);
      else if (!state.mission) state.hudMessage = 'Story complete — free roam!';
      else state.hudMessage = 'Finish the current job first — follow the gold marker';
    }
    // N toggles sound (checked via keydown queue: reuse reload key path is separate,
    // so listen directly here through a held-key edge is not available; see keydown below).
  }

  // Mute toggle on N (not part of the action bitmask).
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyN' && !e.repeat) {
      const muted = state.audio.toggleMute();
      state.hudMessage = muted ? 'Sound off' : 'Sound on';
      state.hudMessageTimer = 2;
    }
    if (e.code === 'KeyF' && !e.repeat && screen === 'title' && saveData) {
      // F on the title screen starts a fresh game, wiping the save.
      startGame(true);
    }
  });

  function step(dt) {
    const p = state.player;
    state.time += dt;
    state.clockHours = (state.clockHours + dt * 0.04) % 24; // a full day in ~10 min
    // Transient messages live ~3 s (first sight starts the clock).
    if (state.hudMessage) {
      if (state.hudMessageTimer <= 0) state.hudMessageTimer = 3;
      state.hudMessageTimer -= dt;
      if (state.hudMessageTimer <= 0) state.hudMessage = '';
    }

    const move = input.move();
    const mouse = input.mouse();
    state.mouse = mouse;
    // Aim follows the mouse (world coordinates).
    const worldMouseX = mouse.x + state.camera.x - canvas.width / 2;
    const worldMouseY = mouse.y + state.camera.y - canvas.height / 2;
    if (!p.inCar) p.aimAngle = Math.atan2(worldMouseY - p.y, worldMouseX - p.x);
    if (mouse.down && !p.inCar) shoot(state, worldMouseX, worldMouseY);
    if (input.takeClick() && !p.inCar) shoot(state, worldMouseX, worldMouseY); // fast clicks land between frames

    if (p.inCar) stepDriving(state, move, dt);
    else stepOnFoot(state, move, input.running(), dt);

    stepTraffic(state, dt);
    stepPeds(state, dt);
    stepPolice(state, dt);
    stepBullets(state, dt);
    updateParticles(state.particles, dt);
    updateMission(state, dt);
    decayWanted(state, dt);

    // Pickups.
    for (let i = state.pickups.length - 1; i >= 0; i--) {
      const pk = state.pickups[i];
      pk.ttl -= dt;
      if (pk.ttl <= 0) {
        state.pickups.splice(i, 1);
        continue;
      }
      if ((pk.x - p.x) ** 2 + (pk.y - p.y) ** 2 < 34 * 34) {
        if (pk.kind === 'cash') {
          p.money += pk.amount;
          state.audio.cash();
          state.hudMessage = `+$${pk.amount}`;
        } else if (pk.kind === 'health') {
          p.health = Math.min(100, p.health + 35);
          state.audio.pickup();
          state.hudMessage = 'Health +35';
        } else {
          p.reserve += 24;
          state.audio.pickup();
          state.hudMessage = 'Ammo +24';
        }
        state.hudMessageTimer = 2;
        state.pickups.splice(i, 1);
      }
    }

    // Slow health regen while the heat is off.
    if (state.wanted === 0 && p.health > 0 && p.health < 100) {
      p.health = Math.min(100, p.health + 1.5 * dt);
    }
    // Ammo restock trickle: street vendors sell bullets — slow refill of reserve.
    if (p.reserve < PISTOL_MAG) p.reserve = Math.min(PISTOL_MAG, p.reserve + dt * 0.5);

    // Camera follows the player smoothly.
    const camSpeed = 1 - Math.pow(0.001, dt);
    state.camera.x += (p.x - state.camera.x) * camSpeed;
    state.camera.y += (p.y - state.camera.y) * camSpeed;

    if (state.busted) {
      state.audio.busted();
      screen = 'busted';
      announce('Busted by the SPD.');
    } else if (state.wasted || p.health <= 0) {
      state.audio.busted();
      screen = 'wasted';
      announce('Wasted.');
    }

    // Autosave every 10 seconds.
    state.saveTimer += dt;
    if (state.saveTimer > 10) {
      state.saveTimer = 0;
      writeSave(state);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === 'play') {
      while (accumulator >= STEP && screen === 'play') {
        step(STEP);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    if (screen === 'title') {
      drawTitle(renderer.ctx, canvas, saveData);
    } else if (screen === 'play') {
      drawWorld(renderer, state, state.camera);
      drawHUD(renderer.ctx, canvas, state);
    } else if (screen === 'paused') {
      drawWorld(renderer, state, state.camera);
      drawHUD(renderer.ctx, canvas, state);
      drawOverlay(renderer.ctx, canvas, 'PAUSED', ['Take a breather, Solmar waits.', 'P / Enter — resume'], '#ffd23d');
    } else if (screen === 'busted') {
      drawOverlay(renderer.ctx, canvas, 'BUSTED', [
        'The SPD caught you. Rosa bailed you out — for a price.',
        `You lost $${Math.floor(state.player.money * 0.2)} in bail and fines.`,
      ], '#4d7dff');
    } else if (screen === 'wasted') {
      drawOverlay(renderer.ctx, canvas, 'WASTED', [
        'Solmar chewed you up… but the city never keeps anyone down.',
        `You lost $${Math.floor(state.player.money * 0.2)} in hospital bills.`,
      ], '#ff5c5c');
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') screen = 'paused';
  });

  canvas.addEventListener('mousedown', () => {
    if (screen === 'title') startGame(false);
  });

  announce('Solmar Nights. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
