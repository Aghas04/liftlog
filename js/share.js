// Renders a workout summary as a shareable 1080x1350 image.

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fit(ctx, text, max) {
  if (ctx.measureText(text).width <= max) return text;
  while (text.length > 1 && ctx.measureText(text + '…').width > max) text = text.slice(0, -1);
  return text + '…';
}

/**
 * card: { color, icon, title, date, stats: [[value, label]x3], lifts: [[name, detail, isPR]], footer }
 * Returns a PNG Blob.
 */
export function workoutCard(card) {
  const W = 1080, H = 1350;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const font = (w, s) => `${w} ${s}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

  ctx.fillStyle = '#0d0f12';
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, 180, 40, W / 2, 180, 900);
  g.addColorStop(0, card.color + '66');
  g.addColorStop(1, '#0d0f1200');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.font = font(400, 120);
  ctx.fillText(card.icon, W / 2, 230);
  ctx.fillStyle = card.color;
  ctx.font = font(800, 34);
  ctx.fillText('WORKOUT COMPLETE', W / 2, 320);
  ctx.fillStyle = '#f2f4f7';
  ctx.font = font(900, 76);
  ctx.fillText(fit(ctx, card.title, W - 120), W / 2, 410);
  ctx.fillStyle = '#8b93a1';
  ctx.font = font(600, 34);
  ctx.fillText(card.date, W / 2, 465);

  // Stat tiles
  const tw = 300, th = 170, gap = 30, x0 = (W - (tw * 3 + gap * 2)) / 2;
  card.stats.forEach(([v, l], i) => {
    const x = x0 + i * (tw + gap);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundRect(ctx, x, 520, tw, th, 28);
    ctx.fill();
    ctx.fillStyle = '#f2f4f7';
    ctx.font = font(900, 64);
    ctx.fillText(v, x + tw / 2, 610);
    ctx.fillStyle = '#8b93a1';
    ctx.font = font(600, 28);
    ctx.fillText(l, x + tw / 2, 655);
  });

  // Lifts
  ctx.textAlign = 'left';
  let y = 770;
  for (const [name, detail, pr] of card.lifts.slice(0, 6)) {
    ctx.fillStyle = pr ? 'rgba(255,201,75,0.14)' : 'rgba(255,255,255,0.04)';
    roundRect(ctx, 60, y - 52, W - 120, 78, 20);
    ctx.fill();
    ctx.fillStyle = pr ? '#ffc94b' : '#f2f4f7';
    ctx.font = font(800, 34);
    ctx.fillText(fit(ctx, (pr ? '🏆 ' : '') + name, 520), 90, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#b7bfcc';
    ctx.font = font(600, 30);
    ctx.fillText(fit(ctx, detail, 400), W - 90, y);
    ctx.textAlign = 'left';
    y += 92;
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = card.color;
  ctx.font = font(800, 30);
  ctx.fillText(card.footer, W / 2, H - 60);
  return new Promise(r => c.toBlob(r, 'image/png'));
}

export async function shareOrDownload(blob, name, title) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title });
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
