import { isFutureDate, normalizeDateOnly, resolveReferenceDate } from "../utils/date-utils.js";
import { toFiniteNumber } from "../utils/number-utils.js";
import { TICKER_PATTERN } from "./lot-model.js";

export const PORTFOLIO_VALIDATION_VERSION = "2.2-phase-3a";

export class PortfolioValidationError extends Error {
  constructor(errors, message = "Portfolio validation failed.") {
    super(message);
    this.name = "PortfolioValidationError";
    this.code = "PORTFOLIO_VALIDATION_FAILED";
    this.errors = Array.isArray(errors) ? errors.map((error) => ({ ...error })) : [];
  }
}

export function validateTicker(value, path = "ticker") {
  const errors = [];
  if (typeof value !== "string" || !value.trim()) {
    errors.push(issue("PORTFOLIO_TICKER_REQUIRED", path, "Ticker is required."));
    return { valid: false, value: null, errors };
  }
  const ticker = value.trim().toUpperCase();
  if (!TICKER_PATTERN.test(ticker)) {
    errors.push(issue(
      "PORTFOLIO_TICKER_INVALID",
      path,
      "Ticker must start with a letter and contain only letters, numbers, periods, or hyphens.",
      value
    ));
  }
  return { valid: errors.length === 0, value: ticker, errors };
}

export function validateLot(input, options = {}) {
  const path = options.path || "lot";
  const referenceDate = resolveReferenceDate(options.referenceDate, options.now);
  const errors = [];
  if (!isRecord(input)) {
    return invalidResult(issue("PORTFOLIO_LOT_MALFORMED", path, "Lot must be an object.", input));
  }

  const tickerResult = validateTicker(input.ticker, `${path}.ticker`);
  errors.push(...tickerResult.errors);
  const shares = validatePositiveNumber(input.shares, `${path}.shares`, "PORTFOLIO_SHARES");
  errors.push(...shares.errors);
  const purchaseSource = input.purchasePricePerShare !== undefined
    ? input.purchasePricePerShare
    : input.purchasePrice;
  const price = validatePositiveNumber(
    purchaseSource,
    `${path}.purchasePricePerShare`,
    "PORTFOLIO_PURCHASE_PRICE"
  );
  errors.push(...price.errors);

  let acquisitionDate = null;
  if (input.acquisitionDate === undefined || input.acquisitionDate === null || input.acquisitionDate === "") {
    errors.push(issue(
      "PORTFOLIO_ACQUISITION_DATE_REQUIRED",
      `${path}.acquisitionDate`,
      "Acquisition date is required."
    ));
  } else {
    try {
      acquisitionDate = normalizeDateOnly(input.acquisitionDate, "acquisitionDate");
      if (isFutureDate(acquisitionDate, referenceDate)) {
        errors.push(issue(
          "PORTFOLIO_ACQUISITION_DATE_FUTURE",
          `${path}.acquisitionDate`,
          "Acquisition date must not be in the future.",
          input.acquisitionDate
        ));
      }
    } catch (_error) {
      errors.push(issue(
        "PORTFOLIO_ACQUISITION_DATE_INVALID",
        `${path}.acquisitionDate`,
        "Acquisition date must be a valid YYYY-MM-DD calendar date.",
        input.acquisitionDate
      ));
    }
  }

  const auditNote = input.auditNote === undefined || input.auditNote === null
    ? ""
    : input.auditNote;
  if (typeof auditNote !== "string") {
    errors.push(issue(
      "PORTFOLIO_AUDIT_NOTE_INVALID",
      `${path}.auditNote`,
      "Audit note must be a string.",
      auditNote
    ));
  }
  validateOptionalId(input.id, `${path}.id`, "PORTFOLIO_LOT_ID_INVALID", errors);
  if (input.recordType !== undefined && input.recordType !== "lot") {
    errors.push(issue(
      "PORTFOLIO_LOT_RECORD_TYPE_INVALID",
      `${path}.recordType`,
      "Lot recordType must be lot when present.",
      input.recordType
    ));
  }

  return {
    valid: errors.length === 0,
    errors,
    normalized: errors.length === 0 ? {
      ...input,
      recordType: "lot",
      ticker: tickerResult.value,
      shares: shares.value,
      purchasePricePerShare: price.value,
      acquisitionDate,
      auditNote: auditNote.trim()
    } : null
  };
}

