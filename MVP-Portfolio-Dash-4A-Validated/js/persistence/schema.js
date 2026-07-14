import {
  FINNHUB_API_KEY_SOURCES,
  PREDEFINED_FINNHUB_API_KEY
} from "../config/finnhub.js";

export const APP_VERSION = "0.2.3-v2.3-phase-3b";
export const LOCAL_STORAGE_SCHEMA_VERSION = 2;
export const INDEXED_DB_SCHEMA_VERSION = 2;
export const LOCAL_STORAGE_KEY = "mvpPortfolioDashboard.localState";
export const INDEXED_DB_NAME = "mvpPortfolioDashboard";
export const DEFAULT_DEBOUNCE_MS = 350;
export const DEFAULT_INDEXED_DB_BATCH_MS = 250;

export const STORE_NAMES = Object.freeze({
  QUOTE_SNAPSHOTS: "quoteSnapshots",
  CANDLES: "candles",
  COMPANY_METADATA: "companyMetadata",
  DIAGNOSTICS_HISTORY: "diagnosticsHistory",
  EXPORT_STAGING: "exportStaging",
  HISTORICAL_CANDLES: "historicalCandles",
  HISTORICAL_DATASET_MANIFESTS: "historicalDatasetManifests",
  HISTORICAL_IMPORT_BATCHES: "historicalImportBatches",
  HISTORICAL_QUALITY_FLAGS: "historicalQualityFlags"
});

export const INDEXED_DB_STORE_DEFINITIONS = Object.freeze([
  storeDefinition(STORE_NAMES.QUOTE_SNAPSHOTS, "id", [
    indexDefinition("symbol", "symbol"),
    indexDefinition("asOf", "asOf"),
    indexDefinition("updatedAt", "updatedAt")
  ]),
  storeDefinition(STORE_NAMES.CANDLES, "id", [
    indexDefinition("symbol", "symbol"),
    indexDefinition("resolution", "resolution"),
    indexDefinition("from", "from"),
    indexDefinition("to", "to"),
    indexDefinition("updatedAt", "updatedAt")
  ]),
  storeDefinition(STORE_NAMES.COMPANY_METADATA, "symbol", [
    indexDefinition("updatedAt", "updatedAt"),
    indexDefinition("expiresAt", "expiresAt")
  ]),
  storeDefinition(STORE_NAMES.DIAGNOSTICS_HISTORY, "id", [
    indexDefinition("level", "level"),
    indexDefinition("category", "category"),
    indexDefinition("createdAt", "createdAt")
  ]),
  storeDefinition(STORE_NAMES.EXPORT_STAGING, "id", [
    indexDefinition("type", "type"),
    indexDefinition("createdAt", "createdAt"),
    indexDefinition("expiresAt", "expiresAt")
  ]),
  storeDefinition(STORE_NAMES.HISTORICAL_CANDLES, ["symbol", "date"], [
    indexDefinition("symbol", "symbol"),
    indexDefinition("date", "date"),
    indexDefinition("datasetVersion", "datasetVersion"),
    indexDefinition("source", "source"),
    indexDefinition("importedAt", "importedAt")
  ]),
  storeDefinition(STORE_NAMES.HISTORICAL_DATASET_MANIFESTS, "id", [
    indexDefinition("symbol", "symbol"),
    indexDefinition("datasetId", "datasetId"),
    indexDefinition("datasetVersion", "datasetVersion"),
    indexDefinition("sourceFileHash", "sourceFileHash"),
    indexDefinition("installedAt", "installedAt")
  ]),
  storeDefinition(STORE_NAMES.HISTORICAL_IMPORT_BATCHES, "id", [
    indexDefinition("symbol", "symbol"),
    indexDefinition("datasetVersion", "datasetVersion"),
    indexDefinition("mode", "mode"),
    indexDefinition("status", "status"),
    indexDefinition("startedAt", "startedAt"),
    indexDefinition("completedAt", "completedAt")
  ]),
  storeDefinition(STORE_NAMES.HISTORICAL_QUALITY_FLAGS, "id", [
    indexDefinition("symbol", "symbol"),
    indexDefinition("code", "code"),
    indexDefinition("severity", "severity"),
    indexDefinition("datasetVersion", "datasetVersion"),
    indexDefinition("createdAt", "createdAt")
  ])
]);

export function createDefaultApiSettingsMetadata() {
  return {
    provider: "finnhub",
    hasApiKey: Boolean(PREDEFINED_FINNHUB_API_KEY),
    keySource: FINNHUB_API_KEY_SOURCES.PREDEFINED,
    apiKeyLastUpdatedAt: null,
    lastCapabilityCheckAt: null
  };
}

export function createDefaultLocalState() {
  return {
    schemaVersion: LOCAL_STORAGE_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    updatedAt: null,
    holdings: [],
    lots: [],
    activeSymbols: [],
    benchmarks: [],
    apiSettings: createDefaultApiSettingsMetadata(),
    theme: "system",
    accentColor: "default",
    fontScale: 1,
    uiPreferences: {},
    projectionHorizonYears: 5,
    monteCarloSettings: {},
    exportPreferences: { includeApiKeyInBackup: false },
    historicalImportPreferences: {},
    setup: {
      completed: false,
      completedAt: null
    }
  };
}

