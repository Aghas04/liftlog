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
export function zoneFor(ex) {
  if (ex.equipment === 'bodyweight') return [6, 20];
  return ex.compound ? [6, MAX_REPS] : [8, MAX_REPS];
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
  const isBW = ex.equipment === 'bodyweight';
  let best = 0;
  for (const s of workingSets(session)) {
    const load = isBW ? (bw || 0) + (s.weight || 0) : s.weight || 0;
    if (load > 0) best = Math.max(best, epley(load, s.reps));
  }
  return best;
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
 * @param opts      { bodyweight?: number, now?: number, increment: number, fatigue?: number, fatigueRate?: number }
 *                  fatigue = how tired this muscle will be at this point of today's workout
 *                  fatigueRate = the lifter's personal rate, the starting point for this lift
 * @returns null when there is no usable history, else
 *          { weight, reps: number[], kind, reason }
 */
export function suggest(ex, history, opts) {
  const inc = opts.increment || 5;
  const now = opts.now ?? Date.now();
  const isBW = ex.equipment === 'bodyweight';
  const bw = opts.bodyweight || 0;
  const [zMin, zMax] = zoneFor(ex);
  const hardCap = zMax + 5;

  const usable = history.filter(s => workingSets(s).length);
  if (!usable.length) return null;
  // Deload sessions are deliberately light; ignore them unless that's all there is.
  const valid = usable.some(s => !s.deload) ? usable.filter(s => !s.deload) : usable;
  const lastDate = usable[usable.length - 1].date;
  // Compare like with like: if this lift was done recently at a similar point
  // in a workout (similar fatigue), that session is the baseline. The fatigue
  // model only has to bridge the gap when there's no similar session.
  const fNow = opts.fatigue || 0;
  const isSimilar = x => Math.abs((x.fatigue || 0) - fNow) <= 3;
  const last = [...valid.slice(-4)].reverse().find(isSimilar) || valid[valid.length - 1];
  const lastSets = workingSets(last);
  const topWeight = Math.max(...lastSets.map(s => s.weight || 0));
  // No weight was entered (only bodyweight lifts can be done at 0 lb).
  if (!isBW && !(topWeight > 0)) return null;
  // Plan your usual number of sets, so one short day doesn't stick.
  const n = Math.min(8, Math.max(1, ...valid.slice(-3).map(s => workingSets(s).length)));
  const drop = fatigueDrop(lastSets);
  const loadOf = w => (isBW ? bw + w : w);
  let est = 0;
  let note = '';
  let fatigue = null;

  // Most reps done in one set at `weight` or heavier in recent sessions —
  // sessions at a similar point in a workout when there are any, since a
  // fresh-day 12 doesn't prove a tired day can handle the next weight.
  const bestRepsAt = weight => {
    const recent = valid.slice(-6);
    const peers = recent.filter(isSimilar);
    let best = 0;
    for (const s of peers.length ? peers : recent) for (const x of workingSets(s)) if ((x.weight || 0) >= weight) best = Math.max(best, x.reps);
    return best;
  };

  // Most reps done at `weight` or heavier the last time this lift was done at
  // a similar point in a workout (similar fatigue), or 0 if none.
  const similarSession = () => [...valid].reverse().find(isSimilar) || null;
  // Most reps at `weight` or heavier in that similar session.
  const similarBest = weight => {
    const sim = similarSession();
    return sim ? Math.max(0, ...workingSets(sim).filter(x => (x.weight || 0) >= weight).map(x => x.reps)) : 0;
  };
  // Like similarBest, but only from sets that fell short of their target:
  // the most you actually managed when the target was too much.
  const similarShortfall = weight => {
    const sim = similarSession();
    if (!sim) return 0;
    const short = workingSets(sim).filter(x => (x.weight || 0) >= weight && x.target && x.reps < x.target.reps);
    return short.length ? Math.max(...short.map(x => x.reps)) : 0;
  };

  // bonus: reps asked for beyond the estimate (1 when progressing by reps).
  const build = (weight, first, kind, reason, bonus = 0) => {
    // Safety cap: if you fell short at this weight last time you were this
    // fresh/tired, ask for at most one rep more than you managed (two if you
    // rated it Easy). Hitting every target means there's nothing to cap.
    const seen = similarShortfall(weight);
    const room = similarSession()?.difficulty === 'easy' ? 2 : 1;
    if (seen > 0 && first > seen + room) first = seen + room;
    // Later sets follow your usual drop-off, but never collapse to 1-2 reps.
    const floor = Math.max(1, Math.min(first, zMin - 2));
    const reps = [];
    for (let i = 0; i < n; i++) reps.push(Math.max(floor, Math.round(first - drop * i)));
    // The fatigue explanation is kept separate so the app can show it only on request.
    return { weight: Math.max(0, weight), reps, kind, reason, fatigueNote: note, est, drop, bonus, fatigue };
  };

  // Bodyweight lift with no bodyweight logged: total load is unknown, so
  // progress reps at the same added weight.
  if (isBW && !bw) {
    const best = Math.max(...lastSets.map(s => s.reps));
    if (best >= zMax + 3) {
      return build(topWeight + 5, zMax - 2, 'up', `Hit ${best} reps — try adding 5 lb. Log bodyweight in Health for smarter targets.`);
    }
    return build(topWeight, best + 1, 'reps', `Beat last time by a rep (best was ${best}).`);
  }

  // Convert each past session to a "fresh" strength by undoing how tired the
  // muscle was when it was done, then apply today's fatigue at the end.
  const rate = learnFatigueRate(valid.slice(-12).map(s => ({
    t: new Date(s.date).getTime() / DAY, e1rm: sessionE1RM(s, ex, bw), f: s.fatigue,
  })), opts.fatigueRate || DEFAULT_FATIGUE_RATE);
  const fresh = s => sessionE1RM(s, ex, bw) / fatigueFactor(s.fatigue, rate);

  // Strength estimate. A better session counts in full; a worse one is
  // softened by the session before so one bad day doesn't overreact.
  est = fresh(last);
  // The session before the baseline, preferring one at a similar point too.
  const before = valid.slice(0, valid.indexOf(last));
  const prevSession = [...before].reverse().find(isSimilar) || before[before.length - 1];
  if (prevSession) {
    const prev = fresh(prevSession);
    if (prev > est) est = 0.75 * est + 0.25 * prev;
  }
  // One weaker session can't pull the estimate far below what you showed
  // recently (at a similar point in the workout when there's history for it).
  const peers = valid.slice(-6).filter(isSimilar);
  const pool = peers.length ? peers.slice(-2) : valid.slice(-3);
  est = Math.max(est, 0.95 * Math.max(...pool.map(fresh)));
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

  const gapDays = (now - new Date(lastDate).getTime()) / DAY;
  if (gapDays > 14) {
    est *= 0.93;
    const w = Math.max(0, roundTo(topWeight * 0.9, inc));
    const t = Math.min(zMax, Math.max(zMin, Math.round(repsAt(est, loadOf(w)))));
    return build(w, t, 'break', `${Math.round(gapDays)} days since last time — easing back in.`);
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
  if (missedStreak >= 2 && topWeight > 0) {
    const w = Math.max(0, floorTo(topWeight * 0.9, inc));
    const t = Math.min(zMax, Math.max(zMin, Math.round(repsAt(est, loadOf(w)))));
    return build(w, t, 'deload', 'Missed targets 2 sessions in a row — lighter weight to rebuild.');
  }

  let w = topWeight;
  let t = Math.round(repsAt(est, loadOf(w))) + 1;

  if (t > zMax) {
    // Move up in weight until reps fall back inside the zone, but never more
    // than ~10% in one session (at least one step).
    const maxW = Math.max(w + inc, floorTo(w * 1.1, inc));
    let w2 = w;
    let t2 = t;
    while (t2 > zMax && w2 + inc <= maxW + 1e-9) {
      w2 += inc;
      t2 = Math.round(repsAt(est, loadOf(w2)));
    }
    if (!isBW) {
      // Double progression: never suggest a weight you've already done 12
      // reps with recently — go a step past it.
      while (bestRepsAt(w2) >= zMax) w2 += inc;
      t2 = Math.round(repsAt(est, loadOf(w2)));
    }
    t2 = Math.min(zMax, t2);
    // Already done these reps at this weight recently? Ask for one more.
    const done = bestRepsAt(w2);
    if (t2 <= done) t2 = Math.min(zMax, done + 1);
    if (t2 >= zMin) {
      return build(w2, t2, 'up', `Top of the rep range last time — up to ${w2} lb.`);
    }
    if (!isBW) {
      // Weighted lifts never go past 12, even when the next weight is a big
      // jump (small dumbbells): move up and start a little lower in the range.
      return build(w2, Math.max(zMin - 2, t2), 'up', `Hit ${zMax} reps — up to ${w2} lb, fewer reps to start.`);
    }
    if (t > hardCap) {
      return build(w + inc, zMin, 'up', `Reps are very high — up ${inc} lb, reset to ${zMin} reps.`);
    }
    return build(w, t, 'reps', `Next weight is a big jump for this lift — add reps first.`);
  }

  if (t < zMin) {
    // Too heavy for the zone: come down until it fits.
    let w2 = w;
    let t2 = t;
    while (t2 < zMin && w2 - inc > 0) {
      // Don't drop to a weight you've already done 12 reps with — that's too
      // easy to grow from. Stay heavier with slightly fewer reps instead.
      // Only when the heavier weight is still achievable, and the 12 reps were
      // done at a similar point in a workout (a fresh-day 12 doesn't count).
      if (!isBW && t2 >= zMin - 2 && similarBest(w2 - inc) >= zMax) break;
      w2 -= inc;
      t2 = Math.round(repsAt(est, loadOf(w2))) + 1;
    }
    if (w2 !== w) {
      // Still one rep beyond the estimate, so lighter days keep progressing too.
      return build(w2, Math.min(zMax, Math.max(zMin, t2)), 'down', `Below ${zMin} reps — lighter so you can work in the growth range.`, 1);
    }
  }

  const missedLast = sessionMissed(last);
  // When the target sits below last time's reps (it comes later in today's
  // workout), don't claim it's "one more than last time".
  const reason = missedLast
    ? 'Missed some targets — same weight, adjusted reps.'
    : shift <= -3 ? 'Same weight — go for every rep.' : 'Same weight, beat last time by a rep.';
  return build(w, t, missedLast ? 'hold' : 'reps', reason, 1);
}

// Rep target for one set when the lifter changes the weight mid-workout.
// Returns null when the suggestion has no strength estimate to work from.
export function targetFor(sug, ex, weight, setIndex, bw) {
  if (!sug || !sug.est) return null;
  const load = ex.equipment === 'bodyweight' ? (bw || 0) + (weight || 0) : weight || 0;
  if (load <= 0) return null;
  const reps = repsAt(sug.est, load) + (sug.bonus || 0) - (sug.drop || 0) * setIndex;
  return Math.min(zoneFor(ex)[1], Math.max(1, Math.round(reps)));
}

// Ramp-up sets before the first working set. Barbell warm-ups never go
// below the empty bar.
export function warmupSets(ex, workWeight, inc) {
  if (!(workWeight > 0)) return [];
  const bar = ex.equipment === 'barbell' ? 45 : 0;
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

export function swapWeight(fromEx, toEx, weight, inc) {
  const f = SWAP_FACTOR[fromEx.equipment]?.[toEx.equipment];
  if (!f || !(weight > 0)) return null;
  return Math.max(inc, Math.round((weight * f) / inc) * inc);
}
