// Visual effects: count-up numbers and confetti.

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Animate every [data-count] inside root from 0 to its value.
export function countUp(root) {
  const items = [...root.querySelectorAll('[data-count]')].map(el => ({ el, to: parseFloat(el.dataset.count) || 0, pre: el.dataset.prefix || '' }));
  if (reduceMotion()) {
    for (const { el, to, pre } of items) el.textContent = pre + to.toLocaleString();
    return;
  }
  const start = performance.now();
  const dur = 750;
  const frame = now => {
    const t = Math.min(1, (now - start) / dur);
    const k = 1 - Math.pow(1 - t, 3);
    for (const { el, to, pre } of items) el.textContent = pre + Math.round(to * k).toLocaleString();
    if (t < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

export function confetti(colors) {
  if (reduceMotion()) return;
  const c = document.createElement('canvas');
  c.className = 'confetti';
  const dpr = window.devicePixelRatio || 1;
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  document.body.appendChild(c);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  const parts = Array.from({ length: 140 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 80,
    y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 12,
    vy: -Math.random() * 13 - 4,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.4,
    w: 6 + Math.random() * 6,
    h: 8 + Math.random() * 8,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
  const t0 = performance.now();
  const frame = now => {
    const age = now - t0;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalAlpha = Math.max(0, 1 - Math.max(0, age - 1800) / 900);
    for (const p of parts) {
      p.vy += 0.32;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
      ctx.restore();
    }
    if (age < 2700) requestAnimationFrame(frame);
    else c.remove();
  };
  requestAnimationFrame(frame);
}
