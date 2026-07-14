import { normalizeHistoricalSymbol } from "./historical-normalizer.js";
import {
  DEFAULT_MONTE_CARLO_CLOSE_COUNT,
  DEFAULT_MONTE_CARLO_RETURN_COUNT,
  DEFAULT_STALE_AFTER_CALENDAR_DAYS,
  HISTORICAL_DATA_STATES,
  assessHistoricalDataset,
  deriveHistoricalState,
  mergeHistoricalStates
} from "./historical-quality.js";

export const HISTORICAL_DATA_SERVICE_VERSION = "2.2-phase-2e";

export const HISTORICAL_DATA_SERVICE_ERROR_CODES = Object.freeze({
  INVALID_STORAGE_ADAPTER: "HISTORICAL_DATA_INVALID_STORAGE_ADAPTER",
  INVALID_OPTIONS: "HISTORICAL_DATA_INVALID_OPTIONS",
  INVALID_SYMBOL_LIST: "HISTORICAL_DATA_INVALID_SYMBOL_LIST",
  INDEXED_DB_READ_FAILED: "HISTORICAL_DATA_INDEXED_DB_READ_FAILED"
});

export class HistoricalDataServiceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "HistoricalDataServiceError";
    this.code = code;
    this.details = details && typeof details === "object" ? { ...details } : {};

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HistoricalDataServiceError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: clonePlain(this.details)
    };
  }
}

/**
 * IndexedDB-only historical read service.
 *
 * The supplied adapter must read the Phase 2C normalized candle and metadata
 * stores. This module never reads source files, Local Storage, or the network.
 * Supported adapter names:
 * - getHistoricalSeries(symbol) or getSeries(symbol)
 * - getHistoricalMetadata(symbol) or getDatasetMetadata(symbol), optional
 */
export class HistoricalDataService {
  constructor(options = {}) {
    this.storage = normalizeStorageAdapter(options.storage);
    this.now = typeof options.now === "function" ? options.now : () => new Date();
    this.staleAfterCalendarDays = normalizeNonnegativeInteger(
      options.staleAfterCalendarDays,
      DEFAULT_STALE_AFTER_CALENDAR_DAYS,
      "staleAfterCalendarDays"
    );
    this.defaultMinimumCloseCount = normalizeNonnegativeInteger(
      options.defaultMinimumCloseCount,
      DEFAULT_MONTE_CARLO_CLOSE_COUNT,
      "defaultMinimumCloseCount"
    );
  }

  async getSeries(symbol, options = {}) {
    const canonicalSymbol = normalizeHistoricalSymbol(symbol);
    const query = normalizeSeriesOptions(options, this.defaultMinimumCloseCount);
    const dataset = await this.#readDataset(canonicalSymbol, query.minimumCloseCount);
    const filtered = filterByDateRange(dataset.records, query.startDate, query.endDate);
    const selected = selectWindow(filtered, query.requiredCloseCount, query.windowSide);
    const queryStatus = buildQueryStatus(dataset.status, selected.length, query);

    return {
      symbol: canonicalSymbol,
      state: queryStatus.state,
      states: queryStatus.states,
      available: selected.length > 0,
      candles: selected.map(cloneRecord),
      dates: selected.map((record) => record.date),
      closes: selected.map((record) => record.close),
      count: selected.length,
      requested: serializeQuery(query),
      dateRange: getDateRange(selected),
      counts: {
        datasetObservationCount: dataset.records.length,
        filteredObservationCount: filtered.length,
        returnedObservationCount: selected.length,
        returnObservationCount: Math.max(0, selected.length - 1),
        requiredCloseCount: query.requiredCloseCount
      },
      provenance: clonePlain(dataset.status.provenance),
      datasetStatus: clonePlain(dataset.status),
      warnings: queryStatus.warnings,
      serviceVersion: HISTORICAL_DATA_SERVICE_VERSION
    };
  }

