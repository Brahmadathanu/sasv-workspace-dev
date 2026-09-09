/**
 * Offline smoke for read-only e-Aushadhi lifecycle contract capture / source analysis.
 * Does not contact the live portal and does not invoke discovered handlers.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const captureDir = join(root, "electron/eaushadhi-worker/capture");
const fixtureDir = join(root, "scripts/fixtures/eaushadhi-portal");

const {
  MUTATION_CLASS,
  analyzeSourceText,
  classifyMutation,
  classifyStaticScriptAcquisitionUrl,
  assessShellCreateEvidence,
  bucketRequests,
  isStaticScriptPath,
} = require(join(captureDir, "source-analyzer.js"));
const {
  finalizeLifecycleContractEvidence,
  enrichLifecycleWithStaticScripts,
} = require(join(captureDir, "lifecycle-evidence.js"));
const { extractLifecycleContractEvidence } = require(join(captureDir, "lifecycle-evidence-in-page.js"));
const { summarizeContractEvidence } = require(join(captureDir, "contract-evidence.js"));
const { loadPortalContract } = require(join(root, "electron/eaushadhi-worker/contracts/portal-contract.js"));
const {
  SHELL_CREATE_CANDIDATE,
  UPDATE_CANDIDATE,
  TERMINAL_SUBMIT_CANDIDATE,
  READ_ONLY_LOOKUP_CANDIDATE,
  UNKNOWN_AMBIGUOUS_CANDIDATE,
  COMPOSITION_LOAD_UPDATE,
  EXISTING_RECORD_REREAD,
  GET_ALONE_UNKNOWN,
} = require(join(fixtureDir, "lifecycle-sources.cjs"));
const { parseHtml, installSaveDataFixture, uninstallSaveDataFixture } = require(join(fixtureDir, "mini-dom.cjs"));

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("OK", msg);
  }
}

const FORBIDDEN_SOURCE =
  /\.(?:click|fill|type|press|goto|selectOption|setInputFiles)\s*\(|locator\.(?:click|fill|type|press)\s*\(|\.request\.post\s*\(|form\.submit\s*\(|requestSubmit\s*\(|checkValidity\s*\(|reportValidity\s*\(|dispatchEvent\s*\(|HTMLElement\.prototype\.click|\.click\s*\(\s*\)|SaveData\s*\(\s*\)\s*;/;

const sourceFiles = [
  "source-analyzer.js",
  "lifecycle-evidence.js",
  "lifecycle-evidence-in-page.js",
];

for (const file of sourceFiles) {
  const text = readFileSync(join(captureDir, file), "utf8");
  assert(!FORBIDDEN_SOURCE.test(text), `${file}: no mutation primitives / SaveData invoke`);
  // In-page extractor must not call fetch/$.ajax; Node enrich may use page.request.get only.
  if (file === "lifecycle-evidence-in-page.js") {
    assert(!/\bfetch\s*\(/.test(text), `${file}: no fetch()`);
    assert(!/\$\.(?:ajax|get|post)\s*\(/.test(text), `${file}: no jquery ajax invoke`);
  }
  if (file === "source-analyzer.js") {
    assert(!/\bfetch\s*\(/.test(text), `${file}: analyzer does not call fetch`);
    assert(!/\$\.(?:ajax|get|post)\s*\(/.test(text), `${file}: analyzer does not call jquery`);
  }
}

assert(!/rpc_eaushadhi_worker_run_begin/.test(readFileSync(join(captureDir, "lifecycle-evidence.js"), "utf8")), "no run_begin in lifecycle finalize");
assert(!/rpc_eaushadhi_worker_run_begin/.test(readFileSync(join(captureDir, "index.js"), "utf8")), "capture index has no run_begin");

// A. shell-create candidate
const shell = analyzeSourceText(SHELL_CREATE_CANDIDATE, { name: "SaveData", source_function: "SaveData" });
assert(shell.source_sha256 && shell.source_truncated === false, "shell: sha256 present");
assert(shell.requests.some((r) => r.mutation_classification === MUTATION_CLASS.MUTATING_CANDIDATE), "shell: mutating request");
assert(shell.requests.every((r) => r.mutation_classification !== MUTATION_CLASS.TERMINAL_CANDIDATE), "shell: not terminal");
assert(/saveproductforlegacy/i.test(JSON.stringify(shell.requests)), "shell: endpoint observed");

// B. update candidate
const update = analyzeSourceText(UPDATE_CANDIDATE, { name: "SaveData", source_function: "SaveData" });
assert(update.requests.some((r) => r.mutation_classification === MUTATION_CLASS.MUTATING_CANDIDATE), "update: mutating");
assert(/updateproductforlegacy/i.test(JSON.stringify(update.requests)), "update: endpoint");

// C. terminal
const terminal = analyzeSourceText(TERMINAL_SUBMIT_CANDIDATE, { name: "FinalSubmitProduct", source_function: "FinalSubmitProduct" });
assert(terminal.requests.some((r) => r.mutation_classification === MUTATION_CLASS.TERMINAL_CANDIDATE), "terminal: TERMINAL_CANDIDATE");
const terminalBuckets = bucketRequests(terminal.requests);
assert(terminalBuckets.final_submit_candidates.length > 0, "terminal: bucketed as final_submit");
assert(terminalBuckets.shell_create_candidates.length === 0, "terminal: never treated as shell-create");

// D. read-only lookup
const lookup = analyzeSourceText(READ_ONLY_LOOKUP_CANDIDATE, { name: "searchLegacyProducts" });
assert(lookup.requests.some((r) => r.mutation_classification === MUTATION_CLASS.READ_ONLY_PROVEN), "lookup: READ_ONLY_PROVEN");
assert(/viewproducttbllegacy|loadproductdataforlegacy/i.test(JSON.stringify(lookup.requests)), "lookup: endpoints");

// E. unknown ambiguous
const unknown = analyzeSourceText(UNKNOWN_AMBIGUOUS_CANDIDATE, { name: "doThing" });
assert(unknown.requests.some((r) => r.mutation_classification === MUTATION_CLASS.UNKNOWN), "ambiguous: UNKNOWN");

// GET alone insufficient
const getAlone = classifyMutation({
  method: "GET",
  urlExpression: "../admin/obscureStatus",
  surroundingContext: "success: function(){}",
  sourceFunction: "ping",
});
assert(getAlone.mutation_classification === MUTATION_CLASS.UNKNOWN, "GET alone is UNKNOWN not READ_ONLY_PROVEN");
const getAloneAnalysis = analyzeSourceText(GET_ALONE_UNKNOWN, { name: "ping" });
assert(
  getAloneAnalysis.requests.every((r) => r.mutation_classification !== MUTATION_CLASS.READ_ONLY_PROVEN),
  "GET alone fixture never READ_ONLY_PROVEN",
);

// F. composition
const composition = analyzeSourceText(COMPOSITION_LOAD_UPDATE, { name: "composition" });
const compositionBuckets = bucketRequests(composition.requests);
assert(compositionBuckets.composition_candidates.length > 0, "composition: candidates present");
assert(
  composition.requests.some((r) => r.mutation_classification === MUTATION_CLASS.MUTATING_CANDIDATE),
  "composition: save row mutating",
);
assert(
  composition.requests.some((r) => r.mutation_classification === MUTATION_CLASS.READ_ONLY_PROVEN),
  "composition: load rows read-only proven",
);

// G. existing-record / reread
const reread = analyzeSourceText(EXISTING_RECORD_REREAD, { name: "LoadProductDataforLegacy" });
const rereadBuckets = bucketRequests(reread.requests);
assert(rereadBuckets.existing_record_load_candidates.length > 0, "reread: existing-record load candidates");
assert(rereadBuckets.reread_candidates.length > 0, "reread: reread candidates");

// Shell-create proof assessment remains unresolved without full criteria — but fixture is rich.
const shellProof = assessShellCreateEvidence({
  controls: [{ id: "save_btn", candidate_role: "save_or_submit_ambiguous" }],
  functions: [{ name: "SaveData", contexts: shell.contexts }],
  requests: shell.requests,
});
assert(shellProof.status === "evidence_present_unproven" || shellProof.status === "unresolved", "shell proof not complete-executable");
assert(shellProof.criteria.handler_function === true, "shell proof: handler");
assert(shellProof.criteria.endpoint === true, "shell proof: endpoint");

// Static script acquisition rules
const origin = "https://www.e-aushadhi.gov.in";
const positiveStaticPaths = [
  "/db_static/eaushadhi/addproductforlegacy-abc.js",
  "/static/app.js",
  "/assets/app.js",
  "/js/app.js",
];
for (const path of positiveStaticPaths) {
  assert(isStaticScriptPath(path) === true, `positive static path allowed: ${path}`);
  assert(
    classifyStaticScriptAcquisitionUrl(`${origin}${path}`, origin).ok === true,
    `positive same-origin acquisition allowed: ${path}`,
  );
}

const negativeStaticPaths = [
  "/admin/foo.js",
  "/admin/custom_dashboard1.js",
  "/api/foo.js",
  "/random/foo.js",
  "/foo.js",
];
for (const path of negativeStaticPaths) {
  assert(isStaticScriptPath(path) === false, `negative static path rejected: ${path}`);
  assert(
    classifyStaticScriptAcquisitionUrl(`${origin}${path}`, origin).ok === false,
    `negative same-origin acquisition rejected: ${path}`,
  );
}

const stripped = classifyStaticScriptAcquisitionUrl(
  "https://www.e-aushadhi.gov.in/db_static/eaushadhi/addproductforlegacy-abc.js?cache=1#x",
  origin,
);
assert(stripped.ok === true, "query/hash static path still allowed");
assert(
  stripped.url === "https://www.e-aushadhi.gov.in/db_static/eaushadhi/addproductforlegacy-abc.js",
  "static acquisition strips query/hash",
);
assert(stripped.path === "/db_static/eaushadhi/addproductforlegacy-abc.js", "stripped path keeps approved prefix");

assert(
  classifyStaticScriptAcquisitionUrl("https://evil.example/db_static/x.js", origin).ok === false,
  "cross-origin approved-looking static path rejected",
);
assert(
  classifyStaticScriptAcquisitionUrl(`${origin}/admin/getSomething.js`, origin).ok === false,
  "/admin/getSomething.js rejected even if .js",
);
assert(isStaticScriptPath("/admin/getSomething.js") === false, "isStaticScriptPath rejects /admin/getSomething.js");

assert(
  classifyStaticScriptAcquisitionUrl(
    "https://www.e-aushadhi.gov.in/admin/saveproductforlegacy",
    origin,
  ).ok === false,
  "business save endpoint rejected",
);
assert(
  classifyStaticScriptAcquisitionUrl(
    "https://www.e-aushadhi.gov.in/admin/getsubtypeName",
    origin,
  ).ok === false,
  "business get endpoint rejected as script",
);
assert(
  classifyMutation({
    method: "POST",
    urlExpression: "../admin/saveproductforlegacy",
    payloadExpression: '{ actiontype: "add" }',
    sourceFunction: "SaveData",
  }).mutation_classification === MUTATION_CLASS.MUTATING_CANDIDATE,
  "business endpoint mutation classification unchanged",
);

// Rejected URLs must not cause request issuance during enrichment.
const rejectedRequestCalls = [];
const rejectedEnrich = await enrichLifecycleWithStaticScripts(
  {
    request: {
      get(url) {
        rejectedRequestCalls.push(String(url));
        throw new Error("rejected URL must not be fetched");
      },
    },
  },
  {
    schema_version: 1,
    controls: [],
    functions: [],
    requests: [],
    limitations: [],
    script_inventory: negativeStaticPaths.map((path, index) => ({
      script_index: index,
      source_kind: "external",
      src_path: path,
      src_url_for_acquisition: `${origin}${path}`,
      acquisition_status: "pending_static_check",
    })),
  },
  origin,
);
assert(rejectedRequestCalls.length === 0, "no request issued for rejected static URLs");
assert(
  (rejectedEnrich.script_inventory || []).every((item) => item.acquisition_status === "unresolved"),
  "rejected static URLs remain unresolved without fetch",
);

// Finalize drops raw bodies
const finalized = finalizeLifecycleContractEvidence({
  schema_version: 1,
  page_path: "/admin/addproductforlegacy",
  controls: [{ id: "save_btn", candidate_role: "save_or_submit_ambiguous", activated: false }],
  scripts: [],
  inline_sources: [],
  functions_raw: [
    {
      name: "SaveData",
      source_kind: "window_tostring",
      found: true,
      source_capture_status: "captured",
      source_length: SHELL_CREATE_CANDIDATE.length,
      source_truncated: false,
      function_source_raw: SHELL_CREATE_CANDIDATE,
      referenced_by_onclick: true,
      control_id: "save_btn",
    },
  ],
  limitations: [],
  requests_executed: [],
});
assert(finalized.schema_version === 1, "schema_version 1");
assert(!JSON.stringify(finalized).includes("function_source_raw"), "raw source dropped");
assert(finalized.activated === false, "activated false");
assert(Array.isArray(finalized.requests_executed) && finalized.requests_executed.length === 0, "no requests executed");
assert(finalized.shell_create_candidates.length > 0, "finalize buckets shell-create");
assert(finalized.verification_status === "unverified", "verification unverified");

// Enrich without request API stays unresolved for externals
const enriched = await enrichLifecycleWithStaticScripts(
  {},
  {
    ...finalized,
    script_inventory: [
      {
        script_index: 0,
        source_kind: "external",
        src_path: "/db_static/eaushadhi/addproductforlegacy-abc.js",
        src_url_for_acquisition: `${origin}/db_static/eaushadhi/addproductforlegacy-abc.js`,
        acquisition_status: "pending_static_check",
      },
    ],
  },
  origin,
);
assert(
  enriched.script_inventory[0].acquisition_status === "unresolved",
  "without request API external stays unresolved",
);

// In-page extractor on fixture DOM — observational only
globalThis.__EA_SAVEDATA_INVOKED = false;
globalThis.__EA_LIFECYCLE_HANDLER_FIRED = false;
const legacyHtml = readFileSync(join(fixtureDir, "addproduct-legacy.html"), "utf8");
const document = parseHtml(legacyHtml);
globalThis.document = document;
globalThis.window = globalThis;
globalThis.location = { href: `${origin}/admin/addproductforlegacy`, pathname: "/admin/addproductforlegacy" };
installSaveDataFixture();
const prevSaveData = globalThis.SaveData;
globalThis.SaveData = function SaveData() {
  globalThis.__EA_LIFECYCLE_HANDLER_FIRED = true;
  globalThis.__EA_SAVEDATA_INVOKED = true;
  return prevSaveData ? prevSaveData() : true;
};
// Ensure onclick wrapper exists for allowlist resolution.
const saveBtn = document.getElementById("save_btn");
if (saveBtn) {
  saveBtn.attrs = saveBtn.attrs || {};
  saveBtn.attrs.onclick = "SaveData()";
  saveBtn.getAttribute = (name) => (name === "onclick" ? "SaveData()" : saveBtn.attrs[name] || null);
}

const extracted = extractLifecycleContractEvidence();
assert(extracted.activated === false, "extract activated false");
assert(Array.isArray(extracted.requests_executed) && extracted.requests_executed.length === 0, "extract no requests");
assert(globalThis.__EA_SAVEDATA_INVOKED !== true, "SaveData not invoked by extract");
assert(globalThis.__EA_LIFECYCLE_HANDLER_FIRED !== true, "no handler fired");
const fromExtract = finalizeLifecycleContractEvidence(extracted);
assert(fromExtract.controls.some((c) => c.id === "save_btn"), "extract sees save_btn");
uninstallSaveDataFixture();

// Contract completeness stays false
const contract = loadPortalContract();
assert(contract.completeness.productLookup === false, "productLookup false");
assert(contract.completeness.productDetails === false, "productDetails false");
assert(contract.completeness.pharmacologicalActions === false, "pharmacologicalActions false");
assert(contract.completeness.composition === false, "composition false");
assert(contract.completeness.evidence === false, "evidence false");
assert(contract.completeness.saveUpdate === false, "saveUpdate false");
assert(contract.completeness.reread === false, "reread false");
assert(/Do not click/i.test(contract.saveUpdate.evidence_note), "saveUpdate Do not click");

// Stale contract-evidence summary correction
const summary = summarizeContractEvidence({
  vocabularies: [
    {
      select_id: "type",
      control_key: "product_type",
      options: [{ value: "120", label: "Ayurvedic Proprietary Medicine" }],
    },
    {
      select_id: "categoryId",
      control_key: "product_category",
      options: [{ value: "278", label: "Taila (Oil)" }],
    },
  ],
  pages: [],
  composition_structure: [],
  save_update_structure: [],
  evidence_structure: [],
  reread_structure: [],
});
assert(summary.productDetails.status === "unresolved", "productDetails remains unresolved");
assert(!/category\/subtype capture is not proven/i.test(summary.productDetails.note), "stale not-proven wording removed");
assert(/Taila \(Oil\)|subtype vocabulary|external id 31/i.test(summary.productDetails.note), "summary recognizes governed category/subtype proofs");
assert(summary.productDetails.status !== "proven", "productDetails not proven");

// Deterministic schema keys
for (const key of [
  "schema_version",
  "controls",
  "functions",
  "requests",
  "shell_create_candidates",
  "lookup_candidates",
  "existing_record_load_candidates",
  "composition_candidates",
  "update_candidates",
  "final_submit_candidates",
  "reread_candidates",
  "limitations",
]) {
  assert(Object.prototype.hasOwnProperty.call(finalized, key), `schema has ${key}`);
}

// Secret sanitisation via capture redaction (sensitive.js)
const secretSource = `function SaveData(){ $.ajax({url:"../admin/saveproductforlegacy",type:"POST",data:{x:1}}); }`;
const secretAnalysis = analyzeSourceText(secretSource, { name: "SaveData" });
const { redactCapture } = require(join(captureDir, "sensitive.js"));
const planted = finalizeLifecycleContractEvidence({
  schema_version: 1,
  page_path: "/admin/addproductforlegacy",
  controls: [],
  scripts: [],
  inline_sources: [],
  functions_raw: [
    {
      name: "SaveData",
      source_kind: "window_tostring",
      found: true,
      source_capture_status: "captured",
      source_length: secretSource.length,
      source_truncated: false,
      function_source_raw: secretSource,
    },
  ],
  limitations: [],
  requests_executed: [],
});
planted.access_token = "PLANTED_LIFECYCLE_SECRET";
planted.cookie = "PLANTED_COOKIE";
const redacted = redactCapture({ ...planted, capture_schema_version: 1 });
assert(!JSON.stringify(redacted).includes("PLANTED_LIFECYCLE_SECRET"), "redaction drops access_token secret");
assert(!JSON.stringify(redacted).includes("PLANTED_COOKIE"), "redaction drops cookie secret");
assert(secretAnalysis.source_sha256, "secret fixture still hashed");
assert(!JSON.stringify(planted).includes("function_source_raw"), "raw secret source not retained after finalize");

if (failed) {
  console.error(`eaushadhi-worker-lifecycle-contract-capture-smoke: ${failed} failure(s)`);
  process.exit(1);
}
console.log("eaushadhi-worker-lifecycle-contract-capture-smoke: all assertions passed");
