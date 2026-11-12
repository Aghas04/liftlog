// Rest learned from set times, session timing, and the diet phase (v44).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES } from '../js/data.js';
import { learnRests, restPairs, setSeconds, fitRest } from '../js/rest.js';
import { suggest } from '../js/engine.js';
import { buildSession, buildBlock, modelSeconds } from '../js/planner.js';
import { phaseHint } from '../js/insights.js';

const DAY = 864e5;
const NOW = Date.UTC(2026, 10, 3, 12);
const lookup = id => EXERCISES.find(e => e.id === id);
const REST_CYCLE = [70, 90, 120, 150, 180, 210, 240, 300];

// Sessions of `exId` where reps lost per set follow drop = a - b*ln(rest),
// with the rest that keeps the drop at 1.5 being `needs` seconds.
function history(exId, needs, { sessions = 8, b = 2, first = 12, weight = 100, rests = REST_CYCLE, flat = false } = {}) {
  const a = 1.5 + b * Math.log(needs);
  return Array.from({ length: sessions }, (_, i) => {
    let t = NOW - (sessions - i) * 3 * DAY;
    let reps = first;
    const sets = [];
    for (let k = 0; k < 3; k++) {
      if (k) {
        const rest = rests[(i * 2 + k) % rests.length];
        reps = Math.max(1, Math.round(reps - (flat ? 1 : a - b * Math.log(rest))));
        t += (rest + setSeconds(reps)) * 1000;
      }
      sets.push({ weight, reps, done: true, doneAt: new Date(t).toISOString() });
    }
    return { id: `${exId}${i}`, date: new Date(NOW - (sessions - i) * 3 * DAY).toISOString(), exercises: [{ exId, sets }] };
  });
}

test('learns the shortest rest that keeps reps within about 1.5 a set', () => {
  const r = learnRests(history('bench_press', 165), lookup).bench_press;
  assert.equal(r.source, 'lift');
  assert.ok(Math.abs(r.rest - 165) <= 15, `learned ${r.rest}s for a true 165s`);
  const curls = learnRests(history('barbell_curl', 100, { first: 14 }), lookup).barbell_curl;
  assert.ok(Math.abs(curls.rest - 100) <= 20, `learned ${curls.rest}s for a true 100s`);
});

test('learned rests stay inside the research limits', () => {
  assert.equal(learnRests(history('bench_press', 600), lookup).bench_press.rest, 240, 'big lifts at most 4 min');
  assert.equal(learnRests(history('bench_press', 40), lookup).bench_press.rest, 120, 'big lifts at least 2 min');
  assert.equal(learnRests(history('barbell_curl', 900, { first: 15 }), lookup).barbell_curl.rest, 180, 'small lifts at most 3 min');
});

test('a lift with only a few timed sets borrows from your other lifts of the same kind', () => {
  const few = history('barbell_curl', 100, { sessions: 2 });
  const ws = [...history('lateral_raise', 100, { first: 15 }), ...few];
  const r = learnRests(ws, lookup);
  assert.equal(r.barbell_curl.source, 'group');
  assert.ok(Math.abs(r.barbell_curl.rest - 100) <= 20);
  assert.equal(learnRests(few, lookup).barbell_curl, undefined, 'not enough anywhere: no learned rest');
});

test('only same-weight sets outside supersets, with believable gaps, count', () => {
  const at = s => new Date(NOW + s * 1000).toISOString();
  const w = { date: at(0), exercises: [
    { exId: 'bench_press', sets: [
      { weight: 100, reps: 10, done: true, doneAt: at(0) },
      { weight: 100, reps: 9, done: true, doneAt: at(150 + setSeconds(9)) }, // counts: 150 s
      { weight: 110, reps: 7, done: true, doneAt: at(400) }, // weight changed
      { weight: 110, reps: 6, done: true, doneAt: at(2400) }, // 33 min: forgot to tick
    ] },
    { exId: 'barbell_curl', group: 'a', sets: [{ weight: 50, reps: 10, done: true, doneAt: at(0) }, { weight: 50, reps: 9, done: true, doneAt: at(120) }] },
  ] };
  assert.deepEqual(restPairs([w], 'bench_press'), [{ rest: 150, drop: 1 }]);
  assert.deepEqual(restPairs([w], 'barbell_curl'), []);
});

test('no learned rest when longer rests don\'t keep more reps', () => {
  assert.equal(learnRests(history('bench_press', 165, { flat: true }), lookup).bench_press, undefined);
  assert.equal(fitRest([{ rest: 120, drop: 1 }]), null);
});

test('the rest timer: your own rest wins, then the learned one (3 min+ on strength sets), then the plan', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {} };
  const store = await import('../js/store.js');
  store.state.activeWorkout = { exercises: [{ exId: 'bench_press', rest: 90 }, { exId: 'squat', zone: [3, 6] }] };
  const plan = store.restFor('bench_press');
  assert.equal(plan, 90, 'plan rest without anything learned');
  store.setLearnedRests({ bench_press: { rest: 150 }, squat: { rest: 135 } });
  assert.equal(store.restFor('bench_press'), 150);
  assert.ok(store.restFor('squat') >= 180, 'strength sets keep at least 3 min');
  store.state.exerciseSettings.bench_press = { rest: 200 };
  assert.equal(store.restFor('bench_press'), 200);
  delete store.state.exerciseSettings.bench_press;
  store.setLearnedRests({});
  store.state.activeWorkout = null;
});

