import { normalizeDateOnly } from "../utils/date-utils.js";

export const ANALYTICS_VERSION = "2.3-phase-6a";
export const PRICE_RETURN_APPROXIMATION_LABEL =
  "Split-adjusted, dividend-unadjusted price-return approximation";

export const ANALYTICS_STATES = Object.freeze({
  AVAILABLE: "available",
  STALE: "stale",
  QUALITY_WARNING: "quality-warning",
  MISSING: "missing",
  INSUFFICIENT: "insufficient",
  MISALIGNED: "misaligned",
  UNAVAILABLE: "unavailable",
  ERROR: "error"
});

const NONCURRENT_INPUT_STATES = new Set([
  "stale",
  "quality-warning",
  "insufficient",
  "missing",
  "error"
]);

/**
 * Builds close-to-close daily arithmetic returns. A malformed close invalidates
 * the result; observations are never skipped or bridged across a bad value.
 */
export function buildDailyArithmeticReturns(observations, options = {}) {
  return buildReturnSeries(observations, "arithmetic", options);
}

export const calculateDailyArithmeticReturns = buildDailyArithmeticReturns;

/** Builds close-to-close daily continuously compounded (log) returns. */
export function buildDailyLogReturns(observations, options = {}) {
  return buildReturnSeries(observations, "log", options);
}

export const calculateDailyLogReturns = buildDailyLogReturns;

/**
 * Rebases a valid positive value series without changing any period return.
 * This is suitable for closes and for a contribution-neutral performance index.
 */
export function buildNormalizedPerformanceSeries(observations, options = {}) {
  const metric = "normalized-performance-series";
  const validated = validatePositiveDatedSeries(observations, options);
  const warnings = mergeWarnings(options.warnings, validated.warnings);
  const baseValue = options.baseValue === undefined ? 100 : options.baseValue;

  if (!Number.isFinite(baseValue) || baseValue <= 0) {
    return unavailableResult(metric, "unavailable", warnings.concat(warning(
      "ANALYTICS_BASE_VALUE_INVALID",
      "The normalization base value must be a positive finite number."
    )), options);
  }
  if (!validated.valid) {
    return unavailableResult(metric, validated.state, warnings, options, validated.counts);
  }
  if (validated.rows.length === 0) {
    return unavailableResult(metric, "missing", warnings.concat(warning(
      "ANALYTICS_SERIES_MISSING",
      "No valid close observations were supplied."
    )), options, validated.counts);
  }

  const beginningValue = validated.rows[0].value;
  const rows = [];
  for (const observation of validated.rows) {
    const value = baseValue * (observation.value / beginningValue);
    if (!Number.isFinite(value) || value <= 0) {
      return unavailableResult(metric, "unavailable", warnings.concat(warning(
        "ANALYTICS_NORMALIZED_VALUE_INVALID",
        `Normalization produced an invalid value on ${observation.date}.`
      )), options, validated.counts);
    }
    rows.push({ date: observation.date, value });
  }

  return {
    ...analyticsMetadata(metric, options),
    available: true,
    state: resolveAvailableState(options.inputState),
    baseValue,
    rows,
    dates: rows.map((row) => row.date),
    values: rows.map((row) => row.value),
    beginningSourceValue: beginningValue,
    endingSourceValue: validated.rows.at(-1).value,
    counts: {
      inputObservationCount: validated.rows.length,
      observationCount: rows.length,
      returnObservationCount: Math.max(0, rows.length - 1)
    },
    dateRange: rangeOf(rows),
    warnings
  };
}

function buildReturnSeries(observations, kind, options) {
  const metric = kind === "log" ? "daily-log-returns" : "daily-arithmetic-returns";
  const validated = validatePositiveDatedSeries(observations, options);
  const warnings = mergeWarnings(options.warnings, validated.warnings);

  if (!validated.valid) {
    return unavailableResult(metric, validated.state, warnings, options, validated.counts);
  }
  if (validated.rows.length < 2) {
    return unavailableResult(metric, "insufficient", warnings.concat(warning(
      "ANALYTICS_RETURN_OBSERVATIONS_INSUFFICIENT",
      "At least two valid close observations are required to calculate a return."
    )), options, validated.counts);
  }

  const rows = [];
  for (let index = 1; index < validated.rows.length; index += 1) {
    const previous = validated.rows[index - 1];
    const current = validated.rows[index];
    const ratio = current.value / previous.value;
    const value = kind === "log" ? Math.log(ratio) : ratio - 1;
    if (!Number.isFinite(value)) {
      return unavailableResult(metric, "unavailable", warnings.concat(warning(
        "ANALYTICS_RETURN_NONFINITE",
        `The ${kind} return ending ${current.date} is nonfinite.`
      )), options, validated.counts);
    }
    rows.push({
      date: current.date,
      startDate: previous.date,
      endDate: current.date,
      value,
      previousClose: previous.value,
      close: current.value
    });
  }

  return {
    ...analyticsMetadata(metric, options),
    available: true,
    state: resolveAvailableState(options.inputState),
    returnType: kind,
    frequency: options.frequency || "daily",
    rows,
    dates: rows.map((row) => row.date),
    values: rows.map((row) => row.value),
    counts: {
      inputObservationCount: validated.rows.length,
      observationCount: validated.rows.length,
      returnObservationCount: rows.length
    },
    dateRange: rangeOf(rows),
    warnings
  };
}

