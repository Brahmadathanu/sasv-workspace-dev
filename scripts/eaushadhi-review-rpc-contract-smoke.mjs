/**
 * e-Aushadhi Review & Control — static RPC / safety contract smoke.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("OK", msg);
  }
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const apiSrc = readFileSync(join(root, "public/shared/js/eaushadhi-review-api.js"), "utf8");
const helpersSrc = readFileSync(join(root, "public/shared/js/eaushadhi-review-helpers.js"), "utf8");
const controlSrc = readFileSync(join(root, "public/shared/js/eaushadhi-review-control.js"), "utf8");
const htmlSrc = readFileSync(join(root, "public/shared/e-aushadhi-review-control.html"), "utf8");
const cssSrc = readFileSync(join(root, "public/shared/css/sasv-eaushadhi-review.css"), "utf8");
const workerClientSrc = readFileSync(join(root, "public/shared/js/eaushadhi-review-worker-client.js"), "utf8");
const indexSrc = readFileSync(join(root, "index.html"), "utf8");
const combined = `${apiSrc}\n${helpersSrc}\n${controlSrc}\n${htmlSrc}`;

const requiredRpcs = [
  "rpc_eaushadhi_product_queue",
  "rpc_eaushadhi_review_queue",
  "rpc_eaushadhi_portal_options",
  "rpc_eaushadhi_permission_purpose_options",
  "rpc_eaushadhi_save_line_review",
  "rpc_eaushadhi_product_review_get",
  "rpc_eaushadhi_product_review_save",
  "rpc_eaushadhi_pharmacological_action_options",
  "rpc_eaushadhi_product_actions_get",
  "rpc_eaushadhi_product_actions_save",
  "rpc_eaushadhi_product_evidence_status",
  "rpc_eaushadhi_product_issues",
  "rpc_eaushadhi_promote_verified_formulation",
  "rpc_eaushadhi_verify_product",
  "rpc_eaushadhi_source_issue_context",
  "rpc_eaushadhi_resolve_source_issue",
  "rpc_eaushadhi_correct_working_source_line",
  "rpc_eaushadhi_reopen_line_review",
  "rpc_eaushadhi_reopen_product_review",
  "rpc_eaushadhi_reopen_product_actions",
  "rpc_eaushadhi_approved_product_copy_get",
  "rpc_eaushadhi_register_approved_product_copy",
  "rpc_eaushadhi_worker_preflight",
  "rpc_eaushadhi_worker_payload_get",
];

for (const name of requiredRpcs) {
  assert(apiSrc.includes(`"${name}"`), `adapter calls ${name}`);
}

assert(
  apiSrc.includes("p_product_id: id") &&
    apiSrc.includes("rpc_eaushadhi_review_queue") &&
    apiSrc.includes("p_product_id is required"),
  "review queue requires p_product_id",
);

const saveLineArgs = [
  "p_source_composition_line_id",
  "p_expected_row_version",
  "p_ingredient_type_option_id",
  "p_ingredient_form_option_id",
  "p_part_used_option_id",
  "p_measurement_option_id",
  "p_verify",
  "p_review_notes",
];
for (const arg of saveLineArgs) {
  assert(apiSrc.includes(`${arg}:`), `save_line_review arg ${arg}`);
}

const reviewSaveArgs = [
  "p_product_id",
  "p_expected_row_version",
  "p_permission_purpose_term_id",
  "p_composition_title",
  "p_diseases_conditions_text",
  "p_contains_bhang",
  "p_contains_opium",
  "p_contains_other_narcotic",
  "p_contains_schedule_e1",
  "p_contains_self_generated_alcohol",
  "p_review_notes",
  "p_verify",
];
for (const arg of reviewSaveArgs) {
  assert(apiSrc.includes(`${arg}:`), `product_review_save arg ${arg}`);
}

assert(apiSrc.includes("p_expected_workflow_row_version:"), "actions/promote use workflow row version");
assert(apiSrc.includes("p_actions:"), "actions save uses p_actions");
assert(apiSrc.includes("p_approval_notes:"), "promote uses p_approval_notes");
assert(apiSrc.includes("p_notes:"), "verify product uses p_notes");
assert(apiSrc.includes("p_confirm_current_identity:"), "source resolve uses p_confirm_current_identity");
assert(apiSrc.includes("p_expected_resolution_id:"), "source resolve uses p_expected_resolution_id");
assert(apiSrc.includes("p_part_used_term_id:"), "source resolve uses p_part_used_term_id");
assert(apiSrc.includes("p_resolution_notes:"), "source resolve uses p_resolution_notes");
assert(apiSrc.includes("p_raw_ingredient_name:"), "source correct uses p_raw_ingredient_name");
assert(apiSrc.includes("p_raw_scientific_name:"), "source correct uses p_raw_scientific_name");
assert(apiSrc.includes("p_raw_part_used:"), "source correct uses p_raw_part_used");
assert(apiSrc.includes("p_raw_quantity_text:"), "source correct uses p_raw_quantity_text");
assert(apiSrc.includes("p_raw_quantity_value:"), "source correct uses p_raw_quantity_value");
assert(apiSrc.includes("p_raw_unit_text:"), "source correct uses p_raw_unit_text");
assert(apiSrc.includes("p_correction_reason:"), "source correct uses p_correction_reason");
assert(apiSrc.includes("p_reason:"), "reopen RPCs use p_reason");
assert(apiSrc.includes("p_storage_bucket:"), "copy register uses p_storage_bucket");
assert(apiSrc.includes("p_storage_path:"), "copy register uses p_storage_path");
assert(apiSrc.includes("p_original_file_name:"), "copy register uses p_original_file_name");
assert(apiSrc.includes("p_mime_type:"), "copy register uses p_mime_type");
assert(apiSrc.includes("p_file_size_bytes:"), "copy register uses p_file_size_bytes");
assert(apiSrc.includes("p_content_sha256:"), "copy register uses p_content_sha256");
assert(helpersSrc.includes("eaushadhi-evidence"), "private evidence bucket is used");
assert(helpersSrc.includes("approved-product-copy/"), "approved copy path prefix is used");
assert(controlSrc.includes("Verify line"), "composition verify line wording");
assert(controlSrc.includes("data-source-correct"), "correct source action exists");
assert(!/Save progress/.test(controlSrc + htmlSrc), "routine save progress button removed");
assert(!/Save as In Review/.test(controlSrc + htmlSrc), "routine save as in review buttons removed");
assert(
  controlSrc.includes("Verify reviewed lines") || htmlSrc.includes("Verify reviewed lines"),
  "verify reviewed lines action exists",
);
assert(controlSrc.includes("verifyReviewedConfirmLabel"), "verify reviewed confirm label helper is used");
assert(controlSrc.includes("canVerifyProductDetails"), "product details verify eligibility is used");
assert(controlSrc.includes("canVerifyCompositionLine"), "line verify eligibility is used");
assert(controlSrc.includes("canVerifyActionSet"), "actions verify eligibility is used");
assert(!/Verify \$\{eligible\} reviewed lines/.test(controlSrc), "zero-count verify label is not interpolated directly");

{
  const renderStart = controlSrc.indexOf("function renderComposition()");
  const renderEnd = controlSrc.indexOf("\nfunction ", renderStart + 1);
  const renderFn = controlSrc.slice(renderStart, renderEnd === -1 ? undefined : renderEnd);
  const declIdx = renderFn.indexOf("const saveStatus = state.lineSaveStatus.get(String(id))");
  const useIdx = renderFn.indexOf("lineVerifyPendingCopy");
  assert(declIdx !== -1 && useIdx !== -1 && declIdx < useIdx, "renderComposition declares saveStatus before first verify use");
  assert((renderFn.match(/const saveStatus =/g) || []).length === 1, "renderComposition has exactly one saveStatus declaration");
}
assert(controlSrc.includes("data-bool-key=\"combinedRestricted\""), "restricted declarations use one combined control");
assert(controlSrc.includes("data-action-vocab-toggle"), "actions vocabulary is a multi-select checklist");
assert(!/\b46\b/.test(controlSrc), "pharmacological action terms are not hard-coded as 46");
assert(apiSrc.includes("rpc_eaushadhi_pharmacological_action_options"), "action vocabulary remains server-supplied");
assert(controlSrc.includes("registerApprovedProductCopy"), "copy registration is called after upload");
assert(controlSrc.includes("createSignedUrl") || apiSrc.includes("createSignedUrl"), "private copy open uses signed URL");
assert(!/correctAll|correct all sources|auto.?correct/i.test(controlSrc), "no bulk/auto source correction");
assert(
  !/[·…←→↑↓—]/.test(controlSrc + htmlSrc) && !/Â·|â€/.test(controlSrc + htmlSrc),
  "module-authored UI literals avoid mojibake-prone punctuation",
);
assert(controlSrc.includes("data-source-resolve"), "resolve source issue action exists");
assert(!/resolveAll|resolve all issues|auto.?resolve/i.test(controlSrc), "no bulk/auto source resolve");

assert(!/\.from\(\s*["']regulatory/i.test(combined), "no direct regulatory table access");
assert(!/playwright/i.test(combined), "no Playwright");
assert(!/playwright/i.test(workerClientSrc), "worker client has no Playwright");
assert(!/captcha/i.test(combined), "no CAPTCHA automation");
assert(!/sop-attachments|tally-raw/.test(combined), "no SOP/tally bucket reuse");
assert(htmlSrc.includes("ea-icon-search"), "inline SVG search icon exists");
assert(htmlSrc.includes('stroke="currentColor"'), "search SVG uses currentColor");
assert(htmlSrc.includes('aria-label="Clear search"'), "clear search is labelled");
assert(!/mask:\s*url\(/.test(cssSrc), "no CSS mask search icon");
assert(helpersSrc.includes("filterCompositionLines"), "composition filter helper exists");
assert(controlSrc.includes("nextRovingIndex"), "roving keyboard helper is used");
assert(controlSrc.includes("role=\"tab\""), "workflow stages are tabs");
assert(!/verify all|bulkVerify|bulk_verify|verifyAll/i.test(combined), "no bulk verify");
assert(apiSrc.includes("rpc_eaushadhi_register_approved_product_copy"), "approved copy registration RPC is retained");
assert(!/p_product_id:\s*null/.test(apiSrc), "review queue is never called with null product id");

assert(htmlSrc.includes("sasv-modal sasv-modal--lg"), "correct source uses canonical large modal");
assert(!/sourceCorrectDialog[\s\S]{0,80}style=/i.test(htmlSrc), "correct source has no inline modal width");
assert(
  !/--ea-modal-width|max-width:\s*520px|max-width:\s*480px/.test(cssSrc),
  "no obsolete e-Aushadhi custom modal width",
);
assert(cssSrc.includes("--sasv-text-sm"), "module CSS consumes --sasv-text-sm");
assert(cssSrc.includes("--sasv-text-xs"), "module CSS consumes --sasv-text-xs");
assert(cssSrc.includes("--sasv-text-lg"), "module CSS consumes --sasv-text-lg");
assert(cssSrc.includes("--sasv-font-sans"), "module CSS consumes --sasv-font-sans");
assert(cssSrc.includes("--sasv-control-md"), "module CSS consumes --sasv-control-md");
assert(cssSrc.includes("ea-identity-grid"), "correct source identity grid exists");
assert(cssSrc.includes("ea-quantity-grid"), "correct source quantity grid exists");
assert(controlSrc.includes("ea-callout"), "correct source intro uses callout");
assert(controlSrc.includes('srcCorrectIngredient")?.focus'), "source correct focuses first field");
assert(controlSrc.includes("userMessageForError"), "autosave uses public error messages");

assert(controlSrc.includes("module:e-aushadhi-automation"), "canonical permission target");
assert(controlSrc.includes("get_user_permissions"), "canonical permission RPC");
assert(controlSrc.includes("can_view === true"), "fail-closed strict can_view");
assert(htmlSrc.includes("id=\"workspaceTabs\""), "workspace tabs exist");
assert(htmlSrc.includes("Composition"), "composition tab copy");
assert(htmlSrc.includes("Readiness"), "readiness tab copy");
assert(htmlSrc.includes("ea-mode-queue"), "queue mode class is present");
assert(controlSrc.includes("ea-mode-product"), "product mode is applied in controller");
assert(controlSrc.includes("QUEUE_RENDER_CHUNK"), "progressive queue chunk is used");
assert(controlSrc.includes("renderedCount"), "queue view keeps renderedCount");
assert(helpersSrc.includes("nextRequiredAction"), "next required action helper exists");
assert(controlSrc.includes("data-provenance"), "composition provenance is labelled in markup");
assert(
  !/hasEaushadhiReview/.test(indexSrc),
  "e-Aushadhi Electron local fallback removed",
);
assert(
  indexSrc.includes("hasProductShelfLife"),
  "Product Shelf Life fallback remains",
);
assert(
  indexSrc.includes("hasStaffDirectory"),
  "Staff Directory fallback remains",
);
assert(controlSrc.includes("btnWorkerFoundation"), "Readiness has Foundation Check");
assert(controlSrc.includes("syncWorkerToolbarUi"), "worker toolbar has a canonical sync function");
assert(htmlSrc.includes('id="eaWorkerToolbar"'), "header contains the worker toolbar");
assert((htmlSrc.match(/id="btnWorkerConnect"/g) || []).length === 1, "exactly one Connect button");
assert((htmlSrc.match(/id="btnWorkerStop"/g) || []).length === 1, "exactly one Stop button");
assert((htmlSrc.match(/id="btnWorkerCapture"/g) || []).length === 1, "exactly one Capture button");
assert((htmlSrc.match(/id="btnWorkerOpenCapture"/g) || []).length === 1, "exactly one Open Capture Folder button");
assert((htmlSrc.match(/id="workerBrowserStatus"/g) || []).length === 1, "exactly one worker status node");
assert((htmlSrc.match(/id="btnWorkerFoundation"/g) || []).length === 0, "Foundation Check is not in static header HTML");
assert(htmlSrc.indexOf('id="eaWorkerToolbar"') < htmlSrc.indexOf('id="refreshBtn"'), "worker toolbar is left of Refresh");
assert(htmlSrc.indexOf('id="refreshBtn"') < htmlSrc.indexOf('id="homeBtn"'), "Refresh remains before HOME");
assert(htmlSrc.includes('data-edit-action="true"'), "header worker controls keep data-edit-action");
assert(
  /id="btnWorkerConnect"[^>]*data-edit-action="true"/.test(htmlSrc) &&
    /id="btnWorkerStop"[^>]*data-edit-action="true"/.test(htmlSrc) &&
    /id="btnWorkerCapture"[^>]*data-edit-action="true"/.test(htmlSrc) &&
    /id="btnWorkerOpenCapture"[^>]*data-edit-action="true"/.test(htmlSrc),
  "view-only permission still applies to global worker controls",
);
const foundationCardSrc = controlSrc.slice(
  controlSrc.indexOf("function renderWorkerFoundationCard"),
  controlSrc.indexOf("async function submitWorkerConnect"),
);
assert(foundationCardSrc.includes("btnWorkerFoundation"), "Readiness card still renders Foundation Check");
assert(!foundationCardSrc.includes("btnWorkerConnect"), "Readiness card does not render Connect");
assert(!foundationCardSrc.includes("btnWorkerStop"), "Readiness card does not render Stop");
assert(!foundationCardSrc.includes("btnWorkerCapture"), "Readiness card does not render Capture");
assert(!foundationCardSrc.includes("btnWorkerOpenCapture"), "Readiness card does not render Open Folder");
assert(!foundationCardSrc.includes("workerBrowserStatus"), "Readiness card does not own worker status id");
assert(!foundationCardSrc.includes("workerCaptureResult"), "Readiness card does not show capture summary");
const readinessClickSrc = controlSrc.slice(
  controlSrc.indexOf('$("tab-readiness")?.addEventListener("click"'),
  controlSrc.indexOf('$("tab-readiness")?.addEventListener("input"'),
);
assert(readinessClickSrc.includes("btnWorkerFoundation"), "Readiness click handles Foundation Check");
assert(!readinessClickSrc.includes("btnWorkerConnect"), "Readiness click does not handle Connect");
assert(!readinessClickSrc.includes("btnWorkerStop"), "Readiness click does not handle Stop");
assert(!readinessClickSrc.includes("btnWorkerCapture"), "Readiness click does not handle Capture");
assert(!readinessClickSrc.includes("btnWorkerOpenCapture"), "Readiness click does not handle Open Folder");
assert((controlSrc.match(/async function submitWorkerConnect/g) || []).length === 1, "one submitWorkerConnect definition");
assert((controlSrc.match(/async function submitWorkerStop/g) || []).length === 1, "one submitWorkerStop definition");
assert((controlSrc.match(/async function submitWorkerCapture/g) || []).length === 1, "one submitWorkerCapture definition");
assert((controlSrc.match(/async function submitWorkerOpenCapture/g) || []).length === 1, "one submitWorkerOpenCapture definition");
assert(controlSrc.includes('$("eaWorkerToolbar")?.addEventListener("click"'), "header worker listener is canonical");
assert(
  /onWorkerStatus\(\(status\) => \{[\s\S]*?syncWorkerToolbarUi\(\);/.test(controlSrc),
  "status subscription syncs the header toolbar",
);
const syncSrc = controlSrc.slice(
  controlSrc.indexOf("function syncWorkerToolbarUi"),
  controlSrc.indexOf("function refreshReadinessIfActive"),
);
assert(!syncSrc.includes("selectedProductId"), "toolbar sync is independent of selected product");
assert(controlSrc.includes('function toolbarWorkerStatusText()') && controlSrc.includes('return "Unavailable"'), "PWA toolbar status is Unavailable");
const openSrc = controlSrc.slice(
  controlSrc.indexOf("async function openProduct"),
  controlSrc.indexOf("async function reloadSelected"),
);
assert(openSrc.includes("workerFoundationResult = null"), "Foundation result clears on product switch");
assert(!openSrc.includes("workerStatus = null"), "worker status is not cleared on product switch");
assert(!openSrc.includes("workerCaptureResult = null"), "capture result is not cleared on product switch");
assert(controlSrc.includes("The dedicated e-Aushadhi browser worker is available only in the SASV Electron app"), "PWA Readiness note remains");
assert(!/screenshot/i.test(controlSrc), "Review UI does not request screenshots");
assert(controlSrc.includes("Internal verification is not portal entry"), "internal vs portal copy");
assert(workerClientSrc.includes("runFoundationCheck"), "worker client exposes foundation check");
assert(workerClientSrc.includes("capturePortalContract"), "worker client exposes portal contract capture");
assert(workerClientSrc.includes("openCaptureFolder"), "worker client exposes open capture folder");
assert(!/run_begin|mark_entered|mark_portal_verified|mark_submitted/i.test(apiSrc + controlSrc + workerClientSrc), "no lifecycle write wrappers");
assert(!/\bsubmit\b/i.test(workerClientSrc), "worker client has no Submit");

if (failed) {
  console.error(`\n${failed} RPC contract assertion(s) failed`);
  process.exit(1);
}
console.log("\neaushadhi-review-rpc-contract-smoke: all assertions passed");
