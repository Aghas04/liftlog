// The full exercise library as movements x equipment versions.
//
// A movement (incline press, seated row, leg curl...) decides the muscle, the
// regions it trains and whether it's a compound lift. Each equipment version
// is its own exercise, because a plate-loaded incline press and a pin-stack
// one have different weights and progress separately.
//
// Variant: [equipment, id, name, extra?]
//   id: an existing exercise id (kept so history carries over), or null to
//       generate `${movement}_${equipment}`.
//   name: null keeps the existing exercise's name.
//   extra: { regions, unilateral, grip, hard, common, compound }
// Movement attrs: { angle: 'flat'|'incline'|'decline', position }
const M = (key, muscle, compound, regions, attrs, variants) => ({ key, muscle, compound, regions, attrs, variants });

const BENCH = { chest_mid: 1, chest_lower: 0.4, chest_upper: 0.3, delt_front: 0.5, tri_lateral: 0.5 };
const INCLINE = { chest_upper: 1, chest_mid: 0.5, delt_front: 0.6, tri_lateral: 0.4 };
const DECLINE = { chest_lower: 1, chest_mid: 0.5, tri_lateral: 0.4 };
const PULLDOWN = { lats: 1, upper_back: 0.4, bi_short: 0.25, brachialis: 0.2 };
const ROW = { upper_back: 1, lats: 0.6, delt_rear: 0.3, brachialis: 0.2 };
const OHP = { delt_front: 1, delt_side: 0.4, tri_lateral: 0.4 };
const SQUAT = { vasti: 1, rectus_femoris: 0.3, glute_max: 0.6, adductors: 0.5, lower_back: 0.3 };
const MACHINE_SQUAT = { vasti: 1, glute_max: 0.4, adductors: 0.3 };
const RDL = { ham_hinge: 1, glute_max: 0.6, lower_back: 0.5, forearm_flexors: 0.2 };
const THRUST = { glute_max: 1, ham_hinge: 0.3, glute_med: 0.2 };

