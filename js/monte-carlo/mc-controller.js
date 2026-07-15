import {
  fingerprintMonteCarloInputs,
  validateMonteCarloInputs
} from "./mc-inputs.js";
import {
  MONTE_CARLO_STATES,
  createMonteCarloState,
  isActiveMonteCarloState,
  transitionMonteCarloState
} from "./mc-state.js";
import {
  WORKER_TO_MAIN,
  createCancelMessage,
  createStartMessage,
  validateWorkerToMainMessage
} from "../workers/worker-protocol.js";

export const MONTE_CARLO_CONTROLLER_VERSION = "2.3-phase-7a";

/**
 * Main-thread coordinator for the worker boundary. It owns run identity and
 * stale-result rejection; the worker never receives application state directly.
 */
export class MonteCarloController {
  constructor(options = {}) {
    this.WorkerCtor = options.WorkerCtor === undefined ? globalThis.Worker : options.WorkerCtor;
    this.workerUrl = options.workerUrl || new URL("../workers/monte-carlo-worker.js", import.meta.url);
    this.workerFactory = typeof options.workerFactory === "function"
      ? options.workerFactory
      : null;
    this.now = typeof options.now === "function" ? options.now : () => Date.now();
    this.diagnostics = normalizeDiagnostics(options.diagnostics);
    this.cancelTimeoutMs = Number.isFinite(options.cancelTimeoutMs) ? Math.max(0, options.cancelTimeoutMs) : 250;
    this.sequence = 0;
    this.worker = null;
    this.currentRun = null;
    this.listeners = new Set();
    this.cancelTimer = null;
    this.disposed = false;
    this.state = createMonteCarloState({
      status: this.isWorkerSupported() ? MONTE_CARLO_STATES.IDLE : MONTE_CARLO_STATES.UNAVAILABLE,
      reason: this.isWorkerSupported() ? null : "web-worker-unavailable"
    });
  }

  isWorkerSupported() {
    return Boolean(this.workerFactory || typeof this.WorkerCtor === "function");
  }

  getState() {
    return this.state;
  }

