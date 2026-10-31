import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, MUSCLES, REGIONS, EQUIPMENT, EQUIPMENT_PROFILES, primaryRegion, allowedBy } from '../js/data.js';
import { searchExercises, matchSuggestions } from '../js/search.js';

const byName = n => EXERCISES.find(e => e.name === n);

// Every exercise id that existed before the library grew. History points at
// these, so they must never disappear.
const OLD_IDS = ['lat_pulldown', 'pull_up', 'chin_up', 'barbell_row', 'cable_row', 'db_row', 'machine_row', 'tbar_row', 'straight_arm_pulldown', 'shrug', 'back_extension',
  'barbell_curl', 'ez_curl', 'db_curl', 'hammer_curl', 'incline_db_curl', 'preacher_curl', 'cable_curl', 'bench_press', 'incline_bench', 'db_bench', 'incline_db_press',
  'machine_chest_press', 'cable_fly', 'low_high_cable_fly', 'high_low_cable_fly', 'pec_deck', 'push_up', 'overhead_press', 'db_shoulder_press', 'machine_shoulder_press',
  'lateral_raise', 'cable_lateral_raise', 'rear_delt_fly', 'reverse_pec_deck', 'face_pull', 'tricep_pushdown', 'rope_pushdown', 'overhead_tricep_ext', 'skull_crusher',
  'close_grip_bench', 'dips', 'squat', 'front_squat', 'leg_press', 'hack_squat', 'bulgarian_split_squat', 'walking_lunge', 'leg_extension', 'rdl', 'deadlift', 'db_rdl',
  'lying_leg_curl', 'seated_leg_curl', 'hip_thrust', 'glute_kickback', 'hip_abduction', 'standing_calf_raise', 'seated_calf_raise', 'cable_crunch', 'hanging_leg_raise',
  'ab_machine', 'decline_situp', 'ab_wheel', 'cable_woodchop', 'wrist_curl', 'reverse_wrist_curl', 'reverse_curl', 'adductor_machine', 'sumo_squat', 'decline_db_press',
  'db_overhead_ext', 'sissy_squat', 'nordic_curl', 'side_lying_leg_raise', 'db_calf_raise', 'db_seated_calf_raise', 'db_side_bend', 'chest_supported_row', 'db_hip_thrust'];

test('library: every old exercise id is still there with its name', () => {
  for (const id of OLD_IDS) assert.ok(EXERCISES.some(e => e.id === id), `${id} missing`);
  assert.equal(EXERCISES.find(e => e.id === 'bench_press').name, 'Bench Press');
  assert.equal(EXERCISES.find(e => e.id === 'leg_press').name, 'Leg Press');
});

test('library: unique ids and names, valid muscles, regions and equipment', () => {
  assert.ok(EXERCISES.length >= 200, `${EXERCISES.length} exercises`);
  const ids = new Set(), names = new Set();
  for (const e of EXERCISES) {
    assert.ok(!ids.has(e.id), `duplicate id ${e.id}`); ids.add(e.id);
    assert.ok(!names.has(e.name.toLowerCase()), `duplicate name ${e.name}`); names.add(e.name.toLowerCase());
    assert.ok(MUSCLES[e.muscle], `${e.id}: muscle ${e.muscle}`);
    assert.ok(EQUIPMENT[e.equipment], `${e.id}: equipment ${e.equipment}`);
    assert.ok(e.movement, `${e.id}: no movement`);
    for (const [r, w] of Object.entries(e.regions)) assert.ok(REGIONS[r] && w > 0 && w <= 1, `${e.id}: region ${r}=${w}`);
    assert.equal(REGIONS[primaryRegion(e)].muscle, e.muscle, `${e.id}: main region ${primaryRegion(e)} isn't ${e.muscle}`);
  }
});

test('library: the machines you asked about exist', () => {
  for (const n of ['Plate-Loaded Incline Press', 'Machine Incline Press', 'Plate-Loaded Decline Press', 'Machine Decline Press', 'Smith Machine Incline Press',
    'Plate-Loaded Chest Press', 'Plate-Loaded Leg Press (45°)', 'Pendulum Squat', 'Plate-Loaded High Row', 'Assisted Pull-up', 'Assisted Dip', 'Trap Bar Deadlift']) {
    assert.ok(byName(n), `${n} missing`);
  }
  assert.equal(byName('Plate-Loaded Incline Press').equipment, 'plate_loaded');
  assert.equal(byName('Machine Incline Press').equipment, 'machine');
  assert.equal(byName('Plate-Loaded Incline Press').angle, 'incline');
  assert.equal(byName('Plate-Loaded Incline Press').movement, EXERCISES.find(e => e.id === 'incline_bench').movement);
});

test('library: every setup equipment choice still covers every region', () => {
  for (const [p] of Object.entries(EQUIPMENT_PROFILES)) {
    for (const r of Object.keys(REGIONS)) {
      assert.ok(EXERCISES.some(e => allowedBy(p, e) && (e.regions[r] || 0) >= 0.75), `${p}: nothing trains ${r}`);
    }
  }
});

