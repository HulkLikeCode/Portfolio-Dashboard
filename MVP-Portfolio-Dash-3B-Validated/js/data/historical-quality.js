import { normalizeHistoricalSymbol } from "./historical-normalizer.js";

export const HISTORICAL_QUALITY_VERSION = "2.2-phase-2e";
export const DEFAULT_STALE_AFTER_CALENDAR_DAYS = 7;
export const DEFAULT_MONTE_CARLO_RETURN_COUNT = 756;
export const DEFAULT_MONTE_CARLO_CLOSE_COUNT = 757;

export const HISTORICAL_DATA_STATES = Object.freeze({
  CURRENT: "current",
  MISSING: "missing",
  STALE: "stale",
  INSUFFICIENT: "insufficient",
  QUALITY_WARNING: "quality-warning",
  ERROR: "error"
});

export const HISTORICAL_QUALITY_CODES = Object.freeze({
  MISSING_SERIES: "HISTORICAL_SERIES_MISSING",
  STALE_SERIES: "HISTORICAL_SERIES_STALE",
  INSUFFICIENT_HISTORY: "HISTORICAL_HISTORY_INSUFFICIENT",
  INVALID_RECORD: "HISTORICAL_NORMALIZED_RECORD_INVALID",
  SYMBOL_MISMATCH: "HISTORICAL_SYMBOL_MISMATCH",
  DUPLICATE_DATE: "HISTORICAL_DUPLICATE_DATE",
  UNSORTED_DATE: "HISTORICAL_UNSORTED_DATE",
  METADATA_COUNT_MISMATCH: "HISTORICAL_METADATA_COUNT_MISMATCH",
  METADATA_FIRST_DATE_MISMATCH: "HISTORICAL_METADATA_FIRST_DATE_MISMATCH",
  METADATA_LAST_DATE_MISMATCH: "HISTORICAL_METADATA_LAST_DATE_MISMATCH",
  ADJUSTMENT_METADATA_MISSING: "HISTORICAL_ADJUSTMENT_METADATA_MISSING",
  ADJUSTMENT_METADATA_UNEXPECTED: "HISTORICAL_ADJUSTMENT_METADATA_UNEXPECTED",
  FREQUENCY_METADATA_MISSING: "HISTORICAL_FREQUENCY_METADATA_MISSING",
  FREQUENCY_UNEXPECTED: "HISTORICAL_FREQUENCY_UNEXPECTED",
  SOURCE_METADATA_MISSING: "HISTORICAL_SOURCE_METADATA_MISSING",
  SOURCE_UNEXPECTED: "HISTORICAL_SOURCE_UNEXPECTED",
  FUTURE_LAST_DATE: "HISTORICAL_LAST_DATE_IN_FUTURE",
  RECORD_QUALITY_FLAG: "HISTORICAL_RECORD_QUALITY_FLAG",
  IMPORT_WARNING: "HISTORICAL_IMPORT_WARNING"
});

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REQUIRED_NUMERIC_FIELDS = Object.freeze([
  "open",
  "high",
  "low",
  "close",
  "volume"
]);

/**
 * Evaluates normalized historical candles and their dataset metadata.
 *
 * Freshness uses calendar-day age because Phase 2E must remain local and must
 * not depend on a live holiday/calendar request. The threshold is configurable.
 */
