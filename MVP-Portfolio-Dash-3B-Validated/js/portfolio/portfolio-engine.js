import { compareDateOnly, minDateOnly, normalizeDateOnly } from "../utils/date-utils.js";
import {
  assertFiniteNumber,
  assertPositiveFiniteNumber,
  sumFinite
} from "../utils/number-utils.js";
import { assertValidPortfolio } from "./portfolio-validation.js";

export const PORTFOLIO_ENGINE_VERSION = "2.2-phase-3a";

export const PORTFOLIO_SERIES_LABELS = Object.freeze({
  ACCOUNT_VALUE: "Modeled account value from fixed shares and split-adjusted price history",
  HISTORICAL_PRICE_RETURN: "Split-adjusted, dividend-unadjusted price-return approximation"
});

export const PORTFOLIO_STATES = Object.freeze({
  CURRENT: "current",
  STALE: "stale",
  PARTIAL: "partial",
  MISSING: "missing",
  INSUFFICIENT: "insufficient",
  QUALITY_WARNING: "quality-warning",
  ERROR: "error"
});

export class PortfolioEngineError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PortfolioEngineError";
    this.code = code;
    this.details = details && typeof details === "object" ? { ...details } : {};
  }
}

/** Returns shares multiplied by purchase price without rounding. */
export function calculateLotCost(lot) {
  if (!lot || typeof lot !== "object") {
    throw new PortfolioEngineError("LOT_REQUIRED", "Lot is required.");
  }
  const shares = assertPositiveFiniteNumber(lot.shares, "lot.shares");
  const price = assertPositiveFiniteNumber(
    lot.purchasePricePerShare !== undefined ? lot.purchasePricePerShare : lot.purchasePrice,
    "lot.purchasePricePerShare"
  );
  const result = shares * price;
  if (!Number.isFinite(result)) {
    throw new PortfolioEngineError("LOT_COST_NONFINITE", "Lot cost is nonfinite.");
  }
  return result;
}

export function calculateHoldingShares(holding, options = {}) {
  return sumFinite(selectLots(holding, options).map((lot) => lot.shares), "holding shares");
}

export function calculateHoldingCostBasis(holding, options = {}) {
  return sumFinite(selectLots(holding, options).map(calculateLotCost), "holding cost basis");
}

export function calculatePortfolioCostBasis(portfolio, options = {}) {
  const normalized = assertValidPortfolio(portfolio, options);
  return sumFinite(
    selectHoldings(normalized, options).map((holding) => calculateHoldingCostBasis(holding, options)),
    "portfolio cost basis"
  );
}

export function calculatePositionValue(shares, currentPrice) {
  const normalizedShares = assertPositiveFiniteNumber(shares, "shares");
  const normalizedPrice = assertPositiveFiniteNumber(currentPrice, "currentPrice");
  const result = normalizedShares * normalizedPrice;
  if (!Number.isFinite(result)) {
    throw new PortfolioEngineError("POSITION_VALUE_NONFINITE", "Position value is nonfinite.");
  }
  return result;
}

export function calculateUnrealizedGainLoss(positionValue, costBasis) {
  return assertFiniteNumber(positionValue, "positionValue")
    - assertFiniteNumber(costBasis, "costBasis");
}

export function calculateMarketValueWeights(positions) {
  if (!Array.isArray(positions)) {
    throw new PortfolioEngineError("POSITIONS_REQUIRED", "positions must be an array.");
  }
  const available = positions.filter((position) => (
    position && Number.isFinite(position.positionValue) && position.positionValue >= 0
  ));
  const total = sumFinite(available.map((position) => position.positionValue), "position values");
  return positions.map((position) => ({
    ...position,
    weight: Number.isFinite(position && position.positionValue) && total > 0
      ? position.positionValue / total
      : null
  }));
}

