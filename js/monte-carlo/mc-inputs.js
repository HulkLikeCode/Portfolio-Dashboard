export const MONTE_CARLO_INPUTS_VERSION = "2.3-phase-7a";
export const SUPPORTED_PATH_COUNTS = Object.freeze([1000, 2500, 5000]);
export const DEFAULT_PATH_COUNT = 5000;
export const MIN_HORIZON_YEARS = 1;
export const MAX_HORIZON_YEARS = 10;
export const MAX_LOOKBACK_RETURNS = 756;
export const SEED_MODES = Object.freeze({ FIXED: "fixed", RANDOM: "random" });

const MAX_UINT32 = 0xffffffff;
const SYMBOL_PATTERN = /^[A-Z][A-Z0-9.\-]{0,14}$/;

/**
 * Validates and snapshots the input boundary shared by the UI and worker.
 * This phase deliberately validates inputs only; it does not derive returns or
 * implement a Monte Carlo method.
 */
export function validateMonteCarloInputs(value = {}, options = {}) {
  const errors = [];
  const source = isPlainObject(value) ? value : {};
  if (!isPlainObject(value)) errors.push(issue("INPUT_OBJECT_REQUIRED", "Monte Carlo inputs must be an object."));

  const includedSymbols = normalizeIncludedSymbols(source.includedSymbols, source.initialValues, errors);
  const pathCount = normalizePathCount(source.pathCount, errors);
  const horizonYears = normalizeInteger(source.horizonYears, "horizonYears", errors, {
    min: MIN_HORIZON_YEARS,
    max: MAX_HORIZON_YEARS,
    code: "HORIZON_OUT_OF_RANGE"
  });
  const lookbackReturns = normalizeInteger(source.lookbackReturns, "lookbackReturns", errors, {
    min: 1,
    max: MAX_LOOKBACK_RETURNS,
    code: "LOOKBACK_OUT_OF_RANGE"
  });
  const seedMode = source.seedMode === undefined ? SEED_MODES.RANDOM : source.seedMode;
  const seed = normalizeSeed(seedMode, source.seed, errors, options.randomSeed, options.randomSeedOverride);

  const normalized = {
    includedSymbols,
    pathCount,
    horizonYears,
    lookbackReturns,
    seedMode,
    seed
  };

  return {
    valid: errors.length === 0,
    errors,
    value: errors.length === 0 ? normalized : null
  };
}

export function assertValidMonteCarloInputs(value, options = {}) {
  const result = validateMonteCarloInputs(value, options);
  if (!result.valid) {
    const error = new TypeError(result.errors.map((entry) => entry.message).join(" "));
    error.code = "MONTE_CARLO_INPUT_INVALID";
    error.issues = result.errors;
    throw error;
  }
  return result.value;
}

export function generateRandomSeed(random = Math.random) {
  const cryptoObject = typeof globalThis !== "undefined" ? globalThis.crypto : null;
  if (cryptoObject && typeof cryptoObject.getRandomValues === "function") {
    const values = new Uint32Array(1);
    cryptoObject.getRandomValues(values);
    return values[0];
  }
  return Math.floor(Number(random()) * (MAX_UINT32 + 1)) >>> 0;
}

export function fingerprintMonteCarloInputs(value, options = {}) {
  const result = validateMonteCarloInputs(value, options);
  if (!result.valid) return null;
  return JSON.stringify(result.value);
}

function normalizeIncludedSymbols(rawSymbols, rawInitialValues, errors) {
  if (!Array.isArray(rawSymbols)) {
    errors.push(issue("INCLUDED_SYMBOLS_REQUIRED", "Provide at least one included symbol."));
    return [];
  }

  const seen = new Set();
  const symbols = [];
  rawSymbols.forEach((entry, index) => {
    const source = typeof entry === "string" ? { symbol: entry } : entry;
    if (!isPlainObject(source) || source.included === false) return;
    const symbol = String(source.symbol ?? source.ticker ?? "").trim().toUpperCase();
    if (!SYMBOL_PATTERN.test(symbol)) {
      errors.push(issue("INVALID_INCLUDED_SYMBOL", `Included symbol at index ${index} is invalid.`));
      return;
    }
    if (seen.has(symbol)) {
      errors.push(issue("DUPLICATE_INCLUDED_SYMBOL", `Included symbol ${symbol} appears more than once.`));
      return;
    }
    seen.add(symbol);
    const mappedValue = isPlainObject(rawInitialValues) ? rawInitialValues[symbol] : undefined;
    const initialValue = source.initialValue === undefined ? mappedValue : source.initialValue;
    if (!Number.isFinite(initialValue) || initialValue <= 0) {
      errors.push(issue("INVALID_INITIAL_VALUE", `Included symbol ${symbol} requires a positive finite initial value.`));
      return;
    }
    symbols.push({ symbol, initialValue: Number(initialValue) });
  });

  if (symbols.length === 0) {
    errors.push(issue("INCLUDED_SYMBOLS_REQUIRED", "Provide at least one included symbol with a positive initial value."));
  }
  return symbols;
}

function normalizePathCount(pathCount, errors) {
  const value = pathCount === undefined ? DEFAULT_PATH_COUNT : pathCount;
  if (!SUPPORTED_PATH_COUNTS.includes(value)) {
    errors.push(issue(
      "UNSUPPORTED_PATH_COUNT",
      `Path count must be one of ${SUPPORTED_PATH_COUNTS.join(", ")}; the selected count is never reduced automatically.`
    ));
    return null;
  }
  return value;
}

function normalizeInteger(value, name, errors, constraints) {
  if (!Number.isInteger(value) || value < constraints.min || value > constraints.max) {
    errors.push(issue(
      constraints.code,
      `${name} must be a whole number from ${constraints.min} to ${constraints.max}.`
    ));
    return null;
  }
  return value;
}

function normalizeSeed(seedMode, rawSeed, errors, randomSeed, randomSeedOverride) {
  if (seedMode !== SEED_MODES.FIXED && seedMode !== SEED_MODES.RANDOM) {
    errors.push(issue("INVALID_SEED_MODE", "seedMode must be fixed or random."));
    return null;
  }
  if (seedMode === SEED_MODES.RANDOM) {
    if (rawSeed === undefined && randomSeedOverride !== undefined) {
      return validateSeed(randomSeedOverride, errors);
    }
    return rawSeed === undefined ? generateRandomSeed(randomSeed) : validateSeed(rawSeed, errors);
  }
  if (rawSeed === undefined) {
    errors.push(issue("FIXED_SEED_REQUIRED", "A fixed seed mode requires a seed."));
    return null;
  }
  return validateSeed(rawSeed, errors);
}

function validateSeed(seed, errors) {
  if (!Number.isInteger(seed) || seed < 0 || seed > MAX_UINT32) {
    errors.push(issue("INVALID_SEED", `seed must be an integer from 0 to ${MAX_UINT32}.`));
    return null;
  }
  return seed;
}

function issue(code, message) {
  return Object.freeze({ code, message });
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
