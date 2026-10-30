import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, MUSCLES, REGIONS, regionsOf, primaryRegion, exerciseRegions, allowedBy, EQUIPMENT_PROFILES } from '../js/data.js';
import {
  SPLITS, PLAN_DAYS, PER_SESSION_CAP, MAJOR, recommendSplits, buildBlock, planWeek, weeklyTargets, volumeBounds,
  slotFor, slotCounts, reviewBlock, applyReview, readinessAdjust, swapSuggestions, splitById,
} from '../js/planner.js';
import { regionSets, regionTargets, DIRECT, weekKey } from '../js/insights.js';

const lookup = id => EXERCISES.find(e => e.id === id);
const DAY = 86400000;
// A Monday morning (local time) so weeks line up with weekKey.
const MONDAY = (() => { const d = new Date(2026, 10, 2, 8, 0, 0); return d.getTime(); })();
const sets = (n, w = 50, reps = 10) => Array.from({ length: n }, () => ({ weight: w, reps, done: true }));
const base = { minutes: 75, level: 'intermediate', goal: 'muscle', priority: [], equipment: 'gym', activities: [] };
const daysFor = n => [[0, 3], [0, 2, 4], [0, 1, 3, 4], [0, 1, 2, 4, 5], [0, 1, 2, 3, 4, 5]][n - 2];

function makePlan(profile, splitId, extra = {}) {
  const slots = buildBlock({ profile, splitId, exercises: EXERCISES, lookup, workouts: [], now: MONDAY });
  return { splitId, slots, volume: {}, weekDays: {}, weekEdits: {}, blockStart: new Date(MONDAY).toISOString(), blockNo: 1, ...extra };
}

// Rules every planned session must follow.
function checkWeek(week, profile, label) {
  const split = null;
  const train = week.days.filter(d => d.kind === 'train');
  for (const d of train) {
    const s = d.session;
    const day = PLAN_DAYS[s.type];
    const ids = s.items.map(i => i.exId);
    assert.equal(new Set(ids).size, ids.length, `${label} ${s.name}: duplicate exercise`);
    const perMuscle = {};
    for (const it of s.items) {
      const ex = lookup(it.exId);
      assert.ok(it.sets >= 2 && it.sets <= 4, `${label} ${s.name}: ${it.exId} has ${it.sets} sets`);
      assert.ok(day.muscles.includes(ex.muscle), `${label} ${s.name}: ${it.exId} (${ex.muscle}) not a ${day.name} muscle`);
      assert.ok(allowedBy(profile.equipment, ex), `${label}: ${it.exId} needs ${ex.equipment}`);
      if (day.only?.[ex.muscle]) assert.ok(day.only[ex.muscle].includes(primaryRegion(ex)), `${label} ${s.name}: ${it.exId} region not allowed on ${day.name}`);
      perMuscle[ex.muscle] = (perMuscle[ex.muscle] || 0) + it.sets;
      if (it.main) assert.ok(ex.compound, `${label}: main lift ${it.exId} isn't a compound`);
    }
    for (const [m, n] of Object.entries(perMuscle)) assert.ok(n <= PER_SESSION_CAP, `${label} ${s.name}: ${m} has ${n} sets in one session`);
    assert.ok(s.items.filter(i => i.main).length <= 2, `${label}: more than 2 main lifts`);
    // Supersets are pairs sitting next to each other.
    for (const g of new Set(s.items.map(i => i.superset).filter(Boolean))) {
      const idx = s.items.map((it, i) => (it.superset === g ? i : -1)).filter(i => i >= 0);
      assert.equal(idx.length, 2, `${label} ${s.name}: superset ${g} has ${idx.length} lifts`);
      assert.equal(idx[1] - idx[0], 1, `${label} ${s.name}: superset ${g} split apart`);
    }
    if (profile.goal !== 'strength') assert.ok(!s.items.some(i => i.main), `${label}: main lifts flagged on a muscle goal`);
    // Compound core lifts come before isolation.
    const firstIso = s.items.findIndex(i => !i.compound);
    if (firstIso >= 0) assert.ok(s.items.slice(firstIso).every(i => !(i.core && i.compound && MAJOR.includes(i.muscle))), `${label} ${s.name}: core compound after isolation`);
  }
  return train;
}

