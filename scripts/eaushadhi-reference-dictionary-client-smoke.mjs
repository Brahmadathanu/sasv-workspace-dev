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
const primitivesCss = read("public/shared/css/sasv-primitives.css");
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
assert.doesNotMatch(html, /Canonical to e-Aushadhi Reference Mappings/);
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
  "Source Reference", "Usage", "Canonical Reference Work", "Source Mapping",
  "e-Aushadhi Reference", "Portal Mapping", "Overall",
]) assert.match(html, new RegExp(`<th scope="col">${heading}</th>`));
for (const removedHeading of ["Action", "Source to Canonical", "Canonical to Portal", "Source wordings"]) {
  assert.doesNotMatch(html, new RegExp(`<th scope="col">${removedHeading}</th>`));
}
assert.equal((html.match(/class="reference-dictionary-table"/g) || []).length, 1);
assert.doesNotMatch(html, /Canonical to e-Aushadhi Reference Mappings/);
assert.doesNotMatch(control, /<article class="reference-dictionary-card"/);
assert.doesNotMatch(html, /reference-dictionary-grid/);
assert.match(css, /ea-mode-reference-dictionary #referenceDictionaryPanel[\s\S]*?display: flex[\s\S]*?flex: 1/);
const dictionaryScrollCss = css.match(/body\.sasv-eaushadhi-review \.reference-dictionary-scroll \{[\s\S]*?\n\}/)?.[0] || "";
assert.match(dictionaryScrollCss, /display: grid/);
assert.match(dictionaryScrollCss, /align-content: start/);
assert.match(dictionaryScrollCss, /grid-auto-rows: max-content/);
assert.match(css, /body\.sasv-eaushadhi-review \.workspace-scroll \{[\s\S]*?flex: 1[\s\S]*?min-height: 0[\s\S]*?overflow: auto/);
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
const overallFixture = [
  { source_reference_text: "Ready", reference_ready: true, alias_mapping_status: "VERIFIED", portal_mapping_status: "VERIFIED" },
  { source_reference_text: "Alias suggestion", reference_ready: false, alias_mapping_status: "DRAFT", portal_mapping_status: null },
  { source_reference_text: "Portal suggestion", reference_ready: false, alias_mapping_status: "VERIFIED", portal_mapping_status: "DRAFT" },
  { source_reference_text: "Missing", reference_ready: false, alias_mapping_status: null, portal_mapping_status: null },
];
assert.deepEqual(helpers.filterReferenceDictionary(overallFixture, { statusFilter: "ready" }).map((row) => row.source_reference_text), ["Ready"]);
assert.deepEqual(helpers.filterReferenceDictionary(overallFixture, { statusFilter: "mapping-required" }).map((row) => row.source_reference_text), ["Alias suggestion", "Portal suggestion", "Missing"]);
assert.deepEqual(helpers.filterReferenceDictionary(overallFixture, { statusFilter: "suggested" }).map((row) => row.source_reference_text), ["Alias suggestion", "Portal suggestion"]);
assert.equal("dedupeCanonicalReferenceMappings" in helpers, false);
assert.equal("filterCanonicalReferenceMappings" in helpers, false);
assert.equal(helpers.positiveReferenceSelectionId(""), null);
assert.equal(helpers.positiveReferenceSelectionId(null), null);
assert.equal(helpers.positiveReferenceSelectionId("0"), null);
assert.equal(helpers.positiveReferenceSelectionId("28"), 28);

assert.match(control, /Number\(row\?\.line_count \|\| 0\).*Number\(row\?\.product_count \|\| 0\)/s);
assert.match(control, /<tr class="reference-dictionary-row" tabindex="0" data-reference-source=/);
assert.match(control, /data-label="Source Mapping"/);
assert.match(control, /data-label="Portal Mapping"/);
assert.match(control, /data-label="Overall" class="reference-dictionary-overall"/);
assert.doesNotMatch(control, /data-reference-(?:source|portal)-(?:create|review)=/);
assert.match(control, /reference-dictionary-row[\s\S]*?reference-row-chevron/);
assert.match(control, /event\.target\.closest\("tr\[data-reference-source\]"\)[\s\S]*?openReferenceReview/);
assert.match(control, /event\.key !== "Enter" && event\.key !== " "/);
assert.match(control, /event\.key === " "[\s\S]*?event\.preventDefault\(\)/);
assert.match(css, /\.reference-dictionary-row:hover/);
assert.match(css, /\.reference-dictionary-row:focus-visible/);

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
assert.match(control, /Changing the suggested Reference Work will be recorded as a manual mapping\./);
assert.match(control, /Creates a reusable canonical work only\. The source draft still requires a separate action\./);
assert.match(control, /Creates a global draft mapping\. Verification is a separate step\./);
assert.match(control, /Changing the suggested option will be recorded as a manual mapping\./);
assert.match(control, /Review Reference Mapping/);
assert.match(control, /Section A - Source Reference Mapping/);
assert.match(control, /Section B - Shared Canonical to e-Aushadhi Mapping/);
assert.match(control, /Shared mapping: applies to every source wording resolving to this canonical Reference Work\./);
assert.doesNotMatch(control, /Verify All/);
for (const action of ["source-draft", "source-verify", "portal-draft", "portal-verify"]) {
  assert.match(control, new RegExp(`data-reference-${action}`));
}
const reviewHandler = control.match(/async function handleReferenceReviewAction[\s\S]*?\n}/)?.[0] || "";
assert.match(reviewHandler, /createReferenceAliasDraft/);
assert.match(reviewHandler, /verifyReferenceAlias/);
assert.match(reviewHandler, /createReferencePortalMappingDraft/);
assert.match(reviewHandler, /verifyReferenceMapping/);
assert.doesNotMatch(reviewHandler, /Verify All|Promise\.all/);
assert.match(control, /bindRequiredReferenceSelection\(dialog, selector, feedbackSelector, buttonSelector\)/);
const requiredSelectionBinder = control.match(/function bindRequiredReferenceSelection[\s\S]*?\n}/)?.[0] || "";
assert.match(requiredSelectionBinder, /confirm\.disabled = !valid \|\| !canWrite\(\)/);
const refreshFlow = control.match(/async function refreshReferenceReviewAfterMutation[\s\S]*?\n}/)?.[0] || "";
assert.match(refreshFlow, /loadReferenceDictionary\(\{ force: true \}\)/);
assert.match(refreshFlow, /currentReferenceReviewRow\(\)/);
assert.match(refreshFlow, /renderReferenceReviewDialog\(freshRow, \{ focusSection \}\)/);
assert.match(control, /referenceReviewSource = row\.source_reference_text/);
assert.match(control, /row\.source_reference_text === referenceReviewSource/);
assert.match(control, /await ensureReferenceWorkOptions\(\)/);
assert.match(control, /await fetchReferenceAliasCandidates\(row\.source_reference_text\)/);
assert.match(control, /referenceReviewSelectedCanonicalId = created\?\.controlled_term_id \|\| null/);
assert.doesNotMatch(control, /referenceAliasCandidates:|referenceDialog:/);
assert.match(control, /focusSection: "#referenceSourceSectionTitle"/);
assert.match(control, /focusSection: "#referencePortalSectionTitle"/);
assert.match(control, /data-edit-action="true"/);
assert.match(control, /applyPermissionUi\(\)/);
const openFlow = control.match(/async function openReferenceReview[\s\S]*?\n}/)?.[0] || "";
assert.doesNotMatch(openFlow, /createReference|verifyReference|\.rpc\(/);
assert.match(openFlow, /handleReferenceReviewAction\(event\)\.catch\(toastError\)/);

assert.doesNotMatch(control, /data-reference-review=|isReferenceActionOwner|openReferenceMappingReview/);
assert.doesNotMatch(control, /suggested_reference_work_term_id|selected_reference_work_term_id/);
assert.match(control, /reference\?\.reference_ready === true[\s\S]*?referenceGovernanceLabel\(reference\)/);
assert.equal(helpers.referenceGovernanceLabel({ reference_ready: false }), "Global reference mapping required");
assert.equal(helpers.referenceGovernanceLabel({ reference_ready: true }), "Verified globally");
assert.equal((control.match(/dialog\.id = "referenceReviewDialog"/g) || []).length, 1);
assert.ok(control.indexOf("function sourceReferenceSectionHtml") < control.indexOf("function portalReferenceSectionHtml"));
assert.match(control, /body\.innerHTML = `<div class="reference-dialog-summary reference-review-identity"[\s\S]*?sourceReferenceSectionHtml\(row\)\}\$\{portalReferenceSectionHtml\(row\)\}/);
assert.match(control, /<div data-reference-review-body><\/div>[\s\S]*?<div class="modal-actions"><button type="submit" class="icon-btn with-label">Close<\/button><\/div>/);
assert.match(primitivesCss, /--sasv-modal-width: min\(640px, calc\(100vw - 32px\)\)/);
assert.match(primitivesCss, /\.sasv-modal,[\s\S]*?width: var\(--sasv-modal-width\)[\s\S]*?max-width: 100%[\s\S]*?overflow: hidden/);
const outerModalCss = css.match(/body\.sasv-eaushadhi-review \.reference-dictionary-modal \{[\s\S]*?\n\}/)?.[0] || "";
assert.match(outerModalCss, /width: min\(1200px, calc\(100vw - 24px\)\)/);
assert.match(outerModalCss, /max-width: none/);
assert.match(outerModalCss, /height: min\(760px, calc\(100vh - 24px\)\)/);
assert.match(outerModalCss, /max-height: min\(760px, calc\(100vh - 24px\)\)/);
assert.match(outerModalCss, /padding: 0/);
assert.match(outerModalCss, /overflow: hidden/);
const desktopModalCss = css.match(/body\.sasv-eaushadhi-review \.reference-dictionary-modal \.reference-dictionary-modal-card \{[\s\S]*?\n\}/)?.[0] || "";
assert.match(desktopModalCss, /width: 100%/);
assert.match(desktopModalCss, /max-width: 100%/);
assert.match(desktopModalCss, /height: 100%/);
assert.match(desktopModalCss, /max-height: none/);
assert.doesNotMatch(desktopModalCss, /1200px|100vw|100vh/);
assert.match(desktopModalCss, /grid-template-rows: auto minmax\(0, 1fr\) auto/);
assert.match(desktopModalCss, /overflow: hidden/);
assert.doesNotMatch(desktopModalCss, /overflow-y: auto/);
const desktopReviewBodyCss = css.match(/body\.sasv-eaushadhi-review \[data-reference-review-body\] \{[\s\S]*?\n\}/)?.[0] || "";
assert.match(desktopReviewBodyCss, /grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\)/);
assert.match(desktopReviewBodyCss, /grid-template-rows: auto minmax\(0, 1fr\)/);
assert.match(desktopReviewBodyCss, /min-height: 0/);
assert.match(desktopReviewBodyCss, /overflow: hidden/);
assert.match(css, /\.reference-review-identity \{[\s\S]*?grid-column: 1 \/ -1/);
assert.match(css, /\.reference-review-section \{[\s\S]*?min-height: 0[\s\S]*?overflow-x: hidden[\s\S]*?overflow-y: auto[\s\S]*?align-content: start/);
assert.match(css, /\.reference-section-actions \{[\s\S]*?margin-top: auto/);
const narrowModalCss = css.match(/@media \(max-width: 960px\) \{[\s\S]*?\n\}/)?.[0] || "";
assert.match(narrowModalCss, /\[data-reference-review-body\][\s\S]*?grid-template-columns: minmax\(0, 1fr\)[\s\S]*?overflow-y: auto/);
assert.match(narrowModalCss, /\.reference-review-section[\s\S]*?overflow: visible/);
assert.match(css, /max-width: 720px[\s\S]*?reference-dictionary-modal \.modal-card[\s\S]*?padding: 16px 18px/);
assert.match(control, /aria-describedby=/);
assert.match(control, /dialog\.showModal\(\)/);
assert.doesNotMatch(`${api}\n${control}`, /SaveData|DeleteCompositionData|GetCompositionDataUpdate/);

console.log("eaushadhi global Reference Dictionary client smoke: PASS");
