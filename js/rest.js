// Learns, for each lift, how much rest keeps your reps up from one set to the
// next, using the times you ticked your sets. Pure functions, no storage.
//
// Why: rest longer than ~60 s grows a little more muscle, most likely because
// reps (volume load) hold up better (Singer et al. 2024); 3 min keeps reps far
// better than 1 min (Willardson & Burkett 2005, 2006). How much rest that
// takes differs between people and lifts, so it's learned per lift.
import { workingSets, MAX_DROP } from './engine.js';

// A set takes about 3 s a rep plus ~10 s to get set (rep durations of
// 0.5-8 s all build muscle; 2-4 s is typical: Schoenfeld et al. 2015).
export const REP_SECONDS = 3;
export const SET_SETUP = 10;
export const setSeconds = reps => SET_SETUP + REP_SECONDS * reps;

// Research limits for any learned rest: big lifts 2-4 min (Schoenfeld 2016),
// isolation 1-3 min (more than 60 s helps, past ~90 s unclear: Singer 2024).
export const REST_BOUNDS = { compound: [120, 240], isolation: [60, 180] };
const MIN_GAP = 30, MAX_GAP = 480;

/**
 * (rest, reps lost) pairs for one lift: consecutive working sets at the same
 * weight, outside supersets. Rest = time between ticks minus the set itself,
 * so a late tap or a slow start just counts as rest (it was rest).
 */
export function restPairs(workouts, exId) {
  const out = [];
  for (const w of workouts) {
    for (const e of w.exercises) {
      if (e.exId !== exId || e.group) continue;
      const sets = workingSets(e).filter(s => s.doneAt);
      for (let i = 1; i < sets.length; i++) {
        const a = sets[i - 1], b = sets[i];
        if ((a.weight || 0) !== (b.weight || 0)) continue;
        const rest = (new Date(b.doneAt) - new Date(a.doneAt)) / 1000 - setSeconds(b.reps);
        if (rest < MIN_GAP || rest > MAX_GAP) continue;
        out.push({ rest, drop: a.reps - b.reps });
      }
    }
  }
  return out;
}

/**
 * Reps lost per set = a - b * ln(rest seconds), least squares. null without
 * 8+ pairs, rests that vary by at least 45 s, or no sign that rest helps.
 */
export function fitRest(pairs) {
  if (pairs.length < 8) return null;
  const rests = pairs.map(p => p.rest);
  if (Math.max(...rests) - Math.min(...rests) < 45) return null;
  const xs = rests.map(Math.log), ys = pairs.map(p => p.drop);
  const n = xs.length;
  const mx = xs.reduce((s, x) => s + x, 0) / n, my = ys.reduce((s, y) => s + y, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  const b = -sxy / sxx;
  if (!(b > 0.2)) return null;
  return { a: my + b * mx, b, n };
}

const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const kindOf = ex => (ex.compound ? 'compound' : 'isolation');

/**
 * Learned rest per lift: the shortest rest predicted to keep reps within 1.5 a
 * set, inside the research limits, rounded to 15 s. Uses the lift's own sets
 * when there are enough, else all your big lifts or all your small lifts
 * together. Only for lifts you've done 3+ timed set pairs of.
 * Returns { exId: { rest, source: 'lift' | 'group', n, usualRest, usualDrop } }.
 */
export function learnRests(workouts, lookup) {
  const byEx = {};
  for (const w of workouts) for (const e of w.exercises) if (!byEx[e.exId]) byEx[e.exId] = restPairs(workouts, e.exId);
  const groups = { compound: [], isolation: [] };
  for (const [id, pairs] of Object.entries(byEx)) {
    const ex = lookup(id);
    if (!ex || ex.timed || ex.unknown) continue;
    groups[kindOf(ex)].push(...pairs);
  }
  const groupFit = { compound: fitRest(groups.compound), isolation: fitRest(groups.isolation) };
  const out = {};
  for (const [id, pairs] of Object.entries(byEx)) {
    const ex = lookup(id);
    if (!ex || ex.timed || ex.unknown || pairs.length < 3) continue;
    const own = fitRest(pairs);
    const fit = own || groupFit[kindOf(ex)];
    if (!fit) continue;
    const [lo, hi] = REST_BOUNDS[kindOf(ex)];
    const raw = Math.exp((fit.a - MAX_DROP) / fit.b);
    const rest = Math.round(Math.min(hi, Math.max(lo, raw)) / 15) * 15;
    out[id] = { rest, source: own ? 'lift' : 'group', n: own ? pairs.length : fit.n, usualRest: Math.round(median(pairs.map(p => p.rest))), usualDrop: median(pairs.map(p => p.drop)) };
  }
  return out;
}
