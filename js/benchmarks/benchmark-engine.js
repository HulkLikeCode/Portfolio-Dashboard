import { createBenchmark, updateBenchmark } from "./benchmark-model.js";
import { SymbolRegistry } from "../core/symbol-registry.js";

export const BENCHMARK_ENGINE_VERSION = "2.3-phase-4a";

export class BenchmarkEngineError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "BenchmarkEngineError";
    this.code = code;
    this.details = { ...details };
  }
}

export class BenchmarkEngine {
  constructor(options = {}) {
    if (!options.symbolService || typeof options.symbolService.validateSymbol !== "function") {
      throw new TypeError("SymbolService.validateSymbol() is required.");
    }
    if (!options.historicalDataService
        || typeof options.historicalDataService.getDatasetStatus !== "function") {
      throw new TypeError("HistoricalDataService.getDatasetStatus() is required.");
    }
    this.symbolService = options.symbolService;
    this.historicalDataService = options.historicalDataService;
    this.idFactory = options.idFactory;
    this.maxActiveSymbols = options.maxActiveSymbols;
  }

  async validateNewSymbol(ticker, options = {}) {
    const submittedTicker = String(ticker ?? "").trim();
    if (!submittedTicker) {
      throw new BenchmarkEngineError(
        "BENCHMARK_TICKER_REQUIRED",
        "Enter a ticker symbol before validation."
      );
    }
    let validation;
    try {
      validation = await this.symbolService.validateSymbol(submittedTicker, options);
    } catch (error) {
      throw new BenchmarkEngineError(
        "BENCHMARK_SYMBOL_VALIDATION_FAILED",
        error.message || "Finnhub symbol validation failed.",
        { cause: serializeError(error) }
      );
    }
    if (!validation?.valid) {
      if (validation?.error) {
        throw new BenchmarkEngineError(
          "BENCHMARK_SYMBOL_VALIDATION_FAILED",
          validation.error.message || "Finnhub symbol validation is currently unavailable.",
          { ticker: submittedTicker, validation }
        );
      }
      throw new BenchmarkEngineError(
        "BENCHMARK_SYMBOL_INVALID",
        `${submittedTicker.toUpperCase()} was not found by the Finnhub Symbol Service.`,
        { ticker: submittedTicker, validation }
      );
    }

    let historicalStatus = validation.historicalStatus || null;
    if (!historicalStatus) {
      try {
        historicalStatus = await this.historicalDataService.getDatasetStatus(validation.symbol);
      } catch (_error) {
        historicalStatus = null;
      }
    }
    const hasLocalHistory = historicalStatus === null
      ? null
      : Boolean(historicalStatus.available || (
        historicalStatus.state && !["missing", "error"].includes(historicalStatus.state)
      ));
    return {
      ...validation,
      historicalStatus,
      hasLocalHistory,
      quoteOnly: hasLocalHistory === false || validation.quoteOnly === true
    };
  }

  async add(state, input, options = {}) {
    const validation = await this.validateNewSymbol(input?.ticker, options.validation || {});
    const registry = this.registry(state);
    if (registry.records().some((record) => (
      record.recordType === "benchmark" && record.ticker === validation.symbol
    ))) {
      throw new BenchmarkEngineError(
        "BENCHMARK_ALREADY_EXISTS",
        `${validation.symbol} already exists as a benchmark.`,
        { ticker: validation.symbol }
      );
    }
    const benchmark = createBenchmark({
      ...input,
      ticker: validation.symbol,
      label: input.label || String(validation.match?.description || validation.symbol).slice(0, 80),
      builtIn: false
    }, { idFactory: this.idFactory });
    const nextRegistry = registry.addRecord("benchmark", benchmark);
    return { state: nextRegistry.toState(state, options), benchmark, validation };
  }

  restore(state, deletedBenchmark, input = {}, options = {}) {
    if (!deletedBenchmark?.ticker) {
      throw new BenchmarkEngineError(
        "BENCHMARK_RESTORE_RECORD_REQUIRED",
        "The deleted benchmark record is no longer available to restore."
      );
    }
    const registry = this.registry(state);
    const ticker = String(deletedBenchmark.ticker).trim().toUpperCase();
    if (registry.records().some((record) => (
      record.recordType === "benchmark" && record.ticker === ticker
    ))) {
      throw new BenchmarkEngineError(
        "BENCHMARK_ALREADY_EXISTS",
        `${ticker} already exists as a benchmark.`,
        { ticker }
      );
    }
    const benchmark = createBenchmark({
      ...deletedBenchmark,
      ...input,
      id: deletedBenchmark.id,
      ticker: deletedBenchmark.ticker,
      builtIn: false
    }, { idFactory: this.idFactory });
    const nextRegistry = registry.addRecord("benchmark", benchmark);
    return {
      state: nextRegistry.toState(state, options),
      benchmark,
      validation: {
        symbol: benchmark.ticker,
        valid: true,
        source: "stored-record",
        historicalStatus: null,
        quoteOnly: false
      }
    };
  }

  edit(state, benchmarkId, changes, options = {}) {
    const registry = this.registry(state);
    const current = registry.find("benchmark", benchmarkId);
    if (!current) throw notFound(benchmarkId);
    if (changes.ticker !== undefined && String(changes.ticker).toUpperCase() !== current.ticker) {
      throw new BenchmarkEngineError(
        "BENCHMARK_TICKER_EDIT_REQUIRES_READD",
        "Delete and re-add a benchmark to change its ticker."
      );
    }
    const benchmark = updateBenchmark(
      state.benchmarks.find((entry) => entry.id === benchmarkId),
      changes,
      { idFactory: this.idFactory }
    );
    const activityChecked = benchmark.active === current.active
      ? registry
      : registry.setActive("benchmark", benchmarkId, benchmark.active);
    const next = activityChecked.updateRecord("benchmark", benchmarkId, benchmark);
    return { state: next.toState(state, options), benchmark };
  }

  setActive(state, recordType, recordId, active, options = {}) {
    const registry = this.registry(state).setActive(recordType, recordId, active);
    return { state: registry.toState(state, options), record: registry.find(recordType, recordId) };
  }

  delete(state, benchmarkId, options = {}) {
    const registry = this.registry(state);
    const benchmark = registry.find("benchmark", benchmarkId);
    if (!benchmark) throw notFound(benchmarkId);
    // removeRecord targets the benchmark collection only; same-ticker holdings are untouched.
    return { state: registry.removeRecord("benchmark", benchmarkId).toState(state, options), benchmark };
  }

  activeBenchmarks(state) {
    return selectBenchmarks(state, (benchmark) => benchmark.active);
  }

  chartBenchmarks(state) {
    return selectBenchmarks(state, (benchmark) => benchmark.active && benchmark.includeInCharts);
  }

  projectionTableBenchmarks(state) {
    return selectBenchmarks(
      state,
      (benchmark) => benchmark.active && benchmark.includeInProjectionTables
    );
  }

  registry(state) {
    return new SymbolRegistry(state, { maxActiveSymbols: this.maxActiveSymbols });
  }
}

export function createBenchmarkEngine(options = {}) {
  return new BenchmarkEngine(options);
}

export function selectBenchmarks(state, predicate = () => true) {
  const benchmarks = Array.isArray(state?.benchmarks) ? state.benchmarks : [];
  return benchmarks.map((benchmark) => createBenchmark(benchmark)).filter(predicate);
}

function notFound(id) {
  return new BenchmarkEngineError("BENCHMARK_NOT_FOUND", "Benchmark was not found.", { id });
}

function serializeError(error) {
  return { name: error?.name, code: error?.code, message: error?.message || String(error) };
}
