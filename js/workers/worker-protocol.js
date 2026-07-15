import {
  MAX_HORIZON_YEARS,
  MIN_HORIZON_YEARS,
  SUPPORTED_PATH_COUNTS,
  validateMonteCarloInputs
} from "../monte-carlo/mc-inputs.js";

export const MONTE_CARLO_PROTOCOL_VERSION = "mc-worker-v1";
export const MAIN_TO_WORKER = Object.freeze({ START: "mc:start", CANCEL: "mc:cancel" });
export const WORKER_TO_MAIN = Object.freeze({
  PROGRESS: "mc:progress",
  RESULT: "mc:result",
  CANCELLED: "mc:cancelled",
  ERROR: "mc:error"
});

export function createStartMessage(runId, inputs, alignedHistory) {
  return { protocol: MONTE_CARLO_PROTOCOL_VERSION, type: MAIN_TO_WORKER.START, runId, inputs, alignedHistory };
}

export function createCancelMessage(runId) {
  return { protocol: MONTE_CARLO_PROTOCOL_VERSION, type: MAIN_TO_WORKER.CANCEL, runId };
}

export function createProgressMessage(runId, completedPaths, totalPaths) {
  return { protocol: MONTE_CARLO_PROTOCOL_VERSION, type: WORKER_TO_MAIN.PROGRESS, runId, completedPaths, totalPaths };
}

export function createResultMessage(runId, result) {
  return { protocol: MONTE_CARLO_PROTOCOL_VERSION, type: WORKER_TO_MAIN.RESULT, runId, result };
}

export function createCancelledMessage(runId) {
  return { protocol: MONTE_CARLO_PROTOCOL_VERSION, type: WORKER_TO_MAIN.CANCELLED, runId };
}

export function createErrorMessage(runId, code, message) {
  return {
    protocol: MONTE_CARLO_PROTOCOL_VERSION,
    type: WORKER_TO_MAIN.ERROR,
    runId: isRunId(runId) ? runId : "invalid",
    code: safeText(code) ? code : "WORKER_PROTOCOL_ERROR",
    message: safeText(message) ? message : "Worker protocol validation failed."
  };
}

export function validateMainToWorkerMessage(message) {
  const common = validateEnvelope(message, Object.values(MAIN_TO_WORKER));
  if (!common.valid) return common;
  if (message.type === MAIN_TO_WORKER.CANCEL) return valid(message);
  const inputs = validateMonteCarloInputs(message.inputs);
  if (!inputs.valid) return invalid("INVALID_START_INPUTS", "Start message inputs are invalid.", inputs.errors);
  return valid({ ...message, inputs: inputs.value });
}

export function validateWorkerToMainMessage(message) {
  const common = validateEnvelope(message, Object.values(WORKER_TO_MAIN));
  if (!common.valid) return common;
  switch (message.type) {
    case WORKER_TO_MAIN.PROGRESS:
      if (!Number.isInteger(message.completedPaths) || !Number.isInteger(message.totalPaths)
          || message.totalPaths < 1 || message.completedPaths < 0 || message.completedPaths > message.totalPaths) {
        return invalid("INVALID_PROGRESS", "Progress counts must be whole numbers within the requested total.");
      }
      return valid(message);
    case WORKER_TO_MAIN.RESULT:
      if (!isInfrastructureResult(message.result)) {
        return invalid("INVALID_RESULT", "Result messages require the typed Phase 7A infrastructure result.");
      }
      return valid(message);
    case WORKER_TO_MAIN.CANCELLED:
      return valid(message);
    case WORKER_TO_MAIN.ERROR:
      if (!safeText(message.code) || !safeText(message.message)) {
        return invalid("INVALID_ERROR", "Error messages require safe code and message text.");
      }
      return valid(message);
    default:
      return invalid("UNKNOWN_MESSAGE_TYPE", "Unknown worker message type.");
  }
}

export function assertValidProtocolMessage(message, direction) {
  const result = direction === "to-worker"
    ? validateMainToWorkerMessage(message)
    : validateWorkerToMainMessage(message);
  if (!result.valid) {
    const error = new TypeError(result.message);
    error.code = result.code;
    error.issues = result.issues || [];
    throw error;
  }
  return result.value;
}

function validateEnvelope(message, types) {
  if (!isPlainObject(message)) return invalid("INVALID_MESSAGE", "Worker messages must be plain objects.");
  if (message.protocol !== MONTE_CARLO_PROTOCOL_VERSION) return invalid("INVALID_PROTOCOL", "Unsupported worker protocol version.");
  if (!types.includes(message.type)) return invalid("INVALID_MESSAGE_TYPE", "Message type is invalid for this direction.");
  if (!isRunId(message.runId)) return invalid("INVALID_RUN_ID", "runId must be a safe non-empty identifier.");
  return valid(message);
}

function valid(value) { return { valid: true, value }; }
function invalid(code, message, issues = []) { return { valid: false, code, message, issues }; }
function isPlainObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function isRunId(value) { return typeof value === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(value); }
function safeText(value) { return typeof value === "string" && value.trim().length > 0 && value.length <= 500; }
function isInfrastructureResult(value) {
  return isPlainObject(value)
    && value.kind === "infrastructure-ready"
    && SUPPORTED_PATH_COUNTS.includes(value.pathCount)
    && Number.isInteger(value.horizonYears)
    && value.horizonYears >= MIN_HORIZON_YEARS
    && value.horizonYears <= MAX_HORIZON_YEARS
    && Number.isInteger(value.seed)
    && value.seed >= 0
    && value.seed <= 0xffffffff;
}
