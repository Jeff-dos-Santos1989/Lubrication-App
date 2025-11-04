// sw.js — Offline caching + re-sync for QA/QC App
// -----------------------------------------------

const CACHE_NAME = 'qaqc-cache-v5'; // increment this when updating files

// Files to pre-cache
const PRECACHE_URLS = [
  // Main pages
  './index.html',
  './asset.html',
  './consumption.html',
  './form.html',

  // CSS
  './assets/css/styles.css',

  // Core JS
  './assets/js/app-core.js',
  './assets/js/asset-page.js',
  './assets/js/consumption.js',
  './assets/js/form.js',

  // Vendor libs (local, for offline mode)
  './assets/js/vendor/chart.umd.min.js',
  './assets/js/vendor/html2pdf.bundle.min.js',

  // Data
  './assets/data/assets.csv',

  // Common images
  './Images/Logo_ArcelorMittal.png',

  // Manifest
  './manifest.webmanifest'
];

// INSTALL EVENT → Pre-cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE_URLS);
      self.skipWaiting();
    })()
  );
});

// ACTIVATE EVENT → Remove old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map(key => key === CACHE_NAME ? null : caches.delete(key))
      );
      self.clients.claim();
    })()
  );
});

// Fetch strategy helper: Network-first (HTML/CSV)
async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(req);
    cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    throw new Error('Offline and no cached copy available.');
  }
}

// Fetch strategy helper: Cache-first (CSS/JS/images)
async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  if (cached) return cached;
  const fresh = await fetch(req);
  cache.put(req, fresh.clone());
  return fresh;
}

// FETCH EVENT → Smart routing
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignore external requests
  if (url.origin !== location.origin) return;

  // 1) HTML pages
  if (req.destination === 'document' || req.mode === 'navigate') {
    event.respondWith(networkFirst(req));
    return;
  }

  // 2) CSV (data)
  if (url.pathname.endsWith('/assets/data/assets.csv')) {
    event.respondWith(networkFirst(req));
    return;
  }

  // 3) Static files (CSS, JS, images)
  if (['style', 'script', 'image', 'font'].includes(req.destination)) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // 4) Default fallback
  event.respondWith(cacheFirst(req));
});
