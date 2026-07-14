import {
  calculateLotCost,
  calculateMarketValueWeights
} from "../portfolio/portfolio-engine.js";
import { assertValidPortfolio } from "../portfolio/portfolio-validation.js";
import { compareDateOnly, normalizeDateOnly } from "../utils/date-utils.js";
import { sumFinite } from "../utils/number-utils.js";
import { calculateAlphaBeta } from "./alpha-beta.js";
import { calculateCagr } from "./cagr.js";
import { alignSeriesByExactDate } from "./date-alignment.js";
import { calculateMaximumDrawdown } from "./drawdown.js";
import {
  analyticsMetadata,
  buildDailyArithmeticReturns,
  buildDailyLogReturns,
  buildNormalizedPerformanceSeries,
  mergeWarnings,
  unavailableResult,
  warning
} from "./return-series.js";

export const ANALYTICS_ENGINE_VERSION = "2.3-phase-6a";

export class AnalyticsEngine {
  constructor(options = {}) {
    this.historicalDataService = options.historicalDataService || null;
    this.riskFreeRateService = options.riskFreeRateService || null;
    this.portfolioSeriesBuilder = typeof options.portfolioSeriesBuilder === "function"
      ? options.portfolioSeriesBuilder
      : buildAcquisitionAwarePerformanceSeries;
  }

  async analyzePortfolio(portfolio, options = {}) {
    return analyzePortfolio(portfolio, {
      ...options,
      historicalDataService: options.historicalDataService || this.historicalDataService,
      riskFreeRateService: options.riskFreeRateService || this.riskFreeRateService,
      portfolioSeriesBuilder: options.portfolioSeriesBuilder || this.portfolioSeriesBuilder
    });
  }

  async calculate(portfolio, options = {}) {
    return this.analyzePortfolio(portfolio, options);
  }
}

export function createAnalyticsEngine(options = {}) {
  return new AnalyticsEngine(options);
}

/**
 * Orchestrates Phase 6A only. Historical values are read through the injected
 * Historical Data Service; no source files, network history, or simulations are
 * accessed here.
 */
