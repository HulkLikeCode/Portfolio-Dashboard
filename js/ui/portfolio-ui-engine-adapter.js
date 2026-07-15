import {
  addHolding,
  addLotToHolding,
  deleteHolding,
  deleteLot,
  editHolding,
  editLot
} from '../portfolio/portfolio-model.js';
import {
  calculateHoldingCostBasis,
  calculateHoldingShares,
  calculateLotCost,
  calculatePortfolioCostBasis
} from '../portfolio/portfolio-engine.js';
import { assertValidPortfolio } from '../portfolio/portfolio-validation.js';

export function addHoldingCandidate(portfolio, input, options = {}) {
  return validateCandidate(addHolding(portfolio, {
    ticker: input.ticker,
    active: input.active !== false,
    lots: [{
      shares: input.shares,
      purchasePricePerShare: input.purchasePricePerShare,
      acquisitionDate: input.acquisitionDate,
      auditNote: input.auditNote || ''
    }]
  }, options), options);
}

export function editHoldingCandidate(portfolio, holdingId, changes, options = {}) {
  return validateCandidate(editHolding(portfolio, holdingId, changes, options), options);
}

export function deleteHoldingCandidate(portfolio, holdingId, options = {}) {
  return validateCandidate(deleteHolding(portfolio, holdingId, options), options);
}

export function addLotCandidate(portfolio, holdingId, input, options = {}) {
  return validateCandidate(addLotToHolding(portfolio, holdingId, input, options), options);
}

export function editLotCandidate(portfolio, holdingId, lotId, changes, options = {}) {
  return validateCandidate(editLot(portfolio, holdingId, lotId, changes, options), options);
}

export function deleteLotCandidate(portfolio, holdingId, lotId, options = {}) {
  return validateCandidate(deleteLot(portfolio, holdingId, lotId, options), options);
}

export function summarizePortfolio(portfolio, options = {}) {
  const normalized = assertValidPortfolio(portfolio, options);
  return {
    holdingCount: normalized.holdings.length,
    lotCount: normalized.holdings.reduce((total, holding) => total + holding.lots.length, 0),
    costBasis: calculatePortfolioCostBasis(normalized, options),
    holdings: normalized.holdings.map((holding) => ({
      holdingId: holding.id,
      shares: calculateHoldingShares(holding),
      costBasis: calculateHoldingCostBasis(holding),
      lots: holding.lots.map((lot) => ({ lotId: lot.id, cost: calculateLotCost(lot) }))
    }))
  };
}

function validateCandidate(candidate, options) {
  return assertValidPortfolio(candidate, options);
}
