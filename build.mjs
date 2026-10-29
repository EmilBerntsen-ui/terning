// node build.mjs → dist/site/ (til GitHub Pages)
import { resolve } from 'node:path';
import { buildSite, ROOT } from './build/site.mjs';

const { version, files } = await buildSite({ outDir: resolve(ROOT, 'dist/site') });
console.log(`dist/site/  version ${version}  ${files.length} filer`);
