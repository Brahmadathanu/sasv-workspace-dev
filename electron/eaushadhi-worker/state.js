/* eslint-env node */

const STATES = Object.freeze({
  IDLE: "IDLE",
  STARTING: "STARTING",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  READY: "READY",
  RUNNING: "RUNNING",
  STOPPING: "STOPPING",
  FAILED: "FAILED",
});

const ALLOWED = Object.freeze({
  IDLE: new Set([STATES.STARTING, STATES.RUNNING, STATES.FAILED]),
  STARTING: new Set([
    STATES.AUTH_REQUIRED,
    STATES.READY,
    STATES.STOPPING,
    STATES.FAILED,
  ]),
  AUTH_REQUIRED: new Set([
    STATES.READY,
    STATES.RUNNING,
    STATES.STOPPING,
    STATES.FAILED,
  ]),
  READY: new Set([STATES.RUNNING, STATES.STOPPING, STATES.FAILED]),
  RUNNING: new Set([
    STATES.AUTH_REQUIRED,
    STATES.READY,
    STATES.STOPPING,
    STATES.IDLE,
    STATES.FAILED,
  ]),
  STOPPING: new Set([STATES.IDLE, STATES.FAILED]),
  FAILED: new Set([STATES.IDLE, STATES.STARTING]),
});

function createWorkerState(initial = STATES.IDLE) {
  let current = initial;
  return {
    get() {
      return current;
    },
    canTransition(next) {
      return ALLOWED[current]?.has(next) === true;
    },
    transition(next) {
      if (!ALLOWED[current]?.has(next)) {
        throw new Error(`Illegal worker state transition ${current} -> ${next}`);
      }
      current = next;
      return current;
    },
    reset() {
      current = STATES.IDLE;
      return current;
    },
  };
}

function statusLabel(state) {
  switch (state) {
    case STATES.IDLE:
      return "Disconnected";
    case STATES.STARTING:
      return "Starting";
    case STATES.AUTH_REQUIRED:
      return "Login required";
    case STATES.READY:
      return "Ready";
    case STATES.RUNNING:
      return "Running";
    case STATES.STOPPING:
      return "Stopping";
    case STATES.FAILED:
      return "Failed";
    default:
      return "Disconnected";
  }
}

module.exports = {
  STATES,
  createWorkerState,
  statusLabel,
};
