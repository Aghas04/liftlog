// Plan lifecycle on top of planner.js: creating a plan, keeping it current
// (pauses, breaks, block ends), learning from edits, and turning a planned
// session into workout entries. Pure functions: they take and return plain
// objects, the app does the saving.
import { REGIONS, exerciseRegions, primaryRegion, allowedBy } from './data.js';
import { buildBlock, planWeek, reviewBlock, applyReview, rotationOffsetFor, indirectByMuscle, PLAN_DAYS, MAJOR, splitById } from './planner.js';
import { workingSets } from './engine.js';
import { DIRECT, weekKey } from './insights.js';

const DAY = 86400000;
export const STRENGTH_ZONE = [3, 6];
// Removing or swapping away the same lift this many times keeps it out of the plan.
export const LEARN_AFTER = 2;
// A break this long (no workouts) eases the next week back in.
export const BREAK_DAYS = 14;

/** Block length in weeks: shorter for advanced lifters, who adapt faster. */
export const blockWeeksFor = level => (level === 'beginner' ? 6 : level === 'advanced' ? 4 : 5);

/** Lifts kept out of plans: 'This hurt' reports, the setup avoid list, and learned removals. */
export function blockedLifts(settings = {}, plan = null) {
  const out = new Set(Object.keys(settings.painFlags || {}));
  for (const id of plan?.profile?.avoid || []) out.add(id);
  for (const id of plan?.excluded || []) out.add(id);
  return [...out];
}

/** A fresh plan from the setup answers. */
/**
 * Exercises a plan may pick: common versions, plus any version you've used or
 * starred (so a plan never asks for a machine you've never touched). Starred
 * lifts also count as used a few times, so they win ties.
 */
export function planPool(exercises, { usage = {}, stars = [] } = {}) {
  const starred = new Set(stars);
  // Custom lifts only when you've actually done them (their coverage is a guess).
  const pool = exercises.filter(e => e.common || usage[e.id] || starred.has(e.id));
  const rank = { ...usage };
  for (const id of starred) rank[id] = (rank[id] || 0) + 5;
  return { exercises: pool, usage: rank };
}

// fresh: start new — ignore past workouts when building the plan (starting
// day, neglected areas, favorite lifts, breaks). Weight suggestions still use history.
export function createPlan({ profile, splitId, exercises, usage, workouts, lookup, now = Date.now(), blocked = [], seed, fresh = false }) {
  const split = splitById(splitId);
  if (!split) throw new Error(`Unknown split ${splitId}`);
  if (fresh) { workouts = []; usage = {}; }
  const s = seed ?? (Math.floor(now / DAY) % 100000);
  // The setup's avoid list always applies, whatever the caller passes.
  const allBlocked = [...new Set([...blocked, ...(profile.avoid || [])])];
  const slots = buildBlock({ profile, splitId, exercises, usage, workouts, lookup, now, seed: s, blocked: allBlocked });
  return {
    id: 'p' + now.toString(36), version: 1, profile, splitId, slots, volume: {},
    blockStart: new Date(weekKey(now)).toISOString(), blockNo: 1, blockWeeks: blockWeeksFor(profile.level),
    seed: s, createdAt: new Date(now).toISOString(),
    // Start with the day type you're freshest for.
    rotationOffset: rotationOffsetFor(split, workouts || [], lookup, now),
    ...(fresh ? { fresh: true } : {}),
    weekDays: {}, weekEdits: {}, edits: {}, excluded: [],
    pausedUntil: null, easeWeek: null, breakHandled: null, reviewDismissed: null,
  };
}

/** Weeks since the block started (0 in the first week). */
export const blockWeek = (plan, now = Date.now()) => Math.floor((weekKey(now) - weekKey(new Date(plan.blockStart).getTime())) / (7 * DAY));

/** The block review is due once the block's weeks are up (and not paused). */
export function reviewDue(plan, now = Date.now()) {
  if (!plan || isPaused(plan, now)) return false;
  if (blockWeek(plan, now) < (plan.blockWeeks || 5)) return false;
  return plan.reviewDismissed !== String(weekKey(now));
}

