import assert from 'node:assert/strict';

class MemoryStorage {
  constructor() {
    this.items = new Map();
  }

  getItem(key) {
    return this.items.has(key) ? this.items.get(key) : null;
  }

  setItem(key, value) {
    this.items.set(key, String(value));
  }

  removeItem(key) {
    this.items.delete(key);
  }
}

const localStorage = new MemoryStorage();
globalThis.window = {
  localStorage,
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout
};

const settings = await import('../js/settings/settings-state.js');
const { LocalStoragePersistence } = await import('../js/persistence/local-storage.js');

settings.resetSettingsStateForTesting();
const legacyState = settings.createDefaultSettingsState();
legacyState.api.apiKey = 'legacy-secret-that-must-be-scrubbed';
legacyState.api.keySource = 'user-override';
localStorage.setItem(settings.getSettingsStorageKey(), JSON.stringify(legacyState));

const migrated = settings.loadSettingsState();
assert.equal(migrated.api.apiKey, 'legacy-secret-that-must-be-scrubbed');
assert.equal(JSON.parse(localStorage.getItem(settings.getSettingsStorageKey())).api.apiKey, undefined);
assert(!localStorage.getItem(settings.getSettingsStorageKey()).includes('legacy-secret-that-must-be-scrubbed'));

const next = settings.createDefaultSettingsState();
next.api.apiKey = 'runtime-secret-that-must-not-persist';
next.api.keySource = 'user-override';
settings.saveSettingsState(next, { incrementEditCount: false });

const rawSettings = localStorage.getItem(settings.getSettingsStorageKey());
assert(!rawSettings.includes('runtime-secret-that-must-not-persist'));
assert(!Object.hasOwn(JSON.parse(rawSettings).api, 'apiKey'));
assert.equal(settings.loadSettingsState().api.apiKey, 'runtime-secret-that-must-not-persist');

const persistence = new LocalStoragePersistence({
  storage: localStorage,
  storageKey: 'security-test.local-state',
  debounceMs: 0
});
persistence.writeStateNow({
  apiSettings: {
    provider: 'finnhub',
    apiKey: 'secondary-secret-that-must-not-persist',
    hasApiKey: true,
    keySource: 'user-override'
  }
});

const rawLocalState = localStorage.getItem('security-test.local-state');
assert(!rawLocalState.includes('secondary-secret-that-must-not-persist'));
assert(!Object.hasOwn(JSON.parse(rawLocalState).apiSettings, 'apiKey'));

console.log('PASS security-storage-tests: API keys remain runtime-only and legacy storage is scrubbed');
