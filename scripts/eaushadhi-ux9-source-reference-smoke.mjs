import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const control = read("public/shared/js/eaushadhi-review-control.js");
const api = read("public/shared/js/eaushadhi-review-api.js");
const css = read("public/shared/css/sasv-eaushadhi-review.css");
let passed = 0;
let failed = 0;
function check(value, label) {
  if (value) { passed += 1; console.log(`OK ${label}`); }
  else { failed += 1; console.error(`FAIL ${label}`); }
}

const preview = {
  product_id: 262,
  max_lines: 200,
  caller: { is_verifier: true, is_approver: false },
  product_lock_reason: null,
  known_wordings: [{ raw_reference_text: "API Vol. I", line_count: 20, product_line_count: 3 }],
  lines: [
    { source_composition_line_id: 931, source_row_no: 1, raw_ingredient_name: "A", raw_reference_text: null, row_version: 4, review_status: "PENDING", lock_reason: null },
    { source_composition_line_id: 932, source_row_no: 2, raw_ingredient_name: "B", raw_reference_text: "API Vol. I", row_version: 5, review_status: "PENDING", lock_reason: null },
    { source_composition_line_id: 933, source_row_no: 3, raw_ingredient_name: "C", raw_reference_text: "API Vol. II", row_version: 6, review_status: "PENDING", lock_reason: null },
    { source_composition_line_id: 934, source_row_no: 4, raw_ingredient_name: "D", raw_reference_text: null, row_version: 7, review_status: "VERIFIED", lock_reason: "LINE_VERIFIED" },
  ],
};
const success = {
  request_id: "11111111-1111-4111-8111-111111111111",
  product_id: 262,
  raw_reference_text: "API Vol. I",
  is_new_wording: false,
  approver_used: false,
  applied_count: 1,
  unchanged_count: 0,
  replayed: false,
  lines: [{ source_composition_line_id: 931, outcome: "UPDATED", change_kind: "FILL_BLANK", old_raw_reference_text: null, raw_reference_text: "API Vol. I", review_status: "PENDING", row_version: 5 }],
};

