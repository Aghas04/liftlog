import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, MUSCLES, REGIONS, exerciseRegions, primaryRegion } from '../js/data.js';
import { buildWorkout, paceFromHistory, setsForMinutes, exerciseForRegion } from '../js/builder.js';
import { regionSets, regionTargets } from '../js/insights.js';

const lookup = id => EXERCISES.find(e => e.id === id);
const NOW = new Date('2026-10-28T12:00:00').getTime();
const daysAgo = d => new Date(NOW - d * 86400000).toISOString();
const sets = n => Array.from({ length: n }, () => ({ weight: 50, reps: 10, done: true }));
const wk = (d, exercises, mins) => ({ id: 'w' + d, dayType: 'upper', date: daysAgo(d), finishedAt: mins ? new Date(NOW - d * 86400000 + mins * 60000).toISOString() : undefined, exercises });
const base = { lookup, exercises: EXERCISES, now: NOW, weeklyTarget: 10 };

// Rules every built workout must follow.
function checkPlan(plan, budget, label) {
  assert.ok(!plan.error, `${label}: unexpected error ${plan.error}`);
  const ids = plan.items.map(i => i.exId);
  assert.equal(new Set(ids).size, ids.length, `${label}: duplicate exercise`);
  assert.equal(plan.totalSets, plan.items.reduce((s, i) => s + i.sets, 0), `${label}: total mismatch`);
  assert.ok(plan.totalSets <= budget, `${label}: ${plan.totalSets} sets over budget ${budget}`);
  for (const i of plan.items) {
    assert.ok(i.sets >= 2 && i.sets <= 4, `${label}: ${i.exId} has ${i.sets} sets`);
    assert.equal(lookup(i.exId).muscle, i.muscle, `${label}: ${i.exId} filed under wrong muscle`);
    assert.ok(i.reason && i.reason.length > 3, `${label}: missing reason`);
  }
  for (const m of plan.muscles) {
    const mine = plan.items.filter(i => i.muscle === m);
    assert.ok(mine.length >= 2, `${label}: ${m} has only ${mine.length} exercise(s)`);
    assert.ok(mine.reduce((s, i) => s + i.sets, 0) >= 4, `${label}: ${m} under 4 sets`);
  }
  // Compound lifts come first.
  const firstIso = plan.items.findIndex(i => !lookup(i.exId).compound);
  if (firstIso >= 0) assert.ok(plan.items.slice(firstIso).every(i => !lookup(i.exId).compound), `${label}: compound after isolation`);
}

test('hits the set budget exactly with an empty history', () => {
  for (const budget of [4, 8, 12, 16, 18, 20, 24, 30, 40]) {
    const plan = buildWorkout({ ...base, budget });
    checkPlan(plan, budget, `budget ${budget}`);
    assert.equal(plan.totalSets, budget, `budget ${budget}: got ${plan.totalSets}`);
  }
});

test('each muscle gets two exercises aimed at different regions', () => {
  // Every muscle with 2+ regions, with and without history that flags regions as neglected.
  const multi = Object.keys(MUSCLES).filter(m => Object.values(REGIONS).filter(r => r.muscle === m).length >= 2);
  const upperOnly = [20, 13, 6, 2].map(d => wk(d, [{ exId: 'bench_press', sets: sets(4) }, { exId: 'cable_row', sets: sets(4) }]));
  for (const workouts of [[], upperOnly]) {
    for (const m of multi) {
      const plan = buildWorkout({ ...base, workouts, budget: 8, mode: 'pick', muscles: [m] });
      checkPlan(plan, 8, `pick ${m}`);
      const regions = plan.items.map(i => i.region);
      assert.ok(new Set(regions).size >= 2, `${m}: both lifts hit ${regions[0]} (${plan.items.map(i => i.exId)})`);
    }
  }
});

test('pick mode: too many muscles for the budget explains the fit', () => {
  const r = buildWorkout({ ...base, budget: 12, mode: 'pick', muscles: ['chest', 'back', 'biceps', 'triceps', 'shoulders'] });
  assert.equal(r.error, 'tooSmall');
  assert.equal(r.fit, 3);
  assert.equal(r.ranked.length, 5);
  assert.equal(buildWorkout({ ...base, budget: 3 }).error, 'tooSmall');
});