function validatePositiveDatedSeries(observations, options) {
  const values = Array.isArray(observations)
    ? observations
    : observations && Array.isArray(observations.rows)
      ? observations.rows
      : observations && Array.isArray(observations.candles)
        ? observations.candles
        : null;
  if (!values) {
    return invalidValidation("missing", warning(
      "ANALYTICS_SERIES_INVALID",
      "A dated observation array is required."
    ), 0);
  }

  const rows = [];
  const seenDates = new Set();
  for (let index = 0; index < values.length; index += 1) {
    const item = values[index];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return invalidValidation("unavailable", warning(
        "ANALYTICS_OBSERVATION_INVALID",
        `Observation ${index} must be an object containing a trading date and close.`
      ), values.length);
    }

    let date;
    try {
      date = normalizeDateOnly(item.date, `observation ${index} date`);
    } catch (_error) {
      return invalidValidation("unavailable", warning(
        "ANALYTICS_DATE_INVALID",
        `Observation ${index} has an invalid trading date.`
      ), values.length);
    }
    const value = readObservationValue(item, options.valueField);
    if (!Number.isFinite(value) || value <= 0) {
      return invalidValidation("unavailable", warning(
        "ANALYTICS_CLOSE_INVALID",
        `The close or performance value on ${date} must be a positive finite number.`
      ), values.length);
    }
    if (seenDates.has(date) || (rows.length > 0 && date <= rows.at(-1).date)) {
      return invalidValidation("misaligned", warning(
        "ANALYTICS_DATES_NOT_STRICTLY_ASCENDING",
        "Trading dates must be unique and strictly ascending."
      ), values.length);
    }
    seenDates.add(date);
    rows.push({ date, value });
  }

  return {
    valid: true,
    state: "available",
    rows,
    warnings: [],
    counts: { inputObservationCount: values.length, validObservationCount: values.length }
  };
}

function readObservationValue(item, valueField) {
  if (valueField) return item[valueField];
  const candidates = [item.close, item.value, item.normalizedPriceReturnIndex];
  return candidates.find((value) => value !== undefined);
}

function invalidValidation(state, issue, inputCount) {
  return {
    valid: false,
    state,
    rows: [],
    warnings: [issue],
    counts: { inputObservationCount: inputCount, validObservationCount: 0 }
  };
}

export function analyticsMetadata(metric, options = {}) {
  return {
    recordType: "analytics-result",
    analyticsVersion: ANALYTICS_VERSION,
    metric,
    label: PRICE_RETURN_APPROXIMATION_LABEL,
    priceReturnApproximation: true,
    priceAdjustment: "split-adjusted",
    dividendAdjustment: "none",
    exactTotalReturn: false,
    dividendReinvested: false,
    methodology: options.methodology || methodologyFor(metric),
    benchmark: options.benchmark || null,
    riskFreeRateSource: options.riskFreeRateSource || null
  };
}

export function unavailableResult(metric, state, warnings, options = {}, counts = {}) {
  return {
    ...analyticsMetadata(metric, options),
    available: false,
    state: state || ANALYTICS_STATES.UNAVAILABLE,
    value: null,
    counts: { ...counts },
    dateRange: { firstDate: null, lastDate: null },
    warnings: mergeWarnings(warnings)
  };
}

export function warning(code, message, details = {}, severity = "warning") {
  return { code, severity, message, details: clonePlain(details) };
}

export function mergeWarnings(...groups) {
  const output = [];
  for (const group of groups) {
    if (!Array.isArray(group)) continue;
    for (const item of group) {
      if (item && typeof item === "object") output.push(clonePlain(item));
    }
  }
  return output;
}

export function rangeOf(rows) {
  return rows.length > 0
    ? { firstDate: rows[0].date, lastDate: rows.at(-1).date }
    : { firstDate: null, lastDate: null };
}

export function resolveAvailableState(inputState) {
  return NONCURRENT_INPUT_STATES.has(inputState) ? inputState : ANALYTICS_STATES.AVAILABLE;
}

function methodologyFor(metric) {
  const methods = {
    "daily-arithmetic-returns": "Close-to-close arithmetic returns from valid normalized Stooq closes.",
    "daily-log-returns": "Close-to-close natural-log returns from valid normalized Stooq closes.",
    "normalized-performance-series": "Valid values rebased to a common positive base without changing period returns."
  };
  return methods[metric]
    || "Split-adjusted, dividend-unadjusted Stooq close methodology.";
}

function clonePlain(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(clonePlain);
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, clonePlain(nested)]));
  }
  return value;
}
