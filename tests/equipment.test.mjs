import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, MUSCLES } from '../js/data.js';
import { GEAR_KEYS, FREE_WEIGHTS, FULL_GYM, needsOf, fitsGear, isFullGym, capDumbbell } from '../js/equipment.js';
import { buildWorkout } from '../js/builder.js';

const byName = n => EXERCISES.find(e => e.name === n);

test('every exercise needs only known gear, and the full gym fits everything', () => {
  for (const ex of EXERCISES) {
    for (const g of needsOf(ex)) assert.ok(GEAR_KEYS.includes(g), `${ex.name}: unknown gear ${g}`);
    assert.ok(fitsGear(ex, FULL_GYM.gear), ex.name);
  }
  assert.ok(isFullGym(GEAR_KEYS));
  assert.ok(!isFullGym(FREE_WEIGHTS));
});

test('needs: benches, racks and bars are worked out from the lift', () => {
  assert.deepEqual(needsOf(byName('Dumbbell Bench Press')).sort(), ['bench', 'dumbbell']);
  assert.deepEqual(needsOf(byName('Bench Press')).sort(), ['barbell', 'bench', 'rack']);
  assert.deepEqual(needsOf(byName('Back Squat')).sort(), ['barbell', 'rack']);
  assert.deepEqual(needsOf(byName('Pull-up')), ['bars']);
  assert.deepEqual(needsOf(byName('Dips')), ['bars']);
  assert.deepEqual(needsOf(byName('Hanging Leg Raise')), ['bars']);
  assert.deepEqual(needsOf(byName('Push-up')), []);
  assert.deepEqual(needsOf(byName('Dumbbell Curl')), ['dumbbell']);
  assert.deepEqual(needsOf(byName('Decline Sit-up')), ['bench']);
  assert.ok(needsOf(byName('Back Extension')).includes('machine'));
  assert.deepEqual(needsOf({ custom: true, equipment: 'machine' }), [], 'custom lifts are always allowed');
});

test('free weights only: no cables, machines or smith; dropping the rack drops barbell squats and bench', () => {
  for (const ex of EXERCISES.filter(e => fitsGear(e, FREE_WEIGHTS))) {
    assert.ok(!['cable', 'machine', 'plate_loaded', 'smith', 'assisted'].includes(ex.equipment), ex.name);
  }
  const noRack = FREE_WEIGHTS.filter(g => g !== 'rack');
  assert.ok(!fitsGear(byName('Back Squat'), noRack));
  assert.ok(!fitsGear(byName('Bench Press'), noRack));
  assert.ok(fitsGear(byName('Dumbbell Bench Press'), noRack));
  assert.ok(!fitsGear(byName('Pull-up'), FREE_WEIGHTS), 'no bars, no pull-ups');
  assert.ok(fitsGear(byName('Pull-up'), [...FREE_WEIGHTS, 'bars']));
});

test('a built workout with free weights only uses lifts that fit and still trains the big muscles', () => {
  const fit = EXERCISES.filter(e => fitsGear(e, FREE_WEIGHTS));
  for (const m of ['chest', 'back', 'quads', 'hamstrings', 'shoulders', 'biceps', 'triceps', 'glutes']) {
    assert.ok(fit.filter(e => e.muscle === m).length >= 2, `${MUSCLES[m]} can be trained with free weights`);
  }
  const lookup = id => EXERCISES.find(e => e.id === id);
  for (let seed = 1; seed <= 20; seed++) {
    const plan = buildWorkout({ exercises: fit, lookup, budget: 20, seed, mode: 'auto' });
    assert.ok(!plan.error, `seed ${seed}`);
    for (const it of plan.items) assert.ok(fitsGear(lookup(it.exId), FREE_WEIGHTS), lookup(it.exId).name);
  }
  const legs = buildWorkout({ exercises: fit, lookup, budget: 16, mode: 'pick', muscles: ['quads', 'hamstrings'] });
  assert.ok(!legs.error && legs.items.length >= 4);
});

test('heaviest dumbbell: more reps at that dumbbell instead of a heavier one', () => {
  const db = byName('Dumbbell Bench Press');
  const sug = { weight: 60, reps: [8, 8, 7], est: 80 };
  const repsAt = w => Math.round(30 * (80 / w - 1));
  const c = capDumbbell(sug, db, 50, repsAt);
  assert.equal(c.weight, 50);
  assert.ok(c.reps.every((r, i) => r > sug.reps[i] && r <= 30), JSON.stringify(c.reps));
  assert.match(c.reason, /Heaviest dumbbell/);
  assert.equal(c.zone[1], 30, 'later rep goals at that weight are not clipped to 12');
  assert.equal(capDumbbell(sug, db, 70, repsAt), sug, 'under the cap: unchanged');
  assert.equal(capDumbbell(sug, db, null, repsAt), sug, 'no cap: unchanged');
  assert.equal(capDumbbell(sug, byName('Bench Press'), 50, repsAt), sug, 'barbells are not capped');
  assert.equal(capDumbbell(null, db, 50, repsAt), null);
});
