import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
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
  for (const f of ['index.html', 'app.js', 'dice.js', 'dice3d.js', 'dice2d.js', 'gesture.js', 'prefs.js', 'styles.css', 'sw.js', 'manifest.webmanifest',
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

const VENDOR = ['vendor/three.module.min.js', 'vendor/RoundedBoxGeometry.js', 'vendor/RoomEnvironment.js'];

test('vendored three.js ships and is precached, so the dice work offline', () => {
  const sw = read('sw.js');
  for (const f of VENDOR) {
    assert.ok(existsSync(join(out, f)), f);
    assert.ok(result.files.includes(f), `${f} in the build result`);
    assert.ok(sw.includes(JSON.stringify(f)), `${f} precached`);
  }
  assert.match(read('vendor/three.module.min.js'), /^const t="170",/m, 'three r170');
});

// Every .js file in the build, subfolders included.
const shippedJs = (dir = out, prefix = '') => readdirSync(join(dir), { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? shippedJs(join(dir, e.name), `${prefix}${e.name}/`) : e.name.endsWith('.js') ? [`${prefix}${e.name}`] : []);

test('every import in shipped JS is relative (no bare "three", no CDN, no import map)', () => {
  const found = [];
  for (const f of shippedJs()) {
    const code = read(f);
    const specs = [
      ...code.matchAll(/(?:^|[;}\s])(?:import|export)\b[^;'"`]*?\bfrom\s*(['"])(.*?)\1/g),
      ...code.matchAll(/(?:^|[;}\s])import\s*(['"])(.*?)\1/g),
      ...code.matchAll(/\bimport\s*\(\s*(['"])(.*?)\1\s*\)/g),
    ].map(m => m[2]);
    for (const spec of specs) {
      assert.match(spec, /^\.\.?\//, `${f} imports ${spec}`);
      assert.ok(existsSync(join(out, f, '..', spec)), `${f} imports ${spec}, which ships`);
      found.push(`${f} → ${spec}`);
    }
  }
  for (const edge of ['app.js → ./dice3d.js', 'dice3d.js → ./vendor/three.module.min.js', 'vendor/RoundedBoxGeometry.js → ./three.module.min.js', 'vendor/RoomEnvironment.js → ./three.module.min.js'])
    assert.ok(found.includes(edge), edge);
});

test('the WebGL canvas sits behind the DOM and never takes the taps', () => {
  const stage = read('styles.css').match(/#table > \.stage \{[^}]*\}/)[0];
  assert.match(stage, /pointer-events:\s*none/);
  assert.match(stage, /z-index:\s*-1/);
  assert.match(read('styles.css'), /#table \{[^}]*isolation:\s*isolate/);
});