export const isPaused = (plan, now = Date.now()) => !!plan?.pausedUntil && new Date(plan.pausedUntil).getTime() > now;

/**
 * Keep a plan current. Returns { plan, changed, events } where events are
 * short messages for the app ('resumed', 'eased').
 * - An ended pause clears itself; a pause of a week or more eases the next week in.
 * - A break of BREAK_DAYS without workouts eases the current week in (once per break).
 */
export function maintainPlan(plan, workouts, now = Date.now(), lookup = null) {
  if (!plan) return { plan, changed: false, events: [] };
  const next = { ...plan };
  const events = [];
  // Plans made before the rotation picked its starting day: choose it now,
  // as long as no planned session has been done yet.
  if (next.rotationOffset == null && lookup && !ownWorkouts(next, workouts).some(w => w.plan)) {
    next.rotationOffset = rotationOffsetFor(splitById(next.splitId), workouts.filter(w => w.date <= next.createdAt), lookup, new Date(next.createdAt).getTime());
  }
  const wk = String(weekKey(now));
  if (next.pausedUntil && new Date(next.pausedUntil).getTime() <= now) {
    const pausedFor = (new Date(next.pausedUntil).getTime() - new Date(next.pausedAt || next.pausedUntil).getTime()) / DAY;
    // Plan again from the day the pause ended (earlier days aren't missed).
    next.activeFrom = next.pausedUntil;
    next.pausedUntil = null;
    delete next.pausedAt;
    if (pausedFor >= 7) next.easeWeek = wk;
    // The block clock doesn't run during a pause.
    if (pausedFor >= 7) next.blockStart = new Date(new Date(next.blockStart).getTime() + Math.floor(pausedFor / 7) * 7 * DAY).toISOString();
    events.push('resumed');
  }
  if (!isPaused(next, now)) {
    const seen = ownWorkouts(next, workouts);
    const last = seen.length ? Math.max(...seen.map(w => new Date(w.date).getTime())) : null;
    const since = last ?? new Date(next.createdAt).getTime();
    const gap = (now - since) / DAY;
    if (gap >= BREAK_DAYS && next.breakHandled !== String(since)) {
      next.easeWeek = wk;
      next.breakHandled = String(since);
      events.push('eased');
    }
  }
  // Drop week-specific overrides from past weeks.
  const wdays = {};
  for (const [k, v] of Object.entries(next.weekDays || {})) if (+k >= +wk) wdays[k] = v;
  next.weekDays = wdays;
  // One-off session edits are spent once that session is done.
  const doneSeqs = new Set(ownWorkouts(next, workouts).filter(w => w.plan).map(w => String(w.plan.seq)));
  const wedits = {};
  for (const [k, v] of Object.entries(next.weekEdits || {})) if (!doneSeqs.has(String(k))) wedits[k] = v;
  next.weekEdits = wedits;
  const changed = JSON.stringify(next) !== JSON.stringify(plan);
  return { plan: changed ? next : plan, changed, events };
}

/** The current week's plan (planner.planWeek with the plan's own profile). */
export function currentWeek(plan, workouts, lookup, now = Date.now(), secPerSet = 130) {
  return planWeek({ profile: plan.profile, plan, workouts: ownWorkouts(plan, workouts), lookup, now, secPerSet });
}

// Workouts from an earlier plan keep their history but don't advance this
// plan's rotation (their sequence numbers belong to the old plan).
export function ownWorkouts(plan, workouts) {
  // A fresh plan doesn't look at anything from before it was made.
  if (plan.fresh) workouts = workouts.filter(w => w.date >= plan.createdAt);
  return workouts.map(w => (w.plan && w.plan.id !== plan.id ? { ...w, plan: undefined } : w));
}

/**
 * This week's days plus the next week's up to 6 days past today, so the plan
 * always shows a full week ahead. Next week is a projection: it assumes this
 * week's remaining sessions get done, and shifts if days are missed or moved.
 * Returns { days: [{ ...day, week: 0 | 1 }], todayIndex, thisWeek, nextWeek }.
 */
