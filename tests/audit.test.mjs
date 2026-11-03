// The November 2026 audit of workout building and weight suggestions: one test per fix.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES } from '../js/data.js';
import { suggest, targetFor, retargetFrom, deloadSuggestion, breakFactor } from '../js/engine.js';
import { capDumbbell } from '../js/equipment.js';
import { buildWorkout } from '../js/builder.js';
import { buildSession, buildBlock } from '../js/planner.js';

const DAY = 864e5;
const NOW = Date.UTC(2026, 10, 3, 12);
const ago = d => new Date(NOW - d * DAY).toISOString();
const lookup = id => EXERCISES.find(e => e.id === id);
const bench = { equipment: 'barbell', compound: true };
const S = (d, pairs, extra = {}) => ({ date: ago(d), sets: pairs.map(([weight, reps, target]) => ({ weight, reps, done: true, ...(target ? { target: { weight, reps: target } } : {}) })), ...extra });
const sug = (h, o = {}) => suggest(bench, h, { increment: 5, now: NOW, ...o });

test('mixed-weight sessions keep their pattern instead of every set at the top weight', () => {
  const pyr = sug([S(7, [[135, 12], [155, 8], [175, 5]])]);
  assert.deepEqual(pyr.weights, [140, 155, 175], 'the 12-rep set steps up, the others add a rep');
  assert.deepEqual(pyr.reps.slice(1), [9, 6]);
  const top = sug([S(7, [[205, 5], [175, 10], [175, 10]])]);
  assert.deepEqual(top.weights, [205, 175, 175]);
  assert.deepEqual(top.reps, [6, 11, 11]);
  assert.equal(top.weight, 205, 'first set weight drives warm-ups');
  // A break applies to every set of the pattern.
  const back = sug([S(40, [[205, 5], [175, 10], [175, 10]])]);
  assert.equal(back.kind, 'break');
  assert.ok(back.weights.every((w, i) => w < [205, 175, 175][i]));
});

test('a heavy one-off single is left out: working weight and set count follow the real sets', () => {
  const s = sug([S(7, [[225, 1], [185, 8], [185, 8], [185, 8]])]);
  assert.equal(s.weight, 185);
  assert.equal(s.reps.length, 3);
  assert.equal(s.weights, undefined);
});

test('longer breaks come back lighter', () => {
  const at = d => sug([S(d, [[185, 8], [185, 8], [185, 7]])]).weight;
  const w = [20, 45, 90, 200].map(at);
  assert.ok(w[0] > w[1] && w[1] > w[2] && w[2] > w[3], w.join(' > '));
  assert.equal(breakFactor(20), 0.9);
  assert.equal(breakFactor(200), 0.75);
});

test('a stalled lift is flagged; a progressing one is not', () => {
  const flat = [S(42, [[200, 6]]), S(35, [[200, 7]]), S(28, [[200, 8]]), S(21, [[200, 8]]), S(14, [[200, 8]]), S(7, [[200, 8]])];
  assert.equal(sug(flat).stalled, true);
  const up = [S(42, [[200, 6]]), S(35, [[200, 7]]), S(28, [[200, 8]]), S(21, [[200, 9]]), S(14, [[200, 10]]), S(7, [[200, 11]])];
  assert.ok(!sug(up).stalled);
  assert.ok(!sug(flat.slice(-3)).stalled, 'needs enough history');
});

test('bodyweight lifts use your bodyweight from each session', () => {
  const pull = { equipment: 'bodyweight', compound: true };
  // 8 pull-ups at 200 lb is stronger than 8 at 180 lb: more reps now.
  const then = suggest(pull, [{ date: ago(7), bw: 200, sets: [{ weight: 0, reps: 8, done: true }] }], { increment: 5, now: NOW, bodyweight: 180 });
  const same = suggest(pull, [{ date: ago(7), sets: [{ weight: 0, reps: 8, done: true }] }], { increment: 5, now: NOW, bodyweight: 180 });
  assert.ok(then.reps[0] > same.reps[0] || then.weight > same.weight, `${then.weight}x${then.reps[0]} vs ${same.weight}x${same.reps[0]}`);
});

test('deload week: changing the weight still gives a rep goal', () => {
  const s = sug([S(7, [[185, 8], [185, 8], [185, 7]])]);
  const d = deloadSuggestion(s, bench, 5);
  assert.ok(d.est > 0);
  const r = targetFor(d, bench, d.weight, 0);
  assert.ok(r >= s.reps[0] - 1 && r <= 12, `goal at the deload weight: ${r}`);
  assert.ok(targetFor(d, bench, d.weight - 20, 0) > r);
});

