// Reads an Apple Health export.xml (can be hundreds of MB) in chunks and
// pulls out bodyweight, body fat and waist records.

const TYPES = {
  HKQuantityTypeIdentifierBodyMass: 'weight',
  HKQuantityTypeIdentifierBodyFatPercentage: 'bodyfat',
  HKQuantityTypeIdentifierWaistCircumference: 'waist',
};
const RECORD = /<Record\b[^>]*>/g;
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];

function convert(kind, unit, value) {
  if (kind === 'weight') return unit === 'kg' ? value * 2.20462 : unit === 'g' ? value / 453.592 : value;
  if (kind === 'bodyfat') return unit === '%' && value > 1 ? value : value * 100;
  if (kind === 'waist') return unit === 'cm' ? value / 2.54 : unit === 'm' ? value * 39.37 : value;
  return value;
}

/** Parse text and add the last reading per kind per day into `out`. */
export function parseChunk(text, out) {
  for (const m of text.matchAll(RECORD)) {
    const tag = m[0];
    const kind = TYPES[attr(tag, 'type')];
    if (!kind) continue;
    const value = parseFloat(attr(tag, 'value'));
    const date = attr(tag, 'startDate')?.slice(0, 10);
    if (!date || !Number.isFinite(value)) continue;
    out[kind] ||= {};
    out[kind][date] = Math.round(convert(kind, attr(tag, 'unit'), value) * 10) / 10;
  }
}

/** onProgress(fraction) is called as the file is read. */
export async function readHealthExport(file, onProgress) {
  const out = {};
  const reader = file.stream().getReader();
  const decoder = new TextDecoder();
  let carry = '';
  let read = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    read += value.byteLength;
    const text = carry + decoder.decode(value, { stream: true });
    // Keep a possibly cut-off tag for the next chunk.
    const cut = text.lastIndexOf('<');
    parseChunk(cut > 0 ? text.slice(0, cut) : text, out);
    carry = cut > 0 ? text.slice(cut) : '';
    onProgress?.(read / file.size);
  }
  parseChunk(carry, out);
  return out;
}
