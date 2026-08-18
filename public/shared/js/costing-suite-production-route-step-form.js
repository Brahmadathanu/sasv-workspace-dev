/**
 * Family route step form helpers — Gate 11Y.10I.2C.2A / 11Y.10I.2C.3F.2B.2C.0A.
 * Activity-locked location; governed Cost Centre / Behaviour / Resource / scopes.
 */

import {
  PRM_COST_CENTRE_POOL_EXCLUDED,
  PRM_DIRECT_LABOUR_SCOPES,
  PRM_OTHER_POOL_STEP_SCOPES,
  PRM_PRODUCTION_OVERHEAD_SCOPES,
  PRM_ROUTE_STEP_SCOPES,
  buildPrmMasterOptionsForStepAuthoring,
  coercePrmList,
  filterPrmPlantsByLocation,
  formatPrmActivityLocationCopy,
  formatPrmActivityLocationFieldLabel,
  formatPrmActivityOptionLabel,
  formatPrmActivityOptionPrimary,
  formatPrmActivityOptionSearchText,
  formatPrmCostCentreOptionLabel,
  formatPrmCostCentreOptionPrimary,
  formatPrmCostCentreOptionSearchText,
  formatPrmCostCentreOptionSecondary,
  formatPrmDirectLabourScopeLabel,
  formatPrmPlantMachineryStatusLabel,
  formatPrmProductionOverheadScopeLabel,
  resolvePrmResourceClassDisplayLabel,
  formatPrmRouteStepScopeLabel,
  isBlankPrmValue,
  isPrmOtherPoolStepScope,
  normalizePrmCode,
  normalizePrmIntegerId,
  normalizePrmFamilyRouteStep,
  canonicalizePrmFamilyRouteStepKey,
  collectPrmFamilyRouteStepKeys,
  suggestPrmFamilyRouteStepKey,
  validatePrmFamilyStepMasterIntegrity,
  resolvePrmPoolScopeDlPohRequirement,
} from "./costing-suite-production-route-helpers.js";
import { enhanceSearchableSelect } from "./sasv-module-chrome.js";

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

function optionHtml(value, label, selected, title = "", extra = {}) {
  const sel = String(selected ?? "") === String(value ?? "") ? " selected" : "";
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
  const primary = extra.primary
    ? ` data-primary="${escapeHtml(extra.primary)}"`
    : "";
  const secondary = extra.secondary
    ? ` data-secondary="${escapeHtml(extra.secondary)}"`
    : "";
  const search = extra.search
    ? ` data-search="${escapeHtml(extra.search)}"`
    : "";
  return `<option value="${escapeHtml(value)}"${titleAttr}${primary}${secondary}${search}${sel}>${escapeHtml(label)}</option>`;
}

export function suggestPrmFamilyStepKey(activity = {}, takenKeys = []) {
  if (typeof takenKeys === "number") {
    return suggestPrmFamilyRouteStepKey(activity, new Set());
  }
  return suggestPrmFamilyRouteStepKey(activity, takenKeys);
}

