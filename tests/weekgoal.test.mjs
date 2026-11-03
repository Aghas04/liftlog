// Every muscle's week adds up to its goal: done + planned, counted the way the
// weekly card counts (small muscles get half credit from bigger lifts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES } from '../js/data.js';
import { MAJOR } from '../js/planner.js';
import { createPlan, currentWeek, weekVolume } from '../js/plancontrol.js';

const lookup = id => EXERCISES.find(e => e.id === id);
const MON = new Date(2026, 10, 2, 7).getTime();
const ctx = { exercises: EXERCISES.filter(e => e.common), lookup, blocked: [], usage: {} };
const setups = [
  ['advanced', 90, [0, 1, 2, 3, 4, 5], 'upper_lower'], ['advanced', 60, [0, 1, 2, 3, 4, 5], 'upper_lower'],
  ['advanced', 90, [0, 1, 2, 3, 4, 5], 'ppl'], ['intermediate', 75, [0, 1, 3, 4], 'upper_lower'],
  ['intermediate', 60, [0, 2, 4], 'full_body'], ['beginner', 60, [0, 2, 4], 'full_body'], ['intermediate', 60, [0, 1, 2, 3, 4, 5], 'bro3'],
];

function check(level, minutes, days, splitId, workouts, now, plan) {
  const wk = currentWeek(plan, workouts, lookup, now, 130, ctx);
  const vol = weekVolume(wk, workouts, lookup);
  for (const [m, v] of Object.entries(vol)) {
    if (!v.goal) continue;
    const total = v.done + v.planned;
    const label = `${level} ${minutes}m ${days.length}d ${splitId} ${m}: ${total}/${v.goal}`;
    // Small muscles may sit a little over (they keep 40% of their goal as direct
    // work), and so may glutes and shoulders (half credit from squats, presses, rows).
    const over = MAJOR.includes(m) && !['glutes', 'shoulders'].includes(m) ? 1 : Math.max(1, Math.ceil(v.goal * 0.35));
    // After extra work, a planned lift never goes below 2 sets (the smallest useful dose).
    const atMin = wk.days.filter(x => x.kind === 'train').every(x => x.session.items.filter(it => it.muscle === m).every(it => it.sets <= 2));
    assert.ok(total <= v.goal + over || (workouts.length && atMin), `over: ${label}`);
    if (!wk.notes.some(n => /below this week's goal/.test(n))) assert.ok(total >= v.goal - 1, `under: ${label}`);
  }
  return wk;
}

test('every muscle lands on its weekly goal, before and after the first workout', () => {
  for (const [level, minutes, days, splitId] of setups) {
    const profile = { days, minutes, level, goal: 'muscle', priority: [], equipment: 'gym', activities: [], avoid: [] };
    const plan = createPlan({ profile, splitId, exercises: ctx.exercises, usage: {}, workouts: [], lookup, now: MON - 3600e3 });
    const wk = check(level, minutes, days, splitId, [], MON, plan);
    // Do day 1 with 2 extra sets on every lift: the rest of the week trims to fit.
    const d = wk.days.find(x => x.kind === 'train');
    const w = { id: 'w1', date: new Date(MON + 3600e3).toISOString(), plan: { id: plan.id, seq: d.session.seq }, dayType: 'plan_' + d.session.type,
      exercises: d.session.items.map(it => ({ exId: it.exId, sets: Array.from({ length: it.sets + 2 }, () => ({ weight: 100, reps: 10, done: true })) })) };
    check(level, minutes, days, splitId, [w], MON + 5 * 3600e3, plan);
  }
});

test('last week\'s make-up sets show in the goal, so the card still adds up', () => {
  const profile = { days: [0, 1, 3, 4], minutes: 90, level: 'intermediate', goal: 'muscle', priority: [], equipment: 'gym', activities: [], avoid: [] };
  const plan = createPlan({ profile, splitId: 'upper_lower', exercises: ctx.exercises, usage: {}, workouts: [], lookup, now: MON - 30 * 864e5 });
  plan.createdAt = new Date(MON - 30 * 864e5).toISOString();
  const wk = currentWeek(plan, [], lookup, MON, 130, ctx);
  assert.ok(wk.notes.some(n => /Making up/.test(n)));
  const vol = weekVolume(wk, [], lookup);
  for (const m of MAJOR) assert.ok(Math.abs(vol[m].planned - vol[m].goal) <= 1, `${m}: ${vol[m].planned}/${vol[m].goal}`);
});

test('advanced plans aim for the most growth: up to 30 sets with long sessions, never past what the split can hold', () => {
  const plan = (minutes, splitId) => createPlan({ profile: { days: [0, 1, 2, 3, 4, 5], minutes, level: 'advanced', goal: 'muscle', priority: [], equipment: 'gym', activities: [], avoid: [] }, splitId, exercises: ctx.exercises, usage: {}, workouts: [], lookup, now: MON - 3600e3 });
  const long = currentWeek(plan(150, 'upper_lower'), [], lookup, MON, 130, ctx);
  for (const m of MAJOR) assert.equal(long.goals[m], 30, `${m}: ${long.goals[m]}`);
  const mid = currentWeek(plan(90, 'upper_lower'), [], lookup, MON, 130, ctx);
  for (const m of MAJOR) assert.ok(mid.goals[m] >= 20 && mid.goals[m] < 30, `${m}: ${mid.goals[m]}`);
  // Push/pull/legs on 6 days trains each muscle twice: at most 2 x 10 sets
  // (shoulders train on push and pull days, so they can reach 30).
  const ppl = currentWeek(plan(150, 'ppl'), [], lookup, MON, 130, ctx);
  for (const m of MAJOR.filter(x => x !== 'shoulders')) assert.ok(ppl.goals[m] <= 20, `${m}: ${ppl.goals[m]}`);
  assert.ok(ppl.goals.shoulders <= 30);
});