test('every split, day count, time limit, level, goal and equipment produces a valid week', () => {
  let weeks = 0;
  for (const split of SPLITS) {
    for (let n = split.days[0]; n <= split.days[1]; n++) {
      for (const minutes of [30, 45, 60, 90, 120]) {
        for (const level of ['beginner', 'intermediate', 'advanced']) {
          for (const goal of ['muscle', 'strength']) {
            for (const equipment of Object.keys(EQUIPMENT_PROFILES)) {
              const profile = { ...base, days: daysFor(n), minutes, level, goal, equipment, priority: level === 'advanced' ? ['shoulders'] : [] };
              const plan = makePlan(profile, split.id);
              const week = planWeek({ profile, plan, lookup, now: MONDAY });
              const label = `${split.id} ${n}d ${minutes}min ${level} ${goal} ${equipment}`;
              const train = checkWeek(week, profile, label);
              assert.equal(train.length, n, `${label}: ${train.length} training days`);
              for (const d of train) {
                // Time: fits the limit unless only core lifts are left at their minimum.
                const s = d.session;
                const atFloor = s.items.every(i => i.core || i.sets === 2);
                assert.ok(s.estMinutes <= minutes + 1 || atFloor, `${label} ${s.name}: ${s.estMinutes} min over ${minutes}`);
              }
              weeks++;
            }
          }
        }
      }
    }
  }
  assert.ok(weeks > 1000, `only ${weeks} weeks checked`);
});

test('weekly sets per major muscle land near the target when time allows', () => {
  for (const split of SPLITS) {
    for (let n = split.days[0]; n <= split.days[1]; n++) {
      const profile = { ...base, days: daysFor(n), minutes: 120 };
      const week = planWeek({ profile, plan: makePlan(profile, split.id), lookup, now: MONDAY });
      const targets = weeklyTargets(profile);
      const planned = {};
      for (const d of week.days) for (const it of d.session?.items || []) planned[it.muscle] = (planned[it.muscle] || 0) + it.sets;
      for (const m of MAJOR) {
        const freq = week.days.filter(d => d.session && PLAN_DAYS[d.session.type].muscles.includes(m)).length;
        if (!freq) continue;
        const cap = Math.min(targets[m], freq * PER_SESSION_CAP);
        assert.ok(planned[m] >= cap * 0.7 && planned[m] <= cap * 1.3, `${split.id} ${n}d: ${m} planned ${planned[m]} vs target ${targets[m]}`);
      }
    }
  }
});

test('A/B/C variants use different main exercises', () => {
  const profile = { ...base, days: daysFor(6) };
  const slots = buildBlock({ profile, splitId: 'upper_lower', exercises: EXERCISES, lookup, workouts: [] });
  assert.equal(slots.upper.length, 3);
  for (const m of ['chest', 'back', 'quads']) {
    const type = m === 'quads' ? 'lower' : 'upper';
    const firsts = slots[type].map(v => v[m][0]);
    assert.ok(new Set(firsts).size >= 2, `${m}: variants all start with ${firsts[0]}`);
  }
});

test('hard movements only for advanced lifters when alternatives exist', () => {
  for (const level of ['beginner', 'intermediate']) {
    const profile = { ...base, level, days: daysFor(6) };
    const slots = buildBlock({ profile, splitId: 'upper_lower', exercises: EXERCISES, lookup, workouts: [] });
    const all = Object.values(slots).flatMap(vs => vs.flatMap(v => Object.values(v).flat()));
    assert.ok(!all.includes('nordic_curl') && !all.includes('sissy_squat'), `${level}: picked a hard movement`);
  }
});

test('rotation continues across weeks and missed sessions are pushed, not lost', () => {
  const profile = { ...base, days: [0, 2, 4] };
  const split = splitById('ppl');
  const plan = makePlan(profile, 'ppl');
  // Did seq 0 and 1 last week, missed the third.
  const last = MONDAY - 7 * DAY;
  const done = [0, 1].map(seq => ({ id: 'w' + seq, dayType: 'plan_x', date: new Date(last + seq * 2 * DAY).toISOString(), plan: { seq }, exercises: [{ exId: 'bench_press', sets: sets(3) }] }));
  const week = planWeek({ profile, plan, workouts: done, lookup, now: MONDAY });
  const seqs = week.days.filter(d => d.kind === 'train').map(d => d.session.seq).sort((a, b) => a - b);
  assert.deepEqual(seqs, [2, 3, 4]);
  assert.equal(slotFor(split, 3, 2).type, 'legs');
});

