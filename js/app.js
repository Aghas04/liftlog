import { DAY_TYPES, MUSCLES, EQUIPMENT, dayType } from './data.js';
import {
  state, save, replaceState, uid, allExercises, exercise, increment, restFor, bodyweightOn, usageCounts,
} from './store.js';
import { suggest, targetFor, workingSets, sessionE1RM } from './engine.js';
import { lineChart } from './charts.js';

const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtW = w => (w == null || w === '' ? '' : String(Math.round(w * 10) / 10));
const DAY = 86400000;

const ui = {
  tab: 'workout',
  historyId: null,
  progressEx: null,
  progressMetric: 'e1rm',
  sheet: null,
};

// ---------- Icons ----------
const ICON = {
  workout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/></svg>',
  history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
  progress: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19h16M5 15l4-4 3 3 7-7"/><path d="M15 7h4v4"/></svg>',
  health: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
};

// ---------- Helpers ----------
function relDays(iso) {
  const d = Math.floor((startOfDay(Date.now()) - startOfDay(new Date(iso).getTime())) / DAY);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  return `${d} days ago`;
}
function startOfDay(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
const fmtDate = iso => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const isBW = ex => ex.equipment === 'bodyweight';

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

function getW(ctx) {
  return ctx === 'active' ? state.activeWorkout : state.workouts.find(w => w.id === ctx);
}

// Past sessions of an exercise, oldest first. Only workouts before `beforeIso` if given.
function historyFor(exId, { excludeId, beforeIso } = {}) {
  const out = [];
  for (const w of state.workouts) {
    if (w.id === excludeId) continue;
    if (beforeIso && w.date >= beforeIso) continue;
    for (const e of w.exercises) if (e.exId === exId) out.push({ date: w.date, difficulty: e.difficulty, sets: e.sets });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

function loadOf(ex, weight, dateIso) {
  return isBW(ex) ? (bodyweightOn(dateIso) || 0) + (weight || 0) : weight || 0;
}

function sessionVolume(ex, sets, dateIso) {
  return sets.reduce((sum, s) => sum + loadOf(ex, s.weight, dateIso) * s.reps, 0);
}

function workoutVolume(w) {
  return w.exercises.reduce((sum, e) => sum + sessionVolume(exercise(e.exId), workingSets(e), w.date), 0);
}

function weightLabel(ex, w) {
  if (isBW(ex)) return w ? `BW + ${fmtW(w)} lb` : 'Bodyweight';
  return `${fmtW(w)} lb`;
}

function setsSummary(ex, sets) {
  const ws = sets.filter(s => s.done && s.reps > 0);
  if (!ws.length) return '';
  const sameW = ws.every(s => s.weight === ws[0].weight);
  if (sameW) return `${weightLabel(ex, ws[0].weight)} × ${ws.map(s => s.reps).join(', ')}`;
  return ws.map(s => `${fmtW(s.weight) || 'BW'}×${s.reps}`).join(', ');
}

const FEEL = { easy: 'Easy', hard: 'Hard', too_hard: 'Too hard' };

// ---------- Workout actions ----------
function startWorkout(dayId, repeatFrom) {
  state.activeWorkout = { id: uid(), dayType: dayId, startedAt: new Date().toISOString(), exercises: [], timer: null };
  if (repeatFrom) for (const e of repeatFrom.exercises) addExercise(e.exId, false);
  save();
  requestWakeLock();
  closeSheet();
  render();
  window.scrollTo(0, 0);
}

function addExercise(exId, doRender = true) {
  const w = state.activeWorkout;
  if (!w) return;
  const ex = exercise(exId);
  const bw = bodyweightOn();
  const sug = suggest(ex, historyFor(exId), { increment: increment(ex), bodyweight: bw });
  const sets = sug
    ? sug.reps.map(r => ({ weight: sug.weight, reps: null, target: { weight: sug.weight, reps: r }, done: false }))
    : [{ weight: null, reps: null, target: null, done: false }];
  w.exercises.push({ uid: uid(), exId, difficulty: 'hard', sets, suggestion: sug });
  save();
  if (doRender) {
    closeSheet();
    render();
    const cards = document.querySelectorAll('.ex-card');
    cards[cards.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function finishWorkout() {
  const w = state.activeWorkout;
  const exercises = w.exercises
    .map(e => ({ exId: e.exId, difficulty: e.difficulty, sets: e.sets.filter(s => s.done && s.reps > 0).map(({ weight, reps, target, warmup }) => ({ weight: weight || 0, reps, target, warmup: !!warmup, done: true })) }))
    .filter(e => e.sets.length);
  const saved = { id: w.id, dayType: w.dayType, date: w.startedAt, finishedAt: new Date().toISOString(), exercises };
  state.workouts.push(saved);
  state.workouts.sort((a, b) => a.date.localeCompare(b.date));
  state.activeWorkout = null;
  save();
  stopTimer();
  releaseWakeLock();
  closeSheet();
  toast('Workout saved 💪');
  render();
  window.scrollTo(0, 0);
}

function workoutPRs(w, excludeId) {
  const prs = [];
  for (const e of w.exercises) {
    const ex = exercise(e.exId);
    const bw = bodyweightOn(w.date || w.startedAt);
    const done = { sets: e.sets.filter(s => s.done && s.reps > 0) };
    const now = sessionE1RM(done, ex, bw);
    if (!now) continue;
    const hist = historyFor(e.exId, { excludeId });
    if (!hist.length) continue;
    const prev = Math.max(...hist.map(h => sessionE1RM(h, ex, bodyweightOn(h.date))));
    if (now > prev + 0.01) prs.push({ name: ex.name, now, prev });
  }
  return prs;
}

// ---------- Rest timer ----------
let audioCtx = null;
function unlockAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { /* no audio */ }
}
function beep() {
  if (!audioCtx) return;
  try {
    const t0 = audioCtx.currentTime;
    [0, 0.25, 0.5].forEach(off => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t0 + off);
      g.gain.exponentialRampToValueAtTime(0.4, t0 + off + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + 0.18);
      o.connect(g).connect(audioCtx.destination);
      o.start(t0 + off);
      o.stop(t0 + off + 0.2);
    });
  } catch { /* ignore */ }
  navigator.vibrate?.([200, 100, 200]);
}

function startTimer(exId) {
  const w = state.activeWorkout;
  if (!w) return;
  const secs = restFor(exId);
  w.timer = { end: Date.now() + secs * 1000, total: secs, exId, beeped: false };
  save();
  tick();
}
function stopTimer() {
  if (state.activeWorkout) { state.activeWorkout.timer = null; save(); }
  $('#timer').hidden = true;
}
function adjustTimer(delta) {
  const t = state.activeWorkout?.timer;
  if (!t) return;
  t.end += delta * 1000;
  t.total = Math.max(1, t.total + delta);
  if (t.end > Date.now()) t.beeped = false;
  save();
  tick();
}

function tick() {
  const w = state.activeWorkout;
  const el = $('#timer');
  const elapsed = $('#elapsed');
  if (w && elapsed) {
    const m = Math.floor((Date.now() - new Date(w.startedAt).getTime()) / 60000);
    elapsed.textContent = m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
  }
  const t = w?.timer;
  if (!t) { el.hidden = true; return; }
  const left = Math.round((t.end - Date.now()) / 1000);
  const over = left <= 0;
  if (over && !t.beeped) { t.beeped = true; save(); beep(); }
  if (left < -300) { stopTimer(); return; }
  const a = Math.abs(left);
  const txt = `${over ? '+' : ''}${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`;
  const pct = over ? 100 : Math.max(0, Math.min(100, 100 - (left / t.total) * 100));
  // Build the controls once so taps aren't lost when the numbers update.
  if (!el.firstElementChild) {
    el.innerHTML = `
      <div class="ring"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" class="track"/><circle cx="22" cy="22" r="19" class="fill"/></svg></div>
      <div class="tt"><div class="t"></div><div class="lbl"></div></div>
      <button data-act="timerAdj" data-d="-15">−15</button>
      <button data-act="timerAdj" data-d="15">+15</button>
      <button data-act="timerStop" aria-label="Stop timer">✕</button>`;
  }
  const dt = dayType(w.dayType);
  el.hidden = false;
  el.className = over ? 'over' : '';
  el.style.setProperty('--c', dt?.color || '');
  el.querySelector('.t').textContent = txt;
  el.querySelector('.lbl').textContent = over ? 'Rest done — next set!' : `Rest · ${exercise(t.exId).name}`;
  const C = 2 * Math.PI * 19;
  el.querySelector('.fill').style.strokeDasharray = `${(pct / 100) * C} ${C}`;
}
setInterval(tick, 500);

// Keep the screen on during a workout where supported.
let wakeLock = null;
async function requestWakeLock() {
  try { if ('wakeLock' in navigator && !wakeLock) wakeLock = await navigator.wakeLock.request('screen'); wakeLock?.addEventListener('release', () => { wakeLock = null; }); } catch { wakeLock = null; }
}
function releaseWakeLock() { wakeLock?.release?.(); wakeLock = null; }
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (state.activeWorkout) requestWakeLock();
    tick();
  }
});

