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
  dedupeLifecycleRequests,
  isStaticScriptPath,
  extractSourceLinkageEvidence,
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
  MUTATING_UPDATE_PRODUCT,
  TERMINAL_SUBMIT_CANDIDATE,
  GENERIC_LIBRARY_SUBMIT,
  READ_ONLY_LOOKUP_CANDIDATE,
  LOAD_PRODUCT_DATATABLE,
  LOAD_PRODUCT_POST_WITHOUT_READ_PROOF,
  GETPRODUCT_DATA_UPDATE_REREAD,
  UNKNOWN_AMBIGUOUS_CANDIDATE,
  COMPOSITION_LOAD_UPDATE,
  COMPOSITION_STATUSDATA_LINKAGE,
  EXISTING_RECORD_REREAD,
  GET_ALONE_UNKNOWN,
  LIVE_STATIC_PAGE_SCRIPT,
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
  assert(!/source_contract_proven/.test(text), `${file}: no source_contract_proven status`);
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

// 1. SaveData → SaveProductData mutating / shell; not terminal
const shell = analyzeSourceText(SHELL_CREATE_CANDIDATE, { name: "SaveData", source_function: "SaveData" });
assert(shell.source_sha256 && shell.source_truncated === false, "shell: sha256 present");
assert(shell.requests.some((r) => r.mutation_classification === MUTATION_CLASS.MUTATING_CANDIDATE), "shell: mutating request");
assert(shell.requests.every((r) => r.mutation_classification !== MUTATION_CLASS.TERMINAL_CANDIDATE), "shell: not terminal");
assert(/SaveProductData/i.test(JSON.stringify(shell.requests)), "shell: SaveProductData endpoint observed");
assert(shell.requests.some((r) => r.source_function === "SaveData"), "shell: enclosing function SaveData");
const shellBuckets = bucketRequests(shell.requests);
assert(shellBuckets.shell_create_candidates.length > 0, "shell: bucketed shell_create");
assert(shellBuckets.final_submit_candidates.length === 0, "shell: not final_submit");

const update = analyzeSourceText(UPDATE_CANDIDATE, { name: "SaveData", source_function: "SaveData" });
assert(update.requests.some((r) => r.mutation_classification === MUTATION_CLASS.MUTATING_CANDIDATE), "update SaveData: mutating");
assert(update.requests.every((r) => r.mutation_classification !== MUTATION_CLASS.TERMINAL_CANDIDATE), "#save_btn/SaveData path not terminal");

// 2. LoadProductDataforLegacy POST + DataTable → READ_ONLY; lookup/list; not reread
const loadDt = analyzeSourceText(LOAD_PRODUCT_DATATABLE, {
  name: "LoadProductDataforLegacy",
  source_function: "LoadProductDataforLegacy",
});
assert(
  loadDt.requests.some((r) => r.mutation_classification === MUTATION_CLASS.READ_ONLY_PROVEN),
  "LoadProductDataforLegacy DataTable: READ_ONLY_PROVEN",
);
assert(loadDt.requests.some((r) => r.source_function === "LoadProductDataforLegacy"), "LoadProduct: enclosing fn");
const loadBuckets = bucketRequests(loadDt.requests, loadDt.composition_observations);
assert(loadBuckets.lookup_candidates.length > 0, "LoadProduct: lookup/list bucket");
assert(loadBuckets.reread_candidates.length === 0, "LoadProduct: NOT retained reread");
assert(
  (loadDt.composition_observations || []).some((c) => c.candidate_kind === "source_link_or_handler") ||
    loadBuckets.composition_candidates.some((c) => c.candidate_kind === "source_link_or_handler"),
  "LoadProduct: composition observation when source provides linkage",
);

// 3. similar Load POST without joint read evidence → not READ_ONLY
const loadBare = analyzeSourceText(LOAD_PRODUCT_POST_WITHOUT_READ_PROOF, {
  name: "LoadSomethingLegacy",
  source_function: "LoadSomethingLegacy",
});
assert(
  loadBare.requests.every((r) => r.mutation_classification !== MUTATION_CLASS.READ_ONLY_PROVEN),
  "Load POST without read proof: not READ_ONLY_PROVEN",
);
assert(
  loadBare.requests.some((r) => r.mutation_classification === MUTATION_CLASS.UNKNOWN),
  "Load POST without read proof: UNKNOWN",
);

