import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES } from '../js/data.js';
import { workoutsCsv } from '../js/export.js';

const lookup = id => EXERCISES.find(e => e.id === id) || (id === 'c_q' ? { name: 'My "odd", lift', muscle: 'back', equipment: 'machine' } : null);
const ws = [
  { id: 'b', date: '2026-10-30T18:05:00', dayType: 'upper', templateName: 'Push, heavy', exercises: [
    { exId: 'bench_press', difficulty: 'easy', sets: [{ weight: 95, reps: 10, done: true, warmup: true }, { weight: 185, reps: 8, done: true, target: { weight: 185, reps: 8 }, pr: true }, { weight: 185, reps: 7, done: true }, { weight: 185, reps: null, done: false }] },
    { exId: 'pull_up_assisted', sets: [{ weight: -40, reps: 8, done: true }] },
    { exId: 'c_q', sets: [{ weight: 50, reps: 12, done: true }] },
  ] },
  { id: 'a', date: '2026-10-28T07:00:00', dayType: 'lower', exercises: [{ exId: 'squat', sets: [{ weight: 225, reps: 5, done: true }] }] },
];

test('CSV export: one row per logged set, oldest first, safe quoting', () => {
  const csv = workoutsCsv(ws, lookup, 'lb', id => ({ upper: 'Upper', lower: 'Lower' }[id]));
  const lines = csv.split('\r\n');
  assert.equal(lines[0], 'Date,Time,Workout,Exercise,Muscle,Equipment,Set,Type,Weight (lb),Reps or seconds,Target reps,Feel,PR');
  assert.equal(lines.length, 1 + 1 + 3 + 1 + 1, 'unfinished sets are left out');
  assert.equal(lines[1], '2026-10-28,07:00,Lower,Back Squat,Quads,Barbell,1,Working,225,5,,,');
  assert.equal(lines[2], '2026-10-30,18:05,"Push, heavy",Bench Press,Chest,Barbell,W,Warm-up,95,10,,easy,');
  assert.equal(lines[3], '2026-10-30,18:05,"Push, heavy",Bench Press,Chest,Barbell,1,Working,185,8,8,easy,Yes');
  assert.ok(lines[5].includes(',-40,8,'), 'assistance keeps its sign');
  assert.ok(lines[6].includes('"My ""odd"", lift"'), 'quotes and commas are escaped');
});

test('CSV export in kg converts weights', () => {
  const csv = workoutsCsv([ws[1]], lookup, 'kg');
  assert.ok(csv.split('\r\n')[0].includes('Weight (kg)'));
  assert.ok(csv.split('\r\n')[1].includes(',102.06,5,'));
});
