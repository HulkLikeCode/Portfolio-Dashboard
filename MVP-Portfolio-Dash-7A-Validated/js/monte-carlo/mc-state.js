export const MONTE_CARLO_STATES = Object.freeze({
  IDLE: "idle",
  UNAVAILABLE: "unavailable",
  VALIDATING: "validating",
  QUEUED: "queued",
  RUNNING: "running",
  CANCELLING: "cancelling",
  CANCELLED: "cancelled",
  COMPLETED: "completed",
  FAILED: "failed",
  STALE: "stale"
});

const TRANSITIONS = Object.freeze({
  [MONTE_CARLO_STATES.IDLE]: ["unavailable", "validating"],
  [MONTE_CARLO_STATES.UNAVAILABLE]: ["validating", "idle"],
  [MONTE_CARLO_STATES.VALIDATING]: ["queued", "failed", "unavailable", "idle"],
  [MONTE_CARLO_STATES.QUEUED]: ["running", "cancelling", "cancelled", "completed", "failed", "stale"],
  [MONTE_CARLO_STATES.RUNNING]: ["cancelling", "cancelled", "completed", "failed", "stale"],
  [MONTE_CARLO_STATES.CANCELLING]: ["cancelled", "failed", "stale"],
  [MONTE_CARLO_STATES.CANCELLED]: ["validating", "idle"],
  [MONTE_CARLO_STATES.COMPLETED]: ["validating", "stale", "idle"],
  [MONTE_CARLO_STATES.FAILED]: ["validating", "idle"],
  [MONTE_CARLO_STATES.STALE]: ["validating", "idle", "cancelled"]
});

export function createMonteCarloState(overrides = {}) {
  return Object.freeze({
    status: MONTE_CARLO_STATES.IDLE,
    runId: null,
    progress: 0,
    elapsedMs: 0,
    inputFingerprint: null,
    result: null,
    error: null,
    stale: false,
    reason: null,
    ...overrides
  });
}

export function canTransitionMonteCarloState(from, to) {
  return Boolean(TRANSITIONS[from] && TRANSITIONS[from].includes(to));
}

export function transitionMonteCarloState(current, nextStatus, patch = {}) {
  const previous = current || createMonteCarloState();
  if (previous.status !== nextStatus && !canTransitionMonteCarloState(previous.status, nextStatus)) {
    const error = new Error(`Illegal Monte Carlo state transition: ${previous.status} -> ${nextStatus}.`);
    error.code = "MONTE_CARLO_ILLEGAL_STATE_TRANSITION";
    throw error;
  }
  return createMonteCarloState({
    ...previous,
    ...patch,
    status: nextStatus,
    stale: nextStatus === MONTE_CARLO_STATES.STALE || Boolean(patch.stale)
  });
}

export function isActiveMonteCarloState(status) {
  return status === MONTE_CARLO_STATES.VALIDATING
    || status === MONTE_CARLO_STATES.QUEUED
    || status === MONTE_CARLO_STATES.RUNNING
    || status === MONTE_CARLO_STATES.CANCELLING;
}
