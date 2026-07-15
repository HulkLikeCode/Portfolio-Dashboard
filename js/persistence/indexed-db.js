import {
  DEFAULT_INDEXED_DB_BATCH_MS,
  INDEXED_DB_NAME,
  INDEXED_DB_SCHEMA_VERSION,
  INDEXED_DB_STORE_DEFINITIONS,
  STORE_NAMES,
  applyIndexedDbSchema
} from "./schema.js";

export class IndexedDbPersistence {
  constructor(options = {}) {
    this.databaseName = options.databaseName || INDEXED_DB_NAME;
    this.databaseVersion = Number.isInteger(options.databaseVersion)
      ? options.databaseVersion
      : INDEXED_DB_SCHEMA_VERSION;
    this.batchDelayMs = Number.isFinite(options.batchDelayMs)
      ? Math.max(0, options.batchDelayMs)
      : DEFAULT_INDEXED_DB_BATCH_MS;
    this.indexedDbFactory = options.indexedDbFactory
      || (typeof globalThis !== "undefined" ? globalThis.indexedDB : null);
    this._database = null;
    this._openPromise = null;
    this._pendingWrites = new Map();
    this._pendingTimers = new Map();
  }

  isSupported() {
    return Boolean(this.indexedDbFactory);
  }

  async open() {
    if (this._database) {
      return this._database;
    }
    if (this._openPromise) {
      return this._openPromise;
    }
    if (!this.isSupported()) {
      throw new Error("IndexedDB is not supported in this browser.");
    }

    this._openPromise = new Promise((resolve, reject) => {
      const request = this.indexedDbFactory.open(
        this.databaseName,
        this.databaseVersion
      );

      request.onupgradeneeded = (event) => {
        applyIndexedDbSchema(event);
      };

      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
          if (this._database === database) {
            this._database = null;
          }
        };
        this._database = database;
        resolve(database);
      };

      request.onerror = () => {
        reject(request.error || new Error("IndexedDB open failed."));
      };

      request.onblocked = () => {
        reject(new Error(
          "IndexedDB upgrade is blocked by another open tab. Close other app tabs and retry."
        ));
      };
    }).finally(() => {
      this._openPromise = null;
    });

    return this._openPromise;
  }

  close() {
    if (this._database) {
      this._database.close();
      this._database = null;
    }
  }

  async put(storeName, value) {
    return this._singleRequest(storeName, "readwrite", (store) => store.put(value));
  }

  async get(storeName, key) {
    return this._singleRequest(storeName, "readonly", (store) => store.get(key));
  }

  async getAll(storeName, query = null, count = undefined) {
    return this._singleRequest(
      storeName,
      "readonly",
      (store) => typeof count === "number"
        ? store.getAll(query, count)
        : store.getAll(query)
    );
  }

  async getAllByIndex(storeName, indexName, query = null, count = undefined) {
    return this._singleRequest(
      storeName,
      "readonly",
      (store) => {
        const index = store.index(indexName);
        return typeof count === "number"
          ? index.getAll(query, count)
          : index.getAll(query);
      }
    );
  }

  async count(storeName, query = null) {
    return this._singleRequest(storeName, "readonly", (store) => store.count(query));
  }

  async countByIndex(storeName, indexName, query = null) {
    return this._singleRequest(
      storeName,
      "readonly",
      (store) => store.index(indexName).count(query)
    );
  }

  async delete(storeName, key) {
    return this._singleRequest(storeName, "readwrite", (store) => store.delete(key));
  }

  async clear(storeName) {
    return this._singleRequest(storeName, "readwrite", (store) => store.clear());
  }

  async clearAllStores() {
    await this.flushPendingWrites();
    const database = await this.open();
    const storeNames = Array.from(database.objectStoreNames);
    if (storeNames.length === 0) {
      return;
    }

    await new Promise((resolve, reject) => {
      const transaction = database.transaction(storeNames, "readwrite");
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error || new Error("IndexedDB clear aborted."));
      transaction.onerror = () => {};
      for (const storeName of storeNames) {
        transaction.objectStore(storeName).clear();
      }
    });
  }

  async batchPut(storeName, values) {
    if (!Array.isArray(values)) {
      throw new TypeError("batchPut values must be an array.");
    }
    if (values.length === 0) {
      return 0;
    }

    const database = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      let requestError = null;

      transaction.oncomplete = () => resolve(values.length);
      transaction.onabort = () => reject(
        requestError || transaction.error || new Error(`IndexedDB batch write to ${storeName} aborted.`)
      );
      transaction.onerror = () => {};

      try {
        for (const value of values) {
          const request = store.put(value);
          request.onerror = () => {
            requestError = request.error;
          };
        }
      } catch (error) {
        requestError = error;
        transaction.abort();
      }
    });
  }

  schedulePut(storeName, value) {
    return new Promise((resolve, reject) => {
      const queue = this._pendingWrites.get(storeName) || [];
      queue.push({ value, resolve, reject });
      this._pendingWrites.set(storeName, queue);

      if (this._pendingTimers.has(storeName)) {
        return;
      }
      const timer = setTimeout(() => {
        this._pendingTimers.delete(storeName);
        this.flushPendingWrites(storeName).catch(() => {});
      }, this.batchDelayMs);
      this._pendingTimers.set(storeName, timer);
    });
  }

  async flushPendingWrites(storeName = null) {
    const storeNames = storeName
      ? [storeName]
      : Array.from(this._pendingWrites.keys());

    for (const name of storeNames) {
      const timer = this._pendingTimers.get(name);
      if (timer) {
        clearTimeout(timer);
        this._pendingTimers.delete(name);
      }

      const queue = this._pendingWrites.get(name) || [];
      this._pendingWrites.delete(name);
      if (queue.length === 0) {
        continue;
      }

      try {
        await this.batchPut(name, queue.map((entry) => entry.value));
        queue.forEach((entry) => entry.resolve());
      } catch (error) {
        queue.forEach((entry) => entry.reject(error));
        throw error;
      }
    }
  }

  async deleteDatabase() {
    await this.flushPendingWrites();
    this.close();
    if (!this.isSupported()) {
      return;
    }

    await new Promise((resolve, reject) => {
      const request = this.indexedDbFactory.deleteDatabase(this.databaseName);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error("IndexedDB delete failed."));
      request.onblocked = () => reject(new Error(
        "IndexedDB deletion is blocked by another open tab."
      ));
    });
  }

  async getHistoricalManifest(symbol) {
    return this.get(
      STORE_NAMES.HISTORICAL_DATASET_MANIFESTS,
      `symbol:${normalizeSymbol(symbol)}`
    );
  }

  async getHistoricalDatasetManifest(datasetId) {
    return this.get(
      STORE_NAMES.HISTORICAL_DATASET_MANIFESTS,
      `dataset:${String(datasetId)}`
    );
  }

  async getHistoricalManifests() {
    const records = await this.getAll(STORE_NAMES.HISTORICAL_DATASET_MANIFESTS);
    return records.filter((record) => record && record.recordType === "symbol");
  }

  async getHistoricalCandle(symbol, date) {
    return this.get(
      STORE_NAMES.HISTORICAL_CANDLES,
      [normalizeSymbol(symbol), String(date)]
    );
  }

  async getHistoricalSeries(symbol) {
    const normalized = normalizeSymbol(symbol);
    const range = compoundSymbolRange(normalized);
    return this.getAll(STORE_NAMES.HISTORICAL_CANDLES, range);
  }

  async countHistoricalCandles(symbol = null) {
    if (symbol === null || typeof symbol === "undefined") {
      return this.count(STORE_NAMES.HISTORICAL_CANDLES);
    }
    return this.count(
      STORE_NAMES.HISTORICAL_CANDLES,
      compoundSymbolRange(normalizeSymbol(symbol))
    );
  }

  async replaceHistoricalSeries(symbol, records, metadata, options = {}) {
    const normalizedSymbol = normalizeSymbol(symbol);
    if (!Array.isArray(records) || records.length === 0) {
      throw new TypeError("A nonempty normalized historical record array is required.");
    }
    if (!metadata || typeof metadata !== "object") {
      throw new TypeError("Historical series metadata is required.");
    }

    const database = await this.open();
    const importedAt = metadata.importedAt || new Date().toISOString();
    const sourceFileHash = metadata.sourceFileHash || metadata.sha256 || null;
    const datasetVersion = metadata.datasetVersion || null;
    const warnings = Array.isArray(options.warnings) ? options.warnings : [];
    const progressEvery = Math.max(1, Number(options.progressEvery) || 250);
    const onProgress = typeof options.onProgress === "function"
      ? options.onProgress
      : null;
    const storeNames = [
      STORE_NAMES.HISTORICAL_CANDLES,
      STORE_NAMES.HISTORICAL_DATASET_MANIFESTS,
      STORE_NAMES.HISTORICAL_IMPORT_BATCHES,
      STORE_NAMES.HISTORICAL_QUALITY_FLAGS
    ];

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeNames, "readwrite");
      const candleStore = transaction.objectStore(STORE_NAMES.HISTORICAL_CANDLES);
      const manifestStore = transaction.objectStore(STORE_NAMES.HISTORICAL_DATASET_MANIFESTS);
      const importStore = transaction.objectStore(STORE_NAMES.HISTORICAL_IMPORT_BATCHES);
      const qualityStore = transaction.objectStore(STORE_NAMES.HISTORICAL_QUALITY_FLAGS);
      const startedAt = new Date().toISOString();
      const batchId = metadata.importBatchId
        || `${normalizedSymbol}:${importedAt}:${String(sourceFileHash || "nohash").slice(0, 12)}`;
      let completedWrites = 0;
      let operationError = null;

      transaction.oncomplete = () => {
        safeProgress(onProgress, {
          symbol: normalizedSymbol,
          completedRecords: records.length,
          totalRecords: records.length,
          percent: 100
        });
        resolve({
          symbol: normalizedSymbol,
          recordCount: records.length,
          importedAt,
          batchId
        });
      };
      transaction.onabort = () => reject(
        operationError
        || transaction.error
        || new Error(`Historical replacement for ${normalizedSymbol} was aborted.`)
      );
      transaction.onerror = () => {};

      try {
        candleStore.delete(compoundSymbolRange(normalizedSymbol));
        qualityStore.delete(stringPrefixRange(`${normalizedSymbol}:`));

        for (const record of records) {
          const storedRecord = {
            ...record,
            symbol: normalizedSymbol,
            datasetVersion,
            sourceFileHash,
            importedAt
          };
          const request = candleStore.put(storedRecord);
          request.onsuccess = () => {
            completedWrites += 1;
            if (
              completedWrites === records.length
              || completedWrites % progressEvery === 0
            ) {
              safeProgress(onProgress, {
                symbol: normalizedSymbol,
                completedRecords: completedWrites,
                totalRecords: records.length,
                percent: Math.round((completedWrites / records.length) * 100)
              });
            }
          };
          request.onerror = () => {
            operationError = request.error;
          };
        }

        const symbolManifest = {
          ...metadata,
          id: `symbol:${normalizedSymbol}`,
          recordType: "symbol",
          symbol: normalizedSymbol,
          sourceFileHash,
          recordCount: records.length,
          firstDate: records[0].date,
          lastDate: records[records.length - 1].date,
          installedAt: importedAt,
          importBatchId: batchId,
          status: "current"
        };
        manifestStore.put(symbolManifest);

        importStore.put({
          id: batchId,
          symbol: normalizedSymbol,
          datasetId: metadata.datasetId || null,
          datasetVersion,
          sourceFileHash,
          mode: metadata.importMode || "full-series-replacement",
          status: "completed",
          recordCount: records.length,
          startedAt,
          completedAt: importedAt
        });

        warnings.forEach((warning, index) => {
          qualityStore.put({
            id: `${normalizedSymbol}:${warning.code || "warning"}:${index}`,
            symbol: normalizedSymbol,
            datasetVersion,
            code: warning.code || "HISTORICAL_WARNING",
            severity: warning.severity || "warning",
            message: warning.message || "Historical data warning.",
            count: Number.isFinite(warning.count) ? warning.count : 1,
            createdAt: importedAt
          });
        });
      } catch (error) {
        operationError = error;
        transaction.abort();
      }
    });
  }

  async putHistoricalDatasetManifest(manifestRecord) {
    return this.put(STORE_NAMES.HISTORICAL_DATASET_MANIFESTS, manifestRecord);
  }

  async _singleRequest(storeName, mode, createRequest) {
    const database = await this.open();
    assertStoreExists(database, storeName);

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      let request;
      try {
        request = createRequest(store);
      } catch (error) {
        reject(error);
        return;
      }
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || transaction.error);
    });
  }
}

export const indexedDbPersistence = new IndexedDbPersistence();

export { STORE_NAMES, INDEXED_DB_STORE_DEFINITIONS };

function assertStoreExists(database, storeName) {
  if (!database.objectStoreNames.contains(storeName)) {
    throw new Error(`IndexedDB object store ${storeName} is not available.`);
  }
}

function normalizeSymbol(symbol) {
  if (typeof symbol !== "string" || symbol.trim() === "") {
    throw new TypeError("A historical symbol is required.");
  }
  return symbol.trim().toUpperCase();
}

function compoundSymbolRange(symbol) {
  return IDBKeyRange.bound([symbol, ""], [symbol, "\uffff"]);
}

function stringPrefixRange(prefix) {
  return IDBKeyRange.bound(prefix, `${prefix}\uffff`);
}

function safeProgress(callback, detail) {
  if (!callback) {
    return;
  }
  try {
    callback(detail);
  } catch (error) {
    // Progress rendering must never abort a persistence transaction.
  }
}
