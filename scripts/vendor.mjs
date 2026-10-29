// node scripts/vendor.mjs → src/vendor/. Køres kun ved opgradering; filerne committes, så appen virker uden net og uden CDN.
// three.js i en fast version; tilføjelsernes `from 'three'` peges om på den lokale fil, så der ikke skal bruges et import map.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '0.170.0';
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../src/vendor');
const FILES = [
  'build/three.module.min.js',
  'examples/jsm/geometries/RoundedBoxGeometry.js',
  'examples/jsm/environments/RoomEnvironment.js',
];

mkdirSync(OUT, { recursive: true });
for (const path of FILES) {
  const res = await fetch(`https://cdn.jsdelivr.net/npm/three@${VERSION}/${path}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  const code = (await res.text()).replace(/from\s*(['"])three\1/g, "from './three.module.min.js'");
  const name = path.split('/').pop();
  writeFileSync(resolve(OUT, name), code);
  console.log(`src/vendor/${name}  ${Buffer.byteLength(code)} B`);
}
