import { parseAndNormalizeHistoricalFile } from "./historical-file-parser.js";

export const HISTORICAL_IMPORT_SERVICE_VERSION = "2.2-phase-2d";
export const HISTORICAL_IMPORT_MODES = Object.freeze({
  REPLACE: "replace",
  APPEND: "append"
});

export const HISTORICAL_IMPORT_SERVICE_ERROR_CODES = Object.freeze({
  INVALID_STORAGE_ADAPTER: "HISTORICAL_IMPORT_INVALID_STORAGE_ADAPTER",
  NO_FILES_SELECTED: "HISTORICAL_IMPORT_NO_FILES_SELECTED",
  FILE_READ_FAILED: "HISTORICAL_IMPORT_FILE_READ_FAILED",
  DUPLICATE_SYMBOL_IN_BATCH: "HISTORICAL_IMPORT_DUPLICATE_SYMBOL_IN_BATCH",
  INVALID_PREVIEW: "HISTORICAL_IMPORT_INVALID_PREVIEW",
  REPLACEMENT_CONFIRMATION_REQUIRED: "HISTORICAL_REPLACEMENT_CONFIRMATION_REQUIRED",
  APPEND_NOT_ALLOWED: "HISTORICAL_APPEND_NOT_ALLOWED",
  TRANSACTION_FAILED: "HISTORICAL_IMPORT_TRANSACTION_FAILED"
});

const PREVIEW_TYPE = "historical-import-preview-v1";
const EXACT_RECORD_FIELDS = Object.freeze([
  "symbol",
  "date",
  "open",
  "high",
  "low",
  "close",
  "volume",
  "frequency",
  "source",
  "sourceTicker",
  "priceAdjustment",
  "dividendAdjustment"
]);
const DEFAULT_SAMPLE_LIMIT = 5;

export class HistoricalImportServiceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "HistoricalImportServiceError";
    this.code = code;
    this.details = details && typeof details === "object" ? { ...details } : {};

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HistoricalImportServiceError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: { ...this.details }
    };
  }
}

/**
 * Phase 2D manual import service.
 *
 * The storage adapter deliberately sits between this module and Phase 2C so
 * persistence schema details remain in js/persistence. Supported adapter names:
 *
 * Read methods:
 * - getHistoricalSeries(symbol) or getSeries(symbol)
 * - getHistoricalMetadata(symbol) or getDatasetMetadata(symbol), optional
 *
 * Transaction method:
 * - runHistoricalSymbolTransaction(symbol, callback) or
 *   runSymbolTransaction(symbol, callback)
 *
 * Transaction object methods:
 * - replaceHistoricalSeries(records) or replaceSeries(records)
 * - appendHistoricalRecords(records) or appendSeries(records)
 * - putHistoricalMetadata(metadata) or putDatasetMetadata(metadata)
 * - addHistoricalImportHistory(entry) or addImportHistory(entry)
 * - addDiagnostic(entry)
 * - putDerivedInvalidation(entry) or invalidateDerived(entry)
 *
 * Non-transactional audit method used for rejected, unchanged, and failed attempts.
 * It must persist a safe import-history/Diagnostics entry:
 * - recordHistoricalImportAttempt(entry)
 */
