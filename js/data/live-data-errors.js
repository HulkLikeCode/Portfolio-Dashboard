/**
 * Phase 2F normalized live-data errors.
 *
 * These errors are safe for Diagnostics and user-facing state mapping. They
 * never retain API keys or unredacted request URLs.
 */

export const LIVE_DATA_ERROR_CODES = Object.freeze({
  INVALID_ARGUMENT: "LIVE_DATA_INVALID_ARGUMENT",
  INVALID_SYMBOL: "LIVE_DATA_INVALID_SYMBOL",
  ACTIVE_SYMBOL_LIMIT: "LIVE_DATA_ACTIVE_SYMBOL_LIMIT",
  API_KEY_MISSING: "FINNHUB_API_KEY_MISSING",
  API_KEY_INVALID: "FINNHUB_API_KEY_INVALID",
  REQUEST_QUEUE_REQUIRED: "FINNHUB_REQUEST_QUEUE_REQUIRED",
  REQUEST_QUEUE_INVALID: "FINNHUB_REQUEST_QUEUE_INVALID",
  ENDPOINT_NOT_PERMITTED: "FINNHUB_ENDPOINT_NOT_PERMITTED",
  RATE_LIMITED: "FINNHUB_RATE_LIMITED",
  OFFLINE: "LIVE_DATA_OFFLINE",
  NETWORK_ERROR: "LIVE_DATA_NETWORK_ERROR",
  TEMPORARILY_UNAVAILABLE: "LIVE_DATA_TEMPORARILY_UNAVAILABLE",
  PLAN_UNAVAILABLE: "FINNHUB_PLAN_UNAVAILABLE",
  NOT_FOUND: "LIVE_DATA_NOT_FOUND",
  INVALID_RESPONSE: "LIVE_DATA_INVALID_RESPONSE",
  QUOTE_UNAVAILABLE: "FINNHUB_QUOTE_UNAVAILABLE",
  CACHE_READ_FAILED: "LIVE_DATA_CACHE_READ_FAILED",
  CACHE_WRITE_FAILED: "LIVE_DATA_CACHE_WRITE_FAILED",
  TREASURY_UNAVAILABLE: "TREASURY_RATE_UNAVAILABLE",
  ABORTED: "LIVE_DATA_ABORTED",
  UNKNOWN: "LIVE_DATA_UNKNOWN"
});

export const LIVE_DATA_STATES = Object.freeze({
  AVAILABLE: "available",
  STALE: "stale",
  QUOTE_ONLY: "quote-only",
  RATE_LIMITED: "rate-limited",
  OFFLINE: "offline",
  TEMPORARILY_UNAVAILABLE: "temporarily-unavailable",
  PLAN_UNAVAILABLE: "plan-unavailable",
  ERROR: "error"
});

const SECRET_QUERY_KEYS = new Set([
  "token",
  "api_key",
  "apikey",
  "api-key",
  "access_token",
  "access-token"
]);

export class LiveDataError extends Error {
  constructor(code, message, details = {}) {
    super(sanitizeText(message) || "Live-data request failed.");
    this.name = "LiveDataError";
    this.code = code || LIVE_DATA_ERROR_CODES.UNKNOWN;
    this.availability = details.availability || stateForCode(this.code);
    this.scope = details.scope || "live-data";
    this.endpoint = sanitizeEndpoint(details.endpoint);
    this.status = normalizeStatus(details.status);
    this.retryable = Boolean(details.retryable);
    this.retryAfterMs = normalizeNonnegativeNumber(details.retryAfterMs);
    this.cachedDataUsed = Boolean(details.cachedDataUsed);
    this.details = sanitizeDetails(details.details);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LiveDataError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      availability: this.availability,
      scope: this.scope,
      endpoint: this.endpoint,
      status: this.status,
      retryable: this.retryable,
      retryAfterMs: this.retryAfterMs,
      cachedDataUsed: this.cachedDataUsed,
      details: clonePlain(this.details)
    };
  }
}

export function isLiveDataError(error) {
  return error instanceof LiveDataError;
}

