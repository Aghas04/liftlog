// "Build today's workout": turns a volume budget into a list of exercises.
// Pure functions, no storage access.
//
// 1. Score how much each region needs work: weekly target minus sets done in
//    the last 7 days, plus a boost for neglected regions.
// 2. Choose muscles: Auto ranks them by need x recovery; Pick uses yours.
// 3. Give every chosen muscle at least 4 sets, then share the rest by need.
// 4. Every muscle gets at least 2 different exercises aimed at different
//    regions, 2-4 sets each, adding up exactly to the budget.
// 5. Order: compound lifts first, then by muscle priority.
import { REGIONS, MUSCLES, regionsOf, exerciseRegions, primaryRegion } from './data.js';
import { workingSets } from './engine.js';
import { regionSets, regionTargets, neglectedRegions, DIRECT } from './insights.js';

const DAY = 86400000;
export const MIN_SETS_PER_MUSCLE = 4;
export const MIN_SETS_PER_EXERCISE = 2;
export const MAX_SETS_PER_EXERCISE = 4;

/** Seconds per working set from recent workouts, or rest + 40s of work. */
export function paceFromHistory(workouts, defaultRest = 90) {
  const fallback = defaultRest + 40;
  const per = workouts
    .filter(w => w.finishedAt)
    .slice(-6)
    .map(w => {
      const n = w.exercises.reduce((s, e) => s + workingSets(e).length, 0);
      return n >= 6 ? (new Date(w.finishedAt) - new Date(w.date)) / 1000 / n : null;
    })
    .filter(x => x && x >= 60 && x <= 400)
    .sort((a, b) => a - b);
  return per.length ? Math.round(per[Math.floor(per.length / 2)]) : fallback;
}

export function setsForMinutes(minutes, secPerSet) {
  return Math.max(MIN_SETS_PER_MUSCLE, Math.floor((minutes * 60) / secPerSet));
}

// Small deterministic random generator so "Regenerate" gives a stable variation.
function rng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Split `total` into `parts` integers that differ by at most one.
function evenSplit(total, parts) {
  const base = Math.floor(total / parts);
  return Array.from({ length: parts }, (_, i) => base + (i < total - base * parts ? 1 : 0));
}

/**
 * @param input {
 *   workouts, lookup(exId), exercises: all exercises, now, budget: sets,
 *   mode: 'auto' | 'pick', muscles: [muscle ids for pick mode],
 *   weeklyTarget, ignored: [regions], snoozed: {}, seed, exclude: [exIds],
 *   usage: { exId: times done }
 * }
 * @returns { items: [{ exId, sets, muscle, region, reason, isNew }], muscles, totalSets }
 *       or { error: 'tooSmall', fit, ranked } when the picked muscles can't each get 4 sets.
 */