  async getLatestCandle(symbol) {
    const canonicalSymbol = normalizeHistoricalSymbol(symbol);
    const dataset = await this.#readDataset(canonicalSymbol, this.defaultMinimumCloseCount);
    const candle = dataset.records.length > 0
      ? cloneRecord(dataset.records[dataset.records.length - 1])
      : null;

    return {
      symbol: canonicalSymbol,
      state: dataset.status.state,
      states: dataset.status.states.slice(),
      available: Boolean(candle),
      candle,
      provenance: clonePlain(dataset.status.provenance),
      datasetStatus: clonePlain(dataset.status),
      serviceVersion: HISTORICAL_DATA_SERVICE_VERSION
    };
  }

  async getDateRange(symbol) {
    const canonicalSymbol = normalizeHistoricalSymbol(symbol);
    const dataset = await this.#readDataset(canonicalSymbol, this.defaultMinimumCloseCount);

    return {
      symbol: canonicalSymbol,
      state: dataset.status.state,
      states: dataset.status.states.slice(),
      available: dataset.records.length > 0,
      firstDate: dataset.status.dateRange.firstDate,
      lastDate: dataset.status.dateRange.lastDate,
      observationCount: dataset.records.length,
      provenance: clonePlain(dataset.status.provenance),
      datasetStatus: clonePlain(dataset.status),
      serviceVersion: HISTORICAL_DATA_SERVICE_VERSION
    };
  }