export function assessHistoricalDataset(input = {}) {
  const symbol = normalizeHistoricalSymbol(input.symbol || inferSymbol(input.records));
  const records = normalizeRecords(input.records);
  const metadata = clonePlain(input.metadata || null);
  const referenceDate = normalizeReferenceDate(input.referenceDate);
  const staleAfterCalendarDays = normalizeNonnegativeInteger(
    input.staleAfterCalendarDays,
    DEFAULT_STALE_AFTER_CALENDAR_DAYS,
    "staleAfterCalendarDays"
  );
  const minimumCloseCount = normalizeNonnegativeInteger(
    input.minimumCloseCount,
    DEFAULT_MONTE_CARLO_CLOSE_COUNT,
    "minimumCloseCount"
  );

  const warnings = [];
  const qualityFlagCounts = new Map();
  let validCloseCount = 0;
  let zeroVolumeCount = 0;
  let flaggedRecordCount = 0;
  let previousDate = null;
  const seenDates = new Set();

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const recordIssues = validateNormalizedRecord(record, symbol, index);
    warnings.push(...recordIssues);

    if (Number.isFinite(record.close) && record.close > 0) {
      validCloseCount += 1;
    }
    if (record.volume === 0) {
      zeroVolumeCount += 1;
    }

    if (seenDates.has(record.date)) {
      warnings.push(createWarning(
        HISTORICAL_QUALITY_CODES.DUPLICATE_DATE,
        "error",
        `Duplicate normalized trading date ${record.date}.`,
        { index, date: record.date }
      ));
    }
    seenDates.add(record.date);

    if (previousDate !== null && record.date <= previousDate) {
      warnings.push(createWarning(
        HISTORICAL_QUALITY_CODES.UNSORTED_DATE,
        "error",
        `Normalized trading dates are not strictly ascending at ${record.date}.`,
        { index, date: record.date, previousDate }
      ));
    }
    previousDate = record.date;

    const recordFlags = Array.isArray(record.qualityFlags)
      ? record.qualityFlags.filter((flag) => typeof flag === "string" && flag.trim())
      : [];
    if (recordFlags.length > 0) {
      flaggedRecordCount += 1;
      for (const flag of recordFlags) {
        qualityFlagCounts.set(flag, (qualityFlagCounts.get(flag) || 0) + 1);
      }
    }
  }

  for (const [flag, count] of qualityFlagCounts.entries()) {
    warnings.push(createWarning(
      HISTORICAL_QUALITY_CODES.RECORD_QUALITY_FLAG,
      "warning",
      `${count} normalized record(s) contain quality flag ${flag}.`,
      { flag, count }
    ));
  }

  const firstDate = records.length > 0 ? records[0].date : null;
  const lastDate = records.length > 0 ? records[records.length - 1].date : null;
  const freshnessAgeDays = lastDate
    ? differenceInCalendarDays(lastDate, referenceDate)
    : null;

  if (records.length === 0) {
    warnings.push(createWarning(
      HISTORICAL_QUALITY_CODES.MISSING_SERIES,
      "error",
      `${symbol} has no normalized historical records in IndexedDB.`,
      { symbol }
    ));
  }

  if (records.length > 0 && validCloseCount < minimumCloseCount) {
    warnings.push(createWarning(
      HISTORICAL_QUALITY_CODES.INSUFFICIENT_HISTORY,
      "warning",
      `${symbol} has ${validCloseCount} valid closes; ${minimumCloseCount} are required.`,
      { symbol, validCloseCount, minimumCloseCount }
    ));
  }

  if (freshnessAgeDays !== null && freshnessAgeDays < 0) {
    warnings.push(createWarning(
      HISTORICAL_QUALITY_CODES.FUTURE_LAST_DATE,
      "warning",
      `${symbol} ends on ${lastDate}, after the reference date ${referenceDate}.`,
      { symbol, lastDate, referenceDate, freshnessAgeDays }
    ));
  } else if (freshnessAgeDays !== null && freshnessAgeDays > staleAfterCalendarDays) {
    warnings.push(createWarning(
      HISTORICAL_QUALITY_CODES.STALE_SERIES,
      "warning",
      `${symbol} historical data is ${freshnessAgeDays} calendar days old.`,
      { symbol, lastDate, referenceDate, freshnessAgeDays, staleAfterCalendarDays }
    ));
  }

  const provenance = buildHistoricalProvenance(symbol, records, metadata);
  warnings.push(...validateMetadata({
    symbol,
    records,
    metadata,
    provenance,
    firstDate,
    lastDate
  }));
  warnings.push(...copyMetadataWarnings(metadata));

  const flags = deriveFlags({
    recordCount: records.length,
    validCloseCount,
    minimumCloseCount,
    freshnessAgeDays,
    staleAfterCalendarDays,
    warnings
  });
  const state = choosePrimaryState(flags);

  return {
    symbol,
    state,
    states: flags.slice(),
    available: records.length > 0,
    missing: flags.includes(HISTORICAL_DATA_STATES.MISSING),
    stale: flags.includes(HISTORICAL_DATA_STATES.STALE),
    insufficient: flags.includes(HISTORICAL_DATA_STATES.INSUFFICIENT),
    qualityWarning: flags.includes(HISTORICAL_DATA_STATES.QUALITY_WARNING),
    dateRange: { firstDate, lastDate },
    freshness: {
      referenceDate,
      lastDate,
      ageCalendarDays: freshnessAgeDays,
      staleAfterCalendarDays,
      stale: flags.includes(HISTORICAL_DATA_STATES.STALE)
    },
    counts: {
      recordCount: records.length,
      validCloseCount,
      returnObservationCount: Math.max(0, validCloseCount - 1),
      minimumCloseCount,
      zeroVolumeCount,
      flaggedRecordCount,
      qualityWarningCount: warnings.filter((warning) => warning.severity === "warning").length,
      qualityErrorCount: warnings.filter((warning) => warning.severity === "error").length
    },
    provenance,
    qualityFlags: Array.from(qualityFlagCounts.entries(), ([code, count]) => ({ code, count })),
    warnings: warnings.map(clonePlain),
    qualityVersion: HISTORICAL_QUALITY_VERSION
  };
}

