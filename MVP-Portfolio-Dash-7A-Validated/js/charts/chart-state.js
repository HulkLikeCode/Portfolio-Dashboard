export const CHART_TYPES = Object.freeze({
  COMPARISON: 'comparison',
  ACCOUNT_VALUE: 'account-value',
  ALLOCATION: 'allocation',
  DRAWDOWN: 'drawdown',
  MONTE_CARLO_CONFIDENCE_FAN: 'monte-carlo-confidence-fan',
  MONTE_CARLO_PERCENTILE_BANDS: 'monte-carlo-percentile-bands'
});

export const CHART_DATA_STATES = Object.freeze({
  READY: 'ready',
  LOADING: 'loading',
  UNAVAILABLE: 'unavailable',
  QUOTE_ONLY: 'quote-only',
  INSUFFICIENT_HISTORY: 'insufficient-history',
  STALE: 'stale',
  QUALITY_WARNING: 'quality-warning'
});

export const CHART_TIME_FILTERS = Object.freeze([
  Object.freeze({ id: '1M', label: '1M' }),
  Object.freeze({ id: '3M', label: '3M' }),
  Object.freeze({ id: '6M', label: '6M' }),
  Object.freeze({ id: 'YTD', label: 'YTD' }),
  Object.freeze({ id: '1Y', label: '1Y' }),
  Object.freeze({ id: 'SINCE_PURCHASE', label: 'Since Purchase' }),
  Object.freeze({ id: 'MAX', label: 'Max' })
]);

export const CHART_TIME_FILTER_IDS = Object.freeze(
  CHART_TIME_FILTERS.map((filter) => filter.id)
);

export const STOOQ_PRICE_RETURN_LABEL =
  'Split-adjusted, dividend-unadjusted price-return approximation.';

const RENDERABLE_STATES = new Set([
  CHART_DATA_STATES.READY,
  CHART_DATA_STATES.STALE,
  CHART_DATA_STATES.QUALITY_WARNING
]);

const DEFAULT_STATE_MESSAGES = Object.freeze({
  [CHART_DATA_STATES.LOADING]: 'Loading prepared chart data…',
  [CHART_DATA_STATES.UNAVAILABLE]: 'Chart data is unavailable.',
  [CHART_DATA_STATES.QUOTE_ONLY]: 'Current quotes are available, but this chart requires historical data.',
  [CHART_DATA_STATES.INSUFFICIENT_HISTORY]: 'There is not enough aligned history for this chart and time range.',
  [CHART_DATA_STATES.STALE]: 'This chart may be stale because an input changed.',
  [CHART_DATA_STATES.QUALITY_WARNING]: 'This chart includes historical-data quality warnings.'
});

export function createChartState(overrides = {}) {
  const status = isChartDataState(overrides.status)
    ? overrides.status
    : CHART_DATA_STATES.UNAVAILABLE;
  const timeFilter = CHART_TIME_FILTER_IDS.includes(overrides.timeFilter)
    ? overrides.timeFilter
    : 'MAX';

  return {
    status,
    message: String(overrides.message || DEFAULT_STATE_MESSAGES[status] || ''),
    timeFilter,
    visibleSeries: normalizeVisibleSeries(overrides.visibleSeries),
    zoom: normalizeZoom(overrides.zoom),
    updatedAt: overrides.updatedAt || null
  };
}

export function updateChartState(state, changes = {}) {
  return createChartState({ ...state, ...changes });
}

export function isChartDataState(value) {
  return Object.values(CHART_DATA_STATES).includes(value);
}

export function isRenderableChartState(value) {
  const status = typeof value === 'string' ? value : value?.status;
  return RENDERABLE_STATES.has(status);
}

export function resolvePreparedChartData(prepared, timeFilter = 'MAX') {
  if (!prepared || typeof prepared !== 'object') return null;
  const byFilter = prepared.seriesByTimeFilter;

  if (!byFilter || typeof byFilter !== 'object') {
    return prepared;
  }

  const selected = byFilter[timeFilter];
  if (!selected) {
    return {
      ...prepared,
      status: CHART_DATA_STATES.INSUFFICIENT_HISTORY,
      message: DEFAULT_STATE_MESSAGES[CHART_DATA_STATES.INSUFFICIENT_HISTORY],
      series: []
    };
  }

  return {
    ...prepared,
    ...(selected && !Array.isArray(selected) ? selected : {}),
    series: Array.isArray(selected) ? selected : selected.series,
    timeFilter
  };
}

export function chartStateMessage(status) {
  return DEFAULT_STATE_MESSAGES[status] || '';
}

function normalizeVisibleSeries(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([key, visible]) => [String(key), visible !== false])
  );
}

function normalizeZoom(value) {
  const start = Number(value?.start);
  const end = Number(value?.end);
  return {
    start: Number.isFinite(start) ? Math.min(100, Math.max(0, start)) : 0,
    end: Number.isFinite(end) ? Math.min(100, Math.max(0, end)) : 100
  };
}