// ---------- Rendering: exercise card ----------
function setRow(ctx, ei, si, e, ex, s, live) {
  const miss = s.done && s.target && s.reps != null && s.reps < s.target.reps;
  const bw = isBW(ex);
  return `
  <div class="set-row ${s.done ? 'done' : ''} ${miss ? 'miss' : ''}" data-w="${ctx}" data-e="${ei}" data-s="${si}">
    <button class="set-num ${s.warmup ? 'warm' : ''}" data-act="warmup" aria-label="Toggle warm-up">${s.warmup ? 'W' : si + 1 - e.sets.slice(0, si).filter(x => x.warmup).length}</button>
    <div class="stepper">
      <button data-act="step" data-f="weight" data-d="-1" aria-label="Less weight">−</button>
      <input data-field="weight" inputmode="decimal" value="${fmtW(s.weight)}" placeholder="${bw ? '+0' : 'lb'}" aria-label="Weight">
      <button data-act="step" data-f="weight" data-d="1" aria-label="More weight">+</button>
    </div>
    <div class="stepper reps">
      <button data-act="step" data-f="reps" data-d="-1" aria-label="Fewer reps">−</button>
      <input data-field="reps" inputmode="numeric" value="${s.reps ?? ''}" placeholder="${s.target ? s.target.reps : 'reps'}" aria-label="Reps">
      <button data-act="step" data-f="reps" data-d="1" aria-label="More reps">+</button>
    </div>
    <button class="check" data-act="done" aria-label="Mark set done">${ICON.check}</button>
    ${s.target ? `<div class="goal">${miss ? `missed · goal ${s.target.reps}` : `goal ${s.target.reps}`}</div>` : ''}
  </div>`;
}

