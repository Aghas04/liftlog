// Progressive overload engine. Pure functions, no storage access.
//
// Idea: estimate current strength (e1RM) from recent sessions, then pick a
// weight and per-set rep targets that ask for slightly more than last time.
// Reps climb inside a muscle-building zone; once they pass the top of the
// zone the weight goes up and reps reset lower. Missed targets lower the
// estimate automatically, and two missed sessions in a row trigger a deload.

const DAY = 86400000;

export const epley = (load, reps) => load * (1 + Math.min(reps, 20) / 30);
export const repsAt = (e1rm, load) => (load > 0 ? 30 * (e1rm / load - 1) : 0);
const roundTo = (x, inc) => Math.round(x / inc) * inc;
const floorTo = (x, inc) => Math.floor(x / inc) * inc;

// Weighted lifts never go past 12 reps: at that point the weight goes up.
// Only bodyweight lifts (push-ups, pull-ups, dips, sit-ups) go higher.
export const MAX_REPS = 12;
// Reps lost per set with enough rest (2-3 min): about 1-2 (Willardson & Burkett 2005, 2006).
export const MAX_DROP = 1.5;
// Timed holds use seconds: 20-90 s, then a harder version.
export const HOLD_ZONE = [20, 90];
export function zoneFor(ex) {
  if (ex.timed) return HOLD_ZONE;
  if (ex.equipment === 'bodyweight') return [6, 20];
  return ex.compound ? [6, MAX_REPS] : [8, MAX_REPS];
}

// Bodyweight and assisted lifts move your bodyweight. Assisted machines store
// the assistance as a negative weight, so load = bodyweight - assistance and
// "heavier" still means a bigger number (-40 is harder than -50).
export const usesBodyweight = ex => ex.equipment === 'bodyweight' || ex.equipment === 'assisted';
export function loadFor(ex, weight, bw) {
  // A hold isn't a load times reps; it adds nothing to volume totals.
  if (ex.timed) return 0;
  return usesBodyweight(ex) ? Math.max(0, (bw || 0) + (weight || 0)) : weight || 0;
}

export function workingSets(session) {
  return (session.sets || []).filter(s => s.done && !s.warmup && s.reps > 0);
}

// Targets ask for one rep beyond what you've shown you can do, so falling
// one short is a normal attempt, not a miss. A set counts as missed when it's
// 2+ reps short of its target.
export function sessionMissed(session) {
  const sets = workingSets(session).filter(s => s.target && s.target.reps > 0);
  if (!sets.length) return false;
  const missed = sets.filter(s => s.reps <= s.target.reps - 2 && s.weight >= (s.target.weight ?? 0)).length;
  return missed >= Math.ceil(sets.length / 2);
}

// Best estimated 1RM of a session. `bw` is bodyweight for bodyweight lifts.
export function sessionE1RM(session, ex, bw) {
  // Holds: progress is the longest hold (seconds), not a 1-rep max.
  if (ex.timed) return Math.max(0, ...workingSets(session).map(s => s.reps));
  let best = 0;
  for (const s of workingSets(session)) {
    const load = loadFor(ex, s.weight, bw);
    if (load > 0) best = Math.max(best, epley(load, s.reps));
  }
  return best;
}

// How much lighter to come back after a break. Strength holds for about 3
// weeks off, then fades with time (Bosquet et al. 2013), so longer breaks
// start lighter.
export const breakFactor = days => (days <= 28 ? 0.9 : days <= 60 ? 0.85 : days <= 120 ? 0.8 : 0.75);

// The weight used for most sets (the heavier one on a tie).
export function workWeightOf(sets) {
  const n = {};
  for (const s of sets) n[s.weight || 0] = (n[s.weight || 0] || 0) + 1;
  return +Object.keys(n).sort((a, b) => n[b] - n[a] || b - a)[0];
}

// Average reps lost from one set to the next at the same weight.
function fatigueDrop(sets) {
  const drops = [];
  for (let i = 1; i < sets.length; i++) {
    if (sets[i].weight === sets[i - 1].weight) drops.push(sets[i - 1].reps - sets[i].reps);
  }
  if (!drops.length) return 1;
  const avg = drops.reduce((a, b) => a + b, 0) / drops.length;
  return Math.max(0, Math.min(3, avg));
}

// ---------- Fatigue within a session ----------
// Earlier work in a workout tires a muscle. The same muscle counts most,
// muscles that help with the lift count partly (chest and shoulder pressing
// before triceps, rows before curls), and everything else a little.
export const SYNERGY = {
  chest: ['shoulders', 'triceps'],
  shoulders: ['chest', 'triceps'],
  triceps: ['chest', 'shoulders'],
  back: ['biceps', 'shoulders'],
  biceps: ['back'],
  quads: ['glutes', 'hamstrings'],
  hamstrings: ['glutes', 'back'],
  glutes: ['quads', 'hamstrings'],
  calves: [],
  abs: [],
  // Squats, lunges and leg presses work the inner thighs; rows and curls the grip.
  adductors: ['quads', 'glutes'],
  forearms: ['back', 'biceps'],
};
const SAME = 1.5, HELPER = 0.6, OTHER = 0.1;

