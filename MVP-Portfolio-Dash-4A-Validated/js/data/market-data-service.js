import {
  FINNHUB_PRIORITIES,
  normalizeSymbol
} from "./finnhub-client.js";
import {
  LIVE_DATA_ERROR_CODES,
  LIVE_DATA_STATES,
  LiveDataError,
  normalizeLiveDataError,
  sanitizeDiagnosticError
} from "./live-data-errors.js";
import {
  cacheKey,
  createCacheEntry,
  evaluateCacheEntry,
  resolveCachePolicy
} from "./cache-policy.js";
import {
  safeCacheRead,
  safeCacheWrite
} from "./live-data-cache.js";

export const MARKET_DATA_SERVICE_VERSION = "2.2-phase-2f";
export const MAX_ACTIVE_SYMBOLS = 25;

export class MarketDataService {
  constructor(options = {}) {
    if (!options.client || typeof options.client.getQuote !== "function") {
      throw new TypeError("A FinnhubClient instance is required.");
    }
    if (!options.cache
        || typeof options.cache.get !== "function"
        || typeof options.cache.put !== "function") {
      throw new TypeError("An IndexedDB-backed live-data cache adapter is required.");
    }

    this.client = options.client;
    this.cache = options.cache;
    this.now = typeof options.now === "function"
      ? options.now
      : () => new Date().toISOString();
    this.recordDiagnostic = typeof options.recordDiagnostic === "function"
      ? options.recordDiagnostic
      : async () => {};
    this.policyOverrides = options.policyOverrides || {};
  }

  async getQuote(symbol, options = {}) {
    const canonical = normalizeSymbol(symbol);
    const role = normalizeRole(options.role);
    const priority = options.priority === undefined
      ? priorityForRole(role)
      : options.priority;

    return this._cacheThenFetch({
      category: "QUOTE",
      cacheKey: cacheKey("quote", canonical),
      symbol: canonical,
      endpoint: "/quote",
      forceRefresh: Boolean(options.forceRefresh),
      preferFreshCache: Boolean(options.preferFreshCache),
      fetcher: () => this.client.getQuote(canonical, {
        priority,
        signal: options.signal
      }),
      normalize: normalizeQuote,
      stateWhenAvailable: options.hasLocalHistory === false
        ? LIVE_DATA_STATES.QUOTE_ONLY
        : LIVE_DATA_STATES.AVAILABLE,
      role
    });
  }

  async refreshQuotes(activeSymbols, options = {}) {
    const items = normalizeActiveSymbols(activeSymbols);
    if (items.length > MAX_ACTIVE_SYMBOLS) {
      throw new LiveDataError(
        LIVE_DATA_ERROR_CODES.ACTIVE_SYMBOL_LIMIT,
        `No more than ${MAX_ACTIVE_SYMBOLS} active symbols may be refreshed.`,
        {
          scope: "validation",
          details: {
            activeSymbolCount: items.length,
            limit: MAX_ACTIVE_SYMBOLS
          }
        }
      );
    }

    const ordered = items.slice().sort(compareSymbolPriority);
    const startedAt = this.now();
    const settled = await Promise.all(ordered.map(async (item) => {
      try {
        const result = await this.getQuote(item.symbol, {
          role: item.role,
          hasLocalHistory: item.hasLocalHistory,
          forceRefresh: options.forceRefresh !== false,
          signal: options.signal
        });
        return { status: "fulfilled", symbol: item.symbol, value: result };
      } catch (error) {
        const normalized = normalizeLiveDataError(error, {
          scope: "finnhub",
          endpoint: "/quote",
          details: { symbol: item.symbol }
        });
        await this._recordError(normalized, { symbol: item.symbol });
        return { status: "rejected", symbol: item.symbol, reason: normalized.toJSON() };
      }
    }));

    const results = {};
    const errors = [];
    for (const item of settled) {
      if (item.status === "fulfilled") {
        results[item.symbol] = item.value;
        if (item.value.data === null) {
          errors.push({
            symbol: item.symbol,
            error: item.value.error || {
              code: LIVE_DATA_ERROR_CODES.QUOTE_UNAVAILABLE,
              message: "No usable quote snapshot was returned."
            }
          });
        }
      } else {
        errors.push({ symbol: item.symbol, error: item.reason });
      }
    }

    const availableCount = Object.values(results)
      .filter((result) => result.data !== null).length;
    return {
      category: "quote-refresh",
      startedAt,
      completedAt: this.now(),
      requestedCount: ordered.length,
      availableCount,
      failedCount: errors.length,
      symbols: ordered.map((item) => item.symbol),
      results,
      errors
    };
  }

