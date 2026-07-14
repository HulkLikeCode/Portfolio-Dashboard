import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  FINNHUB_ENDPOINTS,
  FINNHUB_PRIORITIES,
  FinnhubClient
} from "../js/data/finnhub-client.js";
import {
  LIVE_DATA_ERROR_CODES,
  LiveDataError,
  normalizeLiveDataError
} from "../js/data/live-data-errors.js";
import {
  LIVE_DATA_TTLS,
  cacheKey,
  createCacheEntry
} from "../js/data/cache-policy.js";
import {
  createMemoryLiveDataCache,
  createPersistenceLiveDataCache
} from "../js/data/live-data-cache.js";
import {
  MarketDataService,
  normalizeQuote
} from "../js/data/market-data-service.js";
import { SymbolService } from "../js/data/symbol-service.js";
import {
  RiskFreeRateService,
  normalizeTreasuryAuctionResponse
} from "../js/data/risk-free-rate-service.js";
import { LiveDataDiagnostics } from "../js/diagnostics/live-data-diagnostics.js";

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

class FakeQueue {
  constructor() {
    this.calls = [];
  }
  enqueue(task, options) {
    this.calls.push(structuredCloneSafe(options));
    return task();
  }
  getBudgetStatus() {
    return {
      available: true,
      maxPerSecond: 30,
      maxPerMinute: 60,
      callsLastSecond: this.calls.length,
      callsLastMinute: this.calls.length,
      remainingSecond: Math.max(0, 30 - this.calls.length),
      remainingMinute: Math.max(0, 60 - this.calls.length),
      queued: 0,
      inFlight: 0
    };
  }
}

class RouteFetch {
  constructor(routes = {}) {
    this.routes = routes;
    this.calls = [];
  }
  async fetch(url, options = {}) {
    const parsed = new URL(url);
    this.calls.push({
      pathname: parsed.pathname,
      params: Object.fromEntries(parsed.searchParams.entries()),
      options
    });
    const route = this.routes[parsed.pathname];
    if (!route) {
      return fakeResponse(404, { error: "not found" });
    }
    if (typeof route === "function") {
      return route(parsed, options, this.calls.length);
    }
    return fakeResponse(200, route);
  }
}

function fakeResponse(status, payload, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Request failed",
    headers: {
      get(name) {
        if (String(name).toLowerCase() === "content-type") {
          return headers["content-type"] || "application/json";
        }
        return headers[String(name).toLowerCase()] || null;
      }
    },
    async json() {
      if (payload instanceof Error) {
        throw payload;
      }
      return structuredCloneSafe(payload);
    },
    async text() {
      return typeof payload === "string" ? payload : JSON.stringify(payload);
    }
  };
}

function makeClient(routeFetch, queue = new FakeQueue(), key = "runtime-test-key") {
  return {
    client: new FinnhubClient({
      requestQueue: queue,
      getApiKey: async () => key,
      fetchImpl: routeFetch.fetch.bind(routeFetch),
      now: () => "2026-07-11T14:00:00.000Z"
    }),
    queue
  };
}

function validQuote(price = 100) {
  return {
    c: price,
    d: 1,
    dp: 1,
    h: price + 1,
    l: price - 1,
    o: price - 0.5,
    pc: price - 1,
    t: 1783788000
  };
}

