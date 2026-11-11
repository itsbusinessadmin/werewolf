// ─────────────────────────────────────────────────────────────
//  Moonhollow art kit — every character is drawn in code (SVG),
//  so it stays crisp on any phone and needs no image files.
//  PNG copies are exported to /assets/png by tools/export-png.mjs
// ─────────────────────────────────────────────────────────────

const OUT = '#3A2E4D';        // soft outline colour used everywhere
const SW = 2.6;               // outline width

export const SKIN = ['#FFE3CF', '#F8CBA6', '#E9B087', '#C98E63', '#A06A45', '#6E4730'];

// little helper: draw shapes with an outline that never shows inner seams
function puffy(circles, fill) {
  const back = circles.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r + SW * 0.9}" fill="${OUT}"/>`).join('');
  const front = circles.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`).join('');
  return back + front;
}
const st = (fill) => `fill="${fill}" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round" stroke-linecap="round"`;
const line = (w = SW) => `fill="none" stroke="${OUT}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;

// ── Hair: parts drawn behind the head ─────────────────────────
function hairBack(style, c) {
  switch (style) {
    case 'long':
      return `<path d="M27 58 C24 28 42 18 60 18 C78 18 96 28 93 58 L97 104 C84 112 36 112 23 104 Z" ${st(c)}/>`;
    case 'bob':
      return `<path d="M25 60 C22 30 40 19 60 19 C80 19 98 30 95 60 L96 84 C90 90 30 90 24 84 Z" ${st(c)}/>`;
    case 'pigtails':
      return `${puffy([[22, 72, 11], [98, 72, 11]], c)}
        <circle cx="31" cy="64" r="4" fill="#FF7A9C" stroke="${OUT}" stroke-width="2"/>
        <circle cx="89" cy="64" r="4" fill="#FF7A9C" stroke="${OUT}" stroke-width="2"/>`;
    case 'bun':
      return puffy([[60, 19, 11]], c);
    default:
      return '';
  }
}

// ── Hair: fringe drawn on top of the head ─────────────────────
function hairFront(style, c) {
  switch (style) {
    case 'short':
    case 'bun':
      return `<path d="M31 58 C28 33 44 23 60 23 C77 23 93 33 89 58 C85 48 77 42 67 41 C58 47 44 48 35 46 C33 50 32 54 31 58Z" ${st(c)}/>`;
    case 'bangs':
    case 'long':
    case 'bob':
    case 'pigtails':
      return `<path d="M30 57 C28 31 44 22 60 22 C76 22 92 31 90 57 C84 50 78 47 72 47 C70 43 68 41 66 40 C64 45 56 47 48 47 C40 47 34 51 30 57Z" ${st(c)}/>`;
    case 'side':
      return `<path d="M30 58 C27 31 44 21 62 22 C80 23 93 35 90 56 C82 41 64 38 52 46 C44 51 35 54 30 58Z" ${st(c)}/>`;
    case 'spiky':
      return `<path d="M30 57 L27 37 L37 40 L39 24 L49 32 L56 17 L64 30 L73 19 L76 33 L87 27 L86 41 L93 44 L90 57 C82 47 72 45 60 45 C46 45 38 49 30 57Z" ${st(c)}/>`;
    case 'curly':
      return puffy([[33, 50, 9], [36, 38, 10], [46, 29, 10], [60, 25, 11], [74, 29, 10], [84, 38, 10], [87, 50, 9], [60, 36, 9], [47, 40, 7], [73, 40, 7]], c);
    case 'tuft':
      return `<path d="M55 30 C54 22 60 20 61 26 C63 19 70 22 66 30" ${line()}/>`;
    default:
      return '';
  }
}

// ── Hats & headwear ───────────────────────────────────────────
function hat(kind) {
  switch (kind) {
    case 'straw':
      return `<path d="M38 37 C37 15 83 15 82 37Z" ${st('#F2C35B')}/>
        <path d="M38 33 C50 30 70 30 82 33 L82 37 C70 34 50 34 38 37Z" fill="#E4574F"/>
        <ellipse cx="60" cy="38" rx="45" ry="8.5" ${st('#F7D277')}/>
        <path d="M24 38 q6 2 12 1 M84 39 q6 1 12 -1" ${line(1.6)} opacity=".45"/>`;
    case 'chef':
      return `${puffy([[45, 22, 12], [60, 15, 14], [75, 22, 12]], '#FFFFFF')}
        <rect x="36" y="25" width="48" height="15" rx="5" ${st('#FFFFFF')}/>`;
    case 'beanie':
      return `<path d="M30 50 C29 20 91 20 90 50Z" ${st('#4FB6B0')}/>
        <rect x="27" y="43" width="66" height="11" rx="5.5" ${st('#3C9993')}/>
        ${puffy([[60, 18, 6]], '#FFF4E0')}`;
    case 'beanie-orange':
      return `<path d="M30 50 C29 20 91 20 90 50Z" ${st('#F59B4C')}/>
        <rect x="27" y="43" width="66" height="11" rx="5.5" ${st('#E07E30')}/>
        ${puffy([[60, 18, 6]], '#FFF4E0')}`;
    case 'beret':
      return `<path d="M30 40 C26 22 56 14 76 20 C92 24 96 36 88 42 C72 34 48 34 30 40Z" ${st('#E5566E')}/>
        <path d="M60 17 l2 -6" ${line(3)}/>`;
    case 'flowers':
      return [[36, 40, '#FF8FB1'], [48, 31, '#FFD45E'], [60, 28, '#9CD3FF'], [72, 31, '#FF8FB1'], [84, 40, '#C8A2FF']]
        .map(([x, y, c]) => `<g transform="translate(${x} ${y})">
          ${[0, 72, 144, 216, 288].map(a => `<ellipse cx="0" cy="-4.2" rx="3" ry="4" fill="${c}" stroke="${OUT}" stroke-width="1.4" transform="rotate(${a})"/>`).join('')}
          <circle r="2.4" fill="#FFF3B0" stroke="${OUT}" stroke-width="1.2"/></g>`).join('');
    case 'tophat':
      return `<rect x="42" y="6" width="36" height="28" rx="4" ${st('#3D3556')}/>
        <rect x="42" y="25" width="36" height="6" fill="#E4574F"/>
        <ellipse cx="60" cy="35" rx="28" ry="5.5" ${st('#3D3556')}/>`;
    case 'doc':
      return `<path d="M36 41 L40 21 C52 17 68 17 80 21 L84 41 C70 37 50 37 36 41Z" ${st('#FFFFFF')}/>
        <path d="M60 23 v12 M54 29 h12" stroke="#F0506E" stroke-width="4.2" stroke-linecap="round"/>`;
    case 'jester':
      return `<path d="M33 45 C31 28 22 18 9 17 C24 6 50 14 60 36 C49 36 40 39 33 45Z" ${st('#E5566E')}/>
        <path d="M87 45 C89 28 98 18 111 17 C96 6 70 14 60 36 C71 36 80 39 87 45Z" ${st('#4FB6B0')}/>
        <path d="M30 46 Q60 30 90 46 L90 52 Q60 37 30 52Z" ${st('#FFD45E')}/>
        <circle cx="9" cy="17" r="5.2" ${st('#FFD45E')}/><circle cx="111" cy="17" r="5.2" ${st('#FFD45E')}/>
        <circle cx="60" cy="36" r="3.6" ${st('#FFD45E')}/>`;
    case 'bow':
      return `<g transform="translate(80 30) rotate(18)">
        <path d="M0 0 L-11 -7 L-11 7Z M0 0 L11 -7 L11 7Z" ${st('#FF7A9C')}/>
        <circle r="3.4" ${st('#FF5D88')}/></g>`;
    default:
      return '';
  }
}

// ── Eyes ──────────────────────────────────────────────────────
function eyes(kind) {
  const dot = (x) => `<circle cx="${x}" cy="61" r="4.3" fill="${OUT}"/><circle cx="${x - 1.4}" cy="59.4" r="1.5" fill="#fff"/>`;
  const arc = (x) => `<path d="M${x - 5} 62 q5 -6 10 0" ${line(3)}/>`;
  switch (kind) {
    case 'big':
      return [48, 72].map(x => `<ellipse cx="${x}" cy="60.5" rx="6" ry="7" fill="#fff" stroke="${OUT}" stroke-width="2.2"/>
        <circle cx="${x + 0.6}" cy="61.5" r="4" fill="${OUT}"/><circle cx="${x - 1}" cy="59.4" r="1.6" fill="#fff"/>`).join('');
    case 'happy': return arc(48) + arc(72);
    case 'wink': return dot(48) + arc(72);
    case 'lash':
      return dot(48) + dot(72) + `<path d="M42 57 l-3 -2 M78 57 l3 -2" ${line(2)}/>`;
    case 'sleepy':
      return [48, 72].map(x => `<path d="M${x - 5} 60 q5 5 10 0" ${line(3)}/>`).join('');
    default: return dot(48) + dot(72);
  }
}

function mouth(kind) {
  switch (kind) {
    case 'open':
      return `<path d="M52 72 Q60 84 68 72 Z" fill="#B4475B" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/>
        <path d="M55.5 77 Q60 80.5 64.5 77" fill="#FF8C9B"/>`;
    case 'o': return `<ellipse cx="60" cy="75" rx="3.4" ry="4" fill="#B4475B" stroke="${OUT}" stroke-width="2.2"/>`;
    case 'cat': return `<path d="M52 72 q4 4.5 8 0 q4 4.5 8 0" ${line(2.6)}/>`;
    case 'grin':
      return `<path d="M50 71 Q60 83 70 71 Z" fill="#fff" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/>
        <path d="M51 71.5 H69" ${line(2)}/>`;
    case 'flat': return `<path d="M55 74 h10" ${line(2.6)}/>`;
    default: return `<path d="M53 72 q7 7.5 14 0" ${line(2.8)}/>`;
  }
}

function beard(kind, c) {
  if (kind === 'full')
    return `<path d="M32 64 C32 92 50 99 60 99 C70 99 88 92 88 64 C82 76 72 79 60 79 C48 79 38 76 32 64Z" ${st(c)}/>`;
  if (kind === 'mustache')
    return `<path d="M60 70 C54 64 44 66 43 72 C49 71 55 72 60 70 C65 72 71 71 77 72 C76 66 66 64 60 70Z" ${st(c)}/>`;
  return '';
}

function extras(list = [], skin) {
  return list.map(x => {
    switch (x) {
      case 'glasses':
        return `<circle cx="48" cy="61" r="8.4" fill="rgba(255,255,255,.25)" stroke="${OUT}" stroke-width="2.3"/>
          <circle cx="72" cy="61" r="8.4" fill="rgba(255,255,255,.25)" stroke="${OUT}" stroke-width="2.3"/>
          <path d="M56.4 60 q3.6 -2.5 7.2 0" ${line(2.2)}/>`;
      case 'freckles':
        return [[39, 67], [42, 70], [44, 66], [76, 66], [78, 70], [81, 67]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.1" fill="#B9775A"/>`).join('');
      case 'brows':
        return `<path d="M42 51 q6 -3.5 11 0 M67 51 q5 -3.5 11 0" ${line(2.4)}/>`;
      case 'earrings':
        return `<circle cx="31" cy="72" r="2.8" fill="#FFD45E" stroke="${OUT}" stroke-width="1.6"/><circle cx="89" cy="72" r="2.8" fill="#FFD45E" stroke="${OUT}" stroke-width="1.6"/>`;
      default: return '';
    }
  }).join('');
}