function exCard(w, ctx, ei, live) {
  const e = w.exercises[ei];
  const ex = exercise(e.exId);
  const hist = live ? historyFor(e.exId) : historyFor(e.exId, { excludeId: w.id, beforeIso: w.date });
  const last = [...hist].reverse().find(h => workingSets(h).length);
  const sug = e.suggestion;

  let sugHtml = '';
  if (live) {
    if (sug) {
      sugHtml = `<div class="suggest"><div class="target">🎯 ${weightLabel(ex, sug.weight)} × ${sug.reps.join(' · ')}</div><div class="why">${esc(sug.reason)}</div></div>`;
    } else {
      sugHtml = `<div class="suggest first"><div class="why">First time logging this lift — enter what you do and the app learns from here.</div></div>`;
    }
  }
  const lastHtml = last
    ? `<div class="last">Last (${relDays(last.date)}): ${esc(setsSummary(ex, last.sets))}${last.difficulty && last.difficulty !== 'hard' ? ` · ${FEEL[last.difficulty]}` : ''}</div>`
    : '';

  return `
  <section class="ex-card ${cardComplete(e) ? 'complete' : ''}" data-w="${ctx}" data-e="${ei}" style="--c:${dayType(w.dayType)?.color}">
    <div class="ex-head">
      <div><span class="tag">${MUSCLES[ex.muscle] || ''}</span><h3>${esc(ex.name)}</h3></div>
      <div class="ex-tools">
        ${live ? `<button data-act="restSheet">⏱ ${restFor(e.exId)}s</button>` : ''}
        <button data-act="removeEx" aria-label="Remove exercise">✕</button>
      </div>
    </div>
    ${sugHtml}${lastHtml}
    <div class="set-head"><span>Set</span><span>${isBW(ex) ? '+ lb' : 'lb'}</span><span>Reps</span><span></span></div>
    ${e.sets.map((s, si) => setRow(ctx, ei, si, e, ex, s, live)).join('')}
    <div class="set-actions">
      <button class="minus" data-act="removeSet">− Set</button>
      <button data-act="addSet">+ Add set</button>
    </div>
    <div class="feel">
      <span>How did it feel?</span>
      <div class="seg">
        ${Object.entries(FEEL).map(([v, l]) => `<button data-act="feel" data-v="${v}" class="${(e.difficulty || 'hard') === v ? 'on' : ''}">${l}</button>`).join('')}
      </div>
    </div>
  </section>`;
}

function cardComplete(e) {
  return e.sets.length > 0 && e.sets.every(s => s.done);
}

function refreshRow(row) {
  const { w: ctx, e: ei, s: si } = row.dataset;
  const w = getW(ctx);
  const e = w.exercises[+ei];
  const ex = exercise(e.exId);
  const tmp = document.createElement('div');
  tmp.innerHTML = setRow(ctx, +ei, +si, e, ex, e.sets[+si], ctx === 'active');
  row.replaceWith(tmp.firstElementChild);
}

function refreshCard(card) {
  const { w: ctx, e: ei } = card.dataset;
  const tmp = document.createElement('div');
  tmp.innerHTML = exCard(getW(ctx), ctx, +ei, ctx === 'active');
  card.replaceWith(tmp.firstElementChild);
  updateProgress();
}

// ---------- Rendering: views ----------
function setProgress(w) {
  let done = 0, total = 0;
  for (const e of w.exercises) for (const s of e.sets) if (!s.warmup) { total++; if (s.done) done++; }
  return { done, total };
}

function updateProgress() {
  const w = state.activeWorkout;
  const el = $('#setProg');
  if (!w || !el) return;
  const { done, total } = setProgress(w);
  el.querySelector('i').style.width = total ? (done / total) * 100 + '%' : '0';
  $('#setCount').textContent = `${done}/${total} sets`;
}

