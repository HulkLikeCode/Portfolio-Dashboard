/**
 * Strict date-only helpers. Date strings remain YYYY-MM-DD values and are not
 * converted through local or UTC midnight, preventing timezone date shifting.
 */

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function daysInMonth(year, month) {
  if (!Number.isInteger(year) || year < 1 || year > 9999) {
    throw new RangeError("year must be an integer from 1 through 9999.");
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError("month must be an integer from 1 through 12.");
  }
  const lengths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return lengths[month - 1];
}

export function parseDateOnly(value, name = "date") {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must use YYYY-MM-DD.`);
  }
  const match = DATE_ONLY_PATTERN.exec(value.trim());
  if (!match) {
    throw new TypeError(`${name} must use YYYY-MM-DD.`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || year > 9999 || month < 1 || month > 12) {
    throw new RangeError(`${name} must be a valid calendar date.`);
  }
  if (day < 1 || day > daysInMonth(year, month)) {
    throw new RangeError(`${name} must be a valid calendar date.`);
  }
  return {
    value: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    year,
    month,
    day
  };
}

export function normalizeDateOnly(value, name = "date") {
  return parseDateOnly(value, name).value;
}

export function isValidDateOnly(value) {
  try {
    parseDateOnly(value);
    return true;
  } catch (_error) {
    return false;
  }
}

export function compareDateOnly(left, right) {
  const a = normalizeDateOnly(left, "left date");
  const b = normalizeDateOnly(right, "right date");
  return a < b ? -1 : a > b ? 1 : 0;
}

export function minDateOnly(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }
  return values.map((value) => normalizeDateOnly(value)).reduce(
    (minimum, value) => (value < minimum ? value : minimum)
  );
}

export function maxDateOnly(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }
  return values.map((value) => normalizeDateOnly(value)).reduce(
    (maximum, value) => (value > maximum ? value : maximum)
  );
}

export function todayDateOnly(now = new Date()) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError("now must be a valid Date.");
  }
  return [
    String(now.getFullYear()).padStart(4, "0"),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
}

export function resolveReferenceDate(value, now = () => new Date()) {
  if (value === undefined || value === null || value === "") {
    return todayDateOnly(now());
  }
  if (value instanceof Date) {
    return todayDateOnly(value);
  }
  return normalizeDateOnly(value, "referenceDate");
}

export function isFutureDate(value, referenceDate) {
  return compareDateOnly(value, referenceDate) > 0;
}

export function isOnOrAfterDate(value, boundary) {
  return compareDateOnly(value, boundary) >= 0;
}