export async function analyzePortfolio(portfolio, options = {}) {
  const historicalDataService = options.historicalDataService;
  const builder = typeof options.portfolioSeriesBuilder === "function"
    ? options.portfolioSeriesBuilder
    : buildAcquisitionAwarePerformanceSeries;
  const benchmarkSelection = resolveConfiguredBenchmark(options.benchmark, portfolio);
  const benchmark = benchmarkSelection.benchmark;

  if (!historicalDataService
      || typeof historicalDataService.getAlignedSeries !== "function"
      || typeof historicalDataService.getSeries !== "function") {
    return failedEngineResult(benchmark, warning(
      "ANALYTICS_HISTORICAL_SERVICE_REQUIRED",
      "Analytics require Historical Data Service getAlignedSeries() and getSeries() interfaces."
    ));
  }

  let portfolioSeries;
  try {
    portfolioSeries = await builder(portfolio, historicalDataService, portfolioServiceOptions(options));
  } catch (error) {
    return failedEngineResult(benchmark, warning(
      "ANALYTICS_PORTFOLIO_SERIES_FAILED",
      "The contribution-neutral portfolio performance series could not be built.",
      { cause: serializeError(error) },
      "error"
    ));
  }

  const sourceWarnings = mergeWarnings(
    portfolioSeries && portfolioSeries.warnings,
    benchmarkSelection.warning ? [benchmarkSelection.warning] : []
  );
  const commonOptions = {
    benchmark: benchmark ? { ticker: benchmark.ticker, label: benchmark.label } : null,
    inputState: portfolioSeries && portfolioSeries.state,
    warnings: sourceWarnings
  };

  if (!portfolioSeries || portfolioSeries.available !== true || !Array.isArray(portfolioSeries.rows)
      || portfolioSeries.rows.length === 0) {
    return failedEngineResult(benchmark, warning(
      "ANALYTICS_PORTFOLIO_HISTORY_UNAVAILABLE",
      "Portfolio history is missing or unavailable; analytics were not fabricated."
    ), portfolioSeries);
  }

  const portfolioObservations = portfolioSeries.rows.map((row) => ({
    date: row.date,
    value: row.normalizedPriceReturnIndex
  }));
  const performanceSeries = buildNormalizedPerformanceSeries(portfolioObservations, {
    ...commonOptions,
    baseValue: options.baseValue === undefined ? 100 : options.baseValue,
    methodology: "Contribution-neutral fixed-share buy-and-hold Price-Return Performance Series rebased from Historical Data Service closes; lot shares activate on the first aligned session on or after acquisition."
  });
  const cagr = calculateCagr(performanceSeries, commonOptions);
  const drawdown = calculateMaximumDrawdown(performanceSeries, {
    ...commonOptions,
    sourceSeriesType: "price-return-performance-series"
  });
  const portfolioArithmeticReturns = buildDailyArithmeticReturns(performanceSeries, commonOptions);
  const portfolioLogReturns = buildDailyLogReturns(performanceSeries, commonOptions);

  let benchmarkSeriesResult = null;
  let alignment;
  let benchmarkPerformanceSeries;
  let benchmarkArithmeticReturns;
  let benchmarkLogReturns;
  let comparison;
  let alphaBeta;
  let riskFreeRateResult = null;

  if (!benchmark) {
    const noBenchmark = benchmarkSelection.warning || warning(
      "ANALYTICS_BENCHMARK_REQUIRED",
      "A visible configured active benchmark is required for benchmark comparison, alpha, and beta."
    );
    alignment = unavailableResult("exact-date-alignment", "missing", [noBenchmark], commonOptions);
    benchmarkPerformanceSeries = unavailableResult("normalized-performance-series", "missing", [noBenchmark], commonOptions);
    benchmarkArithmeticReturns = unavailableResult("daily-arithmetic-returns", "missing", [noBenchmark], commonOptions);
    benchmarkLogReturns = unavailableResult("daily-log-returns", "missing", [noBenchmark], commonOptions);
    comparison = unavailableResult("normalized-benchmark-comparison", "missing", [noBenchmark], commonOptions);
    alphaBeta = calculateAlphaBeta(portfolioArithmeticReturns, benchmarkArithmeticReturns, null, commonOptions);
  } else {
    try {
      benchmarkSeriesResult = await historicalDataService.getSeries(
        benchmark.ticker,
        benchmarkServiceOptions(options, portfolioSeries.dateRange)
      );
    } catch (error) {
      benchmarkSeriesResult = {
        available: false,
        state: "error",
        candles: [],
        warnings: [warning(
          "ANALYTICS_BENCHMARK_HISTORY_FAILED",
          `Historical Data Service could not read ${benchmark.ticker} benchmark history.`,
          { cause: serializeError(error) },
          "error"
        )]
      };
    }

    const benchmarkObservations = benchmarkCandles(benchmarkSeriesResult);
    const benchmarkWarnings = mergeWarnings(sourceWarnings, benchmarkSeriesResult.warnings);
    const comparisonOptions = {
      ...commonOptions,
      inputState: mergeInputState(portfolioSeries.state, benchmarkSeriesResult.state),
      warnings: benchmarkWarnings
    };
    benchmarkPerformanceSeries = buildNormalizedPerformanceSeries(benchmarkObservations, {
      ...comparisonOptions,
      baseValue: options.baseValue === undefined ? 100 : options.baseValue
    });
    benchmarkArithmeticReturns = buildDailyArithmeticReturns(benchmarkPerformanceSeries, comparisonOptions);
    benchmarkLogReturns = buildDailyLogReturns(benchmarkPerformanceSeries, comparisonOptions);
    alignment = alignSeriesByExactDate(portfolioObservations, benchmarkObservations, {
      ...comparisonOptions,
      leftName: "portfolio",
      rightName: "benchmark",
      minimumObservations: 2
    });

    if (alignment.available) {
      const alignedPortfolio = alignment.rows.map((row) => ({
        date: row.date,
        value: row.portfolioValue
      }));
      const alignedBenchmark = alignment.rows.map((row) => ({
        date: row.date,
        value: row.benchmarkValue
      }));
      const alignedOptions = {
        ...comparisonOptions,
        warnings: alignment.warnings,
        baseValue: options.baseValue === undefined ? 100 : options.baseValue
      };
      const alignedPortfolioPerformance = buildNormalizedPerformanceSeries(alignedPortfolio, alignedOptions);
      const alignedBenchmarkPerformance = buildNormalizedPerformanceSeries(alignedBenchmark, alignedOptions);
      comparison = buildComparison(alignedPortfolioPerformance, alignedBenchmarkPerformance, alignment, alignedOptions);
    } else {
      comparison = unavailableResult("normalized-benchmark-comparison", alignment.state, alignment.warnings, comparisonOptions, alignment.counts);
    }
    riskFreeRateResult = await resolveRiskFreeRate(options);
    alphaBeta = calculateAlphaBeta(
      portfolioArithmeticReturns,
      benchmarkArithmeticReturns,
      riskFreeRateResult,
      {
        ...comparisonOptions,
        periodsPerYear: options.periodsPerYear,
        periodicity: "daily"
      }
    );
  }

  const allWarnings = deduplicateWarnings(mergeWarnings(
    sourceWarnings,
    performanceSeries.warnings,
    cagr.warnings,
    drawdown.warnings,
    alignment.warnings,
    alphaBeta.warnings
  ));
  const riskFreeRateSource = alphaBeta.riskFreeRateSource || null;

  return {
    ...analyticsMetadata("portfolio-analytics", {
      benchmark: benchmark ? { ticker: benchmark.ticker, label: benchmark.label } : null,
      riskFreeRateSource,
      methodology: "Phase 6A analytics from normalized Stooq closes supplied by Historical Data Service, using fixed-share buy-and-hold lots, contribution-neutral portfolio returns, exact benchmark-date alignment, and no daily rebalancing."
    }),
    engineVersion: ANALYTICS_ENGINE_VERSION,
    available: performanceSeries.available && cagr.available && drawdown.available
      && alphaBeta.alphaResult.available && alphaBeta.betaResult.available,
    coreAvailable: performanceSeries.available && cagr.available && drawdown.available,
    state: overallState([performanceSeries, cagr, drawdown, alignment, alphaBeta]),
    performanceSeries,
    portfolioArithmeticReturns,
    portfolioLogReturns,
    cagr,
    drawdown,
    benchmarkComparison: comparison,
    dateAlignment: alignment,
    benchmarkPerformanceSeries,
    benchmarkArithmeticReturns,
    benchmarkLogReturns,
    alpha: alphaBeta.alphaResult,
    beta: alphaBeta.betaResult,
    alphaBeta,
    benchmark: benchmark ? {
      ticker: benchmark.ticker,
      label: benchmark.label,
      configured: true,
      historicalState: benchmarkSeriesResult && benchmarkSeriesResult.state || null
    } : null,
    riskFreeRateSource,
    riskFreeRate: summarizeRiskFreeRate(riskFreeRateResult),
    counts: {
      portfolioObservationCount: performanceSeries.counts.observationCount || 0,
      portfolioReturnObservationCount: Math.max(0, (performanceSeries.counts.observationCount || 0) - 1),
      alignedObservationCount: alignment.counts.alignedObservationCount || 0,
      alignedReturnObservationCount: alphaBeta.counts.alignedReturnObservationCount || 0
    },
    dateRange: performanceSeries.dateRange,
    alignedDateRange: alphaBeta.dateRange || { firstDate: null, lastDate: null },
    comparisonDateRange: alignment.dateRange,
    warnings: allWarnings,
    source: {
      historical: "Historical Data Service normalized Stooq close history",
      priceAdjustment: "split-adjusted",
      dividendAdjustment: "none",
      historicalServiceVersion: portfolioSeries.historicalServiceVersion || null
    },
    portfolioMethodology: {
      fixedShares: true,
      floatingMarketValueWeights: true,
      rebalancedDaily: false,
      lotAcquisitionDatesRespected: true,
      contributionsTreatedAsExternalFlows: true,
      headlineDrawdownSource: "price-return-performance-series"
    },
    sourcePortfolioSeries: portfolioSeries,
    monteCarloImplemented: false
  };
}

