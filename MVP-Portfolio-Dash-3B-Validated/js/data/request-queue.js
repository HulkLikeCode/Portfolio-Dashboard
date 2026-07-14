// js/data/request-queue.js
// Throttled, prioritized request queue for Finnhub-compatible data services.
// Phase 2 scope: queueing, rate limits, retries/backoff, diagnostics hooks.

import {
  API_ERROR_CODES,
  ApiError,
  createCancelledError,
  normalizeApiError,
  sanitizeDiagnosticsValue
} from './api-errors.js';

export const REQUEST_PRIORITIES = Object.freeze({
  PORTFOLIO_QUOTE: 10,
  PORTFOLIO_CACHED_HISTORY: 20,
  BENCHMARK_QUOTE: 30,
  BENCHMARK_CACHED_HISTORY: 40,
  PORTFOLIO_NEW_HISTORY: 50,
  BENCHMARK_NEW_HISTORY: 60,
  PORTFOLIO_METADATA: 70,
  BENCHMARK_METADATA: 80,
  DEFAULT: 100
});

export const REQUEST_QUEUE_DEFAULTS = Object.freeze({
  MAX_PER_MINUTE: 60,
  MAX_PER_SECOND: 30,
  SECOND_WINDOW_MS: 1000,
  MINUTE_WINDOW_MS: 60000,
  MAX_CONCURRENCY: 3,
  MAX_RETRIES: 2,
  BASE_BACKOFF_MS: 1000,
  MAX_BACKOFF_MS: 30000,
  REQUEST_TIMEOUT_MS: 20000,
  RECENT_EVENT_LIMIT: 50,
  RECENT_ERROR_LIMIT: 25
});

export function resolveRequestPriority(options = {}) {
  if (Number.isFinite(Number(options.priority))) return Number(options.priority);

  const ownerType = normalizeToken(options.ownerType || options.symbolRole || options.scope || options.owner || '');
  const requestType = normalizeToken(options.requestType || options.dataType || options.type || '');
  const cacheMode = normalizeToken(options.cacheMode || options.cachePolicy || options.cache || '');

  const isPortfolio = ownerType === 'portfolio' || ownerType === 'holding' || ownerType === 'portfolioholding';
  const isBenchmark = ownerType === 'benchmark' || ownerType === 'benchmarks';
  const isQuote = requestType === 'quote' || requestType === 'quotesnapshot' || requestType === 'snapshot';
  const isHistorical = requestType === 'historical' || requestType === 'history' || requestType === 'candle' || requestType === 'candles';
  const isMetadata = requestType === 'metadata' || requestType === 'profile' || requestType === 'profile2' || requestType === 'metric' || requestType === 'peers';
  const isCached = cacheMode === 'cached' || cacheMode === 'cachefirst' || cacheMode === 'cache';

  if (isPortfolio && isQuote) return REQUEST_PRIORITIES.PORTFOLIO_QUOTE;
  if (isPortfolio && isHistorical && isCached) return REQUEST_PRIORITIES.PORTFOLIO_CACHED_HISTORY;
  if (isBenchmark && isQuote) return REQUEST_PRIORITIES.BENCHMARK_QUOTE;
  if (isBenchmark && isHistorical && isCached) return REQUEST_PRIORITIES.BENCHMARK_CACHED_HISTORY;
  if (isPortfolio && isHistorical) return REQUEST_PRIORITIES.PORTFOLIO_NEW_HISTORY;
  if (isBenchmark && isHistorical) return REQUEST_PRIORITIES.BENCHMARK_NEW_HISTORY;
  if (isPortfolio && isMetadata) return REQUEST_PRIORITIES.PORTFOLIO_METADATA;
  if (isBenchmark && isMetadata) return REQUEST_PRIORITIES.BENCHMARK_METADATA;
  if (isQuote) return REQUEST_PRIORITIES.PORTFOLIO_QUOTE;
  if (isHistorical && isCached) return REQUEST_PRIORITIES.PORTFOLIO_CACHED_HISTORY;
  if (isHistorical) return REQUEST_PRIORITIES.PORTFOLIO_NEW_HISTORY;
  if (isMetadata) return REQUEST_PRIORITIES.PORTFOLIO_METADATA;

  return REQUEST_PRIORITIES.DEFAULT;
}