  getCompanyProfile(symbol, options = {}) {
    const canonical = normalizeSymbol(symbol);
    return this._cacheThenFetch({
      category: "COMPANY_PROFILE",
      cacheKey: cacheKey("profile", canonical),
      symbol: canonical,
      endpoint: "/stock/profile2",
      forceRefresh: Boolean(options.forceRefresh),
      preferFreshCache: options.preferFreshCache !== false,
      fetcher: () => this.client.getCompanyProfile(canonical, {
        priority: options.priority === undefined
          ? FINNHUB_PRIORITIES.PROFILE
          : options.priority,
        signal: options.signal
      }),
      normalize: normalizeCompanyProfile
    });
  }

  getPeers(symbol, options = {}) {
    const canonical = normalizeSymbol(symbol);
    return this._cacheThenFetch({
      category: "COMPANY_PEERS",
      cacheKey: cacheKey("peers", canonical),
      symbol: canonical,
      endpoint: "/stock/peers",
      forceRefresh: Boolean(options.forceRefresh),
      preferFreshCache: options.preferFreshCache !== false,
      fetcher: () => this.client.getPeers(canonical, {
        priority: options.priority === undefined
          ? FINNHUB_PRIORITIES.PEERS
          : options.priority,
        signal: options.signal
      }),
      normalize: (payload) => normalizePeers(payload, canonical)
    });
  }

  getBasicMetrics(symbol, options = {}) {
    const canonical = normalizeSymbol(symbol);
    const metric = typeof options.metric === "string" && options.metric.trim()
      ? options.metric.trim()
      : "all";
    return this._cacheThenFetch({
      category: "BASIC_METRICS",
      cacheKey: cacheKey("metrics", canonical, metric),
      symbol: canonical,
      endpoint: "/stock/metric",
      forceRefresh: Boolean(options.forceRefresh),
      preferFreshCache: options.preferFreshCache !== false,
      fetcher: () => this.client.getBasicMetrics(canonical, metric, {
        priority: options.priority === undefined
          ? FINNHUB_PRIORITIES.METRICS
          : options.priority,
        signal: options.signal
      }),
      normalize: (payload) => normalizeBasicMetrics(payload, canonical, metric)
    });
  }

  getMarketStatus(exchange = "US", options = {}) {
    const canonicalExchange = String(exchange || "US").trim().toUpperCase();
    return this._cacheThenFetch({
      category: "MARKET_STATUS",
      cacheKey: cacheKey("market-status", canonicalExchange),
      endpoint: "/stock/market-status",
      forceRefresh: Boolean(options.forceRefresh),
      preferFreshCache: options.preferFreshCache !== false,
      fetcher: () => this.client.getMarketStatus(canonicalExchange, {
        priority: options.priority === undefined
          ? FINNHUB_PRIORITIES.MARKET_CONTEXT
          : options.priority,
        signal: options.signal
      }),
      normalize: (payload) => normalizeMarketStatus(payload, canonicalExchange)
    });
  }

  getMarketHolidays(exchange = "US", options = {}) {
    const canonicalExchange = String(exchange || "US").trim().toUpperCase();
    return this._cacheThenFetch({
      category: "MARKET_HOLIDAYS",
      cacheKey: cacheKey("market-holidays", canonicalExchange),
      endpoint: "/stock/market-holiday",
      forceRefresh: Boolean(options.forceRefresh),
      preferFreshCache: options.preferFreshCache !== false,
      fetcher: () => this.client.getMarketHolidays(canonicalExchange, {
        priority: options.priority === undefined
          ? FINNHUB_PRIORITIES.MARKET_CONTEXT
          : options.priority,
        signal: options.signal
      }),
      normalize: (payload) => normalizeMarketHolidays(payload, canonicalExchange)
    });
  }