export const calculatePortfolioAnalytics = analyzePortfolio;

/**
 * Builds the contribution-neutral portfolio index in acquisition-date segments.
 * A symbol is requested from Historical Data Service only while at least one of
 * its lots is active, so later holdings cannot truncate earlier performance.
 */
export async function buildAcquisitionAwarePerformanceSeries(
  portfolio,
  historicalDataService,
  options = {}
) {
  let normalized;
  try {
    normalized = assertValidPortfolio(portfolio, options);
  } catch (error) {
    return unavailablePortfolioSource("error", [warning(
      "ANALYTICS_PORTFOLIO_INVALID",
      "The portfolio is invalid and cannot be modeled.",
      { cause: serializeError(error) },
      "error"
    )]);
  }
  const holdings = normalized.holdings.filter((holding) => holding.active !== false);
  const lots = holdings.flatMap((holding) => holding.lots.map((lot, index) => ({
    ...lot,
    holdingId: holding.id,
    activationKey: `${holding.id || holding.ticker}::${lot.id || index}`
  })));
  if (lots.length === 0) {
    return unavailablePortfolioSource("missing", [warning(
      "ANALYTICS_PORTFOLIO_LOTS_MISSING",
      "No active acquisition lots are available for historical analytics."
    )], { portfolioId: normalized.id });
  }

  const inceptionDate = lots.map((lot) => lot.acquisitionDate).sort()[0];
  let requestedStart;
  let endDate;
  try {
    requestedStart = options.startDate
      ? normalizeDateOnly(options.startDate, "analytics startDate")
      : inceptionDate;
    endDate = options.endDate
      ? normalizeDateOnly(options.endDate, "analytics endDate")
      : null;
  } catch (error) {
    return unavailablePortfolioSource("unavailable", [warning(
      "ANALYTICS_PORTFOLIO_RANGE_INVALID",
      "The requested analytics date range contains an invalid calendar date.",
      { cause: serializeError(error) }
    )], { portfolioId: normalized.id, inceptionDate });
  }
  const startDate = requestedStart > inceptionDate ? requestedStart : inceptionDate;
  if (endDate && endDate < startDate) {
    return unavailablePortfolioSource("insufficient", [warning(
      "ANALYTICS_PORTFOLIO_RANGE_INVALID",
      "The requested analytics end date is before the portfolio performance start date."
    )], { portfolioId: normalized.id, inceptionDate });
  }

  const acquisitionBoundaries = Array.from(new Set(lots
    .map((lot) => lot.acquisitionDate)
    .filter((date) => date > startDate && (!endDate || date <= endDate))))
    .sort();
  const boundaries = [startDate, ...acquisitionBoundaries];
  const serviceRows = [];
  const warnings = [];
  const states = [];
  const provenance = {};
  const serviceVersions = new Set();
  let failedSegment = null;

  for (let index = 0; index < boundaries.length; index += 1) {
    const segmentStart = boundaries[index];
    const nextBoundary = boundaries[index + 1] || null;
    const segmentEnd = nextBoundary ? previousCalendarDate(nextBoundary) : endDate;
    const activeLots = lots.filter((lot) => lot.acquisitionDate <= segmentStart);
    const activeSymbols = Array.from(new Set(activeLots.map((lot) => lot.ticker)));
    if (activeSymbols.length === 0) continue;

    const query = {
      startDate: segmentStart,
      minimumCloseCount: 1,
      windowSide: "earliest"
    };
    if (segmentEnd) query.endDate = segmentEnd;
    if (options.referenceDate !== undefined) query.referenceDate = options.referenceDate;
    if (options.staleAfterCalendarDays !== undefined) {
      query.staleAfterCalendarDays = options.staleAfterCalendarDays;
    }

    let segment;
    try {
      segment = await historicalDataService.getAlignedSeries(activeSymbols, query);
    } catch (error) {
      failedSegment = warning(
        "ANALYTICS_ACQUISITION_SEGMENT_FAILED",
        `Historical Data Service failed for the acquisition segment beginning ${segmentStart}.`,
        { segmentStart, segmentEnd, activeSymbols, cause: serializeError(error) },
        "error"
      );
      break;
    }
    states.push(segment && segment.state || "missing");
    warnings.push(...mergeWarnings(segment && segment.warnings));
    if (segment && segment.provenance && typeof segment.provenance === "object") {
      Object.assign(provenance, segment.provenance);
    }
    if (segment && segment.serviceVersion) serviceVersions.add(segment.serviceVersion);
    const missingSymbols = segment && Array.isArray(segment.missingSymbols)
      ? segment.missingSymbols
      : [];
    const rows = segment && Array.isArray(segment.rows) ? segment.rows : [];
    if (rows.length === 0 && (segment && segment.state === "error")) {
      failedSegment = warning(
        "ANALYTICS_ACTIVE_SEGMENT_ERROR",
        `Historical data is unavailable for the active segment beginning ${segmentStart}.`,
        { segmentStart, segmentEnd, activeSymbols },
        "error"
      );
      break;
    }
    if (missingSymbols.length > 0) {
      failedSegment = warning(
        "ANALYTICS_ACTIVE_SYMBOL_HISTORY_MISSING",
        `Portfolio performance is unavailable after ${segmentStart} because active history is missing.`,
        { segmentStart, segmentEnd, activeSymbols, missingSymbols },
        "error"
      );
      break;
    }
    if (rows.length === 0) {
      if (nextBoundary) {
        warnings.push(warning(
          "ANALYTICS_SEGMENT_HAS_NO_SESSIONS",
          `No aligned trading session occurred between acquisition boundaries ${segmentStart} and ${segmentEnd}.`,
          { segmentStart, segmentEnd, activeSymbols }
        ));
        continue;
      }
      failedSegment = warning(
        "ANALYTICS_ACTIVE_SEGMENT_INSUFFICIENT",
        `No aligned observations are available for the active portfolio segment beginning ${segmentStart}.`,
        { segmentStart, segmentEnd, activeSymbols }
      );
      break;
    }
    for (const row of rows) {
      if (!row || typeof row !== "object" || !row.closes) {
        failedSegment = warning(
          "ANALYTICS_ACQUISITION_SEGMENT_MALFORMED",
          "Historical Data Service returned a malformed acquisition-segment row.",
          { segmentStart },
          "error"
        );
        break;
      }
      const date = normalizeDateOnly(row.date, "acquisition segment row date");
      if (serviceRows.length > 0 && date <= serviceRows.at(-1).date) {
        failedSegment = warning(
          "ANALYTICS_ACQUISITION_SEGMENTS_MISALIGNED",
          "Acquisition-aware historical segments overlap or are not strictly ascending.",
          { date },
          "error"
        );
        break;
      }
      serviceRows.push({ date, closes: { ...row.closes } });
    }
    if (failedSegment) break;
  }

  if (failedSegment || serviceRows.length === 0) {
    return unavailablePortfolioSource(
      failedSegment && failedSegment.severity === "error" ? "error" : "insufficient",
      [...warnings, failedSegment].filter(Boolean),
      { portfolioId: normalized.id, inceptionDate, provenance }
    );
  }

  let previousAccountValue = null;
  let normalizedIndex = 100;
  const activated = new Set();
  const rows = [];
  for (const serviceRow of serviceRows) {
    const date = serviceRow.date;
    const activeLots = lots.filter((lot) => compareDateOnly(lot.acquisitionDate, date) <= 0);
    const newlyActiveLots = activeLots.filter((lot) => !activated.has(lot.activationKey));
    const holdingValues = holdings.map((holding) => {
      const holdingLots = activeLots.filter((lot) => lot.holdingId === holding.id);
      const shares = sumFinite(holdingLots.map((lot) => lot.shares), `${holding.ticker} active shares`);
      const costBasis = sumFinite(holdingLots.map(calculateLotCost), `${holding.ticker} active cost basis`);
      const close = shares > 0 ? serviceRow.closes[holding.ticker] : null;
      if (shares > 0 && (!Number.isFinite(close) || close <= 0)) {
        throw new TypeError(`Historical close for active ${holding.ticker} on ${date} is invalid.`);
      }
      const marketValue = shares > 0 ? shares * close : 0;
      return {
        ticker: holding.ticker,
        holdingId: holding.id,
        shares,
        close,
        costBasis,
        marketValue,
        unrealizedGainLoss: marketValue - costBasis,
        weight: null
      };
    });
    const accountValue = sumFinite(holdingValues.map((entry) => entry.marketValue), `account value ${date}`);
    const totalCostBasis = sumFinite(holdingValues.map((entry) => entry.costBasis), `cost basis ${date}`);
    const externalFlowMarketValue = sumFinite(newlyActiveLots.map((lot) => (
      lot.shares * serviceRow.closes[lot.ticker]
    )), `external flow ${date}`);
    let periodPriceReturn = null;
    if (previousAccountValue !== null) {
      const valueBeforeExternalFlow = accountValue - externalFlowMarketValue;
      periodPriceReturn = valueBeforeExternalFlow / previousAccountValue - 1;
      if (!Number.isFinite(periodPriceReturn) || periodPriceReturn <= -1) {
        return unavailablePortfolioSource("unavailable", [...warnings, warning(
          "ANALYTICS_PORTFOLIO_RETURN_INVALID",
          `Contribution-neutral portfolio return is invalid on ${date}.`
        )], { portfolioId: normalized.id, inceptionDate, provenance });
      }
      normalizedIndex *= 1 + periodPriceReturn;
    }
    activeLots.forEach((lot) => activated.add(lot.activationKey));
    previousAccountValue = accountValue;
    const weightedHoldings = calculateMarketValueWeights(holdingValues.map((entry) => ({
      ...entry,
      positionValue: entry.marketValue
    }))).map(({ positionValue: _positionValue, ...entry }) => entry);
    rows.push({
      date,
      accountValue,
      totalCostBasis,
      unrealizedGainLoss: accountValue - totalCostBasis,
      normalizedPriceReturnIndex: normalizedIndex,
      periodPriceReturn,
      externalFlowMarketValue,
      activatedLotIds: newlyActiveLots.map((lot) => lot.id || lot.activationKey),
      activeLotCount: activeLots.length,
      holdings: weightedHoldings,
      weights: Object.fromEntries(weightedHoldings.map((entry) => [entry.ticker, entry.weight]))
    });
  }

  return {
    recordType: "portfolio-historical-series",
    engineVersion: ANALYTICS_ENGINE_VERSION,
    portfolioId: normalized.id,
    symbols: Array.from(new Set(holdings.map((holding) => holding.ticker))),
    available: true,
    state: mergeHistoricalState(states),
    states: Array.from(new Set(states)),
    rows,
    dates: rows.map((row) => row.date),
    accountValues: rows.map((row) => row.accountValue),
    normalizedPriceReturnIndex: rows.map((row) => row.normalizedPriceReturnIndex),
    dateRange: { firstDate: rows[0].date, lastDate: rows.at(-1).date },
    inceptionDate,
    counts: {
      modeledObservationCount: rows.length,
      modeledReturnCount: Math.max(0, rows.length - 1),
      lotCount: lots.length,
      acquisitionSegmentCount: boundaries.length
    },
    warnings,
    provenance,
    historicalServiceVersion: serviceVersions.size === 1 ? [...serviceVersions][0] : [...serviceVersions],
    label: "Split-adjusted, dividend-unadjusted price-return approximation",
    priceAdjustment: "split-adjusted",
    dividendAdjustment: "none",
    exactTotalReturn: false,
    dividendReinvested: false,
    fixedShares: true,
    rebalanced: false,
    contributionsTreatedAsExternalFlows: true,
    contributionValuationMethod: "new lot shares valued at the first aligned close on or after acquisition",
    methodology: "Acquisition-date segmented fixed-share buy-and-hold performance using only Historical Data Service closes for symbols active in each segment."
  };
}