test('a missed day this week spreads its volume over the remaining days (within the cap)', () => {
  const profile = { ...base, days: [0, 2, 4, 5], minutes: 120 };
  const plan = makePlan(profile, 'upper_lower');
  const fresh = planWeek({ profile, plan, lookup, now: MONDAY });
  const wed = MONDAY + 2 * DAY;
  const after = planWeek({ profile, plan, lookup, now: wed }); // Monday missed
  assert.equal(after.days[0].kind, 'missed');
  const sum = (w, m) => w.days.reduce((s, d) => s + (d.session?.items || []).filter(i => i.muscle === m).reduce((a, i) => a + i.sets, 0), 0);
  const trainAfter = after.days.filter(d => d.kind === 'train');
  assert.equal(trainAfter.length, 3);
  // Upper-body volume for the week isn't simply lost.
  assert.ok(sum(after, 'chest') >= sum(fresh, 'chest') * 0.6, `chest ${sum(after, 'chest')} vs ${sum(fresh, 'chest')}`);
  checkWeek(after, profile, 'missed');
  assert.ok(after.notes.some(n => /missed/.test(n)));
});

test('hard leg days are kept off leg-heavy activity days and the day after when possible', () => {
  const profile = { ...base, days: [0, 1, 3, 4], activities: [{ day: 2, kind: 'run', legs: true }] };
  const week = planWeek({ profile, plan: makePlan(profile, 'upper_lower'), lookup, now: MONDAY });
  const thu = week.days[3].session;
  assert.ok(thu && !PLAN_DAYS[thu.type].muscles.includes('quads'), `Thursday after a run is ${thu?.type}`);
  assert.equal(week.days[2].kind, 'activity');
});

test('back-to-back full body days are avoided when the days allow it', () => {
  // 3 days chosen Mon/Tue/Thu with Upper/Lower: Mon and Tue should not both be upper.
  const profile = { ...base, days: [0, 1, 3] };
  const week = planWeek({ profile, plan: makePlan(profile, 'upper_lower'), lookup, now: MONDAY });
  assert.notEqual(week.days[0].session.type, week.days[1].session.type);
});

test('pause and easing back in', () => {
  const profile = { ...base, days: [0, 2, 4] };
  const paused = planWeek({ profile, plan: makePlan(profile, 'ppl', { pausedUntil: new Date(MONDAY + 10 * DAY).toISOString() }), lookup, now: MONDAY });
  assert.ok(paused.days.every(d => d.kind === 'paused'));
  const normal = planWeek({ profile, plan: makePlan(profile, 'ppl'), lookup, now: MONDAY });
  const eased = planWeek({ profile, plan: makePlan(profile, 'ppl', { easeWeek: String(weekKey(MONDAY)) }), lookup, now: MONDAY });
  const total = w => w.days.reduce((s, d) => s + (d.session?.items || []).reduce((a, i) => a + i.sets, 0), 0);
  assert.ok(total(eased) < total(normal), `eased ${total(eased)} should be below normal ${total(normal)}`);
  assert.ok(eased.notes.some(n => /Easing back/.test(n)));
});

test('this week\'s edits replace and remove exercises', () => {
  const profile = { ...base, days: [0, 2, 4] };
  const plan = makePlan(profile, 'ppl');
  const week = planWeek({ profile, plan, lookup, now: MONDAY });
  const mon = week.days[0].session;
  const victim = mon.items.find(i => !i.core);
  const other = EXERCISES.find(e => e.muscle === victim.muscle && !mon.items.some(i => i.exId === e.id) && PLAN_DAYS[mon.type].only?.[e.muscle] == null);
  const edited = planWeek({ profile, plan: { ...plan, weekEdits: { [mon.seq]: { replace: { [victim.exId]: other.id } } } }, lookup, now: MONDAY });
  assert.ok(edited.days[0].session.items.some(i => i.exId === other.id));
  const removed = planWeek({ profile, plan: { ...plan, weekEdits: { [mon.seq]: { remove: [victim.exId] } } }, lookup, now: MONDAY });
  assert.ok(!removed.days[0].session.items.some(i => i.exId === victim.exId));
});

test('split recommendations fit the days and explain themselves', () => {
  for (let n = 2; n <= 6; n++) {
    const recs = recommendSplits({ ...base, days: daysFor(n) });
    assert.ok(recs[0].fits, `${n} days: top pick doesn't fit`);
    const firstUnfit = recs.findIndex(r => !r.fits);
    if (firstUnfit >= 0) assert.ok(recs.slice(firstUnfit).every(r => !r.fits), 'unfit split ranked above a fitting one');
    assert.ok(recs[0].reasons.length > 0);
  }
  assert.equal(recommendSplits({ ...base, days: daysFor(5) })[0].fits, true);
});

