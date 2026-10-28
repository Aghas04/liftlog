// All app data lives in one object saved to localStorage.
import { EXERCISES, EQUIPMENT } from './data.js';

const KEY = 'liftlog.v1';

function emptyState() {
  return {
    version: 1,
    settings: { defaultRest: 90, lastBackup: null },
    customExercises: [],
    exerciseSettings: {}, // exId -> { rest }
    workouts: [],         // finished workouts, oldest first
    activeWorkout: null,
    bodyweight: [],       // { id, date: 'YYYY-MM-DD', lb }
  };
}

export let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...emptyState(), ...JSON.parse(raw) };
  } catch (e) {
    console.error('Could not load saved data', e);
  }
  return emptyState();
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Could not save data', e);
    alert('Could not save your data. Storage may be full.');
  }
}

export function replaceState(next) {
  state = { ...emptyState(), ...next };
  save();
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function allExercises() {
  return [...EXERCISES, ...state.customExercises];
}

export function exercise(id) {
  return allExercises().find(e => e.id === id) || { id, name: id, muscle: 'back', equipment: 'machine', compound: false };
}

export function increment(ex) {
  return ex.increment || EQUIPMENT[ex.equipment]?.increment || 5;
}

export function restFor(exId) {
  return state.exerciseSettings[exId]?.rest ?? state.settings.defaultRest;
}

// Latest bodyweight on or before a date (ISO string), or null.
export function bodyweightOn(dateIso) {
  const day = (dateIso || new Date().toISOString()).slice(0, 10);
  let best = null;
  for (const b of state.bodyweight) {
    if (b.date <= day && (!best || b.date > best.date)) best = b;
  }
  if (!best && state.bodyweight.length) {
    best = [...state.bodyweight].sort((a, b) => a.date.localeCompare(b.date))[0];
  }
  return best ? best.lb : null;
}

export function usageCounts() {
  const counts = {};
  for (const w of state.workouts) for (const e of w.exercises) counts[e.exId] = (counts[e.exId] || 0) + 1;
  return counts;
}
