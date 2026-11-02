// Workout history as a spreadsheet (CSV): one row per logged set.
// Opens in Numbers, Excel or Google Sheets.
import { MUSCLES, EQUIPMENT } from './data.js';
import { toDisplay } from './units.js';

const cell = v => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const round = v => Math.round(v * 100) / 100;

/**
 * workouts: saved workouts. lookup(exId) -> exercise. units: 'lb' | 'kg'.
 * dayName(dayType) -> split name. Returns the CSV text (with a header row).
 */
export function workoutsCsv(workouts, lookup, units = 'lb', dayName = id => id) {
  const unit = units === 'kg' ? 'kg' : 'lb';
  const rows = [['Date', 'Time', 'Workout', 'Exercise', 'Muscle', 'Equipment', 'Set', 'Type', `Weight (${unit})`, 'Reps or seconds', 'Target reps', 'Feel', 'PR']];
  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date));
  for (const w of sorted) {
    const d = new Date(w.date);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const name = w.templateName || dayName(w.dayType);
    for (const e of w.exercises) {
      const ex = lookup(e.exId) || { name: e.exId };
      let n = 0;
      for (const s of e.sets) {
        if (!s.done) continue;
        const warm = !!s.warmup;
        if (!warm) n++;
        // Assisted machines store assistance as negative weight; the sheet keeps the sign.
        const weight = s.weight == null ? '' : round(toDisplay(s.weight, units));
        rows.push([
          date, time, name, ex.name, MUSCLES[ex.muscle] || '', EQUIPMENT[ex.equipment]?.name || '',
          warm ? 'W' : n, warm ? 'Warm-up' : 'Working', weight, s.reps ?? '', s.target?.reps ?? '', e.difficulty || '', s.pr ? 'Yes' : '',
        ]);
      }
    }
  }
  return rows.map(r => r.map(cell).join(',')).join('\r\n');
}