export function calculatePortfolioInceptionDate(portfolio, options = {}) {
  if (options.inceptionDate !== undefined && options.inceptionDate !== null && options.inceptionDate !== "") {
    return normalizeDateOnly(options.inceptionDate, "inceptionDate");
  }
  const normalized = assertValidPortfolio(portfolio, options);
  const dates = selectHoldings(normalized, options)
    .flatMap((holding) => holding.lots.map((lot) => lot.acquisitionDate));
  return minDateOnly(dates);
}

/**
 * Calculates current valuation from Finnhub quote snapshots. Quote map entries
 * may be a raw number, raw Finnhub {c, t}, or the Phase 2F normalized result
 * {data, source, availability, stale, cache, provenance, warnings, error}.
 */
export function calculatePortfolioSnapshot(portfolio, quoteSnapshots = {}, options = {}) {
  const normalized = assertValidPortfolio(portfolio, options);
  if (!quoteSnapshots || typeof quoteSnapshots !== "object" || Array.isArray(quoteSnapshots)) {
    throw new PortfolioEngineError("QUOTE_MAP_INVALID", "quoteSnapshots must be an object keyed by ticker.");
  }

  const holdings = selectHoldings(normalized, options);
  const positions = holdings.map((holding) => {
    const shares = calculateHoldingShares(holding);
    const costBasis = calculateHoldingCostBasis(holding);
    const quote = normalizeQuoteSnapshot(quoteSnapshots[holding.ticker], holding.ticker);
    const positionValue = quote.available ? calculatePositionValue(shares, quote.price) : null;
    return {
      recordType: "position-valuation",
      holdingId: holding.id,
      ticker: holding.ticker,
      shares,
      lotCount: holding.lots.length,
      costBasis,
      currentPrice: quote.price,
      positionValue,
      unrealizedGainLoss: positionValue === null
        ? null
        : calculateUnrealizedGainLoss(positionValue, costBasis),
      weight: null,
      quoteState: quote.state,
      quoteAvailable: quote.available,
      quoteStale: quote.stale,
      quoteSource: quote.source,
      quoteTimestamp: quote.timestamp,
      quoteAvailability: quote.availability,
      quoteWarnings: quote.warnings,
      quoteError: quote.error,
      provenance: quote.provenance
    };
  });

  const weighted = calculateMarketValueWeights(positions);
  const availablePositions = weighted.filter((position) => position.positionValue !== null);
  const missingPriceSymbols = weighted.filter((position) => !position.quoteAvailable).map((position) => position.ticker);
  const stalePriceSymbols = weighted.filter((position) => position.quoteAvailable && position.quoteStale)
    .map((position) => position.ticker);
  const portfolioValue = sumFinite(
    availablePositions.map((position) => position.positionValue),
    "available portfolio value"
  );
  const complete = missingPriceSymbols.length === 0;
  const totalCostBasis = sumFinite(weighted.map((position) => position.costBasis), "portfolio cost basis");
  const availableCostBasis = sumFinite(
    availablePositions.map((position) => position.costBasis),
    "available cost basis"
  );
  const partialUnrealizedGainLoss = portfolioValue - availableCostBasis;

  return {
    recordType: "portfolio-snapshot",
    engineVersion: PORTFOLIO_ENGINE_VERSION,
    portfolioId: normalized.id,
    asOf: options.asOf || null,
    positions: weighted,
    totalCostBasis,
    portfolioValue,
    portfolioValueComplete: complete,
    valueIsPartial: !complete,
    unrealizedGainLoss: complete ? portfolioValue - totalCostBasis : null,
    partialUnrealizedGainLoss,
    missingPriceSymbols,
    stalePriceSymbols,
    hasStaleQuotes: stalePriceSymbols.length > 0,
    complete,
    state: !complete
      ? PORTFOLIO_STATES.PARTIAL
      : stalePriceSymbols.length > 0
        ? PORTFOLIO_STATES.STALE
        : PORTFOLIO_STATES.CURRENT,
    weightBasis: complete ? "complete-portfolio-market-value" : "available-market-value-only",
    quoteSemantics: "Finnhub current quote snapshots; not historical candles",
    corporateActionsApplied: false
  };
}

