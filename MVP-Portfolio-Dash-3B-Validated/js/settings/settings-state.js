import {
  FINNHUB_API_KEY_SOURCES,
  PREDEFINED_FINNHUB_API_KEY
} from '../config/finnhub.js';

const STORAGE_KEY = 'mvpPortfolioDash.settings.v1';
const APP_VERSION = '0.2.3-v2.3-phase-3b';
const SETTINGS_SCHEMA_VERSION = 2;
let runtimeFinnhubApiKey = PREDEFINED_FINNHUB_API_KEY;

const DEFAULT_LOTS = [
  {
    id: 'lot-dco-20260515-001',
    holdingId: 'holding-dco',
    ticker: 'DCO',
    shares: 39,
    acquisitionDate: '2026-05-15',
    purchasePrice: 145.17948,
    auditNote: 'Editable setup default.'
  },
  {
    id: 'lot-vtv-20260515-001',
    holdingId: 'holding-vtv',
    ticker: 'VTV',
    shares: 547,
    acquisitionDate: '2026-05-15',
    purchasePrice: 207.0364,
    auditNote: 'Editable setup default.'
  },
  {
    id: 'lot-oneq-20260515-001',
    holdingId: 'holding-oneq',
    ticker: 'ONEQ',
    shares: 918,
    acquisitionDate: '2026-05-15',
    purchasePrice: 104.06513,
    auditNote: 'Editable setup default.'
  }
];

const DEFAULT_BENCHMARK_TICKERS = ['SPY', 'IWM', 'AVUV', 'AVDV', 'PSCH'];

const DEFAULT_MONTE_CARLO_SETTINGS = Object.freeze({
  methods: ['gbm', 'historicalBootstrap'],
  defaultMethod: 'gbm',
  paths: 5000,
  seedMode: 'random',
  fixedSeed: 123456789
});

const DEFAULT_EXPORT_PREFERENCES = Object.freeze({
  includeApiKeyInBackup: false,
  backupReminderEnabled: true,
  backupReminderDays: 30,
  backupReminderEditCount: 10
});

export function createDefaultSettingsState() {
  const holdings = [
    {
      id: 'holding-dco',
      ticker: 'DCO',
      label: 'DCO',
      active: true,
      type: 'holding',
      lotIds: ['lot-dco-20260515-001']
    },
    {
      id: 'holding-vtv',
      ticker: 'VTV',
      label: 'VTV',
      active: true,
      type: 'holding',
      lotIds: ['lot-vtv-20260515-001']
    },
    {
      id: 'holding-oneq',
      ticker: 'ONEQ',
      label: 'ONEQ',
      active: true,
      type: 'holding',
      lotIds: ['lot-oneq-20260515-001']
    }
  ];

  const benchmarks = DEFAULT_BENCHMARK_TICKERS.map((ticker) => ({
    id: `benchmark-${ticker.toLowerCase()}`,
    ticker,
    label: ticker,
    active: true,
    builtIn: true,
    includeInCharts: true,
    includeInProjectionTables: true,
    type: 'benchmark'
  }));

  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    setup: {
      completed: false,
      completedAt: null,
      lastStep: 0
    },
    api: {
      provider: 'finnhub',
      apiKey: PREDEFINED_FINNHUB_API_KEY,
      hasKey: true,
      keySource: FINNHUB_API_KEY_SOURCES.PREDEFINED,
      lastUpdatedAt: null,
      storageWarningAccepted: false
    },
    holdings,
    lots: DEFAULT_LOTS.map((lot) => ({ ...lot })),
    benchmarks,
    activeSymbols: computeActiveSymbols(holdings, benchmarks),
    theme: 'system',
    accentColor: '#2563eb',
    fontScale: 1,
    uiPreferences: {
      density: 'comfortable',
      reduceMotion: false
    },
    projectionHorizonYears: 5,
    monteCarloSettings: { ...DEFAULT_MONTE_CARLO_SETTINGS },
    exportPreferences: { ...DEFAULT_EXPORT_PREFERENCES },
    backup: {
      lastExportedAt: null,
      editsSinceLastBackup: 0,
      dismissedReminderUntil: null
    },
    portfolioRevision: 0,
    dependentDataState: {
      analytics: 'not-generated',
      simulations: 'not-generated',
      staleReason: null,
      portfolioRevision: 0,
      invalidatedAt: null
    }
  };
}