export function upcomingDays(plan, workouts, lookup, now = Date.now(), secPerSet = 130) {
  const own = ownWorkouts(plan, workouts);
  const thisWeek = planWeek({ profile: plan.profile, plan, workouts: own, lookup, now, secPerSet });
  // Calendar math, not +7 days of ms, so DST changes can't land on the wrong week.
  const next = new Date(thisWeek.weekStart);
  next.setDate(next.getDate() + 7);
  next.setHours(0, 1, 0, 0);
  const assumed = thisWeek.days.filter(d => d.kind === 'train').map(d => ({
    id: `assumed-${d.session.seq}`, date: new Date(d.date + 'T12:00:00').toISOString(), plan: { id: plan.id, seq: d.session.seq }, exercises: [],
  }));
  const nextWeek = planWeek({ profile: plan.profile, plan, workouts: [...own, ...assumed], lookup, now: next.getTime(), secPerSet });
  const todayIndex = (new Date(now).getDay() + 6) % 7;
  const days = [...thisWeek.days.map(d => ({ ...d, week: 0 })), ...nextWeek.days.slice(0, todayIndex).map(d => ({ ...d, week: 1 }))];
  return { days, todayIndex, thisWeek, nextWeek };
}

/**
 * Sets per muscle for one calendar week (Mon-Sun): done in any workout so far,
 * plus what's still planned, against the usual weekly goal. Counted the way
 * the planner counts: each set for its own muscle, and small muscles also get
 * half credit for indirect work from bigger lifts.
 * Returns { [muscle]: { done, planned, goal } }.
 */
export function weekVolume(week, workouts, lookup) {
  const out = {};
  for (const [m, g] of Object.entries(week.goals || {})) if (g > 0) out[m] = { done: 0, planned: 0, goal: g };
  const add = (m, key, v) => { (out[m] ||= { done: 0, planned: 0, goal: 0 })[key] += v; };
  const credit = (exId, n, key) => {
    const ex = lookup(exId);
    add(ex.muscle, key, n);
    for (const [m, w] of Object.entries(indirectByMuscle(ex))) if (!MAJOR.includes(m)) add(m, key, w * n);
  };
  const end = new Date(week.weekStart);
  end.setDate(end.getDate() + 7);
  for (const w of workouts) {
    const t = new Date(w.date).getTime();
    if (t < week.weekStart || t >= end.getTime()) continue;
    for (const e of w.exercises) { const n = workingSets(e).length; if (n) credit(e.exId, n, 'done'); }
  }
  for (const d of week.days) if (d.kind === 'train') for (const it of d.session.items) credit(it.exId, it.sets, 'planned');
  for (const v of Object.values(out)) { v.done = Math.round(v.done); v.planned = Math.round(v.planned); }
  return out;
}

/** Today's day in the week plan, or null. */
export function todayOf(week, now = Date.now()) {
  const i = (new Date(now).getDay() + 6) % 7;
  return week.days[i];
}

/** The next training day from today on (today included), or null. */
export function nextTraining(week, now = Date.now()) {
  const i = (new Date(now).getDay() + 6) % 7;
  return week.days.slice(i).find(d => d.kind === 'train') || null;
}

/**
 * Pause the plan until a date (ISO), e.g. vacation or illness.
 */
export function pausePlan(plan, untilIso, now = Date.now()) {
  return { ...plan, pausedUntil: untilIso, pausedAt: new Date(now).toISOString() };
}

export function resumePlan(plan, now = Date.now()) {
  return maintainPlan({ ...plan, pausedUntil: new Date(now).toISOString() }, [], now).plan;
}

/** Train on different weekdays this week only. days: weekday indexes (Mon = 0). */
export function setWeekDays(plan, days, now = Date.now()) {
  const wk = String(weekKey(now));
  const same = [...days].sort((a, b) => a - b).join() === [...plan.profile.days].sort((a, b) => a - b).join();
  const weekDays = { ...(plan.weekDays || {}) };
  if (same) delete weekDays[wk];
  else weekDays[wk] = [...new Set(days)].sort((a, b) => a - b);
  return { ...plan, weekDays };
}