export function createHistoricalImportService(options = {}) {
  const parser = typeof options.parser === "function"
    ? options.parser
    : parseAndNormalizeHistoricalFile;
  const storage = normalizeStorageAdapter(options.storage);
  const now = typeof options.now === "function"
    ? options.now
    : () => new Date().toISOString();
  const hashText = typeof options.hashText === "function"
    ? options.hashText
    : createSourceHash;
  const invalidationDispatcher = options.invalidationDispatcher || null;
  const sampleLimit = Number.isInteger(options.sampleLimit) && options.sampleLimit > 0
    ? options.sampleLimit
    : DEFAULT_SAMPLE_LIMIT;

  return Object.freeze({
    prepareFiles,
    commit,
    compareSeries: (existingRecords, incomingRecords) => compareHistoricalSeries(
      existingRecords,
      incomingRecords,
      { sampleLimit }
    )
  });

  async function prepareFiles(fileList, prepareOptions = {}) {
    const files = normalizeFiles(fileList);
    if (files.length === 0) {
      throw new HistoricalImportServiceError(
        HISTORICAL_IMPORT_SERVICE_ERROR_CODES.NO_FILES_SELECTED,
        "Select at least one Stooq historical text file."
      );
    }

    const onProgress = typeof prepareOptions.onProgress === "function"
      ? prepareOptions.onProgress
      : () => {};
    const preparedAt = now();
    const entries = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const fileName = sanitizeFileName(file && file.name) || `selected-file-${index + 1}.txt`;
      const baseProgress = {
        phase: "prepare",
        fileIndex: index,
        fileCount: files.length,
        fileName
      };

      try {
        onProgress({ ...baseProgress, status: "reading" });
        const sourceText = await readCompleteFile(file, fileName);

        onProgress({ ...baseProgress, status: "validating" });
        const normalized = parser(sourceText, {
          fileName,
          parsedAt: preparedAt,
          normalizedAt: preparedAt
        });
        const records = normalized.records;
        const symbol = records[0].symbol;

        onProgress({ ...baseProgress, status: "hashing", symbol });
        const sourceHash = await hashText(sourceText);

        onProgress({ ...baseProgress, status: "comparing", symbol });
        const existingRecords = await storage.getSeries(symbol);
        const existingMetadata = await storage.getMetadata(symbol);
        const comparison = compareHistoricalSeries(
          existingRecords,
          records,
          { sampleLimit }
        );
        const append = evaluateAppendEligibility(existingRecords, records);

        entries.push({
          id: createId("historical-file"),
          valid: true,
          fileName,
          fileSize: Number.isFinite(file && file.size) ? file.size : sourceText.length,
          symbol,
          mode: HISTORICAL_IMPORT_MODES.REPLACE,
          records,
          existingRecordCount: existingRecords.length,
          incomingRecordCount: records.length,
          existingDateRange: getDateRange(existingRecords),
          incomingDateRange: getDateRange(records),
          comparison,
          append,
          sourceHash,
          warnings: copyArray(normalized.warnings),
          provenance: clonePlain(normalized.provenance),
          existingMetadata: clonePlain(existingMetadata)
        });
        onProgress({ ...baseProgress, status: "ready", symbol });
      } catch (error) {
        const safeError = serializeSafeError(error);
        entries.push({
          id: createId("historical-file-error"),
          valid: false,
          fileName,
          fileSize: Number.isFinite(file && file.size) ? file.size : null,
          mode: HISTORICAL_IMPORT_MODES.REPLACE,
          error: safeError
        });
        await recordAttemptSafely(storage, {
          id: createId("historical-import-attempt"),
          type: "historical-import-attempt",
          status: "validation-failed",
          fileName,
          timestamp: now(),
          error: safeError,
          serviceVersion: HISTORICAL_IMPORT_SERVICE_VERSION
        });
        onProgress({ ...baseProgress, status: "error", error: safeError });
      }
    }

    markDuplicateSymbols(entries);

    return {
      type: PREVIEW_TYPE,
      id: createId("historical-import-preview"),
      preparedAt,
      defaultMode: HISTORICAL_IMPORT_MODES.REPLACE,
      fileCount: entries.length,
      validFileCount: entries.filter((entry) => entry.valid).length,
      invalidFileCount: entries.filter((entry) => !entry.valid).length,
      entries,
      canCommit: entries.some((entry) => entry.valid)
    };
  }

  async function commit(preview, commitOptions = {}) {
    assertPreview(preview);

    const onProgress = typeof commitOptions.onProgress === "function"
      ? commitOptions.onProgress
      : () => {};
    const modeBySymbol = normalizeModeMap(commitOptions.modeBySymbol);
    const commitEntries = preview.entries.filter((entry) => entry.valid);
    const replacementEntries = commitEntries.filter((entry) => {
      const mode = resolveMode(entry, modeBySymbol);
      return mode === HISTORICAL_IMPORT_MODES.REPLACE
        && entry.existingRecordCount > 0
        && hasMaterialDifference(entry.comparison.counts);
    });

    if (replacementEntries.length > 0) {
      const confirmationSummary = replacementEntries.map((entry) => ({
        symbol: entry.symbol,
        fileName: entry.fileName,
        counts: { ...entry.comparison.counts },
        existingDateRange: { ...entry.existingDateRange },
        incomingDateRange: { ...entry.incomingDateRange }
      }));
      const confirmed = await resolveReplacementConfirmation(
        commitOptions,
        confirmationSummary
      );
      if (!confirmed) {
        throw new HistoricalImportServiceError(
          HISTORICAL_IMPORT_SERVICE_ERROR_CODES.REPLACEMENT_CONFIRMATION_REQUIRED,
          "Confirm full-series replacement before importing changed historical data.",
          { replacements: confirmationSummary }
        );
      }
    }

    const batchId = createId("historical-import-batch");
    const startedAt = now();
    const results = [];

    for (let index = 0; index < commitEntries.length; index += 1) {
      const entry = commitEntries[index];
      const mode = resolveMode(entry, modeBySymbol);
      const progress = {
        phase: "commit",
        batchId,
        symbolIndex: index,
        symbolCount: commitEntries.length,
        symbol: entry.symbol,
        fileName: entry.fileName,
        mode
      };

      onProgress({ ...progress, status: "starting" });

      if (mode === HISTORICAL_IMPORT_MODES.APPEND && !entry.append.allowed) {
        const error = new HistoricalImportServiceError(
          HISTORICAL_IMPORT_SERVICE_ERROR_CODES.APPEND_NOT_ALLOWED,
          entry.append.reason,
          { symbol: entry.symbol, append: clonePlain(entry.append) }
        );
        const failedResult = createFailureResult(entry, mode, error, now());
        results.push(failedResult);
        await recordAttemptSafely(storage, createAttemptFromResult(batchId, failedResult));
        onProgress({ ...progress, status: "error", error: failedResult.error });
        continue;
      }

      const recordsToWrite = mode === HISTORICAL_IMPORT_MODES.APPEND
        ? entry.append.recordsToAppend
        : entry.records;
      const noChanges = mode === HISTORICAL_IMPORT_MODES.APPEND
        ? recordsToWrite.length === 0
        : !hasMaterialDifference(entry.comparison.counts);

      if (noChanges) {
        const unchangedResult = {
          symbol: entry.symbol,
          fileName: entry.fileName,
          mode,
          status: "unchanged",
          importedAt: now(),
          counts: { ...entry.comparison.counts },
          writtenRecordCount: 0,
          sourceHash: clonePlain(entry.sourceHash),
          derivedInvalidation: null
        };
        results.push(unchangedResult);
        await recordAttemptSafely(storage, createAttemptFromResult(batchId, unchangedResult));
        onProgress({ ...progress, status: "unchanged" });
        continue;
      }

      const importedAt = now();
      const invalidation = createDerivedInvalidation(entry.symbol, importedAt, mode);
      const metadata = createImportMetadata(entry, mode, importedAt, recordsToWrite);
      const storedRecords = createStoredRecords(recordsToWrite, metadata);
      const historyEntry = createHistoryEntry(
        batchId,
        entry,
        mode,
        importedAt,
        recordsToWrite.length,
        invalidation
      );
      const diagnosticEntry = createDiagnosticEntry(historyEntry);

      try {
        await storage.runSymbolTransaction(entry.symbol, async (transaction) => {
          const tx = normalizeTransactionAdapter(transaction, entry.symbol);
          if (mode === HISTORICAL_IMPORT_MODES.APPEND) {
            await tx.appendSeries(storedRecords);
          } else {
            await tx.replaceSeries(storedRecords);
          }
          await tx.putMetadata(metadata);
          await tx.putInvalidation(invalidation);
          await tx.addHistory(historyEntry);
          await tx.addDiagnostic(diagnosticEntry);
        });

        const successResult = {
          symbol: entry.symbol,
          fileName: entry.fileName,
          mode,
          status: "committed",
          importedAt,
          counts: { ...entry.comparison.counts },
          writtenRecordCount: storedRecords.length,
          sourceHash: clonePlain(entry.sourceHash),
          derivedInvalidation: clonePlain(invalidation)
        };
        results.push(successResult);
        onProgress({ ...progress, status: "committed" });

        await dispatchInvalidationSafely(
          invalidationDispatcher,
          invalidation,
          storage,
          batchId,
          entry
        );
      } catch (error) {
        const wrapped = error instanceof HistoricalImportServiceError
          ? error
          : new HistoricalImportServiceError(
            HISTORICAL_IMPORT_SERVICE_ERROR_CODES.TRANSACTION_FAILED,
            `Historical import transaction failed for ${entry.symbol}. The installed series was not changed.`,
            {
              symbol: entry.symbol,
              cause: serializeSafeError(error)
            }
          );
        const failedResult = createFailureResult(entry, mode, wrapped, now());
        results.push(failedResult);
        await recordAttemptSafely(storage, createAttemptFromResult(batchId, failedResult));
        onProgress({ ...progress, status: "error", error: failedResult.error });
      }
    }

    return {
      batchId,
      startedAt,
      completedAt: now(),
      results,
      committedCount: results.filter((result) => result.status === "committed").length,
      unchangedCount: results.filter((result) => result.status === "unchanged").length,
      failedCount: results.filter((result) => result.status === "failed").length
    };
  }
}