export class RequestQueue {
  constructor(options = {}) {
    this.maxPerMinute = positiveInteger(options.maxPerMinute, REQUEST_QUEUE_DEFAULTS.MAX_PER_MINUTE);
    this.maxPerSecond = positiveInteger(options.maxPerSecond, REQUEST_QUEUE_DEFAULTS.MAX_PER_SECOND);
    this.secondWindowMs = positiveInteger(options.secondWindowMs, REQUEST_QUEUE_DEFAULTS.SECOND_WINDOW_MS);
    this.minuteWindowMs = positiveInteger(options.minuteWindowMs, REQUEST_QUEUE_DEFAULTS.MINUTE_WINDOW_MS);
    this.maxConcurrency = positiveInteger(options.maxConcurrency, REQUEST_QUEUE_DEFAULTS.MAX_CONCURRENCY);
    this.maxRetries = nonNegativeInteger(options.maxRetries, REQUEST_QUEUE_DEFAULTS.MAX_RETRIES);
    this.baseBackoffMs = positiveInteger(options.baseBackoffMs, REQUEST_QUEUE_DEFAULTS.BASE_BACKOFF_MS);
    this.maxBackoffMs = positiveInteger(options.maxBackoffMs, REQUEST_QUEUE_DEFAULTS.MAX_BACKOFF_MS);
    this.defaultTimeoutMs = positiveInteger(options.defaultTimeoutMs, REQUEST_QUEUE_DEFAULTS.REQUEST_TIMEOUT_MS);
    this.recentEventLimit = positiveInteger(options.recentEventLimit, REQUEST_QUEUE_DEFAULTS.RECENT_EVENT_LIMIT);
    this.recentErrorLimit = positiveInteger(options.recentErrorLimit, REQUEST_QUEUE_DEFAULTS.RECENT_ERROR_LIMIT);
    this.disableJitter = Boolean(options.disableJitter);
    this.onEvent = typeof options.onEvent === 'function' ? options.onEvent : null;
    this.onDiagnostics = typeof options.onDiagnostics === 'function' ? options.onDiagnostics : null;

    this.queue = [];
    this.activeCount = 0;
    this.startedTimestamps = [];
    this.sequence = 0;
    this.timerId = null;
    this.started = options.startPaused ? false : true;
    this.backoffUntil = 0;
    this.recentEvents = [];
    this.recentErrors = [];
    this.lastError = null;

    this.stats = {
      enqueued: 0,
      started: 0,
      completed: 0,
      failed: 0,
      retried: 0,
      cancelled: 0,
      rateLimitedCount: 0
    };
  }

  enqueue(handler, options = {}) {
    if (typeof handler !== 'function') {
      return Promise.reject(new TypeError('RequestQueue.enqueue requires a request handler function.'));
    }

    const id = sanitizeId(options.id || `request-${Date.now()}-${this.sequence + 1}`);
    const priority = resolveRequestPriority(options);
    const item = {
      id,
      label: sanitizeId(options.label || id),
      handler,
      priority,
      sequence: ++this.sequence,
      retries: nonNegativeInteger(options.retries ?? options.maxRetries, this.maxRetries),
      attempt: 0,
      timeoutMs: positiveInteger(options.timeoutMs, this.defaultTimeoutMs),
      endpoint: options.endpoint || options.url || '',
      method: options.method || 'GET',
      metadata: sanitizeDiagnosticsValue(options.metadata || {}),
      createdAt: Date.now(),
      resolve: null,
      reject: null
    };

    const promise = new Promise((resolve, reject) => {
      item.resolve = resolve;
      item.reject = reject;
    });

    this.queue.push(item);
    this.stats.enqueued += 1;
    this.sortQueue();
    this.recordEvent('queued', item);
    this.schedulePump(0);

    return promise;
  }

  start() {
    this.started = true;
    this.recordEvent('queue-started');
    this.schedulePump(0);
  }

