import { MUSCLES, EQUIPMENT, REGIONS, CUSTOM_SPLIT, EQUIPMENT_PROFILES, regionsOf, exerciseRegions, primaryRegion } from './data.js';
import { buildWorkout, paceFromHistory, setsForMinutes, exerciseForRegion } from './builder.js';
import {
  state, save, replaceState, uid, allExercises, exercise, increment, restFor, bodyweightOn, usageCounts, exSetting, setExSetting,
  dayType, visibleSplits,
} from './store.js';
import {
  suggest, targetFor, workingSets, sessionE1RM, epley, warmupSets, swapWeight, zoneFor, fatigueLoad,
  personalFatigueRate, fatigueFactor, DEFAULT_FATIGUE_RATE, calibrationFrom,
} from './engine.js';
import { PLAN_DAYS, recommendSplits, readinessAdjust, swapSuggestions, splitById, slotLetter } from './planner.js';
import {
  createPlan, blockedLifts, maintainPlan, currentWeek, upcomingDays, weekVolume, todayOf, nextTraining, pausePlan, resumePlan, setWeekDays, editSession,
  unexclude, dropFromBlock, sessionEntries, runReview, approveReview, postponeReview, reviewDue, isPaused, blockWeek,
  replacementFor, swapOptions, STRENGTH_ZONE,
} from './plancontrol.js';
import {
  recommendSplit, deloadAdvice, achievements, monthRecap, strengthLevels, muscleSets,
  regionSets, regionTargets, regionLastDirect, neglectedRegions, DIRECT, weekKey as planWeekKey,
} from './insights.js';
import { listPhotos, photoBlob, addPhoto, deletePhoto } from './photos.js';
import { workoutCard, shareOrDownload } from './share.js';
import { readHealthExport } from './healthimport.js';
import { lineChart } from './charts.js';
import {
  weightUnit, lengthUnit, fmtWeight, fmtLength, toDisplay, fromDisplay, toLength, fromLength, isKg, stepChoices, snapToStep, LB_PER_KG,
} from './units.js';
import { countUp, confetti } from './fx.js';
import { platesFor, platesSvg, PLATE_SETS } from './plates.js';
import { muscleMap } from './bodymap.js';

const ACCENTS = { lime: '#c4f542', cyan: '#3ed4ff', purple: '#9b8cff', orange: '#ff9447', red: '#ff5f6d' };

function applyTheme() {
  const hex = ACCENTS[state.settings.accent] || ACCENTS.lime;
  document.documentElement.style.setProperty('--accent', hex);
  document.documentElement.style.setProperty('--hit', hex);
}

const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Weights are stored in lb; these show them in the user's unit.
const U = () => state.settings.units || 'lb';
const wu = () => weightUnit(U());
const fmtW = w => fmtWeight(w, U());
const dispW = lb => Math.round(toDisplay(lb, U()));
const fmtNum = v => (v == null || v === '' ? '' : String(Math.round(v * 10) / 10));
// Body measurements: lengths stored in inches, body fat in %.
const measureUnit = kind => (kind === 'bodyfat' ? '%' : lengthUnit(U()));
const fmtM = (v, kind) => (kind === 'bodyfat' ? fmtNum(v) : fmtLength(v, U()));
const DAY = 86400000;

const ui = {
  tab: 'workout',
  historyId: null,
  progressEx: null,
  progressMetric: 'e1rm',
  sheet: null,
  ranges: loadRanges(), // chart key -> range id
};

function loadRanges() {
  try { return JSON.parse(localStorage.getItem('liftlog.ranges')) || {}; } catch { return {}; }
}

// ---------- Icons ----------
const ICON = {
  workout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/></svg>',
  history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
  progress: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19h16M5 15l4-4 3 3 7-7"/><path d="M15 7h4v4"/></svg>',
  plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2.5h6V4M9 10h6M9 14h6M9 18h3"/></svg>',
  health: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
};

// Small equipment glyphs shown next to exercise names.
const EQUIP_ICON = {
  barbell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M2 12h20M5 8v8M8 6v12M16 6v12M19 8v8"/></svg>',
  dumbbell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M8 12h8M5 8v8M8 7v10M16 7v10M19 8v8"/></svg>',
  cable: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="5" r="2.5"/><path d="M12 7.5V17M8 19h8M12 17v2"/></svg>',
  machine: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="6" y="4" width="12" height="16" rx="2"/><path d="M6 9h12M6 13h12M6 17h12"/></svg>',
  bodyweight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4.5" r="2"/><path d="M5 9l7 1 7-1M12 10v5l-3 6M12 15l3 6"/></svg>',
};

// ---------- Helpers ----------
function relDays(iso) {
  const d = Math.floor((startOfDay(Date.now()) - startOfDay(new Date(iso).getTime())) / DAY);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  return `${d} days ago`;
}
function startOfDay(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
const fmtDate = iso => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const isBW = ex => ex.equipment === 'bodyweight';

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

const fmtK = v => (v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e4 ? Math.round(v / 1000) + 'k' : Math.round(v).toLocaleString());

// Undo: snapshot the whole state before a destructive change.
let undoSnap = null;
function withUndo(label, fn) {
  undoSnap = JSON.stringify(state);
  fn();
  document.querySelector('.undo-toast')?.remove();
  const el = document.createElement('div');
  el.className = 'undo-toast';
  el.innerHTML = `<span>${esc(label)}</span><button data-act="undo">Undo</button>`;
  document.body.appendChild(el);
  clearTimeout(withUndo.t);
  withUndo.t = setTimeout(() => { el.remove(); undoSnap = null; }, 5000);
}

function prToast(detail) {
  document.querySelector('.pr-toast')?.remove();
  const el = document.createElement('div');
  el.className = 'pr-toast';
  el.innerHTML = `<span class="pr-trophy">🏆</span><div><b>New PR!</b><small>${esc(detail)}</small></div>`;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('out'), 2600);
  setTimeout(() => el.remove(), 3000);
}

function getW(ctx) {
  return ctx === 'active' ? state.activeWorkout : state.workouts.find(w => w.id === ctx);
}

