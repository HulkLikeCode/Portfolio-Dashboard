import {
  HISTORICAL_IMPORT_ERROR_CODES,
  createHistoricalImportError
} from "./historical-import-errors.js";
import {
  HISTORICAL_FREQUENCY,
  normalizeHistoricalSymbol
} from "./historical-normalizer.js";

const OHLC_FIELDS = Object.freeze(["open", "high", "low", "close"]);

export function validateHistoricalRows(parsedData) {
  if (!parsedData || !Array.isArray(parsedData.rows)) {
    throw createHistoricalImportError(
      HISTORICAL_IMPORT_ERROR_CODES.INVALID_PARSED_DATA,
      "Parsed historical rows are required for validation."
    );
  }

  const rows = parsedData.rows;
  if (rows.length === 0) {
    throw createHistoricalImportError(
      HISTORICAL_IMPORT_ERROR_CODES.NO_RECORDS,
      "The historical file contains no data records."
    );
  }

  const expectedSymbol = normalizeHistoricalSymbol(rows[0].sourceTicker);
  let previousDateKey = null;

  for (const row of rows) {
    validatePeriod(row);
    validateSymbol(row, expectedSymbol);
    validateSequence(row, previousDateKey);
    validateOhlcv(row);
    previousDateKey = row.dateKey;
  }

  return {
    rows: rows.slice(),
    warnings: copyWarnings(parsedData.warnings),
    provenance: {
      ...(parsedData.provenance || {}),
      validatedSymbol: expectedSymbol,
      validatedRecordCount: rows.length,
      ascendingUniqueDates: true,
      ohlcvValidated: true
    }
  };
}

function validatePeriod(row) {
  if (row.period !== HISTORICAL_FREQUENCY) {
    throw createHistoricalImportError(
      HISTORICAL_IMPORT_ERROR_CODES.INVALID_PERIOD,
      `PER must equal ${HISTORICAL_FREQUENCY} for daily historical data.`,
      { lineNumber: row.lineNumber, field: "PER", value: row.period }
    );
  }
}

function validateSymbol(row, expectedSymbol) {
  const rowSymbol = normalizeHistoricalSymbol(row.sourceTicker);
  if (rowSymbol !== expectedSymbol) {
    throw createHistoricalImportError(
      HISTORICAL_IMPORT_ERROR_CODES.MIXED_SYMBOLS,
      "A historical file must contain one symbol only.",
      {
        lineNumber: row.lineNumber,
        field: "TICKER",
        value: row.sourceTicker,
        details: { expectedSymbol, actualSymbol: rowSymbol }
      }
    );
  }
}

function validateSequence(row, previousDateKey) {
  if (previousDateKey === null) {
    return;
  }
  if (row.dateKey === previousDateKey) {
    throw createHistoricalImportError(
      HISTORICAL_IMPORT_ERROR_CODES.DUPLICATE_DATE,
      `Duplicate historical date ${row.date}.`,
      { lineNumber: row.lineNumber, field: "DATE", value: row.dateKey }
    );
  }
  if (row.dateKey < previousDateKey) {
    throw createHistoricalImportError(
      HISTORICAL_IMPORT_ERROR_CODES.UNSORTED_DATE,
      "Historical dates must be in strictly ascending order.",
      {
        lineNumber: row.lineNumber,
        field: "DATE",
        value: row.dateKey,
        details: { previousDateKey }
      }
    );
  }
}

function validateOhlcv(row) {
  for (const field of OHLC_FIELDS) {
    const value = row[field];
    if (!Number.isFinite(value) || value <= 0) {
      throw createHistoricalImportError(
        HISTORICAL_IMPORT_ERROR_CODES.NONPOSITIVE_OHLC,
        `${field.toUpperCase()} must be a finite positive number.`,
        { lineNumber: row.lineNumber, field: field.toUpperCase(), value }
      );
    }
  }

  if (!Number.isFinite(row.volume) || row.volume < 0) {
    throw createHistoricalImportError(
      HISTORICAL_IMPORT_ERROR_CODES.NEGATIVE_VOLUME,
      "VOL must be a finite nonnegative number.",
      { lineNumber: row.lineNumber, field: "VOL", value: row.volume }
    );
  }

  const lowIsBound = row.low <= row.open
    && row.low <= row.high
    && row.low <= row.close;
  const highIsBound = row.high >= row.open
    && row.high >= row.low
    && row.high >= row.close;

  if (!lowIsBound || !highIsBound) {
    throw createHistoricalImportError(
      HISTORICAL_IMPORT_ERROR_CODES.INVALID_OHLC_BOUNDS,
      "OHLC values violate the daily high/low bounds.",
      {
        lineNumber: row.lineNumber,
        details: {
          open: row.open,
          high: row.high,
          low: row.low,
          close: row.close
        }
      }
    );
  }
}

function copyWarnings(warnings) {
  return Array.isArray(warnings)
    ? warnings.map((warning) => ({ ...warning }))
    : [];
}
