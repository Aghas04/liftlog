// Training insights derived from workout history. Pure functions.
//   lookup(exId) -> exercise { muscle, equipment, ... }
//   bwOn(iso)    -> bodyweight in lb on that date, or null
import { workingSets, sessionE1RM, sessionMissed } from './engine.js';
import { REGIONS, MUSCLES, regionsOf, exerciseRegions } from './data.js';

const DAY = 86400000;
const startOfDay = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

export function weekKey(t) {
  const d = new Date(startOfDay(t));
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

const loadOf = (ex, weight, bw) => (ex.equipment === 'bodyweight' ? (bw || 0) + (weight || 0) : weight || 0);

/** Working sets per muscle in workouts on or after sinceIso. */
export function muscleSets(workouts, lookup, sinceIso) {
  const out = {};
  for (const w of workouts) {
    if (sinceIso && w.date < sinceIso) continue;
    for (const e of w.exercises) {
      const m = lookup(e.exId).muscle;
      out[m] = (out[m] || 0) + workingSets(e).length;
    }
  }
  return out;
}

/**
 * Which split to train today, based on how rested each split's muscles are
 * and a nudge away from repeating the last split.
 * Returns null with no history, { rest: true, reason } if already trained
 * today, else { day, reason }.
 */
export function recommendSplit(workouts, lookup, dayTypes, now = Date.now()) {
  if (!workouts.length) return null;
  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  if (new Date(latest.date).getTime() >= startOfDay(now)) {
    return { rest: true, reason: 'You already trained today. Recover and come back tomorrow.' };
  }
  const lastHit = {};
  for (const w of sorted) {
    const t = new Date(w.date).getTime();
    for (const e of w.exercises) if (workingSets(e).length) lastHit[lookup(e.exId).muscle] = t;
  }
  const daysSince = m => (lastHit[m] ? (now - lastHit[m]) / DAY : Infinity);

  let best = null;
  for (const d of dayTypes) {
    const main = d.muscles.filter(m => m !== 'abs');
    const muscles = main.length ? main : d.muscles;
    if (!muscles.length) continue;
    const recov = muscles.reduce((s, m) => s + Math.min(daysSince(m), 4), 0) / muscles.length;
    const lastOfSplit = [...sorted].reverse().find(w => w.dayType === d.id);
    const splitGap = lastOfSplit ? (now - new Date(lastOfSplit.date).getTime()) / DAY : 14;
    const score = recov + Math.min(splitGap, 14) * 0.05 - (latest.dayType === d.id ? 1.5 : 0);
    const freshest = Math.min(...muscles.map(daysSince));
    if (!best || score > best.score) best = { day: d, score, freshest };
  }
  const f = best.freshest;
  const reason = f === Infinity
    ? 'You haven’t trained these muscles yet.'
    : f >= 3
      ? `These muscles last worked ${Math.floor(f)} days ago — fully recovered.`
      : `Most rested option right now (${Math.max(1, Math.floor(f))}+ days since these muscles worked).`;
  return { day: best.day, reason };
}

/** Exercise ids whose recent sessions have stalled or missed targets. */
export function stalledLifts(workouts, lookup, bwOn, now = Date.now()) {
  const since = new Date(now - 42 * DAY).toISOString();
  const byEx = {};
  for (const w of [...workouts].sort((a, b) => a.date.localeCompare(b.date))) {
    if (w.date < since) continue;
    for (const e of w.exercises) {
      if (!workingSets(e).length) continue;
      (byEx[e.exId] ||= []).push({ date: w.date, sets: e.sets });
    }
  }
  const tracked = [];
  const stalled = [];
  for (const [id, sessions] of Object.entries(byEx)) {
    if (sessions.length < 3) continue;
    tracked.push(id);
    const ex = lookup(id);
    const e = sessions.slice(-3).map(s => sessionE1RM(s, ex, bwOn(s.date)));
    const flat = Math.max(e[1], e[2]) <= e[0] * 1.005;
    const missing = sessionMissed(sessions.at(-1)) && sessionMissed(sessions.at(-2));
    if (flat || missing) stalled.push(id);
  }
  return { tracked, stalled };
}

/** Suggest a deload when several tracked lifts have stalled. */
export function deloadAdvice(workouts, lookup, bwOn, now = Date.now()) {
  const { tracked, stalled } = stalledLifts(workouts, lookup, bwOn, now);
  if (stalled.length >= 3 && stalled.length >= tracked.length * 0.4) return { stalled };
  return null;
}

export function longestStreak(workouts) {
  const weeks = [...new Set(workouts.map(w => weekKey(new Date(w.date).getTime())))].sort((a, b) => a - b);
  let best = 0, run = 0, prev = null;
  for (const wk of weeks) {
    run = prev != null && weekKey(prev + 10 * DAY) === wk ? run + 1 : 1;
    best = Math.max(best, run);
    prev = wk;
  }
  return best;
}

export function achievements(workouts, lookup, bwOn) {
  let volume = 0, prSets = 0, early = 0, night = 0;
  const maxW = {};
  const splits = new Set();
  const perWeek = {};
  for (const w of workouts) {
    const bw = bwOn(w.date);
    const hour = new Date(w.date).getHours();
    if (hour < 7) early = 1;
    if (hour >= 21) night = 1;
    if (w.dayType !== 'custom') splits.add(w.dayType);
    const wk = weekKey(new Date(w.date).getTime());
    perWeek[wk] = (perWeek[wk] || 0) + 1;
    for (const e of w.exercises) {
      const ex = lookup(e.exId);
      for (const s of workingSets(e)) {
        volume += loadOf(ex, s.weight, bw) * s.reps;
        if (s.pr) prSets++;
        maxW[e.exId] = Math.max(maxW[e.exId] || 0, s.weight || 0);
      }
    }
  }
  const total = workouts.length;
  const streak = longestStreak(workouts);
  const bestWeek = Math.max(0, ...Object.values(perWeek));
  const w = id => maxW[id] || 0;
  const defs = [
    ['first', '🎉', 'First workout', 'Log your first workout', total, 1],
    ['w10', '💪', '10 workouts', 'Finish 10 workouts', total, 10],
    ['w25', '🏋️', '25 workouts', 'Finish 25 workouts', total, 25],
    ['w50', '⚡', '50 workouts', 'Finish 50 workouts', total, 50],
    ['w100', '👑', '100 workouts', 'Finish 100 workouts', total, 100],
    ['streak4', '🔥', 'On fire', '4-week training streak', streak, 4],
    ['streak8', '☄️', 'Unstoppable', '8-week training streak', streak, 8],
    ['streak12', '🌋', 'Iron habit', '12-week training streak', streak, 12],
    ['week4', '📅', 'Four-day week', '4 workouts in one week', bestWeek, 4],
    ['splits', '🧩', 'Well rounded', 'Train all 5 splits', splits.size, 5],
    ['vol100k', '📦', '100k club', 'Move 100,000 lb in total', volume, 100000],
    ['vol500k', '🚚', '500k club', 'Move 500,000 lb in total', volume, 500000],
    ['vol1m', '🏗️', 'Million-pound club', 'Move 1,000,000 lb in total', volume, 1000000],
    ['pr10', '⭐', 'PR machine', 'Hit 10 PR sets', prSets, 10],
    ['pr50', '🌟', 'PR legend', 'Hit 50 PR sets', prSets, 50],
    ['bench135', '🥉', 'Plate bench', 'Bench press 135 lb', w('bench_press'), 135],
    ['bench225', '🥈', 'Two-plate bench', 'Bench press 225 lb', w('bench_press'), 225],
    ['bench315', '🥇', 'Three-plate bench', 'Bench press 315 lb', w('bench_press'), 315],
    ['squat225', '🦵', 'Two-plate squat', 'Squat 225 lb', w('squat'), 225],
    ['squat315', '🦿', 'Three-plate squat', 'Squat 315 lb', w('squat'), 315],
    ['dl315', '⛓️', 'Three-plate pull', 'Deadlift 315 lb', w('deadlift'), 315],
    ['dl405', '🏆', 'Four-plate pull', 'Deadlift 405 lb', w('deadlift'), 405],
    ['ohp135', '🙌', 'Plate press', 'Overhead press 135 lb', w('overhead_press'), 135],
    ['early', '🌅', 'Early bird', 'Start a workout before 7 am', early, 1],
    ['night', '🌙', 'Night owl', 'Start a workout after 9 pm', night, 1],
  ];
  return defs.map(([id, icon, name, desc, value, goal]) => ({
    id, icon, name, desc, value, goal, earned: value >= goal, progress: Math.min(1, value / goal),
  }));
}

/** Summary for one calendar month (month is 0-based). */
export function monthRecap(workouts, lookup, bwOn, year, month) {
  const start = new Date(year, month, 1).toISOString();
  const end = new Date(year, month + 1, 1).toISOString();
  const prevStart = new Date(year, month - 1, 1).toISOString();
  const inMonth = workouts.filter(w => w.date >= start && w.date < end);
  const vol = list => list.reduce((sum, w) => {
    const bw = bwOn(w.date);
    return sum + w.exercises.reduce((s2, e) => {
      const ex = lookup(e.exId);
      return s2 + workingSets(e).reduce((s3, s) => s3 + loadOf(ex, s.weight, bw) * s.reps, 0);
    }, 0);
  }, 0);
  const volume = vol(inMonth);
  const prevVolume = vol(workouts.filter(w => w.date >= prevStart && w.date < start));
  let sets = 0, prSets = 0;
  const splitCount = {};
  for (const w of inMonth) {
    splitCount[w.dayType] = (splitCount[w.dayType] || 0) + 1;
    for (const e of w.exercises) for (const s of workingSets(e)) { sets++; if (s.pr) prSets++; }
  }
  const favorite = Object.entries(splitCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  // Biggest strength gain this month vs the best before it.
  let improved = null;
  const ids = new Set(inMonth.flatMap(w => w.exercises.map(e => e.exId)));
  for (const id of ids) {
    const ex = lookup(id);
    let before = 0, during = 0;
    for (const w of workouts) {
      for (const e of w.exercises) {
        if (e.exId !== id) continue;
        const v = sessionE1RM(e, ex, bwOn(w.date));
        if (w.date < start) before = Math.max(before, v);
        else if (w.date < end) during = Math.max(during, v);
      }
    }
    if (before > 0 && during > before) {
      const gain = (during - before) / before;
      if (!improved || gain > improved.gain) improved = { exId: id, gain, from: before, to: during };
    }
  }
  return { workouts: inMonth.length, sets, volume, prevVolume, prSets, favorite, improved };
}

const LEVELS = ['Untrained', 'Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite'];
// Rough bodyweight multiples (est. 1RM) to reach Beginner..Elite.
const STANDARDS = {
  male: {
    bench_press: [0.5, 0.75, 1.25, 1.5, 2.0],
    squat: [0.75, 1.25, 1.5, 2.25, 2.75],
    deadlift: [1.0, 1.5, 2.0, 2.5, 3.0],
    overhead_press: [0.35, 0.55, 0.8, 1.05, 1.35],
  },
  female: {
    bench_press: [0.25, 0.5, 0.75, 1.0, 1.5],
    squat: [0.5, 0.75, 1.25, 1.5, 2.0],
    deadlift: [0.5, 1.0, 1.25, 1.75, 2.5],
    overhead_press: [0.2, 0.35, 0.5, 0.75, 1.0],
  },
};

export function strengthLevels(workouts, lookup, bw, standards) {
  const table = STANDARDS[standards];
  if (!table || !bw) return [];
  return Object.entries(table).map(([id, t]) => {
    const ex = lookup(id);
    let e1rm = 0;
    for (const w of workouts) for (const e of w.exercises) if (e.exId === id) e1rm = Math.max(e1rm, sessionE1RM(e, ex, bw));
    if (!e1rm) return null;
    const ratio = e1rm / bw;
    const idx = t.filter(x => ratio >= x).length;
    const nextRatio = t[idx];
    return {
      exId: id, name: ex.name, e1rm, ratio, level: LEVELS[idx], levelIdx: idx,
      pct: Math.min(1, ratio / (t[4] * 1.1)),
      next: nextRatio ? { level: LEVELS[idx + 1], lb: Math.ceil(nextRatio * bw - e1rm) } : null,
    };
  }).filter(Boolean);
}

// ---------- Muscle regions ----------

// A set counts as direct work for a region when the region weight is at least this.
export const DIRECT = 0.75;

/** Effective sets per region in workouts on or after sinceIso (secondary work counts partly). */
export function regionSets(workouts, lookup, sinceIso, untilIso) {
  const out = {};
  for (const w of workouts) {
    if (sinceIso && w.date < sinceIso) continue;
    if (untilIso && w.date >= untilIso) continue;
    for (const e of w.exercises) {
      const n = workingSets(e).length;
      if (!n) continue;
      for (const [r, wt] of Object.entries(exerciseRegions(lookup(e.exId)))) out[r] = (out[r] || 0) + n * wt;
    }
  }
  return out;
}

/** Timestamp of the last direct work per region. */
export function regionLastDirect(workouts, lookup) {
  const out = {};
  for (const w of workouts) {
    const t = new Date(w.date).getTime();
    for (const e of w.exercises) {
      if (!workingSets(e).length) continue;
      for (const [r, wt] of Object.entries(exerciseRegions(lookup(e.exId)))) {
        if (wt >= DIRECT && (!out[r] || t > out[r])) out[r] = t;
      }
    }
  }
  return out;
}

/** Weekly set target per region: the muscle target split by region size. */
export function regionTargets(weeklyTarget) {
  const out = {};
  for (const m of Object.keys(MUSCLES)) {
    const rs = regionsOf(m);
    const total = rs.reduce((s, r) => s + REGIONS[r].size, 0);
    for (const r of rs) out[r] = (weeklyTarget * REGIONS[r].size) / total;
  }
  return out;
}

/**
 * Regions that are being neglected, most urgent first.
 * Flagged when there's been no direct work for 10+ days, or the region got
 * under a third of its share of its muscle's sets over the last 2 weeks.
 * Needs at least a week of history. opts: { now, ignored: [], snoozed: { region: iso } }
 */
export function neglectedRegions(workouts, lookup, opts = {}) {
  const now = opts.now ?? Date.now();
  if (!workouts.length) return [];
  const first = Math.min(...workouts.map(w => new Date(w.date).getTime()));
  const span = (now - first) / DAY;
  if (span < 7) return [];
  const ignored = new Set(opts.ignored || []);
  const snoozed = opts.snoozed || {};
  const targets = regionTargets(opts.weeklyTarget || 10);
  const last = regionLastDirect(workouts, lookup);
  const two = regionSets(workouts, lookup, new Date(now - 14 * DAY).toISOString());
  const month = regionSets(workouts, lookup, new Date(now - 28 * DAY).toISOString());
  const out = [];
  for (const [r, info] of Object.entries(REGIONS)) {
    if (ignored.has(r)) continue;
    if (snoozed[r] && new Date(snoozed[r]).getTime() > now) continue;
    const days = last[r] ? (now - last[r]) / DAY : span;
    const rs = regionsOf(info.muscle);
    const size = rs.reduce((s, x) => s + REGIONS[x].size, 0);
    const share = info.size / size;
    const muscleSets = rs.reduce((s, x) => s + (two[x] || 0), 0);
    const mine = two[r] || 0;
    // No direct work only matters if indirect work isn't covering it either
    // (e.g. heavy pressing already trains the front delts well).
    const covered = mine >= 2 * targets[r] * 0.6;
    const stale = days >= 10 && !covered;
    const behind = muscleSets >= 4 && mine < (share * muscleSets) / 3;
    if (!stale && !behind) continue;
    // Muscles you haven't trained at all lately rank a bit lower.
    const trainedMuscle = rs.some(x => (month[x] || 0) > 0);
    let priority = (stale ? Math.min(days, 30) / 10 : 0) + (behind ? (1 - mine / (share * muscleSets)) * 2 : 0);
    if (!trainedMuscle) priority *= 0.5;
    const reason = stale
      ? (last[r] ? `No direct work in ${Math.floor(days)} days` : 'No direct work yet')
      : `Only ${Math.round(mine)} of ~${Math.round(share * muscleSets)} ${MUSCLES[info.muscle].toLowerCase()} sets in 2 weeks`;
    out.push({ region: r, name: info.name, muscle: info.muscle, days, behind, stale, priority, reason });
  }
  return out.sort((a, b) => b.priority - a.priority);
}
