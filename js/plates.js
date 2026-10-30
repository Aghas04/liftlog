// Plate calculator for barbell lifts, in lb or kg.

export const PLATE_SETS = {
  lb: { plates: [45, 35, 25, 10, 5, 2.5], bars: [[45, 'Olympic 45'], [35, "Women's 35"], [25, 'EZ / 25'], [15, 'Training 15']] },
  kg: { plates: [25, 20, 15, 10, 5, 2.5, 1.25], bars: [[20, 'Olympic 20'], [15, "Women's 15"], [10, 'EZ / 10'], [7, 'Training 7']] },
};

// Bigger plates are taller; colors follow the usual plate colors.
const STYLE = {
  lb: { 45: ['#ff5f6d', 104, 16], 35: ['#3ed4ff', 92, 15], 25: ['#ffc24b', 80, 14], 10: ['#c4f542', 62, 11], 5: ['#f2f4f7', 48, 10], 2.5: ['#8b93a1', 38, 8] },
  kg: { 25: ['#ff5f6d', 104, 16], 20: ['#3ed4ff', 104, 15], 15: ['#ffc24b', 96, 14], 10: ['#c4f542', 84, 12], 5: ['#f2f4f7', 60, 10], 2.5: ['#8b93a1', 46, 9], 1.25: ['#5b6370', 38, 7] },
};

/** Plates for one side of the bar, heaviest first. total and bar in the same unit. */
export function platesFor(total, bar = 45, unit = 'lb') {
  let side = (total - bar) / 2;
  const plates = [];
  if (side <= 0) return { plates, leftover: 0 };
  for (const p of PLATE_SETS[unit].plates) {
    while (side >= p - 1e-9) { plates.push(p); side -= p; }
  }
  return { plates, leftover: Math.round(side * 2 * 100) / 100 };
}

export function platesSvg(plates, unit = 'lb') {
  const W = 320;
  const H = 130;
  const mid = H / 2;
  let x = 96;
  const shapes = plates.map(p => {
    const [color, h, w] = STYLE[unit][p];
    const r = `<rect x="${x}" y="${mid - h / 2}" width="${w}" height="${h}" rx="3" fill="${color}"/>`;
    x += w + 3;
    return r;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="plates-svg" role="img" aria-label="Plates per side: ${plates.join(', ') || 'none'}">
    <rect x="0" y="${mid - 5}" width="80" height="10" rx="3" fill="#5b6370"/>
    <rect x="78" y="${mid - 14}" width="14" height="28" rx="3" fill="#8b93a1"/>
    <rect x="92" y="${mid - 7}" width="${W - 96}" height="14" rx="4" fill="#3a414c"/>
    ${shapes}
  </svg>`;
}
