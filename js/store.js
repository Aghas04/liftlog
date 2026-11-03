// All app data lives in one object saved to localStorage.
import { EXERCISES, EQUIPMENT, DAY_TYPES, MUSCLES, CUSTOM_SPLIT } from './data.js';
import { PLAN_DAYS } from './planner.js';
import { isKg, defaultStepLb, stepChoices } from './units.js';
import { restSeconds } from './engine.js';

const KEY = 'liftlog.v1';

function emptyState() {
  return {
    version: 1,
    settings: { defaultRest: 90, lastBackup: null, weeklyTarget: 10, accent: 'lime', standards: null, deloadUntil: null, deloadDismissed: null, ignoredRegions: [], neglectSnooze: {},
      units: 'lb', safetyAck: null,
      painFlags: {}, // exId -> ISO date of the 'This hurt' report; kept out of plans and suggestions
      readinessCheck: true,
      gymStars: [],     // exercise ids marked 'at my gym'
      notAtGym: [] },   // exercise ids your gym doesn't have: never suggested
    plan: null,           // weekly plan, see planner.js
    customExercises: [],
    exerciseSettings: {}, // exId -> { rest, increment, note }
    workouts: [],         // finished workouts, oldest first
    activeWorkout: null,
    bodyweight: [],       // { id, date: 'YYYY-MM-DD', lb }
    measurements: [],     // { id, date: 'YYYY-MM-DD', kind, value }
    achievements: {},     // achievement id -> ISO date earned
    splits: DAY_TYPES.map(d => ({ ...d, muscles: [...d.muscles] })), // { id, name, icon, color, muscles, hidden? }
    templates: [],        // { id, splitId, name, exercises: [{ exId, group? }] }
  };
}

function withDefaults(data) {
  const base = emptyState();
  return { ...base, ...data, settings: { ...base.settings, ...(data.settings || {}) } };
}

// Set when saved data couldn't be read: the unreadable copy is kept under
// this key so nothing is lost, and the app offers to restore a backup.
export let loadProblem = null;

export let state = load();

function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
    if (raw) return withDefaults(JSON.parse(raw));
  } catch (e) {
    console.error('Could not load saved data', e);
    const keep = `${KEY}.unreadable-${Date.now()}`;
    try { localStorage.setItem(keep, raw); } catch { /* storage full: the original stays until the next save */ }
    loadProblem = { key: keep };
  }
  return emptyState();
}

// Another tab or the Home Screen app saved: take its data, so this copy
// doesn't save over it with older data.
let onOutside = null;
export const onOutsideChange = fn => { onOutside = fn; };
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key !== KEY || !e.newValue) return;
    try { state = withDefaults(JSON.parse(e.newValue)); onOutside?.(); } catch { /* ignore a half-written value */ }
  });
}

// Typing saves a moment after you stop, not on every key; save() is immediate.
let soon = null;
export function saveSoon() {
  clearTimeout(soon);
  soon = setTimeout(save, 400);
}
export function flushSave() { if (soon) { clearTimeout(soon); soon = null; save(); } }

export function save() {
  clearTimeout(soon);
  soon = null;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Could not save data', e);
    alert('Could not save your data. Storage may be full.');
  }
}

export function replaceState(next) {
  state = withDefaults(next);
  save();
}

// Splits are user-editable. Hidden splits stay so old workouts still show.
export function dayType(id) {
  if (id === CUSTOM_SPLIT.id) return CUSTOM_SPLIT;
  // Planned sessions save as 'plan_<type>' so history shows the plan day.
  if (typeof id === 'string' && id.startsWith('plan_') && PLAN_DAYS[id.slice(5)]) return { id, ...PLAN_DAYS[id.slice(5)] };
  return state.splits.find(s => s.id === id)
    || DAY_TYPES.find(d => d.id === id)
    || { id, name: 'Workout', icon: '🏋️', color: '#c4f542', muscles: Object.keys(MUSCLES) };
}

export function visibleSplits() {
  return state.splits.filter(s => !s.hidden);
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function allExercises() {
  return [...EXERCISES, ...state.customExercises];
}

export function exercise(id) {
  // An id with no exercise (deleted custom lift, damaged import): shown, but
  // counted toward no muscle's weekly sets.
  return allExercises().find(e => e.id === id) || { id, name: 'Unknown exercise', muscle: 'back', equipment: 'machine', compound: false, unknown: true };
}

// Weight step in stored lb. A custom step only applies in the unit it was
// picked in (a 5 lb step would be an odd 2.27 kg), otherwise the unit's default.
export function increment(ex) {
  const units = state.settings.units || 'lb';
  const custom = state.exerciseSettings[ex.id]?.increment;
  if (custom && stepChoices(units).some(v => Math.abs(v - custom) < 1e-6)) return custom;
  if (isKg(units)) return defaultStepLb(ex.equipment, units, {});
  return ex.increment || EQUIPMENT[ex.equipment]?.increment || 5;
}

export function exSetting(exId, key) {
  return state.exerciseSettings[exId]?.[key];
}

export function setExSetting(exId, key, value) {
  state.exerciseSettings[exId] = { ...(state.exerciseSettings[exId] || {}), [key]: value };
  save();
}

// Rest before the next set (engine.restSeconds has the rules and evidence).
export function restFor(exId) {
  const zone = state.activeWorkout?.exercises.find(e => e.exId === exId)?.zone;
  return restSeconds(exercise(exId), { own: state.exerciseSettings[exId]?.rest, base: state.settings.defaultRest, zone });
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