export function sanitizeApiSettings(apiSettings = {}) {
  const safe = apiSettings && typeof apiSettings === "object"
    ? { ...apiSettings }
    : {};
  delete safe.token;
  delete safe.secret;
  delete safe.apiKey;
  const normalized = {
    ...createDefaultApiSettingsMetadata(),
    ...safe
  };
  normalized.hasApiKey = Boolean(normalized.hasApiKey);
  normalized.keySource = Object.values(FINNHUB_API_KEY_SOURCES).includes(normalized.keySource)
    ? normalized.keySource
    : FINNHUB_API_KEY_SOURCES.PREDEFINED;
  return normalized;
}

export function summarizeApiSettingsForDiagnostics(apiSettings = {}) {
  const normalized = sanitizeApiSettings(apiSettings);
  return {
    provider: normalized.provider,
    hasApiKey: normalized.hasApiKey,
    keySource: normalized.keySource,
    apiKeyLastUpdatedAt: normalized.apiKeyLastUpdatedAt,
    lastCapabilityCheckAt: normalized.lastCapabilityCheckAt
  };
}

export function migrateLocalState(oldState) {
  let source = oldState;

  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch (error) {
      return createDefaultLocalState();
    }
  }

  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return createDefaultLocalState();
  }
  return normalizeLocalState({
    ...source,
    schemaVersion: LOCAL_STORAGE_SCHEMA_VERSION
  });
}

export function normalizeLocalState(state) {
  const defaults = createDefaultLocalState();
  const source = state && typeof state === "object" ? state : {};
  return {
    ...defaults,
    ...source,
    schemaVersion: LOCAL_STORAGE_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    holdings: arrayOrDefault(source.holdings, defaults.holdings),
    lots: arrayOrDefault(source.lots, defaults.lots),
    activeSymbols: arrayOrDefault(source.activeSymbols, defaults.activeSymbols),
    benchmarks: arrayOrDefault(source.benchmarks, defaults.benchmarks),
    apiSettings: sanitizeApiSettings(source.apiSettings),
    uiPreferences: objectOrDefault(source.uiPreferences, defaults.uiPreferences),
    monteCarloSettings: objectOrDefault(source.monteCarloSettings, defaults.monteCarloSettings),
    exportPreferences: objectOrDefault(source.exportPreferences, defaults.exportPreferences),
    historicalImportPreferences: objectOrDefault(
      source.historicalImportPreferences,
      defaults.historicalImportPreferences
    ),
    setup: {
      ...defaults.setup,
      ...objectOrDefault(source.setup, {})
    }
  };
}

export function mergeLocalState(currentState, partialState) {
  return normalizeLocalState({
    ...normalizeLocalState(currentState),
    ...(partialState && typeof partialState === "object" ? partialState : {}),
    updatedAt: new Date().toISOString()
  });
}

export function nowIso() {
  return new Date().toISOString();
}

export function createIndexedDbUpgradePlan(oldVersion, newVersion) {
  return {
    oldVersion: Number(oldVersion) || 0,
    newVersion: Number(newVersion) || INDEXED_DB_SCHEMA_VERSION,
    appliedMigrations: [],
    notes: [
      "Existing Phase 1 stores are preserved.",
      "Version 2 adds normalized historical candles and historical metadata stores."
    ]
  };
}

export function applyIndexedDbSchema(event) {
  const database = event.target.result;
  const transaction = event.target.transaction;
  const plan = createIndexedDbUpgradePlan(event.oldVersion, event.newVersion);

  for (const definition of INDEXED_DB_STORE_DEFINITIONS) {
    let store;
    if (!database.objectStoreNames.contains(definition.name)) {
      store = database.createObjectStore(definition.name, {
        keyPath: definition.keyPath,
        ...(definition.autoIncrement ? { autoIncrement: true } : {})
      });
      plan.appliedMigrations.push(`created:${definition.name}`);
    } else {
      store = transaction.objectStore(definition.name);
    }

    for (const index of definition.indexes) {
      if (!store.indexNames.contains(index.name)) {
        store.createIndex(index.name, index.keyPath, index.options);
        plan.appliedMigrations.push(`index:${definition.name}.${index.name}`);
      }
    }
  }

  return plan;
}

function storeDefinition(name, keyPath, indexes = [], autoIncrement = false) {
  return Object.freeze({
    name,
    keyPath,
    autoIncrement,
    indexes: Object.freeze(indexes)
  });
}

function indexDefinition(name, keyPath, options = {}) {
  return Object.freeze({
    name,
    keyPath,
    options: Object.freeze({ unique: false, multiEntry: false, ...options })
  });
}

function arrayOrDefault(value, fallback) {
  return Array.isArray(value) ? value.slice() : fallback.slice();
}

function objectOrDefault(value, fallback) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...value }
    : { ...fallback };
}
