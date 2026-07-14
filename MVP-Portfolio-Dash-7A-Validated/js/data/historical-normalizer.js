import {
  HISTORICAL_IMPORT_ERROR_CODES,
  createHistoricalImportError
} from "./historical-import-errors.js";

export const HISTORICAL_SOURCE = "Stooq";
export const HISTORICAL_FREQUENCY = "D";
export const PRICE_ADJUSTMENT = "split-adjusted";
export const DIVIDEND_ADJUSTMENT = "none";
export const NORMALIZER_VERSION = "2.2-phase-2b";

const SYMBOL_PATTERN = /^[A-Z0-9][A-Z0-9.-]*$/;

export function normalizeHistoricalSymbol(sourceTicker) {
  if (typeof sourceTicker !== "string") {
    throw createHistoricalImportError(
      HISTORICAL_IMPORT_ERROR_CODES.INVALID_TICKER,
      "Ticker must be text.",
      { field: "TICKER", value: sourceTicker }
    );
  }

  const upperTicker = sourceTicker.trim().toUpperCase();
  const symbol = upperTicker.endsWith(".US")
    ? upperTicker.slice(0, -3)
    : upperTicker;

  if (!symbol || !SYMBOL_PATTERN.test(symbol)) {
    throw createHistoricalImportError(
      HISTORICAL_IMPORT_ERROR_CODES.INVALID_TICKER,
      "Ticker is not a supported U.S. stock or ETF symbol.",
      { field: "TICKER", value: sourceTicker }
    );
  }

  return symbol;
}

export function normalizeHistoricalRows(validatedData, options = {}) {
  if (!validatedData || !Array.isArray(validatedData.rows)) {
    throw createHistoricalImportError(
      HISTORICAL_IMPORT_ERROR_CODES.INVALID_PARSED_DATA,
      "Validated historical rows are required before normalization."
    );
  }

  const rows = validatedData.rows;
  if (rows.length === 0) {
    throw createHistoricalImportError(
      HISTORICAL_IMPORT_ERROR_CODES.NO_RECORDS,
      "The historical file contains no data records."
    );
  }

  const symbol = normalizeHistoricalSymbol(rows[0].sourceTicker);
  const sourceTicker = rows[0].sourceTicker.trim().toUpperCase();
  const normalizedAt = resolveTimestamp(
    options.normalizedAt,
    validatedData.provenance && validatedData.provenance.parsedAt
  );

  const records = rows.map((row) => {
    const qualityFlags = [];
    if (row.volume === 0) {
      qualityFlags.push("zero-volume");
    }

    return {
      symbol,
      date: row.date,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume,
      frequency: HISTORICAL_FREQUENCY,
      source: HISTORICAL_SOURCE,
      sourceTicker: row.sourceTicker.trim().toUpperCase(),
      priceAdjustment: PRICE_ADJUSTMENT,
      dividendAdjustment: DIVIDEND_ADJUSTMENT,
      sourcePrecision: {
        open: row.sourcePrecision.open,
        high: row.sourcePrecision.high,
        low: row.sourcePrecision.low,
        close: row.sourcePrecision.close,
        volume: row.sourcePrecision.volume
      },
      sourceValueText: {
        open: row.sourceValueText.open,
        high: row.sourceValueText.high,
        low: row.sourceValueText.low,
        close: row.sourceValueText.close,
        volume: row.sourceValueText.volume
      },
      qualityFlags
    };
  });

  const warnings = copyWarnings(validatedData.warnings);
  if (sourceTicker !== symbol) {
    warnings.push({
      code: "HISTORICAL_SYMBOL_SUFFIX_NORMALIZED",
      severity: "info",
      message: `Normalized source ticker ${sourceTicker} to ${symbol}.`,
      count: 1
    });
  }

  const zeroVolumeCount = records.reduce(
    (count, record) => count + (record.volume === 0 ? 1 : 0),
    0
  );
  if (zeroVolumeCount > 0) {
    warnings.push({
      code: "HISTORICAL_ZERO_VOLUME_ROWS",
      severity: "warning",
      message: `${zeroVolumeCount} record(s) contain zero source-provided volume.`,
      count: zeroVolumeCount
    });
  }

  const provenance = {
    ...(validatedData.provenance || {}),
    source: HISTORICAL_SOURCE,
    sourceTicker,
    symbol,
    frequency: HISTORICAL_FREQUENCY,
    priceAdjustment: PRICE_ADJUSTMENT,
    dividendAdjustment: DIVIDEND_ADJUSTMENT,
    volumeSemantics: "source-provided; not assumed to be raw exchange share volume",
    normalizedRecordCount: records.length,
    firstDate: records[0].date,
    lastDate: records[records.length - 1].date,
    normalizerVersion: NORMALIZER_VERSION,
    normalizedAt
  };

  return { records, warnings, provenance };
}

function resolveTimestamp(primaryValue, fallbackValue) {
  if (typeof primaryValue === "string" && primaryValue) {
    return primaryValue;
  }
  if (typeof fallbackValue === "string" && fallbackValue) {
    return fallbackValue;
  }
  return new Date().toISOString();
}

function copyWarnings(warnings) {
  return Array.isArray(warnings)
    ? warnings.map((warning) => ({ ...warning }))
    : [];
}