/**
 * Creates a fixed-share modeled account-value series and a contribution-neutral
 * chained price-return index using HistoricalDataService.getAlignedSeries().
 */
export async function buildHistoricalPerformanceSeries(
  portfolio,
  historicalDataService,
  options = {}
) {
  const normalized = assertValidPortfolio(portfolio, options);
  if (!historicalDataService || typeof historicalDataService.getAlignedSeries !== "function") {
    throw new PortfolioEngineError(
      "HISTORICAL_SERVICE_REQUIRED",
      "HistoricalDataService.getAlignedSeries() is required."
    );
  }

  const holdings = selectHoldings(normalized, options);
  const symbols = holdings.map((holding) => holding.ticker);
  const inceptionDate = calculatePortfolioInceptionDate(normalized, options);
  if (symbols.length === 0 || !inceptionDate) {
    return emptyHistoricalResult({
      normalized,
      symbols,
      inceptionDate,
      state: PORTFOLIO_STATES.MISSING,
      states: [PORTFOLIO_STATES.MISSING],
      warnings: [{
        code: "PORTFOLIO_HISTORY_NO_ACTIVE_HOLDINGS",
        severity: "warning",
        message: "No active holdings are available for historical modeling."
      }]
    });
  }

  const serviceOptions = buildHistoricalServiceOptions(options, inceptionDate);
  let aligned;
  try {
    aligned = await historicalDataService.getAlignedSeries(symbols, serviceOptions);
  } catch (error) {
    throw new PortfolioEngineError(
      "HISTORICAL_SERVICE_FAILED",
      "Historical Data Service failed while building the portfolio series.",
      { cause: serializeSafeError(error) }
    );
  }

  const propagated = normalizeHistoricalServiceResult(aligned, symbols);
  if (!propagated.available || propagated.rows.length === 0) {
    return emptyHistoricalResult({
      normalized,
      symbols,
      inceptionDate,
      state: propagated.state,
      states: propagated.states,
      warnings: propagated.warnings,
      serviceResult: propagated
    });
  }

  const lots = holdings.flatMap((holding) => holding.lots.map((lot, lotIndex) => ({
    ...lot,
    holdingId: holding.id,
    activationKey: `${holding.id || holding.ticker}::${lot.id || lotIndex}`
  })));
  let previousAccountValue = null;
  let normalizedIndex = 100;
  const previouslyActivatedLotKeys = new Set();

  const rows = propagated.rows.map((serviceRow, rowIndex) => {
    const date = normalizeDateOnly(serviceRow.date, `historical row ${rowIndex} date`);
    const closes = normalizeCloseMap(serviceRow.closes, symbols, date);
    const activeLots = lots.filter((lot) => compareDateOnly(lot.acquisitionDate, date) <= 0);
    const newlyActiveLots = activeLots.filter(
      (lot) => !previouslyActivatedLotKeys.has(lot.activationKey)
    );
    const holdingValues = holdings.map((holding) => {
      const activeHoldingLots = activeLots.filter((lot) => lot.holdingId === holding.id);
      const shares = sumFinite(activeHoldingLots.map((lot) => lot.shares), `${holding.ticker} active shares`);
      const costBasis = sumFinite(activeHoldingLots.map(calculateLotCost), `${holding.ticker} active cost basis`);
      const marketValue = shares > 0 ? shares * closes[holding.ticker] : 0;
      return {
        ticker: holding.ticker,
        holdingId: holding.id,
        shares,
        close: closes[holding.ticker],
        costBasis,
        marketValue,
        unrealizedGainLoss: marketValue - costBasis,
        weight: null
      };
    });
    const accountValue = sumFinite(holdingValues.map((entry) => entry.marketValue), `account value ${date}`);
    const totalCostBasis = sumFinite(holdingValues.map((entry) => entry.costBasis), `cost basis ${date}`);
    const contributionMarketValue = sumFinite(newlyActiveLots.map(
      (lot) => lot.shares * closes[lot.ticker]
    ), `contribution market value ${date}`);

    let periodReturn = null;
    if (previousAccountValue !== null && previousAccountValue > 0) {
      const valueBeforeExternalFlow = accountValue - contributionMarketValue;
      periodReturn = valueBeforeExternalFlow / previousAccountValue - 1;
      if (!Number.isFinite(periodReturn)) {
        throw new PortfolioEngineError(
          "HISTORICAL_RETURN_NONFINITE",
          `Historical return is nonfinite on ${date}.`
        );
      }
      normalizedIndex *= 1 + periodReturn;
    }

    activeLots.forEach((lot) => previouslyActivatedLotKeys.add(lot.activationKey));
    previousAccountValue = accountValue;
    const weightedHoldings = calculateMarketValueWeights(
      holdingValues.map((entry) => ({ ...entry, positionValue: entry.marketValue }))
    ).map(({ positionValue: _positionValue, ...entry }) => entry);

    return {
      date,
      accountValue,
      totalCostBasis,
      unrealizedGainLoss: accountValue - totalCostBasis,
      normalizedPriceReturnIndex: normalizedIndex,
      periodPriceReturn: periodReturn,
      externalFlowMarketValue: contributionMarketValue,
      activatedLotIds: newlyActiveLots.map((lot) => lot.id || lot.activationKey),
      activatedLots: newlyActiveLots.map((lot) => ({
        holdingId: lot.holdingId,
        lotId: lot.id || null,
        activationKey: lot.activationKey
      })),
      activeLotCount: activeLots.length,
      holdings: weightedHoldings,
      weights: Object.fromEntries(weightedHoldings.map((entry) => [entry.ticker, entry.weight]))
    };
  });

  return {
    recordType: "portfolio-historical-series",
    engineVersion: PORTFOLIO_ENGINE_VERSION,
    portfolioId: normalized.id,
    symbols,
    available: rows.length > 0,
    state: propagated.state,
    states: propagated.states,
    rows,
    dates: rows.map((row) => row.date),
    accountValues: rows.map((row) => row.accountValue),
    normalizedPriceReturnIndex: rows.map((row) => row.normalizedPriceReturnIndex),
    dateRange: rows.length > 0
      ? { firstDate: rows[0].date, lastDate: rows[rows.length - 1].date }
      : { firstDate: null, lastDate: null },
    inceptionDate,
    counts: {
      ...propagated.counts,
      modeledObservationCount: rows.length,
      modeledReturnCount: Math.max(0, rows.length - 1),
      lotCount: lots.length
    },
    warnings: propagated.warnings,
    provenance: propagated.provenance,
    historicalServiceVersion: propagated.serviceVersion,
    accountValueLabel: PORTFOLIO_SERIES_LABELS.ACCOUNT_VALUE,
    label: PORTFOLIO_SERIES_LABELS.HISTORICAL_PRICE_RETURN,
    priceAdjustment: "split-adjusted",
    dividendAdjustment: "none",
    exactTotalReturn: false,
    dividendReinvested: false,
    brokerageReconciled: false,
    taxAdjusted: false,
    fixedShares: true,
    rebalanced: false,
    contributionsTreatedAsExternalFlows: true,
    contributionValuationMethod: "new lot shares valued at the first aligned close on or after acquisition",
    corporateActionsApplied: false,
    methodology: "Fixed-share buy-and-hold modeled account value using exact-date aligned Historical Data Service closes."
  };
}