  async getAlignedSeries(symbols, options = {}) {
    const canonicalSymbols = normalizeSymbolList(symbols);
    const query = normalizeSeriesOptions(options, this.defaultMinimumCloseCount);
    const datasets = await Promise.all(
      canonicalSymbols.map((symbol) => this.#readDataset(symbol, query.minimumCloseCount))
    );

    const perSymbolStatus = Object.fromEntries(
      datasets.map((dataset) => [dataset.symbol, clonePlain(dataset.status)])
    );
    const missingSymbols = datasets
      .filter((dataset) => dataset.records.length === 0)
      .map((dataset) => dataset.symbol);

    const filteredBySymbol = new Map();
    for (const dataset of datasets) {
      filteredBySymbol.set(
        dataset.symbol,
        filterByDateRange(dataset.records, query.startDate, query.endDate)
      );
    }

    const commonDates = intersectExactTradingDates(canonicalSymbols, filteredBySymbol);
    const selectedDates = selectWindow(commonDates, query.requiredCloseCount, query.windowSide);
    const recordsBySymbol = {};
    const closesBySymbol = {};
    const mapsBySymbol = new Map();

    for (const symbol of canonicalSymbols) {
      mapsBySymbol.set(
        symbol,
        new Map(filteredBySymbol.get(symbol).map((record) => [record.date, record]))
      );
    }

    for (const symbol of canonicalSymbols) {
      const selectedRecords = selectedDates.map((date) => mapsBySymbol.get(symbol).get(date));
      recordsBySymbol[symbol] = selectedRecords.map(cloneRecord);
      closesBySymbol[symbol] = selectedRecords.map((record) => record.close);
    }

    const rows = selectedDates.map((date, index) => ({
      date,
      closes: Object.fromEntries(
        canonicalSymbols.map((symbol) => [symbol, closesBySymbol[symbol][index]])
      ),
      candles: Object.fromEntries(
        canonicalSymbols.map((symbol) => [symbol, cloneRecord(recordsBySymbol[symbol][index])])
      )
    }));

    const baseMerge = mergeHistoricalStates(datasets.map((dataset) => dataset.status));
    const combinedStates = baseMerge.states.filter((state) => state !== HISTORICAL_DATA_STATES.CURRENT);
    if (missingSymbols.length > 0 && !combinedStates.includes(HISTORICAL_DATA_STATES.MISSING)) {
      combinedStates.push(HISTORICAL_DATA_STATES.MISSING);
    }
    if (query.requiredCloseCount !== null && selectedDates.length < query.requiredCloseCount
        && !combinedStates.includes(HISTORICAL_DATA_STATES.INSUFFICIENT)) {
      combinedStates.push(HISTORICAL_DATA_STATES.INSUFFICIENT);
    }
    if (combinedStates.length === 0) {
      combinedStates.push(HISTORICAL_DATA_STATES.CURRENT);
    }

    const state = deriveHistoricalState(combinedStates);
    const warnings = collectAlignmentWarnings({
      datasets,
      missingSymbols,
      commonDateCount: commonDates.length,
      returnedDateCount: selectedDates.length,
      query
    });

    return {
      symbols: canonicalSymbols.slice(),
      state,
      states: orderStates(combinedStates),
      available: missingSymbols.length === 0 && selectedDates.length > 0,
      missingSymbols,
      dates: selectedDates.slice(),
      rows,
      series: recordsBySymbol,
      closes: closesBySymbol,
      dateRange: selectedDates.length > 0
        ? { firstDate: selectedDates[0], lastDate: selectedDates[selectedDates.length - 1] }
        : { firstDate: null, lastDate: null },
      counts: {
        requestedSymbolCount: canonicalSymbols.length,
        availableSymbolCount: canonicalSymbols.length - missingSymbols.length,
        commonObservationCount: commonDates.length,
        returnedObservationCount: selectedDates.length,
        returnObservationCount: Math.max(0, selectedDates.length - 1),
        requiredCloseCount: query.requiredCloseCount
      },
      requested: serializeQuery(query),
      perSymbolStatus,
      provenance: Object.fromEntries(
        datasets.map((dataset) => [dataset.symbol, clonePlain(dataset.status.provenance)])
      ),
      warnings,
      serviceVersion: HISTORICAL_DATA_SERVICE_VERSION
    };
  }

  async getDatasetStatus(symbol, options = {}) {
    const canonicalSymbol = normalizeHistoricalSymbol(symbol);
    const minimumCloseCount = normalizeNonnegativeInteger(
      options.minimumCloseCount,
      this.defaultMinimumCloseCount,
      "minimumCloseCount"
    );
    const dataset = await this.#readDataset(canonicalSymbol, minimumCloseCount, options);
    return clonePlain(dataset.status);
  }

  async #readDataset(symbol, minimumCloseCount, overrides = {}) {
    let rawSeries;
    let rawMetadata;
    try {
      [rawSeries, rawMetadata] = await Promise.all([
        this.storage.getSeries(symbol),
        this.storage.getMetadata(symbol)
      ]);
    } catch (error) {
      throw new HistoricalDataServiceError(
        HISTORICAL_DATA_SERVICE_ERROR_CODES.INDEXED_DB_READ_FAILED,
        `Unable to read normalized historical data for ${symbol} from IndexedDB.`,
        { symbol, cause: serializeSafeError(error) }
      );
    }

    const records = normalizeStoredSeries(rawSeries);
    const status = assessHistoricalDataset({
      symbol,
      records,
      metadata: normalizeStoredMetadata(rawMetadata),
      referenceDate: resolveReferenceDate(overrides.referenceDate, this.now),
      staleAfterCalendarDays: normalizeNonnegativeInteger(
        overrides.staleAfterCalendarDays,
        this.staleAfterCalendarDays,
        "staleAfterCalendarDays"
      ),
      minimumCloseCount
    });

    return { symbol, records, status };
  }
}

export function createHistoricalDataService(options = {}) {
  return new HistoricalDataService(options);
}

export function closesRequiredForReturns(returnCount) {
  if (!Number.isInteger(returnCount) || returnCount < 0) {
    throw new HistoricalDataServiceError(
      HISTORICAL_DATA_SERVICE_ERROR_CODES.INVALID_OPTIONS,
      "returnCount must be a nonnegative integer.",
      { returnCount }
    );
  }
  return returnCount + 1;
}

export function intersectHistoricalDates(seriesBySymbol, symbols) {
  const canonicalSymbols = normalizeSymbolList(symbols || Object.keys(seriesBySymbol || {}));
  const normalized = new Map();
  for (const symbol of canonicalSymbols) {
    const records = seriesBySymbol instanceof Map
      ? seriesBySymbol.get(symbol)
      : seriesBySymbol && seriesBySymbol[symbol];
    normalized.set(symbol, normalizeStoredSeries(records));
  }
  return intersectExactTradingDates(canonicalSymbols, normalized);
}

