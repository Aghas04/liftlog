// Front/back body outline whose muscles light up by weekly set count.

// Weekly sets at which a muscle shows at full brightness.
const FULL = 12;

const FRONT = [
  ['shoulders', '<ellipse cx="66" cy="60" rx="13" ry="11"/><ellipse cx="134" cy="60" rx="13" ry="11"/>'],
  ['chest', '<path d="M98 52 L80 53 Q71 62 75 80 Q88 86 98 82 Z"/><path d="M102 52 L120 53 Q129 62 125 80 Q112 86 102 82 Z"/>'],
  ['biceps', '<ellipse cx="59" cy="90" rx="8" ry="17"/><ellipse cx="141" cy="90" rx="8" ry="17"/>'],
  ['abs', '<rect x="87" y="88" width="26" height="52" rx="7"/>'],
  ['quads', '<ellipse cx="87" cy="176" rx="12" ry="31"/><ellipse cx="113" cy="176" rx="12" ry="31"/>'],
  ['calves', '<ellipse cx="87" cy="230" rx="7" ry="17"/><ellipse cx="113" cy="230" rx="7" ry="17"/>'],
  ['forearms', '<ellipse cx="53" cy="126" rx="6" ry="20"/><ellipse cx="147" cy="126" rx="6" ry="20"/>'],
  ['adductors', '<ellipse cx="100" cy="170" rx="4.5" ry="19"/>'],
];

const BACK = [
  ['back', '<path d="M310 47 L284 55 Q277 82 291 113 L310 120 L329 113 Q343 82 336 55 Z"/>'],
  ['shoulders', '<ellipse cx="276" cy="60" rx="13" ry="11"/><ellipse cx="344" cy="60" rx="13" ry="11"/>'],
  ['triceps', '<ellipse cx="269" cy="91" rx="8" ry="17"/><ellipse cx="351" cy="91" rx="8" ry="17"/>'],
  ['glutes', '<ellipse cx="298" cy="141" rx="13" ry="13"/><ellipse cx="322" cy="141" rx="13" ry="13"/>'],
  ['hamstrings', '<ellipse cx="297" cy="182" rx="11" ry="25"/><ellipse cx="323" cy="182" rx="11" ry="25"/>'],
  ['calves', '<ellipse cx="297" cy="228" rx="9" ry="17"/><ellipse cx="323" cy="228" rx="9" ry="17"/>'],
];

// Neutral body parts drawn underneath.
const BASE = cx => `
  <circle cx="${cx}" cy="24" r="14"/>
  <rect x="${cx - 6}" y="36" width="12" height="10" rx="3"/>
  <path d="M${cx - 30} 50 Q${cx} 42 ${cx + 30} 50 L${cx + 28} 120 Q${cx} 130 ${cx - 28} 120 Z"/>
  <ellipse cx="${cx - 47}" cy="126" rx="6" ry="20"/><ellipse cx="${cx + 47}" cy="126" rx="6" ry="20"/>
  <path d="M${cx - 26} 118 Q${cx} 128 ${cx + 26} 118 L${cx + 25} 150 L${cx - 25} 150 Z"/>`;

export function muscleMap(counts) {
  const part = ([m, shapes]) => {
    const n = counts[m] || 0;
    const a = n ? 0.25 + 0.75 * Math.min(1, n / FULL) : 0;
    return `<g class="mm" data-m="${m}" style="fill:${n ? 'var(--accent)' : '#2a3039'};fill-opacity:${n ? a.toFixed(2) : 1}">${shapes}</g>`;
  };
  return `<svg viewBox="0 0 420 256" class="muscle-map" role="img" aria-label="Muscles trained in the last 7 days">
    <g fill="#1c2027">${BASE(100)}${BASE(310)}</g>
    ${FRONT.map(part).join('')}
    ${BACK.map(part).join('')}
    <text x="100" y="254" text-anchor="middle" fill="#8b93a1" font-size="11" font-weight="700">FRONT</text>
    <text x="310" y="254" text-anchor="middle" fill="#8b93a1" font-size="11" font-weight="700">BACK</text>
  </svg>`;
}