export function nextPrmFamilyStepSequence(steps = [], afterSequence = null) {
  const list = coercePrmList(steps);
  if (afterSequence != null && Number.isFinite(Number(afterSequence))) {
    const after = Number(afterSequence);
    const nextExisting = list
      .map((s) => Number(s.sequence_no))
      .filter((n) => Number.isFinite(n) && n > after)
      .sort((a, b) => a - b)[0];
    if (nextExisting != null) {
      const mid = Math.floor((after + nextExisting) / 2);
      if (mid > after && mid < nextExisting) return mid;
      return after + 1;
    }
    return after + 10;
  }
  const max = list.reduce((acc, s) => {
    const n = Number(s.sequence_no);
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 0);
  return max > 0 ? max + 10 : 10;
}

export function previousPrmFamilyStepSequence(steps = [], beforeSequence = null) {
  const list = coercePrmList(steps);
  if (beforeSequence != null && Number.isFinite(Number(beforeSequence))) {
    const before = Number(beforeSequence);
    const prevExisting = list
      .map((s) => Number(s.sequence_no))
      .filter((n) => Number.isFinite(n) && n < before)
      .sort((a, b) => b - a)[0];
    if (prevExisting != null) {
      const mid = Math.floor((prevExisting + before) / 2);
      if (mid > prevExisting && mid < before) return mid;
      return Math.max(1, before - 1);
    }
    return Math.max(1, before - 10);
  }
  const min = list.reduce((acc, s) => {
    const n = Number(s.sequence_no);
    if (!Number.isFinite(n)) return acc;
    return acc == null ? n : Math.min(acc, n);
  }, null);
  if (min == null) return 10;
  return Math.max(1, min - 10);
}

export function findDuplicatePrmFamilyStepSequences(steps = []) {
  const seen = new Map();
  const dupes = new Set();
  for (const step of coercePrmList(steps)) {
    const seq = Number(step.sequence_no);
    if (!Number.isFinite(seq)) continue;
    if (seen.has(seq)) dupes.add(seq);
    else seen.set(seq, true);
  }
  return [...dupes];
}

export function findDuplicatePrmFamilyStepKeys(steps = [], candidateKey = null, excludeId = null) {
  const want = String(candidateKey || "").trim().toLowerCase();
  if (!want) return false;
  return coercePrmList(steps).some((step) => {
    const id = String(
      step.family_route_step_id ?? step.route_step_id ?? step.step_id ?? step.id ?? "",
    );
    if (excludeId != null && String(excludeId) === id) return false;
    return String(step.step_key || "").trim().toLowerCase() === want;
  });
}

export function validatePrmFamilyStepForm(values = {}, context = {}) {
  return validatePrmFamilyStepMasterIntegrity(values, context);
}

function activityOptionsHtml(activities, selectedId) {
  const opts = ['<option value="">— Select activity —</option>'];
  for (const row of coercePrmList(activities)) {
    const id = normalizePrmIntegerId(row.activity_id ?? row.id);
    if (id == null) continue;
    const label = formatPrmActivityOptionLabel(row);
    const primary = formatPrmActivityOptionPrimary(row);
    const secondary = formatPrmActivityLocationCopy(row);
    const search = formatPrmActivityOptionSearchText(row);
    const title = [label, search, `Activity ${id}`]
      .filter((part) => !isBlankPrmValue(part))
      .join(" · ");
    opts.push(
      optionHtml(id, label, selectedId, title, { primary, secondary, search }),
    );
  }
  return opts.join("");
}

function costCentreOptionsHtml(centres, selectedId) {
  const opts = ['<option value="">— Select cost centre —</option>'];
  for (const row of coercePrmList(centres)) {
    const id = normalizePrmIntegerId(row.cost_centre_id ?? row.id);
    if (id == null) continue;
    const label = formatPrmCostCentreOptionLabel(row);
    const primary = formatPrmCostCentreOptionPrimary(row);
    const secondary = formatPrmCostCentreOptionSecondary(row);
    const search = formatPrmCostCentreOptionSearchText(row);
    const title = [label, search, `Cost Centre ${id}`]
      .filter((part) => !isBlankPrmValue(part))
      .join(" · ");
    opts.push(
      optionHtml(id, label, selectedId, title, { primary, secondary, search }),
    );
  }
  return opts.join("");
}

function resourceClassOptionsHtml(rows, selected) {
  const opts = ['<option value="">— Select —</option>'];
  for (const row of coercePrmList(rows)) {
    const code = normalizePrmCode(
      row?.resource_class_code || row?.code,
    ).toUpperCase();
    if (!code) continue;
    const label = resolvePrmResourceClassDisplayLabel(code, {
      catalogue: rows,
      rowLabel: row?.resource_class_label || row?.label,
    });
    opts.push(
      optionHtml(code, label, selected, code, {
        secondary: code,
        search: `${label} ${code}`,
      }),
    );
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
    .concat(
      codes.map((code) =>
        optionHtml(code, formatter(code), selected, code),
      ),
    )
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

function resolveActivityLocationNames(activity = {}, seed = {}) {
  return {
    sectionName: formatPrmActivityLocationFieldLabel(
      seed.section_name || activity.section_name,
    ),
    subsectionName: formatPrmActivityLocationFieldLabel(
      seed.subsection_name || activity.subsection_name,
    ),
    areaName: formatPrmActivityLocationFieldLabel(
      seed.area_name ?? activity.area_name,
    ),
  };
}

export function buildFamilyStepFormHtml({
  step = null,
  options = {},
  prefix = "prmFamilyStep",
  sequenceSuggestion = 10,
  stepKeySuggestion = "",
} = {}) {
  const enriched = buildPrmMasterOptionsForStepAuthoring(options);
  const resourceClassContext = {
    catalogue: enriched.resource_classes || [],
  };
  const seed = step
    ? normalizePrmFamilyRouteStep(step, resourceClassContext)
    : {};
  const activities = enriched.activities || [];
  const centres = enriched.cost_centres || [];
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
  const { sectionName, subsectionName, areaName } = resolveActivityLocationNames(
    activity,
    seed,
  );
  const plants = filterPrmPlantsByLocation(enriched.plants || [], {
    section_id: sectionId,
    subsection_id: subsectionId,
    area_id: areaId,
  });
  const seq = seed.sequence_no ?? sequenceSuggestion;
  const hasActivity = normalizePrmIntegerId(activityId) != null;
  const stepKey = seed.step_key || (hasActivity ? stepKeySuggestion : "") || "";
  const stepKeyPlaceholder = hasActivity ? "" : "Select Activity first";
  const isPersistedStep =
    normalizePrmIntegerId(
      seed.family_route_step_id ??
        seed.route_step_id ??
        seed.step_id ??
        seed.id,
    ) != null;
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
  const centreDefaultRc = normalizePrmCode(centre.default_resource_class_code);
  const resourceSelected =
    seed.resource_class_code || centreDefaultRc || "";
  const activityContext = formatPrmActivityLocationCopy(activity);
  const exclusionNotice =
    otherPool || excludedCc
      ? `<p class="cp-prm-form-notice" data-prm-other-pool-notice>This route step remains operationally visible but its cost is owned by another pool. Direct Labour and Production Overhead scopes are set to Excluded.</p>`
      : "";

  return `<div class="cp-prm-summary cp-prm-form cp-prm-family-step-form" data-prm-family-step-form>
    ${exclusionNotice}
    <input type="hidden" id="${prefix}SectionId" value="${text(sectionId, "")}" />
    <input type="hidden" id="${prefix}SubsectionId" value="${text(subsectionId, "")}" />
    <input type="hidden" id="${prefix}AreaId" value="${text(areaId, "")}" />
    <section class="cp-detail-section">
      <h3 class="cp-section-title">Identity</h3>
      <div class="cp-detail-grid cp-detail-grid--2col">
        <div class="cp-prm-form-field cp-prm-form-field--full"><span class="cp-field-label">Activity</span>
          <select id="${prefix}Activity" class="cp-period-select" data-prm-searchable-select required>${activityOptionsHtml(activities, activityId)}</select>
          <div class="cp-prm-master-context" data-prm-activity-context ${activityContext ? "" : "hidden"}>
            <span class="cp-field-label">Selected Activity context</span>
            <span class="cp-muted-text" data-prm-activity-context-copy>${text(activityContext)}</span>
          </div>
        </div>
        <div class="cp-prm-form-field cp-prm-form-field--full"><span class="cp-field-label">Cost Centre</span>
          <select id="${prefix}CostCentre" class="cp-period-select" data-prm-searchable-select required>${costCentreOptionsHtml(centres, seed.cost_centre_id)}</select>
        </div>
        <div class="cp-prm-form-field"><span class="cp-field-label">Step key</span>
          <input id="${prefix}Key" data-prm-family-step-key value="${escapeHtml(stepKey)}" placeholder="${escapeHtml(stepKeyPlaceholder)}" readonly required />
          <span class="cp-muted-text">Generated from Activity. Unique semantic identity within this route version.</span>
          <span class="cp-muted-text" data-prm-family-step-key-notice ${isPersistedStep ? "" : "hidden"}>Step identity remains unchanged for this saved route step.</span>
        </div>
        <div class="cp-prm-form-field"><span class="cp-field-label">Sequence</span>
          <input id="${prefix}Seq" type="number" min="1" step="1" value="${escapeHtml(seq)}" required />
          <span class="cp-muted-text">Suggested spacing: 10, 20, 30…</span>
        </div>
      </div>
    </section>
    <section class="cp-detail-section">
      <h3 class="cp-section-title">Location (from Activity)</h3>
      <div class="cp-detail-grid cp-detail-grid--2col">
        ${lockedLocationHtml(prefix, sectionName, subsectionName, areaName)}
        <div class="cp-prm-form-field"><span class="cp-field-label">Plant (optional)</span>
          <select id="${prefix}Plant" class="cp-period-select">${plantOptionsHtml(plants, seed.plant_id)}</select>
        </div>
      </div>
    </section>
    <section class="cp-detail-section">
      <h3 class="cp-section-title">Classification</h3>
      <div class="cp-detail-grid cp-detail-grid--2col">
        <div class="cp-prm-form-field"><span class="cp-field-label">Behaviour</span>
          <select id="${prefix}Behaviour" class="cp-period-select" required>${codeOptionsHtml(behaviours, "behaviour_code", "behaviour_label", seed.behaviour_code)}</select>
        </div>
        <div class="cp-prm-form-field"><span class="cp-field-label">Resource class</span>
          <select id="${prefix}Resource" class="cp-period-select" required>${resourceClassOptionsHtml(resources, resourceSelected)}</select>
          <span class="cp-muted-text" data-prm-resource-default-hint hidden></span>
        </div>
        <div class="cp-prm-form-field cp-prm-form-field--full"><span class="cp-field-label">Route step scope</span>
          <select id="${prefix}Scope" class="cp-period-select" required>${enumOptionsHtml(PRM_ROUTE_STEP_SCOPES, seed.route_step_scope, formatPrmRouteStepScopeLabel)}</select>
          <span class="cp-muted-text">Boundaries and process classification for validation and costing pools.</span>
        </div>
        <div class="cp-prm-form-field"><span class="cp-field-label">Direct Labour scope</span>
          <select id="${prefix}DlScope" class="cp-period-select" required>${enumOptionsHtml(PRM_DIRECT_LABOUR_SCOPES, seed.direct_labour_scope || (otherPool || excludedCc ? "EXCLUDE_OTHER_POOL" : ""), formatPrmDirectLabourScopeLabel)}</select>
        </div>
        <div class="cp-prm-form-field"><span class="cp-field-label">Production Overhead scope</span>
          <select id="${prefix}PohScope" class="cp-period-select" required>${enumOptionsHtml(PRM_PRODUCTION_OVERHEAD_SCOPES, seed.production_overhead_scope || (otherPool || excludedCc ? "EXCLUDE_OTHER_POOL" : ""), formatPrmProductionOverheadScopeLabel)}</select>
        </div>
        <div class="cp-prm-form-field"><span class="cp-field-label">Expected occurrences</span>
          <input id="${prefix}Occ" type="number" min="1" step="1" value="${escapeHtml(seed.expected_occurrence_count ?? 1)}" required />
          <span class="cp-muted-text">Times this step is expected within one standard batch.</span>
        </div>
        <div class="cp-prm-form-field"><span class="cp-field-label">Standard cycles</span>
          <input id="${prefix}Cycles" type="number" min="1" step="1" value="${escapeHtml(seed.standard_cycle_count ?? 1)}" required />
          <span class="cp-muted-text">Governed cycle multiplier for the step.</span>
        </div>
      </div>
    </section>
    <section class="cp-detail-section">
      <h3 class="cp-section-title">Flags & note</h3>
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
        <div class="cp-prm-form-field cp-prm-form-field--full"><span class="cp-field-label">Step note</span>
          <textarea id="${prefix}Note" rows="2">${escapeHtml(seed.step_note || "")}</textarea>
        </div>
      </div>
    </section>
    <div class="cp-prm-form-actions">
      <button type="button" class="icon-btn icon-btn-primary" data-prm-family-step-save>Save step</button>
      ${
        seed.family_route_step_id != null
          ? `<button type="button" class="icon-btn cp-danger-text-btn" data-prm-step-delete="${escapeHtml(seed.family_route_step_id)}">Remove step</button>`
          : ""
      }
    </div>
  </div>`;
}

export function readFamilyStepFormValues(host, prefix = "prmFamilyStep") {
  const num = (sel) => {
    const raw = host.querySelector(sel)?.value;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  const intOrNull = (sel) => normalizePrmIntegerId(host.querySelector(sel)?.value);
  return {
    step_key: canonicalizePrmFamilyRouteStepKey(
      host.querySelector(`#${prefix}Key`)?.value || "",
      { trimEdges: true },
    ),
    sequence_no: num(`#${prefix}Seq`),
    activity_id: intOrNull(`#${prefix}Activity`),
    cost_centre_id: intOrNull(`#${prefix}CostCentre`),
    section_id: intOrNull(`#${prefix}SectionId`),
    subsection_id: intOrNull(`#${prefix}SubsectionId`),
    area_id: intOrNull(`#${prefix}AreaId`),
    plant_id: intOrNull(`#${prefix}Plant`),
    behaviour_code: normalizePrmCode(host.querySelector(`#${prefix}Behaviour`)?.value),
    resource_class_code: normalizePrmCode(
      host.querySelector(`#${prefix}Resource`)?.value,
    ),
    route_step_scope: normalizePrmCode(host.querySelector(`#${prefix}Scope`)?.value),
    direct_labour_scope: normalizePrmCode(
      host.querySelector(`#${prefix}DlScope`)?.value,
    ),
    production_overhead_scope: normalizePrmCode(
      host.querySelector(`#${prefix}PohScope`)?.value,
    ),
    expected_occurrence_count: num(`#${prefix}Occ`),
    standard_cycle_count: num(`#${prefix}Cycles`),
    is_mandatory: Boolean(host.querySelector(`#${prefix}Mandatory`)?.checked),
    allows_repeat: Boolean(host.querySelector(`#${prefix}Repeat`)?.checked),
    allows_skip_with_approval: Boolean(
      host.querySelector(`#${prefix}Skip`)?.checked,
    ),
    step_note: String(host.querySelector(`#${prefix}Note`)?.value || "").trim(),
  };
}

export function bindFamilyStepFormCascade(
  host,
  options = {},
  prefix = "prmFamilyStep",
  extras = {},
) {
  const enriched = buildPrmMasterOptionsForStepAuthoring(options);
  const activityEl = host.querySelector(`#${prefix}Activity`);
  const plantEl = host.querySelector(`#${prefix}Plant`);
  const scopeEl = host.querySelector(`#${prefix}Scope`);
  const ccEl = host.querySelector(`#${prefix}CostCentre`);
  const resourceEl = host.querySelector(`#${prefix}Resource`);
  const resourceHint = host.querySelector("[data-prm-resource-default-hint]");
  const dlEl = host.querySelector(`#${prefix}DlScope`);
  const pohEl = host.querySelector(`#${prefix}PohScope`);
  const keyEl = host.querySelector(`#${prefix}Key`);
  const keyNotice = host.querySelector("[data-prm-family-step-key-notice]");
  const activityContextWrap = host.querySelector("[data-prm-activity-context]");
  const activityContextCopy = host.querySelector("[data-prm-activity-context-copy]");
  const sectionIdEl = host.querySelector(`#${prefix}SectionId`);
  const subsectionIdEl = host.querySelector(`#${prefix}SubsectionId`);
  const areaIdEl = host.querySelector(`#${prefix}AreaId`);
  const sectionNameEl = host.querySelector(`#${prefix}SectionName`);
  const subsectionNameEl = host.querySelector(`#${prefix}SubsectionName`);
  const areaNameEl = host.querySelector(`#${prefix}AreaName`);
  const notice = host.querySelector("[data-prm-other-pool-notice]");
  const seed = extras.seed && typeof extras.seed === "object" ? extras.seed : null;
  const persistedStepId = normalizePrmIntegerId(
    seed?.family_route_step_id ??
      seed?.route_step_id ??
      seed?.step_id ??
      seed?.id,
  );
  const isPersistedStep = persistedStepId != null;
  const fieldState = {
    step_key: {
      mode: isPersistedStep && seed?.step_key ? "persisted" : "empty",
    },
    resource_class_code: {
      mode: "empty",
      lastAuto: "",
    },
    direct_labour_scope: {
      mode: "empty",
    },
    production_overhead_scope: {
      mode: "empty",
    },
  };
  const takenKeys = () =>
    collectPrmFamilyRouteStepKeys({
      steps: extras.existingSteps || [],
      excludeStepId: extras.excludeStepId ?? null,
    });

  const findActivity = (id) =>
    coercePrmList(enriched.activities).find(
      (row) => normalizePrmIntegerId(row.activity_id ?? row.id) === id,
    ) || null;
  const findCentre = (id) =>
    coercePrmList(enriched.cost_centres).find(
      (row) => normalizePrmIntegerId(row.cost_centre_id ?? row.id) === id,
    ) || null;

  const applyStepKeySuggestion = (activity) => {
    if (!keyEl) return;
    if (fieldState.step_key.mode === "persisted") return;
    if (!activity || normalizePrmIntegerId(activity.activity_id ?? activity.id) == null) {
      keyEl.value = "";
      keyEl.placeholder = "Select Activity first";
      fieldState.step_key.mode = "empty";
      return;
    }
    const suggested = suggestPrmFamilyRouteStepKey(activity, takenKeys());
    keyEl.value = suggested;
    keyEl.placeholder = "";
    fieldState.step_key.mode = suggested ? "suggested" : "empty";
  };

  const refreshActivityContext = (activity) => {
    const context = formatPrmActivityLocationCopy(activity || {});
    if (activityContextCopy) {
      activityContextCopy.textContent = context || "";
    }
    if (activityContextWrap) {
      activityContextWrap.hidden = !context;
    }
  };

  const refreshResourceDefaultHint = (centre) => {
    if (!resourceEl || !resourceHint) return;
    const defaultCode = normalizePrmCode(centre?.default_resource_class_code);
    const defaultLabel = resolvePrmResourceClassDisplayLabel(defaultCode, {
      catalogue: enriched.resource_classes || [],
      rowLabel: centre?.default_resource_class_label,
    });
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
      if (dlEl) {
        dlEl.value = "EXCLUDE_OTHER_POOL";
        dlEl.disabled = true;
      }
      if (pohEl) {
        pohEl.value = "EXCLUDE_OTHER_POOL";
        pohEl.disabled = true;
      }
      if (notice) notice.hidden = false;
      else {
        const form = host.querySelector("[data-prm-family-step-form]");
        if (form && !form.querySelector("[data-prm-other-pool-notice]")) {
          form.insertAdjacentHTML(
            "afterbegin",
            `<p class="cp-prm-form-notice" data-prm-other-pool-notice>This route step remains operationally visible but its cost is owned by another pool. Direct Labour and Production Overhead scopes are set to Excluded.</p>`,
          );
        }
      }
      return;
    }
    if (dlEl) dlEl.disabled = false;
    if (pohEl) pohEl.disabled = false;
    if (notice) notice.hidden = true;
  };

  const applyActivityLocation = (activity) => {
    const sectionId = normalizePrmIntegerId(activity?.section_id);
    const subsectionId = normalizePrmIntegerId(activity?.subsection_id);
    const areaId = normalizePrmIntegerId(activity?.area_id);
    if (sectionIdEl) sectionIdEl.value = sectionId ?? "";
    if (subsectionIdEl) subsectionIdEl.value = subsectionId ?? "";
    if (areaIdEl) areaIdEl.value = areaId ?? "";
    const names = resolveActivityLocationNames(activity || {});
    if (sectionNameEl) sectionNameEl.value = names.sectionName;
    if (subsectionNameEl) subsectionNameEl.value = names.subsectionName;
    if (areaNameEl) areaNameEl.value = names.areaName;
    const plants = filterPrmPlantsByLocation(enriched.plants || [], {
      section_id: sectionId,
      subsection_id: subsectionId,
      area_id: areaId,
    });
    if (plantEl) {
      const keep = normalizePrmIntegerId(plantEl.value);
      const still = plants.some(
        (row) => normalizePrmIntegerId(row.plant_id ?? row.id) === keep,
      );
      plantEl.innerHTML = plantOptionsHtml(plants, still ? keep : null);
      if (!still) plantEl.value = "";
    }
    refreshActivityContext(activity);
  };

  const searchableOpts = {
    placeholder: "Search or select…",
    allowEmptyOption: true,
    openOnFocus: true,
    showAllWhenEmpty: true,
    preserveQueryOnBlur: true,
    portalLayer: "modal",
  };
  const enhanceIfNeeded = (el) => {
    if (!el || el._sasvSearch) return;
    if (!el.options || el.options.length <= 1) return;
    enhanceSearchableSelect(el, searchableOpts);
  };

  activityEl?.addEventListener("change", () => {
    const activity = findActivity(normalizePrmIntegerId(activityEl.value));
    applyActivityLocation(activity);
    if (fieldState.step_key.mode === "persisted") {
      if (keyNotice) keyNotice.hidden = false;
    } else {
      applyStepKeySuggestion(activity);
      if (keyNotice) keyNotice.hidden = true;
    }
  });

  ccEl?.addEventListener("change", () => {
    const centre = findCentre(normalizePrmIntegerId(ccEl.value));
    refreshResourceDefaultHint(centre);
    refreshExclusion();
  });

  resourceEl?.addEventListener("change", () => {
    const centre = findCentre(normalizePrmIntegerId(ccEl?.value));
    const defaultCode = normalizePrmCode(centre?.default_resource_class_code);
    const current = normalizePrmCode(resourceEl.value);
    fieldState.resource_class_code.mode =
      defaultCode && current === defaultCode ? "cc_default" : "user";
    refreshResourceDefaultHint(centre);
  });

  scopeEl?.addEventListener("change", refreshExclusion);

  enhanceIfNeeded(activityEl);
  enhanceIfNeeded(ccEl);

  if (seed?.resource_class_code) {
    const centre = findCentre(normalizePrmIntegerId(seed.cost_centre_id));
    const defaultCode = normalizePrmCode(centre?.default_resource_class_code);
    fieldState.resource_class_code.mode =
      normalizePrmCode(seed.resource_class_code) === defaultCode
        ? "cc_default"
        : "user";
  }

  if (isPersistedStep && seed?.step_key && keyEl) {
    keyEl.value = seed.step_key;
    fieldState.step_key.mode = "persisted";
  } else if (activityEl?.value) {
    const activity = findActivity(normalizePrmIntegerId(activityEl.value));
    if (activity && fieldState.step_key.mode !== "persisted") {
      applyStepKeySuggestion(activity);
    }
  }

  const initialCentre = findCentre(normalizePrmIntegerId(ccEl?.value));
  refreshResourceDefaultHint(initialCentre);
  refreshExclusion();
  if (activityEl?.value) {
    applyActivityLocation(findActivity(normalizePrmIntegerId(activityEl.value)));
  }
}