  subscribe(listener) {
    if (typeof listener !== "function") throw new TypeError("Monte Carlo state listener must be a function.");
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(rawInputs) {
    if (this.disposed) {
      return {
        accepted: false,
        state: this.state,
        errors: [{ code: "MONTE_CARLO_CONTROLLER_DISPOSED", message: "The simulation controller has been disposed." }]
      };
    }
    if (this.currentRun) this.supersedeCurrentRun("new-run-started");
    this.setState(MONTE_CARLO_STATES.VALIDATING, { result: null, error: null, progress: 0, elapsedMs: 0, reason: null });

    if (!this.isWorkerSupported()) {
      this.setState(MONTE_CARLO_STATES.UNAVAILABLE, { reason: "web-worker-unavailable" });
      this.record("unavailable", {});
      return { accepted: false, state: this.state, errors: [] };
    }

    const validation = validateMonteCarloInputs(rawInputs);
    if (!validation.valid) {
      this.setState(MONTE_CARLO_STATES.FAILED, {
        error: { code: "MONTE_CARLO_INPUT_INVALID", message: "Simulation inputs are invalid." },
        reason: "validation-failed"
      });
      this.record("validation-failed", { validationErrorCodes: validation.errors.map((entry) => entry.code) });
      return { accepted: false, state: this.state, errors: validation.errors };
    }

    const runId = `mc_${++this.sequence}`;
    const startedAt = this.now();
    const inputs = validation.value;
    this.currentRun = {
      runId,
      inputs,
      inputFingerprint: fingerprintMonteCarloInputs(inputs),
      startedAt,
      stale: false
    };
    this.setState(MONTE_CARLO_STATES.QUEUED, {
      runId,
      inputFingerprint: this.currentRun.inputFingerprint,
      startedAt,
      progress: 0,
      elapsedMs: 0,
      result: null,
      error: null,
      stale: false
    });

    try {
      this.createWorker();
      this.worker.postMessage(createStartMessage(runId, inputs));
      this.record("started", runMetadata(this.currentRun, 0));
      return { accepted: true, runId, state: this.state, errors: [] };
    } catch (error) {
      this.failRun(this.currentRun, "WORKER_START_FAILED", "The simulation worker could not be started.", error);
      return { accepted: false, state: this.state, errors: [this.state.error] };
    }
  }

  cancel() {
    const run = this.currentRun;
    if (!run || !isActiveMonteCarloState(this.state.status)) return false;
    this.setState(MONTE_CARLO_STATES.CANCELLING, { elapsedMs: this.elapsedFor(run), reason: "cancel-requested" });
    this.record("cancelling", runMetadata(run, this.elapsedFor(run)));
    try {
      this.worker?.postMessage(createCancelMessage(run.runId));
    } catch (_error) {
      // The timeout below safely finalizes cancellation even if the worker died.
    }
    this.clearCancelTimer();
    this.cancelTimer = setTimeout(() => {
      if (this.currentRun === run && this.state.status === MONTE_CARLO_STATES.CANCELLING) {
        this.finishCancelled(run, "cancel-timeout");
      }
    }, this.cancelTimeoutMs);
    return true;
  }

  /** Marks the current run stale when a relevant input snapshot differs. */
  markInputsChanged(rawInputs) {
    const run = this.currentRun;
    if (!run || !isActiveMonteCarloState(this.state.status)) return false;
    const nextFingerprint = fingerprintMonteCarloInputs(rawInputs, {
      randomSeedOverride: run.inputs.seed
    });
    if (nextFingerprint !== null && nextFingerprint === run.inputFingerprint) return false;
    run.stale = true;
    this.setState(MONTE_CARLO_STATES.STALE, {
      elapsedMs: this.elapsedFor(run),
      stale: true,
      reason: "inputs-changed"
    });
    this.record("stale", runMetadata(run, this.elapsedFor(run)));
    try { this.worker?.postMessage(createCancelMessage(run.runId)); } catch (_error) { /* timeout releases the worker */ }
    this.clearCancelTimer();
    this.cancelTimer = setTimeout(() => {
      if (this.currentRun === run && run.stale) this.settleStaleRun(run, "stale-cancel-timeout");
    }, this.cancelTimeoutMs);
    return true;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const run = this.currentRun;
    this.clearCancelTimer();
    this.currentRun = null;
    this.destroyWorker();
    if (run && (isActiveMonteCarloState(this.state.status) || this.state.status === MONTE_CARLO_STATES.STALE)) {
      this.setState(MONTE_CARLO_STATES.CANCELLED, {
        elapsedMs: this.elapsedFor(run),
        reason: "disposed",
        result: null,
        stale: false
      });
      this.record("cancelled", runMetadata(run, this.state.elapsedMs));
    } else if (isActiveMonteCarloState(this.state.status)) {
      const status = this.state.status === MONTE_CARLO_STATES.CANCELLING
        ? MONTE_CARLO_STATES.CANCELLED
        : MONTE_CARLO_STATES.IDLE;
      this.setState(status, { reason: "disposed", result: null, stale: false });
    }
    this.listeners.clear();
  }

  createWorker() {
    this.destroyWorker();
    const worker = this.workerFactory
      ? this.workerFactory()
      : new this.WorkerCtor(this.workerUrl, { type: "module" });
    if (!worker || typeof worker.postMessage !== "function") throw new TypeError("Worker factory returned an invalid worker.");
    this.worker = worker;
    worker.onmessage = (event) => this.handleWorkerMessage(event);
    worker.onerror = (event) => this.handleWorkerFault(event);
    worker.onmessageerror = () => this.handleWorkerFault(new Error("Worker message could not be deserialized."));
  }

  handleWorkerMessage(event) {
    const checked = validateWorkerToMainMessage(event && event.data);
    const run = this.currentRun;
    if (!checked.valid) {
      if (run && run.stale) this.settleStaleRun(run, "invalid-message");
      else if (run) this.failRun(run, checked.code, checked.message);
      return;
    }
    const message = checked.value;
    if (!run || message.runId !== run.runId) return; // Superseded worker messages are never current.
    if (run.stale) {
      if (message.type === WORKER_TO_MAIN.RESULT) this.record("stale-result-ignored", runMetadata(run, this.elapsedFor(run)));
      if (message.type !== WORKER_TO_MAIN.PROGRESS) this.settleStaleRun(run, "worker-settled-stale-run");
      return;
    }

    switch (message.type) {
      case WORKER_TO_MAIN.PROGRESS:
        if (this.state.status !== MONTE_CARLO_STATES.RUNNING && this.state.status !== MONTE_CARLO_STATES.QUEUED) return;
        if (message.totalPaths !== run.inputs.pathCount) {
          this.failRun(run, "PROGRESS_PATH_COUNT_MISMATCH", "Worker progress did not preserve the selected path count.");
          return;
        }
        this.setState(MONTE_CARLO_STATES.RUNNING, {
          progress: message.completedPaths / message.totalPaths,
          elapsedMs: this.elapsedFor(run)
        });
        return;
      case WORKER_TO_MAIN.RESULT:
        if (this.state.status === MONTE_CARLO_STATES.CANCELLING) return this.finishCancelled(run, "result-after-cancel");
        if (message.result.pathCount !== run.inputs.pathCount) {
          this.failRun(run, "RESULT_PATH_COUNT_MISMATCH", "Worker result did not preserve the selected path count.");
          return;
        }
        this.completeRun(run, message.result);
        return;
      case WORKER_TO_MAIN.CANCELLED:
        this.finishCancelled(run, "worker-cancelled");
        return;
      case WORKER_TO_MAIN.ERROR:
        this.failRun(run, message.code, message.message);
        return;
      default:
        return;
    }
  }

  handleWorkerFault(error) {
    const run = this.currentRun;
    if (!run) return;
    if (run.stale) {
      this.settleStaleRun(run, "worker-fault-stale-run");
      return;
    }
    if (this.state.status === MONTE_CARLO_STATES.CANCELLING) return;
    this.failRun(run, "WORKER_RUNTIME_ERROR", "The simulation worker failed.", error);
  }

  completeRun(run, result) {
    if (this.currentRun !== run || run.stale) return;
    this.clearCancelTimer();
    this.setState(MONTE_CARLO_STATES.COMPLETED, {
      progress: 1,
      elapsedMs: this.elapsedFor(run),
      result,
      reason: null
    });
    const stabilization = result?.diagnostics?.covarianceStabilization;
    if (stabilization?.applied) {
      this.record("covariance-stabilized", {
        ...runMetadata(run, this.state.elapsedMs),
        method: stabilization.method,
        diagonalJitter: stabilization.diagonalJitter,
        attempts: stabilization.attempts,
        symbols: Array.isArray(result.symbols) ? result.symbols.slice() : run.inputs.includedSymbols.map(({ symbol }) => symbol)
      });
    }
    this.record("completed", runMetadata(run, this.state.elapsedMs));
    this.currentRun = null;
    this.destroyWorker();
  }

  finishCancelled(run, reason) {
    if (this.currentRun !== run) return;
    this.clearCancelTimer();
    this.setState(MONTE_CARLO_STATES.CANCELLED, {
      elapsedMs: this.elapsedFor(run),
      reason,
      result: null
    });
    this.record("cancelled", runMetadata(run, this.state.elapsedMs));
    this.currentRun = null;
    this.destroyWorker();
  }

  failRun(run, code, message, cause = null) {
    if (!run || this.currentRun !== run || run.stale) return;
    this.clearCancelTimer();
    this.setState(MONTE_CARLO_STATES.FAILED, {
      elapsedMs: this.elapsedFor(run),
      error: { code, message },
      reason: "worker-failed"
    });
    this.record("failed", { ...runMetadata(run, this.state.elapsedMs), code, cause: cause ? safeErrorName(cause) : null });
    this.currentRun = null;
    this.destroyWorker();
  }

  supersedeCurrentRun(reason) {
    const run = this.currentRun;
    if (!run) return;
    run.stale = true;
    this.clearCancelTimer();
    if (isActiveMonteCarloState(this.state.status)) {
      this.setState(MONTE_CARLO_STATES.STALE, { stale: true, elapsedMs: this.elapsedFor(run), reason });
    }
    this.record("stale", runMetadata(run, this.elapsedFor(run)));
    this.currentRun = null;
    this.destroyWorker();
  }

  settleStaleRun(run, reason) {
    if (this.currentRun !== run) return;
    this.clearCancelTimer();
    this.currentRun = null;
    this.destroyWorker();
    this.record("stale-settled", { ...runMetadata(run), reason });
  }

  elapsedFor(run) {
    return Math.max(0, this.now() - run.startedAt);
  }

  setState(status, patch = {}) {
    this.state = transitionMonteCarloState(this.state, status, patch);
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (error) {
        this.record("state-listener-failed", { cause: safeErrorName(error) });
      }
    }
  }