export function deriveHistoricalState(flags) {
  const normalized = Array.isArray(flags) ? flags : [];
  return choosePrimaryState(normalized);
}

export function mergeHistoricalStates(statuses) {
  const flags = [];
  for (const status of Array.isArray(statuses) ? statuses : []) {
    const sourceFlags = Array.isArray(status && status.states)
      ? status.states
      : [status && status.state].filter(Boolean);
    for (const flag of sourceFlags) {
      if (!flags.includes(flag)) {
        flags.push(flag);
      }
    }
  }
  if (flags.length === 0) {
    flags.push(HISTORICAL_DATA_STATES.CURRENT);
  }
  return {
    state: choosePrimaryState(flags),
    states: orderStates(flags)
  };
}

export function buildHistoricalProvenance(symbol, records, metadata) {
  const firstRecord = records[0] || {};
  const sourceHash = firstDefined(
    metadata && metadata.sourceFileHash,
    metadata && metadata.hash,
    metadata && metadata.fileHash,
    firstRecord.sourceFileHash,
    null
  );
  const hashAlgorithm = firstDefined(
    metadata && metadata.sourceFileHashAlgorithm,
    metadata && metadata.hashAlgorithm,
    firstRecord.sourceFileHashAlgorithm,
    null
  );

  return {
    symbol,
    source: firstDefined(metadata && metadata.source, firstRecord.source, null),
    sourceTicker: firstDefined(
      metadata && metadata.sourceTicker,
      metadata && metadata.provenance && metadata.provenance.sourceTicker,
      firstRecord.sourceTicker,
      null
    ),
    frequency: firstDefined(metadata && metadata.frequency, firstRecord.frequency, null),
    priceAdjustment: firstDefined(
      metadata && metadata.priceAdjustment,
      metadata && metadata.provenance && metadata.provenance.priceAdjustment,
      firstRecord.priceAdjustment,
      null
    ),
    dividendAdjustment: firstDefined(
      metadata && metadata.dividendAdjustment,
      metadata && metadata.provenance && metadata.provenance.dividendAdjustment,
      firstRecord.dividendAdjustment,
      null
    ),
    datasetVersion: firstDefined(metadata && metadata.datasetVersion, firstRecord.datasetVersion, null),
    sourceFileHash: sourceHash,
    sourceFileHashAlgorithm: hashAlgorithm,
    sourceFileName: firstDefined(
      metadata && metadata.sourceFileName,
      metadata && metadata.fileName,
      metadata && metadata.provenance && metadata.provenance.sourceFileName,
      null
    ),
    importMode: firstDefined(metadata && metadata.importMode, firstRecord.importMode, null),
    importedAt: firstDefined(
      metadata && metadata.importedAt,
      metadata && metadata.importTimestamp,
      firstRecord.importTimestamp,
      null
    ),
    parserVersion: firstDefined(
      metadata && metadata.parserVersion,
      metadata && metadata.provenance && metadata.provenance.parserVersion,
      null
    ),
    normalizerVersion: firstDefined(
      metadata && metadata.normalizerVersion,
      metadata && metadata.provenance && metadata.provenance.normalizerVersion,
      null
    ),
    volumeSemantics: firstDefined(
      metadata && metadata.volumeSemantics,
      metadata && metadata.provenance && metadata.provenance.volumeSemantics,
      null
    )
  };
}

export function differenceInCalendarDays(earlierDate, laterDate) {
  const earlier = dateOnlyToUtcMilliseconds(earlierDate);
  const later = dateOnlyToUtcMilliseconds(laterDate);
  return Math.floor((later - earlier) / 86400000);
}

