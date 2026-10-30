// Simulated lifters follow the app's suggestions for months. Every single
// suggestion is checked against safety rules, and each scenario checks the
// long-run outcome (progressing lifters keep progressing, stalled ones don't
// get stuck in deload loops, targets stay achievable).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggest, repsAt, zoneFor, fatigueFactor } from '../js/engine.js';

const DAY = 86400000;
const T0 = new Date('2026-01-05T10:00:00Z').getTime();

// Deterministic random numbers so failures are reproducible.
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Run one lifter on one lift.
 *  strength(k)  true fresh 1RM at session k
 *  fatigue(k)   fatigue score at that lift's position in session k
 *  trueRate     how fast this lifter actually tires
 *  start        first session { weight, reps: [...] } (no suggestion yet)
 *  stopAtTarget lifter stops at the target instead of going to failure
 */
function simulate({ ex, inc, sessions = 40, strength, fatigue = () => 0, trueRate = 0.012, start, bw = 0,
  noise = 0.02, seed = 1, stopAtTarget = true, everyDays = 3.5 }) {
  const rand = rng(seed);
  const history = [];
  const log = [];
  const loadOf = w => (ex.equipment === 'bodyweight' ? bw + w : w);
  for (let k = 0; k < sessions; k++) {
    const now = T0 + k * everyDays * DAY;
    const f = fatigue(k);
    const sug = k === 0 ? null : suggest(ex, history, { increment: inc, now, fatigue: f, bodyweight: bw });
    const weight = sug ? sug.weight : start.weight;
    const targets = sug ? sug.reps : start.reps;
    const today = strength(k) * fatigueFactor(f, trueRate) * (1 + (rand() - 0.5) * 2 * noise);
    const sets = targets.map((target, i) => {
      const capacity = Math.max(0, Math.floor(repsAt(today, loadOf(weight)) - i));
      const reps = stopAtTarget ? Math.min(capacity, target) : capacity;
      return { weight, reps, done: reps > 0, target: sug ? { weight, reps: target } : null };
    });
    history.push({ date: new Date(now).toISOString(), sets, fatigue: f });
    log.push({ k, sug, weight, targets, sets, today, f });
  }
  return log;
}

// Rules every suggestion must follow.
function checkSuggestion(entry, prev, ex, inc, bw, recent) {
  const { sug } = entry;
  if (!sug) return;
  const [, zMax] = zoneFor(ex);
  const where = `session ${entry.k} (${sug.kind}: ${sug.weight} × ${sug.reps.join(',')})`;
  assert.ok(Number.isFinite(sug.weight) && sug.weight >= 0, `bad weight at ${where}`);
  assert.ok(Math.abs(sug.weight / inc - Math.round(sug.weight / inc)) < 1e-9, `weight not loadable in ${inc} lb steps at ${where}`);
  const cap = ex.equipment === 'bodyweight' ? zMax + 5 : 12;
  for (const r of sug.reps) assert.ok(Number.isInteger(r) && r >= 1 && r <= cap, `rep target over ${cap} at ${where}`);
  assert.ok(sug.reps.every((r, i) => i === 0 || r <= sug.reps[i - 1]), `later sets ask for more reps at ${where}`);
  if (ex.equipment !== 'bodyweight' || bw) assert.ok(sug.weight > 0 || ex.equipment === 'bodyweight', `zero weight at ${where}`);
  // Never more than one step / ~12% above the heaviest weight used in the
  // last 3 sessions, and never a crash of more than 35%.
  const top = Math.max(0, ...recent.map(e => e.weight));
  if (top > 0) {
    const up = (sug.weight - top) / top;
    assert.ok(up <= Math.max(0.12, inc / top + 1e-9), `jumped up ${(up * 100).toFixed(0)}% at ${where}`);
  }
  // Compare with the previous session only when it was at a similar point in
  // the workout; fresh-vs-tired swings are judged by the closeness-to-ideal checks.
  if (prev && prev.weight > 0 && Math.abs((prev.f || 0) - (entry.f || 0)) <= 3) {
    const change = (sug.weight - prev.weight) / prev.weight;
    assert.ok(change >= -0.35, `dropped ${(change * 100).toFixed(0)}% at ${where} [fatigue ${prev.f}→${entry.f}, prev ${prev.weight}×${prev.sets.map(s => s.reps).join(",")}, today capacity ${Math.floor(repsAt(entry.today, sug.weight))} reps]`);
  }
}

// Target vs what the lifter could truly do that day (fresh-from-noise capacity).
function capacityGap(entry, ex, bw) {
  const load = ex.equipment === 'bodyweight' ? bw + entry.weight : entry.weight;
  const capacity = Math.floor(repsAt(entry.today, load));
  return entry.targets[0] - capacity;
}

