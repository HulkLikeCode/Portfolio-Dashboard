import { normalizeDateOnly } from "../utils/date-utils.js";
import {
  analyticsMetadata,
  mergeWarnings,
  rangeOf,
  resolveAvailableState,
  unavailableResult,
  warning
} from "./return-series.js";

/**
 * Intersects two observation series by identical YYYY-MM-DD trading dates.
 * It never fills, carries forward, interpolates, or matches a nearby session.
 */
export function alignSeriesByExactDate(leftSeries, rightSeries, options = {}) {
  const metric = "exact-date-alignment";
  const leftName = options.leftName || "portfolio";
  const rightName = options.rightName || "benchmark";
  const left = normalizeSeries(leftSeries, options.leftValueField, leftName);
  const right = normalizeSeries(rightSeries, options.rightValueField, rightName);
  const inheritedWarnings = mergeWarnings(options.warnings, left.warnings, right.warnings);

  if (!left.valid || !right.valid) {
    return unavailableResult(
      metric,
      left.state === "misaligned" || right.state === "misaligned" ? "misaligned" : "unavailable",
      inheritedWarnings,
      options,
      alignmentCounts(left, right, 0)
    );
  }
  if (left.rows.length === 0 || right.rows.length === 0) {
    return unavailableResult(metric, "missing", inheritedWarnings.concat(warning(
      "ANALYTICS_ALIGNMENT_SERIES_MISSING",
      "Both portfolio and benchmark series are required for exact-date alignment."
    )), options, alignmentCounts(left, right, 0));
  }

  const rightByDate = new Map(right.rows.map((row) => [row.date, row.value]));
  const rows = left.rows
    .filter((row) => rightByDate.has(row.date))
    .map((row) => ({
      date: row.date,
      leftValue: row.value,
      rightValue: rightByDate.get(row.date),
      [`${leftName}Value`]: row.value,
      [`${rightName}Value`]: rightByDate.get(row.date)
    }));

  const minimumObservations = options.minimumObservations === undefined
    ? 1
    : options.minimumObservations;
  if (!Number.isInteger(minimumObservations) || minimumObservations < 1) {
    return unavailableResult(metric, "unavailable", inheritedWarnings.concat(warning(
      "ANALYTICS_ALIGNMENT_MINIMUM_INVALID",
      "minimumObservations must be a positive integer."
    )), options, alignmentCounts(left, right, rows.length));
  }

  const warnings = inheritedWarnings.slice();
  const droppedLeftCount = left.rows.length - rows.length;
  const droppedRightCount = right.rows.length - rows.length;
  if (droppedLeftCount > 0 || droppedRightCount > 0) {
    warnings.push(warning(
      "ANALYTICS_DATES_EXACT_INTERSECTION",
      "Nonmatching trading dates were excluded; no values were filled or carried forward.",
      { droppedLeftCount, droppedRightCount }
    ));
  }
  if (rows.length < minimumObservations) {
    return {
      ...unavailableResult(metric, rows.length === 0 ? "misaligned" : "insufficient", warnings.concat(warning(
      "ANALYTICS_ALIGNED_OBSERVATIONS_INSUFFICIENT",
      `Exact-date alignment produced ${rows.length} observations; ${minimumObservations} are required.`,
      { alignedObservationCount: rows.length, minimumObservations }
      )), options, alignmentCounts(left, right, rows.length)),
      dateRange: rangeOf(rows)
    };
  }

  return {
    ...analyticsMetadata(metric, {
      ...options,
      methodology: "Exact intersection of portfolio and benchmark trading dates; no filling, interpolation, or nearby-date matching."
    }),
    available: true,
    state: resolveAvailableState(options.inputState),
    alignment: "exact-trading-date-intersection",
    leftName,
    rightName,
    rows,
    dates: rows.map((row) => row.date),
    leftValues: rows.map((row) => row.leftValue),
    rightValues: rows.map((row) => row.rightValue),
    counts: alignmentCounts(left, right, rows.length),
    dateRange: rangeOf(rows),
    warnings
  };
}

export const alignByExactTradingDate = alignSeriesByExactDate;

/**
 * Intersects periodic returns by the exact pair of start and end trading dates.
 * Matching only the end date is insufficient because it can pair returns that
 * cover different numbers of market sessions.
 */
