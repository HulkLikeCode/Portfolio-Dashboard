import { assertValidMonteCarloInputs } from "./mc-inputs.js";
import { createSeededRandom } from "./random.js";
import { percentileBands, summarizeEndingValues } from "./statistics.js";
import { normalizeDateOnly } from "../utils/date-utils.js";

export const TRADING_DAYS_PER_YEAR = 252;
export const MAX_LOOKBACK_RETURNS = 756;
export const ALIGNED_HISTORY_SOURCE = "historical-data-service-indexeddb";

/**
 * Builds trailing, date-aligned arithmetic return vectors.  Each matrix column
 * is one trading day across every included symbol and is therefore sampled as
 * a unit by the bootstrap engine.
 */
export function deriveAlignedArithmeticReturnVectors(includedSymbols, alignedHistory, lookbackReturns = MAX_LOOKBACK_RETURNS) {
  if (!Array.isArray(includedSymbols) || includedSymbols.length === 0) throw codedError("NO_INCLUDED_SYMBOLS", "At least one included holding is required.");
  validateAlignedHistory(alignedHistory);
  const closeVectors = includedSymbols.map(({ symbol }) => {
    const closes = alignedHistory.closes[symbol];
    if (!Array.isArray(closes) || closes.length < 3) throw codedError("INSUFFICIENT_HISTORY", `Symbol ${symbol} needs at least three aligned normalized closes.`);
    if (closes.some((value) => !Number.isFinite(value) || value <= 0)) throw codedError("INVALID_CLOSE_HISTORY", `Symbol ${symbol} contains a non-positive or nonfinite normalized close.`);
    return closes;
  });
  const closeCount = closeVectors[0].length;
  if (alignedHistory.dates.length !== closeCount || closeVectors.some((closes) => closes.length !== closeCount)) {
    throw codedError("MISALIGNED_HISTORY", "All included symbols require the same aligned close dates; no symbol was removed.");
  }
  const usedReturns = Math.min(closeCount - 1, lookbackReturns, MAX_LOOKBACK_RETURNS);
  if (usedReturns < 2) throw codedError("INSUFFICIENT_HISTORY", "At least two aligned daily return vectors are required for Historical Bootstrap.");
  const first = closeCount - usedReturns - 1;
  const vectors = Array.from({ length: usedReturns }, (_, day) => {
    const vector = closeVectors.map((closes) => closes[first + day + 1] / closes[first + day] - 1);
    if (vector.some((value) => !Number.isFinite(value))) throw codedError("NONFINITE_RETURN", "Historical Bootstrap received a nonfinite arithmetic return.");
    if (vector.some((value) => value <= -1)) throw codedError("RETURN_AT_OR_BELOW_MINUS_100_PERCENT", "Historical Bootstrap cannot compound a return less than or equal to -100%.");
    return vector;
  });
  return {
    vectors,
    dates: alignedHistory.dates.slice(first + 1),
    observationCount: usedReturns,
    closeObservationCount: usedReturns + 1,
    shortenedLookback: usedReturns < Math.min(lookbackReturns, MAX_LOOKBACK_RETURNS)
  };
}

export function prepareBootstrapRun(inputs, alignedHistory) {
  const validatedInputs = assertValidMonteCarloInputs(inputs);
  const returns = deriveAlignedArithmeticReturnVectors(validatedInputs.includedSymbols, alignedHistory, validatedInputs.lookbackReturns);
  const totalInitialValue = validatedInputs.includedSymbols.reduce((sum, item) => sum + item.initialValue, 0);
  if (!Number.isFinite(totalInitialValue) || totalInitialValue <= 0) throw codedError("INVALID_INITIAL_VALUE", "Portfolio initial value must be positive and finite.");
  const totalDays = validatedInputs.horizonYears * TRADING_DAYS_PER_YEAR;
  return {
    inputs: validatedInputs, returns, totalInitialValue, totalDays,
    random: createSeededRandom(validatedInputs.seed), endingValues: new Float64Array(validatedInputs.pathCount),
    pathValues: Array.from({ length: totalDays + 1 }, () => new Float64Array(validatedInputs.pathCount)), completedPaths: 0
  };
}