export function compareHistoricalSeries(existingRecords, incomingRecords, options = {}) {
  const existing = normalizeRecordArray(existingRecords);
  const incoming = normalizeRecordArray(incomingRecords);
  const sampleLimit = Number.isInteger(options.sampleLimit) && options.sampleLimit > 0
    ? options.sampleLimit
    : DEFAULT_SAMPLE_LIMIT;
  const existingByDate = new Map(existing.map((record) => [record.date, record]));
  const incomingByDate = new Map(incoming.map((record) => [record.date, record]));
  const samples = {
    added: [],
    changed: [],
    removed: [],
    unchanged: []
  };
  const counts = {
    added: 0,
    changed: 0,
    removed: 0,
    unchanged: 0
  };

  for (const incomingRecord of incoming) {
    const existingRecord = existingByDate.get(incomingRecord.date);
    if (!existingRecord) {
      counts.added += 1;
      pushSample(samples.added, {
        date: incomingRecord.date,
        incoming: cloneRecord(incomingRecord)
      }, sampleLimit);
      continue;
    }

    if (historicalRecordsEqual(existingRecord, incomingRecord)) {
      counts.unchanged += 1;
      pushSample(samples.unchanged, {
        date: incomingRecord.date,
        incoming: cloneRecord(incomingRecord)
      }, sampleLimit);
    } else {
      counts.changed += 1;
      pushSample(samples.changed, {
        date: incomingRecord.date,
        existing: cloneRecord(existingRecord),
        incoming: cloneRecord(incomingRecord)
      }, sampleLimit);
    }
  }

  for (const existingRecord of existing) {
    if (!incomingByDate.has(existingRecord.date)) {
      counts.removed += 1;
      pushSample(samples.removed, {
        date: existingRecord.date,
        existing: cloneRecord(existingRecord)
      }, sampleLimit);
    }
  }

  return {
    counts,
    samples,
    existingRecordCount: existing.length,
    incomingRecordCount: incoming.length
  };
}