// 4. GetproductDataUpdate → READ_ONLY + existing load + reread
const getUpdate = analyzeSourceText(GETPRODUCT_DATA_UPDATE_REREAD, {
  name: "GetproductDataUpdate",
  source_function: "GetproductDataUpdate",
});
assert(
  getUpdate.requests.some((r) => r.mutation_classification === MUTATION_CLASS.READ_ONLY_PROVEN),
  "GetproductDataUpdate: READ_ONLY_PROVEN",
);
const getUpdateBuckets = bucketRequests(getUpdate.requests);
assert(getUpdateBuckets.existing_record_load_candidates.length > 0, "GetproductDataUpdate: existing_record_load");
assert(getUpdateBuckets.reread_candidates.length > 0, "GetproductDataUpdate: reread candidate");
assert(getUpdateBuckets.lookup_candidates.length === 0, "GetproductDataUpdate: not list lookup");

// 5. UpdateProduct mutating
const updateProduct = analyzeSourceText(MUTATING_UPDATE_PRODUCT, {
  name: "UpdateProduct",
  source_function: "UpdateProduct",
});
assert(
  updateProduct.requests.some((r) => r.mutation_classification === MUTATION_CLASS.MUTATING_CANDIDATE),
  "UpdateProduct: MUTATING_CANDIDATE",
);

// 6–9. submitProduct terminal with linkage; SaveData not terminal; row .Submit contributes
const terminal = analyzeSourceText(TERMINAL_SUBMIT_CANDIDATE, {
  name: "submitProduct",
  source_function: "submitProduct",
});
const linkage = extractSourceLinkageEvidence(TERMINAL_SUBMIT_CANDIDATE);
assert(linkage.row_submit_links_submitProduct === true, "row .Submit linkage marker present");
assert(
  terminal.requests.some((r) => r.mutation_classification === MUTATION_CLASS.TERMINAL_CANDIDATE),
  "submitProduct: TERMINAL_CANDIDATE",
);
assert(
  terminal.requests.some((r) => (r.linkage_markers || []).includes("row_Submit_invokes_submitProduct")),
  "submitProduct: linkage markers on request (not distant text dump)",
);
const terminalBuckets = bucketRequests(terminal.requests);
assert(terminalBuckets.final_submit_candidates.length > 0, "submitProduct: final_submit_candidates");
assert(terminalBuckets.shell_create_candidates.length === 0, "submitProduct: never shell-create");

// 7. generic library submit not terminal
const genericSubmit = analyzeSourceText(GENERIC_LIBRARY_SUBMIT, { name: "wireFormHelpers" });
assert(
  genericSubmit.requests.every((r) => r.mutation_classification !== MUTATION_CLASS.TERMINAL_CANDIDATE),
  "generic library submit: not terminal",
);
assert(
  classifyMutation({
    method: "POST",
    urlExpression: "../admin/other",
    surroundingContext: "please submit the form helper",
    sourceFunction: "helper",
  }).mutation_classification !== MUTATION_CLASS.TERMINAL_CANDIDATE,
  "generic submit word: not terminal",
);

// D. read-only lookup getProductNames
const lookup = analyzeSourceText(READ_ONLY_LOOKUP_CANDIDATE, { name: "searchProductNames" });
assert(lookup.requests.some((r) => r.mutation_classification === MUTATION_CLASS.READ_ONLY_PROVEN), "lookup: READ_ONLY_PROVEN");
assert(/getProductNames/i.test(JSON.stringify(lookup.requests)), "lookup: getProductNames");

// E. unknown ambiguous
const unknown = analyzeSourceText(UNKNOWN_AMBIGUOUS_CANDIDATE, { name: "doThing" });
assert(unknown.requests.some((r) => r.mutation_classification === MUTATION_CLASS.UNKNOWN), "ambiguous: UNKNOWN");

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

// F. composition load/save + statusData linkage
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
const compositionLink = analyzeSourceText(COMPOSITION_STATUSDATA_LINKAGE, { name: "mapProductRows" });
assert(
  (compositionLink.composition_observations || []).some((o) => o.observation === "statusData.composition"),
  "composition: statusData.composition observation extracted",
);
assert(
  (compositionLink.composition_observations || []).some((o) => o.linkage_complete === true),
  "composition: exact handler linkage when source provides it",
);

