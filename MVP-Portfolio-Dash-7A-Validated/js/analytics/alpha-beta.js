import { alignReturnSeriesByExactInterval } from "./date-alignment.js";
import {
  analyticsMetadata,
  mergeWarnings,
  resolveAvailableState,
  unavailableResult,
  warning
} from "./return-series.js";

export const DEFAULT_TRADING_PERIODS_PER_YEAR = 252;

/** Calculates beta from exact-date aligned periodic arithmetic returns. */
export function calculateBeta(portfolioReturns, benchmarkReturns, options = {}) {
  const prepared = prepareAlignedReturns(portfolioReturns, benchmarkReturns, options);
  if (!prepared.valid) {
    return unavailableResult("beta", prepared.state, prepared.warnings, options, prepared.counts);
  }

  const betaValues = calculateBetaValues(prepared.portfolioValues, prepared.benchmarkValues);
  if (!betaValues.valid) {
    return unavailableResult("beta", "unavailable", prepared.warnings.concat(betaValues.warning), options, prepared.counts);
  }

  return {
    ...analyticsMetadata("beta", {
      ...options,
      methodology: "Sample covariance of portfolio and benchmark periodic arithmetic returns divided by sample benchmark variance after exact trading-date and interval alignment."
    }),
    available: true,
    state: resolveAvailableState(options.inputState),
    value: betaValues.beta,
    beta: betaValues.beta,
    covariance: betaValues.covariance,
    benchmarkVariance: betaValues.benchmarkVariance,
    periodicity: options.periodicity || "daily",
    counts: prepared.counts,
    dateRange: prepared.dateRange,
    warnings: prepared.warnings
  };
}

/**
 * Calculates Jensen-style alpha and beta with one consistent return period.
 * The approved annual risk-free rate is compounded down to that period; the
 * arithmetic periodic alpha is annualized by periodsPerYear.
 */
export function calculateAlphaBeta(
  portfolioReturns,
  benchmarkReturns,
  riskFreeRate,
  options = {}
) {
  const betaResult = calculateBeta(portfolioReturns, benchmarkReturns, options);
  const periodsPerYear = options.periodsPerYear === undefined
    ? DEFAULT_TRADING_PERIODS_PER_YEAR
    : options.periodsPerYear;
  const rate = normalizeRiskFreeRate(riskFreeRate, options);
  const combinedWarnings = mergeWarnings(betaResult.warnings, rate.warnings);

  let alphaResult;
  if (!betaResult.available) {
    alphaResult = unavailableResult("alpha", betaResult.state, combinedWarnings.concat(warning(
      "ANALYTICS_ALPHA_BETA_REQUIRED",
      "Alpha is unavailable because beta could not be calculated."
    )), { ...options, riskFreeRateSource: rate.source }, betaResult.counts);
  } else if (!Number.isInteger(periodsPerYear) || periodsPerYear <= 0) {
    alphaResult = unavailableResult("alpha", "unavailable", combinedWarnings.concat(warning(
      "ANALYTICS_PERIODICITY_INVALID",
      "periodsPerYear must be a positive integer."
    )), { ...options, riskFreeRateSource: rate.source }, betaResult.counts);
  } else if (!rate.valid) {
    alphaResult = unavailableResult("alpha", rate.state, combinedWarnings, {
      ...options,
      riskFreeRateSource: rate.source
    }, betaResult.counts);
  } else {
    const prepared = prepareAlignedReturns(portfolioReturns, benchmarkReturns, options);
    const portfolioMean = mean(prepared.portfolioValues);
    const benchmarkMean = mean(prepared.benchmarkValues);
    const periodicRiskFreeRate = (1 + rate.annualRate) ** (1 / periodsPerYear) - 1;
    const periodicAlpha = (portfolioMean - periodicRiskFreeRate)
      - betaResult.beta * (benchmarkMean - periodicRiskFreeRate);
    const annualizedAlpha = periodicAlpha * periodsPerYear;

    if (!Number.isFinite(periodicRiskFreeRate)
        || !Number.isFinite(periodicAlpha)
        || !Number.isFinite(annualizedAlpha)) {
      alphaResult = unavailableResult("alpha", "unavailable", combinedWarnings.concat(warning(
        "ANALYTICS_ALPHA_NONFINITE",
        "The alpha calculation produced a nonfinite result."
      )), { ...options, riskFreeRateSource: rate.source }, betaResult.counts);
    } else {
      alphaResult = {
        ...analyticsMetadata("alpha", {
          ...options,
          riskFreeRateSource: rate.source,
          methodology: "Jensen-style arithmetic alpha from exact-date aligned periodic returns; the approved annual risk-free rate is compounded to the return period and periodic alpha is annualized arithmetically."
        }),
        available: true,
        state: rate.stale ? "stale" : resolveAvailableState(options.inputState),
        value: annualizedAlpha,
        alpha: annualizedAlpha,
        periodicAlpha,
        portfolioMeanPeriodicReturn: portfolioMean,
        benchmarkMeanPeriodicReturn: benchmarkMean,
        annualRiskFreeRate: rate.annualRate,
        periodicRiskFreeRate,
        riskFreeRateStale: rate.stale,
        periodicity: options.periodicity || "daily",
        periodsPerYear,
        annualization: "arithmetic-periodic-alpha-times-periods-per-year",
        counts: betaResult.counts,
        dateRange: betaResult.dateRange,
        warnings: combinedWarnings
      };
    }
  }

  return {
    ...analyticsMetadata("alpha-beta", {
      ...options,
      riskFreeRateSource: rate.source,
      methodology: "Beta and Jensen-style alpha from the same exact-date aligned periodic arithmetic return observations."
    }),
    available: betaResult.available && alphaResult.available,
    partial: betaResult.available !== alphaResult.available,
    state: alphaResult.available ? alphaResult.state : betaResult.available ? alphaResult.state : betaResult.state,
    value: alphaResult.available ? { alpha: alphaResult.alpha, beta: betaResult.beta } : null,
    alpha: alphaResult.available ? alphaResult.alpha : null,
    beta: betaResult.available ? betaResult.beta : null,
    alphaResult,
    betaResult,
    periodicity: options.periodicity || "daily",
    periodsPerYear: Number.isInteger(periodsPerYear) && periodsPerYear > 0 ? periodsPerYear : null,
    counts: betaResult.counts,
    dateRange: betaResult.dateRange,
    warnings: mergeWarnings(betaResult.warnings, alphaResult.warnings)
  };
}