export function evaluateAppendEligibility(existingRecords, incomingRecords) {
  const existing = normalizeRecordArray(existingRecords);
  const incoming = normalizeRecordArray(incomingRecords);

  if (incoming.length === 0) {
    return appendDenied("The selected file contains no normalized records.");
  }

  if (existing.length === 0) {
    return {
      allowed: true,
      reason: "No installed series exists; all validated records can be inserted.",
      overlapCount: 0,
      newRecordCount: incoming.length,
      recordsToAppend: incoming.map(cloneRecord)
    };
  }

  const existingByDate = new Map(existing.map((record) => [record.date, record]));
  const installedLastDate = existing[existing.length - 1].date;
  let overlapCount = 0;
  const recordsToAppend = [];

  for (const record of incoming) {
    const installed = existingByDate.get(record.date);
    if (installed) {
      overlapCount += 1;
      if (!historicalRecordsEqual(installed, record)) {
        return appendDenied(
          `Append is blocked because overlapping date ${record.date} does not match the installed record exactly.`,
          overlapCount
        );
      }
      continue;
    }

    if (record.date <= installedLastDate) {
      return appendDenied(
        `Append is blocked because ${record.date} is inside the installed date range but has no matching installed record.`,
        overlapCount
      );
    }
    recordsToAppend.push(cloneRecord(record));
  }

  if (overlapCount === 0) {
    return appendDenied(
      "Append is blocked because the selected file has no overlapping date that can verify continuity with the installed series."
    );
  }

  return {
    allowed: true,
    reason: recordsToAppend.length > 0
      ? "All overlapping records match exactly and all new records are later than the installed series."
      : "All overlapping records match exactly; there are no later records to add.",
    overlapCount,
    newRecordCount: recordsToAppend.length,
    recordsToAppend
  };
}

export function historicalRecordsEqual(left, right) {
  if (!left || !right) {
    return false;
  }

  for (const field of EXACT_RECORD_FIELDS) {
    if (!Object.is(left[field], right[field])) {
      return false;
    }
  }

  return shallowObjectEqual(left.sourcePrecision, right.sourcePrecision)
    && shallowObjectEqual(left.sourceValueText, right.sourceValueText)
    && arrayEqual(left.qualityFlags, right.qualityFlags);
}

/**
 * Deterministic in-memory adapter for the manual test page. It mirrors the
 * per-symbol atomic transaction contract and supports failure injection.
 */
