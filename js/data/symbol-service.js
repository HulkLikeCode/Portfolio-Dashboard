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
import { safeCacheRead, safeCacheWrite } from "./live-data-cache.js";

export const SYMBOL_SERVICE_VERSION = "2.2-phase-2f";

export class SymbolService {
  constructor(options = {}) {
    if (!options.client
        || typeof options.client.search !== "function"
        || typeof options.client.listSymbols !== "function") {
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
    this.getHistoricalStatus = typeof options.getHistoricalStatus === "function"
      ? options.getHistoricalStatus
      : null;
    this.policyOverrides = options.policyOverrides || {};
  }

  async search(query, options = {}) {
    const normalizedQuery = normalizeQuery(query);
    const key = cacheKey("symbol-search", normalizedQuery);
    const policy = resolveCachePolicy(
      "SYMBOL_SEARCH",
      this.policyOverrides.SYMBOL_SEARCH || {}
    );
    const cacheRead = await safeCacheRead(this.cache, key, { endpoint: "/search" });
    const status = evaluateCacheEntry(cacheRead.entry, { now: this.now(), ...policy });
    const warnings = cacheRead.error ? [cacheRead.error.toJSON()] : [];

    if (!options.forceRefresh && status.fresh && cacheRead.entry) {
      return this._withHistoricalAvailability(cacheRead.entry.data, {
        source: "cache",
        stale: false,
        cacheStatus: status,
        warnings
      });
    }

    try {
      const response = await this.client.search(normalizedQuery, {
        priority: options.priority === undefined
          ? FINNHUB_PRIORITIES.SYMBOL_LOOKUP
          : options.priority,
        signal: options.signal
      });
      const data = normalizeSearchResults(response.data, normalizedQuery);
      const entry = createCacheEntry({
        key,
        category: "SYMBOL_SEARCH",
        source: "Finnhub",
        data,
        storedAt: this.now(),
        ttlMs: policy.ttlMs,
        staleAfterMs: policy.staleAfterMs,
        provenance: response.provenance
      });
      const write = await safeCacheWrite(this.cache, entry, { endpoint: "/search" });
      if (write.error) {
        warnings.push(write.error.toJSON());
        await this._recordError(write.error, { cacheKey: key });
      }
      return this._withHistoricalAvailability(data, {
        source: "live",
        stale: false,
        cacheStatus: evaluateCacheEntry(entry, { now: this.now(), ...policy }),
        warnings,
        provenance: response.provenance
      });
    } catch (error) {
      const normalized = normalizeLiveDataError(error, {
        scope: "finnhub",
        endpoint: "/search",
        cachedDataUsed: status.usable,
        details: { query: normalizedQuery }
      });
      await this._recordError(normalized, { query: normalizedQuery });
      if (status.usable && cacheRead.entry) {
        return this._withHistoricalAvailability(cacheRead.entry.data, {
          source: "cache",
          stale: true,
          cacheStatus: status,
          warnings,
          error: normalizeLiveDataError(normalized, {
            cachedDataUsed: true
          }).toJSON()
        });
      }
      return {
        query: normalizedQuery,
        matches: [],
        count: 0,
        source: "none",
        availability: normalized.availability,
        stale: false,
        warnings,
        error: normalized.toJSON(),
        cache: serializeCacheStatus(status)
      };
    }
  }

  async listUsSymbols(options = {}) {
    const exchange = "US";
    const key = cacheKey("symbol-list", exchange);
    const policy = resolveCachePolicy(
      "SYMBOL_LIST",
      this.policyOverrides.SYMBOL_LIST || {}
    );
    const cacheRead = await safeCacheRead(this.cache, key, {
      endpoint: "/stock/symbol"
    });
    const status = evaluateCacheEntry(cacheRead.entry, { now: this.now(), ...policy });
    const warnings = cacheRead.error ? [cacheRead.error.toJSON()] : [];

    if (!options.forceRefresh && status.fresh && cacheRead.entry) {
      return buildListResult(cacheRead.entry.data, "cache", false, status, warnings, null);
    }

    try {
      const response = await this.client.listSymbols(exchange, {
        priority: options.priority === undefined
          ? FINNHUB_PRIORITIES.SYMBOL_LOOKUP
          : options.priority,
        signal: options.signal
      });
      const symbols = normalizeSymbolList(response.data);
      const entry = createCacheEntry({
        key,
        category: "SYMBOL_LIST",
        source: "Finnhub",
        data: symbols,
        storedAt: this.now(),
        ttlMs: policy.ttlMs,
        staleAfterMs: policy.staleAfterMs,
        provenance: response.provenance
      });
      const write = await safeCacheWrite(this.cache, entry, {
        endpoint: "/stock/symbol"
      });
      if (write.error) {
        warnings.push(write.error.toJSON());
      }
      return buildListResult(
        symbols,
        "live",
        false,
        evaluateCacheEntry(entry, { now: this.now(), ...policy }),
        warnings,
        null,
        response.provenance
      );
    } catch (error) {
      const normalized = normalizeLiveDataError(error, {
        scope: "finnhub",
        endpoint: "/stock/symbol",
        cachedDataUsed: status.usable
      });
      await this._recordError(normalized, {});
      if (status.usable && cacheRead.entry) {
        return buildListResult(
          cacheRead.entry.data,
          "cache",
          true,
          status,
          warnings,
          normalizeLiveDataError(normalized, { cachedDataUsed: true }).toJSON()
        );
      }
      return buildListResult([], "none", false, status, warnings, normalized.toJSON());
    }
  }

  async validateSymbol(symbol, options = {}) {
    const canonical = normalizeSymbol(symbol);
    const searchResult = await this.search(canonical, options);
    const exact = searchResult.matches.find((item) => item.symbol === canonical) || null;
    if (!exact) {
      return {
        symbol: canonical,
        valid: false,
        availability: searchResult.availability,
        quoteOnly: false,
        match: null,
        source: searchResult.source,
        stale: searchResult.stale,
        error: searchResult.error
      };
    }

    const historical = await this._historicalStatus(canonical);
    const hasLocalHistory = historical === null
      ? null
      : Boolean(historical.available || historical.state === "available");
    return {
      symbol: canonical,
      valid: true,
      availability: hasLocalHistory === false
        ? LIVE_DATA_STATES.QUOTE_ONLY
        : LIVE_DATA_STATES.AVAILABLE,
      quoteOnly: hasLocalHistory === false,
      match: exact,
      historicalStatus: historical,
      source: searchResult.source,
      stale: searchResult.stale,
      error: searchResult.error
    };
  }

  async _withHistoricalAvailability(data, context) {
    const matches = [];
    for (const match of data.matches || []) {
      const historical = await this._historicalStatus(match.symbol);
      const hasLocalHistory = historical === null
        ? null
        : Boolean(historical.available || historical.state === "available");
      matches.push({
        ...match,
        quoteOnly: hasLocalHistory === false,
        availability: hasLocalHistory === false
          ? LIVE_DATA_STATES.QUOTE_ONLY
          : LIVE_DATA_STATES.AVAILABLE,
        historicalStatus: historical
      });
    }
    return {
      query: data.query,
      matches,
      count: matches.length,
      source: context.source,
      availability: context.stale
        ? LIVE_DATA_STATES.STALE
        : LIVE_DATA_STATES.AVAILABLE,
      stale: context.stale,
      cache: serializeCacheStatus(context.cacheStatus),
      provenance: context.provenance || null,
      warnings: context.warnings || [],
      error: context.error || null
    };
  }

  async _historicalStatus(symbol) {
    if (!this.getHistoricalStatus) {
      return null;
    }
    try {
      return clonePlain(await this.getHistoricalStatus(symbol));
    } catch (_error) {
      return null;
    }
  }

  async _recordError(error, details) {
    try {
      await this.recordDiagnostic({
        ...sanitizeDiagnosticError(error, { occurredAt: this.now() }),
        details: {
          ...clonePlain(error.details || {}),
          ...clonePlain(details || {})
        }
      });
    } catch (_error) {
      // Diagnostics must not break symbol lookup.
    }
  }
}

export function createSymbolService(options = {}) {
  return new SymbolService(options);
}

export function normalizeSearchResults(payload, query) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.result)) {
    throw new LiveDataError(
      LIVE_DATA_ERROR_CODES.INVALID_RESPONSE,
      "Finnhub symbol-search response is invalid.",
      { scope: "finnhub", endpoint: "/search" }
    );
  }
  const matches = payload.result
    .map(normalizeSearchMatch)
    .filter(Boolean)
    .filter((item) => isSupportedUsCandidate(item));
  return {
    query,
    matches,
    count: matches.length
  };
}

