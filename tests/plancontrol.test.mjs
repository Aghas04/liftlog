import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, MUSCLES, primaryRegion, allowedBy } from '../js/data.js';
import { PLAN_DAYS } from '../js/planner.js';
import { weekKey } from '../js/insights.js';
import {
  createPlan, blockedLifts, maintainPlan, currentWeek, todayOf, nextTraining, pausePlan, resumePlan, setWeekDays,
  editSession, unexclude, dropFromBlock, sessionEntries, runReview, approveReview, postponeReview, reviewDue,
  blockWeek, replacementFor, swapOptions, ownWorkouts, STRENGTH_ZONE, LEARN_AFTER, BREAK_DAYS,
} from '../js/plancontrol.js';

const lookup = id => EXERCISES.find(e => e.id === id);
const DAY = 86400000;
const MONDAY = new Date(2026, 10, 2, 8, 0, 0).getTime();
const profile = { days: [0, 1, 3, 4], minutes: 75, level: 'intermediate', goal: 'muscle', priority: [], equipment: 'gym', activities: [], avoid: [] };
const ctx = { exercises: EXERCISES, lookup, blocked: [], usage: {} };
const fresh = (p = profile, splitId = 'upper_lower', now = MONDAY) => createPlan({ profile: p, splitId, exercises: EXERCISES, usage: {}, workouts: [], lookup, now });
const allSlotIds = plan => Object.values(plan.slots).flatMap(vs => vs.flatMap(v => Object.values(v).flat()));

// Log a planned session as a finished workout, hitting every target.
function doSession(plan, day, t, extra = {}) {
  return {
    id: 'w' + t, date: new Date(t).toISOString(), dayType: 'plan_' + day.session.type,
    plan: { id: plan.id, seq: day.session.seq },
    exercises: day.session.items.map(it => ({ exId: it.exId, sets: Array.from({ length: it.sets }, () => ({ weight: 100, reps: 10, done: true, target: { weight: 100, reps: 10 } })) })),
    ...extra,
  };
}

test('createPlan builds a full block with an id and block length', () => {
  const plan = fresh();
  assert.ok(plan.id && plan.slots.upper && plan.slots.lower);
  assert.equal(plan.blockWeeks, 5);
  assert.equal(plan.blockNo, 1);
  assert.equal(new Date(plan.blockStart).getTime(), weekKey(MONDAY));
  assert.equal(createPlan({ profile: { ...profile, level: 'beginner' }, splitId: 'full_body', exercises: EXERCISES, lookup, workouts: [], now: MONDAY }).blockWeeks, 6);
  assert.throws(() => createPlan({ profile, splitId: 'nope', exercises: EXERCISES, lookup, workouts: [] }));
});

test('blocked lifts never appear in the plan: pain flags, avoid list, learned exclusions', () => {
  const avoid = ['squat', 'deadlift'];
  const pain = { bench_press: '2026-11-01' };
  const p = { ...profile, avoid };
  const blocked = blockedLifts({ painFlags: pain }, { profile: p, excluded: ['lat_pulldown'] });
  assert.deepEqual(blocked.sort(), ['bench_press', 'deadlift', 'lat_pulldown', 'squat']);
  const plan = createPlan({ profile: p, splitId: 'upper_lower', exercises: EXERCISES, usage: {}, workouts: [], lookup, now: MONDAY, blocked });
  const ids = allSlotIds(plan);
  for (const b of blocked) assert.ok(!ids.includes(b), `${b} in plan`);
});

test('planned sessions advance the rotation and the week fills in', () => {
  let plan = fresh();
  let workouts = [];
  const seen = [];
  for (let d = 0; d < 7; d++) {
    const t = MONDAY + d * DAY;
    const week = currentWeek(plan, workouts, lookup, t);
    const today = todayOf(week, t);
    if (today.kind === 'train') { seen.push(today.session.seq); workouts.push(doSession(plan, today, t)); }
  }
  assert.deepEqual(seen, [0, 1, 2, 3]);
  const week = currentWeek(plan, workouts, lookup, MONDAY + 6 * DAY);
  assert.equal(week.days.filter(x => x.kind === 'done').length, 4);
  // Next week starts at seq 4.
  const next = currentWeek(plan, workouts, lookup, MONDAY + 7 * DAY);
  assert.equal(todayOf(next, MONDAY + 7 * DAY).session.seq, 4);
});

