/**
 * Product Route delta authoring form — Gate 11Y.10I.2C.3E.3D / 3D.1.
 * Governed selectors; master enrichment; integrity guardrails.
 */

import {
  PRM_COST_CENTRE_POOL_EXCLUDED,
  PRM_DELTA_OPERATIONS,
  PRM_DIRECT_LABOUR_SCOPES,
  PRM_OTHER_POOL_STEP_SCOPES,
  PRM_PRODUCTION_OVERHEAD_SCOPES,
  PRM_ROUTE_STEP_SCOPES,
  buildPrmMasterOptionsForStepAuthoring,
  classifyPrmActivityCostCentreCompatibility,
  coercePrmList,
  collectPrmProductDeltaStepKeys,
  extractEnrichedApprovedCostCentres,
  filterPrmPlantsByLocation,
  formatPrmActivityCostCentreCompatibilityStatus,
  formatPrmActivityLocationCopy,
  formatPrmActivityOptionLabel,
  formatPrmActivityOptionSearchText,
  formatPrmCostCentreContextCopy,
  formatPrmCostCentreOptionLabel,
  formatPrmCostCentreOptionSearchText,
  formatPrmDeltaBaseStepLabel,
  formatPrmDeltaLabel,
  formatPrmDirectLabourScopeLabel,
  formatPrmPlantMachineryStatusLabel,
  formatPrmProductionOverheadScopeLabel,
  formatPrmResourceClassLabel,
  formatPrmRouteStepScopeLabel,
  isBlankPrmValue,
  isMeaningfulPrmApprovalReference,
  isPrmOtherPoolStepScope,
  isValidPrmProductDeltaStepKey,
  normalizePrmCode,
  normalizePrmIntegerId,
  normalizePrmProductRouteOverride,
  requiresPrmActivityCostCentreAcknowledgement,
  resolvePrmDeltaOperation,
  resolvePrmFamilyStepId,
  resolvePrmPoolScopeDlPohRequirement,
  selectPrmBypassEligibleFamilySteps,
  suggestPrmProductDeltaStepKey,
  validatePrmProductDeltaMasterIntegrity,
} from "./costing-suite-production-route-helpers.js";
import { nextPrmFamilyStepSequence } from "./costing-suite-production-route-step-form.js";
import {
  enhanceSearchableSelect,
} from "./sasv-module-chrome.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function text(value, fallback = "—") {
  return isBlankPrmValue(value) ? fallback : escapeHtml(value);
}

function optionHtml(value, label, selected, title = "") {
  const sel = String(selected ?? "") === String(value ?? "") ? " selected" : "";
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
  return `<option value="${escapeHtml(value)}"${titleAttr}${sel}>${escapeHtml(label)}</option>`;
}

function activityOptionsHtml(activities, selectedId) {
  const opts = ['<option value="">— Select activity —</option>'];
  for (const row of coercePrmList(activities)) {
    const id = normalizePrmIntegerId(row.activity_id ?? row.id);
    if (id == null) continue;
    const label = formatPrmActivityOptionLabel(row);
    const title = [
      label,
      formatPrmActivityOptionSearchText(row),
      `Activity ${id}`,
    ]
      .filter((part) => !isBlankPrmValue(part))
      .join(" · ");
    opts.push(optionHtml(id, label, selectedId, title));
  }
  return opts.join("");
}

function costCentreOptionsHtml(centres, selectedId) {
  const opts = ['<option value="">— Select cost centre —</option>'];
  for (const row of coercePrmList(centres)) {
    const id = normalizePrmIntegerId(row.cost_centre_id ?? row.id);
    if (id == null) continue;
    const label = formatPrmCostCentreOptionLabel(row);
    const title = [
      label,
      formatPrmCostCentreOptionSearchText(row),
      `Cost Centre ${id}`,
    ]
      .filter((part) => !isBlankPrmValue(part))
      .join(" · ");
    opts.push(optionHtml(id, label, selectedId, title));
  }
  return opts.join("");
}

function codeOptionsHtml(rows, codeKey, labelKey, selected, formatter) {
  const opts = ['<option value="">— Select —</option>'];
  for (const row of coercePrmList(rows)) {
    const code = normalizePrmCode(row?.[codeKey] || row?.code || row?.id);
    if (!code) continue;
    const label =
      row?.[labelKey] ||
      row?.label ||
      (formatter ? formatter(code) : code) ||
      code;
    opts.push(optionHtml(code, label, selected, code));
  }
  return opts.join("");
}

function enumOptionsHtml(codes, selected, formatter) {
  return ['<option value="">— Select —</option>']
    .concat(codes.map((code) => optionHtml(code, formatter(code), selected, code)))
    .join("");
}

function plantOptionsHtml(plants, selectedId) {
  const opts = ['<option value="">— Optional plant —</option>'];
  for (const row of coercePrmList(plants)) {
    const id = normalizePrmIntegerId(row.plant_id ?? row.id);
    if (id == null) continue;
    const name = row.plant_name || row.name || id;
    const status =
      row.status_label ||
      formatPrmPlantMachineryStatusLabel(row.status) ||
      row.status ||
      "";
    const label = status ? `${name} (${status})` : String(name);
    opts.push(optionHtml(id, label, selectedId));
  }
  return opts.join("");
}

function operationOptionsHtml(selected) {
  return ['<option value="">— Select operation —</option>']
    .concat(
      PRM_DELTA_OPERATIONS.map((code) =>
        optionHtml(code, formatPrmDeltaLabel(code) || code, selected, code),
      ),
    )
    .join("");
}

function baseStepOptionsHtml(steps, selectedId, { bypassOnly = false } = {}) {
  const list = bypassOnly
    ? selectPrmBypassEligibleFamilySteps(steps)
    : coercePrmList(steps);
  const opts = ['<option value="">— Select Family step —</option>'];
  for (const step of list) {
    const id = resolvePrmFamilyStepId(step);
    if (id == null) continue;
    opts.push(optionHtml(id, formatPrmDeltaBaseStepLabel(step), selectedId));
  }
  return opts.join("");
}

function insertAfterOptionsHtml(steps, selectedSeq) {
  const opts = ['<option value="">— End of route —</option>'];
  for (const step of coercePrmList(steps)) {
    const seq = Number(step.sequence_no);
    if (!Number.isFinite(seq)) continue;
    opts.push(
      optionHtml(seq, `After ${formatPrmDeltaBaseStepLabel(step)}`, selectedSeq),
    );
  }
  return opts.join("");
}