function normalizeStorageAdapter(storage) {
  if (!storage || typeof storage !== "object") {
    throw new HistoricalDataServiceError(
      HISTORICAL_DATA_SERVICE_ERROR_CODES.INVALID_STORAGE_ADAPTER,
      "An IndexedDB-backed historical storage adapter is required."
    );
  }

  const getSeriesMethod = pickMethod(storage, ["getHistoricalSeries", "getSeries"]);
  const getMetadataMethod = pickMethod(
    storage,
    ["getHistoricalMetadata", "getDatasetMetadata"],
    true
  );

  if (!getSeriesMethod) {
    throw new HistoricalDataServiceError(
      HISTORICAL_DATA_SERVICE_ERROR_CODES.INVALID_STORAGE_ADAPTER,
      "The storage adapter must provide getHistoricalSeries(symbol) or getSeries(symbol)."
    );
  }

  return {
    getSeries: (symbol) => getSeriesMethod(symbol),
    getMetadata: getMetadataMethod
      ? (symbol) => getMetadataMethod(symbol)
      : async () => null
  };
}

function pickMethod(target, names, optional = false) {
  for (const name of names) {
    if (typeof target[name] === "function") {
      return target[name].bind(target);
    }
  }
  return optional ? null : null;
}

function normalizeSeriesOptions(options, defaultMinimumCloseCount) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new HistoricalDataServiceError(
      HISTORICAL_DATA_SERVICE_ERROR_CODES.INVALID_OPTIONS,
      "Historical series options must be an object."
    );
  }

  const startDate = normalizeOptionalDate(options.startDate, "startDate");
  const endDate = normalizeOptionalDate(options.endDate, "endDate");
  if (startDate && endDate && startDate > endDate) {
    throw new HistoricalDataServiceError(
      HISTORICAL_DATA_SERVICE_ERROR_CODES.INVALID_OPTIONS,
      "startDate must not be after endDate.",
      { startDate, endDate }
    );
  }

  const hasReturnCount = options.returnCount !== undefined && options.returnCount !== null;
  const hasCloseCount = options.closeCount !== undefined && options.closeCount !== null;
  if (hasReturnCount && hasCloseCount) {
    throw new HistoricalDataServiceError(
      HISTORICAL_DATA_SERVICE_ERROR_CODES.INVALID_OPTIONS,
      "Specify returnCount or closeCount, not both."
    );
  }

  let returnCount = null;
  let requiredCloseCount = null;
  if (hasReturnCount) {
    returnCount = normalizeNonnegativeInteger(options.returnCount, null, "returnCount");
    requiredCloseCount = returnCount + 1;
  } else if (hasCloseCount) {
    requiredCloseCount = normalizePositiveInteger(options.closeCount, "closeCount");
    returnCount = Math.max(0, requiredCloseCount - 1);
  }

  const minimumCloseCount = normalizeNonnegativeInteger(
    options.minimumCloseCount,
    requiredCloseCount === null ? defaultMinimumCloseCount : requiredCloseCount,
    "minimumCloseCount"
  );
  const windowSide = options.windowSide === undefined ? "latest" : options.windowSide;
  if (windowSide !== "latest" && windowSide !== "earliest") {
    throw new HistoricalDataServiceError(
      HISTORICAL_DATA_SERVICE_ERROR_CODES.INVALID_OPTIONS,
      "windowSide must be latest or earliest.",
      { windowSide }
    );
  }

  return {
    startDate,
    endDate,
    returnCount,
    requiredCloseCount,
    minimumCloseCount,
    windowSide,
    referenceDate: options.referenceDate,
    staleAfterCalendarDays: options.staleAfterCalendarDays
  };
}

