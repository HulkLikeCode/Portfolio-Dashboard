import { createLot, normalizeTicker, updateLot } from "./lot-model.js";
import { assertValidPortfolio } from "./portfolio-validation.js";

export const PORTFOLIO_MODEL_VERSION = "2.2-phase-3a";

export class PortfolioModelError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PortfolioModelError";
    this.code = code;
    this.details = details && typeof details === "object" ? { ...details } : {};
  }
}

export function createHolding(input, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new PortfolioModelError("HOLDING_OBJECT_REQUIRED", "Holding input must be an object.");
  }
  const ticker = normalizeTicker(input.ticker);
  const lotsInput = Array.isArray(input.lots) ? input.lots : [];
  if (lotsInput.length === 0) {
    throw new PortfolioModelError("HOLDING_LOTS_REQUIRED", "A holding must contain at least one lot.");
  }
  const lots = lotsInput.map((lot) => createLot({ ...lot, ticker }, options));
  return Object.freeze({
    id: normalizeId(input.id, "holding", options.idFactory),
    recordType: "holding",
    ticker,
    active: input.active !== false,
    lots: Object.freeze(lots),
    modelVersion: PORTFOLIO_MODEL_VERSION
  });
}

export function createPortfolio(input = {}, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new PortfolioModelError("PORTFOLIO_OBJECT_REQUIRED", "Portfolio input must be an object.");
  }
  const holdings = Array.isArray(input.holdings)
    ? input.holdings.map((holding) => createHolding(holding, options))
    : [];
  const portfolio = {
    id: normalizeId(input.id, "portfolio", options.idFactory),
    recordType: "portfolio",
    name: normalizeName(input.name),
    holdings: Object.freeze(holdings),
    benchmarks: Object.freeze(Array.isArray(input.benchmarks)
      ? input.benchmarks.map(clonePlain)
      : []),
    modelVersion: PORTFOLIO_MODEL_VERSION
  };
  const normalized = assertValidPortfolio(portfolio, options);
  return freezePortfolio(normalized);
}

/**
 * Adds a new holding. To add shares to an existing ticker, call addLotToHolding;
 * duplicate holding records are rejected by validation.
 */
export function addHolding(portfolio, holdingInput, options = {}) {
  const current = assertValidPortfolio(portfolio, options);
  const holding = createHolding(holdingInput, options);
  if (current.holdings.some((entry) => entry.ticker === holding.ticker)) {
    throw new PortfolioModelError(
      "HOLDING_ALREADY_EXISTS",
      `${holding.ticker} already exists. Add a new lot instead.`,
      { ticker: holding.ticker }
    );
  }
  return createPortfolio({ ...current, holdings: [...current.holdings, holding] }, options);
}

export function editHolding(portfolio, holdingId, changes, options = {}) {
  const current = assertValidPortfolio(portfolio, options);
  const index = findHoldingIndex(current, holdingId);
  const existing = current.holdings[index];
  const ticker = changes && changes.ticker !== undefined
    ? normalizeTicker(changes.ticker)
    : existing.ticker;
  if (ticker !== existing.ticker && current.holdings.some(
    (holding, holdingIndex) => holdingIndex !== index && holding.ticker === ticker
  )) {
    throw new PortfolioModelError(
      "HOLDING_ALREADY_EXISTS",
      `${ticker} already exists as another holding.`,
      { ticker }
    );
  }
  const nextHolding = createHolding({
    ...existing,
    ...changes,
    id: existing.id,
    ticker,
    lots: existing.lots.map((lot) => ({ ...lot, ticker }))
  }, options);
  const holdings = current.holdings.slice();
  holdings[index] = nextHolding;
  return createPortfolio({ ...current, holdings }, options);
}

export function deleteHolding(portfolio, holdingId, options = {}) {
  const current = assertValidPortfolio(portfolio, options);
  const index = findHoldingIndex(current, holdingId);
  const holdings = current.holdings.slice();
  holdings.splice(index, 1);
  return createPortfolio({ ...current, holdings }, options);
}

/**
 * Always creates a distinct lot record. It never merges into or mutates an
 * existing lot, satisfying the add-to-position rule.
 */