test('a neglected region gets picked and explained', () => {
  // Lots of pressing and side raises, never any rear delt work.
  const ws = [13, 10, 6, 3].map(d => wk(d, [{ exId: 'bench_press', sets: sets(4) }, { exId: 'lateral_raise', sets: sets(4) }, { exId: 'overhead_press', sets: sets(3) }]));
  const plan = buildWorkout({ ...base, workouts: ws, budget: 16, mode: 'pick', muscles: ['shoulders', 'back'] });
  checkPlan(plan, 16, 'neglect');
  const rear = plan.items.find(i => i.region === 'delt_rear');
  assert.ok(rear, 'should include a rear delt exercise');
  assert.match(rear.reason, /Rear delts/);
});

test('auto mode favors muscles that are behind and rested', () => {
  // Chest/shoulders/triceps hammered yesterday; back/biceps untouched for a week.
  const ws = [8, 1].map(d => wk(d, [
    { exId: 'bench_press', sets: sets(5) }, { exId: 'incline_db_press', sets: sets(4) },
    { exId: 'overhead_press', sets: sets(4) }, { exId: 'tricep_pushdown', sets: sets(4) },
  ]));
  const plan = buildWorkout({ ...base, workouts: ws, budget: 18 });
  checkPlan(plan, 18, 'auto');
  assert.ok(!plan.muscles.includes('chest'), `chest was trained yesterday but got picked: ${plan.muscles}`);
});

test('recovery is a preference, not a ban: a muscle far behind can still be picked', () => {
  // Only biceps exist as an option in pick mode even though trained yesterday.
  const ws = [1].map(d => wk(d, [{ exId: 'db_curl', sets: sets(3) }]));
  const plan = buildWorkout({ ...base, workouts: ws, budget: 8, mode: 'pick', muscles: ['biceps'] });
  checkPlan(plan, 8, 'pick biceps');
  assert.equal(plan.totalSets, 8);
});

test('prefers lifts you know, new ones only when needed', () => {
  const usage = { cable_row: 8, lat_pulldown: 8, db_curl: 6, hammer_curl: 6 };
  const plan = buildWorkout({ ...base, budget: 16, mode: 'pick', muscles: ['back', 'biceps'], usage });
  checkPlan(plan, 16, 'familiar');
  const known = plan.items.filter(i => usage[i.exId]).length;
  assert.ok(known >= 3, `only ${known} familiar lifts: ${plan.items.map(i => i.exId)}`);
  assert.ok(plan.items.every(i => i.isNew === !usage[i.exId]));
});

test('regenerate gives a valid, different workout; same seed is stable', () => {
  const a = buildWorkout({ ...base, budget: 20, seed: 1 });
  const b = buildWorkout({ ...base, budget: 20, seed: 1 });
  assert.deepEqual(a, b);
  let different = false;
  for (let s = 2; s < 8; s++) {
    const c = buildWorkout({ ...base, budget: 20, seed: s });
    checkPlan(c, 20, `seed ${s}`);
    if (c.items.map(i => i.exId).join() !== a.items.map(i => i.exId).join()) different = true;
  }
  assert.ok(different, 'regenerating never changed anything');
});

test('ignored regions and excluded exercises are respected', () => {
  const plan = buildWorkout({ ...base, budget: 16, mode: 'pick', muscles: ['biceps', 'triceps'], exclude: ['hammer_curl'], ignored: ['brachialis'] });
  checkPlan(plan, 16, 'exclude');
  assert.ok(!plan.items.some(i => i.exId === 'hammer_curl'));
  const auto = buildWorkout({ ...base, budget: 20, ignored: Object.keys(REGIONS).filter(r => REGIONS[r].muscle === 'calves') });
  assert.ok(!auto.muscles.includes('calves'));
});

