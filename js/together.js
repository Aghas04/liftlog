// Train together: share a workout as a link. The other phone starts the same
// exercises with its own weights and history. No server: the workout travels
// in the link itself. Pure functions (the app does the UI and saving).

const b64url = {
  encode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  decode(code) {
    const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((code.length + 3) % 4));
    return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
  },
};

/**
 * Pack a workout's exercises: [{ exId, sets, zone?, group? }]. Custom lifts
 * carry their details so the other phone can recreate them.
 * lookup(exId) -> exercise. Returns the code for the link.
 */
export function packWorkout({ name, dayType, exercises }, lookup) {
  const groups = [];
  const e = exercises.map(x => {
    const ex = lookup(x.exId);
    const out = { i: x.exId, s: Math.max(1, Math.min(10, x.sets || 3)) };
    if (x.zone) out.z = x.zone;
    if (x.group) { if (!groups.includes(x.group)) groups.push(x.group); out.g = groups.indexOf(x.group) + 1; }
    if (ex?.custom) out.c = { n: ex.name, m: ex.muscle, q: ex.equipment, k: !!ex.compound };
    return out;
  });
  return b64url.encode(JSON.stringify({ v: 1, n: String(name || 'Workout').slice(0, 60), d: dayType || null, e }));
}

/** Read a code back. Returns null when it isn't a valid shared workout. */
export function unpackWorkout(code) {
  try {
    const data = JSON.parse(b64url.decode(code));
    if (data?.v !== 1 || !Array.isArray(data.e) || !data.e.length || data.e.length > 30) return null;
    const exercises = data.e
      .filter(x => typeof x?.i === 'string' && x.i.length < 80)
      .map(x => ({
        exId: x.i,
        sets: Math.max(1, Math.min(10, +x.s || 3)),
        ...(Array.isArray(x.z) && x.z.length === 2 ? { zone: x.z.map(Number) } : {}),
        ...(x.g ? { group: `g${+x.g}` } : {}),
        ...(x.c && typeof x.c.n === 'string' ? { custom: { name: x.c.n.slice(0, 60), muscle: x.c.m, equipment: x.c.q, compound: !!x.c.k } } : {}),
      }));
    if (!exercises.length) return null;
    return { name: String(data.n || 'Workout').slice(0, 60), dayType: typeof data.d === 'string' ? data.d : null, exercises };
  } catch {
    return null;
  }
}

/**
 * Turn a shared workout into this phone's exercises.
 * ctx: { has(exId), customs: [custom exercises], blocked: [exIds], replace(exId) -> exercise|null, muscles }
 * Returns { exercises: [{ exId, sets, zone?, group? }], newCustoms: [...], swaps: [{ from, to }], dropped: [names] }.
 */
export function resolveShared(shared, ctx) {
  const newCustoms = [];
  const swaps = [];
  const dropped = [];
  const out = [];
  const blocked = new Set(ctx.blocked || []);
  for (const x of shared.exercises) {
    let id = x.exId;
    if (!ctx.has(id)) {
      if (!x.custom || !ctx.muscles[x.custom.muscle]) { dropped.push(x.custom?.name || id); continue; }
      // A custom lift: reuse one with the same name, or create it.
      const same = [...ctx.customs, ...newCustoms].find(c => c.name.trim().toLowerCase() === x.custom.name.trim().toLowerCase());
      if (same) id = same.id;
      else {
        const c = { id: `c_${x.exId.replace(/^c_/, '')}`, name: x.custom.name, muscle: x.custom.muscle, equipment: x.custom.equipment || 'machine', compound: x.custom.compound, custom: true };
        newCustoms.push(c);
        id = c.id;
      }
    }
    if (blocked.has(id)) {
      const r = ctx.replace(id);
      if (!r) { dropped.push(id); continue; }
      swaps.push({ from: id, to: r.id });
      id = r.id;
    }
    if (out.some(o => o.exId === id)) continue;
    out.push({ exId: id, sets: x.sets, ...(x.zone ? { zone: x.zone } : {}), ...(x.group ? { group: x.group } : {}) });
  }
  // A superset needs two lifts; a lone partner just becomes a normal exercise.
  for (const o of out) if (o.group && out.filter(p => p.group === o.group).length < 2) delete o.group;
  return { exercises: out, newCustoms, swaps, dropped };
}
