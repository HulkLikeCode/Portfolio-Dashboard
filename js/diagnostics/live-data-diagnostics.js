import { sanitizeDiagnosticError } from "../data/live-data-errors.js";
import { FINNHUB_API_KEY_SOURCES } from "../config/finnhub.js";

export const LIVE_DATA_DIAGNOSTICS_VERSION = "2.2-phase-2f";

/**
 * Version 2.3 Diagnostics projection. API-key values are never included in
 * snapshots or persisted diagnostic events.
 */
export class LiveDataDiagnostics {
  constructor(options = {}) {
    if (!options.requestQueue || typeof options.requestQueue !== "object") {
      throw new TypeError("The existing Finnhub Request Queue is required.");
    }
    this.requestQueue = options.requestQueue;
    this.storage = normalizeDiagnosticStorage(options.storage);
    this.now = typeof options.now === "function"
      ? options.now
      : () => new Date().toISOString();
    this.lastQuoteRefresh = null;
    this.lastTreasuryRefresh = null;
    this.lastApiState = "not-tested";
    this.getApiKeySource = typeof options.getApiKeySource === "function"
      ? options.getApiKeySource
      : () => FINNHUB_API_KEY_SOURCES.SESSION;
  }

  async record(event) {
    const safe = sanitizeEvent(event, this.now());
    updateSnapshot(this, safe);
    if (this.storage) {
      try {
        await this.storage.write(safe);
      } catch (_error) {
        // Diagnostics persistence must not interrupt data delivery.
      }
    }
    return safe;
  }

  async recordError(error, context = {}) {
    return this.record({
      ...sanitizeDiagnosticError(error, { occurredAt: this.now() }),
      ...context
    });
  }

  async getSnapshot() {
    const queueBudget = await readQueueBudget(this.requestQueue);
    const recent = this.storage ? await safeReadRecent(this.storage) : [];
    const apiKeySource = await this.getApiKeySource();
    return {
      category: "live-data",
      version: LIVE_DATA_DIAGNOSTICS_VERSION,
      generatedAt: this.now(),
      apiStatus: this.lastApiState,
      apiKeySource,
      lastQuoteRefresh: this.lastQuoteRefresh,
      lastTreasuryRefresh: this.lastTreasuryRefresh,
      requestBudget: sanitizeBudget(queueBudget),
      recentEvents: recent.map((event) => sanitizeEvent(event, event.occurredAt || this.now())),
      security: {
        apiKeyExposed: false,
        apiKeyLogged: false,
        policy: "runtime-only-redacted"
      },
      sourcePolicy: {
        finnhubHistoricalRequests: false,
        treasuryCountsAgainstFinnhubBudget: false
      }
    };
  }
}

export function createLiveDataDiagnostics(options = {}) {
  return new LiveDataDiagnostics(options);
}

export function createLiveDataDiagnosticRecorder(diagnostics) {
  if (!diagnostics || typeof diagnostics.record !== "function") {
    throw new TypeError("A LiveDataDiagnostics instance is required.");
  }
  return (event) => diagnostics.record(event);
}

async function readQueueBudget(queue) {
  for (const methodName of [
    "getBudgetStatus",
    "getApproximateBudget",
    "getStatus",
    "getDiagnostics"
  ]) {
    if (typeof queue[methodName] === "function") {
      try {
        return await queue[methodName]();
      } catch (_error) {
        return { available: false, reason: "queue-status-read-failed" };
      }
    }
  }
  return { available: false, reason: "queue-status-method-not-exposed" };
}

function normalizeDiagnosticStorage(storage) {
  if (!storage) {
    return null;
  }
  const write = pickMethod(storage, [
    "addDiagnostic",
    "recordDiagnostic",
    "putDiagnostic",
    "add"
  ]);
  const read = pickMethod(storage, [
    "getRecentDiagnostics",
    "listDiagnostics",
    "getRecent",
    "list"
  ], true);
  if (!write) {
    throw new TypeError("Diagnostics storage must provide a write method.");
  }
  return {
    write,
    read: read || (async () => [])
  };
}

