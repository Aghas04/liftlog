import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  recommendSplit, deloadAdvice, achievements, monthRecap, strengthLevels, longestStreak, muscleSets,
} from '../js/insights.js';
import { EXERCISES, DAY_TYPES } from '../js/data.js';

const lookup = id => EXERCISES.find(e => e.id === id);
const bwOn = () => 180;
const NOW = new Date('2026-10-28T12:00:00').getTime();
const daysAgo = d => new Date(NOW - d * 86400000).toISOString();
const sets = (w, reps, tg) => reps.map((r, i) => ({ weight: w, reps: r, done: true, target: tg ? { weight: w, reps: tg[i] } : undefined }));
const wk = (id, dayType, d, exercises) => ({ id, dayType, date: daysAgo(d), exercises });

test('recommends a rested split, not the one just done', () => {
  const ws = [
    wk('1', 'chest_sh_tri', 3, [{ exId: 'bench_press', sets: sets(185, [8, 8]) }]),
    wk('2', 'back_bi', 1, [{ exId: 'cable_row', sets: sets(120, [10, 10]) }]),
  ];
  const r = recommendSplit(ws, lookup, DAY_TYPES, NOW);
  assert.ok(['legs', 'lower'].includes(r.day.id), `got ${r.day.id}`);
});

test('says rest when already trained today', () => {
  const ws = [wk('1', 'legs', 0, [{ exId: 'squat', sets: sets(225, [5]) }])];
  assert.equal(recommendSplit(ws, lookup, DAY_TYPES, NOW).rest, true);
});

test('deload advised when most lifts stall', () => {
  const ids = ['bench_press', 'squat', 'cable_row'];
  const ws = [10, 6, 2].map((d, i) => wk('s' + i, 'upper', d, ids.map(exId => ({ exId, sets: sets(100, [8, 8]) }))));
  assert.ok(deloadAdvice(ws, lookup, bwOn, NOW));
});

test('no deload while lifts are progressing', () => {
  const ids = ['bench_press', 'squat', 'cable_row'];
  const ws = [10, 6, 2].map((d, i) => wk('s' + i, 'upper', d, ids.map(exId => ({ exId, sets: sets(100 + i * 10, [8, 8]) }))));
  assert.equal(deloadAdvice(ws, lookup, bwOn, NOW), null);
});

test('longest streak counts consecutive weeks', () => {
  const ws = [0, 7, 14, 35].map((d, i) => wk('x' + i, 'legs', d, []));
  assert.equal(longestStreak(ws), 3);
});

test('achievements track counts and lift milestones', () => {
  const ws = [wk('1', 'upper', 2, [{ exId: 'bench_press', sets: sets(225, [3]) }])];
  const a = Object.fromEntries(achievements(ws, lookup, bwOn).map(x => [x.id, x]));
  assert.ok(a.first.earned);
  assert.ok(a.bench225.earned);
  assert.ok(!a.bench315.earned);
  assert.ok(a.w10.progress > 0 && a.w10.progress < 1);
});

test('month recap finds the most improved lift', () => {
  const ws = [
    { id: 'a', dayType: 'upper', date: '2026-09-20T10:00:00', exercises: [{ exId: 'bench_press', sets: sets(185, [5]) }] },
    { id: 'b', dayType: 'upper', date: '2026-10-10T10:00:00', exercises: [{ exId: 'bench_press', sets: sets(200, [5]) }] },
  ];
  const r = monthRecap(ws, lookup, bwOn, 2026, 9);
  assert.equal(r.workouts, 1);
  assert.equal(r.improved.exId, 'bench_press');
  assert.ok(r.improved.gain > 0.05);
});

test('strength levels use bodyweight ratio', () => {
  const ws = [wk('1', 'upper', 2, [{ exId: 'bench_press', sets: sets(225, [1]) }])];
  const [bench] = strengthLevels(ws, lookup, 180, 'male');
  assert.ok(bench.ratio > 1.25 && bench.ratio < 1.3);
  assert.equal(bench.level, 'Intermediate');
  assert.equal(bench.next.level, 'Advanced');
  assert.deepEqual(strengthLevels(ws, lookup, 180, null), []);
});

test('muscle sets counts working sets by muscle', () => {
  const ws = [wk('1', 'upper', 1, [{ exId: 'bench_press', sets: sets(185, [8, 8, 8]) }, { exId: 'db_curl', sets: sets(25, [10]) }])];
  assert.deepEqual(muscleSets(ws, lookup), { chest: 3, biceps: 1 });
});

test('kg achievements use round kg goals and keep the same ids', () => {
  // 100 kg typed in kg mode is stored as 220.462 lb.
  const ws = [wk('1', 'upper', 2, [{ exId: 'bench_press', sets: sets(100 * 2.20462, [3]) }])];
  const kg = Object.fromEntries(achievements(ws, lookup, bwOn, 'kg').map(x => [x.id, x]));
  assert.ok(kg.bench225.earned, '100 kg bench earned');
  assert.match(kg.bench225.desc, /100 kg/);
  assert.ok(!kg.bench315.earned);
  const lb = Object.fromEntries(achievements(ws, lookup, bwOn).map(x => [x.id, x]));
  assert.ok(!lb.bench225.earned, '220 lb is short of 225 lb');
  assert.deepEqual(Object.keys(kg).sort(), Object.keys(lb).sort());
  assert.equal(Object.keys(lb).length, 25);
});

test('plan days do not count toward the five-splits badge', () => {
  const ws = ['plan_upper', 'plan_lower', 'plan_push', 'plan_pull', 'plan_legs'].map((d, i) => wk('p' + i, d, i + 1, []));
  const a = Object.fromEntries(achievements(ws, lookup, bwOn).map(x => [x.id, x]));
  assert.equal(a.splits.value, 0);
});
