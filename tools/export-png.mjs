// Exports every character to /assets/svg and /assets/png (512px).
// Run:  node tools/export-png.mjs   (needs rsvg-convert installed)
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { AVATARS, faceSVG, ROLE_ART, ghostSVG } from '../js/art.js';

const root = new URL('../assets/', import.meta.url).pathname;
mkdirSync(root + 'svg', { recursive: true });
mkdirSync(root + 'png', { recursive: true });

const files = [];
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
for (const a of AVATARS) files.push([`villager-${slug(a.name)}`, faceSVG(a)]);
for (const [k, fn] of Object.entries(ROLE_ART)) files.push([`role-${k}`, fn()]);
files.push(['ghost', ghostSVG()]);

for (const [name, svg] of files) {
  const s = root + `svg/${name}.svg`;
  writeFileSync(s, svg);
  execFileSync('rsvg-convert', ['-w', '512', '-h', '512', '-o', root + `png/${name}.png`, s]);
}
console.log(`exported ${files.length} images`);