function runScenario(opts) {
  const log = simulate(opts);
  log.forEach((e, i) => checkSuggestion(e, log[i - 1], opts.ex, opts.inc, opts.bw || 0, log.slice(Math.max(0, i - 6), i)));
  const kinds = log.filter(e => e.sug).map(e => e.sug.kind);
  const gaps = log.slice(4).filter(e => e.sug && e.sug.kind !== 'deload' && e.sug.kind !== 'break').map(e => capacityGap(e, opts.ex, opts.bw || 0));
  return { log, kinds, gaps, deloads: kinds.filter(k => k === 'deload').length };
}

const row = { id: 'cable_row', equipment: 'cable', compound: true, muscle: 'back' };
const curl = { id: 'db_curl', equipment: 'dumbbell', compound: false, muscle: 'biceps' };
const squat = { id: 'squat', equipment: 'barbell', compound: true, muscle: 'quads' };
const dips = { id: 'dips', equipment: 'bodyweight', compound: true, muscle: 'triceps' };
const legPress = { id: 'leg_press', equipment: 'machine', compound: true, muscle: 'quads' };

test('progressing lifter keeps progressing with no deloads', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const r = runScenario({ ex: row, inc: 5, seed, strength: k => 170 * (1 + 0.006 * k), start: { weight: 120, reps: [10, 9, 8] } });
    assert.equal(r.deloads, 0, `seed ${seed}: unexpected deloads ${r.kinds.join(',')}`);
    assert.ok(r.log.at(-1).weight > 120, `seed ${seed}: weight never went up`);
    assert.ok(Math.max(...r.gaps) <= 2, `seed ${seed}: asked for ${Math.max(...r.gaps)} reps beyond capacity`);
  }
});

test('stalled lifter does not get stuck in a deload loop', () => {
  for (const seed of [1, 2, 3]) {
    const r = runScenario({ ex: row, inc: 5, seed, strength: () => 170, start: { weight: 120, reps: [10, 9, 8] } });
    assert.ok(r.deloads <= 2, `seed ${seed}: ${r.deloads} deloads in 40 sessions`);
    const last10 = r.log.slice(-10).map(e => e.weight);
    assert.ok(Math.min(...last10) >= 120 * 0.85, `seed ${seed}: weight drifted down to ${Math.min(...last10)}`);
  }
});

test('lifter getting weaker gets lighter, achievable targets', () => {
  const r = runScenario({ ex: row, inc: 5, seed: 7, strength: k => 170 * (1 - 0.008 * k), start: { weight: 120, reps: [10, 9, 8] } });
  assert.ok(r.log.at(-1).weight < 120, 'weight should come down');
  assert.ok(Math.max(...r.gaps) <= 3, `asked for ${Math.max(...r.gaps)} reps beyond capacity`);
});

test('alternating workout order: weight stays close to ideal, fresh and tired days', () => {
  for (const ex of [curl, row]) {
    for (const trueRate of [0.006, 0.012, 0.02]) {
      const isCurl = ex === curl;
      const r = runScenario({
        ex, inc: 5, seed: 3, trueRate, fatigue: k => (k % 2 ? 12 : 0),
        strength: k => (isCurl ? 42 : 170) * (1 + 0.004 * k), start: { weight: isCurl ? 25 : 120, reps: [12, 11, 10] },
      });
      const tag = `${ex.id} rate ${trueRate}`;
      assert.ok(Math.max(...r.gaps) <= 3, `${tag}: asked ${Math.max(...r.gaps)} beyond capacity`);
      // Ideal = heaviest loadable weight the lifter could do the target reps with that day.
      const offs = r.log.slice(8).map(e => {
        const ideal = Math.floor(e.today / (1 + e.targets[0] / 30) / 5) * 5;
        return Math.round((e.weight - ideal) / 5);
      });
      assert.ok(offs.every(o => Math.abs(o) <= 2), `${tag}: ${Math.max(...offs.map(Math.abs))} steps off ideal`);
      const close = offs.filter(o => Math.abs(o) <= 1).length / offs.length;
      assert.ok(close >= 0.8, `${tag}: only ${(close * 100).toFixed(0)}% within one step of ideal`);
      assert.equal(r.deloads, 0, `${tag}: deloads ${r.kinds.join(',')}`);
      // Last session may be a tired day; compare the best of the last four.
      assert.ok(Math.max(...r.log.slice(-4).map(e => e.weight)) > r.log[0].weight, `${tag}: never progressed`);
    }
  }
});

test('lifter who goes to failure (does more than asked) is tracked', () => {
  const r = runScenario({ ex: squat, inc: 5, seed: 9, stopAtTarget: false, strength: k => 300 * (1 + 0.005 * k), start: { weight: 225, reps: [8, 7, 6] } });
  assert.equal(r.deloads, 0);
  assert.ok(r.log.at(-1).weight >= 245, `ended at ${r.log.at(-1).weight}`);
});

