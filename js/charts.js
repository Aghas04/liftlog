// Tiny dependency-free SVG line chart.

const W = 340;
const H = 170;
const PAD = { l: 38, r: 12, t: 12, b: 24 };

const fmt = v => (Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(Math.round(v)));
const shortDate = t => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** points: [{ x: timestamp, y: number }] sorted by x */
export function lineChart(points) {
  if (!points.length) return '';
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  let minX = Math.min(...xs), maxX = Math.max(...xs);
  if (minX === maxX) { minX -= 86400000; maxX += 86400000; }
  let minY = Math.min(...ys), maxY = Math.max(...ys);
  const padY = (maxY - minY) * 0.15 || maxY * 0.1 || 1;
  minY = Math.max(0, minY - padY);
  maxY += padY;

  const sx = x => PAD.l + ((x - minX) / (maxX - minX)) * (W - PAD.l - PAD.r);
  const sy = y => H - PAD.b - ((y - minY) / (maxY - minY)) * (H - PAD.t - PAD.b);

  const grid = [0, 0.5, 1].map(f => {
    const v = minY + (maxY - minY) * f;
    const y = sy(v).toFixed(1);
    return `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y}" y2="${y}" stroke="#2c313a" stroke-width="1"/>
      <text x="${PAD.l - 6}" y="${y}" fill="#8b93a1" font-size="10" text-anchor="end" dominant-baseline="middle">${fmt(v)}</text>`;
  }).join('');

  const d = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  const area = `${d} L${sx(points[points.length - 1].x).toFixed(1)},${H - PAD.b} L${sx(points[0].x).toFixed(1)},${H - PAD.b} Z`;
  const dots = points.length <= 40
    ? points.map(p => `<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="3" fill="#c4f542"/>`).join('')
    : '';

  return `<svg viewBox="0 0 ${W} ${H}" role="img">
    <defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#c4f542" stop-opacity="0.25"/><stop offset="1" stop-color="#c4f542" stop-opacity="0"/>
    </linearGradient></defs>
    ${grid}
    <path d="${area}" fill="url(#g)"/>
    <path d="${d}" fill="none" stroke="#c4f542" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
    <text x="${PAD.l}" y="${H - 6}" fill="#8b93a1" font-size="10">${shortDate(points[0].x)}</text>
    <text x="${W - PAD.r}" y="${H - 6}" fill="#8b93a1" font-size="10" text-anchor="end">${shortDate(points[points.length - 1].x)}</text>
  </svg>`;
}
