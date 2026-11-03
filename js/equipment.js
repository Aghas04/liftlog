// What each exercise needs, so a workout can be built for a gym with only
// some equipment (e.g. barbells, dumbbells and a bench). Pure: no DOM, no state.

// Things a gym can have. Bodyweight needs nothing and is always allowed.
export const GEAR = [
  ['barbell', 'Barbell'], ['dumbbell', 'Dumbbells'], ['ez_bar', 'EZ bar'], ['trap_bar', 'Trap bar'],
  ['kettlebell', 'Kettlebells'], ['cable', 'Cables'], ['machine', 'Machines'], ['smith', 'Smith machine'],
  ['bench', 'Bench'], ['rack', 'Squat rack'], ['bars', 'Pull-up / dip bars'],
];
export const GEAR_KEYS = GEAR.map(([k]) => k);
export const FREE_WEIGHTS = ['barbell', 'dumbbell', 'ez_bar', 'kettlebell', 'bench', 'rack'];
export const FULL_GYM = { id: 'full', name: 'Full gym', gear: GEAR_KEYS, maxDb: null };

// Pin, plate-loaded and assisted machines all count as "Machines".
const BASE = { machine: 'machine', plate_loaded: 'machine', assisted: 'machine' };

// Free-weight versions of these lie, sit or lean on a bench.
const BENCH_MOVES = new Set(['flat_press', 'incline_press', 'decline_press', 'close_grip_press', 'skull_crusher',
  'chest_fly', 'incline_fly', 'pullover', 'one_arm_row', 'chest_supported_row', 'incline_curl', 'spider_curl',
  'preacher_curl', 'hip_thrust', 'split_squat', 'step_up', 'seated_calf_raise', 'dragon_flag']);
// Barbell versions of these start from a rack.
const RACK_MOVES = new Set(['squat', 'front_squat', 'overhead_press', 'flat_press', 'incline_press', 'decline_press',
  'close_grip_press', 'good_morning', 'split_squat', 'lunge']);
// Bodyweight lifts that hang from or press on bars.
const BAR_MOVES = new Set(['pull_up', 'chin_up', 'dip', 'chest_dip', 'dead_hang']);
const FREE = new Set(['barbell', 'dumbbell', 'ez_bar', 'kettlebell', 'trap_bar', 'bodyweight']);

/** The gear keys an exercise needs (empty for floor bodyweight work and custom lifts). */
export function needsOf(ex) {
  if (!ex || ex.custom) return [];
  const need = new Set();
  const eq = ex.equipment;
  if (eq !== 'bodyweight') need.add(BASE[eq] || eq);
  const mv = ex.movement;
  const name = ex.name || '';
  if (FREE.has(eq) && BENCH_MOVES.has(mv)) need.add('bench');
  if (/decline/i.test(name) && eq !== 'machine' && eq !== 'plate_loaded' && eq !== 'smith' && eq !== 'cable') need.add('bench');
  if (eq === 'barbell' && RACK_MOVES.has(mv)) need.add('rack');
  if (eq === 'bodyweight') {
    if (BAR_MOVES.has(mv) || /hanging|toes-to-bar/i.test(name)) need.add('bars');
    if (mv === 'back_extension' || /captain|glute-ham/i.test(name)) need.add('machine');
  }
  return [...need];
}

// Presses where dumbbells train the lift differently from a bar or machine:
// a deeper stretch and each arm working on its own, against heavier, steadier
// loading with the bar or machine. Having both on different days is useful.
const DB_DIFFERS = new Set(['flat_press', 'incline_press', 'decline_press', 'overhead_press']);

/**
 * Are two versions of the same movement worth having both (on different days)?
 * Only when they train it differently. Machine vs dumbbell hip thrust, say,
 * train the same part the same way: switching adds nothing and restarts progress.
 */
export const worthBoth = (a, b) => !!a && !!b && a.id !== b.id && a.movement === b.movement
  && DB_DIFFERS.has(a.movement) && (a.equipment === 'dumbbell') !== (b.equipment === 'dumbbell');

/** Can this exercise be done with this gear? */
export function fitsGear(ex, gear) {
  const have = gear instanceof Set ? gear : new Set(gear);
  return needsOf(ex).every(g => have.has(g));
}

/** Is this the whole gym (nothing to filter)? */
export const isFullGym = gear => GEAR_KEYS.every(k => gear.includes(k));

/**
 * The heaviest-dumbbell cap: if a suggestion asks for more than the heaviest
 * dumbbell, use that dumbbell and more reps. repsAt(weight, setIndex) gives the
 * rep goal at a weight. Returns the suggestion unchanged when no cap applies.
 */
export function capDumbbell(sug, ex, maxDb, repsAt) {
  if (!sug || !maxDb || ex.equipment !== 'dumbbell' || ex.timed || !(Math.max(sug.weight, ...(sug.weights || [])) > maxDb)) return sug;
  const over = i => (sug.weights ? sug.weights[i] : sug.weight) > maxDb;
  const reps = sug.reps.map((r, i) => (over(i) ? Math.min(30, Math.max(r, repsAt(maxDb, i) || r)) : r));
  if (sug.weights) return { ...sug, weights: sug.weights.map(w => Math.min(w, maxDb)), weight: Math.min(sug.weight, maxDb), reps, capped: true, zone: [sug.zone?.[0] ?? 6, 30],
    reason: 'Heaviest dumbbell here: more reps on the sets that wanted more weight.' };
  // Rep goals may go past the usual range (up to 30) at the capped weight.
  return { ...sug, weight: maxDb, reps, capped: true, zone: [sug.zone?.[0] ?? 6, 30],
    reason: `Heaviest dumbbell here: do more reps (up to 30), slow the lowering, or pause at the stretch.` };
}