test("an old plan's workouts don't advance a new plan", () => {
  const old = fresh();
  const wk = currentWeek(old, [], lookup, MONDAY);
  const workouts = [doSession(old, todayOf(wk, MONDAY), MONDAY)];
  const plan = fresh(profile, 'upper_lower', MONDAY + DAY);
  assert.notEqual(plan.id, old.id);
  const week = currentWeek(plan, workouts, lookup, MONDAY + DAY);
  assert.equal(todayOf(week, MONDAY + DAY).session.seq, 0);
  assert.equal(ownWorkouts(plan, workouts)[0].plan, undefined);
  // History itself is untouched.
  assert.equal(workouts[0].plan.id, old.id);
});

test('nextTraining finds today or the next training day', () => {
  const plan = fresh();
  const tue = MONDAY + DAY;
  const wed = MONDAY + 2 * DAY;
  const week = currentWeek(plan, [], lookup, wed);
  assert.equal(todayOf(week, wed).kind, 'rest');
  assert.equal(nextTraining(week, wed).weekday, 3);
  assert.equal(nextTraining(currentWeek(plan, [], lookup, tue), tue).weekday, 1);
});

test('pause: nothing planned; resuming after a week eases back in and shifts the block', () => {
  let plan = pausePlan(fresh(), new Date(MONDAY + 14 * DAY).toISOString(), MONDAY);
  const wk = currentWeek(plan, [], lookup, MONDAY + 3 * DAY);
  assert.ok(wk.days.every(d => d.kind !== 'train'), 'nothing planned while paused');
  assert.ok(wk.days.filter(d => d.weekday >= 3).every(d => d.kind === 'paused'));
  assert.equal(reviewDue(plan, MONDAY + 3 * DAY), false);
  const later = MONDAY + 15 * DAY;
  const r = maintainPlan(plan, [], later);
  assert.ok(r.changed && r.events.includes('resumed'));
  assert.equal(r.plan.pausedUntil, null);
  assert.equal(r.plan.easeWeek, String(weekKey(later)));
  assert.equal(blockWeek(r.plan, later), 0, 'paused weeks do not count toward the block');
  const week = currentWeek(r.plan, [], lookup, later);
  assert.ok(week.notes.some(n => /Easing back/.test(n)));
  // Resume early by hand.
  const early = resumePlan(pausePlan(fresh(), new Date(MONDAY + 30 * DAY).toISOString(), MONDAY), MONDAY + 2 * DAY);
  assert.equal(early.pausedUntil, null);
  assert.equal(early.easeWeek, null, 'a 2-day pause does not ease');
});

test('a long break eases the week once, not every week', () => {
  const plan = fresh();
  const last = { id: 'x', date: new Date(MONDAY).toISOString(), dayType: 'upper', exercises: [] };
  const t1 = MONDAY + (BREAK_DAYS + 1) * DAY;
  const r1 = maintainPlan(plan, [last], t1);
  assert.ok(r1.events.includes('eased'));
  assert.equal(r1.plan.easeWeek, String(weekKey(t1)));
  const r2 = maintainPlan(r1.plan, [last], t1 + 7 * DAY);
  assert.ok(!r2.events.includes('eased'), 'same break is only eased once');
  const r3 = maintainPlan(plan, [last], MONDAY + 5 * DAY);
  assert.ok(!r3.changed, 'short gaps change nothing');
});

test('maintainPlan drops past week overrides and spent session edits', () => {
  let plan = fresh();
  plan = setWeekDays(plan, [0, 2, 4, 5], MONDAY);
  const id = plan.slots.upper[0].chest[0];
  plan = editSession(plan, { seq: 0, type: 'upper', slot: 0, action: 'remove', from: id, scope: 'week' }, ctx).plan;
  const wk = currentWeek(plan, [], lookup, MONDAY);
  const w = doSession(plan, todayOf(wk, MONDAY), MONDAY);
  const r = maintainPlan(plan, [w], MONDAY + 8 * DAY);
  assert.deepEqual(r.plan.weekDays, {});
  assert.deepEqual(r.plan.weekEdits, {});
});