test('every equipment profile can train every region a plan day asks for', () => {
  for (const eq of Object.keys(EQUIPMENT_PROFILES)) {
    for (const [type, day] of Object.entries(PLAN_DAYS)) {
      for (const m of day.muscles) {
        const regions = day.only?.[m] || regionsOf(m);
        for (const r of regions) {
          const ok = EXERCISES.some(ex => allowedBy(eq, ex) && (exerciseRegions(ex)[r] || 0) >= DIRECT && ex.muscle === m);
          assert.ok(ok, `${eq}: nothing trains ${r} on ${type}`);
        }
      }
    }
  }
});

// ---------- Block review ----------
function blockHistory(exId, e1rms, opts = {}) {
  return e1rms.map((w, i) => ({
    id: exId + i, dayType: 'plan_upper', date: new Date(MONDAY - (30 - i * 5) * DAY).toISOString(), plan: { seq: i },
    readiness: opts.poor ? { poor: 2 } : undefined,
    exercises: [{ exId, sets: [8, 8, 8].map(r => ({ weight: w, reps: r, done: true, target: opts.missed ? { weight: w, reps: r + 3 } : undefined })) }],
  }));
}

test('review: progressing holds, stalled adds sets, declining cuts, within bounds', () => {
  const profile = { ...base, days: [0, 2, 4] };
  const plan = makePlan(profile, 'ppl', { blockStart: new Date(MONDAY - 40 * DAY).toISOString() });
  const run = ws => reviewBlock({ profile, plan, workouts: ws, lookup, exercises: EXERCISES });
  const target = weeklyTargets(profile).chest;
  assert.equal(run(blockHistory('bench_press', [100, 103, 106, 109, 112])).volume.chest.to, target);
  assert.equal(run(blockHistory('bench_press', [100, 100, 100, 100, 100])).volume.chest.to, target + 2);
  assert.equal(run(blockHistory('bench_press', [110, 108, 106, 104, 102])).volume.chest.to, target - 2);
  assert.equal(run(blockHistory('bench_press', [100, 100, 100, 100, 100], { poor: true })).volume.chest.to, target - 2);
  const [lo, hi] = volumeBounds(profile, 'chest');
  const maxed = reviewBlock({ profile, plan: { ...plan, volume: { chest: hi } }, workouts: blockHistory('bench_press', [100, 100, 100, 100, 100]), lookup, exercises: EXERCISES });
  assert.equal(maxed.volume.chest.to, hi);
  const floored = reviewBlock({ profile, plan: { ...plan, volume: { chest: lo } }, workouts: blockHistory('bench_press', [110, 108, 106, 104, 102]), lookup, exercises: EXERCISES });
  assert.equal(floored.volume.chest.to, lo);
});

test('review: stalled core lift gets a variation, accessories rotate within the rules', () => {
  const profile = { ...base, days: [0, 2, 4] };
  const plan = makePlan(profile, 'ppl', { blockStart: new Date(MONDAY - 40 * DAY).toISOString() });
  const core = plan.slots.push[0].chest[0];
  const r = reviewBlock({ profile, plan, workouts: blockHistory(core, [100, 100, 100, 100, 100]), lookup, exercises: EXERCISES });
  const coreSwap = r.swaps.find(s => s.from === core && s.index === 0);
  assert.ok(coreSwap, 'stalled core should get a variation');
  assert.equal(lookup(coreSwap.to).muscle, 'chest');
  assert.equal(!!lookup(coreSwap.to).compound, !!lookup(core).compound);
  for (const s of r.swaps) {
    const ex = lookup(s.to);
    assert.equal(ex.muscle, s.muscle);
    assert.ok(allowedBy(profile.equipment, ex));
    const only = PLAN_DAYS[s.type].only?.[s.muscle];
    if (only) assert.ok(only.includes(primaryRegion(ex)), `${s.to} breaks the ${s.type} region rule`);
  }
  const next = applyReview(plan, r, new Date(MONDAY).toISOString());
  assert.equal(next.slots.push[0].chest[0], coreSwap.to);
  assert.equal(next.blockNo, 2);
  assert.notEqual(plan.slots.push[0].chest[0], coreSwap.to, 'original plan untouched');
});