function unavailablePortfolioSource(state, warnings, context = {}) {
  return {
    recordType: "portfolio-historical-series",
    engineVersion: ANALYTICS_ENGINE_VERSION,
    portfolioId: context.portfolioId || null,
    symbols: [],
    available: false,
    state,
    states: [state],
    rows: [],
    dates: [],
    accountValues: [],
    normalizedPriceReturnIndex: [],
    dateRange: { firstDate: null, lastDate: null },
    inceptionDate: context.inceptionDate || null,
    counts: { modeledObservationCount: 0, modeledReturnCount: 0 },
    warnings: mergeWarnings(warnings),
    provenance: context.provenance || {},
    historicalServiceVersion: null,
    label: "Split-adjusted, dividend-unadjusted price-return approximation",
    priceAdjustment: "split-adjusted",
    dividendAdjustment: "none",
    exactTotalReturn: false,
    dividendReinvested: false,
    fixedShares: true,
    rebalanced: false,
    contributionsTreatedAsExternalFlows: true
  };
}

function previousCalendarDate(dateOnly) {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function mergeHistoricalState(states) {
  const priority = ["error", "missing", "insufficient", "stale", "quality-warning", "current"];
  return states.slice().sort((left, right) => priority.indexOf(left) - priority.indexOf(right))[0]
    || "current";
}

function buildComparison(portfolioSeries, benchmarkSeries, alignment, options) {
  if (!portfolioSeries.available || !benchmarkSeries.available) {
    return unavailableResult("normalized-benchmark-comparison", "unavailable", mergeWarnings(
      portfolioSeries.warnings,
      benchmarkSeries.warnings
    ), options, alignment.counts);
  }
  const rows = alignment.dates.map((date, index) => ({
    date,
    portfolioValue: portfolioSeries.values[index],
    benchmarkValue: benchmarkSeries.values[index],
    portfolioReturn: portfolioSeries.values[index] / portfolioSeries.baseValue - 1,
    benchmarkReturn: benchmarkSeries.values[index] / benchmarkSeries.baseValue - 1
  }));
  return {
    ...analyticsMetadata("normalized-benchmark-comparison", {
      ...options,
      methodology: "Portfolio and configured benchmark rebased to a common base after exact trading-date intersection."
    }),
    available: true,
    state: portfolioSeries.state,
    baseValue: portfolioSeries.baseValue,
    rows,
    counts: { ...alignment.counts },
    dateRange: alignment.dateRange,
    warnings: mergeWarnings(alignment.warnings)
  };
}

async function resolveRiskFreeRate(options) {
  if (options.riskFreeRateResult !== undefined) return options.riskFreeRateResult;
  const service = options.riskFreeRateService;
  if (!service || typeof service.getCurrentRate !== "function") return null;
  try {
    return await service.getCurrentRate(options.riskFreeRateOptions || {});
  } catch (error) {
    return {
      data: null,
      source: "none",
      availability: "error",
      stale: false,
      warnings: [warning(
        "ANALYTICS_RISK_FREE_SERVICE_FAILED",
        "The approved risk-free-rate service failed; alpha is unavailable.",
        { cause: serializeError(error) },
        "error"
      )]
    };
  }
}

function portfolioServiceOptions(options) {
  const output = {};
  for (const key of [
    "startDate", "endDate", "minimumCloseCount", "closeCount", "returnCount",
    "windowSide", "referenceDate", "staleAfterCalendarDays", "inceptionDate", "activeOnly"
  ]) {
    if (options[key] !== undefined) output[key] = options[key];
  }
  return output;
}

function benchmarkServiceOptions(options, dateRange) {
  const output = {
    startDate: dateRange && dateRange.firstDate || options.startDate,
    endDate: dateRange && dateRange.lastDate || options.endDate,
    minimumCloseCount: 1,
    windowSide: "earliest"
  };
  if (options.referenceDate !== undefined) output.referenceDate = options.referenceDate;
  if (options.staleAfterCalendarDays !== undefined) output.staleAfterCalendarDays = options.staleAfterCalendarDays;
  return Object.fromEntries(Object.entries(output).filter(([, value]) => value !== undefined && value !== null));
}

function benchmarkCandles(result) {
  if (!result || result.available !== true) return [];
  if (Array.isArray(result.candles)) {
    return result.candles.map((candle) => ({ date: candle.date, close: candle.close }));
  }
  if (Array.isArray(result.dates) && Array.isArray(result.closes)
      && result.dates.length === result.closes.length) {
    return result.dates.map((date, index) => ({ date, close: result.closes[index] }));
  }
  return [];
}

function resolveConfiguredBenchmark(input, portfolio) {
  if (input === undefined || input === null || input === "") {
    return { benchmark: null, warning: null };
  }
  const records = portfolio && Array.isArray(portfolio.benchmarks)
    ? portfolio.benchmarks
    : [];
  const requestedId = input && typeof input === "object" && input.id
    ? String(input.id)
    : null;
  const requestedTicker = typeof input === "string"
    ? input.trim().toUpperCase()
    : input && input.ticker
      ? String(input.ticker).trim().toUpperCase()
      : "";
  const match = records.find((record) => (
    record
    && record.active !== false
    && ((requestedId && String(record.id) === requestedId)
      || (requestedTicker && String(record.ticker || "").toUpperCase() === requestedTicker))
  ));
  if (!match) {
    return {
      benchmark: null,
      warning: warning(
        "ANALYTICS_BENCHMARK_NOT_CONFIGURED",
        "The requested benchmark is not a configured active benchmark; alpha, beta, and comparison are unavailable.",
        { requestedId, requestedTicker: requestedTicker || null }
      )
    };
  }
  const ticker = String(match.ticker).trim().toUpperCase();
  return {
    benchmark: {
      id: match.id || null,
      ticker,
      label: String(match.label || ticker),
      active: true
    },
    warning: null
  };
}

function mergeInputState(...states) {
  const priority = ["error", "missing", "insufficient", "stale", "quality-warning", "current"];
  return states.filter(Boolean).sort((left, right) => priority.indexOf(left) - priority.indexOf(right))[0] || "current";
}

function overallState(results) {
  const available = results.filter((result) => result && result.available);
  if (available.some((result) => result.state === "stale")) return "stale";
  if (available.some((result) => result.state === "quality-warning")) return "quality-warning";
  if (results.some((result) => result && !result.available)) return "partial";
  return "available";
}

function failedEngineResult(benchmark, issue, portfolioSeries = null) {
  const benchmarkMetadata = benchmark ? { ticker: benchmark.ticker, label: benchmark.label } : null;
  const options = { benchmark: benchmarkMetadata };
  const warnings = mergeWarnings(portfolioSeries && portfolioSeries.warnings, [issue]);
  const metric = (name) => unavailableResult(name, portfolioSeries && portfolioSeries.state || "unavailable", warnings, options);
  return {
    ...analyticsMetadata("portfolio-analytics", {
      ...options,
      methodology: "Phase 6A analytics require a valid contribution-neutral Price-Return Performance Series from Historical Data Service closes."
    }),
    engineVersion: ANALYTICS_ENGINE_VERSION,
    available: false,
    coreAvailable: false,
    state: portfolioSeries && portfolioSeries.state || "unavailable",
    performanceSeries: metric("normalized-performance-series"),
    portfolioArithmeticReturns: metric("daily-arithmetic-returns"),
    portfolioLogReturns: metric("daily-log-returns"),
    cagr: metric("cagr"),
    drawdown: metric("maximum-drawdown"),
    benchmarkComparison: metric("normalized-benchmark-comparison"),
    dateAlignment: metric("exact-date-alignment"),
    benchmarkPerformanceSeries: metric("normalized-performance-series"),
    benchmarkArithmeticReturns: metric("daily-arithmetic-returns"),
    benchmarkLogReturns: metric("daily-log-returns"),
    alpha: metric("alpha"),
    beta: metric("beta"),
    alphaBeta: metric("alpha-beta"),
    benchmark: benchmarkMetadata,
    riskFreeRateSource: null,
    riskFreeRate: null,
    counts: {
      portfolioObservationCount: 0,
      portfolioReturnObservationCount: 0,
      alignedObservationCount: 0,
      alignedReturnObservationCount: 0
    },
    dateRange: { firstDate: null, lastDate: null },
    alignedDateRange: { firstDate: null, lastDate: null },
    comparisonDateRange: { firstDate: null, lastDate: null },
    warnings,
    source: {
      historical: "Historical Data Service normalized Stooq close history",
      priceAdjustment: "split-adjusted",
      dividendAdjustment: "none",
      historicalServiceVersion: portfolioSeries && portfolioSeries.historicalServiceVersion || null
    },
    portfolioMethodology: {
      fixedShares: true,
      floatingMarketValueWeights: true,
      rebalancedDaily: false,
      lotAcquisitionDatesRespected: true,
      contributionsTreatedAsExternalFlows: true,
      headlineDrawdownSource: "price-return-performance-series"
    },
    sourcePortfolioSeries: portfolioSeries,
    monteCarloImplemented: false
  };
}

function summarizeRiskFreeRate(result) {
  if (!result || typeof result !== "object") return null;
  return {
    source: result.source || null,
    availability: result.availability || null,
    stale: Boolean(result.stale),
    retrievedAt: result.retrievedAt || null,
    rateDecimal: result.data && Number.isFinite(result.data.rateDecimal)
      ? result.data.rateDecimal
      : null,
    instrument: result.data && result.data.instrument || null,
    provenance: result.provenance || null
  };
}

function deduplicateWarnings(warnings) {
  const seen = new Set();
  return warnings.filter((item) => {
    const key = `${item.code || ""}|${item.message || ""}|${item.symbol || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function serializeError(error) {
  return {
    name: error && error.name || "Error",
    code: error && error.code || null,
    message: error && error.message || String(error)
  };
}
