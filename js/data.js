// Exercise library, muscles, muscle regions and day types.

export const MUSCLES = {
  back: 'Back',
  biceps: 'Biceps',
  chest: 'Chest',
  shoulders: 'Shoulders',
  triceps: 'Triceps',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  abs: 'Abs',
  forearms: 'Forearms',
  adductors: 'Adductors',
};

// Parts of each muscle. `size` sets each region's share of its muscle's
// weekly set target (bigger regions need more of the work).
export const REGIONS = {
  chest_upper: { name: 'Upper chest', muscle: 'chest', size: 1 },
  chest_mid: { name: 'Mid chest', muscle: 'chest', size: 1.5 },
  chest_lower: { name: 'Lower chest', muscle: 'chest', size: 0.8 },
  delt_front: { name: 'Front delts', muscle: 'shoulders', size: 0.8 },
  delt_side: { name: 'Side delts', muscle: 'shoulders', size: 1.2 },
  delt_rear: { name: 'Rear delts', muscle: 'shoulders', size: 1 },
  lats: { name: 'Lats', muscle: 'back', size: 1.5 },
  upper_back: { name: 'Upper back', muscle: 'back', size: 1.2 },
  traps: { name: 'Upper traps', muscle: 'back', size: 0.6 },
  lower_back: { name: 'Lower back', muscle: 'back', size: 0.6 },
  bi_long: { name: 'Biceps long head', muscle: 'biceps', size: 1 },
  bi_short: { name: 'Biceps short head', muscle: 'biceps', size: 1 },
  brachialis: { name: 'Brachialis', muscle: 'biceps', size: 0.8 },
  tri_long: { name: 'Triceps long head', muscle: 'triceps', size: 1.2 },
  tri_lateral: { name: 'Triceps lateral & medial heads', muscle: 'triceps', size: 1 },
  rectus_femoris: { name: 'Rectus femoris', muscle: 'quads', size: 0.6 },
  vasti: { name: 'Vastus muscles', muscle: 'quads', size: 1.4 },
  ham_hinge: { name: 'Hamstrings (hip hinge)', muscle: 'hamstrings', size: 1 },
  ham_curl: { name: 'Hamstrings (knee flexion)', muscle: 'hamstrings', size: 1 },
  glute_max: { name: 'Glute max', muscle: 'glutes', size: 1.4 },
  glute_med: { name: 'Glute med', muscle: 'glutes', size: 0.6 },
  gastrocnemius: { name: 'Calves (gastrocnemius)', muscle: 'calves', size: 1 },
  soleus: { name: 'Calves (soleus)', muscle: 'calves', size: 0.7 },
  abs_rectus: { name: 'Abs', muscle: 'abs', size: 1 },
  obliques: { name: 'Obliques', muscle: 'abs', size: 0.6 },
  forearm_flexors: { name: 'Forearm flexors (grip)', muscle: 'forearms', size: 1 },
  forearm_extensors: { name: 'Forearm extensors', muscle: 'forearms', size: 0.8 },
  adductors: { name: 'Adductors', muscle: 'adductors', size: 1 },
};

