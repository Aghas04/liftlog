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

test('weighted lifts never go past 12 reps, even when the next weight is a big jump', () => {
  const s = suggest(curl, [{ date: daysAgo(3), sets: sets(15, [12, 12]) }], { increment: 5, now: NOW });
  assert.equal(s.weight, 20);
  assert.ok(s.reps.every(r => r <= 12));
  // Going lighter mid-workout can't push the goal past 12 either.
  assert.ok(targetFor(s, curl, 5, 0) <= 12);
});

test('bodyweight lifts may go past 12 reps', () => {
  const pushup = { equipment: 'bodyweight', compound: true };
  const s = suggest(pushup, [{ date: daysAgo(3), sets: sets(0, [15, 14]) }], { increment: 5, now: NOW });
  assert.equal(s.weight, 0);
  assert.equal(s.reps[0], 16);
});

test('missing targets lowers the next target', () => {
  const hit = suggest(row, [{ date: daysAgo(3), sets: sets(120, [10, 10, 10], [10, 10, 10]) }], { increment: 5, now: NOW });
  const miss = suggest(row, [{ date: daysAgo(3), sets: sets(120, [8, 7, 6], [10, 10, 10]) }], { increment: 5, now: NOW });
  assert.ok(miss.reps[0] < hit.reps[0]);
  assert.equal(miss.kind, 'hold');
});

test('missing by just one rep is not a miss', () => {
  assert.equal(sessionMissed({ sets: sets(150, [8, 7, 6], [9, 8, 7]) }), false);
  assert.equal(sessionMissed({ sets: sets(150, [7, 6, 6], [9, 8, 7]) }), true);
});

