import { parseAndNormalizeHistoricalFile } from "./historical-file-parser.js";
import {
  DIVIDEND_ADJUSTMENT,
  HISTORICAL_FREQUENCY,
  HISTORICAL_SOURCE,
  PRICE_ADJUSTMENT
} from "./historical-normalizer.js";
import {
  IndexedDbPersistence,
  indexedDbPersistence
} from "../persistence/indexed-db.js";

export const DEFAULT_HISTORICAL_MANIFEST_URL = new URL(
  "../../data/historical/manifest.json",
  import.meta.url
).href;

export const HISTORICAL_DATASET_MANAGER_VERSION = "2.2-phase-2c";

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const PROGRESS_PHASE_FRACTIONS = Object.freeze({
  checking: 0.05,
  fetching: 0.15,
  hashing: 0.25,
  parsing: 0.45,
  writing: 0.5,
  complete: 1,
  skipped: 1
});

export class HistoricalDatasetManager {
  constructor(options = {}) {
    this.persistence = options.persistence || indexedDbPersistence;
    this.manifestUrl = options.manifestUrl || DEFAULT_HISTORICAL_MANIFEST_URL;
    this.fetchImpl = options.fetchImpl || defaultFetch();
    this.now = typeof options.now === "function"
      ? options.now
      : () => new Date().toISOString();
  }

  async loadManifest(options = {}) {
    const manifestUrl = options.manifestUrl || this.manifestUrl;
    const response = await this.fetchImpl(manifestUrl, {
      cache: options.cache || "no-cache",
      signal: options.signal
    });
    if (!response || !response.ok) {
      const status = response ? response.status : "unavailable";
      throw new Error(`Historical dataset manifest request failed (${status}).`);
    }
    const manifest = await response.json();
    await validateHistoricalManifest(manifest);
    return { manifest, manifestUrl };
  }

  async installSeed(options = {}) {
    const onProgress = typeof options.onProgress === "function"
      ? options.onProgress
      : null;
    emitProgress(onProgress, {
      phase: "manifest",
      percent: 0,
      message: "Loading historical dataset manifest."
    });

    const loaded = options.manifest
      ? {
          manifest: options.manifest,
          manifestUrl: options.manifestUrl || this.manifestUrl
        }
      : await this.loadManifest(options);

    await validateHistoricalManifest(loaded.manifest);
    return this.installManifest(loaded.manifest, {
      ...options,
      manifestUrl: loaded.manifestUrl,
      onProgress
    });
  }

