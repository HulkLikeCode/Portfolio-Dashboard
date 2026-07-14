import {
  DEFAULT_MONTE_CARLO_RETURN_COUNT,
  HISTORICAL_DATA_STATES
} from "../data/historical-quality.js";

export const HISTORICAL_DATA_DIAGNOSTICS_VERSION = "2.2-phase-2e";

/**
 * Diagnostics projection over HistoricalDataService results.
 * It exposes safe provenance, hashes, counts, freshness, and flags only.
 */
export class HistoricalDataDiagnostics {
  constructor(options = {}) {
    if (!options.service
        || typeof options.service.getDatasetStatus !== "function"
        || typeof options.service.getAlignedSeries !== "function") {
      throw new TypeError("A HistoricalDataService instance is required.");
    }
    this.service = options.service;
    this.now = typeof options.now === "function"
      ? options.now
      : () => new Date().toISOString();
  }

  async getSymbolDiagnostics(symbol, options = {}) {
    const status = await this.service.getDatasetStatus(symbol, options);
    return buildHistoricalSymbolDiagnostic(status, this.now());
  }

  async getDiagnostics(symbols, options = {}) {
    if (!Array.isArray(symbols) || symbols.length === 0) {
      throw new TypeError("Provide at least one symbol for historical diagnostics.");
    }

    const generatedAt = this.now();
    const statuses = await Promise.all(
      symbols.map((symbol) => this.service.getDatasetStatus(symbol, options))
    );
    const symbolDiagnostics = statuses.map((status) => (
      buildHistoricalSymbolDiagnostic(status, generatedAt)
    ));

    const alignmentOptions = {
      startDate: options.startDate,
      endDate: options.endDate,
      referenceDate: options.referenceDate,
      staleAfterCalendarDays: options.staleAfterCalendarDays
    };
    if (options.returnCount !== undefined) {
      alignmentOptions.returnCount = options.returnCount;
    }
    const alignment = await this.service.getAlignedSeries(symbols, alignmentOptions);

    return {
      category: "historical-data",
      version: HISTORICAL_DATA_DIAGNOSTICS_VERSION,
      generatedAt,
      state: alignment.state,
      states: alignment.states.slice(),
      summary: summarizeHistoricalStatuses(symbolDiagnostics, alignment),
      symbols: symbolDiagnostics,
      alignment: buildAlignmentDiagnostic(alignment),
      methodology: {
        source: "Stooq",
        frequency: "D",
        priceAdjustment: "split-adjusted",
        dividendAdjustment: "none",
        returnLabel: "split-adjusted, dividend-unadjusted price-return approximation"
      }
    };
  }

  async getMonteCarloReadiness(symbols, options = {}) {
    const returnCount = options.returnCount === undefined
      ? DEFAULT_MONTE_CARLO_RETURN_COUNT
      : options.returnCount;
    const result = await this.getDiagnostics(symbols, {
      ...options,
      returnCount
    });
    const requiredCloseCount = returnCount + 1;
    const returnedCloseCount = result.alignment.returnedObservationCount;

    return {
      ...result,
      monteCarlo: {
        ready: result.alignment.missingSymbols.length === 0
          && returnedCloseCount === requiredCloseCount,
        requestedReturnCount: returnCount,
        requiredCloseCount,
        returnedCloseCount,
        returnedReturnCount: Math.max(0, returnedCloseCount - 1)
      }
    };
  }
}

export function createHistoricalDataDiagnostics(options = {}) {
  return new HistoricalDataDiagnostics(options);
}

