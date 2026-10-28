// Exercise library and day types.

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
};

// Order of muscles here is the order suggestions are grouped in.
export const DAY_TYPES = [
  { id: 'upper', name: 'Upper', muscles: ['back', 'biceps', 'chest', 'shoulders', 'triceps', 'abs'] },
  { id: 'lower', name: 'Lower', muscles: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'] },
  { id: 'back_bi', name: 'Back & Biceps', muscles: ['back', 'biceps', 'abs'] },
  { id: 'chest_sh_tri', name: 'Chest, Shoulders & Triceps', muscles: ['chest', 'shoulders', 'triceps', 'abs'] },
  { id: 'legs', name: 'Legs', muscles: ['quads', 'hamstrings', 'glutes', 'calves'] },
];

export const EQUIPMENT = {
  barbell: { name: 'Barbell', increment: 5 },
  dumbbell: { name: 'Dumbbell', increment: 5 },
  cable: { name: 'Cable', increment: 5 },
  machine: { name: 'Machine', increment: 10 },
  bodyweight: { name: 'Bodyweight', increment: 5 },
};

// compound: true -> rep zone 6-12, false -> 8-15
const E = (id, name, muscle, equipment, compound = false) => ({ id, name, muscle, equipment, compound });

export const EXERCISES = [
  // Back
  E('lat_pulldown', 'Lat Pulldown', 'back', 'cable', true),
  E('pull_up', 'Pull-up', 'back', 'bodyweight', true),
  E('chin_up', 'Chin-up', 'back', 'bodyweight', true),
  E('barbell_row', 'Barbell Row', 'back', 'barbell', true),
  E('cable_row', 'Seated Cable Row', 'back', 'cable', true),
  E('db_row', 'One-Arm Dumbbell Row', 'back', 'dumbbell', true),
  E('machine_row', 'Machine Row', 'back', 'machine', true),
  E('tbar_row', 'T-Bar Row', 'back', 'machine', true),
  E('straight_arm_pulldown', 'Straight-Arm Pulldown', 'back', 'cable'),
  E('face_pull', 'Face Pull', 'back', 'cable'),
  // Biceps
  E('barbell_curl', 'Barbell Curl', 'biceps', 'barbell'),
  E('ez_curl', 'EZ-Bar Curl', 'biceps', 'barbell'),
  E('db_curl', 'Dumbbell Curl', 'biceps', 'dumbbell'),
  E('hammer_curl', 'Hammer Curl', 'biceps', 'dumbbell'),
  E('incline_db_curl', 'Incline Dumbbell Curl', 'biceps', 'dumbbell'),
  E('preacher_curl', 'Preacher Curl', 'biceps', 'machine'),
  E('cable_curl', 'Cable Curl', 'biceps', 'cable'),
  // Chest
  E('bench_press', 'Bench Press', 'chest', 'barbell', true),
  E('incline_bench', 'Incline Bench Press', 'chest', 'barbell', true),
  E('db_bench', 'Dumbbell Bench Press', 'chest', 'dumbbell', true),
  E('incline_db_press', 'Incline Dumbbell Press', 'chest', 'dumbbell', true),
  E('machine_chest_press', 'Machine Chest Press', 'chest', 'machine', true),
  E('cable_fly', 'Cable Fly', 'chest', 'cable'),
  E('pec_deck', 'Pec Deck', 'chest', 'machine'),
  E('push_up', 'Push-up', 'chest', 'bodyweight', true),
  // Shoulders
  E('overhead_press', 'Overhead Press', 'shoulders', 'barbell', true),
  E('db_shoulder_press', 'Dumbbell Shoulder Press', 'shoulders', 'dumbbell', true),
  E('machine_shoulder_press', 'Machine Shoulder Press', 'shoulders', 'machine', true),
  E('lateral_raise', 'Lateral Raise', 'shoulders', 'dumbbell'),
  E('cable_lateral_raise', 'Cable Lateral Raise', 'shoulders', 'cable'),
  E('rear_delt_fly', 'Rear Delt Fly', 'shoulders', 'dumbbell'),
  E('reverse_pec_deck', 'Reverse Pec Deck', 'shoulders', 'machine'),
  // Triceps
  E('tricep_pushdown', 'Tricep Pushdown', 'triceps', 'cable'),
  E('rope_pushdown', 'Rope Pushdown', 'triceps', 'cable'),
  E('overhead_tricep_ext', 'Overhead Tricep Extension', 'triceps', 'cable'),
  E('skull_crusher', 'Skull Crusher', 'triceps', 'barbell'),
  E('close_grip_bench', 'Close-Grip Bench Press', 'triceps', 'barbell', true),
  E('dips', 'Dips', 'triceps', 'bodyweight', true),
  // Quads
  E('squat', 'Back Squat', 'quads', 'barbell', true),
  E('front_squat', 'Front Squat', 'quads', 'barbell', true),
  E('leg_press', 'Leg Press', 'quads', 'machine', true),
  E('hack_squat', 'Hack Squat', 'quads', 'machine', true),
  E('bulgarian_split_squat', 'Bulgarian Split Squat', 'quads', 'dumbbell', true),
  E('walking_lunge', 'Walking Lunge', 'quads', 'dumbbell', true),
  E('leg_extension', 'Leg Extension', 'quads', 'machine'),
  // Hamstrings
  E('rdl', 'Romanian Deadlift', 'hamstrings', 'barbell', true),
  E('deadlift', 'Deadlift', 'hamstrings', 'barbell', true),
  E('db_rdl', 'Dumbbell RDL', 'hamstrings', 'dumbbell', true),
  E('lying_leg_curl', 'Lying Leg Curl', 'hamstrings', 'machine'),
  E('seated_leg_curl', 'Seated Leg Curl', 'hamstrings', 'machine'),
  // Glutes
  E('hip_thrust', 'Hip Thrust', 'glutes', 'barbell', true),
  E('glute_kickback', 'Cable Glute Kickback', 'glutes', 'cable'),
  E('hip_abduction', 'Hip Abduction', 'glutes', 'machine'),
  // Calves
  E('standing_calf_raise', 'Standing Calf Raise', 'calves', 'machine'),
  E('seated_calf_raise', 'Seated Calf Raise', 'calves', 'machine'),
  // Abs
  E('cable_crunch', 'Cable Crunch', 'abs', 'cable'),
  E('hanging_leg_raise', 'Hanging Leg Raise', 'abs', 'bodyweight'),
  E('ab_machine', 'Ab Crunch Machine', 'abs', 'machine'),
  E('decline_situp', 'Decline Sit-up', 'abs', 'bodyweight'),
  E('ab_wheel', 'Ab Wheel Rollout', 'abs', 'bodyweight'),
];

export function dayType(id) {
  return DAY_TYPES.find(d => d.id === id);
}