test('works across weight steps of 1, 2.5, 10 and 20 lb', () => {
  for (const [ex, inc, s0, w0] of [[curl, 1, 40, 25], [curl, 2.5, 40, 25], [legPress, 10, 500, 360], [legPress, 20, 500, 360]]) {
    const r = runScenario({ ex, inc, seed: 11, strength: k => s0 * (1 + 0.005 * k), start: { weight: w0, reps: [12, 11, 10] } });
    assert.ok(r.deloads <= 1, `${inc} lb: ${r.kinds.join(',')}`);
    assert.ok(Math.max(...r.gaps) <= 3, `${inc} lb: ${Math.max(...r.gaps)} beyond capacity`);
  }
});

test('bodyweight lift with bodyweight logged progresses', () => {
  const r = runScenario({ ex: dips, inc: 5, bw: 180, seed: 4, strength: k => 260 * (1 + 0.005 * k), start: { weight: 0, reps: [10, 9, 8] } });
  assert.equal(r.deloads, 0);
  assert.ok(r.log.at(-1).weight > 0, 'should be adding weight by the end');
});

test('bodyweight lift with added weight but no bodyweight logged stays sane', () => {
  const history = [{ date: new Date(T0).toISOString(), sets: [{ weight: 25, reps: 8, done: true }, { weight: 25, reps: 7, done: true }] }];
  const s = suggest(dips, history, { increment: 5, now: T0 + 3 * DAY });
  assert.equal(s.weight, 25);
  assert.equal(s.reps[0], 9);
});

test('history with no weight entered gives no suggestion instead of 0 lb', () => {
  const history = [{ date: new Date(T0).toISOString(), sets: [{ weight: 0, reps: 10, done: true }] }];
  assert.equal(suggest(row, history, { increment: 5, now: T0 + 3 * DAY }), null);
});

test('later-set targets never collapse to 1-2 reps', () => {
  const history = [{ date: new Date(T0).toISOString(), sets: [12, 9, 6, 3, 1].map(r => ({ weight: 100, reps: r, done: true })) }];
  const s = suggest(row, history, { increment: 5, now: T0 + 3 * DAY });
  assert.ok(Math.min(...s.reps) >= 4, `targets ${s.reps}`);
});

test('stress: 400 random lifters, every suggestion follows the safety rules', () => {
  const lifts = [
    [row, 5, 170, 120], [curl, 5, 42, 25], [curl, 2.5, 42, 25], [squat, 5, 300, 225],
    [legPress, 10, 500, 360], [legPress, 20, 600, 400], [{ ...curl, id: 'cable_curl', equipment: 'cable' }, 5, 70, 50],
  ];
  let suggestions = 0, nearIdeal = 0, judged = 0, overshoots = 0, deloadsWhileGaining = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const rand = rng(seed * 7919);
    const [ex, inc, s0, w0] = lifts[seed % lifts.length];
    const gain = -0.004 + rand() * 0.014;          // -0.4% .. +1% per session
    const trueRate = 0.005 + rand() * 0.02;        // slow to fast fatigue
    const pattern = Math.floor(rand() * 3);        // fixed, alternating, random position
    const fatigue = k => pattern === 0 ? 0 : pattern === 1 ? (k % 2 ? 4 + (seed % 10) : 0) : Math.floor(rng(seed + k)() * 16);
    const opts = {
      ex, inc, seed, trueRate, fatigue, noise: 0.01 + rand() * 0.04, stopAtTarget: rand() < 0.7,
      sessions: 36, strength: k => s0 * (1 + gain * k), start: { weight: w0, reps: [10, 9, 8] },
    };
    const log = simulate(opts);
    log.forEach((e, i) => checkSuggestion(e, log[i - 1], ex, inc, 0, log.slice(Math.max(0, i - 6), i)));
    for (const e of log.slice(8)) {
      if (!e.sug) continue;
      suggestions++;
      const gap = capacityGap(e, ex, 0);
      if (gap > 3) overshoots++;
      if (e.sug.kind === 'deload' && gain > 0.003) deloadsWhileGaining++;
      const ideal = Math.floor(e.today / (1 + e.targets[0] / 30) / inc) * inc;
      judged++;
      if (Math.abs(e.weight - ideal) <= inc + 1e-9) nearIdeal++;
    }
  }
  const nearPct = nearIdeal / judged;
  console.log(`  ${suggestions} suggestions: ${(nearPct * 100).toFixed(1)}% within one step of ideal, ${overshoots} overshoots >3 reps, ${deloadsWhileGaining} deloads while clearly gaining`);
  assert.ok(nearPct >= 0.8, `only ${(nearPct * 100).toFixed(1)}% near ideal`);
  assert.ok(overshoots / suggestions <= 0.01, `${overshoots} overshoots`);
  assert.ok(deloadsWhileGaining / suggestions <= 0.005, `${deloadsWhileGaining} deloads while gaining`);
});