export function createMemoryHistoricalImportStorage(options = {}) {
  const series = new Map();
  const metadata = new Map();
  const importHistory = [];
  const diagnostics = [];
  const invalidations = [];
  const attempts = [];
  let failOperation = options.failOperation || null;

  if (options.initialSeries && typeof options.initialSeries === "object") {
    for (const [symbol, records] of Object.entries(options.initialSeries)) {
      series.set(symbol, normalizeRecordArray(records).map(cloneRecord));
    }
  }

  return {
    async getHistoricalSeries(symbol) {
      return (series.get(symbol) || []).map(cloneRecord);
    },

    async getHistoricalMetadata(symbol) {
      return clonePlain(metadata.get(symbol) || null);
    },

    async runHistoricalSymbolTransaction(symbol, callback) {
      const staged = {
        series: (series.get(symbol) || []).map(cloneRecord),
        metadata: clonePlain(metadata.get(symbol) || null),
        history: [],
        diagnostics: [],
        invalidations: []
      };
      const transaction = {
        async replaceHistoricalSeries(records) {
          maybeFail("replaceHistoricalSeries");
          staged.series = normalizeRecordArray(records).map(cloneRecord);
        },
        async appendHistoricalRecords(records) {
          maybeFail("appendHistoricalRecords");
          staged.series.push(...normalizeRecordArray(records).map(cloneRecord));
          staged.series.sort((a, b) => a.date.localeCompare(b.date));
        },
        async putHistoricalMetadata(value) {
          maybeFail("putHistoricalMetadata");
          staged.metadata = clonePlain(value);
        },
        async addHistoricalImportHistory(value) {
          maybeFail("addHistoricalImportHistory");
          staged.history.push(clonePlain(value));
        },
        async addDiagnostic(value) {
          maybeFail("addDiagnostic");
          staged.diagnostics.push(clonePlain(value));
        },
        async putDerivedInvalidation(value) {
          maybeFail("putDerivedInvalidation");
          staged.invalidations.push(clonePlain(value));
        }
      };

      await callback(transaction);
      maybeFail("commit");

      series.set(symbol, staged.series);
      metadata.set(symbol, staged.metadata);
      importHistory.push(...staged.history);
      diagnostics.push(...staged.diagnostics);
      invalidations.push(...staged.invalidations);
    },

    async recordHistoricalImportAttempt(value) {
      attempts.push(clonePlain(value));
    },

    setFailure(operation) {
      failOperation = operation || null;
    },

    seedSeries(symbol, records) {
      series.set(symbol, normalizeRecordArray(records).map(cloneRecord));
    },

    snapshot() {
      return {
        series: Object.fromEntries(
          Array.from(series.entries(), ([symbol, records]) => [
            symbol,
            records.map(cloneRecord)
          ])
        ),
        metadata: Object.fromEntries(
          Array.from(metadata.entries(), ([symbol, value]) => [symbol, clonePlain(value)])
        ),
        importHistory: importHistory.map(clonePlain),
        diagnostics: diagnostics.map(clonePlain),
        invalidations: invalidations.map(clonePlain),
        attempts: attempts.map(clonePlain)
      };
    }
  };

  function maybeFail(operation) {
    if (failOperation === operation) {
      throw new Error(`Injected transaction failure at ${operation}.`);
    }
  }
}

export async function createSourceHash(sourceText) {
  const text = typeof sourceText === "string" ? sourceText : String(sourceText);
  const cryptoObject = globalThis.crypto;
  if (cryptoObject && cryptoObject.subtle && typeof TextEncoder === "function") {
    const digest = await cryptoObject.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(text)
    );
    return {
      algorithm: "SHA-256",
      value: bytesToHex(new Uint8Array(digest))
    };
  }

  return {
    algorithm: "FNV-1A-32-FALLBACK",
    value: fnv1a32(text),
    warning: "SubtleCrypto was unavailable; a non-cryptographic fallback hash was used."
  };
}

function normalizeStorageAdapter(storage) {
  if (!storage || typeof storage !== "object") {
    throw new HistoricalImportServiceError(
      HISTORICAL_IMPORT_SERVICE_ERROR_CODES.INVALID_STORAGE_ADAPTER,
      "A Phase 2C historical storage adapter is required."
    );
  }

  const getSeries = pickMethod(storage, ["getHistoricalSeries", "getSeries"]);
  const getMetadata = pickMethod(storage, [
    "getHistoricalMetadata",
    "getDatasetMetadata"
  ], true);
  const runSymbolTransaction = pickMethod(storage, [
    "runHistoricalSymbolTransaction",
    "runSymbolTransaction"
  ]);
  const recordAttempt = pickMethod(storage, ["recordHistoricalImportAttempt"]);

  if (!getSeries || !runSymbolTransaction || !recordAttempt) {
    throw new HistoricalImportServiceError(
      HISTORICAL_IMPORT_SERVICE_ERROR_CODES.INVALID_STORAGE_ADAPTER,
      "The storage adapter must provide historical series reads, per-symbol transactions, and import-attempt audit persistence."
    );
  }

  return {
    getSeries: async (symbol) => normalizeRecordArray(await getSeries(symbol)),
    getMetadata: async (symbol) => getMetadata ? await getMetadata(symbol) : null,
    runSymbolTransaction,
    recordAttempt
  };
}