function lockedLocationHtml(prefix, sectionName, subsectionName, areaName) {
  return `
    <div class="cp-prm-form-field"><span class="cp-field-label">Section</span>
      <input type="text" id="${prefix}SectionName" value="${text(sectionName, "")}" readonly disabled />
    </div>
    <div class="cp-prm-form-field"><span class="cp-field-label">Subsection</span>
      <input type="text" id="${prefix}SubsectionName" value="${text(subsectionName, "")}" readonly disabled />
    </div>
    <div class="cp-prm-form-field"><span class="cp-field-label">Area</span>
      <input type="text" id="${prefix}AreaName" value="${text(areaName, "")}" readonly disabled />
    </div>`;
}

function panel(name, hidden, inner) {
  return `<div data-prm-delta-panel="${name}" ${hidden ? "hidden" : ""}>${inner}</div>`;
}

export function buildProductDeltaFormHtml({
  delta = null,
  options = {},
  familySteps = [],
  prefix = "prmProductDelta",
  sequenceSuggestion = null,
} = {}) {
  const enriched = buildPrmMasterOptionsForStepAuthoring(options);
  const seed = delta ? normalizePrmProductRouteOverride(delta) : {};
  const operation = resolvePrmDeltaOperation(seed) || "ADD_STEP";
  const activities = enriched.activities || [];
  const centres = extractEnrichedApprovedCostCentres(enriched);
  const behaviours = enriched.behaviours || [];
  const resources = enriched.resource_classes || [];
  const activityId = seed.activity_id;
  const activity =
    coercePrmList(activities).find(
      (row) => normalizePrmIntegerId(row.activity_id ?? row.id) === activityId,
    ) || {};
  const sectionId = seed.section_id ?? activity.section_id;
  const subsectionId = seed.subsection_id ?? activity.subsection_id;
  const areaId = seed.area_id ?? activity.area_id;
  const sectionName =
    seed.section_name || activity.section_name || (sectionId != null ? String(sectionId) : "");
  const subsectionName =
    seed.subsection_name ||
    activity.subsection_name ||
    (subsectionId != null ? String(subsectionId) : "");
  const areaName =
    seed.area_name || activity.area_name || (areaId != null ? String(areaId) : "");
  const plants = filterPrmPlantsByLocation(enriched.plants || [], {
    section_id: sectionId,
    subsection_id: subsectionId,
    area_id: areaId,
  });
  const seq =
    seed.sequence_no ??
    sequenceSuggestion ??
    nextPrmFamilyStepSequence(familySteps);
  const stepKey = seed.override_step_key || "";
  const stepKeyPlaceholder = activity.activity_name
    ? suggestPrmProductDeltaStepKey(activity, [])
    : "POWDER_BLENDING";
  const otherPool = isPrmOtherPoolStepScope(seed.route_step_scope);
  const centre =
    coercePrmList(centres).find(
      (row) =>
        normalizePrmIntegerId(row.cost_centre_id ?? row.id) ===
        normalizePrmIntegerId(seed.cost_centre_id),
    ) || {};
  const excludedCc =
    normalizePrmCode(centre.pool_scope).toUpperCase() ===
    PRM_COST_CENTRE_POOL_EXCLUDED;
  const compatibility = classifyPrmActivityCostCentreCompatibility(activity, centre);
  const showAdd = operation === "ADD_STEP" || operation === "REPLACE_STEP";
  const showBase = operation !== "ADD_STEP";
  const showLocation = operation === "ALTER_LOCATION";
  const showResource = operation === "ALTER_RESOURCE";
  const showCycle = operation === "ALTER_CYCLE";
  const showFlags = operation === "ALTER_MANDATORY_STATUS" || showAdd;
  const bypassOnly = operation === "BYPASS_STEP";
  const overrideId = normalizePrmIntegerId(seed.override_id);
  const activityContext = formatPrmActivityLocationCopy(activity);
  const centreContext = formatPrmCostCentreContextCopy(centre);
  const centreDefaultRc =
    centre.default_resource_class_label ||
    formatPrmResourceClassLabel(centre.default_resource_class_code) ||
    "";
  const exclusionNotice =
    otherPool || excludedCc
      ? `<p class="cp-prm-form-notice" data-prm-other-pool-notice>This route step remains operationally visible but its cost is owned by another pool. Direct Labour and Production Overhead scopes are set to Excluded.</p>`
      : `<p class="cp-prm-form-notice" data-prm-other-pool-notice hidden></p>`;

  return `<div class="cp-prm-summary cp-prm-form cp-prm-family-step-form cp-prm-product-delta-form" data-prm-product-delta-form data-prm-delta-override-id="${overrideId != null ? overrideId : ""}">
    ${exclusionNotice}
    <input type="hidden" id="${prefix}SectionId" value="${text(sectionId, "")}" />
    <input type="hidden" id="${prefix}SubsectionId" value="${text(subsectionId, "")}" />
    <input type="hidden" id="${prefix}AreaId" value="${text(areaId, "")}" />
    <section class="cp-detail-section">
      <h3 class="cp-section-title">Operation</h3>
      <div class="cp-detail-grid cp-detail-grid--2col">
        <div class="cp-prm-form-field cp-prm-form-field--full"><span class="cp-field-label">Delta operation</span>
          <select id="${prefix}Operation" class="cp-period-select" required data-prm-delta-operation>${operationOptionsHtml(operation)}</select>
        </div>
      </div>
    </section>
    ${panel(
      "base",
      !showBase,
      `<section class="cp-detail-section">
        <h3 class="cp-section-title">Target Family step</h3>
        <div class="cp-detail-grid cp-detail-grid--2col">
          <div class="cp-prm-form-field cp-prm-form-field--full"><span class="cp-field-label">Base step</span>
            <select id="${prefix}BaseStep" class="cp-period-select" data-prm-delta-base-step>${baseStepOptionsHtml(familySteps, seed.base_step_id, { bypassOnly })}</select>
            <span class="cp-muted-text" data-prm-delta-bypass-hint ${bypassOnly ? "" : "hidden"}>Only Family steps that allow skip-with-approval can be bypassed.</span>
          </div>
        </div>
      </section>`,
    )}
    ${panel(
      "add",
      !showAdd,
      `<section class="cp-detail-section">
        <h3 class="cp-section-title">Added / replacement step</h3>
        <div class="cp-detail-grid cp-detail-grid--2col">
          <div class="cp-prm-form-field" data-prm-delta-insert ${operation === "ADD_STEP" ? "" : "hidden"}><span class="cp-field-label">Insert after</span>
            <select id="${prefix}InsertAfter" class="cp-period-select">${insertAfterOptionsHtml(familySteps, "")}</select>
            <span class="cp-muted-text">Sets sequence only. Not stored as a separate field.</span>
          </div>
          <div class="cp-prm-form-field"><span class="cp-field-label">Override step key</span>
            <input id="${prefix}Key" value="${escapeHtml(stepKey)}" placeholder="${escapeHtml(stepKeyPlaceholder)}" autocomplete="off" />
            <span class="cp-muted-text">Uppercase letters, numbers, and underscores only. Unique within this Product route.</span>
            <span class="cp-muted-text" data-prm-delta-key-suggestion hidden></span>
          </div>
          <div class="cp-prm-form-field"><span class="cp-field-label">Sequence</span>
            <input id="${prefix}Seq" type="number" min="1" step="1" value="${escapeHtml(seq)}" />
          </div>
          <div class="cp-prm-form-field cp-prm-form-field--full"><span class="cp-field-label">Activity</span>
            <select id="${prefix}Activity" class="cp-period-select" data-prm-searchable-select>${activityOptionsHtml(activities, activityId)}</select>
            <div class="cp-prm-master-context" data-prm-activity-context ${activityContext ? "" : "hidden"}>
              <span class="cp-field-label">Selected Activity context</span>
              <span class="cp-muted-text" data-prm-activity-context-copy>${text(activityContext)}</span>
            </div>
          </div>
          <div class="cp-prm-form-field cp-prm-form-field--full"><span class="cp-field-label">Cost Centre</span>
            <select id="${prefix}CostCentre" class="cp-period-select" data-prm-searchable-select>${costCentreOptionsHtml(centres, seed.cost_centre_id)}</select>
            <span class="cp-muted-text">Approved Production cost centres. Selected independently of Activity.</span>
            <div class="cp-prm-master-context" data-prm-cost-centre-context ${centreContext || centreDefaultRc ? "" : "hidden"}>
              <span class="cp-field-label">Selected Cost Centre context</span>
              <span class="cp-muted-text" data-prm-cost-centre-context-copy>${text(centreContext)}</span>
              <span class="cp-muted-text" data-prm-cost-centre-default-rc ${centreDefaultRc ? "" : "hidden"}>Default resource: ${text(centreDefaultRc)}</span>
            </div>
          </div>
          <div class="cp-prm-form-field cp-prm-form-field--full cp-prm-compat-strip" data-prm-compat-strip ${activityId && centre.cost_centre_id ? "" : "hidden"}>
            <div class="cp-prm-compat-grid">
              <div><span class="cp-field-label">Activity location</span><span class="cp-muted-text" data-prm-compat-activity>${text(activityContext)}</span></div>
              <div><span class="cp-field-label">Cost Centre context</span><span class="cp-muted-text" data-prm-compat-centre>${text(centreContext)}</span></div>
              <div><span class="cp-field-label">Status</span><span class="cp-prm-compat-status" data-prm-compat-status data-prm-compat-class="${escapeHtml(compatibility)}">${text(formatPrmActivityCostCentreCompatibilityStatus(compatibility))}</span></div>
            </div>
            <label class="cp-prm-compat-ack" data-prm-compat-ack-wrap ${requiresPrmActivityCostCentreAcknowledgement(compatibility) ? "" : "hidden"}>
              <input type="checkbox" id="${prefix}CompatAck" data-prm-compat-ack />
              <span>I confirm this Cost Centre is appropriate for the selected Activity location.</span>
            </label>
          </div>
        </div>
      </section>
      <section class="cp-detail-section">
        <h3 class="cp-section-title">Location (from Activity)</h3>
        <div class="cp-detail-grid cp-detail-grid--2col">
          ${lockedLocationHtml(prefix, sectionName, subsectionName, areaName)}
          <div class="cp-prm-form-field"><span class="cp-field-label">Plant (optional)</span>
            <select id="${prefix}Plant" class="cp-period-select">${plantOptionsHtml(plants, seed.plant_id)}</select>
            <span class="cp-muted-text" data-prm-plant-cc-note hidden></span>
          </div>
        </div>
      </section>
      <section class="cp-detail-section">
        <h3 class="cp-section-title">Classification</h3>
        <div class="cp-detail-grid cp-detail-grid--2col">
          <div class="cp-prm-form-field"><span class="cp-field-label">Behaviour</span>
            <select id="${prefix}Behaviour" class="cp-period-select">${codeOptionsHtml(behaviours, "behaviour_code", "behaviour_label", seed.behaviour_code)}</select>
          </div>
          <div class="cp-prm-form-field"><span class="cp-field-label">Resource class</span>
            <select id="${prefix}Resource" class="cp-period-select">${codeOptionsHtml(resources, "resource_class_code", "resource_class_label", seed.resource_class_code)}</select>
            <span class="cp-muted-text" data-prm-resource-default-hint hidden></span>
          </div>
          <div class="cp-prm-form-field cp-prm-form-field--full"><span class="cp-field-label">Route step scope</span>
            <select id="${prefix}Scope" class="cp-period-select">${enumOptionsHtml(PRM_ROUTE_STEP_SCOPES, seed.route_step_scope, formatPrmRouteStepScopeLabel)}</select>
          </div>
          <div class="cp-prm-form-field"><span class="cp-field-label">Direct Labour scope</span>
            <select id="${prefix}DlScope" class="cp-period-select">${enumOptionsHtml(PRM_DIRECT_LABOUR_SCOPES, seed.direct_labour_scope || (otherPool || excludedCc ? "EXCLUDE_OTHER_POOL" : ""), formatPrmDirectLabourScopeLabel)}</select>
          </div>
          <div class="cp-prm-form-field"><span class="cp-field-label">Production Overhead scope</span>
            <select id="${prefix}PohScope" class="cp-period-select">${enumOptionsHtml(PRM_PRODUCTION_OVERHEAD_SCOPES, seed.production_overhead_scope || (otherPool || excludedCc ? "EXCLUDE_OTHER_POOL" : ""), formatPrmProductionOverheadScopeLabel)}</select>
          </div>
          <div class="cp-prm-form-field"><span class="cp-field-label">Expected occurrences</span>
            <input id="${prefix}Occ" type="number" min="1" step="1" value="${escapeHtml(seed.expected_occurrence_count ?? 1)}" />
          </div>
          <div class="cp-prm-form-field"><span class="cp-field-label">Standard cycles</span>
            <input id="${prefix}Cycles" type="number" min="1" step="1" value="${escapeHtml(seed.standard_cycle_count ?? 1)}" />
          </div>
        </div>
      </section>`,
    )}
    ${panel(
      "location",
      !showLocation,
      `<section class="cp-detail-section">
        <h3 class="cp-section-title">Location change</h3>
        <div class="cp-detail-grid cp-detail-grid--2col">
          <div class="cp-prm-form-field cp-prm-form-field--full"><span class="cp-field-label">Activity (derives location)</span>
            <select id="${prefix}LocationActivity" class="cp-period-select" data-prm-searchable-select>${activityOptionsHtml(activities, activityId)}</select>
            <span class="cp-muted-text">Section, Subsection, and Area follow the selected Activity.</span>
            <div class="cp-prm-master-context" data-prm-location-activity-context ${activityContext ? "" : "hidden"}>
              <span class="cp-field-label">Selected Activity context</span>
              <span class="cp-muted-text" data-prm-location-activity-context-copy>${text(activityContext)}</span>
            </div>
          </div>
          <p class="cp-muted-text cp-prm-form-field--full" data-prm-delta-location-copy></p>
          <div class="cp-prm-form-field"><span class="cp-field-label">Plant (optional)</span>
            <select id="${prefix}LocationPlant" class="cp-period-select">${plantOptionsHtml(plants, seed.plant_id)}</select>
          </div>
        </div>
      </section>`,
    )}
    ${panel(
      "resource",
      !showResource,
      `<section class="cp-detail-section">
        <h3 class="cp-section-title">Resource change</h3>
        <div class="cp-detail-grid cp-detail-grid--2col">
          <div class="cp-prm-form-field"><span class="cp-field-label">Behaviour</span>
            <select id="${prefix}AlterBehaviour" class="cp-period-select">${codeOptionsHtml(behaviours, "behaviour_code", "behaviour_label", seed.behaviour_code)}</select>
          </div>
          <div class="cp-prm-form-field"><span class="cp-field-label">Resource class</span>
            <select id="${prefix}AlterResource" class="cp-period-select">${codeOptionsHtml(resources, "resource_class_code", "resource_class_label", seed.resource_class_code)}</select>
          </div>
        </div>
      </section>`,
    )}
    ${panel(
      "cycle",
      !showCycle,
      `<section class="cp-detail-section">
        <h3 class="cp-section-title">Cycle change</h3>
        <div class="cp-detail-grid cp-detail-grid--2col">
          <div class="cp-prm-form-field"><span class="cp-field-label">Expected occurrences</span>
            <input id="${prefix}AlterOcc" type="number" min="1" step="1" value="${escapeHtml(seed.expected_occurrence_count ?? "")}" />
          </div>
          <div class="cp-prm-form-field"><span class="cp-field-label">Standard cycles</span>
            <input id="${prefix}AlterCycles" type="number" min="1" step="1" value="${escapeHtml(seed.standard_cycle_count ?? "")}" />
          </div>
        </div>
      </section>`,
    )}
    ${panel(
      "flags",
      !showFlags,
      `<section class="cp-detail-section">
        <h3 class="cp-section-title">Mandatory / repeat / skip</h3>
        <div class="cp-detail-grid cp-detail-grid--2col">
          <label class="cp-prm-form-field"><span class="cp-field-label">Mandatory</span>
            <input id="${prefix}Mandatory" type="checkbox" ${seed.is_mandatory ? "checked" : ""} />
          </label>
          <label class="cp-prm-form-field"><span class="cp-field-label">Allows repeat</span>
            <input id="${prefix}Repeat" type="checkbox" ${seed.allows_repeat ? "checked" : ""} />
          </label>
          <label class="cp-prm-form-field"><span class="cp-field-label">Allows skip with approval</span>
            <input id="${prefix}Skip" type="checkbox" ${seed.allows_skip_with_approval ? "checked" : ""} />
          </label>
        </div>
      </section>`,
    )}
    <section class="cp-detail-section">
      <h3 class="cp-section-title">Governance</h3>
      <div class="cp-detail-grid cp-detail-grid--2col">
        <div class="cp-prm-form-field cp-prm-form-field--full"><span class="cp-field-label">Reason / Manufacturing rationale</span>
          <textarea id="${prefix}Reason" rows="3" required>${escapeHtml(seed.override_reason || "")}</textarea>
          <span class="cp-muted-text">Required Product-specific rationale. Placeholders such as — or N/A are not allowed.</span>
        </div>
      </div>
    </section>
    <div class="cp-prm-form-actions">
      <button type="button" class="icon-btn icon-btn-primary" data-prm-product-delta-save>${overrideId != null ? "Save delta" : "Add delta"}</button>
      <button type="button" class="icon-btn" data-prm-product-delta-cancel>Cancel</button>
    </div>
  </div>`;
}