export const buildHistoricalAccountValueSeries = buildHistoricalPerformanceSeries;

export class PortfolioEngine {
  constructor(options = {}) {
    this.historicalDataService = options.historicalDataService || null;
  }

  calculateSnapshot(portfolio, quoteSnapshots, options = {}) {
    return calculatePortfolioSnapshot(portfolio, quoteSnapshots, options);
  }

  async getHistoricalPerformanceSeries(portfolio, options = {}) {
    return buildHistoricalPerformanceSeries(portfolio, this.historicalDataService, options);
  }

  async getHistoricalAccountValueSeries(portfolio, options = {}) {
    return this.getHistoricalPerformanceSeries(portfolio, options);
  }
}

export function createPortfolioEngine(options = {}) {
  return new PortfolioEngine(options);
}

export function normalizeQuoteSnapshot(input, ticker = null) {
  const base = {
    ticker,
    available: false,
    price: null,
    stale: false,
    state: PORTFOLIO_STATES.MISSING,
    source: "none",
    availability: "missing",
    timestamp: null,
    warnings: [],
    error: null,
    provenance: null
  };
  if (input === undefined || input === null) return base;
  if (typeof input === "number") {
    if (!Number.isFinite(input) || input <= 0) return base;
    return { ...base, available: true, price: input, state: PORTFOLIO_STATES.CURRENT, source: "direct", availability: "available" };
  }
  if (typeof input !== "object" || Array.isArray(input)) return base;

  const wrapper = input;
  const data = wrapper.data && typeof wrapper.data === "object" ? wrapper.data : wrapper;
  const priceCandidates = [data.c, data.currentPrice, data.price, data.lastPrice, data.close];
  const price = priceCandidates.find((value) => Number.isFinite(value) && value > 0) || null;
  const source = typeof wrapper.source === "string"
    ? wrapper.source
    : typeof data.source === "string"
      ? data.source
      : "unknown";
  const availability = typeof wrapper.availability === "string"
    ? wrapper.availability
    : price ? "available" : "missing";
  const stale = wrapper.stale === true
    || data.stale === true
    || availability === "stale"
    || Boolean(wrapper.cache && wrapper.cache.stale === true);
  const timestampValue = firstDefined(
    wrapper.retrievedAt,
    wrapper.timestamp,
    data.retrievedAt,
    data.timestamp,
    data.t
  );
  return {
    ...base,
    available: price !== null,
    price,
    stale: price !== null && stale,
    state: price === null
      ? PORTFOLIO_STATES.MISSING
      : stale
        ? PORTFOLIO_STATES.STALE
        : PORTFOLIO_STATES.CURRENT,
    source,
    availability,
    timestamp: normalizeQuoteTimestamp(timestampValue),
    warnings: Array.isArray(wrapper.warnings) ? wrapper.warnings.map(clonePlain) : [],
    error: wrapper.error ? clonePlain(wrapper.error) : null,
    provenance: wrapper.provenance ? clonePlain(wrapper.provenance) : null
  };
}