test('after a set 2+ reps off its goal, the next sets follow today', () => {
  const s = sug([S(7, [[185, 10], [185, 9], [185, 8]])]);
  const hard = retargetFrom(s, bench, { weight: 185, reps: 6, target: { weight: 185, reps: 11 } });
  assert.ok(hard);
  const next = [0, 1].map(k => targetFor(hard, bench, 185, k));
  assert.ok(next[0] <= 7 && next[0] >= 5 && next[1] <= next[0], next.join(','));
  const easy = retargetFrom(s, bench, { weight: 185, reps: 13, target: { weight: 185, reps: 10 } });
  assert.ok(targetFor(easy, bench, 185, 0) > 10 && targetFor(easy, bench, 185, 0) <= 12);
  assert.equal(retargetFrom(s, bench, { weight: 185, reps: 10, target: { weight: 185, reps: 11 } }), null, 'one short is normal');
});

test('heaviest dumbbell caps a mixed pattern too', () => {
  const db = EXERCISES.find(e => e.name === 'Dumbbell Bench Press');
  const c = capDumbbell({ weight: 60, weights: [60, 50], reps: [8, 10], est: 80 }, db, 55, () => 12);
  assert.deepEqual(c.weights, [55, 50]);
  assert.deepEqual(c.reps, [12, 10]);
});

test('Build today\'s workout: no advanced-only lifts unless advanced or already used', () => {
  const pool = EXERCISES.filter(e => e.common);
  for (let seed = 1; seed <= 60; seed++) {
    const p = buildWorkout({ exercises: pool, lookup, budget: 24, seed, mode: 'pick', muscles: ['hamstrings', 'quads', 'abs'] });
    assert.ok(!p.items.some(i => lookup(i.exId).hard), `seed ${seed}`);
  }
  const adv = Array.from({ length: 60 }, (_, i) => buildWorkout({ exercises: pool, lookup, budget: 24, seed: i + 1, mode: 'pick', muscles: ['hamstrings', 'quads'], level: 'advanced' }));
  assert.ok(adv.some(p => p.items.some(i => lookup(i.exId).hard)), 'advanced lifters can get them');
  const used = buildWorkout({ exercises: pool, lookup, budget: 16, seed: 3, mode: 'pick', muscles: ['hamstrings'], usage: { nordic_curl: 6 } });
  assert.ok(used.items.some(i => i.exId === 'nordic_curl'), 'one you already do stays');
});

test('Build today\'s workout goes easy on muscles your plan trains soon, and uses the plan\'s goals', () => {
  const pool = EXERCISES.filter(e => e.common);
  const legs = ['quads', 'hamstrings', 'glutes'];
  let free = 0, soon = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const a = buildWorkout({ exercises: pool, lookup, budget: 18, seed, mode: 'auto' });
    const b = buildWorkout({ exercises: pool, lookup, budget: 18, seed, mode: 'auto', soon: { quads: 0.5, hamstrings: 0.5, glutes: 0.5 } });
    free += a.muscles.filter(m => legs.includes(m)).length;
    soon += b.muscles.filter(m => legs.includes(m)).length;
  }
  assert.ok(soon < free, `legs picked ${soon} vs ${free} times`);
  const t = buildWorkout({ exercises: pool, lookup, budget: 12, mode: 'pick', muscles: ['chest'], muscleTargets: { chest: 18 } });
  assert.match(t.items[0].reason, /\/18 sets/);
});

test('plan time: without a measured pace each lift is timed by its own rest plus warm-ups', () => {
  const profile = { days: [0, 2, 4, 5], minutes: 240, level: 'intermediate', goal: 'muscle', priority: [], equipment: 'gym', activities: [], avoid: [] };
  const slots = buildBlock({ profile, splitId: 'upper_lower', exercises: EXERCISES.filter(e => e.common), lookup, workouts: [], seed: 1 });
  const setsByMuscle = { chest: 6, back: 6, shoulders: 4, biceps: 3, triceps: 3 };
  const avg = buildSession({ type: 'upper', variant: slots.upper[0], setsByMuscle, lookup, profile, secPerSet: 130, restSec: 90 });
  const per = buildSession({ type: 'upper', variant: slots.upper[0], setsByMuscle, lookup, profile, secPerSet: 130, restSec: 90, perLift: true });
  assert.ok(per.estMinutes > avg.estMinutes, `${per.estMinutes} vs ${avg.estMinutes}`);
});