export function normalizeLiveDataError(error, context = {}) {
  if (isLiveDataError(error)) {
    return withContext(error, context);
  }

  const status = normalizeStatus(context.status || error && error.status);
  const responseText = sanitizeText(
    context.responseMessage
      || error && error.responseMessage
      || error && error.message
      || ""
  );
  const lowerMessage = responseText.toLowerCase();
  const navigatorOffline = typeof navigator !== "undefined"
    && navigator
    && navigator.onLine === false;

  if (error && error.name === "AbortError") {
    return createError(
      LIVE_DATA_ERROR_CODES.ABORTED,
      "The live-data request was cancelled.",
      context,
      { retryable: false, status }
    );
  }

  if (status === 429) {
    return createError(
      LIVE_DATA_ERROR_CODES.RATE_LIMITED,
      "Finnhub rate limit reached. Cached data is used when available.",
      context,
      {
        retryable: true,
        status,
        retryAfterMs: context.retryAfterMs
      }
    );
  }

  if (status === 401
      || lowerMessage.includes("invalid api key")
      || lowerMessage.includes("invalid token")
      || lowerMessage.includes("api key is invalid")
      || lowerMessage.includes("token is invalid")) {
    return createError(
      LIVE_DATA_ERROR_CODES.API_KEY_INVALID,
      "The Finnhub API key was rejected.",
      context,
      { retryable: false, status }
    );
  }

  if (status === 403) {
    if (lowerMessage.includes("token") || lowerMessage.includes("api key")) {
      return createError(
        LIVE_DATA_ERROR_CODES.API_KEY_INVALID,
        "The Finnhub API key was rejected.",
        context,
        { retryable: false, status }
      );
    }
    return createError(
      LIVE_DATA_ERROR_CODES.PLAN_UNAVAILABLE,
      "The requested Finnhub endpoint is not available for the current plan or entitlement.",
      context,
      { retryable: false, status }
    );
  }

  if (status === 404) {
    return createError(
      LIVE_DATA_ERROR_CODES.NOT_FOUND,
      "The requested live-data resource was not found.",
      context,
      { retryable: false, status }
    );
  }

  if (status >= 500 && status <= 599) {
    return createError(
      LIVE_DATA_ERROR_CODES.TEMPORARILY_UNAVAILABLE,
      "The live-data provider is temporarily unavailable.",
      context,
      { retryable: true, status }
    );
  }

  if (navigatorOffline) {
    return createError(
      LIVE_DATA_ERROR_CODES.OFFLINE,
      "Internet access is unavailable. Cached data is used when available.",
      context,
      { retryable: true, status }
    );
  }

  if (error instanceof TypeError
      || lowerMessage.includes("failed to fetch")
      || lowerMessage.includes("networkerror")
      || lowerMessage.includes("network request failed")) {
    return createError(
      LIVE_DATA_ERROR_CODES.NETWORK_ERROR,
      "The live-data network request failed. Cached data is used when available.",
      context,
      { retryable: true, status }
    );
  }

  return createError(
    context.defaultCode || LIVE_DATA_ERROR_CODES.UNKNOWN,
    context.defaultMessage || responseText || "The live-data request failed.",
    context,
    { retryable: Boolean(context.retryable), status }
  );
}

export function createHttpError(response, payload, context = {}) {
  const status = normalizeStatus(response && response.status);
  const responseMessage = extractProviderMessage(payload)
    || response && response.statusText
    || "HTTP request failed.";
  const retryAfterMs = parseRetryAfterMs(
    response && response.headers && typeof response.headers.get === "function"
      ? response.headers.get("Retry-After")
      : null
  );

  return normalizeLiveDataError(new Error(responseMessage), {
    ...context,
    status,
    retryAfterMs,
    responseMessage
  });
}

export function createCacheError(operation, error, context = {}) {
  const read = operation === "read";
  return new LiveDataError(
    read
      ? LIVE_DATA_ERROR_CODES.CACHE_READ_FAILED
      : LIVE_DATA_ERROR_CODES.CACHE_WRITE_FAILED,
    read
      ? "The local live-data cache could not be read."
      : "The local live-data cache could not be updated.",
    {
      availability: LIVE_DATA_STATES.ERROR,
      scope: "local-cache",
      endpoint: context.endpoint,
      status: null,
      retryable: true,
      cachedDataUsed: false,
      details: {
        operation,
        cacheKey: context.cacheKey || null,
        causeName: error && error.name ? error.name : null
      }
    }
  );
}

export function sanitizeEndpoint(value) {
  if (!value) {
    return null;
  }
  const text = String(value);
  try {
    const url = new URL(text, "https://redaction.invalid");
    for (const key of Array.from(url.searchParams.keys())) {
      if (SECRET_QUERY_KEYS.has(key.toLowerCase())) {
        url.searchParams.set(key, "[REDACTED]");
      }
    }
    if (url.origin === "https://redaction.invalid") {
      return `${url.pathname}${url.search}`;
    }
    return `${url.origin}${url.pathname}${url.search}`;
  } catch (_error) {
    return redactSecrets(text);
  }
}