function selectHoldings(portfolio, options) {
  const activeOnly = options.activeOnly !== false;
  return activeOnly ? portfolio.holdings.filter((holding) => holding.active !== false) : portfolio.holdings.slice();
}

function selectLots(holding, options) {
  if (!holding || !Array.isArray(holding.lots)) {
    throw new PortfolioEngineError("HOLDING_INVALID", "Holding must contain a lots array.");
  }
  if (!options.asOfDate) return holding.lots.slice();
  const asOfDate = normalizeDateOnly(options.asOfDate, "asOfDate");
  return holding.lots.filter((lot) => compareDateOnly(lot.acquisitionDate, asOfDate) <= 0);
}

function buildHistoricalServiceOptions(options, inceptionDate) {
  const result = {
    startDate: options.startDate
      ? normalizeDateOnly(options.startDate, "startDate")
      : inceptionDate,
    minimumCloseCount: options.minimumCloseCount === undefined ? 1 : options.minimumCloseCount,
    windowSide: options.windowSide || "earliest"
  };
  if (options.endDate) result.endDate = normalizeDateOnly(options.endDate, "endDate");
  if (options.closeCount !== undefined) result.closeCount = options.closeCount;
  if (options.returnCount !== undefined) result.returnCount = options.returnCount;
  if (options.referenceDate !== undefined) result.referenceDate = options.referenceDate;
  if (options.staleAfterCalendarDays !== undefined) {
    result.staleAfterCalendarDays = options.staleAfterCalendarDays;
  }
  return result;
}