test('changing days for this week only', () => {
  let plan = fresh();
  plan = setWeekDays(plan, [1, 2, 5, 6], MONDAY);
  const week = currentWeek(plan, [], lookup, MONDAY);
  assert.deepEqual(week.days.filter(d => d.kind === 'train').map(d => d.weekday), [1, 2, 5, 6]);
  const nextWeek = currentWeek(plan, [], lookup, MONDAY + 7 * DAY);
  assert.deepEqual(nextWeek.days.filter(d => d.kind === 'train').map(d => d.weekday), [0, 1, 3, 4]);
  // Setting the usual days clears the override.
  assert.deepEqual(setWeekDays(plan, [0, 1, 3, 4], MONDAY).weekDays, {});
});

test('fewer days this week: rotation continues, nothing lost from the order', () => {
  let plan = setWeekDays(fresh(), [0, 3], MONDAY);
  const week = currentWeek(plan, [], lookup, MONDAY);
  const train = week.days.filter(d => d.kind === 'train');
  assert.equal(train.length, 2);
  assert.deepEqual(train.map(d => d.session.seq).sort(), [0, 1]);
});

test('week edit: swap and remove change only that session', () => {
  let plan = fresh();
  const week = currentWeek(plan, [], lookup, MONDAY);
  const day = todayOf(week, MONDAY);
  const target = day.session.items.find(i => !i.core);
  const opts = swapOptions(target.exId, { plan, ...ctx, type: day.session.type, exclude: day.session.items.map(i => i.exId) });
  assert.ok(opts.length);
  assert.ok(opts.every(x => x.muscle === lookup(target.exId).muscle && allowedBy('gym', x)));
  plan = editSession(plan, { seq: day.session.seq, type: day.session.type, slot: day.session.slot, action: 'swap', from: target.exId, to: opts[0].id, scope: 'week' }, ctx).plan;
  let after = todayOf(currentWeek(plan, [], lookup, MONDAY), MONDAY).session;
  assert.ok(after.items.some(i => i.exId === opts[0].id));
  assert.ok(!after.items.some(i => i.exId === target.exId));
  // Swapping the swapped-in lift again points the original at the newest choice.
  plan = editSession(plan, { seq: day.session.seq, type: day.session.type, slot: day.session.slot, action: 'swap', from: opts[0].id, to: opts[1].id, scope: 'week' }, ctx).plan;
  assert.deepEqual(plan.weekEdits[day.session.seq].replace, { [target.exId]: opts[1].id });
  // The block's slots are untouched by week edits.
  assert.ok(allSlotIds(plan).includes(target.exId));
});

test('block edit changes the A/B/C slot for the rest of the block', () => {
  let plan = fresh();
  const variant = plan.slots.upper[0];
  const from = variant.biceps[1] || variant.biceps[0];
  const opts = swapOptions(from, { plan, ...ctx, type: 'upper', exclude: Object.values(variant).flat() });
  plan = editSession(plan, { seq: 0, type: 'upper', slot: 0, action: 'swap', from, to: opts[0].id, scope: 'block' }, ctx).plan;
  assert.ok(plan.slots.upper[0].biceps.includes(opts[0].id));
  assert.ok(!plan.slots.upper[0].biceps.includes(from));
});

test(`learning: a lift edited away ${LEARN_AFTER} times is excluded and replaced everywhere`, () => {
  let plan = fresh();
  const variant = plan.slots.upper[0];
  const from = variant.triceps[1] || variant.triceps[0];
  const r1 = editSession(plan, { seq: 0, type: 'upper', slot: 0, action: 'remove', from, scope: 'week' }, ctx);
  assert.equal(r1.learned, null);
  const r2 = editSession(r1.plan, { seq: 2, type: 'upper', slot: 1, action: 'remove', from, scope: 'week' }, ctx);
  assert.equal(r2.learned, from);
  assert.ok(r2.plan.excluded.includes(from));
  assert.ok(!allSlotIds(r2.plan).includes(from), 'gone from every slot');
  // Triceps still get trained.
  for (const v of r2.plan.slots.upper) assert.ok((v.triceps || []).length >= 1);
  assert.ok(blockedLifts({}, r2.plan).includes(from));
  // Undo the learning.
  const back = unexclude(r2.plan, from);
  assert.ok(!back.excluded.includes(from));
  assert.equal(back.edits[from], undefined);
});