export const MOVEMENTS = [
  // ---------- Chest ----------
  M('flat_press', 'chest', true, BENCH, { angle: 'flat' }, [
    ['barbell', 'bench_press', null], ['dumbbell', 'db_bench', null], ['machine', 'machine_chest_press', null],
    ['plate_loaded', null, 'Plate-Loaded Chest Press'], ['smith', null, 'Smith Machine Bench Press'],
    ['plate_loaded', 'iso_chest_press_plate', 'Iso-Lateral Chest Press (Plate-Loaded)', { unilateral: true }],
    ['plate_loaded', 'wide_chest_press_plate', 'Wide Chest Press (Plate-Loaded)'], ['machine', 'converging_chest_press', 'Converging Chest Press Machine'],
    ['cable', 'cable_chest_press', 'Standing Cable Chest Press'],
  ]),
  M('incline_press', 'chest', true, INCLINE, { angle: 'incline' }, [
    ['barbell', 'incline_bench', null], ['dumbbell', 'incline_db_press', null], ['machine', null, 'Machine Incline Press'],
    ['plate_loaded', null, 'Plate-Loaded Incline Press'], ['smith', null, 'Smith Machine Incline Press'],
    ['plate_loaded', 'iso_incline_press_plate', 'Iso-Lateral Incline Press (Plate-Loaded)', { unilateral: true }],
  ]),
  M('decline_press', 'chest', true, DECLINE, { angle: 'decline' }, [
    ['barbell', null, 'Decline Bench Press'], ['dumbbell', 'decline_db_press', null], ['machine', null, 'Machine Decline Press'],
    ['plate_loaded', null, 'Plate-Loaded Decline Press'], ['smith', null, 'Smith Machine Decline Press'],
  ]),
  M('chest_fly', 'chest', false, { chest_mid: 1, chest_upper: 0.3, chest_lower: 0.3 }, { angle: 'flat' }, [
    ['cable', 'cable_fly', null], ['machine', 'pec_deck', null], ['dumbbell', null, 'Dumbbell Fly'],
    ['plate_loaded', null, 'Plate-Loaded Chest Fly'],
  ]),
  M('incline_fly', 'chest', false, { chest_upper: 1, chest_mid: 0.4, delt_front: 0.2 }, { angle: 'incline' }, [
    ['cable', 'low_high_cable_fly', null], ['dumbbell', null, 'Incline Dumbbell Fly'],
  ]),
  M('decline_fly', 'chest', false, { chest_lower: 1, chest_mid: 0.5 }, { angle: 'decline' }, [
    ['cable', 'high_low_cable_fly', null],
  ]),
  M('push_up', 'chest', true, { chest_mid: 1, delt_front: 0.5, tri_lateral: 0.5, abs_rectus: 0.2 }, {}, [
    ['bodyweight', 'push_up', null],
  ]),
  M('chest_dip', 'chest', true, { chest_lower: 1, tri_lateral: 0.6, delt_front: 0.4 }, { angle: 'decline' }, [
    ['bodyweight', null, 'Chest Dip'], ['assisted', null, 'Assisted Chest Dip'],
  ]),

  // ---------- Back ----------
  M('lat_pulldown', 'back', true, PULLDOWN, { position: 'seated' }, [
    ['cable', 'lat_pulldown', null], ['machine', null, 'Machine Lat Pulldown'], ['plate_loaded', null, 'Plate-Loaded Lat Pulldown'],
    ['cable', 'close_grip_pulldown', 'Close-Grip Lat Pulldown', { grip: 'close', regions: { lats: 1, upper_back: 0.3, bi_short: 0.3, brachialis: 0.2 } }],
    ['cable', 'single_arm_pulldown', 'Single-Arm Cable Pulldown', { unilateral: true }],
    ['plate_loaded', 'iso_pulldown_plate', 'Iso-Lateral Front Pulldown (Plate-Loaded)', { unilateral: true }],
    ['machine', 'dual_pulley_pulldown', 'Dual-Handle Lat Pulldown Machine'],
  ]),
  M('pull_up', 'back', true, PULLDOWN, {}, [
    ['bodyweight', 'pull_up', null], ['assisted', null, 'Assisted Pull-up'],
  ]),
  M('chin_up', 'back', true, { lats: 1, bi_short: 0.5, upper_back: 0.3 }, {}, [
    ['bodyweight', 'chin_up', null], ['assisted', null, 'Assisted Chin-up'],
  ]),
  M('seated_row', 'back', true, ROW, { position: 'seated' }, [
    ['cable', 'cable_row', null], ['machine', 'machine_row', null], ['plate_loaded', null, 'Plate-Loaded Seated Row'],
    ['plate_loaded', 'iso_row_plate', 'Iso-Lateral Row (Plate-Loaded)', { unilateral: true }],
    ['plate_loaded', 'low_row_plate', 'Low Row (Plate-Loaded)'], ['plate_loaded', 'iso_low_row_plate', 'Iso-Lateral Low Row (Plate-Loaded)', { unilateral: true }],
  ]),
  M('bent_row', 'back', true, { upper_back: 1, lats: 0.6, lower_back: 0.4, delt_rear: 0.4, brachialis: 0.2 }, { position: 'standing' }, [
    ['barbell', 'barbell_row', null], ['smith', null, 'Smith Machine Row'], ['dumbbell', null, 'Bent-Over Dumbbell Row'],
  ]),
  M('one_arm_row', 'back', true, { lats: 1, upper_back: 0.7, delt_rear: 0.3, brachialis: 0.2 }, {}, [
    ['dumbbell', 'db_row', null, { unilateral: true }], ['cable', null, 'Single-Arm Cable Row', { unilateral: true }],
    ['kettlebell', null, 'Kettlebell Row', { unilateral: true }],
  ]),
  M('tbar_row', 'back', true, { upper_back: 1, lats: 0.6, lower_back: 0.3 }, {}, [
    ['machine', 'tbar_row', null], ['barbell', null, 'Landmine T-Bar Row'],
    ['plate_loaded', null, 'Chest-Supported T-Bar Row (Plate-Loaded)', { regions: { upper_back: 1, lats: 0.6, delt_rear: 0.3 } }],
  ]),
  M('chest_supported_row', 'back', true, { upper_back: 1, lats: 0.5, delt_rear: 0.4, brachialis: 0.2 }, {}, [
    ['dumbbell', 'chest_supported_row', null], ['machine', null, 'Chest-Supported Machine Row'],
    ['plate_loaded', null, 'Plate-Loaded Chest-Supported Row'],
  ]),
  M('high_row', 'back', true, { lats: 1, upper_back: 0.8, delt_rear: 0.3 }, { position: 'seated' }, [
    ['plate_loaded', null, 'Plate-Loaded High Row'], ['machine', null, 'Machine High Row'], ['cable', null, 'Kneeling High Cable Row'],
  ]),
  M('pullover', 'back', false, { lats: 1, tri_long: 0.2 }, {}, [
    ['cable', 'straight_arm_pulldown', null], ['dumbbell', null, 'Dumbbell Pullover', { regions: { lats: 1, chest_mid: 0.3, tri_long: 0.2 } }],
    ['machine', null, 'Pullover Machine'],
  ]),
  M('shrug', 'back', false, { traps: 1, forearm_flexors: 0.3 }, {}, [
    ['dumbbell', 'shrug', null], ['barbell', null, 'Barbell Shrug'], ['trap_bar', null, 'Trap Bar Shrug'],
    ['smith', null, 'Smith Machine Shrug'], ['machine', null, 'Machine Shrug'],
  ]),
  M('back_extension', 'back', false, { lower_back: 1, glute_max: 0.5, ham_hinge: 0.4 }, {}, [
    ['bodyweight', 'back_extension', null], ['machine', null, 'Back Extension Machine'],
    ['plate_loaded', null, 'Plate-Loaded Back Extension'],
  ]),

  // ---------- Biceps ----------
  M('curl', 'biceps', false, { bi_short: 0.9, bi_long: 0.8, brachialis: 0.3 }, { position: 'standing' }, [
    ['barbell', 'barbell_curl', null], ['ez_bar', 'ez_curl', null], ['dumbbell', 'db_curl', null], ['cable', 'cable_curl', null],
    ['machine', null, 'Machine Curl'], ['plate_loaded', null, 'Plate-Loaded Curl'],
  ]),
  M('hammer_curl', 'biceps', false, { brachialis: 1, bi_long: 0.4, forearm_extensors: 0.6 }, {}, [
    ['dumbbell', 'hammer_curl', null], ['cable', null, 'Rope Hammer Curl'],
  ]),
  M('incline_curl', 'biceps', false, { bi_long: 1, bi_short: 0.5 }, { angle: 'incline' }, [
    ['dumbbell', 'incline_db_curl', null], ['cable', null, 'Behind-the-Body Cable Curl'],
  ]),
  M('preacher_curl', 'biceps', false, { bi_short: 1, bi_long: 0.5, brachialis: 0.4 }, { position: 'seated' }, [
    ['machine', 'preacher_curl', null], ['ez_bar', null, 'EZ-Bar Preacher Curl'], ['dumbbell', null, 'Dumbbell Preacher Curl', { unilateral: true }],
    ['plate_loaded', null, 'Plate-Loaded Preacher Curl'],
  ]),
  M('spider_curl', 'biceps', false, { bi_short: 1, bi_long: 0.4 }, {}, [
    ['dumbbell', null, 'Spider Curl'], ['ez_bar', null, 'EZ-Bar Spider Curl'],
  ]),
  M('concentration_curl', 'biceps', false, { bi_short: 1, bi_long: 0.5, brachialis: 0.3 }, { position: 'seated' }, [
    ['dumbbell', null, 'Concentration Curl', { unilateral: true }],
  ]),

  // ---------- Triceps ----------
  M('pushdown', 'triceps', false, { tri_lateral: 1, tri_long: 0.4 }, {}, [
    ['cable', 'tricep_pushdown', null], ['cable', 'rope_pushdown', null, { grip: 'rope' }],
    ['cable', 'single_arm_pushdown', 'Single-Arm Cable Pushdown', { unilateral: true }],
  ]),
  M('overhead_extension', 'triceps', false, { tri_long: 1, tri_lateral: 0.5 }, {}, [
    ['cable', 'overhead_tricep_ext', null], ['dumbbell', 'db_overhead_ext', null], ['ez_bar', null, 'EZ-Bar Overhead Extension'],
    ['machine', null, 'Machine Overhead Extension'],
  ]),
  M('skull_crusher', 'triceps', false, { tri_long: 0.9, tri_lateral: 0.7 }, { position: 'lying' }, [
    ['barbell', 'skull_crusher', null], ['ez_bar', null, 'EZ-Bar Skull Crusher'], ['dumbbell', null, 'Dumbbell Skull Crusher'],
  ]),
  M('close_grip_press', 'triceps', true, { tri_lateral: 1, tri_long: 0.4, chest_mid: 0.5, delt_front: 0.3 }, { angle: 'flat' }, [
    ['barbell', 'close_grip_bench', null], ['smith', null, 'Smith Machine Close-Grip Bench'],
  ]),
  M('dip', 'triceps', true, { tri_lateral: 1, tri_long: 0.4, chest_lower: 0.6, delt_front: 0.4 }, {}, [
    ['bodyweight', 'dips', null], ['assisted', null, 'Assisted Dip'], ['machine', null, 'Seated Dip Machine'],
    ['plate_loaded', null, 'Plate-Loaded Dip Machine'],
  ]),
  M('kickback', 'triceps', false, { tri_lateral: 1, tri_long: 0.6 }, {}, [
    ['dumbbell', null, 'Dumbbell Tricep Kickback', { unilateral: true }], ['cable', null, 'Cable Tricep Kickback', { unilateral: true }],
  ]),
  M('tricep_machine', 'triceps', false, { tri_lateral: 1, tri_long: 0.5 }, { position: 'seated' }, [
    ['machine', null, 'Tricep Extension Machine'], ['plate_loaded', null, 'Plate-Loaded Tricep Extension'],
  ]),

  // ---------- Shoulders ----------
  M('overhead_press', 'shoulders', true, OHP, {}, [
    ['barbell', 'overhead_press', null], ['dumbbell', 'db_shoulder_press', null], ['machine', 'machine_shoulder_press', null],
    ['plate_loaded', null, 'Plate-Loaded Shoulder Press'], ['smith', null, 'Smith Machine Shoulder Press'],
    ['kettlebell', null, 'Kettlebell Overhead Press', { unilateral: true }],
  ]),
  M('arnold_press', 'shoulders', true, { delt_front: 1, delt_side: 0.6, tri_lateral: 0.3 }, { position: 'seated' }, [
    ['dumbbell', null, 'Arnold Press'],
  ]),
  M('lateral_raise', 'shoulders', false, { delt_side: 1, traps: 0.2 }, {}, [
    ['dumbbell', 'lateral_raise', null], ['cable', 'cable_lateral_raise', null], ['machine', null, 'Lateral Raise Machine'],
    ['cable', 'cable_y_raise', 'Cable Y-Raise', { regions: { delt_side: 1, delt_rear: 0.3, traps: 0.3 } }],
    ['plate_loaded', null, 'Plate-Loaded Lateral Raise'],
  ]),
  M('upright_row', 'shoulders', true, { delt_side: 1, traps: 0.6, delt_front: 0.3 }, { position: 'standing' }, [
    ['barbell', null, 'Barbell Upright Row'], ['cable', null, 'Cable Upright Row'], ['ez_bar', null, 'EZ-Bar Upright Row'],
    ['dumbbell', null, 'Dumbbell Upright Row'],
  ]),
  M('front_raise', 'shoulders', false, { delt_front: 1, chest_upper: 0.2 }, {}, [
    ['dumbbell', null, 'Dumbbell Front Raise'], ['cable', null, 'Cable Front Raise'], ['barbell', null, 'Barbell Front Raise'],
  ]),
  M('rear_delt', 'shoulders', false, { delt_rear: 1, upper_back: 0.4 }, {}, [
    ['dumbbell', 'rear_delt_fly', null], ['machine', 'reverse_pec_deck', null], ['cable', null, 'Cable Rear Delt Fly'],
    ['plate_loaded', null, 'Plate-Loaded Rear Delt Fly'], ['machine', 'rear_delt_row_machine', 'Rear Delt Row Machine', { regions: { delt_rear: 1, upper_back: 0.6 } }],
  ]),
  M('face_pull', 'shoulders', false, { delt_rear: 1, upper_back: 0.6, traps: 0.3 }, {}, [
    ['cable', 'face_pull', null],
  ]),

  // ---------- Quads ----------
  M('squat', 'quads', true, SQUAT, { position: 'standing' }, [
    ['barbell', 'squat', null], ['smith', null, 'Smith Machine Squat'],
  ]),
  M('front_squat', 'quads', true, { vasti: 1, rectus_femoris: 0.3, glute_max: 0.4, abs_rectus: 0.2 }, {}, [
    ['barbell', 'front_squat', null],
  ]),
  M('goblet_squat', 'quads', true, { vasti: 1, glute_max: 0.5, adductors: 0.4, abs_rectus: 0.2 }, {}, [
    ['dumbbell', null, 'Dumbbell Goblet Squat'], ['kettlebell', null, 'Kettlebell Goblet Squat'],
  ]),
  M('leg_press', 'quads', true, MACHINE_SQUAT, {}, [
    ['machine', 'leg_press', null], ['plate_loaded', null, 'Plate-Loaded Leg Press (45°)'],
    ['plate_loaded', 'horizontal_leg_press_plate', 'Horizontal Leg Press (Plate-Loaded)'],
    ['machine', 'single_leg_press', 'Single-Leg Press', { unilateral: true }],
  ]),
  M('hack_squat', 'quads', true, { vasti: 1, glute_max: 0.3 }, {}, [
    ['machine', 'hack_squat', null], ['plate_loaded', null, 'Plate-Loaded Hack Squat'],
    ['plate_loaded', 'leverage_squat_plate', 'Leverage Squat (Plate-Loaded)'], ['plate_loaded', 'reverse_hack_squat_plate', 'Reverse Hack Squat (Plate-Loaded)', { regions: { vasti: 0.9, glute_max: 0.7, ham_hinge: 0.3 } }],
  ]),
  M('pendulum_squat', 'quads', true, { vasti: 1, glute_max: 0.4 }, {}, [
    ['plate_loaded', null, 'Pendulum Squat'],
  ]),
  M('v_squat', 'quads', true, { vasti: 1, glute_max: 0.5 }, {}, [
    ['plate_loaded', null, 'V-Squat'],
  ]),
  M('belt_squat', 'quads', true, { vasti: 1, glute_max: 0.6, adductors: 0.4 }, {}, [
    ['plate_loaded', null, 'Belt Squat'],
  ]),
  M('split_squat', 'quads', true, { vasti: 1, glute_max: 0.7, glute_med: 0.3, adductors: 0.3 }, {}, [
    ['dumbbell', 'bulgarian_split_squat', null, { unilateral: true }], ['smith', null, 'Smith Machine Split Squat', { unilateral: true }],
    ['barbell', null, 'Barbell Split Squat', { unilateral: true }],
  ]),
  M('lunge', 'quads', true, { vasti: 0.9, glute_max: 0.7, glute_med: 0.3, adductors: 0.3 }, {}, [
    ['dumbbell', 'walking_lunge', null, { unilateral: true }], ['barbell', null, 'Barbell Lunge', { unilateral: true }],
    ['dumbbell', 'reverse_lunge', 'Dumbbell Reverse Lunge', { unilateral: true }],
  ]),
  M('step_up', 'quads', true, { vasti: 1, glute_max: 0.6, glute_med: 0.3 }, {}, [
    ['dumbbell', null, 'Dumbbell Step-up', { unilateral: true }],
  ]),
  M('leg_extension', 'quads', false, { rectus_femoris: 1, vasti: 0.8 }, { position: 'seated' }, [
    ['machine', 'leg_extension', null], ['plate_loaded', null, 'Plate-Loaded Leg Extension'],
    ['machine', 'single_leg_extension', 'Single-Leg Extension', { unilateral: true }],
  ]),
  M('sissy_squat', 'quads', false, { rectus_femoris: 1, vasti: 0.6 }, {}, [
    ['bodyweight', 'sissy_squat', null], ['machine', 'sissy_squat_machine', 'Sissy Squat Machine'],
  ]),

  // ---------- Hamstrings ----------
  M('rdl', 'hamstrings', true, RDL, { position: 'standing' }, [
    ['barbell', 'rdl', null], ['dumbbell', 'db_rdl', null], ['smith', null, 'Smith Machine RDL'],
    ['dumbbell', 'single_leg_rdl', 'Single-Leg Dumbbell RDL', { unilateral: true, regions: { ham_hinge: 1, glute_max: 0.7, glute_med: 0.4 } }],
  ]),
  M('deadlift', 'hamstrings', true, { ham_hinge: 0.8, glute_max: 0.8, lower_back: 0.8, traps: 0.4, upper_back: 0.3, vasti: 0.3, forearm_flexors: 0.3 }, {}, [
    ['barbell', 'deadlift', null],
    ['trap_bar', null, 'Trap Bar Deadlift', { regions: { ham_hinge: 0.8, glute_max: 0.8, vasti: 0.7, lower_back: 0.6, traps: 0.4, forearm_flexors: 0.3 } }],
  ]),
  M('good_morning', 'hamstrings', true, { ham_hinge: 1, lower_back: 0.6, glute_max: 0.5 }, {}, [
    ['barbell', null, 'Good Morning'], ['smith', null, 'Smith Machine Good Morning'],
  ]),
  M('lying_leg_curl', 'hamstrings', false, { ham_curl: 1, gastrocnemius: 0.2 }, { position: 'lying' }, [
    ['machine', 'lying_leg_curl', null], ['plate_loaded', null, 'Plate-Loaded Lying Leg Curl'],
  ]),
  M('seated_leg_curl', 'hamstrings', false, { ham_curl: 1 }, { position: 'seated' }, [
    ['machine', 'seated_leg_curl', null],
  ]),
  M('standing_leg_curl', 'hamstrings', false, { ham_curl: 1 }, { position: 'standing' }, [
    ['machine', null, 'Standing Single-Leg Curl', { unilateral: true }], ['cable', null, 'Cable Leg Curl', { unilateral: true }],
    ['machine', 'kneeling_leg_curl', 'Kneeling Leg Curl Machine', { unilateral: true }],
  ]),
  M('nordic_curl', 'hamstrings', false, { ham_curl: 1 }, {}, [
    ['bodyweight', 'nordic_curl', null, { hard: true }],
    ['bodyweight', 'glute_ham_raise', 'Glute-Ham Raise', { hard: true, regions: { ham_curl: 1, ham_hinge: 0.4, glute_max: 0.3 } }],
  ]),

  // ---------- Glutes ----------
  M('hip_thrust', 'glutes', true, THRUST, {}, [
    ['barbell', 'hip_thrust', null], ['dumbbell', 'db_hip_thrust', null], ['machine', null, 'Hip Thrust Machine'],
    ['plate_loaded', null, 'Plate-Loaded Hip Thrust'], ['smith', null, 'Smith Machine Hip Thrust'],
  ]),
  M('glute_bridge', 'glutes', true, { glute_max: 1, ham_hinge: 0.3 }, { position: 'lying' }, [
    ['barbell', null, 'Barbell Glute Bridge'],
  ]),
  M('glute_kickback', 'glutes', false, { glute_max: 1, glute_med: 0.3 }, {}, [
    ['cable', 'glute_kickback', null, { unilateral: true }], ['machine', null, 'Glute Kickback Machine', { unilateral: true }],
    ['plate_loaded', null, 'Plate-Loaded Glute Kickback', { unilateral: true }], ['machine', 'multi_hip_extension', 'Multi-Hip Machine (Hip Extension)', { unilateral: true }],
  ]),
  M('hip_abduction', 'glutes', false, { glute_med: 1 }, {}, [
    ['machine', 'hip_abduction', 'Hip Abduction Machine (Outer Thigh)'], ['cable', null, 'Cable Hip Abduction', { unilateral: true }],
    ['machine', 'standing_abduction_machine', 'Standing Hip Abduction Machine (Multi-Hip)', { unilateral: true }],
    ['plate_loaded', null, 'Plate-Loaded Hip Abduction'],
    ['bodyweight', 'side_lying_leg_raise', null],
  ]),
  M('reverse_hyper', 'glutes', false, { glute_max: 1, ham_hinge: 0.5, lower_back: 0.5 }, { position: 'lying' }, [
    ['machine', null, 'Reverse Hyper Machine'],
  ]),
  M('pull_through', 'glutes', true, { glute_max: 1, ham_hinge: 0.5 }, {}, [
    ['cable', null, 'Cable Pull-Through'], ['kettlebell', null, 'Kettlebell Swing', { regions: { glute_max: 1, ham_hinge: 0.6, lower_back: 0.3 } }],
  ]),

  // ---------- Calves ----------
  M('standing_calf_raise', 'calves', false, { gastrocnemius: 1, soleus: 0.5 }, { position: 'standing' }, [
    ['machine', 'standing_calf_raise', null], ['dumbbell', 'db_calf_raise', null, { unilateral: true }],
    ['smith', null, 'Smith Machine Calf Raise'], ['bodyweight', null, 'Bodyweight Calf Raise'],
    ['machine', 'leg_press_calf_raise', 'Leg Press Calf Raise'], ['plate_loaded', null, 'Plate-Loaded Standing Calf Raise'],
    ['machine', 'donkey_calf_raise', 'Donkey Calf Raise Machine'],
  ]),
  M('seated_calf_raise', 'calves', false, { soleus: 1, gastrocnemius: 0.3 }, { position: 'seated' }, [
    ['machine', 'seated_calf_raise', null], ['dumbbell', 'db_seated_calf_raise', null], ['plate_loaded', null, 'Plate-Loaded Seated Calf Raise'],
  ]),

  // ---------- Abs ----------
  M('crunch', 'abs', false, { abs_rectus: 1, obliques: 0.3 }, {}, [
    ['cable', 'cable_crunch', null], ['machine', 'ab_machine', null], ['bodyweight', null, 'Crunch'],
    ['plate_loaded', null, 'Plate-Loaded Ab Crunch'], ['machine', 'ab_coaster', 'Ab Coaster', { regions: { abs_rectus: 1, obliques: 0.3 } }],
    ['bodyweight', 'ball_crunch', 'Stability Ball Crunch'], ['cable', 'standing_cable_crunch', 'Standing Cable Crunch'],
    ['machine', 'oblique_crunch_machine', 'Oblique Crunch Machine', { regions: { obliques: 1, abs_rectus: 0.4 } }],
  ]),
  M('leg_raise', 'abs', false, { abs_rectus: 1, obliques: 0.3, forearm_flexors: 0.2 }, {}, [
    ['bodyweight', 'hanging_leg_raise', null], ['bodyweight', 'captains_chair_raise', "Captain's Chair Leg Raise", { regions: { abs_rectus: 1, obliques: 0.3 } }],
    ['bodyweight', 'hanging_knee_raise', 'Hanging Knee Raise', { regions: { abs_rectus: 1, obliques: 0.2, forearm_flexors: 0.2 } }],
    ['bodyweight', 'toes_to_bar', 'Toes-to-Bar', { hard: true, regions: { abs_rectus: 1, obliques: 0.3, lats: 0.2, forearm_flexors: 0.3 } }],
    ['bodyweight', 'lying_leg_raise', 'Lying Leg Raise', { regions: { abs_rectus: 1 } }],
    ['bodyweight', 'decline_leg_raise', 'Decline Bench Leg Raise', { regions: { abs_rectus: 1 } }],
  ]),
  M('situp', 'abs', false, { abs_rectus: 1, obliques: 0.2 }, { angle: 'decline' }, [
    ['bodyweight', 'decline_situp', null], ['bodyweight', 'situp_flat', 'Sit-up'],
    ['dumbbell', 'weighted_decline_situp', 'Weighted Decline Sit-up'],
  ]),
  M('ab_wheel', 'abs', false, { abs_rectus: 1, obliques: 0.3, lats: 0.2 }, {}, [
    ['bodyweight', 'ab_wheel', null],
  ]),
  M('oblique', 'abs', false, { obliques: 1, abs_rectus: 0.3 }, {}, [
    ['cable', 'cable_woodchop', null], ['dumbbell', 'db_side_bend', null, { regions: { obliques: 1 } }],
    ['cable', 'pallof_press', 'Pallof Press', { regions: { obliques: 1, abs_rectus: 0.4 } }],
    ['machine', null, 'Rotary Torso Machine'],
    ['cable', 'cable_side_bend', 'Cable Side Bend', { regions: { obliques: 1 } }],
    ['cable', 'cable_oblique_crunch', 'Cable Oblique Crunch', { regions: { obliques: 1, abs_rectus: 0.4 } }],
    ['barbell', 'landmine_rotation', 'Landmine Rotation', { regions: { obliques: 1, abs_rectus: 0.3, delt_front: 0.2 } }],
    ['bodyweight', 'heel_touches', 'Heel Touches', { regions: { obliques: 1, abs_rectus: 0.3 } }],
    ['bodyweight', 'windshield_wiper', 'Hanging Windshield Wiper', { hard: true, regions: { obliques: 1, abs_rectus: 0.5, forearm_flexors: 0.3 } }],
  ]),

  M('russian_twist', 'abs', false, { obliques: 1, abs_rectus: 0.4 }, { position: 'seated' }, [
    ['bodyweight', 'russian_twist', 'Russian Twist'], ['dumbbell', 'weighted_russian_twist', 'Weighted Russian Twist (Dumbbell or Plate)'],
    ['kettlebell', null, 'Kettlebell Russian Twist'],
  ]),
  M('bicycle_crunch', 'abs', false, { abs_rectus: 1, obliques: 0.7 }, { position: 'lying' }, [
    ['bodyweight', 'bicycle_crunch', 'Bicycle Crunch'],
  ]),
  M('reverse_crunch', 'abs', false, { abs_rectus: 1, obliques: 0.2 }, { position: 'lying' }, [
    ['bodyweight', 'reverse_crunch', 'Reverse Crunch'], ['bodyweight', 'decline_reverse_crunch', 'Decline Reverse Crunch'],
  ]),
  M('v_up', 'abs', false, { abs_rectus: 1, obliques: 0.3 }, { position: 'lying' }, [
    ['bodyweight', 'v_up', 'V-Up'], ['dumbbell', 'weighted_v_up', 'Weighted V-Up'],
  ]),
  M('dead_bug', 'abs', false, { abs_rectus: 1, obliques: 0.4 }, { position: 'lying' }, [
    ['bodyweight', 'dead_bug', 'Dead Bug'],
  ]),
  M('dragon_flag', 'abs', false, { abs_rectus: 1, obliques: 0.3, lats: 0.2 }, { position: 'lying' }, [
    ['bodyweight', 'dragon_flag', 'Dragon Flag', { hard: true }],
  ]),

  // ---------- Forearms ----------
  M('wrist_curl', 'forearms', false, { forearm_flexors: 1 }, {}, [
    ['dumbbell', 'wrist_curl', null], ['barbell', null, 'Barbell Wrist Curl'], ['cable', null, 'Cable Wrist Curl'],
    ['machine', 'wrist_curl_machine', 'Wrist Curl Machine'],
  ]),
  M('reverse_wrist_curl', 'forearms', false, { forearm_extensors: 1 }, {}, [
    ['dumbbell', 'reverse_wrist_curl', null], ['barbell', null, 'Barbell Reverse Wrist Curl'],
  ]),
  M('reverse_curl', 'forearms', false, { forearm_extensors: 1, brachialis: 0.7 }, {}, [
    ['barbell', 'reverse_curl', null], ['ez_bar', null, 'EZ-Bar Reverse Curl'], ['cable', null, 'Cable Reverse Curl'],
  ]),
  M('carry', 'forearms', true, { forearm_flexors: 1, traps: 0.5, obliques: 0.3 }, {}, [
    ['dumbbell', null, "Farmer's Carry"], ['trap_bar', null, 'Trap Bar Carry'],
  ]),

  // ---------- Adductors ----------
  M('adduction', 'adductors', false, { adductors: 1 }, { position: 'seated' }, [
    ['machine', 'adductor_machine', 'Hip Adduction Machine (Inner Thigh)'], ['cable', null, 'Cable Hip Adduction', { unilateral: true }],
    ['machine', 'standing_adduction_machine', 'Standing Hip Adduction Machine (Multi-Hip)', { unilateral: true }],
  ]),
  M('sumo_squat', 'adductors', true, { adductors: 0.9, vasti: 0.6, glute_max: 0.6 }, {}, [
    ['dumbbell', 'sumo_squat', null], ['kettlebell', null, 'Kettlebell Sumo Squat'], ['barbell', null, 'Barbell Sumo Squat'],
  ]),
];