  async getCompanyContext(symbol, options = {}) {
    const profile = await this.getCompanyProfile(symbol, options);
    const metrics = await this.getBasicMetrics(symbol, options);
    const peers = options.includePeers
      ? await this.getPeers(symbol, options)
      : null;
    return {
      symbol: normalizeSymbol(symbol),
      profile,
      metrics,
      peers,
      peerDataOnDemand: !options.includePeers
    };
  }

  async _cacheThenFetch(config) {
    const policy = resolveCachePolicy(
      config.category,
      this.policyOverrides[config.category] || {}
    );
    const cacheRead = await safeCacheRead(this.cache, config.cacheKey, {
      endpoint: config.endpoint
    });
    const cacheStatus = evaluateCacheEntry(cacheRead.entry, {
      now: this.now(),
      ...policy
    });
    const warnings = [];
    if (cacheRead.error) {
      warnings.push(cacheRead.error.toJSON());
      await this._recordError(cacheRead.error, {
        cacheKey: config.cacheKey,
        symbol: config.symbol || null
      });
    }

    if (!config.forceRefresh
        && config.preferFreshCache
        && cacheStatus.fresh
        && cacheRead.entry) {
      return buildResult({
        data: clonePlain(cacheRead.entry.data),
        source: "cache",
        state: config.stateWhenAvailable || LIVE_DATA_STATES.AVAILABLE,
        stale: false,
        cacheStatus,
        provenance: cacheRead.entry.provenance,
        warnings,
        error: null
      });
    }

    try {
      const liveResponse = await config.fetcher();
      const normalizedData = config.normalize(liveResponse.data);
      const storedAt = this.now();
      const entry = createCacheEntry({
        key: config.cacheKey,
        category: config.category,
        symbol: config.symbol,
        source: "Finnhub",
        data: normalizedData,
        storedAt,
        ttlMs: policy.ttlMs,
        staleAfterMs: policy.staleAfterMs,
        provenance: liveResponse.provenance
      });
      const cacheWrite = await safeCacheWrite(this.cache, entry, {
        endpoint: config.endpoint
      });
      if (cacheWrite.error) {
        warnings.push(cacheWrite.error.toJSON());
        await this._recordError(cacheWrite.error, {
          cacheKey: config.cacheKey,
          symbol: config.symbol || null
        });
      }

      await this._recordSuccess({
        endpoint: config.endpoint,
        symbol: config.symbol || null,
        source: "live",
        retrievedAt: liveResponse.provenance && liveResponse.provenance.retrievedAt
      });

      return buildResult({
        data: normalizedData,
        source: "live",
        state: config.stateWhenAvailable || LIVE_DATA_STATES.AVAILABLE,
        stale: false,
        cacheStatus: evaluateCacheEntry(entry, { now: storedAt, ...policy }),
        provenance: liveResponse.provenance,
        warnings,
        error: null
      });
    } catch (error) {
      const normalized = normalizeLiveDataError(error, {
        scope: "finnhub",
        endpoint: config.endpoint,
        cachedDataUsed: cacheStatus.usable,
        details: {
          symbol: config.symbol || null,
          cacheKey: config.cacheKey
        }
      });
      await this._recordError(normalized, {
        cacheKey: config.cacheKey,
        symbol: config.symbol || null
      });

      if (cacheStatus.usable && cacheRead.entry) {
        const cachedError = normalizeLiveDataError(normalized, {
          cachedDataUsed: true
        });
        return buildResult({
          data: clonePlain(cacheRead.entry.data),
          source: "cache",
          state: LIVE_DATA_STATES.STALE,
          stale: true,
          cacheStatus,
          provenance: cacheRead.entry.provenance,
          warnings,
          error: cachedError.toJSON()
        });
      }

      return buildResult({
        data: null,
        source: "none",
        state: normalized.availability,
        stale: false,
        cacheStatus,
        provenance: null,
        warnings,
        error: normalized.toJSON()
      });
    }
  }

  async _recordError(error, details = {}) {
    try {
      await this.recordDiagnostic({
        ...sanitizeDiagnosticError(error, { occurredAt: this.now() }),
        details: {
          ...clonePlain(error.details || {}),
          ...clonePlain(details)
        }
      });
    } catch (_error) {
      // Diagnostics must never break live-data delivery.
    }
  }

