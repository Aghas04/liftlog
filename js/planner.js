// Weekly training plans. Pure functions, no storage access.
//
// Evidence behind the rules (see the "Why this works" pages in the app):
// - Weekly sets per muscle drive growth with diminishing returns, counting
//   indirect sets as half (Pelland et al. 2024; Schoenfeld et al. 2017).
// - Growth per session tails off past roughly 6-11 hard sets for one muscle
//   (Remmert et al. preprint), so weekly volume is spread across days.
// - With volume equal, split type and frequency matter little (Ramos-Campo
//   2024; Schoenfeld 2019); ~2x/week is preferred because it fits more
//   quality sets under the per-session limit (Schoenfeld 2016).
// - Systematic, not random, exercise variation (Kassiano 2022): core lifts
//   stay fixed for a block, accessories rotate between blocks.
// - Priority lifts go first (Nunes 2021). Supersets save time without losing
//   volume (Iversen 2021, 2024). Deloads only when needed (Coleman 2024).
import { MUSCLES, REGIONS, regionsOf, exerciseRegions, primaryRegion, allowedBy } from './data.js';
import { workingSets, sessionE1RM, sessionMissed } from './engine.js';
import { neglectedRegions, DIRECT, weekKey } from './insights.js';

const DAY = 86400000;
export const PER_SESSION_CAP = 10;
export const MAJOR = ['chest', 'back', 'quads', 'hamstrings', 'glutes', 'shoulders'];
const ANTAGONIST = { chest: 'back', back: 'chest', biceps: 'triceps', triceps: 'biceps', quads: 'hamstrings', hamstrings: 'quads' };

