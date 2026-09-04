import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { STATES, createWorkerState } = require(join(root, "electron/eaushadhi-worker/state.js"));

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("OK", msg);
  }
}

const machine = createWorkerState();
assert(machine.get() === STATES.IDLE, "starts IDLE");
machine.transition(STATES.STARTING);
assert(machine.get() === STATES.STARTING, "IDLE -> STARTING");
machine.transition(STATES.AUTH_REQUIRED);
assert(machine.get() === STATES.AUTH_REQUIRED, "STARTING -> AUTH_REQUIRED");
machine.transition(STATES.RUNNING);
assert(machine.get() === STATES.RUNNING, "AUTH_REQUIRED -> RUNNING");
machine.transition(STATES.AUTH_REQUIRED);
machine.transition(STATES.STOPPING);
machine.transition(STATES.IDLE);
assert(machine.get() === STATES.IDLE, "STOPPING -> IDLE");

let illegal = false;
try {
  machine.transition(STATES.READY);
} catch {
  illegal = true;
}
assert(illegal, "IDLE cannot jump to READY");

if (failed) {
  console.error(`\n${failed} state assertion(s) failed`);
  process.exit(1);
}
console.log("\neaushadhi-worker-state-smoke: all assertions passed");
