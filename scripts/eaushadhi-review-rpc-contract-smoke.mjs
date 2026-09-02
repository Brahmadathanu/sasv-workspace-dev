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

assert(!/\.from\(\s*["']regulatory/i.test(combined), "no direct regulatory table access");
assert(!/playwright/i.test(combined), "no Playwright");
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
assert(!/rpc_eaushadhi_register_approved_product_copy/.test(controlSrc), "v1 does not call copy registration");
assert(!/p_product_id:\s*null/.test(apiSrc), "review queue is never called with null product id");

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

if (failed) {
  console.error(`\n${failed} RPC contract assertion(s) failed`);
  process.exit(1);
}
console.log("\neaushadhi-review-rpc-contract-smoke: all assertions passed");
