// Match a custom exercise to a library exercise: everything recorded under
// the custom one moves over, so weights and progress carry on as if you'd
// always used the library entry. Pure: returns a new state, the app saves it.

/** What a merge would move: { workouts, sets, templates, inPlan }. */
export function mergePreview(state, fromId) {
  let workouts = 0, sets = 0;
  for (const w of state.workouts || []) {
    const mine = w.exercises.filter(e => e.exId === fromId);
    if (!mine.length) continue;
    workouts++;
    for (const e of mine) sets += e.sets.filter(s => s.done && !s.warmup).length;
  }
  const templates = (state.templates || []).filter(t => t.exercises.some(e => e.exId === fromId)).length;
  const inPlan = !!state.plan && JSON.stringify(state.plan).includes(`"${fromId}"`);
  return { workouts, sets, templates, inPlan };
}

const swapId = (id, fromId, toId) => (id === fromId ? toId : id);
const dedupe = list => [...new Set(list)];

/**
 * Move a custom exercise's history, settings and references to a library
 * exercise, then remove the custom one. Returns { state, moved }.
 * Throws if fromId isn't a custom exercise or toId is the same lift.
 */
export function mergeExercise(state, fromId, toId) {
  const custom = (state.customExercises || []).find(c => c.id === fromId);
  if (!custom) throw new Error('Only custom exercises can be matched');
  if (!toId || toId === fromId) throw new Error('Pick a different exercise to match to');
  const moved = mergePreview(state, fromId);
  const next = JSON.parse(JSON.stringify(state));
  const fix = e => { e.exId = swapId(e.exId, fromId, toId); };

  for (const w of next.workouts || []) w.exercises.forEach(fix);
  if (next.activeWorkout) next.activeWorkout.exercises.forEach(fix);
  for (const t of next.templates || []) t.exercises.forEach(fix);

  // Settings: the library lift keeps its own, and gains the custom one's where it has none.
  const es = next.exerciseSettings || {};
  if (es[fromId]) { es[toId] = { ...es[fromId], ...(es[toId] || {}) }; delete es[fromId]; }

  const s = next.settings || {};
  if (s.painFlags?.[fromId]) { s.painFlags[toId] = s.painFlags[toId] || s.painFlags[fromId]; delete s.painFlags[fromId]; }
  if (s.gymStars) s.gymStars = dedupe(s.gymStars.map(id => swapId(id, fromId, toId)));

  const p = next.plan;
  if (p) {
    for (const variants of Object.values(p.slots || {})) {
      for (const v of variants) for (const m of Object.keys(v)) v[m] = dedupe(v[m].map(id => swapId(id, fromId, toId)));
    }
    for (const we of Object.values(p.weekEdits || {})) {
      const rep = {};
      for (const [a, b] of Object.entries(we.replace || {})) {
        const [x, y] = [swapId(a, fromId, toId), swapId(b, fromId, toId)];
        if (x !== y) rep[x] = y;
      }
      we.replace = rep;
      we.remove = dedupe((we.remove || []).map(id => swapId(id, fromId, toId)));
    }
    if (p.edits?.[fromId]) { p.edits[toId] = (p.edits[toId] || 0) + p.edits[fromId]; delete p.edits[fromId]; }
    if (p.excluded) p.excluded = dedupe(p.excluded.map(id => swapId(id, fromId, toId)));
    if (p.profile?.avoid) p.profile.avoid = dedupe(p.profile.avoid.map(id => swapId(id, fromId, toId)));
  }

  next.customExercises = next.customExercises.filter(c => c.id !== fromId);
  return { state: next, moved };
}

/**
 * Move logged history from one exercise to another — for any lift, e.g. sets
 * logged as "Machine Chest Press" that were really the plate-loaded press.
 * workoutIds: only these workouts (all when omitted). Moving everything also
 * carries the note and weight step over when the target has none. Templates
 * and plans aren't touched (the lift itself still exists). Returns { state, moved }.
 */
export function moveHistory(state, fromId, toId, workoutIds = null) {
  if (!toId || toId === fromId) throw new Error('Pick a different exercise to move to');
  const pick = workoutIds && new Set(workoutIds);
  const next = JSON.parse(JSON.stringify(state));
  let workouts = 0, sets = 0;
  for (const w of next.workouts || []) {
    if (pick && !pick.has(w.id)) continue;
    const mine = w.exercises.filter(e => e.exId === fromId);
    if (!mine.length) continue;
    workouts++;
    for (const e of mine) { e.exId = toId; sets += e.sets.filter(s => s.done && !s.warmup).length; }
  }
  const all = !pick || !(next.workouts || []).some(w => w.exercises.some(e => e.exId === fromId));
  const es = next.exerciseSettings || {};
  if (all && es[fromId]) es[toId] = { ...es[fromId], ...(es[toId] || {}) };
  return { state: next, moved: { workouts, sets, all } };
}