// Day types plans are built from. `only` limits a muscle to some regions
// (e.g. push days train front/side delts; pull days train rear delts).
export const PLAN_DAYS = {
  full: { name: 'Full Body', icon: '🔄', color: '#5ee0a0', muscles: ['chest', 'back', 'quads', 'hamstrings', 'shoulders', 'glutes', 'biceps', 'triceps', 'calves', 'abs'] },
  upper: { name: 'Upper', icon: '💪', color: '#9b8cff', muscles: ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms'] },
  lower: { name: 'Lower', icon: '🦵', color: '#ff9447', muscles: ['quads', 'hamstrings', 'glutes', 'calves', 'adductors', 'abs'] },
  push: { name: 'Push', icon: '🔥', color: '#ff5f9e', muscles: ['chest', 'shoulders', 'triceps'], only: { shoulders: ['delt_front', 'delt_side'] } },
  pull: { name: 'Pull', icon: '🏋️', color: '#3ed4ff', muscles: ['back', 'biceps', 'shoulders', 'forearms'], only: { shoulders: ['delt_rear'] } },
  legs: { name: 'Legs', icon: '⚡', color: '#c4f542', muscles: ['quads', 'hamstrings', 'glutes', 'calves', 'adductors', 'abs'] },
  back_bi: { name: 'Back & Biceps', icon: '🏋️', color: '#3ed4ff', muscles: ['back', 'biceps', 'shoulders', 'forearms'], only: { shoulders: ['delt_rear'] } },
  chest_sh_tri: { name: 'Chest, Shoulders & Triceps', icon: '🔥', color: '#ff5f9e', muscles: ['chest', 'shoulders', 'triceps', 'abs'], only: { shoulders: ['delt_front', 'delt_side'] } },
  chest_back: { name: 'Chest & Back', icon: '🦍', color: '#9b8cff', muscles: ['chest', 'back', 'abs'] },
  shoulders_arms: { name: 'Shoulders & Arms', icon: '💥', color: '#ffc24b', muscles: ['shoulders', 'biceps', 'triceps', 'forearms'] },
};

export const SPLITS = [
  { id: 'full_body', name: 'Full Body', rotation: ['full'], days: [2, 4], blurb: 'Every major muscle each session.' },
  { id: 'upper_lower', name: 'Upper / Lower', rotation: ['upper', 'lower'], days: [2, 6], blurb: 'Alternates upper-body and lower-body days.' },
  { id: 'ppl', name: 'Push / Pull / Legs', rotation: ['push', 'pull', 'legs'], days: [3, 6], blurb: 'Pressing, pulling, then legs.' },
  { id: 'bro3', name: 'Back & Biceps / Chest, Shoulders & Triceps / Legs', rotation: ['back_bi', 'chest_sh_tri', 'legs'], days: [3, 6], blurb: 'Pull muscles, push muscles, then legs.' },
  { id: 'arnold', name: 'Arnold: Chest & Back / Shoulders & Arms / Legs', rotation: ['chest_back', 'shoulders_arms', 'legs'], days: [3, 6], blurb: 'Opposing muscles paired, arms get their own day.' },
  { id: 'ulppl', name: 'Upper / Lower + Push / Pull / Legs', rotation: ['upper', 'lower', 'push', 'pull', 'legs'], days: [5, 5], blurb: 'A 5-day hybrid that hits everything about twice.' },
];

export const LEVELS = {
  beginner: { base: 10, min: 8, max: 14 },
  intermediate: { base: 14, min: 10, max: 20 },
  advanced: { base: 18, min: 12, max: 24 },
};
// Small muscles already get a lot of indirect work, so they need fewer direct sets.
const SIZE_FACTOR = { forearms: 0.5, adductors: 0.5, calves: 0.8, abs: 0.8 };

export const splitById = id => SPLITS.find(s => s.id === id);
export const slotLetter = i => String.fromCharCode(65 + i);

function rng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Share of the time limit filled with planned sets; the rest absorbs warm-ups
// and the occasional longer rest.
export const TIME_FILL = 0.85;

/**
 * Weekly direct-set target per muscle. overrides come from block reviews.
 * When the weekly time (days x minutes) fits more than the level's base
 * volume, every muscle scales up together, never past the level's maximum
 * (more sets keep helping, with diminishing returns: Pelland 2024).
 */
export function weeklyTargets(profile, overrides = {}, secPerSet = 130) {
  const lvl = LEVELS[profile.level] || LEVELS.intermediate;
  const base = {};
  for (const m of Object.keys(MUSCLES)) {
    let t = lvl.base * (SIZE_FACTOR[m] || 1);
    if ((profile.priority || []).includes(m)) t += 4;
    base[m] = Math.min(t, volumeBounds(profile, m)[1]);
  }
  const days = (profile.days || []).length;
  const capacity = days * Math.floor(((profile.minutes || 60) * 60) / secPerSet) * TIME_FILL;
  const total = Object.values(base).reduce((a, b) => a + b, 0);
  const boost = days && capacity > total ? capacity / total : 1;
  const out = {};
  for (const m of Object.keys(MUSCLES)) {
    out[m] = overrides[m] != null ? overrides[m] : Math.round(Math.min(base[m] * boost, volumeBounds(profile, m)[1]));
  }
  return out;
}

export const volumeBounds = (profile, m) => {
  const lvl = LEVELS[profile.level] || LEVELS.intermediate;
  const f = SIZE_FACTOR[m] || 1;
  return [Math.round(lvl.min * f), Math.round(lvl.max * f + ((profile.priority || []).includes(m) ? 4 : 0))];
};

/** Day types for `days` sessions starting at sequence number `seq`. */
export const sequenceTypes = (split, seq, count) => Array.from({ length: count }, (_, i) => split.rotation[(seq + i) % split.rotation.length]);

/** How many A/B/C variants each day type gets for this many days a week. */
export function slotCounts(split, days) {
  const out = {};
  for (const t of split.rotation) out[t] = Math.max(1, Math.min(3, Math.ceil(days / split.rotation.length)));
  return out;
}

/**
 * Which A/B/C variant the session with sequence number seq uses. offset
 * starts the rotation at a later day type (a new plan picks the freshest).
 */
export function slotFor(split, days, seq, offset = 0) {
  const type = split.rotation[(seq + offset) % split.rotation.length];
  const occurrence = Math.floor(seq / split.rotation.length);
  return { type, slot: occurrence % slotCounts(split, days)[type] };
}

/**
 * Where a new plan's rotation starts: the day type whose big muscles were
 * trained least recently (last 3 days, any workout). E.g. after two upper
 * days, a new Upper/Lower plan starts with Lower.
 */
export function rotationOffsetFor(split, workouts, lookup, now = Date.now()) {
  const day0 = new Date(now); day0.setHours(0, 0, 0, 0);
  const load = {};
  for (const w of workouts) {
    const d = new Date(w.date); d.setHours(0, 0, 0, 0);
    const ago = Math.round((day0.getTime() - d.getTime()) / DAY);
    if (ago < 0 || ago > 3) continue;
    const wt = ago <= 1 ? 3 : ago === 2 ? 2 : 1;
    for (const e of w.exercises) {
      const m = lookup(e.exId).muscle;
      if (workingSets(e).length && MAJOR.includes(m)) load[m] = Math.max(load[m] || 0, wt);
    }
  }
  let best = 0, bestC = Infinity;
  split.rotation.forEach((t, k) => {
    const majors = PLAN_DAYS[t].muscles.filter(m => MAJOR.includes(m));
    const c = majors.reduce((a, m) => a + (load[m] || 0), 0) / Math.max(1, majors.length);
    if (c < bestC - 1e-9) { bestC = c; best = k; }
  });
  return best;
}

const sharedMajor = (a, b) => PLAN_DAYS[a].muscles.filter(m => MAJOR.includes(m) && PLAN_DAYS[b].muscles.includes(m)).length;
const isLegDay = t => PLAN_DAYS[t].muscles.includes('quads') || PLAN_DAYS[t].muscles.includes('hamstrings');

// Penalty for training days in this weekday order: same major muscles on
// back-to-back days, and hard leg days on or the day after leg-heavy activities.
function schedulePenalty(types, weekdays, legActivityDays) {
  let p = 0;
  for (let i = 0; i < types.length; i++) {
    if (i > 0 && weekdays[i] - weekdays[i - 1] === 1) p += 2 * sharedMajor(types[i], types[i - 1]);
    if (isLegDay(types[i]) && (legActivityDays.has(weekdays[i]) || legActivityDays.has((weekdays[i] + 6) % 7))) p += 3;
    // The day before matters less: tired legs for the activity, not a worse lift.
    else if (isLegDay(types[i]) && legActivityDays.has((weekdays[i] + 1) % 7)) p += 1.5;
  }
  // Wrap-around Sunday -> Monday.
  if (types.length > 1 && weekdays[0] === 0 && weekdays[types.length - 1] === 6) p += 2 * sharedMajor(types[0], types[types.length - 1]);
  return p;
}

/**
 * Rank splits for a profile. Returns [{ id, name, score, reasons, fits }],
 * best first. Splits that can't fit the number of days are listed last.
 */
export function recommendSplits(profile, opts = {}) {
  const days = (profile.days || []).length;
  const secPerSet = opts.secPerSet || 130;
  const targets = weeklyTargets(profile, opts.volume, secPerSet);
  const legActivity = new Set((profile.activities || []).filter(a => a.legs).map(a => a.day));
  const weekdays = [...(profile.days || [])].sort((a, b) => a - b);
  return SPLITS.map(split => {
    const reasons = [];
    const fits = days >= split.days[0] && days <= split.days[1];
    if (!fits) return { id: split.id, name: split.name, score: -100, fits, reasons: [split.days[0] === split.days[1] ? `Needs exactly ${split.days[0]} days a week` : `Needs ${split.days[0]}–${split.days[1]} days a week`] };
    const types = sequenceTypes(split, 0, days);
    let score = 0;
    // Frequency for major muscles: ~2x/week is the sweet spot.
    const freq = {};
    for (const m of MAJOR) freq[m] = types.filter(t => PLAN_DAYS[t].muscles.includes(m)).length;
    const fScore = m => (freq[m] === 0 ? -3 : freq[m] === 1 ? 0.5 : freq[m] <= 3 ? 1 : 0.8);
    score += MAJOR.reduce((s, m) => s + fScore(m), 0);
    const avg = MAJOR.reduce((s, m) => s + freq[m], 0) / MAJOR.length;
    if (MAJOR.every(m => freq[m] >= 2)) reasons.push('Trains every major muscle at least twice a week');
    else if (MAJOR.some(m => freq[m] === 1)) reasons.push(`Some muscles only once a week (avg ${avg.toFixed(1)}×)`);
    // Per-session load: weekly target / frequency must fit under the cap.
    const over = MAJOR.filter(m => freq[m] && targets[m] / freq[m] > PER_SESSION_CAP);
    if (over.length) { score -= over.length; reasons.push(`${over.map(m => MUSCLES[m]).join(', ')} would need over ${PER_SESSION_CAP} sets in one session`); }
    // Time: average sets per session vs the time limit.
    const totalSets = Object.keys(MUSCLES).reduce((s, m) => s + (types.some(t => PLAN_DAYS[t].muscles.includes(m)) ? targets[m] : 0), 0);
    const perSession = totalSets / days;
    const fit = Math.floor(((profile.minutes || 60) * 60) / secPerSet);
    if (perSession > fit * 1.4) { score -= 2; reasons.push(`About ${Math.round(perSession)} sets per session; your time fits ~${fit} (supersets help)`); }
    else if (perSession > fit) { score -= 0.5; reasons.push('Sessions run close to your time limit (supersets will help)'); }
    else reasons.push(`About ${Math.round(perSession)} sets per session fits your time`);
    // Recovery with your chosen weekdays.
    const pen = schedulePenalty(types, weekdays, legActivity);
    if (pen) { score -= pen * 0.3; reasons.push('Some back-to-back days train the same muscles'); }
    if (split.id === 'full_body' && days >= 4) score -= 1;
    return { id: split.id, name: split.name, score, fits, reasons };
  }).sort((a, b) => b.score - a.score);
}

/**
 * Choose exercises for every A/B/C session variant of a block.
 * Returns slots: { [type]: [ { [muscle]: [exId, ...ranked] } per variant ] }.
 * The first exercise per muscle is the core lift (a compound when one exists).
 */
export function buildBlock(input) {
  const {
    profile, splitId, exercises, usage = {}, workouts = [], lookup, now = Date.now(), seed = 1,
    blocked = [], prev = null, keepCore = true,
  } = input;
  const split = splitById(splitId);
  const days = (profile.days || []).length || split.days[0];
  const counts = slotCounts(split, days);
  const blockedSet = new Set(blocked);
  const jitter = rng(seed);
  const neglect = new Set(neglectedRegions(workouts, lookup, { now }).map(n => n.region));
  const slots = {};
  const coveredBy = {};
  for (const type of [...new Set(split.rotation)]) {
    const day = PLAN_DAYS[type];
    slots[type] = [];
    const firstPicks = {};
    for (let v = 0; v < counts[type]; v++) {
      const variant = {};
      for (const m of day.muscles) {
        const allowedRegions = day.only?.[m] || regionsOf(m);
        const cands = exercises.filter(ex => ex.muscle === m && allowedBy(profile.equipment, ex) && !blockedSet.has(ex.id)
          && allowedRegions.includes(primaryRegion(ex)));
        if (!cands.length) continue;
        const ordered = [...allowedRegions].sort((a, b) => REGIONS[b].size - REGIONS[a].size);
        // Emphasize the biggest region that earlier variants' first two lifts
        // haven't covered yet, so A/B/C together reach every region.
        const covered = coveredBy[`${type}:${m}`] ||= new Set();
        const emphasis = ordered.find(r => !covered.has(r)) || ordered[v % ordered.length];
        const prevList = prev?.[type]?.[v]?.[m] || [];
        const picks = [];
        const used = new Set();
        for (let j = 0; j < 3 && picks.length < cands.length; j++) {
          // Core lift carries over from the last block unless it was swapped out.
          if (j === 0 && keepCore && prevList[0] && cands.some(c => c.id === prevList[0])) { picks.push(prevList[0]); used.add(primaryRegion(lookup(prevList[0]))); continue; }
          let best = null, bestS = -Infinity;
          for (const ex of cands) {
            if (picks.includes(ex.id)) continue;
            const main = primaryRegion(ex);
            const regs = exerciseRegions(ex);
            let s = 0;
            // A custom lift without an area map counts as one area, not all of them.
            if (ex.regions) for (const r of allowedRegions) s += (regs[r] || 0) * (neglect.has(r) ? 2 : 1);
            else s += 1;
            if (usage[ex.id]) s += 2 + Math.min(usage[ex.id], 10) * 0.15;
            if (main === emphasis) s += 2.5;
            if (j === 0 && ex.compound && MAJOR.includes(m)) s += 3;
            if (used.has(main)) s -= 6;
            if (ex.hard && profile.level !== 'advanced') s -= 5;              // e.g. Nordic curls: advanced only
            if (!ex.regions) s -= 3;                                          // custom lift: its coverage is a guess
            if (j === 0 && (firstPicks[m] || []).includes(ex.id)) s -= 2.5; // A/B/C variants differ
            if (j > 0 && prevList.slice(1).includes(ex.id)) s -= 1.5;        // accessories rotate between blocks
            s += jitter() * 0.6;
            if (s > bestS) { bestS = s; best = ex; }
          }
          if (!best) break;
          picks.push(best.id);
          used.add(primaryRegion(best));
        }
        variant[m] = picks;
        (firstPicks[m] ||= []).push(picks[0]);
        for (const id of picks.slice(0, 2)) covered.add(primaryRegion(lookup(id)));
      }
      slots[type].push(variant);
    }
  }
  return slots;
}

// Split n sets into k exercises, each 2-4 sets.
function splitSets(total, k) {
  const base = Math.floor(total / k);
  return Array.from({ length: k }, (_, i) => base + (i < total - base * k ? 1 : 0));
}

// Indirect (half-weight) sets an exercise gives each muscle other than its own.
export function indirectByMuscle(ex) {
  const out = {};
  for (const [r, w] of Object.entries(exerciseRegions(ex))) {
    const m = REGIONS[r].muscle;
    if (m === ex.muscle || w >= DIRECT) continue;
    out[m] = (out[m] || 0) + w;
  }
  for (const m of Object.keys(out)) out[m] = Math.min(0.5, out[m]);
  return out;
}

/**
 * Build one session: sets per muscle -> exercises with sets, ordered, with
 * main lifts flagged and supersets/trims applied to fit the time limit.
 */
export function buildSession({ type, variant, setsByMuscle, lookup, profile, secPerSet = 130, restSec = 90 }) {
  const day = PLAN_DAYS[type];
  const items = [];
  const notes = [];
  for (const m of day.muscles) {
    const sets = setsByMuscle[m] || 0;
    const list = variant[m] || [];
    if (sets < 2 || !list.length) continue;
    const k = Math.min(list.length, sets >= 4 ? Math.max(2, Math.ceil(sets / 4)) : 1);
    const per = splitSets(Math.min(sets, k * 4), k);
    list.slice(0, k).forEach((id, j) => items.push({ exId: id, muscle: m, sets: per[j], core: j === 0, compound: !!lookup(id).compound }));
  }
  const pri = profile.priority || [];
  const rank = it => (it.core && it.compound && MAJOR.includes(it.muscle) ? 0 : 2) + (it.compound ? 0 : 1) - (pri.includes(it.muscle) ? 0.5 : 0);
  items.sort((a, b) => rank(a) - rank(b));
  // Strength goal: the first compound core lift of the top 2 major muscles is a main lift (3-6 reps).
  if (profile.goal === 'strength') {
    let n = 0;
    for (const it of items) if (it.core && it.compound && MAJOR.includes(it.muscle) && n < 2) { it.main = true; n++; }
  }
  // Fit the time limit: superset unrelated isolation lifts, then trim.
  const limit = (profile.minutes || 60) * 60;
  const timeOf = () => {
    let t = items.reduce((s, it) => s + it.sets * secPerSet, 0);
    const seen = new Set();
    for (const it of items) if (it.superset && !seen.has(it.superset)) {
      seen.add(it.superset);
      const pair = items.filter(x => x.superset === it.superset);
      t -= Math.min(...pair.map(x => x.sets)) * restSec;
    }
    return t;
  };
  if (timeOf() > limit) {
    const free = items.filter(it => !it.main);
    let g = 0;
    for (const a of free) {
      if (a.superset) continue;
      const partner = free.find(b => !b.superset && b !== a && b.muscle !== a.muscle
        && (ANTAGONIST[a.muscle] === b.muscle || !lookup(a.exId).compound) && !lookup(b.exId).compound === !lookup(a.exId).compound);
      if (partner) { g++; a.superset = partner.superset = `s${g}`; }
      if (timeOf() <= limit) break;
    }
    if (g) notes.push('Supersets added to fit your time');
  }
  let trimmed = 0;
  const trimOrder = () => [...items].filter(it => !it.main).sort((a, b) => (pri.includes(a.muscle) - pri.includes(b.muscle)) || (a.core - b.core) || (b.sets - a.sets));
  while (timeOf() > limit) {
    const cand = trimOrder().find(it => it.sets > 2);
    if (cand) { cand.sets--; trimmed++; continue; }
    // Drop a non-core accessory if trimming sets isn't enough.
    const drop = trimOrder().find(it => !it.core);
    if (!drop) break;
    trimmed += drop.sets;
    items.splice(items.indexOf(drop), 1);
  }
  if (trimmed) notes.push(`Time limit: ${trimmed} set${trimmed > 1 ? 's' : ''} trimmed`);
  // A dropped accessory can leave its superset partner alone.
  for (const it of items) if (it.superset && items.filter(x => x.superset === it.superset).length < 2) delete it.superset;
  // Partners sit next to each other, where the later one was. Partners are
  // both compounds or both isolation, so compounds still come first.
  const ordered = [];
  items.forEach((it, i) => {
    if (!it.superset) { ordered.push(it); return; }
    const group = items.filter(x => x.superset === it.superset);
    if (items.lastIndexOf(group.at(-1)) === i) ordered.push(...group);
  });
  items.splice(0, items.length, ...ordered);
  return { items, estMinutes: Math.round(timeOf() / 60), notes };
}

/**
 * The plan for the week containing `now`.
 * input: { profile, plan: { splitId, slots, volume, pausedUntil, easeWeek, weekDays, weekEdits },
 *          workouts, lookup, now, secPerSet }
 * Plan workouts carry `plan: { seq }`. Returns { weekStart, days, notes, targets }.
 */
export function planWeek(input) {
  const { profile, plan, workouts = [], lookup, now = Date.now(), secPerSet = 130 } = input;
  const split = splitById(plan.splitId);
  const ws = weekKey(now);
  const wk = String(ws);
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const todayIdx = (today.getDay() + 6) % 7;
  const weekdays = [...(plan.weekDays?.[wk] || profile.days || [])].sort((a, b) => a - b);
  const daysPerWeek = (profile.days || []).length || weekdays.length;
  const notes = [];
  // A plan started or resumed mid-week only plans from that day on: earlier
  // days aren't 'missed', and the week's volume shrinks to the days left.
  const from = plan.activeFrom || plan.createdAt;
  let startIdx = 0;
  if (from) {
    const f = new Date(from); f.setHours(0, 0, 0, 0);
    if (f.getTime() > ws) startIdx = Math.min(7, Math.round((f.getTime() - ws) / DAY));
  }
  const dateOf = i => new Date(ws + i * DAY + 3600000 * 12);
  const out = Array.from({ length: 7 }, (_, i) => ({ weekday: i, date: dateOf(i).toISOString().slice(0, 10), kind: 'rest' }));

  // Pause: nothing planned.
  if (plan.pausedUntil && new Date(plan.pausedUntil).getTime() > now) {
    // Days already trained stay visible; today on is paused.
    for (const w of workouts) {
      const t = new Date(w.date).getTime();
      if (t >= ws && t < ws + 7 * DAY) { const i = (new Date(w.date).getDay() + 6) % 7; out[i].kind = 'done'; out[i].workoutId = w.id; }
    }
    out.forEach(d => { if (d.kind !== 'done' && d.weekday >= todayIdx) d.kind = 'paused'; });
    return { weekStart: ws, days: out, notes: ['Plan paused'], targets: {} };
  }

  for (const a of profile.activities || []) {
    if (out[a.day]) { out[a.day].activity = a; if (out[a.day].kind === 'rest') out[a.day].kind = 'activity'; }
  }

  // What's been done this week.
  const inWeek = workouts.filter(w => new Date(w.date).getTime() >= ws && new Date(w.date).getTime() < ws + 7 * DAY);
  const doneSeqs = new Set(workouts.filter(w => w.plan).map(w => w.plan.seq));
  for (const w of inWeek) {
    const i = (new Date(w.date).getDay() + 6) % 7;
    out[i].kind = 'done';
    out[i].workoutId = w.id;
    if (w.plan) out[i].session = { seq: w.plan.seq, ...slotFor(split, daysPerWeek, w.plan.seq, plan.rotationOffset || 0) };
  }
  const trainedToday = out[todayIdx].kind === 'done';
  const remainingDays = weekdays.filter(d => d > todayIdx || (d === todayIdx && !trainedToday)).filter(d => out[d].kind !== 'done');
  for (const d of weekdays) if (d >= startIdx && d < todayIdx && out[d].kind !== 'done') { out[d].kind = 'missed'; }
  // Days before the plan started (or resumed) aren't rest days, just not planned.
  for (let d = 0; d < startIdx; d++) if (out[d].kind === 'rest') out[d].kind = 'before';
  const missed = weekdays.filter(d => d < todayIdx && out[d].kind === 'missed').length;

  // Next sessions in the rotation: the lowest sequence numbers not done yet.
  const seqs = [];
  for (let s = 0; seqs.length < remainingDays.length && s < 10000; s++) if (!doneSeqs.has(s)) seqs.push(s);
  let order = seqs.map(s => ({ seq: s, ...slotFor(split, daysPerWeek, s, plan.rotationOffset || 0) }));

  // Reorder upcoming sessions to avoid back-to-back muscle overlap and hard
  // leg days around leg-heavy activities (keeps the rotation otherwise).
  const legActivity = new Set((profile.activities || []).filter(a => a.legs).map(a => a.day));
  if (order.length > 1 && order.length <= 6) {
    // Big muscles trained the day before the next session, in any workout
    // (planned or not), so the next session doesn't hit them again.
    const prevMuscles = new Set();
    const prevDay = remainingDays[0] - 1;
    for (const w of inWeek) {
      if ((new Date(w.date).getDay() + 6) % 7 !== prevDay) continue;
      for (const e of w.exercises) if (workingSets(e).length && MAJOR.includes(lookup(e.exId).muscle)) prevMuscles.add(lookup(e.exId).muscle);
    }
    const cost = perm => {
      const types = perm.map(o => o.type);
      let p = schedulePenalty(types, remainingDays, legActivity);
      p += 2 * PLAN_DAYS[types[0]].muscles.filter(m => prevMuscles.has(m)).length;
      perm.forEach((o, i) => { p += Math.abs(o.seq - order[i].seq) * 0.01; }); // prefer the normal order
      return p;
    };
    let best = order, bestC = cost(order);
    const permute = (arr, l) => {
      if (l === arr.length) { const c = cost(arr); if (c < bestC - 1e-9) { bestC = c; best = [...arr]; } return; }
      for (let i = l; i < arr.length; i++) { [arr[l], arr[i]] = [arr[i], arr[l]]; permute(arr, l + 1); [arr[l], arr[i]] = [arr[i], arr[l]]; }
    };
    permute([...order], 0);
    order = best;
  }

  // Volume: weekly targets minus what's already done this week, spread over
  // the remaining sessions (never above the per-session cap).
  let targets = weeklyTargets(profile, plan.volume, secPerSet);
  const ease = plan.easeWeek && String(plan.easeWeek) === wk ? 0.7 : 1;
  // The usual weekly goal per muscle (before any mid-week-start scaling).
  const goals = Object.fromEntries(Object.entries(targets).map(([m, t]) => [m, Math.round(t * ease)]));
  // Smallest useful dose per session: half of a normal session's share, at
  // least 2 sets. Extra workouts during the week never shrink a planned
  // session below this.
  const fullTypes = sequenceTypes(split, 0, daysPerWeek);
  const minSets = {};
  for (const m of Object.keys(MUSCLES)) {
    const freq = fullTypes.filter(t => PLAN_DAYS[t].muscles.includes(m)).length;
    if (freq) minSets[m] = Math.min(PER_SESSION_CAP, Math.max(2, Math.round(((targets[m] * ease) / freq) * 0.5)));
  }
  if (startIdx > 0 && weekdays.length) {
    const frac = weekdays.filter(d => d >= startIdx).length / weekdays.length;
    targets = Object.fromEntries(Object.entries(targets).map(([m, t]) => [m, Math.round(t * frac)]));
    if (frac < 1) notes.push('Starting mid-week: volume scaled to the days left');
  }
  if (ease < 1) {
    targets = Object.fromEntries(Object.entries(targets).map(([m, t]) => [m, Math.round(t * ease)]));
    notes.push('Easing back in after a break: about 30% less volume this week');
  }
  // Each set counts once for its own muscle (not once per region). Indirect
  // half-sets only count toward small muscles — the same way the week is
  // planned — so the plan doesn't shrink mid-week as sessions get done.
  const doneMuscle = {};
  const directDone = {};
  // Workouts before a mid-week start are already covered by scaling the
  // targets down, so they don't count again.
  for (const w of inWeek.filter(x => (new Date(x.date).getDay() + 6) % 7 >= startIdx)) {
    for (const e of w.exercises) {
      const n = workingSets(e).length;
      if (!n) continue;
      const ex = lookup(e.exId);
      doneMuscle[ex.muscle] = (doneMuscle[ex.muscle] || 0) + n;
      directDone[ex.muscle] = (directDone[ex.muscle] || 0) + n;
      for (const [m, wt] of Object.entries(indirectByMuscle(ex))) if (!MAJOR.includes(m)) doneMuscle[m] = (doneMuscle[m] || 0) + wt * n;
    }
  }
  const remaining = Object.fromEntries(Object.keys(MUSCLES).map(m => [m, Math.max(0, targets[m] - (doneMuscle[m] || 0))]));
  const sessionsWith = m => order.filter(o => PLAN_DAYS[o.type].muscles.includes(m));

  // Each session's lifts with this week's edits (swap/remove) applied.
  const edits = plan.weekEdits || {};
  const sessions = order.map(o => {
    const variant = JSON.parse(JSON.stringify(plan.slots[o.type]?.[o.slot] || plan.slots[o.type]?.[0] || {}));
    const e = edits[o.seq];
    if (e) {
      for (const [from, to] of Object.entries(e.replace || {})) for (const m of Object.keys(variant)) variant[m] = variant[m].map(x => (x === from ? to : x));
      for (const rm of e.remove || []) for (const m of Object.keys(variant)) variant[m] = variant[m].filter(x => x !== rm);
    }
    return { ...o, variant };
  });
  // Most sets a session can hold for a muscle: 4 per lift, never past the cap.
  // If lifts were removed, the sets that no longer fit go to other sessions.
  const capOf = (i, m) => Math.min(PER_SESSION_CAP, 4 * (sessions[i].variant[m] || []).length);
  const perSession = order.map(() => ({}));
  const assign = muscles => {
    for (const m of muscles) {
      const idx = order.map((o, i) => (PLAN_DAYS[o.type].muscles.includes(m) && capOf(i, m) > 0 ? i : -1)).filter(i => i >= 0);
      if (!idx.length) continue;
      // Hand out the remaining sets one at a time across sessions with room,
      // so the week adds up exactly (9 over 2 = 5 + 4) and nothing overflows.
      let total = Math.round(remaining[m]);
      const got = Object.fromEntries(idx.map(i => [i, 0]));
      while (total > 0 && idx.some(i => got[i] < capOf(i, m))) {
        for (const i of idx) { if (total > 0 && got[i] < capOf(i, m)) { got[i]++; total--; } }
      }
      for (const i of idx) {
        let n = got[i];
        if (n > 0 && n < 2) n = 2;
        n = Math.min(capOf(i, m), Math.max(n, minSets[m] || 0));
        perSession[i][m] = n;
      }
    }
  };
  // Big muscles first, then subtract their indirect work from small muscles.
  assign(MAJOR);
  for (let i = 0; i < sessions.length; i++) {
    for (const m of MAJOR) {
      const list = sessions[i].variant[m] || [];
      if (!perSession[i][m] || !list.length) continue;
      const ind = indirectByMuscle(lookup(list[0]));
      for (const [mm, w] of Object.entries(ind)) if (!MAJOR.includes(mm)) remaining[mm] = Math.max(0, remaining[mm] - w * perSession[i][m]);
    }
  }
  // Indirect work can stand in for at most 60% of a small muscle's sets, so
  // triceps still get direct work (e.g. overhead extensions for the long head).
  for (const m of Object.keys(MUSCLES)) {
    if (MAJOR.includes(m)) continue;
    const floor = Math.max(0, Math.ceil(targets[m] * 0.4) - (directDone[m] || 0));
    remaining[m] = Math.max(remaining[m], floor);
  }
  assign(Object.keys(MUSCLES).filter(m => !MAJOR.includes(m)));

  // Build each session.
  sessions.forEach((s, i) => {
    const built = buildSession({ type: s.type, variant: s.variant, setsByMuscle: perSession[i], lookup, profile, secPerSet, restSec: Math.max(60, secPerSet - 40) });
    const day = remainingDays[i];
    out[day].kind = 'train';
    out[day].session = {
      seq: s.seq, type: s.type, slot: s.slot,
      name: `${PLAN_DAYS[s.type].name} ${slotLetter(s.slot)}`,
      items: built.items, estMinutes: built.estMinutes, notes: built.notes,
    };
  });
  for (const d of out) {
    if (d.kind !== 'train' || !isLegDay(d.session.type)) continue;
    const near = (profile.activities || []).find(a => a.legs && [d.weekday, (d.weekday + 6) % 7, (d.weekday + 1) % 7].includes(a.day));
    if (near) notes.push(`${d.session.name} is next to ${near.name} — with these days there's no better spot, so go by feel that day`);
  }
  if (missed) notes.push(`${missed} missed day${missed > 1 ? 's' : ''} this week: the rotation picks up where you left off and the remaining days carry a bit more volume`);
  if (order.length && sessionsWith('quads').length === 0 && sessionsWith('chest').length === 0) notes.push('Rest of the week is light');
  return { weekStart: ws, days: out, notes, targets, goals };
}

/**
 * End-of-block review: per-muscle volume up / hold / down from how its lifts
 * progressed and how well you recovered, plus core-lift variations for
 * stalled lifts and accessory rotation.
 */
export function reviewBlock(input) {
  const { profile, plan, workouts, lookup, bwOn = () => 0, exercises, usage = {}, blocked = [], secPerSet = 130 } = input;
  const start = plan.blockStart;
  const block = workouts.filter(w => w.date >= start);
  const targets = weeklyTargets(profile, plan.volume, secPerSet);
  const volume = {};
  const progressOf = {};
  for (const m of Object.keys(MUSCLES)) {
    const ids = [...new Set(block.flatMap(w => w.exercises.filter(e => lookup(e.exId).muscle === m && workingSets(e).length).map(e => e.exId)))];
    const changes = [];
    let sessions = 0, missedN = 0;
    for (const id of ids) {
      const ex = lookup(id);
      const hist = block.flatMap(w => w.exercises.filter(e => e.exId === id).map(e => ({ date: w.date, sets: e.sets }))).sort((a, b) => a.date.localeCompare(b.date));
      sessions += hist.length;
      missedN += hist.filter(sessionMissed).length;
      if (hist.length < 3) continue;
      const first = Math.max(...hist.slice(0, 2).map(h => sessionE1RM(h, ex, bwOn(h.date))));
      const last = Math.max(...hist.slice(-2).map(h => sessionE1RM(h, ex, bwOn(h.date))));
      if (first > 0) changes.push(last / first - 1);
    }
    const poorDays = block.filter(w => w.readiness && w.readiness.poor >= 2 && w.exercises.some(e => lookup(e.exId).muscle === m)).length;
    const muscleDays = block.filter(w => w.exercises.some(e => lookup(e.exId).muscle === m)).length;
    const from = targets[m];
    if (!changes.length || sessions < 3) { volume[m] = { from, to: from, reason: 'Not enough data yet — holding' }; continue; }
    const prog = changes.reduce((a, b) => a + b, 0) / changes.length;
    progressOf[m] = prog;
    const missRate = missedN / Math.max(1, sessions);
    const poorRate = muscleDays ? poorDays / muscleDays : 0;
    const [lo, hi] = volumeBounds(profile, m);
    let to = from, reason;
    if (prog < 0 || missRate >= 0.4 || poorRate >= 0.5) {
      to = Math.max(lo, from - 2);
      reason = prog < 0 ? `Strength dipped ${(prog * 100).toFixed(1)}% — easing volume to recover` : 'Missing targets or recovering poorly — easing volume';
    } else if (prog < 0.01 && missRate < 0.25 && poorRate < 0.3) {
      to = Math.min(hi, from + 2);
      reason = 'Stalled but recovering well — a little more volume';
    } else {
      reason = `Progressing (+${(prog * 100).toFixed(1)}%) — keeping what works`;
    }
    volume[m] = { from, to, reason };
  }
  // Core variations for stalled main lifts, and accessory rotation.
  const swaps = [];
  const blockedSet = new Set(blocked);
  const neglect = new Set(neglectedRegions(workouts, lookup).map(n => n.region));
  for (const [type, variants] of Object.entries(plan.slots)) {
    variants.forEach((variant, v) => {
      for (const [m, list] of Object.entries(variant)) {
        const allowed = PLAN_DAYS[type].only?.[m] || regionsOf(m);
        const inSlot = new Set(list);
        // A replacement must train the same target region directly, so a
        // rotation never drops a region (e.g. shrugs are the only direct traps work).
        const pick = (from, wantRegion, compound) => {
          const c = exercises.filter(ex => ex.muscle === m && !inSlot.has(ex.id) && ex.id !== from && !blockedSet.has(ex.id)
            && allowedBy(profile.equipment, ex) && allowed.includes(primaryRegion(ex)) && (compound == null || !!ex.compound === compound)
            && (exerciseRegions(ex)[wantRegion] || 0) >= DIRECT && (!ex.hard || profile.level === 'advanced'));
          c.sort((a, b) => ((primaryRegion(b) === wantRegion) - (primaryRegion(a) === wantRegion))
            || ((exerciseRegions(b)[wantRegion] || 0) - (exerciseRegions(a)[wantRegion] || 0)) || ((usage[b.id] || 0) - (usage[a.id] || 0)));
          return c[0] || null;
        };
        // Progress of a lift over the block, or null without enough sessions.
        const progressOfLift = (id, ex, minSessions) => {
          const hist = block.flatMap(w => w.exercises.filter(e => e.exId === id).map(e => ({ date: w.date, sets: e.sets })));
          if (hist.length < minSessions) return null;
          const first = Math.max(...hist.slice(0, 2).map(h => sessionE1RM(h, ex, bwOn(h.date))));
          const last = Math.max(...hist.slice(-2).map(h => sessionE1RM(h, ex, bwOn(h.date))));
          return first > 0 ? last / first - 1 : null;
        };
        list.forEach((id, j) => {
          const ex = lookup(id);
          if (j === 0) {
            const p = progressOfLift(id, ex, 4);
            if (p != null && p < 0.01) {
              const to = pick(id, primaryRegion(ex), !!ex.compound);
              if (to) { swaps.push({ type, slot: v, muscle: m, index: j, from: id, to: to.id, reason: `${ex.name} stalled this block — a close variation to restart progress` }); inSlot.add(to.id); }
            }
            return;
          }
          const want = allowed.find(r => neglect.has(r)) || primaryRegion(ex);
          // Stable blocks: an accessory that's still progressing stays. One that
          // stalled rotates (only the last per muscle), and so does any swap that
          // brings in a neglected area.
          const p = progressOfLift(id, ex, 3);
          const stalled = p != null && p < 0.01;
          if (!neglect.has(want) && !(stalled && j === list.length - 1)) return;
          const to = pick(id, want, null);
          if (to) {
            swaps.push({ type, slot: v, muscle: m, index: j, from: id, to: to.id, reason: neglect.has(want) ? `Rotating in ${to.name} for ${REGIONS[want].name.toLowerCase()}` : `${ex.name} stalled — rotating for the new block` });
            inSlot.add(to.id);
          }
        });
      }
    });
  }
  return { volume, swaps, progress: progressOf };
}

/** Apply an approved review: new volumes and swapped exercises. */
export function applyReview(plan, review, newBlockStart) {
  const next = JSON.parse(JSON.stringify(plan));
  next.volume = { ...(next.volume || {}) };
  for (const [m, v] of Object.entries(review.volume)) next.volume[m] = v.to;
  for (const s of review.swaps) {
    const list = next.slots[s.type]?.[s.slot]?.[s.muscle];
    if (list && list[s.index] === s.from) list[s.index] = s.to;
  }
  next.blockStart = newBlockStart;
  next.blockNo = (next.blockNo || 1) + 1;
  next.weekEdits = {};
  return next;
}

/**
 * Readiness check: trims a little volume on rough days.
 * answers: { sleep: 'poor'|'ok'|'good', soreness: 'high'|'some'|'none', energy: 'low'|'ok'|'high' }
 * items: [{ sets, main? }]. Returns { items, poor, trimmed }.
 */
export function readinessAdjust(items, answers = {}) {
  const poor = (answers.sleep === 'poor') + (answers.soreness === 'high') + (answers.energy === 'low');
  const outItems = items.map(it => ({ ...it }));
  let trimmed = 0;
  if (poor >= 2) {
    for (const it of outItems) {
      if (it.sets >= 3 && (poor >= 3 || !it.main)) { it.sets--; trimmed++; }
    }
  }
  return { items: outItems, poor, trimmed };
}

/**
 * Swap suggestions for a template workout that keeps skipping some regions.
 * Accessories only, same muscle, today only. Returns up to `max` swaps:
 * [{ uid, from, to, region, reason }].
 */
export function swapSuggestions({ entries, neglect, exercises, usage = {}, blocked = [], equipment = 'gym', lookup, timesUsed, minUses = 3, max = 3 }) {
  if (timesUsed < minUses) return [];
  const inWorkout = new Set(entries.map(e => e.exId));
  const covered = new Set();
  for (const e of entries) for (const [r, w] of Object.entries(exerciseRegions(lookup(e.exId)))) if (w >= DIRECT) covered.add(r);
  const neglected = new Set(neglect.map(n => n.region));
  const usedEntries = new Set();
  const out = [];
  for (const n of neglect) {
    if (out.length >= max) break;
    if (covered.has(n.region)) continue;
    const m = REGIONS[n.region].muscle;
    const options = exercises
      .filter(ex => ex.muscle === m && !inWorkout.has(ex.id) && !blocked.includes(ex.id) && allowedBy(equipment, ex) && (exerciseRegions(ex)[n.region] || 0) >= DIRECT)
      .sort((a, b) => (!!usage[b.id] - !!usage[a.id]) || ((exerciseRegions(b)[n.region] || 0) - (exerciseRegions(a)[n.region] || 0)));
    // An accessory of the same muscle that hasn't been started and isn't itself
    // fixing a neglected region. Swapping it must not open a new gap: its area
    // stays covered by another lift in the workout, or by the new one.
    let entry = null, to = null;
    for (const e of entries) {
      const ex = lookup(e.exId);
      if (ex.muscle !== m || ex.compound || usedEntries.has(e.uid) || e.sets.some(s => s.done) || neglected.has(primaryRegion(ex))) continue;
      const own = primaryRegion(ex);
      const others = entries.some(o => o !== e && (exerciseRegions(lookup(o.exId))[own] || 0) >= DIRECT);
      const pick = options.find(x => others || (exerciseRegions(x)[own] || 0) >= DIRECT);
      if (pick) { entry = e; to = pick; break; }
    }
    if (!entry) continue;
    usedEntries.add(entry.uid);
    inWorkout.add(to.id);
    out.push({ uid: entry.uid, from: entry.exId, to: to.id, region: n.region, reason: `${REGIONS[n.region].name}: ${n.reason.charAt(0).toLowerCase()}${n.reason.slice(1)}` });
  }
  return out;
}
