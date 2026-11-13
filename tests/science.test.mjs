// Every rule the app uses to build a workout, checked across many generated
// workouts and plans. See docs/science.md for the evidence behind each one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, MUSCLES, REGIONS, EQUIPMENT_PROFILES, primaryRegion, exerciseRegions } from '../js/data.js';
import { buildWorkout } from '../js/builder.js';
import {
  SPLITS, PLAN_DAYS, PER_SESSION_CAP, MAJOR, LEVELS, buildBlock, planWeek, recommendSplits, weeklyTargets, volumeBounds, orderExercises,
} from '../js/planner.js';
import { zoneFor, restSeconds, MAX_REPS } from '../js/engine.js';
import { sessionEntries, STRENGTH_ZONE } from '../js/plancontrol.js';

const lookup = id => EXERCISES.find(e => e.id === id);
const DAY = 86400000;
const MONDAY = new Date(2026, 10, 2, 8).getTime();
const HELPERS = { biceps: ['back'], triceps: ['chest', 'shoulders'], forearms: ['back', 'biceps'] };

// Order rules shared by the builder and plan sessions.
function checkOrder(items, label) {
  const firstIso = items.findIndex(i => !lookup(i.exId).compound);
  if (firstIso >= 0) {
    assert.ok(items.slice(firstIso).every(i => !lookup(i.exId).compound), `${label}: a compound lift comes after isolation work`);
  }
  const lastBig = items.map(i => lookup(i.exId).compound && MAJOR.includes(i.muscle)).lastIndexOf(true);
  const firstSmallCompound = items.findIndex(i => lookup(i.exId).compound && !MAJOR.includes(i.muscle));
  if (lastBig >= 0 && firstSmallCompound >= 0) assert.ok(firstSmallCompound > lastBig, `${label}: small-muscle compound before a big lift`);
  // Isolation: never the same muscle twice in a row while another muscle's isolation is still waiting.
  const iso = items.slice(firstIso < 0 ? items.length : firstIso);
  for (let i = 1; i < iso.length; i++) {
    if (iso[i].muscle !== iso[i - 1].muscle) continue;
    const others = iso.slice(i).some(x => x.muscle !== iso[i].muscle);
    assert.ok(!others, `${label}: ${iso[i].muscle} isolation back to back while other muscles wait (${iso.map(x => x.muscle).join(', ')})`);
  }
}

// ---------- Exercise order ----------
test('order: big compound lifts first, then other compounds, then isolation alternating by muscle', () => {
  const items = [
    { exId: 'barbell_curl', muscle: 'biceps', compound: false }, { exId: 'hammer_curl', muscle: 'biceps', compound: false },
    { exId: 'incline_db_curl', muscle: 'biceps', compound: false }, { exId: 'preacher_curl', muscle: 'biceps', compound: false },
    { exId: 'lat_pulldown', muscle: 'back', compound: true }, { exId: 'cable_row', muscle: 'back', compound: true },
    { exId: 'straight_arm_pulldown', muscle: 'back', compound: false }, { exId: 'shrug', muscle: 'back', compound: false },
  ];
  const out = orderExercises(items);
  assert.deepEqual(out.slice(0, 2).map(i => i.exId), ['lat_pulldown', 'cable_row']);
  checkOrder(out, 'back + biceps');
  // Max's case: never four curls in a row.
  const run = Math.max(...out.map((_, i) => { let n = 0; while (out[i + n]?.muscle === 'biceps') n++; return n; }));
  assert.ok(run <= 2, `${run} biceps exercises in a row`);
  // Priority muscles' big lifts lead.
  const pri = orderExercises([{ exId: 'squat', muscle: 'quads', compound: true }, { exId: 'bench_press', muscle: 'chest', compound: true }], ['chest']);
  assert.equal(pri[0].exId, 'bench_press');
});