  pause() {
    this.started = false;
    this.recordEvent('queue-paused');
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  clear(reason = 'Queued request cancelled.') {
    const pending = this.queue.splice(0);
    for (const item of pending) {
      this.stats.cancelled += 1;
      const error = createCancelledError(reason, {
        requestId: item.id,
        endpoint: item.endpoint,
        method: item.method,
        safeDetails: { label: item.label }
      });
      item.reject(error);
      this.recordError(error);
      this.recordEvent('cancelled', item);
    }
    this.schedulePump(0);
  }

  getDiagnosticsSnapshot() {
    const budget = this.getBudget();
    const now = Date.now();
    const status = this.activeCount > 0
      ? 'running'
      : this.queue.length > 0 && this.backoffUntil > now
        ? 'backing-off'
        : this.queue.length > 0
          ? 'queued'
          : 'idle';

    return sanitizeDiagnosticsValue({
      status,
      limits: {
        maxPerMinute: this.maxPerMinute,
        maxPerSecond: this.maxPerSecond,
        maxConcurrency: this.maxConcurrency
      },
      queued: this.queue.length,
      active: this.activeCount,
      backoffUntil: this.backoffUntil ? new Date(this.backoffUntil).toISOString() : null,
      backoffRemainingMs: Math.max(0, this.backoffUntil - now),
      budget,
      stats: { ...this.stats },
      rateLimitedCount: this.stats.rateLimitedCount,
      lastError: this.lastError ? this.lastError.toJSON() : null,
      recentErrors: this.recentErrors.map((entry) => entry.toJSON ? entry.toJSON() : entry),
      recentEvents: [...this.recentEvents]
    });
  }

  getBudget() {
    this.pruneTimestamps(Date.now());
    const now = Date.now();
    const perSecondUsed = countWithin(this.startedTimestamps, now - this.secondWindowMs);
    const perMinuteUsed = countWithin(this.startedTimestamps, now - this.minuteWindowMs);

    return {
      perSecond: {
        limit: this.maxPerSecond,
        used: perSecondUsed,
        remaining: Math.max(0, this.maxPerSecond - perSecondUsed),
        resetsInMs: resetInMs(this.startedTimestamps, this.secondWindowMs, now)
      },
      perMinute: {
        limit: this.maxPerMinute,
        used: perMinuteUsed,
        remaining: Math.max(0, this.maxPerMinute - perMinuteUsed),
        resetsInMs: resetInMs(this.startedTimestamps, this.minuteWindowMs, now)
      }
    };
  }

  sortQueue() {
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.sequence - b.sequence;
    });
  }

  schedulePump(delayMs) {
    if (!this.started) return;
    if (this.timerId) clearTimeout(this.timerId);

    const delay = Math.max(0, Number(delayMs) || 0);
    this.timerId = setTimeout(() => {
      this.timerId = null;
      this.pump();
    }, delay);
  }

  pump() {
    if (!this.started) return;
    this.pruneTimestamps(Date.now());

    while (this.canStartNext()) {
      const item = this.queue.shift();
      this.startItem(item);
    }

    if (this.queue.length > 0 && this.activeCount < this.maxConcurrency) {
      const delay = this.msUntilNextStart();
      if (Number.isFinite(delay)) this.schedulePump(delay);
    }

    this.publishDiagnostics();
  }

  canStartNext() {
    if (!this.started) return false;
    if (this.queue.length === 0) return false;
    if (this.activeCount >= this.maxConcurrency) return false;
    if (Date.now() < this.backoffUntil) return false;

    const budget = this.getBudget();
    return budget.perSecond.remaining > 0 && budget.perMinute.remaining > 0;
  }

  msUntilNextStart() {
    const now = Date.now();
    const waits = [];

    if (this.backoffUntil > now) waits.push(this.backoffUntil - now);

    const budget = this.getBudget();
    if (budget.perSecond.remaining <= 0) waits.push(budget.perSecond.resetsInMs);
    if (budget.perMinute.remaining <= 0) waits.push(budget.perMinute.resetsInMs);

    if (waits.length === 0) return 0;
    return Math.max(...waits, 0) + 5;
  }

  startItem(item) {
    item.attempt += 1;
    item.startedAt = Date.now();
    this.activeCount += 1;
    this.startedTimestamps.push(item.startedAt);
    this.stats.started += 1;
    this.recordEvent('started', item, { attempt: item.attempt });
    this.publishDiagnostics();

    this.runItem(item)
      .then((result) => {
        this.activeCount -= 1;
        this.stats.completed += 1;
        this.recordEvent('completed', item, { attempt: item.attempt });
        item.resolve(result);
        this.schedulePump(0);
      })
      .catch((error) => {
        const apiError = normalizeApiError(error, {
          requestId: item.id,
          endpoint: item.endpoint,
          method: item.method,
          safeDetails: {
            label: item.label,
            attempt: item.attempt,
            priority: item.priority,
            metadata: item.metadata
          }
        });

        if (apiError.code === API_ERROR_CODES.RATE_LIMIT) {
          this.stats.rateLimitedCount += 1;
        }

        if (this.shouldRetry(item, apiError)) {
          const retryDelay = this.computeRetryDelay(item, apiError);
          this.stats.retried += 1;
          this.activeCount -= 1;
          this.recordError(apiError);
          this.recordEvent('retry-scheduled', item, {
            attempt: item.attempt,
            retryDelayMs: retryDelay,
            errorCode: apiError.code
          });

          if (apiError.code === API_ERROR_CODES.RATE_LIMIT) {
            this.backoffUntil = Math.max(this.backoffUntil, Date.now() + retryDelay);
          }

          setTimeout(() => {
            this.queue.push(item);
            this.sortQueue();
            this.schedulePump(0);
          }, retryDelay);

          this.schedulePump(this.msUntilNextStart());
          return;
        }

        this.activeCount -= 1;
        this.stats.failed += 1;
        this.recordError(apiError);
        this.recordEvent('failed', item, {
          attempt: item.attempt,
          errorCode: apiError.code
        });
        item.reject(apiError);
        this.schedulePump(0);
      });
  }

  async runItem(item) {
    if (!item.timeoutMs) {
      return item.handler(this.createHandlerContext(item, null));
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = setTimeout(() => {
      if (controller) controller.abort();
    }, item.timeoutMs);

    try {
      return await item.handler(this.createHandlerContext(item, controller ? controller.signal : null));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  createHandlerContext(item, signal) {
    return {
      id: item.id,
      label: item.label,
      attempt: item.attempt,
      signal,
      endpoint: item.endpoint,
      method: item.method,
      metadata: item.metadata,
      queue: this
    };
  }

  shouldRetry(item, apiError) {
    return Boolean(apiError.retryable && item.attempt <= item.retries);
  }

  computeRetryDelay(item, apiError) {
    if (Number.isFinite(apiError.retryAfterMs) && apiError.retryAfterMs > 0) {
      return clamp(apiError.retryAfterMs, 0, this.maxBackoffMs);
    }

    const exponential = this.baseBackoffMs * Math.pow(2, Math.max(0, item.attempt - 1));
    const jitter = this.disableJitter ? 0 : Math.round(Math.random() * this.baseBackoffMs * 0.25);
    return clamp(exponential + jitter, this.baseBackoffMs, this.maxBackoffMs);
  }

  pruneTimestamps(now) {
    const oldestAllowed = now - Math.max(this.secondWindowMs, this.minuteWindowMs);
    this.startedTimestamps = this.startedTimestamps.filter((timestamp) => timestamp > oldestAllowed);
  }

  recordError(error) {
    this.lastError = error;
    this.recentErrors.push(error);
    if (this.recentErrors.length > this.recentErrorLimit) {
      this.recentErrors.splice(0, this.recentErrors.length - this.recentErrorLimit);
    }
  }

  recordEvent(type, item = null, extra = {}) {
    const event = sanitizeDiagnosticsValue({
      type,
      id: item?.id || '',
      label: item?.label || '',
      priority: item?.priority ?? null,
      queued: this.queue.length,
      active: this.activeCount,
      timestamp: new Date().toISOString(),
      ...extra
    });

    this.recentEvents.push(event);
    if (this.recentEvents.length > this.recentEventLimit) {
      this.recentEvents.splice(0, this.recentEvents.length - this.recentEventLimit);
    }

    if (this.onEvent) {
      this.onEvent(event);
    }
  }

  publishDiagnostics() {
    if (this.onDiagnostics) {
      this.onDiagnostics(this.getDiagnosticsSnapshot());
    }
  }
}

export function createRequestQueue(options = {}) {
  return new RequestQueue(options);
}

function normalizeToken(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function sanitizeId(value) {
  return String(value || '').replace(/[\r\n\t]/g, ' ').slice(0, 160);
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  if (Number.isInteger(number) && number > 0) return number;
  return fallback;
}

function nonNegativeInteger(value, fallback) {
  const number = Number(value);
  if (Number.isInteger(number) && number >= 0) return number;
  return fallback;
}

function countWithin(timestamps, cutoffExclusive) {
  return timestamps.filter((timestamp) => timestamp > cutoffExclusive).length;
}

function resetInMs(timestamps, windowMs, now) {
  const active = timestamps.filter((timestamp) => timestamp > now - windowMs);
  if (active.length === 0) return 0;
  const oldest = Math.min(...active);
  return Math.max(0, oldest + windowMs - now);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
