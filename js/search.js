// Exercise search: filters plus forgiving word matching, so "plated incline
// bench" finds "Plate-Loaded Incline Press" and "pin row" finds the machine row.
import { MUSCLES, EQUIPMENT } from './data.js';

// Words that mean the same thing. Each group maps to its first word.
const GROUPS = [
  ['plate_loaded', 'plate', 'plates', 'plated', 'loaded', 'hammer', 'iso', 'isolateral', 'lever'],
  ['machine', 'pin', 'pins', 'dial', 'stack', 'selector', 'selectorized', 'selectorised'],
  ['smith'],
  ['cable', 'cables', 'pulley', 'rope'],
  ['barbell', 'bb', 'bar'],
  ['dumbbell', 'dumbbells', 'db', 'dbs'],
  ['ez_bar', 'ez', 'ezbar'],
  ['trap_bar', 'hex', 'trapbar'],
  ['kettlebell', 'kettlebells', 'kb'],
  ['bodyweight', 'bw', 'body'],
  ['assisted', 'assist', 'assistance'],
  ['press', 'bench', 'presses', 'pressing'],
  ['row', 'rows', 'rowing'],
  ['pulldown', 'pulldowns', 'lat', 'lats'],
  ['curl', 'curls'],
  ['extension', 'extensions', 'ext'],
  ['raise', 'raises'],
  ['fly', 'flye', 'flies', 'flyes', 'flys'],
  ['squat', 'squats'],
  ['deadlift', 'deadlifts', 'dl'],
  ['rdl', 'romanian', 'rdls'],
  ['calf', 'calves'],
  ['pushdown', 'pushdowns'],
  ['shoulder', 'shoulders', 'overhead', 'ohp', 'military'],
  ['tricep', 'triceps'],
  ['bicep', 'biceps'],
  ['glute', 'glutes'],
  ['hamstring', 'hamstrings', 'hams'],
  ['quad', 'quads'],
  ['ab', 'abs', 'core'],
  ['delt', 'delts', 'deltoid', 'deltoids'],
  ['leg', 'legs'],
  ['pec', 'pecs', 'chest'],
  ['incline', 'inclined'],
  ['decline', 'declined'],
  ['flat'],
  ['seated', 'sitting'],
  ['standing'],
  ['lying', 'prone'],
  ['single', 'one', 'unilateral'],
  ['adduction', 'adductor', 'adductors', 'inner', 'adduct'],
  ['abduction', 'abductor', 'abductors', 'outer', 'abduct'],
  ['thigh', 'thighs'],
  ['multihip', 'multi'],
];
const CANON = new Map();
for (const g of GROUPS) for (const w of g) CANON.set(w, g[0]);

export const tokenize = s => String(s || '').toLowerCase().replace(/[’']/g, '').split(/[^a-z0-9]+/).filter(Boolean);
// Hyphenated words also count joined: "Pull-up" answers to "pull up" and "pullup".
const joined = s => (String(s || '').toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)+/g) || []).map(w => w.replace(/-/g, ''));
export const canon = w => CANON.get(w) || (w.length > 4 && w.endsWith('s') ? CANON.get(w.slice(0, -1)) || w.slice(0, -1) : w);

// Every word an exercise answers to: its name, equipment, angle, position, muscle.
const MACHINE_TYPES = new Set(['machine', 'plate_loaded', 'smith', 'assisted']);
function wordsOf(ex) {
  const words = new Set([...tokenize(ex.name), ...joined(ex.name)].map(canon));
  words.add(ex.equipment);
  for (const w of tokenize(EQUIPMENT[ex.equipment]?.name)) words.add(canon(w));
  if (MACHINE_TYPES.has(ex.equipment)) words.add('machine_any');
  if (ex.angle) words.add(ex.angle);
  if (ex.position) words.add(canon(ex.position));
  if (ex.unilateral) words.add('single');
  for (const w of tokenize(MUSCLES[ex.muscle])) words.add(canon(w));
  return words;
}
const cache = new WeakMap();
const words = ex => { let w = cache.get(ex); if (!w) { w = wordsOf(ex); cache.set(ex, w); } return w; };

// "machine" on its own means any machine (pin, plate-loaded, Smith, assisted).
const queryWords = q => tokenize(q.replace(/(w)ups?/gi, '$1 up')).map(w => (w === 'machine' || w === 'machines' ? 'machine_any' : canon(w)));

// A query word matches a whole word, or the start of one (typing "incl").
const hit = (set, w) => set.has(w) || (w.length >= 3 && [...set].some(x => x.startsWith(w)));

/** How many of the query's words an exercise matches, out of how many. */
export function matchScore(ex, query) {
  const q = queryWords(query);
  if (!q.length) return { hits: 0, of: 0 };
  const set = words(ex);
  return { hits: q.filter(w => hit(set, w)).length, of: q.length };
}

/**
 * Search the library. filters: { muscle, equipment, angle } (each optional).
 * rank: { usage: {exId: n}, stars: [exId] }. Every query word must match.
 * Starred, then used, then common lifts come first.
 */
export function searchExercises(list, query = '', filters = {}, rank = {}) {
  const stars = new Set(rank.stars || []);
  const usage = rank.usage || {};
  const out = [];
  for (const ex of list) {
    if (filters.muscle && ex.muscle !== filters.muscle) continue;
    if (filters.equipment && ex.equipment !== filters.equipment) continue;
    if (filters.angle && ex.angle !== filters.angle) continue;
    const { hits, of } = matchScore(ex, query);
    if (hits < of) continue;
    const exact = of && tokenize(ex.name).map(canon).join(' ') === queryWords(query).join(' ');
    // Words found in the name itself count more than ones matched via muscle or equipment.
    const nameWords = new Set([...tokenize(ex.name), ...joined(ex.name)].map(canon));
    const inName = queryWords(query).filter(w => hit(nameWords, w)).length;
    out.push({ ex, score: (exact ? 100 : 0) + inName * 5 + (stars.has(ex.id) ? 20 : 0) + (usage[ex.id] ? 4 + Math.min(usage[ex.id], 10) : 0) + (ex.common ? 3 : 0) - ex.name.length / 100 });
  }
  return out.sort((a, b) => b.score - a.score || a.ex.name.localeCompare(b.ex.name)).map(x => x.ex);
}

/**
 * Library exercises a custom exercise most likely is, best first: shares the
 * most words with its name (equipment and angle words count), same muscle and
 * equipment preferred. Returns [{ ex, score }] with score 0-1.
 */
export function matchSuggestions(custom, library, max = 5) {
  const q = queryWords(custom.name);
  if (!q.length) return [];
  const scored = [];
  for (const ex of library) {
    if (ex.id === custom.id || ex.custom) continue;
    const set = words(ex);
    const hits = q.filter(w => hit(set, w)).length;
    if (!hits) continue;
    const own = new Set(tokenize(ex.name).map(canon));
    // Penalize library names with many words the custom name doesn't have.
    const extra = [...own].filter(w => !q.includes(w)).length;
    let score = hits / q.length - extra * 0.05;
    if (ex.muscle === custom.muscle) score += 0.15;
    // Moving history from a library lift: other versions of the same movement first.
    if (custom.movement && ex.movement === custom.movement) score += 0.5;
    if (ex.equipment === custom.equipment) score += 0.1;
    scored.push({ ex, raw: score, score: Math.max(0, Math.min(1, score)) });
  }
  return scored.sort((a, b) => b.raw - a.raw || a.ex.name.localeCompare(b.ex.name)).slice(0, max).map(({ ex, score }) => ({ ex, score }));
}
