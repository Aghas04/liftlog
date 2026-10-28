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

export function zoneFor(ex) {
  return ex.compound ? [6, 12] : [8, 15];
}

export function workingSets(session) {
  return (session.sets || []).filter(s => s.done && !s.warmup && s.reps > 0);
}

export function sessionMissed(session) {
  const sets = workingSets(session).filter(s => s.target && s.target.reps > 0);
  if (!sets.length) return false;
  const missed = sets.filter(s => s.reps < s.target.reps && s.weight >= (s.target.weight ?? 0)).length;
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

/**
 * @param ex        exercise { equipment, compound, increment? }
 * @param history   past sessions for this exercise, oldest first:
 *                  { date: ISO, difficulty?: 'easy'|'hard'|'too_hard', sets: [...] }
 * @param opts      { bodyweight?: number, now?: number, increment: number }
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

  const valid = history.filter(s => workingSets(s).length);
  if (!valid.length) return null;
  const last = valid[valid.length - 1];
  const lastSets = workingSets(last);
  const topWeight = Math.max(...lastSets.map(s => s.weight || 0));
  const n = Math.min(8, Math.max(1, lastSets.length));
  const drop = fatigueDrop(lastSets);
  const loadOf = w => (isBW ? bw + w : w);
  let est = 0;

  // bonus: reps asked for beyond the estimate (1 when progressing by reps).
  const build = (weight, first, kind, reason, bonus = 0) => {
    const reps = [];
    for (let i = 0; i < n; i++) reps.push(Math.max(1, Math.round(first - drop * i)));
    return { weight: Math.max(0, weight), reps, kind, reason, est, drop, bonus };
  };

  // Bodyweight lift with no bodyweight logged: progress reps only.
  if (isBW && !bw && topWeight === 0) {
    const best = Math.max(...lastSets.map(s => s.reps));
    if (best >= zMax + 3) {
      return build(5, zMax - 2, 'up', `Hit ${best} reps — try adding 5 lb. Log bodyweight in Health for smarter targets.`);
    }
    return build(0, best + 1, 'reps', `Beat last time by a rep (best was ${best}).`);
  }

  // Strength estimate. A better session counts in full; a worse one is
  // softened by the session before so one bad day doesn't overreact.
  est = sessionE1RM(last, ex, bw);
  if (valid.length >= 2) {
    const prev = sessionE1RM(valid[valid.length - 2], ex, bw);
    if (prev > est) est = 0.75 * est + 0.25 * prev;
  }
  if (last.difficulty === 'easy') est *= 1.025;
  if (last.difficulty === 'too_hard') est *= 0.975;

  const gapDays = (now - new Date(last.date).getTime()) / DAY;
  if (gapDays > 14) {
    est *= 0.93;
    const w = Math.max(0, roundTo(topWeight * 0.9, inc));
    const t = Math.min(zMax, Math.max(zMin, Math.round(repsAt(est, loadOf(w)))));
    return build(w, t, 'break', `${Math.round(gapDays)} days since last time — easing back in.`);
  }

  // Two missed sessions in a row -> deload.
  const missedStreak = (() => {
    let c = 0;
    for (let i = valid.length - 1; i >= 0 && sessionMissed(valid[i]); i--) c++;
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
    // Move up in weight until reps fall back inside the zone.
    let w2 = w;
    let t2 = t;
    while (t2 > zMax) {
      w2 += inc;
      t2 = Math.round(repsAt(est, loadOf(w2)));
    }
    if (t2 >= zMin) {
      return build(w2, t2, 'up', `Top of the rep range last time — up ${w2 - w} lb.`);
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
      w2 -= inc;
      t2 = Math.round(repsAt(est, loadOf(w2)));
    }
    if (w2 !== w) {
      return build(w2, Math.min(zMax, Math.max(zMin, t2)), 'down', `Below ${zMin} reps — lighter so you can work in the growth range.`);
    }
  }

  const missedLast = sessionMissed(last);
  const reason = missedLast
    ? 'Missed some targets — same weight, adjusted reps.'
    : `Same weight, beat last time by a rep.`;
  return build(w, t, missedLast ? 'hold' : 'reps', reason, 1);
}

// Rep target for one set when the lifter changes the weight mid-workout.
// Returns null when the suggestion has no strength estimate to work from.
export function targetFor(sug, ex, weight, setIndex, bw) {
  if (!sug || !sug.est) return null;
  const load = ex.equipment === 'bodyweight' ? (bw || 0) + (weight || 0) : weight || 0;
  if (load <= 0) return null;
  const reps = repsAt(sug.est, load) + (sug.bonus || 0) - (sug.drop || 0) * setIndex;
  return Math.max(1, Math.round(reps));
}
