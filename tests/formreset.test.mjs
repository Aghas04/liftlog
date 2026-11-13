// Form reset: a lift done lighter on purpose to fix technique isn't lost strength (v45).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES } from '../js/data.js';
import { stalledLifts, deloadAdvice, strengthLevels } from '../js/insights.js';
import { reviewBlock, weeklyTargets } from '../js/planner.js';
import { lineChart } from '../js/charts.js';

const DAY = 864e5;
const NOW = Date.UTC(2026, 10, 13, 12);
const lookup = id => EXERCISES.find(e => e.id === id);
const at = d => new Date(NOW - d * DAY).toISOString();
const session = (d, exId, weight, reps, target) => ({
  id: `${exId}${d}`, date: at(d), exercises: [{ exId, sets: reps.map(r => ({ weight, reps: r, done: true, ...(target ? { target: { weight, reps: target } } : {}) })) }],
});
// Heavy cheated sets, then a reset 9 days ago and lighter clean sessions climbing.
const history = id => [
  session(30, id, 225, [8, 8, 7], 9), session(25, id, 225, [8, 8, 7], 9), session(20, id, 225, [8, 7, 7], 9), session(15, id, 225, [8, 7, 7], 9),
  session(9, id, 185, [8, 8, 8], 8), session(5, id, 185, [9, 9, 8], 9), session(1, id, 185, [10, 9, 9], 10),
];

test('stall checks ignore sessions before a form reset', () => {
  const ws = history('bench_press');
  // The clean sessions alone are climbing: not stalled.
  assert.ok(!stalledLifts(ws, lookup, () => 0, NOW, { bench_press: at(9) }).stalled.includes('bench_press'));
  // Old heavy sessions missing goals, flat: stalled without the reset.
  const old = ws.slice(0, 4).map(w => ({ ...w, date: new Date(new Date(w.date).getTime() + 12 * DAY).toISOString() }));
  assert.ok(stalledLifts(old, lookup, () => 0, NOW).stalled.includes('bench_press'));
  assert.equal(deloadAdvice(ws, lookup, () => 0, NOW, { bench_press: at(9) }), null);
});

test('strength levels use your clean-form best after a reset', () => {
  const ws = history('bench_press');
  const all = strengthLevels(ws, lookup, 180, 'male')[0].e1rm;
  const clean = strengthLevels(ws, lookup, 180, 'male', { bench_press: at(9) })[0].e1rm;
  assert.ok(clean < all, `${clean} < ${all}`);
  assert.equal(Math.round(clean), Math.round(185 * (1 + 10 / 30)));
});

test('the block review doesn\'t read a form reset as decline', () => {
  const profile = { days: [0, 2, 4], minutes: 75, level: 'intermediate', goal: 'muscle', priority: [], equipment: 'gym', activities: [], avoid: [] };
  const plan = { profile, splitId: 'full_body', blockStart: at(35), volume: {}, slots: {} };
  const ws = history('bench_press').map(w => ({ ...w, dayType: 'plan_push' }));
  const target = weeklyTargets(profile, {}, 130, plan.splitId).chest;
  const run = resets => reviewBlock({ profile, plan, workouts: ws, lookup, exercises: EXERCISES, resets }).volume.chest;
  assert.ok(run({}).to < target, 'without the reset the drop looks like decline');
  assert.equal(run({ bench_press: at(9) }).to, target, 'clean sessions are progressing: volume holds');
});

test('the chart marks the reset and fades the old-form part', () => {
  const pts = [30, 20, 9, 5, 1].map((d, i) => ({ x: NOW - d * DAY, y: [300, 290, 245, 250, 255][i] }));
  const svg = lineChart(pts, { prs: true, splitAt: NOW - 9 * DAY });
  assert.match(svg, /Form reset/);
  assert.equal((svg.match(/class="pt old"/g) || []).length, 2);
  assert.ok(!/class="pt pr"[^>]*data-i="[01]"/.test(svg), 'old points are never stars');
  assert.ok(!/Form reset/.test(lineChart(pts, { prs: true })));
});