  async installManifest(manifest, options = {}) {
    await validateHistoricalManifest(manifest);
    const onProgress = typeof options.onProgress === "function"
      ? options.onProgress
      : null;
    const manifestUrl = options.manifestUrl || this.manifestUrl;
    const force = options.force === true;
    const signal = options.signal;
    const imported = [];
    const skipped = [];
    const failed = [];
    const totalFiles = manifest.files.length;
    const startedAt = this.now();

    throwIfAborted(signal);
    await this.persistence.open();

    for (let index = 0; index < totalFiles; index += 1) {
      const file = manifest.files[index];
      throwIfAborted(signal);
      emitFileProgress(onProgress, index, totalFiles, "checking", file.symbol, {
        message: `Checking ${file.symbol}.`
      });

      const existing = await this.persistence.getHistoricalManifest(file.symbol);
      if (!force && isFileCurrent(existing, manifest, file)) {
        skipped.push(file.symbol);
        emitFileProgress(onProgress, index, totalFiles, "skipped", file.symbol, {
          recordsCompleted: file.recordCount,
          recordsTotal: file.recordCount,
          message: `${file.symbol} is unchanged; source file was not parsed.`
        });
        continue;
      }

      try {
        const fileUrl = new URL(file.path, manifestUrl).href;
        emitFileProgress(onProgress, index, totalFiles, "fetching", file.symbol, {
          message: `Loading ${file.symbol} source file.`
        });
        const sourceBuffer = await fetchArrayBuffer(
          this.fetchImpl,
          fileUrl,
          signal
        );
        throwIfAborted(signal);

        if (
          Number.isInteger(file.byteLength)
          && sourceBuffer.byteLength !== file.byteLength
        ) {
          throw new Error(
            `${file.symbol} byte length mismatch: expected ${file.byteLength}, received ${sourceBuffer.byteLength}.`
          );
        }

        emitFileProgress(onProgress, index, totalFiles, "hashing", file.symbol, {
          message: `Verifying ${file.symbol} SHA-256 hash.`
        });
        const actualHash = await sha256Hex(sourceBuffer);
        if (actualHash !== file.sha256) {
          throw new Error(
            `${file.symbol} file hash mismatch. The source file was not installed.`
          );
        }
        throwIfAborted(signal);

        emitFileProgress(onProgress, index, totalFiles, "parsing", file.symbol, {
          message: `Parsing and validating ${file.symbol}.`
        });
        await yieldToBrowser();
        const sourceText = decodeUtf8(sourceBuffer);
        const importedAt = this.now();
        const normalized = parseAndNormalizeHistoricalFile(sourceText, {
          fileName: file.path,
          parsedAt: importedAt,
          normalizedAt: importedAt
        });
        validateNormalizedFile(normalized, manifest, file);
        throwIfAborted(signal);

        const metadata = buildSymbolMetadata(
          manifest,
          file,
          normalized,
          importedAt,
          startedAt
        );
        emitFileProgress(onProgress, index, totalFiles, "writing", file.symbol, {
          recordsCompleted: 0,
          recordsTotal: file.recordCount,
          message: `Writing ${file.symbol} to IndexedDB.`
        });

        await this.persistence.replaceHistoricalSeries(
          file.symbol,
          normalized.records,
          metadata,
          {
            warnings: normalized.warnings,
            onProgress: (writeProgress) => {
              emitFileProgress(onProgress, index, totalFiles, "writing", file.symbol, {
                recordsCompleted: writeProgress.completedRecords,
                recordsTotal: writeProgress.totalRecords,
                phaseFraction: 0.5 + (writeProgress.percent / 100) * 0.48,
                message: `Writing ${file.symbol}: ${writeProgress.completedRecords}/${writeProgress.totalRecords}.`
              });
            }
          }
        );

        imported.push(file.symbol);
        emitFileProgress(onProgress, index, totalFiles, "complete", file.symbol, {
          recordsCompleted: file.recordCount,
          recordsTotal: file.recordCount,
          message: `${file.symbol} installed.`
        });
      } catch (error) {
        failed.push({ symbol: file.symbol, message: error.message });
        await this._recordDatasetStatus(manifest, {
          status: "incomplete",
          startedAt,
          completedAt: this.now(),
          imported,
          skipped,
          failed
        });
        emitFileProgress(onProgress, index, totalFiles, "error", file.symbol, {
          message: `${file.symbol} failed: ${error.message}`
        });
        throw error;
      }
    }

    const completedAt = this.now();
    await this._recordDatasetStatus(manifest, {
      status: "current",
      startedAt,
      completedAt,
      imported,
      skipped,
      failed
    });

    const result = {
      datasetId: manifest.datasetId,
      datasetVersion: manifest.datasetVersion,
      datasetSha256: manifest.datasetSha256,
      totalRecordCount: manifest.totalRecordCount,
      imported,
      skipped,
      failed,
      startedAt,
      completedAt,
      current: failed.length === 0
    };

    emitProgress(onProgress, {
      phase: "complete",
      percent: 100,
      recordsCompleted: manifest.totalRecordCount,
      recordsTotal: manifest.totalRecordCount,
      message: imported.length === 0
        ? "Historical dataset is already current. No source files were parsed."
        : `Historical dataset installation complete. ${imported.length} file(s) installed; ${skipped.length} skipped.`
    });

    return result;
  }