/**
 * Replacement for a lift in a plan slot: same muscle, allowed equipment, not
 * blocked, trains the same main region directly. Most-used first.
 */
export function replacementFor(exId, { plan, exercises, lookup, blocked = [], usage = {}, type, exclude = [] }) {
  const ex = lookup(exId);
  const region = primaryRegion(ex);
  const allowed = (type && PLAN_DAYS[type]?.only?.[ex.muscle]) || null;
  const skip = new Set([exId, ...blocked, ...exclude]);
  const cands = exercises.filter(x => x.muscle === ex.muscle && !skip.has(x.id) && allowedBy(plan.profile.equipment, x)
    && (!allowed || allowed.includes(primaryRegion(x))) && (!x.hard || plan.profile.level === 'advanced'));
  const score = x => ((exerciseRegions(x)[region] || 0) >= DIRECT ? 4 : 0) + (primaryRegion(x) === region ? 2 : 0)
    + (!!x.compound === !!ex.compound ? 1 : 0) + Math.min(usage[x.id] || 0, 10) * 0.1;
  return cands.sort((a, b) => score(b) - score(a))[0] || null;
}

/** Lifts that can replace exId in a session, best first (for the swap list). */
export function swapOptions(exId, { plan, exercises, lookup, blocked = [], usage = {}, type, exclude = [] }) {
  const ex = lookup(exId);
  const region = primaryRegion(ex);
  const allowed = (type && PLAN_DAYS[type]?.only?.[ex.muscle]) || null;
  const skip = new Set([exId, ...blocked, ...exclude]);
  return exercises.filter(x => x.muscle === ex.muscle && !skip.has(x.id) && allowedBy(plan.profile.equipment, x)
    && (!allowed || allowed.includes(primaryRegion(x))))
    .sort((a, b) => ((primaryRegion(b) === region) - (primaryRegion(a) === region)) || ((usage[b.id] || 0) - (usage[a.id] || 0)) || a.name.localeCompare(b.name));
}

// Replace a lift everywhere in the block's slots (all variants of every type).
function replaceInSlots(slots, from, to) {
  const next = JSON.parse(JSON.stringify(slots));
  for (const variants of Object.values(next)) {
    for (const v of variants) {
      for (const m of Object.keys(v)) {
        if (!v[m].includes(from)) continue;
        v[m] = to && !v[m].includes(to) ? v[m].map(x => (x === from ? to : x)) : v[m].filter(x => x !== from);
      }
    }
  }
  return next;
}

/**
 * Edit a planned session.
 * edit: { seq, type, slot, action: 'swap' | 'remove', from, to? , scope: 'week' | 'block' }
 * 'week' changes only that session; 'block' changes the A/B/C slot for the
 * rest of the block. Either way the edit is counted, and a lift swapped away
 * or removed LEARN_AFTER times is kept out of the plan from then on.
 * ctx: { exercises, lookup, blocked, usage } for picking replacements.
 * Returns { plan, learned } where learned is the exId now excluded, if any.
 */