function buildQueryStatus(datasetStatus, selectedCount, query) {
  const states = datasetStatus.states.filter((state) => state !== HISTORICAL_DATA_STATES.CURRENT);
  const warnings = datasetStatus.warnings.map(clonePlain);
  if (query.requiredCloseCount !== null && selectedCount < query.requiredCloseCount) {
    if (!states.includes(HISTORICAL_DATA_STATES.INSUFFICIENT)) {
      states.push(HISTORICAL_DATA_STATES.INSUFFICIENT);
    }
    warnings.push({
      code: "HISTORICAL_QUERY_WINDOW_INSUFFICIENT",
      severity: "warning",
      message: `The filtered series contains ${selectedCount} closes; ${query.requiredCloseCount} were requested.`,
      details: {
        selectedCount,
        requiredCloseCount: query.requiredCloseCount,
        startDate: query.startDate,
        endDate: query.endDate
      }
    });
  }
  if (states.length === 0) {
    states.push(HISTORICAL_DATA_STATES.CURRENT);
  }
  return {
    state: deriveHistoricalState(states),
    states: orderStates(states),
    warnings
  };
}

function collectAlignmentWarnings(context) {
  const warnings = [];
  for (const dataset of context.datasets) {
    for (const warning of dataset.status.warnings) {
      warnings.push({ symbol: dataset.symbol, ...clonePlain(warning) });
    }
  }
  if (context.missingSymbols.length > 0) {
    warnings.push({
      code: "HISTORICAL_ALIGNMENT_SYMBOLS_MISSING",
      severity: "error",
      message: `Exact-date alignment cannot be complete because data is missing for ${context.missingSymbols.join(", ")}.`,
      details: { missingSymbols: context.missingSymbols.slice() }
    });
  }
  if (context.query.requiredCloseCount !== null
      && context.returnedDateCount < context.query.requiredCloseCount) {
    warnings.push({
      code: "HISTORICAL_ALIGNMENT_INSUFFICIENT",
      severity: "warning",
      message: `Exact-date alignment produced ${context.returnedDateCount} closes; ${context.query.requiredCloseCount} were requested.`,
      details: {
        commonDateCount: context.commonDateCount,
        returnedDateCount: context.returnedDateCount,
        requiredCloseCount: context.query.requiredCloseCount
      }
    });
  }
  return warnings;
}

function intersectExactTradingDates(symbols, recordsBySymbol) {
  if (symbols.length === 0) {
    return [];
  }
  const firstRecords = recordsBySymbol.get(symbols[0]) || [];
  if (firstRecords.length === 0) {
    return [];
  }

  const otherDateSets = symbols.slice(1).map((symbol) => new Set(
    (recordsBySymbol.get(symbol) || []).map((record) => record.date)
  ));
  return firstRecords
    .map((record) => record.date)
    .filter((date) => otherDateSets.every((dateSet) => dateSet.has(date)));
}

function filterByDateRange(records, startDate, endDate) {
  if (!startDate && !endDate) {
    return records.slice();
  }
  return records.filter((record) => (
    (!startDate || record.date >= startDate)
      && (!endDate || record.date <= endDate)
  ));
}

function selectWindow(values, requiredCount, windowSide) {
  if (requiredCount === null || values.length <= requiredCount) {
    return values.slice();
  }
  return windowSide === "earliest"
    ? values.slice(0, requiredCount)
    : values.slice(values.length - requiredCount);
}

function normalizeStoredSeries(value) {
  const records = Array.isArray(value)
    ? value
    : value && Array.isArray(value.records)
      ? value.records
      : value && Array.isArray(value.candles)
        ? value.candles
        : [];
  return records.map(cloneRecord);
}

function normalizeStoredMetadata(value) {
  if (value && typeof value === "object" && value.metadata && typeof value.metadata === "object") {
    return clonePlain(value.metadata);
  }
  return value && typeof value === "object" ? clonePlain(value) : null;
}