test('minutes mode: pace from history, sensible fallback', () => {
  assert.equal(paceFromHistory([], 90), 130);
  const ws = [10, 7, 4, 1].map(d => wk(d, [{ exId: 'bench_press', sets: sets(10) }, { exId: 'db_curl', sets: sets(10) }], 50));
  assert.equal(paceFromHistory(ws, 90), 150);
  assert.equal(setsForMinutes(60, 150), 24);
  assert.equal(setsForMinutes(5, 150), 4);
});

test('exerciseForRegion picks a familiar direct lift first', () => {
  assert.equal(primaryRegion(exerciseForRegion('delt_rear', EXERCISES, { face_pull: 3 })), 'delt_rear');
  assert.equal(exerciseForRegion('delt_rear', EXERCISES, { face_pull: 3 }).id, 'face_pull');
  for (const r of Object.keys(REGIONS)) assert.ok(exerciseForRegion(r, EXERCISES), `no exercise for ${r}`);
});

test('stress: 1000 random histories and budgets always produce valid workouts', () => {
  let rand = 12345;
  const next = () => ((rand = (rand * 1103515245 + 12345) % 2147483648) / 2147483648);
  const muscles = Object.keys(MUSCLES);
  let exact = 0, runs = 0;
  for (let i = 0; i < 1000; i++) {
    const ws = [];
    for (let d = 28; d >= 1; d -= 1 + Math.floor(next() * 4)) {
      const exs = [];
      for (let k = 0; k < 3 + Math.floor(next() * 6); k++) exs.push({ exId: EXERCISES[Math.floor(next() * EXERCISES.length)].id, sets: sets(1 + Math.floor(next() * 4)) });
      ws.push(wk(d, exs));
    }
    const budget = 4 + Math.floor(next() * 40);
    const usage = {};
    for (const w of ws) for (const e of w.exercises) usage[e.exId] = (usage[e.exId] || 0) + 1;
    const pick = next() < 0.4;
    const chosen = muscles.filter(() => next() < 0.25).slice(0, Math.max(1, Math.floor(budget / 4)));
    const plan = buildWorkout({ ...base, workouts: ws, budget, usage, seed: i % 5, mode: pick && chosen.length ? 'pick' : 'auto', muscles: chosen });
    if (plan.error) { assert.ok(pick, `auto mode errored: ${plan.error}`); continue; }
    checkPlan(plan, budget, `run ${i} (budget ${budget})`);
    runs++;
    if (plan.totalSets === budget) exact++;
    else {
      // Only allowed when the picked muscles have run out of exercises.
      assert.ok(pick, `auto run ${i}: ${plan.totalSets}/${budget} sets`);
      const cap = plan.muscles.reduce((s, m) => s + EXERCISES.filter(e => e.muscle === m).length * 4, 0);
      assert.equal(plan.totalSets, cap, `pick run ${i}: short of budget but not at the exercise cap`);
    }
  }
  assert.ok(exact / runs > 0.9, `only ${exact}/${runs} hit the budget exactly`);
});

test('a lifter following built workouts for 8 weeks ends up with balanced regions', () => {
  const ws = [];
  const usage = {};
  for (let day = 0; day < 56; day += 2) {
    const now = NOW - (56 - day) * 86400000;
    const plan = buildWorkout({ ...base, workouts: ws, now, budget: 20, usage, seed: day });
    checkPlan(plan, 20, `day ${day}`);
    ws.push({ id: 'b' + day, dayType: 'custom', date: new Date(now).toISOString(), exercises: plan.items.map(i => ({ exId: i.exId, sets: sets(i.sets) })) });
    for (const i of plan.items) usage[i.exId] = (usage[i.exId] || 0) + 1;
  }
  // Over the last 2 weeks, every region got at least some direct-or-partial work.
  const last2 = regionSets(ws, lookup, new Date(NOW - 14 * 86400000).toISOString());
  const t = regionTargets(10);
  const starved = Object.keys(REGIONS).filter(r => (last2[r] || 0) < t[r] * 0.25);
  assert.deepEqual(starved, [], `regions left behind: ${starved}`);
});
