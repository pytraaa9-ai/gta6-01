// Story missions for Solmar Nights — five jobs for Rosa's crew.
// Each mission is a small stage machine: { stage, target, timer }.
// Completing a job pays cash and unlocks the next one; progress saves.
import { writeSave } from './save.js';
import { nearestRoadPoint } from './world.js';

export const MISSION_DEFS = [
  {
    id: 0, name: 'First Job',
    intro: 'Rosa needs a package picked up at the Night Market and brought to the Hideout. No cops, no fuss.',
    reward: 200,
  },
  {
    id: 1, name: 'Getaway Driver',
    intro: 'The crew needs wheels. Steal any car (E) and bring it to Marina Bay before the timer runs out.',
    reward: 300,
  },
  {
    id: 2, name: 'Debt Collection',
    intro: 'A gambler at Palm Plaza owes Rosa $400. Go remind him — fists work fine — then take what he owes.',
    reward: 400,
  },
  {
    id: 3, name: 'Hot Pursuit',
    intro: 'The cops need a reminder who runs Solmar. Get 2 stars, then lose the heat and slip away to the Docks.',
    reward: 500,
  },
  {
    id: 4, name: 'The Big Score',
    intro: 'Solmar Bank, midday. Grab the cash, outrun a 3-star response, and bring it home to the Hideout.',
    reward: 800,
  },
];

function at(state, x, y, r) {
  return (state.player.x - x) ** 2 + (state.player.y - y) ** 2 < r * r;
}

// Landmarks sit inside blocks; missions point at the nearest road instead,
// so the player can actually stand on the marker.
function roadTarget(lm, label) {
  const p = nearestRoadPoint(lm.x, lm.y);
  return { x: p.x, y: p.y, label };
}

export function startMission(state, index) {
  const def = MISSION_DEFS[index];
  if (!def) {
    state.mission = null;
    state.objective = 'Story complete! Free roam Solmar — cause chaos or chase the high score.';
    return;
  }
  const L = state.city.landmarks;
  const m = { index, def, stage: 0, timer: 0, target: null, text: def.intro, targetPed: null };
  state.mission = m;
  state.objective = `${def.name}: ${def.intro}`;
  state.audio.mission();
  if (index === 0) {
    m.target = roadTarget(L.market, 'Night Market — pick up the package');
    m.text = 'Pick up the package at the Night Market';
  } else if (index === 1) {
    m.target = roadTarget(L.marina, 'Marina Bay');
    m.timer = 75;
    m.text = 'Steal a car (press E near one), then drive to Marina Bay';
  } else if (index === 2) {
    m.target = roadTarget(L.plaza, 'Palm Plaza — the debtor');
    m.text = 'Find the debtor at Palm Plaza';
  } else if (index === 3) {
    m.target = null;
    m.text = 'Cause trouble until you have 2 wanted stars';
  } else if (index === 4) {
    m.target = roadTarget(L.bank, 'Solmar Bank');
    m.text = 'Get to Solmar Bank';
  }
  state.hudMessage = `New mission: ${def.name}`;
}

export function completeMission(state) {
  const m = state.mission;
  if (!m) return;
  state.player.money += m.def.reward;
  state.completedMissions.push(m.def.id);
  state.missionIndex = Math.min(MISSION_DEFS.length, m.index + 1);
  state.audio.cash();
  state.hudMessage = `Mission complete: ${m.def.name} — +$${m.def.reward}`;
  state.objective = `Mission complete! Press M for the next job.`;
  state.mission = null;
  writeSave(state);
  // A short breather, then the next job auto-starts after 4 seconds.
  state.nextMissionTimer = 4;
}

