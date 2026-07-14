import { normalizeSymbol } from "../data/finnhub-client.js";

export const SYMBOL_REGISTRY_VERSION = "2.3-phase-4a";
export const MAX_ACTIVE_SYMBOLS = 25;
export const REGISTRY_STALE_REASON = "symbol-registry-changed";

export class SymbolRegistryError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "SymbolRegistryError";
    this.code = code;
    this.details = { ...details };
  }
}

export class SymbolRegistry {
  constructor(state = {}, options = {}) {
    this.maxActiveSymbols = normalizeLimit(options.maxActiveSymbols);
    this.state = normalizeRegistryState(state);
  }

  records() {
    return [
      ...this.state.holdings.map((record) => registryRecord(record, "holding")),
      ...this.state.benchmarks.map((record) => registryRecord(record, "benchmark"))
    ];
  }

  activeSymbols() {
    return collectActiveSymbols(this.state.holdings, this.state.benchmarks);
  }

  activeCount() {
    return this.activeSymbols().length;
  }

  find(recordType, id) {
    return this.records().find((record) => record.recordType === recordType && record.id === id) || null;
  }

  filter(query = "", activity = "all") {
    const term = String(query || "").trim().toLocaleLowerCase();
    return this.records().filter((record) => {
      if (activity === "active" && !record.active) return false;
      if (activity === "inactive" && record.active) return false;
      if (!term) return true;
      return `${record.ticker} ${record.label} ${record.recordType}`.toLocaleLowerCase().includes(term);
    });
  }

  canActivate(recordType, id) {
    const record = this.find(recordType, id);
    if (!record) return { allowed: false, reason: "not-found", activeCount: this.activeCount() };
    if (record.active || this.activeSymbols().includes(record.ticker)) {
      return { allowed: true, reason: "already-counted", activeCount: this.activeCount() };
    }
    const activeCount = this.activeCount();
    return {
      allowed: activeCount < this.maxActiveSymbols,
      reason: activeCount < this.maxActiveSymbols ? "capacity-available" : "active-symbol-limit",
      activeCount
    };
  }

  setActive(recordType, id, active) {
    const nextActive = Boolean(active);
    if (nextActive) {
      const decision = this.canActivate(recordType, id);
      if (!decision.allowed) {
        throw new SymbolRegistryError(
          "ACTIVE_SYMBOL_LIMIT_REACHED",
          `Cannot activate another symbol. The ${this.maxActiveSymbols}-active-symbol limit is already reached. Deactivate a holding or benchmark first.`,
          { recordType, id, activeCount: decision.activeCount, limit: this.maxActiveSymbols }
        );
      }
    }
    return this.updateRecord(recordType, id, { active: nextActive });
  }

  updateRecord(recordType, id, changes) {
    const key = collectionKey(recordType);
    const index = this.state[key].findIndex((record) => record.id === id);
    if (index < 0) throw notFound(recordType, id);
    const collection = this.state[key].map((record, recordIndex) => (
      recordIndex === index ? { ...record, ...changes, id: record.id, type: recordType } : { ...record }
    ));
    return this.withCollection(key, collection);
  }

  addRecord(recordType, record) {
    const key = collectionKey(recordType);
    const candidate = { ...record, type: recordType };
    const next = this.withCollection(key, [...this.state[key], candidate]);
    if (candidate.active !== false && next.activeCount() > this.maxActiveSymbols) {
      throw new SymbolRegistryError(
        "ACTIVE_SYMBOL_LIMIT_REACHED",
        `Cannot activate ${candidate.ticker}. The maximum is ${this.maxActiveSymbols} active symbols across holdings and benchmarks. Save it inactive or deactivate another symbol first.`,
        { ticker: candidate.ticker, activeCount: this.activeCount(), limit: this.maxActiveSymbols }
      );
    }
    return next;
  }

  removeRecord(recordType, id) {
    const key = collectionKey(recordType);
    if (!this.state[key].some((record) => record.id === id)) throw notFound(recordType, id);
    return this.withCollection(key, this.state[key].filter((record) => record.id !== id));
  }

  toState(previousState = this.state, options = {}) {
    const revision = Math.max(0, Number(previousState.registryRevision || 0)) + 1;
    const invalidatedAt = options.invalidatedAt || new Date().toISOString();
    return {
      ...previousState,
      holdings: this.state.holdings.map(clonePlain),
      benchmarks: this.state.benchmarks.map(clonePlain),
      activeSymbols: this.activeSymbols(),
      registryRevision: revision,
      dependentDataState: {
        ...(previousState.dependentDataState || {}),
        charts: "stale",
        analytics: "stale",
        simulations: "stale",
        staleReason: REGISTRY_STALE_REASON,
        registryRevision: revision,
        invalidatedAt
      }
    };
  }

  withCollection(key, collection) {
    return new SymbolRegistry({ ...this.state, [key]: collection }, {
      maxActiveSymbols: this.maxActiveSymbols
    });
  }
}

export function createSymbolRegistry(state, options = {}) {
  return new SymbolRegistry(state, options);
}

export function collectActiveSymbols(holdings = [], benchmarks = []) {
  const symbols = new Set();
  [...holdings, ...benchmarks].forEach((record) => {
    if (record?.active !== false && record?.ticker) symbols.add(normalizeSymbol(String(record.ticker)));
  });
  return [...symbols].sort();
}

export function assertActiveSymbolLimit(state, options = {}) {
  const registry = new SymbolRegistry(state, options);
  if (registry.activeCount() > registry.maxActiveSymbols) {
    throw new SymbolRegistryError(
      "ACTIVE_SYMBOL_LIMIT_REACHED",
      `The active symbol set contains ${registry.activeCount()} symbols; the maximum is ${registry.maxActiveSymbols}.`,
      { activeCount: registry.activeCount(), limit: registry.maxActiveSymbols }
    );
  }
  return registry;
}

function normalizeRegistryState(state) {
  return {
    holdings: Array.isArray(state.holdings) ? state.holdings.map(clonePlain) : [],
    benchmarks: Array.isArray(state.benchmarks) ? state.benchmarks.map(clonePlain) : []
  };
}

function registryRecord(record, recordType) {
  return Object.freeze({
    id: record.id,
    recordType,
    type: recordType,
    ticker: normalizeSymbol(String(record.ticker || "")),
    label: String(record.label || record.ticker || ""),
    active: record.active !== false,
    includeInCharts: recordType === "benchmark" ? record.includeInCharts !== false : true,
    includeInProjectionTables: recordType === "benchmark"
      ? record.includeInProjectionTables !== false
      : true
  });
}

function collectionKey(recordType) {
  if (recordType === "holding") return "holdings";
  if (recordType === "benchmark") return "benchmarks";
  throw new SymbolRegistryError("REGISTRY_RECORD_TYPE_INVALID", "Record type must be holding or benchmark.", { recordType });
}

function notFound(recordType, id) {
  return new SymbolRegistryError("REGISTRY_RECORD_NOT_FOUND", `${recordType} record was not found.`, { recordType, id });
}

function normalizeLimit(value) {
  if (value === undefined) return MAX_ACTIVE_SYMBOLS;
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1) {
    throw new SymbolRegistryError("ACTIVE_SYMBOL_LIMIT_INVALID", "Active symbol limit must be a positive integer.");
  }
  return numeric;
}

function clonePlain(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}