function normalizeTransactionAdapter(transaction, symbol) {
  if (!transaction || typeof transaction !== "object") {
    throw new HistoricalImportServiceError(
      HISTORICAL_IMPORT_SERVICE_ERROR_CODES.INVALID_STORAGE_ADAPTER,
      `The transaction adapter for ${symbol} is missing.`
    );
  }

  const replaceSeries = pickMethod(transaction, [
    "replaceHistoricalSeries",
    "replaceSeries"
  ]);
  const appendSeries = pickMethod(transaction, [
    "appendHistoricalRecords",
    "appendSeries"
  ]);
  const putMetadata = pickMethod(transaction, [
    "putHistoricalMetadata",
    "putDatasetMetadata"
  ]);
  const addHistory = pickMethod(transaction, [
    "addHistoricalImportHistory",
    "addImportHistory"
  ]);
  const addDiagnostic = pickMethod(transaction, ["addDiagnostic"]);
  const putInvalidation = pickMethod(transaction, [
    "putDerivedInvalidation",
    "invalidateDerived"
  ]);

  if (!replaceSeries || !appendSeries || !putMetadata || !addHistory
      || !addDiagnostic || !putInvalidation) {
    throw new HistoricalImportServiceError(
      HISTORICAL_IMPORT_SERVICE_ERROR_CODES.INVALID_STORAGE_ADAPTER,
      `The transaction adapter for ${symbol} does not implement every Phase 2D write operation.`
    );
  }

  return {
    replaceSeries,
    appendSeries,
    putMetadata,
    addHistory,
    addDiagnostic,
    putInvalidation
  };
}

function pickMethod(target, names, optional = false) {
  for (const name of names) {
    if (typeof target[name] === "function") {
      return target[name].bind(target);
    }
  }
  return optional ? null : null;
}

function normalizeFiles(fileList) {
  if (!fileList) {
    return [];
  }
  if (Array.isArray(fileList)) {
    return fileList.slice();
  }
  try {
    return Array.from(fileList);
  } catch (error) {
    return [];
  }
}

async function readCompleteFile(file, fileName) {
  try {
    if (file && typeof file.text === "function") {
      return await file.text();
    }
    if (typeof file === "string") {
      return file;
    }
    throw new TypeError("Selected file does not support text reading.");
  } catch (error) {
    throw new HistoricalImportServiceError(
      HISTORICAL_IMPORT_SERVICE_ERROR_CODES.FILE_READ_FAILED,
      `Could not read ${fileName} completely.`,
      { fileName, cause: serializeSafeError(error) }
    );
  }
}

function markDuplicateSymbols(entries) {
  const bySymbol = new Map();
  for (const entry of entries) {
    if (!entry.valid) {
      continue;
    }
    const group = bySymbol.get(entry.symbol) || [];
    group.push(entry);
    bySymbol.set(entry.symbol, group);
  }

  for (const [symbol, group] of bySymbol.entries()) {
    if (group.length < 2) {
      continue;
    }
    for (const entry of group) {
      entry.valid = false;
      entry.error = serializeSafeError(new HistoricalImportServiceError(
        HISTORICAL_IMPORT_SERVICE_ERROR_CODES.DUPLICATE_SYMBOL_IN_BATCH,
        `Select only one file for ${symbol} in each import batch.`,
        { symbol, fileNames: group.map((item) => item.fileName) }
      ));
    }
  }
}

function assertPreview(preview) {
  if (!preview || preview.type !== PREVIEW_TYPE || !Array.isArray(preview.entries)) {
    throw new HistoricalImportServiceError(
      HISTORICAL_IMPORT_SERVICE_ERROR_CODES.INVALID_PREVIEW,
      "Prepare and validate the selected files before committing an import."
    );
  }
}

function normalizeModeMap(value) {
  if (value instanceof Map) {
    return new Map(value);
  }
  if (value && typeof value === "object") {
    return new Map(Object.entries(value));
  }
  return new Map();
}

function resolveMode(entry, modeBySymbol) {
  const mode = modeBySymbol.get(entry.symbol) || entry.mode || HISTORICAL_IMPORT_MODES.REPLACE;
  return mode === HISTORICAL_IMPORT_MODES.APPEND
    ? HISTORICAL_IMPORT_MODES.APPEND
    : HISTORICAL_IMPORT_MODES.REPLACE;
}

async function resolveReplacementConfirmation(options, summary) {
  if (options.replacementConfirmed === true) {
    return true;
  }
  if (typeof options.confirmReplacement === "function") {
    return Boolean(await options.confirmReplacement(summary));
  }
  return false;
}

