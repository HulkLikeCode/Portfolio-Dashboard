import {
  LIVE_DATA_ERROR_CODES,
  LiveDataError,
  createHttpError,
  normalizeLiveDataError
} from "./live-data-errors.js";
import { PREDEFINED_FINNHUB_API_KEY } from "../config/finnhub.js";

export const FINNHUB_CLIENT_VERSION = "2.2-phase-2f";
export const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

export const FINNHUB_ENDPOINTS = Object.freeze({
  QUOTE: "/quote",
  SEARCH: "/search",
  SYMBOLS: "/stock/symbol",
  PROFILE: "/stock/profile2",
  PEERS: "/stock/peers",
  MARKET_STATUS: "/stock/market-status",
  MARKET_HOLIDAY: "/stock/market-holiday",
  METRIC: "/stock/metric"
});

export const FINNHUB_PRIORITIES = Object.freeze({
  HOLDING_QUOTE: 10,
  BENCHMARK_QUOTE: 20,
  OTHER_QUOTE: 30,
  SYMBOL_LOOKUP: 40,
  MARKET_CONTEXT: 50,
  PROFILE: 60,
  METRICS: 70,
  PEERS: 80
});

const PERMITTED_ENDPOINTS = new Set(Object.values(FINNHUB_ENDPOINTS));

/**
 * Finnhub client that requires the existing Phase 2A Request Queue.
 * There is intentionally no direct-fetch fallback when the queue is absent.
 */
export class FinnhubClient {
  constructor(options = {}) {
    this.fetchImpl = typeof options.fetchImpl === "function"
      ? options.fetchImpl
      : globalThis.fetch && globalThis.fetch.bind(globalThis);
    if (!this.fetchImpl) {
      throw new LiveDataError(
        LIVE_DATA_ERROR_CODES.TEMPORARILY_UNAVAILABLE,
        "Fetch is not available in this browser.",
        { scope: "browser-capability" }
      );
    }

    this.getApiKey = normalizeApiKeyProvider(options.getApiKey);
    this.enqueue = normalizeRequestQueue(options.requestQueue, options.queueAdapter);
    this.baseUrl = normalizeBaseUrl(options.baseUrl || FINNHUB_BASE_URL);
    this.timeoutMs = normalizePositiveNumber(options.timeoutMs, 15000, "timeoutMs");
    this.now = typeof options.now === "function" ? options.now : () => new Date().toISOString();
  }

  getQuote(symbol, options = {}) {
    const canonical = normalizeSymbol(symbol);
    return this.request(FINNHUB_ENDPOINTS.QUOTE, { symbol: canonical }, {
      ...options,
      priority: options.priority === undefined
        ? FINNHUB_PRIORITIES.OTHER_QUOTE
        : options.priority,
      requestType: "quote",
      symbol: canonical
    });
  }

  search(query, options = {}) {
    const normalizedQuery = normalizeSearchQuery(query);
    return this.request(FINNHUB_ENDPOINTS.SEARCH, { q: normalizedQuery }, {
      ...options,
      priority: options.priority === undefined
        ? FINNHUB_PRIORITIES.SYMBOL_LOOKUP
        : options.priority,
      requestType: "symbol-search"
    });
  }

  listSymbols(exchange = "US", options = {}) {
    const canonicalExchange = normalizeExchange(exchange);
    return this.request(FINNHUB_ENDPOINTS.SYMBOLS, { exchange: canonicalExchange }, {
      ...options,
      priority: options.priority === undefined
        ? FINNHUB_PRIORITIES.SYMBOL_LOOKUP
        : options.priority,
      requestType: "symbol-list"
    });
  }

  getCompanyProfile(symbol, options = {}) {
    const canonical = normalizeSymbol(symbol);
    return this.request(FINNHUB_ENDPOINTS.PROFILE, { symbol: canonical }, {
      ...options,
      priority: options.priority === undefined
        ? FINNHUB_PRIORITIES.PROFILE
        : options.priority,
      requestType: "company-profile",
      symbol: canonical
    });
  }

  getPeers(symbol, options = {}) {
    const canonical = normalizeSymbol(symbol);
    return this.request(FINNHUB_ENDPOINTS.PEERS, { symbol: canonical }, {
      ...options,
      priority: options.priority === undefined
        ? FINNHUB_PRIORITIES.PEERS
        : options.priority,
      requestType: "company-peers",
      symbol: canonical
    });
  }