function structuredCloneSafe(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

test("Finnhub client requires the existing Request Queue", () => {
  assert.throws(
    () => new FinnhubClient({ getApiKey: () => "x", fetchImpl: async () => {} }),
    (error) => error instanceof LiveDataError
      && error.code === LIVE_DATA_ERROR_CODES.REQUEST_QUEUE_REQUIRED
  );
});


test("Missing runtime API key does not consume queue budget", async () => {
  const routes = new RouteFetch({ "/api/v1/quote": validQuote() });
  const queue = new FakeQueue();
  const client = new FinnhubClient({
    requestQueue: queue,
    getApiKey: async () => "",
    fetchImpl: routes.fetch.bind(routes)
  });
  await assert.rejects(
    () => client.getQuote("SPY"),
    (error) => error.code === LIVE_DATA_ERROR_CODES.API_KEY_MISSING
  );
  assert.equal(queue.calls.length, 0);
  assert.equal(routes.calls.length, 0);
});

test("Generic IndexedDB adapter receives store name before key or entry", async () => {
  const calls = [];
  const records = new Map();
  const persistence = {
    async get(storeName, key) {
      calls.push(["get", storeName, key]);
      return records.get(key) || null;
    },
    async put(storeName, entry) {
      calls.push(["put", storeName, entry.key]);
      records.set(entry.key, entry);
    },
    async delete(storeName, key) {
      calls.push(["delete", storeName, key]);
      records.delete(key);
    }
  };
  const cache = createPersistenceLiveDataCache(persistence, { storeName: "marketDataCache" });
  await cache.put({ key: "QUOTE:SPY", data: { currentPrice: 100 } });
  const entry = await cache.get("QUOTE:SPY");
  await cache.delete("QUOTE:SPY");
  assert.equal(entry.data.currentPrice, 100);
  assert.deepEqual(calls, [
    ["put", "marketDataCache", "QUOTE:SPY"],
    ["get", "marketDataCache", "QUOTE:SPY"],
    ["delete", "marketDataCache", "QUOTE:SPY"]
  ]);
});

test("Every Finnhub request is queued with safe metadata", async () => {
  const routes = new RouteFetch({ "/api/v1/quote": validQuote() });
  const { client, queue } = makeClient(routes);
  const result = await client.getQuote("spy", {
    priority: FINNHUB_PRIORITIES.HOLDING_QUOTE
  });
  assert.equal(result.data.c, 100);
  assert.equal(queue.calls.length, 1);
  assert.equal(queue.calls[0].metadata.endpoint, FINNHUB_ENDPOINTS.QUOTE);
  assert.equal(queue.calls[0].metadata.priority, FINNHUB_PRIORITIES.HOLDING_QUOTE);
  assert.equal(JSON.stringify(queue.calls[0]).includes("runtime-test-key"), false);
  assert.equal(routes.calls[0].params.token, undefined);
  assert.equal(routes.calls[0].options.headers["X-Finnhub-Token"], "runtime-test-key");
});

test("Only approved Finnhub endpoints are accepted", async () => {
  const routes = new RouteFetch({});
  const { client } = makeClient(routes);
  await assert.rejects(
    () => client.request("/unsupported", {}),
    (error) => error.code === LIVE_DATA_ERROR_CODES.ENDPOINT_NOT_PERMITTED
  );
});

test("Quote normalization rejects zero-value unavailable payloads", () => {
  assert.throws(
    () => normalizeQuote({ c: 0, pc: 0, t: 0 }),
    (error) => error.code === LIVE_DATA_ERROR_CODES.QUOTE_UNAVAILABLE
  );
});

test("Holding quotes receive higher priority than benchmark quotes", async () => {
  const routes = new RouteFetch({ "/api/v1/quote": validQuote() });
  const { client, queue } = makeClient(routes);
  const service = new MarketDataService({
    client,
    cache: createMemoryLiveDataCache(),
    now: () => "2026-07-11T14:00:00.000Z"
  });
  const result = await service.refreshQuotes([
    { symbol: "SPY", role: "benchmark" },
    { symbol: "DCO", role: "holding" }
  ]);
  assert.equal(result.availableCount, 2);
  assert.equal(queue.calls[0].priority, FINNHUB_PRIORITIES.HOLDING_QUOTE);
  assert.equal(queue.calls[1].priority, FINNHUB_PRIORITIES.BENCHMARK_QUOTE);
});


test("Quote refresh counts unavailable snapshots as failures", async () => {
  const routes = new RouteFetch({ "/api/v1/quote": { c: 0, pc: 0, t: 0 } });
  const { client } = makeClient(routes);
  const service = new MarketDataService({
    client,
    cache: createMemoryLiveDataCache(),
    now: () => "2026-07-11T14:00:00.000Z"
  });
  const result = await service.refreshQuotes([{ symbol: "SPY", role: "benchmark" }]);
  assert.equal(result.availableCount, 0);
  assert.equal(result.failedCount, 1);
  assert.equal(result.results.SPY.data, null);
});

test("Company profile uses the required seven-day TTL", async () => {
  const routes = new RouteFetch({
    "/api/v1/stock/profile2": {
      ticker: "DCO",
      name: "Ducommun",
      exchange: "NYSE",
      weburl: "https://example.test"
    }
  });
  const { client } = makeClient(routes);
  const cache = createMemoryLiveDataCache();
  const service = new MarketDataService({
    client,
    cache,
    now: () => "2026-07-11T14:00:00.000Z"
  });
  const first = await service.getCompanyProfile("DCO");
  const second = await service.getCompanyProfile("DCO");
  assert.equal(first.source, "live");
  assert.equal(second.source, "cache");
  assert.equal(routes.calls.length, 1);
  const entry = cache.snapshot()[cacheKey("profile", "DCO")];
  assert.equal(entry.ttlMs, LIVE_DATA_TTLS.COMPANY_PROFILE);
});

test("Stale metadata falls back to cache after provider failure", async () => {
  const staleEntry = createCacheEntry({
    key: cacheKey("profile", "DCO"),
    category: "COMPANY_PROFILE",
    symbol: "DCO",
    source: "Finnhub",
    data: { ticker: "DCO", name: "Cached DCO" },
    storedAt: "2026-07-03T14:00:00.000Z",
    ttlMs: LIVE_DATA_TTLS.COMPANY_PROFILE,
    staleAfterMs: 30 * 24 * 60 * 60 * 1000,
    provenance: { provider: "Finnhub" }
  });
  const routes = new RouteFetch({
    "/api/v1/stock/profile2": () => fakeResponse(503, { error: "maintenance" })
  });
  const { client } = makeClient(routes);
  const service = new MarketDataService({
    client,
    cache: createMemoryLiveDataCache([staleEntry]),
    now: () => "2026-07-11T14:00:00.000Z"
  });
  const result = await service.getCompanyProfile("DCO");
  assert.equal(result.source, "cache");
  assert.equal(result.availability, "stale");
  assert.equal(result.stale, true);
  assert.equal(result.error.cachedDataUsed, true);
});

test("Cache read failure does not break a successful live request", async () => {
  const routes = new RouteFetch({ "/api/v1/quote": validQuote(125) });
  const { client } = makeClient(routes);
  const cache = createMemoryLiveDataCache();
  cache.setReadFailure(new Error("IndexedDB blocked"));
  const service = new MarketDataService({
    client,
    cache,
    now: () => "2026-07-11T14:00:00.000Z"
  });
  const result = await service.getQuote("SPY");
  assert.equal(result.source, "live");
  assert.equal(result.data.currentPrice, 125);
  assert.equal(result.warnings[0].code, LIVE_DATA_ERROR_CODES.CACHE_READ_FAILED);
});

test("HTTP 429 is normalized and uses a cached quote when available", async () => {
  const cached = createCacheEntry({
    key: cacheKey("quote", "SPY"),
    category: "QUOTE",
    symbol: "SPY",
    source: "Finnhub",
    data: normalizeQuote(validQuote(110)),
    storedAt: "2026-07-11T13:50:00.000Z",
    ttlMs: 5 * 60 * 1000,
    staleAfterMs: 7 * 24 * 60 * 60 * 1000,
    provenance: { provider: "Finnhub" }
  });
  const routes = new RouteFetch({
    "/api/v1/quote": () => fakeResponse(429, { error: "API limit reached" }, {
      "retry-after": "10"
    })
  });
  const { client } = makeClient(routes);
  const service = new MarketDataService({
    client,
    cache: createMemoryLiveDataCache([cached]),
    now: () => "2026-07-11T14:00:00.000Z"
  });
  const result = await service.getQuote("SPY", { forceRefresh: true });
  assert.equal(result.source, "cache");
  assert.equal(result.availability, "stale");
  assert.equal(result.error.code, LIVE_DATA_ERROR_CODES.RATE_LIMITED);
  assert.equal(result.error.cachedDataUsed, true);
});

test("Symbol validation marks missing local history as quote-only", async () => {
  const routes = new RouteFetch({
    "/api/v1/search": {
      count: 1,
      result: [{ symbol: "MSFT", displaySymbol: "MSFT", description: "Microsoft", type: "Common Stock" }]
    }
  });
  const { client } = makeClient(routes);
  const service = new SymbolService({
    client,
    cache: createMemoryLiveDataCache(),
    now: () => "2026-07-11T14:00:00.000Z",
    getHistoricalStatus: async () => ({ state: "missing", available: false })
  });
  const result = await service.validateSymbol("MSFT");
  assert.equal(result.valid, true);
  assert.equal(result.quoteOnly, true);
  assert.equal(result.availability, "quote-only");
});

test("Market status, holidays, metrics, profile, peers, lookup, and quote use only approved endpoints", async () => {
  const routes = new RouteFetch({
    "/api/v1/quote": validQuote(),
    "/api/v1/search": { count: 0, result: [] },
    "/api/v1/stock/symbol": [],
    "/api/v1/stock/profile2": { ticker: "SPY", name: "SPDR S&P 500 ETF Trust" },
    "/api/v1/stock/peers": ["IVV", "VOO"],
    "/api/v1/stock/market-status": { exchange: "US", isOpen: false, session: "closed", t: 1783788000 },
    "/api/v1/stock/market-holiday": { exchange: "US", data: [] },
    "/api/v1/stock/metric": { symbol: "SPY", metric: { beta: 1 } }
  });
  const { client } = makeClient(routes);
  await client.getQuote("SPY");
  await client.search("SPY");
  await client.listSymbols("US");
  await client.getCompanyProfile("SPY");
  await client.getPeers("SPY");
  await client.getMarketStatus("US");
  await client.getMarketHolidays("US");
  await client.getBasicMetrics("SPY");
  const permittedPaths = new Set(Object.values(FINNHUB_ENDPOINTS).map((endpoint) => `/api/v1${endpoint}`));
  assert.equal(routes.calls.every((call) => permittedPaths.has(call.pathname)), true);
  assert.equal(routes.calls.length, 8);
});

test("Treasury parser selects the latest 13-week investment rate", () => {
  const result = normalizeTreasuryAuctionResponse({
    data: [
      {
        record_date: "2026-07-06",
        security_type: "Bill",
        security_term: "13-Week",
        auction_date: "2026-07-06",
        issue_date: "2026-07-09",
        high_investment_rate: "4.125"
      },
      {
        record_date: "2026-07-13",
        security_type: "Bill",
        security_term: "13-Week",
        auction_date: "2026-07-13",
        issue_date: "2026-07-16",
        high_investment_rate: "4.200"
      }
    ]
  });
  assert.equal(result.ratePercent, 4.2);
  assert.equal(result.rateDecimal, 0.042);
  assert.equal(result.auctionDate, "2026-07-13");
});

test("Treasury service uses stale cache and no fixed substitute", async () => {
  const entry = createCacheEntry({
    key: cacheKey("treasury-rate", "13-week-bill"),
    category: "TREASURY_RATE",
    source: "U.S. Treasury Fiscal Data",
    data: {
      instrument: "3-Month U.S. Treasury Bill",
      ratePercent: 4.1,
      rateDecimal: 0.041,
      auctionDate: "2026-07-06"
    },
    storedAt: "2026-07-09T14:00:00.000Z",
    ttlMs: 24 * 60 * 60 * 1000,
    staleAfterMs: 30 * 24 * 60 * 60 * 1000,
    provenance: { provider: "U.S. Treasury Fiscal Data", retrievedAt: "2026-07-09T14:00:00.000Z" }
  });
  const service = new RiskFreeRateService({
    cache: createMemoryLiveDataCache([entry]),
    fetchImpl: async () => fakeResponse(503, { error: { message: "unavailable" } }),
    now: () => "2026-07-11T14:00:00.000Z"
  });
  const result = await service.getCurrentRate({ forceRefresh: true });
  assert.equal(result.source, "cache");
  assert.equal(result.stale, true);
  assert.equal(result.data.rateDecimal, 0.041);
});

test("Treasury service can use an explicitly user-provided rate", async () => {
  const service = new RiskFreeRateService({
    cache: createMemoryLiveDataCache(),
    fetchImpl: async () => fakeResponse(503, { error: { message: "unavailable" } }),
    now: () => "2026-07-11T14:00:00.000Z",
    getManualRate: async () => 3.75
  });
  const result = await service.getCurrentRate({ forceRefresh: true });
  assert.equal(result.source, "manual");
  assert.equal(result.data.rateDecimal, 0.0375);
  assert.equal(result.data.userProvided, true);
});

test("Normalized errors and Diagnostics redact credentials", async () => {
  const error = normalizeLiveDataError(
    new Error("failed token=super-secret-value"),
    {
      endpoint: "https://finnhub.io/api/v1/quote?symbol=SPY&token=super-secret-value"
    }
  );
  assert.equal(JSON.stringify(error.toJSON()).includes("super-secret-value"), false);

  const diagnostics = new LiveDataDiagnostics({ requestQueue: new FakeQueue() });
  await diagnostics.record({
    provider: "Finnhub",
    endpoint: "/quote?token=super-secret-value",
    message: "api_key=super-secret-value"
  });
  const snapshot = await diagnostics.getSnapshot();
  assert.equal(JSON.stringify(snapshot).includes("super-secret-value"), false);
  assert.equal(snapshot.security.apiKeyExposed, false);
  assert.equal(snapshot.security.apiKeyLogged, false);
  assert.equal(Object.hasOwn(snapshot, "activeApiKey"), false);
});

test("Source modules contain no request implementation for the forbidden historical endpoint", async () => {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const sourceDir = path.resolve(currentDir, "../js/data");
  const files = [
    "finnhub-client.js",
    "market-data-service.js",
    "symbol-service.js",
    "risk-free-rate-service.js"
  ];
  for (const file of files) {
    const source = await readFile(path.join(sourceDir, file), "utf8");
    assert.equal(source.includes("/stock/candle"), false, `${file} contains forbidden endpoint text`);
  }
});

let passed = 0;
for (const item of tests) {
  try {
    await item.fn();
    passed += 1;
    console.log(`PASS ${item.name}`);
  } catch (error) {
    console.error(`FAIL ${item.name}`);
    console.error(error);
  }
}

console.log(`\n${passed}/${tests.length} tests passed.`);
if (passed !== tests.length) {
  process.exitCode = 1;
}
