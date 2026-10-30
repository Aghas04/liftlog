// Weight and length units. Everything is stored in lb and inches; these
// helpers convert only for display and input, so switching units never
// rewrites saved data.

export const LB_PER_KG = 2.20462;
export const CM_PER_IN = 2.54;

// Typical gym jumps in kg per equipment type.
export const KG_STEPS = { barbell: 2.5, dumbbell: 2, cable: 2.5, machine: 5, bodyweight: 2.5 };

export const isKg = units => units === 'kg';
export const weightUnit = units => (isKg(units) ? 'kg' : 'lb');
export const lengthUnit = units => (isKg(units) ? 'cm' : 'in');

/** Stored lb -> number shown to the user. */
export function toDisplay(lb, units) {
  if (lb == null || lb === '') return lb;
  return isKg(units) ? lb / LB_PER_KG : lb;
}

/** Number the user typed -> stored lb. */
export function fromDisplay(v, units) {
  if (v == null || v === '' || Number.isNaN(v)) return v;
  return isKg(units) ? v * LB_PER_KG : v;
}

/** Formatted weight without unit, e.g. "102.5". kg keeps two decimals for 1.25 kg plates. */
export function fmtWeight(lb, units) {
  if (lb == null || lb === '') return '';
  const v = toDisplay(lb, units);
  const places = isKg(units) ? 100 : 10;
  return String(Math.round(v * places) / places);
}

export const toLength = (inches, units) => (isKg(units) ? inches * CM_PER_IN : inches);
export const fromLength = (v, units) => (isKg(units) ? v / CM_PER_IN : v);
export const fmtLength = (inches, units) => String(Math.round(toLength(inches, units) * 10) / 10);

/** Default weight step for an equipment type, in stored lb. */
export function defaultStepLb(equipment, units, lbSteps) {
  return isKg(units) ? (KG_STEPS[equipment] || 2.5) * LB_PER_KG : lbSteps[equipment] || 5;
}

/** Step choices offered in the exercise menu, in stored lb. */
export function stepChoices(units) {
  return isKg(units) ? [1, 1.25, 2, 2.5, 5, 10].map(k => k * LB_PER_KG) : [1, 2.5, 5, 7.5, 10, 15, 20];
}

/** Snap a stored-lb weight onto the step grid (e.g. after switching to kg). */
export function snapToStep(lb, stepLb) {
  if (!(lb > 0) || !(stepLb > 0)) return lb;
  return Math.round(lb / stepLb) * stepLb;
}