function validateNormalizedRecord(record, symbol, index) {
  const warnings = [];
  if (!record || typeof record !== "object") {
    return [createWarning(
      HISTORICAL_QUALITY_CODES.INVALID_RECORD,
      "error",
      `Normalized record ${index} is not an object.`,
      { index }
    )];
  }

  if (record.symbol !== symbol) {
    warnings.push(createWarning(
      HISTORICAL_QUALITY_CODES.SYMBOL_MISMATCH,
      "error",
      `Normalized record ${index} belongs to ${String(record.symbol)}, not ${symbol}.`,
      { index, expectedSymbol: symbol, actualSymbol: record.symbol }
    ));
  }

  if (!isValidDateOnly(record.date)) {
    warnings.push(createWarning(
      HISTORICAL_QUALITY_CODES.INVALID_RECORD,
      "error",
      `Normalized record ${index} has invalid date ${String(record.date)}.`,
      { index, field: "date", value: record.date }
    ));
  }

  for (const field of REQUIRED_NUMERIC_FIELDS) {
    const value = record[field];
    const valid = field === "volume"
      ? Number.isFinite(value) && value >= 0
      : Number.isFinite(value) && value > 0;
    if (!valid) {
      warnings.push(createWarning(
        HISTORICAL_QUALITY_CODES.INVALID_RECORD,
        "error",
        `Normalized record ${index} has invalid ${field}.`,
        { index, field, value }
      ));
    }
  }

  if (Number.isFinite(record.high) && Number.isFinite(record.low)
      && Number.isFinite(record.open) && Number.isFinite(record.close)
      && (record.high < Math.max(record.open, record.close, record.low)
        || record.low > Math.min(record.open, record.close, record.high))) {
    warnings.push(createWarning(
      HISTORICAL_QUALITY_CODES.INVALID_RECORD,
      "error",
      `Normalized record ${index} violates OHLC bounds.`,
      { index, date: record.date }
    ));
  }

  return warnings;
}

function validateMetadata(context) {
  const { symbol, records, metadata, provenance, firstDate, lastDate } = context;
  const warnings = [];
  const storedCount = firstFiniteInteger(
    metadata && metadata.recordCount,
    metadata && metadata.normalizedRecordCount,
    metadata && metadata.observationCount,
    metadata && metadata.count
  );

  if (storedCount !== null && storedCount !== records.length) {
    warnings.push(createWarning(
      HISTORICAL_QUALITY_CODES.METADATA_COUNT_MISMATCH,
      "warning",
      `${symbol} metadata reports ${storedCount} records, but IndexedDB returned ${records.length}.`,
      { symbol, storedCount, actualCount: records.length }
    ));
  }

  const storedFirstDate = metadata && metadata.firstDate;
  if (storedFirstDate && firstDate && storedFirstDate !== firstDate) {
    warnings.push(createWarning(
      HISTORICAL_QUALITY_CODES.METADATA_FIRST_DATE_MISMATCH,
      "warning",
      `${symbol} metadata first date ${storedFirstDate} does not match ${firstDate}.`,
      { symbol, storedFirstDate, actualFirstDate: firstDate }
    ));
  }

  const storedLastDate = metadata && metadata.lastDate;
  if (storedLastDate && lastDate && storedLastDate !== lastDate) {
    warnings.push(createWarning(
      HISTORICAL_QUALITY_CODES.METADATA_LAST_DATE_MISMATCH,
      "warning",
      `${symbol} metadata last date ${storedLastDate} does not match ${lastDate}.`,
      { symbol, storedLastDate, actualLastDate: lastDate }
    ));
  }

  if (!provenance.priceAdjustment || !provenance.dividendAdjustment) {
    warnings.push(createWarning(
      HISTORICAL_QUALITY_CODES.ADJUSTMENT_METADATA_MISSING,
      "warning",
      `${symbol} adjustment metadata is incomplete.`,
      {
        symbol,
        priceAdjustment: provenance.priceAdjustment,
        dividendAdjustment: provenance.dividendAdjustment
      }
    ));
  } else if (provenance.priceAdjustment !== "split-adjusted"
      || provenance.dividendAdjustment !== "none") {
    warnings.push(createWarning(
      HISTORICAL_QUALITY_CODES.ADJUSTMENT_METADATA_UNEXPECTED,
      "warning",
      `${symbol} adjustment metadata differs from the approved Stooq methodology.`,
      {
        symbol,
        priceAdjustment: provenance.priceAdjustment,
        dividendAdjustment: provenance.dividendAdjustment
      }
    ));
  }

  if (!provenance.frequency) {
    warnings.push(createWarning(
      HISTORICAL_QUALITY_CODES.FREQUENCY_METADATA_MISSING,
      "warning",
      `${symbol} frequency metadata is missing.`,
      { symbol }
    ));
  } else if (provenance.frequency !== "D") {
    warnings.push(createWarning(
      HISTORICAL_QUALITY_CODES.FREQUENCY_UNEXPECTED,
      "warning",
      `${symbol} frequency ${provenance.frequency} is not daily.`,
      { symbol, frequency: provenance.frequency }
    ));
  }

  if (!provenance.source) {
    warnings.push(createWarning(
      HISTORICAL_QUALITY_CODES.SOURCE_METADATA_MISSING,
      "warning",
      `${symbol} source metadata is missing.`,
      { symbol }
    ));
  } else if (String(provenance.source).toLowerCase() !== "stooq") {
    warnings.push(createWarning(
      HISTORICAL_QUALITY_CODES.SOURCE_UNEXPECTED,
      "warning",
      `${symbol} source ${provenance.source} is not the approved Stooq source.`,
      { symbol, source: provenance.source }
    ));
  }

  return warnings;
}