/** Fatigue score for `muscle` given working sets already done per muscle. */
export function fatigueLoad(priorSets, muscle) {
  let f = 0;
  for (const [m, n] of Object.entries(priorSets || {})) {
    f += n * (m === muscle ? SAME : SYNERGY[muscle]?.includes(m) ? HELPER : OTHER);
  }
  return f;
}

// Strength lost per fatigue point; learned per lift once there's enough data.
export const DEFAULT_FATIGUE_RATE = 0.012;
export const fatigueFactor = (f, rate = DEFAULT_FATIGUE_RATE) => Math.max(0.7, 1 - rate * (f || 0));

/**
 * Fit how much strength drops per fatigue point from one lift's sessions done
 * at different positions, while allowing for getting stronger over time
 * (least squares on log e1RM vs days and fatigue).
 * Returns { rate, n } or null when the sessions don't vary enough to tell.
 */
export function fitFatigueRate(points) {
  const pts = points.filter(p => p.e1rm > 0 && p.f != null);
  if (pts.length < 4) return null;
  const fs = pts.map(p => p.f);
  if (Math.max(...fs) - Math.min(...fs) < 3) return null;
  const n = pts.length;
  const mean = a => a.reduce((s, v) => s + v, 0) / n;
  const t = pts.map(p => p.t), y = pts.map(p => Math.log(p.e1rm));
  const mt = mean(t), mf = mean(fs), my = mean(y);
  let stt = 0, sff = 0, stf = 0, sty = 0, sfy = 0;
  for (let i = 0; i < n; i++) {
    const dt = t[i] - mt, df = fs[i] - mf, dy = y[i] - my;
    stt += dt * dt; sff += df * df; stf += dt * df; sty += dt * dy; sfy += df * dy;
  }
  const det = stt * sff - stf * stf;
  if (det <= 1e-9) return null;
  return { rate: Math.min(0.03, Math.max(0.003, -(stt * sfy - stf * sty) / det)), n };
}

/**
 * Fatigue rate for one lift, shrunk toward `prior` (the lifter's personal
 * rate, or the default) until there's plenty of data for this lift.
 */
export function learnFatigueRate(points, prior = DEFAULT_FATIGUE_RATE) {
  const fit = fitFatigueRate(points);
  if (!fit) return prior;
  return (fit.n * fit.rate + 4 * prior) / (fit.n + 4);
}

/**
 * The lifter's overall fatigue rate, pooled from every lift that has enough
 * varied sessions (weighted by sessions), shrunk toward the default.
 * pointsByLift: arrays of { t, e1rm, f } per lift.
 * Returns { rate, lifts, sessions }.
 */
export function personalFatigueRate(pointsByLift) {
  let sum = 0, sessions = 0, lifts = 0;
  for (const pts of pointsByLift) {
    const fit = fitFatigueRate(pts.slice(-12));
    if (!fit) continue;
    sum += fit.rate * fit.n;
    sessions += fit.n;
    lifts++;
  }
  const rate = sessions ? (sum + 8 * DEFAULT_FATIGUE_RATE) / (sessions + 8) : DEFAULT_FATIGUE_RATE;
  return { rate, lifts, sessions };
}

/**
 * @param ex        exercise { equipment, compound, increment? }
 * @param history   past sessions for this exercise, oldest first:
 *                  { date: ISO, difficulty?: 'easy'|'hard'|'too_hard', sets: [...], fatigue?: number }
 * @param opts      { bodyweight?: number, now?: number, increment: number, fatigue?: number, fatigueRate?: number, zone?: [min, max] }
 *                  fatigue = how tired this muscle will be at this point of today's workout
 *                  fatigueRate = the lifter's personal rate, the starting point for this lift
 * @returns null when there is no usable history, else
 *          { weight, reps: number[], kind, reason }
 */
/**
 * Timed hold suggestion: the target time is your best last time plus 5 seconds
 * when every set hit its goal, else the same. At 90 seconds, switch to a harder
 * version (longer holds add little). reps hold seconds.
 */
function suggestHold(ex, history, opts) {
  const usable = history.filter(s => workingSets(s).length);
  if (!usable.length) return null;
  const last = usable[usable.length - 1];
  const sets = workingSets(last);
  const best = Math.max(...sets.map(s => s.reps));
  const hitAll = sets.every(s => !s.target || s.reps >= s.target.reps);
  const [lo, hi] = HOLD_ZONE;
  const n = Math.min(6, Math.max(1, ...usable.slice(-3).map(s => workingSets(s).length)));
  const gap = ((opts.now ?? Date.now()) - new Date(last.date).getTime()) / DAY;
  let t, kind, reason;
  if (gap > 14) { t = Math.max(lo, Math.round(best * (breakFactor(gap) - 0.05) / 5) * 5); kind = 'break'; reason = `${Math.round(gap)} days since last time — easing back in.`; }
  else if (best >= hi) { t = hi; kind = 'hold'; reason = 'You can hold 90 seconds: try a harder version (weighted, longer lever, one side).'; }
  else if (hitAll && best + 5 < lo) { t = lo; kind = 'reps'; reason = `Build up to a ${lo}-second hold.`; }
  else if (hitAll) { t = Math.min(hi, best + 5); kind = 'reps'; reason = 'Hold 5 seconds longer than last time.'; }
  else { t = Math.max(lo, best); kind = 'hold'; reason = 'Same time as your best last time.'; }
  const topWeight = Math.max(0, ...sets.map(s => s.weight || 0));
  return { weight: topWeight, reps: Array.from({ length: n }, () => t), kind, reason, est: 0, drop: 0, bonus: 0, zone: HOLD_ZONE, timed: true };
}

