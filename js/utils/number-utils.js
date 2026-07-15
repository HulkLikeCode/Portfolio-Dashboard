/**
 * Numeric helpers for deterministic portfolio calculations.
 * Financial calculations retain JavaScript Number precision. Rounding belongs
 * in formatting or display code, not in this module's calculation paths.
 */

export function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function toFiniteNumber(value, options = {}) {
  const {
    name = "value",
    allowNumericString = true,
    positive = false,
    nonnegative = false
  } = options;

  let normalized = value;
  if (allowNumericString && typeof normalized === "string") {
    const trimmed = normalized.trim();
    if (!trimmed) {
      throw new TypeError(`${name} must be a finite number.`);
    }
    normalized = Number(trimmed);
  }

  if (!isFiniteNumber(normalized)) {
    throw new TypeError(`${name} must be a finite number.`);
  }
  if (positive && normalized <= 0) {
    throw new RangeError(`${name} must be greater than zero.`);
  }
  if (nonnegative && normalized < 0) {
    throw new RangeError(`${name} must be zero or greater.`);
  }
  return normalized;
}

export function assertFiniteNumber(value, name = "value") {
  return toFiniteNumber(value, { name, allowNumericString: false });
}

export function assertPositiveFiniteNumber(value, name = "value") {
  return toFiniteNumber(value, {
    name,
    allowNumericString: false,
    positive: true
  });
}

export function sumFinite(values, name = "values") {
  if (!Array.isArray(values)) {
    throw new TypeError(`${name} must be an array.`);
  }
  let total = 0;
  values.forEach((value, index) => {
    total += assertFiniteNumber(value, `${name}[${index}]`);
  });
  if (!Number.isFinite(total)) {
    throw new RangeError(`${name} produced a nonfinite total.`);
  }
  return total;
}

export function safeDivide(numerator, denominator, fallback = null) {
  const top = assertFiniteNumber(numerator, "numerator");
  const bottom = assertFiniteNumber(denominator, "denominator");
  if (bottom === 0) {
    return fallback;
  }
  const result = top / bottom;
  return Number.isFinite(result) ? result : fallback;
}

export function nearlyEqual(left, right, tolerance = 1e-10) {
  if (!isFiniteNumber(left) || !isFiniteNumber(right)) {
    return false;
  }
  if (!isFiniteNumber(tolerance) || tolerance < 0) {
    throw new RangeError("tolerance must be a nonnegative finite number.");
  }
  const scale = Math.max(1, Math.abs(left), Math.abs(right));
  return Math.abs(left - right) <= tolerance * scale;
}

/**
 * Display-only decimal rounding. Do not use this function inside financial
 * calculations or persisted model normalization.
 */
export function roundForDisplay(value, decimalPlaces = 2) {
  const number = assertFiniteNumber(value, "value");
  if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 15) {
    throw new RangeError("decimalPlaces must be an integer from 0 through 15.");
  }
  const factor = 10 ** decimalPlaces;
  return Math.round((number + Number.EPSILON) * factor) / factor;
}
