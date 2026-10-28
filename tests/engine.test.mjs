import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggest, sessionMissed, targetFor } from '../js/engine.js';

const NOW = new Date('2026-10-28T12:00:00Z').getTime();
const daysAgo = d => new Date(NOW - d * 86400000).toISOString();
const sets = (weight, reps, targets) =>
  reps.map((r, i) => ({ weight, reps: r, done: true, target: targets ? { weight, reps: targets[i] } : undefined }));

const row = { equipment: 'cable', compound: true };
const curl = { equipment: 'dumbbell', compound: false };
const dips = { equipment: 'bodyweight', compound: true };

test('no history gives no suggestion', () => {
  assert.equal(suggest(row, [], { increment: 5, now: NOW }), null);
});

test('inside the zone: same weight, one more rep on the first set', () => {
  const s = suggest(row, [{ date: daysAgo(3), sets: sets(120, [10, 9, 8]) }], { increment: 5, now: NOW });
  assert.equal(s.weight, 120);
  assert.equal(s.reps[0], 11);
  assert.equal(s.reps.length, 3);
  assert.ok(s.reps[1] < s.reps[0] && s.reps[2] < s.reps[1], 'later sets account for fatigue');
});

test('top of the zone: weight goes up and reps reset into the zone', () => {
  const s = suggest(row, [{ date: daysAgo(3), sets: sets(120, [12, 12, 12]) }], { increment: 5, now: NOW });
  assert.ok(s.weight > 120);
  assert.equal(s.kind, 'up');
  assert.ok(s.reps[0] >= 6 && s.reps[0] <= 12);
});

test('small isolation lift: adds reps when a 5 lb jump is too big', () => {
  const s = suggest(curl, [{ date: daysAgo(3), sets: sets(15, [15, 15]) }], { increment: 5, now: NOW });
  assert.equal(s.weight, 15);
  assert.equal(s.reps[0], 16);
});

test('missing targets lowers the next target', () => {
  const hit = suggest(row, [{ date: daysAgo(3), sets: sets(120, [10, 10, 10], [10, 10, 10]) }], { increment: 5, now: NOW });
  const miss = suggest(row, [{ date: daysAgo(3), sets: sets(120, [8, 7, 6], [10, 10, 10]) }], { increment: 5, now: NOW });
  assert.ok(miss.reps[0] < hit.reps[0]);
  assert.equal(miss.kind, 'hold');
});

test('two missed sessions in a row deloads about 10%', () => {
  const h = [
    { date: daysAgo(7), sets: sets(150, [7, 6, 5], [9, 8, 7]) },
    { date: daysAgo(3), sets: sets(150, [6, 6, 5], [8, 7, 6]) },
  ];
  assert.ok(sessionMissed(h[1]));
  const s = suggest(row, h, { increment: 5, now: NOW });
  assert.equal(s.kind, 'deload');
  assert.equal(s.weight, 135);
});

test('long break eases back in', () => {
  const s = suggest(row, [{ date: daysAgo(30), sets: sets(120, [10, 9, 8]) }], { increment: 5, now: NOW });
  assert.equal(s.kind, 'break');
  assert.ok(s.weight < 120);
});

test('easy rating progresses faster than hard', () => {
  const base = { date: daysAgo(3), sets: sets(120, [10, 9, 8]) };
  const hard = suggest(row, [{ ...base, difficulty: 'hard' }], { increment: 5, now: NOW });
  const easy = suggest(row, [{ ...base, difficulty: 'easy' }], { increment: 5, now: NOW });
  assert.ok(easy.reps[0] > hard.reps[0] || easy.weight > hard.weight);
});

test('bodyweight lift without bodyweight logged progresses reps', () => {
  const s = suggest(dips, [{ date: daysAgo(3), sets: sets(0, [10, 8]) }], { increment: 5, now: NOW });
  assert.equal(s.weight, 0);
  assert.equal(s.reps[0], 11);
});

test('bodyweight lift with bodyweight logged uses total load', () => {
  const s = suggest(dips, [{ date: daysAgo(3), sets: sets(0, [12, 12, 12]) }], { increment: 5, now: NOW, bodyweight: 180 });
  assert.equal(s.kind, 'up');
  assert.ok(s.weight >= 5, 'suggests added weight');
});

test('improving trend still progresses (no drag from older sessions)', () => {
  const h = [
    { date: daysAgo(10), sets: sets(115, [10, 9, 9]) },
    { date: daysAgo(3), sets: sets(120, [12, 12, 11]) },
  ];
  const s = suggest(row, h, { increment: 5, now: NOW });
  assert.equal(s.kind, 'up');
  assert.equal(s.weight, 125);
});

test('a bad day is softened by the session before', () => {
  const h = [
    { date: daysAgo(10), sets: sets(120, [10, 9, 8]) },
    { date: daysAgo(3), sets: sets(120, [7, 6, 6]) },
  ];
  const s = suggest(row, h, { increment: 5, now: NOW });
  assert.equal(s.weight, 120);
  assert.ok(s.reps[0] >= 8, 'not dragged all the way down');
});

test('changing the weight re-targets reps', () => {
  const s = suggest(row, [{ date: daysAgo(3), sets: sets(120, [10, 9, 8]) }], { increment: 5, now: NOW });
  assert.equal(targetFor(s, row, 120, 0), s.reps[0]);
  assert.ok(targetFor(s, row, 140, 0) < s.reps[0], 'heavier means fewer reps');
  assert.ok(targetFor(s, row, 100, 0) > s.reps[0], 'lighter means more reps');
});

test('warm-up sets are ignored', () => {
  const h = [{ date: daysAgo(3), sets: [{ weight: 50, reps: 15, done: true, warmup: true }, ...sets(120, [10, 9, 8])] }];
  const s = suggest(row, h, { increment: 5, now: NOW });
  assert.equal(s.weight, 120);
  assert.equal(s.reps.length, 3);
});
