// js/diagnostics/capabilities.js
// Browser capability checks for Phase 1 diagnostics.
// This module does not make network or market-data calls.

export async function runCapabilityChecks() {
  const checks = {
    localStorage: checkLocalStorage(),
    indexedDB: await checkIndexedDb(),
    serviceWorkers: checkServiceWorkers(),
    webWorkers: checkWebWorkers(),
    fetch: checkFetch(),
    promise: checkPromise(),
    echarts: checkECharts(),
    storageManager: await checkStorageManager(),
    blobDownload: checkBlobDownload(),
    graphics: checkGraphics()
  };

  return {
    checkedAt: new Date().toISOString(),
    checks,
    warnings: Object.entries(checks)
      .filter(([, result]) => !result.supported && result.severity !== 'error')
      .map(([name, result]) => ({ name, message: result.message })),
    errors: Object.entries(checks)
      .filter(([, result]) => !result.supported && result.severity === 'error')
      .map(([name, result]) => ({ name, message: result.message }))
  };
}

export function checkLocalStorage() {
  try {
    const key = 'mvpPortfolioDashboard.capability.localStorage';
    window.localStorage.setItem(key, '1');
    window.localStorage.removeItem(key);

    return available('Local Storage is available.');
  } catch (error) {
    return unavailable('error', 'Local Storage is unavailable. Settings and portfolio configuration cannot persist.');
  }
}

export async function checkIndexedDb() {
  if (!('indexedDB' in window)) {
    return unavailable('error', 'IndexedDB is unavailable. Market-data cache placeholders cannot persist.');
  }

  const dbName = 'mvpPortfolioDashboard.capability.indexedDB';

  try {
    await new Promise((resolve, reject) => {
      const request = window.indexedDB.open(dbName, 1);

      request.onupgradeneeded = () => {
        request.result.createObjectStore('probe', { keyPath: 'id' });
      };

      request.onsuccess = () => {
        request.result.close();
        resolve(true);
      };

      request.onerror = () => reject(request.error || new Error('IndexedDB probe failed.'));
      request.onblocked = () => reject(new Error('IndexedDB probe was blocked.'));
    });

    await new Promise((resolve, reject) => {
      const deleteRequest = window.indexedDB.deleteDatabase(dbName);

      deleteRequest.onsuccess = () => resolve(true);
      deleteRequest.onerror = () => reject(deleteRequest.error || new Error('IndexedDB probe cleanup failed.'));
      deleteRequest.onblocked = () => resolve(false);
    });

    return available('IndexedDB is available.');
  } catch (error) {
    return unavailable('error', 'IndexedDB is unavailable or blocked. Cached quote, candle, metadata, diagnostics, and staging data may not persist.');
  }
}

export function checkServiceWorkers() {
  if ('serviceWorker' in navigator) {
    return available('Service workers are available.');
  }

  return unavailable('warning', 'Service workers are unavailable. Offline PWA shell behavior may not work.');
}

export function checkWebWorkers() {
  if (typeof Worker !== 'undefined') {
    return available('Web Workers are available.');
  }

  return unavailable('warning', 'Web Workers are unavailable. Future Monte Carlo simulations may block or be disabled.');
}

export function checkFetch() {
  if (typeof fetch === 'function') {
    return available('Fetch is available.');
  }

  return unavailable('error', 'Fetch is unavailable. Runtime data retrieval cannot work.');
}

export function checkPromise() {
  if (typeof Promise === 'function') {
    return available('Promise is available.');
  }

  return unavailable('error', 'Promise is unavailable. ES2020 module workflows cannot run reliably.');
}

export function checkECharts() {
  if (typeof window.echarts !== 'undefined') {
    return available('ECharts is available.');
  }

  return unavailable('error', 'Vendored ECharts did not load. Charts and offline chart export are unavailable.');
}

export async function checkStorageManager() {
  if (!navigator.storage) {
    return unavailable('warning', 'StorageManager is unavailable. Browser storage persistence cannot be requested.');
  }
  try {
    const [persisted, estimate] = await Promise.all([navigator.storage.persisted?.(), navigator.storage.estimate?.()]);
    const usage = Number.isFinite(estimate?.usage) ? `${estimate.usage} bytes used` : 'usage unavailable';
    return available(`StorageManager is available; persistence ${persisted ? 'granted' : 'not granted'}; ${usage}.`);
  } catch (_) {
    return unavailable('warning', 'StorageManager is present but its status could not be read.');
  }
}

export function checkBlobDownload() {
  try {
    const blobSupported = typeof Blob === 'function' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
    const anchor = document.createElement('a');
    const downloadSupported = 'download' in anchor;

    if (blobSupported && downloadSupported) {
      return available('Blob/download support is available.');
    }

    return unavailable('warning', 'Blob/download support is incomplete. Backup and PNG downloads may need fallback handling.');
  } catch (error) {
    return unavailable('warning', 'Blob/download support check failed.');
  }
}

export function checkGraphics() {
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (context) {
      return available('Canvas 2D graphics are available.');
    }

    return unavailable('warning', 'Canvas 2D graphics are unavailable. Future chart rendering may be impaired.');
  } catch (error) {
    return unavailable('warning', 'Graphics capability check failed.');
  }
}

function available(message) {
  return {
    supported: true,
    severity: 'ok',
    message
  };
}

function unavailable(severity, message) {
  return {
    supported: false,
    severity,
    message
  };
}
