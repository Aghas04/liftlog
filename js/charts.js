// Tiny dependency-free SVG line chart.

const W = 340;
const H = 170;
const PAD = { l: 38, r: 12, t: 14, b: 24 };
const DAY = 86400000;

const fmt = v => (Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(Math.round(v)));
const dateLabel = (t, withYear) => new Date(t).toLocaleDateString(undefined, withYear ? { month: 'short', year: 'numeric' } : { month: 'short', day: 'numeric' });

function star(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

/**
 * points: [{ x: timestamp, y: number }] sorted by x
 * opts.prs:   star points that beat every earlier point
 * opts.trend: dotted trend line projected two weeks ahead
 * Points get data-i so the page can show details on tap.
 */
export function lineChart(points, opts = {}) {
  if (!points.length) return '';
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);

  // Least-squares trend over days.
  let trend = null;
  if (opts.trend && points.length >= 3) {
    const n = points.length;
    const dx = xs.map(x => (x - xs[0]) / DAY);
    const mx = dx.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (dx[i] - mx) * (ys[i] - my); den += (dx[i] - mx) ** 2; }
    if (den > 0) {
      const slope = num / den;
      const at = x => my + slope * ((x - xs[0]) / DAY - mx);
      const x2 = xs[n - 1] + 14 * DAY;
      trend = { x1: xs[0], y1: at(xs[0]), x2, y2: at(x2) };
    }
  }

  let minX = Math.min(...xs), maxX = Math.max(...xs, trend ? trend.x2 : -Infinity);
  if (minX === maxX) { minX -= DAY; maxX += DAY; }
  let minY = Math.min(...ys, trend ? Math.min(trend.y1, trend.y2) : Infinity);
  let maxY = Math.max(...ys, trend ? Math.max(trend.y1, trend.y2) : -Infinity);
  const padY = (maxY - minY) * 0.15 || maxY * 0.1 || 1;
  minY = Math.max(0, minY - padY);
  maxY += padY;

  // Spans over ~11 months show the year so "Oct 28" isn't ambiguous.
  const long = xs[xs.length - 1] - xs[0] > 330 * DAY;
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

  // Too many points to show dots cleanly; keep tap targets and PR stars.
  const dense = points.length > 40;
  let best = -Infinity;
  const marks = points.map((p, i) => {
    const cx = sx(p.x).toFixed(1);
    const cy = sy(p.y).toFixed(1);
    // A point may carry its own PR flag (computed over full history when the chart is filtered).
    const isPR = opts.prs && (p.pr ?? (i > 0 && p.y > best + 0.01));
    best = Math.max(best, p.y);
    const mark = isPR
      ? `<polygon points="${star(+cx, +cy, 7)}" class="pt pr" data-i="${i}"/>`
      : `<circle cx="${cx}" cy="${cy}" r="${dense ? 0 : 3.5}" class="pt" data-i="${i}"/>`;
    return `${mark}<circle cx="${cx}" cy="${cy}" r="14" fill="transparent" data-act="chartPt" data-i="${i}"/>`;
  }).join('');

  const trendLine = trend
    ? `<line x1="${sx(trend.x1).toFixed(1)}" y1="${sy(trend.y1).toFixed(1)}" x2="${sx(trend.x2).toFixed(1)}" y2="${sy(trend.y2).toFixed(1)}" class="trend"/>
       <text x="${W - PAD.r}" y="${(sy(trend.y2) - 6).toFixed(1)}" text-anchor="end" font-size="10" class="trend-lbl">${fmt(trend.y2)}</text>`
    : '';

  return `<svg viewBox="0 0 ${W} ${H}" role="img" class="chart">
    <defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" style="stop-color:var(--accent);stop-opacity:0.28"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/>
    </linearGradient></defs>
    ${grid}
    <path d="${area}" fill="url(#g)"/>
    ${trendLine}
    <path d="${d}" fill="none" style="stroke:var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${marks}
    <text x="${PAD.l}" y="${H - 6}" fill="#8b93a1" font-size="10">${dateLabel(points[0].x, long)}</text>
    <text x="${W - PAD.r}" y="${H - 6}" fill="#8b93a1" font-size="10" text-anchor="end">${trend ? 'in 2 wks' : dateLabel(points[points.length - 1].x, long)}</text>
  </svg>`;
}