export function simulateBootstrapPath(run, pathIndex) {
  const values = run.inputs.includedSymbols.map((item) => item.initialValue);
  run.pathValues[0][pathIndex] = run.totalInitialValue;
  for (let day = 1; day <= run.totalDays; day += 1) {
    // One index selects the complete same-day cross-asset vector.  Assets are
    // intentionally never sampled independently.
    const sampledVector = run.returns.vectors[Math.floor(run.random.next() * run.returns.vectors.length)];
    let total = 0;
    for (let asset = 0; asset < values.length; asset += 1) {
      const multiplier = 1 + sampledVector[asset];
      if (!Number.isFinite(multiplier) || multiplier <= 0) throw codedError("INVALID_BOOTSTRAP_MULTIPLIER", "Historical Bootstrap produced an invalid daily asset multiplier.");
      values[asset] *= multiplier;
      if (!Number.isFinite(values[asset]) || values[asset] <= 0) throw codedError(values[asset] === Infinity ? "BOOTSTRAP_OVERFLOW" : "BOOTSTRAP_NONFINITE_OUTPUT", "Historical Bootstrap produced a nonfinite or nonpositive asset value.");
      total += values[asset];
    }
    if (!Number.isFinite(total) || total <= 0) throw codedError("BOOTSTRAP_NONFINITE_OUTPUT", "Historical Bootstrap produced a nonfinite portfolio value.");
    run.pathValues[day][pathIndex] = total;
  }
  run.endingValues[pathIndex] = run.pathValues[run.totalDays][pathIndex];
  run.completedPaths += 1;
}

export function finalizeBootstrapRun(run) {
  if (run.completedPaths !== run.inputs.pathCount) throw codedError("INCOMPLETE_SIMULATION", "The selected path count was not completed.");
  const summary = summarizeEndingValues(run.endingValues, run.totalInitialValue, run.inputs.horizonYears);
  const bands = percentileBands(run.pathValues, run.totalInitialValue);
  return {
    // Keep the accepted Phase 7A typed result discriminator; consumers may use
    // the explicit method field to select method-specific presentation.
    kind: "infrastructure-ready", method: "historical-bootstrap",
    pathCount: run.inputs.pathCount, horizonYears: run.inputs.horizonYears, seed: run.inputs.seed,
    tradingDaysPerYear: TRADING_DAYS_PER_YEAR, totalTradingDays: run.totalDays,
    symbols: run.inputs.includedSymbols.map(({ symbol }) => symbol), initialValue: run.totalInitialValue,
    resampling: { observationCount: run.returns.observationCount, closeObservationCount: run.returns.closeObservationCount, shortenedLookback: run.returns.shortenedLookback, vectorDates: run.returns.dates },
    diagnostics: { messages: run.returns.shortenedLookback ? ["Historical Bootstrap used a shorter aligned return lookback."] : [] },
    ...summary,
    confidenceFan: bands.map(({ day, p10, p50, p90 }) => ({ day, p10, p50, p90 })),
    percentileBands: bands
  };
}

export function runBootstrapSimulation(inputs, alignedHistory) {
  const run = prepareBootstrapRun(inputs, alignedHistory);
  for (let path = 0; path < run.inputs.pathCount; path += 1) simulateBootstrapPath(run, path);
  return finalizeBootstrapRun(run);
}

function validateAlignedHistory(history) {
  if (!history || typeof history !== "object" || Array.isArray(history)) throw codedError("HISTORY_REQUIRED", "Dated aligned local history is required for Historical Bootstrap.");
  if (history.source !== ALIGNED_HISTORY_SOURCE) throw codedError("HISTORY_PROVENANCE_INVALID", "Historical Bootstrap requires aligned history supplied by local Historical Data Service storage.");
  if (!history.closes || typeof history.closes !== "object" || Array.isArray(history.closes) || !Array.isArray(history.dates) || history.dates.length < 3) throw codedError("INSUFFICIENT_HISTORY", "At least three aligned normalized Stooq closes are required.");
  let previousDate = null;
  history.dates.forEach((date, index) => {
    let normalized;
    try { normalized = normalizeDateOnly(date, `aligned history date ${index}`); } catch (_error) { throw codedError("MISALIGNED_HISTORY", "Aligned history dates must be valid ISO calendar dates."); }
    if (normalized !== date || (previousDate !== null && normalized <= previousDate)) throw codedError("MISALIGNED_HISTORY", "Aligned history dates must be unique and strictly ascending.");
    previousDate = normalized;
  });
}
function codedError(code, message) { const error = new Error(message); error.code = code; return error; }
