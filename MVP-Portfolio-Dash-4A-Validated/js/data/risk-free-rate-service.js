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

export const RISK_FREE_RATE_SERVICE_VERSION = "2.2-phase-2f";
export const TREASURY_AUCTIONS_ENDPOINT =
  "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/auctions_query";

/**
 * Retrieves the latest 13-week Treasury bill investment rate from the official
 * U.S. Treasury Fiscal Data auctions dataset. Treasury calls are intentionally
 * outside the Finnhub Request Queue and Finnhub request budget.
 */
export class RiskFreeRateService {
  constructor(options = {}) {
    this.fetchImpl = typeof options.fetchImpl === "function"
      ? options.fetchImpl
      : globalThis.fetch && globalThis.fetch.bind(globalThis);
    if (!this.fetchImpl) {
      throw new TypeError("Fetch is required for Treasury rate retrieval.");
    }
    if (!options.cache
        || typeof options.cache.get !== "function"
        || typeof options.cache.put !== "function") {
      throw new TypeError("An IndexedDB-backed live-data cache adapter is required.");
    }
    this.cache = options.cache;
    this.endpoint = options.endpoint || TREASURY_AUCTIONS_ENDPOINT;
    this.now = typeof options.now === "function"
      ? options.now
      : () => new Date().toISOString();
    this.timeoutMs = normalizePositiveNumber(options.timeoutMs, 15000, "timeoutMs");
    this.getManualRate = typeof options.getManualRate === "function"
      ? options.getManualRate
      : null;
    this.recordDiagnostic = typeof options.recordDiagnostic === "function"
      ? options.recordDiagnostic
      : async () => {};
    this.policy = resolveCachePolicy("TREASURY_RATE", options.policy || {});
  }

  async getCurrentRate(options = {}) {
    const key = cacheKey("treasury-rate", "13-week-bill");
    const cacheRead = await safeCacheRead(this.cache, key, {
      endpoint: this.endpoint
    });
    const cacheStatus = evaluateCacheEntry(cacheRead.entry, {
      now: this.now(),
      ...this.policy
    });
    const warnings = cacheRead.error ? [cacheRead.error.toJSON()] : [];

    if (!options.forceRefresh
        && options.preferFreshCache !== false
        && cacheStatus.fresh) {
      return buildRateResult({
        data: cacheRead.entry.data,
        source: "cache",
        availability: LIVE_DATA_STATES.AVAILABLE,
        stale: false,
        cacheStatus,
        provenance: cacheRead.entry.provenance,
        warnings
      });
    }

    try {
      const response = await this._fetchTreasury(options.signal);
      const rate = normalizeTreasuryAuctionResponse(response.payload);
      const storedAt = this.now();
      const entry = createCacheEntry({
        key,
        category: "TREASURY_RATE",
        source: "U.S. Treasury Fiscal Data",
        data: rate,
        storedAt,
        ttlMs: this.policy.ttlMs,
        staleAfterMs: this.policy.staleAfterMs,
        provenance: {
          provider: "U.S. Treasury Fiscal Data",
          dataset: "Treasury Securities Auctions Data",
          endpoint: "/v1/accounting/od/auctions_query",
          retrievedAt: storedAt,
          finnhubRequestBudgetUsed: false
        }
      });
      const write = await safeCacheWrite(this.cache, entry, {
        endpoint: this.endpoint
      });
      if (write.error) {
        warnings.push(write.error.toJSON());
        await this._recordError(write.error, { cacheKey: key });
      }
      return buildRateResult({
        data: rate,
        source: "live",
        availability: LIVE_DATA_STATES.AVAILABLE,
        stale: false,
        cacheStatus: evaluateCacheEntry(entry, { now: storedAt, ...this.policy }),
        provenance: entry.provenance,
        warnings
      });
    } catch (error) {
      const normalized = normalizeLiveDataError(error, {
        defaultCode: LIVE_DATA_ERROR_CODES.TREASURY_UNAVAILABLE,
        defaultMessage: "The U.S. Treasury risk-free rate is temporarily unavailable.",
        scope: "treasury-rate",
        endpoint: this.endpoint,
        cachedDataUsed: cacheStatus.usable
      });
      await this._recordError(normalized, { cacheKey: key });

      if (cacheStatus.usable && cacheRead.entry) {
        return buildRateResult({
          data: cacheRead.entry.data,
          source: "cache",
          availability: LIVE_DATA_STATES.STALE,
          stale: true,
          cacheStatus,
          provenance: cacheRead.entry.provenance,
          warnings,
          error: normalizeLiveDataError(normalized, {
            cachedDataUsed: true
          }).toJSON()
        });
      }

      const manual = await this._readManualRate();
      if (manual) {
        return buildRateResult({
          data: manual,
          source: "manual",
          availability: LIVE_DATA_STATES.AVAILABLE,
          stale: false,
          cacheStatus,
          provenance: {
            provider: "User-provided",
            retrievedAt: this.now(),
            finnhubRequestBudgetUsed: false
          },
          warnings: [
            ...warnings,
            {
              code: "RISK_FREE_RATE_USER_PROVIDED",
              message: "A user-provided risk-free rate is being used."
            }
          ],
          error: normalized.toJSON()
        });
      }

      return buildRateResult({
        data: null,
        source: "none",
        availability: normalized.availability,
        stale: false,
        cacheStatus,
        provenance: null,
        warnings,
        error: normalized.toJSON()
      });
    }
  }

