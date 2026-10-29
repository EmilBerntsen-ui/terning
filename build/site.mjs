// Bygger den installerbare side: src/ + manifest + ikoner → outDir, og stempler sw.js med version og precache-liste.
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Første 10 hex-tegn af sha256 over de sorterede stier og deres indhold.
export function siteVersion(entries) {
  const hash = createHash('sha256');
  for (const [path, data] of [...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) hash.update(`${path}\0`).update(data).update('\0');
  return hash.digest('hex').slice(0, 10);
}

export async function buildSite({ outDir }) {
  const src = join(ROOT, 'src'), icons = join(ROOT, 'assets/icons');
  const entries = [
    ...readdirSync(src).filter(name => name !== 'sw.js' && !name.startsWith('.')).map(name => [name, readFileSync(join(src, name))]),
    ['manifest.webmanifest', readFileSync(join(ROOT, 'assets/manifest.webmanifest'))],
    ...readdirSync(icons).filter(name => name.endsWith('.png')).map(name => [`icons/${name}`, readFileSync(join(icons, name))]),
  ];
  const template = readFileSync(join(src, 'sw.js'), 'utf8');
  const version = siteVersion([...entries, ['sw.js', Buffer.from(template)]]);
  const files = entries.map(([path]) => path).sort();

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(join(outDir, 'icons'), { recursive: true });
  for (const [path, data] of entries) writeFileSync(join(outDir, path), data);
  const sw = template.replace("'__VERSION__'", JSON.stringify(version)).replace('__PRECACHE__', JSON.stringify(['./', ...files]));
  writeFileSync(join(outDir, 'sw.js'), sw);
  return { version, files: [...files, 'sw.js'] };
}
