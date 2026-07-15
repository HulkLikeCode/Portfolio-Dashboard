/**
 * Historical import error types.
 *
 * These errors are safe for display in local Diagnostics and import UI.
 * They never include complete source-file contents.
 */

export const HISTORICAL_IMPORT_ERROR_CODES = Object.freeze({
  INPUT_NOT_TEXT: "HISTORICAL_INPUT_NOT_TEXT",
  EMPTY_FILE: "HISTORICAL_EMPTY_FILE",
  INVALID_HEADER: "HISTORICAL_INVALID_HEADER",
  INVALID_COLUMN_COUNT: "HISTORICAL_INVALID_COLUMN_COUNT",
  MISSING_VALUE: "HISTORICAL_MISSING_VALUE",
  INVALID_TICKER: "HISTORICAL_INVALID_TICKER",
  INVALID_PERIOD: "HISTORICAL_INVALID_PERIOD",
  INVALID_DATE: "HISTORICAL_INVALID_DATE",
  INVALID_NUMBER: "HISTORICAL_INVALID_NUMBER",
  NO_RECORDS: "HISTORICAL_NO_RECORDS",
  MIXED_SYMBOLS: "HISTORICAL_MIXED_SYMBOLS",
  DUPLICATE_DATE: "HISTORICAL_DUPLICATE_DATE",
  UNSORTED_DATE: "HISTORICAL_UNSORTED_DATE",
  NONPOSITIVE_OHLC: "HISTORICAL_NONPOSITIVE_OHLC",
  NEGATIVE_VOLUME: "HISTORICAL_NEGATIVE_VOLUME",
  INVALID_OHLC_BOUNDS: "HISTORICAL_INVALID_OHLC_BOUNDS",
  INVALID_PARSED_DATA: "HISTORICAL_INVALID_PARSED_DATA"
});

export class HistoricalImportError extends Error {
  constructor(code, message, context = {}) {
    super(message);
    this.name = "HistoricalImportError";
    this.code = code;
    this.lineNumber = Number.isInteger(context.lineNumber)
      ? context.lineNumber
      : null;
    this.field = typeof context.field === "string" ? context.field : null;
    this.value = Object.prototype.hasOwnProperty.call(context, "value")
      ? context.value
      : null;
    this.details = context.details && typeof context.details === "object"
      ? { ...context.details }
      : {};

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HistoricalImportError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      lineNumber: this.lineNumber,
      field: this.field,
      value: this.value,
      details: { ...this.details }
    };
  }
}

export function isHistoricalImportError(error) {
  return error instanceof HistoricalImportError;
}

export function createHistoricalImportError(code, message, context = {}) {
  return new HistoricalImportError(code, message, context);
}