function copyMetadataWarnings(metadata) {
  const sourceWarnings = [];
  if (metadata && Array.isArray(metadata.warnings)) {
    sourceWarnings.push(...metadata.warnings);
  }
  if (metadata && metadata.provenance && Array.isArray(metadata.provenance.warnings)) {
    sourceWarnings.push(...metadata.provenance.warnings);
  }

  return sourceWarnings.map((warning) => {
    const severity = warning && ["info", "warning", "error"].includes(warning.severity)
      ? warning.severity
      : "warning";
    return createWarning(
      warning && warning.code ? warning.code : HISTORICAL_QUALITY_CODES.IMPORT_WARNING,
      severity,
      warning && warning.message ? warning.message : "Historical import warning.",
      warning && typeof warning === "object" ? warning : { value: warning }
    );
  });
}

function deriveFlags(context) {
  const flags = [];
  if (context.recordCount === 0) {
    flags.push(HISTORICAL_DATA_STATES.MISSING);
  }
  if (context.validCloseCount < context.minimumCloseCount) {
    flags.push(HISTORICAL_DATA_STATES.INSUFFICIENT);
  }
  if (context.freshnessAgeDays !== null
      && context.freshnessAgeDays > context.staleAfterCalendarDays) {
    flags.push(HISTORICAL_DATA_STATES.STALE);
  }
  if (context.warnings.some((warning) => (
    (warning.severity === "warning" || warning.severity === "error")
      && warning.code !== HISTORICAL_QUALITY_CODES.MISSING_SERIES
      && warning.code !== HISTORICAL_QUALITY_CODES.INSUFFICIENT_HISTORY
      && warning.code !== HISTORICAL_QUALITY_CODES.STALE_SERIES
  ))) {
    flags.push(HISTORICAL_DATA_STATES.QUALITY_WARNING);
  }
  if (flags.length === 0) {
    flags.push(HISTORICAL_DATA_STATES.CURRENT);
  }
  return orderStates(flags);
}

function choosePrimaryState(flags) {
  const ordered = orderStates(flags);
  return ordered[0] || HISTORICAL_DATA_STATES.CURRENT;
}

function orderStates(flags) {
  const priority = [
    HISTORICAL_DATA_STATES.ERROR,
    HISTORICAL_DATA_STATES.MISSING,
    HISTORICAL_DATA_STATES.INSUFFICIENT,
    HISTORICAL_DATA_STATES.STALE,
    HISTORICAL_DATA_STATES.QUALITY_WARNING,
    HISTORICAL_DATA_STATES.CURRENT
  ];
  const unique = Array.from(new Set(flags.filter(Boolean)));
  return unique.sort((left, right) => priority.indexOf(left) - priority.indexOf(right));
}

function normalizeRecords(records) {
  if (!Array.isArray(records)) {
    return [];
  }
  return records.map((record) => clonePlain(record));
}

function inferSymbol(records) {
  if (Array.isArray(records) && records[0] && records[0].symbol) {
    return records[0].symbol;
  }
  throw new TypeError("A historical symbol is required.");
}

function normalizeReferenceDate(value) {
  if (typeof value === "string" && isValidDateOnly(value)) {
    return value;
  }
  const date = value instanceof Date
    ? value
    : value !== undefined && value !== null
      ? new Date(value)
      : new Date();
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("referenceDate must be a valid Date or YYYY-MM-DD string.");
  }
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function isValidDateOnly(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function dateOnlyToUtcMilliseconds(value) {
  if (!isValidDateOnly(value)) {
    throw new TypeError(`Invalid date-only value: ${String(value)}.`);
  }
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function normalizeNonnegativeInteger(value, fallback, name) {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a nonnegative integer.`);
  }
  return value;
}

function firstFiniteInteger(...values) {
  for (const value of values) {
    if (Number.isInteger(value) && value >= 0) {
      return value;
    }
  }
  return null;
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return null;
}

function createWarning(code, severity, message, details = {}) {
  return {
    code,
    severity,
    message,
    details: clonePlain(details)
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
