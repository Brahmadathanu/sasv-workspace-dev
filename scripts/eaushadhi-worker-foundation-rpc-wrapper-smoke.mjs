import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { loadFoundationSnapshot } = require(
  join(root, "electron/eaushadhi-worker/foundation-check.js"),
);
const { ERROR_KINDS } = require(join(root, "electron/eaushadhi-worker/errors.js"));

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("OK", msg);
  }
}

const eligiblePreflight = {
  eligible: true,
  reasons: [],
  entry_status: "NOT_STARTED",
  is_ready_for_entry: true,
  workflow_row_version: 4,
};
const ineligiblePreflight = {
  eligible: false,
  reasons: ["Product is not ready for portal entry"],
  entry_status: "NOT_STARTED",
  is_ready_for_entry: false,
  workflow_row_version: 4,
};
const payload = {
  payload_hash: "abc123",
  entry_status: "NOT_STARTED",
};

async function run(preflightImpl, payloadImpl) {
  return loadFoundationSnapshot({
    productId: 41,
    callRpc: async (name, args) => {
      if (name === "rpc_eaushadhi_worker_preflight") return preflightImpl(args);
      if (name === "rpc_eaushadhi_worker_payload_get") return payloadImpl(args);
      throw new Error(`unexpected rpc ${name}`);
    },
  });
}

const eligible = await run(
  () => eligiblePreflight,
  (args) => {
    assert(args.p_expected_workflow_row_version === 4, "payload uses server workflow version");
    return payload;
  },
);
assert(eligible.errorKind === ERROR_KINDS.CONTRACT_INCOMPLETE, "eligible product still CONTRACT_INCOMPLETE");
assert(eligible.mutated === false, "eligible path does not mutate");
assert(eligible.entryStatusChanged === false, "entry status not changed");
assert(eligible.entryStatus === "NOT_STARTED", "entry status remains NOT_STARTED");

const ineligible = await run(
  () => ineligiblePreflight,
  () => payload,
);
assert(ineligible.errorKind === ERROR_KINDS.CONTRACT_INCOMPLETE, "ineligible still reports contract stop first");
assert(ineligible.preflight.eligible === false, "ineligible reasons retained");

let staleKind = null;
try {
  await run(
    () => eligiblePreflight,
    () => {
      const error = new Error("Stale workflow row version");
      error.code = "40001";
      throw error;
    },
  );
} catch (error) {
  staleKind = error.code;
}
assert(staleKind === "40001", "stale version bubbles from payload_get");

let permKind = null;
try {
  await run(
    () => {
      const error = new Error("e-Aushadhi Automation permission is required");
      error.code = "42501";
      throw error;
    },
    () => payload,
  );
} catch (error) {
  permKind = error.code;
}
assert(permKind === "42501", "permission error bubbles from preflight");

const workerSrc = [
  "index.js",
  "ipc.js",
  "browser.js",
  "foundation-check.js",
].map((name) => readFileSync(join(root, "electron/eaushadhi-worker", name), "utf8")).join("\n");
assert(!/rpc_eaushadhi_worker_run_begin/.test(workerSrc), "foundation does not call run_begin");
assert(!/mark_entered|mark_portal_verified|click\('Save|Submit/.test(workerSrc), "no mutating portal/runtime transitions");

if (failed) {
  console.error(`\n${failed} foundation wrapper assertion(s) failed`);
  process.exit(1);
}
console.log("\neaushadhi-worker-foundation-rpc-wrapper-smoke: all assertions passed");
