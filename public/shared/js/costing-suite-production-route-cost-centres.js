/**
 * Production Route Manager — Cost Centres master lens (Gate 11Y.10I.2C.1B).
 * Server RPCs remain authoritative for lifecycle and validation.
 */

import {
  PRM_APPROVAL_REFERENCE_HELPER_TEXT,
  PRM_COST_CENTRE_POOL_SCOPES,
  PRM_COST_CENTRE_ROUTE_USE_NOTE,
  PRM_COST_CENTRE_STATUSES,
  PRM_COST_CENTRE_TYPES,
  PRM_PRODUCTION_COST_CENTRE_APPROVAL_REFERENCE_HELPER_TEXT,
  buildPrmProductionCostCentreApprovalReference,
  coercePrmList,
  filterPrmAreasBySectionSubsection,
  filterPrmPlantsByLocation,
  filterPrmSubsectionsBySection,
  formatPrmCostCentrePoolScopeLabel,
  formatPrmCostCentreTypeLabel,
  formatPrmCostCentreValidationLabel,
  buildPrmResourceClassLabelIndex,
  resolvePrmResourceClassDisplayLabel,
  formatPrmRpcError,
  getPrmCostCentreLocationRequirements,
  getPrmLocalIsoDate,
  isBlankPrmValue,
  normalizePrmCode,
  normalizePrmCostCentreValidation,
  normalizePrmIntegerId,
  normalizePrmProductionCostCentreDetailPayload,
  normalizePrmProductionCostCentresPayload,
  resolvePrmProductionCostCentreApprovalIdentity,
  validatePrmProductionCostCentreApprovalReference,
} from "./costing-suite-production-route-helpers.js";
import {
  buildApproveProductionCostCentreRpcArgs,
  buildCreateProductionCostCentreDraftRpcArgs,
  buildInactivateProductionCostCentreRpcArgs,
  buildProductionCostCentreDetailRpcArgs,
  buildProductionCostCentresRpcArgs,
  buildUpdateProductionCostCentreDraftRpcArgs,
  buildValidateProductionCostCentreRpcArgs,
} from "./costing-suite-production-route-rpc.js";

const RPC = Object.freeze({
  list: "rpc_get_production_cost_centres",
  detail: "rpc_get_production_cost_centre_detail",
  create: "rpc_create_production_cost_centre_draft",
  update: "rpc_update_production_cost_centre_draft",
  validate: "rpc_validate_production_cost_centre",
  approve: "rpc_approve_production_cost_centre",
  inactivate: "rpc_inactivate_production_cost_centre",
});

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