// Past sessions of an exercise, oldest first. Only workouts before `beforeIso` if given.
function historyFor(exId, { excludeId, beforeIso } = {}) {
  const out = [];
  for (const w of state.workouts) {
    if (w.id === excludeId) continue;
    if (beforeIso && w.date >= beforeIso) continue;
    w.exercises.forEach((e, i) => {
      if (e.exId !== exId) return;
      out.push({ date: w.date, difficulty: e.difficulty, sets: e.sets, deload: e.deload, fatigue: fatigueAt(w, i, false) });
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// How tired an exercise's muscle is from the lifts before it in workout `w`.
// planned: count every working set listed (today's plan); otherwise only sets done.
function fatigueAt(w, idx, planned) {
  const prior = {};
  w.exercises.slice(0, idx).forEach(e => {
    const m = exercise(e.exId).muscle;
    prior[m] = (prior[m] || 0) + (planned ? e.sets.filter(s => !s.warmup).length : workingSets(e).length);
  });
  return fatigueLoad(prior, exercise(w.exercises[idx]?.exId ?? '').muscle);
}

// Fatigue for a lift about to be added at position idx of the active workout.
function fatigueFor(exId, idx) {
  const w = state.activeWorkout;
  const probe = { exercises: [...w.exercises.slice(0, idx), { exId, sets: [] }] };
  return fatigueAt(probe, idx, true);
}

// Re-suggest lifts not started yet after the workout's order or size changes.
// Weights you've changed by hand are kept; only their rep goals update.
function refreshPlan() {
  const w = state.activeWorkout;
  if (!w) return;
  const bw = bodyweightOn();
  w.exercises.forEach((e, i) => {
    if (e.sets.some(s => s.done) || e.suggestion?.kind === 'guess' || e.suggestion?.kind === 'calibrate') return;
    const ex = exercise(e.exId);
    const sug = suggestionFor(ex, fatigueAt(w, i, true), e.zone);
    if (!sug) return;
    const old = e.suggestion;
    e.suggestion = sug;
    let k = 0;
    for (const s of e.sets) {
      if (s.warmup) continue;
      if (!old || s.weight == null || s.weight === old.weight) s.weight = sug.weight;
      const reps = s.weight === sug.weight ? sug.reps[k] ?? sug.reps.at(-1) : targetFor(sug, ex, s.weight, k, bw);
      s.target = reps ? { weight: s.weight, reps } : s.target;
      k++;
    }
  });
  save();
}

function loadOf(ex, weight, dateIso) {
  return isBW(ex) ? (bodyweightOn(dateIso) || 0) + (weight || 0) : weight || 0;
}

function sessionVolume(ex, sets, dateIso) {
  return sets.reduce((sum, s) => sum + loadOf(ex, s.weight, dateIso) * s.reps, 0);
}

function workoutVolume(w) {
  return w.exercises.reduce((sum, e) => sum + sessionVolume(exercise(e.exId), workingSets(e), w.date), 0);
}

function weightLabel(ex, w) {
  if (isBW(ex)) return w ? `BW + ${fmtW(w)} ${wu()}` : 'Bodyweight';
  return `${fmtW(w)} ${wu()}`;
}

function setsSummary(ex, sets) {
  const ws = sets.filter(s => s.done && s.reps > 0);
  if (!ws.length) return '';
  const sameW = ws.every(s => s.weight === ws[0].weight);
  if (sameW) return `${weightLabel(ex, ws[0].weight)} × ${ws.map(s => s.reps).join(', ')}`;
  return ws.map(s => `${fmtW(s.weight) || 'BW'}×${s.reps}`).join(', ');
}

const FEEL = { easy: 'Easy', hard: 'Hard', too_hard: 'Too hard' };

// ---------- Workout actions ----------
// `from` is a past workout or a template: its exercises (and supersets) are
// copied in order. An exercise with `sets` (built workouts) gets that many.
// extra: fields stored on the workout (e.g. plan: { id, seq }). readiness:
// today's answers; on a rough day a set comes off some exercises.
function startWorkout(dayId, from, template, name, extra = {}, readiness = null) {
  state.activeWorkout = {
    id: uid(), dayType: dayId, startedAt: new Date().toISOString(), exercises: [], timer: null,
    ...(template ? { templateId: template.id, templateName: template.name } : name ? { templateName: name } : {}),
    ...extra,
  };
  const w = state.activeWorkout;
  const groups = {};
  for (const e of from?.exercises || []) {
    const entry = buildEntry(e.exId, null, fatigueFor(e.exId, w.exercises.length), e.zone);
    if (e.group) entry.group = groups[e.group] ||= uid();
    if (e.sets > 0) resizeSets(entry, e.sets);
    w.exercises.push(entry);
  }
  if (readiness) {
    const work = w.exercises.map(e => ({ sets: e.sets.filter(x => !x.warmup).length, main: !!e.zone }));
    const adj = readinessAdjust(work, readiness);
    adj.items.forEach((it, i) => { if (it.sets !== work[i].sets) resizeSets(w.exercises[i], it.sets); });
    w.readiness = { ...readiness, poor: adj.poor, trimmed: adj.trimmed };
    if (adj.trimmed) setTimeout(() => toast(`Rough day: ${adj.trimmed} set${adj.trimmed > 1 ? 's' : ''} trimmed`), 400);
  }
  if (template) {
    const timesUsed = state.workouts.filter(x => x.templateId === template.id).length;
    const offers = swapSuggestions({
      entries: w.exercises, neglect: neglectList(), exercises: allExercises(), usage: usageCounts(), blocked: blocked(),
      equipment: state.plan?.profile.equipment || 'gym', lookup: exercise, timesUsed,
    });
    if (offers.length) w.swapOffers = offers;
  }
  save();
  requestWakeLock();
  ui.tab = 'workout';
  ui.historyId = null;
  closeSheet();
  render(true);
  window.scrollTo(0, 0);
}

// Set an exercise entry to exactly n working sets. Extra sets continue the
// suggestion's rep pattern for their position.
function resizeSets(entry, n) {
  const ex = exercise(entry.exId);
  const warm = entry.sets.filter(s => s.warmup);
  const work = entry.sets.filter(s => !s.warmup).slice(0, n);
  while (work.length < n) {
    const prev = work.at(-1) || { weight: null, target: null };
    const reps = entry.suggestion && prev.weight != null ? targetFor(entry.suggestion, ex, prev.weight, work.length, bodyweightOn()) : null;
    work.push({ weight: prev.weight ?? null, reps: null, target: reps ? { weight: prev.weight, reps } : prev.target ? { ...prev.target } : null, done: false });
  }
  entry.sets = [...warm, ...work];
}

// Neglected muscle regions, most urgent first, honoring snoozes and opt-outs.
function neglectList() {
  return neglectedRegions(state.workouts, exercise, {
    ignored: state.settings.ignoredRegions, snoozed: state.settings.neglectSnooze, weeklyTarget: state.settings.weeklyTarget,
  });
}

const inDeload = () => !!state.settings.deloadUntil && Date.now() < new Date(state.settings.deloadUntil).getTime();

function setsFrom(sug) {
  return sug
    ? sug.reps.map(r => ({ weight: sug.weight, reps: null, target: { weight: sug.weight, reps: r }, done: false }))
    : [{ weight: null, reps: null, target: null, done: false }];
}

// The lifter's overall fatigue rate from all lifts. Cached until workouts change.
let rateCache = null;
function personalRate() {
  const key = `${state.workouts.length}|${state.workouts.at(-1)?.id}|${state.bodyweight.length}`;
  if (rateCache?.key === key) return rateCache.value;
  const ids = new Set(state.workouts.flatMap(w => w.exercises.map(e => e.exId)));
  const pointsByLift = [...ids].map(id => {
    const ex = exercise(id);
    return historyFor(id)
      .filter(h => workingSets(h).length && !h.deload)
      .map(h => ({ t: new Date(h.date).getTime() / DAY, e1rm: sessionE1RM(h, ex, bodyweightOn(h.date)), f: h.fatigue }));
  });
  rateCache = { key, value: personalFatigueRate(pointsByLift) };
  return rateCache.value;
}

// zone: rep range override (strength-goal main lifts use [3, 6]).
function suggestionFor(ex, fatigue = 0, zone = null) {
  const inc = increment(ex);
  let sug = suggest(ex, historyFor(ex.id), {
    increment: inc, bodyweight: bodyweightOn(), fatigue, fatigueRate: personalRate().rate,
    formatWeight: v => `${fmtW(v)} ${wu()}`, ...(zone ? { zone } : {}),
  });
  // After switching to kg, old lb weights (135 lb = 61.23 kg) aren't real kg
  // loads; snap those onto the step grid. Weights already typed in kg stay as is.
  if (sug && isKg(U()) && sug.weight > 0) {
    const kg = toDisplay(sug.weight, 'kg');
    if (Math.abs(kg * 4 - Math.round(kg * 4)) > 0.02) sug = { ...sug, weight: snapToStep(sug.weight, inc) };
  }
  if (sug && inDeload()) {
    // 'deloadWeek' (not 'deload'): only these sessions get excluded from future
    // estimates. A lighter session after missed targets still counts normally.
    sug = { ...sug, weight: Math.max(0, Math.round((sug.weight * 0.85) / inc) * inc), est: 0, kind: 'deloadWeek', reason: 'Deload week — about 15% lighter so you recover and come back stronger.' };
  }
  return sug;
}

// A fresh exercise entry. `from` gives a rough starting weight when swapping
// to a lift with no history: { ex, weight }.
// zone: rep range override kept on the entry (strength-goal main lifts).
function buildEntry(exId, from, fatigue = 0, zone = null) {
  const ex = exercise(exId);
  let sug = suggestionFor(ex, fatigue, zone);
  if (!sug && from) {
    const weight = swapWeight(from.ex, ex, from.weight, increment(ex));
    if (weight) {
      const [lo, hi] = zone || zoneFor(ex);
      const mid = Math.round((lo + hi) / 2);
      sug = { weight, reps: [mid, mid, mid - 1], kind: 'guess', reason: `Rough guess from ${from.ex.name} — adjust to what feels right.` };
    }
  }
  return { uid: uid(), exId, difficulty: 'hard', sets: setsFrom(sug), suggestion: sug, ...(zone ? { zone } : {}) };
}

function addExercise(exId, doRender = true) {
  const w = state.activeWorkout;
  if (!w) return;
  w.exercises.push(buildEntry(exId, null, fatigueFor(exId, w.exercises.length)));
  save();
  if (doRender) {
    closeSheet();
    render();
    const cards = document.querySelectorAll('.ex-card');
    cards[cards.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function finishWorkout() {
  const w = state.activeWorkout;
  const prs = workoutPRs(w);
  const exercises = w.exercises
    .map(e => ({
      exId: e.exId,
      difficulty: e.difficulty,
      ...(e.suggestion?.kind === 'deloadWeek' ? { deload: true } : {}),
      ...(e.group ? { group: e.group } : {}),
      sets: e.sets.filter(s => s.done && s.reps > 0).map(({ weight, reps, target, warmup, pr }) => ({ weight: weight || 0, reps, target, warmup: !!warmup, done: true, ...(pr ? { pr: true } : {}) })),
    }))
    .filter(e => e.sets.length);
  const saved = {
    id: w.id, dayType: w.dayType, date: w.startedAt, finishedAt: new Date().toISOString(), exercises,
    ...(w.templateId ? { templateId: w.templateId } : {}),
    ...(w.templateName ? { templateName: w.templateName } : {}),
    ...(w.plan ? { plan: w.plan } : {}),
    ...(w.readiness ? { readiness: w.readiness } : {}),
  };
  state.workouts.push(saved);
  state.workouts.sort((a, b) => a.date.localeCompare(b.date));
  state.activeWorkout = null;
  save();
  stopTimer();
  releaseWakeLock();
  closeSheet();
  const fresh = syncAchievements();
  render(true);
  window.scrollTo(0, 0);
  celebrate(saved, prs, fresh);
}

// Record newly earned achievements; returns the new ones.
function syncAchievements() {
  const fresh = achievements(state.workouts, exercise, bodyweightOn, U()).filter(a => a.earned && !state.achievements[a.id]);
  for (const a of fresh) state.achievements[a.id] = new Date().toISOString();
  if (fresh.length) save();
  return fresh;
}

// Full-screen "workout complete" moment.
function celebrate(w, prs, fresh = []) {
  const dt = dayType(w.dayType);
  const sets = w.exercises.reduce((n, e) => n + workingSets(e).length, 0);
  const mins = Math.max(1, Math.round((new Date(w.finishedAt) - new Date(w.date)) / 60000));
  const { streak } = weekStats();
  const el = document.createElement('div');
  el.className = 'celebrate';
  el.style.setProperty('--c', dt.color);
  el.innerHTML = `
    <div class="cel-inner">
      <div class="cel-ico">${dt.icon}</div>
      <div class="eyebrow">Workout complete</div>
      <h1>${esc(dt.name)} crushed.</h1>
      <div class="cel-stats">
        <div><b data-count="${mins}">0</b><span>minutes</span></div>
        <div><b data-count="${sets}">0</b><span>sets</span></div>
        <div><b data-count="${dispW(workoutVolume(w))}">0</b><span>${wu()} moved</span></div>
      </div>
      ${prs.length ? `<div class="cel-prs">${prs.map(p => `<div class="cel-pr"><span>🏆</span><div><b>${esc(p.name)}</b><small>New best · ${dispW(p.now)} ${wu()} est. 1RM (+${dispW(p.now - p.prev)})</small></div></div>`).join('')}</div>` : ''}
      ${fresh.length ? `<div class="cel-awards">${fresh.map(a => `<div class="cel-aw"><span>${a.icon}</span><div><small>Achievement unlocked</small><b>${esc(a.name)}</b></div></div>`).join('')}</div>` : ''}
      ${streak ? `<div class="cel-streak">🔥 ${streak}-week streak — keep it going</div>` : ''}
      <div class="row">
        <button class="btn" data-act="shareWorkout" data-id="${w.id}">Share</button>
        <button class="btn primary" data-act="closeCelebrate">Done</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  countUp(el);
  confetti([dt.color, ACCENTS[state.settings.accent] || ACCENTS.lime, '#ffffff', '#ffd34d']);
}

function workoutPRs(w, excludeId) {
  const prs = [];
  for (const e of w.exercises) {
    const ex = exercise(e.exId);
    const bw = bodyweightOn(w.date || w.startedAt);
    const done = { sets: e.sets.filter(s => s.done && s.reps > 0) };
    const now = sessionE1RM(done, ex, bw);
    if (!now) continue;
    const hist = historyFor(e.exId, { excludeId });
    if (!hist.length) continue;
    const prev = Math.max(...hist.map(h => sessionE1RM(h, ex, bodyweightOn(h.date))));
    if (now > prev + 0.01) prs.push({ name: ex.name, now, prev });
  }
  return prs;
}

// ---------- Rest timer ----------
let audioCtx = null;
function unlockAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { /* no audio */ }
}
function beep() {
  if (!audioCtx) return;
  try {
    const t0 = audioCtx.currentTime;
    [0, 0.25, 0.5].forEach(off => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t0 + off);
      g.gain.exponentialRampToValueAtTime(0.4, t0 + off + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + 0.18);
      o.connect(g).connect(audioCtx.destination);
      o.start(t0 + off);
      o.stop(t0 + off + 0.2);
    });
  } catch { /* ignore */ }
  navigator.vibrate?.([200, 100, 200]);
}

function startTimer(exId, override) {
  const w = state.activeWorkout;
  if (!w) return;
  const secs = override ?? restFor(exId);
  w.timer = { end: Date.now() + secs * 1000, total: secs, exId, beeped: false };
  save();
  tick();
}
function stopTimer() {
  if (state.activeWorkout) { state.activeWorkout.timer = null; save(); }
  $('#timer').hidden = true;
}
function adjustTimer(delta) {
  const t = state.activeWorkout?.timer;
  if (!t) return;
  t.end += delta * 1000;
  t.total = Math.max(1, t.total + delta);
  if (t.end > Date.now()) t.beeped = false;
  save();
  tick();
}

function tick() {
  const w = state.activeWorkout;
  const el = $('#timer');
  const elapsed = $('#elapsed');
  if (w && elapsed) {
    const m = Math.floor((Date.now() - new Date(w.startedAt).getTime()) / 60000);
    elapsed.textContent = m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
  }
  const t = w?.timer;
  if (!t) { el.hidden = true; return; }
  const left = Math.round((t.end - Date.now()) / 1000);
  const over = left <= 0;
  if (over && !t.beeped) { t.beeped = true; save(); beep(); }
  if (left < -300) { stopTimer(); return; }
  const a = Math.abs(left);
  const txt = `${over ? '+' : ''}${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`;
  const pct = over ? 100 : Math.max(0, Math.min(100, 100 - (left / t.total) * 100));
  // Build the controls once so taps aren't lost when the numbers update.
  if (!el.firstElementChild) {
    el.innerHTML = `
      <div class="ring"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" class="track"/><circle cx="22" cy="22" r="19" class="fill"/></svg></div>
      <div class="tt"><div class="t"></div><div class="lbl"></div></div>
      <button data-act="timerAdj" data-d="-15">−15</button>
      <button data-act="timerAdj" data-d="15">+15</button>
      <button data-act="timerStop" aria-label="Stop timer">✕</button>`;
  }
  const dt = dayType(w.dayType);
  el.hidden = false;
  el.className = over ? 'over' : '';
  el.style.setProperty('--c', dt?.color || '');
  el.querySelector('.t').textContent = txt;
  el.querySelector('.lbl').textContent = over ? 'Rest done — next set!' : `Rest · ${exercise(t.exId).name}`;
  const C = 2 * Math.PI * 19;
  el.querySelector('.fill').style.strokeDasharray = `${(pct / 100) * C} ${C}`;
}
setInterval(tick, 500);

// Keep the screen on during a workout where supported.
let wakeLock = null;
async function requestWakeLock() {
  try { if ('wakeLock' in navigator && !wakeLock) wakeLock = await navigator.wakeLock.request('screen'); wakeLock?.addEventListener('release', () => { wakeLock = null; }); } catch { wakeLock = null; }
}
function releaseWakeLock() { wakeLock?.release?.(); wakeLock = null; }
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (state.activeWorkout) requestWakeLock();
    tick();
  }
});

// ---------- Rendering: exercise card ----------
// How a finished set compares to its goal. One short is a normal attempt at
// "one more rep than last time"; two or more short is a miss (same rule the
// suggestion engine uses).
function setStatus(s) {
  if (!s.done || !s.target || s.reps == null) return '';
  if (s.reps <= s.target.reps - 2) return 'miss';
  if (s.reps === s.target.reps - 1) return 'near';
  return '';
}

function setRow(ctx, ei, si, e, ex, s, live) {
  const status = setStatus(s);
  const bw = isBW(ex);
  return `
  <div class="set-row ${s.done ? 'done' : ''} ${status} ${s.done && s.pr ? 'pr' : ''}" data-w="${ctx}" data-e="${ei}" data-s="${si}">
    <button class="set-num ${s.warmup ? 'warm' : ''}" data-act="warmup" aria-label="Toggle warm-up">${s.warmup ? 'W' : si + 1 - e.sets.slice(0, si).filter(x => x.warmup).length}</button>
    <div class="stepper">
      <button data-act="step" data-f="weight" data-d="-1" aria-label="Less weight">−</button>
      <input data-field="weight" inputmode="decimal" value="${fmtW(s.weight)}" placeholder="${bw ? '+0' : wu()}" aria-label="Weight">
      <button data-act="step" data-f="weight" data-d="1" aria-label="More weight">+</button>
    </div>
    <div class="stepper reps">
      <button data-act="step" data-f="reps" data-d="-1" aria-label="Fewer reps">−</button>
      <input data-field="reps" inputmode="numeric" value="${s.reps ?? ''}" placeholder="${s.target ? s.target.reps : 'reps'}" aria-label="Reps">
      <button data-act="step" data-f="reps" data-d="1" aria-label="More reps">+</button>
    </div>
    <button class="check" data-act="done" aria-label="Mark set done">${ICON.check}</button>
    ${s.target || (s.done && s.pr) ? `<div class="goal">${goalText(s)}</div>` : ''}
  </div>`;
}

function goalText(s) {
  const status = setStatus(s);
  const parts = [];
  if (s.done && s.pr) parts.push('🏆 New PR');
  if (s.target) parts.push(status === 'miss' ? `missed · goal ${s.target.reps}` : status === 'near' ? `1 short · goal ${s.target.reps}` : `goal ${s.target.reps}`);
  return parts.join(' · ');
}

// Best estimated 1RM for an exercise before this set: past sessions plus
// other finished sets in the current workout.
function bestBefore(c) {
  const hist = historyFor(c.e.exId, { excludeId: c.w.id });
  if (!hist.length) return null;
  let best = Math.max(...hist.map(h => sessionE1RM(h, c.ex, bodyweightOn(h.date))));
  c.e.sets.forEach(s => {
    if (s !== c.s && s.done && !s.warmup && s.reps > 0) best = Math.max(best, epley(loadOf(c.ex, s.weight), s.reps));
  });
  return best;
}

function exCard(w, ctx, ei, live) {
  const e = w.exercises[ei];
  const ex = exercise(e.exId);
  const hist = live ? historyFor(e.exId) : historyFor(e.exId, { excludeId: w.id, beforeIso: w.date });
  const last = [...hist].reverse().find(h => workingSets(h).length);
  const sug = e.suggestion;
  const note = exSetting(e.exId, 'note');

  let sugHtml = '';
  if (live) {
    if (sug?.kind === 'calibrate') {
      sugHtml = `<div class="suggest"><div class="target">🎯 Targets set from your first set</div><div class="why">Later sets aim to match it, then drop about a rep each.</div></div>`;
    } else if (sug) {
      // The workout-order adjustment stays out of sight mid-workout; it's one tap away.
      sugHtml = `<div class="suggest"><div class="target">🎯 ${weightLabel(ex, sug.weight)} × ${sug.reps.join(' · ')}</div><div class="why">${esc(sug.reason)}</div>
        ${sug.fatigueNote ? `<details class="why-more"><summary>Why this number?</summary><p>${esc(sug.fatigueNote)}</p></details>` : ''}</div>`;
    } else {
      const [lo, hi] = e.zone || zoneFor(ex);
      sugHtml = `<div class="suggest first"><div class="why">New lift: pick a weight you could do about ${Math.min(hi, lo + 4)} times with good form and stop with 2 reps left. After the first set, the app sets targets for the rest.</div></div>`;
    }
  }
  const lastHtml = last
    ? `<div class="last">Last (${relDays(last.date)}): ${esc(setsSummary(ex, last.sets))}${last.difficulty && last.difficulty !== 'hard' ? ` · ${FEEL[last.difficulty]}` : ''}</div>`
    : '';

  return `
  <section class="ex-card ${cardComplete(e) ? 'complete' : ''} ${e.group ? 'ss' : ''}" data-w="${ctx}" data-e="${ei}" style="--c:${dayType(w.dayType)?.color}">
    ${e.group ? `<div class="ss-label">🔗 Superset ${groupLetter(w, e.group)}</div>` : ''}
    <div class="ex-head">
      <div><span class="tag">${EQUIP_ICON[ex.equipment] || ''}${MUSCLES[ex.muscle] || ''}</span><h3>${esc(ex.name)}</h3></div>
      <div class="ex-tools">
        ${live && ex.equipment === 'barbell' ? `<button data-act="platesSheet" aria-label="Plate calculator">Plates</button>` : ''}
        ${live ? `<button data-act="restSheet">⏱ ${restFor(e.exId)}s</button>` : ''}
        ${live
          ? `<button data-act="exMenu" aria-label="Exercise options">•••</button>`
          : `<button data-act="removeEx" aria-label="Remove exercise">✕</button>`}
      </div>
    </div>
    ${note ? `<div class="ex-note">📝 ${esc(note)}</div>` : ''}
    ${e.zone ? `<div class="zone-tag">Strength · ${e.zone[0]}–${e.zone[1]} reps</div>` : ''}${sugHtml}${lastHtml}
    <div class="set-head"><span>Set</span><span>${isBW(ex) ? '+ ' + wu() : wu()}</span><span>Reps</span><span></span></div>
    ${e.sets.map((s, si) => setRow(ctx, ei, si, e, ex, s, live)).join('')}
    <div class="set-actions">
      <button class="minus" data-act="removeSet">− Set</button>
      <button data-act="addSet">+ Add set</button>
    </div>
    <div class="feel">
      <span>How did it feel?</span>
      <div class="seg">
        ${Object.entries(FEEL).map(([v, l]) => `<button data-act="feel" data-v="${v}" class="${(e.difficulty || 'hard') === v ? 'on' : ''}">${l}</button>`).join('')}
      </div>
    </div>
  </section>`;
}

function groupLetter(w, g) {
  const groups = [...new Set(w.exercises.map(x => x.group).filter(Boolean))];
  return String.fromCharCode(65 + groups.indexOf(g));
}

// After a set: start rest, or hand off to the next lift in a superset.
function afterSet(c) {
  const { w, e } = c;
  if (c.s.warmup) { startTimer(e.exId, Math.min(60, restFor(e.exId))); return; }
  if (!e.group) { startTimer(e.exId); return; }
  const doneCount = x => x.sets.filter(s => s.done && !s.warmup).length;
  const mine = doneCount(e);
  const next = w.exercises.find(x => x !== e && x.group === e.group && doneCount(x) < mine && x.sets.some(s => !s.done && !s.warmup));
  if (!next) { startTimer(e.exId); return; }
  stopTimer();
  toast(`Superset → ${exercise(next.exId).name}`);
  const idx = w.exercises.indexOf(next);
  setTimeout(() => document.querySelectorAll('.ex-card')[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
}

function cardComplete(e) {
  return e.sets.length > 0 && e.sets.every(s => s.done);
}

function refreshRow(row) {
  const { w: ctx, e: ei, s: si } = row.dataset;
  const w = getW(ctx);
  const e = w.exercises[+ei];
  const ex = exercise(e.exId);
  const tmp = document.createElement('div');
  tmp.innerHTML = setRow(ctx, +ei, +si, e, ex, e.sets[+si], ctx === 'active');
  row.replaceWith(tmp.firstElementChild);
}

function refreshCard(card) {
  const { w: ctx, e: ei } = card.dataset;
  const tmp = document.createElement('div');
  tmp.innerHTML = exCard(getW(ctx), ctx, +ei, ctx === 'active');
  card.replaceWith(tmp.firstElementChild);
  updateProgress();
}

// ---------- Rendering: views ----------
function setProgress(w) {
  let done = 0, total = 0;
  for (const e of w.exercises) for (const s of e.sets) if (!s.warmup) { total++; if (s.done) done++; }
  return { done, total };
}

function updateProgress() {
  const w = state.activeWorkout;
  const el = $('#setProg');
  if (!w || !el) return;
  const { done, total } = setProgress(w);
  el.querySelector('i').style.width = total ? (done / total) * 100 + '%' : '0';
  $('#setCount').textContent = `${done}/${total} sets`;
}

function viewWorkout() {
  const w = state.activeWorkout;
  if (w) {
    const dt = dayType(w.dayType);
    const { done, total } = setProgress(w);
    return `
    <div class="active" style="--c:${dt.color}">
      <div class="workout-head">
        <div class="top">
          <div class="wh-title"><span class="day-ico sm">${dt.icon}</span>
            <div><h1>${esc(dt.name)}</h1><div class="sub">${w.templateName ? `<span class="tpl-tag">${esc(w.templateName)}</span> ` : ''}<span id="elapsed">0 min</span> · <span id="setCount">${done}/${total} sets</span></div></div></div>
          <button class="finish-btn" data-act="finishSheet">Finish</button>
        </div>
        <div class="prog" id="setProg"><i style="width:${total ? (done / total) * 100 : 0}%"></i></div>
      </div>
      ${swapOffersHtml(w)}
      ${w.exercises.map((_, i) => exCard(w, 'active', i, true)).join('')}
      ${w.exercises.length ? '' : `<div class="empty"><div class="big-ico">${dt.icon}</div>Add your first exercise to get started.</div>`}
      ${workoutTipHtml(w, dt)}
      <button class="btn primary day" data-act="picker">+ Add exercise</button>
      ${w.exercises.length ? `<button class="btn ghost" style="margin-top:10px" data-act="saveTplSheet">💾 Save as template</button>` : ''}
    </div>`;
  }

  const needsBackup = state.workouts.length >= 3 &&
    (!state.settings.lastBackup || Date.now() - new Date(state.settings.lastBackup).getTime() > 14 * DAY);
  const lastOf = id => [...state.workouts].sort((a, b) => b.date.localeCompare(a.date)).find(x => x.dayType === id);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const { thisWeek, streak } = weekStats();
  const days = new Set(state.workouts.map(w => startOfDay(new Date(w.date).getTime())));
  const monday = weekKey(Date.now());
  const today = startOfDay(Date.now());
  const week = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => {
    const t = startOfDay(monday + i * DAY + 3600000);
    return `<div class="wd ${days.has(t) ? 'on' : ''} ${t === today ? 'today' : ''}"><span>${l}</span><i></i></div>`;
  }).join('');
  const splits = visibleSplits();
  const planWk = state.plan ? planWeekNow() : null;
  const pick = !planWk && splits.length ? recommendSplit(state.workouts, exercise, splits) : null;
  const neglect = neglectList();
  const pickHtml = !pick ? '' : pick.rest
    ? `<div class="pick-card rest"><span class="day-ico">😴</span><div class="pick-txt"><small>Today</small><b>Rest day</b><span>${esc(pick.reason)}</span></div></div>`
    : `<button class="pick-card" style="--c:${pick.day.color}" data-act="start" data-day="${pick.day.id}">
        <span class="day-ico">${pick.day.icon}</span>
        <div class="pick-txt"><small>Today's pick</small><b>${esc(pick.day.name)}</b><span>${esc(pick.reason)}</span></div>
        <span class="go">${ICON.arrow}</span></button>`;
  return `
  <div class="top">
    <div><div class="eyebrow">${greeting}</div><h1>Let's lift.</h1></div>
    <button class="icon-btn" data-act="settings" aria-label="Settings">${ICON.gear}</button>
  </div>
  <div class="week-card">
    <div class="week-stats">
      <div><b data-count="${thisWeek}">${thisWeek}</b><span>this week</span></div>
      <div><b data-count="${streak}" data-prefix="${streak ? '🔥 ' : ''}">${streak ? '🔥 ' + streak : '0'}</b><span>week streak</span></div>
      <div><b data-count="${state.workouts.length}">${state.workouts.length}</b><span>total</span></div>
    </div>
    <div class="week-days">${week}</div>
  </div>
  ${needsBackup ? `<div class="banner"><div>It's been a while since your last backup.</div><button data-act="export">Back up</button></div>` : ''}
  ${deloadBanner()}
  ${reviewCardHtml()}
  ${planWk ? todayPlanHtml(planWk) : pickHtml}
  ${planWk ? "" : planIntroHtml(true)}
  <button class="pick-card build-card" style="--c:${CUSTOM_SPLIT.color}" data-act="buildSheet">
    <span class="day-ico">${CUSTOM_SPLIT.icon}</span>
    <div class="pick-txt"><small>Custom</small><b>Build today's workout</b><span>Choose the volume, it picks the lifts${neglect[0] ? ` and covers ${esc(neglect[0].name.toLowerCase())}` : ''}.</span></div>
    <span class="go">${ICON.arrow}</span></button>
  ${attentionHtml(neglect.slice(0, 3))}
  <div class="section-title row-title"><span>${planWk || pick?.day ? 'Or pick any split' : 'Pick today’s split'}</span><button data-act="splitsSheet">Edit splits</button></div>
  <div class="days">
    ${splits.length ? '' : `<button class="btn ghost" data-act="splitEdit">+ Add your first split</button>`}
    ${splits.map(d => {
      const l = lastOf(d.id);
      const n = state.templates.filter(t => t.splitId === d.id).length;
      return `<button class="day-btn ${pick?.day?.id === d.id ? 'suggested' : ''}" style="--c:${d.color}" data-act="start" data-day="${d.id}">
        <span class="day-ico">${d.icon}</span>
        <div class="day-txt"><strong>${esc(d.name)}</strong>
          <span class="muscles">${d.muscles.map(m => MUSCLES[m]).join(' · ')}</span>
          <span class="when">${l ? `Last done ${relDays(l.date)}` : 'Not done yet'}${n ? ` · ${n} template${n > 1 ? 's' : ''}` : ''}</span></div>
        <span class="go">${ICON.arrow}</span></button>`;
    }).join('')}
  </div>`;
}

// Home card listing neglected regions, each with snooze and opt-out.
function attentionHtml(list) {
  if (!list.length) return '';
  return `<div class="card attn">
    <div class="attn-head">⚠️ Needs attention</div>
    ${list.map(n => `<div class="attn-row">
      <div class="attn-txt"><b>${esc(n.name)}</b><small>${esc(n.reason)}</small></div>
      <button data-act="snoozeRegion" data-r="${n.region}">Snooze</button>
      <button class="muted" data-act="ignoreRegion" data-r="${n.region}">Don't track</button>
    </div>`).join('')}
  </div>`;
}

// One gentle tip per workout: a neglected region this workout's split can
// train that no lift in the workout covers yet, with a one-tap add.
function workoutTipHtml(w, dt) {
  if (w.tipDismissed) return '';
  const covered = new Set();
  for (const e of w.exercises) for (const [r, wt] of Object.entries(exerciseRegions(exercise(e.exId)))) if (wt >= DIRECT) covered.add(r);
  const n = neglectList().find(x => !covered.has(x.region) && dt.muscles.includes(x.muscle));
  if (!n) return '';
  const ex = exerciseForRegion(n.region, usable(), usageCounts());
  if (!ex) return '';
  return `<div class="tip">
    <div>💡 <b>${esc(n.name)}</b>: ${esc(n.reason.charAt(0).toLowerCase() + n.reason.slice(1))}. Add ${esc(ex.name)}?</div>
    <div class="banner-btns"><button data-act="tipAdd" data-id="${ex.id}">Add</button><button class="muted" data-act="tipDismiss" aria-label="Dismiss tip">✕</button></div>
  </div>`;
}

function deloadBanner() {
  if (inDeload()) {
    const until = new Date(state.settings.deloadUntil).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    return `<div class="banner info"><div>🧘 <b>Deload week</b> until ${until}. Suggestions are about 15% lighter.</div><button data-act="endDeload">End</button></div>`;
  }
  const dismissed = state.settings.deloadDismissed && Date.now() - new Date(state.settings.deloadDismissed).getTime() < 14 * DAY;
  const advice = !dismissed && deloadAdvice(state.workouts, exercise, bodyweightOn);
  if (!advice) return '';
  const names = advice.stalled.slice(0, 3).map(id => exercise(id).name).join(', ');
  return `<div class="banner deload"><div>📉 <b>${advice.stalled.length} lifts have stalled</b> (${esc(names)}). A lighter week often gets you moving again.</div>
    <div class="banner-btns"><button data-act="startDeload">Start deload</button><button class="muted" data-act="dismissDeload">Not now</button></div></div>`;
}

function weekStats() {
  const weeks = new Set(state.workouts.map(w => weekKey(new Date(w.date).getTime())));
  let streak = 0;
  let wk = weekKey(Date.now());
  if (!weeks.has(wk)) wk -= 7 * DAY;
  while (weeks.has(wk)) { streak++; wk = weekKey(wk - 3 * DAY); }
  const thisWeek = state.workouts.filter(w => weekKey(new Date(w.date).getTime()) === weekKey(Date.now())).length;
  return { thisWeek, streak };
}

function viewHistory() {
  if (ui.historyId) {
    const w = state.workouts.find(x => x.id === ui.historyId);
    if (!w) { ui.historyId = null; return viewHistory(); }
    return `
    <div class="top"><button class="back-link" data-act="histBack">‹ History</button>
      <div class="row" style="flex:none;gap:8px">
        <button class="btn" style="width:auto;min-height:36px" data-act="shareWorkout" data-id="${w.id}">Share</button>
        <button class="btn danger" style="width:auto;min-height:36px" data-act="deleteWorkout">Delete</button>
      </div></div>
    <h1 style="font-size:24px">${esc(dayType(w.dayType)?.name)}</h1>
    <div class="muted" style="margin:4px 0 14px">${fmtDate(w.date)} · ${dispW(workoutVolume(w)).toLocaleString()} ${wu()} volume</div>
    ${w.exercises.map((_, i) => exCard(w, w.id, i, false)).join('')}
    <p class="muted small">Edits save automatically and update future suggestions.</p>`;
  }
  if (!state.workouts.length) return `<div class="top"><h1>History</h1></div><div class="empty">No workouts yet. Your saved workouts show up here.</div>`;
  const list = [...state.workouts].sort((a, b) => b.date.localeCompare(a.date));
  let month = '';
  return `<div class="top"><h1>History</h1></div>` + list.map(w => {
    const m = new Date(w.date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const head = m !== month ? `<div class="section-title">${m}</div>` : '';
    month = m;
    const sets = w.exercises.reduce((n, e) => n + workingSets(e).length, 0);
    const dt = dayType(w.dayType);
    return `${head}<button class="card hist" style="--c:${dt?.color}" data-act="openWorkout" data-id="${w.id}">
      <span class="day-ico sm">${dt?.icon || ''}</span>
      <div class="hist-txt">
        <div class="top-line"><strong>${esc(dt?.name)}${w.templateName ? ` <span class="tpl-tag">${esc(w.templateName)}</span>` : ''}</strong><span class="muted small">${fmtDate(w.date)}</span></div>
        <div class="ex-names">${w.exercises.length} exercises · ${sets} sets · ${esc(w.exercises.map(e => exercise(e.exId).name).join(', '))}</div>
      </div>
    </button>`;
  }).join('');
}

function weekKey(t) {
  const d = new Date(startOfDay(t));
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

// Chart time ranges: [id, label, days, phrase]
const RANGES = [
  ['1m', '1M', 31, 'in 1 month'], ['3m', '3M', 92, 'in 3 months'], ['6m', '6M', 183, 'in 6 months'],
  ['1y', '1Y', 366, 'in 1 year'], ['5y', '5Y', 1827, 'in 5 years'], ['all', 'All', Infinity, 'all time'],
];
const rangeOf = key => RANGES.find(r => r[0] === (ui.ranges[key] || 'all'));

function inRange(points, key) {
  const since = Date.now() - rangeOf(key)[2] * DAY;
  return points.filter(p => p.x >= since);
}

function rangeChips(key) {
  const cur = rangeOf(key)[0];
  return `<div class="range">${RANGES.map(([v, l]) => `<button data-act="range" data-k="${key}" data-v="${v}" class="${cur === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
}

// Chart for a filtered range, or a hint when there isn't enough data.
function rangedChart(points, total, opts, emptyMsg) {
  if (points.length > 1) return lineChart(points, opts);
  const msg = total > 1 ? 'Not enough entries in this range. Try a longer one.' : emptyMsg;
  return `<div class="empty" style="padding:24px">${msg}</div>`;
}

function subTabs(act, current, items) {
  return `<div class="seg subtabs">${items.map(([v, l]) => `<button data-act="${act}" data-v="${v}" class="${current === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
}

function viewProgress() {
  const sub = ui.progressView || 'overview';
  const head = `<div class="top"><h1>Progress</h1></div>${subTabs('progressView', sub, [['overview', 'Overview'], ['lifts', 'Lifts'], ['awards', 'Awards']])}`;
  if (sub === 'awards') return head + progressAwards();
  if (!state.workouts.length) return head + `<div class="empty">Log a few workouts and your progress will appear here.</div>`;
  return head + (sub === 'lifts' ? progressLifts() : progressOverview());
}

function progressOverview() {
  const { thisWeek, streak } = weekStats();

  // Calendar: last 16 weeks, Monday-first columns
  const days = new Set(state.workouts.map(w => startOfDay(new Date(w.date).getTime())));
  const start = weekKey(Date.now()) - 15 * 7 * DAY;
  const today = startOfDay(Date.now());
  let cal = '';
  for (let i = 0; i < 16 * 7; i++) {
    const t = startOfDay(start + i * DAY + 3600000);
    cal += t > today ? '<i style="visibility:hidden"></i>' : `<i class="${days.has(t) ? 'on' : ''} ${t === today ? 'today' : ''}"></i>`;
  }

  // Monthly recap
  const off = ui.recapOffset || 0;
  const m = new Date();
  m.setDate(1);
  m.setMonth(m.getMonth() + off);
  const r = monthRecap(state.workouts, exercise, bodyweightOn, m.getFullYear(), m.getMonth());
  const volDelta = r.prevVolume ? Math.round(((r.volume - r.prevVolume) / r.prevVolume) * 100) : null;
  const fav = r.favorite && dayType(r.favorite);
  const recap = `
  <div class="card recap">
    <div class="recap-head">
      <button data-act="recapNav" data-d="-1" aria-label="Previous month">‹</button>
      <b>${m.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</b>
      <button data-act="recapNav" data-d="1" aria-label="Next month" ${off >= 0 ? 'disabled' : ''}>›</button>
    </div>
    ${r.workouts ? `
    <div class="recap-grid">
      <div><b>${r.workouts}</b><span>workouts</span></div>
      <div><b>${r.sets}</b><span>sets</span></div>
      <div><b>${fmtK(toDisplay(r.volume, U()))}</b><span>${wu()} moved${volDelta != null ? ` <em class="${volDelta >= 0 ? 'up' : 'down'}">${volDelta >= 0 ? '+' : ''}${volDelta}%</em>` : ''}</span></div>
      <div><b>${r.prSets}</b><span>PR sets</span></div>
    </div>
    ${r.improved ? `<div class="recap-line">📈 Most improved: <b>${esc(exercise(r.improved.exId).name)}</b> +${(r.improved.gain * 100).toFixed(1)}% <span class="muted">(${dispW(r.improved.from)} → ${dispW(r.improved.to)} ${wu()} e1RM)</span></div>` : ''}
    ${fav ? `<div class="recap-line">${fav.icon} Favorite split: <b>${esc(fav.name)}</b></div>` : ''}
    ${barelyTrained(m, r.workouts)}`
    : `<p class="muted small" style="margin:6px 0 0">No workouts this month.</p>`}
  </div>`;

  // Weekly set targets
  const sets = muscleSets(state.workouts, exercise, new Date(Date.now() - 7 * DAY).toISOString());
  const target = state.settings.weeklyTarget;
  const behind = Object.entries(MUSCLES).filter(([k]) => (sets[k] || 0) < target / 2).map(([, n]) => n);
  const neglect = neglectList();

  return `
  <div class="stats">
    <div class="stat"><b data-count="${thisWeek}">${thisWeek}</b><span>this week</span></div>
    <div class="stat"><b data-count="${streak}">${streak}</b><span>week streak</span></div>
    <div class="stat"><b data-count="${state.workouts.length}">${state.workouts.length}</b><span>workouts</span></div>
  </div>
  <div class="card"><div class="cal">${cal}</div></div>

  <div class="section-title">Monthly recap</div>
  ${recap}

  ${neglect.length ? `<div class="section-title">Needs attention</div>${attentionHtml(neglect.slice(0, 5))}` : ''}

  <div class="section-title">Weekly sets · last 7 days</div>
  <div class="card mm-card">
    ${muscleMap(sets)}
    <div class="tbars">${regionRows(sets, target, neglect)}</div>
    <p class="muted small" style="margin:10px 0 0">Tap a muscle to see its parts. Goal: ${target} sets per muscle a week (change in Settings).${behind.length ? ` Behind: ${behind.join(', ')}.` : ' Every muscle is on track 💪'}</p>
  </div>`;
}

// Recap line: tracked regions that got under one set's worth of work all month.
function barelyTrained(monthStart, workoutCount) {
  if (workoutCount < 4) return '';
  const start = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1).toISOString();
  const end = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1).toISOString();
  const r = regionSets(state.workouts, exercise, start, end);
  const ignored = new Set(state.settings.ignoredRegions);
  const low = Object.keys(REGIONS).filter(x => !ignored.has(x) && (r[x] || 0) < 1).map(x => REGIONS[x].name);
  return low.length ? `<div class="recap-line">🔍 Barely trained: <b>${esc(low.slice(0, 3).join(', '))}</b>${low.length > 3 ? ` +${low.length - 3} more` : ''}</div>` : '';
}

// Muscle bars that open into their regions: effective sets this week vs the
// region's share of the target, and when it last got direct work.
function regionRows(sets, target, neglect) {
  const weekAgo = new Date(Date.now() - 7 * DAY).toISOString();
  const rSets = regionSets(state.workouts, exercise, weekAgo);
  const rTargets = regionTargets(target);
  const last = regionLastDirect(state.workouts, exercise);
  const flagged = new Set(neglect.map(n => n.region));
  const ignored = new Set(state.settings.ignoredRegions);
  const fmt1 = v => String(Math.round(v * 10) / 10);
  return Object.entries(MUSCLES).map(([m, name]) => {
    const n = sets[m] || 0;
    const rs = regionsOf(m).filter(r => !ignored.has(r));
    const flag = rs.some(r => flagged.has(r));
    return `<details class="mrow">
      <summary class="tbar ${n >= target ? 'hit' : n === 0 ? 'zero' : ''}"><span>${name}${flag ? '<em class="flag-dot">!</em>' : ''}</span><div><i style="width:${Math.min(1, n / target) * 100}%"></i></div><b>${n}/${target}</b></summary>
      <div class="rbars">${rs.map(r => {
        const v = rSets[r] || 0;
        const t = rTargets[r];
        const d = last[r] ? Math.floor((Date.now() - last[r]) / DAY) : null;
        const when = d == null ? 'No direct work yet' : d === 0 ? 'Direct work today' : `Last direct work ${d} day${d > 1 ? 's' : ''} ago`;
        return `<div class="rbar ${flagged.has(r) ? 'flag' : ''}"><span>${REGIONS[r].name}</span><div><i style="width:${Math.min(1, v / t) * 100}%"></i></div><b>${fmt1(v)}/${Math.round(t)}</b><small>${when}</small></div>`;
      }).join('') || '<p class="muted small">All parts of this muscle are hidden (Settings → Tracked areas).</p>'}</div>
    </details>`;
  }).join('');
}

function progressLifts() {
  // Exercises with history, most recent first
  const seen = new Map();
  const byDate = [...state.workouts].sort((a, b) => b.date.localeCompare(a.date));
  for (const w of byDate) for (const e of w.exercises) if (!seen.has(e.exId)) seen.set(e.exId, w.date);
  const exIds = [...seen.keys()];
  if (!ui.progressEx || !seen.has(ui.progressEx)) ui.progressEx = exIds[0];
  const ex = exercise(ui.progressEx);
  const hist = historyFor(ui.progressEx).filter(h => workingSets(h).length);
  const metricFn = {
    e1rm: h => sessionE1RM(h, ex, bodyweightOn(h.date)),
    top: h => Math.max(...workingSets(h).map(s => loadOf(ex, s.weight, h.date))),
    volume: h => sessionVolume(ex, workingSets(h), h.date),
  }[ui.progressMetric];
  const allPoints = hist.map(h => ({ x: new Date(h.date).getTime(), y: toDisplay(metricFn(h), U()), info: setsSummary(ex, h.sets) })).filter(p => p.y > 0);
  // Flag PRs over the full history so a short range doesn't invent new "bests".
  let best = -Infinity;
  allPoints.forEach((p, i) => { p.pr = i > 0 && p.y > best + 0.01; best = Math.max(best, p.y); });
  const points = inRange(allPoints, 'lift');
  ui.chartPoints = points;
  const lastY = allPoints.at(-1)?.y ?? 0;
  const firstY = points[0]?.y ?? 0;
  const delta = firstY && points.length > 1 ? ((points.at(-1).y - firstY) / firstY) * 100 : 0;
  const metricName = { e1rm: 'Est. 1-rep max', top: 'Top set weight', volume: 'Session volume' }[ui.progressMetric];

  // PRs
  const prs = exIds.map(id => {
    const x = exercise(id);
    const hs = historyFor(id).filter(h => workingSets(h).length);
    const best = Math.max(0, ...hs.map(h => sessionE1RM(h, x, bodyweightOn(h.date))));
    let heavy = null;
    for (const h of hs) for (const s of workingSets(h)) if (!heavy || s.weight > heavy.weight || (s.weight === heavy.weight && s.reps > heavy.reps)) heavy = s;
    return { x, best, heavy };
  }).filter(p => p.heavy);

  // Strength levels
  const std = state.settings.standards;
  const bw = bodyweightOn();
  const levels = strengthLevels(state.workouts, exercise, bw, std);
  const strength = !std
    ? `<p class="muted small" style="margin-top:0">Compare your lifts to common strength standards. Pick a set:</p>
       <div class="chips"><button data-act="setStandards" data-v="male">Men's standards</button><button data-act="setStandards" data-v="female">Women's standards</button></div>`
    : !bw
      ? `<p class="muted small" style="margin:0">Log your bodyweight in the Health tab to see strength levels.</p>`
      : levels.length
        ? levels.map(l => `
          <div class="lvl">
            <div class="lvl-top"><b>${esc(l.name)}</b><span class="lvl-badge l${l.levelIdx}">${l.level}</span></div>
            <div class="lvl-bar"><i style="width:${l.pct * 100}%"></i></div>
            <div class="muted small">${dispW(l.e1rm)} ${wu()} e1RM · ${l.ratio.toFixed(2)}× bodyweight${l.next ? ` · ${dispW(l.next.lb)} ${wu()} to ${l.next.level}` : ' · top level!'}</div>
          </div>`).join('') + `<p class="muted small" style="margin:8px 0 0">Rough guide only. Change standards in Settings.</p>`
        : `<p class="muted small" style="margin:0">Log bench press, back squat, deadlift or overhead press to see where you stand.</p>`;

  return `
  <select class="ex-select" data-field="progressEx">
    ${exIds.map(id => `<option value="${id}" ${id === ui.progressEx ? 'selected' : ''}>${esc(exercise(id).name)}</option>`).join('')}
  </select>
  <div class="seg" style="margin-bottom:10px">
    ${[['e1rm', 'Strength'], ['top', 'Top set'], ['volume', 'Volume']].map(([v, l]) => `<button data-act="metric" data-v="${v}" class="${ui.progressMetric === v ? 'on' : ''}">${l}</button>`).join('')}
  </div>
  <div class="chart-wrap">
    <div class="chart-head"><div><div class="muted small">${metricName}</div><b>${dispW(lastY).toLocaleString()} ${wu()}</b></div>
      ${points.length > 1 ? `<span class="delta ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(1)}% ${rangeOf('lift')[3]}</span>` : ''}</div>
    ${allPoints.length > 1 ? rangeChips('lift') : ''}
    ${rangedChart(points, allPoints.length, { prs: ui.progressMetric !== 'volume', trend: true }, 'Log this lift again to see a trend.')}
    ${points.length > 1 ? `<div class="chart-info" id="chartInfo">Tap a point to see that session. ★ = new best${points.length >= 3 ? ' · dotted line = trend' : ''}</div>` : ''}
  </div>

  <div class="section-title">Strength level</div>
  <div class="card">${strength}</div>

  <div class="section-title">Fatigue profile</div>
  <div class="card">${fatigueProfile()}</div>

  <div class="section-title">Personal records</div>
  <div class="card pr-list">
    ${prs.map(p => `<div class="pr"><span>${esc(p.x.name)}</span><span class="muted">${esc(weightLabel(p.x, p.heavy.weight))} × ${p.heavy.reps}${p.best ? ` · <b>${dispW(p.best)}</b> e1RM` : ''}</span></div>`).join('')}
  </div>`;
}

// What the app has learned about how fast this lifter tires within a workout.
function fatigueProfile() {
  const p = personalRate();
  // Drop after a big block of related work (about 16 sets of helper-muscle work).
  const drop = r => Math.round((1 - fatigueFactor(10, r)) * 100);
  const yours = drop(p.rate);
  const avg = drop(DEFAULT_FATIGUE_RATE);
  if (!p.lifts) {
    return `<p class="muted small" style="margin:0">Still learning. Do lifts at different points in your workouts (early one day, later another) and the app works out how fast you tire. Until then it assumes an average rate (about −${avg}% after a big block of related sets).</p>`;
  }
  const ratio = p.rate / DEFAULT_FATIGUE_RATE;
  const label = ratio < 0.8 ? 'You hold strength well when tired 💪' : ratio > 1.2 ? 'You tire faster than average' : 'About average';
  return `
    <div class="lvl-top"><b>${label}</b><span class="lvl-badge l3">−${yours}%</span></div>
    <div class="fp-bars">
      <div><span>You</span><div><i style="width:${Math.min(100, yours * 3)}%"></i></div><b>−${yours}%</b></div>
      <div class="avg"><span>Average</span><div><i style="width:${Math.min(100, avg * 3)}%"></i></div><b>−${avg}%</b></div>
    </div>
    <p class="muted small" style="margin:8px 0 0">Strength lost after a big block of related sets. Learned from ${p.lifts} lift${p.lifts > 1 ? 's' : ''} (${p.sessions} sessions). New lifts start from your number.</p>`;
}

function progressAwards() {
  const list = achievements(state.workouts, exercise, bodyweightOn, U());
  const earned = list.filter(a => a.earned);
  const shortDate = iso => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const tile = a => `
    <div class="award ${a.earned ? 'on' : ''}">
      <div class="aw-ico">${a.icon}</div>
      <b>${esc(a.name)}</b>
      <small>${esc(a.desc)}</small>
      ${a.earned
        ? `<small class="aw-date">${state.achievements[a.id] ? shortDate(state.achievements[a.id]) : 'Unlocked'}</small>`
        : `<div class="aw-bar"><i style="width:${a.progress * 100}%"></i></div>`}
    </div>`;
  // Unlocked first, then closest to unlocking.
  const sorted = [...earned, ...list.filter(a => !a.earned).sort((a, b) => b.progress - a.progress)];
  return `
  <div class="awards-head"><b data-count="${earned.length}">${earned.length}</b><span>of ${list.length} achievements unlocked</span></div>
  <div class="awards">${sorted.map(tile).join('')}</div>`;
}

const MEASURES = {
  waist: ['Waist', 'in'], chest: ['Chest', 'in'], arms: ['Arms', 'in'], thighs: ['Thighs', 'in'],
  hips: ['Hips', 'in'], neck: ['Neck', 'in'], calves: ['Calves', 'in'], bodyfat: ['Body fat', '%'],
};

function viewHealth() {
  const sub = ui.healthView || 'weight';
  const head = `<div class="top"><h1>Health</h1></div>${subTabs('healthView', sub, [['weight', 'Weight'], ['body', 'Body'], ['photos', 'Photos']])}`;
  if (sub === 'body') return head + healthBody();
  if (sub === 'photos') return head + healthPhotos();
  return head + healthWeight();
}

function healthWeight() {
  const entries = [...state.bodyweight].sort((a, b) => a.date.localeCompare(b.date));
  const allPoints = entries.map(b => ({ x: new Date(b.date + 'T12:00:00').getTime(), y: toDisplay(b.lb, U()), info: '' }));
  const points = inRange(allPoints, 'bw');
  const cur = entries.at(-1);
  const change = points.length > 1 ? points.at(-1).y - points[0].y : null;
  return `
  <div class="card">
    <div class="row" style="align-items:flex-end">
      <label class="field" style="margin:0"><span>Bodyweight (${wu()})</span><input id="bwInput" inputmode="decimal" placeholder="${cur ? fmtW(cur.lb) : isKg(U()) ? 'e.g. 80' : 'e.g. 180'}"></label>
      <label class="field" style="margin:0"><span>Date</span><input id="bwDate" type="date" value="${todayStr()}" max="${todayStr()}"></label>
    </div>
    <button class="btn primary" style="margin-top:12px" data-act="saveBW">Save weight</button>
  </div>
  ${cur ? `
  <div class="chart-wrap">
    <div class="chart-head"><div><div class="muted small">Bodyweight</div><b>${fmtW(cur.lb)} ${wu()}</b></div>
      ${change != null ? `<span class="delta muted">${change >= 0 ? '+' : ''}${fmtNum(change)} ${wu()} ${rangeOf('bw')[3]}</span>` : ''}</div>
    ${allPoints.length > 1 ? rangeChips('bw') : ''}
    ${rangedChart(points, allPoints.length, { trend: points.length >= 3 }, 'Log again on another day to see a trend.')}
  </div>` : `<p class="muted small">Your bodyweight is also used for strength levels and for pull-ups, dips and other bodyweight lifts.</p>`}
  <div class="card import-card">
    <span class="imp-ico">❤️</span>
    <div><b>Import from Apple Health</b><p class="muted small">Bring in your past bodyweight, body fat and waist readings.</p></div>
    <button class="btn" style="width:auto" data-act="healthImportSheet">Import</button>
  </div>
  ${cur ? `
  <div class="section-title">Entries</div>
  <div class="card">
    ${[...entries].reverse().slice(0, 60).map(b => `<div class="set-line"><span>${new Date(b.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
      <span>${fmtW(b.lb)} ${wu()} <button class="muted" style="margin-left:12px" data-act="delBW" data-id="${b.id}" aria-label="Delete entry">✕</button></span></div>`).join('')}
  </div>` : ''}`;
}

function healthBody() {
  const byKind = {};
  for (const m of [...state.measurements].sort((a, b) => a.date.localeCompare(b.date))) (byKind[m.kind] ||= []).push(m);
  const kinds = Object.keys(MEASURES).filter(k => byKind[k]);
  if (!ui.measureKind || !byKind[ui.measureKind]) ui.measureKind = kinds[0];
  const sel = byKind[ui.measureKind] || [];
  const [selName] = MEASURES[ui.measureKind] || [];
  const selUnit = measureUnit(ui.measureKind);
  const allPoints = sel.map(m => ({ x: new Date(m.date + 'T12:00:00').getTime(), y: ui.measureKind === 'bodyfat' ? m.value : toLength(m.value, U()), info: '' }));
  const points = inRange(allPoints, 'measure');
  const mChange = points.length > 1 ? points.at(-1).y - points[0].y : null;
  return `
  <div class="card">
    <div class="row" style="align-items:flex-end">
      <label class="field" style="margin:0"><span>Measurement</span>
        <select id="mKind">${Object.entries(MEASURES).map(([k, [n]]) => `<option value="${k}" ${k === ui.measureKind ? 'selected' : ''}>${n} (${measureUnit(k)})</option>`).join('')}</select></label>
      <label class="field" style="margin:0"><span>Value</span><input id="mValue" inputmode="decimal" placeholder="e.g. 32.5"></label>
    </div>
    <label class="field" style="margin:12px 0 0"><span>Date</span><input id="mDate" type="date" value="${todayStr()}" max="${todayStr()}"></label>
    <button class="btn primary" style="margin-top:12px" data-act="saveMeasure">Save measurement</button>
  </div>
  ${kinds.length ? `
  <div class="measure-grid">
    ${kinds.map(k => {
      const list = byKind[k];
      const [n] = MEASURES[k];
      const u = measureUnit(k);
      const d = list.length > 1 ? list.at(-1).value - list[0].value : null;
      return `<button class="measure ${k === ui.measureKind ? 'on' : ''}" data-act="measureKind" data-v="${k}">
        <span>${n}</span><b>${fmtM(list.at(-1).value, k)}<small>${u}</small></b>
        ${d != null ? `<em>${d >= 0 ? '+' : ''}${fmtM(d, k)} ${u}</em>` : '<em>&nbsp;</em>'}</button>`;
    }).join('')}
  </div>
  <div class="chart-wrap">
    <div class="chart-head"><div><div class="muted small">${selName}</div><b>${fmtM(sel.at(-1).value, ui.measureKind)} ${selUnit}</b></div>
      ${mChange != null ? `<span class="delta muted">${mChange >= 0 ? '+' : ''}${fmtM(mChange, ui.measureKind)} ${selUnit} ${rangeOf('measure')[3]}</span>` : ''}</div>
    ${allPoints.length > 1 ? rangeChips('measure') : ''}
    ${rangedChart(points, allPoints.length, { trend: points.length >= 3 }, `Log ${selName.toLowerCase()} again to see a trend.`)}
  </div>
  <div class="card">
    ${[...sel].reverse().map(m => `<div class="set-line"><span>${new Date(m.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
      <span>${fmtM(m.value, ui.measureKind)} ${selUnit} <button class="muted" style="margin-left:12px" data-act="delMeasure" data-id="${m.id}" aria-label="Delete entry">✕</button></span></div>`).join('')}
  </div>` : `<p class="muted small">Track waist, arms, chest and more. Measure at the same time of day for the clearest trend.</p>`}`;
}

function healthPhotos() {
  return `
  <div class="card">
    <div class="row" style="align-items:flex-end">
      <label class="field" style="margin:0"><span>Photo date</span><input id="photoDate" type="date" value="${todayStr()}" max="${todayStr()}"></label>
      <label class="btn primary">📷 Add photo<input type="file" id="photoInput" accept="image/*" hidden></label>
    </div>
    <p class="muted small" style="margin:10px 0 0">Photos stay on this phone only and aren't part of backups. Tap one to view, then Compare to see two side by side.</p>
  </div>
  ${ui.compareFrom ? `<div class="banner info"><div>Tap another photo to compare.</div><button data-act="cancelCompare">Cancel</button></div>` : ''}
  <div id="photoGrid" class="photo-grid"><div class="muted small">Loading…</div></div>`;
}

// Photos come from IndexedDB, so the grid fills in after render.
let photoUrls = [];
async function loadPhotoGrid() {
  const grid = $('#photoGrid');
  if (!grid) return;
  photoUrls.forEach(u => URL.revokeObjectURL(u));
  photoUrls = [];
  let list = [];
  try { list = await listPhotos(); } catch { grid.innerHTML = '<div class="muted small">Photos aren’t available in this browser.</div>'; return; }
  if (!list.length) { grid.innerHTML = '<div class="empty">No photos yet. Take one every few weeks in the same spot and lighting.</div>'; return; }
  const items = await Promise.all(list.map(async p => {
    const blob = await photoBlob(p.id);
    const url = URL.createObjectURL(blob);
    photoUrls.push(url);
    return `<button class="ph ${ui.compareFrom?.id === p.id ? 'sel' : ''}" data-act="openPhoto" data-id="${p.id}" data-date="${p.date}"><img src="${url}" alt=""><span>${new Date(p.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></button>`;
  }));
  if ($('#photoGrid') === grid) grid.innerHTML = items.join('');
}

function renderTabs() {
  const tabs = [['workout', 'Workout'], ['plan', 'Plan'], ['history', 'History'], ['progress', 'Progress'], ['health', 'Health']];
  $('#tabs').innerHTML = tabs.map(([id, l]) => `<button data-act="tab" data-tab="${id}" class="${ui.tab === id ? 'on' : ''}">${ICON[id]}${l}</button>`).join('');
}

// animate: play the entrance animation (tab switches, starting/finishing).
function render(animate = false) {
  const views = { workout: viewWorkout, plan: viewPlan, history: viewHistory, progress: viewProgress, health: viewHealth };
  const view = $('#view');
  rateCache = null; // history edits can change what's been learned
  keepPlanCurrent();
  view.innerHTML = views[ui.tab]();
  if (animate) {
    const items = view.querySelectorAll(':scope > *, .active > *, .days > *');
    items.forEach((n, i) => n.style.setProperty('--i', Math.min(i, 12)));
    view.classList.remove('enter');
    void view.offsetWidth;
    view.classList.add('enter');
    countUp(view);
  }
  // Plan tab: the day list opens at today.
  const sc = ui.tab === 'plan' && $('#planScroll');
  const todayRow = sc && sc.querySelector('.plan-day.today');
  if (todayRow) sc.scrollTop = todayRow.offsetTop - sc.querySelector('.plan-day').offsetTop;
  renderTabs();
  renderSheet();
  tick();
  if (ui.tab === 'health' && ui.healthView === 'photos') loadPhotoGrid();
}

// ---------- Weekly plan ----------
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const LEVEL_INFO = {
  beginner: ['Beginner', 'Under a year of steady lifting'],
  intermediate: ['Intermediate', '1–3 years of steady lifting'],
  advanced: ['Advanced', '3+ years, progress comes slowly'],
};
const GOAL_INFO = {
  muscle: ['Build muscle', '6–12 reps on everything'],
  strength: ['Get stronger', 'Main lifts 3–6 reps, the rest 6–12'],
};
const blocked = () => blockedLifts(state.settings, state.plan);
const usable = () => { const b = new Set(blocked()); return allExercises().filter(e => !b.has(e.id)); };
const pace = () => paceFromHistory(state.workouts, state.settings.defaultRest);
const planCtx = () => ({ exercises: allExercises(), lookup: exercise, blocked: blocked(), usage: usageCounts() });
const todayIdx = () => (new Date().getDay() + 6) % 7;

// Ended pauses, long breaks, spent edits. Saves only when something changed.
function keepPlanCurrent() {
  if (!state.plan) return;
  const r = maintainPlan(state.plan, state.workouts, Date.now(), exercise);
  if (!r.changed) return;
  state.plan = r.plan;
  save();
  if (r.events.includes('eased')) setTimeout(() => toast('Welcome back — this week is a little lighter'), 300);
  else if (r.events.includes('resumed')) setTimeout(() => toast('Plan resumed'), 300);
}

const planWeekNow = () => (state.plan ? currentWeek(state.plan, state.workouts, exercise, Date.now(), pace()) : null);
const planDayBySeq = (week, seq) => week?.days.find(d => d.kind === 'train' && d.session.seq === seq) || null;
// This week plus a projection up to 6 days past today.
const planUpcoming = () => upcomingDays(state.plan, state.workouts, exercise, Date.now(), pace());
const sessionMuscles = s => [...new Set(s.items.map(i => i.muscle))].map(m => MUSCLES[m]).join(' · ');

// Home: today's planned workout leads.
function todayPlanHtml(week) {
  const plan = state.plan;
  if (isPaused(plan)) {
    return `<div class="pick-card rest"><span class="day-ico">⏸️</span><div class="pick-txt"><small>Plan paused</small><b>Until ${fmtDate(plan.pausedUntil)}</b><span>Train whenever you like, nothing is scheduled.</span></div></div>`;
  }
  const today = todayOf(week);
  if (today.kind === 'train') {
    const s = today.session;
    const dt = PLAN_DAYS[s.type];
    return `<button class="pick-card" style="--c:${dt.color}" data-act="planStart" data-seq="${s.seq}">
      <span class="day-ico">${dt.icon}</span>
      <div class="pick-txt"><small>Today's plan</small><b>${esc(s.name)}</b><span>${s.items.length} exercises · ≈ ${s.estMinutes} min · ${esc(sessionMuscles(s))}</span></div>
      <span class="go">${ICON.arrow}</span></button>`;
  }
  const next = nextTraining(week) || planUpcoming().days.find(d => d.week === 1 && d.kind === 'train');
  const nextTxt = next ? `Next: ${esc(next.session.name)} on ${next.week ? 'next ' : ''}${WEEKDAYS[next.weekday]}.` : 'Next week starts Monday.';
  const head = today.kind === 'done' ? ['✅', 'Done for today', 'Nice work. ' + nextTxt]
    : today.kind === 'activity' ? ['🏃', esc(today.activity.name), nextTxt]
      : ['😴', 'Rest day', nextTxt];
  return `<div class="pick-card rest"><span class="day-ico">${head[0]}</span><div class="pick-txt"><small>Today</small><b>${head[1]}</b><span>${head[2]}</span></div>
    ${next && !next.week && today.kind !== 'done' ? `<button class="mini-btn" data-act="planStart" data-seq="${next.session.seq}">Do it today</button>` : ''}</div>`;
}

function reviewCardHtml() {
  if (!state.plan || !reviewDue(state.plan)) return '';
  return `<div class="card review-card"><div><b>🏁 Block ${state.plan.blockNo || 1} complete</b>
    <small>See how each muscle progressed and approve next block's changes.</small></div>
    <div class="banner-btns"><button data-act="reviewSheet">Review</button></div></div>`;
}

function planIntroHtml(compact) {
  if (compact) {
    return `<button class="pick-card plan-cta" data-act="planSetup">
      <span class="day-ico">🗓️</span>
      <div class="pick-txt"><small>New</small><b>Get a weekly plan</b><span>Pick your days, it plans every session and adapts as you go.</span></div>
      <span class="go">${ICON.arrow}</span></button>`;
  }
  return `<div class="card plan-intro">
    <div class="big-ico">🗓️</div>
    <h3>A plan that adapts to you</h3>
    <p class="muted">Tell it which days you train and for how long. It picks a split, spreads each muscle's weekly sets across your days, keeps your main lifts steady for a 4–6 week block, and adjusts volume per muscle from how you actually progress.</p>
    <div class="stack"><button class="btn primary" data-act="planSetup">Set up my plan</button>
    <button class="btn ghost" data-act="whySheet">Why this works</button></div>
  </div>`;
}

function viewPlan() {
  const plan = state.plan;
  if (!plan) {
    return `<div class="top"><div><div class="eyebrow">Weekly plan</div><h1>Your plan</h1></div>
      <button class="icon-btn" data-act="settings" aria-label="Settings">${ICON.gear}</button></div>${planIntroHtml(false)}`;
  }
  const split = splitById(plan.splitId);
  const up = planUpcoming();
  const week = up.thisWeek;
  const paused = isPaused(plan);
  const bw = Math.min(blockWeek(plan) + 1, plan.blockWeeks || 5);
  const tIdx = todayIdx();
  const rows = up.days.map((d, i) => {
    const date = new Date(d.date + 'T12:00:00');
    const when = `<div class="pd-date"><b>${WEEKDAYS[d.weekday]}</b><small>${date.getDate()}</small></div>`;
    const act = d.activity && d.kind !== 'activity' ? ` · ${esc(d.activity.name)}` : '';
    let body, attrs = '', color = '#8b93a1';
    if (d.kind === 'train') {
      const s = d.session;
      color = PLAN_DAYS[s.type].color;
      body = `<b>${esc(s.name)}</b><small>${s.items.length} exercises · ≈ ${s.estMinutes} min${act}</small>`;
      attrs = `data-act="planSession" data-seq="${s.seq}"`;
    } else if (d.kind === 'done') {
      const w = state.workouts.find(x => x.id === d.workoutId);
      const name = w?.templateName || (w && dayType(w.dayType).name) || 'Workout';
      color = d.session ? PLAN_DAYS[d.session.type].color : dayType(w?.dayType).color;
      body = `<b>✓ ${esc(name)}</b><small>Done${act}</small>`;
      attrs = `data-act="openWorkoutFromPlan" data-id="${d.workoutId}"`;
    } else if (d.kind === 'missed') {
      body = `<b>Missed</b><small>Its session moves to your next day${act}</small>`;
    } else if (d.kind === 'activity') {
      body = `<b>${esc(d.activity.name)}</b><small>${d.activity.legs ? 'Hard on legs' : 'Other activity'}</small>`;
    } else if (d.kind === 'before') {
      body = `<b>—</b><small>${plan.activeFrom ? 'Plan was paused' : 'Before your plan started'}</small>`;
    } else if (d.kind === 'paused') {
      body = `<b>Paused</b><small>&nbsp;</small>`;
    } else {
      body = `<b>Rest</b><small>${act ? act.slice(3) : 'Recover'}</small>`;
    }
    const tag = attrs ? 'button' : 'div';
    const divider = d.week === 1 && up.days[i - 1]?.week === 0 ? `<div class="pd-divider">Next week · planned ahead</div>` : '';
    const isToday = d.week === 0 && d.weekday === tIdx;
    return `${divider}<${tag} class="plan-day ${d.kind} ${isToday ? 'today' : ''} ${d.week ? 'ahead' : ''}" style="--c:${color}" ${attrs}>${when}<div class="pd-body">${body}</div>${attrs ? `<span class="pd-go">›</span>` : ''}</${tag}>`;
  }).join('');
  // Weekly sets per muscle: planned target vs done so far.
  // This calendar week: done so far (any workout) + still planned, vs the usual goal.
  const wv = weekVolume(week, state.workouts, exercise);
  const pct = (v, g) => Math.min(100, (v / g) * 100);
  const vol = Object.entries(wv).filter(([, v]) => v.goal > 0)
    .map(([m, v]) => `<div class="vol-row"><span>${MUSCLES[m]}</span>
      <div class="vol-bar"><i style="width:${pct(v.done, v.goal)}%"></i><i class="planned" style="width:${Math.max(0, Math.min(100 - pct(v.done, v.goal), pct(v.planned, v.goal)))}%"></i></div>
      <small>${v.done + v.planned}/${v.goal}</small><em>${v.done} done · ${v.planned} planned</em></div>`).join('');
  const partial = week.notes.some(n => /mid-week/.test(n));
  return `
  <div class="top"><div><div class="eyebrow">Block ${plan.blockNo || 1} · week ${bw} of ${plan.blockWeeks || 5}</div><h1 class="plan-title">${esc(split.name)}</h1></div>
    <button class="icon-btn" data-act="settings" aria-label="Settings">${ICON.gear}</button></div>
  ${paused ? `<div class="banner info"><div>⏸️ <b>Paused</b> until ${fmtDate(plan.pausedUntil)}.</div><button data-act="planResume">Resume</button></div>` : ''}
  ${reviewCardHtml()}
  ${tIdx ? `<p class="pd-hint">Today and the 6 days after it. Scroll up for earlier days.</p>` : ''}
  <div class="plan-week scroller" id="planScroll">${rows}</div>
  ${week.notes.length ? `<div class="plan-notes">${week.notes.map(n => `<p>ℹ️ ${esc(n)}</p>`).join('')}</div>` : ''}
  ${vol ? `<details class="card vol-card"><summary>Sets per muscle this week</summary>
    <p class="muted small">Mon–Sun. Solid = done in any workout, light = still planned, out of your usual weekly goal.${partial ? ' Your plan started mid-week, so this week ends below the goal.' : ''}</p>${vol}
    <p class="muted small">Small muscles also count half of the sets they get from bigger lifts (triceps from presses, for example).</p></details>` : ''}
  <div class="plan-actions">
    <button class="btn" data-act="planDaysSheet">📅 Change days this week</button>
    ${paused ? '' : `<button class="btn" data-act="planPauseSheet">⏸️ Pause plan</button>`}
    <button class="btn" data-act="planSetup">⚙️ Plan settings</button>
    <button class="btn ghost" data-act="whySheet">📚 Why this works</button>
  </div>`;
}

// Rep range shown for a planned item.
function itemZone(it) {
  const [lo, hi] = it.main ? STRENGTH_ZONE : zoneFor(exercise(it.exId));
  return `${lo}–${hi} reps`;
}

function startPlanned(seq, readiness) {
  const week = planWeekNow();
  const day = planDayBySeq(week, seq);
  if (!day) { toast('That session is no longer planned'); render(); return; }
  const s = day.session;
  startWorkout(`plan_${s.type}`, { exercises: sessionEntries(s) }, null, s.name, { plan: { id: state.plan.id, seq } }, readiness);
}

// Edit a planned session (this week, or the slot for the rest of the block).
function applyPlanEdit(seq, i, action, to) {
  const scope = ui.sheet?.scope || 'week';
  const day = planDayBySeq(planUpcoming(), seq);
  const it = day?.session.items[i];
  if (!it) return;
  const r = editSession(state.plan, { seq, type: day.session.type, slot: day.session.slot, action, from: it.exId, to, scope }, planCtx());
  state.plan = r.plan;
  save();
  if (r.learned) toast(`Got it — ${exercise(r.learned).name} won't be planned anymore`);
  else toast(scope === 'block' ? 'Changed for the rest of the block' : 'Changed for this session');
  openSheet({ type: 'planSession', seq, scope });
  render();
}

// Count a mid-workout swap or removal in a planned workout, so the plan learns.
function learnFromWorkoutEdit(fromId, toId) {
  const w = state.activeWorkout;
  if (!w?.plan || !state.plan || w.plan.id !== state.plan.id) return;
  const action = toId ? 'swap' : 'remove';
  const type = w.dayType.slice(5);
  const r = editSession(state.plan, { seq: w.plan.seq, type, slot: 0, action, from: fromId, to: toId, scope: 'week' }, planCtx());
  state.plan = r.plan;
  if (r.learned) toast(`Got it — ${exercise(r.learned).name} won't be planned anymore`);
}

// Template workouts that keep skipping regions get swap offers (today only).
function swapOffersHtml(w) {
  if (!w.swapOffers?.length || w.exercises.some(e => e.sets.some(s => s.done))) return '';
  const live = w.swapOffers.filter(o => w.exercises.some(e => e.uid === o.uid && e.exId === o.from));
  if (!live.length) return '';
  return `<div class="card swap-offer">
    <div class="attn-head">💡 This template keeps missing a few areas</div>
    <p class="muted small">Swap for today only. Your template stays the same.</p>
    ${live.map(o => `<div class="attn-row"><div class="attn-txt"><b>${esc(exercise(o.from).name)} → ${esc(exercise(o.to).name)}</b><small>${esc(o.reason)}</small></div>
      <button data-act="offerAccept" data-uid="${o.uid}">Swap</button></div>`).join('')}
    <div class="banner-btns">${live.length > 1 ? `<button data-act="offerAll">Swap all</button>` : ''}<button class="muted" data-act="offerDismiss">No thanks</button></div>
  </div>`;
}

// Replace an unstarted entry of the active workout with another lift.
function replaceEntry(i, toId) {
  const w = state.activeWorkout;
  const old = w.exercises[i];
  const work = old.sets.find(s => !s.warmup)?.weight ?? old.suggestion?.weight;
  const entry = buildEntry(toId, { ex: exercise(old.exId), weight: work }, fatigueFor(toId, i), old.zone);
  if (old.group) entry.group = old.group;
  const keep = old.sets.filter(s => !s.warmup).length;
  if (keep > 0) resizeSets(entry, keep);
  w.exercises[i] = entry;
}

// Setup questionnaire defaults (or the current plan's answers).
function setupDraft() {
  const p = state.plan?.profile;
  return {
    step: 0,
    days: p ? [...p.days] : [0, 1, 3, 4],
    minutes: p?.minutes || 60,
    level: p?.level || (state.workouts.length > 60 ? 'intermediate' : 'beginner'),
    goal: p?.goal || 'muscle',
    equipment: p?.equipment || 'gym',
    priority: p ? [...(p.priority || [])] : [],
    avoid: p ? [...(p.avoid || [])] : [],
    activities: p ? (p.activities || []).map(a => ({ ...a })) : [],
    splitId: state.plan?.splitId || null,
  };
}
const setupProfile = d => ({
  days: [...d.days].sort((a, b) => a - b), minutes: d.minutes, level: d.level, goal: d.goal, equipment: d.equipment,
  priority: d.priority, avoid: d.avoid, activities: d.activities,
});

function setupHtml() {
  const d = ui.setup;
  const steps = ['Schedule', 'Experience', 'Focus', 'Activities', 'Split'];
  const dots = `<div class="setup-dots">${steps.map((n, i) => `<span class="${i === d.step ? 'on' : i < d.step ? 'done' : ''}">${n}</span>`).join('')}</div>`;
  const chip = (act, v, label, on) => `<button data-act="${act}" data-v="${v}" class="${on ? 'on' : ''}">${label}</button>`;
  const choice = (act, v, [title, sub], on) => `<button class="choice ${on ? 'on' : ''}" data-act="${act}" data-v="${v}"><b>${title}</b><small>${sub}</small></button>`;
  let body = '';
  if (d.step === 0) {
    body = `<div class="field"><span>Which days do you lift?</span>
        <div class="chips">${WEEKDAYS.map((n, i) => chip('suDay', i, n, d.days.includes(i))).join('')}</div></div>
      <p class="muted small">${d.days.length} day${d.days.length === 1 ? '' : 's'} a week. You can move days for a single week any time.</p>
      <div class="field"><span>How long per workout?</span>
        <div class="chips">${[30, 45, 60, 75, 90, 120].map(v => chip('suMin', v, `${v} min`, d.minutes === v)).join('')}</div></div>
      <p class="muted small">More time means more sets per muscle, up to the most that still pays off for your experience level. Past that, sessions end early rather than adding junk volume.</p>`;
  } else if (d.step === 1) {
    body = `<div class="field"><span>Experience</span><div class="choices">${Object.entries(LEVEL_INFO).map(([k, v]) => choice('suLevel', k, v, d.level === k)).join('')}</div></div>
      <div class="field"><span>Main goal</span><div class="choices">${Object.entries(GOAL_INFO).map(([k, v]) => choice('suGoal', k, v, d.goal === k)).join('')}</div></div>`;
  } else if (d.step === 2) {
    const byMuscle = Object.entries(MUSCLES).map(([m, n]) => `<optgroup label="${n}">${allExercises().filter(e => e.muscle === m && !d.avoid.includes(e.id)).map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}</optgroup>`).join('');
    body = `<div class="field"><span>Equipment you have</span><div class="choices">${Object.entries(EQUIPMENT_PROFILES).map(([k, v]) => choice('suEquip', k, [v.name, v.allows.map(a => EQUIPMENT[a].name).join(', ')], d.equipment === k)).join('')}</div></div>
      <div class="field"><span>Priority muscles (up to 2, optional) — they get extra sets and go first</span>
        <div class="chips">${Object.entries(MUSCLES).map(([m, n]) => chip('suPri', m, n, d.priority.includes(m))).join('')}</div></div>
      <div class="field"><span>Lifts to avoid (injuries, no machine, dislike)</span>
        ${d.avoid.length ? `<div class="chips">${d.avoid.map(id => `<button class="on" data-act="suAvoidDel" data-v="${id}">✕ ${esc(exercise(id).name)}</button>`).join('')}</div>` : ''}
        <div class="row"><select id="suAvoid"><option value="">Pick a lift…</option>${byMuscle}</select><button class="btn" style="flex:0 0 72px" data-act="suAvoidAdd">Add</button></div></div>`;
  } else if (d.step === 3) {
    body = `<p class="muted small">Sports, runs or classes. Hard leg days are kept away from leg-heavy ones.</p>
      ${d.activities.length ? `<div class="tpl-list">${d.activities.map((a, i) => `<div class="act-row"><b>${esc(a.name)}</b><small>${WEEKDAYS[a.day]}${a.legs ? ' · hard on legs' : ''}</small><button data-act="suActDel" data-i="${i}" aria-label="Remove">✕</button></div>`).join('')}</div>` : ''}
      <div class="field"><span>Activity</span><input id="suActName" placeholder="e.g. Soccer" autocomplete="off"></div>
      <div class="row"><label class="field"><span>Day</span><select id="suActDay">${WEEKDAYS.map((n, i) => `<option value="${i}">${n}</option>`).join('')}</select></label>
        <label class="field check-field"><span>Hard on legs</span><input type="checkbox" id="suActLegs"></label></div>
      <button class="btn" data-act="suActAdd">+ Add activity</button>`;
  } else {
    const recs = recommendSplits(setupProfile(d), { secPerSet: pace() });
    if (!d.splitId || !recs.find(r => r.id === d.splitId && r.fits)) d.splitId = recs.find(r => r.fits)?.id || null;
    body = `<p class="muted small">Ranked for ${d.days.length} days, ${d.minutes} min and your goal. Any of them works when weekly volume is equal; the top pick fits your schedule best.</p>
      <div class="choices">${recs.map((r, i) => {
        const sp = splitById(r.id);
        return `<button class="choice split-choice ${d.splitId === r.id ? 'on' : ''}" data-act="suSplit" data-v="${r.id}" ${r.fits ? '' : 'disabled'}>
          <b>${esc(sp.name)}${i === 0 && r.fits ? ' <em class="rec">Recommended</em>' : ''}</b>
          <small>${esc(sp.blurb)}</small>
          <ul>${r.reasons.map(x => `<li>${esc(x)}</li>`).join('')}</ul></button>`;
      }).join('')}</div>`;
  }
  const last = d.step === steps.length - 1;
  return `<h2>${state.plan ? 'Plan settings' : 'Set up your plan'}</h2>${dots}${body}
    <div class="row" style="margin-top:16px">
      ${d.step ? `<button class="btn" data-act="suBack">Back</button>` : ''}
      <button class="btn primary" data-act="${last ? 'suCreate' : 'suNext'}">${last ? (state.plan ? 'Start new plan' : 'Create my plan') : 'Next'}</button>
    </div>
    ${d.step === 0 ? `<button class="btn ghost" style="margin-top:10px" data-act="whySheet">Why this works</button>` : ''}`;
}

const WHY = [
  ['📊', 'Weekly sets per muscle drive growth', 'The number of hard sets each muscle gets per week is the strongest training predictor of muscle growth, with diminishing returns at higher volumes. Sets that train a muscle indirectly (triceps on bench press) count about half.', 'Pelland et al. 2024 (meta-regression, 67 studies); Schoenfeld, Ogborn & Krieger 2017'],
  ['⏳', 'Your time sets the volume, up to a point', 'More weekly sets build more muscle, but each extra set adds less. So the plan fills the time you give it, then stops at about 14 sets per muscle per week for beginners, 20 for intermediates and 24 for advanced lifters. Past that, extra sets mostly add fatigue.', 'Pelland et al. 2024; Baz-Valle et al. 2022'],
  ['✂️', 'Volume is spread across the week', 'Gains per session level off somewhere around 6–11 hard sets for one muscle, so the plan caps each muscle at 10 sets in a session and splits the rest over more days.', 'Remmert et al. (preprint, per-session volume); Schoenfeld et al. 2016'],
  ['🔁', 'Any split works if volume matches', 'With the same weekly sets, full body, upper/lower and push/pull/legs build muscle about equally. Training a muscle about twice a week mostly helps because it fits more good sets. That is why the plan ranks splits by your days and time, not by "best split".', 'Ramos-Campo et al. 2024; Schoenfeld, Grgic & Krieger 2019'],
  ['📌', 'Fixed main lifts, rotating accessories', 'Random exercise changes slow strength gains. Planned variation helps: main lifts stay the same for a 4–6 week block so progress is measurable, while accessories rotate between blocks to cover every part of a muscle.', 'Kassiano et al. 2022 (systematic review)'],
  ['🥇', 'Priorities go first', 'Exercises done early in a session improve the most, so priority muscles and big compound lifts come first.', 'Nunes et al. 2021'],
  ['⏱️', 'Supersets save time, not gains', 'Pairing unrelated or opposing muscles back to back cuts session time a lot with similar results, so the plan adds them when a session would run over your time limit.', 'Iversen et al. 2021; 2024'],
  ['🎯', 'Rep ranges by goal', 'Muscle grows across a wide rep range when sets are taken close to failure; 6–12 is efficient and easy to track. Strength is specific: heavy 3–6 rep sets on the main lifts build it best, and accessories stay at 6–12 for muscle.', 'Schoenfeld et al. 2017 (load meta-analysis); Lopez et al. 2021'],
  ['🧘', 'Deloads only when needed', 'A lighter week helps when performance drops, but scheduled deloads every few weeks can cost progress. The app suggests one only when your lifts stall or drop.', 'Coleman et al. 2024'],
  ['📈', 'Volume adapts per muscle', 'People respond differently. At the end of each block, muscles that stalled while recovering well get a bit more volume, muscles that are struggling get less, and the rest hold. You approve every change.', 'Based on individual-response findings, e.g. Damas et al. 2019'],
  ['😴', 'Rough days get lighter', 'Poor sleep and low energy reduce performance. The optional readiness check trims a set from accessories when two of the three answers are rough.', 'Knowles et al. 2018 (sleep and performance review)'],
];

function whyHtml() {
  return `<h2>📚 Why this works</h2>
    <p class="muted small">What the plan is built on. Studies show averages; the plan then adapts to how you respond.</p>
    ${WHY.map(([ico, title, text, src]) => `<div class="why-item"><div class="why-ico">${ico}</div><div><b>${title}</b><p>${text}</p><small>${src}</small></div></div>`).join('')}
    <p class="muted small" style="margin-top:12px">General training information, not medical advice.</p>`;
}

function reviewHtml() {
  const r = ui.review;
  const acc = ui.reviewAcc;
  const plan = state.plan;
  const changes = Object.entries(r.volume).filter(([, v]) => v.to !== v.from);
  const holds = Object.entries(r.volume).filter(([, v]) => v.to === v.from);
  const prog = Object.entries(r.progress).sort((a, b) => b[1] - a[1]);
  const pct = v => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
  // Exercise changes grouped by session (Upper A, Upper B, ...).
  const groups = {};
  r.swaps.forEach((s, i) => { (groups[`${PLAN_DAYS[s.type].name} ${slotLetter(s.slot)}`] ||= []).push({ s, i }); });
  const swapGroups = Object.entries(groups);
  const toggle = (act, key, on) => `<button class="mini-btn ${on ? 'on' : ''}" data-act="${act}" data-k="${key}">${on ? '✓ Apply' : 'Skip'}</button>`;
  return `<h2>🏁 Block ${plan.blockNo || 1} review</h2>
    <p class="muted small">From your last ${plan.blockWeeks || 5} weeks. Approve what you want for block ${(plan.blockNo || 1) + 1}.</p>
    ${prog.length ? `<div class="section-title">Strength change by muscle</div><div class="rv-prog">${prog.map(([m, v]) => `<span class="${v > 0.01 ? 'up' : v < 0 ? 'down' : ''}">${MUSCLES[m]} <b>${pct(v)}</b></span>`).join('')}</div>` : ''}
    <div class="section-title">Weekly sets</div>
    ${changes.length ? changes.map(([m, v]) => `<div class="rv-row"><div><b>${MUSCLES[m]}: ${v.from} → ${v.to} sets</b><small>${esc(v.reason)}</small></div>${toggle('rvVol', m, acc.volume[m] !== false)}</div>`).join('') : '<p class="muted small">No volume changes.</p>'}
    ${holds.length ? `<p class="muted small">Holding: ${holds.map(([m, v]) => `${MUSCLES[m]} ${v.to}`).join(', ')}.</p>` : ''}
    <div class="section-title">Exercise changes</div>
    ${r.swaps.length ? swapGroups.map(([name, list]) => `<details class="rv-group" ${swapGroups.length <= 2 ? 'open' : ''}><summary>${esc(name)} <small>${list.length} change${list.length > 1 ? 's' : ''}</small></summary>
      ${list.map(({ s, i }) => `<div class="rv-row"><div><b>${esc(exercise(s.from).name)} → ${esc(exercise(s.to).name)}</b><small>${esc(s.reason)}</small></div>${toggle('rvSwap', i, acc.swaps[i] !== false)}</div>`).join('')}</details>`).join('') : '<p class="muted small">Keeping every exercise: they are all still progressing.</p>'}
    <div class="stack" style="margin-top:16px">
      <button class="btn primary" data-act="reviewApprove">Start block ${(plan.blockNo || 1) + 1}</button>
      <button class="btn" data-act="reviewLater">One more week first</button>
      <button class="btn ghost" data-act="whySheet">Why this works</button>
    </div>`;
}

function readinessHtml() {
  const a = ui.ready;
  const seg = (key, items) => `<div class="seg">${items.map(([v, l]) => `<button data-act="readySet" data-k="${key}" data-v="${v}" class="${a[key] === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const poor = readinessAdjust([], a).poor;
  return `<h2>How are you today?</h2>
    <p class="muted small">Optional. On rough days a set comes off some exercises so you recover.</p>
    <div class="field"><span>Sleep last night</span>${seg('sleep', [['poor', 'Poor'], ['ok', 'OK'], ['good', 'Good']])}</div>
    <div class="field"><span>Soreness</span>${seg('soreness', [['high', 'Very sore'], ['some', 'A bit'], ['none', 'None']])}</div>
    <div class="field"><span>Energy</span>${seg('energy', [['low', 'Low'], ['ok', 'OK'], ['high', 'High']])}</div>
    <p class="ready-hint ${poor >= 2 ? 'rough' : ''}">${poor >= 3 ? 'Rough day: one set comes off every exercise with 3 or more.' : poor >= 2 ? 'Rough day: one set comes off accessories with 3 or more. Main lifts stay.' : 'Good to go: full workout.'}</p>
    <div class="stack"><button class="btn primary" data-act="readyGo">Start workout</button>
      <div class="row"><button class="btn" data-act="readySkip">Skip</button><button class="btn ghost" data-act="readyOff">Don't ask again</button></div></div>`;
}

function safetyHtml() {
  return `<h2>👋 Before you start</h2>
    <div class="safety">
      <p>LiftLog gives general training suggestions. It isn't medical advice and doesn't know your health history.</p>
      <ul>
        <li>If you have a heart condition, injury, high blood pressure, are pregnant or are new to exercise, check with a doctor first.</li>
        <li>Learn each lift with light weight and good form before adding load.</li>
        <li>Stop a set if you feel sharp pain, dizziness, chest pain or shortness of breath.</li>
        <li>Something hurts? Tap <b>•••</b> on the exercise, then <b>This hurt</b>. It's swapped out and kept out of your plans.</li>
      </ul>
    </div>
    <div class="field"><span>Units</span>
      <div class="chips">${[['lb', 'Pounds (lb)'], ['kg', 'Kilograms (kg)']].map(([v, l]) => `<button data-act="setUnits" data-v="${v}" class="${U() === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <button class="btn primary" data-act="safetyOk">Got it</button>`;
}

function pauseUntil(date) {
  state.plan = pausePlan(state.plan, date.toISOString());
  save();
  closeSheet();
  render();
  toast(`Paused until ${fmtDate(date.toISOString())}`);
}

function startFromReadiness(answers) {
  const s = ui.sheet;
  const readiness = answers ? { ...answers, poor: readinessAdjust([], answers).poor } : null;
  if (s.kind === 'plan') { startPlanned(s.seq, readiness); return; }
  const t = state.templates.find(x => x.id === s.id);
  if (t) startWorkout(t.splitId, t, t, undefined, {}, readiness);
  else closeSheet();
}

// First working set of a lift with no history: estimate strength from it
// and give the remaining sets targets at that weight.
function calibrate(c) {
  if (c.e.sets.filter(s => s.done && !s.warmup).length !== 1) return false;
  const bw = bodyweightOn();
  const cal = calibrationFrom(c.ex, c.s, bw, c.e.zone);
  if (!cal) return false;
  c.e.suggestion = cal;
  let k = 0;
  for (const s of c.e.sets) {
    if (s.warmup) continue;
    if (!s.done) {
      if (s.weight == null) s.weight = c.s.weight;
      const reps = targetFor(cal, c.ex, s.weight, k, bw);
      if (reps) s.target = { weight: s.weight, reps };
    }
    k++;
  }
  return true;
}

// ---------- Sheets ----------
function openSheet(s) { ui.sheet = s; renderSheet(); }

// Return to the sheet a sub-editor was opened from.
function reopenSheet(back) {
  if (!back) { closeSheet(); return; }
  if (back.type === 'splitEdit') {
    const sp = state.splits.find(x => x.id === back.id);
    openSheet({ type: 'splitEdit', id: back.id, draft: { name: sp.name, icon: sp.icon, color: sp.color, muscles: [...sp.muscles] } });
  } else openSheet(back);
}
function closeSheet() { ui.sheet = null; renderSheet(); }

function pickerList(query) {
  const w = state.activeWorkout;
  const dt = dayType(w.dayType);
  const added = new Set(w.exercises.map(e => e.exId));
  const counts = usageCounts();
  const q = query.trim().toLowerCase();
  const sortFn = (a, b) => (counts[b.id] || 0) - (counts[a.id] || 0) || a.name.localeCompare(b.name);
  const neglected = neglectList().slice(0, 5).map(n => n.region);
  const hits = ex => neglected.find(r => (exerciseRegions(ex)[r] || 0) >= DIRECT);
  const item = ex => {
    const r = hits(ex);
    return `<button class="pick ${added.has(ex.id) ? 'added' : ''}" data-act="pick" data-id="${ex.id}">
    <span>${esc(ex.name)}${r ? `<em class="hit-tag">Hits ${esc(REGIONS[r].name.toLowerCase())}</em>` : ''}</span><span class="muted pick-eq">${added.has(ex.id) ? 'added' : `${EQUIP_ICON[ex.equipment] || ''}${esc(EQUIPMENT[ex.equipment]?.name || '')}`}</span></button>`;
  };
  if (q) {
    const hits = allExercises().filter(e => e.name.toLowerCase().includes(q)).sort(sortFn);
    return (hits.map(item).join('') || `<div class="empty">No match. Create it as a custom exercise.</div>`);
  }
  const weekSets = muscleSets(state.workouts, exercise, new Date(Date.now() - 7 * DAY).toISOString());
  const target = state.settings.weeklyTarget;
  return dt.muscles.map(m => {
    const list = allExercises().filter(e => e.muscle === m).sort(sortFn);
    const n = weekSets[m] || 0;
    return list.length ? `<div class="pick-group"><h4>${MUSCLES[m]}<span class="${n >= target ? 'ok' : ''}">${n}/${target} sets this week</span></h4>${list.map(item).join('')}</div>` : '';
  }).join('');
}

// Builder settings live here so they survive closing and reopening the sheet.
ui.build = { mode: 'auto', unit: 'sets', sets: 18, minutes: 60, muscles: [], seed: 0, error: null, plan: null, budget: 0 };

function buildBudget() {
  const b = ui.build;
  return b.unit === 'sets' ? b.sets : setsForMinutes(b.minutes, paceFromHistory(state.workouts, state.settings.defaultRest));
}

function runBuild() {
  const b = ui.build;
  const budget = buildBudget();
  const plan = buildWorkout({
    workouts: state.workouts, lookup: exercise, exercises: allExercises(), budget, mode: b.mode, muscles: b.muscles,
    weeklyTarget: state.settings.weeklyTarget, ignored: state.settings.ignoredRegions, snoozed: state.settings.neglectSnooze,
    seed: b.seed, usage: usageCounts(), exclude: blocked(),
  });
  if (plan.error) { b.error = plan; b.plan = null; openSheet({ type: 'build' }); return; }
  b.error = null;
  b.plan = plan;
  b.budget = budget;
  openSheet({ type: 'buildPreview' });
}

const regionOptions = muscle => `<option value="">Whole muscle</option>${regionsOf(muscle).map(r => `<option value="${r}">${REGIONS[r].name}</option>`).join('')}`;

const SPLIT_ICONS = ['💪', '🦵', '🏋️', '🔥', '⚡', '🎯', '🦍', '🚀', '🧱', '🏃', '🤸', '⭐'];
const SPLIT_COLORS = ['#9b8cff', '#ff9447', '#3ed4ff', '#ff5f9e', '#c4f542', '#ffc24b', '#5ee0a0', '#ff5f6d'];

const lastWorkoutOf = id => [...state.workouts].sort((a, b) => b.date.localeCompare(a.date)).find(w => w.dayType === id);
function tplCount(splitId) {
  const n = state.templates.filter(t => t.splitId === splitId).length;
  return n ? `${n} template${n > 1 ? 's' : ''}` : 'No templates';
}
// Template exercises from a workout, keeping order and supersets.
const tplExercises = w => w.exercises.map(e => ({ exId: e.exId, ...(e.group ? { group: e.group } : {}) }));

function sheetHtml() {
  const s = ui.sheet;
  switch (s.type) {
    case 'build': {
      const b = ui.build;
      const pace = paceFromHistory(state.workouts, state.settings.defaultRest);
      const budget = buildBudget();
      const saved = state.templates.filter(t => t.splitId === CUSTOM_SPLIT.id);
      const seg = (act, cur, items) => `<div class="seg">${items.map(([v, l]) => `<button data-act="${act}" data-v="${v}" class="${cur === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
      let err = '';
      if (b.error?.error === 'noMuscles') err = `<div class="banner info"><div>Pick at least one muscle.</div></div>`;
      if (b.error?.error === 'tooSmall') {
        err = b.error.fit
          ? `<div class="banner info"><div>${b.muscles.length} muscles need at least ${b.muscles.length * 4} sets (2 exercises × 2 sets each).</div>
              <div class="banner-btns"><button data-act="bRaise">Raise to ${b.muscles.length * 4} sets</button><button data-act="bKeepTop">Keep top ${b.error.fit}</button></div></div>`
          : `<div class="banner info"><div>A workout needs at least 4 sets.</div></div>`;
      }
      return `<h2>${CUSTOM_SPLIT.icon} Build today's workout</h2>
        <div class="field"><span>Muscles</span>${seg('bMode', b.mode, [['auto', 'Auto'], ['pick', 'Pick muscles']])}</div>
        ${b.mode === 'auto'
          ? `<p class="muted small" style="margin-top:-4px">Picks what you need most today: muscles behind on weekly sets, neglected areas, and how rested you are.</p>`
          : `<div class="chips">${Object.entries(MUSCLES).map(([k, n]) => `<button data-act="bMuscle" data-v="${k}" class="${b.muscles.includes(k) ? 'on' : ''}">${n}</button>`).join('')}</div>`}
        <div class="field"><span>Volume</span>${seg('bUnit', b.unit, [['sets', 'Sets'], ['min', 'Minutes']])}</div>
        <div class="plates-weight">
          <button data-act="bStep" data-d="-1" aria-label="Less">−</button>
          <div><b>${b.unit === 'sets' ? b.sets : b.minutes}</b><span>${b.unit === 'sets' ? 'working sets' : 'minutes'}</span></div>
          <button data-act="bStep" data-d="1" aria-label="More">+</button>
        </div>
        <p class="muted small" style="text-align:center">${b.unit === 'min' ? `≈ ${budget} sets at your pace (${pace}s per set)` : `≈ ${Math.round((budget * pace) / 60)} min at your pace`}</p>
        ${err}
        <button class="btn primary" data-act="doBuild">Build workout</button>
        ${saved.length ? `<div class="section-title">Saved builds</div><div class="tpl-list">${saved.map(t => `
          <div class="tpl" style="--c:${CUSTOM_SPLIT.color}">
            <button class="tpl-main" data-act="startTemplate" data-id="${t.id}"><b>${esc(t.name)}</b><small>${t.exercises.length} exercises · ${esc(t.exercises.map(e => exercise(e.exId).name).join(', '))}</small></button>
            <button class="tpl-edit" data-act="tplEdit" data-id="${t.id}">Edit</button>
          </div>`).join('')}</div>` : ''}`;
    }
    case 'buildPreview': {
      const p = ui.build.plan;
      const pace = paceFromHistory(state.workouts, state.settings.defaultRest);
      const rows = p.items.map((it, i) => {
        const ex = exercise(it.exId);
        const sug = suggestionFor(ex);
        const load = sug ? `${weightLabel(ex, sug.weight)} × ${sug.reps[0]}` : 'new — find your weight';
        return `<div class="bp-row">
          <div class="bp-main">
            <span class="tag">${EQUIP_ICON[ex.equipment] || ''}${MUSCLES[it.muscle]}</span>
            <b>${esc(ex.name)}</b>
            <small>${it.sets} sets · ${esc(load)}</small>
            <small class="bp-why">${esc(it.reason)}${it.isNew ? ' · new for you' : ''}</small>
          </div>
          <div class="bp-tools"><button data-act="bpSwap" data-i="${i}" aria-label="Swap exercise">↻</button><button data-act="bpRemove" data-i="${i}" aria-label="Remove exercise">✕</button></div>
        </div>`;
      }).join('');
      const short = p.totalSets < ui.build.budget
        ? `<p class="muted small">Only ${p.totalSets} of ${ui.build.budget} sets fit: those muscles ran out of exercises.</p>` : '';
      return `<h2>Today's workout</h2>
        <p class="muted small" style="margin-top:-6px">${p.totalSets} sets · ≈ ${Math.round((p.totalSets * pace) / 60)} min · ${esc(p.muscles.map(m => MUSCLES[m]).join(', '))}</p>
        ${short}
        <div class="bp-list">${rows || '<div class="empty">Everything was removed.</div>'}</div>
        <div class="stack" style="margin-top:14px">
          <button class="btn primary" data-act="bpStart" ${p.items.length ? '' : 'disabled style="opacity:.5"'}>Start workout</button>
          <div class="row"><button class="btn" data-act="bpRegen">↻ Regenerate</button><button class="btn" data-act="bpBack">Change settings</button></div>
          <div class="row" style="align-items:flex-end">
            <label class="field" style="margin:0"><span>Save as template</span><input id="bpName" placeholder="e.g. Arms & shoulders" autocomplete="off"></label>
            <button class="btn" style="flex:0 0 80px" data-act="bpSave">Save</button>
          </div>
        </div>`;
    }
    case 'start': {
      const sp = dayType(s.day);
      const tpls = state.templates.filter(t => t.splitId === s.day);
      const last = lastWorkoutOf(s.day);
      return `<h2>${sp.icon} ${esc(sp.name)}</h2>
        ${tpls.length
          ? `<div class="tpl-list">${tpls.map(t => `
            <div class="tpl" style="--c:${sp.color}">
              <button class="tpl-main" data-act="startTemplate" data-id="${t.id}"><b>${esc(t.name)}</b><small>${t.exercises.length} exercises · ${esc(t.exercises.map(e => exercise(e.exId).name).join(', '))}</small></button>
              <button class="tpl-edit" data-act="tplEdit" data-id="${t.id}">Edit</button>
            </div>`).join('')}</div>`
          : `<p class="muted small">Tip: save a workout as a template to start it in one tap next time.</p>`}
        <div class="stack" style="margin-top:14px">
          ${last ? `<button class="btn ${tpls.length ? '' : 'primary'}" data-act="startRepeat">Repeat last time (${relDays(last.date)})</button>` : ''}
          <button class="btn" data-act="startEmpty">Start empty</button>
          <button class="btn ghost" data-act="tplNew" data-split="${s.day}">+ New template</button>
        </div>`;
    }
    case 'splits': {
      const vis = visibleSplits();
      const hid = state.splits.filter(x => x.hidden);
      return `<h2>Your splits</h2>
        <div class="split-list">${vis.map((x, i) => `
          <div class="split-row" style="--c:${x.color}">
            <span class="day-ico sm">${x.icon}</span>
            <div class="sr-txt"><b>${esc(x.name)}</b><small>${tplCount(x.id)}</small></div>
            <button data-act="splitMove" data-id="${x.id}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
            <button data-act="splitMove" data-id="${x.id}" data-d="1" ${i === vis.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
            <button data-act="splitEdit" data-id="${x.id}">Edit</button>
          </div>`).join('')}</div>
        <button class="btn primary" style="margin-top:12px" data-act="splitEdit">+ New split</button>
        ${hid.length ? `<div class="section-title">Removed</div><div class="split-list">${hid.map(x => `
          <div class="split-row off"><span class="day-ico sm">${x.icon}</span><div class="sr-txt"><b>${esc(x.name)}</b><small>Hidden · past workouts kept</small></div>
          <button data-act="splitRestore" data-id="${x.id}">Restore</button></div>`).join('')}</div>` : ''}`;
    }
    case 'splitEdit': {
      const d = s.draft;
      return `<h2>${s.id ? 'Edit split' : 'New split'}</h2>
        <label class="field"><span>Name</span><input id="spName" value="${esc(d.name)}" placeholder="e.g. Push, Arms, Full body" autocomplete="off"></label>
        <div class="field"><span>Icon</span><div class="chips icons">${SPLIT_ICONS.map(ic => `<button data-act="spIcon" data-v="${ic}" class="${d.icon === ic ? 'on' : ''}">${ic}</button>`).join('')}</div></div>
        <div class="field"><span>Color</span><div class="swatches">${SPLIT_COLORS.map(c => `<button data-act="spColor" data-v="${c}" class="${d.color === c ? 'on' : ''}" style="--sw:${c}" aria-label="Color ${c}"></button>`).join('')}</div></div>
        <div class="field"><span>Muscles — these decide which exercises get suggested</span>
          <div class="chips">${Object.entries(MUSCLES).map(([k, n]) => `<button data-act="spMuscle" data-v="${k}" class="${d.muscles.includes(k) ? 'on' : ''}">${n}</button>`).join('')}</div></div>
        ${s.id ? `<div class="section-title">Templates</div>
          ${state.templates.filter(t => t.splitId === s.id).map(t => `<div class="split-row"><div class="sr-txt"><b>${esc(t.name)}</b><small>${t.exercises.length} exercises</small></div><button data-act="tplEdit" data-id="${t.id}">Edit</button></div>`).join('') || '<p class="muted small">No templates yet.</p>'}
          <button class="btn ghost" style="margin-top:8px" data-act="tplNew" data-split="${s.id}">+ New template</button>` : ''}
        <div class="stack" style="margin-top:16px">
          <button class="btn primary" data-act="spSave">Save split</button>
          ${s.id ? `<button class="btn danger" data-act="spRemove">Remove split</button>` : ''}
        </div>`;
    }
    case 'tplEdit': {
      const d = s.draft;
      const sp = dayType(d.splitId);
      const groupsOrder = [...sp.muscles, ...Object.keys(MUSCLES).filter(m => !sp.muscles.includes(m))];
      const opts = groupsOrder.map(m => {
        const list = allExercises().filter(x => x.muscle === m).sort((a, b) => a.name.localeCompare(b.name));
        return list.length ? `<optgroup label="${MUSCLES[m]}">${list.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</optgroup>` : '';
      }).join('');
      return `<h2>${s.id ? 'Edit template' : 'New template'}</h2>
        <p class="muted small" style="margin-top:-6px">${sp.icon} ${esc(sp.name)} · order here is the order you'll do them</p>
        <label class="field"><span>Name</span><input id="tplName" value="${esc(d.name)}" placeholder="e.g. Back first" autocomplete="off"></label>
        <div class="tpl-ex">${d.exercises.length ? d.exercises.map((e, i) => `
          <div class="tpl-row">
            <span class="n">${i + 1}</span>
            <span class="nm">${esc(exercise(e.exId).name)}${e.group ? ' <em>🔗 superset</em>' : ''}</span>
            <button data-act="tplMove" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
            <button data-act="tplMove" data-i="${i}" data-d="1" ${i === d.exercises.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
            <button data-act="tplRemove" data-i="${i}" aria-label="Remove">✕</button>
          </div>`).join('') : '<p class="muted small">No exercises yet — add some below.</p>'}</div>
        <div class="row" style="margin-top:10px;align-items:center">
          <select id="tplAdd" class="ex-select" style="margin:0">${opts}</select>
          <button class="btn" style="flex:0 0 76px" data-act="tplAddEx">Add</button>
        </div>
        <div class="stack" style="margin-top:16px">
          <button class="btn primary" data-act="tplSave">Save template</button>
          ${s.id ? `<button class="btn danger" data-act="tplDelete">Delete template</button>` : ''}
        </div>`;
    }
    case 'saveTpl': {
      const w = state.activeWorkout;
      const cur = w.templateId && state.templates.find(t => t.id === w.templateId);
      return `<h2>Save as template</h2>
        <p class="muted small">Saves these ${w.exercises.length} exercises in this order${w.exercises.some(e => e.group) ? ', including supersets' : ''}. Weights aren't saved — the app suggests those fresh each time.</p>
        ${cur ? `<button class="btn primary" data-act="tplUpdateFromWorkout">Update “${esc(cur.name)}”</button><div class="section-title">Or save as a new one</div>` : ''}
        <label class="field"><span>Template name</span><input id="newTplName" placeholder="e.g. Back first" autocomplete="off"></label>
        <button class="btn ${cur ? '' : 'primary'}" data-act="tplSaveFromWorkout">Save new template</button>`;
    }
    case 'picker':
      return `<h2>Add exercise</h2>
        <input class="search" id="pickerSearch" placeholder="Search all exercises" autocomplete="off">
        <div id="pickerList">${pickerList('')}</div>
        <button class="btn ghost" style="margin-top:14px" data-act="customSheet">+ Custom exercise</button>`;
    case 'custom': {
      const m0 = dayType(state.activeWorkout?.dayType)?.muscles[0] || 'chest';
      return `<h2>Custom exercise</h2>
        <label class="field"><span>Name</span><input id="cName" placeholder="e.g. Machine Pullover"></label>
        <label class="field"><span>Muscle</span><select id="cMuscle">${Object.entries(MUSCLES).map(([k, v]) => `<option value="${k}" ${m0 === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="field"><span>Main area it works</span><select id="cRegion">${regionOptions(m0)}</select></label>
        <label class="field"><span>Equipment</span><select id="cEquip">${Object.entries(EQUIPMENT).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('')}</select></label>
        <label class="check-field"><input type="checkbox" id="cCompound"> Compound lift (multi-joint, 6–12 reps)</label>
        <button class="btn primary" data-act="saveCustom">Add exercise</button>`;
    }
    case 'rest': {
      const cur = restFor(s.exId);
      return `<h2>Rest timer</h2><p class="muted">${esc(exercise(s.exId).name)}</p>
        <div class="chips">${[45, 60, 90, 120, 150, 180, 240].map(v => `<button data-act="setRest" data-v="${v}" class="${v === cur ? 'on' : ''}">${v < 60 ? v + 's' : v / 60 + ' min'}</button>`).join('')}</div>
        <label class="field"><span>Custom (seconds)</span><input id="restCustom" inputmode="numeric" value="${cur}"></label>
        <button class="btn primary" data-act="setRestCustom">Save</button>`;
    }
    case 'finish': {
      const w = state.activeWorkout;
      const done = w.exercises.reduce((n, e) => n + e.sets.filter(x => x.done && x.reps > 0 && !x.warmup).length, 0);
      const vol = w.exercises.reduce((sum, e) => sum + sessionVolume(exercise(e.exId), e.sets.filter(x => x.done && x.reps > 0 && !x.warmup), w.startedAt), 0);
      const mins = Math.round((Date.now() - new Date(w.startedAt).getTime()) / 60000);
      const prs = workoutPRs(w);
      const undone = w.exercises.reduce((n, e) => n + e.sets.filter(x => !x.done).length, 0);
      return `<h2>Finish workout?</h2>
        <div class="stats">
          <div class="stat"><b>${mins}</b><span>minutes</span></div>
          <div class="stat"><b>${done}</b><span>sets</span></div>
          <div class="stat"><b>${dispW(vol).toLocaleString()}</b><span>${wu()} volume</span></div>
        </div>
        ${prs.length ? `<div class="card pr-list"><div class="muted small">🎉 New strength PRs</div>${prs.map(p => `<div class="pr"><span>${esc(p.name)}</span><b>${Math.round(p.now)} e1RM</b></div>`).join('')}</div>` : ''}
        ${undone ? `<p class="muted small">${undone} unticked set${undone > 1 ? 's' : ''} won't be saved.</p>` : ''}
        <div class="stack">
          <button class="btn primary" data-act="finish" ${done ? '' : 'disabled style="opacity:.5"'}>Save workout</button>
          <button class="btn" data-act="closeSheet">Keep going</button>
          <button class="btn danger" data-act="discard">Discard workout</button>
        </div>`;
    }
    case 'exmenu': {
      const e = state.activeWorkout.exercises[s.ei];
      const ex = exercise(e.exId);
      const inc = increment(ex);
      const steps = stepChoices(U());
      return `<h2>${esc(ex.name)}</h2>
        <label class="field"><span>Note — shows every time you do this lift</span>
          <textarea id="exNote" rows="2" placeholder="e.g. Seat height 4, wide grip">${esc(exSetting(e.exId, 'note') || '')}</textarea></label>
        <button class="btn" data-act="saveNote">Save note</button>
        <div class="field" style="margin-top:16px"><span>Weight step for this lift (your gym's real jumps)</span>
          <div class="chips">${steps.map(v => `<button data-act="setStep" data-v="${v}" class="${Math.abs(inc - v) < 1e-6 ? 'on' : ''}">${fmtW(v)} ${wu()}</button>`).join('')}${steps.some(v => Math.abs(inc - v) < 1e-6) ? '' : `<button class="on">${fmtW(inc)} ${wu()}</button>`}</div>
        </div>
        <div class="menu-list">
          <button data-act="moveEx" data-d="-1" ${s.ei === 0 ? 'disabled' : ''}><span>⬆️</span>Move up</button>
          <button data-act="moveEx" data-d="1" ${s.ei === state.activeWorkout.exercises.length - 1 ? 'disabled' : ''}><span>⬇️</span>Move down</button>
          <button data-act="addWarmups"><span>🔥</span>Add warm-up sets</button>
          <button data-act="swapSheet"><span>🔄</span>Swap exercise</button>
          <button data-act="hurtSheet"><span>🤕</span>This hurt</button>
          <button data-act="supersetSheet"><span>🔗</span>${e.group ? 'Add another to this superset' : 'Superset with…'}</button>
          ${e.group ? `<button data-act="unSuperset"><span>✂️</span>Remove from superset</button>` : ''}
          <button class="danger" data-act="removeExMenu"><span>🗑</span>Remove exercise</button>
        </div>`;
    }
    case 'swap': {
      const e = state.activeWorkout.exercises[s.ei];
      const ex = exercise(e.exId);
      const counts = usageCounts();
      const options = usable().filter(x => x.muscle === ex.muscle && x.id !== ex.id)
        .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0) || a.name.localeCompare(b.name));
      return `<h2>Swap ${esc(ex.name)}</h2>
        <p class="muted small">Other ${MUSCLES[ex.muscle]} lifts. ${e.sets.some(x => x.done) ? 'Your logged sets stay — the new lift is added below.' : 'Lifts you haven’t done get a rough starting weight.'}</p>
        ${options.map(x => `<button class="pick" data-act="doSwap" data-id="${x.id}"><span>${esc(x.name)}</span><span class="muted pick-eq">${EQUIP_ICON[x.equipment] || ''}${esc(EQUIPMENT[x.equipment]?.name || '')}</span></button>`).join('')}`;
    }
    case 'superset': {
      const w = state.activeWorkout;
      const e = w.exercises[s.ei];
      const others = w.exercises.map((x, i) => ({ x, i })).filter(({ x }) => x !== e && (!e.group || x.group !== e.group));
      return `<h2>Superset with…</h2>
        <p class="muted small">Do one set of each back to back. Rest starts after the round.</p>
        ${others.length ? others.map(({ x, i }) => `<button class="pick" data-act="doSuperset" data-i="${i}"><span>${esc(exercise(x.exId).name)}</span><span class="muted">${x.group ? 'in superset ' + groupLetter(w, x.group) : ''}</span></button>`).join('') : '<div class="empty">Add another exercise first.</div>'}`;
    }
    case 'share':
      return `<h2>Share workout</h2>
        <img class="share-preview" src="${s.url}" alt="Workout summary card">
        <button class="btn primary" data-act="doShare">Share image</button>`;
    case 'healthImport':
      return `<h2>Import from Apple Health</h2>
        <ol class="steps">
          <li>Open the <b>Health</b> app, tap your profile picture, then <b>Export All Health Data</b>.</li>
          <li>Save the file to <b>Files</b>, open it there and tap the zip to unzip it.</li>
          <li>Come back here and pick <b>export.xml</b> from the unzipped folder.</li>
        </ol>
        <p class="muted small">Brings in bodyweight, body fat and waist readings. Days you've already logged here are kept as they are. Big exports can take a minute.</p>
        <label class="btn primary">Choose export.xml<input type="file" id="healthFile" accept=".xml,text/xml,application/xml" hidden></label>
        <div id="importProg" class="muted small" style="margin-top:10px"></div>`;
    case 'photo':
      return `<h2>${fmtDate(s.date + 'T12:00:00')}</h2>
        <img class="photo-full" src="${s.url}" alt="Progress photo">
        <div class="row" style="margin-top:12px">
          <button class="btn" data-act="comparePick">Compare…</button>
          <button class="btn danger" data-act="deletePhoto">Delete</button>
        </div>`;
    case 'compare':
      return `<h2>Compare</h2>
        <div class="compare">${s.items.map(p => `<figure><img src="${p.url}" alt=""><figcaption>${fmtDate(p.date + 'T12:00:00')}</figcaption></figure>`).join('')}</div>
        <p class="muted small" style="text-align:center">${Math.round(Math.abs(new Date(s.items[1].date) - new Date(s.items[0].date)) / DAY)} days apart</p>`;
    case 'plates': {
      const pu = wu();
      const total = Math.round(toDisplay(s.weight, U()) * 100) / 100;
      const { plates, leftover } = platesFor(total, s.bar, pu);
      const under = total < s.bar;
      return `<h2>Plate calculator</h2><p class="muted">${esc(exercise(s.exId).name)}</p>
        <div class="plates-weight">
          <button data-act="platesStep" data-d="-1" aria-label="Less weight">−</button>
          <div><b>${fmtW(s.weight)}</b><span>${pu} total</span></div>
          <button data-act="platesStep" data-d="1" aria-label="More weight">+</button>
        </div>
        <div class="plates-view">${platesSvg(plates, pu)}</div>
        <p class="plates-list">${under ? `Less than the ${s.bar} ${pu} bar.` : plates.length ? `Each side: <b>${plates.join(' + ')}</b>` : 'Empty bar'}${leftover ? ` <span class="muted">(${leftover} ${pu} can't be loaded)</span>` : ''}</p>
        <div class="field"><span>Bar</span>
          <div class="chips">${PLATE_SETS[pu].bars.map(([v, l]) => `<button data-act="platesBar" data-v="${v}" class="${s.bar === v ? 'on' : ''}">${l}</button>`).join('')}</div>
        </div>`;
    }
    case 'safety':
      return safetyHtml();
    case 'setup':
      return setupHtml();
    case 'why':
      return whyHtml();
    case 'review':
      return reviewHtml();
    case 'readiness':
      return readinessHtml();
    case 'planSession': {
      const day = planDayBySeq(planUpcoming(), s.seq);
      if (!day) return `<h2>Session</h2><div class="empty">This session is no longer planned.</div>`;
      const ss = day.session;
      const dt = PLAN_DAYS[ss.type];
      const letters = {};
      for (const it of ss.items) if (it.superset && !letters[it.superset]) letters[it.superset] = slotLetter(Object.keys(letters).length);
      const rows = ss.items.map((it, i) => {
        const ex = exercise(it.exId);
        const badges = [it.main ? '<em class="badge">Main lift</em>' : '', it.superset ? `<em class="badge ss">Superset ${letters[it.superset]}</em>` : ''].join('');
        return `<div class="bp-row" style="--c:${dt.color}">
          <div class="bp-main"><span class="tag">${EQUIP_ICON[ex.equipment] || ''}${MUSCLES[it.muscle]}</span>
            <b>${esc(ex.name)}</b><small>${it.sets} sets · ${itemZone(it)}${badges}</small></div>
          <div class="bp-tools"><button data-act="planSwapSheet" data-i="${i}" aria-label="Swap exercise">↻</button><button data-act="planRemove" data-i="${i}" aria-label="Remove exercise">✕</button></div>
        </div>`;
      }).join('');
      const isToday = day.weekday === todayIdx();
      return `<h2>${dt.icon} ${esc(ss.name)}</h2>
        <p class="muted small" style="margin-top:-6px">${day.week ? 'Next ' : ''}${WEEKDAYS[day.weekday]} · ${ss.items.length} exercises · ≈ ${ss.estMinutes} min${ss.notes.length ? ' · ' + esc(ss.notes.join(' · ')) : ''}</p>
        <div class="field"><span>Edits apply to</span><div class="seg">${[['week', 'This session'], ['block', 'Rest of block']].map(([v, l]) => `<button data-act="planScope" data-v="${v}" class="${s.scope === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
        <div class="bp-list">${rows || '<div class="empty">Everything was removed.</div>'}</div>
        <p class="muted small">Swap or remove the same lift twice and the plan stops picking it.</p>
        ${day.week ? `<p class="muted small">Planned for next week. It shifts if you miss or move a day before then.</p>` : `<button class="btn primary" style="margin-top:8px" data-act="planStart" data-seq="${ss.seq}">${isToday ? 'Start workout' : 'Do it today'}</button>`}`;
    }
    case 'planSwap': {
      const day = planDayBySeq(planUpcoming(), s.seq);
      const it = day?.session.items[s.i];
      if (!it) return `<h2>Swap</h2><div class="empty">Nothing to swap.</div>`;
      const ex = exercise(it.exId);
      const opts = swapOptions(it.exId, { plan: state.plan, ...planCtx(), type: day.session.type, exclude: day.session.items.map(x => x.exId) });
      return `<h2>Swap ${esc(ex.name)}</h2>
        <p class="muted small">${s.scope === 'block' ? 'For the rest of this block.' : 'For this session only.'} Same muscle, your equipment. Best match for the same area first.</p>
        ${opts.map(x => `<button class="pick" data-act="planDoSwap" data-id="${x.id}"><span>${esc(x.name)}</span><span class="muted pick-eq">${EQUIP_ICON[x.equipment] || ''}${esc(REGIONS[primaryRegion(x)]?.name || '')}</span></button>`).join('') || '<div class="empty">No other options with your equipment.</div>'}`;
    }
    case 'planDays': {
      return `<h2>📅 Days this week</h2>
        <p class="muted small">Only this week changes. Sessions keep their order; fewer days means the rotation simply continues next week.</p>
        <div class="chips">${WEEKDAYS.map((n, i) => `<button data-act="pdDay" data-v="${i}" class="${s.days.includes(i) ? 'on' : ''}">${n}</button>`).join('')}</div>
        <button class="btn primary" data-act="pdSave">Save for this week</button>`;
    }
    case 'planPause': {
      return `<h2>⏸️ Pause plan</h2>
        <p class="muted small">Vacation, illness, busy stretch. Nothing gets scheduled or counted as missed. Coming back after a week or more, your first week is about 30% lighter.</p>
        <div class="chips">${[[7, '1 week'], [14, '2 weeks'], [28, '4 weeks']].map(([d, l]) => `<button data-act="ppFor" data-v="${d}">${l}</button>`).join('')}</div>
        <label class="field"><span>Or until</span><input type="date" id="ppDate" min="${todayStr()}"></label>
        <button class="btn" data-act="ppDate">Pause until this date</button>`;
    }
    case 'hurt': {
      const e = state.activeWorkout.exercises[s.ei];
      const ex = exercise(e.exId);
      return `<h2>🤕 ${esc(ex.name)} hurt</h2>
        <p class="muted small">Pain is a sign to change something, not to push through. If it's sharp, lingers or swells, stop and get it checked.</p>
        <div class="stack">
          <button class="btn primary" data-act="hurtAvoid">Swap it and keep it out of my plans</button>
          <button class="btn" data-act="hurtSwap">Just swap it for today</button>
        </div>
        <p class="muted small" style="margin-top:10px">You can let it back in from Settings later.</p>`;
    }
    case 'settings':
      return `<h2>Settings</h2>
        <div class="field"><span>Units</span>
          <div class="chips">${[['lb', 'Pounds (lb)'], ['kg', 'Kilograms (kg)']].map(([v, l]) => `<button data-act="setUnits" data-v="${v}" class="${U() === v ? 'on' : ''}">${l}</button>`).join('')}</div>
        </div>
        <div class="field"><span>Accent color</span>
          <div class="swatches">${Object.entries(ACCENTS).map(([k, hex]) => `<button data-act="accent" data-v="${k}" class="${(state.settings.accent || 'lime') === k ? 'on' : ''}" style="--sw:${hex}" aria-label="${k}"></button>`).join('')}</div>
        </div>
        ${state.settings.ignoredRegions.length ? `<div class="field"><span>Tracked areas — tap to track again</span>
          <div class="chips">${state.settings.ignoredRegions.map(r => `<button data-act="unignoreRegion" data-r="${r}">↺ ${esc(REGIONS[r]?.name || r)}</button>`).join('')}</div>
        </div>` : ''}
        <div class="field"><span>Weekly set target per muscle</span>
          <div class="chips">${[6, 8, 10, 12, 15, 20].map(v => `<button data-act="weeklyTarget" data-v="${v}" class="${state.settings.weeklyTarget === v ? 'on' : ''}">${v}</button>`).join('')}</div>
        </div>
        <div class="field"><span>Strength standards</span>
          <div class="chips">${[['male', "Men's"], ['female', "Women's"]].map(([v, l]) => `<button data-act="setStandards" data-v="${v}" class="${state.settings.standards === v ? 'on' : ''}">${l}</button>`).join('')}</div>
        </div>
        <div class="field"><span>Readiness check before planned and template workouts</span>
          <div class="chips"><button data-act="readinessToggle" class="${state.settings.readinessCheck !== false ? 'on' : ''}">${state.settings.readinessCheck !== false ? 'On' : 'Off'}</button></div>
        </div>
        ${Object.keys(state.settings.painFlags || {}).length ? `<div class="field"><span>Lifts that hurt — kept out of plans. Tap to allow again</span>
          <div class="chips">${Object.keys(state.settings.painFlags).map(id => `<button data-act="unpain" data-id="${id}">↺ ${esc(exercise(id).name)}</button>`).join('')}</div>
        </div>` : ''}
        ${state.plan?.excluded?.length ? `<div class="field"><span>Lifts the plan learned to skip. Tap to allow again</span>
          <div class="chips">${state.plan.excluded.map(id => `<button data-act="unexclude" data-id="${id}">↺ ${esc(exercise(id).name)}</button>`).join('')}</div>
        </div>` : ''}
        <div class="field"><span>Default rest timer</span>
          <div class="chips">${[60, 90, 120, 180].map(v => `<button data-act="defaultRest" data-v="${v}" class="${state.settings.defaultRest === v ? 'on' : ''}">${v}s</button>`).join('')}</div>
        </div>
        <div class="section-title">Backup</div>
        <p class="muted small">Your data is stored only on this phone. Save a backup file to Files or iCloud Drive now and then.
          ${state.settings.lastBackup ? `Last backup: ${relDays(state.settings.lastBackup)}.` : 'No backup yet.'}</p>
        <div class="stack">
          <button class="btn primary" data-act="export">Export backup</button>
          <button class="btn" data-act="import">Import backup</button>
        </div>
        <div class="section-title">About</div>
        <div class="stack"><button class="btn" data-act="whySheet">📚 Why the plan works</button>
          <button class="btn" data-act="safetySheet">👋 Safety note</button></div>
        <div class="section-title">Danger zone</div>
        <div class="stack">${state.plan ? `<button class="btn danger" data-act="deletePlan">Delete weekly plan</button>` : ''}
        <button class="btn danger" data-act="wipe">Delete all data</button></div>`;
  }
  return '';
}

function renderSheet() {
  const root = $('#sheet');
  if (!ui.sheet) { root.innerHTML = ''; delete root.dataset.type; document.body.style.overflow = ''; return; }
  // Same sheet already open: update its contents without replaying the slide-in.
  const panel = root.querySelector('.panel');
  if (panel && root.dataset.type === ui.sheet.type) {
    panel.innerHTML = `<div class="grip"></div>${sheetHtml()}`;
    return;
  }
  root.dataset.type = ui.sheet.type;
  root.innerHTML = `<div class="overlay" data-act="closeSheet"></div><div class="panel"><div class="grip"></div>${sheetHtml()}</div>`;
  document.body.style.overflow = 'hidden';
}

// ---------- Backup ----------
async function exportBackup() {
  const data = JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 1);
  const name = `liftlog-backup-${todayStr()}.json`;
  const file = new File([data], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'LiftLog backup' });
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
    state.settings.lastBackup = new Date().toISOString();
    save();
    toast('Backup saved');
    render();
  } catch (e) {
    if (e.name !== 'AbortError') alert('Backup failed: ' + e.message);
  }
}

$('#importFile').addEventListener('change', async ev => {
  const f = ev.target.files[0];
  ev.target.value = '';
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!Array.isArray(data.workouts)) throw new Error('Not a LiftLog backup file');
    if (!confirm(`Replace all current data with this backup (${data.workouts.length} workouts)?`)) return;
    delete data.exportedAt;
    replaceState(data);
    closeSheet();
    toast('Backup restored');
    render();
  } catch (e) {
    alert('Could not import: ' + e.message);
  }
});

// ---------- Event handling ----------
function setCtx(el) {
  const row = el.closest('.set-row');
  const card = el.closest('.ex-card');
  const ctx = (row || card)?.dataset.w;
  const w = ctx && getW(ctx);
  const e = w && w.exercises[+(row || card).dataset.e];
  const s = row && e ? e.sets[+row.dataset.s] : null;
  return { ctx, w, e, s, row, card, ex: e && exercise(e.exId) };
}

// When the weight on an unfinished set changes, re-target its reps.
function retarget(c) {
  if (c.ctx !== 'active' || c.s.done || !c.e.suggestion) return;
  const si = +c.row.dataset.s;
  const reps = targetFor(c.e.suggestion, c.ex, c.s.weight, si, bodyweightOn());
  if (reps) c.s.target = { weight: c.s.weight, reps };
}

const actions = {
  tab(el) { ui.tab = el.dataset.tab; ui.historyId = null; render(true); window.scrollTo(0, 0); },
  settings() { openSheet({ type: 'settings' }); },
  closeSheet() { closeSheet(); },

  start(el) {
    const day = el.dataset.day;
    if (lastWorkoutOf(day) || state.templates.some(t => t.splitId === day)) openSheet({ type: 'start', day });
    else startWorkout(day);
  },
  startRepeat() { startWorkout(ui.sheet.day, lastWorkoutOf(ui.sheet.day)); },
  startEmpty() { startWorkout(ui.sheet.day); },
  startTemplate(el) {
    const t = state.templates.find(x => x.id === el.dataset.id);
    if (!t) return;
    if (state.settings.readinessCheck !== false) { ui.ready = { sleep: 'ok', soreness: 'some', energy: 'ok' }; openSheet({ type: 'readiness', kind: 'tpl', id: t.id }); return; }
    startWorkout(t.splitId, t, t);
  },
  safetySheet() { openSheet({ type: 'safety' }); },

  // Splits
  splitsSheet() { openSheet({ type: 'splits' }); },
  splitEdit(el) {
    const id = el.dataset.id;
    const sp = id && state.splits.find(x => x.id === id);
    const draft = sp
      ? { name: sp.name, icon: sp.icon, color: sp.color, muscles: [...sp.muscles] }
      : { name: '', icon: SPLIT_ICONS[5], color: SPLIT_COLORS[state.splits.length % SPLIT_COLORS.length], muscles: [] };
    openSheet({ type: 'splitEdit', id, draft });
  },
  spIcon(el) { ui.sheet.draft.icon = el.dataset.v; renderSheet(); },
  spColor(el) { ui.sheet.draft.color = el.dataset.v; renderSheet(); },
  spMuscle(el) {
    const d = ui.sheet.draft;
    const m = el.dataset.v;
    d.muscles = d.muscles.includes(m) ? d.muscles.filter(x => x !== m) : Object.keys(MUSCLES).filter(k => k === m || d.muscles.includes(k));
    renderSheet();
  },
  spSave() {
    const { id, draft } = ui.sheet;
    draft.name = draft.name.trim();
    if (!draft.name) { toast('Give the split a name'); $('#spName')?.focus(); return; }
    if (!draft.muscles.length) { toast('Pick at least one muscle'); return; }
    if (id) Object.assign(state.splits.find(x => x.id === id), draft);
    else state.splits.push({ id: 's_' + uid(), ...draft });
    save();
    openSheet({ type: 'splits' });
    render();
  },
  spRemove() {
    const id = ui.sheet.id;
    const sp = state.splits.find(x => x.id === id);
    const used = state.workouts.some(w => w.dayType === id) || state.activeWorkout?.dayType === id;
    withUndo(`Removed ${sp.name}`, () => {
      // Splits with history are hidden so past workouts keep their name and color.
      if (used) sp.hidden = true;
      else {
        state.splits = state.splits.filter(x => x.id !== id);
        state.templates = state.templates.filter(t => t.splitId !== id);
      }
      save();
    });
    openSheet({ type: 'splits' });
    render();
  },
  splitRestore(el) { delete state.splits.find(x => x.id === el.dataset.id).hidden; save(); renderSheet(); render(); },
  splitMove(el) {
    const vis = visibleSplits();
    const i = vis.findIndex(x => x.id === el.dataset.id);
    const other = vis[i + +el.dataset.d];
    if (!other) return;
    const a = state.splits.indexOf(vis[i]);
    const b = state.splits.indexOf(other);
    [state.splits[a], state.splits[b]] = [state.splits[b], state.splits[a]];
    save();
    renderSheet();
    render();
  },

  // Templates
  tplNew(el) {
    const back = ui.sheet ? { type: ui.sheet.type, id: ui.sheet.id, day: ui.sheet.day } : null;
    openSheet({ type: 'tplEdit', draft: { name: '', splitId: el.dataset.split, exercises: [] }, back });
  },
  tplEdit(el) {
    const t = state.templates.find(x => x.id === el.dataset.id);
    const back = ui.sheet ? { type: ui.sheet.type, id: ui.sheet.id, day: ui.sheet.day } : null;
    openSheet({ type: 'tplEdit', id: t.id, draft: { name: t.name, splitId: t.splitId, exercises: t.exercises.map(e => ({ ...e })) }, back });
  },
  tplMove(el) {
    const ex = ui.sheet.draft.exercises;
    const i = +el.dataset.i;
    const j = i + +el.dataset.d;
    if (j < 0 || j >= ex.length) return;
    [ex[i], ex[j]] = [ex[j], ex[i]];
    renderSheet();
  },
  tplRemove(el) { ui.sheet.draft.exercises.splice(+el.dataset.i, 1); renderSheet(); },
  tplAddEx() {
    const id = $('#tplAdd').value;
    if (id) ui.sheet.draft.exercises.push({ exId: id });
    renderSheet();
  },
  tplSave() {
    const { id, draft } = ui.sheet;
    draft.name = draft.name.trim() || `${dayType(draft.splitId).name} ${state.templates.filter(t => t.splitId === draft.splitId).length + 1}`;
    if (!draft.exercises.length) { toast('Add at least one exercise'); return; }
    if (id) Object.assign(state.templates.find(t => t.id === id), draft);
    else state.templates.push({ id: 't_' + uid(), ...draft });
    save();
    toast('Template saved');
    reopenSheet(ui.sheet.back);
    render();
  },
  tplDelete() {
    const { id, back } = ui.sheet;
    const t = state.templates.find(x => x.id === id);
    withUndo(`Deleted ${t.name}`, () => { state.templates = state.templates.filter(x => x.id !== id); save(); });
    reopenSheet(back);
    render();
  },
  saveTplSheet() { openSheet({ type: 'saveTpl' }); },
  tplSaveFromWorkout() {
    const w = state.activeWorkout;
    const name = $('#newTplName').value.trim();
    if (!name) { toast('Give it a name'); $('#newTplName').focus(); return; }
    const t = { id: 't_' + uid(), splitId: w.dayType, name, exercises: tplExercises(w) };
    state.templates.push(t);
    w.templateId = t.id;
    w.templateName = t.name;
    save();
    closeSheet();
    render();
    toast(`Saved “${name}”`);
  },
  tplUpdateFromWorkout() {
    const w = state.activeWorkout;
    const t = state.templates.find(x => x.id === w.templateId);
    t.exercises = tplExercises(w);
    save();
    closeSheet();
    toast(`Updated “${t.name}”`);
  },
  moveEx(el) {
    const ex = state.activeWorkout.exercises;
    const i = ui.sheet.ei;
    const j = i + +el.dataset.d;
    if (j < 0 || j >= ex.length) return;
    [ex[i], ex[j]] = [ex[j], ex[i]];
    ui.sheet.ei = j;
    refreshPlan();
    render();
  },
  picker() { openSheet({ type: 'picker' }); },
  pick(el) {
    if (state.activeWorkout.exercises.some(e => e.exId === el.dataset.id) && !confirm('Already added. Add it again?')) return;
    addExercise(el.dataset.id);
  },
  customSheet() { openSheet({ type: 'custom' }); },
  saveCustom() {
    const name = $('#cName').value.trim();
    if (!name) { $('#cName').focus(); return; }
    const ex = {
      id: 'c_' + uid(), name, muscle: $('#cMuscle').value, equipment: $('#cEquip').value, compound: $('#cCompound').checked, custom: true,
      ...($('#cRegion').value ? { mainRegion: $('#cRegion').value } : {}),
    };
    state.customExercises.push(ex);
    save();
    addExercise(ex.id);
  },

  // Updates the input in place so press-and-hold can keep stepping.
  step(el) {
    const c = setCtx(el);
    const f = el.dataset.f;
    const d = +el.dataset.d;
    if (f === 'weight') {
      const inc = increment(c.ex);
      const base = c.s.weight ?? c.s.target?.weight ?? 0;
      c.s.weight = Math.max(0, Math.round((base + d * inc) / inc) * inc);
      retarget(c);
    } else {
      const base = c.s.reps ?? c.s.target?.reps ?? 0;
      c.s.reps = Math.max(0, base + d);
    }
    save();
    const input = c.row.querySelector(`[data-field="${f}"]`);
    input.value = f === 'weight' ? fmtW(c.s.weight) : c.s.reps;
    input.classList.remove('bump');
    void input.offsetWidth;
    input.classList.add('bump');
    syncRow(c.row, c.s);
    navigator.vibrate?.(4);
  },
  done(el) {
    const c = setCtx(el);
    let pr = false;
    if (!c.s.done) {
      if (c.s.reps == null) c.s.reps = c.s.target?.reps ?? null;
      if (c.s.weight == null) c.s.weight = c.s.target?.weight ?? (isBW(c.ex) ? 0 : null);
      if (c.s.reps == null || c.s.reps <= 0) { toast('Enter reps first'); return; }
      if (c.s.weight == null && !isBW(c.ex)) { toast('Enter weight first'); return; }
      c.s.done = true;
      if (c.ctx === 'active' && !c.s.warmup) {
        const best = bestBefore(c);
        pr = best != null && epley(loadOf(c.ex, c.s.weight), c.s.reps) > best + 0.01;
      }
      c.s.pr = pr;
      if (c.ctx === 'active') { unlockAudio(); afterSet(c); }
      if (c.ctx === 'active' && !c.s.warmup && !c.e.suggestion && calibrate(c)) { save(); refreshCard(c.card); return; }
    } else {
      c.s.done = false;
      c.s.pr = false;
    }
    save();
    refreshRow(c.row);
    const row = c.card.querySelector(`.set-row[data-s="${c.row.dataset.s}"]`);
    if (c.s.done) row?.classList.add('just-done');
    if (pr) {
      prToast(`${c.ex.name}: ${weightLabel(c.ex, c.s.weight)} × ${c.s.reps}`);
      navigator.vibrate?.([30, 40, 30]);
    }
    c.card.classList.toggle('complete', cardComplete(c.e));
    updateProgress();
  },
  platesSheet(el) {
    const c = setCtx(el);
    const s = c.e.sets.find(x => !x.done) || c.e.sets.at(-1);
    const kg = isKg(U());
    openSheet({ type: 'plates', exId: c.e.exId, weight: s?.weight ?? s?.target?.weight ?? (kg ? 60 * LB_PER_KG : 135), bar: kg ? 20 : 45 });
  },
  platesStep(el) {
    const step = isKg(U()) ? 2.5 * LB_PER_KG : 5;
    ui.sheet.weight = Math.max(0, Math.round((ui.sheet.weight + +el.dataset.d * step) / step) * step);
    renderSheet();
  },
  platesBar(el) { ui.sheet.bar = +el.dataset.v; renderSheet(); },
  closeCelebrate() { document.querySelector('.celebrate')?.remove(); },
  chartPt(el) {
    const info = $('#chartInfo');
    const p = ui.chartPoints?.[+el.dataset.i];
    if (!info || !p) return;
    document.querySelectorAll('.chart .pt').forEach(n => n.classList.toggle('sel', n.dataset.i === el.dataset.i));
    info.innerHTML = `<b>${fmtDate(new Date(p.x).toISOString())}</b> · ${Math.round(p.y).toLocaleString()} ${ui.chartUnit || wu()}<br><span class="muted">${esc(p.info || '')}</span>`;
    info.classList.add('on');
  },
  accent(el) { state.settings.accent = el.dataset.v; save(); applyTheme(); renderSheet(); },
  // Display-only switch: stored weights stay in lb, so nothing is rewritten.
  setUnits(el) { state.settings.units = el.dataset.v; save(); renderSheet(); render(); },
  weeklyTarget(el) { state.settings.weeklyTarget = +el.dataset.v; save(); render(); },
  setStandards(el) { state.settings.standards = el.dataset.v; save(); render(); },
  undo() {
    if (!undoSnap) return;
    replaceState(JSON.parse(undoSnap));
    undoSnap = null;
    document.querySelector('.undo-toast')?.remove();
    applyTheme();
    render();
  },

  // Exercise menu
  exMenu(el) { openSheet({ type: 'exmenu', ei: +el.closest('.ex-card').dataset.e }); },
  saveNote() {
    const e = state.activeWorkout.exercises[ui.sheet.ei];
    setExSetting(e.exId, 'note', $('#exNote').value.trim() || undefined);
    closeSheet();
    render();
    toast('Note saved');
  },
  setStep(el) {
    const e = state.activeWorkout.exercises[ui.sheet.ei];
    setExSetting(e.exId, 'increment', +el.dataset.v);
    // Nothing logged yet: rebuild the suggestion with the new step.
    if (!e.sets.some(s => s.done)) {
      e.suggestion = suggestionFor(exercise(e.exId), fatigueAt(state.activeWorkout, ui.sheet.ei, true), e.zone);
      e.sets = setsFrom(e.suggestion);
      save();
    }
    renderSheet();
    render();
  },
  addWarmups() {
    const e = state.activeWorkout.exercises[ui.sheet.ei];
    const ex = exercise(e.exId);
    const first = e.sets.find(s => !s.warmup);
    const work = first?.weight ?? first?.target?.weight;
    const ws = warmupSets(ex, work, increment(ex), isKg(U()) ? 20 * LB_PER_KG : 45);
    if (!ws.length) { toast(work ? 'Too light for warm-ups' : 'Set a working weight first'); return; }
    e.sets = [...ws.map(x => ({ weight: x.weight, reps: x.reps, target: null, done: false, warmup: true })), ...e.sets.filter(s => !s.warmup || s.done)];
    save();
    closeSheet();
    render();
  },
  swapSheet() { openSheet({ type: 'swap', ei: ui.sheet.ei }); },
  doSwap(el) {
    const w = state.activeWorkout;
    const i = ui.sheet.ei;
    const old = w.exercises[i];
    const oldEx = exercise(old.exId);
    const work = old.sets.find(s => !s.warmup)?.weight ?? old.suggestion?.weight;
    const keepOld = old.sets.some(s => s.done);
    const at = keepOld ? i + 1 : i; // a replaced lift doesn't count as earlier work
    const entry = buildEntry(el.dataset.id, { ex: oldEx, weight: work }, fatigueFor(el.dataset.id, at), old.zone);
    entry.group = old.group;
    learnFromWorkoutEdit(old.exId, el.dataset.id);
    if (keepOld) w.exercises.splice(at, 0, entry);
    else w.exercises[i] = entry;
    refreshPlan();
    closeSheet();
    render();
  },
  supersetSheet() { openSheet({ type: 'superset', ei: ui.sheet.ei }); },
  doSuperset(el) {
    const w = state.activeWorkout;
    const e = w.exercises[ui.sheet.ei];
    const partner = w.exercises[+el.dataset.i];
    const g = e.group || partner.group || uid();
    // Merge partner's whole group into this one, then keep the group together.
    const moving = partner.group ? w.exercises.filter(x => x.group === partner.group) : [partner];
    moving.forEach(x => { x.group = g; });
    e.group = g;
    w.exercises = w.exercises.filter(x => !moving.includes(x));
    const lastIdx = w.exercises.map(x => x.group).lastIndexOf(g);
    w.exercises.splice(lastIdx + 1, 0, ...moving);
    refreshPlan();
    closeSheet();
    render();
  },
  unSuperset() {
    const w = state.activeWorkout;
    const e = w.exercises[ui.sheet.ei];
    const g = e.group;
    delete e.group;
    const rest = w.exercises.filter(x => x.group === g);
    if (rest.length === 1) delete rest[0].group;
    save();
    closeSheet();
    render();
  },
  removeExMenu() {
    const w = state.activeWorkout;
    const name = exercise(w.exercises[ui.sheet.ei].exId).name;
    const gone = w.exercises[ui.sheet.ei].exId;
    withUndo(`Removed ${name}`, () => { learnFromWorkoutEdit(gone, null); w.exercises.splice(ui.sheet.ei, 1); refreshPlan(); });
    closeSheet();
    render();
  },

  // Safety note and 'This hurt'
  safetyOk() { state.settings.safetyAck = new Date().toISOString(); save(); closeSheet(); render(); },
  hurtSheet() { openSheet({ type: 'hurt', ei: ui.sheet.ei }); },
  hurtSwap() { openSheet({ type: 'swap', ei: ui.sheet.ei }); },
  hurtAvoid() {
    const w = state.activeWorkout;
    const i = ui.sheet.ei;
    const e = w.exercises[i];
    const ex = exercise(e.exId);
    state.settings.painFlags = { ...(state.settings.painFlags || {}), [e.exId]: new Date().toISOString() };
    if (state.plan) state.plan = dropFromBlock(state.plan, e.exId, { ...planCtx(), blocked: blocked() });
    // Swap it out now: a replacement for the same area if nothing is logged yet,
    // otherwise keep the logged sets and drop the rest.
    const inWorkout = w.exercises.map(x => x.exId);
    const fallbackPlan = state.plan || { profile: { equipment: 'gym', level: 'intermediate' } };
    const repl = replacementFor(e.exId, { plan: fallbackPlan, exercises: allExercises(), lookup: exercise, blocked: blocked(), usage: usageCounts(), exclude: inWorkout });
    let msg = `${ex.name} is kept out of your plans`;
    if (!e.sets.some(s => s.done)) {
      if (repl) { replaceEntry(i, repl.id); msg = `Swapped for ${repl.name}. ${msg}`; } else w.exercises.splice(i, 1);
    } else {
      e.sets = e.sets.filter(s => s.done);
    }
    refreshPlan();
    closeSheet();
    render();
    toast(msg);
  },
  unpain(el) {
    const flags = { ...(state.settings.painFlags || {}) };
    delete flags[el.dataset.id];
    state.settings.painFlags = flags;
    save();
    renderSheet();
  },
  unexclude(el) { state.plan = unexclude(state.plan, el.dataset.id); save(); renderSheet(); },
  readinessToggle() { state.settings.readinessCheck = state.settings.readinessCheck === false; save(); renderSheet(); },
  deletePlan() {
    if (!confirm('Delete your weekly plan? Your workout history stays.')) return;
    withUndo('Plan deleted', () => { state.plan = null; save(); });
    closeSheet();
    render();
  },

  // Weekly plan
  whySheet() { openSheet({ type: 'why' }); },
  planSetup() {
    if (!ui.setup || ui.sheet?.type !== 'setup') ui.setup = setupDraft();
    openSheet({ type: 'setup' });
  },
  suDay(el) {
    const d = ui.setup;
    const v = +el.dataset.v;
    if (d.days.includes(v)) d.days = d.days.filter(x => x !== v);
    else if (d.days.length >= 6) { toast('Keep at least one rest day'); return; }
    else d.days = [...d.days, v].sort((a, b) => a - b);
    renderSheet();
  },
  suMin(el) { ui.setup.minutes = +el.dataset.v; renderSheet(); },
  suLevel(el) { ui.setup.level = el.dataset.v; renderSheet(); },
  suGoal(el) { ui.setup.goal = el.dataset.v; renderSheet(); },
  suEquip(el) { ui.setup.equipment = el.dataset.v; renderSheet(); },
  suPri(el) {
    const d = ui.setup;
    const m = el.dataset.v;
    if (d.priority.includes(m)) d.priority = d.priority.filter(x => x !== m);
    else if (d.priority.length >= 2) { toast('Pick up to 2 — more priorities means none stand out'); return; }
    else d.priority = [...d.priority, m];
    renderSheet();
  },
  suAvoidAdd() {
    const id = $('#suAvoid')?.value;
    if (id && !ui.setup.avoid.includes(id)) ui.setup.avoid.push(id);
    renderSheet();
  },
  suAvoidDel(el) { ui.setup.avoid = ui.setup.avoid.filter(x => x !== el.dataset.v); renderSheet(); },
  suActAdd() {
    const name = $('#suActName').value.trim();
    if (!name) { toast('Name the activity'); $('#suActName').focus(); return; }
    ui.setup.activities.push({ name, day: +$('#suActDay').value, legs: $('#suActLegs').checked });
    renderSheet();
  },
  suActDel(el) { ui.setup.activities.splice(+el.dataset.i, 1); renderSheet(); },
  suSplit(el) { ui.setup.splitId = el.dataset.v; renderSheet(); },
  suBack() { ui.setup.step = Math.max(0, ui.setup.step - 1); renderSheet(); },
  suNext() {
    const d = ui.setup;
    if (d.step === 0 && d.days.length < 2) { toast('Pick at least 2 days'); return; }
    d.step += 1;
    renderSheet();
    $('#sheet .panel')?.scrollTo(0, 0);
  },
  suCreate() {
    const d = ui.setup;
    if (!d.splitId) { toast('Pick a split'); return; }
    if (state.plan && !confirm('Start a new plan? Your history stays; the new plan starts block 1 this week.')) return;
    const profile = setupProfile(d);
    const plan = createPlan({
      profile, splitId: d.splitId, exercises: allExercises(), usage: usageCounts(), workouts: state.workouts, lookup: exercise,
      blocked: blockedLifts(state.settings, { profile, excluded: state.plan?.excluded || [] }),
    });
    // Learned exclusions carry over to a new plan.
    plan.excluded = [...(state.plan?.excluded || [])];
    state.plan = plan;
    save();
    ui.setup = null;
    ui.tab = 'plan';
    closeSheet();
    render(true);
    window.scrollTo(0, 0);
    toast('Your plan is ready 🗓️');
  },
  planSession(el) { openSheet({ type: 'planSession', seq: +el.dataset.seq, scope: ui.planScope || 'week' }); },
  planScope(el) { ui.planScope = ui.sheet.scope = el.dataset.v; renderSheet(); },
  planSwapSheet(el) { openSheet({ type: 'planSwap', seq: ui.sheet.seq, i: +el.dataset.i, scope: ui.sheet.scope }); },
  planDoSwap(el) { applyPlanEdit(ui.sheet.seq, ui.sheet.i, 'swap', el.dataset.id); },
  planRemove(el) { applyPlanEdit(ui.sheet.seq, +el.dataset.i, 'remove'); },
  planStart(el) {
    const seq = +el.dataset.seq;
    if (state.activeWorkout) { toast('Finish or discard your current workout first'); ui.tab = 'workout'; closeSheet(); render(); return; }
    if (state.settings.readinessCheck !== false) { ui.ready = { sleep: 'ok', soreness: 'some', energy: 'ok' }; openSheet({ type: 'readiness', kind: 'plan', seq }); return; }
    startPlanned(seq, null);
  },
  openWorkoutFromPlan(el) { ui.tab = 'history'; ui.historyId = el.dataset.id; render(true); window.scrollTo(0, 0); },
  planDaysSheet() {
    const wk = String(planWeekKey(Date.now()));
    openSheet({ type: 'planDays', days: [...(state.plan.weekDays?.[wk] || state.plan.profile.days)] });
  },
  pdDay(el) {
    const v = +el.dataset.v;
    const s = ui.sheet;
    s.days = s.days.includes(v) ? s.days.filter(x => x !== v) : [...s.days, v].sort((a, b) => a - b);
    renderSheet();
  },
  pdSave() {
    if (!ui.sheet.days.length) { toast('Pick at least one day, or pause the plan'); return; }
    state.plan = setWeekDays(state.plan, ui.sheet.days);
    save();
    closeSheet();
    render();
    toast('Days updated for this week');
  },
  planPauseSheet() { openSheet({ type: 'planPause' }); },
  ppFor(el) { pauseUntil(new Date(startOfDay(Date.now()) + +el.dataset.v * DAY)); },
  ppDate() {
    const v = $('#ppDate').value;
    if (!v || v < todayStr()) { toast('Pick a date from today on'); return; }
    pauseUntil(new Date(v + 'T00:00:00'));
  },
  planResume() { state.plan = resumePlan(state.plan); save(); render(); toast('Plan resumed'); },

  // Readiness check
  readySet(el) { ui.ready[el.dataset.k] = el.dataset.v; renderSheet(); },
  readyGo() { startFromReadiness({ ...ui.ready }); },
  readySkip() { startFromReadiness(null); },
  readyOff() { state.settings.readinessCheck = false; save(); toast('Turn it back on in Settings'); startFromReadiness(null); },

  // Block review
  reviewSheet() {
    ui.review = runReview(state.plan, { workouts: state.workouts, lookup: exercise, bwOn: bodyweightOn, exercises: allExercises(), usage: usageCounts(), blocked: blocked(), secPerSet: pace() });
    ui.reviewAcc = { volume: {}, swaps: [] };
    openSheet({ type: 'review' });
  },
  rvVol(el) { const a = ui.reviewAcc.volume; a[el.dataset.k] = a[el.dataset.k] === false; renderSheet(); },
  rvSwap(el) { const a = ui.reviewAcc.swaps; a[+el.dataset.k] = a[+el.dataset.k] === false; renderSheet(); },
  reviewApprove() {
    const no = (state.plan.blockNo || 1) + 1;
    state.plan = approveReview(state.plan, ui.review, ui.reviewAcc);
    save();
    ui.review = null;
    closeSheet();
    render(true);
    toast(`Block ${no} starts now 💪`);
  },
  reviewLater() { state.plan = postponeReview(state.plan); save(); closeSheet(); render(); },

  // Template swap offers (today only)
  offerAccept(el) {
    const w = state.activeWorkout;
    const o = w.swapOffers.find(x => x.uid === el.dataset.uid);
    const i = w.exercises.findIndex(e => e.uid === o?.uid && e.exId === o.from);
    if (i < 0) return;
    replaceEntry(i, o.to);
    w.swapOffers = w.swapOffers.filter(x => x !== o);
    refreshPlan();
    render();
  },
  offerAll() {
    const w = state.activeWorkout;
    for (const o of [...w.swapOffers]) {
      const i = w.exercises.findIndex(e => e.uid === o.uid && e.exId === o.from);
      if (i >= 0) replaceEntry(i, o.to);
    }
    w.swapOffers = [];
    refreshPlan();
    render();
  },
  offerDismiss() { state.activeWorkout.swapOffers = []; save(); render(); },

  // Home
  startDeload() {
    state.settings.deloadUntil = new Date(Date.now() + 7 * DAY).toISOString();
    save();
    toast('Deload week started 🧘');
    render();
  },
  endDeload() { state.settings.deloadUntil = null; save(); render(); },
  dismissDeload() { state.settings.deloadDismissed = new Date().toISOString(); save(); render(); },

  // Progress
  progressView(el) { ui.progressView = el.dataset.v; render(true); },

  // Builder
  buildSheet() { ui.build.error = null; openSheet({ type: 'build' }); },
  bMode(el) { ui.build.mode = el.dataset.v; ui.build.error = null; renderSheet(); },
  bUnit(el) { ui.build.unit = el.dataset.v; ui.build.error = null; renderSheet(); },
  bStep(el) {
    const b = ui.build;
    const d = +el.dataset.d;
    if (b.unit === 'sets') b.sets = Math.max(4, Math.min(60, b.sets + d * 2));
    else b.minutes = Math.max(15, Math.min(180, b.minutes + d * 5));
    b.error = null;
    renderSheet();
  },
  bMuscle(el) {
    const b = ui.build;
    const m = el.dataset.v;
    b.muscles = b.muscles.includes(m) ? b.muscles.filter(x => x !== m) : [...b.muscles, m];
    b.error = null;
    renderSheet();
  },
  doBuild() { ui.build.seed = 0; runBuild(); },
  bRaise() { const b = ui.build; b.unit = 'sets'; b.sets = b.muscles.length * 4; runBuild(); },
  bKeepTop() { const b = ui.build; b.muscles = b.error.ranked.slice(0, b.error.fit); runBuild(); },
  bpRegen() { ui.build.seed += 1; runBuild(); },
  bpBack() { openSheet({ type: 'build' }); },
  bpSwap(el) {
    const p = ui.build.plan;
    const it = p.items[+el.dataset.i];
    const inPlan = new Set(p.items.map(x => x.exId));
    const counts = usageCounts();
    ui.build.swapped = ui.build.swapped || {};
    const tried = (ui.build.swapped[it.muscle] ||= new Set());
    tried.add(it.exId);
    // Same muscle, not already in the workout; prefer the same region, then familiar lifts.
    let options = allExercises().filter(x => x.muscle === it.muscle && !inPlan.has(x.id) && !tried.has(x.id));
    if (!options.length) { tried.clear(); tried.add(it.exId); options = allExercises().filter(x => x.muscle === it.muscle && !inPlan.has(x.id)); }
    if (!options.length) { toast('No other exercises for this muscle'); return; }
    options.sort((a, b) => ((exerciseRegions(b)[it.region] || 0) - (exerciseRegions(a)[it.region] || 0)) || ((counts[b.id] || 0) - (counts[a.id] || 0)));
    const next = options[0];
    Object.assign(it, { exId: next.id, region: primaryRegion(next), reason: 'Swapped in', isNew: !counts[next.id] });
    renderSheet();
  },
  bpRemove(el) {
    const p = ui.build.plan;
    p.items.splice(+el.dataset.i, 1);
    p.totalSets = p.items.reduce((s, x) => s + x.sets, 0);
    p.muscles = p.muscles.filter(m => p.items.some(x => x.muscle === m));
    renderSheet();
  },
  bpStart() {
    const p = ui.build.plan;
    if (!p?.items.length) return;
    startWorkout(CUSTOM_SPLIT.id, { exercises: p.items.map(i => ({ exId: i.exId, sets: i.sets })) }, null, 'Built workout');
  },
  bpSave() {
    const name = $('#bpName').value.trim();
    if (!name) { toast('Give it a name'); $('#bpName').focus(); return; }
    const p = ui.build.plan;
    state.templates.push({ id: 't_' + uid(), splitId: CUSTOM_SPLIT.id, name, exercises: p.items.map(i => ({ exId: i.exId, sets: i.sets })) });
    save();
    toast(`Saved “${name}”`);
  },

  // Neglected regions
  snoozeRegion(el) {
    state.settings.neglectSnooze = { ...state.settings.neglectSnooze, [el.dataset.r]: new Date(Date.now() + 7 * DAY).toISOString() };
    save();
    toast('Snoozed for a week');
    render();
  },
  ignoreRegion(el) {
    const r = el.dataset.r;
    withUndo(`Stopped tracking ${REGIONS[r].name.toLowerCase()}`, () => {
      state.settings.ignoredRegions = [...new Set([...state.settings.ignoredRegions, r])];
      save();
    });
    render();
  },
  unignoreRegion(el) {
    state.settings.ignoredRegions = state.settings.ignoredRegions.filter(r => r !== el.dataset.r);
    save();
    renderSheet();
    render();
  },
  // One tip per workout: adding the suggestion also retires the tip.
  tipAdd(el) { state.activeWorkout.tipDismissed = true; addExercise(el.dataset.id); },
  tipDismiss() { state.activeWorkout.tipDismissed = true; save(); render(); },
  range(el) {
    ui.ranges[el.dataset.k] = el.dataset.v;
    try { localStorage.setItem('liftlog.ranges', JSON.stringify(ui.ranges)); } catch { /* per-device nicety only */ }
    render();
  },
  recapNav(el) { ui.recapOffset = Math.min(0, (ui.recapOffset || 0) + +el.dataset.d); render(); },

  // Sharing
  async shareWorkout(el) {
    const w = state.workouts.find(x => x.id === el.dataset.id);
    if (!w) return;
    const dt = dayType(w.dayType);
    const sets = w.exercises.reduce((n, e) => n + workingSets(e).length, 0);
    const mins = Math.max(1, Math.round((new Date(w.finishedAt || w.date) - new Date(w.date)) / 60000));
    const lifts = w.exercises.map(e => {
      const ex = exercise(e.exId);
      const ws = workingSets(e);
      const score = s => epley(loadOf(ex, s.weight, w.date), s.reps);
      const top = ws.reduce((b, s) => (!b || score(s) > score(b) ? s : b), null);
      return [ex.name, top ? `${weightLabel(ex, top.weight)} × ${top.reps}${ws.length > 1 ? ` · ${ws.length} sets` : ''}` : '', ws.some(s => s.pr)];
    });
    const blob = await workoutCard({
      color: dt.color, icon: dt.icon, title: dt.name, date: fmtDate(w.date),
      stats: [[String(mins), 'minutes'], [String(sets), 'sets'], [fmtK(toDisplay(workoutVolume(w), U())), `${wu()} moved`]],
      lifts, footer: 'Logged with LiftLog',
    });
    document.querySelector('.celebrate')?.remove();
    openSheet({ type: 'share', blob, url: URL.createObjectURL(blob), name: `liftlog-${w.date.slice(0, 10)}.png` });
  },
  async doShare() {
    const s = ui.sheet;
    try { await shareOrDownload(s.blob, s.name, 'My workout'); } catch (e) { if (e.name !== 'AbortError') toast('Could not share'); }
  },

  // Health
  healthView(el) { ui.healthView = el.dataset.v; render(true); },
  measureKind(el) { ui.measureKind = el.dataset.v; render(); },
  saveMeasure() {
    const kind = $('#mKind').value;
    const raw = parseFloat($('#mValue').value);
    const value = kind === 'bodyfat' ? raw : fromLength(raw, U());
    const date = $('#mDate').value || todayStr();
    if (!(value > 0 && value < 200)) { toast('Enter a value'); return; }
    const existing = state.measurements.find(m => m.kind === kind && m.date === date);
    if (existing) existing.value = value;
    else state.measurements.push({ id: uid(), date, kind, value });
    ui.measureKind = kind;
    save();
    toast('Saved');
    render();
  },
  delMeasure(el) {
    withUndo('Entry deleted', () => { state.measurements = state.measurements.filter(m => m.id !== el.dataset.id); save(); });
    render();
  },
  healthImportSheet() { openSheet({ type: 'healthImport' }); },
  async openPhoto(el) {
    const id = el.dataset.id;
    const blob = await photoBlob(id);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    if (ui.compareFrom && ui.compareFrom.id !== id) {
      const a = ui.compareFrom;
      ui.compareFrom = null;
      const items = [a, { id, date: el.dataset.date, url }].sort((x, y) => x.date.localeCompare(y.date));
      openSheet({ type: 'compare', items });
      return;
    }
    openSheet({ type: 'photo', id, date: el.dataset.date, url });
  },
  cancelCompare() { ui.compareFrom = null; render(); },
  comparePick() {
    ui.compareFrom = { id: ui.sheet.id, date: ui.sheet.date, url: ui.sheet.url };
    closeSheet();
    toast('Now tap another photo to compare');
  },
  async deletePhoto() {
    if (!confirm('Delete this photo? This can’t be undone.')) return;
    await deletePhoto(ui.sheet.id);
    closeSheet();
    render();
  },
  warmup(el) {
    const c = setCtx(el);
    c.s.warmup = !c.s.warmup;
    save();
    refreshCard(c.card);
  },
  addSet(el) {
    const c = setCtx(el);
    const prev = c.e.sets.at(-1);
    const si = c.e.sets.length;
    const ns = { weight: prev?.weight ?? null, reps: null, target: null, done: false };
    if (c.ctx === 'active' && c.e.suggestion && ns.weight != null) {
      const reps = targetFor(c.e.suggestion, c.ex, ns.weight, si, bodyweightOn());
      if (reps) ns.target = { weight: ns.weight, reps };
    } else if (prev?.target) {
      ns.target = { ...prev.target };
    }
    c.e.sets.push(ns);
    save();
    // More sets here means more fatigue for the lifts after it.
    if (c.ctx === 'active') { refreshPlan(); render(); } else refreshCard(c.card);
  },
  removeSet(el) {
    const c = setCtx(el);
    if (c.e.sets.length <= 1) { toast('Remove the exercise from its menu instead'); return; }
    withUndo('Set removed', () => { c.e.sets.pop(); save(); });
    if (c.ctx === 'active') { refreshPlan(); render(); } else refreshCard(c.card);
  },
  removeEx(el) {
    const c = setCtx(el);
    withUndo(`Removed ${c.ex.name}`, () => {
      c.w.exercises.splice(+c.card.dataset.e, 1);
      if (c.ctx !== 'active' && !c.w.exercises.length) {
        state.workouts = state.workouts.filter(w => w !== c.w);
        ui.historyId = null;
      }
      if (c.ctx === 'active') refreshPlan();
      save();
    });
    render();
  },
  feel(el) {
    const c = setCtx(el);
    c.e.difficulty = el.dataset.v;
    save();
    c.card.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b === el));
  },
  restSheet(el) { openSheet({ type: 'rest', exId: setCtx(el).e.exId }); },
  setRest(el) { applyRest(+el.dataset.v); },
  setRestCustom() { applyRest(parseInt($('#restCustom').value, 10)); },
  timerAdj(el) { adjustTimer(+el.dataset.d); },
  timerStop() { stopTimer(); },

  finishSheet() { openSheet({ type: 'finish' }); },
  finish() { finishWorkout(); },
  discard() {
    if (!confirm('Discard this workout? Nothing from it will be saved.')) return;
    withUndo('Workout discarded', () => { state.activeWorkout = null; save(); });
    stopTimer();
    releaseWakeLock();
    closeSheet();
    render();
  },

  openWorkout(el) { ui.historyId = el.dataset.id; render(); window.scrollTo(0, 0); },
  histBack() { ui.historyId = null; render(); },
  deleteWorkout() {
    withUndo('Workout deleted', () => { state.workouts = state.workouts.filter(w => w.id !== ui.historyId); save(); });
    ui.historyId = null;
    render();
  },

  metric(el) { ui.progressMetric = el.dataset.v; render(); },

  saveBW() {
    const lb = fromDisplay(parseFloat($('#bwInput').value), U());
    const date = $('#bwDate').value || todayStr();
    if (!(lb > 50 && lb < 700)) { toast(`Enter a weight in ${wu()}`); return; }
    const existing = state.bodyweight.find(b => b.date === date);
    if (existing) existing.lb = lb;
    else state.bodyweight.push({ id: uid(), date, lb });
    save();
    toast('Weight saved');
    render();
  },
  delBW(el) {
    withUndo('Entry deleted', () => { state.bodyweight = state.bodyweight.filter(b => b.id !== el.dataset.id); save(); });
    render();
  },

  defaultRest(el) { state.settings.defaultRest = +el.dataset.v; save(); renderSheet(); },
  export() { exportBackup(); },
  import() { $('#importFile').click(); },
  wipe() {
    if (!confirm('Delete ALL workouts, bodyweight and settings from this phone?')) return;
    if (!confirm('Are you sure? This cannot be undone unless you have a backup.')) return;
    replaceState({});
    closeSheet();
    render();
  },
};

function applyRest(secs) {
  if (!(secs >= 10 && secs <= 900)) { toast('Pick 10–900 seconds'); return; }
  state.exerciseSettings[ui.sheet.exId] = { ...(state.exerciseSettings[ui.sheet.exId] || {}), rest: secs };
  save();
  closeSheet();
  render();
}

document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.disabled) return;
  // A press-and-hold already stepped; skip the click that follows it.
  if (el.dataset.act === 'step' && hold.repeated) { hold.repeated = false; return; }
  const fn = actions[el.dataset.act];
  if (fn) { ev.preventDefault(); fn(el); }
});

// Press and hold a +/− button to keep stepping.
const hold = { timer: null, interval: null, repeated: false };
function endHold() {
  clearTimeout(hold.timer);
  clearInterval(hold.interval);
  hold.timer = hold.interval = null;
}
document.addEventListener('pointerdown', ev => {
  const el = ev.target.closest('[data-act="step"]');
  if (!el) return;
  hold.repeated = false;
  endHold();
  hold.timer = setTimeout(() => {
    hold.interval = setInterval(() => { hold.repeated = true; actions.step(el); }, 110);
  }, 420);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(t => document.addEventListener(t, endHold, true));

document.addEventListener('input', ev => {
  const el = ev.target;
  if (el.id === 'pickerSearch') { $('#pickerList').innerHTML = pickerList(el.value); return; }
  // Keep typed names in the draft so re-rendering the sheet doesn't lose them.
  if (el.id === 'spName' || el.id === 'tplName') { ui.sheet.draft.name = el.value; return; }
  const f = el.dataset.field;
  if (f === 'weight' || f === 'reps') {
    const c = setCtx(el);
    let v = el.value.trim() === '' ? null : parseFloat(el.value);
    if (f === 'weight' && v != null && !Number.isNaN(v)) v = fromDisplay(v, U());
    if (v != null && Number.isNaN(v)) return;
    c.s[f] = v;
    if (f === 'weight') retarget(c);
    save();
    syncRow(c.row, c.s);
  }
});

// Update a row's goal/miss state in place. Replacing the row here would
// steal focus from the input the user is moving to.
function syncRow(row, s) {
  const status = setStatus(s);
  row.classList.toggle('miss', status === 'miss');
  row.classList.toggle('near', status === 'near');
  const reps = row.querySelector('[data-field="reps"]');
  reps.placeholder = s.target ? s.target.reps : 'reps';
  let goal = row.querySelector('.goal');
  if (s.target && !goal) {
    goal = document.createElement('div');
    goal.className = 'goal';
    row.appendChild(goal);
  }
  if (goal) goal.textContent = goalText(s);
}

document.addEventListener('change', async ev => {
  const el = ev.target;
  if (el.dataset.field === 'progressEx') { ui.progressEx = el.value; render(); return; }
  if (el.id === 'cMuscle') { $('#cRegion').innerHTML = regionOptions(el.value); return; }
  if (el.id === 'photoInput' && el.files[0]) {
    const file = el.files[0];
    el.value = '';
    toast('Saving photo…');
    try {
      await addPhoto(file, $('#photoDate')?.value || todayStr(), uid());
      render();
    } catch (e) {
      alert('Could not save photo: ' + e.message);
    }
    return;
  }
  if (el.id === 'healthFile' && el.files[0]) {
    const file = el.files[0];
    el.value = '';
    const prog = $('#importProg');
    try {
      const data = await readHealthExport(file, f => { if (prog) prog.textContent = `Reading… ${Math.round(f * 100)}%`; });
      let added = 0;
      const haveBW = new Set(state.bodyweight.map(b => b.date));
      for (const [date, lb] of Object.entries(data.weight || {})) {
        if (!haveBW.has(date) && lb > 50 && lb < 700) { state.bodyweight.push({ id: uid(), date, lb }); added++; }
      }
      for (const kind of ['bodyfat', 'waist']) {
        const have = new Set(state.measurements.filter(m => m.kind === kind).map(m => m.date));
        for (const [date, value] of Object.entries(data[kind] || {})) {
          if (!have.has(date)) { state.measurements.push({ id: uid(), date, kind, value }); added++; }
        }
      }
      save();
      closeSheet();
      render();
      toast(added ? `Imported ${added} readings` : 'Nothing new to import');
    } catch (e) {
      if (prog) prog.textContent = 'Could not read that file: ' + e.message;
    }
  }
});

// Select the whole number on focus so typing replaces it.
document.addEventListener('focusin', ev => {
  if (ev.target.matches('.stepper input')) setTimeout(() => ev.target.select(), 0);
});

// ---------- Boot ----------
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
navigator.storage?.persist?.().catch(() => {});
if (state.activeWorkout) { ui.tab = 'workout'; requestWakeLock(); }
applyTheme();
syncAchievements(); // silently record anything already earned
render(true);
if (!state.settings.safetyAck) openSheet({ type: 'safety' });