function normalizeHistoricalServiceResult(result, symbols) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new PortfolioEngineError(
      "HISTORICAL_RESULT_MALFORMED",
      "Historical Data Service returned a malformed result."
    );
  }
  if (!Array.isArray(result.rows)) {
    throw new PortfolioEngineError(
      "HISTORICAL_ROWS_MALFORMED",
      "Historical Data Service result must include rows."
    );
  }
  const missingSymbols = Array.isArray(result.missingSymbols) ? result.missingSymbols : [];
  const available = result.available === true && missingSymbols.length === 0 && result.rows.length > 0;
  return {
    available,
    state: typeof result.state === "string"
      ? result.state
      : available ? PORTFOLIO_STATES.CURRENT : PORTFOLIO_STATES.MISSING,
    states: Array.isArray(result.states)
      ? result.states.slice()
      : [available ? PORTFOLIO_STATES.CURRENT : PORTFOLIO_STATES.MISSING],
    rows: result.rows.map((row) => clonePlain(row)),
    dateRange: result.dateRange ? clonePlain(result.dateRange) : null,
    counts: result.counts ? clonePlain(result.counts) : {},
    provenance: result.provenance ? clonePlain(result.provenance) : {},
    warnings: Array.isArray(result.warnings) ? result.warnings.map(clonePlain) : [],
    serviceVersion: result.serviceVersion || null,
    missingSymbols,
    symbols: Array.isArray(result.symbols) ? result.symbols.slice() : symbols.slice()
  };
}

function normalizeCloseMap(value, symbols, date) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PortfolioEngineError(
      "HISTORICAL_CLOSES_MALFORMED",
      `Historical closes are malformed on ${date}.`
    );
  }
  return Object.fromEntries(symbols.map((symbol) => {
    const close = value[symbol];
    if (!Number.isFinite(close) || close <= 0) {
      throw new PortfolioEngineError(
        "HISTORICAL_CLOSE_INVALID",
        `Historical close for ${symbol} on ${date} must be a positive finite number.`,
        { symbol, date, close }
      );
    }
    return [symbol, close];
  }));
}

function emptyHistoricalResult(context) {
  const serviceResult = context.serviceResult || {};
  return {
    recordType: "portfolio-historical-series",
    engineVersion: PORTFOLIO_ENGINE_VERSION,
    portfolioId: context.normalized.id,
    symbols: context.symbols,
    available: false,
    state: context.state,
    states: context.states,
    rows: [],
    dates: [],
    accountValues: [],
    normalizedPriceReturnIndex: [],
    dateRange: { firstDate: null, lastDate: null },
    inceptionDate: context.inceptionDate,
    counts: serviceResult.counts || { modeledObservationCount: 0, modeledReturnCount: 0 },
    warnings: context.warnings || [],
    provenance: serviceResult.provenance || {},
    historicalServiceVersion: serviceResult.serviceVersion || null,
    accountValueLabel: PORTFOLIO_SERIES_LABELS.ACCOUNT_VALUE,
    label: PORTFOLIO_SERIES_LABELS.HISTORICAL_PRICE_RETURN,
    priceAdjustment: "split-adjusted",
    dividendAdjustment: "none",
    exactTotalReturn: false,
    dividendReinvested: false,
    brokerageReconciled: false,
    taxAdjusted: false,
    fixedShares: true,
    rebalanced: false,
    contributionsTreatedAsExternalFlows: true,
    corporateActionsApplied: false
  };
}

function normalizeQuoteTimestamp(value) {
  if (value === undefined || value === null) return null;
  if (Number.isFinite(value)) {
    const milliseconds = value < 1e12 ? value * 1000 : value;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value.trim() : date.toISOString();
  }
  return null;
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function serializeSafeError(error) {
  return {
    name: error && error.name ? error.name : "Error",
    code: error && error.code ? error.code : null,
    message: error && error.message ? error.message : String(error)
  };
}

function clonePlain(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(clonePlain);
  if (typeof value === "object") {
    const output = {};
    Object.entries(value).forEach(([key, nested]) => {
      output[key] = clonePlain(nested);
    });
    return output;
  }
  return value;
}
