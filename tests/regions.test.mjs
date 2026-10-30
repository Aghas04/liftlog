import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, REGIONS, MUSCLES, regionsOf, exerciseRegions, primaryRegion } from '../js/data.js';
import { regionSets, regionTargets, neglectedRegions, DIRECT } from '../js/insights.js';

const lookup = id => EXERCISES.find(e => e.id === id);
const NOW = new Date('2026-10-28T12:00:00').getTime();
const daysAgo = d => new Date(NOW - d * 86400000).toISOString();
const sets = (n, w = 50) => Array.from({ length: n }, () => ({ weight: w, reps: 10, done: true }));
const wk = (d, exercises) => ({ id: 'w' + d, dayType: 'upper', date: daysAgo(d), exercises });

// ---------- Data integrity ----------
test('every exercise has a valid region map', () => {
  const ids = new Set();
  for (const ex of EXERCISES) {
    assert.ok(!ids.has(ex.id), `duplicate exercise id ${ex.id}`);
    ids.add(ex.id);
    assert.ok(MUSCLES[ex.muscle], `${ex.id}: unknown muscle ${ex.muscle}`);
    const regs = exerciseRegions(ex);
    assert.ok(Object.keys(regs).length, `${ex.id}: no regions`);
    for (const [r, w] of Object.entries(regs)) {
      assert.ok(REGIONS[r], `${ex.id}: unknown region ${r}`);
      assert.ok(w > 0 && w <= 1, `${ex.id}: weight ${w} for ${r} out of range`);
    }
    const main = primaryRegion(ex);
    assert.equal(REGIONS[main].muscle, ex.muscle, `${ex.id}: main region ${main} isn't in its muscle ${ex.muscle}`);
    assert.ok(regs[main] >= DIRECT, `${ex.id}: main region weight below direct-work level`);
  }
});

test('every region has at least one exercise that trains it directly', () => {
  for (const r of Object.keys(REGIONS)) {
    const direct = EXERCISES.filter(ex => (exerciseRegions(ex)[r] || 0) >= DIRECT);
    assert.ok(direct.length, `nothing trains ${r} directly`);
  }
});

test('every muscle has at least 2 exercises (builder needs two per muscle)', () => {
  for (const m of Object.keys(MUSCLES)) {
    const n = EXERCISES.filter(ex => ex.muscle === m).length;
    assert.ok(n >= 2, `${m} has only ${n} exercise(s)`);
    assert.ok(regionsOf(m).length >= 1, `${m} has no regions`);
  }
});

test('custom exercises without a map count toward their muscle', () => {
  const plain = exerciseRegions({ muscle: 'biceps' });
  assert.deepEqual(Object.keys(plain).sort(), regionsOf('biceps').sort());
  const main = exerciseRegions({ muscle: 'chest', mainRegion: 'chest_upper' });
  assert.equal(main.chest_upper, 1);
  assert.ok(main.chest_mid < DIRECT);
});

// ---------- Region volume ----------
test('region sets count secondary work partly', () => {
  const r = regionSets([wk(1, [{ exId: 'bench_press', sets: sets(4) }])], lookup);
  assert.equal(r.chest_mid, 4);
  assert.equal(r.delt_front, 2);
  assert.equal(r.tri_lateral, 2);
});

test('warm-ups and unfinished sets do not count', () => {
  const s = [{ weight: 45, reps: 10, done: true, warmup: true }, { weight: 135, reps: 8, done: false }, { weight: 135, reps: 8, done: true }];
  assert.equal(regionSets([wk(1, [{ exId: 'bench_press', sets: s }])], lookup).chest_mid, 1);
});

test('region targets split the muscle target by size', () => {
  const t = regionTargets(10);
  const chest = regionsOf('chest').reduce((s, r) => s + t[r], 0);
  assert.ok(Math.abs(chest - 10) < 1e-9);
  assert.ok(t.chest_mid > t.chest_lower);
  assert.ok(Math.abs(t.adductors - 10) < 1e-9);
});

// ---------- Neglect ----------
test('flags a region with no direct work for 10+ days', () => {
  const ws = [10, 6, 2].map(d => wk(d, [{ exId: 'bench_press', sets: sets(4) }, { exId: 'lateral_raise', sets: sets(3) }]));
  const n = neglectedRegions(ws, lookup, { now: NOW });
  const rear = n.find(x => x.region === 'delt_rear');
  assert.ok(rear, 'rear delts should be flagged');
  assert.match(rear.reason, /No direct work/);
  assert.ok(!n.find(x => x.region === 'delt_side'), 'side delts are trained');
});

test('flags a region far behind its siblings', () => {
  // Plenty of chest work, but machine press gives the upper chest nothing.
  const ws = [12, 9, 5, 2].map(d => wk(d, [{ exId: 'machine_chest_press', sets: sets(5) }]));
  const n = neglectedRegions(ws, lookup, { now: NOW });
  const upper = n.find(x => x.region === 'chest_upper');
  assert.ok(upper, 'upper chest should be flagged');
  assert.ok(upper.behind, 'flagged as behind its siblings');
  assert.ok(!n.find(x => x.region === 'chest_mid'));
});

test('needs a week of history, honors ignore and snooze', () => {
  const recent = [wk(2, [{ exId: 'bench_press', sets: sets(4) }])];
  assert.deepEqual(neglectedRegions(recent, lookup, { now: NOW }), []);
  const ws = [10, 2].map(d => wk(d, [{ exId: 'bench_press', sets: sets(4) }]));
  const all = neglectedRegions(ws, lookup, { now: NOW });
  assert.ok(all.find(x => x.region === 'delt_rear'));
  const ign = neglectedRegions(ws, lookup, { now: NOW, ignored: ['delt_rear'] });
  assert.ok(!ign.find(x => x.region === 'delt_rear'));
  const snz = neglectedRegions(ws, lookup, { now: NOW, snoozed: { delt_rear: new Date(NOW + 86400000).toISOString() } });
  assert.ok(!snz.find(x => x.region === 'delt_rear'));
  const expired = neglectedRegions(ws, lookup, { now: NOW, snoozed: { delt_rear: new Date(NOW - 86400000).toISOString() } });
  assert.ok(expired.find(x => x.region === 'delt_rear'));
});

test('trained muscles rank above muscles never trained', () => {
  const ws = [12, 2].map(d => wk(d, [{ exId: 'bench_press', sets: sets(4) }]));
  const n = neglectedRegions(ws, lookup, { now: NOW });
  const upper = n.findIndex(x => x.region === 'chest_upper' || x.region === 'chest_lower');
  const adductor = n.findIndex(x => x.region === 'adductors');
  if (upper >= 0) assert.ok(upper < adductor, 'a lagging chest region should outrank an untrained muscle');
});

test('a region covered well by indirect work is not flagged for "no direct work"', () => {
  // Heavy pressing: front delts get lots of indirect work, rear delts none.
  const ws = [13, 10, 6, 3].map(d => wk(d, [{ exId: 'bench_press', sets: sets(5) }, { exId: 'incline_bench', sets: sets(4) }, { exId: 'lateral_raise', sets: sets(3) }]));
  const n = neglectedRegions(ws, lookup, { now: NOW });
  assert.ok(!n.find(x => x.region === 'delt_front'), 'front delts are covered by pressing');
  assert.ok(n.find(x => x.region === 'delt_rear'), 'rear delts still flagged');
});