export function updateMission(state, dt) {
  // Auto-start the next job after the breather.
  if (!state.mission && state.nextMissionTimer > 0) {
    state.nextMissionTimer -= dt;
    if (state.nextMissionTimer <= 0 && state.missionIndex < MISSION_DEFS.length) {
      startMission(state, state.missionIndex);
    }
    return;
  }
  const m = state.mission;
  if (!m) return;
  const L = state.city.landmarks;
  const p = state.player;

  if (m.index === 0) {
    if (m.stage === 0 && at(state, m.target.x, m.target.y, 80)) {
      m.stage = 1;
      m.target = roadTarget(L.hideout, 'Hideout — deliver the package');
      m.text = 'Package secured. Deliver it to Rosa\u2019s Hideout';
      state.audio.pickup();
      state.objective = `${m.def.name}: ${m.text}`;
    } else if (m.stage === 1 && at(state, m.target.x, m.target.y, 80)) {
      completeMission(state);
    }
  } else if (m.index === 1) {
    m.timer -= dt;
    if (m.timer <= 0) {
      state.hudMessage = 'Too slow — the crew found another driver. Press M to retry.';
      state.mission = null;
      state.objective = 'Getaway Driver failed. Press M to retry the job.';
      return;
    }
    if (m.stage === 0 && p.inCar) {
      m.stage = 1;
      m.text = `Car secured! Reach Marina Bay — ${Math.ceil(m.timer)}s left`;
      state.objective = `${m.def.name}: ${m.text}`;
    } else if (m.stage === 1 && at(state, m.target.x, m.target.y, 80)) {
      completeMission(state);
    } else if (m.stage === 1) {
      m.text = `Reach Marina Bay — ${Math.ceil(m.timer)}s left`;
      state.objective = `${m.def.name}: ${m.text}`;
    }
  } else if (m.index === 2) {
    if (m.stage === 0 && at(state, m.target.x, m.target.y, 90)) {
      m.stage = 1;
      // The debtor appears on the street by the plaza: a marked ped.
      const rp = nearestRoadPoint(L.plaza.x, L.plaza.y);
      const ped = {
        x: rp.x + 30, y: rp.y + 10, angle: 0, speed: 40,
        color: '#ff2d78', health: 100, down: false, downTimer: 0,
        flee: 0, fleeAngle: 0, walkPhase: 0, target: true,
      };
      state.peds.push(ped);
      m.targetPed = ped;
      m.target = { x: ped.x, y: ped.y, label: 'The debtor — collect the debt' };
      m.text = 'There he is (pink). Knock him down and take the cash';
      state.objective = `${m.def.name}: ${m.text}`;
    } else if (m.stage === 1 && m.targetPed && m.targetPed.down) {
      m.stage = 2;
      state.pickups.push({ x: m.targetPed.x, y: m.targetPed.y, kind: 'cash', amount: m.def.reward, ttl: 30, mission: true });
      m.target = { x: m.targetPed.x, y: m.targetPed.y, label: 'Grab the cash' };
      m.text = 'He paid up. Grab the cash';
      state.objective = `${m.def.name}: ${m.text}`;
    } else if (m.stage === 2) {
      // Picking up the mission cash completes the job (handled in main loop).
      if (!state.pickups.some((pk) => pk.mission)) completeMission(state);
    }
  } else if (m.index === 3) {
    if (m.stage === 0 && state.wanted >= 2) {
      m.stage = 1;
      m.text = 'Heat is on! Now lose the cops (lay low until 0 stars)';
      state.objective = `${m.def.name}: ${m.text}`;
    } else if (m.stage === 1 && state.wanted === 0) {
      m.stage = 2;
      m.target = roadTarget(L.docks, 'The Docks — lay low');
      m.text = 'Clean. Slip away to the Docks';
      state.objective = `${m.def.name}: ${m.text}`;
    } else if (m.stage === 2 && at(state, m.target.x, m.target.y, 80)) {
      completeMission(state);
    }
  } else if (m.index === 4) {
    if (m.stage === 0 && at(state, m.target.x, m.target.y, 80)) {
      m.stage = 1;
      state.wanted = Math.max(state.wanted, 3);
      state.wantedTimer = 0;
      state.audio.sirenBlip();
      m.target = roadTarget(L.hideout, 'Hideout — bring the cash home');
      m.text = 'Cash grabbed! 3 stars — escape to the Hideout';
      state.objective = `${m.def.name}: ${m.text}`;
      state.hudMessage = 'The vault is open — RUN!';
    } else if (m.stage === 1 && at(state, m.target.x, m.target.y, 80)) {
      completeMission(state);
    }
  }
}

// The world position the mission marker (and minimap) should point at.
export function missionMarker(state) {
  const m = state.mission;
  if (!m || !m.target) return null;
  if (m.targetPed && !m.targetPed.down && m.index === 2) {
    return { x: m.targetPed.x, y: m.targetPed.y, label: m.target.label };
  }
  return m.target;
}
