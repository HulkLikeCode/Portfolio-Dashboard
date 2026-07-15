import { FinnhubClient } from "../data/finnhub-client.js";
import { HistoricalDataService } from "../data/historical-data-service.js";
import { createPersistenceLiveDataCache } from "../data/live-data-cache.js";
import { RequestQueue } from "../data/request-queue.js";
import { SymbolService } from "../data/symbol-service.js";
import { IndexedDbPersistence } from "../persistence/indexed-db.js";
import { getActiveFinnhubApiKey } from "../settings/settings-state.js";

export function createBenchmarkManagementServices(options = {}) {
  const persistence = options.persistence || new IndexedDbPersistence();
  const historicalDataService = options.historicalDataService || new HistoricalDataService({
    storage: {
      getHistoricalSeries: (symbol) => persistence.getHistoricalSeries(symbol),
      getHistoricalMetadata: (symbol) => persistence.getHistoricalManifest(symbol)
    }
  });
  const requestQueue = options.requestQueue || new RequestQueue();
  const client = options.client || new FinnhubClient({
    requestQueue,
    getApiKey: options.getApiKey || (() => getActiveFinnhubApiKey())
  });
  const cache = options.cache || createPersistenceLiveDataCache(persistence);
  const symbolService = options.symbolService || new SymbolService({
    client,
    cache,
    getHistoricalStatus: (symbol) => historicalDataService.getDatasetStatus(symbol)
  });

  return { persistence, historicalDataService, requestQueue, client, cache, symbolService };
}
