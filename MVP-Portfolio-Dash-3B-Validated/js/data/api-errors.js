// js/data/api-errors.js
// Normalized API error handling for Phase 2 data services.
// This module intentionally avoids logging and redacts common API-key shapes.

export const API_ERROR_CODES = Object.freeze({
  UNKNOWN: 'unknown_error',
  RATE_LIMIT: 'rate_limited',
  NETWORK_OFFLINE: 'network_offline',
  TIMEOUT: 'timeout',
  INVALID_API_KEY: 'invalid_api_key',
  PLAN_ENTITLEMENT: 'plan_entitlement_unavailable',
  TEMPORARY_UNAVAILABLE: 'temporarily_unavailable',
  BAD_REQUEST: 'bad_request',
  NOT_FOUND: 'not_found',
  INVALID_RESPONSE: 'invalid_response',
  CANCELLED: 'cancelled'
});

export const FEATURE_STATES = Object.freeze({
  AVAILABLE: 'available',
  LOADING: 'loading',
  STALE: 'stale',
  QUOTE_ONLY: 'quote-only',
  INSUFFICIENT_HISTORY: 'insufficient-history',
  RATE_LIMITED: 'rate-limited',
  OFFLINE: 'offline',
  TEMPORARILY_UNAVAILABLE: 'temporarily-unavailable',
  PLAN_ENTITLEMENT_UNAVAILABLE: 'plan-entitlement-unavailable',
  ERROR: 'error'
});

const SECRET_QUERY_PARAM_NAMES = new Set([
  'token',
  'api_key',
  'apikey',
  'key',
  'access_token',
  'finnhub_key',
  'finnhubtoken'
]);

const LONG_SECRET_PATTERN = /\b[A-Za-z0-9_-]{20,}\b/g;
const HEADER_SECRET_PATTERNS = [
  /(Authorization\s*:\s*(?:Bearer\s+)?)[^\s,;]+/gi,
  /(X-Finnhub-Token\s*:\s*)[^\s,;]+/gi,
  /(Finnhub-Token\s*:\s*)[^\s,;]+/gi
];

export class ApiError extends Error {
  constructor(message, options = {}) {
    super(sanitizeString(message || 'Request failed.'));
    this.name = 'ApiError';
    this.code = options.code || API_ERROR_CODES.UNKNOWN;
    this.category = options.category || 'unknown';
    this.httpStatus = Number.isFinite(Number(options.httpStatus)) ? Number(options.httpStatus) : null;
    this.retryable = Boolean(options.retryable);
    this.retryAfterMs = Number.isFinite(Number(options.retryAfterMs)) ? Math.max(0, Number(options.retryAfterMs)) : 0;
    this.availabilityState = options.availabilityState || FEATURE_STATES.ERROR;
    this.userMessage = sanitizeString(options.userMessage || this.message);
    this.endpoint = sanitizeUrl(options.endpoint || options.url || '');
    this.method = sanitizeString(options.method || 'GET').toUpperCase();
    this.requestId = sanitizeString(options.requestId || '');
    this.safeDetails = sanitizeDiagnosticsValue(options.safeDetails || {});
    this.causeName = sanitizeString(options.causeName || '');
    this.timestamp = options.timestamp || new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      category: this.category,
      httpStatus: this.httpStatus,
      retryable: this.retryable,
      retryAfterMs: this.retryAfterMs,
      availabilityState: this.availabilityState,
      userMessage: this.userMessage,
      endpoint: this.endpoint,
      method: this.method,
      requestId: this.requestId,
      safeDetails: this.safeDetails,
      causeName: this.causeName,
      timestamp: this.timestamp
    };
  }
}

export function isApiError(value) {
  return value instanceof ApiError || Boolean(value && value.name === 'ApiError' && value.code);
}

export function isRetryableApiError(value) {
  return isApiError(value) && Boolean(value.retryable);
}

