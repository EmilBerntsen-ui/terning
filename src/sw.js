// Service worker (skabelon). buildSite() indsætter versionen og precache-listen på de to pladsholder-linjer nedenfor.
// Skallen precaches hel og serveres cache-first, versioneret med indholdshash, så appen virker uden net.
'use strict';

const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;

const PREFIX = 'terning-';
const CACHE = `${PREFIX}shell-${VERSION}`;
const SCOPE = self.registration.scope;

// Ny version tager over med det samme; siden genindlæses ikke midt i et spil, men næste start kører den nye kode.
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // ?v= gør hver URL ny for GitHubs CDN, så en forældet kopi aldrig havner i den nye cache; opslag bruger ignoreSearch.
    await cache.addAll(PRECACHE.map(u => new Request(`${u}?v=${VERSION}`, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith(SCOPE)) return;
  event.respondWith(answer(req));
});

async function answer(req) {
  const cache = await caches.open(CACHE);
  const hit = req.mode === 'navigate' ? await cache.match(SCOPE, { ignoreSearch: true }) : await cache.match(req, { ignoreSearch: true });
  return hit || fetch(req);
}