export function loadSettingsState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return applyRuntimeApiKey(createDefaultSettingsState());
    }

    const parsed = JSON.parse(raw);
    const legacyApiKey = parsed?.api?.apiKey;
    if (typeof legacyApiKey === 'string' && legacyApiKey.trim()) {
      runtimeFinnhubApiKey = legacyApiKey.trim();
    }

    const normalized = applyRuntimeApiKey(normalizeSettingsState(migrateSettingsState(parsed)));

    // Rewrite legacy state immediately so keys saved by older versions do not
    // remain in clear text after the application is upgraded.
    persistSettingsState(normalized);
    return normalized;
  } catch (error) {
    return applyRuntimeApiKey(createDefaultSettingsState());
  }
}

export function saveSettingsState(nextState, options = {}) {
  const normalized = normalizeSettingsState(nextState);
  normalized.updatedAt = new Date().toISOString();

  if (options.incrementEditCount !== false) {
    normalized.backup.editsSinceLastBackup += 1;
  }

  runtimeFinnhubApiKey = normalized.api.apiKey;
  persistSettingsState(normalized);
  return normalized;
}

export function markSetupComplete(state) {
  const next = normalizeSettingsState(state);
  next.setup.completed = true;
  next.setup.completedAt = new Date().toISOString();
  next.setup.lastStep = 0;
  next.activeSymbols = computeActiveSymbols(next.holdings, next.benchmarks);
  return saveSettingsState(next, { incrementEditCount: true });
}

export function resetSettingsStateForTesting() {
  window.localStorage.removeItem(STORAGE_KEY);
  runtimeFinnhubApiKey = PREDEFINED_FINNHUB_API_KEY;
  return createDefaultSettingsState();
}

export function getSettingsStorageKey() {
  return STORAGE_KEY;
}

export function getActiveFinnhubApiKey(state = loadSettingsState()) {
  return normalizeSettingsState(state).api.apiKey;
}

export function resetFinnhubApiKey(state) {
  const next = normalizeSettingsState(state);
  next.api.apiKey = PREDEFINED_FINNHUB_API_KEY;
  next.api.hasKey = true;
  next.api.keySource = FINNHUB_API_KEY_SOURCES.PREDEFINED;
  next.api.lastUpdatedAt = new Date().toISOString();
  return next;
}

export { PREDEFINED_FINNHUB_API_KEY, FINNHUB_API_KEY_SOURCES };

export function computeActiveSymbols(holdings = [], benchmarks = []) {
  const symbols = new Set();

  holdings.forEach((holding) => {
    if (holding.active && holding.ticker) {
      symbols.add(normalizeTicker(holding.ticker));
    }
  });

  benchmarks.forEach((benchmark) => {
    if (benchmark.active && benchmark.ticker) {
      symbols.add(normalizeTicker(benchmark.ticker));
    }
  });

  return Array.from(symbols).sort();
}

export function applyDisplayPreferences(state) {
  const root = document.documentElement;
  const normalized = normalizeSettingsState(state);
  const preferredTheme = resolveTheme(normalized.theme);

  root.dataset.theme = preferredTheme;
  root.style.setProperty('--accent', normalized.accentColor);
  root.style.setProperty('--font-scale', String(normalized.fontScale));
}

export function maskApiKey(apiKey) {
  if (!apiKey) return '';
  const visible = apiKey.slice(-4);
  return `••••••••${visible}`;
}

export function normalizeTicker(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.\-]/g, '');
}

function migrateSettingsState(state) {
  if (!state || typeof state !== 'object') {
    return createDefaultSettingsState();
  }

  if (!state.schemaVersion) {
    return {
      ...createDefaultSettingsState(),
      ...state,
      schemaVersion: SETTINGS_SCHEMA_VERSION
    };
  }

  if (state.schemaVersion === SETTINGS_SCHEMA_VERSION) {
    return state;
  }

  return {
    ...createDefaultSettingsState(),
    ...state,
    schemaVersion: SETTINGS_SCHEMA_VERSION
  };
}

