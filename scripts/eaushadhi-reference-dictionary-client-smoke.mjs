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
const reviewHelperSource = read("public/shared/js/eaushadhi-review-helpers.js");
const reviewHelpers = await import(`data:text/javascript;base64,${Buffer.from(reviewHelperSource).toString("base64")}`);

assert.doesNotMatch(html, /id="kpiStrip"/);
assert.doesNotMatch(control, /renderKpis|kpiStrip|data-kpi|queueKpis/);
assert.equal("queueKpis" in reviewHelpers, false);
assert.doesNotMatch(css, /body\.sasv-eaushadhi-review[^\n{]*\.kpi(?:-strip|\s|\.|:|\{)/);
assert.match(html, /id="reviewLenses"/);
assert.deepEqual(
  reviewHelpers.REVIEW_LENSES.map((item) => item.label),
  ["All", "Pending", "In Review", "Verified", "Blocked", "Ready"],
);
assert.match(control, /reviewLenses[\s\S]*?addEventListener\("click"[\s\S]*?state\.queueView\.reviewLens[\s\S]*?applyQueueFilterChange/);
assert.match(control, /reviewLenses[\s\S]*?addEventListener\("keydown"[\s\S]*?handleRovingKey/);
assert.match(control, /reviewLens:\s*state\.queueView\.reviewLens/);
assert.match(control, /function filteredQueue\(\)[\s\S]*?filterQueueRows/);
assert.match(html, /id="queueRowCount"/);
assert.match(control, /queueRowCount[\s\S]*?formatShowingCount/);
assert.match(html, /id="systemLenses"/);
assert.match(html, /id="classLenses"/);
assert.match(html, /id="queueTableWrap"[\s\S]*?id="queueTbody"/);
assert.match(html, /id="workspacePanel"/);
assert.equal((html.match(/id="openReferenceDictionaryBtn"/g) || []).length, 1);
const headerActions = html.match(/<div class="header-actions">([\s\S]*?)<\/div>\s*<\/div>/)?.[1] || "";
assert.match(headerActions, /id="openReferenceDictionaryBtn"[^>]*>Reference Dictionary</);
assert.ok(headerActions.indexOf('id="openReferenceDictionaryBtn"') < headerActions.indexOf('id="eaWorkerToolbar"'));
assert.doesNotMatch(html, /queue-global-actions/);
assert.doesNotMatch(css, /queue-global-actions/);
assert.doesNotMatch(html, /id="referenceDictionarySummary"|reference-dictionary-summary/);
assert.doesNotMatch(control, /referenceDictionarySummary|Distinct source references/);
assert.match(html, /<section id="referenceDictionaryPanel"/);
assert.match(html, /Source Reference Dictionary/);
assert.match(html, /Canonical to e-Aushadhi Reference Mappings/);
assert.doesNotMatch(html.match(/id="workspaceTabs"[\s\S]*?<\/div>/)?.[0] || "", /Reference Dictionary/);
assert.match(control, /classList\.toggle\("ea-mode-reference-dictionary", mode === "reference-dictionary"\)/);
assert.match(css, /ea-mode-reference-dictionary #referenceDictionaryPanel/);
assert.match(css, /ea-mode-reference-dictionary #queuePanel/);
assert.match(css, /ea-mode-reference-dictionary #workspacePanel/);

const mainPanel = html.match(/<div id="mainPanel">([\s\S]*?)<script type="module"/)?.[1] || "";
const topLevelSurfaces = [...mainPanel.matchAll(/\n      <section id="(queuePanel|referenceDictionaryPanel|workspacePanel)"/g)].map((match) => match[1]);
assert.deepEqual(topLevelSurfaces, ["queuePanel", "referenceDictionaryPanel", "workspacePanel"]);
assert.match(html, /<section id="queuePanel">/);
assert.match(html, /<section id="referenceDictionaryPanel"[^>]*aria-hidden="true"[^>]*inert[^>]*hidden/);
assert.match(html, /<section id="workspacePanel"[^>]*aria-hidden="true"[^>]*inert[^>]*hidden/);
const modeAuthority = control.match(/function setAppMode\(mode\)[\s\S]*?\n}/)?.[0] || "";
assert.match(modeAuthority, /queue:\s*"queuePanel"/);
assert.match(modeAuthority, /product:\s*"workspacePanel"/);
assert.match(modeAuthority, /"reference-dictionary":\s*"referenceDictionaryPanel"/);
assert.match(modeAuthority, /panel\.hidden = !active/);
assert.match(modeAuthority, /panel\.inert = !active/);
assert.match(modeAuthority, /panel\.removeAttribute\("aria-hidden"\)/);
assert.match(modeAuthority, /panel\.setAttribute\("aria-hidden", "true"\)/);
assert.match(modeAuthority, /dictionaryActive = mode === "reference-dictionary"/);
assert.match(modeAuthority, /dictionaryButton\.disabled = dictionaryActive/);
assert.match(modeAuthority, /dictionaryButton\.setAttribute\("aria-disabled", String\(dictionaryActive\)\)/);
assert.match(control, /async function initPage\(\) \{\s*setAppMode\("queue"\)/);
assert.match(control, /backFromReferenceDictionaryBtn[\s\S]*?closeWorkerMenu\(\)[\s\S]*?setAppMode\("queue"\)[\s\S]*?openReferenceDictionaryBtn[^\n]*focus/);
assert.match(css, /#mainPanel > section\[hidden\][\s\S]*?display: none !important/);

assert.equal((html.match(/id="referenceDictionaryFilterBtn"/g) || []).length, 1);
const filterTrigger = html.match(/<button id="referenceDictionaryFilterBtn"[\s\S]*?<\/button>/)?.[0] || "";
assert.match(filterTrigger, /class="icon-btn"/);
assert.match(filterTrigger, /title="Filter Reference Dictionary"/);
assert.match(filterTrigger, /aria-label="Filter Reference Dictionary"/);
assert.match(filterTrigger, /aria-haspopup="menu"/);
assert.match(filterTrigger, /aria-controls="referenceDictionaryFilterMenu"/);
assert.match(filterTrigger, /aria-expanded="false"/);
assert.match(filterTrigger, /ea-icon-filter/);
assert.doesNotMatch(filterTrigger.replace(/<svg[\s\S]*?<\/svg>/, ""), />\s*Filter[^<]*</);
assert.equal((html.match(/id="referenceDictionaryFilterMenu"/g) || []).length, 1);
const filterMenu = html.match(/<div id="referenceDictionaryFilterMenu"[\s\S]*?<\/div>/)?.[0] || "";
assert.match(filterMenu, /role="menu"[^>]*hidden/);
for (const [value, label] of [["all", "All"], ["mapping-required", "Mapping required"], ["suggested", "Suggested"], ["ready", "Ready"]]) {
  assert.match(filterMenu, new RegExp(`role="menuitemradio"[^>]*data-reference-filter="${value}"[^>]*>${label}<`));
}
assert.match(control, /state\.referenceDictionary\.statusFilter = value/);
assert.match(control, /option\.dataset\.referenceFilter === state\.referenceDictionary\.statusFilter/);
assert.match(control, /openReferenceDictionaryFilterMenu\(\)[\s\S]*?menu\.hidden = false[\s\S]*?aria-expanded", "true"/);
assert.doesNotMatch(control.match(/function openReferenceDictionaryFilterMenu\(\)[\s\S]*?\n}/)?.[0] || "", /fetch|rpc|create|verify|save/i);
assert.match(control, /event\.key === "Escape"[\s\S]*?closeReferenceDictionaryFilterMenu\(\{ restoreFocus: true \}\)/);
assert.match(control, /referenceDictionaryFilterMenuOpen[\s\S]*?closest\("\.reference-dictionary-filter-control"\)[\s\S]*?closeReferenceDictionaryFilterMenu\(\)/);
assert.match(control, /event\.key !== "ArrowDown" && event\.key !== "ArrowUp"[\s\S]*?items\[\(current \+ direction \+ items\.length\) % items\.length\]\.focus\(\)/);
assert.match(control, /selectReferenceDictionaryFilter[\s\S]*?statusFilter = value[\s\S]*?closeReferenceDictionaryFilterMenu\(\{ restoreFocus: true \}\)[\s\S]*?renderReferenceDictionary\(\)/);
assert.equal((html.match(/id="referenceDictionarySearch"/g) || []).length, 1);
assert.match(html, /reference-dictionary-filterbar[\s\S]*?referenceDictionaryFilterBtn[\s\S]*?class="search-wrap input-with-icon"[\s\S]*?ea-icon-search[\s\S]*?id="referenceDictionarySearch"/);
assert.match(control, /referenceDictionarySearch[^\n]*addEventListener\("input"[\s\S]*?state\.referenceDictionary\.search[\s\S]*?renderReferenceDictionary\(\)/);
assert.match(control, /const allRows = state\.referenceDictionary\.rows[\s\S]*?rows\.length[^\n]*allRows\.length[^\n]*source references shown/);
assert.match(css, /reference-dictionary-header h2[\s\S]*?font-size: var\(--sasv-text-lg\)[\s\S]*?font-weight: var\(--sasv-fw-semibold\)/);
assert.doesNotMatch(css, /reference-dictionary-summary/);

for (const heading of [
  "Source Reference", "Usage", "Canonical Reference Work", "Source to Canonical", "Overall", "Action",
  "e-Aushadhi Reference", "Canonical to Portal", "Source wordings",
]) assert.match(html, new RegExp(`<th scope="col">${heading}</th>`));
assert.equal((html.match(/class="reference-dictionary-table"/g) || []).length, 2);
assert.doesNotMatch(control, /<article class="reference-dictionary-card"/);
assert.doesNotMatch(html, /reference-dictionary-grid/);
assert.match(css, /ea-mode-reference-dictionary #referenceDictionaryPanel[\s\S]*?display: flex[\s\S]*?flex: 1/);
assert.match(css, /reference-dictionary-scroll[\s\S]*?display: grid/);
assert.match(css, /@media \(max-width: 720px\)[\s\S]*?reference-dictionary-table td::before[\s\S]*?content: attr\(data-label\)/);

assert.equal((html.match(/id="btnWorkerMenuTrigger"/g) || []).length, 1);
assert.doesNotMatch(html, /id="btnWorkerMore"|id="eaWorkerStatusChip"/);
assert.match(html, /id="btnWorkerMenuTrigger"[^>]*aria-haspopup="menu"[^>]*aria-controls="eaWorkerMenu"[^>]*aria-expanded="false"/);
assert.match(html, /id="btnWorkerMenuTrigger"[\s\S]*?Browser:[\s\S]*?id="workerBrowserStatus"/);
for (const id of ["btnWorkerConnect", "btnWorkerRecheckLogin", "btnWorkerStop", "btnWorkerCapture", "btnWorkerOpenCapture"]) {
  assert.equal((html.match(new RegExp(`id="${id}"`, "g")) || []).length, 1);
  assert.match(html, new RegExp(`id="${id}"[^>]*role="menuitem"`));
}
assert.doesNotMatch(control, /placeWorkerStop/);
assert.match(control, /syncWorkerActionVisibility\(connectPrimary\)/);
assert.match(control, /target\.closest\("#btnWorkerMenuTrigger"\)[\s\S]*?toggleWorkerMenu\(\)/);
assert.match(control, /openWorkerMenu\(\)[\s\S]*?querySelector\('\.ea-worker-menuitem:not\(\[hidden\]\):not\(:disabled\):not\(\[aria-disabled="true"\]\)'\)\?\.focus\(\)/);
assert.match(control, /event\.key === "Escape"[\s\S]*?closeWorkerMenu\(\{ restoreFocus: true \}\)/);
assert.match(control, /toolbar\.contains\(node\)[\s\S]*?closeWorkerMenu\(\)/);
assert.match(control, /event\.key !== "ArrowDown" && event\.key !== "ArrowUp"/);
const workerTriggerFlow = control.match(/if \(target\.closest\("#btnWorkerMenuTrigger"\)\)[\s\S]*?return;/)?.[0] || "";
assert.doesNotMatch(workerTriggerFlow, /submitWorker(?:Connect|RecheckLogin|Stop|Capture|OpenCapture)/);

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
  source_to_canonical_ready: false,
  canonical_to_portal_ready: false,
  reference_ready: false,
}));
assert.equal(helpers.filterReferenceDictionary(fixture).length, 33);
assert.equal(helpers.filterReferenceDictionary(fixture, { search: "sahasrayoga" }).length, 2);
assert.equal(helpers.filterReferenceDictionary(fixture, { search: "28" }).length, 3);
assert.equal(helpers.filterReferenceDictionary(fixture, { statusFilter: "mapping-required" }).length, 33);
assert.equal(helpers.filterReferenceDictionary(fixture, { statusFilter: "suggested" }).length, 2);
assert.equal(helpers.dedupeCanonicalReferenceMappings(fixture).length, 1);
assert.equal(helpers.dedupeCanonicalReferenceMappings(fixture)[0].source_alias_count, 2);

const canonicalFixture = [
  {
    source_reference_text: "Source A",
    alias_mapping_status: "DRAFT",
    source_to_canonical_ready: false,
    canonical_term_id: 28,
    canonical_code: "SAHASRAYOGAM",
    canonical_label: "Sahasrayogam",
    portal_mapping_status: "VERIFIED",
    portal_label: "Sahasrayoga",
    portal_external_id: "28",
    canonical_to_portal_ready: true,
  },
  {
    source_reference_text: "Source B",
    alias_mapping_status: "VERIFIED",
    source_to_canonical_ready: true,
    canonical_term_id: 28,
    canonical_code: "SAHASRAYOGAM",
    canonical_label: "Sahasrayogam",
    portal_mapping_status: "VERIFIED",
    portal_label: "Sahasrayoga",
    portal_external_id: "28",
    canonical_to_portal_ready: true,
  },
  {
    source_reference_text: "Source C",
    alias_mapping_status: "VERIFIED",
    source_to_canonical_ready: true,
    canonical_term_id: 29,
    canonical_code: "ASHTANGAH",
    canonical_label: "Ashtangahridayam",
    portal_mapping_status: "DRAFT",
    portal_label: "Ashtanga Hridaya",
    portal_external_id: "29",
    canonical_to_portal_ready: false,
  },
];
const allCanonicalRows = helpers.dedupeCanonicalReferenceMappings(canonicalFixture);
assert.equal(allCanonicalRows.find((row) => row.canonical_term_id === 28).source_alias_count, 2);
assert.equal(
  helpers.dedupeCanonicalReferenceMappings(
    helpers.filterReferenceDictionary(canonicalFixture, { search: "Source A" }),
  )[0].source_alias_count,
  1,
);
assert.equal(
  helpers.filterCanonicalReferenceMappings(allCanonicalRows, { search: "Source A" }).length,
  0,
);
assert.equal(
  helpers.filterCanonicalReferenceMappings(allCanonicalRows, { statusFilter: "suggested" }).length,
  1,
);
assert.equal(
  helpers.filterCanonicalReferenceMappings(allCanonicalRows, { statusFilter: "suggested" })[0].canonical_term_id,
  29,
);
assert.equal(
  helpers.filterCanonicalReferenceMappings(allCanonicalRows, { statusFilter: "ready" })[0].canonical_term_id,
  28,
);
assert.equal(
  helpers.filterCanonicalReferenceMappings(allCanonicalRows, { statusFilter: "mapping-required" })[0].canonical_term_id,
  29,
);
assert.equal(helpers.filterCanonicalReferenceMappings(allCanonicalRows, { search: "ASHTANGAH" }).length, 1);
assert.equal(helpers.filterCanonicalReferenceMappings(allCanonicalRows, { search: "Ashtangahridayam" }).length, 1);
assert.equal(helpers.filterCanonicalReferenceMappings(allCanonicalRows, { search: "Ashtanga Hridaya" }).length, 1);
assert.equal(helpers.filterCanonicalReferenceMappings(allCanonicalRows, { search: "29" }).length, 1);
assert.equal(helpers.positiveReferenceSelectionId(""), null);
assert.equal(helpers.positiveReferenceSelectionId(null), null);
assert.equal(helpers.positiveReferenceSelectionId("0"), null);
assert.equal(helpers.positiveReferenceSelectionId("28"), 28);

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
assert.match(canonicalRender, /dedupeCanonicalReferenceMappings\(state\.referenceDictionary\.rows\)/);
assert.match(canonicalRender, /filterCanonicalReferenceMappings/);
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
const sourceDraftFlow = control.match(/async function openSourceAliasCreate[\s\S]*?function openReferenceWorkCreate/)?.[0] || "";
const portalDraftFlow = control.match(/function openPortalDraftCreate[\s\S]*?function openPortalMappingReview/)?.[0] || "";
assert.match(sourceDraftFlow, /required[\s\S]*?requirePositiveReferenceSelection[\s\S]*?createReferenceAliasDraft/);
assert.equal((sourceDraftFlow.match(/await createReferenceAliasDraft\(/g) || []).length, 1);
assert.match(portalDraftFlow, /required[\s\S]*?requirePositiveReferenceSelection[\s\S]*?createReferencePortalMappingDraft/);
assert.equal((portalDraftFlow.match(/await createReferencePortalMappingDraft\(/g) || []).length, 1);
assert.match(control, /bindRequiredReferenceSelection\(dialog, "#referenceCanonicalOption"/);
assert.match(control, /bindRequiredReferenceSelection\(dialog, "#referencePortalOption"/);
const requiredSelectionBinder = control.match(/function bindRequiredReferenceSelection[\s\S]*?\n}/)?.[0] || "";
assert.match(requiredSelectionBinder, /confirm\.disabled = !valid \|\| !canWrite\(\)/);

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