function collar(kind) {
  switch (kind) {
    case 'scarf':
      return `<path d="M42 90 C50 97 70 97 78 90 L80 98 C70 104 50 104 40 98Z" ${st('#E5566E')}/>
        <path d="M70 99 l6 16 l7 -3 l-6 -15" ${st('#E5566E')}/>`;
    case 'bowtie':
      return `<path d="M60 96 L49 90 L49 102Z M60 96 L71 90 L71 102Z" ${st('#5B8DEF')}/><circle cx="60" cy="96" r="3" ${st('#4677DB')}/>`;
    case 'pearls':
      return [44, 50, 56, 64, 70, 76].map((x, i) => `<circle cx="${x}" cy="${95 + (i === 0 || i === 5 ? -2 : i === 1 || i === 4 ? 0 : 1)}" r="2.6" fill="#FFF8F0" stroke="${OUT}" stroke-width="1.3"/>`).join('');
    case 'ruff':
      return [[40, 95, '#FFD45E'], [49, 99, '#E5566E'], [60, 101, '#FFD45E'], [71, 99, '#4FB6B0'], [80, 95, '#FFD45E']]
        .map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="7" fill="${c}" stroke="${OUT}" stroke-width="2.2"/>`).join('');
    case 'apron':
      return `<path d="M44 104 h32 v18 h-32Z" fill="#FFFFFF" stroke="${OUT}" stroke-width="2"/>`;
    case 'stetho':
      return `<path d="M46 92 C42 104 48 112 56 112 M74 92 C78 104 72 112 64 112" ${line(2.6)}/>
        <circle cx="60" cy="113" r="5" fill="#C7D3E3" stroke="${OUT}" stroke-width="2.4"/>`;
    default: return '';
  }
}

// ── Build one face (viewBox 0 0 120 120) ──────────────────────
export function faceInner(o) {
  const skin = o.skin || SKIN[1];
  const hc = o.hairColor || '#6B4A3A';
  return `
    ${o.backLayer || ''}
    ${hairBack(o.hair, hc)}
    <path d="M17 124 C17 99 36 90 60 90 C84 90 103 99 103 124Z" ${st(o.shirt || '#8FB8FF')}/>
    <rect x="52" y="80" width="16" height="13" rx="5" fill="${skin}" stroke="${OUT}" stroke-width="${SW}"/>
    <circle cx="31" cy="63" r="6.5" ${st(skin)}/>
    <circle cx="89" cy="63" r="6.5" ${st(skin)}/>
    <ellipse cx="60" cy="60" rx="29" ry="29.5" ${st(skin)}/>
    ${o.blush === false ? '' : `<ellipse cx="41" cy="71" rx="5.5" ry="3.3" fill="#FF8FA3" opacity=".55"/><ellipse cx="79" cy="71" rx="5.5" ry="3.3" fill="#FF8FA3" opacity=".55"/>`}
    ${extras((o.extras || []).filter(e => e === 'freckles'), skin)}
    <g class="ch-blink">${eyes(o.eyes)}</g>
    ${beard(o.beard, o.beardColor || hc)}
    ${mouth(o.mouth)}
    ${hairFront(o.hair, hc)}
    ${extras((o.extras || []).filter(e => e !== 'freckles'), skin)}
    ${hat(o.hat)}
    ${collar(o.collar)}
    ${o.frontLayer || ''}`;
}

export function faceSVG(o, { bg = true, size } = {}) {
  const sz = size ? `width="${size}" height="${size}"` : '';
  const clip = `c${Math.random().toString(36).slice(2, 8)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" ${sz} role="img" aria-label="${o.name || 'villager'}">
    ${bg ? `<defs><clipPath id="${clip}"><circle cx="60" cy="60" r="60"/></clipPath></defs>
    <g clip-path="url(#${clip})"><rect width="120" height="120" fill="${o.bg || '#FFE7C2'}"/>
    <circle cx="20" cy="22" r="26" fill="#fff" opacity=".22"/>${faceInner(o)}</g>` : faceInner(o)}
  </svg>`;
}

// ── The villagers of Moonhollow (player avatars) ──────────────
export const AVATARS = [
  { name: 'Baker Bea',      bg: '#FFD9DE', skin: SKIN[0], hair: 'bangs',   hairColor: '#C9773E', hat: 'chef',   eyes: 'big',   mouth: 'open',  shirt: '#FF9EB5', collar: 'apron' },
  { name: 'Farmer Finn',    bg: '#D9F2C9', skin: SKIN[2], hair: 'short',   hairColor: '#8A5A3B', hat: 'straw',  eyes: 'dot',   mouth: 'smile', shirt: '#7CC47F', extras: ['freckles'] },
  { name: 'Granny Gwen',    bg: '#E8DEFF', skin: SKIN[1], hair: 'bun',     hairColor: '#D9D4E4', eyes: 'happy', mouth: 'smile', shirt: '#B9A3F0', extras: ['glasses'], collar: 'pearls' },
  { name: 'Blacksmith Bo',  bg: '#FFE0C2', skin: SKIN[4], hair: 'tuft',    hairColor: '#3B2A22', beard: 'full', eyes: 'dot',   mouth: 'grin',  shirt: '#E98B4E', extras: ['brows'] },
  { name: 'Mayor Mabel',    bg: '#D6E6FF', skin: SKIN[3], hair: 'bob',     hairColor: '#2E2438', hat: 'tophat', eyes: 'lash',  mouth: 'smile', shirt: '#5B6FD8', collar: 'pearls' },
  { name: 'Fisher Fern',    bg: '#CFF3EF', skin: SKIN[2], hair: 'long',    hairColor: '#5A3A2E', hat: 'beanie', eyes: 'dot',   mouth: 'cat',   shirt: '#FFCE5C' },
  { name: 'Tailor Theo',    bg: '#FFF1C2', skin: SKIN[0], hair: 'side',    hairColor: '#E3B04B', eyes: 'dot',   mouth: 'cat',   shirt: '#8FB8FF', extras: ['glasses'], collar: 'bowtie' },
  { name: 'Shepherd Sol',   bg: '#E2F5D5', skin: SKIN[5], hair: 'curly',   hairColor: '#241A1A', eyes: 'happy', mouth: 'open',  shirt: '#F7F2E8' },
  { name: 'Painter Pip',    bg: '#FFE0EC', skin: SKIN[1], hair: 'bangs',   hairColor: '#2F2A3A', hat: 'beret',  eyes: 'wink',  mouth: 'smile', shirt: '#FFB86B', collar: 'scarf' },
  { name: 'Flower Flo',     bg: '#FFEFD6', skin: SKIN[0], hair: 'pigtails',hairColor: '#E8743B', hat: 'flowers',eyes: 'big',   mouth: 'smile', shirt: '#9CDB9A', extras: ['freckles'] },
  { name: 'Miller Max',     bg: '#E0EEFF', skin: SKIN[2], hair: 'spiky',   hairColor: '#F2C94C', eyes: 'big',   mouth: 'o',     shirt: '#6FB6E8' },
  { name: 'Hunter Hana',    bg: '#FFDCD2', skin: SKIN[3], hair: 'long',    hairColor: '#1F1A2B', eyes: 'lash',  mouth: 'smile', shirt: '#E5566E', extras: ['earrings'] },
  { name: 'Bard Benny',     bg: '#EADCFF', skin: SKIN[4], hair: 'side',    hairColor: '#3A2A20', eyes: 'happy', mouth: 'grin',  shirt: '#A88BEB', collar: 'bowtie', hat: 'bow' },
  { name: 'Weaver Wren',    bg: '#D7F4E4', skin: SKIN[3], hair: 'bun',     hairColor: '#6B3F2A', eyes: 'sleepy',mouth: 'smile', shirt: '#4FB6B0', extras: ['earrings'] },
  { name: 'Cheesy Charlie', bg: '#FFF4BF', skin: SKIN[1], hair: 'short',   hairColor: '#B5482F', beard: 'mustache', eyes: 'dot', mouth: 'open', shirt: '#F2C35B', extras: ['brows'] },
  { name: 'Brewer Brigid',  bg: '#FFE3C9', skin: SKIN[5], hair: 'curly',   hairColor: '#4A2F25', hat: 'beanie-orange', eyes: 'wink', mouth: 'smile', shirt: '#7CC47F' },
  { name: 'Teacher Tess',   bg: '#DDEBFF', skin: SKIN[2], hair: 'bob',     hairColor: '#8A4B2E', eyes: 'dot',   mouth: 'smile', shirt: '#F49AC1', extras: ['glasses'] },
  { name: 'Postman Pete',   bg: '#FFE6D5', skin: SKIN[4], hair: 'short',   hairColor: '#20181A', hat: 'beanie', eyes: 'happy', mouth: 'cat',   shirt: '#5B8DEF', extras: ['brows'] },
];

// ── More villagers for big groups ─────────────────────────────
// The 18 hand-drawn villagers come first. After them, every index gets its own villager,
// built from the same hand-drawn parts (hair, hats, eyes, mouths, glasses, scarves…) and
// picked by a seeded random generator, so index 57 always looks the same on every phone.
export const AVATAR_COUNT = 400;
const GEN = {
  bg: ['#FFD9DE', '#D9F2C9', '#E8DEFF', '#FFE0C2', '#D6E6FF', '#CFF3EF', '#FFF1C2', '#E2F5D5', '#FFE0EC', '#FFEFD6', '#E0EEFF', '#FFDCD2', '#EADCFF', '#D7F4E4', '#FFF4BF', '#FFE3C9', '#DDEBFF', '#FFE6D5'],
  hair: ['short', 'bangs', 'bun', 'tuft', 'bob', 'long', 'side', 'curly', 'pigtails', 'spiky'],
  hairColor: ['#C9773E', '#8A5A3B', '#D9D4E4', '#3B2A22', '#2E2438', '#5A3A2E', '#E3B04B', '#241A1A', '#2F2A3A', '#E8743B', '#F2C94C', '#1F1A2B', '#6B3F2A', '#B5482F', '#4A2F25', '#8A4B2E'],
  hat: ['straw', 'chef', 'beanie', 'beanie-orange', 'beret', 'flowers', 'tophat', 'bow'],
  eyes: ['dot', 'big', 'happy', 'wink', 'lash', 'sleepy'],
  mouth: ['smile', 'open', 'o', 'cat', 'grin'],
  shirt: ['#FF9EB5', '#7CC47F', '#B9A3F0', '#E98B4E', '#5B6FD8', '#FFCE5C', '#8FB8FF', '#F7F2E8', '#FFB86B', '#9CDB9A', '#6FB6E8', '#E5566E', '#A88BEB', '#4FB6B0', '#F2C35B', '#F49AC1', '#5B8DEF'],
  extras: ['glasses', 'freckles', 'brows', 'earrings'],
  collar: ['scarf', 'bowtie', 'pearls', 'apron'],
  trade: ['Potter', 'Cobbler', 'Fiddler', 'Gardener', 'Beekeeper', 'Carpenter', 'Candlemaker', 'Herbalist', 'Lamplighter', 'Ferry', 'Glassblower', 'Knitter', 'Woodcutter', 'Storyteller', 'Cook', 'Mason', 'Clockmaker', 'Toymaker', 'Orchard', 'Shepherd', 'Fisher', 'Miller', 'Weaver', 'Baker'],
  name: ['Ada', 'Bram', 'Cora', 'Dex', 'Elsie', 'Fitz', 'Gus', 'Hattie', 'Ivo', 'Juno', 'Kit', 'Lou', 'Mo', 'Nell', 'Otto', 'Peg', 'Quin', 'Rosa', 'Sam', 'Tilly', 'Uma', 'Vic', 'Wes', 'Yara', 'Zed', 'Bea', 'Cal', 'Dot', 'Edie', 'Finn'],
};
function rng(seed) {                         // mulberry32: tiny, fast, good enough for faces
  let t = (seed * 2654435761) >>> 0;
  return () => { t = (t + 0x6D2B79F5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}
const genCache = {};
function generatedVillager(i) {
  if (genCache[i]) return genCache[i];
  const r = rng(i + 1);
  const pick = (list) => list[Math.floor(r() * list.length)];
  const o = {
    name: `${pick(GEN.trade)} ${pick(GEN.name)}`,
    bg: pick(GEN.bg), skin: pick(SKIN), hair: pick(GEN.hair), hairColor: pick(GEN.hairColor),
    eyes: pick(GEN.eyes), mouth: pick(GEN.mouth), shirt: pick(GEN.shirt),
  };
  if (r() < 0.45) o.hat = pick(GEN.hat);
  if (r() < 0.5) o.extras = [pick(GEN.extras), ...(r() < 0.25 ? [pick(GEN.extras)] : [])];
  if (r() < 0.35) o.collar = pick(GEN.collar);
  if (r() < 0.14) { o.beard = r() < 0.5 ? 'mustache' : 'full'; o.beardColor = o.hairColor; }
  return (genCache[i] = o);
}
export const avatarData = (i) => {
  const n = ((Math.floor(i) % AVATAR_COUNT) + AVATAR_COUNT) % AVATAR_COUNT || 0;
  return n < AVATARS.length ? AVATARS[n] : generatedVillager(n);
};
export const avatarName = (i) => avatarData(i).name;

// ── What someone can notice about a villager in the dark (for the Survivor's glimpse) ──
// Broad, everyday details only: a clue should fit several people, not point at one.
const HAIR_TONE = {
  '#3B2A22': 'dark', '#2E2438': 'dark', '#241A1A': 'dark', '#2F2A3A': 'dark', '#1F1A2B': 'dark', '#3A2A20': 'dark', '#20181A': 'dark', '#4A2F25': 'dark',
  '#8A5A3B': 'brown', '#5A3A2E': 'brown', '#6B3F2A': 'brown', '#8A4B2E': 'brown', '#7A3B2E': 'brown',
  '#E3B04B': 'fair', '#F2C94C': 'fair',
  '#C9773E': 'red', '#E8743B': 'red', '#B5482F': 'red',
  '#D9D4E4': 'grey',
};
const SHIRT_TONE = {
  '#FF9EB5': 'red', '#F49AC1': 'red', '#E5566E': 'red',
  '#7CC47F': 'green', '#9CDB9A': 'green', '#4FB6B0': 'green',
  '#8FB8FF': 'blue', '#5B6FD8': 'blue', '#6FB6E8': 'blue', '#5B8DEF': 'blue',
  '#B9A3F0': 'purple', '#A88BEB': 'purple',
  '#FFCE5C': 'yellow', '#F2C35B': 'yellow', '#FFB86B': 'yellow', '#E98B4E': 'yellow',
  '#F7F2E8': 'white',
};
export const TRAIT_TEXT = {
  hat: 'was wearing a hat', nohat: "wasn't wearing a hat",
  glasses: 'wears glasses', noglasses: "doesn't wear glasses",
  earrings: 'wears earrings', freckles: 'has freckles', beard: 'has a beard or a moustache',
  longhair: 'has long hair', shorthair: 'has short hair',
  'hair-dark': 'has dark hair', 'hair-brown': 'has brown hair', 'hair-fair': 'has fair hair', 'hair-red': 'has red or ginger hair', 'hair-grey': 'has grey hair',
  'top-red': 'was wearing pink or red', 'top-green': 'was wearing green', 'top-blue': 'was wearing blue',
  'top-purple': 'was wearing purple', 'top-yellow': 'was wearing yellow or orange', 'top-white': 'was wearing white',
};
export function avatarTraits(i) {
  const a = avatarData(i);
  const ex = a.extras || [];
  const t = [a.hat ? 'hat' : 'nohat', ex.includes('glasses') ? 'glasses' : 'noglasses'];
  if (ex.includes('earrings')) t.push('earrings');
  if (ex.includes('freckles')) t.push('freckles');
  if (a.beard) t.push('beard');
  if (['long', 'pigtails', 'bob'].includes(a.hair)) t.push('longhair');
  else if (['short', 'tuft', 'spiky', 'side', 'bangs', 'curly'].includes(a.hair)) t.push('shorthair');
  if (HAIR_TONE[a.hairColor]) t.push('hair-' + HAIR_TONE[a.hairColor]);
  if (SHIRT_TONE[a.shirt]) t.push('top-' + SHIRT_TONE[a.shirt]);
  return t;
}
export const avatarSVG = (i, opts) => faceSVG(avatarData(i), opts);

// ── Role portraits (viewBox 0 0 200 200) ──────────────────────
function sparkle(x, y, s = 1, c = '#FFF6C9') {
  return `<path class="ch-spark" transform="translate(${x} ${y}) scale(${s})" d="M0 -9 C1.5 -2 2 -1.5 9 0 C2 1.5 1.5 2 0 9 C-1.5 2 -2 1.5 -9 0 C-2 -1.5 -1.5 -2 0 -9Z" fill="${c}"/>`;
}

function roleFrame(id, c1, c2, inner, deco = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="${id}">
    <defs>
      <radialGradient id="g-${id}" cx="50%" cy="38%" r="70%">
        <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
      </radialGradient>
      <clipPath id="cp-${id}"><circle cx="100" cy="100" r="96"/></clipPath>
    </defs>
    <circle cx="100" cy="100" r="96" fill="url(#g-${id})"/>
    <g clip-path="url(#cp-${id})">${deco}${inner}</g>
  </svg>`;
}

export function werewolfSVG() {
  const fur = '#8E86B8', furDark = '#6C6496', belly = '#E9E3FF';
  const inner = `
    <circle cx="150" cy="52" r="24" fill="#FFF3B8"/>
    <circle cx="142" cy="46" r="5" fill="#F2E39A"/><circle cx="156" cy="60" r="3.5" fill="#F2E39A"/>
    ${sparkle(40, 42, 0.9)}${sparkle(58, 24, 0.55)}${sparkle(172, 104, 0.6)}
    <!-- body -->
    <path d="M44 204 C44 160 70 146 100 146 C130 146 156 160 156 204Z" ${st(fur)}/>
    <path d="M76 204 C76 172 88 162 100 162 C112 162 124 172 124 204Z" fill="${belly}"/>
    <!-- ears (twitch from their base) -->
    <g class="ch-ear-l"><path d="M50 84 L58 26 L96 62 Z" ${st(fur)}/><path d="M60 72 L63 42 L84 62 Z" fill="#FFAFC5"/></g>
    <g class="ch-ear-r"><path d="M150 84 L142 26 L104 62 Z" ${st(fur)}/><path d="M140 72 L137 42 L116 62 Z" fill="#FFAFC5"/></g>
    <!-- fluffy head -->
    <path d="M40 108 L28 98 L40 92 C38 70 62 52 100 52 C138 52 162 70 160 92 L172 98 L160 108 L170 118 L156 122 C148 148 126 158 100 158 C74 158 52 148 44 122 L30 118 Z" ${st(fur)}/>
    <path d="M86 54 L92 66 L100 54 L108 66 L114 54" fill="${furDark}" stroke="${OUT}" stroke-width="2" stroke-linejoin="round"/>
    <!-- muzzle -->
    <ellipse cx="100" cy="126" rx="31" ry="22" ${st(belly)}/>
    <!-- eyes -->
    <path d="M62 82 q12 -7 22 2 M138 82 q-12 -7 -22 2" ${line(3.4)}/>
    <ellipse cx="76" cy="100" rx="11" ry="12.5" fill="#FFD84D" stroke="${OUT}" stroke-width="2.6"/>
    <ellipse cx="124" cy="100" rx="11" ry="12.5" fill="#FFD84D" stroke="${OUT}" stroke-width="2.6"/>
    <ellipse cx="77" cy="102" rx="5.5" ry="7.5" fill="${OUT}"/><ellipse cx="123" cy="102" rx="5.5" ry="7.5" fill="${OUT}"/>
    <circle cx="74" cy="97" r="2.6" fill="#fff"/><circle cx="120" cy="97" r="2.6" fill="#fff"/>
    <!-- furry eyelids: hidden until a blink -->
    <g class="ch-lid" opacity="0"><ellipse cx="76" cy="100" rx="12.4" ry="14" fill="${fur}" stroke="${OUT}" stroke-width="2.6"/></g>
    <g class="ch-lid" opacity="0"><ellipse cx="124" cy="100" rx="12.4" ry="14" fill="${fur}" stroke="${OUT}" stroke-width="2.6"/></g>
    <!-- nose & mouth -->
    <path d="M90 113 Q100 108 110 113 Q106 122 100 122 Q94 122 90 113Z" fill="${OUT}"/>
    <ellipse cx="96" cy="113" rx="2.6" ry="1.4" fill="#fff" opacity=".6"/>
    <path d="M100 122 v5 M100 127 q-9 9 -17 2 M100 127 q9 9 17 2" ${line(2.8)}/>
    <path d="M87 130 l3 7 l3 -6Z M113 130 l-3 7 l-3 -6Z" fill="#fff" stroke="${OUT}" stroke-width="1.8" stroke-linejoin="round"/>
    <ellipse cx="62" cy="122" rx="8" ry="4.5" fill="#FF8FB1" opacity=".6"/><ellipse cx="138" cy="122" rx="8" ry="4.5" fill="#FF8FB1" opacity=".6"/>
    <!-- paws -->
    <ellipse cx="66" cy="190" rx="16" ry="13" ${st(fur)}/><ellipse cx="134" cy="190" rx="16" ry="13" ${st(fur)}/>
    <path d="M60 183 v8 M66 182 v9 M72 183 v8 M128 183 v8 M134 182 v9 M140 183 v8" ${line(2)}/>`;
  return roleFrame('werewolf', '#4C3F8F', '#1E1A44', inner,
    [[30, 150], [170, 160], [24, 70], [100, 18]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#fff" opacity=".8"/>`).join(''));
}

function portrait(id, c1, c2, face, props = '', deco = '') {
  return roleFrame(id, c1, c2, `${deco}<g transform="translate(22 30) scale(1.3)">${faceInner(face)}</g>${props}`);
}

export function doctorSVG() {
  return portrait('doctor', '#E4FFF5', '#9FE3CD',
    { skin: SKIN[2], hair: 'bob', hairColor: '#5A3A2E', hat: 'doc', eyes: 'big', mouth: 'smile', shirt: '#FFFFFF', collar: 'stetho' },
    `<g transform="translate(150 150)">
       <path d="M0 -24 L22 -16 V2 C22 16 10 24 0 28 C-10 24 -22 16 -22 2 V-16Z" ${st('#5BD1A8')}/>
       <g class="ch-beat"><path d="M0 -10 C-4 -18 -16 -14 -12 -4 C-9 3 0 9 0 9 C0 9 9 3 12 -4 C16 -14 4 -18 0 -10Z" fill="#FF6F91" stroke="${OUT}" stroke-width="2"/></g>
     </g>`,
    `${sparkle(36, 44, 0.8, '#fff')}${sparkle(168, 60, 0.6, '#fff')}`);
}

export function seerSVG() {
  const hood = '#7B5CD6';
  const back = `<path d="M18 74 C16 26 40 8 60 8 C80 8 104 26 102 74 L110 124 L10 124Z" ${st(hood)}/>`;
  const front = `<path d="M27 74 C24 40 40 24 60 24 C80 24 96 40 93 74" fill="none" stroke="#5E43B5" stroke-width="7" stroke-linecap="round"/>
    <path d="M60 30 l3 6 l6.5 1 l-4.7 4.5 l1.1 6.5 l-5.9 -3 l-5.9 3 l1.1 -6.5 l-4.7 -4.5 l6.5 -1z" fill="#FFD84D" stroke="${OUT}" stroke-width="1.6" stroke-linejoin="round"/>`;
  return portrait('seer', '#3E2E7A', '#171236',
    { skin: SKIN[1], hair: 'bangs', hairColor: '#2F2147', eyes: 'lash', mouth: 'cat', shirt: hood, backLayer: back, frontLayer: front, extras: ['earrings'] },
    `<g transform="translate(100 172)">
       <ellipse cx="0" cy="18" rx="30" ry="9" ${st('#C99A5B')}/>
       <circle cx="0" cy="-6" r="24" fill="#9FE8FF" stroke="${OUT}" stroke-width="${SW}" opacity=".95"/>
       <circle class="ch-glow" cx="0" cy="-6" r="16" fill="#E6FBFF" opacity=".65"/>
       <path d="M-12 -14 q6 -8 14 -6" stroke="#fff" stroke-width="3.4" fill="none" stroke-linecap="round"/>
       <g class="ch-swirl"><circle cx="4" cy="-4" r="4" fill="#B78CFF"/></g>
     </g>`,
    `${sparkle(30, 40, 0.9)}${sparkle(168, 36, 0.7)}${sparkle(176, 120, 0.5)}${sparkle(24, 130, 0.5)}
     <circle cx="150" cy="80" r="1.6" fill="#fff"/><circle cx="46" cy="96" r="1.4" fill="#fff"/>`);
}

export function villagerSVG() {
  return portrait('villager', '#FFF5D9', '#FFD59A',
    { skin: SKIN[3], hair: 'short', hairColor: '#6B3F2A', hat: 'straw', eyes: 'happy', mouth: 'open', shirt: '#7CC47F', extras: ['freckles'] },
    `<g transform="translate(160 118)">
       <path d="M0 0 V82" stroke="#A86B3C" stroke-width="7" stroke-linecap="round"/>
       <path d="M0 0 V82" ${line(2)} opacity=".35"/>
       <path d="M-14 -24 V-4 C-14 4 14 4 14 -4 V-24 M0 -26 V2" fill="none" stroke="#8E95A8" stroke-width="5" stroke-linecap="round"/>
     </g>
     <g transform="translate(52 162)">
       <path d="M-22 0 h44 l-6 24 h-32Z" ${st('#E6A65B')}/>
       ${puffy([[-10, -4, 8], [4, -6, 9], [14, -2, 6]], '#FF6F6F')}
     </g>`,
    `${sparkle(38, 48, 0.8, '#fff')}${sparkle(170, 50, 0.6, '#fff')}
     <ellipse cx="160" cy="34" rx="18" ry="7" fill="#fff" opacity=".7"/><ellipse cx="38" cy="140" rx="14" ry="5" fill="#fff" opacity=".5"/>`);
}

export function jesterSVG() {
  // a cheeky grin, a wink, and a jester's stick with a tiny copy of their own head
  return portrait('jester', '#FFE6EF', '#F5A3BF',
    { skin: SKIN[1], hair: 'short', hairColor: '#7A3B2E', hat: 'jester', eyes: 'wink', mouth: 'grin', shirt: '#8E6CF0', collar: 'ruff', extras: ['brows'] },
    `<g transform="translate(162 112)">
       <path d="M0 14 V92" stroke="#A86B3C" stroke-width="7" stroke-linecap="round"/>
       <path d="M0 14 V92" ${line(2)} opacity=".35"/>
       <path d="M-13 2 C-14 -8 -20 -14 -26 -14 C-18 -22 -6 -16 0 -6 C6 -16 18 -22 26 -14 C20 -14 14 -8 13 2Z" ${st('#E5566E')}/>
       <circle cx="-26" cy="-14" r="3.6" ${st('#FFD45E')}/><circle cx="26" cy="-14" r="3.6" ${st('#FFD45E')}/>
       <circle cx="0" cy="10" r="11" ${st('#FFE3C9')}/>
       <path d="M-4 8 h0.1 M4 8 h0.1" ${line(3.4)}/><path d="M-4 13 q4 4 8 0" ${line(2)}/>
     </g>`,
    `${sparkle(36, 46, 0.8, '#fff')}${sparkle(170, 46, 0.6, '#fff')}${sparkle(30, 120, 0.5, '#fff')}
     <path d="M150 30 l4 8 l-8 0Z M48 26 l3 6 l-6 0Z" fill="#fff" opacity=".55"/>`);
}

export const ROLE_ART = { werewolf: werewolfSVG, doctor: doctorSVG, seer: seerSVG, villager: villagerSVG, jester: jesterSVG };

// ── Werewolf bite (overlay for a night victim's avatar) ───────
// Two rounded jaws in the werewolf's fur colour. CSS snaps them shut on the avatar's edge;
// the bite they leave is a mask on the avatar itself (see .bitten in style.css).
export function biteSVG() {
  const gum = '#6C6496';
  // teeth hang off the gum's curved edge (a quadratic from (2,22) via (50,34) to (98,22)); fangs are longer
  const teeth = [16, 27, 38, 50, 62, 73, 84].map((x) => {
    const t = (x - 2) / 96, y0 = 22 + 24 * t * (1 - t);
    const len = x === 27 || x === 73 ? 17 : 10;
    return `<path d="M${x - 4.6} ${(y0 - 2).toFixed(1)} L${x} ${(y0 + len).toFixed(1)} L${x + 4.6} ${(y0 - 2).toFixed(1)}Z" fill="#FFFFFF" stroke="${OUT}" stroke-width="2" stroke-linejoin="round"/>`;
  }).join('');
  const jaw = `<svg viewBox="0 0 100 50" aria-hidden="true">${teeth}
    <path d="M2 22 Q2 5 20 5 H80 Q98 5 98 22 Q50 34 2 22Z" fill="${gum}" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M22 12 H62" stroke="#8E86B8" stroke-width="3" stroke-linecap="round"/></svg>`;
  return `<div class="bite" aria-hidden="true"><div class="jaw up">${jaw}</div><div class="jaw down">${jaw}</div></div>`;
}

export function ghostSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" role="img" aria-label="ghost">
    <path d="M12 52 V26 C12 14 20 6 30 6 C40 6 48 14 48 26 V52 L42 47 L36 52 L30 47 L24 52 L18 47Z" ${st('#F6F3FF')}/>
    <circle cx="23" cy="26" r="3" fill="${OUT}"/><circle cx="37" cy="26" r="3" fill="${OUT}"/>
    <ellipse cx="30" cy="35" rx="3" ry="3.6" fill="${OUT}"/>
    <ellipse cx="19" cy="32" rx="3.4" ry="2" fill="#FF8FA3" opacity=".6"/><ellipse cx="41" cy="32" rx="3.4" ry="2" fill="#FF8FA3" opacity=".6"/>
  </svg>`;
}

export function moonSceneSVG() {
  // decorative hills + houses for the home screen
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 140" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <path d="M0 90 C60 60 120 70 180 88 C240 104 300 70 400 80 V140 H0Z" fill="#3B3172"/>
    <path d="M0 110 C80 92 150 100 220 112 C290 124 340 100 400 104 V140 H0Z" fill="#2A2358"/>
    ${[[60, 92, '#FFB86B'], [118, 98, '#FF8FB1'], [276, 96, '#9CD3FF'], [330, 92, '#FFD45E']].map(([x, y, c]) => `
      <g transform="translate(${x} ${y})">
        <rect x="-14" y="-16" width="28" height="22" rx="3" fill="#4B3F8A" stroke="${OUT}" stroke-width="2"/>
        <path d="M-18 -14 L0 -30 L18 -14Z" fill="${c}" stroke="${OUT}" stroke-width="2" stroke-linejoin="round"/>
        <rect x="-6" y="-10" width="8" height="8" rx="1.5" fill="#FFE58A"/>
      </g>`).join('')}
    ${[[200, 108], [240, 116], [20, 112]].map(([x, y]) => `
      <g transform="translate(${x} ${y})"><path d="M0 -26 L12 0 H-12Z" fill="#2E7D5B" stroke="${OUT}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M0 -36 L9 -16 H-9Z" fill="#3A9C70" stroke="${OUT}" stroke-width="2" stroke-linejoin="round"/></g>`).join('')}
  </svg>`;
}

// ── Small UI icons (24×24, stroke) ────────────────────────────
const I = (p, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${p}</svg>`;
export const ICON = {
  pause: I('<path d="M8.5 5.5v13M15.5 5.5v13"/>'),
  chat: I('<path d="M4.5 6.5h15v9.5h-8l-4.5 3.5V16h-2.5Z"/>'),
  scale: I('<path d="M12 4v16M8 20h8M5 7.5h14"/><path d="M5 7.5 2.5 13a2.6 2.6 0 0 0 5 0Z M19 7.5 16.5 13a2.6 2.6 0 0 0 5 0Z"/>'),
  cards: I('<rect x="7.5" y="4.5" width="11" height="15" rx="2.2" transform="rotate(8 13 12)"/><path d="M5.6 6.4 4.1 17.2a2 2 0 0 0 1.7 2.3l4.4.6"/>'),
  mic: I('<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5"/>'),
  alert: I('<path d="M12 4 21 19.5H3Z"/><path d="M12 10v4.2"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>'),
  dice: I('<rect x="4.5" y="4.5" width="15" height="15" rx="3.5"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'),
  key: I('<circle cx="8" cy="12" r="3.8"/><path d="M11.8 12H20.5M17.5 12v3M20.5 12v2.2"/>'),
  hunch: I('<path d="M9.2 9.2a2.9 2.9 0 1 1 4.2 2.6c-.9.5-1.4 1.2-1.4 2.2v.5"/><circle cx="12" cy="18" r=".7" fill="currentColor"/><circle cx="12" cy="12" r="9"/>'),
  moon: I('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>'),
  sun: I('<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>'),
  shield: I('<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8-7.5 9.5-4.3-1.5-7.5-4.9-7.5-9.5V6Z"/>'),
  eye: I('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>'),
  paw: I('<circle cx="7" cy="9" r="1.9"/><circle cx="11" cy="6" r="1.9"/><circle cx="15.5" cy="7" r="1.9"/><circle cx="18" cy="11" r="1.7"/><path d="M8.5 17c0-3 2-5.5 4.2-5.5S17 14 16.5 17c-.4 2.2-2.6 2.6-4 2-1.3.6-3.6.4-4-2Z"/>'),
  vote: I('<path d="M4 13h16v7H4z"/><path d="M8 13V5.5h8V13"/><path d="M10 9.3l1.6 1.6 3-3"/>'),
  clock: I('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  copy: I('<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
  users: I('<circle cx="9" cy="8" r="3.4"/><path d="M2.8 19.5c.6-3.4 3.2-5.3 6.2-5.3s5.6 1.9 6.2 5.3"/><circle cx="17" cy="9" r="2.6"/><path d="M17.5 14.3c2 .4 3.4 2 3.8 4.4"/>'),
  crown: I('<path d="M3.5 8l4.2 3.8L12 5l4.3 6.8L20.5 8 19 18H5Z"/>'),
  play: I('<path d="M7 4.5v15l12-7.5Z"/>'),
  check: I('<path d="M4.5 12.5l4.5 4.5L19.5 6.5"/>'),
  x: I('<path d="M6 6l12 12M18 6L6 18"/>'),
  bot: I('<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 4v4"/><circle cx="12" cy="3.5" r="1"/><circle cx="9.5" cy="13.3" r="1.1"/><circle cx="14.5" cy="13.3" r="1.1"/>'),
  sparkle: I('<path d="M12 3c.8 4.6 1.6 5.4 6.2 6.2-4.6.8-5.4 1.6-6.2 6.2-.8-4.6-1.6-5.4-6.2-6.2C10.4 8.4 11.2 7.6 12 3Z"/><path d="M18.5 15.5c.4 2 .8 2.4 2.5 2.8-1.7.4-2.1.8-2.5 2.7-.4-1.9-.8-2.3-2.5-2.7 1.7-.4 2.1-.8 2.5-2.8Z"/>'),
  arrow: I('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  back: I('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  refresh: I('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>'),
  skip: I('<path d="M5 5l9 7-9 7Z"/><path d="M18 5v14"/>'),
  ghost: I('<path d="M6 20V11a6 6 0 0 1 12 0v9l-2-1.6L14 20l-2-1.6L10 20l-2-1.6Z"/><circle cx="10" cy="11" r=".8" fill="currentColor"/><circle cx="14" cy="11" r=".8" fill="currentColor"/>'),
  lock: I('<rect x="5" y="11" width="14" height="9.5" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  soundAll: I('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  soundSfx: I('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z"/><path d="M15.5 9a4 4 0 0 1 0 6"/>'),
  soundOff: I('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>'),
  music: I('<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>'),
  upload: I('<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-3"/>'),
  gear: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>'),
  link: I('<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>'),
  heart: I('<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z"/>'),
};
