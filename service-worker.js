// Only immutable, credential-free application resources belong in this cache.
// User settings, backups, imports, IndexedDB records, and provider responses
// are deliberately excluded and remain under their own browser storage policy.
const STATIC_CACHE_PREFIX = 'portfolio-dash-static-';
const CACHE_VERSION = `${STATIC_CACHE_PREFIX}v0.2.3-phase-10a-1`;

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon.svg',
  './icons/maskable-icon.svg',
  './vendor/echarts/echarts.js',
  './data/historical/manifest.json',
  './data/historical/seed/avdv.us.txt',
  './data/historical/seed/avuv.us.txt',
  './data/historical/seed/dco.us.txt',
  './data/historical/seed/iwm.us.txt',
  './data/historical/seed/oneq.us.txt',
  './data/historical/seed/psch.us.txt',
  './data/historical/seed/spy.us.txt',
  './data/historical/seed/vtv.us.txt',
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
  './js/charts/mc-confidence-fan.js',
  './js/charts/mc-percentile-bands.js',
  './js/settings/settings-state.js',
  './js/settings/projection-settings.js',
  './js/ui/setup-wizard.js',
  './js/ui/lot-editor.js',
  './js/ui/portfolio-editor.js',
  './js/ui/portfolio-phase-3b.js',
  './js/ui/portfolio-settings-state-adapter.js',
  './js/ui/portfolio-ui-engine-adapter.js',
  './js/ui/benchmark-manager.js',
  './js/ui/benchmark-management-services.js',
  './js/ui/full-backup-manager.js',
  './js/benchmarks/benchmark-model.js',
  './js/benchmarks/benchmark-engine.js',
  './js/data/api-errors.js',
  './js/data/cache-policy.js',
  './js/data/finnhub-client.js',
  './js/data/historical-data-service.js',
  './js/data/historical-dataset-manager.js',
  './js/data/historical-file-parser.js',
  './js/data/historical-import-errors.js',
  './js/data/historical-import-service.js',
  './js/data/historical-normalizer.js',
  './js/data/historical-quality.js',
  './js/data/historical-validator.js',
  './js/data/live-data-cache.js',
  './js/data/live-data-errors.js',
  './js/data/request-queue.js',
  './js/data/symbol-service.js',
  './js/data/market-data-service.js',
  './js/data/risk-free-rate-service.js',
  './js/diagnostics/capabilities.js',
  './js/diagnostics/historical-data-diagnostics.js',
  './js/diagnostics/live-data-diagnostics.js',
  './js/export/backup-export.js',
  './js/export/backup-restore.js',
  './js/export/export-manager.js',
  './js/export/full-backup-export.js',
  './js/export/full-backup-restore.js',
  './js/persistence/indexed-db.js',
  './js/persistence/local-storage.js',
  './js/persistence/schema.js',
  './js/portfolio/lot-model.js',
  './js/portfolio/portfolio-model.js',
  './js/portfolio/portfolio-validation.js',
  './js/portfolio/portfolio-engine.js',
  './js/utils/date-utils.js',
  './js/utils/number-utils.js',
  './js/utils/dom-utils.js',
  './js/utils/projection-date-utils.js',
  './js/analytics/alpha-beta.js',
  './js/analytics/analytics-engine.js',
  './js/analytics/cagr.js',
  './js/analytics/date-alignment.js',
  './js/analytics/drawdown.js',
  './js/analytics/return-series.js',
  './js/monte-carlo/bootstrap.js',
  './js/monte-carlo/covariance.js',
  './js/monte-carlo/gbm.js',
  './js/monte-carlo/mc-controller.js',
  './js/monte-carlo/mc-inputs.js',
  './js/monte-carlo/mc-state.js',
  './js/monte-carlo/random.js',
  './js/monte-carlo/statistics.js',
  './js/ui/historical-import-dialog.js',
  './js/ui/historical-import-preview.js',
  './js/workers/monte-carlo-worker.js',
  './js/workers/worker-protocol.js'
];

self.addEventListener('install', (event) => {
  // addAll is atomic: an incomplete shell never replaces a known-good cache.
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names
        .filter((name) => name.startsWith(STATIC_CACHE_PREFIX) && name !== CACHE_VERSION)
        .map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Bypass Cache Storage for this no-store probe so the page can distinguish
  // an available internet connection from an unavailable Pages host.
  if (url.searchParams.has('__pages_healthcheck')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // The service worker never writes runtime responses to Cache Storage. This
  // keeps query-bearing requests, exports, and mutable user content out of it.
  if (isPrecachedAsset(url)) event.respondWith(cacheFirstStatic(request));
});

function isPrecachedAsset(url) {
  const asset = new URL(url.pathname, self.location.href).pathname;
  return STATIC_ASSETS.some((path) => new URL(path, self.location.href).pathname === asset);
}

function networkFirstNavigation(request) {
  return fetch(request).catch(() => caches.match('./index.html'));
}

function cacheFirstStatic(request) {
  return caches.match(request, { ignoreSearch: true }).then((cached) => cached || fetch(request));
}
