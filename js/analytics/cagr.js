import { daysInMonth, normalizeDateOnly, parseDateOnly } from "../utils/date-utils.js";
import {
  analyticsMetadata,
  mergeWarnings,
  resolveAvailableState,
  unavailableResult,
  warning
} from "./return-series.js";

export const CAGR_DAY_COUNT_CONVENTION = "ACT/ACT anniversary";

/**
 * Calculates CAGR with anniversary-based ACT/ACT elapsed years. Accepts either a dated
 * series/result or (beginningValue, endingValue, beginningDate, endingDate).
 */
export function calculateCagr(
  input,
  endingValueOrOptions,
  beginningDate,
  endingDate,
  explicitOptions = {}
) {
  const parsed = parseArguments(
    input,
    endingValueOrOptions,
    beginningDate,
    endingDate,
    explicitOptions
  );
  const options = parsed.options;
  const metric = "cagr";
  const warnings = mergeWarnings(options.warnings, parsed.warnings);

  if (!parsed.valid) {
    return unavailableResult(metric, parsed.state, warnings, options, parsed.counts);
  }
  if (!Number.isFinite(parsed.beginningValue) || parsed.beginningValue <= 0
      || !Number.isFinite(parsed.endingValue) || parsed.endingValue <= 0) {
    return unavailableResult(metric, "unavailable", warnings.concat(warning(
      "ANALYTICS_CAGR_VALUE_INVALID",
      "CAGR requires positive finite beginning and ending values."
    )), options, parsed.counts);
  }

  let firstDate;
  let lastDate;
  try {
    firstDate = normalizeDateOnly(parsed.beginningDate, "CAGR beginning date");
    lastDate = normalizeDateOnly(parsed.endingDate, "CAGR ending date");
  } catch (_error) {
    return unavailableResult(metric, "unavailable", warnings.concat(warning(
      "ANALYTICS_CAGR_DATE_INVALID",
      "CAGR requires valid YYYY-MM-DD beginning and ending dates."
    )), options, parsed.counts);
  }

  const elapsedDays = calendarDayNumber(lastDate) - calendarDayNumber(firstDate);
  if (!Number.isFinite(elapsedDays) || elapsedDays <= 0) {
    return unavailableResult(metric, "insufficient", warnings.concat(warning(
      "ANALYTICS_CAGR_ELAPSED_TIME_INVALID",
      "CAGR ending date must be later than its beginning date."
    )), options, parsed.counts);
  }

  const elapsedYears = anniversaryElapsedYears(firstDate, lastDate);
  const value = (parsed.endingValue / parsed.beginningValue) ** (1 / elapsedYears) - 1;
  if (!Number.isFinite(value)) {
    return unavailableResult(metric, "unavailable", warnings.concat(warning(
      "ANALYTICS_CAGR_NONFINITE",
      "The CAGR calculation produced a nonfinite result."
    )), options, parsed.counts);
  }

  return {
    ...analyticsMetadata(metric, {
      ...options,
      methodology: "CAGR from positive beginning and ending Price-Return Performance Series values using anniversary-based ACT/ACT elapsed years."
    }),
    available: true,
    state: resolveAvailableState(options.inputState),
    value,
    cagr: value,
    beginningValue: parsed.beginningValue,
    endingValue: parsed.endingValue,
    elapsedDays,
    elapsedYears,
    dayCountConvention: CAGR_DAY_COUNT_CONVENTION,
    counts: parsed.counts,
    dateRange: { firstDate, lastDate },
    warnings
  };
}

export const calculatePriceReturnCagr = calculateCagr;

