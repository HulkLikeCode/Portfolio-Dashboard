import { createCacheError } from "./live-data-errors.js";

/**
 * Creates the Phase 2F cache adapter over the existing persistence layer.
 *
 * Preferred specialized persistence methods:
 * - getLiveDataCache(key)
 * - putLiveDataCache(entry)
 * - deleteLiveDataCache(key), optional
 *
 * Supported specialized aliases:
 * - getMarketDataCache / putMarketDataCache / deleteMarketDataCache
 * - getCacheEntry / putCacheEntry / deleteCacheEntry
 *
 * Generic IndexedDB-manager methods are also supported and receive the cache
 * store name first:
 * - get(storeName, key) / put(storeName, entry) / delete(storeName, key)
 * - getRecord(storeName, key) / putRecord(storeName, entry) /
 *   deleteRecord(storeName, key)
 *
 * The production application should bind this adapter to the existing
 * IndexedDB manager. No silent in-memory production fallback is used.
 */
export function createPersistenceLiveDataCache(persistence, options = {}) {
  if (!persistence || typeof persistence !== "object") {
    throw new TypeError("An IndexedDB-backed persistence adapter is required.");
  }

  const storeName = typeof options.storeName === "string" && options.storeName.trim()
    ? options.storeName.trim()
    : "liveDataCache";

  const specializedGet = pickMethod(persistence, [
    "getLiveDataCache",
    "getMarketDataCache",
    "getCacheEntry"
  ]);
  const specializedPut = pickMethod(persistence, [
    "putLiveDataCache",
    "putMarketDataCache",
    "putCacheEntry"
  ]);
  const specializedDelete = pickMethod(persistence, [
    "deleteLiveDataCache",
    "deleteMarketDataCache",
    "deleteCacheEntry"
  ], true);

  let get;
  let put;
  let remove;

  if (specializedGet && specializedPut) {
    get = specializedGet;
    put = specializedPut;
    remove = specializedDelete;
  } else {
    const genericGet = pickMethod(persistence, ["getRecord", "get"]);
    const genericPut = pickMethod(persistence, ["putRecord", "put"]);
    const genericDelete = pickMethod(persistence, ["deleteRecord", "delete"], true);
    if (genericGet && genericPut) {
      get = (key) => genericGet(storeName, key);
      put = (entry) => genericPut(storeName, entry);
      remove = genericDelete
        ? (key) => genericDelete(storeName, key)
        : null;
    }
  }

  if (!get || !put) {
    throw new TypeError(
      "The persistence adapter must provide specialized live-data cache methods or generic store-aware get and put methods."
    );
  }

  return Object.freeze({
    storeName,
    async get(key) {
      return clonePlain(await get(key));
    },
    async put(entry) {
      await put(clonePlain(entry));
      return clonePlain(entry);
    },
    async delete(key) {
      if (remove) {
        await remove(key);
      }
    }
  });
}

/** Deterministic cache for tests only. */
export function createMemoryLiveDataCache(initialEntries = []) {
  const entries = new Map();
  let readFailure = null;
  let writeFailure = null;

  for (const entry of initialEntries || []) {
    if (entry && entry.key) {
      entries.set(entry.key, clonePlain(entry));
    }
  }

  return {
    async get(key) {
      if (readFailure) {
        throw readFailure;
      }
      return clonePlain(entries.get(key) || null);
    },
    async put(entry) {
      if (writeFailure) {
        throw writeFailure;
      }
      if (!entry || typeof entry.key !== "string") {
        throw new TypeError("Cache entry requires a key.");
      }
      entries.set(entry.key, clonePlain(entry));
      return clonePlain(entry);
    },
    async delete(key) {
      entries.delete(key);
    },
    setReadFailure(error) {
      readFailure = error || null;
    },
    setWriteFailure(error) {
      writeFailure = error || null;
    },
    snapshot() {
      return Object.fromEntries(
        Array.from(entries.entries(), ([key, value]) => [key, clonePlain(value)])
      );
    }
  };
}

export async function safeCacheRead(cache, key, context = {}) {
  try {
    return {
      entry: await cache.get(key),
      error: null
    };
  } catch (error) {
    return {
      entry: null,
      error: createCacheError("read", error, {
        ...context,
        cacheKey: key
      })
    };
  }
}

export async function safeCacheWrite(cache, entry, context = {}) {
  try {
    await cache.put(entry);
    return { error: null };
  } catch (error) {
    return {
      error: createCacheError("write", error, {
        ...context,
        cacheKey: entry && entry.key
      })
    };
  }
}

function pickMethod(target, names, optional = false) {
  for (const name of names) {
    if (typeof target[name] === "function") {
      return target[name].bind(target);
    }
  }
  return optional ? null : null;
}

function clonePlain(value) {
  if (value === null || value === undefined) {
    return value;
  }
  return JSON.parse(JSON.stringify(value));
}
