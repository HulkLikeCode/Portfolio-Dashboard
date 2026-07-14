import { assertValidPortfolio } from '../portfolio/portfolio-validation.js';

export const PORTFOLIO_STALE_REASON = 'portfolio-edited';

export function settingsStateToPortfolio(state, options = {}) {
  const source = state && typeof state === 'object' ? state : {};
  const lots = Array.isArray(source.lots) ? source.lots : [];
  const holdings = (Array.isArray(source.holdings) ? source.holdings : []).map((holding) => {
    const holdingLots = lots
      .filter((lot) => lot.holdingId === holding.id || (holding.lotIds || []).includes(lot.id))
      .map((lot) => ({
        id: lot.id,
        recordType: 'lot',
        ticker: holding.ticker,
        shares: lot.shares,
        purchasePricePerShare: lot.purchasePricePerShare ?? lot.purchasePrice,
        acquisitionDate: lot.acquisitionDate,
        auditNote: lot.auditNote || ''
      }));

    return {
      id: holding.id,
      recordType: 'holding',
      ticker: holding.ticker,
      active: holding.active !== false,
      lots: holdingLots
    };
  });

  return assertValidPortfolio({
    id: source.portfolioId || 'portfolio-primary',
    recordType: 'portfolio',
    name: source.portfolioName || 'Portfolio',
    holdings,
    benchmarks: Array.isArray(source.benchmarks) ? source.benchmarks : []
  }, options);
}

export function portfolioToSettingsPatch(portfolio, previousState = {}, options = {}) {
  const normalized = assertValidPortfolio(portfolio, options);
  const previousHoldings = new Map(
    (previousState.holdings || []).map((holding) => [holding.id, holding])
  );
  const editedAt = options.editedAt || new Date().toISOString();
  const revision = Number(previousState.portfolioRevision || 0) + 1;

  const holdings = normalized.holdings.map((holding) => ({
    id: holding.id,
    ticker: holding.ticker,
    label: previousHoldings.get(holding.id)?.label || holding.ticker,
    active: holding.active !== false,
    type: 'holding',
    lotIds: holding.lots.map((lot) => lot.id)
  }));

  const lots = normalized.holdings.flatMap((holding) => holding.lots.map((lot) => ({
    id: lot.id,
    holdingId: holding.id,
    ticker: holding.ticker,
    shares: lot.shares,
    acquisitionDate: lot.acquisitionDate,
    purchasePrice: lot.purchasePricePerShare,
    auditNote: lot.auditNote || ''
  })));

  return {
    portfolioId: normalized.id,
    portfolioName: normalized.name,
    holdings,
    lots,
    portfolioRevision: revision,
    dependentDataState: {
      ...(previousState.dependentDataState || {}),
      charts: 'stale',
      analytics: 'stale',
      simulations: 'stale',
      staleReason: PORTFOLIO_STALE_REASON,
      portfolioRevision: revision,
      invalidatedAt: editedAt
    }
  };
}

export function applyPortfolioPatch(state, portfolio, options = {}) {
  return {
    ...state,
    ...portfolioToSettingsPatch(portfolio, state, options)
  };
}
