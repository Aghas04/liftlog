// Press and hold a card, then drag it up or down to reorder (like moving an
// app icon). Holding still for HOLD_MS lifts the card; moving first is a
// normal scroll. Other cards slide out of the way, the page scrolls near the
// edges, and letting go settles the card into its new place.
//
// cardDrag({ selector, ignore, blockOf, onDrop }):
//   selector  cards that can be dragged (in display order)
//   ignore    parts of a card that never start a drag (inputs, set rows)
//   blockOf   card -> the cards that move with it (a superset), in order
//   onDrop    (order) -> called with the cards' data-e indexes in their new order
const HOLD_MS = 400;
const SLOP = 8; // px the finger may wander while holding
const EDGE = 90; // px from the screen edge where auto-scroll starts
const MAX_SPEED = 16; // px per frame
const SETTLE_MS = 180;

let active = null;
export const isDragging = () => !!active;

export function cardDrag({ selector, ignore, blockOf, onDrop }) {
  let press = null;

  const pointOf = ev => (ev.touches ? ev.touches[0] || ev.changedTouches[0] : ev);

  function down(ev) {
    if (active || press || (ev.button != null && ev.button > 0)) return;
    const card = ev.target.closest(selector);
    if (!card || ev.target.closest(ignore)) return;
    const p = pointOf(ev);
    press = { card, x: p.clientX, y: p.clientY, timer: setTimeout(() => lift(card, press.y), HOLD_MS) };
  }

  function lift(card, y) {
    press = null;
    const cards = [...document.querySelectorAll(selector)];
    const block = blockOf(card).filter(c => cards.includes(c));
    if (!block.length) return;
    const rect = c => { const r = c.getBoundingClientRect(); return { top: r.top + scrollY, bottom: r.bottom + scrollY }; };
    const rects = new Map(cards.map(c => [c, rect(c)]));
    const gap = cards.length > 1 ? Math.max(0, rects.get(cards[1]).top - rects.get(cards[0]).bottom) : 12;
    // Units: the dragged block, and every other card or superset, kept whole.
    const units = [];
    for (const c of cards) {
      if (block.includes(c)) { if (!units.some(u => u.block)) units.push({ cards: block, block: true }); continue; }
      const own = blockOf(c).filter(x => cards.includes(x) && !block.includes(x));
      if (!units.some(u => u.cards.includes(c))) units.push({ cards: own.length ? own : [c] });
    }
    for (const u of units) { u.top = rects.get(u.cards[0]).top; u.bottom = rects.get(u.cards.at(-1)).bottom; }
    const from = units.findIndex(u => u.block);
    const me = units[from];
    const size = me.bottom - me.top + gap;
    active = { units, from, to: from, me, size, gap, startY: y, startScroll: scrollY, y, raf: 0 };
    for (const c of block) c.classList.add('dragging');
    for (const u of units) if (!u.block) for (const c of u.cards) c.classList.add('drag-shift');
    document.body.classList.add('drag-on');
    navigator.vibrate?.(8);
    active.raf = requestAnimationFrame(frame);
  }

  // Where the block lands: after every other unit whose middle is above the block's middle.
  function update() {
    const a = active;
    const dy = a.y - a.startY + (scrollY - a.startScroll);
    for (const c of a.me.cards) c.style.setProperty('--dy', `${dy}px`);
    const mid = (a.me.top + a.me.bottom) / 2 + dy;
    const others = a.units.filter(u => !u.block);
    let to = others.filter(u => (u.top + u.bottom) / 2 < mid).length;
    a.to = to;
    // Slide the others out of the way.
    others.forEach((u, i) => {
      const orig = a.units.indexOf(u);
      const shift = orig > a.from && i < to ? -a.size : orig < a.from && i >= to ? a.size : 0;
      for (const c of u.cards) c.style.setProperty('--sy', `${shift}px`);
    });
  }

  function frame() {
    if (!active) return;
    // Near the top or bottom edge: scroll the page, faster closer to the edge.
    const { y } = active;
    const speed = y < EDGE ? -MAX_SPEED * (1 - y / EDGE) : y > innerHeight - EDGE ? MAX_SPEED * (1 - (innerHeight - y) / EDGE) : 0;
    if (speed) { scrollBy(0, speed); update(); }
    active.raf = requestAnimationFrame(frame);
  }

  function move(ev) {
    const p = pointOf(ev);
    if (press && Math.hypot(p.clientX - press.x, p.clientY - press.y) > SLOP) { clearTimeout(press.timer); press = null; return; }
    if (!active) return;
    if (ev.cancelable) ev.preventDefault();
    active.y = p.clientY;
    // Follow the finger right away (the frame loop only adds edge scrolling).
    update();
  }

  function up() {
    if (press) { clearTimeout(press.timer); press = null; return; }
    if (!active) return;
    const a = active;
    cancelAnimationFrame(a.raf);
    update();
    // A click follows the release; it shouldn't press a button under the finger.
    const swallow = e => { e.stopPropagation(); e.preventDefault(); };
    document.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => document.removeEventListener('click', swallow, { capture: true }), 400);
    // Settle into the slot, then commit the new order.
    const order = a.units.filter(u => !u.block);
    order.splice(a.to, 0, a.me);
    const slotTop = a.to === 0 ? a.units[0].top : (() => {
      const prev = order[a.to - 1];
      const orig = a.units.indexOf(prev);
      const prevBottom = prev.bottom + (orig > a.from ? -a.size : 0);
      return prevBottom + a.gap;
    })();
    const dyFinal = slotTop - a.me.top;
    for (const c of a.me.cards) { c.classList.add('drag-settle'); c.style.setProperty('--dy', `${dyFinal}px`); }
    setTimeout(() => {
      const indexes = order.flatMap(u => u.cards.map(c => +c.dataset.e));
      cleanup();
      if (a.to !== a.from) onDrop(indexes);
    }, SETTLE_MS);
  }

  function cleanup() {
    document.querySelectorAll('.dragging, .drag-shift, .drag-settle').forEach(c => {
      c.classList.remove('dragging', 'drag-shift', 'drag-settle');
      c.style.removeProperty('--dy');
      c.style.removeProperty('--sy');
    });
    document.body.classList.remove('drag-on');
    active = null;
  }

  document.addEventListener('touchstart', down, { passive: true });
  document.addEventListener('mousedown', down);
  // Not passive: once a card is lifted, the page must not scroll under the finger.
  document.addEventListener('touchmove', move, { passive: false });
  document.addEventListener('mousemove', move);
  document.addEventListener('touchend', up);
  document.addEventListener('touchcancel', () => { if (press) { clearTimeout(press.timer); press = null; } if (active) up(); });
  document.addEventListener('mouseup', up);
  // A long press shouldn't open the browser's menu or select text.
  document.addEventListener('contextmenu', ev => { if (active || (press && ev.target.closest(selector))) ev.preventDefault(); });
}