export function suggest(ex, history, opts) {
  if (ex.timed) return suggestHold(ex, history, opts);
  const inc = opts.increment || 5;
  // Weights stay in lb; the app passes a formatter so messages read in the user's unit.
  const fw = opts.formatWeight || (v => `${Math.round(v * 10) / 10} lb`);
  const now = opts.now ?? Date.now();
  // isBW: pure bodyweight lifts, which may go past 12 reps. Assisted lifts
  // follow the weighted rules, but their load includes bodyweight too.
  const isBW = ex.equipment === 'bodyweight';
  const assisted = ex.equipment === 'assisted';
  const bwLoad = isBW || assisted;
  const bw = opts.bodyweight || 0;
  // opts.zone overrides the rep range (strength-goal main lifts use [3, 6]).
  const zone = opts.zone || zoneFor(ex);
  const [zMin, zMax] = zone;
  const hardCap = zMax + 5;

  const usable = history.filter(s => workingSets(s).length);
  if (!usable.length) return null;
  // Deload sessions are deliberately light; ignore them unless that's all there is.
  const valid = usable.some(s => !s.deload) ? usable.filter(s => !s.deload) : usable;
  const lastDate = usable[usable.length - 1].date;
  const fNow = opts.fatigue || 0;
  const isSimilar = x => Math.abs((x.fatigue || 0) - fNow) <= 3;
  // Bodyweight lifts: each session uses your bodyweight from that day when known.
  const bwOf = s => s.bw || bw;
  // Each session's strength as if done fresh (undoing how tired the muscle
  // was from earlier lifts that day), so sessions at different points in a
  // workout compare fairly.
  const rate = learnFatigueRate(valid.slice(-12).map(s => ({
    t: new Date(s.date).getTime() / DAY, e1rm: sessionE1RM(s, ex, bwOf(s)), f: s.fatigue,
  })), opts.fatigueRate || DEFAULT_FATIGUE_RATE);
  const fresh = s => sessionE1RM(s, ex, bwOf(s)) / fatigueFactor(s.fatigue, rate);
  // The session to build on. Where a lift sits in the workout changes what you
  // can do (earlier lifts tire it), so a recent session at a similar point is
  // the best guide: within the last 4 sessions and 3 weeks, and still current. Otherwise your latest session. Then, if that was a clearly bad
  // day (more than ~5% below your best of the last 2-3 sessions, about the size
  // of normal day-to-day swings), the goal is to get back to that best session.
  const latest0 = valid[valid.length - 1];
  const twin = !isSimilar(latest0) ? [...valid.slice(-4)].reverse().find(isSimilar) : null;
  // (If your latest session was done at least as tired and you still lifted
  // more, that earlier session is out of date: compared on what you lifted.)
  const outdated = twin && (latest0.fatigue || 0) >= (twin.fatigue || 0) && sessionE1RM(latest0, ex, bwOf(latest0)) > sessionE1RM(twin, ex, bwOf(twin));
  const latest = twin && !outdated && new Date(latest0.date) - new Date(twin.date) <= 21 * DAY ? twin : latest0;
  // Bad days are judged against sessions done at a similar point in a workout
  // (your last 3 of those within the last 4): comparing a tired-day session
  // with a fresh one leans on the fatigue estimate, and an underestimate would
  // call every tired day "bad" and set goals from a fresh day.
  const nearLatest = x => Math.abs((x.fatigue || 0) - (latest.fatigue || 0)) <= 3;
  const recentPool = valid.slice(-4).filter(nearLatest).slice(-3).filter(x => new Date(latest.date) - new Date(x.date) <= 42 * DAY);
  const bestRecent = recentPool.reduce((a, b) => (fresh(b) > fresh(a) ? b : a), latest);
  const heavierOrSame = (a, b) => Math.max(...workingSets(a).map(x => x.weight || 0)) >= Math.max(...workingSets(b).map(x => x.weight || 0));
  // A bad day shows in what you actually lifted too, not only after the
  // fatigue adjustment (which is an estimate).
  const badDay = fresh(latest) < 0.95 * fresh(bestRecent) && sessionE1RM(latest, ex, bwOf(latest)) < sessionE1RM(bestRecent, ex, bwOf(bestRecent))
    && heavierOrSame(bestRecent, latest);
  const last = badDay ? bestRecent : latest;
  let lastSets = workingSets(last);
  // Shown on the card when the goals come from a session other than your latest.
  const basedOn = last !== latest0 ? { basedOn: { date: last.date, why: badDay ? 'best' : 'position', sets: workingSets(last).map(x => ({ weight: x.weight || 0, reps: x.reps, done: true })) } } : {};
  // A heavy one-off (a 1-3 rep test set) above the weight you used for most
  // sets isn't your working weight; leave it out of the set pattern.
  if (!(isBW || assisted)) {
    const ww = workWeightOf(lastSets);
    const core = lastSets.filter(s => !((s.weight || 0) > ww && s.reps < zMin - 2));
    if (core.length) lastSets = core;
  }
  const topWeight = Math.max(...lastSets.map(s => s.weight || 0));
  // Sets at clearly different weights (pyramid, top set + back-off sets): keep
  // that pattern and progress each set from what it did, instead of asking for
  // every set at the heaviest weight.
  const weightsUsed = lastSets.map(s => s.weight || 0);
  const shape = !(isBW || assisted) && lastSets.length > 1 && Math.max(...weightsUsed) - Math.min(...weightsUsed) > inc + 1e-9 ? lastSets : null;
  // No weight was entered (only bodyweight lifts can be done at 0 lb).
  if (!bwLoad && !(topWeight > 0)) return null;
  // Plan your usual number of sets, so one short day doesn't stick.
  const n = Math.min(8, Math.max(1, ...valid.slice(-3).map(s => (s === last ? lastSets.length : workingSets(s).length))));
  const drop = fatigueDrop(lastSets);
  // Planned drop-off: at most 1.5 reps a set (12, 11, 9, 8), the same line the
  // move-up rule uses, so a pattern you hit always counts as ready.
  const plannedDrop = Math.min(MAX_DROP, drop);
  const loadOf = w => (bwLoad ? Math.max(0, bw + w) : w);
  // Assisted: a lighter session means more assistance, worked out on total load.
  const lighter = (frac, round) => (assisted ? Math.min(0, round(frac * (bw + topWeight) - bw, inc)) : Math.max(0, round(topWeight * frac, inc)));
  let est = 0;
  let note = '';
  let fatigue = null;

  // Most reps done in one set at `weight` or heavier in recent sessions —
  // sessions at a similar point in a workout when there are any, since a
  // fresh-day 12 doesn't prove a tired day can handle the next weight.
  // Most reps at `weight` or heavier in recent sessions, at a similar point in
  // a workout when there are any (a fresh-day 12 doesn't prove a tired day can
  // handle the next weight).
  const bestRepsAt = weight => {
    const recent = valid.slice(-6);
    const peers = recent.filter(isSimilar);
    // No session at a similar point: only ones done at least as tired as today count.
    const pool = peers.length ? peers : recent.filter(x => (x.fatigue || 0) >= fNow - 3);
    let best = 0;
    for (const s of pool) for (const x of workingSets(s)) if ((x.weight || 0) >= weight) best = Math.max(best, x.reps);
    return best;
  };

  // Most reps done at `weight` or heavier the last time this lift was done at
  // a similar point in a workout (similar fatigue), or 0 if none.
  const similarSession = () => last;
  // Most reps at `weight` or heavier in that similar session.
  const similarBest = weight => {
    const sim = similarSession();
    return sim ? Math.max(0, ...workingSets(sim).filter(x => (x.weight || 0) >= weight).map(x => x.reps)) : 0;
  };
  // Per set, what you managed where that same set fell short of its target at
  // this weight (the target was too much); null where it hit. Each set is
  // capped by its own result: 10, 10, 7 against 10s keeps the first sets
  // climbing and asks the third for at most a rep more than 7.
  const similarShortfalls = weight => {
    const sim = similarSession();
    if (!sim) return [];
    // Only this same weight (falling short heavier says nothing about lighter).
    return workingSets(sim).map(x => (Math.abs((x.weight || 0) - weight) < 1e-9 && x.target?.reps && x.reps < x.target.reps ? x.reps : null));
  };

  // bonus: reps asked for beyond the estimate (1 when progressing by reps).
  const build = (weight, first, kind, reason, bonus = 0) => {
    // Safety cap: if you fell short at this weight last time you were this
    // fresh/tired, ask for at most one rep more than you managed (two if you
    // rated it Easy). Hitting every target means there's nothing to cap.
    const seen = similarShortfalls(weight);
    const room = similarSession()?.difficulty === 'easy' ? 2 : 1;
    if (seen[0] > 0 && first > seen[0] + room) first = seen[0] + room;
    // Later sets: at most 1.5 reps fewer per set and never below the growth range.
    // With 2-3 min rests reps hold within a rep or two across sets; bigger
    // drop-offs mostly mean short rests (Willardson & Burkett 2005, 2006).
    const floor = Math.max(1, Math.min(first, zMin));
    const reps = [];
    for (let i = 0; i < n; i++) {
      const r = Math.max(floor, Math.round(first - plannedDrop * i));
      const capped = seen[i] > 0 ? Math.min(r, seen[i] + room) : r;
      reps.push(i ? Math.min(capped, reps[i - 1]) : capped);
    }
    // The fatigue explanation is kept separate so the app can show it only on request.
    return { weight: assisted ? Math.min(0, weight) : Math.max(0, weight), reps, kind, reason, fatigueNote: note, est, drop: plannedDrop, bonus, fatigue, zone, ...basedOn };
  };

  // Bodyweight lift with no bodyweight logged: total load is unknown, so
  // progress reps at the same added weight.
  if (assisted && !bw) {
    const best = Math.max(...lastSets.map(s => s.reps));
    if (best >= zMax && topWeight < 0) {
      const w = Math.min(0, topWeight + inc);
      return build(w, zMin + 2, 'up', `Hit ${best} reps — less assistance (${fw(-w)}). Log bodyweight in Health for smarter targets.`);
    }
    return build(topWeight, Math.min(zMax, best + 1), 'reps', `Beat last time by a rep (best was ${best}).`);
  }
  if (isBW && !bw) {
    const best = Math.max(...lastSets.map(s => s.reps));
    if (best >= zMax + 3) {
      return build(topWeight + inc, zMax - 2, 'up', `Hit ${best} reps — try adding ${fw(inc)}. Log bodyweight in Health for smarter targets.`);
    }
    return build(topWeight, best + 1, 'reps', `Beat last time by a rep (best was ${best}).`);
  }

  // Strength estimate. A better session counts in full; a worse one is
  // softened by the session before so one bad day doesn't overreact.
  // Predicting today: a recent session (last 4) done at a similar point in a
  // workout is the best evidence of what you manage at this point; the fatigue
  // estimate only bridges the gap when there isn't one. (This predicts reps;
  // the weight and set pattern come from your latest session.)
  const simBase = last;
  est = fresh(simBase);
  // The session before it, preferring one at a similar point too.
  const before = valid.slice(0, valid.indexOf(simBase));
  const prevSession = [...before].reverse().find(isSimilar) || before[before.length - 1];
  if (prevSession) {
    const prev = fresh(prevSession);
    if (prev > est) est = 0.75 * est + 0.25 * prev;
  }
  // One weaker session can't pull the estimate far below what you showed
  // recently (at a similar point in the workout when there's history for it).
  const peers = valid.slice(-6).filter(isSimilar);
  est = Math.max(est, 0.95 * Math.max(...(peers.length ? peers.slice(-2) : recentPool).map(fresh)));
  // And a looser floor from any recent session, so one disastrous day at
  // this position can't start a downward spiral.
  est = Math.max(est, 0.9 * Math.max(...valid.slice(-3).map(fresh)));
  if (last.difficulty === 'easy') est *= 1.025;
  if (last.difficulty === 'too_hard') est *= 0.975;

  const nowFactor = fatigueFactor(opts.fatigue, rate);
  const lastFactor = fatigueFactor(last.fatigue, rate);
  est *= nowFactor;
  fatigue = { now: nowFactor, last: lastFactor, rate };
  const shift = Math.round((nowFactor / lastFactor - 1) * 100);
  if (shift <= -3) note = `Adjusted about ${-shift}% lower than last time because of the lifts before it today.`;
  else if (shift >= 3) note = `Adjusted about ${shift}% higher than last time because it comes earlier in today's workout.`;

  // Per-set plan for a mixed-weight session. frac < 1 (break, deload): every
  // set lighter, same reps. Otherwise each set gets one more rep, and a set
  // that reached the top of the range moves up a step.
  const shaped = (frac, kind, reason) => {
    const weights = [], reps = [];
    for (const s of shape) {
      let w = frac < 1 ? Math.max(inc, roundTo((s.weight || 0) * frac, inc)) : s.weight || 0;
      let r;
      if (frac < 1) r = Math.min(zMax, s.reps);
      else if (s.reps >= zMax) {
        // That set's own strength (fatigue from earlier sets included).
        const e1 = epley(loadOf(w), s.reps);
        w += inc;
        r = Math.max(zMin - 2, Math.min(zMax, Math.round(repsAt(e1, loadOf(w))) + 1));
      } else r = s.reps + (shift <= -3 ? 0 : 1);
      weights.push(w); reps.push(r);
    }
    return { weight: weights[0], weights, reps, kind, reason, fatigueNote: note, est, drop: plannedDrop, bonus: 1, fatigue, zone, ...basedOn };
  };

  const gapDays = (now - new Date(lastDate).getTime()) / DAY;
  if (gapDays > 14) {
    const f = breakFactor(gapDays);
    est *= f + 0.03;
    const why = `${Math.round(gapDays)} days since last time — easing back in about ${Math.round((1 - f) * 100)}% lighter.`;
    if (shape) return shaped(f, 'break', why);
    const w = lighter(f, roundTo);
    const t = Math.min(zMax, Math.max(zMin, Math.round(repsAt(est, loadOf(w)))));
    return build(w, t, 'break', why);
  }

  // Two missed sessions in a row -> deload. A session only counts when your
  // actual strength also dropped (below 97% of the best of the 3 sessions
  // before it) — an ambitious target on a normal day isn't a reason to back
  // off. Only sessions after the latest deload week count.
  const lastDeload = [...usable].reverse().find(s => s.deload)?.date || '';
  const weaker = i => {
    const before = valid.slice(Math.max(0, i - 3), i).map(fresh);
    return !before.length || fresh(valid[i]) < 0.97 * Math.max(...before);
  };
  const missedStreak = (() => {
    let c = 0;
    for (let i = valid.length - 1; i >= 0 && valid[i].date > lastDeload && sessionMissed(valid[i]) && weaker(i); i--) c++;
    return c;
  })();
  if (missedStreak >= 2 && shape) return shaped(0.9, 'deload', 'Missed targets 2 sessions in a row — lighter weight to rebuild.');
  if (missedStreak >= 2 && (topWeight > 0 || assisted)) {
    const w = lighter(0.9, floorTo);
    const t = Math.min(zMax, Math.max(zMin, Math.round(repsAt(est, loadOf(w)))));
    return build(w, t, 'deload', 'Missed targets 2 sessions in a row — lighter weight to rebuild.');
  }

  // Stalled: the last 3 sessions didn't beat the best of the ones before AND
  // you're missing goals (2 of the last 3 sessions had a set short of its goal).
  // Hitting your goals is progress, never a stall.
  const fr = valid.map(fresh);
  // Fell short of a goal, or logged without goals (then a flat session counts).
  const short = x => { const g = workingSets(x).filter(y => y.target?.reps); return !g.length || g.some(y => y.reps < y.target.reps); };
  // On a cut, keeping your strength is the realistic goal (muscle gain is
  // impaired in a calorie deficit, strength much less: Murphy & Koehler 2022),
  // so holding steady is never called a stall.
  const cutting = opts.phase === 'cut';
  const stalled = !cutting && valid.length >= 5 && Math.max(...fr.slice(-3)) <= 1.005 * Math.max(...fr.slice(0, -3).slice(-6))
    && valid.slice(-3).filter(short).length >= 2 && short(latest);
  if (shape) {
    const out = shaped(1, 'reps', 'Same set pattern as last time: one more rep per set, and a step up on sets that reached the top of the range.');
    return stalled ? { ...out, stalled: true } : out;
  }

  let w = topWeight;
  // Goals come from the reps you actually logged in the baseline session: one
  // more on the first set (after a bad day: get back to the good session).
  // Today's conditions adjust only the reps: later in the workout than last
  // time (tired from earlier lifts) asks for fewer, as many as the fatigue
  // estimate says; fresher, lighter bodyweight or an Easy rating, one more at
  // most. They never move the weight by themselves.
  const rB = lastSets[0].reps;
  // Today's position in the workout: a recent session (last 4) done at a
  // similar point and at this weight is real evidence of what you manage
  // here; use it. Otherwise the fatigue estimate adjusts the goal.
  const expect = repsAt(est, loadOf(w));
  const nudge = Math.max(1 - rB - 1, Math.min(1, Math.round(expect - rB)));
  const add = badDay ? 0 : Math.max(0, 1 + nudge);
  let t = Math.max(1, badDay ? rB + Math.min(0, nudge) : rB + 1 + nudge);
  // Weight moves up only when you reached the top of the range on your first
  // set and your reps fell 1.5 a set or less on average (12, 11, 10, 9 yes;
  // 12, 10, 8 or 12, 8, 6 not yet).
  const best = Math.max(...lastSets.map(x => x.reps));
  const behind = lastSets.length > 1 && (best - lastSets.at(-1).reps) / (lastSets.length - 1) > MAX_DROP + 1e-9;
  const ready = rB >= zMax && !behind && !badDay;
  // Not ready to move up: never past the top of the range (12).
  if (!ready && !behind) t = Math.min(t, Math.max(zMax, rB));
  if (ready && t <= zMax) t = zMax + 1;

  // 185 x 12, 8, 6 is far less work than 12, 12, 12: stay at 185 and bring the
  // later sets up first (one more rep each), the first set held at the top.
  if (t > zMax && behind) {
    const first = Math.min(zMax, rB);
    const reps = Array.from({ length: n }, (_, i) => {
      const was = lastSets[Math.min(i, lastSets.length - 1)].reps;
      return Math.max(Math.min(first, zMin), Math.min(first, i === 0 ? first : was + (add ? 1 : 0)));
    });
    // Reps falling 3+ a set on a big lift usually means short rests, not weak muscles.
    const steep = ex.compound && !isBW && drop >= 3;
    const out = build(w, reps[0], 'reps', `Same weight: bring the later sets up first (they fell to ${Math.min(...lastSets.map(x => x.reps))} at ${fw(w)}). Weight goes up once your reps drop about 1-2 a set or less.${steep ? ' Your reps drop a lot between sets: rest 2-3 minutes on this lift.' : ''}`, 1);
    return { ...out, reps, ...(steep ? { restTip: true } : {}) };
  }

  if (t > zMax && assisted && w >= 0) {
    return build(0, zMax, 'reps', 'No assistance needed anymore — time to try the bodyweight version.');
  }
  up: if (t > zMax) {
    // Move up in weight until reps fall back inside the zone, but never more
    // than ~10% in one session (at least one step). Assisted: never past zero.
    const maxW = assisted ? Math.min(0, w + inc) : Math.max(w + inc, floorTo(w * 1.1, inc));
    // Big compound lifts in the muscle range (6-12) restart near 8 reps after
    // reaching 12: a jump of up to ~10%, then build back up. More time at
    // heavier weights builds strength, and sets end because the muscle is
    // done, not from breathing or form at high reps. Isolation lifts and the
    // strength range keep the smallest step.
    const restart = ex.compound && !isBW && !assisted && zMax >= 10;
    const aim = restart ? zMin + 2 : zMax;
    let w2 = w;
    let t2 = t;
    while (t2 > aim && w2 + inc <= maxW + 1e-9) {
      w2 += inc;
      t2 = Math.round(repsAt(est, loadOf(w2)));
    }
    if (!isBW) {
      // Double progression: never suggest a weight you've already done 12
      // reps with recently — go a step past it.
      while (bestRepsAt(w2) >= zMax && (!assisted || w2 + inc <= 0)) w2 += inc;
      t2 = Math.round(repsAt(est, loadOf(w2)));
    }
    // Earned the jump, but this lift is clearly later in today's workout than
    // when you earned it and the new weight wouldn't reach the range: same
    // weight today, move up next time.
    if (!isBW && w2 !== w && shift <= -3 && t2 < zMin - 1) {
      if (Math.round(expect) >= zMin) {
        return build(w, Math.min(zMax, Math.round(expect)), 'hold', "Ready to move up, but this lift comes later in today's workout: same weight today, up next time.", 0);
      }
      // Too tired today even for this weight: the lighter-day rule below.
      t = Math.round(expect);
      break up;
    }
    t2 = Math.min(zMax, t2);
    // Already done these reps at this weight recently? Ask for one more.
    const done = bestRepsAt(w2);
    if (t2 <= done) t2 = Math.min(zMax, done + 1);
    if (t2 >= zMin) {
      return build(w2, t2, 'up', assisted ? `Top of the rep range last time — less assistance (${fw(-w2)}).`
        : restart && t2 <= zMin + 3 ? `Top of the rep range last time — up to ${fw(w2)}: start near ${zMin + 2} reps and build back to ${zMax}.` : `Top of the rep range last time — up to ${fw(w2)}.`);
    }
    // Small isolation lift with a big next step (15 -> 20 lb lateral raises is
    // +33%): add reps up to 15 first. Growth is similar across a wide rep range
    // when sets are hard (Schoenfeld et al. 2017), and the jump lands better.
    const ext = zMax + 3;
    if (!isBW && !assisted && !ex.compound && w > 0 && (w2 - w) / w > 0.15 && bestRepsAt(w) < ext) {
      // One more than last time, fewer if you're more tired today.
      const r = Math.min(ext, Math.max(zMin, rB + 1 + nudge));
      return { ...build(w, r, 'reps', `Next weight is a big jump (+${Math.round(((w2 - w) / w) * 100)}%) — add reps up to ${ext} first. A smaller step for this lift helps if your gym has one.`, 1), zone: [zMin, ext], bigJump: true };
    }
    if (!isBW) {
      // Weighted lifts never go past 12, even when the next weight is a big
      // jump (small dumbbells): move up and start a little lower in the range.
      return build(w2, Math.max(zMin - 2, t2), 'up', assisted ? `Hit ${zMax} reps — less assistance (${fw(-w2)}), fewer reps to start.` : `Hit ${zMax} reps — up to ${fw(w2)}, fewer reps to start.`);
    }
    if (t > hardCap) {
      return build(w + inc, zMin, 'up', `Reps are very high — up ${fw(inc)}, reset to ${zMin} reps.`);
    }
    return build(w, t, 'reps', `Next weight is a big jump for this lift — add reps first.`);
  }

  // Today's prediction is well below the range (much more tired than usual):
  // lighter so the sets stay in the growth range.
  if (t < zMin) {
    // Too heavy for the zone: come down until it fits.
    let w2 = w;
    // A lighter day: aim at what the estimate says (no extra rep).
    let t2 = Math.round(repsAt(est, loadOf(w)));
    while (t2 < zMin && (assisted ? w2 - inc > -bw : w2 - inc > 0)) {
      // Don't drop to a weight you've already done 12 reps with — that's too
      // easy to grow from. Stay heavier with slightly fewer reps instead.
      // Only when the heavier weight is still achievable, and the 12 reps were
      // done at a similar point in a workout (a fresh-day 12 doesn't count).
      // (Any recent session counts: right after moving up from 15 lateral raises at
      // 20 lb to 25 lb, the 25 lb session alone would send you back to 20.)
      if (!isBW && t2 >= zMin - 2 && Math.max(similarBest(w2 - inc), bestRepsAt(w2 - inc)) >= zMax) break;
      w2 -= inc;
      t2 = Math.round(repsAt(est, loadOf(w2)));
    }
    if (w2 !== w) {
      // Still one rep beyond the estimate, so lighter days keep progressing too.
      return build(w2, Math.min(zMax, Math.max(zMin, t2)), 'down', `Below ${zMin} reps — lighter so you can work in the growth range.`, 0);
    }
  }

  const missedLast = sessionMissed(last);
  // When the target sits below last time's reps (it comes later in today's
  // workout), don't claim it's "one more than last time".
  const reason = badDay
    ? 'Last time was lighter or an off day: back to your best recent session.'
    : missedLast
      ? 'Missed some targets — same weight, adjusted reps.'
      : shift <= -3 ? 'Same weight — go for every rep.'
        : cutting ? 'On a cut: matching last time keeps your strength and muscle; add a rep if you have it.' : 'Same weight, beat last time by a rep.';
  const out = build(w, t, missedLast ? 'hold' : 'reps', reason, 1);
  return stalled ? { ...out, stalled: true } : out;
}