test('learning via swaps puts the chosen lift in', () => {
  let plan = fresh();
  const from = plan.slots.lower[0].calves[0];
  const to = EXERCISES.find(e => e.muscle === 'calves' && e.id !== from).id;
  plan = editSession(plan, { seq: 1, type: 'lower', slot: 0, action: 'swap', from, to, scope: 'week' }, ctx).plan;
  const r = editSession(plan, { seq: 3, type: 'lower', slot: 1, action: 'swap', from, to, scope: 'week' }, ctx);
  assert.equal(r.learned, from);
  assert.ok(allSlotIds(r.plan).includes(to));
  assert.ok(!allSlotIds(r.plan).includes(from));
});

test("'This hurt': dropFromBlock replaces the lift for the same region", () => {
  const plan = fresh();
  const id = plan.slots.upper[0].chest[0];
  const region = primaryRegion(lookup(id));
  const next = dropFromBlock(plan, id, { ...ctx, blocked: [id] });
  assert.ok(!allSlotIds(next).includes(id));
  const repl = replacementFor(id, { plan, ...ctx, blocked: [id] });
  assert.ok(repl && repl.muscle === 'chest');
  assert.ok(next.slots.upper[0].chest.includes(repl.id));
  assert.equal(primaryRegion(repl), region);
});

test('replacements respect equipment, day regions and the hard flag', () => {
  const p = { ...profile, equipment: 'dumbbells' };
  const plan = createPlan({ profile: p, splitId: 'ppl', exercises: EXERCISES, workouts: [], lookup, now: MONDAY });
  for (const [type, variants] of Object.entries(plan.slots)) {
    for (const v of variants) {
      for (const [m, list] of Object.entries(v)) {
        for (const id of list) {
          const r = replacementFor(id, { plan, ...ctx, type });
          if (!r) continue;
          assert.ok(allowedBy('dumbbells', r), `${r.id} needs ${r.equipment}`);
          assert.ok(!r.hard, `${r.id} is advanced-only`);
          const only = PLAN_DAYS[type].only?.[m];
          if (only) assert.ok(only.includes(primaryRegion(r)), `${r.id} region not allowed on ${type}`);
        }
      }
    }
  }
});

test('sessionEntries: strength main lifts get 3-6 reps, supersets become groups', () => {
  const sp = { ...profile, goal: 'strength', minutes: 30 };
  const plan = fresh(sp);
  const day = todayOf(currentWeek(plan, [], lookup, MONDAY), MONDAY);
  const entries = sessionEntries(day.session);
  assert.equal(entries.length, day.session.items.length);
  const mains = entries.filter(e => e.zone);
  assert.ok(mains.length >= 1 && mains.length <= 2);
  for (const e of mains) assert.deepEqual(e.zone, STRENGTH_ZONE);
  for (const e of entries.filter(x => !x.zone)) assert.ok(!day.session.items.find(i => i.exId === e.exId).main);
  const muscle = sessionEntries(todayOf(currentWeek(fresh(), [], lookup, MONDAY), MONDAY).session);
  assert.ok(muscle.every(e => !e.zone), 'muscle goal never gets the strength zone');
  // Supersets: grouped pairs.
  const groups = {};
  for (const e of entries) if (e.group) (groups[e.group] ||= []).push(e);
  for (const g of Object.values(groups)) assert.equal(g.length, 2);
});