test('two missed sessions in a row deloads about 10%', () => {
  const h = [
    { date: daysAgo(11), sets: sets(150, [9, 8, 7], [9, 8, 7]) },
    { date: daysAgo(7), sets: sets(150, [7, 6, 5], [10, 9, 8]) },
    { date: daysAgo(3), sets: sets(150, [6, 5, 4], [8, 7, 6]) },
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
  // Bodyweight lifts climb to 20 reps before adding weight.
  const more = suggest(dips, [{ date: daysAgo(3), sets: sets(0, [12, 12, 12]) }], { increment: 5, now: NOW, bodyweight: 180 });
  assert.equal(more.weight, 0);
  assert.equal(more.reps[0], 13);
  const s = suggest(dips, [{ date: daysAgo(3), sets: sets(0, [20, 20, 20]) }], { increment: 5, now: NOW, bodyweight: 180 });
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

test('warm-ups ramp up and stay under the working weight', async () => {
  const { warmupSets } = await import('../js/engine.js');
  const w = warmupSets({ equipment: 'barbell' }, 225, 5);
  assert.deepEqual(w.map(s => s.weight), [90, 135, 180]);
  assert.ok(warmupSets({ equipment: 'barbell' }, 65, 5).every(s => s.weight >= 45 && s.weight < 65));
  assert.deepEqual(warmupSets({ equipment: 'cable' }, 0, 5), []);
});

test('swap weight converts between equipment', async () => {
  const { swapWeight } = await import('../js/engine.js');
  assert.equal(swapWeight({ equipment: 'barbell' }, { equipment: 'dumbbell' }, 185, 5), 75);
  assert.equal(swapWeight({ equipment: 'bodyweight' }, { equipment: 'cable' }, 0, 5), null);
});

test('deload sessions do not lower the next suggestion', () => {
  const h = [
    { date: daysAgo(10), sets: sets(150, [10, 9, 8]) },
    { date: daysAgo(3), deload: true, sets: sets(125, [10, 9, 8]) },
  ];
  const s = suggest(row, h, { increment: 5, now: NOW });
  assert.equal(s.weight, 150);
  assert.notEqual(s.kind, 'break');
});

test('fatigue: same history, tired now asks for less than fresh now', async () => {
  const { fatigueLoad } = await import('../js/engine.js');
  const h = [{ date: daysAgo(3), fatigue: 0, sets: sets(30, [12, 11, 10]) }];
  const curl = { equipment: 'dumbbell', compound: false };
  const fresh = suggest(curl, h, { increment: 5, now: NOW, fatigue: 0 });
  const tired = suggest(curl, h, { increment: 5, now: NOW, fatigue: fatigueLoad({ back: 20 }, 'biceps') });
  assert.ok(tired.est < fresh.est);
  assert.ok(tired.reps[0] < fresh.reps[0] || tired.weight < fresh.weight);
  assert.match(tired.fatigueNote, /lower/);
  assert.doesNotMatch(tired.reason, /lower/);
});

test('fatigue: tired last time, fresh now asks for more', () => {
  const tiredLast = [{ date: daysAgo(3), fatigue: 12, sets: sets(30, [10, 9, 8]) }];
  const freshLast = [{ date: daysAgo(3), fatigue: 0, sets: sets(30, [10, 9, 8]) }];
  const a = suggest(curl, tiredLast, { increment: 5, now: NOW, fatigue: 0 });
  const b = suggest(curl, freshLast, { increment: 5, now: NOW, fatigue: 0 });
  assert.ok(a.est > b.est);
  assert.match(a.fatigueNote, /higher/);
});

test('fatigue load weights same muscle > helper > other', async () => {
  const { fatigueLoad } = await import('../js/engine.js');
  assert.ok(fatigueLoad({ triceps: 4 }, 'triceps') > fatigueLoad({ chest: 4 }, 'triceps'));
  assert.ok(fatigueLoad({ chest: 4 }, 'triceps') > fatigueLoad({ quads: 4 }, 'triceps'));
  assert.equal(fatigueLoad({}, 'biceps'), 0);
});

test('learns a steeper personal fatigue rate from varied positions', async () => {
  const { learnFatigueRate, DEFAULT_FATIGUE_RATE } = await import('../js/engine.js');
  // Same strength over time, but 3% weaker per fatigue point.
  const pts = [0, 8, 2, 10, 4, 12, 0, 9].map((f, i) => ({ t: i * 3, f, e1rm: 100 * (1 - 0.03 * f) }));
  const r = learnFatigueRate(pts);
  assert.ok(r > DEFAULT_FATIGUE_RATE + 0.005, `rate ${r}`);
  assert.equal(learnFatigueRate(pts.slice(0, 3)), DEFAULT_FATIGUE_RATE);
});

test('personal fatigue rate pools lifts and becomes the starting point', async () => {
  const { personalFatigueRate, learnFatigueRate, DEFAULT_FATIGUE_RATE } = await import('../js/engine.js');
  // Two lifts, both ~2.5% weaker per fatigue point.
  const lift = base => [0, 8, 2, 10, 4, 12, 1, 9].map((f, i) => ({ t: i * 3, f, e1rm: base * (1 - 0.025 * f) }));
  const p = personalFatigueRate([lift(100), lift(60), [{ t: 0, f: 0, e1rm: 50 }]]);
  assert.equal(p.lifts, 2);
  assert.ok(p.rate > DEFAULT_FATIGUE_RATE + 0.005, `rate ${p.rate}`);
  // A lift without varied sessions starts from the personal rate, not the default.
  assert.equal(learnFatigueRate([{ t: 0, f: 0, e1rm: 50 }], p.rate), p.rate);
  // No usable data: default.
  assert.equal(personalFatigueRate([]).rate, DEFAULT_FATIGUE_RATE);
});

test('suggest uses the personal rate for a lift with no varied history', () => {
  const h = [{ date: daysAgo(3), fatigue: 0, sets: sets(30, [12, 11, 10]) }];
  const slow = suggest(curl, h, { increment: 5, now: NOW, fatigue: 10, fatigueRate: 0.005 });
  const fast = suggest(curl, h, { increment: 5, now: NOW, fatigue: 10, fatigueRate: 0.025 });
  assert.ok(slow.est > fast.est, 'someone who tires slowly gets a smaller cut');
});

test('messages use the formatter the app passes (kg mode)', () => {
  const kgInc = 2.5 * 2.20462;
  const s = suggest(row, [{ date: daysAgo(3), sets: sets(50 * 2.20462, [12, 12, 12]) }], {
    increment: kgInc, now: NOW, formatWeight: v => `${Math.round(v / 2.20462 * 100) / 100} kg`,
  });
  assert.equal(s.kind, 'up');
  assert.match(s.reason, /kg/);
  assert.doesNotMatch(s.reason, /lb/);
  // New weight is a whole number of kg steps above the old one.
  const steps = (s.weight - 50 * 2.20462) / kgInc;
  assert.ok(Math.abs(steps - Math.round(steps)) < 1e-6 && steps >= 1);
});

test('default messages still read in lb', () => {
  const s = suggest(row, [{ date: daysAgo(3), sets: sets(120, [12, 12, 12]) }], { increment: 5, now: NOW });
  assert.match(s.reason, /\d+ lb/);
});

test('warm-ups use a 20 kg bar in kg mode', async () => {
  const { warmupSets } = await import('../js/engine.js');
  const bar = 20 * 2.20462;
  const w = warmupSets({ equipment: 'barbell' }, 100 * 2.20462, 2.5 * 2.20462, bar);
  assert.ok(w.length && w.every(s => s.weight >= bar - 1e-9 && s.weight < 100 * 2.20462));
});

// ---------- Assisted machines (assistance stored as negative weight) ----------
const assistedPull = { equipment: 'assisted', compound: true };

test('assisted: hitting the top of the range means less assistance, never below zero', async () => {
  const { loadFor } = await import('../js/engine.js');
  assert.equal(loadFor(assistedPull, -50, 180), 130);
  assert.equal(loadFor(assistedPull, -250, 180), 0, 'load never negative');
  const s = suggest(assistedPull, [{ date: daysAgo(3), sets: sets(-50, [12, 12, 12]) }], { increment: 10, now: NOW, bodyweight: 180 });
  assert.equal(s.kind, 'up');
  assert.ok(s.weight > -50 && s.weight <= 0, `assistance went from 50 to ${-s.weight}`);
  assert.ok(s.reps[0] >= 6 && s.reps[0] <= 12, 'assisted lifts follow the weighted 6-12 range');
  assert.match(s.reason, /less assistance/);
});

test('assisted: inside the range adds a rep at the same assistance', () => {
  const s = suggest(assistedPull, [{ date: daysAgo(3), sets: sets(-50, [8, 7, 7]) }], { increment: 10, now: NOW, bodyweight: 180 });
  assert.equal(s.weight, -50);
  assert.equal(s.reps[0], 9);
});

test('assisted: too hard means more assistance, a deload adds assistance', () => {
  const down = suggest(assistedPull, [{ date: daysAgo(3), sets: sets(-30, [3, 2, 2]) }], { increment: 10, now: NOW, bodyweight: 180 });
  assert.ok(down.weight < -30, `assistance should go up from 30, got ${-down.weight}`);
  const miss = [9, 6, 3].map(d => ({ date: daysAgo(d), sets: sets(-40, [5, 4, 4], [8, 8, 8]) }));
  miss[0].sets = sets(-40, [8, 8, 8], [8, 8, 8]);
  const dl = suggest(assistedPull, miss, { increment: 10, now: NOW, bodyweight: 180 });
  assert.ok(dl.weight <= -40, `a lighter session must not reduce assistance (${-dl.weight})`);
  const brk = suggest(assistedPull, [{ date: daysAgo(30), sets: sets(-40, [8, 8, 8]) }], { increment: 10, now: NOW, bodyweight: 180 });
  assert.equal(brk.kind, 'break');
  assert.ok(brk.weight < -40, 'easing back in adds assistance');
});

test('assisted: no assistance left suggests the bodyweight version', () => {
  const s = suggest(assistedPull, [{ date: daysAgo(3), sets: sets(0, [12, 12, 12]) }], { increment: 10, now: NOW, bodyweight: 180 });
  assert.equal(s.weight, 0);
  assert.match(s.reason, /bodyweight version/);
});

test('assisted without bodyweight logged progresses reps, then less assistance', () => {
  const a = suggest(assistedPull, [{ date: daysAgo(3), sets: sets(-50, [8, 8]) }], { increment: 10, now: NOW });
  assert.equal(a.weight, -50);
  assert.equal(a.reps[0], 9);
  const b = suggest(assistedPull, [{ date: daysAgo(3), sets: sets(-50, [12, 12]) }], { increment: 10, now: NOW });
  assert.equal(b.weight, -40);
});

test('new equipment types convert starting weights like their closest classic type', async () => {
  const { swapWeight } = await import('../js/engine.js');
  assert.equal(swapWeight({ equipment: 'barbell' }, { equipment: 'smith' }, 200, 5), 180);
  assert.equal(swapWeight({ equipment: 'dumbbell' }, { equipment: 'plate_loaded' }, 50, 5), 100);
  assert.equal(swapWeight({ equipment: 'barbell' }, { equipment: 'assisted' }, 200, 5), null);
});
