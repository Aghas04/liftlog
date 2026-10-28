// Progress photos, kept in IndexedDB (localStorage is far too small for images).

const DB = 'liftlog-photos';
const STORE = 'photos';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(out?.result ?? out);
    t.onerror = () => reject(t.error);
  });
}

/** Photos without image data, newest first: { id, date }. */
export async function listPhotos() {
  const all = await tx('readonly', s => s.getAll());
  return all.map(({ id, date }) => ({ id, date })).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

export async function photoBlob(id) {
  const rec = await tx('readonly', s => s.get(id));
  return rec?.blob || null;
}

export function deletePhoto(id) {
  return tx('readwrite', s => s.delete(id));
}

// Downscale to 1280px on the long side and re-encode as JPEG to save space.
async function compress(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise(r => c.toBlob(r, 'image/jpeg', 0.82));
}

export async function addPhoto(file, date, id) {
  let blob;
  try { blob = await compress(file); } catch { blob = file; }
  await tx('readwrite', s => s.put({ id, date, blob }));
}
