import {
  MAIN_TO_WORKER,
  createCancelledMessage,
  createErrorMessage,
  createProgressMessage,
  createResultMessage,
  validateMainToWorkerMessage
} from "./worker-protocol.js";

// Phase 7A is intentionally a worker/protocol probe. No projection model or
// return calculation belongs here until the later method-specific phases.
const activeRuns = new Map();

self.onmessage = (event) => {
  const checked = validateMainToWorkerMessage(event.data);
  if (!checked.valid) {
    const runId = typeof event.data?.runId === "string" ? event.data.runId : "invalid";
    self.postMessage(createErrorMessage(runId, checked.code, checked.message));
    return;
  }

  const message = checked.value;
  if (message.type === MAIN_TO_WORKER.CANCEL) {
    const run = activeRuns.get(message.runId);
    if (run) run.cancelled = true;
    return;
  }
  startInfrastructureRun(message);
};

function startInfrastructureRun(message) {
  const run = { cancelled: false, inputs: message.inputs };
  activeRuns.set(message.runId, run);
  self.postMessage(createProgressMessage(message.runId, 0, message.inputs.pathCount));
  queueMicrotask(() => advanceInfrastructureRun(message.runId, run, 1));
}

function advanceInfrastructureRun(runId, run, stage) {
  if (activeRuns.get(runId) !== run) return;
  if (run.cancelled) {
    activeRuns.delete(runId);
    self.postMessage(createCancelledMessage(runId));
    return;
  }
  const completedPaths = Math.min(run.inputs.pathCount, Math.floor(run.inputs.pathCount * stage / 3));
  self.postMessage(createProgressMessage(runId, completedPaths, run.inputs.pathCount));
  if (stage < 3) {
    setTimeout(() => advanceInfrastructureRun(runId, run, stage + 1), 0);
    return;
  }
  activeRuns.delete(runId);
  self.postMessage(createResultMessage(runId, {
    kind: "infrastructure-ready",
    pathCount: run.inputs.pathCount,
    horizonYears: run.inputs.horizonYears,
    seed: run.inputs.seed
  }));
}