export function alignReturnSeriesByExactInterval(leftSeries, rightSeries, options = {}) {
  const metric = "exact-return-interval-alignment";
  const leftName = options.leftName || "portfolio";
  const rightName = options.rightName || "benchmark";
  const left = normalizeReturnSeries(leftSeries, options.leftValueField, leftName);
  const right = normalizeReturnSeries(rightSeries, options.rightValueField, rightName);
  const inheritedWarnings = mergeWarnings(options.warnings, left.warnings, right.warnings);
  const counts = (alignedCount) => ({
    leftReturnObservationCount: left.inputCount,
    rightReturnObservationCount: right.inputCount,
    alignedReturnObservationCount: alignedCount,
    droppedLeftReturnObservationCount: Math.max(0, left.inputCount - alignedCount),
    droppedRightReturnObservationCount: Math.max(0, right.inputCount - alignedCount)
  });

  if (!left.valid || !right.valid) {
    return unavailableResult(
      metric,
      left.state === "misaligned" || right.state === "misaligned" ? "misaligned" : "unavailable",
      inheritedWarnings,
      options,
      counts(0)
    );
  }
  if (left.rows.length === 0 || right.rows.length === 0) {
    return unavailableResult(metric, "missing", inheritedWarnings.concat(warning(
      "ANALYTICS_RETURN_INTERVAL_SERIES_MISSING",
      "Both portfolio and benchmark periodic return series are required."
    )), options, counts(0));
  }

  const rightByInterval = new Map(right.rows.map((row) => [intervalKey(row), row]));
  const rows = left.rows
    .filter((row) => rightByInterval.has(intervalKey(row)))
    .map((row) => {
      const matched = rightByInterval.get(intervalKey(row));
      return {
        date: row.endDate,
        startDate: row.startDate,
        endDate: row.endDate,
        leftValue: row.value,
        rightValue: matched.value,
        [`${leftName}Value`]: row.value,
        [`${rightName}Value`]: matched.value
      };
    });
  const minimumObservations = options.minimumObservations === undefined
    ? 2
    : options.minimumObservations;
  if (!Number.isInteger(minimumObservations) || minimumObservations < 1) {
    return unavailableResult(metric, "unavailable", inheritedWarnings.concat(warning(
      "ANALYTICS_RETURN_INTERVAL_MINIMUM_INVALID",
      "minimumObservations must be a positive integer."
    )), options, counts(rows.length));
  }

  const warnings = inheritedWarnings.slice();
  let sharedEndMismatches = 0;
  if (rows.length !== left.rows.length || rows.length !== right.rows.length) {
    sharedEndMismatches = countSharedEndMismatches(left.rows, right.rows);
    warnings.push(warning(
      "ANALYTICS_RETURN_INTERVALS_EXACT_INTERSECTION",
      "Only returns with identical start and end trading dates were retained.",
      {
        alignedReturnObservationCount: rows.length,
        droppedLeftReturnObservationCount: left.rows.length - rows.length,
        droppedRightReturnObservationCount: right.rows.length - rows.length,
        sharedEndMismatches
      }
    ));
    if (sharedEndMismatches > 0) {
      warnings.push(warning(
        "ANALYTICS_RETURN_INTERVALS_MISALIGNED",
        "Some portfolio and benchmark returns shared an end date but not the same start date.",
        { sharedEndMismatches }
      ));
    }
  }

  const dateRange = rows.length > 0
    ? { firstDate: rows[0].startDate, lastDate: rows.at(-1).endDate }
    : { firstDate: null, lastDate: null };
  if (rows.length < minimumObservations) {
    const state = rows.length === 0 || sharedEndMismatches > 0 ? "misaligned" : "insufficient";
    return {
      ...unavailableResult(metric, state, warnings.concat(warning(
        "ANALYTICS_ALIGNED_RETURN_INTERVALS_INSUFFICIENT",
        `Exact interval alignment produced ${rows.length} returns; ${minimumObservations} are required.`,
        { alignedReturnObservationCount: rows.length, minimumObservations }
      )), options, counts(rows.length)),
      dateRange
    };
  }

  return {
    ...analyticsMetadata(metric, {
      ...options,
      methodology: "Exact intersection of periodic returns by identical start and end trading dates; unmatched intervals are excluded."
    }),
    available: true,
    state: resolveAvailableState(options.inputState),
    alignment: "exact-return-interval-intersection",
    leftName,
    rightName,
    rows,
    dates: rows.map((row) => row.endDate),
    leftValues: rows.map((row) => row.leftValue),
    rightValues: rows.map((row) => row.rightValue),
    counts: counts(rows.length),
    dateRange,
    warnings
  };
}