function normalizeSettingsState(state) {
  const defaults = createDefaultSettingsState();
  const next = {
    ...defaults,
    ...state,
    setup: { ...defaults.setup, ...(state.setup || {}) },
    api: { ...defaults.api, ...(state.api || {}) },
    uiPreferences: { ...defaults.uiPreferences, ...(state.uiPreferences || {}) },
    monteCarloSettings: {
      ...defaults.monteCarloSettings,
      ...(state.monteCarloSettings || {})
    },
    exportPreferences: {
      ...defaults.exportPreferences,
      ...(state.exportPreferences || {})
    },
    backup: { ...defaults.backup, ...(state.backup || {}) }
  };

  next.dependentDataState = {
    ...defaults.dependentDataState,
    ...(state.dependentDataState || {})
  };
  next.portfolioRevision = Number.isInteger(Number(state.portfolioRevision))
    ? Math.max(0, Number(state.portfolioRevision))
    : defaults.portfolioRevision;

  next.holdings = Array.isArray(state.holdings) ? state.holdings.map(normalizeHolding) : defaults.holdings;
  next.lots = Array.isArray(state.lots) ? state.lots.map(normalizeLot).filter(Boolean) : defaults.lots;
  next.benchmarks = Array.isArray(state.benchmarks)
    ? state.benchmarks.map(normalizeBenchmark).filter(Boolean)
    : defaults.benchmarks;
  next.theme = ['system', 'light', 'dark'].includes(state.theme) ? state.theme : defaults.theme;
  next.accentColor = /^#[0-9a-fA-F]{6}$/.test(state.accentColor || '') ? state.accentColor : defaults.accentColor;
  next.fontScale = clampNumber(state.fontScale, 0.85, 1.25, defaults.fontScale);
  next.projectionHorizonYears = clampInteger(state.projectionHorizonYears, 1, 10, defaults.projectionHorizonYears);
  next.activeSymbols = computeActiveSymbols(next.holdings, next.benchmarks);
  next.api.hasKey = Boolean(next.api.apiKey);
  if (!next.api.apiKey) {
    next.api.apiKey = PREDEFINED_FINNHUB_API_KEY;
    next.api.hasKey = true;
    next.api.keySource = FINNHUB_API_KEY_SOURCES.PREDEFINED;
  }
  if (!Object.values(FINNHUB_API_KEY_SOURCES).includes(next.api.keySource)) {
    next.api.keySource = next.api.apiKey === PREDEFINED_FINNHUB_API_KEY
      ? FINNHUB_API_KEY_SOURCES.PREDEFINED
      : FINNHUB_API_KEY_SOURCES.USER_OVERRIDE;
  }

  return next;
}

function applyRuntimeApiKey(state) {
  const next = state;
  next.api.apiKey = runtimeFinnhubApiKey || PREDEFINED_FINNHUB_API_KEY;
  next.api.hasKey = Boolean(next.api.apiKey);
  next.api.keySource = next.api.apiKey === PREDEFINED_FINNHUB_API_KEY
    ? FINNHUB_API_KEY_SOURCES.PREDEFINED
    : FINNHUB_API_KEY_SOURCES.USER_OVERRIDE;
  return next;
}

function persistSettingsState(state) {
  const { api: runtimeApi, ...persistentSettings } = state;
  const { apiKey: _omittedApiKey, ...persistentApiMetadata } = runtimeApi;
  const persistentState = {
    ...persistentSettings,
    api: persistentApiMetadata
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistentState));
}

function normalizeHolding(holding) {
  const ticker = normalizeTicker(holding.ticker);
  const id = holding.id || `holding-${ticker.toLowerCase()}-${cryptoSafeId()}`;

  return {
    id,
    ticker,
    label: String(holding.label || ticker),
    active: holding.active !== false,
    type: 'holding',
    lotIds: Array.isArray(holding.lotIds) ? holding.lotIds : []
  };
}

function normalizeLot(lot) {
  const ticker = normalizeTicker(lot.ticker);
  const shares = Number(lot.shares);
  const purchasePrice = Number(lot.purchasePrice);

  if (!ticker || !Number.isFinite(shares) || !Number.isFinite(purchasePrice)) {
    return null;
  }

  return {
    id: lot.id || `lot-${ticker.toLowerCase()}-${cryptoSafeId()}`,
    holdingId: lot.holdingId || `holding-${ticker.toLowerCase()}`,
    ticker,
    shares,
    acquisitionDate: String(lot.acquisitionDate || ''),
    purchasePrice,
    auditNote: String(lot.auditNote || '')
  };
}

function normalizeBenchmark(benchmark) {
  const ticker = normalizeTicker(benchmark.ticker);
  if (!ticker) return null;

  return {
    id: benchmark.id || `benchmark-${ticker.toLowerCase()}-${cryptoSafeId()}`,
    ticker,
    label: String(benchmark.label || ticker),
    active: benchmark.active !== false,
    builtIn: Boolean(benchmark.builtIn),
    includeInCharts: benchmark.includeInCharts !== false,
    includeInProjectionTables: benchmark.includeInProjectionTables !== false,
    type: 'benchmark'
  };
}

function resolveTheme(theme) {
  if (theme === 'light' || theme === 'dark') return theme;

  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }

  return 'light';
}

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function clampInteger(value, min, max, fallback) {
  const numeric = Number.parseInt(value, 10);
  if (!Number.isInteger(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function cryptoSafeId() {
  if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return array[0].toString(36);
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
