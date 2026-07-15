import { factorCovariance, multiplyLowerTriangular } from "./covariance.js";
import { assertValidMonteCarloInputs } from "./mc-inputs.js";
import { createSeededRandom } from "./random.js";
import { estimateLogReturnStatistics, percentile, sortedCopy } from "./statistics.js";
import { normalizeDateOnly } from "../utils/date-utils.js";

export const TRADING_DAYS_PER_YEAR = 252;
export const MAX_LOOKBACK_RETURNS = 756;
export const ALIGNED_HISTORY_SOURCE = "historical-data-service-indexeddb";

/**
 * Builds trailing aligned log returns, r_t = ln(C_t / C_(t-1)), from the
 * dated, local IndexedDB output of HistoricalDataService.getAlignedSeries().
 */
export function deriveAlignedLogReturns(includedSymbols, alignedHistory, lookbackReturns = MAX_LOOKBACK_RETURNS) {
  if (!Array.isArray(includedSymbols) || includedSymbols.length === 0) throw codedError("NO_INCLUDED_SYMBOLS", "At least one included holding is required.");
  const validatedHistory = validateAlignedHistory(alignedHistory);
  const alignedCloses = validatedHistory.closes;
  const closeVectors = includedSymbols.map(({ symbol }) => {
    const values = alignedCloses[symbol];
    if (!Array.isArray(values) || values.length < 3) throw codedError("INSUFFICIENT_HISTORY", `Symbol ${symbol} needs at least three aligned normalized closes.`);
    if (values.some((value) => !Number.isFinite(value) || value <= 0)) throw codedError("INVALID_CLOSE_HISTORY", `Symbol ${symbol} contains a non-positive or nonfinite normalized close.`);
    return values;
  });
  const closeCount = closeVectors[0].length;
  if (validatedHistory.dates.length !== closeCount) throw codedError("MISALIGNED_HISTORY", "Aligned history dates and close vectors must have the same observation count.");
  if (closeVectors.some((values) => values.length !== closeCount)) throw codedError("MISALIGNED_HISTORY", "All included symbols require the same aligned close dates; no symbol was removed.");
  const availableReturns = closeCount - 1;
  const usedReturns = Math.min(availableReturns, lookbackReturns, MAX_LOOKBACK_RETURNS);
  if (usedReturns < 2) throw codedError("INSUFFICIENT_HISTORY", "At least two aligned daily log returns are required for sample covariance.");
  const first = closeCount - usedReturns - 1;
  return {
    observationCount: usedReturns,
    closeObservationCount: usedReturns + 1,
    shortenedLookback: usedReturns < Math.min(lookbackReturns, MAX_LOOKBACK_RETURNS),
    matrix: closeVectors.map((closes) => Array.from({ length: usedReturns }, (_, index) => Math.log(closes[first + index + 1] / closes[first + index])))
  };
}

export function prepareGbmRun(inputs, alignedHistory) {
  const validatedInputs = assertValidMonteCarloInputs(inputs);
  const returns = deriveAlignedLogReturns(validatedInputs.includedSymbols, alignedHistory, validatedInputs.lookbackReturns);
  const estimates = estimateLogReturnStatistics(returns.matrix);
  const covariance = factorCovariance(estimates.covariance);
  const totalDays = validatedInputs.horizonYears * TRADING_DAYS_PER_YEAR;
  const totalInitialValue = validatedInputs.includedSymbols.reduce((sum, item) => sum + item.initialValue, 0);
  if (!Number.isFinite(totalInitialValue) || totalInitialValue <= 0) throw codedError("INVALID_INITIAL_VALUE", "Portfolio initial value must be positive and finite.");
  return {
    inputs: validatedInputs, totalDays, totalInitialValue, returns, estimates, covariance,
    random: createSeededRandom(validatedInputs.seed), endingValues: new Float64Array(validatedInputs.pathCount),
    // Every path/day value is retained so Phase 8 can render daily percentile bands.
    pathValues: Array.from({ length: totalDays + 1 }, () => new Float64Array(validatedInputs.pathCount)), completedPaths: 0
  };
}

export function simulateGbmPath(run, pathIndex) {
  const { inputs, random, covariance, estimates, totalDays, pathValues } = run;
  const values = inputs.includedSymbols.map((item) => item.initialValue);
  pathValues[0][pathIndex] = run.totalInitialValue;
  for (let day = 1; day <= totalDays; day += 1) {
    const shocks = multiplyLowerTriangular(covariance.factor, values.map(() => random.normal()));
    let total = 0;
    for (let asset = 0; asset < values.length; asset += 1) {
      // With μ = mean(r) and Σ = sampleCovariance(r), L Lᵀ = Σ and z ~ N(0, I):
      // V_(t+1) = V_t exp(μ + Lz), one observed trading-day log-return step.
      const multiplier = Math.exp(estimates.means[asset] + shocks[asset]);
      if (!Number.isFinite(multiplier) || multiplier === 0) throw codedError(multiplier === 0 ? "GBM_UNDERFLOW" : "GBM_OVERFLOW", "GBM produced an invalid daily asset multiplier.");
      values[asset] *= multiplier;
      if (!Number.isFinite(values[asset]) || values[asset] === 0) throw codedError(values[asset] === 0 ? "GBM_UNDERFLOW" : "GBM_OVERFLOW", "GBM produced an invalid asset value.");
      total += values[asset];
    }
    if (!Number.isFinite(total) || total <= 0) throw codedError("GBM_NONFINITE_OUTPUT", "GBM produced a nonfinite portfolio value.");
    pathValues[day][pathIndex] = total;
  }
  run.endingValues[pathIndex] = pathValues[totalDays][pathIndex];
  run.completedPaths += 1;
}