export function editSession(plan, edit, ctx) {
  let next = JSON.parse(JSON.stringify(plan));
  const { seq, type, slot, action, from, to, scope } = edit;
  if (scope === 'block') {
    const variant = next.slots[type]?.[slot];
    if (variant) {
      for (const m of Object.keys(variant)) {
        if (!variant[m].includes(from)) continue;
        variant[m] = action === 'swap' && to && !variant[m].includes(to)
          ? variant[m].map(x => (x === from ? to : x))
          : variant[m].filter(x => x !== from);
      }
    }
    // A block-wide change replaces any one-off edit of this lift.
    const we = next.weekEdits[seq];
    if (we) {
      delete we.replace?.[from];
      if (we.remove) we.remove = we.remove.filter(x => x !== from);
    }
  } else {
    const we = next.weekEdits[seq] ||= { replace: {}, remove: [] };
    we.replace ||= {};
    we.remove ||= [];
    if (action === 'swap' && to) {
      // Swapping a lift that was itself a swap-in: point the original at the new one.
      const orig = Object.keys(we.replace).find(k => we.replace[k] === from);
      if (orig) we.replace[orig] = to; else we.replace[from] = to;
      if (orig === to) delete we.replace[orig];
    } else if (action === 'remove') {
      const orig = Object.keys(we.replace).find(k => we.replace[k] === from);
      if (orig) { delete we.replace[orig]; we.remove.push(orig); } else we.remove.push(from);
    }
  }
  // Learn: count edits per lift.
  next.edits ||= {};
  next.edits[from] = (next.edits[from] || 0) + 1;
  let learned = null;
  if (next.edits[from] >= LEARN_AFTER && !(next.excluded || []).includes(from)) {
    next.excluded = [...(next.excluded || []), from];
    learned = from;
    // Swap it out of the rest of the block too.
    const repl = action === 'swap' && to ? ctx.lookup(to)
      : replacementFor(from, { plan: next, ...ctx, blocked: [...(ctx.blocked || []), ...next.excluded] });
    next.slots = replaceInSlots(next.slots, from, repl?.id || null);
  }
  return { plan: next, learned };
}

/** Undo learning: let an excluded lift back into future plans. */
export function unexclude(plan, exId) {
  const edits = { ...(plan.edits || {}) };
  delete edits[exId];
  return { ...plan, excluded: (plan.excluded || []).filter(x => x !== exId), edits };
}

/**
 * Take a lift out of the current block everywhere (e.g. after 'This hurt'),
 * putting in a replacement for the same region when one exists.
 */
export function dropFromBlock(plan, exId, ctx) {
  const repl = replacementFor(exId, { plan, ...ctx });
  return { ...plan, slots: replaceInSlots(plan.slots, exId, repl?.id || null) };
}

/**
 * Workout entries for a planned session: [{ exId, sets, zone?, group? }].
 * Strength-goal main lifts get the 3-6 rep zone; supersets become groups.
 */
export function sessionEntries(session) {
  return session.items.map(it => ({
    exId: it.exId,
    sets: it.sets,
    ...(it.main ? { zone: STRENGTH_ZONE } : {}),
    ...(it.superset ? { group: it.superset } : {}),
  }));
}

/** Run the block review with the plan's own settings. */
export function runReview(plan, { workouts, lookup, bwOn, exercises, usage, blocked, secPerSet }) {
  return reviewBlock({ profile: plan.profile, plan, workouts: ownWorkouts(plan, workouts), lookup, bwOn, exercises, usage, blocked, secPerSet });
}

/**
 * Approve a review. accepted: { volume: { m: bool }, swaps: [bool] } (all by
 * default). Starts the next block this week.
 */
export function approveReview(plan, review, accepted = null, now = Date.now()) {
  const pickVol = {};
  for (const [m, v] of Object.entries(review.volume)) pickVol[m] = accepted?.volume?.[m] === false ? { ...v, to: v.from } : v;
  const swaps = review.swaps.filter((_, i) => accepted?.swaps?.[i] !== false);
  const next = applyReview(plan, { ...review, volume: pickVol, swaps }, new Date(weekKey(now)).toISOString());
  next.reviewDismissed = null;
  next.lastReview = { at: new Date(now).toISOString(), blockNo: plan.blockNo || 1 };
  return next;
}

/** Postpone the review by a week (keeps training the current block). */
export function postponeReview(plan, now = Date.now()) {
  return { ...plan, reviewDismissed: String(weekKey(now)) };
}

/** Plain-language summary for the review sheet. */
export function reviewSummary(review, muscleNames) {
  const up = [], down = [], hold = [];
  for (const [m, v] of Object.entries(review.volume)) {
    if (v.to > v.from) up.push(muscleNames[m]); else if (v.to < v.from) down.push(muscleNames[m]); else hold.push(muscleNames[m]);
  }
  return { up, down, hold, swaps: review.swaps.length };
}

/** Region name helper for messages. */
export const regionName = r => REGIONS[r]?.name || r;