  async _recordSuccess(details) {
    try {
      await this.recordDiagnostic({
        category: "live-data-request",
        status: "success",
        occurredAt: this.now(),
        provider: "Finnhub",
        endpoint: details.endpoint,
        symbol: details.symbol,
        source: details.source,
        retrievedAt: details.retrievedAt || null
      });
    } catch (_error) {
      // Diagnostics must never break live-data delivery.
    }
  }
}

export function createMarketDataService(options = {}) {
  return new MarketDataService(options);
}

export function normalizeQuote(payload) {
  if (!payload || typeof payload !== "object") {
    throw invalidResponse("Quote response is not an object.", "/quote");
  }
  const currentPrice = finiteNumber(payload.c);
  const previousClose = finiteNumber(payload.pc);
  const timestampSeconds = finiteNumber(payload.t);
  if (!(currentPrice > 0) || !(previousClose > 0) || !(timestampSeconds > 0)) {
    throw new LiveDataError(
      LIVE_DATA_ERROR_CODES.QUOTE_UNAVAILABLE,
      "Finnhub did not return a usable quote snapshot.",
      {
        scope: "finnhub",
        endpoint: "/quote",
        details: {
          hasCurrentPrice: currentPrice > 0,
          hasPreviousClose: previousClose > 0,
          hasTimestamp: timestampSeconds > 0
        }
      }
    );
  }

  return {
    currentPrice,
    change: finiteNumberOrNull(payload.d),
    percentChange: finiteNumberOrNull(payload.dp),
    high: positiveNumberOrNull(payload.h),
    low: positiveNumberOrNull(payload.l),
    open: positiveNumberOrNull(payload.o),
    previousClose,
    marketTimestampEpochSeconds: timestampSeconds,
    marketTimestamp: new Date(timestampSeconds * 1000).toISOString(),
    quoteType: "snapshot"
  };
}

export function normalizeCompanyProfile(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw invalidResponse("Company profile response is invalid.", "/stock/profile2");
  }
  if (Object.keys(payload).length === 0) {
    throw new LiveDataError(
      LIVE_DATA_ERROR_CODES.NOT_FOUND,
      "No company profile was returned for this symbol.",
      { scope: "finnhub", endpoint: "/stock/profile2" }
    );
  }
  return {
    country: textOrNull(payload.country),
    currency: textOrNull(payload.currency),
    exchange: textOrNull(payload.exchange),
    industry: textOrNull(payload.finnhubIndustry),
    ipoDate: textOrNull(payload.ipo),
    logoUrl: httpsUrlOrNull(payload.logo),
    marketCapitalization: finiteNumberOrNull(payload.marketCapitalization),
    name: textOrNull(payload.name),
    phone: textOrNull(payload.phone),
    sharesOutstanding: finiteNumberOrNull(payload.shareOutstanding),
    ticker: textOrNull(payload.ticker),
    websiteUrl: httpsUrlOrNull(payload.weburl)
  };
}

export function normalizePeers(payload, symbol) {
  if (!Array.isArray(payload)) {
    throw invalidResponse("Peer response is not an array.", "/stock/peers");
  }
  const peers = Array.from(new Set(payload
    .filter((item) => typeof item === "string")
    .map((item) => item.trim().toUpperCase())
    .filter((item) => item && item !== symbol)));
  return {
    symbol,
    peers,
    peerCount: peers.length,
    contextOnly: true
  };
}

export function normalizeBasicMetrics(payload, symbol, metricName) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw invalidResponse("Metric response is invalid.", "/stock/metric");
  }
  const metric = payload.metric && typeof payload.metric === "object"
    ? clonePlain(payload.metric)
    : {};
  const series = payload.series && typeof payload.series === "object"
    ? clonePlain(payload.series)
    : {};
  return {
    symbol: textOrNull(payload.symbol) || symbol,
    metricName,
    metric,
    series,
    contextOnly: true,
    portfolioAnalyticsSubstitute: false,
    dividendValuesIncomeEligible: false
  };
}