// ---------- Builder ----------
function randomWorkouts(seed) {
  let r = seed;
  const next = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648);
  const ws = [];
  for (let d = 21; d >= 1; d -= 1 + Math.floor(next() * 4)) {
    ws.push({ id: 'w' + d, date: new Date(MONDAY - d * DAY).toISOString(), exercises: Array.from({ length: 3 + Math.floor(next() * 4) }, () => ({ exId: EXERCISES[Math.floor(next() * 80)].id, sets: [{ weight: 50, reps: 10, done: true }, { weight: 50, reps: 10, done: true }] })) });
  }
  return { ws, next };
}

test('builder: every generated workout follows the order, volume and coverage rules', () => {
  const muscles = Object.keys(MUSCLES);
  for (let i = 0; i < 400; i++) {
    const { ws, next } = randomWorkouts(i + 7);
    const budget = 8 + Math.floor(next() * 30);
    const pick = next() < 0.5;
    const chosen = muscles.filter(() => next() < 0.3).slice(0, Math.max(1, Math.floor(budget / 4)));
    const plan = buildWorkout({ workouts: ws, lookup, exercises: EXERCISES.filter(e => e.common), now: MONDAY, budget, mode: pick && chosen.length ? 'pick' : 'auto', muscles: chosen, weeklyTarget: 10 });
    if (plan.error) continue;
    const label = `run ${i}`;
    checkOrder(plan.items, label);
    const per = {};
    for (const it of plan.items) per[it.muscle] = (per[it.muscle] || 0) + it.sets;
    for (const [m, n] of Object.entries(per)) assert.ok(n <= PER_SESSION_CAP, `${label}: ${m} has ${n} sets (limit ${PER_SESSION_CAP})`);
    for (const it of plan.items) assert.ok(it.sets >= 2 && it.sets <= 4, `${label}: ${it.exId} ${it.sets} sets`);
    const ids = plan.items.map(i => i.exId);
    assert.equal(new Set(ids).size, ids.length, `${label}: same exercise twice`);
    // Each muscle: at least two exercises aimed at different parts.
    for (const m of plan.muscles) {
      const mine = plan.items.filter(i => i.muscle === m);
      assert.ok(mine.length >= 2, `${label}: ${m} has ${mine.length} exercise`);
      const parts = new Set(mine.map(i => primaryRegion(lookup(i.exId))));
      const partsOfMuscle = Object.values(REGIONS).filter(r => r.muscle === m).length;
      assert.ok(parts.size >= Math.min(2, mine.length, partsOfMuscle), `${label}: ${m} exercises all hit the same part`);
    }
  }
});

test('builder: helper muscles get credit for indirect work (biceps with back, triceps with chest)', () => {
  for (const budget of [12, 16, 20, 24]) {
    const p = buildWorkout({ workouts: [], lookup, exercises: EXERCISES.filter(e => e.common), now: MONDAY, budget, mode: 'pick', muscles: ['back', 'biceps'], weeklyTarget: 10 });
    const sets = m => p.items.filter(i => i.muscle === m).reduce((a, i) => a + i.sets, 0);
    assert.ok(sets('biceps') < sets('back'), `budget ${budget}: biceps ${sets('biceps')} vs back ${sets('back')}`);
    assert.ok(sets('biceps') >= 4, 'still at least two biceps exercises');
    assert.ok(p.items.filter(i => i.muscle === 'biceps').length <= 3, 'no wall of curls');
  }
  const t = buildWorkout({ workouts: [], lookup, exercises: EXERCISES.filter(e => e.common), now: MONDAY, budget: 20, mode: 'pick', muscles: ['chest', 'triceps'], weeklyTarget: 10 });
  const ts = m => t.items.filter(i => i.muscle === m).reduce((a, i) => a + i.sets, 0);
  assert.ok(ts('triceps') < ts('chest'));
});

test('builder: more sets than help in one workout are not given; the workout says so', () => {
  const p = buildWorkout({ workouts: [], lookup, exercises: EXERCISES.filter(e => e.common), now: MONDAY, budget: 30, mode: 'pick', muscles: ['back'], weeklyTarget: 10 });
  assert.equal(p.totalSets, PER_SESSION_CAP);
  assert.equal(p.capped, true);
});