test('plan timing: set length from reps, learned rests, and your measured time scale', () => {
  const profile = { days: [0, 2, 4, 5], minutes: 240, level: 'intermediate', goal: 'muscle', priority: [], equipment: 'gym', activities: [], avoid: [] };
  const slots = buildBlock({ profile, splitId: 'upper_lower', exercises: EXERCISES.filter(e => e.common), lookup, workouts: [], seed: 1 });
  const setsByMuscle = { chest: 6, back: 6, shoulders: 4, biceps: 3, triceps: 3 };
  const run = o => buildSession({ type: 'upper', variant: slots.upper[0], setsByMuscle, lookup, profile, secPerSet: 130, restSec: 90, perLift: true, ...o });
  const one = run({}), slow = run({ timeScale: 1.3 });
  assert.ok(Math.abs(slow.estMinutes / one.estMinutes - 1.3) < 0.05, `${slow.estMinutes} vs ${one.estMinutes}`);
  const iso = one.items.find(it => !lookup(it.exId).compound);
  const longer = run({ rests: { [iso.exId]: 180 } });
  assert.ok(longer.estMinutes > one.estMinutes, 'a lift you need longer rests on takes longer');
  // Short on time: a small lift you've been learned to need 2+ min on keeps its rest.
  const tight = buildSession({ type: 'upper', variant: slots.upper[0], setsByMuscle, lookup, profile: { ...profile, minutes: 45 }, secPerSet: 130, restSec: 150, perLift: true, rests: { [iso.exId]: 150 } });
  const kept = tight.items.find(it => it.exId === iso.exId);
  assert.ok(kept);
  assert.equal(kept.rest, undefined);
  assert.ok(tight.items.some(it => !lookup(it.exId).compound && it.exId !== iso.exId && it.rest === 90), 'others still drop to 90 s');
});

test('a logged workout\'s model time counts its sets, rests, warm-ups and changes', () => {
  const w = { exercises: [{ exId: 'bench_press', sets: [10, 10, 10].map(reps => ({ weight: 100, reps, done: true })) }, { exId: 'barbell_curl', sets: [12, 12].map(reps => ({ weight: 50, reps, done: true })) }] };
  const t = modelSeconds(w, lookup, { rests: { bench_press: 150, barbell_curl: 90 } });
  assert.equal(t, 3 * (setSeconds(10) + 150) + 150 + 45 + 2 * (setSeconds(12) + 90) + 45);
});

test('bodyweight trend suggests a diet phase only when it clearly differs from yours', () => {
  const now = Date.UTC(2026, 10, 1, 12);
  const days = d => new Date(now - d * DAY).toISOString().slice(0, 10);
  const gaining = [35, 28, 21, 14, 7, 0].map((d, i) => ({ date: days(d), lb: 180 + i * 0.9 })); // +0.5%/week
  assert.equal(phaseHint(gaining, 'maintain', now).suggest, 'bulk');
  assert.equal(phaseHint(gaining, 'bulk', now), null);
  const losing = [35, 28, 21, 14, 7, 0].map((d, i) => ({ date: days(d), lb: 180 - i * 1.4 }));
  assert.equal(phaseHint(losing, 'bulk', now).suggest, 'cut');
  const steady = [35, 28, 21, 14, 7, 0].map((d, i) => ({ date: days(d), lb: 180 + (i % 2 ? 0.2 : -0.2) }));
  assert.equal(phaseHint(steady, 'cut', now).suggest, 'maintain');
  assert.equal(phaseHint(gaining.slice(-3), 'maintain', now), null, 'needs 4+ weigh-ins');
  assert.equal(phaseHint(gaining.slice(-4).map((b, i) => ({ ...b, date: days(i) })), 'maintain', now), null, 'needs 3+ weeks');
});

test('on a cut, holding your weights is never a stall and the goal says so', () => {
  const ago = d => new Date(NOW - d * DAY).toISOString();
  const S = (d, w, r, t) => ({ date: ago(d), sets: [{ weight: w, reps: r, done: true, target: { weight: w, reps: t } }] });
  const flat = [S(42, 200, 8, 8), S(35, 200, 8, 9), S(28, 200, 8, 9), S(21, 200, 8, 9), S(14, 200, 8, 9), S(7, 200, 8, 9)];
  const bench = { equipment: 'barbell', compound: true };
  assert.equal(suggest(bench, flat, { increment: 5, now: NOW }).stalled, true);
  const cut = suggest(bench, flat, { increment: 5, now: NOW, phase: 'cut' });
  assert.ok(!cut.stalled);
  assert.match(cut.reason, /cut/i);
});