function normalizeSymbolList(symbols) {
  if (!Array.isArray(symbols) || symbols.length === 0) {
    throw new HistoricalDataServiceError(
      HISTORICAL_DATA_SERVICE_ERROR_CODES.INVALID_SYMBOL_LIST,
      "Provide at least one historical symbol."
    );
  }
  const normalized = [];
  for (const symbol of symbols) {
    const canonical = normalizeHistoricalSymbol(symbol);
    if (!normalized.includes(canonical)) {
      normalized.push(canonical);
    }
  }
  return normalized;
}

function normalizeOptionalDate(value, name) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HistoricalDataServiceError(
      HISTORICAL_DATA_SERVICE_ERROR_CODES.INVALID_OPTIONS,
      `${name} must use YYYY-MM-DD.`,
      { [name]: value }
    );
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new HistoricalDataServiceError(
      HISTORICAL_DATA_SERVICE_ERROR_CODES.INVALID_OPTIONS,
      `${name} must be a valid calendar date.`,
      { [name]: value }
    );
  }
  return value;
}

function normalizePositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new HistoricalDataServiceError(
      HISTORICAL_DATA_SERVICE_ERROR_CODES.INVALID_OPTIONS,
      `${name} must be a positive integer.`,
      { [name]: value }
    );
  }
  return value;
}

function normalizeNonnegativeInteger(value, fallback, name) {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (!Number.isInteger(value) || value < 0) {
    throw new HistoricalDataServiceError(
      HISTORICAL_DATA_SERVICE_ERROR_CODES.INVALID_OPTIONS,
      `${name} must be a nonnegative integer.`,
      { [name]: value }
    );
  }
  return value;
}

function resolveReferenceDate(value, now) {
  if (value !== undefined && value !== null) {
    return value;
  }
  return now();
}

function serializeQuery(query) {
  return {
    startDate: query.startDate,
    endDate: query.endDate,
    returnCount: query.returnCount,
    requiredCloseCount: query.requiredCloseCount,
    minimumCloseCount: query.minimumCloseCount,
    windowSide: query.windowSide,
    referenceDate: query.referenceDate === undefined ? null : query.referenceDate,
    staleAfterCalendarDays: query.staleAfterCalendarDays === undefined
      ? null
      : query.staleAfterCalendarDays
  };
}

function getDateRange(records) {
  return records.length > 0
    ? { firstDate: records[0].date, lastDate: records[records.length - 1].date }
    : { firstDate: null, lastDate: null };
}

function orderStates(states) {
  const priority = [
    HISTORICAL_DATA_STATES.ERROR,
    HISTORICAL_DATA_STATES.MISSING,
    HISTORICAL_DATA_STATES.INSUFFICIENT,
    HISTORICAL_DATA_STATES.STALE,
    HISTORICAL_DATA_STATES.QUALITY_WARNING,
    HISTORICAL_DATA_STATES.CURRENT
  ];
  return Array.from(new Set(states)).sort(
    (left, right) => priority.indexOf(left) - priority.indexOf(right)
  );
}

function cloneRecord(record) {
  if (!record || typeof record !== "object") {
    return record;
  }
  return {
    ...record,
    sourcePrecision: record.sourcePrecision ? { ...record.sourcePrecision } : undefined,
    sourceValueText: record.sourceValueText ? { ...record.sourceValueText } : undefined,
    qualityFlags: Array.isArray(record.qualityFlags) ? record.qualityFlags.slice() : []
  };
}

function clonePlain(value) {
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(clonePlain);
  }
  if (typeof value === "object") {
    const output = {};
    for (const [key, nested] of Object.entries(value)) {
      output[key] = clonePlain(nested);
    }
    return output;
  }
  return value;
}

function serializeSafeError(error) {
  if (error && typeof error.toJSON === "function") {
    return clonePlain(error.toJSON());
  }
  return {
    name: error && error.name ? error.name : "Error",
    code: error && error.code ? error.code : null,
    message: error && error.message ? error.message : String(error)
  };
}

export const MONTE_CARLO_HISTORY_DEFAULTS = Object.freeze({
  returnCount: DEFAULT_MONTE_CARLO_RETURN_COUNT,
  closeCount: DEFAULT_MONTE_CARLO_CLOSE_COUNT
});