// G. existing-record / reread via GetproductDataUpdate
const reread = analyzeSourceText(EXISTING_RECORD_REREAD, { name: "GetproductDataUpdate" });
const rereadBuckets = bucketRequests(reread.requests);
assert(rereadBuckets.existing_record_load_candidates.length > 0, "reread: existing-record load candidates");
assert(rereadBuckets.reread_candidates.length > 0, "reread: reread candidates");

// Shell-create proof — only unresolved | evidence_present_unproven
const shellProof = assessShellCreateEvidence({
  controls: [{ id: "save_btn", candidate_role: "save_or_submit_ambiguous" }],
  functions: [{ name: "SaveData", contexts: shell.contexts }],
  requests: shell.requests,
});
assert(
  shellProof.status === "evidence_present_unproven" || shellProof.status === "unresolved",
  "shell proof not complete-executable",
);
assert(shellProof.status !== "source_contract_proven", "shell proof never source_contract_proven");
assert(shellProof.criteria.handler_function === true, "shell proof: handler");
assert(shellProof.criteria.endpoint === true, "shell proof: endpoint");

// --- Live whole-static-script correlation (capture 297f0893 shape) ---
const liveStaticPath =
  "static_script:/db_static/eaushadhi/addproductforlegacy-4f97f4fb38bf04556d376bd91854f6a1.js";
const live = analyzeSourceText(LIVE_STATIC_PAGE_SCRIPT, {
  name: liveStaticPath,
  source_function: liveStaticPath,
  source_kind: "same_origin_static_js",
});
assert(
  (live.named_regions_segmented || []).includes("SaveData") &&
    (live.named_regions_segmented || []).includes("LoadProductDataforLegacy") &&
    (live.named_regions_segmented || []).includes("GetproductDataUpdate") &&
    (live.named_regions_segmented || []).includes("submitProduct"),
  "live static: named regions segmented",
);
const liveSave = live.requests.find((r) => /SaveProductData/i.test(r.static_path || r.url_expression || ""));
assert(liveSave && liveSave.mutation_classification === MUTATION_CLASS.MUTATING_CANDIDATE, "live: SaveProductData MUTATING");
assert(liveSave.source_function === "SaveData", "live: SaveData enclosing attribution");
assert(liveSave.mutation_classification !== MUTATION_CLASS.TERMINAL_CANDIDATE, "live: SaveData not terminal");
assert(liveSave.deferred_handling === true || /deferred_done|deferred_fail/.test(String(liveSave.response_usage || "")), "live: SaveData .done/.fail captured");

const liveLoad = live.requests.find((r) => /LoadProductDataforLegacy/i.test(r.static_path || r.url_expression || ""));
assert(liveLoad && liveLoad.mutation_classification === MUTATION_CLASS.READ_ONLY_PROVEN, "live: LoadProduct READ_ONLY_PROVEN");
assert(liveLoad.source_function === "LoadProductDataforLegacy", "live: LoadProduct attributed without window export");

const liveGet = live.requests.find((r) => /GetproductDataUpdate/i.test(r.static_path || r.url_expression || ""));
assert(liveGet && liveGet.mutation_classification === MUTATION_CLASS.READ_ONLY_PROVEN, "live: GetproductDataUpdate READ_ONLY_PROVEN");

const liveSubmit = live.requests.find((r) => /submitProduct/i.test(r.static_path || "") || /submitProduct/i.test(r.url_expression || ""));
assert(liveSubmit && liveSubmit.mutation_classification === MUTATION_CLASS.TERMINAL_CANDIDATE, "live: submitProduct TERMINAL");
assert(liveSubmit.source_function === "submitProduct", "live: submitProduct enclosing name");