  getMarketStatus(exchange = "US", options = {}) {
    const canonicalExchange = normalizeExchange(exchange);
    return this.request(FINNHUB_ENDPOINTS.MARKET_STATUS, {
      exchange: canonicalExchange
    }, {
      ...options,
      priority: options.priority === undefined
        ? FINNHUB_PRIORITIES.MARKET_CONTEXT
        : options.priority,
      requestType: "market-status"
    });
  }

  getMarketHolidays(exchange = "US", options = {}) {
    const canonicalExchange = normalizeExchange(exchange);
    return this.request(FINNHUB_ENDPOINTS.MARKET_HOLIDAY, {
      exchange: canonicalExchange
    }, {
      ...options,
      priority: options.priority === undefined
        ? FINNHUB_PRIORITIES.MARKET_CONTEXT
        : options.priority,
      requestType: "market-holidays"
    });
  }

  getBasicMetrics(symbol, metric = "all", options = {}) {
    const canonical = normalizeSymbol(symbol);
    const metricName = typeof metric === "string" && metric.trim()
      ? metric.trim()
      : "all";
    return this.request(FINNHUB_ENDPOINTS.METRIC, {
      symbol: canonical,
      metric: metricName
    }, {
      ...options,
      priority: options.priority === undefined
        ? FINNHUB_PRIORITIES.METRICS
        : options.priority,
      requestType: "basic-metrics",
      symbol: canonical
    });
  }

  async request(endpoint, params = {}, options = {}) {
    if (!PERMITTED_ENDPOINTS.has(endpoint)) {
      throw new LiveDataError(
        LIVE_DATA_ERROR_CODES.ENDPOINT_NOT_PERMITTED,
        "The requested Finnhub endpoint is not permitted by the MVP specification.",
        {
          scope: "finnhub",
          endpoint,
          details: { endpoint }
        }
      );
    }

    const apiKey = await this.getApiKey();
    if (typeof apiKey !== "string" || !apiKey.trim()) {
      throw new LiveDataError(
        LIVE_DATA_ERROR_CODES.API_KEY_MISSING,
        "Enter a Finnhub API key before refreshing live data.",
        {
          scope: "finnhub",
          endpoint,
          retryable: false
        }
      );
    }
    const runtimeApiKey = apiKey.trim();

    const priority = normalizePriority(options.priority);
    const metadata = Object.freeze({
      provider: "finnhub",
      endpoint,
      requestType: options.requestType || "live-data",
      symbol: options.symbol || null,
      priority
    });

    const execute = async () => {
      const url = buildRequestUrl(this.baseUrl, endpoint, params, runtimeApiKey);
      const abortContext = createAbortContext(options.signal, this.timeoutMs);
      try {
        const response = await this.fetchImpl(url, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: abortContext.signal,
          cache: "no-store",
          credentials: "omit"
        });
        const payload = await parseResponsePayload(response);

        if (!response.ok) {
          throw createHttpError(response, payload, {
            scope: "finnhub",
            endpoint
          });
        }

        const providerError = extractProviderError(payload);
        if (providerError) {
          throw normalizeLiveDataError(new Error(providerError), {
            scope: "finnhub",
            endpoint,
            status: inferProviderErrorStatus(providerError),
            responseMessage: providerError
          });
        }

        return {
          data: payload,
          provenance: {
            provider: "Finnhub",
            endpoint,
            retrievedAt: this.now()
          }
        };
      } catch (error) {
        throw normalizeLiveDataError(error, {
          scope: "finnhub",
          endpoint,
          details: {
            requestType: metadata.requestType,
            symbol: metadata.symbol
          }
        });
      } finally {
        abortContext.cleanup();
      }
    };

    try {
      return await this.enqueue(execute, {
        priority,
        metadata,
        label: `${metadata.requestType}${metadata.symbol ? `:${metadata.symbol}` : ""}`,
        retry: options.retry,
        signal: options.signal
      });
    } catch (error) {
      throw normalizeLiveDataError(error, {
        scope: "finnhub",
        endpoint,
        details: {
          requestType: metadata.requestType,
          symbol: metadata.symbol
        }
      });
    }
  }
}

export function createFinnhubClient(options = {}) {
  return new FinnhubClient(options);
}

