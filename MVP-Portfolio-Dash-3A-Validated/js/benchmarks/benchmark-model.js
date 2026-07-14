import { normalizeSymbol } from "../data/finnhub-client.js";

export const BENCHMARK_MODEL_VERSION = "2.3-phase-4a";
export const DEFAULT_BENCHMARK_TICKERS = Object.freeze([
  "SPY",
  "IWM",
  "AVUV",
  "AVDV",
  "PSCH"
]);

export class BenchmarkModelError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "BenchmarkModelError";
    this.code = code;
    this.details = { ...details };
  }
}

export function createBenchmark(input, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new BenchmarkModelError("BENCHMARK_OBJECT_REQUIRED", "Benchmark input must be an object.");
  }

  let ticker;
  try {
    ticker = normalizeSymbol(String(input.ticker || ""));
  } catch (error) {
    throw new BenchmarkModelError("BENCHMARK_TICKER_INVALID", error.message, { ticker: input.ticker });
  }
  const label = normalizeLabel(input.label, ticker);
  const id = normalizeId(input.id, ticker, options.idFactory);

  return Object.freeze({
    id,
    recordType: "benchmark",
    type: "benchmark",
    ticker,
    label,
    active: input.active !== false,
    includeInCharts: input.includeInCharts !== false,
    includeInProjectionTables: input.includeInProjectionTables !== false,
    // Provenance only. Built-in records have exactly the same edit/delete rules.
    builtIn: Boolean(input.builtIn),
    modelVersion: BENCHMARK_MODEL_VERSION
  });
}

export function seedDefaultBenchmarks(options = {}) {
  return Object.freeze(DEFAULT_BENCHMARK_TICKERS.map((ticker) => createBenchmark({
    id: `benchmark-${ticker.toLowerCase()}`,
    ticker,
    label: ticker,
    active: true,
    builtIn: true,
    includeInCharts: true,
    includeInProjectionTables: true
  }, options)));
}

export function updateBenchmark(benchmark, changes = {}, options = {}) {
  const current = createBenchmark(benchmark, options);
  return createBenchmark({ ...current, ...changes, id: current.id }, options);
}

function normalizeLabel(value, ticker) {
  if (value === undefined || value === null || String(value).trim() === "") return ticker;
  const label = String(value).trim();
  if (label.length > 80) {
    throw new BenchmarkModelError(
      "BENCHMARK_LABEL_TOO_LONG",
      "Benchmark display label must be 80 characters or fewer."
    );
  }
  return label;
}

function normalizeId(value, ticker, idFactory) {
  if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  if (typeof idFactory === "function") {
    const generated = idFactory("benchmark");
    if (typeof generated === "string" && generated.trim()) return generated.trim();
  }
  const suffix = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  return `benchmark-${ticker.toLowerCase()}-${suffix}`;
}