export function createProductionCostCentresController(deps = {}) {
  const {
    governed,
    showToast,
    canEdit = () => false,
    openModal,
    closeModal,
    onModal,
    withMutation,
    formField,
    formShell,
    getAsOfDate,
    loadMasterOptions,
    getOptions = () => null,
    getSearch = () => "",
    isActiveLens = () => true,
    clearLensOwnedDom,
    hosts,
    bindRows,
    on,
    onRegisterRefreshed,
  } = deps;

  const state = {
    payload: null,
    rows: [],
    loadError: null,
    statusFilter: "",
    poolFilter: "",
    detail: null,
    loading: false,
  };

  let drawerWired = false;

  function clearPrmDormantStatus() {
    const el = document.getElementById("statusArea");
    if (!el) return;
    el.textContent = "";
    el.innerHTML = "";
    el.hidden = true;
    el.removeAttribute("data-type");
    el.style.display = "none";
  }

  function costCentreFormShell(opts = {}) {
    return formShell({
      ...opts,
      extraClass: ["cp-prm-cost-centre-modal", opts.extraClass]
        .filter(Boolean)
        .join(" "),
    });
  }

  function syncDrawerFilters() {
    const statusEl = document.getElementById("prmCcStatusFilter");
    const poolEl = document.getElementById("prmCcPoolFilter");
    if (statusEl) {
      statusEl.innerHTML = statusFilterOptionsHtml(state.statusFilter);
    }
    if (poolEl) {
      poolEl.innerHTML = poolOptionsHtml(state.poolFilter, true);
    }
    wireDrawerFiltersOnce();
  }

  function wireDrawerFiltersOnce() {
    const drawer = document.getElementById("peqFilterDrawer");
    if (!drawer || drawerWired) return;
    drawerWired = true;
    drawer.addEventListener("change", async (event) => {
      const statusEl = event.target.closest("#prmCcStatusFilter");
      const poolEl = event.target.closest("#prmCcPoolFilter");
      if (!statusEl && !poolEl) return;
      if (!isActiveLens()) return;
      if (statusEl) state.statusFilter = statusEl.value || "";
      if (poolEl) state.poolFilter = poolEl.value || "";
      paintLoading();
      await refreshCostCentresAfterMutation({
        refreshMasterOptions: false,
        refreshFailureMessage:
          "Cost Centres could not be refreshed with the current filters.",
      });
    });
  }

  async function clearFilters() {
    state.statusFilter = "";
    state.poolFilter = "";
    syncDrawerFilters();
    paintLoading();
    const result = await refreshCostCentresAfterMutation({
      refreshMasterOptions: false,
      refreshFailureMessage:
        "Cost Centres could not be refreshed after clearing filters.",
    });
    return result;
  }

  function paintLoading() {
    clearPrmDormantStatus();
    state.loading = true;
    const host = hosts();
    host.tableWrap?.classList.remove("hidden");
    const table = document.getElementById("mainTable");
    if (table) {
      table.style.display = "";
      table.setAttribute("data-prm-cost-centres-table", "");
    }
    if (host.tableHead) {
      host.tableHead.innerHTML = `<tr>
          <th>Code</th><th>Cost Centre</th><th>Type</th><th>Section / Subsection</th>
          <th>Area</th><th>Plant</th><th>Resource Class</th><th>Pool Scope</th>
          <th>Status</th><th>Effective</th><th>Validation</th>
        </tr>`;
    }
    if (host.tableBody) {
      host.tableBody.innerHTML = `<tr data-prm-cc-loading-row><td colspan="11"><div class="status">Loading Cost Centres…</div></td></tr>`;
    }
  }

  function resourceClassDisplayContext() {
    const catalogue = coercePrmList(getOptions()?.resource_classes);
    return {
      catalogue,
      catalogueIndex: buildPrmResourceClassLabelIndex(catalogue),
    };
  }

  function enrichCostCentreResourceLabels(rows = []) {
    const ctx = resourceClassDisplayContext();
    return coercePrmList(rows).map((row) => {
      const code = normalizePrmCode(
        row.default_resource_class_code ||
          row.resource_class ||
          row.resource_class_code,
      );
      const label = resolvePrmResourceClassDisplayLabel(code, {
        ...ctx,
        rowLabel: row.resource_class_label || row.default_resource_class_label,
      });
      return {
        ...row,
        resource_class_label: label,
        default_resource_class_label: label,
      };
    });
  }

  function resourceOptionsHtml(selected = "") {
    const rows = coercePrmList(getOptions()?.resource_classes);
    return ["<option value=\"\">— Select —</option>"]
      .concat(
        rows.map((row) => {
          const code = normalizePrmCode(
            row.code || row.resource_class_code,
          ).toUpperCase();
          if (!code) return "";
          const label = resolvePrmResourceClassDisplayLabel(code, {
            catalogue: rows,
            rowLabel: row.label || row.resource_class_label,
          });
          const sel =
            code === String(selected || "").toUpperCase() ? " selected" : "";
          return `<option value="${text(code)}" title="${text(code)}"${sel}>${text(label)}</option>`;
        }),
      )
      .filter(Boolean)
      .join("");
  }

  function typeOptionsHtml(selected = "") {
    return ["<option value=\"\">— Select —</option>"]
      .concat(
        PRM_COST_CENTRE_TYPES.map((code) => {
          const sel =
            code === String(selected || "").toUpperCase() ? " selected" : "";
          return `<option value="${text(code)}" title="${text(code)}"${sel}>${text(
            formatPrmCostCentreTypeLabel(code),
          )}</option>`;
        }),
      )
      .join("");
  }

  function poolOptionsHtml(selected = "SHARED_ROUTE", includeBlank = false) {
    const head = includeBlank ? ['<option value="">All</option>'] : [];
    return head
      .concat(
        PRM_COST_CENTRE_POOL_SCOPES.map((code) => {
          const sel =
            code === String(selected || "").toUpperCase() ? " selected" : "";
          return `<option value="${text(code)}" title="${text(code)}"${sel}>${text(
            formatPrmCostCentrePoolScopeLabel(code),
          )}</option>`;
        }),
      )
      .join("");
  }

  function statusFilterOptionsHtml(selected = "") {
    return ['<option value="">All</option>']
      .concat(
        PRM_COST_CENTRE_STATUSES.map((code) => {
          const sel =
            code === String(selected || "").toUpperCase() ? " selected" : "";
          return `<option value="${text(code)}"${sel}>${text(code)}</option>`;
        }),
      )
      .join("");
  }

  function hierarchyOptions(rows, idKey, nameKey, selected, extraFn) {
    const opts = ['<option value="">— Select —</option>'];
    for (const row of coercePrmList(rows)) {
      const id = normalizePrmIntegerId(row?.[idKey]);
      if (id == null) continue;
      const name = row?.[nameKey] || id;
      const extra = extraFn ? extraFn(row) : "";
      const sel = id === normalizePrmIntegerId(selected) ? " selected" : "";
      opts.push(
        `<option value="${text(id)}"${sel}>${text(name)}${
          extra ? escapeHtml(extra) : ""
        }</option>`,
      );
    }
    return opts.join("");
  }

  function bindHierarchyCascade(host, prefix) {
    const sectionEl = host.querySelector(`#${prefix}Section`);
    const subsectionEl = host.querySelector(`#${prefix}Subsection`);
    const areaEl = host.querySelector(`#${prefix}Area`);
    const plantEl = host.querySelector(`#${prefix}Plant`);
    const catalogs = getOptions() || {};

    const repopulate = () => {
      const sectionId = normalizePrmIntegerId(sectionEl?.value);
      const subsectionId = normalizePrmIntegerId(subsectionEl?.value);
      const areaId = normalizePrmIntegerId(areaEl?.value);
      const subsections = filterPrmSubsectionsBySection(
        catalogs.subsections,
        sectionId,
      );
      const areas = filterPrmAreasBySectionSubsection(
        catalogs.areas,
        sectionId,
        subsectionId,
      );
      const plants = filterPrmPlantsByLocation(catalogs.plants, {
        section_id: sectionId,
        subsection_id: subsectionId,
        area_id: areaId,
      });
      if (subsectionEl) {
        const keep = subsections.some(
          (r) => normalizePrmIntegerId(r.subsection_id) === subsectionId,
        )
          ? subsectionId
          : null;
        subsectionEl.innerHTML = hierarchyOptions(
          subsections,
          "subsection_id",
          "subsection_name",
          keep,
        );
        if (!keep) subsectionEl.value = "";
      }
      if (areaEl) {
        const keep = areas.some((r) => normalizePrmIntegerId(r.area_id) === areaId)
          ? areaId
          : null;
        areaEl.innerHTML = hierarchyOptions(areas, "area_id", "area_name", keep);
        if (!keep) areaEl.value = "";
      }
      if (plantEl) {
        const plantId = normalizePrmIntegerId(plantEl.value);
        const keep = plants.some((r) => normalizePrmIntegerId(r.plant_id) === plantId)
          ? plantId
          : null;
        plantEl.innerHTML = hierarchyOptions(
          plants,
          "plant_id",
          "plant_name",
          keep,
          (row) =>
            row?.status_label
              ? ` (${row.status_label})`
              : row?.status
                ? ` (${row.status})`
                : "",
        );
        if (!keep) plantEl.value = "";
      }
    };

    onModal(host, "change", (event) => {
      const t = event.target;
      if (t === sectionEl) {
        if (subsectionEl) subsectionEl.value = "";
        if (areaEl) areaEl.value = "";
        if (plantEl) plantEl.value = "";
        repopulate();
      } else if (t === subsectionEl) {
        if (areaEl) areaEl.value = "";
        if (plantEl) plantEl.value = "";
        repopulate();
      } else if (t === areaEl) {
        if (plantEl) plantEl.value = "";
        repopulate();
      }
    });
    repopulate();
    return { repopulate };
  }

  function readForm(host, prefix) {
    return {
      cost_centre_code: host.querySelector(`#${prefix}Code`)?.value?.trim() || "",
      cost_centre_name: host.querySelector(`#${prefix}Name`)?.value?.trim() || "",
      cost_centre_type: host.querySelector(`#${prefix}Type`)?.value || "",
      section_id: host.querySelector(`#${prefix}Section`)?.value || null,
      subsection_id: host.querySelector(`#${prefix}Subsection`)?.value || null,
      area_id: host.querySelector(`#${prefix}Area`)?.value || null,
      plant_id: host.querySelector(`#${prefix}Plant`)?.value || null,
      default_resource_class_code:
        host.querySelector(`#${prefix}ResourceClass`)?.value || null,
      pool_scope:
        host.querySelector(`#${prefix}PoolScope`)?.value || "SHARED_ROUTE",
      effective_from: host.querySelector(`#${prefix}EffectiveFrom`)?.value || null,
      description:
        host.querySelector(`#${prefix}Description`)?.value?.trim() || null,
    };
  }

  function formFieldsHtml(seed = {}, prefix = "prmCc") {
    const catalogs = getOptions() || {};
    const catalogReady = coercePrmList(catalogs.sections).length > 0;
    const notice = catalogReady
      ? ""
      : `<p class="cp-prm-form-notice">Location catalogue unavailable from master options. Section / Subsection / Area / Plant selectors stay empty until catalogues load.</p>`;
    const req = getPrmCostCentreLocationRequirements(seed.cost_centre_type);
    return (
      notice +
      [
        formField({
          id: `${prefix}Code`,
          label: "Code",
          required: true,
          value: seed.cost_centre_code || "",
          placeholder: "PROD_EXAMPLE",
        }),
        formField({
          id: `${prefix}Name`,
          label: "Name",
          required: true,
          value: seed.cost_centre_name || "",
        }),
        formField({
          id: `${prefix}Type`,
          label: "Type",
          type: "select",
          required: true,
          optionsHtml: typeOptionsHtml(seed.cost_centre_type),
        }),
        formField({
          id: `${prefix}Section`,
          label: "Section",
          type: "select",
          optionsHtml: hierarchyOptions(
            catalogs.sections,
            "section_id",
            "section_name",
            seed.section_id,
          ),
        }),
        formField({
          id: `${prefix}Subsection`,
          label: "Subsection",
          type: "select",
          optionsHtml: '<option value="">— Select —</option>',
        }),
        formField({
          id: `${prefix}Area`,
          label: req.areaRequired ? "Area (required for this type)" : "Area",
          type: "select",
          optionsHtml: '<option value="">— Select —</option>',
        }),
        formField({
          id: `${prefix}Plant`,
          label: req.plantRequired
            ? "Plant/Machinery (required for equipment-centred)"
            : "Plant/Machinery",
          type: "select",
          optionsHtml: '<option value="">— Select —</option>',
        }),
        formField({
          id: `${prefix}ResourceClass`,
          label: "Default Resource Class",
          type: "select",
          required: true,
          optionsHtml: resourceOptionsHtml(
            seed.default_resource_class_code || seed.resource_class,
          ),
        }),
        formField({
          id: `${prefix}PoolScope`,
          label: "Pool Scope",
          type: "select",
          required: true,
          optionsHtml: poolOptionsHtml(seed.pool_scope || "SHARED_ROUTE"),
        }),
        formField({
          id: `${prefix}EffectiveFrom`,
          label: "Effective from",
          type: "date",
          required: true,
          value: seed.effective_from || getAsOfDate(),
        }),
        formField({
          id: `${prefix}Description`,
          label: "Description",
          type: "textarea",
          rows: 3,
          full: true,
          value: seed.description || "",
        }),
      ].join("")
    );
  }


  async function load({ search = getSearch() } = {}) {
    state.loadError = null;
    state.loading = true;
    const response = await governed(
      RPC.list,
      buildProductionCostCentresRpcArgs({
        as_of_date: getAsOfDate(),
        status: state.statusFilter || null,
        pool_scope: state.poolFilter || null,
        search: search || null,
      }),
      "Unable to load Production Cost Centres.",
    );
    state.loading = false;
    if (!response.ok) {
      state.loadError =
        formatPrmRpcError(response.error) ||
        "Unable to load Production Cost Centres.";
      state.payload = null;
      state.rows = [];
      return response;
    }
    const payload = normalizePrmProductionCostCentresPayload(
      response.data,
      resourceClassDisplayContext(),
    );
    state.payload = payload;
    state.rows = enrichCostCentreResourceLabels(payload.cost_centres || []);
    return { ok: true, data: payload };
  }

  async function refreshCostCentresAfterMutation({
    refreshFailureMessage = "Cost Centre register could not be refreshed.",
    refreshMasterOptions = true,
  } = {}) {
    if (refreshMasterOptions && typeof loadMasterOptions === "function") {
      try {
        await loadMasterOptions();
      } catch {
        /* master-options sync must not block authoritative register re-read */
      }
    }
    const result = await load({ search: getSearch() });
    state.detail = null;
    if (isActiveLens()) {
      onRegisterRefreshed?.();
    }
    if (!result?.ok) {
      showToast?.(refreshFailureMessage, "warning", 5200);
    }
    return result;
  }

  function openCreate() {
    if (!canEdit()) {
      showToast?.("Edit permission required.", "warning");
      return;
    }
    openModal({
      title: "Create Cost Centre",
      subtitle: "Creates a DRAFT only — no automatic approval",
      html: costCentreFormShell({
        notice:
          "Server validation remains authoritative. HTML required fields do not prove the Cost Centre is valid.",
        sectionTitle: "Cost Centre identity",
        fieldsHtml: formFieldsHtml({}, "prmCcCreate"),
        actionsHtml: `<button type="button" class="icon-btn icon-btn-primary" data-prm-create-cost-centre-submit>Create DRAFT</button>`,
      }),
      bind: (host) => {
        bindHierarchyCascade(host, "prmCcCreate");
        host.querySelector("#prmCcCreateCode")?.focus();
        onModal(host, "click", async (event) => {
          const submit = event.target.closest(
            "[data-prm-create-cost-centre-submit]",
          );
          if (!submit) return;
          await withMutation(submit, async () => {
            const values = readForm(host, "prmCcCreate");
            const response = await governed(
              RPC.create,
              buildCreateProductionCostCentreDraftRpcArgs(values),
              "Unable to create Cost Centre draft.",
            );
            if (!response.ok) return response;
            showToast?.("Cost Centre DRAFT created.", "success");
            closeModal({ restorePrevious: false });
            await refreshCostCentresAfterMutation({
              refreshFailureMessage:
                "Cost Centre created, but the register could not be refreshed.",
            });
            return { ok: true };
          });
        });
      },
    });
  }

  function openEditDraft(centre) {
    if (!canEdit()) {
      showToast?.("Edit permission required.", "warning");
      return;
    }
    if (normalizePrmCode(centre?.status).toUpperCase() !== "DRAFT") {
      showToast?.("Only DRAFT Cost Centres can be edited.", "warning");
      return;
    }
    const seed = {
      cost_centre_code: centre.cost_centre_code || centre.code,
      cost_centre_name: centre.cost_centre_name || centre.name,
      cost_centre_type: centre.cost_centre_type || centre.type,
      section_id: centre.section_id,
      subsection_id: centre.subsection_id,
      area_id: centre.area_id,
      plant_id: centre.plant_id,
      default_resource_class_code: centre.default_resource_class_code,
      pool_scope: centre.pool_scope,
      effective_from: centre.effective_from,
      description: centre.description,
    };
    openModal(
      {
      title: "Edit Cost Centre DRAFT",
      subtitle: centre.cost_centre_code || centre.code || "",
      html: costCentreFormShell({
        notice: "Patch saves DRAFT fields only. No automatic approval.",
        sectionTitle: "Draft fields",
        fieldsHtml: formFieldsHtml(seed, "prmCcEdit"),
        actionsHtml: `<button type="button" class="icon-btn icon-btn-primary" data-prm-edit-cost-centre-submit>Save DRAFT</button>`,
      }),
      bind: (host) => {
        bindHierarchyCascade(host, "prmCcEdit");
        const sectionEl = host.querySelector("#prmCcEditSection");
        if (sectionEl && seed.section_id != null) {
          sectionEl.value = String(seed.section_id);
          sectionEl.dispatchEvent(new Event("change", { bubbles: true }));
        }
        const subsectionEl = host.querySelector("#prmCcEditSubsection");
        if (subsectionEl && seed.subsection_id != null) {
          subsectionEl.value = String(seed.subsection_id);
          subsectionEl.dispatchEvent(new Event("change", { bubbles: true }));
        }
        const areaEl = host.querySelector("#prmCcEditArea");
        if (areaEl && seed.area_id != null) {
          areaEl.value = String(seed.area_id);
          areaEl.dispatchEvent(new Event("change", { bubbles: true }));
        }
        const plantEl = host.querySelector("#prmCcEditPlant");
        if (plantEl && seed.plant_id != null) {
          plantEl.value = String(seed.plant_id);
        }
        onModal(host, "click", async (event) => {
          const submit = event.target.closest(
            "[data-prm-edit-cost-centre-submit]",
          );
          if (!submit) return;
          await withMutation(submit, async () => {
            const values = readForm(host, "prmCcEdit");
            const patch = {
              cost_centre_code: values.cost_centre_code,
              cost_centre_name: values.cost_centre_name,
              cost_centre_type: values.cost_centre_type,
              section_id: values.section_id || null,
              subsection_id: values.subsection_id || null,
              area_id: values.area_id || null,
              plant_id: values.plant_id || null,
              default_resource_class_code: values.default_resource_class_code,
              pool_scope: values.pool_scope,
              effective_from: values.effective_from,
              description: values.description,
            };
            const response = await governed(
              RPC.update,
              buildUpdateProductionCostCentreDraftRpcArgs({
                cost_centre_id: centre.cost_centre_id,
                patch,
              }),
              "Unable to update Cost Centre draft.",
            );
            if (!response.ok) return response;
            showToast?.("Cost Centre DRAFT updated.", "success");
            closeModal({ restorePrevious: false });
            await refreshCostCentresAfterMutation({
              refreshFailureMessage:
                "Cost Centre updated, but the register could not be refreshed.",
            });
            await openDetail({ cost_centre_id: centre.cost_centre_id });
            return { ok: true };
          });
        });
      },
    },
      { replace: true },
    );
  }

  function openApprove(centre) {
    if (!canEdit()) {
      showToast?.("Edit permission required.", "warning");
      return;
    }
    const identity = resolvePrmProductionCostCentreApprovalIdentity({
      detail: centre,
    });
    if (!identity.ok) {
      showToast?.(identity.error, "warning");
      return;
    }
    const generated = buildPrmProductionCostCentreApprovalReference({
      costCentreCode: identity.costCentreCode,
      approvalDate: getPrmLocalIsoDate(),
    });
    if (!generated.ok) {
      showToast?.(generated.error, "warning");
      return;
    }
    openModal(
      {
      title: "Approve Production Cost Centre",
      subtitle: "Canonical approval reference",
      html: costCentreFormShell({
        sectionTitle: "Approval",
        fieldsHtml: [
          formField({
            id: "prmCcApproveRef",
            label: "Approval reference",
            required: true,
            full: true,
            readonly: true,
            value: generated.reference,
            hint: PRM_PRODUCTION_COST_CENTRE_APPROVAL_REFERENCE_HELPER_TEXT,
          }),
          formField({
            id: "prmCcApproveEffective",
            label: "Effective from",
            type: "date",
            required: true,
            value: centre.effective_from || getAsOfDate(),
          }),
        ].join(""),
        actionsHtml: `<button type="button" class="icon-btn icon-btn-primary" data-prm-approve-cost-centre-submit>Approve</button>`,
      }),
      bind: (host) => {
        host
          .querySelector("[data-prm-approve-cost-centre-submit]")
          ?.focus();
        onModal(host, "click", async (event) => {
          const submit = event.target.closest(
            "[data-prm-approve-cost-centre-submit]",
          );
          if (!submit) return;
          await withMutation(submit, async () => {
            const currentIdentity =
              resolvePrmProductionCostCentreApprovalIdentity({
                detail: centre,
              });
            if (!currentIdentity.ok) {
              showToast?.(currentIdentity.error, "warning");
              return { ok: false, reason: currentIdentity.reason };
            }
            const recomputed = buildPrmProductionCostCentreApprovalReference({
              costCentreCode: currentIdentity.costCentreCode,
              approvalDate: getPrmLocalIsoDate(),
            });
            if (!recomputed.ok) {
              showToast?.(recomputed.error, "warning");
              return { ok: false, reason: recomputed.reason };
            }
            const checked = validatePrmProductionCostCentreApprovalReference(
              recomputed.reference,
              {
                costCentreCode: currentIdentity.costCentreCode,
                approvalDate: getPrmLocalIsoDate(),
              },
            );
            if (!checked.ok) {
              showToast?.(checked.error, "warning");
              return { ok: false, reason: checked.reason };
            }
            const response = await governed(
              RPC.approve,
              buildApproveProductionCostCentreRpcArgs({
                cost_centre_id: centre.cost_centre_id,
                approval_reference: recomputed.reference,
                effective_from:
                  host.querySelector("#prmCcApproveEffective")?.value || null,
              }),
              "Unable to approve Cost Centre.",
            );
            if (!response.ok) return response;
            showToast?.("Cost Centre approved.", "success");
            closeModal({ restorePrevious: false });
            await refreshCostCentresAfterMutation({
              refreshFailureMessage:
                "Cost Centre approved, but the register could not be refreshed.",
            });
            return { ok: true };
          });
        });
      },
    },
      { replace: true },
    );
  }

  function openInactivate(centre) {
    if (!canEdit()) {
      showToast?.("Edit permission required.", "warning");
      return;
    }
    openModal(
      {
      title: "Inactivate Cost Centre",
      subtitle: centre.cost_centre_code || centre.code || "",
      html: costCentreFormShell({
        notice:
          "Server rejects inactivation when the Cost Centre is used by an effective approved Route Family route. This action does not rewrite routes.",
        sectionTitle: "Inactivation",
        fieldsHtml: [
          formField({
            id: "prmCcInactivateTo",
            label: "Effective to",
            type: "date",
            required: true,
            value: getAsOfDate(),
          }),
          formField({
            id: "prmCcInactivateRef",
            label: "Inactivation reference",
            required: true,
            hint: PRM_APPROVAL_REFERENCE_HELPER_TEXT,
          }),
        ].join(""),
        actionsHtml: `<button type="button" class="icon-btn icon-btn-primary" data-prm-inactivate-cost-centre-submit>Inactivate</button>`,
      }),
      bind: (host) => {
        host.querySelector("#prmCcInactivateRef")?.focus();
        onModal(host, "click", async (event) => {
          const submit = event.target.closest(
            "[data-prm-inactivate-cost-centre-submit]",
          );
          if (!submit) return;
          await withMutation(submit, async () => {
            const response = await governed(
              RPC.inactivate,
              buildInactivateProductionCostCentreRpcArgs({
                cost_centre_id: centre.cost_centre_id,
                effective_to: host.querySelector("#prmCcInactivateTo")?.value,
                inactivation_reference: host.querySelector(
                  "#prmCcInactivateRef",
                )?.value,
              }),
              "Unable to inactivate Cost Centre.",
            );
            if (!response.ok) return response;
            showToast?.("Cost Centre inactivated.", "success");
            closeModal({ restorePrevious: false });
            await refreshCostCentresAfterMutation({
              refreshFailureMessage:
                "Cost Centre inactivated, but the register could not be refreshed.",
            });
            return { ok: true };
          });
        });
      },
    },
      { replace: true },
    );
  }

  async function openDetail(row, { replace = false } = {}) {
    if (!row) return;
    let centre = row;
    const id = normalizePrmIntegerId(row.cost_centre_id);
    if (id != null) {
      const detail = await governed(
        RPC.detail,
        buildProductionCostCentreDetailRpcArgs({ cost_centre_id: id }),
        "Unable to load Cost Centre detail.",
      );
      if (detail.ok) {
        centre = normalizePrmProductionCostCentreDetailPayload(
          detail.data,
          resourceClassDisplayContext(),
        ).cost_centre;
        state.detail = centre;
      }
    }
    const status = normalizePrmCode(centre.status).toUpperCase();
    const validation = normalizePrmCostCentreValidation(centre.validation);
    const editOk = canEdit();
    const actions = [];
    if (editOk && status === "DRAFT") {
      actions.push(
        `<button type="button" class="icon-btn" data-prm-cc-edit>Edit DRAFT</button>`,
      );
      actions.push(
        `<button type="button" class="icon-btn" data-prm-cc-validate>Validate</button>`,
      );
      if (validation.valid) {
        actions.push(
          `<button type="button" class="icon-btn icon-btn-primary" data-prm-cc-approve>Approve…</button>`,
        );
      }
    }
    if (editOk && status === "APPROVED") {
      actions.push(
        `<button type="button" class="icon-btn" data-prm-cc-inactivate>Inactivate</button>`,
      );
    }
    openModal(
      {
      title: centre.cost_centre_name || centre.name || "Cost Centre",
      subtitle: centre.cost_centre_code || centre.code || "",
      html: `<div class="cp-prm-summary cp-prm-cost-centre-modal" data-prm-cost-centre-detail>
        <section class="cp-detail-section">
          <h3 class="cp-section-title">Identity</h3>
          <div class="cp-detail-grid cp-detail-grid--2col">
            <div><div class="cp-field-label">Code</div><div class="cp-cell-primary" title="${text(
              centre.cost_centre_code || centre.code,
            )}">${text(centre.cost_centre_code || centre.code)}</div></div>
            <div><div class="cp-field-label">Name</div><div>${text(
              centre.cost_centre_name || centre.name,
            )}</div></div>
            <div class="cp-detail-span-full"><div class="cp-field-label">Type</div><div title="${text(
              centre.cost_centre_type || centre.type,
            )}">${text(
              centre.type_label ||
                formatPrmCostCentreTypeLabel(
                  centre.cost_centre_type || centre.type,
                ),
            )}</div></div>
          </div>
        </section>
        <section class="cp-detail-section">
          <h3 class="cp-section-title">Location</h3>
          <div class="cp-detail-grid cp-detail-grid--2col">
            <div><div class="cp-field-label">Section</div><div>${text(
              centre.section_name,
            )}</div></div>
            <div><div class="cp-field-label">Subsection</div><div>${text(
              centre.subsection_name,
            )}</div></div>
            <div><div class="cp-field-label">Area</div><div>${text(
              centre.area_name,
            )}</div></div>
            <div><div class="cp-field-label">Plant</div><div>${text(
              centre.plant_name,
            )}</div></div>
          </div>
        </section>
        <section class="cp-detail-section">
          <h3 class="cp-section-title">Resource</h3>
          <div class="cp-detail-grid cp-detail-grid--2col">
            <div><div class="cp-field-label">Default Resource Class</div><div title="${text(
              centre.default_resource_class_code,
            )}">${text(centre.resource_class_label)}</div></div>
            <div><div class="cp-field-label">Pool Scope</div><div title="${text(
              centre.pool_scope,
            )}">${text(
              centre.pool_scope_label ||
                formatPrmCostCentrePoolScopeLabel(centre.pool_scope),
            )}</div></div>
          </div>
        </section>
        <section class="cp-detail-section">
          <h3 class="cp-section-title">Governance</h3>
          <div class="cp-detail-grid cp-detail-grid--2col">
            <div><div class="cp-field-label">Status</div><div>${text(
              status,
            )}</div></div>
            <div><div class="cp-field-label">Effective from</div><div>${text(
              centre.effective_from,
            )}</div></div>
            <div><div class="cp-field-label">Effective to</div><div>${text(
              centre.effective_to,
            )}</div></div>
            <div><div class="cp-field-label">Approval reference</div><div>${text(
              centre.approval_reference,
            )}</div></div>
            <div class="cp-detail-span-full"><div class="cp-field-label">Validation</div><div title="${text(
              (validation.errors || []).join(", "),
            )}">${text(formatPrmCostCentreValidationLabel(validation))}${
              validation.errors?.length
                ? ` — ${text(validation.errors.join("; "))}`
                : ""
            }</div></div>
          </div>
        </section>
        <section class="cp-detail-section">
          <h3 class="cp-section-title">Description</h3>
          <p class="cp-muted-text cp-prm-cc-desc">${text(
            centre.description || "—",
          )}</p>
        </section>
        <section class="cp-detail-section">
          <h3 class="cp-section-title">Route usage</h3>
          <p class="cp-muted-text cp-prm-cc-desc">${text(
            PRM_COST_CENTRE_ROUTE_USE_NOTE,
          )}</p>
        </section>
        ${
          actions.length
            ? `<div class="cp-prm-form-actions">${actions.join("")}</div>`
            : ""
        }
      </div>`,
      bind: (host) => {
        onModal(host, "click", async (event) => {
          if (event.target.closest("[data-prm-cc-edit]")) {
            event.stopPropagation();
            openEditDraft(centre);
            return;
          }
          if (event.target.closest("[data-prm-cc-approve]")) {
            event.stopPropagation();
            if (!canEdit()) {
              showToast?.("Edit permission required.", "warning");
              return;
            }
            const approveStatus = normalizePrmCode(centre.status).toUpperCase();
            if (approveStatus !== "DRAFT") {
              showToast?.(
                "Only DRAFT Cost Centres can be approved.",
                "warning",
              );
              return;
            }
            const approveValidation = normalizePrmCostCentreValidation(
              centre.validation,
            );
            if (!approveValidation.valid) {
              showToast?.(
                "Validate the Cost Centre before approval.",
                "warning",
              );
              return;
            }
            openApprove(centre);
            return;
          }
          if (event.target.closest("[data-prm-cc-inactivate]")) {
            event.stopPropagation();
            openInactivate(centre);
            return;
          }
          const validateBtn = event.target.closest("[data-prm-cc-validate]");
          if (!validateBtn) return;
          event.stopPropagation();
          await withMutation(validateBtn, async () => {
            const response = await governed(
              RPC.validate,
              buildValidateProductionCostCentreRpcArgs({
                cost_centre_id: centre.cost_centre_id,
              }),
              "Unable to validate Cost Centre.",
            );
            if (!response.ok) return response;
            const v = normalizePrmCostCentreValidation(response.data);
            showToast?.(
              v.valid
                ? "Cost Centre is valid."
                : `Invalid: ${(v.errors || []).join("; ") || "see server errors"}`,
              v.valid ? "success" : "warning",
            );
            await refreshCostCentresAfterMutation({
              refreshMasterOptions: false,
              refreshFailureMessage:
                "Cost Centre validated, but the register could not be refreshed.",
            });
            await openDetail({ cost_centre_id: centre.cost_centre_id }, { replace: true });
            return { ok: true };
          });
        });
      },
    },
      { replace },
    );
  }

  function render() {
    clearPrmDormantStatus();
    const host = hosts();
    host.tableWrap?.classList.remove("hidden");
    const table = document.getElementById("mainTable");
    if (table) {
      table.style.display = "";
      table.setAttribute("data-prm-cost-centres-table", "");
    }
    clearLensOwnedDom();
    syncDrawerFilters();
    const catalogs = getOptions() || {};
    const catalogReady = coercePrmList(catalogs.sections).length > 0;
    const summary = host.summary;
    if (summary) {
      summary.classList.add("is-visible", "cp-prm-cost-centres-summary-host");
      const createBtn = canEdit()
        ? `<button type="button" class="icon-btn icon-btn-primary" data-prm-create-cost-centre>Create Cost Centre</button>`
        : "";
      const catalogMeta = catalogReady
        ? `Catalogues: ${text(coercePrmList(catalogs.sections).length)} sections · ${text(
            coercePrmList(catalogs.subsections).length,
          )} subsections · ${text(coercePrmList(catalogs.areas).length)} areas · ${text(
            coercePrmList(catalogs.plants).length,
          )} plants`
        : "Location catalogues unavailable";
      summary.innerHTML = `<div class="cp-prm-cost-centres-toolbar" data-prm-cost-centres-toolbar>
        <span class="cp-muted-text cp-prm-cc-catalog">${catalogMeta}</span>
        ${createBtn}
      </div>`;
    }
    host.tableHead.innerHTML = `<tr>
          <th>Code</th><th>Cost Centre</th><th>Type</th><th>Section / Subsection</th>
          <th>Area</th><th>Plant</th><th>Resource Class</th><th>Pool Scope</th>
          <th>Status</th><th>Effective</th><th>Validation</th>
        </tr>`;
    if (state.loading) {
      host.tableBody.innerHTML = `<tr data-prm-cc-loading-row><td colspan="11"><div class="status">Loading Cost Centres…</div></td></tr>`;
      on(summary, "click", (event) => {
        if (event.target.closest("[data-prm-create-cost-centre]")) openCreate();
      });
      return;
    }
    if (state.loadError) {
      host.tableBody.innerHTML = `<tr><td colspan="11"><div class="status">${text(
        state.loadError,
      )}</div></td></tr>`;
      on(summary, "click", (event) => {
        if (event.target.closest("[data-prm-create-cost-centre]")) openCreate();
      });
      return;
    }
    const rows = state.rows || [];
    if (!rows.length) {
      host.tableBody.innerHTML = `<tr><td colspan="11"><div class="status">No Production Cost Centres match the current filters.</div></td></tr>`;
    } else {
      host.tableBody.innerHTML = rows
        .map((centre, index) => {
          const effective = centre.effective_to
            ? `${text(centre.effective_from)} → ${text(centre.effective_to)}`
            : text(centre.effective_from);
          return `<tr class="cp-prm-row cp-prm-cost-centre-manager-row" tabindex="0" role="button" data-prm-cost-centre-row="${index}" aria-label="${text(
            centre.cost_centre_name ||
              centre.cost_centre_code ||
              "Cost Centre",
          )}">
              <td class="cp-prm-cc-code">${text(
                centre.cost_centre_code || centre.code,
              )}</td>
              <td><div class="cp-cell-primary">${text(
                centre.cost_centre_name || centre.name,
              )}</div></td>
              <td title="${text(centre.cost_centre_type || centre.type)}">${text(
                centre.type_label ||
                  formatPrmCostCentreTypeLabel(
                    centre.cost_centre_type || centre.type,
                  ),
              )}</td>
              <td>${text(centre.section_subsection_label)}</td>
              <td>${text(centre.area_name)}</td>
              <td>${text(centre.plant_name)}</td>
              <td title="${text(centre.default_resource_class_code)}">${text(
                centre.resource_class_label,
              )}</td>
              <td title="${text(centre.pool_scope)}">${text(
                centre.pool_scope_label ||
                  formatPrmCostCentrePoolScopeLabel(centre.pool_scope),
              )}</td>
              <td>${text(centre.status)}</td>
              <td>${effective}</td>
              <td title="${text((centre.validation?.errors || []).join(", "))}">${text(
                centre.validation_label ||
                  formatPrmCostCentreValidationLabel(centre.validation),
              )}</td>
            </tr>`;
        })
        .join("");
    }
    bindRows();
    on(summary, "click", (event) => {
      if (event.target.closest("[data-prm-create-cost-centre]")) openCreate();
    });
    const tableHost = host.tableBody || table;
    on(tableHost, "click", (event) => {
      const row = event.target.closest("[data-prm-cost-centre-row]");
      if (!row) return;
      const idx = Number(row.getAttribute("data-prm-cost-centre-row"));
      openDetail(state.rows[idx]);
    });
    on(tableHost, "keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const row = event.target.closest("[data-prm-cost-centre-row]");
      if (!row) return;
      event.preventDefault();
      const idx = Number(row.getAttribute("data-prm-cost-centre-row"));
      openDetail(state.rows[idx]);
    });
  }

  return {
    load,
    render,
    paintLoading,
    syncDrawerFilters,
    clearFilters,
    openCreate,
    openDetail,
    getRows: () => state.rows,
    getTotalCount: () => state.rows.length,
    getState: () => state,
    RPC,
  };
}