// ---------- Plans ----------
test('plans: every session follows the order rules (supersets aside) for every split and goal', () => {
  const daysFor = n => [[0, 3], [0, 2, 4], [0, 1, 3, 4], [0, 1, 2, 4, 5], [0, 1, 2, 3, 4, 5]][n - 2];
  for (const split of SPLITS) {
    for (let n = split.days[0]; n <= split.days[1]; n++) {
      for (const goal of ['muscle', 'strength']) {
        const profile = { days: daysFor(n), minutes: 90, level: 'intermediate', goal, priority: [], equipment: 'gym', activities: [] };
        const slots = buildBlock({ profile, splitId: split.id, exercises: EXERCISES.filter(e => e.common), lookup, workouts: [], now: MONDAY });
        const week = planWeek({ profile, plan: { splitId: split.id, slots, volume: {}, weekDays: {}, weekEdits: {} }, lookup, now: MONDAY });
        for (const d of week.days.filter(x => x.kind === 'train')) {
          const items = d.session.items.filter(i => !i.superset);
          checkOrder(items, `${split.id} ${n}d ${goal} ${d.session.name}`);
        }
      }
    }
  }
});

test('plans: the recommended split trains every big muscle at least twice a week', () => {
  for (let n = 2; n <= 6; n++) {
    const days = [[0, 3], [0, 2, 4], [0, 1, 3, 4], [0, 1, 2, 4, 5], [0, 1, 2, 3, 4, 5]][n - 2];
    const top = recommendSplits({ days, minutes: 60, level: 'intermediate', goal: 'muscle', priority: [], equipment: 'gym', activities: [] })[0];
    const split = SPLITS.find(s => s.id === top.id);
    const types = Array.from({ length: n }, (_, i) => split.rotation[i % split.rotation.length]);
    for (const m of MAJOR) assert.ok(types.filter(t => PLAN_DAYS[t].muscles.includes(m)).length >= 2, `${n} days: ${top.id} trains ${m} once`);
  }
});

test('plans: weekly volume stays inside the evidence-based range, unless the time can\'t hold it', async () => {
  const { goalSizing } = await import('../js/planner.js');
  for (const level of Object.keys(LEVELS)) {
    for (const days of [[0, 2, 4], [0, 1, 3, 4], [0, 1, 2, 3, 4, 5]]) {
      for (const minutes of [30, 45, 60, 90, 120]) {
        const profile = { days, minutes, level, goal: 'muscle', priority: [], equipment: 'gym' };
        const t = weeklyTargets(profile);
        // Under the level's range only when the sessions can't hold it (the
        // plan then says how many minutes would reach it).
        const timeLimited = goalSizing(profile).minutesForMin > minutes;
        for (const m of MAJOR) {
          const [lo, hi] = volumeBounds(profile, m);
          const label = `${level} ${days.length}x${minutes} ${m}: ${t[m]}`;
          assert.ok(t[m] <= hi, `${label} over ${hi}`);
          assert.ok(t[m] >= lo || timeLimited, `${label} under ${lo} though the time holds more`);
          assert.ok(t[m] >= 2, label);
        }
      }
    }
  }
  // Enough time: inside the range, and at least the 10 weekly sets research
  // supports for intermediate and advanced lifters.
  for (const level of ['intermediate', 'advanced']) {
    const t = weeklyTargets({ days: [0, 1, 3, 4], minutes: 90, level, priority: [] });
    for (const m of MAJOR) assert.ok(t[m] >= 10, `${level} 4x90 ${m}: ${t[m]}`);
  }
});

