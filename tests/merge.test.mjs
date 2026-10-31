import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES } from '../js/data.js';
import { mergeExercise, mergePreview } from '../js/merge.js';
import { suggest } from '../js/engine.js';

const DAY = 86400000;
const NOW = new Date('2026-10-28T12:00:00Z').getTime();
const day = d => new Date(NOW - d * DAY).toISOString();
const sets = (w, reps) => reps.map(r => ({ weight: w, reps: r, done: true, warmup: false, target: { weight: w, reps: r } }));
const PLATE = EXERCISES.find(e => e.name === 'Plate-Loaded Incline Press').id;

function sample() {
  return {
    customExercises: [{ id: 'c_plated', name: 'plated incline bench', muscle: 'chest', equipment: 'machine', compound: true, custom: true }],
    workouts: [
      { id: 'w1', date: day(9), dayType: 'upper', exercises: [{ exId: 'c_plated', sets: sets(90, [10, 9, 8]) }, { exId: 'bench_press', sets: sets(135, [8]) }] },
      { id: 'w2', date: day(6), dayType: 'upper', exercises: [{ exId: 'c_plated', sets: [...sets(45, [10]).map(s => ({ ...s, warmup: true })), ...sets(100, [10, 10, 9])] }] },
      { id: 'w3', date: day(3), dayType: 'upper', exercises: [{ exId: 'bench_press', sets: sets(135, [9]) }] },
    ],
    activeWorkout: { id: 'a', exercises: [{ exId: 'c_plated', sets: [] }] },
    templates: [{ id: 't1', name: 'Push', exercises: [{ exId: 'c_plated' }, { exId: 'lateral_raise' }] }],
    exerciseSettings: { c_plated: { increment: 10, note: 'seat 4' }, [PLATE]: { rest: 120 } },
    settings: { painFlags: { c_plated: '2026-10-01' }, gymStars: ['c_plated', PLATE] },
    plan: {
      id: 'p1', slots: { upper: [{ chest: ['c_plated', 'cable_fly'] }, { chest: [PLATE, 'c_plated'] }] },
      weekEdits: { 3: { replace: { incline_bench: 'c_plated', c_plated: PLATE }, remove: ['c_plated'] } },
      edits: { c_plated: 1, [PLATE]: 1 }, excluded: ['c_plated'], profile: { avoid: ['c_plated'] },
    },
  };
}

test('preview counts what will move', () => {
  assert.deepEqual(mergePreview(sample(), 'c_plated'), { workouts: 2, sets: 6, templates: 1, inPlan: true });
});

test('merge moves every set, setting and reference, and removes the custom lift', () => {
  const before = sample();
  const { state, moved } = mergeExercise(before, 'c_plated', PLATE);
  assert.equal(moved.sets, 6);
  assert.ok(!JSON.stringify(state).includes('c_plated'), 'no reference to the custom lift is left');
  // Sets unchanged, just under the library id (warm-ups included, nothing lost or duplicated).
  const all = s => s.workouts.flatMap(w => w.exercises.flatMap(e => e.sets));
  assert.equal(all(state).length, all(before).length);
  assert.equal(state.workouts[1].exercises[0].exId, PLATE);
  assert.deepEqual(state.workouts[1].exercises[0].sets, before.workouts[1].exercises[0].sets);
  assert.equal(state.activeWorkout.exercises[0].exId, PLATE);
  assert.deepEqual(state.templates[0].exercises.map(e => e.exId), [PLATE, 'lateral_raise']);
  // Settings: the library lift keeps its rest, gains the note and step.
  assert.deepEqual(state.exerciseSettings[PLATE], { increment: 10, note: 'seat 4', rest: 120 });
  assert.equal(state.settings.painFlags[PLATE], '2026-10-01');
  assert.deepEqual(state.settings.gymStars, [PLATE]);
  // Plan: no duplicates in a slot, edits summed, self-replacements dropped.
  assert.deepEqual(state.plan.slots.upper[0].chest, [PLATE, 'cable_fly']);
  assert.deepEqual(state.plan.slots.upper[1].chest, [PLATE]);
  assert.deepEqual(state.plan.weekEdits[3].replace, { incline_bench: PLATE });
  assert.deepEqual(state.plan.weekEdits[3].remove, [PLATE]);
  assert.equal(state.plan.edits[PLATE], 2);
  assert.deepEqual(state.plan.excluded, [PLATE]);
  assert.deepEqual(state.customExercises, []);
  // The original is untouched (undo restores it as it was).
  assert.equal(before.workouts[0].exercises[0].exId, 'c_plated');
});

test('after merging, suggestions continue from the custom lift history', () => {
  const { state } = mergeExercise(sample(), 'c_plated', PLATE);
  const ex = EXERCISES.find(e => e.id === PLATE);
  const hist = state.workouts.flatMap(w => w.exercises.filter(e => e.exId === PLATE).map(e => ({ date: w.date, sets: e.sets })));
  const s = suggest(ex, hist, { increment: 5, now: NOW });
  assert.ok(s && s.weight >= 100, `continues from 100 lb, got ${s?.weight}`);
});

test('merging into a lift that already has history keeps both, in date order', () => {
  const st = sample();
  st.workouts.push({ id: 'w4', date: day(1), dayType: 'upper', exercises: [{ exId: PLATE, sets: sets(110, [8]) }] });
  const { state } = mergeExercise(st, 'c_plated', PLATE);
  const dates = state.workouts.filter(w => w.exercises.some(e => e.exId === PLATE)).map(w => w.date);
  assert.equal(dates.length, 3);
  assert.deepEqual(dates, [...dates].sort());
});

test('refuses to merge a library lift or into itself', () => {
  assert.throws(() => mergeExercise(sample(), 'bench_press', PLATE));
  assert.throws(() => mergeExercise(sample(), 'c_plated', 'c_plated'));
  assert.throws(() => mergeExercise(sample(), 'c_plated', ''));
});

test('works with no plan, no settings and no active workout', () => {
  const st = sample();
  delete st.plan; delete st.settings; st.activeWorkout = null; delete st.exerciseSettings;
  const { state } = mergeExercise(st, 'c_plated', PLATE);
  assert.equal(state.workouts[0].exercises[0].exId, PLATE);
});
