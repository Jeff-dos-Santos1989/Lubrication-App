// sw.js — robust cache with versioning + safe update
// --------------------------------------------------
const CACHE_VERSION = 'v2025-11-05a';
const CACHE_NAME = `qaqc-${CACHE_VERSION}`;

// Add *all* files you need available offline.
// (Keep this small; SW will still cache-on-demand for others.)
const CORE_ASSETS = [
  './',
  './index.html',
  './form.html',
  './asset.html',
  './consumption.html',
  // CSS
  './assets/css/styles.css',
  // JS (cache-busted URLs in HTML still work; SW matches path only)
  './assets/js/app-core.js',
  './assets/js/form.js',
  './assets/js/asset-page.js',
  './assets/js/consumption.js',
  './assets/js/vendor/chart.umd.min.js',
  './assets/js/vendor/html2pdf.bundle.min.js',
  // Data
  './assets/data/assets.csv',
  './assets/data/assets_profile.csv',
  // Images used in shell
  './Images/Logo_ArcelorMittal.png',
];

// Helper: classify request
const isJS     = (req) => req.destination === 'script' || req.url.endsWith('.js');
const isData   = (req) => req.url.endsWith('.csv') || req.url.endsWith('.json');
const isStyle  = (req) => req.destination === 'style' || req.url.endsWith('.css');
const isImage  = (req) => req.destination === 'image';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // purge old caches
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => k.startsWith('qaqc-') && k !== CACHE_NAME)
          .map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// Strategy:
// - JS/CSV/JSON: network-first (so new code wins), fall back to cache offline
// - CSS/Images: stale-while-revalidate (fast, then refresh cache)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  if (isJS(req) || isData(req)) {
    event.respondWith(networkFirst(req));
  } else if (isStyle(req) || isImage(req)) {
    event.respondWith(staleWhileRevalidate(req));
  } else {
    // default: try cache, then network (app shell)
    event.respondWith(cacheFirst(req));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(request, { cache: 'no-store' });
    cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw new Response('Offline and no cached copy', { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  const fetchPromise = fetch(request).then((res) => {
    cache.put(request, res.clone());
    return res;
  }).catch(() => null);
  return cached || (await fetchPromise) || new Response('', { status: 504 });
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    cache.put(request, fresh.clone());
    return fresh;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}