// ---------- Readiness ----------
test('readiness trims only on rough days, main lifts last', () => {
  const items = [{ sets: 4, main: true }, { sets: 3 }, { sets: 2 }];
  assert.equal(readinessAdjust(items, { sleep: 'good', soreness: 'none', energy: 'high' }).trimmed, 0);
  assert.equal(readinessAdjust(items, { sleep: 'poor', soreness: 'none', energy: 'ok' }).trimmed, 0);
  const two = readinessAdjust(items, { sleep: 'poor', soreness: 'high', energy: 'ok' });
  assert.deepEqual(two.items.map(i => i.sets), [4, 2, 2]);
  const three = readinessAdjust(items, { sleep: 'poor', soreness: 'high', energy: 'low' });
  assert.deepEqual(three.items.map(i => i.sets), [3, 2, 2]);
  assert.ok(three.items.every(i => i.sets >= 2));
});

// ---------- Template swap suggestions ----------
test('swap suggestions: accessories only, same muscle, targets the neglected region', () => {
  const entries = [
    { uid: 'a', exId: 'squat', sets: [{ done: false }] },
    { uid: 'b', exId: 'leg_extension', sets: [{ done: false }] },
    { uid: 'c', exId: 'lying_leg_curl', sets: [{ done: false }] },
    { uid: 'd', exId: 'standing_calf_raise', sets: [{ done: false }] },
  ];
  const neglect = [
    { region: 'ham_hinge', reason: 'No direct work in 14 days' },
    { region: 'soleus', reason: 'No direct work in 20 days' },
  ];
  assert.deepEqual(swapSuggestions({ entries, neglect, exercises: EXERCISES, lookup, timesUsed: 2 }), []);
  const s = swapSuggestions({ entries, neglect, exercises: EXERCISES, lookup, timesUsed: 4 });
  for (const x of s) {
    assert.ok(!lookup(x.from).compound, 'never swaps a compound');
    assert.equal(lookup(x.from).muscle, lookup(x.to).muscle);
    assert.ok((exerciseRegions(lookup(x.to))[x.region] || 0) >= DIRECT);
  }
  // The only calf raise isn't swapped for a soleus-only lift: that would drop the gastrocnemius.
  assert.ok(!s.find(x => x.from === 'standing_calf_raise'));
  // With a second gastrocnemius lift in the workout, the swap is fine.
  const two = [...entries, { uid: 'e', exId: 'db_calf_raise', sets: [{ done: false }] }];
  const s2 = swapSuggestions({ entries: two, neglect, exercises: EXERCISES, lookup, timesUsed: 4 });
  assert.ok(s2.find(x => (x.from === 'standing_calf_raise' || x.from === 'db_calf_raise') && x.region === 'soleus'), JSON.stringify(s2));
  // Every swap leaves the swapped lift's own area covered.
  for (const x of s2) {
    const own = primaryRegion(lookup(x.from));
    const after = two.filter(e => e.exId !== x.from).map(e => e.exId).concat(x.to);
    assert.ok(after.some(id => (exerciseRegions(lookup(id))[own] || 0) >= DIRECT), `${x.from} -> ${x.to} drops ${own}`);
  }
  // Started lifts are left alone.
  const started = entries.map(e => (e.uid === 'd' ? { ...e, sets: [{ done: true }] } : e));
  assert.ok(!swapSuggestions({ entries: [...started, { uid: 'e', exId: 'db_calf_raise', sets: [{ done: true }] }], neglect, exercises: EXERCISES, lookup, timesUsed: 4 }).some(x => x.uid === 'd' || x.uid === 'e'));
});

// ---------- Long run ----------
test('a lifter following a 4-day Upper/Lower plan for 12 weeks keeps every region trained', () => {
  const profile = { ...base, days: [0, 1, 3, 4] };
  let plan = makePlan(profile, 'upper_lower');
  const workouts = [];
  for (let w = 0; w < 12; w++) {
    for (const wd of profile.days) {
      const now = MONDAY + (w * 7 + wd) * DAY;
      const week = planWeek({ profile, plan, workouts, lookup, now });
      const s = week.days[wd].session;
      assert.ok(s, `week ${w} day ${wd}: no session`);
      workouts.push({ id: `w${w}-${wd}`, dayType: 'plan_' + s.type, date: new Date(now).toISOString(), plan: { seq: s.seq },
        exercises: s.items.map(i => ({ exId: i.exId, sets: sets(i.sets) })) });
    }
    if (w % 5 === 4) {
      const r = reviewBlock({ profile, plan, workouts, lookup, exercises: EXERCISES });
      plan = applyReview(plan, r, new Date(MONDAY + (w + 1) * 7 * DAY).toISOString());
    }
  }
  const last2 = regionSets(workouts, lookup, new Date(MONDAY + 10 * 7 * DAY).toISOString());
  const t = regionTargets(10);
  const starved = Object.keys(REGIONS).filter(r => (last2[r] || 0) < t[r] * 0.25);
  assert.deepEqual(starved, [], `regions left behind: ${starved}`);
  const seqs = workouts.map(w => w.plan.seq);
  assert.deepEqual(seqs, seqs.map((_, i) => i), 'rotation stays in order when every day is done');
});