  destroyWorker() {
    if (!this.worker) return;
    this.worker.onmessage = null;
    this.worker.onerror = null;
    this.worker.onmessageerror = null;
    if (typeof this.worker.terminate === "function") this.worker.terminate();
    this.worker = null;
  }

  clearCancelTimer() {
    if (this.cancelTimer !== null) clearTimeout(this.cancelTimer);
    this.cancelTimer = null;
  }

  record(status, details) {
    const event = {
      category: "simulation",
      status,
      occurredAt: new Date(this.now()).toISOString(),
      details
    };
    try { void this.diagnostics?.record(event); } catch (_error) { /* diagnostics never interrupt a run */ }
  }
}

export function createMonteCarloController(options = {}) {
  return new MonteCarloController(options);
}

function normalizeDiagnostics(value) {
  if (!value) return null;
  if (typeof value === "function") return { record: value };
  return typeof value.record === "function" ? value : null;
}

function runMetadata(run, elapsedMs = null) {
  return {
    runId: run.runId,
    symbolCount: run.inputs.includedSymbols.length,
    pathCount: run.inputs.pathCount,
    horizonYears: run.inputs.horizonYears,
    lookbackReturns: run.inputs.lookbackReturns,
    seedMode: run.inputs.seedMode,
    seed: run.inputs.seed,
    elapsedMs
  };
}

function safeErrorName(error) {
  return error && typeof error.name === "string" ? error.name.slice(0, 80) : "Error";
}
