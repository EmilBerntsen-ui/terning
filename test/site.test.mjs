import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSite, siteVersion } from '../build/site.mjs';

let out, result;
before(async () => {
  out = mkdtempSync(join(tmpdir(), 'terning-'));
  result = await buildSite({ outDir: out });
});
const read = f => readFileSync(join(out, f), 'utf8');

test('ships every file', () => {
  for (const f of ['index.html', 'app.js', 'dice.js', 'gesture.js', 'prefs.js', 'styles.css', 'sw.js', 'manifest.webmanifest',
    'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png']) assert.ok(existsSync(join(out, f)), f);
});

test('sw.js is stamped and precaches everything shipped', () => {
  const sw = read('sw.js');
  assert.ok(!sw.includes('__VERSION__') && !sw.includes('__PRECACHE__'));
  assert.ok(sw.includes(result.version));
  for (const f of result.files.filter(f => f !== 'sw.js')) assert.ok(sw.includes(JSON.stringify(f)), f);
});

test('siteVersion changes when any file changes', () => {
  const a = siteVersion([['a.js', Buffer.from('1')]]), b = siteVersion([['a.js', Buffer.from('2')]]);
  assert.match(a, /^[0-9a-f]{10}$/);
  assert.notEqual(a, b);
});

test('icons have the right sizes', () => {
  const size = f => { const b = readFileSync(join(out, 'icons', f)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
  assert.deepEqual(size('apple-touch-icon.png'), [180, 180]);
  assert.deepEqual(size('icon-192.png'), [192, 192]);
  assert.deepEqual(size('icon-512.png'), [512, 512]);
  assert.deepEqual(size('icon-maskable-512.png'), [512, 512]);
});

test('manifest points at shipped icons', () => {
  for (const icon of JSON.parse(read('manifest.webmanifest')).icons) assert.ok(existsSync(join(out, icon.src)), icon.src);
});

test('two-finger tap cannot zoom', () => {
  assert.match(read('index.html'), /user-scalable=no/);
  assert.match(read('styles.css'), /touch-action:\s*none/);
});

test('nothing visible gives the trick away', () => {
  for (const f of ['index.html', 'manifest.webmanifest'])
    assert.doesNotMatch(read(f), /\b(fake|cheat|rigged|forced|snyd|falsk)\b/i, f);
});

test('the app checks for updates when it comes back to the foreground', () => {
  const app = read('app.js');
  assert.match(app, /\.update\(\)/);
  assert.match(app, /controllerchange/);
});

test('precache requests carry the version so a stale CDN copy is never cached', () => {
  assert.match(read('sw.js'), /v=\$\{VERSION\}/);
});

test('3D dice avoid what makes iOS Safari flatten or mis-sort the cube', () => {
  const css = read('styles.css'), app = read('app.js');
  assert.doesNotMatch(css, /filter:/, 'no filters near the 3D context');
  assert.doesNotMatch(css + app, /core/, 'no intersecting inner planes');
  assert.doesNotMatch(css, /\.die\.rolling/, 'the perspective element is never animated');
  assert.match(css, /-webkit-backface-visibility:\s*hidden/);
});

test('cube faces are square so the corners close', () => {
  const face = read("styles.css").match(/\.face \{[^}]*padding[^}]*\}/)[0];
  assert.match(face, /border-radius:\s*0/);
});
