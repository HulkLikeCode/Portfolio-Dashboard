import { normalizeDateOnly } from "../utils/date-utils.js";
import {
  analyticsMetadata,
  mergeWarnings,
  resolveAvailableState,
  unavailableResult,
  warning
} from "./return-series.js";

/**
 * Calculates the headline peak-to-trough drawdown only from a normalized,
 * contribution-neutral Price-Return Performance Series.
 */
export function calculateMaximumDrawdown(performanceSeries, options = {}) {
  const metric = "maximum-drawdown";
  const warnings = mergeWarnings(options.warnings);
  if (options.sourceSeriesType === "raw-account-value") {
    return unavailableResult(metric, "unavailable", warnings.concat(warning(
      "ANALYTICS_DRAWDOWN_RAW_ACCOUNT_VALUE_REJECTED",
      "Headline maximum drawdown cannot be calculated from raw account value."
    )), options);
  }
  const verifiedPerformanceSeries = options.sourceSeriesType === "price-return-performance-series"
    || Boolean(
      performanceSeries
      && !Array.isArray(performanceSeries)
      && performanceSeries.metric === "normalized-performance-series"
      && performanceSeries.priceReturnApproximation === true
    );
  if (!verifiedPerformanceSeries) {
    return unavailableResult(metric, "unavailable", warnings.concat(warning(
      "ANALYTICS_DRAWDOWN_PROVENANCE_REQUIRED",
      "Headline drawdown requires a verified contribution-neutral Price-Return Performance Series."
    )), options);
  }

  const normalized = normalizePerformanceRows(performanceSeries, options.valueField);
  if (!normalized.valid) {
    return unavailableResult(metric, normalized.state, warnings.concat(normalized.warning), options, {
      observationCount: normalized.inputCount
    });
  }
  if (normalized.rows.length < 2) {
    return unavailableResult(metric, "insufficient", warnings.concat(warning(
      "ANALYTICS_DRAWDOWN_OBSERVATIONS_INSUFFICIENT",
      "At least two Price-Return Performance Series observations are required for drawdown."
    )), options, { observationCount: normalized.rows.length });
  }

  let peakValue = normalized.rows[0].value;
  let peakDate = normalized.rows[0].date;
  let maximumDrawdown = 0;
  let maximumPeakDate = peakDate;
  let troughDate = peakDate;
  let troughValue = peakValue;
  const rows = [];

  for (const observation of normalized.rows) {
    if (observation.value > peakValue) {
      peakValue = observation.value;
      peakDate = observation.date;
    }
    const drawdown = observation.value / peakValue - 1;
    if (!Number.isFinite(drawdown)) {
      return unavailableResult(metric, "unavailable", warnings.concat(warning(
        "ANALYTICS_DRAWDOWN_NONFINITE",
        `Drawdown is nonfinite on ${observation.date}.`
      )), options, { observationCount: normalized.rows.length });
    }
    rows.push({
      date: observation.date,
      value: drawdown,
      drawdown,
      performanceValue: observation.value,
      runningPeakValue: peakValue,
      runningPeakDate: peakDate
    });
    if (drawdown < maximumDrawdown) {
      maximumDrawdown = drawdown;
      maximumPeakDate = peakDate;
      troughDate = observation.date;
      troughValue = observation.value;
    }
  }

  const maximumPeakValue = normalized.rows.find((row) => row.date === maximumPeakDate).value;
  const recovery = maximumDrawdown < 0
    ? normalized.rows.find((row) => row.date > troughDate && row.value >= maximumPeakValue)
    : null;

  return {
    ...analyticsMetadata(metric, {
      ...options,
      methodology: "Headline peak-to-trough drawdown from the normalized contribution-neutral Price-Return Performance Series; raw account value is excluded."
    }),
    available: true,
    state: resolveAvailableState(options.inputState),
    value: maximumDrawdown,
    maximumDrawdown,
    maximumDrawdownPercent: maximumDrawdown * 100,
    peakDate: maximumPeakDate,
    peakValue: maximumPeakValue,
    troughDate,
    troughValue,
    recoveryDate: recovery ? recovery.date : null,
    recovered: Boolean(recovery),
    rows,
    dates: rows.map((row) => row.date),
    drawdowns: rows.map((row) => row.drawdown),
    headline: true,
    sourceSeriesType: "price-return-performance-series",
    contributionsNeutralized: true,
    rawAccountValueUsed: false,
    counts: {
      observationCount: rows.length,
      drawdownObservationCount: rows.length
    },
    dateRange: {
      firstDate: rows[0].date,
      lastDate: rows.at(-1).date
    },
    warnings
  };
}

export const calculateHeadlineMaximumDrawdown = calculateMaximumDrawdown;

function normalizePerformanceRows(series, valueField) {
  const input = Array.isArray(series)
    ? series
    : series && Array.isArray(series.rows)
      ? series.rows
      : null;
  if (!input) {
    return invalid("missing", "ANALYTICS_DRAWDOWN_SERIES_MISSING", "A Price-Return Performance Series is required.", 0);
  }

  const rows = [];
  const dates = new Set();
  for (let index = 0; index < input.length; index += 1) {
    const item = input[index];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return invalid("unavailable", "ANALYTICS_DRAWDOWN_OBSERVATION_INVALID", `Drawdown observation ${index} is invalid.`, input.length);
    }
    let date;
    try {
      date = normalizeDateOnly(item.date, "drawdown observation date");
    } catch (_error) {
      return invalid("unavailable", "ANALYTICS_DRAWDOWN_DATE_INVALID", `Drawdown observation ${index} has an invalid date.`, input.length);
    }
    const value = valueField
      ? item[valueField]
      : [item.value, item.normalizedPriceReturnIndex].find((candidate) => candidate !== undefined);
    if (!Number.isFinite(value) || value <= 0) {
      return invalid("unavailable", "ANALYTICS_DRAWDOWN_VALUE_INVALID", `The performance value on ${date} must be positive and finite.`, input.length);
    }
    if (dates.has(date) || (rows.length > 0 && date <= rows.at(-1).date)) {
      return invalid("misaligned", "ANALYTICS_DRAWDOWN_DATES_INVALID", "Drawdown dates must be unique and strictly ascending.", input.length);
    }
    dates.add(date);
    rows.push({ date, value });
  }
  return { valid: true, rows, inputCount: input.length };
}

function invalid(state, code, message, inputCount) {
  return { valid: false, state, warning: warning(code, message), inputCount, rows: [] };
}
