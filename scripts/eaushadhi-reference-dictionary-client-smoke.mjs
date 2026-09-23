import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const html = read("public/shared/e-aushadhi-review-control.html");
const control = read("public/shared/js/eaushadhi-review-control.js");
const api = read("public/shared/js/eaushadhi-review-api.js");
const css = read("public/shared/css/sasv-eaushadhi-review.css");
const helperSource = read("public/shared/js/eaushadhi-reference-mapping.js");
const helpers = await import(`data:text/javascript;base64,${Buffer.from(helperSource).toString("base64")}`);

assert.match(html, /id="openReferenceDictionaryBtn"[^>]*>Reference Dictionary</);
assert.match(html, /<section id="referenceDictionaryPanel"/);
assert.match(html, /Source Reference Dictionary/);
assert.match(html, /Canonical to e-Aushadhi Reference Mappings/);
assert.doesNotMatch(html.match(/id="workspaceTabs"[\s\S]*?<\/div>/)?.[0] || "", /Reference Dictionary/);
assert.match(control, /classList\.toggle\("ea-mode-reference-dictionary", mode === "reference-dictionary"\)/);
assert.match(css, /ea-mode-reference-dictionary #referenceDictionaryPanel/);
assert.match(css, /ea-mode-reference-dictionary #queuePanel/);
assert.match(css, /ea-mode-reference-dictionary #workspacePanel/);

const workspaceLoader = api.slice(api.indexOf("export async function loadProductWorkspace"));
assert.doesNotMatch(workspaceLoader, /fetchReferenceDictionary/);
assert.match(control, /async function openReferenceDictionary\(\)[\s\S]*?loadReferenceDictionary\(\)/);
assert.match(control, /refreshReferenceDictionaryBtn[\s\S]*?loadReferenceDictionary\(\{ force: true \}\)/);

const fixture = Array.from({ length: 33 }, (_, index) => ({
  source_reference_text: `Source ${index}`,
  line_count: index + 1,
  product_count: 1,
  alias_mapping_id: index < 2 ? index + 1 : null,
  alias_mapping_status: index < 2 ? "DRAFT" : null,
  canonical_term_id: index < 2 ? 28 : null,
  canonical_code: index < 2 ? "SAHASRAYOGAM" : null,
  canonical_label: index < 2 ? "Sahasrayogam" : null,
  portal_mapping_id: index < 2 ? 90 : null,
  portal_mapping_status: index < 2 ? "DRAFT" : null,
  portal_external_id: index < 2 ? "28" : null,
  portal_label: index < 2 ? "Sahasrayoga" : null,
  reference_ready: false,
}));
assert.equal(helpers.filterReferenceDictionary(fixture).length, 33);
assert.equal(helpers.filterReferenceDictionary(fixture, { search: "sahasrayoga" }).length, 2);
assert.equal(helpers.filterReferenceDictionary(fixture, { search: "28" }).length, 3);
assert.equal(helpers.filterReferenceDictionary(fixture, { statusFilter: "mapping-required" }).length, 33);
assert.equal(helpers.filterReferenceDictionary(fixture, { statusFilter: "suggested" }).length, 2);
assert.equal(helpers.dedupeCanonicalReferenceMappings(fixture).length, 1);
assert.equal(helpers.dedupeCanonicalReferenceMappings(fixture)[0].source_alias_count, 2);

assert.match(control, /Number\(row\?\.line_count \|\| 0\).*Number\(row\?\.product_count \|\| 0\)/s);
assert.match(control, /data-reference-source-create=/);
assert.match(control, /data-reference-source-review=/);
assert.match(control, /data-reference-portal-create=/);
assert.match(control, /data-reference-portal-review=/);
const sourceRender = control.slice(control.indexOf("const sourceHost"), control.indexOf("const canonicalHost"));
assert.doesNotMatch(sourceRender, /data-reference-portal-(?:create|review)/);
assert.match(sourceRender, /!row\.alias_mapping_id[\s\S]*?Create\/review source mapping/);
assert.match(sourceRender, /aliasStatus === "DRAFT"[\s\S]*?Review source mapping/);
const canonicalRender = control.slice(control.indexOf("const canonicalHost"), control.indexOf("applyPermissionUi();", control.indexOf("const canonicalHost")));
assert.match(canonicalRender, /dedupeCanonicalReferenceMappings\(rows\)/);
assert.match(canonicalRender, /!row\.portal_mapping_id[\s\S]*?Create\/review portal mapping/);
assert.match(canonicalRender, /portalStatus === "DRAFT"[\s\S]*?Review portal mapping/);

for (const rpc of [
  "rpc_eaushadhi_reference_dictionary_get",
  "rpc_eaushadhi_reference_alias_candidates",
  "rpc_eaushadhi_reference_alias_draft_create",
  "rpc_eaushadhi_reference_alias_verify",
  "rpc_eaushadhi_reference_work_options",
  "rpc_eaushadhi_reference_work_create",
  "rpc_eaushadhi_reference_portal_mapping_draft_create",
]) assert.match(api, new RegExp(rpc));
assert.match(api, /rpc_eaushadhi_reference_alias_draft_create", \{\s*p_source_reference_text:[\s\S]*?p_controlled_term_id:[\s\S]*?\}\)/);
assert.match(api, /rpc_eaushadhi_reference_alias_verify", \{\s*p_alias_mapping_id:[\s\S]*?p_expected_status:[\s\S]*?p_controlled_term_id:[\s\S]*?\}\)/);
assert.match(api, /rpc_eaushadhi_reference_portal_mapping_draft_create", \{\s*p_controlled_term_id:[\s\S]*?p_portal_option_id:[\s\S]*?\}\)/);
assert.doesNotMatch(api, /p_(?:canonical_label|portal_label|match_basis|comparison_evidence|line_count|product_count|verified_by|verified_at)/);

assert.match(control, /Candidate guidance \(diagnostic only\)/);
assert.match(control, /createReferenceAliasDraft[\s\S]*?loadReferenceDictionary\(\{ force: true \}\)/);
assert.doesNotMatch(control.match(/async function openSourceAliasCreate[\s\S]*?function openReferenceWorkCreate/)?.[0] || "", /verifyReferenceAlias/);
assert.match(control, /Changing the suggested Reference Work will be recorded as a manual mapping\./);
assert.match(control, /Creates a reusable global canonical Reference Work\. It does not create an e-Aushadhi portal mapping automatically\./);
assert.match(control, /Creates a global draft mapping\. Verification is a separate step\./);
assert.match(control, /Changing the suggested option will be recorded as a manual mapping\./);

assert.doesNotMatch(control, /data-reference-review=|isReferenceActionOwner|openReferenceMappingReview/);
assert.doesNotMatch(control, /suggested_reference_work_term_id|selected_reference_work_term_id/);
assert.match(control, /reference\?\.reference_ready === true[\s\S]*?referenceGovernanceLabel\(reference\)/);
assert.equal(helpers.referenceGovernanceLabel({ reference_ready: false }), "Global reference mapping required");
assert.equal(helpers.referenceGovernanceLabel({ reference_ready: true }), "Verified globally");
assert.match(css, /reference-dictionary-modal \.modal-card[\s\S]*?padding: 22px 26px/);
assert.match(css, /max-width: 720px[\s\S]*?reference-dictionary-modal \.modal-card[\s\S]*?padding: 16px 18px/);
assert.match(control, /aria-describedby=/);
assert.match(control, /dialog\.showModal\(\)/);
assert.doesNotMatch(`${api}\n${control}`, /SaveData|DeleteCompositionData|GetCompositionDataUpdate/);

console.log("eaushadhi global Reference Dictionary client smoke: PASS");
