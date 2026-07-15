import {
  MAIN_TO_WORKER,
  createCancelledMessage,
  createErrorMessage,
  createProgressMessage,
  createResultMessage,
  validateMainToWorkerMessage
} from "./worker-protocol.js";
import { finalizeBootstrapRun, prepareBootstrapRun, simulateBootstrapPath } from "../monte-carlo/bootstrap.js";

const activeRuns = new Map();
const PATHS_PER_TURN = 4;

self.onmessage = (event) => {
  const checked = validateMainToWorkerMessage(event.data);
  if (!checked.valid) {
    self.postMessage(createErrorMessage(typeof event.data?.runId === "string" ? event.data.runId : "invalid", checked.code, checked.message));
    return;
  }
  if (checked.value.type === MAIN_TO_WORKER.CANCEL) {
    const run = activeRuns.get(checked.value.runId);
    if (run) run.cancelled = true;
    return;
  }
  startBootstrapRun(checked.value, checked.value.alignedHistory);
};

function startBootstrapRun(message, alignedHistory) {
  try {
    const run = { cancelled: false, simulation: prepareBootstrapRun(message.inputs, alignedHistory) };
    activeRuns.set(message.runId, run);
    self.postMessage(createProgressMessage(message.runId, 0, message.inputs.pathCount));
    queueMicrotask(() => advanceBootstrapRun(message.runId, run));
  } catch (error) {
    self.postMessage(createErrorMessage(message.runId, safeCode(error), safeMessage(error)));
  }
}

function advanceBootstrapRun(runId, run) {
  if (activeRuns.get(runId) !== run) return;
  if (run.cancelled) {
    activeRuns.delete(runId);
    self.postMessage(createCancelledMessage(runId));
    return;
  }
  try {
    const simulation = run.simulation;
    const end = Math.min(simulation.inputs.pathCount, simulation.completedPaths + PATHS_PER_TURN);
    while (simulation.completedPaths < end) simulateBootstrapPath(simulation, simulation.completedPaths);
    self.postMessage(createProgressMessage(runId, simulation.completedPaths, simulation.inputs.pathCount));
    if (simulation.completedPaths < simulation.inputs.pathCount) {
      setTimeout(() => advanceBootstrapRun(runId, run), 0);
      return;
    }
    activeRuns.delete(runId);
    self.postMessage(createResultMessage(runId, finalizeBootstrapRun(simulation)));
  } catch (error) {
    activeRuns.delete(runId);
    self.postMessage(createErrorMessage(runId, safeCode(error), safeMessage(error)));
  }
}

function safeCode(error) { return typeof error?.code === "string" && error.code.length <= 500 ? error.code : "BOOTSTRAP_SIMULATION_FAILED"; }
function safeMessage(error) { return typeof error?.message === "string" && error.message.trim() && error.message.length <= 500 ? error.message : "Historical Bootstrap simulation could not be completed."; }
