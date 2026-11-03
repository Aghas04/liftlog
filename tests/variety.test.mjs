import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES } from '../js/data.js';
import { worthBoth } from '../js/equipment.js';
import { buildBlock } from '../js/planner.js';
import { buildWorkout } from '../js/builder.js';
import { createPlan, currentWeek, regeneratePlan } from '../js/plancontrol.js';

const lookup = id => EXERCISES.find(e => e.id === id);
const byName = n => EXERCISES.find(e => e.name === n);
const DAY = 86400000;
const MONDAY = new Date(2026, 10, 2, 8, 0, 0).getTime();
const profile = { days: [0, 1, 3, 4, 5, 6], minutes: 75, level: 'intermediate', goal: 'muscle', priority: [], equipment: 'gym', activities: [], avoid: [] };
const allIds = slots => Object.values(slots).flatMap(vs => vs.flatMap(v => Object.values(v).flat()));
const versionsOf = (ids, movement) => [...new Set(ids.filter(id => lookup(id)?.movement === movement))];

test('which versions are worth having both: dumbbell vs bar presses yes, hip thrust machine vs dumbbell no', () => {
  assert.ok(worthBoth(byName('Incline Bench Press'), byName('Incline Dumbbell Press')));
  assert.ok(worthBoth(byName('Bench Press'), byName('Dumbbell Bench Press')));
  assert.ok(!worthBoth(byName('Hip Thrust Machine'), byName('Dumbbell Hip Thrust')));
  assert.ok(!worthBoth(byName('Hip Thrust'), byName('Hip Thrust Machine')));
  assert.ok(!worthBoth(byName('Incline Bench Press'), byName('Incline Bench Press')));
});

test('plans keep the hip thrust version you use instead of adding another version', () => {
  const used = EXERCISES.find(e => e.id === 'hip_thrust_machine');
  const exercises = EXERCISES.filter(e => e.common || e.id === used.id);
  for (let seed = 1; seed <= 25; seed++) {
    const slots = buildBlock({ profile, splitId: 'upper_lower', exercises, usage: { [used.id]: 4 }, workouts: [], lookup, now: MONDAY, seed });
    const thrusts = versionsOf(allIds(slots), 'hip_thrust');
    assert.ok(thrusts.every(id => id === used.id), `seed ${seed}: ${thrusts.join(', ')}`);
  }
});

test('Build today\'s workout keeps the version you use', () => {
  const used = 'hip_thrust_machine';
  const exercises = EXERCISES.filter(e => e.common || e.id === used);
  for (let seed = 1; seed <= 25; seed++) {
    const plan = buildWorkout({ exercises, lookup, budget: 16, mode: 'pick', muscles: ['glutes', 'hamstrings'], usage: { [used]: 5 }, seed });
    const thrusts = versionsOf(plan.items.map(i => i.exId), 'hip_thrust');
    assert.ok(thrusts.every(id => id === used), `seed ${seed}: ${thrusts.join(', ')}`);
  }
});

test('a useful second version (dumbbell incline next to barbell incline) may appear on another day, never in the same session', () => {
  const usage = { incline_bench_press: 4, [byName('Incline Bench Press').id]: 4 };
  let seenBoth = false;
  for (let seed = 1; seed <= 25; seed++) {
    const slots = buildBlock({ profile, splitId: 'upper_lower', exercises: EXERCISES.filter(e => e.common), usage, workouts: [], lookup, now: MONDAY, seed });
    for (const v of slots.upper) {
      for (const list of Object.values(v)) {
        const moves = list.map(id => lookup(id).movement);
        assert.equal(new Set(moves).size, moves.length, `seed ${seed}: two versions in one session: ${list.join(', ')}`);
      }
    }
    if (versionsOf(allIds(slots), 'incline_press').length > 1) seenBoth = true;
  }
  assert.ok(seenBoth, 'dumbbell and barbell incline are allowed on different days');
});

test('regenerate: done workouts stay, the plan keeps its id and block, and lifts you did are kept', () => {
  const plan = createPlan({ profile, splitId: 'upper_lower', exercises: EXERCISES, usage: {}, workouts: [], lookup, now: MONDAY });
  const week = currentWeek(plan, [], lookup, MONDAY);
  const first = week.days.find(d => d.kind === 'train');
  const done = {
    id: 'w1', date: new Date(MONDAY + 3600e3).toISOString(), dayType: 'plan_' + first.session.type, plan: { id: plan.id, seq: first.session.seq },
    exercises: first.session.items.map(it => ({ exId: it.exId, sets: [{ weight: 100, reps: 10, done: true }] })),
  };
  plan.weekEdits = { [first.session.seq]: { replace: {}, remove: ['x'] }, [first.session.seq + 1]: { replace: { a: 'b' }, remove: [] } };
  const next = regeneratePlan(plan, { exercises: EXERCISES, workouts: [done], lookup, now: MONDAY + DAY });
  assert.equal(next.id, plan.id);
  assert.equal(next.blockStart, plan.blockStart);
  assert.ok(next.weekEdits[first.session.seq], 'edits of the done session stay');
  assert.ok(!next.weekEdits[first.session.seq + 1], 'edits of upcoming sessions are replaced');
  // The done session still counts: the week moves on to the next session.
  const after = currentWeek(next, [done], lookup, MONDAY + DAY);
  const doneDay = after.days.find(d => d.done || d.workout || d.kind === 'done');
  assert.ok(after.days.some(d => d.session?.seq === first.session.seq + 1), 'rotation continues after the done session');
  // Lifts you did are favored for the same day type.
  const doneIds = new Set(done.exercises.map(e => e.exId));
  const kept = allIds(next.slots).filter(id => doneIds.has(id));
  assert.ok(kept.length >= doneIds.size * 0.6, `kept ${kept.length} of ${doneIds.size} lifts you did`);
  void doneDay;
});