// Order of muscles here is the order suggestions are grouped in.
export const DAY_TYPES = [
  { id: 'upper', name: 'Upper', icon: '💪', color: '#9b8cff', muscles: ['back', 'biceps', 'chest', 'shoulders', 'triceps', 'abs'] },
  { id: 'lower', name: 'Lower', icon: '🦵', color: '#ff9447', muscles: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'] },
  { id: 'back_bi', name: 'Back & Biceps', icon: '🏋️', color: '#3ed4ff', muscles: ['back', 'biceps', 'abs'] },
  { id: 'chest_sh_tri', name: 'Chest, Shoulders & Triceps', icon: '🔥', color: '#ff5f9e', muscles: ['chest', 'shoulders', 'triceps', 'abs'] },
  { id: 'legs', name: 'Legs', icon: '⚡', color: '#c4f542', muscles: ['quads', 'hamstrings', 'glutes', 'calves'] },
];

// Workouts made with "Build today's workout". Not shown in the split list.
export const CUSTOM_SPLIT = { id: 'custom', name: 'Custom', icon: '🛠️', color: '#5ee0a0', muscles: Object.keys(MUSCLES) };

export const EQUIPMENT = {
  barbell: { name: 'Barbell', increment: 5 },
  dumbbell: { name: 'Dumbbell', increment: 5 },
  cable: { name: 'Cable', increment: 5 },
  machine: { name: 'Machine', increment: 10 },
  bodyweight: { name: 'Bodyweight', increment: 5 },
};

// regions: how much each set counts toward each region. 1 = main target,
// ~0.5 = solid secondary work, under 0.3 = minor. The exercise's `muscle`
// is the muscle of its main region.
const E = (id, name, muscle, equipment, compound, regions) => ({ id, name, muscle, equipment, compound, regions });

export const EXERCISES = [
  // Back
  E('lat_pulldown', 'Lat Pulldown', 'back', 'cable', true, { lats: 1, upper_back: 0.4, bi_short: 0.25, brachialis: 0.2 }),
  E('pull_up', 'Pull-up', 'back', 'bodyweight', true, { lats: 1, upper_back: 0.4, bi_short: 0.25, brachialis: 0.2 }),
  E('chin_up', 'Chin-up', 'back', 'bodyweight', true, { lats: 1, bi_short: 0.5, upper_back: 0.3 }),
  E('barbell_row', 'Barbell Row', 'back', 'barbell', true, { upper_back: 1, lats: 0.6, lower_back: 0.4, delt_rear: 0.4, brachialis: 0.2 }),
  E('cable_row', 'Seated Cable Row', 'back', 'cable', true, { upper_back: 1, lats: 0.6, delt_rear: 0.3, brachialis: 0.2 }),
  E('db_row', 'One-Arm Dumbbell Row', 'back', 'dumbbell', true, { lats: 1, upper_back: 0.7, delt_rear: 0.3, brachialis: 0.2 }),
  E('machine_row', 'Machine Row', 'back', 'machine', true, { upper_back: 1, lats: 0.5, delt_rear: 0.3 }),
  E('tbar_row', 'T-Bar Row', 'back', 'machine', true, { upper_back: 1, lats: 0.6, lower_back: 0.3 }),
  E('straight_arm_pulldown', 'Straight-Arm Pulldown', 'back', 'cable', false, { lats: 1, tri_long: 0.2 }),
  E('shrug', 'Dumbbell Shrug', 'back', 'dumbbell', false, { traps: 1, forearm_flexors: 0.3 }),
  E('back_extension', 'Back Extension', 'back', 'bodyweight', false, { lower_back: 1, glute_max: 0.5, ham_hinge: 0.4 }),
  // Biceps
  E('barbell_curl', 'Barbell Curl', 'biceps', 'barbell', false, { bi_short: 0.9, bi_long: 0.8, brachialis: 0.3 }),
  E('ez_curl', 'EZ-Bar Curl', 'biceps', 'barbell', false, { bi_short: 0.8, bi_long: 0.8, brachialis: 0.4 }),
  E('db_curl', 'Dumbbell Curl', 'biceps', 'dumbbell', false, { bi_long: 0.8, bi_short: 0.8, brachialis: 0.3 }),
  E('hammer_curl', 'Hammer Curl', 'biceps', 'dumbbell', false, { brachialis: 1, bi_long: 0.4, forearm_extensors: 0.6 }),
  E('incline_db_curl', 'Incline Dumbbell Curl', 'biceps', 'dumbbell', false, { bi_long: 1, bi_short: 0.5 }),
  E('preacher_curl', 'Preacher Curl', 'biceps', 'machine', false, { bi_short: 1, bi_long: 0.5, brachialis: 0.4 }),
  E('cable_curl', 'Cable Curl', 'biceps', 'cable', false, { bi_short: 0.9, bi_long: 0.8 }),
  // Chest
  E('bench_press', 'Bench Press', 'chest', 'barbell', true, { chest_mid: 1, chest_lower: 0.4, chest_upper: 0.3, delt_front: 0.5, tri_lateral: 0.5 }),
  E('incline_bench', 'Incline Bench Press', 'chest', 'barbell', true, { chest_upper: 1, chest_mid: 0.5, delt_front: 0.6, tri_lateral: 0.4 }),
  E('db_bench', 'Dumbbell Bench Press', 'chest', 'dumbbell', true, { chest_mid: 1, chest_lower: 0.4, chest_upper: 0.3, delt_front: 0.5, tri_lateral: 0.4 }),
  E('incline_db_press', 'Incline Dumbbell Press', 'chest', 'dumbbell', true, { chest_upper: 1, chest_mid: 0.5, delt_front: 0.6, tri_lateral: 0.3 }),
  E('machine_chest_press', 'Machine Chest Press', 'chest', 'machine', true, { chest_mid: 1, chest_lower: 0.3, delt_front: 0.4, tri_lateral: 0.4 }),
  E('cable_fly', 'Cable Fly', 'chest', 'cable', false, { chest_mid: 1, chest_upper: 0.3, chest_lower: 0.3 }),
  E('low_high_cable_fly', 'Low-to-High Cable Fly', 'chest', 'cable', false, { chest_upper: 1, chest_mid: 0.4, delt_front: 0.2 }),
  E('high_low_cable_fly', 'High-to-Low Cable Fly', 'chest', 'cable', false, { chest_lower: 1, chest_mid: 0.5 }),
  E('pec_deck', 'Pec Deck', 'chest', 'machine', false, { chest_mid: 1, chest_upper: 0.3 }),
  E('push_up', 'Push-up', 'chest', 'bodyweight', true, { chest_mid: 1, delt_front: 0.5, tri_lateral: 0.5, abs_rectus: 0.2 }),
  // Shoulders
  E('overhead_press', 'Overhead Press', 'shoulders', 'barbell', true, { delt_front: 1, delt_side: 0.4, tri_lateral: 0.5, chest_upper: 0.3, traps: 0.2 }),
  E('db_shoulder_press', 'Dumbbell Shoulder Press', 'shoulders', 'dumbbell', true, { delt_front: 1, delt_side: 0.4, tri_lateral: 0.4 }),
  E('machine_shoulder_press', 'Machine Shoulder Press', 'shoulders', 'machine', true, { delt_front: 1, delt_side: 0.4, tri_lateral: 0.4 }),
  E('lateral_raise', 'Lateral Raise', 'shoulders', 'dumbbell', false, { delt_side: 1, traps: 0.2 }),
  E('cable_lateral_raise', 'Cable Lateral Raise', 'shoulders', 'cable', false, { delt_side: 1 }),
  E('rear_delt_fly', 'Rear Delt Fly', 'shoulders', 'dumbbell', false, { delt_rear: 1, upper_back: 0.4 }),
  E('reverse_pec_deck', 'Reverse Pec Deck', 'shoulders', 'machine', false, { delt_rear: 1, upper_back: 0.4 }),
  E('face_pull', 'Face Pull', 'shoulders', 'cable', false, { delt_rear: 1, upper_back: 0.6, traps: 0.3 }),
  // Triceps
  E('tricep_pushdown', 'Tricep Pushdown', 'triceps', 'cable', false, { tri_lateral: 1, tri_long: 0.4 }),
  E('rope_pushdown', 'Rope Pushdown', 'triceps', 'cable', false, { tri_lateral: 1, tri_long: 0.5 }),
  E('overhead_tricep_ext', 'Overhead Tricep Extension', 'triceps', 'cable', false, { tri_long: 1, tri_lateral: 0.5 }),
  E('skull_crusher', 'Skull Crusher', 'triceps', 'barbell', false, { tri_long: 0.9, tri_lateral: 0.7 }),
  E('close_grip_bench', 'Close-Grip Bench Press', 'triceps', 'barbell', true, { tri_lateral: 1, tri_long: 0.4, chest_mid: 0.5, delt_front: 0.3 }),
  E('dips', 'Dips', 'triceps', 'bodyweight', true, { tri_lateral: 1, tri_long: 0.4, chest_lower: 0.6, delt_front: 0.4 }),
  // Quads
  E('squat', 'Back Squat', 'quads', 'barbell', true, { vasti: 1, rectus_femoris: 0.3, glute_max: 0.6, adductors: 0.5, lower_back: 0.3 }),
  E('front_squat', 'Front Squat', 'quads', 'barbell', true, { vasti: 1, rectus_femoris: 0.3, glute_max: 0.4, abs_rectus: 0.2 }),
  E('leg_press', 'Leg Press', 'quads', 'machine', true, { vasti: 1, glute_max: 0.4, adductors: 0.3 }),
  E('hack_squat', 'Hack Squat', 'quads', 'machine', true, { vasti: 1, glute_max: 0.3 }),
  E('bulgarian_split_squat', 'Bulgarian Split Squat', 'quads', 'dumbbell', true, { vasti: 1, glute_max: 0.7, glute_med: 0.3, adductors: 0.3 }),
  E('walking_lunge', 'Walking Lunge', 'quads', 'dumbbell', true, { vasti: 0.9, glute_max: 0.7, glute_med: 0.3, adductors: 0.3 }),
  E('leg_extension', 'Leg Extension', 'quads', 'machine', false, { rectus_femoris: 1, vasti: 0.8 }),
  // Hamstrings
  E('rdl', 'Romanian Deadlift', 'hamstrings', 'barbell', true, { ham_hinge: 1, glute_max: 0.6, lower_back: 0.5, forearm_flexors: 0.2 }),
  E('deadlift', 'Deadlift', 'hamstrings', 'barbell', true, { ham_hinge: 0.8, glute_max: 0.8, lower_back: 0.8, traps: 0.4, upper_back: 0.3, vasti: 0.3, forearm_flexors: 0.3 }),
  E('db_rdl', 'Dumbbell RDL', 'hamstrings', 'dumbbell', true, { ham_hinge: 1, glute_max: 0.6, lower_back: 0.4 }),
  E('lying_leg_curl', 'Lying Leg Curl', 'hamstrings', 'machine', false, { ham_curl: 1, gastrocnemius: 0.2 }),
  E('seated_leg_curl', 'Seated Leg Curl', 'hamstrings', 'machine', false, { ham_curl: 1 }),
  // Glutes
  E('hip_thrust', 'Hip Thrust', 'glutes', 'barbell', true, { glute_max: 1, ham_hinge: 0.3, glute_med: 0.2 }),
  E('glute_kickback', 'Cable Glute Kickback', 'glutes', 'cable', false, { glute_max: 1, glute_med: 0.3 }),
  E('hip_abduction', 'Hip Abduction', 'glutes', 'machine', false, { glute_med: 1 }),
  // Calves
  E('standing_calf_raise', 'Standing Calf Raise', 'calves', 'machine', false, { gastrocnemius: 1, soleus: 0.5 }),
  E('seated_calf_raise', 'Seated Calf Raise', 'calves', 'machine', false, { soleus: 1, gastrocnemius: 0.3 }),
  // Abs
  E('cable_crunch', 'Cable Crunch', 'abs', 'cable', false, { abs_rectus: 1, obliques: 0.3 }),
  E('hanging_leg_raise', 'Hanging Leg Raise', 'abs', 'bodyweight', false, { abs_rectus: 1, obliques: 0.3, forearm_flexors: 0.2 }),
  E('ab_machine', 'Ab Crunch Machine', 'abs', 'machine', false, { abs_rectus: 1 }),
  E('decline_situp', 'Decline Sit-up', 'abs', 'bodyweight', false, { abs_rectus: 1, obliques: 0.2 }),
  E('ab_wheel', 'Ab Wheel Rollout', 'abs', 'bodyweight', false, { abs_rectus: 1, obliques: 0.3, lats: 0.2 }),
  E('cable_woodchop', 'Cable Woodchop', 'abs', 'cable', false, { obliques: 1, abs_rectus: 0.3 }),
  // Forearms
  E('wrist_curl', 'Wrist Curl', 'forearms', 'dumbbell', false, { forearm_flexors: 1 }),
  E('reverse_wrist_curl', 'Reverse Wrist Curl', 'forearms', 'dumbbell', false, { forearm_extensors: 1 }),
  E('reverse_curl', 'Reverse Curl', 'forearms', 'barbell', false, { forearm_extensors: 1, brachialis: 0.7 }),
  // Adductors
  E('adductor_machine', 'Adductor Machine', 'adductors', 'machine', false, { adductors: 1 }),
  E('sumo_squat', 'Dumbbell Sumo Squat', 'adductors', 'dumbbell', true, { adductors: 0.9, vasti: 0.6, glute_max: 0.6 }),
];

export const regionsOf = muscle => Object.keys(REGIONS).filter(r => REGIONS[r].muscle === muscle);

/**
 * Region weights for an exercise. Custom exercises without a mapping count
 * toward their muscle's regions: fully for a chosen main area, or evenly.
 */
export function exerciseRegions(ex) {
  if (ex.regions) return ex.regions;
  const rs = regionsOf(ex.muscle);
  if (ex.mainRegion && REGIONS[ex.mainRegion]) return Object.fromEntries(rs.map(r => [r, r === ex.mainRegion ? 1 : 0.3]));
  return Object.fromEntries(rs.map(r => [r, 0.8]));
}

/** The region an exercise mainly trains (highest weight). */
export function primaryRegion(ex) {
  const regs = exerciseRegions(ex);
  let best = null;
  for (const [r, w] of Object.entries(regs)) if (!best || w > regs[best]) best = r;
  return best;
}

export function dayType(id) {
  return DAY_TYPES.find(d => d.id === id);
}