export const calculateAlphaAndBeta = calculateAlphaBeta;

function prepareAlignedReturns(portfolioReturns, benchmarkReturns, options) {
  const alignment = alignReturnSeriesByExactInterval(portfolioReturns, benchmarkReturns, {
    ...options,
    leftName: "portfolio",
    rightName: "benchmark",
    minimumObservations: options.minimumObservations || 2,
    leftValueField: options.portfolioValueField,
    rightValueField: options.benchmarkValueField
  });
  if (!alignment.available) {
    return {
      valid: false,
      state: alignment.state,
      warnings: alignment.warnings,
      counts: alignment.counts,
      dateRange: alignment.dateRange
    };
  }

  return {
    valid: true,
    portfolioValues: alignment.leftValues,
    benchmarkValues: alignment.rightValues,
    warnings: alignment.warnings,
    counts: { ...alignment.counts },
    dateRange: alignment.dateRange
  };
}

function calculateBetaValues(portfolioValues, benchmarkValues) {
  const portfolioMean = mean(portfolioValues);
  const benchmarkMean = mean(benchmarkValues);
  let covarianceTotal = 0;
  let varianceTotal = 0;
  for (let index = 0; index < portfolioValues.length; index += 1) {
    covarianceTotal += (portfolioValues[index] - portfolioMean)
      * (benchmarkValues[index] - benchmarkMean);
    varianceTotal += (benchmarkValues[index] - benchmarkMean) ** 2;
  }
  const denominator = portfolioValues.length - 1;
  const covariance = covarianceTotal / denominator;
  const benchmarkVariance = varianceTotal / denominator;
  if (!Number.isFinite(covariance) || !Number.isFinite(benchmarkVariance)
      || benchmarkVariance <= Number.EPSILON) {
    return {
      valid: false,
      warning: warning(
        "ANALYTICS_BENCHMARK_VARIANCE_INSUFFICIENT",
        "Beta requires at least two aligned returns and nonzero finite benchmark variance."
      )
    };
  }
  const beta = covariance / benchmarkVariance;
  return Number.isFinite(beta)
    ? { valid: true, beta, covariance, benchmarkVariance }
    : {
        valid: false,
        warning: warning("ANALYTICS_BETA_NONFINITE", "The beta calculation produced a nonfinite result.")
      };
}

function normalizeRiskFreeRate(input, options) {
  const wrapped = input && typeof input === "object" && !Array.isArray(input) ? input : null;
  const data = wrapped && wrapped.data && typeof wrapped.data === "object" ? wrapped.data : wrapped;
  const annualRate = typeof input === "number"
    ? input
    : data && data.rateDecimal;
  const deliverySource = wrapped && wrapped.source && wrapped.source !== "none"
    ? wrapped.source
    : null;
  const provider = wrapped && wrapped.provenance && wrapped.provenance.provider
    ? wrapped.provenance.provider
    : data && data.userProvided === true
      ? "User-provided"
      : isApprovedSource(deliverySource)
        ? deliverySource
        : null;
  const source = provider && deliverySource && provider !== deliverySource
    ? `${provider} (${deliverySource})`
    : provider || options.riskFreeRateSource || deliverySource || null;
  const stale = Boolean(wrapped && (wrapped.stale || wrapped.availability === "stale"));
  const warnings = mergeWarnings(wrapped && wrapped.warnings);
  const approved = options.riskFreeRateApproved === true
    || Boolean(data && data.userProvided === true)
    || isApprovedSource(provider)
    || isApprovedSource(source);

  if (!Number.isFinite(annualRate) || annualRate <= -1 || !source || !approved) {
    return {
      valid: false,
      state: "unavailable",
      annualRate: null,
      source,
      stale,
      warnings: warnings.concat(warning(
        "ANALYTICS_RISK_FREE_RATE_UNAVAILABLE",
        "Alpha requires a valid annual rate from the approved Treasury service or a clearly user-provided rate."
      ))
    };
  }
  if (stale) {
    warnings.push(warning(
      "ANALYTICS_RISK_FREE_RATE_STALE",
      "The cached risk-free rate is stale; alpha is labeled stale."
    ));
  }
  return { valid: true, state: stale ? "stale" : "available", annualRate, source, stale, warnings };
}

function isApprovedSource(source) {
  const normalized = String(source || "").toLowerCase();
  return normalized.includes("u.s. treasury")
    || normalized.includes("treasury fiscal data")
    || normalized.includes("user-provided")
    || normalized === "manual";
}

function mean(values) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}
