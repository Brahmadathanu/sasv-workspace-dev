/**
 * First-entry capture + dry-run scaffolding smokes.
 * No Edge. No portal writes. No mutating lifecycle RPC invocation.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { namesEqualExact, classifyLookupMatches } = require(
  join(root, "electron/eaushadhi-worker/lookup-equality.js"),
);
const { COMPARE_RESULT, compareGovernedSnapshot } = require(
  join(root, "electron/eaushadhi-worker/compare.js"),
);
const { runEntryDryRun, MUTATING_RPC_NAMES } = require(
  join(root, "electron/eaushadhi-worker/dry-run.js"),
);
const { ERROR_KINDS } = require(join(root, "electron/eaushadhi-worker/errors.js"));
const { FIRST_CONTROLLED_PRODUCT_ID } = require(
  join(root, "electron/eaushadhi-worker/product-lock.js"),
);
const { classifyActionCandidate } = require(join(root, "electron/eaushadhi-worker/capture/index.js"));
const { loadPortalContract, getContractCompleteness } = require(
  join(root, "electron/eaushadhi-worker/contracts/portal-contract.js"),
);

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("OK", msg);
  }
}

assert(FIRST_CONTROLLED_PRODUCT_ID === 262, "first controlled product is 262");
assert(namesEqualExact("Karpooradi Thailam", "KARPOORADI THAILAM"), "lookup equality is case-insensitive");
assert(namesEqualExact(" Karpooradi Thailam ", "Karpooradi Thailam"), "lookup equality trims whitespace");
assert(
  namesEqualExact("Karpooradi Thailam", "Karpooradi Thailam.") === false,
  "punctuation difference is not exact equality",
);
assert(
  namesEqualExact("Sandhirujah, Śōpham", "Sandhirujah, Sopham") === false,
  "diacritic difference is not exact equality",
);
assert(
  classifyLookupMatches([{ name: "Karpooradi Thailam" }], "Karpooradi Thailam").outcome === "EXACT_ONE",
  "exact existing product found",
);
assert(
  classifyLookupMatches([], "Karpooradi Thailam").outcome === "NONE",
  "no product found",
);
assert(
  classifyLookupMatches(
    [{ name: "Karpooradi Thailam" }, { name: "KARPOORADI THAILAM" }],
    "Karpooradi Thailam",
  ).outcome === "AMBIGUOUS",
  "ambiguous duplicate exact names stop",
);

const intended = {
  product: { portal_product_name: "Karpooradi Thailam" },
  details: {
    diseases_conditions: "Sandhirujah, Śōpham",
    composition_title: "For 10 mL",
    permission_purpose_label: "Purpose",
    combined_restricted_declaration: "NO",
  },
  actions: [{ label: "Musculoskeletal System (Bones &Joints)" }],
  composition: [{ source_composition_line_id: 1, ingredient_name: "Camphor", quantity_value: 1, unit_text: "g" }],
};
const matchPortal = {
  product: { portal_product_name: "KARPOORADI THAILAM" },
  details: intended.details,
  actions: [{ label: "Musculoskeletal System (Bones &Joints)" }],
  composition: intended.composition,
};
const matchReport = compareGovernedSnapshot(intended, matchPortal);
assert(matchReport.equal === true, "MATCH report is equal when fields match");
assert(
  matchReport.fields.every((item) => item.result === COMPARE_RESULT.MATCH),
  "all MATCH when portal snapshot matches",
);

const mismatch = structuredClone(matchPortal);
mismatch.details.diseases_conditions = "Sandhirujah, Sopham";
const mismatchReport = compareGovernedSnapshot(intended, mismatch);
assert(mismatchReport.equal === false, "MISMATCH blocks equal");
assert(
  mismatchReport.fields.some(
    (item) => item.path === "details.diseases_conditions" && item.result === COMPARE_RESULT.MISMATCH,
  ),
  "diacritic disease text is MISMATCH",
);

const unavailable = compareGovernedSnapshot(intended, {});
assert(unavailable.equal === false, "UNAVAILABLE blocks overall equal");
assert(
  unavailable.fields.some((item) => item.result === COMPARE_RESULT.UNAVAILABLE),
  "missing portal snapshot is UNAVAILABLE",
);

const actionSet = compareGovernedSnapshot(
  { ...intended, actions: [{ label: "A" }, { label: "B" }] },
  { ...matchPortal, actions: [{ label: "B" }, { label: "A" }] },
);
assert(actionSet.equal === true, "Actions compare as a set");

const saveCandidate = classifyActionCandidate({ text: "Save", type: "submit", id: "save_btn" });
assert(saveCandidate.action_candidate === "save", "Save type=submit is classified as save, not final Submit");
const unknownSubmit = classifyActionCandidate({ text: "Submit", type: "submit", id: "x" });
assert(unknownSubmit.action_candidate === "unknown", "bare Submit remains unknown");

const completeness = getContractCompleteness(loadPortalContract());
assert(completeness.productLookup === false, "productLookup completeness stays false");
assert(completeness.productDetails === false, "productDetails completeness stays false");
assert(completeness.composition === false, "composition completeness stays false");
assert(completeness.evidence === false, "evidence completeness stays false");
assert(completeness.saveUpdate === false, "saveUpdate completeness stays false");
assert(completeness.reread === false, "reread completeness stays false");

const eligiblePreflight = {
  eligible: true,
  reasons: [],
  entry_status: "NOT_STARTED",
  is_ready_for_entry: true,
  workflow_row_version: 5,
};
const content = {
  content_hash: "content-abc",
  payload_hash: "payload-xyz",
  workflow_row_version: 5,
};
const invoked = [];
const dry = await runEntryDryRun({
  productId: 262,
  workerState: "READY",
  callRpc: async (name, args) => {
    invoked.push(name);
    if (name === "rpc_eaushadhi_worker_preflight") return eligiblePreflight;
    if (name === "rpc_eaushadhi_worker_content_get") {
      assert(args.p_expected_workflow_row_version === 5, "content_get uses workflow row version");
      return content;
    }
    throw new Error(`unexpected rpc ${name}`);
  },
});
assert(dry.errorKind === ERROR_KINDS.CONTRACT_INCOMPLETE, "eligible dry-run stops CONTRACT_INCOMPLETE");
assert(dry.contentHash === "content-abc", "content_hash is present");
assert(dry.mutated === false, "dry-run does not mutate");
assert(invoked.includes("rpc_eaushadhi_worker_preflight"), "dry-run calls preflight");
assert(invoked.includes("rpc_eaushadhi_worker_content_get"), "dry-run calls content_get");
assert(
  MUTATING_RPC_NAMES.every((name) => !invoked.includes(name)),
  "mutating lifecycle RPCs are not invoked",
);
assert(dry.stoppedPhase === "Lookup Contract", "default contract first stop is Lookup Contract");
assert(dry.entryStatusChanged === false, "dry-run does not change entry status");
assert(
  JSON.stringify(dry.rpcsInvoked) ===
    JSON.stringify(["rpc_eaushadhi_worker_preflight", "rpc_eaushadhi_worker_content_get"]),
  "invoked RPCs are only preflight and content_get",
);
assert(
  dry.phases.filter((item) => item.status === "stop").length === 1,
  "default dry-run has exactly one execution stop",
);
assert(
  dry.phases.slice(dry.phases.findIndex((item) => item.status === "stop") + 1).every(
    (item) => item.status === "not_run",
  ),
  "downstream phases after first blocker are not_run",
);
assert(
  JSON.stringify(dry.contractCompleteness) === JSON.stringify(completeness),
  "default dry-run reports the evaluated default contract completeness",
);

function eligibleCallRpc() {
  return async (name, args) => {
    if (name === "rpc_eaushadhi_worker_preflight") return eligiblePreflight;
    if (name === "rpc_eaushadhi_worker_content_get") {
      assert(args.p_expected_workflow_row_version === 5, "content_get uses workflow row version");
      return content;
    }
    throw new Error(`unexpected rpc ${name}`);
  };
}

function contractWithFlags(flags) {
  const base = loadPortalContract();
  return {
    ...base,
    completeness: {
      ...base.completeness,
      ...flags,
    },
  };
}

async function dryWithFlags(flags) {
  const contract = contractWithFlags(flags);
  return {
    contract,
    result: await runEntryDryRun({
      productId: 262,
      workerState: "READY",
      contract,
      callRpc: eligibleCallRpc(),
    }),
  };
}

function assertSingleStop(result, expectedPhase) {
  assert(result.stoppedPhase === expectedPhase, `stoppedPhase is ${expectedPhase}`);
  const stops = result.phases.filter((item) => item.status === "stop");
  assert(stops.length === 1, `${expectedPhase}: exactly one stop`);
  assert(stops[0].id === expectedPhase, `${expectedPhase}: stop record matches first blocker`);
  const stopIndex = result.phases.findIndex((item) => item.status === "stop");
  assert(
    result.phases.slice(stopIndex + 1).every((item) => item.status === "not_run"),
    `${expectedPhase}: later phases are not_run`,
  );
  assert(result.mutated === false, `${expectedPhase}: mutated remains false`);
}

{
  const { result } = await dryWithFlags({
    productLookup: false,
    productDetails: false,
    composition: false,
    evidence: false,
    saveUpdate: false,
    reread: false,
  });
  assertSingleStop(result, "Lookup Contract");
}

{
  const { result } = await dryWithFlags({
    productLookup: true,
    productDetails: false,
    composition: false,
    evidence: false,
    saveUpdate: false,
    reread: false,
  });
  assertSingleStop(result, "Product Details Contract");
}

{
  const { result } = await dryWithFlags({
    productLookup: true,
    productDetails: true,
    composition: false,
    evidence: false,
    saveUpdate: false,
    reread: false,
  });
  assertSingleStop(result, "Composition Contract");
}

{
  const { result } = await dryWithFlags({
    productLookup: true,
    productDetails: true,
    composition: true,
    evidence: true,
    saveUpdate: true,
    reread: true,
  });
  assertSingleStop(result, "Comparator Readiness");
}

{
  const flags = {
    productLookup: true,
    productDetails: false,
    composition: false,
    evidence: false,
    saveUpdate: false,
    reread: false,
  };
  const { contract, result } = await dryWithFlags(flags);
  const expected = getContractCompleteness(contract);
  assert(
    JSON.stringify(result.contractCompleteness) === JSON.stringify(expected),
    "injected contract completeness is reported exactly",
  );
  assert(result.contractCompleteness.productLookup === true, "injected lookup completeness is true");
  assert(result.contractCompleteness.productDetails === false, "injected details completeness is false");
}

const other = await runEntryDryRun({
  productId: 41,
  workerState: "READY",
  callRpc: async () => {
    throw new Error("must not call rpc");
  },
});
assert(other.errorKind === ERROR_KINDS.PRODUCT_NOT_ALLOWED, "other product id rejected");

const notReady = await runEntryDryRun({
  productId: 262,
  workerState: "AUTH_REQUIRED",
  callRpc: async () => {
    throw new Error("must not call rpc");
  },
});
assert(notReady.errorKind === ERROR_KINDS.WORKER_NOT_READY, "non-READY worker rejected");

const denied = await runEntryDryRun({
  productId: 262,
  workerState: "READY",
  callRpc: async (name) => {
    if (name === "rpc_eaushadhi_worker_preflight") {
      return {
        eligible: false,
        reasons: ["Not ready"],
        is_ready_for_entry: false,
        entry_status: "NOT_STARTED",
        workflow_row_version: 5,
      };
    }
    throw new Error(`unexpected rpc ${name}`);
  },
});
assert(denied.errorKind === ERROR_KINDS.PREFLIGHT_DENIED, "non-READY product rejected");

let staleKind = null;
try {
  await runEntryDryRun({
    productId: 262,
    workerState: "READY",
    callRpc: async (name) => {
      if (name === "rpc_eaushadhi_worker_preflight") return eligiblePreflight;
      const error = new Error("Stale workflow row version");
      error.code = "40001";
      throw error;
    },
  });
} catch (error) {
  staleKind = error.code || error.kind;
}
assert(staleKind === "40001" || staleKind === ERROR_KINDS.STALE, "stale workflow version rejected");

const dryRunSrc = readFileSync(join(root, "electron/eaushadhi-worker/dry-run.js"), "utf8");
const indexSrc = readFileSync(join(root, "electron/eaushadhi-worker/index.js"), "utf8");
const captureSrc = readFileSync(join(root, "electron/eaushadhi-worker/capture/index.js"), "utf8");
const controlSrc = readFileSync(join(root, "public/shared/js/eaushadhi-review-control.js"), "utf8");
assert(
  !/await wrappedCall\(\s*["']rpc_eaushadhi_worker_run_begin["']/.test(dryRunSrc),
  "dry-run source does not call run_begin",
);
assert(!indexSrc.includes("rpc_eaushadhi_worker_run_begin"), "worker index does not call run_begin");
assert(!/page\.(click|fill|selectOption|setInputFiles)\(/.test(captureSrc), "capture does not fill or click");
assert(!/\.goto\s*\(/.test(captureSrc), "capture does not call goto");
assert(!/qc|quality control/i.test(controlSrc + dryRunSrc), "no QC");
assert(!/mark_submitted/.test(indexSrc + dryRunSrc), "no Submit lifecycle");

if (failed) {
  console.error(`\n${failed} first-entry capture assertion(s) failed`);
  process.exit(1);
}
console.log("\neaushadhi-worker-first-entry-capture-smoke: all assertions passed");