test('review is due after the block, can be postponed a week, and approval starts block 2', () => {
  let plan = fresh();
  assert.equal(reviewDue(plan, MONDAY + 3 * 7 * DAY), false);
  const end = MONDAY + 5 * 7 * DAY;
  assert.equal(reviewDue(plan, end), true);
  const later = postponeReview(plan, end);
  assert.equal(reviewDue(later, end + DAY), false);
  assert.equal(reviewDue(later, end + 7 * DAY), true);

  // Five weeks of sessions, stalled on everything.
  let workouts = [];
  for (let d = 0; d < 35; d++) {
    const t = MONDAY + d * DAY;
    const today = todayOf(currentWeek(plan, workouts, lookup, t), t);
    if (today.kind === 'train') workouts.push(doSession(plan, today, t));
  }
  const review = runReview(plan, { workouts, lookup, bwOn: () => 180, exercises: EXERCISES, usage: {}, blocked: [] });
  assert.ok(Object.keys(review.volume).length === Object.keys(MUSCLES).length);
  const ups = Object.values(review.volume).filter(v => v.to > v.from).length;
  assert.ok(ups > 0, 'stalled but recovering muscles get more volume');
  // Reject the first swap and one volume change.
  const someM = Object.keys(review.volume).find(m => review.volume[m].to !== review.volume[m].from);
  const accepted = { volume: { [someM]: false }, swaps: review.swaps.map((_, i) => i !== 0) };
  const next = approveReview(plan, review, accepted, end);
  assert.equal(next.blockNo, 2);
  assert.equal(new Date(next.blockStart).getTime(), weekKey(end));
  assert.equal(next.volume[someM], review.volume[someM].from, 'rejected change kept the old volume');
  assert.equal(reviewDue(next, end), false);
  if (review.swaps.length) {
    const s0 = review.swaps[0];
    assert.equal(next.slots[s0.type][s0.slot][s0.muscle][s0.index], plan.slots[s0.type][s0.slot][s0.muscle][s0.index], 'rejected swap not applied');
  }
  // The new block keeps planning valid weeks.
  const wk = currentWeek(next, workouts, lookup, end);
  assert.ok(wk.days.some(d => d.kind === 'train'));
});

test('strength plan: 12-week run keeps main lifts in 3-6 and never repeats exercises in a session', () => {
  const sp = { ...profile, goal: 'strength' };
  let plan = fresh(sp);
  let workouts = [];
  for (let d = 0; d < 84; d++) {
    const t = MONDAY + d * DAY;
    const m = maintainPlan(plan, workouts, t);
    plan = m.plan;
    if (reviewDue(plan, t)) {
      const review = runReview(plan, { workouts, lookup, bwOn: () => 180, exercises: EXERCISES, usage: {}, blocked: [] });
      plan = approveReview(plan, review, null, t);
    }
    const today = todayOf(currentWeek(plan, workouts, lookup, t), t);
    if (today.kind !== 'train') continue;
    const ids = today.session.items.map(i => i.exId);
    assert.equal(new Set(ids).size, ids.length);
    for (const e of sessionEntries(today.session)) if (e.zone) assert.deepEqual(e.zone, [3, 6]);
    workouts.push(doSession(plan, today, t));
  }
  assert.ok(plan.blockNo >= 2, 'at least one block review happened');
  assert.ok(workouts.length >= 44, `${workouts.length} sessions in 12 weeks`);
});

test('a plan created mid-week does not mark earlier days missed or cram the week', () => {
  const friday = MONDAY + 4 * DAY;
  const p6 = { ...profile, days: [0, 1, 2, 3, 4, 5] };
  const plan = fresh(p6, 'upper_lower', friday);
  const week = currentWeek(plan, [], lookup, friday);
  assert.ok(!week.days.some(d => d.kind === 'missed'), 'no missed days before the plan existed');
  const train = week.days.filter(d => d.kind === 'train');
  assert.equal(train.length, 2);
  // Per-session size matches a normal full week's sessions.
  const full = currentWeek(plan, [], lookup, MONDAY + 7 * DAY).days.filter(d => d.kind === 'train');
  const avg = list => list.reduce((s, d) => s + d.session.items.reduce((a, i) => a + i.sets, 0), 0) / list.length;
  assert.ok(avg(train) <= avg(full) * 1.25, `partial week sessions ${avg(train)} vs normal ${avg(full)}`);
  // The next week is a normal week.
  assert.ok(!currentWeek(plan, [], lookup, MONDAY + 7 * DAY).notes.some(n => /mid-week/.test(n)));
});

test('resuming mid-week plans from the resume day', () => {
  const p = pausePlan(fresh(), new Date(MONDAY + 3 * DAY).toISOString(), MONDAY - 14 * DAY);
  const thu = MONDAY + 3 * DAY + 3600000;
  const r = maintainPlan(p, [], thu);
  const week = currentWeek(r.plan, [], lookup, thu);
  assert.ok(!week.days.some(d => d.kind === 'missed'));
  assert.deepEqual(week.days.filter(d => d.kind === 'train').map(d => d.weekday), [3, 4]);
});

