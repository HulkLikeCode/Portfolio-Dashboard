const CACHE_VERSION = 'portfolio-dash-static-v0.2.3-phase-5a-2';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/base.css',
  './css/layout.css',
  './css/themes.css',
  './css/setup-wizard.css',
  './css/portfolio-editor.css',
  './css/benchmark-manager.css',
  './js/app.js',
  './js/config/finnhub.js',
  './js/core/symbol-registry.js',
  './js/charts/chart-manager.js',
  './js/charts/chart-options.js',
  './js/charts/chart-export.js',
  './js/charts/chart-state.js',
  './js/settings/settings-state.js',
  './js/ui/setup-wizard.js',
  './js/ui/lot-editor.js',
  './js/ui/portfolio-editor.js',
  './js/ui/portfolio-phase-3b.js',
  './js/ui/portfolio-settings-state-adapter.js',
  './js/ui/portfolio-ui-engine-adapter.js',
  './js/ui/benchmark-manager.js',
  './js/ui/benchmark-management-services.js',
  './js/benchmarks/benchmark-model.js',
  './js/benchmarks/benchmark-engine.js',
  './js/data/api-errors.js',
  './js/data/cache-policy.js',
  './js/data/finnhub-client.js',
  './js/data/historical-data-service.js',
  './js/data/historical-import-errors.js',
  './js/data/historical-normalizer.js',
  './js/data/historical-quality.js',
  './js/data/live-data-cache.js',
  './js/data/live-data-errors.js',
  './js/data/request-queue.js',
  './js/data/symbol-service.js',
  './js/persistence/indexed-db.js',
  './js/persistence/schema.js',
  './js/portfolio/lot-model.js',
  './js/portfolio/portfolio-model.js',
  './js/portfolio/portfolio-validation.js',
  './js/portfolio/portfolio-engine.js',
  './js/utils/date-utils.js',
  './js/utils/number-utils.js',
  './js/utils/dom-utils.js',
  './tests/index.html',
  './tests/ui-tests.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_VERSION)
          .map((cacheName) => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(request.url);

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstForNavigation(request));
    return;
  }

  event.respondWith(cacheFirstForStaticAssets(request));
});

function networkFirstForNavigation(request) {
  return fetch(request)
    .then((response) => {
      const responseClone = response.clone();
      caches.open(CACHE_VERSION).then((cache) => cache.put(request, responseClone));
      return response;
    })
    .catch(() => caches.match(request).then((cachedResponse) => cachedResponse || caches.match('./index.html')));
}

function cacheFirstForStaticAssets(request) {
  return caches.match(request).then((cachedResponse) => {
    if (cachedResponse) {
      return cachedResponse;
    }

    return fetch(request).then((response) => {
      const responseClone = response.clone();
      caches.open(CACHE_VERSION).then((cache) => cache.put(request, responseClone));
      return response;
    });
  });
}