function num(host, sel) {
  const raw = host.querySelector(sel)?.value;
  if (raw == null || String(raw).trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function intOrNull(host, sel) {
  return normalizePrmIntegerId(host.querySelector(sel)?.value);
}

function readStepAuthoringFields(host, prefix) {
  return {
    override_step_key:
      String(host.querySelector(`#${prefix}Key`)?.value || "").trim() || null,
    sequence_no: num(host, `#${prefix}Seq`),
    activity_id: intOrNull(host, `#${prefix}Activity`),
    cost_centre_id: intOrNull(host, `#${prefix}CostCentre`),
    section_id: intOrNull(host, `#${prefix}SectionId`),
    subsection_id: intOrNull(host, `#${prefix}SubsectionId`),
    area_id: intOrNull(host, `#${prefix}AreaId`),
    plant_id: intOrNull(host, `#${prefix}Plant`),
    behaviour_code:
      normalizePrmCode(host.querySelector(`#${prefix}Behaviour`)?.value) || null,
    resource_class_code:
      normalizePrmCode(host.querySelector(`#${prefix}Resource`)?.value) || null,
    route_step_scope:
      normalizePrmCode(host.querySelector(`#${prefix}Scope`)?.value) || null,
    direct_labour_scope:
      normalizePrmCode(host.querySelector(`#${prefix}DlScope`)?.value) || null,
    production_overhead_scope:
      normalizePrmCode(host.querySelector(`#${prefix}PohScope`)?.value) || null,
    expected_occurrence_count: num(host, `#${prefix}Occ`),
    standard_cycle_count: num(host, `#${prefix}Cycles`),
    is_mandatory: Boolean(host.querySelector(`#${prefix}Mandatory`)?.checked),
    allows_repeat: Boolean(host.querySelector(`#${prefix}Repeat`)?.checked),
    allows_skip_with_approval: Boolean(
      host.querySelector(`#${prefix}Skip`)?.checked,
    ),
  };
}

export function readProductDeltaFormValues(host, prefix = "prmProductDelta") {
  const operation = normalizePrmCode(
    host.querySelector(`#${prefix}Operation`)?.value,
  ).toUpperCase();
  const override_reason = String(
    host.querySelector(`#${prefix}Reason`)?.value || "",
  ).trim();
  const base_step_id = intOrNull(host, `#${prefix}BaseStep`);
  if (operation === "ADD_STEP") {
    return {
      operation_type: operation,
      base_step_id: null,
      override_reason,
      ...readStepAuthoringFields(host, prefix),
    };
  }
  if (operation === "REPLACE_STEP") {
    return {
      operation_type: operation,
      base_step_id,
      override_reason,
      ...readStepAuthoringFields(host, prefix),
    };
  }
  if (operation === "BYPASS_STEP") {
    return {
      operation_type: operation,
      base_step_id,
      override_reason,
    };
  }
  if (operation === "ALTER_LOCATION") {
    return {
      operation_type: operation,
      base_step_id,
      override_reason,
      activity_id: intOrNull(host, `#${prefix}LocationActivity`),
      section_id: intOrNull(host, `#${prefix}SectionId`),
      subsection_id: intOrNull(host, `#${prefix}SubsectionId`),
      area_id: intOrNull(host, `#${prefix}AreaId`),
      plant_id: intOrNull(host, `#${prefix}LocationPlant`),
    };
  }
  if (operation === "ALTER_RESOURCE") {
    return {
      operation_type: operation,
      base_step_id,
      override_reason,
      behaviour_code:
        normalizePrmCode(host.querySelector(`#${prefix}AlterBehaviour`)?.value) ||
        null,
      resource_class_code:
        normalizePrmCode(host.querySelector(`#${prefix}AlterResource`)?.value) ||
        null,
    };
  }
  if (operation === "ALTER_CYCLE") {
    return {
      operation_type: operation,
      base_step_id,
      override_reason,
      expected_occurrence_count: num(host, `#${prefix}AlterOcc`),
      standard_cycle_count: num(host, `#${prefix}AlterCycles`),
    };
  }
  if (operation === "ALTER_MANDATORY_STATUS") {
    return {
      operation_type: operation,
      base_step_id,
      override_reason,
      is_mandatory: Boolean(host.querySelector(`#${prefix}Mandatory`)?.checked),
      allows_repeat: Boolean(host.querySelector(`#${prefix}Repeat`)?.checked),
      allows_skip_with_approval: Boolean(
        host.querySelector(`#${prefix}Skip`)?.checked,
      ),
    };
  }
  return {
    operation_type: operation || null,
    base_step_id,
    override_reason,
  };
}

export function validatePrmProductDeltaForm(
  values = {},
  {
    familySteps = [],
    options = {},
    existingOverrides = [],
    effectiveSteps = [],
    excludeOverrideId = null,
    compatibilityAcknowledged = false,
  } = {},
) {
  const errors = [];
  const op = normalizePrmCode(values.operation_type).toUpperCase();
  if (!PRM_DELTA_OPERATIONS.includes(op)) {
    errors.push("Select a valid Product delta operation.");
    return { ok: false, errors };
  }
  if (!isMeaningfulPrmApprovalReference(values.override_reason)) {
    errors.push(
      "Enter a meaningful manufacturing rationale. Placeholders such as — or N/A are not allowed.",
    );
  }
  if (op === "ADD_STEP") {
    if (values.base_step_id != null) {
      errors.push("Add step must not target an existing Family step.");
    }
    if (!values.override_step_key) errors.push("Override step key is required.");
    else if (!isValidPrmProductDeltaStepKey(values.override_step_key)) {
      errors.push(
        "Override step key must use uppercase letters, numbers, and underscores only.",
      );
    }
    if (values.sequence_no == null || values.sequence_no <= 0) {
      errors.push("Sequence must be a positive number.");
    }
    if (values.activity_id == null) errors.push("Activity is required.");
    if (values.cost_centre_id == null) errors.push("Cost Centre is required.");
    if (
      values.section_id == null ||
      values.subsection_id == null ||
      values.area_id == null
    ) {
      errors.push("Activity location (Section / Subsection / Area) is required.");
    }
    if (!values.behaviour_code) errors.push("Behaviour is required.");
    if (!values.resource_class_code) errors.push("Resource class is required.");
    if (!values.route_step_scope) errors.push("Route step scope is required.");
    if (!values.direct_labour_scope) errors.push("Direct Labour scope is required.");
    if (!values.production_overhead_scope) {
      errors.push("Production Overhead scope is required.");
    }
    if (
      values.expected_occurrence_count == null ||
      values.expected_occurrence_count <= 0
    ) {
      errors.push("Expected occurrence count must be greater than 0.");
    }
    if (values.standard_cycle_count == null || values.standard_cycle_count <= 0) {
      errors.push("Standard cycle count must be greater than 0.");
    }
  } else if (values.base_step_id == null) {
    errors.push("Select the Family Route step this delta applies to.");
  }
  if (op === "BYPASS_STEP" && values.base_step_id != null) {
    const eligible = selectPrmBypassEligibleFamilySteps(familySteps).some(
      (step) => resolvePrmFamilyStepId(step) === values.base_step_id,
    );
    if (!eligible) {
      errors.push("This Family step does not permit approved bypass.");
    }
  }
  if (op === "REPLACE_STEP") {
    if (!values.override_step_key) errors.push("Override step key is required.");
    else if (!isValidPrmProductDeltaStepKey(values.override_step_key)) {
      errors.push(
        "Override step key must use uppercase letters, numbers, and underscores only.",
      );
    }
    if (values.sequence_no == null || values.sequence_no <= 0) {
      errors.push("Sequence must be a positive number.");
    }
    if (values.activity_id == null) errors.push("Activity is required.");
    if (values.cost_centre_id == null) errors.push("Cost Centre is required.");
    if (
      values.section_id == null ||
      values.subsection_id == null ||
      values.area_id == null
    ) {
      errors.push("Activity location (Section / Subsection / Area) is required.");
    }
    if (!values.behaviour_code) errors.push("Behaviour is required.");
    if (!values.resource_class_code) errors.push("Resource class is required.");
    if (!values.route_step_scope) errors.push("Route step scope is required.");
    if (!values.direct_labour_scope) errors.push("Direct Labour scope is required.");
    if (!values.production_overhead_scope) {
      errors.push("Production Overhead scope is required.");
    }
    if (
      values.expected_occurrence_count == null ||
      values.expected_occurrence_count <= 0
    ) {
      errors.push("Expected occurrence count must be greater than 0.");
    }
    if (values.standard_cycle_count == null || values.standard_cycle_count <= 0) {
      errors.push("Standard cycle count must be greater than 0.");
    }
  }
  if (op === "ALTER_LOCATION") {
    if (
      values.section_id == null &&
      values.subsection_id == null &&
      values.area_id == null &&
      values.plant_id == null
    ) {
      errors.push("Select an Activity-derived location or an optional Plant.");
    }
  }
  if (op === "ALTER_RESOURCE") {
    if (!values.behaviour_code && !values.resource_class_code) {
      errors.push("Select a behaviour and/or resource class.");
    }
  }
  if (op === "ALTER_CYCLE") {
    const occ = values.expected_occurrence_count;
    const cycles = values.standard_cycle_count;
    if (occ == null && cycles == null) {
      errors.push("Enter expected occurrences and/or standard cycles.");
    }
    if (occ != null && occ <= 0) {
      errors.push("Expected occurrence count must be greater than 0.");
    }
    if (cycles != null && cycles <= 0) {
      errors.push("Standard cycle count must be greater than 0.");
    }
  }
  if (errors.length) return { ok: false, errors };
  const integrity = validatePrmProductDeltaMasterIntegrity(values, {
    options,
    familySteps,
    existingOverrides,
    effectiveSteps,
    excludeOverrideId,
    compatibilityAcknowledged,
  });
  if (!integrity.ok) {
    return integrity;
  }
  return { ok: true, errors: [] };
}

function applyActivityLocation(host, enriched, prefix, activityId, plantSel, {
  activityContextCopySel = "[data-prm-activity-context-copy]",
  activityContextWrapSel = "[data-prm-activity-context]",
  locationActivityContextCopySel = "[data-prm-location-activity-context-copy]",
  locationActivityContextWrapSel = "[data-prm-location-activity-context]",
} = {}) {
  const activity = coercePrmList(enriched.activities).find(
    (row) => normalizePrmIntegerId(row.activity_id ?? row.id) === activityId,
  );
  const sectionId = normalizePrmIntegerId(activity?.section_id);
  const subsectionId = normalizePrmIntegerId(activity?.subsection_id);
  const areaId = normalizePrmIntegerId(activity?.area_id);
  const sectionIdEl = host.querySelector(`#${prefix}SectionId`);
  const subsectionIdEl = host.querySelector(`#${prefix}SubsectionId`);
  const areaIdEl = host.querySelector(`#${prefix}AreaId`);
  const sectionNameEl = host.querySelector(`#${prefix}SectionName`);
  const subsectionNameEl = host.querySelector(`#${prefix}SubsectionName`);
  const areaNameEl = host.querySelector(`#${prefix}AreaName`);
  if (sectionIdEl) sectionIdEl.value = sectionId ?? "";
  if (subsectionIdEl) subsectionIdEl.value = subsectionId ?? "";
  if (areaIdEl) areaIdEl.value = areaId ?? "";
  if (sectionNameEl) {
    sectionNameEl.value =
      activity?.section_name || (sectionId != null ? String(sectionId) : "");
  }
  if (subsectionNameEl) {
    subsectionNameEl.value =
      activity?.subsection_name ||
      (subsectionId != null ? String(subsectionId) : "");
  }
  if (areaNameEl) {
    areaNameEl.value =
      activity?.area_name || (areaId != null ? String(areaId) : "");
  }
  const plants = filterPrmPlantsByLocation(enriched.plants || [], {
    section_id: sectionId,
    subsection_id: subsectionId,
    area_id: areaId,
  });
  const plantEl = host.querySelector(plantSel);
  if (plantEl) {
    const keep = normalizePrmIntegerId(plantEl.value);
    const still = plants.some(
      (row) => normalizePrmIntegerId(row.plant_id ?? row.id) === keep,
    );
    plantEl.innerHTML = plantOptionsHtml(plants, still ? keep : null);
    if (!still) plantEl.value = "";
  }
  const locationCopy = formatPrmActivityLocationCopy(activity || {});
  for (const [wrapSel, copySel] of [
    [activityContextWrapSel, activityContextCopySel],
    [locationActivityContextWrapSel, locationActivityContextCopySel],
  ]) {
    const wrap = host.querySelector(wrapSel);
    const copy = host.querySelector(copySel);
    if (copy) copy.textContent = locationCopy || "";
    if (wrap) wrap.hidden = !locationCopy;
  }
  const copy = host.querySelector("[data-prm-delta-location-copy]");
  if (copy) {
    copy.textContent = locationCopy
      ? `Derived location: ${locationCopy}`
      : "Select an Activity to derive Section / Subsection / Area.";
  }
  return activity || null;
}

function createFieldState(seed = {}) {
  return {
    override_step_key: {
      mode: seed.override_step_key ? "user" : "empty",
      lastAuto: null,
    },
    resource_class_code: { mode: "empty", lastAuto: null },
    plant_id: { mode: "empty", lastAuto: null },
    direct_labour_scope: { mode: "empty", lastAuto: null },
    production_overhead_scope: { mode: "empty", lastAuto: null },
  };
}

export function bindProductDeltaForm(
  host,
  options = {},
  familySteps = [],
  prefix = "prmProductDelta",
  extras = {},
) {
  const enriched = buildPrmMasterOptionsForStepAuthoring(options);
  const centres = extractEnrichedApprovedCostCentres(enriched);
  const existingOverrides = extras.existingOverrides || [];
  const effectiveSteps = extras.effectiveSteps || [];
  const excludeOverrideId = extras.excludeOverrideId ?? null;
  const fieldState = createFieldState(extras.seed || {});

  const operationEl = host.querySelector(`#${prefix}Operation`);
  const baseEl = host.querySelector(`#${prefix}BaseStep`);
  const insertEl = host.querySelector(`#${prefix}InsertAfter`);
  const seqEl = host.querySelector(`#${prefix}Seq`);
  const activityEl = host.querySelector(`#${prefix}Activity`);
  const locationActivityEl = host.querySelector(`#${prefix}LocationActivity`);
  const scopeEl = host.querySelector(`#${prefix}Scope`);
  const ccEl = host.querySelector(`#${prefix}CostCentre`);
  const resourceEl = host.querySelector(`#${prefix}Resource`);
  const plantEl = host.querySelector(`#${prefix}Plant`);
  const dlEl = host.querySelector(`#${prefix}DlScope`);
  const pohEl = host.querySelector(`#${prefix}PohScope`);
  const keyEl = host.querySelector(`#${prefix}Key`);
  const notice = host.querySelector("[data-prm-other-pool-notice]");
  const bypassHint = host.querySelector("[data-prm-delta-bypass-hint]");
  const insertWrap = host.querySelector("[data-prm-delta-insert]");
  const keySuggestion = host.querySelector("[data-prm-delta-key-suggestion]");
  const resourceHint = host.querySelector("[data-prm-resource-default-hint]");
  const plantCcNote = host.querySelector("[data-prm-plant-cc-note]");
  const compatStrip = host.querySelector("[data-prm-compat-strip]");
  const compatAckWrap = host.querySelector("[data-prm-compat-ack-wrap]");
  const compatAck = host.querySelector("[data-prm-compat-ack]");

  const setPanel = (name, visible) => {
    const el = host.querySelector(`[data-prm-delta-panel="${name}"]`);
    if (el) el.hidden = !visible;
  };

  const findActivity = (id) =>
    coercePrmList(enriched.activities).find(
      (row) => normalizePrmIntegerId(row.activity_id ?? row.id) === id,
    ) || null;
  const findCentre = (id) =>
    centres.find(
      (row) => normalizePrmIntegerId(row.cost_centre_id ?? row.id) === id,
    ) || null;

  const takenStepKeys = () =>
    collectPrmProductDeltaStepKeys({
      overrides: existingOverrides,
      familySteps,
      effectiveSteps,
      excludeOverrideId,
    });

  const refreshStepKeySuggestion = (activity) => {
    if (!keyEl || !keySuggestion) return;
    if (fieldState.override_step_key.mode === "user") {
      keySuggestion.hidden = true;
      return;
    }
    const current = String(keyEl.value || "").trim();
    if (current && fieldState.override_step_key.mode !== "empty") {
      keySuggestion.hidden = true;
      return;
    }
    if (!activity) {
      keySuggestion.hidden = true;
      return;
    }
    const suggested = suggestPrmProductDeltaStepKey(activity, takenStepKeys());
    fieldState.override_step_key.lastAuto = suggested;
    if (fieldState.override_step_key.mode !== "user") {
      keyEl.value = suggested;
      fieldState.override_step_key.mode = "suggested";
    }
    keySuggestion.hidden = false;
    keySuggestion.textContent = `Suggested key: ${suggested}`;
  };

  const refreshResourceDefaultHint = (centre) => {
    if (!resourceEl || !resourceHint) return;
    const defaultCode = normalizePrmCode(centre?.default_resource_class_code);
    const defaultLabel =
      centre?.default_resource_class_label ||
      formatPrmResourceClassLabel(defaultCode) ||
      "";
    if (!defaultCode) {
      resourceHint.hidden = true;
      resourceHint.textContent = "";
      return;
    }
    const current = normalizePrmCode(resourceEl.value);
    if (
      fieldState.resource_class_code.mode === "user" &&
      current &&
      current !== defaultCode
    ) {
      resourceHint.hidden = false;
      resourceHint.textContent = `Selected Cost Centre default: ${defaultLabel || defaultCode}`;
      return;
    }
    if (fieldState.resource_class_code.mode !== "user") {
      resourceEl.value = defaultCode;
      fieldState.resource_class_code.mode = "cc_default";
      fieldState.resource_class_code.lastAuto = defaultCode;
      resourceHint.hidden = false;
      resourceHint.textContent = "Default from selected Cost Centre";
    } else {
      resourceHint.hidden = true;
    }
  };

  const refreshPlantFromCentre = (centre, activity) => {
    if (!plantEl || !plantCcNote) return;
    const ccPlantId = normalizePrmIntegerId(centre?.plant_id);
    if (ccPlantId == null) {
      plantCcNote.hidden = true;
      plantCcNote.textContent = "";
      return;
    }
    const plants = filterPrmPlantsByLocation(enriched.plants || [], {
      section_id: activity?.section_id,
      subsection_id: activity?.subsection_id,
      area_id: activity?.area_id,
    });
    const compatible = plants.some(
      (row) => normalizePrmIntegerId(row.plant_id ?? row.id) === ccPlantId,
    );
    if (!compatible) {
      plantCcNote.hidden = false;
      plantCcNote.textContent =
        "Selected Cost Centre references a plant outside this Activity location.";
      return;
    }
    plantCcNote.hidden = true;
    if (fieldState.plant_id.mode !== "user") {
      plantEl.value = String(ccPlantId);
      fieldState.plant_id.mode = "cc_default";
      fieldState.plant_id.lastAuto = ccPlantId;
    }
  };

  const refreshCostCentreContext = (centre) => {
    const wrap = host.querySelector("[data-prm-cost-centre-context]");
    const copy = host.querySelector("[data-prm-cost-centre-context-copy]");
    const defaultRc = host.querySelector("[data-prm-cost-centre-default-rc]");
    const context = formatPrmCostCentreContextCopy(centre || {});
    const rcLabel =
      centre?.default_resource_class_label ||
      formatPrmResourceClassLabel(centre?.default_resource_class_code) ||
      "";
    if (copy) copy.textContent = context || "";
    if (defaultRc) {
      defaultRc.hidden = !rcLabel;
      defaultRc.textContent = rcLabel ? `Default resource: ${rcLabel}` : "";
    }
    if (wrap) wrap.hidden = !(context || rcLabel);
    refreshResourceDefaultHint(centre);
  };

  const refreshCompatibility = (activity, centre) => {
    if (!compatStrip) return;
    const activityCopy = host.querySelector("[data-prm-compat-activity]");
    const centreCopy = host.querySelector("[data-prm-compat-centre]");
    const statusEl = host.querySelector("[data-prm-compat-status]");
    if (!activity || !centre) {
      compatStrip.hidden = true;
      if (compatAckWrap) compatAckWrap.hidden = true;
      return;
    }
    const compatibility = classifyPrmActivityCostCentreCompatibility(
      activity,
      centre,
    );
    const status = formatPrmActivityCostCentreCompatibilityStatus(compatibility);
    compatStrip.hidden = false;
    if (activityCopy) {
      activityCopy.textContent = formatPrmActivityLocationCopy(activity);
    }
    if (centreCopy) {
      centreCopy.textContent = formatPrmCostCentreContextCopy(centre);
    }
    if (statusEl) {
      statusEl.textContent = status;
      statusEl.dataset.prmCompatClass = compatibility;
      statusEl.classList.toggle(
        "cp-prm-compat-status--warn",
        requiresPrmActivityCostCentreAcknowledgement(compatibility),
      );
    }
    if (compatAckWrap) {
      compatAckWrap.hidden = !requiresPrmActivityCostCentreAcknowledgement(
        compatibility,
      );
    }
    if (
      compatAck &&
      !requiresPrmActivityCostCentreAcknowledgement(compatibility)
    ) {
      compatAck.checked = false;
    }
  };

  const refreshExclusion = () => {
    const scope = normalizePrmCode(scopeEl?.value).toUpperCase();
    const ccId = normalizePrmIntegerId(ccEl?.value);
    const centre = findCentre(ccId);
    const poolRule = resolvePrmPoolScopeDlPohRequirement({
      costCentre: centre,
      routeStepScope: scope,
    });
    const force = Boolean(poolRule?.forced);
    if (force) {
      if (dlEl && fieldState.direct_labour_scope.mode !== "user") {
        dlEl.value = "EXCLUDE_OTHER_POOL";
        fieldState.direct_labour_scope.mode = "pool_rule";
      }
      if (pohEl && fieldState.production_overhead_scope.mode !== "user") {
        pohEl.value = "EXCLUDE_OTHER_POOL";
        fieldState.production_overhead_scope.mode = "pool_rule";
      }
    }
    if (notice) {
      notice.hidden = !force;
      if (force) {
        notice.textContent =
          "This route step remains operationally visible but its cost is owned by another pool. Direct Labour and Production Overhead scopes are set to Excluded.";
      }
    }
  };

  const applyOperation = () => {
    const op = normalizePrmCode(operationEl?.value).toUpperCase();
    const showAdd = op === "ADD_STEP" || op === "REPLACE_STEP";
    setPanel("base", op && op !== "ADD_STEP");
    setPanel("add", showAdd);
    setPanel("location", op === "ALTER_LOCATION");
    setPanel("resource", op === "ALTER_RESOURCE");
    setPanel("cycle", op === "ALTER_CYCLE");
    setPanel("flags", op === "ALTER_MANDATORY_STATUS" || showAdd);
    if (insertWrap) insertWrap.hidden = op !== "ADD_STEP";
    if (bypassHint) bypassHint.hidden = op !== "BYPASS_STEP";
    if (baseEl) {
      const keep = normalizePrmIntegerId(baseEl.value);
      const bypassOnly = op === "BYPASS_STEP";
      baseEl.innerHTML = baseStepOptionsHtml(familySteps, keep, { bypassOnly });
      const allowed = bypassOnly
        ? selectPrmBypassEligibleFamilySteps(familySteps)
        : coercePrmList(familySteps);
      const still = allowed.some((step) => resolvePrmFamilyStepId(step) === keep);
      if (!still) baseEl.value = "";
    }
  };

  const onActivityChange = (activitySelect, plantSelector) => {
    const activityId = normalizePrmIntegerId(activitySelect?.value);
    const activity = applyActivityLocation(
      host,
      enriched,
      prefix,
      activityId,
      plantSelector,
    );
    refreshStepKeySuggestion(activity);
    const centre = findCentre(normalizePrmIntegerId(ccEl?.value));
    refreshCompatibility(activity, centre);
    refreshPlantFromCentre(centre, activity);
  };

  const onCostCentreChange = () => {
    const centre = findCentre(normalizePrmIntegerId(ccEl?.value));
    const activity = findActivity(normalizePrmIntegerId(activityEl?.value));
    refreshCostCentreContext(centre);
    refreshCompatibility(activity, centre);
    refreshPlantFromCentre(centre, activity);
    refreshExclusion();
  };

  operationEl?.addEventListener("change", applyOperation);
  activityEl?.addEventListener("change", () =>
    onActivityChange(activityEl, `#${prefix}Plant`),
  );
  locationActivityEl?.addEventListener("change", () =>
    onActivityChange(locationActivityEl, `#${prefix}LocationPlant`),
  );
  ccEl?.addEventListener("change", onCostCentreChange);
  insertEl?.addEventListener("change", () => {
    const after = Number(insertEl.value);
    if (!Number.isFinite(after) || !seqEl) {
      if (seqEl && !insertEl.value) {
        seqEl.value = String(nextPrmFamilyStepSequence(familySteps));
      }
      return;
    }
    seqEl.value = String(nextPrmFamilyStepSequence(familySteps, after));
  });
  scopeEl?.addEventListener("change", refreshExclusion);
  keyEl?.addEventListener("input", () => {
    fieldState.override_step_key.mode = "user";
    if (keySuggestion) keySuggestion.hidden = true;
  });
  resourceEl?.addEventListener("change", () => {
    const centre = findCentre(normalizePrmIntegerId(ccEl?.value));
    const defaultCode = normalizePrmCode(centre?.default_resource_class_code);
    const current = normalizePrmCode(resourceEl.value);
    fieldState.resource_class_code.mode =
      defaultCode && current === defaultCode ? "cc_default" : "user";
    refreshResourceDefaultHint(centre);
  });
  plantEl?.addEventListener("change", () => {
    fieldState.plant_id.mode = plantEl.value ? "user" : "empty";
  });
  dlEl?.addEventListener("change", () => {
    fieldState.direct_labour_scope.mode = "user";
  });
  pohEl?.addEventListener("change", () => {
    fieldState.production_overhead_scope.mode = "user";
  });

  applyOperation();
  if (extras.seed?.override_step_key) {
    fieldState.override_step_key.mode = "user";
  }
  if (extras.seed?.resource_class_code) {
    const centre = findCentre(
      normalizePrmIntegerId(extras.seed.cost_centre_id),
    );
    const defaultCode = normalizePrmCode(centre?.default_resource_class_code);
    fieldState.resource_class_code.mode =
      normalizePrmCode(extras.seed.resource_class_code) === defaultCode
        ? "cc_default"
        : "user";
  }
  if (extras.seed?.plant_id != null) {
    fieldState.plant_id.mode = "user";
  }
  if (extras.seed?.direct_labour_scope) {
    const poolRule = resolvePrmPoolScopeDlPohRequirement({
      costCentre: findCentre(normalizePrmIntegerId(extras.seed.cost_centre_id)),
      routeStepScope: extras.seed.route_step_scope,
    });
    fieldState.direct_labour_scope.mode = poolRule?.forced ? "pool_rule" : "user";
  }
  if (extras.seed?.production_overhead_scope) {
    const poolRule = resolvePrmPoolScopeDlPohRequirement({
      costCentre: findCentre(normalizePrmIntegerId(extras.seed.cost_centre_id)),
      routeStepScope: extras.seed.route_step_scope,
    });
    fieldState.production_overhead_scope.mode = poolRule?.forced
      ? "pool_rule"
      : "user";
  }
  if (activityEl?.value) onActivityChange(activityEl, `#${prefix}Plant`);
  if (locationActivityEl?.value) {
    onActivityChange(locationActivityEl, `#${prefix}LocationPlant`);
  }
  if (ccEl?.value) onCostCentreChange();
  refreshExclusion();

  for (const el of host.querySelectorAll("[data-prm-searchable-select]")) {
    enhanceSearchableSelect(el, {
      placeholder: "Search or select…",
      allowEmptyOption: true,
    });
  }

  host._prmDeltaFormContext = {
    options: enriched,
    familySteps,
    existingOverrides,
    effectiveSteps,
    excludeOverrideId,
    compatibilityAcknowledged: () => Boolean(compatAck?.checked),
  };
}