test('search: plain words, synonyms and filters find the right machine', () => {
  const top = (q, f, r) => searchExercises(EXERCISES, q, f, r)[0]?.name;
  assert.equal(top('incline plate'), 'Plate-Loaded Incline Press');
  assert.equal(top('plated incline bench'), 'Plate-Loaded Incline Press');
  assert.equal(top('incline', { equipment: 'plate_loaded', muscle: 'chest' }), 'Plate-Loaded Incline Press');
  assert.equal(top('pin incline'), 'Machine Incline Press');
  assert.equal(top('smith squat'), 'Smith Machine Squat');
  assert.equal(top('db bench'), 'Dumbbell Bench Press');
  assert.equal(top('assisted pull up'), 'Assisted Pull-up');
  assert.ok(searchExercises(EXERCISES, 'hex deadlift').some(e => e.name === 'Trap Bar Deadlift'));
  // Partial typing.
  assert.ok(searchExercises(EXERCISES, 'pendul').some(e => e.name === 'Pendulum Squat'));
  // Filters alone.
  const declines = searchExercises(EXERCISES, '', { muscle: 'chest', angle: 'decline' });
  assert.ok(declines.length >= 5 && declines.every(e => e.angle === 'decline' && e.muscle === 'chest'));
  // "machine" means any machine type.
  const m = searchExercises(EXERCISES, 'leg press machine');
  assert.ok(m.some(e => e.equipment === 'plate_loaded') && m.some(e => e.equipment === 'machine'));
  // Nonsense finds nothing.
  assert.deepEqual(searchExercises(EXERCISES, 'zzqx'), []);
});

test('search: starred and used lifts come first', () => {
  const plate = byName('Plate-Loaded Incline Press');
  const r = searchExercises(EXERCISES, 'incline press', {}, { stars: [plate.id] });
  assert.equal(r[0].id, plate.id);
  const used = searchExercises(EXERCISES, 'incline press', {}, { usage: { incline_db_press: 8 } });
  assert.equal(used[0].id, 'incline_db_press');
});

test('matching: custom names find the library exercise they are', () => {
  const custom = (name, muscle, equipment) => ({ id: 'c_x', name, muscle, equipment, custom: true });
  const best = c => matchSuggestions(c, EXERCISES)[0]?.ex.name;
  assert.equal(best(custom('plated incline bench', 'chest', 'machine')), 'Plate-Loaded Incline Press');
  assert.equal(best(custom('Hammer Strength incline', 'chest', 'machine')), 'Plate-Loaded Incline Press');
  assert.equal(best(custom('pendulum squat', 'quads', 'machine')), 'Pendulum Squat');
  assert.equal(best(custom('DB shoulder press', 'shoulders', 'dumbbell')), 'Dumbbell Shoulder Press');
  assert.equal(best(custom('assisted pullups', 'back', 'machine')), 'Assisted Pull-up');
  assert.ok(matchSuggestions(custom('plated incline bench', 'chest', 'machine'), EXERCISES).length <= 5);
  assert.deepEqual(matchSuggestions(custom('???', 'chest', 'machine'), EXERCISES), []);
});

test('search: a machine you have used once ranks above unused common versions', () => {
  const plate = EXERCISES.find(e => e.name === 'Plate-Loaded Incline Press');
  assert.equal(searchExercises(EXERCISES, 'incline', { muscle: 'chest' }, { usage: { [plate.id]: 1 } })[0].id, plate.id);
});

test('library: inner and outer thigh machines, and other common gym machines', () => {
  const top = q => searchExercises(EXERCISES, q)[0]?.name;
  assert.equal(top('inner thigh'), 'Hip Adduction Machine (Inner Thigh)');
  assert.equal(top('outer thigh'), 'Hip Abduction Machine (Outer Thigh)');
  assert.equal(top('adductor'), 'Hip Adduction Machine (Inner Thigh)');
  assert.equal(top('abductor machine'), 'Hip Abduction Machine (Outer Thigh)');
  // Renamed, same ids, so history is kept.
  assert.equal(EXERCISES.find(e => e.id === 'adductor_machine').name, 'Hip Adduction Machine (Inner Thigh)');
  assert.equal(EXERCISES.find(e => e.id === 'hip_abduction').name, 'Hip Abduction Machine (Outer Thigh)');
  for (const n of ['Reverse Hyper Machine', 'Low Row (Plate-Loaded)', 'Donkey Calf Raise Machine', 'Kneeling Leg Curl Machine', 'Leverage Squat (Plate-Loaded)',
    'Converging Chest Press Machine', 'Wide Chest Press (Plate-Loaded)', 'Ab Coaster', 'Standing Hip Abduction Machine (Multi-Hip)', 'Rear Delt Row Machine']) {
    assert.ok(byName(n), `${n} missing`);
  }
});

test('moving history from a library lift suggests its other versions first', () => {
  const from = EXERCISES.find(e => e.id === 'machine_chest_press');
  const top = matchSuggestions(from, EXERCISES, 4).map(x => x.ex);
  assert.ok(top.slice(0, 3).every(e => e.movement === from.movement), top.map(e => e.name).join(', '));
  assert.ok(top.some(e => e.name === 'Plate-Loaded Chest Press'));
});
