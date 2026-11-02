import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES } from '../js/data.js';
import { MOVEMENTS } from '../js/library.js';
import { HOWTO, SYMPTOMS, PATTERN_KEYS, RESEARCH, howTo, videoUrl } from '../js/howto.js';
import { TIPS } from '../js/tips.js';

test('every movement has a complete how-to: setup, steps, breathing, mistakes and all six fixes', () => {
  for (const m of MOVEMENTS) {
    const h = HOWTO[m.key];
    assert.ok(h, `${m.key}: no how-to`);
    assert.ok(PATTERN_KEYS.includes(h.p), `${m.key}: unknown pattern ${h.p}`);
    const full = howTo({ movement: m.key });
    assert.ok(full.setup.length >= 1, `${m.key}: setup`);
    assert.ok(full.steps.length >= 2, `${m.key}: steps`);
    assert.ok(full.mistakes.length >= 1 && full.mistakes.every(x => x.length === 2 && x[0] && x[1]), `${m.key}: mistakes`);
    assert.ok(full.breath && full.breath.length > 20, `${m.key}: breathing`);
    for (const [key] of SYMPTOMS) assert.ok(full.fixes[key]?.length > 15, `${m.key}: no fix for ${key}`);
    for (const line of [...full.setup, ...full.steps, ...Object.values(full.fixes)]) assert.ok(line.length < 260, `${m.key}: a line is too long`);
  }
  assert.equal(Object.keys(HOWTO).length, MOVEMENTS.length, 'no leftover entries for movements that don\'t exist');
});

test('every exercise in the library gets its movement\'s how-to and a demo link', () => {
  for (const ex of EXERCISES) {
    assert.ok(howTo(ex), `${ex.id}: no how-to`);
    const url = videoUrl(ex);
    assert.ok(url.startsWith('https://www.youtube.com/results?search_query='), url);
    assert.ok(decodeURIComponent(url).includes(ex.name), `${ex.id}: link doesn't name the exercise`);
  }
  assert.equal(howTo({ movement: 'nope' }), null);
  assert.equal(howTo(null), null);
});

test('lift-specific fixes override the general ones', () => {
  assert.match(howTo(EXERCISES.find(e => e.id === 'upright_row_barbell') || { movement: 'upright_row' }).fixes.shoulder, /lateral raises/);
  assert.match(howTo({ movement: 'pull_up' }).fixes.range, /assisted/);
  assert.notEqual(howTo({ movement: 'push_up' }).fixes.lowerBack, howTo({ movement: 'flat_press' }).fixes.lowerBack);
});

test('breathing on heavy lifts: breathe out through the hard part, never a long breath-hold, and a warning for blood pressure', () => {
  for (const mv of ['flat_press', 'squat', 'deadlift', 'leg_press', 'overhead_press']) {
    const h = howTo({ movement: mv });
    assert.match(h.breath, /out as you push through the hardest part/);
    assert.match(h.breath, /blood pressure/);
    assert.doesNotMatch(h.breath, /hold it through/);
    assert.match(h.breathSource, /MacDougall/);
  }
  assert.equal(howTo({ movement: 'curl' }).breathSource, null);
  assert.ok(howTo({ movement: 'leg_press' }).mistakes.some(([m]) => /breath/.test(m)));
});

test('research notes belong to real movements, cite a source and stay short; claims match the studies', () => {
  for (const [mv, notes] of Object.entries(RESEARCH)) {
    assert.ok(HOWTO[mv], mv);
    for (const n of notes) { assert.ok(n.length < 260, mv); assert.ok(/\([^)]*\d{4}\)|gastrocnemius/.test(n), mv + ': no source'); }
  }
  assert.deepEqual(howTo({ movement: 'plank' }).research, []);
  // Incline: 30-45 degrees (Rodriguez-Ridao 2020), not a fixed 30
  assert.match(TIPS.incline_press[0], /30-45/);
  // Squat depth helps glutes and adductors, not quads (Kubo 2019)
  assert.match(howTo({ movement: 'squat' }).fixes.notFeeling, /Quads grew about the same/);
  // Rep speed 0.5-8 s works (Schoenfeld 2015): no 'slow grows more' claims
  const all = [...Object.values(TIPS).flat(), ...Object.keys(HOWTO).flatMap(k => { const h = howTo({ movement: k }); return [...h.steps, ...h.mistakes.flat(), ...Object.values(h.fixes)]; })];
  for (const line of all) assert.doesNotMatch(line, /slow(er)?,? (full )?reps (grow|work)|shoulder health|hold it through/i, line);
});