test('plans: no muscle gets more than the per-session limit, and main lifts are compounds in 3-6', () => {
  const profile = { days: [0, 1, 2, 3, 4, 5], minutes: 120, level: 'advanced', goal: 'strength', priority: ['chest', 'back'], equipment: 'gym', activities: [] };
  for (const split of SPLITS.filter(s => 6 >= s.days[0] && 6 <= s.days[1])) {
    const slots = buildBlock({ profile, splitId: split.id, exercises: EXERCISES.filter(e => e.common), lookup, workouts: [], now: MONDAY });
    const week = planWeek({ profile, plan: { splitId: split.id, slots, volume: {}, weekDays: {}, weekEdits: {} }, lookup, now: MONDAY });
    for (const d of week.days.filter(x => x.kind === 'train')) {
      const per = {};
      for (const it of d.session.items) per[it.muscle] = (per[it.muscle] || 0) + it.sets;
      for (const [m, n] of Object.entries(per)) assert.ok(n <= PER_SESSION_CAP, `${split.id}: ${m} ${n} sets`);
      for (const e of sessionEntries(d.session)) if (e.zone) { assert.deepEqual(e.zone, STRENGTH_ZONE); assert.ok(lookup(e.exId).compound); }
    }
  }
});

// ---------- Reps and rest ----------
test('reps: weighted lifts stay in 6-12 (compound) or 8-12 (isolation); bodyweight up to 20', () => {
  for (const ex of EXERCISES) {
    const [lo, hi] = zoneFor(ex);
    if (ex.timed) assert.deepEqual([lo, hi], [20, 90], `${ex.id}: holds are 20-90 seconds`);
    else if (ex.equipment === 'bodyweight') assert.deepEqual([lo, hi], [6, 20]);
    else { assert.equal(hi, MAX_REPS); assert.equal(lo, ex.compound ? 6 : 8); }
  }
});

test('rest: compound lifts rest longer than isolation; strength sets 3 minutes; your setting wins', () => {
  const bench = lookup('bench_press'), curl = lookup('db_curl'), pull = lookup('pull_up');
  assert.equal(restSeconds(curl, { base: 90 }), 90);
  assert.equal(restSeconds(bench, { base: 90 }), 120);
  assert.equal(restSeconds(bench, { base: 90, zone: [3, 6] }), 180);
  assert.equal(restSeconds(bench, { base: 150 }), 150, 'a longer default is kept');
  assert.equal(restSeconds(pull, { base: 90 }), 90, 'bodyweight lifts use the default');
  assert.equal(restSeconds(bench, { base: 90, own: 60 }), 60, 'your own setting wins');
});

// ---------- Coverage ----------
test('coverage: every setup equipment choice can train every part of every muscle', () => {
  for (const p of Object.keys(EQUIPMENT_PROFILES)) {
    for (const r of Object.keys(REGIONS)) {
      assert.ok(EXERCISES.some(e => EQUIPMENT_PROFILES[p].allows.includes(e.equipment) && (exerciseRegions(e)[r] || 0) >= 0.75), `${p}: nothing trains ${r}`);
    }
  }
});

test('plans: big compound lifts alternate between muscles (press, row, press) instead of stacking one muscle', () => {
  for (const split of SPLITS) {
    const profile = { days: [0, 1, 2, 3, 4, 5].slice(0, split.days[1]), minutes: 120, level: 'advanced', goal: 'muscle', priority: [], equipment: 'gym', activities: [] };
    const slots = buildBlock({ profile, splitId: split.id, exercises: EXERCISES.filter(e => e.common), lookup, workouts: [], now: MONDAY });
    const week = planWeek({ profile, plan: { splitId: split.id, slots, volume: {}, weekDays: {}, weekEdits: {} }, lookup, now: MONDAY });
    for (const d of week.days.filter(x => x.kind === 'train')) {
      const big = d.session.items.filter(i => !i.superset && i.compound && MAJOR.includes(i.muscle));
      const muscles = new Set(big.map(i => i.muscle));
      if (muscles.size < 2) continue;
      // The first round reaches every big muscle before any muscle's second lift.
      const firstRound = big.slice(0, muscles.size).map(i => i.muscle);
      assert.equal(new Set(firstRound).size, muscles.size, `${split.id} ${d.session.name}: ${big.map(i => i.muscle).join(', ')}`);
    }
  }
});
