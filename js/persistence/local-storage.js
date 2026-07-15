// js/persistence/local-storage.js
// Local Storage manager for small configuration state.
// Debounced writes prevent rewriting the full state blob on every input event.

import {
  DEFAULT_DEBOUNCE_MS,
  LOCAL_STORAGE_KEY,
  createDefaultLocalState,
  migrateLocalState,
  mergeLocalState,
  normalizeLocalState,
  nowIso
} from './schema.js';

export class LocalStoragePersistence {
  constructor(options = {}) {
    this.storageKey = options.storageKey || LOCAL_STORAGE_KEY;
    this.debounceMs = Number.isFinite(options.debounceMs) ? options.debounceMs : DEFAULT_DEBOUNCE_MS;
    this.storage = options.storage || window.localStorage;
    this.pendingState = null;
    this.writeTimer = null;
    this.listeners = new Set();
  }

  isAvailable() {
    try {
      const probeKey = `${this.storageKey}.probe`;
      this.storage.setItem(probeKey, '1');
      this.storage.removeItem(probeKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  readState() {
    if (!this.isAvailable()) {
      return createDefaultLocalState();
    }

    const raw = this.storage.getItem(this.storageKey);

    try {
      return migrateLocalState(raw);
    } catch (error) {
      return createDefaultLocalState();
    }
  }

  writeStateNow(state) {
    if (!this.isAvailable()) {
      throw new Error('Local Storage is not available.');
    }

    const normalized = normalizeLocalState({
      ...state,
      updatedAt: nowIso()
    });

    this.storage.setItem(this.storageKey, JSON.stringify(normalized));
    this.pendingState = null;
    this.notify(normalized);

    return normalized;
  }

  scheduleWrite(state) {
    const normalized = normalizeLocalState({
      ...state,
      updatedAt: nowIso()
    });

    this.pendingState = normalized;

    if (this.writeTimer) {
      window.clearTimeout(this.writeTimer);
    }

    this.writeTimer = window.setTimeout(() => {
      this.flush();
    }, this.debounceMs);

    return normalized;
  }

  patchState(patchOrUpdater, options = {}) {
    const current = this.pendingState || this.readState();

    const patch =
      typeof patchOrUpdater === 'function'
        ? patchOrUpdater(current)
        : patchOrUpdater;

    const nextState = mergeLocalState(current, patch || {});

    if (options.immediate) {
      return this.writeStateNow(nextState);
    }

    return this.scheduleWrite(nextState);
  }

  flush() {
    if (this.writeTimer) {
      window.clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }

    if (!this.pendingState) {
      return this.readState();
    }

    return this.writeStateNow(this.pendingState);
  }

  clearState() {
    if (this.writeTimer) {
      window.clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }

    this.pendingState = null;

    if (this.isAvailable()) {
      this.storage.removeItem(this.storageKey);
    }

    const defaultState = createDefaultLocalState();
    this.notify(defaultState);

    return defaultState;
  }

  subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('Local Storage subscriber must be a function.');
    }

    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  notify(state) {
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        // Do not let listener failures prevent persistence.
      }
    });
  }
}

export const localStoragePersistence = new LocalStoragePersistence();