const liveBuckets = bucketRequests(live.requests, live.composition_observations);
assert(liveBuckets.shell_create_candidates.some((r) => /SaveProductData/i.test(r.static_path || "")), "live: shell candidate");
assert(liveBuckets.final_submit_candidates.length > 0, "live: final_submit_candidates");
assert(liveBuckets.lookup_candidates.some((r) => /LoadProductDataforLegacy/i.test(r.static_path || "")), "live: Load in lookup/list");
assert(
  !liveBuckets.reread_candidates.some((r) => /LoadProductDataforLegacy/i.test(r.static_path || "")),
  "live: Load NOT reread",
);
assert(liveBuckets.existing_record_load_candidates.some((r) => /GetproductDataUpdate/i.test(r.static_path || "")), "live: Getproduct existing load");
assert(liveBuckets.reread_candidates.some((r) => /GetproductDataUpdate/i.test(r.static_path || "")), "live: Getproduct reread");
assert(
  (live.composition_observations || []).some((o) => o.linkage_complete === true && /addcomposition/i.test(String(o.class_or_id || o.evidence_basis || ""))),
  "live: composition addcomposition linkage",
);

const liveShell = assessShellCreateEvidence({
  controls: [{ id: "save_btn", candidate_role: "save_or_submit_ambiguous" }],
  functions: (live.named_regions_segmented || []).map((name) => ({ name })),
  requests: live.requests,
});
assert(liveShell.status === "evidence_present_unproven", "live shell: evidence_present_unproven");
assert(Array.isArray(liveShell.missing_criteria) && liveShell.missing_criteria.length === 0, "live shell: missing_criteria empty");

// Cross-source duplicate: weaker UNKNOWN must not mask proven Getproduct
const weakGet = {
  source_function: liveStaticPath,
  url_expression: "../admin/GetproductDataUpdate",
  static_path: "../admin/GetproductDataUpdate",
  method: "POST",
  payload_expression: "{ id: id }",
  response_usage: null,
  mutation_classification: MUTATION_CLASS.UNKNOWN,
  evidence_basis: ["incomplete_getproductdataupdate_read_proof"],
  linkage_markers: [],
};
const dedupedGet = dedupeLifecycleRequests([weakGet, liveGet]);
assert(dedupedGet.length === 1, "dedupe: single Getproduct remains");
assert(dedupedGet[0].mutation_classification === MUTATION_CLASS.READ_ONLY_PROVEN, "dedupe: prefers joint READ_ONLY over UNKNOWN");
assert(dedupedGet[0].source_function === "GetproductDataUpdate", "dedupe: prefers named function");

// Contradiction: strong MUTATING joint vs READ_ONLY joint → fail closed, keep mutating
const strongMutatingGet = {
  source_function: "GetproductDataUpdate",
  url_expression: "../admin/GetproductDataUpdate",
  static_path: "../admin/GetproductDataUpdate",
  method: "POST",
  payload_expression: liveGet.payload_expression || "{ id: id }",
  response_usage: "actiontype_semantics",
  mutation_classification: MUTATION_CLASS.MUTATING_CANDIDATE,
  evidence_basis: ["getproductdataupdate_identity", "actiontype_semantics", "http_post", "mutating_verb"],
  linkage_markers: [],
};
const conflict = dedupeLifecycleRequests([liveGet, strongMutatingGet]);
assert(conflict.length === 1, "contradiction dedupe: one survivor");
assert(conflict[0].mutation_classification === MUTATION_CLASS.MUTATING_CANDIDATE, "contradiction: fail-closed keeps MUTATING over READ_ONLY");
assert(
  (conflict[0].evidence_basis || []).includes("classification_conflict_fail_closed"),
  "contradiction: conflict marker recorded",
);

// Finalize path with window + static duplicate sources
const crossFinalize = finalizeLifecycleContractEvidence({
  schema_version: 1,
  page_path: "/admin/addproductforlegacy",
  controls: [{ id: "save_btn", candidate_role: "save_or_submit_ambiguous", activated: false }],
  scripts: [],
  inline_sources: [],
  functions_raw: [
    {
      name: "GetproductDataUpdate",
      source_kind: "window_tostring",
      found: true,
      source_capture_status: "captured",
      source_length: GETPRODUCT_DATA_UPDATE_REREAD.length,
      source_truncated: false,
      function_source_raw: GETPRODUCT_DATA_UPDATE_REREAD,
    },
    {
      name: liveStaticPath,
      source_kind: "same_origin_static_js",
      found: true,
      source_capture_status: "captured",
      source_length: LIVE_STATIC_PAGE_SCRIPT.length,
      source_truncated: false,
      function_source_raw: LIVE_STATIC_PAGE_SCRIPT,
    },
  ],
  limitations: [],
  requests_executed: [],
});
assert(crossFinalize.activated === false, "cross-finalize activated false");
assert(crossFinalize.requests_executed.length === 0, "cross-finalize no requests executed");
assert(
  crossFinalize.reread_candidates.some((r) => /GetproductDataUpdate/i.test(r.static_path || "")),
  "cross-finalize: Getproduct reread present",
);
assert(
  crossFinalize.requests.filter((r) => /GetproductDataUpdate/i.test(r.static_path || "")).length === 1,
  "cross-finalize: Getproduct deduped to one",
);
assert(
  crossFinalize.final_submit_candidates.length > 0,
  "cross-finalize: submitProduct terminal bucketed",
);