function viewWorkout() {
  const w = state.activeWorkout;
  if (w) {
    const dt = dayType(w.dayType);
    const { done, total } = setProgress(w);
    return `
    <div class="active" style="--c:${dt.color}">
      <div class="workout-head">
        <div class="top">
          <div class="wh-title"><span class="day-ico sm">${dt.icon}</span>
            <div><h1>${esc(dt.name)}</h1><div class="sub"><span id="elapsed">0 min</span> · <span id="setCount">${done}/${total} sets</span></div></div></div>
          <button class="finish-btn" data-act="finishSheet">Finish</button>
        </div>
        <div class="prog" id="setProg"><i style="width:${total ? (done / total) * 100 : 0}%"></i></div>
      </div>
      ${w.exercises.map((_, i) => exCard(w, 'active', i, true)).join('')}
      ${w.exercises.length ? '' : `<div class="empty"><div class="big-ico">${dt.icon}</div>Add your first exercise to get started.</div>`}
      <button class="btn primary day" data-act="picker">+ Add exercise</button>
    </div>`;
  }

  const needsBackup = state.workouts.length >= 3 &&
    (!state.settings.lastBackup || Date.now() - new Date(state.settings.lastBackup).getTime() > 14 * DAY);
  const lastOf = id => [...state.workouts].sort((a, b) => b.date.localeCompare(a.date)).find(x => x.dayType === id);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const { thisWeek, streak } = weekStats();
  const days = new Set(state.workouts.map(w => startOfDay(new Date(w.date).getTime())));
  const monday = weekKey(Date.now());
  const today = startOfDay(Date.now());
  const week = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => {
    const t = startOfDay(monday + i * DAY + 3600000);
    return `<div class="wd ${days.has(t) ? 'on' : ''} ${t === today ? 'today' : ''}"><span>${l}</span><i></i></div>`;
  }).join('');
  return `
  <div class="top">
    <div><div class="eyebrow">${greeting}</div><h1>Let's lift.</h1></div>
    <button class="icon-btn" data-act="settings" aria-label="Settings">${ICON.gear}</button>
  </div>
  <div class="week-card">
    <div class="week-stats">
      <div><b>${thisWeek}</b><span>this week</span></div>
      <div><b>${streak ? '🔥 ' + streak : '0'}</b><span>week streak</span></div>
      <div><b>${state.workouts.length}</b><span>total</span></div>
    </div>
    <div class="week-days">${week}</div>
  </div>
  ${needsBackup ? `<div class="banner"><div>It's been a while since your last backup.</div><button data-act="export">Back up</button></div>` : ''}
  <div class="section-title">Pick today's split</div>
  <div class="days">
    ${DAY_TYPES.map(d => {
      const l = lastOf(d.id);
      return `<button class="day-btn" style="--c:${d.color}" data-act="start" data-day="${d.id}">
        <span class="day-ico">${d.icon}</span>
        <div class="day-txt"><strong>${esc(d.name)}</strong>
          <span class="muscles">${d.muscles.map(m => MUSCLES[m]).join(' · ')}</span>
          <span class="when">${l ? `Last done ${relDays(l.date)}` : 'Not done yet'}</span></div>
        <span class="go">${ICON.arrow}</span></button>`;
    }).join('')}
  </div>`;
}

function weekStats() {
  const weeks = new Set(state.workouts.map(w => weekKey(new Date(w.date).getTime())));
  let streak = 0;
  let wk = weekKey(Date.now());
  if (!weeks.has(wk)) wk -= 7 * DAY;
  while (weeks.has(wk)) { streak++; wk = weekKey(wk - 3 * DAY); }
  const thisWeek = state.workouts.filter(w => weekKey(new Date(w.date).getTime()) === weekKey(Date.now())).length;
  return { thisWeek, streak };
}

function viewHistory() {
  if (ui.historyId) {
    const w = state.workouts.find(x => x.id === ui.historyId);
    if (!w) { ui.historyId = null; return viewHistory(); }
    return `
    <div class="top"><button class="back-link" data-act="histBack">‹ History</button>
      <button class="btn danger" style="width:auto;min-height:36px" data-act="deleteWorkout">Delete</button></div>
    <h1 style="font-size:24px">${esc(dayType(w.dayType)?.name)}</h1>
    <div class="muted" style="margin:4px 0 14px">${fmtDate(w.date)} · ${Math.round(workoutVolume(w)).toLocaleString()} lb volume</div>
    ${w.exercises.map((_, i) => exCard(w, w.id, i, false)).join('')}
    <p class="muted small">Edits save automatically and update future suggestions.</p>`;
  }
  if (!state.workouts.length) return `<div class="top"><h1>History</h1></div><div class="empty">No workouts yet. Your saved workouts show up here.</div>`;
  const list = [...state.workouts].sort((a, b) => b.date.localeCompare(a.date));
  let month = '';
  return `<div class="top"><h1>History</h1></div>` + list.map(w => {
    const m = new Date(w.date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const head = m !== month ? `<div class="section-title">${m}</div>` : '';
    month = m;
    const sets = w.exercises.reduce((n, e) => n + workingSets(e).length, 0);
    const dt = dayType(w.dayType);
    return `${head}<button class="card hist" style="--c:${dt?.color}" data-act="openWorkout" data-id="${w.id}">
      <span class="day-ico sm">${dt?.icon || ''}</span>
      <div class="hist-txt">
        <div class="top-line"><strong>${esc(dt?.name)}</strong><span class="muted small">${fmtDate(w.date)}</span></div>
        <div class="ex-names">${w.exercises.length} exercises · ${sets} sets · ${esc(w.exercises.map(e => exercise(e.exId).name).join(', '))}</div>
      </div>
    </button>`;
  }).join('');
}

function weekKey(t) {
  const d = new Date(startOfDay(t));
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

function viewProgress() {
  if (!state.workouts.length) return `<div class="top"><h1>Progress</h1></div><div class="empty">Log a few workouts and your progress charts will appear here.</div>`;

  const { thisWeek, streak } = weekStats();

  // Calendar: last 16 weeks, Monday-first columns
  const days = new Set(state.workouts.map(w => startOfDay(new Date(w.date).getTime())));
  const start = weekKey(Date.now()) - 15 * 7 * DAY;
  const today = startOfDay(Date.now());
  let cal = '';
  for (let i = 0; i < 16 * 7; i++) {
    const t = startOfDay(start + i * DAY + 3600000);
    cal += t > today ? '<i style="visibility:hidden"></i>' : `<i class="${days.has(t) ? 'on' : ''} ${t === today ? 'today' : ''}"></i>`;
  }

  // Exercises with history, most recent first
  const seen = new Map();
  const byDate = [...state.workouts].sort((a, b) => b.date.localeCompare(a.date));
  for (const w of byDate) for (const e of w.exercises) if (!seen.has(e.exId)) seen.set(e.exId, w.date);
  const exIds = [...seen.keys()];
  if (!ui.progressEx || !seen.has(ui.progressEx)) ui.progressEx = exIds[0];
  const ex = exercise(ui.progressEx);
  const hist = historyFor(ui.progressEx).filter(h => workingSets(h).length);
  const metricFn = {
    e1rm: h => sessionE1RM(h, ex, bodyweightOn(h.date)),
    top: h => Math.max(...workingSets(h).map(s => loadOf(ex, s.weight, h.date))),
    volume: h => sessionVolume(ex, workingSets(h), h.date),
  }[ui.progressMetric];
  const points = hist.map(h => ({ x: new Date(h.date).getTime(), y: metricFn(h) })).filter(p => p.y > 0);
  const lastY = points.at(-1)?.y ?? 0;
  const firstY = points[0]?.y ?? 0;
  const delta = firstY ? ((lastY - firstY) / firstY) * 100 : 0;
  const metricName = { e1rm: 'Est. 1-rep max', top: 'Top set weight', volume: 'Session volume' }[ui.progressMetric];

  // PRs
  const prs = exIds.map(id => {
    const x = exercise(id);
    const hs = historyFor(id).filter(h => workingSets(h).length);
    const best = Math.max(0, ...hs.map(h => sessionE1RM(h, x, bodyweightOn(h.date))));
    let heavy = null;
    for (const h of hs) for (const s of workingSets(h)) if (!heavy || s.weight > heavy.weight || (s.weight === heavy.weight && s.reps > heavy.reps)) heavy = s;
    return { x, best, heavy };
  }).filter(p => p.heavy);

  return `
  <div class="top"><h1>Progress</h1></div>
  <div class="stats">
    <div class="stat"><b>${thisWeek}</b><span>this week</span></div>
    <div class="stat"><b>${streak}</b><span>week streak</span></div>
    <div class="stat"><b>${state.workouts.length}</b><span>workouts</span></div>
  </div>
  <div class="card"><div class="cal">${cal}</div></div>

  <div class="section-title">Lift progress</div>
  <select class="ex-select" data-field="progressEx">
    ${exIds.map(id => `<option value="${id}" ${id === ui.progressEx ? 'selected' : ''}>${esc(exercise(id).name)}</option>`).join('')}
  </select>
  <div class="seg" style="margin-bottom:10px">
    ${[['e1rm', 'Strength'], ['top', 'Top set'], ['volume', 'Volume']].map(([v, l]) => `<button data-act="metric" data-v="${v}" class="${ui.progressMetric === v ? 'on' : ''}">${l}</button>`).join('')}
  </div>
  <div class="chart-wrap">
    <div class="chart-head"><div><div class="muted small">${metricName}</div><b>${Math.round(lastY).toLocaleString()} lb</b></div>
      ${points.length > 1 ? `<span class="delta ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(1)}% since first</span>` : ''}</div>
    ${points.length > 1 ? lineChart(points) : `<div class="empty" style="padding:24px">Log this lift again to see a trend.</div>`}
  </div>

  <div class="section-title">Personal records</div>
  <div class="card pr-list">
    ${prs.map(p => `<div class="pr"><span>${esc(p.x.name)}</span><span class="muted">${esc(weightLabel(p.x, p.heavy.weight))} × ${p.heavy.reps}${p.best ? ` · <b>${Math.round(p.best)}</b> e1RM` : ''}</span></div>`).join('')}
  </div>`;
}

function viewHealth() {
  const entries = [...state.bodyweight].sort((a, b) => a.date.localeCompare(b.date));
  const points = entries.map(b => ({ x: new Date(b.date + 'T12:00:00').getTime(), y: b.lb }));
  const cur = entries.at(-1);
  const monthAgo = new Date(Date.now() - 30 * DAY).toISOString().slice(0, 10);
  const base = [...entries].reverse().find(b => b.date <= monthAgo) || entries[0];
  const change = cur && base && cur !== base ? cur.lb - base.lb : null;
  return `
  <div class="top"><h1>Health</h1></div>
  <div class="card">
    <div class="row" style="align-items:flex-end">
      <label class="field" style="margin:0"><span>Bodyweight (lb)</span><input id="bwInput" inputmode="decimal" placeholder="${cur ? fmtW(cur.lb) : 'e.g. 180'}"></label>
      <label class="field" style="margin:0"><span>Date</span><input id="bwDate" type="date" value="${todayStr()}" max="${todayStr()}"></label>
    </div>
    <button class="btn primary" style="margin-top:12px" data-act="saveBW">Save weight</button>
  </div>
  ${cur ? `
  <div class="chart-wrap">
    <div class="chart-head"><div><div class="muted small">Bodyweight</div><b>${fmtW(cur.lb)} lb</b></div>
      ${change != null ? `<span class="delta muted">${change >= 0 ? '+' : ''}${fmtW(change)} lb / 30 days</span>` : ''}</div>
    ${points.length > 1 ? lineChart(points) : `<div class="empty" style="padding:24px">Log again on another day to see a trend.</div>`}
  </div>
  <div class="section-title">Entries</div>
  <div class="card">
    ${[...entries].reverse().map(b => `<div class="set-line"><span>${new Date(b.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
      <span>${fmtW(b.lb)} lb <button class="muted" style="margin-left:12px" data-act="delBW" data-id="${b.id}" aria-label="Delete entry">✕</button></span></div>`).join('')}
  </div>` : `<p class="muted small">Your bodyweight is also used to calculate strength on pull-ups, dips and other bodyweight lifts.</p>`}`;
}

function renderTabs() {
  const tabs = [['workout', 'Workout'], ['history', 'History'], ['progress', 'Progress'], ['health', 'Health']];
  $('#tabs').innerHTML = tabs.map(([id, l]) => `<button data-act="tab" data-tab="${id}" class="${ui.tab === id ? 'on' : ''}">${ICON[id]}${l}</button>`).join('');
}

function render() {
  const views = { workout: viewWorkout, history: viewHistory, progress: viewProgress, health: viewHealth };
  $('#view').innerHTML = views[ui.tab]();
  renderTabs();
  renderSheet();
  tick();
}

// ---------- Sheets ----------
function openSheet(s) { ui.sheet = s; renderSheet(); }
function closeSheet() { ui.sheet = null; renderSheet(); }

function pickerList(query) {
  const w = state.activeWorkout;
  const dt = dayType(w.dayType);
  const added = new Set(w.exercises.map(e => e.exId));
  const counts = usageCounts();
  const q = query.trim().toLowerCase();
  const sortFn = (a, b) => (counts[b.id] || 0) - (counts[a.id] || 0) || a.name.localeCompare(b.name);
  const item = ex => `<button class="pick ${added.has(ex.id) ? 'added' : ''}" data-act="pick" data-id="${ex.id}">
    <span>${esc(ex.name)}</span><span class="muted">${added.has(ex.id) ? 'added' : esc(EQUIPMENT[ex.equipment]?.name || '')}</span></button>`;
  if (q) {
    const hits = allExercises().filter(e => e.name.toLowerCase().includes(q)).sort(sortFn);
    return (hits.map(item).join('') || `<div class="empty">No match. Create it as a custom exercise.</div>`);
  }
  return dt.muscles.map(m => {
    const list = allExercises().filter(e => e.muscle === m).sort(sortFn);
    return list.length ? `<div class="pick-group"><h4>${MUSCLES[m]}</h4>${list.map(item).join('')}</div>` : '';
  }).join('');
}

function sheetHtml() {
  const s = ui.sheet;
  switch (s.type) {
    case 'repeat': {
      const last = s.last;
      return `<h2>${esc(dayType(s.day).name)}</h2>
        <p class="muted">Last time (${relDays(last.date)}): ${esc(last.exercises.map(e => exercise(e.exId).name).join(', '))}</p>
        <div class="stack">
          <button class="btn primary" data-act="startRepeat">Repeat with new targets</button>
          <button class="btn" data-act="startEmpty">Start empty</button>
        </div>`;
    }
    case 'picker':
      return `<h2>Add exercise</h2>
        <input class="search" id="pickerSearch" placeholder="Search all exercises" autocomplete="off">
        <div id="pickerList">${pickerList('')}</div>
        <button class="btn ghost" style="margin-top:14px" data-act="customSheet">+ Custom exercise</button>`;
    case 'custom':
      return `<h2>Custom exercise</h2>
        <label class="field"><span>Name</span><input id="cName" placeholder="e.g. Machine Pullover"></label>
        <label class="field"><span>Muscle</span><select id="cMuscle">${Object.entries(MUSCLES).map(([k, v]) => `<option value="${k}" ${dayType(state.activeWorkout?.dayType)?.muscles[0] === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="field"><span>Equipment</span><select id="cEquip">${Object.entries(EQUIPMENT).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('')}</select></label>
        <label class="check-field"><input type="checkbox" id="cCompound"> Compound lift (multi-joint, 6–12 reps)</label>
        <button class="btn primary" data-act="saveCustom">Add exercise</button>`;
    case 'rest': {
      const cur = restFor(s.exId);
      return `<h2>Rest timer</h2><p class="muted">${esc(exercise(s.exId).name)}</p>
        <div class="chips">${[45, 60, 90, 120, 150, 180, 240].map(v => `<button data-act="setRest" data-v="${v}" class="${v === cur ? 'on' : ''}">${v < 60 ? v + 's' : v / 60 + ' min'}</button>`).join('')}</div>
        <label class="field"><span>Custom (seconds)</span><input id="restCustom" inputmode="numeric" value="${cur}"></label>
        <button class="btn primary" data-act="setRestCustom">Save</button>`;
    }
    case 'finish': {
      const w = state.activeWorkout;
      const done = w.exercises.reduce((n, e) => n + e.sets.filter(x => x.done && x.reps > 0 && !x.warmup).length, 0);
      const vol = w.exercises.reduce((sum, e) => sum + sessionVolume(exercise(e.exId), e.sets.filter(x => x.done && x.reps > 0 && !x.warmup), w.startedAt), 0);
      const mins = Math.round((Date.now() - new Date(w.startedAt).getTime()) / 60000);
      const prs = workoutPRs(w);
      const undone = w.exercises.reduce((n, e) => n + e.sets.filter(x => !x.done).length, 0);
      return `<h2>Finish workout?</h2>
        <div class="stats">
          <div class="stat"><b>${mins}</b><span>minutes</span></div>
          <div class="stat"><b>${done}</b><span>sets</span></div>
          <div class="stat"><b>${Math.round(vol).toLocaleString()}</b><span>lb volume</span></div>
        </div>
        ${prs.length ? `<div class="card pr-list"><div class="muted small">🎉 New strength PRs</div>${prs.map(p => `<div class="pr"><span>${esc(p.name)}</span><b>${Math.round(p.now)} e1RM</b></div>`).join('')}</div>` : ''}
        ${undone ? `<p class="muted small">${undone} unticked set${undone > 1 ? 's' : ''} won't be saved.</p>` : ''}
        <div class="stack">
          <button class="btn primary" data-act="finish" ${done ? '' : 'disabled style="opacity:.5"'}>Save workout</button>
          <button class="btn" data-act="closeSheet">Keep going</button>
          <button class="btn danger" data-act="discard">Discard workout</button>
        </div>`;
    }
    case 'settings':
      return `<h2>Settings</h2>
        <div class="field"><span>Default rest timer</span>
          <div class="chips">${[60, 90, 120, 180].map(v => `<button data-act="defaultRest" data-v="${v}" class="${state.settings.defaultRest === v ? 'on' : ''}">${v}s</button>`).join('')}</div>
        </div>
        <div class="section-title">Backup</div>
        <p class="muted small">Your data is stored only on this phone. Save a backup file to Files or iCloud Drive now and then.
          ${state.settings.lastBackup ? `Last backup: ${relDays(state.settings.lastBackup)}.` : 'No backup yet.'}</p>
        <div class="stack">
          <button class="btn primary" data-act="export">Export backup</button>
          <button class="btn" data-act="import">Import backup</button>
        </div>
        <div class="section-title">Danger zone</div>
        <button class="btn danger" data-act="wipe">Delete all data</button>`;
  }
  return '';
}

function renderSheet() {
  const root = $('#sheet');
  if (!ui.sheet) { root.innerHTML = ''; document.body.style.overflow = ''; return; }
  root.innerHTML = `<div class="overlay" data-act="closeSheet"></div><div class="panel"><div class="grip"></div>${sheetHtml()}</div>`;
  document.body.style.overflow = 'hidden';
}

// ---------- Backup ----------
async function exportBackup() {
  const data = JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 1);
  const name = `liftlog-backup-${todayStr()}.json`;
  const file = new File([data], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'LiftLog backup' });
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
    state.settings.lastBackup = new Date().toISOString();
    save();
    toast('Backup saved');
    render();
  } catch (e) {
    if (e.name !== 'AbortError') alert('Backup failed: ' + e.message);
  }
}

$('#importFile').addEventListener('change', async ev => {
  const f = ev.target.files[0];
  ev.target.value = '';
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!Array.isArray(data.workouts)) throw new Error('Not a LiftLog backup file');
    if (!confirm(`Replace all current data with this backup (${data.workouts.length} workouts)?`)) return;
    delete data.exportedAt;
    replaceState(data);
    closeSheet();
    toast('Backup restored');
    render();
  } catch (e) {
    alert('Could not import: ' + e.message);
  }
});

// ---------- Event handling ----------
function setCtx(el) {
  const row = el.closest('.set-row');
  const card = el.closest('.ex-card');
  const ctx = (row || card)?.dataset.w;
  const w = ctx && getW(ctx);
  const e = w && w.exercises[+(row || card).dataset.e];
  const s = row && e ? e.sets[+row.dataset.s] : null;
  return { ctx, w, e, s, row, card, ex: e && exercise(e.exId) };
}

// When the weight on an unfinished set changes, re-target its reps.
function retarget(c) {
  if (c.ctx !== 'active' || c.s.done || !c.e.suggestion) return;
  const si = +c.row.dataset.s;
  const reps = targetFor(c.e.suggestion, c.ex, c.s.weight, si, bodyweightOn());
  if (reps) c.s.target = { weight: c.s.weight, reps };
}

const actions = {
  tab(el) { ui.tab = el.dataset.tab; ui.historyId = null; render(); window.scrollTo(0, 0); },
  settings() { openSheet({ type: 'settings' }); },
  closeSheet() { closeSheet(); },

  start(el) {
    const day = el.dataset.day;
    const last = [...state.workouts].reverse().find(w => w.dayType === day);
    if (last) openSheet({ type: 'repeat', day, last });
    else startWorkout(day);
  },
  startRepeat() { startWorkout(ui.sheet.day, ui.sheet.last); },
  startEmpty() { startWorkout(ui.sheet.day); },
  picker() { openSheet({ type: 'picker' }); },
  pick(el) {
    if (state.activeWorkout.exercises.some(e => e.exId === el.dataset.id) && !confirm('Already added. Add it again?')) return;
    addExercise(el.dataset.id);
  },
  customSheet() { openSheet({ type: 'custom' }); },
  saveCustom() {
    const name = $('#cName').value.trim();
    if (!name) { $('#cName').focus(); return; }
    const ex = { id: 'c_' + uid(), name, muscle: $('#cMuscle').value, equipment: $('#cEquip').value, compound: $('#cCompound').checked, custom: true };
    state.customExercises.push(ex);
    save();
    addExercise(ex.id);
  },

  step(el) {
    const c = setCtx(el);
    const f = el.dataset.f;
    const d = +el.dataset.d;
    if (f === 'weight') {
      const inc = increment(c.ex);
      const base = c.s.weight ?? c.s.target?.weight ?? 0;
      c.s.weight = Math.max(0, Math.round((base + d * inc) / inc) * inc);
      retarget(c);
    } else {
      const base = c.s.reps ?? c.s.target?.reps ?? 0;
      c.s.reps = Math.max(0, base + d);
    }
    save();
    refreshRow(c.row);
  },
  done(el) {
    const c = setCtx(el);
    if (!c.s.done) {
      if (c.s.reps == null) c.s.reps = c.s.target?.reps ?? null;
      if (c.s.weight == null) c.s.weight = c.s.target?.weight ?? (isBW(c.ex) ? 0 : null);
      if (c.s.reps == null || c.s.reps <= 0) { toast('Enter reps first'); return; }
      if (c.s.weight == null && !isBW(c.ex)) { toast('Enter weight first'); return; }
      c.s.done = true;
      if (c.ctx === 'active') { unlockAudio(); startTimer(c.e.exId); }
    } else {
      c.s.done = false;
    }
    save();
    refreshRow(c.row);
    if (c.s.done) c.card.querySelector(`.set-row[data-s="${c.row.dataset.s}"]`)?.classList.add('just-done');
    c.card.classList.toggle('complete', cardComplete(c.e));
    updateProgress();
  },
  warmup(el) {
    const c = setCtx(el);
    c.s.warmup = !c.s.warmup;
    save();
    refreshCard(c.card);
  },
  addSet(el) {
    const c = setCtx(el);
    const prev = c.e.sets.at(-1);
    const si = c.e.sets.length;
    const ns = { weight: prev?.weight ?? null, reps: null, target: null, done: false };
    if (c.ctx === 'active' && c.e.suggestion && ns.weight != null) {
      const reps = targetFor(c.e.suggestion, c.ex, ns.weight, si, bodyweightOn());
      if (reps) ns.target = { weight: ns.weight, reps };
    } else if (prev?.target) {
      ns.target = { ...prev.target };
    }
    c.e.sets.push(ns);
    save();
    refreshCard(c.card);
  },
  removeSet(el) {
    const c = setCtx(el);
    if (c.e.sets.length <= 1) { toast('Remove the exercise with ✕ instead'); return; }
    c.e.sets.pop();
    save();
    refreshCard(c.card);
  },
  removeEx(el) {
    const c = setCtx(el);
    if (!confirm(`Remove ${c.ex.name}?`)) return;
    c.w.exercises.splice(+c.card.dataset.e, 1);
    if (c.ctx !== 'active' && !c.w.exercises.length) {
      state.workouts = state.workouts.filter(w => w !== c.w);
      ui.historyId = null;
    }
    save();
    render();
  },
  feel(el) {
    const c = setCtx(el);
    c.e.difficulty = el.dataset.v;
    save();
    c.card.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b === el));
  },
  restSheet(el) { openSheet({ type: 'rest', exId: setCtx(el).e.exId }); },
  setRest(el) { applyRest(+el.dataset.v); },
  setRestCustom() { applyRest(parseInt($('#restCustom').value, 10)); },
  timerAdj(el) { adjustTimer(+el.dataset.d); },
  timerStop() { stopTimer(); },

  finishSheet() { openSheet({ type: 'finish' }); },
  finish() { finishWorkout(); },
  discard() {
    if (!confirm('Discard this workout? Nothing from it will be saved.')) return;
    state.activeWorkout = null;
    save();
    stopTimer();
    releaseWakeLock();
    closeSheet();
    render();
  },

  openWorkout(el) { ui.historyId = el.dataset.id; render(); window.scrollTo(0, 0); },
  histBack() { ui.historyId = null; render(); },
  deleteWorkout() {
    if (!confirm('Delete this workout permanently?')) return;
    state.workouts = state.workouts.filter(w => w.id !== ui.historyId);
    ui.historyId = null;
    save();
    render();
  },

  metric(el) { ui.progressMetric = el.dataset.v; render(); },

  saveBW() {
    const lb = parseFloat($('#bwInput').value);
    const date = $('#bwDate').value || todayStr();
    if (!(lb > 50 && lb < 700)) { toast('Enter a weight in lb'); return; }
    const existing = state.bodyweight.find(b => b.date === date);
    if (existing) existing.lb = lb;
    else state.bodyweight.push({ id: uid(), date, lb });
    save();
    toast('Weight saved');
    render();
  },
  delBW(el) {
    state.bodyweight = state.bodyweight.filter(b => b.id !== el.dataset.id);
    save();
    render();
  },

  defaultRest(el) { state.settings.defaultRest = +el.dataset.v; save(); renderSheet(); },
  export() { exportBackup(); },
  import() { $('#importFile').click(); },
  wipe() {
    if (!confirm('Delete ALL workouts, bodyweight and settings from this phone?')) return;
    if (!confirm('Are you sure? This cannot be undone unless you have a backup.')) return;
    replaceState({});
    closeSheet();
    render();
  },
};

function applyRest(secs) {
  if (!(secs >= 10 && secs <= 900)) { toast('Pick 10–900 seconds'); return; }
  state.exerciseSettings[ui.sheet.exId] = { ...(state.exerciseSettings[ui.sheet.exId] || {}), rest: secs };
  save();
  closeSheet();
  render();
}

document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.act];
  if (fn) { ev.preventDefault(); fn(el); }
});

document.addEventListener('input', ev => {
  const el = ev.target;
  if (el.id === 'pickerSearch') { $('#pickerList').innerHTML = pickerList(el.value); return; }
  const f = el.dataset.field;
  if (f === 'weight' || f === 'reps') {
    const c = setCtx(el);
    const v = el.value.trim() === '' ? null : parseFloat(el.value);
    if (v != null && Number.isNaN(v)) return;
    c.s[f] = v;
    if (f === 'weight') retarget(c);
    save();
    syncRow(c.row, c.s);
  }
});

// Update a row's goal/miss state in place. Replacing the row here would
// steal focus from the input the user is moving to.
function syncRow(row, s) {
  const miss = s.done && s.target && s.reps != null && s.reps < s.target.reps;
  row.classList.toggle('miss', !!miss);
  const reps = row.querySelector('[data-field="reps"]');
  reps.placeholder = s.target ? s.target.reps : 'reps';
  let goal = row.querySelector('.goal');
  if (s.target && !goal) {
    goal = document.createElement('div');
    goal.className = 'goal';
    row.appendChild(goal);
  }
  if (goal) goal.textContent = s.target ? (miss ? `missed · goal ${s.target.reps}` : `goal ${s.target.reps}`) : '';
}

document.addEventListener('change', ev => {
  const el = ev.target;
  if (el.dataset.field === 'progressEx') { ui.progressEx = el.value; render(); }
});

// Select the whole number on focus so typing replaces it.
document.addEventListener('focusin', ev => {
  if (ev.target.matches('.stepper input')) setTimeout(() => ev.target.select(), 0);
});

// ---------- Boot ----------
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
navigator.storage?.persist?.().catch(() => {});
if (state.activeWorkout) { ui.tab = 'workout'; requestWakeLock(); }
render();