function normalizeSeries(series, valueField, name) {
  const values = Array.isArray(series)
    ? series
    : series && Array.isArray(series.rows)
      ? series.rows
      : series && Array.isArray(series.candles)
        ? series.candles
        : null;
  if (!values) {
    return invalidSeries("missing", warning(
      "ANALYTICS_ALIGNMENT_INPUT_INVALID",
      `The ${name} series must be a dated observation array.`
    ));
  }

  const rows = [];
  const dates = new Set();
  for (let index = 0; index < values.length; index += 1) {
    const observation = values[index];
    if (!observation || typeof observation !== "object" || Array.isArray(observation)) {
      return invalidSeries("unavailable", warning(
        "ANALYTICS_ALIGNMENT_OBSERVATION_INVALID",
        `${name} observation ${index} is invalid.`
      ), values.length);
    }
    let date;
    try {
      date = normalizeDateOnly(observation.date, `${name} observation date`);
    } catch (_error) {
      return invalidSeries("unavailable", warning(
        "ANALYTICS_ALIGNMENT_DATE_INVALID",
        `${name} observation ${index} has an invalid trading date.`
      ), values.length);
    }
    const value = readValue(observation, valueField);
    if (!Number.isFinite(value)) {
      return invalidSeries("unavailable", warning(
        "ANALYTICS_ALIGNMENT_VALUE_INVALID",
        `${name} has a nonfinite value on ${date}.`
      ), values.length);
    }
    if (dates.has(date) || (rows.length > 0 && date <= rows.at(-1).date)) {
      return invalidSeries("misaligned", warning(
        "ANALYTICS_ALIGNMENT_DATES_INVALID",
        `${name} trading dates must be unique and strictly ascending.`
      ), values.length);
    }
    dates.add(date);
    rows.push({ date, value });
  }
  return { valid: true, state: "available", rows, warnings: [], inputCount: values.length };
}

function normalizeReturnSeries(series, valueField, name) {
  const values = Array.isArray(series)
    ? series
    : series && Array.isArray(series.rows)
      ? series.rows
      : null;
  if (!values) {
    return invalidSeries("missing", warning(
      "ANALYTICS_RETURN_INTERVAL_INPUT_INVALID",
      `The ${name} return series must be a dated observation array.`
    ));
  }

  const rows = [];
  const intervals = new Set();
  for (let index = 0; index < values.length; index += 1) {
    const observation = values[index];
    if (!observation || typeof observation !== "object" || Array.isArray(observation)) {
      return invalidSeries("unavailable", warning(
        "ANALYTICS_RETURN_INTERVAL_OBSERVATION_INVALID",
        `${name} return observation ${index} is invalid.`
      ), values.length);
    }
    let startDate;
    let endDate;
    try {
      startDate = normalizeDateOnly(observation.startDate, `${name} return start date`);
      endDate = normalizeDateOnly(observation.endDate || observation.date, `${name} return end date`);
    } catch (_error) {
      return invalidSeries("unavailable", warning(
        "ANALYTICS_RETURN_INTERVAL_DATE_INVALID",
        `${name} return observation ${index} has an invalid interval.`
      ), values.length);
    }
    const value = readValue(observation, valueField);
    const key = `${startDate}|${endDate}`;
    if (!Number.isFinite(value) || startDate >= endDate || intervals.has(key)
        || (rows.length > 0 && endDate <= rows.at(-1).endDate)) {
      return invalidSeries("misaligned", warning(
        "ANALYTICS_RETURN_INTERVAL_INVALID",
        `${name} return intervals must be finite, unique, valid, and strictly ascending.`
      ), values.length);
    }
    intervals.add(key);
    rows.push({ date: endDate, startDate, endDate, value });
  }
  return { valid: true, state: "available", rows, warnings: [], inputCount: values.length };
}

function intervalKey(row) {
  return `${row.startDate}|${row.endDate}`;
}

function countSharedEndMismatches(leftRows, rightRows) {
  const rightStartsByEnd = new Map(rightRows.map((row) => [row.endDate, row.startDate]));
  return leftRows.filter((row) => (
    rightStartsByEnd.has(row.endDate)
      && rightStartsByEnd.get(row.endDate) !== row.startDate
  )).length;
}

function readValue(observation, valueField) {
  if (valueField) return observation[valueField];
  const candidates = [
    observation.value,
    observation.close,
    observation.normalizedPriceReturnIndex,
    observation.leftValue,
    observation.rightValue
  ];
  return candidates.find((value) => value !== undefined);
}

function invalidSeries(state, issue, inputCount = 0) {
  return { valid: false, state, rows: [], warnings: [issue], inputCount };
}

function alignmentCounts(left, right, alignedCount) {
  const leftCount = left.inputCount ?? left.rows.length;
  const rightCount = right.inputCount ?? right.rows.length;
  return {
    leftObservationCount: leftCount,
    rightObservationCount: rightCount,
    alignedObservationCount: alignedCount,
    alignedReturnObservationCount: Math.max(0, alignedCount - 1),
    droppedLeftObservationCount: Math.max(0, leftCount - alignedCount),
    droppedRightObservationCount: Math.max(0, rightCount - alignedCount)
  };
}