// Rep target for one set when the lifter changes the weight mid-workout.
// Returns null when the suggestion has no strength estimate to work from.
export function targetFor(sug, ex, weight, setIndex, bw) {
  if (ex.timed) return sug?.reps?.[setIndex] ?? sug?.reps?.at(-1) ?? null;
  if (!sug || !sug.est) return null;
  const load = loadFor(ex, weight, bw);
  if (load <= 0) return null;
  const reps = repsAt(sug.est, load) + (sug.bonus || 0) - (sug.drop || 0) * setIndex;
  return Math.min((sug.zone || zoneFor(ex))[1], Math.max(1, Math.round(reps)));
}

/**
 * A working set that landed 2+ reps off its goal: today's estimate from that
 * set, so the remaining sets follow what you can do today. Use with targetFor,
 * counting set indexes from the next set (0). Returns null when on target.
 */
export function retargetFrom(sug, ex, set, bw) {
  if (ex.timed || !set?.target?.reps || !(set.reps > 0) || Math.abs(set.reps - set.target.reps) < 2) return null;
  const load = loadFor(ex, set.weight, bw);
  if (!(load > 0)) return null;
  // At least a rep lost per set after a set that went off plan.
  const drop = Math.max(1, sug?.drop ?? 1);
  // Goals ask for about one rep more than you've shown, so a set is about one short of your max.
  return { est: epley(load, set.reps + 1), drop, bonus: -drop, zone: sug?.zone || zoneFor(ex) };
}

