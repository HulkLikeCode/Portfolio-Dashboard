import {
  HISTORICAL_IMPORT_ERROR_CODES,
  createHistoricalImportError
} from "./historical-import-errors.js";
import { validateHistoricalRows } from "./historical-validator.js";
import { normalizeHistoricalRows } from "./historical-normalizer.js";

export const STOOQ_HISTORICAL_COLUMNS = Object.freeze([
  "<TICKER>",
  "<PER>",
  "<DATE>",
  "<TIME>",
  "<OPEN>",
  "<HIGH>",
  "<LOW>",
  "<CLOSE>",
  "<VOL>",
  "<OPENINT>"
]);

export const STOOQ_HISTORICAL_HEADER = STOOQ_HISTORICAL_COLUMNS.join(",");
export const PARSER_VERSION = "2.2-phase-2b";

const FIELD_NAMES = Object.freeze([
  "TICKER",
  "PER",
  "DATE",
  "TIME",
  "OPEN",
  "HIGH",
  "LOW",
  "CLOSE",
  "VOL",
  "OPENINT"
]);

const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

export function parseHistoricalFile(sourceText, options = {}) {
  if (typeof sourceText !== "string") {
    throw createHistoricalImportError(
      HISTORICAL_IMPORT_ERROR_CODES.INPUT_NOT_TEXT,
      "Historical file input must be text."
    );
  }

  const text = stripLeadingBom(sourceText);
  if (text.length === 0 || text.trim().length === 0) {
    throw createHistoricalImportError(
      HISTORICAL_IMPORT_ERROR_CODES.EMPTY_FILE,
      "The historical file is empty."
    );
  }

  const lines = text.split(/\r\n|\n|\r/);
  const header = lines[0];
  if (header !== STOOQ_HISTORICAL_HEADER) {
    throw createHistoricalImportError(
      HISTORICAL_IMPORT_ERROR_CODES.INVALID_HEADER,
      "Historical file header does not exactly match the required Stooq header.",
      {
        lineNumber: 1,
        details: { expected: STOOQ_HISTORICAL_HEADER, actual: header }
      }
    );
  }

  const rows = [];
  let blankLineCount = 0;
  let trimmedFieldCount = 0;
  let nonstandardTimeCount = 0;
  let nonzeroOpenInterestCount = 0;

  for (let index = 1; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const line = lines[index];

    if (line.trim() === "") {
      if (index !== lines.length - 1) {
        blankLineCount += 1;
      }
      continue;
    }

    const rawCells = line.split(",");
    if (rawCells.length !== FIELD_NAMES.length) {
      throw createHistoricalImportError(
        HISTORICAL_IMPORT_ERROR_CODES.INVALID_COLUMN_COUNT,
        `Expected ${FIELD_NAMES.length} comma-separated values.`,
        {
          lineNumber,
          details: {
            expectedColumnCount: FIELD_NAMES.length,
            actualColumnCount: rawCells.length
          }
        }
      );
    }

    const cells = rawCells.map((cell) => {
      const trimmed = cell.trim();
      if (trimmed !== cell) {
        trimmedFieldCount += 1;
      }
      return trimmed;
    });

    for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
      if (cells[cellIndex] === "") {
        throw createHistoricalImportError(
          HISTORICAL_IMPORT_ERROR_CODES.MISSING_VALUE,
          `${FIELD_NAMES[cellIndex]} is required.`,
          { lineNumber, field: FIELD_NAMES[cellIndex] }
        );
      }
    }

    const dateResult = parseCalendarDate(cells[2], lineNumber);
    const open = parseDecimal(cells[4], "OPEN", lineNumber);
    const high = parseDecimal(cells[5], "HIGH", lineNumber);
    const low = parseDecimal(cells[6], "LOW", lineNumber);
    const close = parseDecimal(cells[7], "CLOSE", lineNumber);
    const volume = parseDecimal(cells[8], "VOL", lineNumber);

    if (cells[3] !== "000000") {
      nonstandardTimeCount += 1;
    }
    if (!isZeroDecimalText(cells[9])) {
      nonzeroOpenInterestCount += 1;
    }

    rows.push({
      lineNumber,
      sourceTicker: cells[0],
      period: cells[1],
      date: dateResult.isoDate,
      dateKey: dateResult.dateKey,
      open,
      high,
      low,
      close,
      volume,
      sourcePrecision: {
        open: countDecimalPlaces(cells[4]),
        high: countDecimalPlaces(cells[5]),
        low: countDecimalPlaces(cells[6]),
        close: countDecimalPlaces(cells[7]),
        volume: countDecimalPlaces(cells[8])
      },
      sourceValueText: {
        open: cells[4],
        high: cells[5],
        low: cells[6],
        close: cells[7],
        volume: cells[8]
      },
      ignoredSourceFields: { time: cells[3], openInterest: cells[9] }
    });
  }

  if (rows.length === 0) {
    throw createHistoricalImportError(
      HISTORICAL_IMPORT_ERROR_CODES.NO_RECORDS,
      "The historical file contains a header but no data records."
    );
  }

  const warnings = [];
  if (blankLineCount > 0) {
    warnings.push({
      code: "HISTORICAL_BLANK_LINES_IGNORED",
      severity: "info",
      message: `${blankLineCount} blank line(s) were ignored.`,
      count: blankLineCount
    });
  }
  if (trimmedFieldCount > 0) {
    warnings.push({
      code: "HISTORICAL_FIELD_WHITESPACE_TRIMMED",
      severity: "warning",
      message: `${trimmedFieldCount} field value(s) contained surrounding whitespace and were trimmed.`,
      count: trimmedFieldCount
    });
  }
  if (nonstandardTimeCount > 0) {
    warnings.push({
      code: "HISTORICAL_DAILY_TIME_IGNORED",
      severity: "warning",
      message: `${nonstandardTimeCount} daily TIME value(s) were not 000000 and were ignored.`,
      count: nonstandardTimeCount
    });
  }
  if (nonzeroOpenInterestCount > 0) {
    warnings.push({
      code: "HISTORICAL_OPENINT_IGNORED",
      severity: "warning",
      message: `${nonzeroOpenInterestCount} nonzero OPENINT value(s) were ignored.`,
      count: nonzeroOpenInterestCount
    });
  }

  const parsedAt = typeof options.parsedAt === "string" && options.parsedAt
    ? options.parsedAt
    : new Date().toISOString();

  return {
    rows,
    warnings,
    provenance: {
      source: "Stooq",
      sourceFileName: sanitizeFileName(options.fileName),
      sourceHeader: STOOQ_HISTORICAL_HEADER,
      sourceFormat: "stooq-us-daily-ohlcv-text",
      parsedRecordCount: rows.length,
      parserVersion: PARSER_VERSION,
      parsedAt
    }
  };
}