export function normalizeSymbolList(payload) {
  if (!Array.isArray(payload)) {
    throw new LiveDataError(
      LIVE_DATA_ERROR_CODES.INVALID_RESPONSE,
      "Finnhub symbol-list response is invalid.",
      { scope: "finnhub", endpoint: "/stock/symbol" }
    );
  }
  return payload
    .map(normalizeListItem)
    .filter(Boolean)
    .filter((item) => isSupportedUsCandidate(item));
}

function normalizeSearchMatch(item) {
  if (!item || typeof item !== "object") {
    return null;
  }
  const rawSymbol = text(item.symbol);
  if (!rawSymbol) {
    return null;
  }
  let symbol;
  try {
    symbol = normalizeSymbol(rawSymbol);
  } catch (_error) {
    return null;
  }
  return {
    symbol,
    displaySymbol: text(item.displaySymbol) || symbol,
    description: text(item.description),
    type: text(item.type),
    primary: Boolean(item.isPrimary)
  };
}

function normalizeListItem(item) {
  if (!item || typeof item !== "object") {
    return null;
  }
  let symbol;
  try {
    symbol = normalizeSymbol(text(item.symbol));
  } catch (_error) {
    return null;
  }
  return {
    symbol,
    displaySymbol: text(item.displaySymbol) || symbol,
    description: text(item.description),
    type: text(item.type),
    currency: text(item.currency),
    mic: text(item.mic),
    figi: text(item.figi),
    shareClassFigi: text(item.shareClassFIGI),
    primary: Boolean(item.isPrimary)
  };
}