function createImportMetadata(entry, mode, importedAt, recordsWritten) {
  const resultingRecordCount = mode === HISTORICAL_IMPORT_MODES.APPEND
    ? entry.existingRecordCount + recordsWritten.length
    : entry.incomingRecordCount;
  const resultingFirstDate = mode === HISTORICAL_IMPORT_MODES.APPEND
    ? entry.existingDateRange.firstDate || entry.incomingDateRange.firstDate
    : entry.incomingDateRange.firstDate;
  const resultingLastDate = mode === HISTORICAL_IMPORT_MODES.APPEND
    ? recordsWritten.length > 0
      ? recordsWritten[recordsWritten.length - 1].date
      : entry.existingDateRange.lastDate
    : entry.incomingDateRange.lastDate;

  return {
    symbol: entry.symbol,
    datasetVersion: HISTORICAL_IMPORT_SERVICE_VERSION,
    source: entry.provenance.source || "Stooq",
    sourceFileName: entry.fileName,
    sourceFileHash: entry.sourceHash.value,
    sourceFileHashAlgorithm: entry.sourceHash.algorithm,
    priceAdjustment: entry.provenance.priceAdjustment || "split-adjusted",
    dividendAdjustment: entry.provenance.dividendAdjustment || "none",
    frequency: entry.provenance.frequency || "D",
    recordCount: resultingRecordCount,
    firstDate: resultingFirstDate,
    lastDate: resultingLastDate,
    importMode: mode,
    importedAt,
    warnings: copyArray(entry.warnings),
    provenance: clonePlain(entry.provenance),
    comparisonCounts: { ...entry.comparison.counts },
    previousDatasetVersion: entry.existingMetadata && entry.existingMetadata.datasetVersion
      ? entry.existingMetadata.datasetVersion
      : null,
    previousSourceFileHash: entry.existingMetadata && entry.existingMetadata.sourceFileHash
      ? entry.existingMetadata.sourceFileHash
      : null,
    previousImportedAt: entry.existingMetadata && entry.existingMetadata.importedAt
      ? entry.existingMetadata.importedAt
      : null
  };
}

function createStoredRecords(records, metadata) {
  return records.map((record) => ({
    ...cloneRecord(record),
    datasetVersion: metadata.datasetVersion,
    importTimestamp: metadata.importedAt,
    sourceFileHash: metadata.sourceFileHash,
    sourceFileHashAlgorithm: metadata.sourceFileHashAlgorithm,
    importMode: metadata.importMode
  }));
}

function createDerivedInvalidation(symbol, timestamp, mode) {
  return {
    id: createId("historical-derived-invalidation"),
    symbol,
    timestamp,
    reason: "historical-series-import",
    importMode: mode,
    analytics: "stale",
    simulations: "stale",
    status: "pending-recompute"
  };
}

function createHistoryEntry(batchId, entry, mode, importedAt, writtenRecordCount, invalidation) {
  return {
    id: createId("historical-import-history"),
    batchId,
    type: "historical-import",
    status: "committed",
    symbol: entry.symbol,
    fileName: entry.fileName,
    importMode: mode,
    timestamp: importedAt,
    source: entry.provenance.source || "Stooq",
    sourceFileHash: entry.sourceHash.value,
    sourceFileHashAlgorithm: entry.sourceHash.algorithm,
    priceAdjustment: entry.provenance.priceAdjustment || "split-adjusted",
    dividendAdjustment: entry.provenance.dividendAdjustment || "none",
    comparisonCounts: { ...entry.comparison.counts },
    installedRecordCountBefore: entry.existingRecordCount,
    incomingRecordCount: entry.incomingRecordCount,
    writtenRecordCount,
    firstDate: entry.incomingDateRange.firstDate,
    lastDate: entry.incomingDateRange.lastDate,
    warningCount: entry.warnings.length,
    derivedInvalidationId: invalidation.id,
    serviceVersion: HISTORICAL_IMPORT_SERVICE_VERSION
  };
}

function createDiagnosticEntry(historyEntry) {
  return {
    id: createId("historical-import-diagnostic"),
    category: "historical-import",
    severity: "info",
    timestamp: historyEntry.timestamp,
    symbol: historyEntry.symbol,
    code: "HISTORICAL_IMPORT_COMMITTED",
    message: `${historyEntry.symbol} historical data was imported using ${historyEntry.importMode} mode.`,
    details: clonePlain(historyEntry)
  };
}

function createFailureResult(entry, mode, error, timestamp) {
  return {
    symbol: entry.symbol,
    fileName: entry.fileName,
    mode,
    status: "failed",
    importedAt: timestamp,
    counts: { ...entry.comparison.counts },
    writtenRecordCount: 0,
    sourceHash: clonePlain(entry.sourceHash),
    derivedInvalidation: null,
    error: serializeSafeError(error)
  };
}

