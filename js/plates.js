// Plate calculator for barbell lifts (lb).

const PLATES = [45, 35, 25, 10, 5, 2.5];
const STYLE = {
  45: { color: '#ff5f6d', h: 104, w: 16 },
  35: { color: '#3ed4ff', h: 92, w: 15 },
  25: { color: '#ffc24b', h: 80, w: 14 },
  10: { color: '#c4f542', h: 62, w: 11 },
  5: { color: '#f2f4f7', h: 48, w: 10 },
  2.5: { color: '#8b93a1', h: 38, w: 8 },
};

/** Plates for one side of the bar, heaviest first. */
export function platesFor(total, bar = 45) {
  let side = (total - bar) / 2;
  const plates = [];
  if (side <= 0) return { plates, leftover: 0 };
  for (const p of PLATES) {
    while (side >= p - 1e-9) { plates.push(p); side -= p; }
  }
  return { plates, leftover: Math.round(side * 2 * 10) / 10 };
}

export function platesSvg(plates) {
  const W = 320;
  const H = 130;
  const mid = H / 2;
  let x = 96;
  const shapes = plates.map(p => {
    const s = STYLE[p];
    const r = `<rect x="${x}" y="${mid - s.h / 2}" width="${s.w}" height="${s.h}" rx="3" fill="${s.color}"/>`;
    x += s.w + 3;
    return r;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="plates-svg" role="img" aria-label="Plates per side: ${plates.join(', ') || 'none'}">
    <rect x="0" y="${mid - 5}" width="80" height="10" rx="3" fill="#5b6370"/>
    <rect x="78" y="${mid - 14}" width="14" height="28" rx="3" fill="#8b93a1"/>
    <rect x="92" y="${mid - 7}" width="${W - 96}" height="14" rx="4" fill="#3a414c"/>
    ${shapes}
  </svg>`;
}