export function normalizeMarketStatus(payload, exchange) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw invalidResponse("Market-status response is invalid.", "/stock/market-status");
  }
  return {
    exchange: textOrNull(payload.exchange) || exchange,
    isOpen: Boolean(payload.isOpen),
    session: textOrNull(payload.session),
    timezone: textOrNull(payload.timezone),
    timestampEpochSeconds: finiteNumberOrNull(payload.t),
    timestamp: finiteNumberOrNull(payload.t) === null
      ? null
      : new Date(Number(payload.t) * 1000).toISOString(),
    holiday: textOrNull(payload.holiday)
  };
}

export function normalizeMarketHolidays(payload, exchange) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw invalidResponse("Market-holiday response is invalid.", "/stock/market-holiday");
  }
  const data = Array.isArray(payload.data) ? payload.data : [];
  return {
    exchange: textOrNull(payload.exchange) || exchange,
    timezone: textOrNull(payload.timezone),
    holidays: data.map((item) => ({
      eventName: textOrNull(item && item.eventName),
      date: textOrNull(item && item.atDate) || textOrNull(item && item.date),
      tradingHour: textOrNull(item && item.tradingHour),
      atTradingHour: Boolean(item && item.atTradingHour)
    }))
  };
}

function buildResult(input) {
  return {
    data: clonePlain(input.data),
    source: input.source,
    availability: input.state,
    stale: Boolean(input.stale),
    cache: {
      present: input.cacheStatus.present,
      fresh: input.cacheStatus.fresh,
      usable: input.cacheStatus.usable,
      ageMs: input.cacheStatus.ageMs,
      storedAt: input.cacheStatus.storedAt,
      expiresAt: input.cacheStatus.expiresAt,
      staleAfter: input.cacheStatus.staleAfter
    },
    provenance: clonePlain(input.provenance),
    warnings: clonePlain(input.warnings || []),
    error: clonePlain(input.error)
  };
}

function normalizeActiveSymbols(values) {
  if (!Array.isArray(values)) {
    throw new LiveDataError(
      LIVE_DATA_ERROR_CODES.INVALID_ARGUMENT,
      "Active symbols must be provided as an array.",
      { scope: "validation" }
    );
  }
  const seen = new Set();
  const items = [];
  for (const value of values) {
    const item = typeof value === "string"
      ? { symbol: value, role: "other", active: true }
      : value || {};
    if (item.active === false) {
      continue;
    }
    const symbol = normalizeSymbol(item.symbol);
    if (seen.has(symbol)) {
      continue;
    }
    seen.add(symbol);
    items.push({
      symbol,
      role: normalizeRole(item.role),
      hasLocalHistory: item.hasLocalHistory
    });
  }
  return items;
}

function compareSymbolPriority(a, b) {
  const roleOrder = { holding: 0, benchmark: 1, other: 2 };
  const difference = roleOrder[a.role] - roleOrder[b.role];
  return difference || a.symbol.localeCompare(b.symbol);
}

function normalizeRole(value) {
  const role = String(value || "other").toLowerCase();
  return role === "holding" || role === "benchmark" ? role : "other";
}

function priorityForRole(role) {
  if (role === "holding") {
    return FINNHUB_PRIORITIES.HOLDING_QUOTE;
  }
  if (role === "benchmark") {
    return FINNHUB_PRIORITIES.BENCHMARK_QUOTE;
  }
  return FINNHUB_PRIORITIES.OTHER_QUOTE;
}

function invalidResponse(message, endpoint) {
  return new LiveDataError(
    LIVE_DATA_ERROR_CODES.INVALID_RESPONSE,
    message,
    { scope: "finnhub", endpoint }
  );
}

function finiteNumber(value) {
  return Number(value);
}

function finiteNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function positiveNumberOrNull(value) {
  const number = finiteNumberOrNull(value);
  return number !== null && number > 0 ? number : null;
}

function textOrNull(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function httpsUrlOrNull(value) {
  const text = textOrNull(value);
  if (!text) {
    return null;
  }
  try {
    const url = new URL(text);
    return url.protocol === "https:" ? url.toString() : null;
  } catch (_error) {
    return null;
  }
}

function clonePlain(value) {
  if (value === null || value === undefined) {
    return value;
  }
  return JSON.parse(JSON.stringify(value));
}