export function sanitizeString(value) {
  if (value === null || value === undefined) return '';
  let output = String(value);

  output = output.replace(/([?&](?:token|api_key|apikey|key|access_token|finnhub_key|finnhubtoken)=)[^&#\s]+/gi, '$1[REDACTED]');
  output = output.replace(/((?:token|api_key|apikey|key|access_token|finnhub_key|finnhubtoken)\s*[:=]\s*)[^\s,;&]+/gi, '$1[REDACTED]');

  for (const pattern of HEADER_SECRET_PATTERNS) {
    output = output.replace(pattern, '$1[REDACTED]');
  }

  // Last-resort redaction for long opaque strings commonly used as API keys.
  output = output.replace(LONG_SECRET_PATTERN, '[REDACTED]');
  return output;
}

export function sanitizeUrl(url) {
  if (!url) return '';

  try {
    const parsed = new URL(String(url), window.location.origin);
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (SECRET_QUERY_PARAM_NAMES.has(key.toLowerCase())) {
        parsed.searchParams.set(key, '[REDACTED]');
      }
    }

    if (parsed.origin === window.location.origin && !String(url).startsWith('http')) {
      return sanitizeString(`${parsed.pathname}${parsed.search}${parsed.hash}`);
    }

    return sanitizeString(parsed.toString());
  } catch (_error) {
    return sanitizeString(url);
  }
}

export function sanitizeDiagnosticsValue(value, depth = 0) {
  if (depth > 6) return '[MAX_DEPTH]';
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') return sanitizeString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: sanitizeString(value.name),
      message: sanitizeString(value.message)
    };
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeDiagnosticsValue(entry, depth + 1));
  }
  if (typeof value === 'object') {
    const output = {};
    for (const [key, entry] of Object.entries(value)) {
      const safeKey = sanitizeString(key);
      if (SECRET_QUERY_PARAM_NAMES.has(String(key).toLowerCase())) {
        output[safeKey] = '[REDACTED]';
      } else {
        output[safeKey] = sanitizeDiagnosticsValue(entry, depth + 1);
      }
    }
    return output;
  }

  return sanitizeString(value);
}

export function normalizeApiError(error, context = {}) {
  if (isApiError(error)) {
    return error;
  }

  const status = getHttpStatus(error, context);
  const rawMessage = getErrorMessage(error, context);
  const message = sanitizeString(rawMessage);
  const retryAfterMs = extractRetryAfterMs(error, context);
  const endpoint = sanitizeUrl(context.endpoint || context.url || error?.endpoint || error?.url || '');
  const method = sanitizeString(context.method || error?.method || 'GET').toUpperCase();
  const requestId = sanitizeString(context.requestId || error?.requestId || '');
  const causeName = sanitizeString(error?.name || '');
  const safeDetails = sanitizeDiagnosticsValue({
    ...(context.safeDetails || {}),
    statusText: error?.statusText || context.statusText || '',
    originalName: error?.name || '',
    label: context.label || ''
  });

  if (status === 429) {
    return new ApiError('API rate limit reached.', {
      code: API_ERROR_CODES.RATE_LIMIT,
      category: 'rate-limit',
      httpStatus: status,
      retryable: true,
      retryAfterMs,
      availabilityState: FEATURE_STATES.RATE_LIMITED,
      userMessage: 'Finnhub rate limit reached. The request is queued for retry using backoff.',
      endpoint,
      method,
      requestId,
      safeDetails,
      causeName
    });
  }

  if (isOffline(context)) {
    return new ApiError('Network is offline.', {
      code: API_ERROR_CODES.NETWORK_OFFLINE,
      category: 'network',
      httpStatus: status,
      retryable: true,
      availabilityState: FEATURE_STATES.OFFLINE,
      userMessage: 'Network appears offline. Cached data may be used where available.',
      endpoint,
      method,
      requestId,
      safeDetails,
      causeName
    });
  }

  if (isTimeoutError(error)) {
    return new ApiError('Request timed out.', {
      code: API_ERROR_CODES.TIMEOUT,
      category: 'timeout',
      httpStatus: status,
      retryable: true,
      availabilityState: FEATURE_STATES.TEMPORARILY_UNAVAILABLE,
      userMessage: 'The request timed out. The app can retry or use cached data where available.',
      endpoint,
      method,
      requestId,
      safeDetails,
      causeName
    });
  }

  if (status === 401) {
    return new ApiError('Invalid or unauthorized API key.', {
      code: API_ERROR_CODES.INVALID_API_KEY,
      category: 'authentication',
      httpStatus: status,
      retryable: false,
      availabilityState: FEATURE_STATES.ERROR,
      userMessage: 'The Finnhub API key was rejected. Re-enter the key in Settings.',
      endpoint,
      method,
      requestId,
      safeDetails,
      causeName
    });
  }

  if (status === 403 || looksLikeEntitlementError(message)) {
    return new ApiError('Endpoint unavailable under current data plan or entitlement.', {
      code: API_ERROR_CODES.PLAN_ENTITLEMENT,
      category: 'entitlement',
      httpStatus: status,
      retryable: false,
      availabilityState: FEATURE_STATES.PLAN_ENTITLEMENT_UNAVAILABLE,
      userMessage: 'This data appears unavailable under the current API key or data plan.',
      endpoint,
      method,
      requestId,
      safeDetails,
      causeName
    });
  }

  if (status === 400 || status === 422) {
    return new ApiError(message || 'Bad API request.', {
      code: API_ERROR_CODES.BAD_REQUEST,
      category: 'request',
      httpStatus: status,
      retryable: false,
      availabilityState: FEATURE_STATES.ERROR,
      userMessage: 'The request was invalid. Check the symbol, endpoint, and parameters.',
      endpoint,
      method,
      requestId,
      safeDetails,
      causeName
    });
  }

  if (status === 404) {
    return new ApiError('Requested data was not found.', {
      code: API_ERROR_CODES.NOT_FOUND,
      category: 'not-found',
      httpStatus: status,
      retryable: false,
      availabilityState: FEATURE_STATES.ERROR,
      userMessage: 'The requested data was not found.',
      endpoint,
      method,
      requestId,
      safeDetails,
      causeName
    });
  }

  if (status >= 500 && status <= 599) {
    return new ApiError(message || 'Remote service temporarily unavailable.', {
      code: API_ERROR_CODES.TEMPORARY_UNAVAILABLE,
      category: 'server',
      httpStatus: status,
      retryable: true,
      availabilityState: FEATURE_STATES.TEMPORARILY_UNAVAILABLE,
      userMessage: 'The remote service is temporarily unavailable. The app can retry or use cached data where available.',
      endpoint,
      method,
      requestId,
      safeDetails,
      causeName
    });
  }

  if (error instanceof TypeError && /fetch|network|failed/i.test(message)) {
    return new ApiError('Network request failed.', {
      code: API_ERROR_CODES.NETWORK_OFFLINE,
      category: 'network',
      httpStatus: status,
      retryable: true,
      availabilityState: FEATURE_STATES.OFFLINE,
      userMessage: 'Network request failed. Cached data may be used where available.',
      endpoint,
      method,
      requestId,
      safeDetails,
      causeName
    });
  }

  return new ApiError(message || 'Unknown API error.', {
    code: API_ERROR_CODES.UNKNOWN,
    category: 'unknown',
    httpStatus: status,
    retryable: false,
    availabilityState: FEATURE_STATES.ERROR,
    userMessage: 'The request failed. Check Diagnostics for the sanitized error record.',
    endpoint,
    method,
    requestId,
    safeDetails,
    causeName
  });
}