function createAttemptFromResult(batchId, result) {
  return {
    id: createId("historical-import-attempt"),
    batchId,
    type: "historical-import-attempt",
    status: result.status,
    symbol: result.symbol || null,
    fileName: result.fileName || null,
    importMode: result.mode || null,
    timestamp: result.importedAt || new Date().toISOString(),
    counts: clonePlain(result.counts),
    error: clonePlain(result.error),
    serviceVersion: HISTORICAL_IMPORT_SERVICE_VERSION
  };
}

async function recordAttemptSafely(storage, entry) {
  if (!storage.recordAttempt) {
    return;
  }
  try {
    await storage.recordAttempt(entry);
  } catch (error) {
    // Audit persistence must never expose source contents or mask the primary result.
  }
}

async function dispatchInvalidationSafely(dispatcher, invalidation, storage, batchId, entry) {
  if (!dispatcher) {
    return;
  }

  try {
    if (typeof dispatcher === "function") {
      await dispatcher(clonePlain(invalidation));
    } else if (typeof dispatcher.invalidateHistoricalSymbol === "function") {
      await dispatcher.invalidateHistoricalSymbol(
        invalidation.symbol,
        clonePlain(invalidation)
      );
    }
  } catch (error) {
    await recordAttemptSafely(storage, {
      id: createId("historical-invalidation-dispatch"),
      batchId,
      type: "historical-invalidation-dispatch",
      status: "dispatch-failed",
      symbol: entry.symbol,
      fileName: entry.fileName,
      timestamp: new Date().toISOString(),
      invalidationId: invalidation.id,
      error: serializeSafeError(error),
      serviceVersion: HISTORICAL_IMPORT_SERVICE_VERSION
    });
  }
}

function hasMaterialDifference(counts) {
  return counts.added > 0 || counts.changed > 0 || counts.removed > 0;
}

function appendDenied(reason, overlapCount = 0) {
  return {
    allowed: false,
    reason,
    overlapCount,
    newRecordCount: 0,
    recordsToAppend: []
  };
}

function normalizeRecordArray(records) {
  if (!Array.isArray(records)) {
    return [];
  }
  return records.slice().sort((left, right) => String(left.date).localeCompare(String(right.date)));
}

function getDateRange(records) {
  if (!records.length) {
    return { firstDate: null, lastDate: null };
  }
  return {
    firstDate: records[0].date,
    lastDate: records[records.length - 1].date
  };
}

function shallowObjectEqual(left, right) {
  const leftObject = left && typeof left === "object" ? left : {};
  const rightObject = right && typeof right === "object" ? right : {};
  const leftKeys = Object.keys(leftObject).sort();
  const rightKeys = Object.keys(rightObject).sort();
  if (!arrayEqual(leftKeys, rightKeys)) {
    return false;
  }
  return leftKeys.every((key) => Object.is(leftObject[key], rightObject[key]));
}

function arrayEqual(left, right) {
  const leftArray = Array.isArray(left) ? left : [];
  const rightArray = Array.isArray(right) ? right : [];
  return leftArray.length === rightArray.length
    && leftArray.every((value, index) => Object.is(value, rightArray[index]));
}

function pushSample(target, value, limit) {
  if (target.length < limit) {
    target.push(value);
  }
}

function cloneRecord(record) {
  return {
    ...record,
    sourcePrecision: record.sourcePrecision ? { ...record.sourcePrecision } : undefined,
    sourceValueText: record.sourceValueText ? { ...record.sourceValueText } : undefined,
    qualityFlags: Array.isArray(record.qualityFlags) ? record.qualityFlags.slice() : []
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

function copyArray(value) {
  return Array.isArray(value) ? value.map(clonePlain) : [];
}

function serializeSafeError(error) {
  if (error && typeof error.toJSON === "function") {
    return clonePlain(error.toJSON());
  }
  return {
    name: error && error.name ? error.name : "Error",
    code: error && error.code ? error.code : null,
    message: error && error.message ? error.message : String(error),
    details: error && error.details && typeof error.details === "object"
      ? clonePlain(error.details)
      : {}
  };
}

function sanitizeFileName(fileName) {
  if (typeof fileName !== "string" || fileName.trim() === "") {
    return null;
  }
  const pathParts = fileName.trim().split(/[\\/]/);
  return pathParts[pathParts.length - 1] || null;
}

function createId(prefix) {
  const cryptoObject = globalThis.crypto;
  if (cryptoObject && typeof cryptoObject.randomUUID === "function") {
    return `${prefix}-${cryptoObject.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fnv1a32(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
