// node scripts/icons.mjs → assets/icons/*.png. Køres én gang; PNG-filerne committes.
// En hvid terning med fem prikker på sort, fuld baggrund. Det maskérbare ikon holder terningen inden for det sikre område.
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from './png.mjs';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../assets/icons');
const BACKGROUND = [0x00, 0x00, 0x00], DIE = [0xFA, 0xFA, 0xF7], PIP = [0x1A, 0x1A, 0x1A];
const SS = 4; // supersampling pr. akse

// Farve i punktet (x, y) i enhedskvadratet; `side` er terningens sidelængde som andel af ikonet.
function colorAt(x, y, side) {
  const h = side / 2, r = side * 0.2;
  const dx = Math.max(Math.abs(x - 0.5) - (h - r), 0), dy = Math.max(Math.abs(y - 0.5) - (h - r), 0);
  if (dx * dx + dy * dy > r * r) return BACKGROUND;
  const q = side * 0.27, pr = side * 0.095;
  for (const [px, py] of [[-q, -q], [q, -q], [0, 0], [-q, q], [q, q]]) {
    if ((x - 0.5 - px) ** 2 + (y - 0.5 - py) ** 2 <= pr * pr) return PIP;
  }
  return DIE;
}

function icon(size, side) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sum = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const c = colorAt((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size, side);
        for (let k = 0; k < 3; k++) sum[k] += c[k];
      }
      const i = (y * size + x) * 4;
      for (let k = 0; k < 3; k++) rgba[i + k] = Math.round(sum[k] / (SS * SS));
      rgba[i + 3] = 255;
    }
  }
  return encodePng(size, size, rgba);
}

const files = { 'apple-touch-icon.png': [180, 0.72], 'icon-192.png': [192, 0.78], 'icon-512.png': [512, 0.78], 'icon-maskable-512.png': [512, 0.54] };
for (const [name, [size, side]] of Object.entries(files)) {
  writeFileSync(resolve(OUT, name), icon(size, side));
  console.log(`assets/icons/${name}  ${size}×${size}`);
}