export function finalizeGbmRun(run) {
  if (run.completedPaths !== run.inputs.pathCount) throw codedError("INCOMPLETE_SIMULATION", "The selected path count was not completed.");
  const ending = sortedCopy(run.endingValues);
  const p10 = percentile(ending, .10); const p50 = percentile(ending, .50); const p90 = percentile(ending, .90);
  const lossCount = ending.filter((value) => value < run.totalInitialValue).length;
  const expectedEndingValue = ending.reduce((sum, value) => sum + value, 0) / ending.length;
  const expectedAnnualizedReturn = (expectedEndingValue / run.totalInitialValue) ** (1 / run.inputs.horizonYears) - 1;
  const bands = run.pathValues.map((values, day) => bandPoint(day, values, run.totalInitialValue));
  return {
    kind: "infrastructure-ready", // Retains the accepted Phase 7A result envelope.
    method: "gbm", pathCount: run.inputs.pathCount, horizonYears: run.inputs.horizonYears, seed: run.inputs.seed,
    tradingDaysPerYear: TRADING_DAYS_PER_YEAR, totalTradingDays: run.totalDays,
    symbols: run.inputs.includedSymbols.map(({ symbol }) => symbol), initialValue: run.totalInitialValue,
    estimation: { dailyDrift: run.estimates.means, dailyVolatility: run.estimates.volatilities, covariance: run.estimates.covariance, observationCount: run.returns.observationCount, closeObservationCount: run.returns.closeObservationCount, shortenedLookback: run.returns.shortenedLookback },
    diagnostics: { covarianceStabilization: run.covariance.stabilization, messages: run.covariance.stabilization.applied ? ["Sample covariance was singular or non-positive-definite; bounded diagonal ridge jitter was applied before Cholesky decomposition."] : [] },
    endingValueDistribution: { count: ending.length, minimum: ending[0], maximum: ending[ending.length - 1], mean: expectedEndingValue, p10, p50, p90 },
    p10, p50, p90, expectedAnnualizedReturn, probabilityOfLoss: lossCount / ending.length,
    valueAtRisk: Math.max(0, run.totalInitialValue - p10),
    confidenceFan: bands.map(({ day, p10: lower, p50: median, p90: upper }) => ({ day, p10: lower, p50: median, p90: upper })),
    percentileBands: bands
  };
}

export function runGbmSimulation(inputs, alignedHistory) { const run = prepareGbmRun(inputs, alignedHistory); for (let path = 0; path < run.inputs.pathCount; path += 1) simulateGbmPath(run, path); return finalizeGbmRun(run); }

function bandPoint(day, values, initialValue) { const sorted = sortedCopy(values); return { day, p5: percentile(sorted, .05), p10: percentile(sorted, .10), p25: percentile(sorted, .25), p50: percentile(sorted, .50), p75: percentile(sorted, .75), p90: percentile(sorted, .90), p95: percentile(sorted, .95), initialValue }; }
function validateAlignedHistory(history) {
  if (!history || typeof history !== "object" || Array.isArray(history)) throw codedError("HISTORY_REQUIRED", "Dated aligned local history is required for GBM.");
  if (history.source !== ALIGNED_HISTORY_SOURCE) throw codedError("HISTORY_PROVENANCE_INVALID", "GBM requires aligned history supplied by local Historical Data Service storage.");
  if (!history.closes || typeof history.closes !== "object" || Array.isArray(history.closes) || !Array.isArray(history.dates)) throw codedError("HISTORY_REQUIRED", "Dated aligned normalized Stooq closes are required for GBM.");
  if (history.dates.length < 3) throw codedError("INSUFFICIENT_HISTORY", "At least three aligned local closing dates are required for GBM.");
  let previousDate = null;
  history.dates.forEach((date, index) => {
    let normalized;
    try { normalized = normalizeDateOnly(date, `aligned history date ${index}`); } catch (_error) { throw codedError("MISALIGNED_HISTORY", "Aligned history dates must be valid ISO calendar dates."); }
    if (normalized !== date || (previousDate !== null && normalized <= previousDate)) throw codedError("MISALIGNED_HISTORY", "Aligned history dates must be unique and strictly ascending.");
    previousDate = normalized;
  });
  return history;
}
function codedError(code, message) { const error = new Error(message); error.code = code; return error; }