export function parseAndNormalizeHistoricalFile(sourceText, options = {}) {
  const parsed = parseHistoricalFile(sourceText, options);
  const validated = validateHistoricalRows(parsed);
  return normalizeHistoricalRows(validated, options);
}

export function parseHistoricalCalendarDate(dateText, lineNumber = null) {
  return parseCalendarDate(dateText, lineNumber).isoDate;
}

function parseCalendarDate(value, lineNumber) {
  if (!/^\d{8}$/.test(value)) {
    throw createHistoricalImportError(
      HISTORICAL_IMPORT_ERROR_CODES.INVALID_DATE,
      "DATE must use exactly eight digits in YYYYMMDD format.",
      { lineNumber, field: "DATE", value }
    );
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));

  if (year < 1 || month < 1 || month > 12) {
    throw invalidDateError(value, lineNumber);
  }
  const maxDay = daysInMonth(year, month);
  if (day < 1 || day > maxDay) {
    throw invalidDateError(value, lineNumber);
  }

  return {
    dateKey: value,
    isoDate: `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
  };
}

function invalidDateError(value, lineNumber) {
  return createHistoricalImportError(
    HISTORICAL_IMPORT_ERROR_CODES.INVALID_DATE,
    "DATE is not a valid calendar date.",
    { lineNumber, field: "DATE", value }
  );
}

function daysInMonth(year, month) {
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthLengths = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return monthLengths[month - 1];
}

function parseDecimal(value, field, lineNumber) {
  if (!DECIMAL_PATTERN.test(value)) {
    throw createHistoricalImportError(
      HISTORICAL_IMPORT_ERROR_CODES.INVALID_NUMBER,
      `${field} must be a finite decimal number.`,
      { lineNumber, field, value }
    );
  }
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    throw createHistoricalImportError(
      HISTORICAL_IMPORT_ERROR_CODES.INVALID_NUMBER,
      `${field} must be a finite decimal number.`,
      { lineNumber, field, value }
    );
  }
  return numberValue;
}

function countDecimalPlaces(value) {
  const decimalIndex = value.indexOf(".");
  return decimalIndex === -1 ? 0 : value.length - decimalIndex - 1;
}

function isZeroDecimalText(value) {
  return /^[+-]?0+(?:\.0*)?$/.test(value);
}

function stripLeadingBom(value) {
  return value.charCodeAt(0) === 0xFEFF ? value.slice(1) : value;
}

function sanitizeFileName(fileName) {
  if (typeof fileName !== "string" || fileName.trim() === "") {
    return null;
  }
  const pathParts = fileName.trim().split(/[\\/]/);
  return pathParts[pathParts.length - 1] || null;
}