/**
 * First time doing a lift: once the first working set is logged, estimate
 * strength from it (assuming ~2 reps were left in reserve, as the guidance
 * asks) so the remaining sets get sensible targets at that weight.
 */
export function calibrationFrom(ex, set, bw, zone) {
  if (ex.timed) return null;
  const load = loadFor(ex, set.weight, bw);
  if (!(load > 0) || !(set.reps > 0)) return null;
  return {
    weight: set.weight || 0, reps: [], kind: 'calibrate', reason: 'Based on your first set today.',
    // bonus -1: the second set aims to match the first, later sets drop a rep each.
    est: epley(load, set.reps + 2), drop: 1, bonus: -1, zone: zone || zoneFor(ex),
  };
}

// Ramp-up sets before the first working set. Barbell warm-ups never go
// below the empty bar.
export function warmupSets(ex, workWeight, inc, barWeight = 45) {
  if (!(workWeight > 0)) return [];
  const bar = ex.equipment === 'barbell' ? barWeight : 0;
  const steps = bar && workWeight >= 95 ? [[0.4, 10], [0.6, 5], [0.8, 3]] : [[0.5, 10], [0.75, 5]];
  const out = [];
  for (const [p, reps] of steps) {
    const w = Math.max(bar, Math.round((workWeight * p) / inc) * inc);
    if (w <= 0 || w >= workWeight || out.at(-1)?.weight === w) continue;
    out.push({ weight: w, reps });
  }
  return out;
}

