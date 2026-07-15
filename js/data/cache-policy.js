export const LIVE_DATA_CACHE_VERSION = "2.2-phase-2f";

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

/**
 * Required Version 2.2 TTLs are profile, peers, and metrics at seven calendar
 * days. Other values are conservative operational defaults and remain
 * configurable by the caller.
 */
export const LIVE_DATA_TTLS = Object.freeze({
  QUOTE: 5 * MINUTE,
  SYMBOL_SEARCH: 24 * 60 * MINUTE,
  SYMBOL_LIST: 7 * DAY,
  COMPANY_PROFILE: 7 * DAY,
  COMPANY_PEERS: 7 * DAY,
  BASIC_METRICS: 7 * DAY,
  MARKET_STATUS: 1 * MINUTE,
  MARKET_HOLIDAYS: 24 * 60 * MINUTE,
  TREASURY_RATE: 24 * 60 * MINUTE
});

export const LIVE_DATA_STALE_LIMITS = Object.freeze({
  QUOTE: 7 * DAY,
  SYMBOL_SEARCH: 7 * DAY,
  SYMBOL_LIST: 30 * DAY,
  COMPANY_PROFILE: 30 * DAY,
  COMPANY_PEERS: 30 * DAY,
  BASIC_METRICS: 30 * DAY,
  MARKET_STATUS: 24 * 60 * MINUTE,
  MARKET_HOLIDAYS: 30 * DAY,
  TREASURY_RATE: 30 * DAY
});

export function createCacheEntry(options = {}) {
  const storedAt = normalizeIsoDate(options.storedAt || new Date().toISOString());
  const ttlMs = normalizeDuration(options.ttlMs, 0, "ttlMs");
  const staleAfterMs = normalizeDuration(
    options.staleAfterMs,
    Math.max(ttlMs, 0),
    "staleAfterMs"
  );

  return {
    key: normalizeCacheKey(options.key),
    category: String(options.category || "live-data"),
    symbol: options.symbol ? String(options.symbol).toUpperCase() : null,
    source: String(options.source || "unknown"),
    data: clonePlain(options.data),
    storedAt,
    expiresAt: addMilliseconds(storedAt, ttlMs),
    staleAfter: addMilliseconds(storedAt, staleAfterMs),
    ttlMs,
    staleAfterMs,
    schemaVersion: options.schemaVersion || LIVE_DATA_CACHE_VERSION,
    provenance: clonePlain(options.provenance || {})
  };
}

export function evaluateCacheEntry(entry, options = {}) {
  if (!entry || typeof entry !== "object") {
    return {
      present: false,
      usable: false,
      fresh: false,
      stale: false,
      expiredBeyondUse: false,
      ageMs: null,
      storedAt: null,
      expiresAt: null,
      staleAfter: null
    };
  }

  const nowMs = toTimestamp(options.now || new Date());
  const storedAtMs = toTimestamp(entry.storedAt);
  const ttlMs = normalizeDuration(
    options.ttlMs,
    Number.isFinite(entry.ttlMs) ? entry.ttlMs : 0,
    "ttlMs"
  );
  const staleAfterMs = normalizeDuration(
    options.staleAfterMs,
    Number.isFinite(entry.staleAfterMs)
      ? entry.staleAfterMs
      : Math.max(ttlMs, 0),
    "staleAfterMs"
  );

  if (!Number.isFinite(storedAtMs)) {
    return {
      present: true,
      usable: false,
      fresh: false,
      stale: false,
      expiredBeyondUse: true,
      ageMs: null,
      storedAt: entry.storedAt || null,
      expiresAt: null,
      staleAfter: null
    };
  }

  const ageMs = Math.max(0, nowMs - storedAtMs);
  const fresh = ageMs <= ttlMs;
  const usable = ageMs <= staleAfterMs;

  return {
    present: true,
    usable,
    fresh,
    stale: usable && !fresh,
    expiredBeyondUse: !usable,
    ageMs,
    storedAt: new Date(storedAtMs).toISOString(),
    expiresAt: new Date(storedAtMs + ttlMs).toISOString(),
    staleAfter: new Date(storedAtMs + staleAfterMs).toISOString()
  };
}

export function cacheKey(category, ...parts) {
  const normalized = [category, ...parts]
    .map((part) => String(part === undefined || part === null ? "" : part).trim())
    .filter(Boolean)
    .map((part) => encodeURIComponent(part.toUpperCase()));
  if (normalized.length === 0) {
    throw new TypeError("A cache category is required.");
  }
  return normalized.join(":");
}

export function resolveCachePolicy(category, overrides = {}) {
  const categoryKey = String(category || "").toUpperCase();
  const ttlMs = overrides.ttlMs === undefined
    ? LIVE_DATA_TTLS[categoryKey]
    : overrides.ttlMs;
  const staleAfterMs = overrides.staleAfterMs === undefined
    ? LIVE_DATA_STALE_LIMITS[categoryKey]
    : overrides.staleAfterMs;

  if (!Number.isFinite(ttlMs) || ttlMs < 0) {
    throw new TypeError(`No valid TTL is configured for ${category}.`);
  }
  if (!Number.isFinite(staleAfterMs) || staleAfterMs < ttlMs) {
    throw new TypeError(`The stale-use limit for ${category} must be at least its TTL.`);
  }

  return { ttlMs, staleAfterMs };
}

function normalizeCacheKey(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError("A non-empty cache key is required.");
  }
  return value.trim();
}

function normalizeIsoDate(value) {
  const timestamp = toTimestamp(value);
  if (!Number.isFinite(timestamp)) {
    throw new TypeError("storedAt must be a valid date.");
  }
  return new Date(timestamp).toISOString();
}

function normalizeDuration(value, fallback, field) {
  const resolved = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(resolved) || resolved < 0) {
    throw new TypeError(`${field} must be a nonnegative finite number.`);
  }
  return resolved;
}

function addMilliseconds(isoDate, milliseconds) {
  return new Date(Date.parse(isoDate) + milliseconds).toISOString();
}

function toTimestamp(value) {
  if (value instanceof Date) {
    return value.getTime();
  }
  return Date.parse(String(value));
}

function clonePlain(value) {
  if (value === undefined) {
    return null;
  }
  return JSON.parse(JSON.stringify(value));
}