export function sanitizeDiagnosticError(error, overrides = {}) {
  const normalized = normalizeLiveDataError(error, overrides);
  return {
    category: "live-data-error",
    occurredAt: overrides.occurredAt || new Date().toISOString(),
    ...normalized.toJSON()
  };
}

function createError(code, message, context, overrides) {
  return new LiveDataError(code, message, {
    availability: overrides.availability || stateForCode(code),
    scope: context.scope || "live-data",
    endpoint: context.endpoint,
    status: overrides.status,
    retryable: overrides.retryable,
    retryAfterMs: overrides.retryAfterMs,
    cachedDataUsed: Boolean(context.cachedDataUsed),
    details: context.details
  });
}

function withContext(error, context) {
  if (!context || Object.keys(context).length === 0) {
    return error;
  }
  return new LiveDataError(error.code, error.message, {
    availability: context.availability || error.availability,
    scope: context.scope || error.scope,
    endpoint: context.endpoint || error.endpoint,
    status: context.status === undefined ? error.status : context.status,
    retryable: context.retryable === undefined ? error.retryable : context.retryable,
    retryAfterMs: context.retryAfterMs === undefined
      ? error.retryAfterMs
      : context.retryAfterMs,
    cachedDataUsed: context.cachedDataUsed === undefined
      ? error.cachedDataUsed
      : context.cachedDataUsed,
    details: {
      ...clonePlain(error.details),
      ...sanitizeDetails(context.details)
    }
  });
}

function stateForCode(code) {
  switch (code) {
    case LIVE_DATA_ERROR_CODES.RATE_LIMITED:
      return LIVE_DATA_STATES.RATE_LIMITED;
    case LIVE_DATA_ERROR_CODES.OFFLINE:
    case LIVE_DATA_ERROR_CODES.NETWORK_ERROR:
      return LIVE_DATA_STATES.OFFLINE;
    case LIVE_DATA_ERROR_CODES.TEMPORARILY_UNAVAILABLE:
    case LIVE_DATA_ERROR_CODES.TREASURY_UNAVAILABLE:
      return LIVE_DATA_STATES.TEMPORARILY_UNAVAILABLE;
    case LIVE_DATA_ERROR_CODES.PLAN_UNAVAILABLE:
      return LIVE_DATA_STATES.PLAN_UNAVAILABLE;
    default:
      return LIVE_DATA_STATES.ERROR;
  }
}

function extractProviderMessage(payload) {
  if (!payload) {
    return "";
  }
  if (typeof payload === "string") {
    return payload;
  }
  if (typeof payload === "object") {
    for (const key of ["error", "message", "detail", "statusText"]) {
      if (typeof payload[key] === "string" && payload[key].trim()) {
        return payload[key];
      }
    }
  }
  return "";
}

function parseRetryAfterMs(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }
  const date = Date.parse(String(value));
  if (Number.isFinite(date)) {
    return Math.max(0, date - Date.now());
  }
  return null;
}

function sanitizeDetails(value) {
  if (!value || typeof value !== "object") {
    return {};
  }
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (SECRET_QUERY_KEYS.has(key.toLowerCase())) {
      output[key] = "[REDACTED]";
      continue;
    }
    output[key] = sanitizeValue(item);
  }
  return output;
}

function sanitizeValue(value) {
  if (typeof value === "string") {
    return redactSecrets(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === "object") {
    return sanitizeDetails(value);
  }
  return value;
}

function sanitizeText(value) {
  return redactSecrets(value === null || value === undefined ? "" : String(value));
}

function redactSecrets(text) {
  return String(text)
    .replace(/([?&](?:token|api[_-]?key|apikey|access[_-]?token)=)[^&#\s]*/gi, "$1[REDACTED]")
    .replace(/\b(?:token|api[_-]?key|apikey|access[_-]?token)\s*[:=]\s*[^\s,;]+/gi, (match) => {
      const separator = match.includes(":") ? ":" : "=";
      return `${match.split(separator)[0]}${separator}[REDACTED]`;
    });
}

function normalizeStatus(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 100 && number <= 599 ? number : null;
}

function normalizeNonnegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function clonePlain(value) {
  if (value === null || value === undefined) {
    return value;
  }
  return JSON.parse(JSON.stringify(value));
}