export function normalizeSymbol(value) {
  if (typeof value !== "string") {
    throw new LiveDataError(
      LIVE_DATA_ERROR_CODES.INVALID_SYMBOL,
      "Ticker symbol must be text.",
      { scope: "validation" }
    );
  }
  const symbol = value.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9.\-]{0,19}$/.test(symbol)) {
    throw new LiveDataError(
      LIVE_DATA_ERROR_CODES.INVALID_SYMBOL,
      "Ticker symbol contains unsupported characters.",
      {
        scope: "validation",
        details: { symbol: value }
      }
    );
  }
  return symbol;
}

function normalizeRequestQueue(requestQueue, explicitAdapter) {
  if (typeof explicitAdapter === "function") {
    return (task, options) => explicitAdapter(requestQueue, task, options);
  }

  if (!requestQueue || typeof requestQueue !== "object" || Array.isArray(requestQueue)) {
    throw new LiveDataError(
      LIVE_DATA_ERROR_CODES.REQUEST_QUEUE_REQUIRED,
      "The existing Finnhub Request Queue is required.",
      { scope: "configuration" }
    );
  }

  for (const methodName of ["enqueue", "schedule"]) {
    if (typeof requestQueue[methodName] === "function") {
      return (task, options) => requestQueue[methodName](task, options);
    }
  }

  throw new LiveDataError(
    LIVE_DATA_ERROR_CODES.REQUEST_QUEUE_INVALID,
    "The Request Queue does not expose a supported enqueue method.",
    {
      scope: "configuration",
      details: {
        acceptedMethods: ["enqueue", "schedule"]
      }
    }
  );
}

function normalizeApiKeyProvider(provider) {
  return typeof provider === "function"
    ? provider
    : () => PREDEFINED_FINNHUB_API_KEY;
}

function buildRequestUrl(baseUrl, endpoint, params, apiKey) {
  const url = new URL(`${baseUrl}${endpoint}`);
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  url.searchParams.set("token", apiKey);
  return url.toString();
}

async function parseResponsePayload(response) {
  const contentType = response.headers && typeof response.headers.get === "function"
    ? response.headers.get("Content-Type") || ""
    : "";
  if (contentType.toLowerCase().includes("application/json")) {
    try {
      return await response.json();
    } catch (_error) {
      return null;
    }
  }
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (_error) {
    return text;
  }
}

function extractProviderError(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "";
  }
  if (typeof payload.error === "string" && payload.error.trim()) {
    return payload.error.trim();
  }
  return "";
}

function inferProviderErrorStatus(message) {
  const lower = String(message).toLowerCase();
  if (lower.includes("limit") || lower.includes("too many")) {
    return 429;
  }
  if (lower.includes("api key") || lower.includes("token")) {
    return 401;
  }
  if (lower.includes("premium") || lower.includes("access denied") || lower.includes("forbidden")) {
    return 403;
  }
  return null;
}

function createAbortContext(externalSignal, timeoutMs) {
  if (typeof AbortController !== "function") {
    return {
      signal: externalSignal,
      cleanup() {}
    };
  }

  const controller = new AbortController();
  const abortFromExternal = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else if (typeof externalSignal.addEventListener === "function") {
      externalSignal.addEventListener("abort", abortFromExternal, { once: true });
    }
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timer);
      if (externalSignal && typeof externalSignal.removeEventListener === "function") {
        externalSignal.removeEventListener("abort", abortFromExternal);
      }
    }
  };
}

function normalizeSearchQuery(value) {
  if (typeof value !== "string" || value.trim().length < 1) {
    throw new LiveDataError(
      LIVE_DATA_ERROR_CODES.INVALID_ARGUMENT,
      "Enter a ticker or company name to search.",
      { scope: "validation" }
    );
  }
  return value.trim().slice(0, 100);
}

function normalizeExchange(value) {
  if (typeof value !== "string" || !/^[A-Z]{2,10}$/i.test(value.trim())) {
    throw new LiveDataError(
      LIVE_DATA_ERROR_CODES.INVALID_ARGUMENT,
      "Exchange code is invalid.",
      { scope: "validation" }
    );
  }
  return value.trim().toUpperCase();
}

function normalizeBaseUrl(value) {
  const text = String(value || "").replace(/\/+$/, "");
  const url = new URL(text);
  if (url.protocol !== "https:") {
    throw new TypeError("Finnhub base URL must use HTTPS.");
  }
  return text;
}

function normalizePriority(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new TypeError("Request priority must be a finite number.");
  }
  return number;
}

function normalizePositiveNumber(value, fallback, field) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new TypeError(`${field} must be a positive finite number.`);
  }
  return number;
}