export function validateHolding(input, options = {}) {
  const path = options.path || "holding";
  const errors = [];
  if (!isRecord(input)) {
    return invalidResult(issue("PORTFOLIO_HOLDING_MALFORMED", path, "Holding must be an object.", input));
  }

  const tickerResult = validateTicker(input.ticker, `${path}.ticker`);
  errors.push(...tickerResult.errors);
  validateOptionalId(input.id, `${path}.id`, "PORTFOLIO_HOLDING_ID_INVALID", errors);
  if (input.recordType !== undefined && input.recordType !== "holding") {
    errors.push(issue(
      "PORTFOLIO_HOLDING_RECORD_TYPE_INVALID",
      `${path}.recordType`,
      "Holding recordType must be holding when present.",
      input.recordType
    ));
  }
  if (input.active !== undefined && typeof input.active !== "boolean") {
    errors.push(issue(
      "PORTFOLIO_HOLDING_ACTIVE_INVALID",
      `${path}.active`,
      "Holding active must be a boolean.",
      input.active
    ));
  }
  if (!Array.isArray(input.lots)) {
    errors.push(issue("PORTFOLIO_LOTS_MALFORMED", `${path}.lots`, "Holding lots must be an array.", input.lots));
    return { valid: false, errors, normalized: null };
  }
  if (input.lots.length === 0) {
    errors.push(issue("PORTFOLIO_LOTS_REQUIRED", `${path}.lots`, "A holding must contain at least one lot."));
  }

  const normalizedLots = [];
  const lotIds = new Set();
  input.lots.forEach((lot, index) => {
    const result = validateLot(lot, {
      ...options,
      path: `${path}.lots[${index}]`
    });
    errors.push(...result.errors);
    if (result.normalized) {
      normalizedLots.push(result.normalized);
      if (tickerResult.value && result.normalized.ticker !== tickerResult.value) {
        errors.push(issue(
          "PORTFOLIO_LOT_TICKER_MISMATCH",
          `${path}.lots[${index}].ticker`,
          "Each lot ticker must match its holding ticker.",
          result.normalized.ticker
        ));
      }
      if (result.normalized.id) {
        if (lotIds.has(result.normalized.id)) {
          errors.push(issue(
            "PORTFOLIO_DUPLICATE_LOT_ID",
            `${path}.lots[${index}].id`,
            "Lot ids must be unique within a holding.",
            result.normalized.id
          ));
        }
        lotIds.add(result.normalized.id);
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    normalized: errors.length === 0 ? {
      ...input,
      recordType: "holding",
      ticker: tickerResult.value,
      active: input.active !== false,
      lots: normalizedLots
    } : null
  };
}

export function validatePortfolio(input, options = {}) {
  const errors = [];
  if (!isRecord(input)) {
    return invalidResult(issue("PORTFOLIO_MALFORMED", "portfolio", "Portfolio must be an object.", input));
  }
  if (input.recordType !== undefined && input.recordType !== "portfolio") {
    errors.push(issue(
      "PORTFOLIO_RECORD_TYPE_INVALID",
      "portfolio.recordType",
      "Portfolio recordType must be portfolio when present.",
      input.recordType
    ));
  }
  validateOptionalId(input.id, "portfolio.id", "PORTFOLIO_ID_INVALID", errors);
  if (input.name !== undefined && typeof input.name !== "string") {
    errors.push(issue("PORTFOLIO_NAME_INVALID", "portfolio.name", "Portfolio name must be a string.", input.name));
  }
  if (!Array.isArray(input.holdings)) {
    errors.push(issue(
      "PORTFOLIO_HOLDINGS_MALFORMED",
      "portfolio.holdings",
      "Portfolio holdings must be an array.",
      input.holdings
    ));
    return { valid: false, errors, normalized: null };
  }
  if (input.benchmarks !== undefined && !Array.isArray(input.benchmarks)) {
    errors.push(issue(
      "PORTFOLIO_BENCHMARKS_MALFORMED",
      "portfolio.benchmarks",
      "Benchmarks must remain a separate array when present.",
      input.benchmarks
    ));
  }

  const normalizedHoldings = [];
  const tickers = new Set();
  const holdingIds = new Set();
  input.holdings.forEach((holding, index) => {
    const result = validateHolding(holding, {
      ...options,
      path: `portfolio.holdings[${index}]`
    });
    errors.push(...result.errors);
    if (result.normalized) {
      normalizedHoldings.push(result.normalized);
      if (tickers.has(result.normalized.ticker)) {
        errors.push(issue(
          "PORTFOLIO_DUPLICATE_HOLDING",
          `portfolio.holdings[${index}].ticker`,
          "Multiple lots for one ticker must consolidate under one holding.",
          result.normalized.ticker
        ));
      }
      tickers.add(result.normalized.ticker);
      if (result.normalized.id) {
        if (holdingIds.has(result.normalized.id)) {
          errors.push(issue(
            "PORTFOLIO_DUPLICATE_HOLDING_ID",
            `portfolio.holdings[${index}].id`,
            "Holding ids must be unique.",
            result.normalized.id
          ));
        }
        holdingIds.add(result.normalized.id);
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    normalized: errors.length === 0 ? {
      ...input,
      recordType: "portfolio",
      name: typeof input.name === "string" ? input.name.trim() : "",
      holdings: normalizedHoldings,
      benchmarks: Array.isArray(input.benchmarks)
        ? input.benchmarks.map((benchmark) => clonePlain(benchmark))
        : []
    } : null,
    version: PORTFOLIO_VALIDATION_VERSION
  };
}

export function assertValidPortfolio(input, options = {}) {
  const result = validatePortfolio(input, options);
  if (!result.valid) {
    throw new PortfolioValidationError(result.errors);
  }
  return result.normalized;
}

function validatePositiveNumber(value, path, prefix) {
  if (value === undefined || value === null || value === "") {
    return {
      value: null,
      errors: [issue(`${prefix}_REQUIRED`, path, "A value is required.", value)]
    };
  }
  try {
    return {
      value: toFiniteNumber(value, { name: path, positive: true }),
      errors: []
    };
  } catch (error) {
    const nonfinite = isNonfiniteInput(value);
    const code = nonfinite ? `${prefix}_NONFINITE` : `${prefix}_INVALID`;
    return { value: null, errors: [issue(code, path, error.message, value)] };
  }
}

function validateOptionalId(value, path, code, errors) {
  if (value !== undefined && value !== null && (typeof value !== "string" || !value.trim())) {
    errors.push(issue(code, path, "Id must be a nonempty string when present.", value));
  }
}

function isNonfiniteInput(value) {
  if (typeof value === "number") {
    return !Number.isFinite(value);
  }
  if (typeof value === "string" && value.trim()) {
    const number = Number(value);
    return !Number.isFinite(number);
  }
  return false;
}

function invalidResult(error) {
  return { valid: false, errors: [error], normalized: null };
}

function issue(code, path, message, value) {
  const result = { code, path, message };
  if (value !== undefined) {
    result.value = value;
  }
  return result;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clonePlain(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(clonePlain);
  if (typeof value === "object") {
    const output = {};
    Object.entries(value).forEach(([key, nested]) => {
      output[key] = clonePlain(nested);
    });
    return output;
  }
  return value;
}