export function addLotToHolding(portfolio, holdingId, lotInput, options = {}) {
  const current = assertValidPortfolio(portfolio, options);
  const index = findHoldingIndex(current, holdingId);
  const holding = current.holdings[index];
  const lot = createLot({ ...lotInput, ticker: holding.ticker }, options);
  const holdings = current.holdings.slice();
  holdings[index] = createHolding({
    ...holding,
    lots: [...holding.lots, lot]
  }, options);
  return createPortfolio({ ...current, holdings }, options);
}

/** Explicitly edits one existing lot by id. */
export function editLot(portfolio, holdingId, lotId, changes, options = {}) {
  const current = assertValidPortfolio(portfolio, options);
  const holdingIndex = findHoldingIndex(current, holdingId);
  const holding = current.holdings[holdingIndex];
  const lotIndex = findLotIndex(holding, lotId);
  const lots = holding.lots.slice();
  lots[lotIndex] = updateLot(lots[lotIndex], {
    ...changes,
    ticker: holding.ticker
  }, options);
  const holdings = current.holdings.slice();
  holdings[holdingIndex] = createHolding({ ...holding, lots }, options);
  return createPortfolio({ ...current, holdings }, options);
}

export function deleteLot(portfolio, holdingId, lotId, options = {}) {
  const current = assertValidPortfolio(portfolio, options);
  const holdingIndex = findHoldingIndex(current, holdingId);
  const holding = current.holdings[holdingIndex];
  const lotIndex = findLotIndex(holding, lotId);
  if (holding.lots.length === 1) {
    throw new PortfolioModelError(
      "HOLDING_LAST_LOT_DELETE_BLOCKED",
      "Delete the holding instead of deleting its only lot.",
      { holdingId, lotId }
    );
  }
  const lots = holding.lots.slice();
  lots.splice(lotIndex, 1);
  const holdings = current.holdings.slice();
  holdings[holdingIndex] = createHolding({ ...holding, lots }, options);
  return createPortfolio({ ...current, holdings }, options);
}

export function clonePortfolio(portfolio, options = {}) {
  return createPortfolio(clonePlain(portfolio), options);
}

function findHoldingIndex(portfolio, holdingId) {
  const index = portfolio.holdings.findIndex((holding) => holding.id === holdingId);
  if (index < 0) {
    throw new PortfolioModelError("HOLDING_NOT_FOUND", "Holding was not found.", { holdingId });
  }
  return index;
}

function findLotIndex(holding, lotId) {
  const index = holding.lots.findIndex((lot) => lot.id === lotId);
  if (index < 0) {
    throw new PortfolioModelError("LOT_NOT_FOUND", "Lot was not found.", { lotId });
  }
  return index;
}

function normalizeName(value) {
  if (value === undefined || value === null) return "Portfolio";
  if (typeof value !== "string") {
    throw new PortfolioModelError("PORTFOLIO_NAME_INVALID", "Portfolio name must be a string.");
  }
  return value.trim() || "Portfolio";
}

function normalizeId(value, prefix, idFactory) {
  if (value !== undefined && value !== null) {
    if (typeof value !== "string" || !value.trim()) {
      throw new PortfolioModelError("MODEL_ID_INVALID", "Id must be a nonempty string.");
    }
    return value.trim();
  }
  const factory = typeof idFactory === "function" ? idFactory : createDefaultId;
  const id = factory(prefix);
  if (typeof id !== "string" || !id.trim()) {
    throw new PortfolioModelError("MODEL_ID_FACTORY_INVALID", "idFactory must return a nonempty string.");
  }
  return id.trim();
}

function createDefaultId(prefix) {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

function freezePortfolio(portfolio) {
  const holdings = portfolio.holdings.map((holding) => Object.freeze({
    ...holding,
    lots: Object.freeze(holding.lots.map((lot) => Object.freeze({ ...lot })))
  }));
  return Object.freeze({
    ...portfolio,
    holdings: Object.freeze(holdings),
    benchmarks: Object.freeze((portfolio.benchmarks || []).map((entry) => Object.freeze(clonePlain(entry))))
  });
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
