// Save / load: money and mission progress persist in localStorage.
// Nothing else is trusted from storage — positions and wanted reset each run.
import { SAVE_KEY, START_MONEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (typeof s !== 'object' || s === null) return null;
    return {
      money: Number.isFinite(s.money) ? Math.max(0, Math.floor(s.money)) : START_MONEY,
      missionIndex: Number.isFinite(s.missionIndex) ? Math.max(0, Math.min(5, Math.floor(s.missionIndex))) : 0,
      completed: Array.isArray(s.completed) ? s.completed.filter((n) => Number.isFinite(n)) : [],
      bestMoney: Number.isFinite(s.bestMoney) ? s.bestMoney : 0,
    };
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    const data = {
      money: state.money,
      missionIndex: state.missionIndex,
      completed: state.completedMissions,
      bestMoney: Math.max(state.money, state.bestMoney || 0),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Storage off: the run still works, it just does not persist.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch { /* ignore */ }
}