export function buildHistoricalSymbolDiagnostic(status, generatedAt = new Date().toISOString()) {
  const provenance = status && status.provenance ? status.provenance : {};
  const counts = status && status.counts ? status.counts : {};
  const freshness = status && status.freshness ? status.freshness : {};

  return {
    category: "historical-data-symbol",
    generatedAt,
    symbol: status.symbol,
    state: status.state,
    states: Array.isArray(status.states) ? status.states.slice() : [],
    available: Boolean(status.available),
    dateRange: status.dateRange ? { ...status.dateRange } : { firstDate: null, lastDate: null },
    freshness: {
      referenceDate: freshness.referenceDate || null,
      lastDate: freshness.lastDate || null,
      ageCalendarDays: Number.isFinite(freshness.ageCalendarDays)
        ? freshness.ageCalendarDays
        : null,
      staleAfterCalendarDays: Number.isFinite(freshness.staleAfterCalendarDays)
        ? freshness.staleAfterCalendarDays
        : null,
      stale: Boolean(freshness.stale)
    },
    counts: {
      observationCount: counts.recordCount || 0,
      validCloseCount: counts.validCloseCount || 0,
      returnObservationCount: counts.returnObservationCount || 0,
      minimumCloseCount: counts.minimumCloseCount || 0,
      zeroVolumeCount: counts.zeroVolumeCount || 0,
      flaggedRecordCount: counts.flaggedRecordCount || 0,
      qualityWarningCount: counts.qualityWarningCount || 0,
      qualityErrorCount: counts.qualityErrorCount || 0
    },
    provenance: {
      source: provenance.source || null,
      sourceTicker: provenance.sourceTicker || null,
      frequency: provenance.frequency || null,
      priceAdjustment: provenance.priceAdjustment || null,
      dividendAdjustment: provenance.dividendAdjustment || null,
      datasetVersion: provenance.datasetVersion || null,
      sourceFileName: provenance.sourceFileName || null,
      sourceFileHash: provenance.sourceFileHash || null,
      sourceFileHashAlgorithm: provenance.sourceFileHashAlgorithm || null,
      importMode: provenance.importMode || null,
      importedAt: provenance.importedAt || null,
      parserVersion: provenance.parserVersion || null,
      normalizerVersion: provenance.normalizerVersion || null,
      volumeSemantics: provenance.volumeSemantics || null
    },
    qualityFlags: Array.isArray(status.qualityFlags)
      ? status.qualityFlags.map((flag) => ({ ...flag }))
      : [],
    warnings: Array.isArray(status.warnings)
      ? status.warnings.map(sanitizeWarning)
      : []
  };
}

export function summarizeHistoricalStatuses(symbolDiagnostics, alignment) {
  const symbols = Array.isArray(symbolDiagnostics) ? symbolDiagnostics : [];
  const stateCounts = {
    current: 0,
    missing: 0,
    stale: 0,
    insufficient: 0,
    qualityWarning: 0,
    error: 0
  };

  for (const diagnostic of symbols) {
    const states = Array.isArray(diagnostic.states) ? diagnostic.states : [];
    if (states.includes(HISTORICAL_DATA_STATES.CURRENT)) stateCounts.current += 1;
    if (states.includes(HISTORICAL_DATA_STATES.MISSING)) stateCounts.missing += 1;
    if (states.includes(HISTORICAL_DATA_STATES.STALE)) stateCounts.stale += 1;
    if (states.includes(HISTORICAL_DATA_STATES.INSUFFICIENT)) stateCounts.insufficient += 1;
    if (states.includes(HISTORICAL_DATA_STATES.QUALITY_WARNING)) stateCounts.qualityWarning += 1;
    if (states.includes(HISTORICAL_DATA_STATES.ERROR)) stateCounts.error += 1;
  }

  return {
    symbolCount: symbols.length,
    availableSymbolCount: symbols.filter((item) => item.available).length,
    stateCounts,
    totalObservationCount: symbols.reduce(
      (sum, item) => sum + (item.counts.observationCount || 0),
      0
    ),
    commonAlignedObservationCount: alignment && alignment.counts
      ? alignment.counts.commonObservationCount
      : 0,
    returnedAlignedObservationCount: alignment && alignment.counts
      ? alignment.counts.returnedObservationCount
      : 0,
    alignedReturnObservationCount: alignment && alignment.counts
      ? alignment.counts.returnObservationCount
      : 0
  };
}

function buildAlignmentDiagnostic(alignment) {
  return {
    state: alignment.state,
    states: alignment.states.slice(),
    symbols: alignment.symbols.slice(),
    missingSymbols: alignment.missingSymbols.slice(),
    firstDate: alignment.dateRange.firstDate,
    lastDate: alignment.dateRange.lastDate,
    commonObservationCount: alignment.counts.commonObservationCount,
    returnedObservationCount: alignment.counts.returnedObservationCount,
    returnObservationCount: alignment.counts.returnObservationCount,
    requiredCloseCount: alignment.counts.requiredCloseCount,
    warnings: alignment.warnings.map(sanitizeWarning)
  };
}

function sanitizeWarning(warning) {
  return {
    symbol: warning && warning.symbol ? warning.symbol : undefined,
    code: warning && warning.code ? warning.code : "HISTORICAL_WARNING",
    severity: warning && warning.severity ? warning.severity : "warning",
    message: warning && warning.message ? warning.message : "Historical data warning.",
    details: warning && warning.details && typeof warning.details === "object"
      ? clonePlain(warning.details)
      : {}
  };
}

function clonePlain(value) {
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(clonePlain);
  }
  if (typeof value === "object") {
    const output = {};
    for (const [key, nested] of Object.entries(value)) {
      output[key] = clonePlain(nested);
    }
    return output;
  }
  return value;
}
