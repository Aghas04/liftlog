// Changing a set's weight mid-workout (v46): goals count working sets only,
// later sets follow the first, and a picked weight is checked against the range.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyWeightChange, weightFit, targetFor, repsAt } from '../js/engine.js';

const bench = { equipment: 'barbell', compound: true };
// Plan 185 x 11, 10, 9 from a 247 lb estimate (one rep beyond it, a rep less each set).
const sug = { weight: 185, reps: [11, 10, 9], est: 247, drop: 1, bonus: 1, zone: [6, 12] };
const entry = (extra = {}) => ({
  suggestion: { ...sug, ...extra },
  sets: [
    { weight: 95, warmup: true, done: false, target: { weight: 95, reps: 8 } },
    { weight: 135, warmup: true, done: false, target: { weight: 135, reps: 5 } },
    ...[11, 10, 9].map(r => ({ weight: 185, done: false, target: { weight: 185, reps: r } })),
  ],
});
const work = e => e.sets.filter(s => !s.warmup).map(s => `${s.weight}x${s.target?.reps}`);

test('warm-ups don\'t count as working sets when a weight changes', () => {
  const e = entry();
  e.sets[2].weight = 195;
  applyWeightChange(e, bench, e.sets[2], 0);
  assert.equal(e.sets[2].target.reps, targetFor(sug, bench, 195, 0, 0));
  assert.equal(e.sets[2].target.reps, 9, 'about 8 predicted at 195, plus one');
});

test('changing the first set moves the later sets with it, each with its own goal', () => {
  const e = entry();
  e.sets[2].weight = 195;
  const changed = applyWeightChange(e, bench, e.sets[2], 0);
  assert.deepEqual(work(e), ['195x9', '195x8', '195x7']);
  assert.equal(changed.length, 3);
});

test('a later set you changed yourself keeps its weight', () => {
  const e = entry();
  e.sets[4].weight = 175;
  applyWeightChange(e, bench, e.sets[4], 0);
  e.sets[2].weight = 195;
  applyWeightChange(e, bench, e.sets[2], 0);
  assert.deepEqual(work(e), ['195x9', '195x8', `175x${targetFor(sug, bench, 175, 2, 0)}`]);
  assert.equal(e.sets[4].target.reps, 11, 'third set at 175: about 12 predicted, plus one, minus two for set 3');
});

test('after the first set is done, the next set leads', () => {
  const e = entry();
  Object.assign(e.sets[2], { reps: 11, done: true });
  e.sets[3].weight = 190;
  applyWeightChange(e, bench, e.sets[3], 0);
  assert.deepEqual(work(e), ['185x11', '190x9', '190x8']);
});

test('a warm-up keeps its reps; a planned pyramid keeps its pattern', () => {
  const e = entry();
  e.sets[1].weight = 130;
  applyWeightChange(e, bench, e.sets[1], 0);
  assert.deepEqual(e.sets[1].target, { weight: 130, reps: 5 });
  assert.deepEqual(work(e), ['185x11', '185x10', '185x9']);
  const p = entry({ weights: [205, 185, 185] });
  p.sets[2].weight = 215;
  applyWeightChange(p, bench, p.sets[2], 0);
  assert.deepEqual(work(p).slice(1), ['185x10', '185x9']);
});

test('a picked weight is checked against the rep range, with a weight that fits', () => {
  const ok = weightFit(sug, bench, 195, 0, 0, 5);
  assert.equal(ok.fit, 'ok');
  assert.equal(ok.pred, Math.round(repsAt(247, 195)));
  const heavy = weightFit(sug, bench, 225, 0, 0, 5);
  assert.equal(heavy.fit, 'heavy');
  assert.equal(heavy.better, 210);
  assert.ok(targetFor(sug, bench, heavy.better, 0, 0) >= 6, 'the suggested weight is back in range');
  const light = weightFit(sug, bench, 135, 0, 0, 5);
  assert.equal(light.fit, 'light');
  assert.equal(light.better, 185);
  assert.ok(targetFor(sug, bench, light.better, 0, 0) <= 12);
  // Later sets count their planned drop.
  assert.equal(weightFit(sug, bench, 195, 2, 0, 5).goal, 7);
  // Bodyweight lifts: the added weight that fits, not the total load.
  const dips = { equipment: 'bodyweight', compound: true };
  const d = weightFit({ est: 300, drop: 1, bonus: 1, zone: [6, 12] }, dips, 100, 0, 180, 5);
  assert.equal(d.fit, 'heavy');
  assert.ok(d.better < 100 && d.better >= 0);
});
