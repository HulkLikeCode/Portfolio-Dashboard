/** Daily log-return drift estimate: μ = Σrᵢ / n. */
export function arithmeticMean(values) {
  requireFiniteVector(values, "INVALID_STATISTICS_INPUT");
  if (values.length === 0) throw codedError("INSUFFICIENT_HISTORY", "At least one return observation is required.");
  let total = 0;
  for (const value of values) total += value;
  return total / values.length;
}

/** Sample variance: sum((x - mean)^2) / (n - 1). */
export function sampleVariance(values, mean = arithmeticMean(values)) {
  requireFiniteVector(values, "INVALID_STATISTICS_INPUT");
  if (values.length < 2) throw codedError("INSUFFICIENT_HISTORY", "At least two return observations are required for sample statistics.");
  let total = 0;
  for (const value of values) total += (value - mean) ** 2;
  return total / (values.length - 1);
}

/** Sample covariance: sum((x - xBar)(y - yBar)) / (n - 1). */
export function sampleCovariance(left, right, leftMean = arithmeticMean(left), rightMean = arithmeticMean(right)) {
  requireFiniteVector(left, "INVALID_STATISTICS_INPUT"); requireFiniteVector(right, "INVALID_STATISTICS_INPUT");
  if (left.length !== right.length) throw codedError("MISALIGNED_HISTORY", "Aligned return vectors must have equal lengths.");
  if (left.length < 2) throw codedError("INSUFFICIENT_HISTORY", "At least two aligned return observations are required.");
  let total = 0;
  for (let index = 0; index < left.length; index += 1) total += (left[index] - leftMean) * (right[index] - rightMean);
  return total / (left.length - 1);
}

/**
 * Estimates the GBM mean vector μ and sample covariance Σ from aligned daily
 * log-return vectors. Daily volatility is sqrt(Σᵢᵢ); no EWMA weighting is used.
 */
export function estimateLogReturnStatistics(returnMatrix) {
  if (!Array.isArray(returnMatrix) || returnMatrix.length === 0) throw codedError("INSUFFICIENT_HISTORY", "At least one included symbol is required.");
  const count = returnMatrix[0]?.length;
  if (!Number.isInteger(count) || count < 2) throw codedError("INSUFFICIENT_HISTORY", "At least two aligned daily log returns are required.");
  returnMatrix.forEach((values) => { if (values.length !== count) throw codedError("MISALIGNED_HISTORY", "No included symbol may be dropped from an aligned run."); requireFiniteVector(values, "NONFINITE_HISTORY"); });
  const means = returnMatrix.map(arithmeticMean);
  const covariance = returnMatrix.map((left, row) => returnMatrix.map((right, column) => sampleCovariance(left, right, means[row], means[column])));
  return { observationCount: count, means, variances: covariance.map((row, index) => row[index]), volatilities: covariance.map((row, index) => Math.sqrt(row[index])), covariance };
}

export function percentile(sortedValues, probability) {
  requireFiniteVector(sortedValues, "INVALID_DISTRIBUTION");
  if (sortedValues.length === 0 || probability < 0 || probability > 1 || !Number.isFinite(probability)) throw codedError("INVALID_PERCENTILE", "A percentile requires a non-empty finite distribution and probability from zero through one.");
  const position = (sortedValues.length - 1) * probability;
  const lower = Math.floor(position); const upper = Math.ceil(position);
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (position - lower);
}

export function sortedCopy(values) { requireFiniteVector(values, "INVALID_DISTRIBUTION"); return Array.from(values).sort((a, b) => a - b); }

/** Shared Monte Carlo ending-distribution metrics for GBM and Bootstrap. */
export function summarizeEndingValues(endingValues, initialValue, horizonYears) {
  requireFiniteVector(endingValues, "INVALID_DISTRIBUTION");
  if (!Number.isFinite(initialValue) || initialValue <= 0 || !Number.isInteger(horizonYears) || horizonYears < 1) throw codedError("INVALID_SUMMARY_INPUT", "Initial value and horizon must be finite and valid.");
  const ending = sortedCopy(endingValues);
  if (ending.length === 0) throw codedError("INVALID_DISTRIBUTION", "Ending-value distribution cannot be empty.");
  const p10 = percentile(ending, .10); const p50 = percentile(ending, .50); const p90 = percentile(ending, .90);
  const mean = ending.reduce((sum, value) => sum + value, 0) / ending.length;
  if (!Number.isFinite(mean) || mean <= 0) throw codedError("NONFINITE_DISTRIBUTION", "Ending-value distribution has an invalid mean.");
  return {
    endingValueDistribution: { count: ending.length, minimum: ending[0], maximum: ending[ending.length - 1], mean, p10, p50, p90 },
    p10, p50, p90, expectedAnnualizedReturn: (mean / initialValue) ** (1 / horizonYears) - 1,
    probabilityOfLoss: ending.filter((value) => value < initialValue).length / ending.length,
    valueAtRisk: Math.max(0, initialValue - p10)
  };
}

/** Percentile data at each simulated trading day, including the initial day. */
export function percentileBands(pathValues, initialValue) {
  if (!Array.isArray(pathValues) || pathValues.length === 0) throw codedError("INVALID_PATH_VALUES", "Simulation paths are required for percentile bands.");
  return pathValues.map((values, day) => {
    const sorted = sortedCopy(values);
    return { day, p5: percentile(sorted, .05), p10: percentile(sorted, .10), p25: percentile(sorted, .25), p50: percentile(sorted, .50), p75: percentile(sorted, .75), p90: percentile(sorted, .90), p95: percentile(sorted, .95), initialValue };
  });
}
export function requireFiniteVector(values, code) { if (!values || typeof values.length !== "number" || Array.from(values).some((value) => !Number.isFinite(value))) throw codedError(code, "All observations must be finite numbers."); }
function codedError(code, message) { const error = new Error(message); error.code = code; return error; }