// Static script acquisition rules unchanged
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
  classifyStaticScriptAcquisitionUrl(`${origin}/admin/SaveProductData`, origin).ok === false,
  "business SaveProductData endpoint rejected",
);
assert(
  classifyStaticScriptAcquisitionUrl(`${origin}/admin/getsubtypeName`, origin).ok === false,
  "business get endpoint rejected as script",
);
assert(
  classifyMutation({
    method: "POST",
    urlExpression: "../admin/SaveProductData",
    payloadExpression: "formData with actiontype add",
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

// In-page extractor on fixture DOM — observational only + chrome roles
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
const saveBtn = document.getElementById("save_btn");
if (saveBtn) {
  saveBtn.attrs = saveBtn.attrs || {};
  saveBtn.attrs.onclick = "SaveData()";
  saveBtn.getAttribute = (name) => (name === "onclick" ? "SaveData()" : saveBtn.attrs[name] || null);
}

// Synthetic chrome + row Submit controls for role classification
const chromeSpecs = [
  { id: "menuBtn", type: "submit", text: "Menu", className: "" },
  { id: "refreshBtn", type: "submit", text: "Refresh", className: "" },
  { id: "logoutBtn", type: "submit", text: "Logout", className: "" },
];
for (const spec of chromeSpecs) {
  const el = {
    id: spec.id,
    name: null,
    tagName: "BUTTON",
    type: spec.type,
    className: spec.className,
    textContent: spec.text,
    hidden: false,
    disabled: false,
    onclick: null,
    form: null,
    attrs: {},
    getAttribute(name) {
      if (name === "type") return spec.type;
      if (name === "class") return spec.className;
      return this.attrs[name] || null;
    },
    closest() {
      return null;
    },
  };
  document._nodes = document._nodes || [];
  // parseHtml querySelectorAll uses document tree; inject via body children if available
  if (document.body && document.body.appendChild) {
    document.body.appendChild(el);
  } else if (typeof document.querySelectorAll === "function") {
    const prev = document.querySelectorAll.bind(document);
    document.querySelectorAll = (sel) => {
      const base = Array.from(prev(sel) || []);
      if (String(sel).includes("button") || String(sel).includes("submit")) base.push(el);
      return base;
    };
  }
}

const rowSubmit = {
  id: null,
  name: null,
  tagName: "A",
  type: null,
  className: "Submit",
  textContent: "Submit",
  hidden: false,
  disabled: false,
  onclick: null,
  form: null,
  attrs: { class: "Submit", onclick: "submitProduct(123)" },
  getAttribute(name) {
    return this.attrs[name] || null;
  },
  closest() {
    return null;
  },
};

const extracted = extractLifecycleContractEvidence();
assert(extracted.activated === false, "extract activated false");
assert(Array.isArray(extracted.requests_executed) && extracted.requests_executed.length === 0, "extract no requests");
assert(globalThis.__EA_SAVEDATA_INVOKED !== true, "SaveData not invoked by extract");
assert(globalThis.__EA_LIFECYCLE_HANDLER_FIRED !== true, "no handler fired");
const fromExtract = finalizeLifecycleContractEvidence(extracted);
assert(fromExtract.controls.some((c) => c.id === "save_btn"), "extract sees save_btn");
const saveControl = fromExtract.controls.find((c) => c.id === "save_btn");
assert(
  saveControl && saveControl.candidate_role !== "final_submit_candidate",
  "#save_btn is not terminal role",
);

// Direct role checks via a minimal document re-extract with injected nodes
const roleDoc = parseHtml(`<!DOCTYPE html><html><body>
  <button type="submit" id="menuBtn">Menu</button>
  <button type="submit" id="refreshBtn">Refresh</button>
  <button type="submit" id="logoutBtn">Logout</button>
  <button type="submit" id="save_btn" onclick="SaveData()">Submit</button>
  <a class="Submit" href="#" onclick="submitProduct(9)">Submit</a>
</body></html>`);
globalThis.document = roleDoc;
globalThis.SaveData = function SaveData() {
  globalThis.__EA_SAVEDATA_INVOKED = true;
};
globalThis.submitProduct = function submitProduct() {
  globalThis.__EA_LIFECYCLE_HANDLER_FIRED = true;
};
globalThis.__EA_SAVEDATA_INVOKED = false;
globalThis.__EA_LIFECYCLE_HANDLER_FIRED = false;
const roleExtract = extractLifecycleContractEvidence();
assert(globalThis.__EA_SAVEDATA_INVOKED !== true, "role extract did not invoke SaveData");
assert(globalThis.__EA_LIFECYCLE_HANDLER_FIRED !== true, "role extract did not invoke submitProduct");
const roles = Object.fromEntries(roleExtract.controls.map((c) => [c.id || c.text || c.className || Math.random(), c]));
const menu = roleExtract.controls.find((c) => c.id === "menuBtn" || c.text === "Menu");
const refresh = roleExtract.controls.find((c) => c.id === "refreshBtn" || c.text === "Refresh");
const logout = roleExtract.controls.find((c) => c.id === "logoutBtn" || c.text === "Logout");
const saveRole = roleExtract.controls.find((c) => c.id === "save_btn");
const rowRole = roleExtract.controls.find((c) => /submitproduct/i.test(String(c.onclick_preview || "")) && /Submit/i.test(String(c.text || "")));
assert(menu && menu.candidate_role === "chrome_navigation", "Menu not lifecycle save/submit");
assert(refresh && refresh.candidate_role === "chrome_navigation", "Refresh not lifecycle save/submit");
assert(logout && logout.candidate_role === "chrome_navigation", "Logout not lifecycle save/submit");
assert(saveRole && saveRole.candidate_role === "save_or_submit_ambiguous", "#save_btn save candidate role");
assert(rowRole && rowRole.candidate_role === "final_submit_candidate", "row .Submit → terminal candidate role");
assert(
  !assessShellCreateEvidence({
    controls: roleExtract.controls,
    functions: [{ name: "SaveData" }],
    requests: shell.requests,
  }).criteria.initiating_control === false ||
    roleExtract.controls.filter((c) => c.candidate_role === "chrome_navigation").every((c) => c.candidate_role === "chrome_navigation"),
  "chrome controls classified non-lifecycle",
);
const shellWithChrome = assessShellCreateEvidence({
  controls: [
    { id: "menuBtn", candidate_role: "chrome_navigation" },
    { id: "save_btn", candidate_role: "save_or_submit_ambiguous" },
  ],
  functions: [{ name: "SaveData" }],
  requests: shell.requests,
});
assert(shellWithChrome.criteria.initiating_control === true, "chrome ignored; save_btn still initiates");
assert(
  assessShellCreateEvidence({
    controls: [{ id: "menuBtn", candidate_role: "chrome_navigation" }],
    functions: [{ name: "SaveData" }],
    requests: shell.requests,
  }).criteria.initiating_control === false,
  "chrome alone does not satisfy initiating_control",
);

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
assert(/GetproductDataUpdate/i.test(contract.reread.evidence_note), "reread note mentions GetproductDataUpdate");
assert(/SaveProductData/i.test(contract.saveUpdate.evidence_note), "saveUpdate note mentions SaveProductData");

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

const secretSource = `function SaveData(){ $.ajax({url:"../admin/SaveProductData",type:"POST",data:{x:1}}); }`;
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

// Avoid unused var lint-style noise in smoke
void roles;
void rowSubmit;

if (failed) {
  console.error(`eaushadhi-worker-lifecycle-contract-capture-smoke: ${failed} failure(s)`);
  process.exit(1);
}
console.log("eaushadhi-worker-lifecycle-contract-capture-smoke: all assertions passed");