export function normalizeHttpResponse(response, context = {}) {
  if (response && response.ok) return null;

  return normalizeApiError(
    {
      status: response?.status,
      statusText: response?.statusText,
      headers: response?.headers,
      url: response?.url
    },
    context
  );
}

export function createCancelledError(reason = 'Request cancelled.', context = {}) {
  return new ApiError(reason, {
    code: API_ERROR_CODES.CANCELLED,
    category: 'cancelled',
    retryable: false,
    availabilityState: FEATURE_STATES.ERROR,
    userMessage: 'The request was cancelled.',
    endpoint: context.endpoint,
    method: context.method,
    requestId: context.requestId,
    safeDetails: context.safeDetails
  });
}

export function extractRetryAfterMs(error, context = {}) {
  const direct = Number(error?.retryAfterMs ?? context.retryAfterMs);
  if (Number.isFinite(direct) && direct >= 0) return direct;

  const retryAfter = getHeaderValue(error?.headers, 'Retry-After') || getHeaderValue(context.headers, 'Retry-After');
  if (!retryAfter) return 0;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }

  const dateMs = Date.parse(retryAfter);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }

  return 0;
}

function getHttpStatus(error, context) {
  const status = Number(context.status ?? error?.status ?? error?.statusCode ?? error?.response?.status);
  return Number.isFinite(status) ? status : null;
}

function getErrorMessage(error, context) {
  if (context.message) return context.message;
  if (error?.message) return error.message;
  if (error?.statusText) return error.statusText;
  if (typeof error === 'string') return error;
  return 'Request failed.';
}

function getHeaderValue(headers, name) {
  if (!headers) return '';

  if (typeof headers.get === 'function') {
    return headers.get(name) || headers.get(name.toLowerCase()) || '';
  }

  const exact = headers[name] || headers[name.toLowerCase()];
  return exact ? String(exact) : '';
}

function isOffline(context) {
  if (context.isOffline === true) return true;
  if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
    return navigator.onLine === false;
  }
  return false;
}

function isTimeoutError(error) {
  return error?.name === 'AbortError' || /timeout|timed out|aborted/i.test(String(error?.message || ''));
}

function looksLikeEntitlementError(message) {
  return /entitlement|permission|not available|premium|plan|access denied|not allowed/i.test(String(message || ''));
}