  async _fetchTreasury(externalSignal) {
    const url = new URL(this.endpoint);
    url.searchParams.set(
      "fields",
      "record_date,security_type,security_term,auction_date,issue_date,high_investment_rate"
    );
    url.searchParams.set(
      "filter",
      "security_type:eq:Bill,security_term:eq:13-Week"
    );
    url.searchParams.set("sort", "-auction_date");
    url.searchParams.set("page[size]", "10");

    const abortContext = createAbortContext(externalSignal, this.timeoutMs);
    try {
      const response = await this.fetchImpl(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: abortContext.signal,
        cache: "no-store",
        credentials: "omit"
      });
      const payload = await parseJsonSafely(response);
      if (!response.ok) {
        const error = new Error(
          payload && payload.error && payload.error.message
            ? payload.error.message
            : response.statusText || "Treasury request failed."
        );
        error.status = response.status;
        throw error;
      }
      return { payload };
    } catch (error) {
      throw normalizeLiveDataError(error, {
        defaultCode: LIVE_DATA_ERROR_CODES.TREASURY_UNAVAILABLE,
        defaultMessage: "The U.S. Treasury risk-free rate is temporarily unavailable.",
        scope: "treasury-rate",
        endpoint: this.endpoint,
        retryable: true
      });
    } finally {
      abortContext.cleanup();
    }
  }

  async _readManualRate() {
    if (!this.getManualRate) {
      return null;
    }
    const value = await this.getManualRate();
    if (value === null || value === undefined || value === "") {
      return null;
    }
    const ratePercent = Number(
      value && typeof value === "object" && value.ratePercent !== undefined
        ? value.ratePercent
        : value
    );
    if (!Number.isFinite(ratePercent) || ratePercent < 0 || ratePercent > 100) {
      return null;
    }
    return {
      instrument: "User-provided risk-free rate",
      securityType: null,
      securityTerm: null,
      ratePercent,
      rateDecimal: ratePercent / 100,
      rateField: "userProvidedRatePercent",
      auctionDate: null,
      issueDate: null,
      recordDate: null,
      userProvided: true
    };
  }

  async _recordError(error, details) {
    try {
      await this.recordDiagnostic({
        ...sanitizeDiagnosticError(error, { occurredAt: this.now() }),
        provider: "U.S. Treasury Fiscal Data",
        finnhubRequestBudgetUsed: false,
        details: {
          ...clonePlain(error.details || {}),
          ...clonePlain(details || {})
        }
      });
    } catch (_error) {
      // Diagnostics must not break rate retrieval.
    }
  }
}

export function createRiskFreeRateService(options = {}) {
  return new RiskFreeRateService(options);
}

export function normalizeTreasuryAuctionResponse(payload) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.data)) {
    throw new LiveDataError(
      LIVE_DATA_ERROR_CODES.INVALID_RESPONSE,
      "The Treasury auction response is invalid.",
      {
        scope: "treasury-rate",
        endpoint: "/v1/accounting/od/auctions_query"
      }
    );
  }

  const records = payload.data
    .filter((record) => record && typeof record === "object")
    .filter((record) => String(record.security_type || "").toLowerCase() === "bill")
    .filter((record) => normalizeTerm(record.security_term) === "13-week")
    .map((record) => ({
      record,
      auctionDate: normalizeDate(record.auction_date),
      ratePercent: Number(record.high_investment_rate)
    }))
    .filter((item) => item.auctionDate && Number.isFinite(item.ratePercent))
    .sort((a, b) => b.auctionDate.localeCompare(a.auctionDate));

  if (records.length === 0) {
    throw new LiveDataError(
      LIVE_DATA_ERROR_CODES.TREASURY_UNAVAILABLE,
      "No usable 13-week Treasury bill investment rate was returned.",
      {
        scope: "treasury-rate",
        endpoint: "/v1/accounting/od/auctions_query"
      }
    );
  }

  const latest = records[0];
  return {
    instrument: "3-Month U.S. Treasury Bill",
    securityType: "Bill",
    securityTerm: "13-Week",
    ratePercent: latest.ratePercent,
    rateDecimal: latest.ratePercent / 100,
    rateField: "high_investment_rate",
    auctionDate: latest.auctionDate,
    issueDate: normalizeDate(latest.record.issue_date),
    recordDate: normalizeDate(latest.record.record_date),
    userProvided: false
  };
}

function buildRateResult(input) {
  return {
    data: clonePlain(input.data),
    source: input.source,
    availability: input.availability,
    stale: Boolean(input.stale),
    retrievedAt: input.provenance && input.provenance.retrievedAt || null,
    cache: serializeCacheStatus(input.cacheStatus),
    provenance: clonePlain(input.provenance),
    warnings: clonePlain(input.warnings || []),
    error: clonePlain(input.error || null)
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

async function parseJsonSafely(response) {
  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
}

function normalizeTerm(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "-");
}

function normalizeDate(value) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function createAbortContext(externalSignal, timeoutMs) {
  if (typeof AbortController !== "function") {
    return { signal: externalSignal, cleanup() {} };
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

function normalizePositiveNumber(value, fallback, field) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new TypeError(`${field} must be a positive finite number.`);
  }
  return number;
}

function clonePlain(value) {
  if (value === null || value === undefined) {
    return value;
  }
  return JSON.parse(JSON.stringify(value));
}