  async getStatus(options = {}) {
    const loaded = options.manifest
      ? {
          manifest: options.manifest,
          manifestUrl: options.manifestUrl || this.manifestUrl
        }
      : await this.loadManifest(options);
    const manifest = loaded.manifest;
    const symbols = [];
    let installedRecordCount = 0;
    let currentCount = 0;

    for (const file of manifest.files) {
      const stored = await this.persistence.getHistoricalManifest(file.symbol);
      const current = isFileCurrent(stored, manifest, file);
      if (current) {
        currentCount += 1;
        installedRecordCount += stored.recordCount;
      }
      symbols.push({
        symbol: file.symbol,
        current,
        expectedHash: file.sha256,
        storedHash: stored ? stored.sourceFileHash : null,
        expectedRecordCount: file.recordCount,
        storedRecordCount: stored ? stored.recordCount : 0,
        firstDate: stored ? stored.firstDate : null,
        lastDate: stored ? stored.lastDate : null,
        installedAt: stored ? stored.installedAt : null
      });
    }

    return {
      datasetId: manifest.datasetId,
      datasetVersion: manifest.datasetVersion,
      datasetSha256: manifest.datasetSha256,
      current: currentCount === manifest.files.length,
      currentFileCount: currentCount,
      expectedFileCount: manifest.files.length,
      installedRecordCount,
      expectedRecordCount: manifest.totalRecordCount,
      symbols
    };
  }

  async _recordDatasetStatus(manifest, status) {
    return this.persistence.putHistoricalDatasetManifest({
      id: `dataset:${manifest.datasetId}`,
      recordType: "dataset",
      datasetId: manifest.datasetId,
      datasetVersion: manifest.datasetVersion,
      datasetSha256: manifest.datasetSha256,
      source: manifest.source,
      frequency: manifest.frequency,
      priceAdjustment: manifest.priceAdjustment,
      dividendAdjustment: manifest.dividendAdjustment,
      expectedFileCount: manifest.files.length,
      expectedRecordCount: manifest.totalRecordCount,
      status: status.status,
      importedSymbols: status.imported.slice(),
      skippedSymbols: status.skipped.slice(),
      failures: status.failed.map((failure) => ({ ...failure })),
      startedAt: status.startedAt,
      installedAt: status.completedAt,
      managerVersion: HISTORICAL_DATASET_MANAGER_VERSION
    });
  }
}

export const historicalDatasetManager = new HistoricalDatasetManager();

export async function installPrivateHistoricalSeed(options = {}) {
  return historicalDatasetManager.installSeed(options);
}

export async function getPrivateHistoricalSeedStatus(options = {}) {
  return historicalDatasetManager.getStatus(options);
}

export async function validateHistoricalManifest(manifest) {
  if (!manifest || typeof manifest !== "object") {
    throw new Error("Historical dataset manifest must be an object.");
  }
  const requiredText = [
    "datasetId",
    "datasetVersion",
    "datasetSha256",
    "source",
    "frequency",
    "priceAdjustment",
    "dividendAdjustment"
  ];
  for (const field of requiredText) {
    if (typeof manifest[field] !== "string" || manifest[field].trim() === "") {
      throw new Error(`Historical dataset manifest field ${field} is required.`);
    }
  }
  if (manifest.source !== HISTORICAL_SOURCE) {
    throw new Error(`Historical source must be ${HISTORICAL_SOURCE}.`);
  }
  if (manifest.frequency !== HISTORICAL_FREQUENCY) {
    throw new Error(`Historical frequency must be ${HISTORICAL_FREQUENCY}.`);
  }
  if (manifest.priceAdjustment !== PRICE_ADJUSTMENT) {
    throw new Error(`Price adjustment must be ${PRICE_ADJUSTMENT}.`);
  }
  if (manifest.dividendAdjustment !== DIVIDEND_ADJUSTMENT) {
    throw new Error(`Dividend adjustment must be ${DIVIDEND_ADJUSTMENT}.`);
  }
  if (!SHA256_PATTERN.test(manifest.datasetSha256)) {
    throw new Error("Historical dataset SHA-256 must contain 64 lowercase hexadecimal characters.");
  }
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new Error("Historical dataset manifest requires at least one file.");
  }
  if (
    Number.isInteger(manifest.fileCount)
    && manifest.fileCount !== manifest.files.length
  ) {
    throw new Error("Historical manifest fileCount does not match files.length.");
  }

  const seenSymbols = new Set();
  let totalRecordCount = 0;
  for (const file of manifest.files) {
    validateManifestFile(file, seenSymbols);
    totalRecordCount += file.recordCount;
  }
  if (manifest.totalRecordCount !== totalRecordCount) {
    throw new Error(
      `Historical manifest totalRecordCount mismatch: expected ${totalRecordCount}.`
    );
  }

  const actualDatasetHash = await computeDatasetManifestHash(manifest.files);
  if (actualDatasetHash !== manifest.datasetSha256) {
    throw new Error("Historical dataset manifest hash does not match its file hash list.");
  }
  return true;
}

