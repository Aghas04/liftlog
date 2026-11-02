import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, MUSCLES } from '../js/data.js';
import { packWorkout, unpackWorkout, resolveShared } from '../js/together.js';
import { createPlan, currentWeek, todayOf } from '../js/plancontrol.js';

const lookup = id => EXERCISES.find(e => e.id === id) || customs.find(c => c.id === id);
const customs = [{ id: 'c_abc', name: 'Belt squat thing', muscle: 'quads', equipment: 'machine', compound: true, custom: true }];
const workout = {
  name: 'Upper A 💪', dayType: 'plan_upper',
  exercises: [
    { exId: 'bench_press', sets: 4, zone: [3, 6] }, { exId: 'cable_row', sets: 3 },
    { exId: 'lateral_raise', sets: 3, group: 'x9' }, { exId: 'face_pull', sets: 3, group: 'x9' }, { exId: 'c_abc', sets: 2 },
  ],
};

test('a shared workout survives the link round trip, emoji and all', () => {
  const code = packWorkout(workout, lookup);
  assert.ok(/^[A-Za-z0-9_-]+$/.test(code), 'link-safe characters only');
  assert.ok(code.length < 1500, `link is ${code.length} characters`);
  const back = unpackWorkout(code);
  assert.equal(back.name, 'Upper A 💪');
  assert.equal(back.dayType, 'plan_upper');
  assert.deepEqual(back.exercises.map(e => e.exId), ['bench_press', 'cable_row', 'lateral_raise', 'face_pull', 'c_abc']);
  assert.deepEqual(back.exercises[0].zone, [3, 6]);
  assert.equal(back.exercises[2].group, back.exercises[3].group);
  assert.equal(back.exercises[4].custom.name, 'Belt squat thing');
});

test('broken or hostile links are refused', () => {
  for (const bad of ['', 'abc', '%%%', btoa('{"v":2,"e":[]}'), btoa('not json')]) assert.equal(unpackWorkout(bad), null);
  const huge = btoa(JSON.stringify({ v: 1, e: Array.from({ length: 50 }, () => ({ i: 'bench_press', s: 3 })) }));
  assert.equal(unpackWorkout(huge), null);
  const clamp = unpackWorkout(btoa(JSON.stringify({ v: 1, n: 'x', e: [{ i: 'bench_press', s: 999 }] })));
  assert.equal(clamp.exercises[0].sets, 10, 'set counts are clamped');
});

test("the other phone uses its own library, recreates custom lifts and swaps what it can't use", () => {
  const shared = unpackWorkout(packWorkout(workout, lookup));
  const r = resolveShared(shared, {
    has: id => EXERCISES.some(e => e.id === id), customs: [], blocked: ['cable_row'],
    replace: id => (id === 'cable_row' ? EXERCISES.find(e => e.id === 'machine_row') : null), muscles: MUSCLES,
  });
  assert.deepEqual(r.exercises.map(e => e.exId), ['bench_press', 'machine_row', 'lateral_raise', 'face_pull', 'c_abc']);
  assert.deepEqual(r.swaps, [{ from: 'cable_row', to: 'machine_row' }]);
  assert.equal(r.newCustoms.length, 1);
  assert.equal(r.newCustoms[0].name, 'Belt squat thing');
  // A custom lift with the same name on this phone is reused.
  const r2 = resolveShared(shared, { has: id => EXERCISES.some(e => e.id === id), customs: [{ id: 'c_mine', name: 'belt squat thing', muscle: 'quads' }], blocked: [], replace: () => null, muscles: MUSCLES });
  assert.ok(r2.exercises.some(e => e.exId === 'c_mine'));
  assert.equal(r2.newCustoms.length, 0);
  // A superset whose partner is dropped becomes a normal exercise.
  const r3 = resolveShared(shared, { has: id => EXERCISES.some(e => e.id === id), customs: [], blocked: ['face_pull'], replace: () => null, muscles: MUSCLES });
  assert.ok(!r3.exercises.find(e => e.exId === 'lateral_raise').group);
});

test("a workout done together counts toward the week but doesn't move the plan's rotation", () => {
  const DAY = 86400000;
  const MONDAY = new Date(2026, 10, 2, 8).getTime();
  const profile = { days: [0, 1, 3, 4], minutes: 75, level: 'intermediate', goal: 'muscle', priority: [], equipment: 'gym', activities: [], avoid: [] };
  const plan = createPlan({ profile, splitId: 'upper_lower', exercises: EXERCISES, workouts: [], lookup, now: MONDAY - 7 * DAY });
  const planned = todayOf(currentWeek(plan, [], lookup, MONDAY), MONDAY).session;
  // Monday: trained together instead (no plan tag), a lower-body session.
  const together = { id: 't1', date: new Date(MONDAY).toISOString(), dayType: 'plan_lower', together: true, templateName: 'Together: Leg day',
    exercises: [{ exId: 'squat', sets: [{ weight: 200, reps: 8, done: true }, { weight: 200, reps: 8, done: true }, { weight: 200, reps: 8, done: true }] }] };
  const week = currentWeek(plan, [together], lookup, MONDAY + DAY);
  assert.equal(week.days[0].kind, 'done', 'the day shows as trained');
  // The session that was planned for Monday comes next; the rotation didn't skip it.
  assert.equal(todayOf(week, MONDAY + DAY).session.seq, planned.seq);
});