test('the plan for later days doesn\'t shrink as earlier sessions get done', () => {
  const profile = { ...base, days: [0, 1, 3, 4], minutes: 120 };
  const plan = makePlan(profile, 'upper_lower');
  const monday = planWeek({ profile, plan, lookup, now: MONDAY });
  const workouts = [];
  for (const wd of [0, 1]) {
    const s = monday.days[wd].session;
    workouts.push({ id: 'd' + wd, date: new Date(MONDAY + wd * DAY).toISOString(), plan: { seq: s.seq }, exercises: s.items.map(i => ({ exId: i.exId, sets: sets(i.sets) })) });
  }
  const thursday = planWeek({ profile, plan, workouts, lookup, now: MONDAY + 3 * DAY });
  const setsFor = (w, d, m) => (w.days[d].session?.items || []).filter(i => i.muscle === m).reduce((s, i) => s + i.sets, 0);
  for (const m of ['back', 'chest', 'quads', 'hamstrings']) {
    for (const d of [3, 4]) {
      assert.ok(Math.abs(setsFor(thursday, d, m) - setsFor(monday, d, m)) <= 1, `${m} on day ${d}: ${setsFor(monday, d, m)} on Monday's view, ${setsFor(thursday, d, m)} on Thursday's`);
    }
  }
});

test('more time means more weekly volume, never past the level maximum', () => {
  for (const level of ['beginner', 'intermediate', 'advanced']) {
    for (const days of [[0, 3], [0, 2, 4], [0, 1, 3, 4], [0, 1, 2, 3, 4, 5]]) {
      let prev = null;
      for (const minutes of [30, 45, 60, 75, 90, 120]) {
        const t = weeklyTargets({ ...base, level, days, minutes, priority: ['chest'] });
        for (const m of Object.keys(MUSCLES)) {
          assert.ok(t[m] <= volumeBounds({ ...base, level, priority: ['chest'] }, m)[1], `${level} ${minutes}min ${m}: ${t[m]} over max`);
          if (prev) assert.ok(t[m] >= prev[m], `${level} ${days.length}d: ${m} dropped from ${prev[m]} to ${t[m]} with more time`);
        }
        prev = t;
      }
    }
  }
  // Short sessions keep the level's base volume (unchanged from before).
  assert.equal(weeklyTargets({ ...base, level: 'intermediate', days: [0, 1, 3, 4], minutes: 60 }).chest, 14);
  // A lot of time reaches the maximum.
  assert.equal(weeklyTargets({ ...base, level: 'intermediate', days: [0, 1, 2, 3, 4, 5], minutes: 120 }).chest, 20);
  // Block-review overrides still win.
  assert.equal(weeklyTargets({ ...base, level: 'intermediate', days: [0, 1, 2, 3, 4, 5], minutes: 120 }, { chest: 16 }).chest, 16);
});

test('2-hour sessions use the extra time and still fit it', () => {
  const profile = { ...base, days: [0, 1, 2, 3, 4, 5], minutes: 120 };
  const short = { ...profile, minutes: 60 };
  const long = planWeek({ profile, plan: makePlan(profile, 'upper_lower'), lookup, now: MONDAY });
  const normal = planWeek({ profile: short, plan: makePlan(short, 'upper_lower'), lookup, now: MONDAY });
  const sets = w => w.days.filter(d => d.kind === 'train').reduce((a, d) => a + d.session.items.reduce((b, i) => b + i.sets, 0), 0);
  assert.ok(sets(long) > sets(normal) * 1.2, `${sets(long)} vs ${sets(normal)}`);
  for (const d of long.days.filter(x => x.kind === 'train')) assert.ok(d.session.estMinutes <= 120, `${d.session.name} ${d.session.estMinutes} min`);
});