// Rough weight conversion when swapping to a lift on other equipment.
const SWAP_FACTOR = {
  barbell: { barbell: 0.9, dumbbell: 0.4, cable: 0.8, machine: 1 },
  dumbbell: { barbell: 2.2, dumbbell: 0.9, cable: 1.8, machine: 2 },
  cable: { barbell: 1.1, dumbbell: 0.5, cable: 0.9, machine: 1 },
  machine: { barbell: 0.9, dumbbell: 0.45, cable: 1, machine: 0.9 },
};

// Newer equipment types convert like their closest classic type. Plate-loaded
// machines count the plates only, roughly like a pin machine.
const SWAP_CLASS = { smith: 'barbell', ez_bar: 'barbell', trap_bar: 'barbell', kettlebell: 'dumbbell', plate_loaded: 'machine' };
const swapClass = eq => SWAP_CLASS[eq] || eq;

/**
 * A deload week's version of a suggestion: about 15% less load and about 40%
 * fewer sets (a third to a half less volume), so fatigue drops while strength
 * holds (Coleman et al. 2024; Bell et al. 2023). Assisted machines get more
 * assistance, not less.
 */
export const DELOAD_LOAD = 0.85;
export const DELOAD_SETS = 0.6;
export const deloadSetCount = n => Math.max(1, Math.round(n * DELOAD_SETS));
export function deloadSuggestion(sug, ex, inc, bw = 0) {
  const w = ex.equipment === 'assisted'
    ? Math.min(0, Math.round((DELOAD_LOAD * ((bw || 0) + sug.weight) - (bw || 0)) / inc) * inc)
    : Math.max(0, Math.round((sug.weight * DELOAD_LOAD) / inc) * inc);
  const n = deloadSetCount(sug.reps.length);
  const scale = x => (ex.equipment === 'assisted' ? x : Math.max(0, Math.round((x * DELOAD_LOAD) / inc) * inc));
  return {
    ...sug, weight: w, reps: sug.reps.slice(0, n), ...(sug.weights ? { weights: sug.weights.slice(0, n).map(scale) } : {}),
    // Scaled with the load, so changing the weight still gives a sensible goal.
    est: (sug.est || 0) * DELOAD_LOAD, kind: 'deloadWeek',
    reason: 'Deload week: about 15% lighter and fewer sets, so you recover and come back stronger.',
  };
}

export function swapWeight(fromEx, toEx, weight, inc) {
  const f = SWAP_FACTOR[swapClass(fromEx.equipment)]?.[swapClass(toEx.equipment)];
  if (!f || !(weight > 0)) return null;
  return Math.max(inc, Math.round((weight * f) / inc) * inc);
}

/**
 * Rest before the next set, in seconds. Your own setting for a lift wins.
 * Otherwise heavy multi-joint lifts rest longer than isolation work: longer
 * rests keep reps up on the next set and build more muscle and strength
 * (Schoenfeld 2016; Singer 2024). Strength-range sets (3-6 reps) get 3 minutes.
 */
export function restSeconds(ex, { own = null, base = 90, zone = null } = {}) {
  if (own != null) return own;
  if (zone && zone[1] <= 6) return Math.max(base, 180);
  if (ex.compound && !usesBodyweight(ex)) return Math.max(base, 120);
  return base;
}