test('the setup avoid list is enforced even when the caller passes no blocked list', () => {
  const plan = fresh({ ...profile, avoid: ['deadlift', 'squat'] });
  const ids = allSlotIds(plan);
  assert.ok(!ids.includes('deadlift') && !ids.includes('squat'));
});

test('small muscles always get some direct work, even with lots of indirect work', () => {
  for (const splitId of ['upper_lower', 'ppl', 'full_body', 'bro3', 'arnold']) {
    const days = splitId === 'full_body' ? [0, 2, 4] : [0, 1, 2, 3, 4, 5];
    const p = { ...profile, days };
    const plan = createPlan({ profile: p, splitId, exercises: EXERCISES, workouts: [], lookup, now: MONDAY - 7 * DAY });
    const week = currentWeek(plan, [], lookup, MONDAY);
    const direct = {};
    for (const d of week.days.filter(x => x.kind === 'train')) for (const it of d.session.items) direct[it.muscle] = (direct[it.muscle] || 0) + it.sets;
    for (const m of ['triceps', 'biceps']) assert.ok((direct[m] || 0) >= Math.ceil(week.targets[m] * 0.4), `${splitId}: ${m} direct ${direct[m] || 0} of ${week.targets[m]}`);
  }
});

test('pausing mid-week keeps the days already trained', () => {
  let plan = fresh();
  const wk = currentWeek(plan, [], lookup, MONDAY);
  const w = doSession(plan, todayOf(wk, MONDAY), MONDAY);
  plan = pausePlan(plan, new Date(MONDAY + 10 * DAY).toISOString(), MONDAY + DAY);
  const week = currentWeek(plan, [w], lookup, MONDAY + DAY);
  assert.equal(week.days[0].kind, 'done');
  assert.equal(week.days[0].workoutId, w.id);
  assert.ok(week.days.slice(1).every(d => d.kind === 'paused'));
});

test('block review keeps most of the block: at most one accessory rotates per muscle per session', () => {
  const plan = fresh();
  const workouts = [];
  for (let d = 0; d < 35; d++) {
    const t = MONDAY + d * DAY;
    const today = todayOf(currentWeek(plan, workouts, lookup, t), t);
    if (today.kind === 'train') workouts.push(doSession(plan, today, t));
  }
  const review = runReview(plan, { workouts, lookup, bwOn: () => 180, exercises: EXERCISES, usage: {}, blocked: [] });
  const per = {};
  for (const s of review.swaps) if (s.index > 0 && !/Rotating in/.test(s.reason)) {
    const k = `${s.type}${s.slot}${s.muscle}`;
    per[k] = (per[k] || 0) + 1;
  }
  for (const [k, n] of Object.entries(per)) assert.ok(n <= 1, `${k}: ${n} accessory rotations`);
  const accessoryCount = Object.values(plan.slots).flatMap(vs => vs.flatMap(v => Object.values(v).map(l => l.length - 1))).reduce((a, b) => a + b, 0);
  assert.ok(review.swaps.length < accessoryCount, 'not everything rotates');
});

test('block review keeps lifts that are still progressing', () => {
  const plan = fresh();
  const workouts = [];
  for (let d = 0; d < 35; d++) {
    const t = MONDAY + d * DAY;
    const today = todayOf(currentWeek(plan, workouts, lookup, t), t);
    if (today.kind !== 'train') continue;
    const w = doSession(plan, today, t);
    for (const e of w.exercises) for (const s of e.sets) { s.weight = 100 + d * 2; s.target.weight = s.weight; }
    workouts.push(w);
  }
  const review = runReview(plan, { workouts, lookup, bwOn: () => 180, exercises: EXERCISES, usage: {}, blocked: [] });
  assert.ok(!review.swaps.some(s => /stalled/.test(s.reason)), review.swaps.map(s => s.reason).join('; '));
  assert.ok(Object.values(review.volume).every(v => v.to <= v.from), 'progressing muscles do not get more volume');
});