export function buildWorkout(input) {
  const {
    workouts = [], lookup, exercises, now = Date.now(), budget, mode = 'auto', muscles: picked = [],
    weeklyTarget = 10, ignored = [], snoozed = {}, seed = 0, exclude = [], usage = {},
  } = input;
  const ignoredSet = new Set(ignored);
  const jitter = seed ? rng(seed) : () => 0;

  // 1. Region need.
  const targets = regionTargets(weeklyTarget);
  const done = regionSets(workouts, lookup, new Date(now - 7 * DAY).toISOString());
  const neglect = neglectedRegions(workouts, lookup, { now, ignored, snoozed, weeklyTarget });
  const neglectBy = Object.fromEntries(neglect.map(n => [n.region, n]));
  const need = {};
  for (const r of Object.keys(REGIONS)) {
    if (ignoredSet.has(r)) { need[r] = 0; continue; }
    need[r] = Math.max(0, targets[r] - (done[r] || 0));
    if (neglectBy[r]) need[r] += Math.max(2, targets[r] * 0.5);
  }

  // Recovery: prefer rested muscles, but don't rule anything out.
  const readiness = {};
  for (const m of Object.keys(MUSCLES)) readiness[m] = 1;
  for (const w of workouts) {
    const ago = (now - new Date(w.date).getTime()) / DAY;
    if (ago < 0 || ago > 2) continue;
    const perMuscle = {};
    for (const e of w.exercises) {
      const m = lookup(e.exId).muscle;
      perMuscle[m] = (perMuscle[m] || 0) + workingSets(e).length;
    }
    for (const [m, n] of Object.entries(perMuscle)) {
      if (n >= 3) readiness[m] = Math.min(readiness[m], ago < 1 ? 0.35 : 0.65);
    }
  }

  const pool = exercises.filter(ex => !exclude.includes(ex.id));
  const byMuscle = m => pool.filter(ex => ex.muscle === m);
  // Most sets a muscle can take: every exercise at the 4-set maximum.
  const capOf = m => byMuscle(m).length * MAX_SETS_PER_EXERCISE;
  const muscleNeed = m => regionsOf(m).reduce((s, r) => s + need[r], 0);
  const score = m => (muscleNeed(m) + 0.5) * readiness[m] + jitter() * 0.8;
  const available = Object.keys(MUSCLES).filter(m => byMuscle(m).length >= 2 && regionsOf(m).some(r => !ignoredSet.has(r)));

  // 2. Choose muscles.
  const maxMuscles = Math.floor(budget / MIN_SETS_PER_MUSCLE);
  if (maxMuscles < 1) return { error: 'tooSmall', fit: 0, ranked: [] };
  let chosen;
  const scores = Object.fromEntries(available.map(m => [m, score(m)]));
  if (mode === 'pick') {
    const list = picked.filter(m => available.includes(m));
    if (!list.length) return { error: 'noMuscles' };
    if (list.length > maxMuscles) {
      return { error: 'tooSmall', fit: maxMuscles, ranked: [...list].sort((a, b) => scores[b] - scores[a]) };
    }
    chosen = list;
  } else {
    // About 6 sets per muscle, never fewer than 4.
    const ranked = [...available].sort((a, b) => scores[b] - scores[a]);
    const k = Math.max(1, Math.min(maxMuscles, Math.round(budget / 6), available.length));
    chosen = ranked.slice(0, k);
    // Add muscles if the chosen ones don't have enough exercises to use the budget.
    for (const m of ranked.slice(k)) {
      if (chosen.reduce((s, x) => s + capOf(x), 0) >= budget || chosen.length >= maxMuscles) break;
      chosen.push(m);
    }
  }
  chosen.sort((a, b) => scores[b] - scores[a]);

  // 3. Sets per muscle: 4 each, the rest shared by need (largest remainder).
  const alloc = Object.fromEntries(chosen.map(m => [m, MIN_SETS_PER_MUSCLE]));
  let left = budget - MIN_SETS_PER_MUSCLE * chosen.length;
  while (left > 0) {
    const open = chosen.filter(m => alloc[m] < capOf(m));
    if (!open.length) break;
    const weights = open.map(m => muscleNeed(m) + 1);
    const sum = weights.reduce((a, b) => a + b, 0);
    const shares = open.map((m, i) => ({ m, exact: (left * weights[i]) / sum }));
    let given = 0;
    for (const s of shares) {
      const add = Math.min(Math.floor(s.exact), capOf(s.m) - alloc[s.m]);
      alloc[s.m] += add;
      given += add;
    }
    if (given === 0) {
      // Hand out single sets by largest remainder.
      const order = shares.sort((a, b) => (b.exact % 1) - (a.exact % 1) || weights[open.indexOf(b.m)] - weights[open.indexOf(a.m)]);
      for (const s of order) {
        if (given >= left) break;
        if (alloc[s.m] < capOf(s.m)) { alloc[s.m]++; given++; }
      }
    }
    left -= given;
  }

  // 4. Exercises per muscle.
  const items = [];
  const lastIds = new Set((workouts[workouts.length - 1]?.exercises || []).map(e => e.exId));
  for (const m of chosen) {
    const nEx = Math.min(byMuscle(m).length, Math.max(2, Math.ceil(alloc[m] / MAX_SETS_PER_EXERCISE)));
    const setsEach = evenSplit(alloc[m], nEx);
    const remaining = Object.fromEntries(regionsOf(m).map(r => [r, need[r]]));
    const usedRegions = new Set();
    const usedIds = new Set();
    const picks = [];
    for (let j = 0; j < nEx; j++) {
      let best = null, bestScore = -Infinity;
      for (const ex of byMuscle(m)) {
        if (usedIds.has(ex.id)) continue;
        const regs = exerciseRegions(ex);
        const main = primaryRegion(ex);
        let s = 0;
        for (const r of regionsOf(m)) s += (regs[r] || 0) * ((remaining[r] || 0) + 0.5);
        if (usage[ex.id]) s += 3 + Math.min(usage[ex.id], 10) * 0.2; // familiar lifts have accurate suggestions
        if (j === 0 && ex.compound) s += 1;
        if (usedRegions.has(main)) s -= 7;                            // aim the next lift at a different region
        if (lastIds.has(ex.id)) s -= 0.75;                            // a little variety from last time
        if (neglectBy[main]) s += 1.5;
        s += jitter() * 1.5;
        if (s > bestScore) { bestScore = s; best = ex; }
      }
      if (!best) break;
      const regs = exerciseRegions(best);
      for (const r of regionsOf(m)) remaining[r] = Math.max(0, (remaining[r] || 0) - (regs[r] || 0) * setsEach[j]);
      usedIds.add(best.id);
      usedRegions.add(primaryRegion(best));
      picks.push({ ex: best, sets: setsEach[j] });
    }
    picks.forEach(({ ex, sets }, j) => {
      const main = primaryRegion(ex);
      const n = neglectBy[main];
      const doneM = Math.round(regionsOf(m).reduce((s, r) => s + (done[r] || 0), 0));
      const reason = n
        ? `${REGIONS[main].name}: ${n.reason.charAt(0).toLowerCase()}${n.reason.slice(1)}`
        : j === 0
          ? `${MUSCLES[m]}: ${doneM}/${weeklyTarget} sets this week`
          : `Covers ${REGIONS[main].name.toLowerCase()}`;
      items.push({ exId: ex.id, sets, muscle: m, region: main, compound: !!ex.compound, rank: chosen.indexOf(m), order: j, reason, isNew: !usage[ex.id] });
    });
  }

  // 5. Order: compounds first, then by muscle priority, keeping each muscle's pick order.
  items.sort((a, b) => (b.compound - a.compound) || (a.rank - b.rank) || (a.order - b.order));
  return {
    items: items.map(({ exId, sets, muscle, region, reason, isNew }) => ({ exId, sets, muscle, region, reason, isNew })),
    muscles: chosen,
    totalSets: items.reduce((s, i) => s + i.sets, 0),
  };
}

/** Best exercise to fix a neglected region: familiar first, then most direct. */
export function exerciseForRegion(region, exercises, usage = {}) {
  const fits = exercises
    .map(ex => ({ ex, w: exerciseRegions(ex)[region] || 0 }))
    .filter(x => x.w >= DIRECT);
  fits.sort((a, b) => (Number(!!usage[b.ex.id]) - Number(!!usage[a.ex.id])) || (b.w - a.w) || ((usage[b.ex.id] || 0) - (usage[a.ex.id] || 0)));
  return fits[0]?.ex || null;
}