function isSupportedUsCandidate(item) {
  const type = String(item.type || "").toUpperCase();
  if (!type) {
    return true;
  }
  return !type.includes("CRYPTO") && !type.includes("FOREX");
}

function buildListResult(data, source, stale, cacheStatus, warnings, error, provenance = null) {
  return {
    exchange: "US",
    symbols: clonePlain(data || []),
    count: Array.isArray(data) ? data.length : 0,
    source,
    availability: stale
      ? LIVE_DATA_STATES.STALE
      : error && source === "none"
        ? error.availability || LIVE_DATA_STATES.ERROR
        : LIVE_DATA_STATES.AVAILABLE,
    stale,
    cache: serializeCacheStatus(cacheStatus),
    provenance,
    warnings: clonePlain(warnings || []),
    error: clonePlain(error)
  };
}

function serializeCacheStatus(status) {
  return {
    present: Boolean(status && status.present),
    fresh: Boolean(status && status.fresh),
    usable: Boolean(status && status.usable),
    ageMs: status && status.ageMs !== undefined ? status.ageMs : null,
    storedAt: status && status.storedAt || null,
    expiresAt: status && status.expiresAt || null,
    staleAfter: status && status.staleAfter || null
  };
}

function normalizeQuery(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new LiveDataError(
      LIVE_DATA_ERROR_CODES.INVALID_ARGUMENT,
      "Enter a ticker or company name to search.",
      { scope: "validation" }
    );
  }
  return value.trim().slice(0, 100);
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function clonePlain(value) {
  if (value === null || value === undefined) {
    return value;
  }
  return JSON.parse(JSON.stringify(value));
}