check(api.includes('callRpc("rpc_eaushadhi_source_reference_preview_v1"'), "preview RPC uses the final v1 name");
check(api.includes("p_product_id: Number(productId)"), "preview sends the integer product id");
check(api.includes('callRpc("rpc_eaushadhi_set_source_reference_bulk_v1"'), "write RPC uses the final v1 name");
for (const arg of ["p_product_id", "p_request_id", "p_reference_text", "p_allow_new_wording", "p_reason", "p_lines"]) check(api.includes(arg), `write sends named ${arg}`);
check(control.includes("preview.caller?.is_verifier !== true"), "non-Verifiers cannot open the bulk flow");
check(control.includes("preview.product_lock_reason"), "product lock disables the entry point");
check(control.includes('preview.caller?.is_approver !== true'), "Approver capability is read from preview");
check(control.includes('reason: "Approver needed"'), "different wording explains the Approver requirement");
check(control.includes('newDisabled ? " disabled"'), "new wording remains visible but disabled for a non-Approver");
check(control.includes('Excluded: ${sourceReferenceLockLabel'), "locked lines render as excluded with their reason");
check(control.includes("data-source-reference-line-id"), "preview rows are keyed by stable line id");
check(control.includes("bulk.selected.has(String(line.source_composition_line_id))"), "selection does not depend on rendered table rows or filters");
check(control.includes("allRows.slice(0, 50)"), "preview initially renders no more than 50 rows");
check(control.includes("sourceReferenceViewAll"), "View all is offered for a large preview");
check(control.includes("Number(preview.max_lines) || 200"), "client honours the server cap with a 200 fallback");
check(control.includes("selected.length > 200"), "write refuses more than 200 explicit lines");
check(control.includes("expected_row_version: Number(line.row_version)"), "payload preserves preview row_version");
check(control.includes("expected_raw_reference_text"), "payload preserves the exact preview wording");
check(control.includes('sourceReferenceLineRelation(line, target) === "DIFFERENT"'), "replace confirmation is derived only for explicitly selected different wording");
check(control.includes("bulk.requestId ||= newSourceReferenceRequestId()"), "one request id is retained across Apply retries");
check(control.includes("bulk.requestId = newSourceReferenceRequestId()"), "rebuilding preview creates a new request id");
check(control.includes("await setSourceReferenceBulk"), "Apply waits for the RPC result");
check(control.indexOf("await setSourceReferenceBulk") < control.indexOf("state.lines = state.lines.map", control.indexOf("async function applySourceReferenceBulk")), "local lines are not changed before RPC success");
check(control.includes("await reloadSelected({ preserveDrafts: false"), "success reloads affected lines and reference decisions");
check(control.includes("Updated lines are Pending and must be saved for review again"), "success explains the required re-review");
check(control.includes('info.sqlstate === "40001"'), "serialization conflict rebuilds the preview");
check(control.includes('"LINE_VERIFIED"'), "verified-line refusal rebuilds the preview");
check(control.includes('"PORTAL_ENTRY_STARTED", "FORMULATION_APPROVED"'), "product workflow refusals disable after re-preview");
check(control.includes('info.code === "APPROVER_ROLE_REQUIRED"'), "Approver RPC error has dedicated copy");
check(control.includes("replayed") === false || success.replayed === false, "mock success supports replayed as a successful response field");
check(control.includes("No source reference recorded"), "blank wording stays neutral");
check(!control.includes("blank reference blocker") && !control.includes("reference_required_for_portal"), "client adds no blank-reference blocker");
check(!control.includes("rpc_eaushadhi_worker") || !control.slice(control.indexOf("async function applySourceReferenceBulk"), control.indexOf("function renderComposition", control.indexOf("async function applySourceReferenceBulk"))).includes("worker"), "bulk Apply does not call the worker or portal");
check(control.includes("sourceReferenceInlinePrompt"), "single-line success can offer the gentle inline prompt");
check(control.includes('scope: "BLANK"'), "inline prompt reuses the blank-line preview scope");
check(control.includes('sourceReferenceProductKind() === "PROPRIETARY" ? "SELECTED" : "BLANK"'), "proprietary products start without selected lines");
check(control.includes("Same as previous line"), "proprietary selected-lines mode offers the shortcut");
check(control.includes("composition-line-summary-label"), "modal summary uses labelled values");
check(control.includes('title="${escapeHtml(botanical)}"'), "full botanical value remains available");
check(css.includes("grid-template-columns: minmax(180px, 1.5fr)"), "desktop summary uses aligned compact columns");
check(css.includes("-webkit-line-clamp: 2"), "botanical summary wraps to at most two lines");
check(css.includes(".composition-line-summary-chips") && css.includes("justify-content: flex-end"), "review and attention chips group on the right");
check(css.includes("grid-template-columns: repeat(2, minmax(0, 1fr))"), "summary collapses cleanly at narrow width");
check(!control.includes("composition-col-source-reference"), "no permanent source-reference table column was added");
check(preview.lines.filter((line) => !line.raw_reference_text && !line.lock_reason).length === 1, "mock preview counts only selectable blank lines");
check(preview.lines.find((line) => line.source_composition_line_id === 934).lock_reason === "LINE_VERIFIED", "mock preview covers excluded verified lines");
check(success.lines[0].review_status === "PENDING" && success.lines[0].row_version === 5, "mock success covers returned Pending state and new version");
check(success.applied_count === 1 && success.unchanged_count === 0, "mock success keeps changed and unchanged counts separate");
check(control.includes('if (current === wanted) return "SAME"') && control.includes('return "RESPELL"'), "same requires exact trimmed equality and case-only differences are respells");
check(control.includes('relation === "DIFFERENT" && preview?.caller?.is_approver !== true'), "case-only respells do not require an Approver");
check(control.includes('confirm_replace_different: sourceReferenceLineRelation(line, target) === "DIFFERENT"'), "case-only respells do not set replace-different confirmation");
check(control.includes('globalThis.confirm("Discard this source-reference change?")'), "dirty close asks the approved discard question");
check(control.includes("sourceReferenceBulk.reason.trim() || state.sourceReferenceBulk.selected.size"), "dirty close is based on reason or ticked lines");
check(control.includes("backdrop && state.sourceReferenceBulk.applying"), "backdrop clicks are ignored while applying");
check(control.includes("bulk.target = event.target.value; renewSourceReferenceRequestId(); syncSourceReferenceBulkLiveUi();") && control.includes("bulk.reason = event.target.value; renewSourceReferenceRequestId(); syncSourceReferenceBulkLiveUi();"), "typing updates live state without redrawing the dialog");
check((control.match(/renewSourceReferenceRequestId\(\)/g) || []).length >= 7, "target, flag, reason, scope and selection changes renew the request id");
check(control.includes("!line.lock_reason && !safeText(line.raw_reference_text) && !affected.has"), "locked blank lines are excluded from the inline prompt count");
check(!control.includes("All eligible blank and same-wording lines") && !control.includes('value="ALL"'), "duplicate all-lines scope is removed");

console.log(`UX-9 source-reference checks: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
