import { normalizeDateOnly, resolveReferenceDate } from "../utils/date-utils.js";
import { toFiniteNumber } from "../utils/number-utils.js";

export const LOT_MODEL_VERSION = "2.2-phase-3a";
export const TICKER_PATTERN = /^[A-Z][A-Z0-9.-]{0,14}$/;

export class LotModelError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "LotModelError";
    this.code = code;
    this.details = details && typeof details === "object" ? { ...details } : {};
  }
}

export function normalizeTicker(value, name = "ticker") {
  if (typeof value !== "string" || !value.trim()) {
    throw new LotModelError("LOT_TICKER_REQUIRED", `${name} is required.`);
  }
  const ticker = value.trim().toUpperCase();
  if (!TICKER_PATTERN.test(ticker)) {
    throw new LotModelError(
      "LOT_TICKER_INVALID",
      `${name} must start with a letter and contain only letters, numbers, periods, or hyphens.`,
      { value }
    );
  }
  return ticker;
}

export function createLot(input, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new LotModelError("LOT_OBJECT_REQUIRED", "Lot input must be an object.");
  }

  const ticker = normalizeTicker(input.ticker);
  const shares = normalizePositiveNumber(input.shares, "shares", "LOT_SHARES_INVALID");
  const purchasePricePerShare = normalizePositiveNumber(
    input.purchasePricePerShare !== undefined ? input.purchasePricePerShare : input.purchasePrice,
    "purchasePricePerShare",
    "LOT_PURCHASE_PRICE_INVALID"
  );
  const acquisitionDate = normalizeRequiredDate(input.acquisitionDate);
  const referenceDate = resolveReferenceDate(options.referenceDate, options.now);
  if (acquisitionDate > referenceDate) {
    throw new LotModelError(
      "LOT_ACQUISITION_DATE_FUTURE",
      "acquisitionDate must not be in the future.",
      { acquisitionDate, referenceDate }
    );
  }

  return Object.freeze({
    id: normalizeId(input.id, "lot", options.idFactory),
    recordType: "lot",
    ticker,
    shares,
    purchasePricePerShare,
    acquisitionDate,
    auditNote: normalizeAuditNote(input.auditNote),
    modelVersion: LOT_MODEL_VERSION
  });
}

export function cloneLot(lot) {
  if (!lot || typeof lot !== "object" || Array.isArray(lot)) {
    throw new LotModelError("LOT_OBJECT_REQUIRED", "Lot must be an object.");
  }
  return {
    id: lot.id,
    recordType: lot.recordType || "lot",
    ticker: lot.ticker,
    shares: lot.shares,
    purchasePricePerShare: lot.purchasePricePerShare,
    acquisitionDate: lot.acquisitionDate,
    auditNote: lot.auditNote || "",
    modelVersion: lot.modelVersion || LOT_MODEL_VERSION
  };
}

export function updateLot(existingLot, changes, options = {}) {
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    throw new LotModelError("LOT_CHANGES_REQUIRED", "Lot changes must be an object.");
  }
  const merged = {
    ...cloneLot(existingLot),
    ...changes,
    id: existingLot.id,
    ticker: changes.ticker === undefined ? existingLot.ticker : changes.ticker
  };
  return createLot(merged, options);
}

function normalizeRequiredDate(value) {
  if (value === undefined || value === null || value === "") {
    throw new LotModelError("LOT_ACQUISITION_DATE_REQUIRED", "acquisitionDate is required.");
  }
  try {
    return normalizeDateOnly(value, "acquisitionDate");
  } catch (error) {
    throw new LotModelError(
      "LOT_ACQUISITION_DATE_INVALID",
      error.message,
      { acquisitionDate: value }
    );
  }
}

function normalizePositiveNumber(value, name, code) {
  if (value === undefined || value === null || value === "") {
    throw new LotModelError(`${code}_REQUIRED`, `${name} is required.`);
  }
  try {
    return toFiniteNumber(value, { name, positive: true });
  } catch (error) {
    throw new LotModelError(code, error.message, { [name]: value });
  }
}

function normalizeAuditNote(value) {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value !== "string") {
    throw new LotModelError("LOT_AUDIT_NOTE_INVALID", "auditNote must be a string.");
  }
  return value.trim();
}

function normalizeId(value, prefix, idFactory) {
  if (value !== undefined && value !== null) {
    if (typeof value !== "string" || !value.trim()) {
      throw new LotModelError("LOT_ID_INVALID", "Lot id must be a nonempty string.");
    }
    return value.trim();
  }
  const factory = typeof idFactory === "function" ? idFactory : createDefaultId;
  const id = factory(prefix);
  if (typeof id !== "string" || !id.trim()) {
    throw new LotModelError("LOT_ID_FACTORY_INVALID", "idFactory must return a nonempty string.");
  }
  return id.trim();
}

function createDefaultId(prefix) {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  const random = Math.random().toString(36).slice(2, 11);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}
