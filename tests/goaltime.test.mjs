// Weekly goals follow the time you train (v49): fewer days or shorter
// sessions mean smaller goals, more mean bigger ones, and every planned week
// lands on its goals.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES } from '../js/data.js';
import { MAJOR, weeklyTargets, goalSizing, volumeBounds } from '../js/planner.js';
import { createPlan, currentWeek, weekVolume } from '../js/plancontrol.js';

const lookup = id => EXERCISES.find(e => e.id === id);
const MON = new Date(2026, 10, 2, 7).getTime();
const ctx = { exercises: EXERCISES.filter(e => e.common), lookup, blocked: [], usage: {}, perLift: true, timeScale: 1 };
const prof = (level, d, minutes) => ({ days: [0, 1, 2, 3, 4, 5].slice(0, d), minutes, level, goal: 'muscle', priority: [], equipment: 'gym', activities: [], avoid: [] });

test('1 hour 3 days a week aims lower than 2 hours 6 days a week, at every level', () => {
  for (const level of ['beginner', 'intermediate', 'advanced']) {
    const small = weeklyTargets(prof(level, 3, 60), {}, 160, 'full_body');
    const big = weeklyTargets(prof(level, 6, 120), {}, 160, 'upper_lower');
    for (const m of MAJOR) assert.ok(small[m] < big[m], `${level} ${m}: ${small[m]} vs ${big[m]}`);
    assert.equal(big.chest, volumeBounds(prof(level, 6, 120), 'chest')[1], `${level}: 6 x 120 reaches the level's most`);
  }
});

test('when the time can\'t hold the level\'s range, the plan says how long would', () => {
  const sz = goalSizing(prof('advanced', 3, 45), 160, 'full_body');
  assert.ok(sz.goal < sz.min);
  assert.ok(sz.minutesForMin > 45);
  assert.ok(goalSizing(prof('advanced', 3, sz.minutesForMin), 160, 'full_body').goal >= sz.min, 'those minutes really reach it');
});

test('every planned week lands on its goals: 2-6 days, 30-120 minutes, every level', () => {
  for (const level of ['beginner', 'intermediate', 'advanced']) for (const d of [2, 3, 4, 5, 6]) for (const minutes of [30, 45, 60, 90, 120]) {
    const splitId = d <= 3 ? 'full_body' : 'upper_lower';
    const plan = createPlan({ profile: prof(level, d, minutes), splitId, exercises: ctx.exercises, usage: {}, workouts: [], lookup, now: MON - 3600e3 });
    const wk = currentWeek(plan, [], lookup, MON, 160, ctx);
    const v = weekVolume(wk, [], lookup);
    const label = `${level} ${d}x${minutes}`;
    // Only very short sessions (45 min or less) may leave a small muscle
    // (arms, calves, abs) below goal, and the plan says so.
    const below = wk.notes.find(n => /below this week's goal/.test(n));
    if (below) {
      assert.ok(minutes <= 45, `${label}: ${below}`);
      assert.ok(!MAJOR.some(m => below.startsWith(m[0].toUpperCase() + m.slice(1)) || below.includes(` ${m[0].toUpperCase() + m.slice(1)}`)), `${label}: a big muscle is short: ${below}`);
    }
    for (const m of MAJOR) assert.ok(v[m].planned >= v[m].goal - 1, `${label} ${m}: ${v[m].planned}/${v[m].goal}`);
    assert.ok(wk.days.filter(x => x.kind === 'train').every(x => x.session.estMinutes <= minutes + 1), `${label}: over time`);
  }
});