function parseArguments(input, endingValueOrOptions, beginningDate, endingDate, explicitOptions) {
  if (Array.isArray(input) || (input && Array.isArray(input.rows))) {
    const rows = Array.isArray(input) ? input : input.rows;
    const options = isPlainObject(endingValueOrOptions) ? endingValueOrOptions : {};
    if (rows.length < 2) {
      return invalidParsed("insufficient", options, warning(
        "ANALYTICS_CAGR_OBSERVATIONS_INSUFFICIENT",
        "At least two Price-Return Performance Series observations are required for CAGR."
      ), rows.length);
    }
    let previousDate = null;
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const value = readValue(row, options.valueField);
      let date;
      try {
        date = normalizeDateOnly(row && row.date, `CAGR observation ${index} date`);
      } catch (_error) {
        return invalidParsed("unavailable", options, warning(
          "ANALYTICS_CAGR_SERIES_DATE_INVALID",
          `CAGR observation ${index} has an invalid date.`
        ), rows.length);
      }
      if (!Number.isFinite(value) || value <= 0) {
        return invalidParsed("unavailable", options, warning(
          "ANALYTICS_CAGR_SERIES_VALUE_INVALID",
          `CAGR observation ${index} must have a positive finite performance value.`
        ), rows.length);
      }
      if (previousDate !== null && date <= previousDate) {
        return invalidParsed("misaligned", options, warning(
          "ANALYTICS_CAGR_SERIES_DATES_INVALID",
          "CAGR series dates must be unique and strictly ascending."
        ), rows.length);
      }
      previousDate = date;
    }
    const first = rows[0];
    const last = rows.at(-1);
    return {
      valid: true,
      beginningValue: readValue(first, options.valueField),
      endingValue: readValue(last, options.valueField),
      beginningDate: first && first.date,
      endingDate: last && last.date,
      options,
      warnings: [],
      counts: { observationCount: rows.length, endpointObservationCount: 2 }
    };
  }

  if (isPlainObject(input)
      && (input.beginningValue !== undefined || input.endingValue !== undefined)) {
    const options = isPlainObject(endingValueOrOptions) ? endingValueOrOptions : {};
    return {
      valid: true,
      beginningValue: input.beginningValue,
      endingValue: input.endingValue,
      beginningDate: input.beginningDate || input.startDate,
      endingDate: input.endingDate || input.endDate,
      options,
      warnings: [],
      counts: { observationCount: 2, endpointObservationCount: 2 }
    };
  }

  return {
    valid: true,
    beginningValue: input,
    endingValue: endingValueOrOptions,
    beginningDate,
    endingDate,
    options: isPlainObject(explicitOptions) ? explicitOptions : {},
    warnings: [],
    counts: { observationCount: 2, endpointObservationCount: 2 }
  };
}

function invalidParsed(state, options, issue, inputCount) {
  return {
    valid: false,
    state,
    options,
    warnings: [issue],
    counts: { observationCount: inputCount, endpointObservationCount: 0 }
  };
}

function readValue(row, valueField) {
  if (!row || typeof row !== "object") return undefined;
  if (valueField) return row[valueField];
  return [row.value, row.normalizedPriceReturnIndex, row.close]
    .find((value) => value !== undefined);
}

function calendarDayNumber(dateOnly) {
  const parsed = parseDateOnly(dateOnly);
  return Date.UTC(parsed.year, parsed.month - 1, parsed.day) / 86400000;
}

function anniversaryElapsedYears(firstDate, lastDate) {
  const first = parseDateOnly(firstDate);
  const last = parseDateOnly(lastDate);
  let wholeYears = last.year - first.year;
  let anniversary = anniversaryForYear(first, first.year + wholeYears);
  if (anniversary > lastDate) {
    wholeYears -= 1;
    anniversary = anniversaryForYear(first, first.year + wholeYears);
  }
  const nextAnniversary = anniversaryForYear(first, first.year + wholeYears + 1);
  const partialDays = calendarDayNumber(lastDate) - calendarDayNumber(anniversary);
  const anniversaryYearDays = calendarDayNumber(nextAnniversary) - calendarDayNumber(anniversary);
  return wholeYears + partialDays / anniversaryYearDays;
}

function anniversaryForYear(first, year) {
  const day = Math.min(first.day, daysInMonth(year, first.month));
  return [
    String(year).padStart(4, "0"),
    String(first.month).padStart(2, "0"),
    String(day).padStart(2, "0")
  ].join("-");
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