export async function computeDatasetManifestHash(files) {
  const canonical = files
    .slice()
    .sort((left, right) => left.symbol.localeCompare(right.symbol))
    .map((file) => `${file.symbol}:${file.sha256}\n`)
    .join("");
  return sha256Hex(canonical);
}

export async function sha256Hex(value) {
  const cryptoObject = typeof globalThis !== "undefined" ? globalThis.crypto : null;
  if (!cryptoObject || !cryptoObject.subtle) {
    throw new Error("Web Crypto SHA-256 support is required for historical file verification.");
  }
  let buffer;
  if (typeof value === "string") {
    buffer = new TextEncoder().encode(value).buffer;
  } else if (value instanceof ArrayBuffer) {
    buffer = value;
  } else if (ArrayBuffer.isView(value)) {
    buffer = value.buffer.slice(
      value.byteOffset,
      value.byteOffset + value.byteLength
    );
  } else {
    throw new TypeError("SHA-256 input must be text, an ArrayBuffer, or a typed array.");
  }
  const digest = await cryptoObject.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function validateManifestFile(file, seenSymbols) {
  if (!file || typeof file !== "object") {
    throw new Error("Historical manifest file entries must be objects.");
  }
  const symbol = typeof file.symbol === "string"
    ? file.symbol.trim().toUpperCase()
    : "";
  if (!symbol) {
    throw new Error("Historical manifest file symbol is required.");
  }
  if (seenSymbols.has(symbol)) {
    throw new Error(`Historical manifest contains duplicate symbol ${symbol}.`);
  }
  seenSymbols.add(symbol);
  if (typeof file.path !== "string" || file.path.trim() === "") {
    throw new Error(`Historical manifest path is required for ${symbol}.`);
  }
  if (!SHA256_PATTERN.test(file.sha256)) {
    throw new Error(`Historical file SHA-256 is invalid for ${symbol}.`);
  }
  if (!Number.isInteger(file.recordCount) || file.recordCount <= 0) {
    throw new Error(`Historical recordCount is invalid for ${symbol}.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(file.firstDate)) {
    throw new Error(`Historical firstDate is invalid for ${symbol}.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(file.lastDate)) {
    throw new Error(`Historical lastDate is invalid for ${symbol}.`);
  }
  if (file.firstDate > file.lastDate) {
    throw new Error(`Historical date range is reversed for ${symbol}.`);
  }
}

function validateNormalizedFile(normalized, manifest, file) {
  const provenance = normalized.provenance || {};
  if (provenance.symbol !== file.symbol) {
    throw new Error(
      `${file.symbol} source file normalized to unexpected symbol ${provenance.symbol}.`
    );
  }
  if (provenance.sourceTicker !== file.sourceTicker) {
    throw new Error(`${file.symbol} source ticker does not match the manifest.`);
  }
  if (normalized.records.length !== file.recordCount) {
    throw new Error(
      `${file.symbol} record count mismatch: expected ${file.recordCount}, received ${normalized.records.length}.`
    );
  }
  if (provenance.firstDate !== file.firstDate || provenance.lastDate !== file.lastDate) {
    throw new Error(`${file.symbol} date range does not match the manifest.`);
  }
  if (
    provenance.source !== manifest.source
    || provenance.frequency !== manifest.frequency
    || provenance.priceAdjustment !== manifest.priceAdjustment
    || provenance.dividendAdjustment !== manifest.dividendAdjustment
  ) {
    throw new Error(`${file.symbol} source or adjustment metadata does not match the manifest.`);
  }
}

function buildSymbolMetadata(manifest, file, normalized, importedAt, startedAt) {
  return {
    datasetId: manifest.datasetId,
    datasetVersion: manifest.datasetVersion,
    datasetSha256: manifest.datasetSha256,
    source: manifest.source,
    sourceFormat: manifest.sourceFormat,
    sourceTicker: file.sourceTicker,
    sourceFilePath: file.path,
    sourceFileHash: file.sha256,
    sourceFileByteLength: file.byteLength,
    frequency: manifest.frequency,
    priceAdjustment: manifest.priceAdjustment,
    dividendAdjustment: manifest.dividendAdjustment,
    volumeSemantics: manifest.volumeSemantics,
    recordCount: file.recordCount,
    firstDate: file.firstDate,
    lastDate: file.lastDate,
    warningCount: normalized.warnings.length,
    warnings: normalized.warnings.map((warning) => ({ ...warning })),
    provenance: { ...normalized.provenance },
    importMode: "private-seed-full-series-replacement",
    importStartedAt: startedAt,
    importedAt,
    managerVersion: HISTORICAL_DATASET_MANAGER_VERSION
  };
}

function isFileCurrent(stored, manifest, file) {
  return Boolean(
    stored
    && stored.status === "current"
    && stored.datasetId === manifest.datasetId
    && stored.datasetVersion === manifest.datasetVersion
    && stored.datasetSha256 === manifest.datasetSha256
    && stored.sourceFileHash === file.sha256
    && stored.source === manifest.source
    && stored.frequency === manifest.frequency
    && stored.priceAdjustment === manifest.priceAdjustment
    && stored.dividendAdjustment === manifest.dividendAdjustment
    && stored.recordCount === file.recordCount
    && stored.firstDate === file.firstDate
    && stored.lastDate === file.lastDate
  );
}

async function fetchArrayBuffer(fetchImpl, url, signal) {
  const response = await fetchImpl(url, { cache: "no-cache", signal });
  if (!response || !response.ok) {
    const status = response ? response.status : "unavailable";
    throw new Error(`Historical source file request failed (${status}).`);
  }
  return response.arrayBuffer();
}

function decodeUtf8(buffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch (error) {
    throw new Error("Historical source file is not valid UTF-8 text.");
  }
}

function defaultFetch() {
  if (typeof globalThis === "undefined" || typeof globalThis.fetch !== "function") {
    throw new Error("Fetch support is required for historical seed installation.");
  }
  return globalThis.fetch.bind(globalThis);
}

function emitFileProgress(callback, fileIndex, fileCount, phase, symbol, detail = {}) {
  const phaseFraction = Number.isFinite(detail.phaseFraction)
    ? detail.phaseFraction
    : (PROGRESS_PHASE_FRACTIONS[phase] || 0);
  const percent = Math.max(
    0,
    Math.min(100, Math.round(((fileIndex + phaseFraction) / fileCount) * 100))
  );
  emitProgress(callback, {
    phase,
    symbol,
    fileIndex: fileIndex + 1,
    fileCount,
    percent,
    recordsCompleted: detail.recordsCompleted || 0,
    recordsTotal: detail.recordsTotal || 0,
    message: detail.message || `${phase} ${symbol}`
  });
}

function emitProgress(callback, detail) {
  if (!callback) {
    return;
  }
  try {
    callback({ ...detail });
  } catch (error) {
    // UI progress callbacks cannot interrupt installation.
  }
}

function throwIfAborted(signal) {
  if (signal && signal.aborted) {
    throw new DOMException("Historical dataset installation was aborted.", "AbortError");
  }
}

function yieldToBrowser() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export { IndexedDbPersistence };