async function safeReadRecent(storage) {
  try {
    const value = await storage.read({ category: "live-data", limit: 50 });
    return Array.isArray(value) ? value : [];
  } catch (_error) {
    return [];
  }
}

function sanitizeEvent(event, fallbackTime) {
  const value = event && typeof event === "object" ? event : {};
  const safe = {
    category: text(value.category) || "live-data-event",
    status: text(value.status) || inferStatus(value),
    occurredAt: validIso(value.occurredAt) || fallbackTime,
    provider: text(value.provider),
    endpoint: sanitizeEndpoint(value.endpoint),
    symbol: sanitizeSymbol(value.symbol),
    source: text(value.source),
    code: text(value.code),
    message: redact(text(value.message)),
    availability: text(value.availability),
    retryable: Boolean(value.retryable),
    retryAfterMs: finiteOrNull(value.retryAfterMs),
    cachedDataUsed: Boolean(value.cachedDataUsed),
    finnhubRequestBudgetUsed: value.finnhubRequestBudgetUsed === undefined
      ? value.provider === "Finnhub"
      : Boolean(value.finnhubRequestBudgetUsed),
    details: sanitizeDetails(value.details)
  };
  return safe;
}

function updateSnapshot(target, event) {
  if (event.category === "quote-refresh" || event.endpoint === "/quote") {
    target.lastQuoteRefresh = event.occurredAt;
  }
  if (event.provider === "U.S. Treasury Fiscal Data") {
    target.lastTreasuryRefresh = event.occurredAt;
  }
  if (event.provider === "Finnhub") {
    target.lastApiState = event.status === "success"
      ? "available"
      : event.availability || "error";
  }
}

function sanitizeBudget(value) {
  if (!value || typeof value !== "object") {
    return { available: false };
  }
  const output = {};
  const permitted = [
    "available",
    "callsLastSecond",
    "callsLastMinute",
    "remainingSecond",
    "remainingMinute",
    "queued",
    "inFlight",
    "maxPerSecond",
    "maxPerMinute",
    "rateLimitedUntil",
    "reason"
  ];
  for (const key of permitted) {
    if (value[key] !== undefined) {
      output[key] = clonePlain(value[key]);
    }
  }
  return output;
}

function sanitizeDetails(value) {
  if (!value || typeof value !== "object") {
    return {};
  }
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (/token|api.?key|secret|authorization/i.test(key)) {
      output[key] = "[REDACTED]";
    } else if (typeof item === "string") {
      output[key] = redact(item);
    } else if (Array.isArray(item)) {
      output[key] = item.slice(0, 25).map((entry) => (
        typeof entry === "string" ? redact(entry) : clonePlain(entry)
      ));
    } else if (item && typeof item === "object") {
      output[key] = sanitizeDetails(item);
    } else {
      output[key] = item;
    }
  }
  return output;
}

function sanitizeEndpoint(value) {
  const endpoint = text(value);
  if (!endpoint) {
    return null;
  }
  return redact(endpoint).split("?")[0];
}

function sanitizeSymbol(value) {
  const symbol = (text(value) || "").toUpperCase();
  return /^[A-Z0-9.\-]{1,20}$/.test(symbol) ? symbol : null;
}

function inferStatus(value) {
  if (value.code || value.error) {
    return "error";
  }
  return "info";
}

function redact(value) {
  return String(value || "")
    .replace(/([?&](?:token|api[_-]?key|apikey|access[_-]?token)=)[^&#\s]*/gi, "$1[REDACTED]")
    .replace(/\b(?:token|api[_-]?key|apikey|access[_-]?token)\s*[:=]\s*[^\s,;]+/gi, "credential=[REDACTED]");
}

function pickMethod(target, names, optional = false) {
  for (const name of names) {
    if (typeof target[name] === "function") {
      return target[name].bind(target);
    }
  }
  return optional ? null : null;
}

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function validIso(value) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    return null;
  }
  return new Date(Date.parse(value)).toISOString();
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clonePlain(value) {
  if (value === null || value === undefined) {
    return value;
  }
  return JSON.parse(JSON.stringify(value));
}
