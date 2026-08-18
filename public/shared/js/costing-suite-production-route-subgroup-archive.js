/**
 * Gate 11Y.10I.2C.3F.1C — Product Subgroup Mappings + Archived Routes lenses.
 * Client-only. Archive is not a normal mapping lifecycle action.
 */

import {
  PRM_ARCHIVED_ENTITY_TYPES,
  PRM_EMPTY_STATES,
  PRM_PRODUCT_SUBGROUP_MAPPING_APPROVAL_REFERENCE_HELPER_TEXT,
  assignmentLifecycleIncludes,
  PRM_ROUTE_FAMILY_DETAILS_UNAVAILABLE,
  buildPrmMappingBasisOptionsHtml,
  buildPrmProductSubgroupMappingApprovalReference,
  buildPrmProductSubgroupMappingOptions,
  buildPrmRouteFamilyMappingSelectOptions,
  clampPrmPagination,
  coercePrmList,
  findPrmApprovedSubgroupMapping,
  findPrmRouteFamilyMasterById,
  findPrmWritableSubgroupMapping,
  formatPrmApprovedFamilyRouteContextLabel,
  formatPrmArchivedEffectivePeriod,
  formatPrmArchivedEntityTypeLabel,
  formatPrmAssignmentStatusLabel,
  formatPrmDayMonthYearLabel,
  formatPrmRouteStatusLabel,
  getPrmLocalIsoDate,
  isBlankPrmValue,
  normalizePrmArchivedRoutesPayload,
  normalizePrmAssignmentLifecycleActions,
  normalizePrmCode,
  normalizePrmIntegerId,
  normalizePrmMappingBasis,
  normalizePrmProductSubgroupMapping,
  normalizePrmSubgroupMappingsPayload,
  resolvePrmApprovedFamilyRouteForFamily,
  resolvePrmProductSubgroupMappingApprovalIdentity,
  resolvePrmRouteFamilyMasterIdentity,
  validatePrmProductSubgroupMappingApprovalReference,
  validatePrmSubgroupMappingCreateSelection,
} from "./costing-suite-production-route-helpers.js";
import {
  buildApproveProductSubgroupMappingArgs,
  buildArchivedRoutesRpcArgs,
  buildInactivateProductSubgroupMappingArgs,
  buildMapProductSubgroupToRouteFamilyArgs,
  buildProductRouteDetailArgs,
  buildRouteFamilyRouteDetailArgs,
  buildSubmitProductSubgroupMappingArgs,
  buildSubgroupMappingsRpcArgs,
  buildUpdateProductSubgroupMappingDraftArgs,
  normalizeRouteFamilyRouteDetail,
  normalizeProductRouteDetail,
} from "./costing-suite-production-route-rpc.js";
import {
  enhanceSearchableSelect,
  destroySearchableSelectsIn,
} from "./sasv-module-chrome.js";

const RPC = Object.freeze({
  subgroupMappings: "rpc_get_production_route_manager_subgroup_mappings",
  mapSubgroup: "rpc_map_product_subgroup_to_route_family",
  updateSubgroupDraft: "rpc_update_product_subgroup_route_family_mapping_draft",
  submitSubgroup: "rpc_submit_product_subgroup_route_family_mapping_for_review",
  approveSubgroup: "rpc_approve_product_subgroup_route_family_mapping",
  inactivateSubgroup: "rpc_inactivate_product_subgroup_route_family_mapping",
  archivedRoutes: "rpc_get_archived_production_route_architecture",
  familyDetail: "rpc_get_route_family_route_detail",
  productDetail: "rpc_get_product_route_detail",
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

export function createPrmSubgroupArchiveController(deps = {}) {
  const {
    state,
    invoke,
    governed,
    canView = () => true,
    canEdit = () => false,
    showToast,
    openModal,
    closeModal,
    isDetailsModalOpen = () => false,
    formShell,
    formField,
    onModal,
    withMutation,
    chip,
    getAsOfDate,
    ensureMasterOptions,
    onRegisterRefreshed,
    hosts,
    on,
    buildEffectiveStepsTableHtml,
  } = deps;

  function subgroupLifecycleModalOpts() {
    return {
      nested:
        typeof isDetailsModalOpen === "function" && isDetailsModalOpen(),
    };
  }

  function subgroupOptionsSource() {
    return (
      state.productSubgroups ||
      state.options?.product_subgroups ||
      []
    );
  }

  function subgroupMappingCache() {
    return coercePrmList([
      ...(state.subgroupMappingRows || []),
      ...(state.routeFamilySubgroupMappings ||
        state.options?.route_family_subgroup_mappings ||
        []),
    ]);
  }

  async function loadSubgroupMappings({ resetOffset = false, search } = {}) {
    if (!canView()) {
      state.permissionDenied = true;
      state.subgroupMappingRows = [];
      state.subgroupMappingTotalCount = 0;
      return { ok: false, permissionDenied: true };
    }
    const current = ++state.subgroupMappingGeneration;
    state.subgroupMappingLoading = true;
    state.permissionDenied = false;
    state.subgroupMappingLoadError = null;
    if (resetOffset) {
      state.page = 1;
      state.offset = 0;
    }
    if (search != null) state.search = String(search || "").trim();
    await ensureMasterOptions();
    const response = await invoke(
      RPC.subgroupMappings,
      buildSubgroupMappingsRpcArgs({
        status: state.subgroup_mapping_status || null,
        search: state.search || null,
        route_family_id: state.route_family_id || null,
        product_group_id: state.product_group_id || null,
        product_subgroup_id: state.product_subgroup_id || null,
        limit: state.limit,
        offset: state.offset,
      }),
      "Unable to load Product Subgroup mappings.",
    );
    if (current !== state.subgroupMappingGeneration) {
      return { ok: false, stale: true };
    }
    state.subgroupMappingLoading = false;
    if (!response.ok) {
      state.subgroupMappingRows = [];
      state.subgroupMappingTotalCount = 0;
      state.subgroupMappingLoadError =
        response.error?.message || "Subgroup Mappings failed to load.";
      return response;
    }
    const normalized = normalizePrmSubgroupMappingsPayload(response.data);
    state.subgroupMappingRows = normalized.rows;
    state.subgroupMappingTotalCount = normalized.total_count;
    state.subgroup_mapping_status_counts = normalized.status_counts || {};
    const page = clampPrmPagination({
      total: state.subgroupMappingTotalCount,
      offset: state.offset,
      limit: state.limit,
      page: state.page,
    });
    state.page = page.page;
    state.offset = page.offset;
    return { ok: true, data: normalized };
  }

  async function refreshSubgroupMappingsAfterMutation({
    refreshFailureMessage = "Mapping updated, but the register could not be refreshed.",
  } = {}) {
    const result = await loadSubgroupMappings({ resetOffset: false });
    if (state.activeLens === "product-subgroup-mappings") {
      if (typeof onRegisterRefreshed === "function") {
        onRegisterRefreshed();
      } else {
        renderSubgroupMappings();
      }
    }
    if (!result?.ok && !result?.stale && !result?.permissionDenied) {
      showToast?.(refreshFailureMessage, "warning", 5200);
    }
    return result;
  }

  function buildSubgroupRowActionsHtml(row) {
    if (!canEdit()) return "";
    const status = normalizePrmCode(row.status).toUpperCase();
    const actions = normalizePrmAssignmentLifecycleActions(row.lifecycle_actions);
    const buttons = [];
    if (status === "DRAFT") {
      buttons.push(["edit-subgroup-mapping", "Edit"]);
      if (assignmentLifecycleIncludes(actions, "SUBMIT_FOR_REVIEW")) {
        buttons.push(["submit-subgroup-mapping", "Submit for review"]);
      }
    }
    if (
      status === "IN_REVIEW" &&
      assignmentLifecycleIncludes(actions, "APPROVE")
    ) {
      buttons.push(["approve-subgroup-mapping", "Approve"]);
    }
    if (status === "APPROVED") {
      buttons.push(["replace-subgroup-mapping", "Create replacement"]);
      if (assignmentLifecycleIncludes(actions, "INACTIVATE")) {
        buttons.push(["inactivate-subgroup-mapping", "Inactivate"]);
      }
    }
    if (!buttons.length) return "";
    return `<div class="cp-prm-actions" data-prm-subgroup-detail-actions>${buttons
      .map(
        ([id, label]) =>
          `<button type="button" class="icon-btn" data-prm-subgroup-action="${text(id)}" data-prm-subgroup-mapping-id="${text(row.mapping_id)}">${text(label)}</button>`,
      )
      .join("")}</div>`;
  }

  function setSubgroupDetailWideModal(enabled) {
    const modal = document.getElementById("detailsModal");
    const windowEl = modal?.querySelector?.(".modal-window");
    if (!windowEl) return;
    windowEl.classList.toggle("cp-prm-modal-window--wide", !!enabled);
    windowEl.classList.toggle("cp-prm-modal-window--subgroup-detail", !!enabled);
    modal?.classList?.toggle("cp-prm-modal-overlay--subgroup-detail", !!enabled);
  }

  function resolveSubgroupMappingFamilyContext(mapping) {
    const family =
      findPrmRouteFamilyMasterById(
        state.routeFamilies || [],
        mapping.route_family_id,
      ) || mapping;
    const identity = resolvePrmRouteFamilyMasterIdentity(family);
    const approvedRoute = resolvePrmApprovedFamilyRouteForFamily(
      family,
      state.approvedFamilyRoutes ||
        state.options?.approved_route_family_routes ||
        [],
    );
    const approvedLabel = approvedRoute
      ? formatPrmApprovedFamilyRouteContextLabel(approvedRoute)
      : "";
    return { family, identity, approvedRoute, approvedLabel };
  }

  function dispatchSubgroupMappingAction(action, row) {
    if (action === "edit-subgroup-mapping") openEditSubgroupMappingModal(row);
    else if (action === "submit-subgroup-mapping") {
      openSubmitSubgroupMappingModal(row);
    } else if (action === "approve-subgroup-mapping") {
      openApproveSubgroupMappingModal(row);
    } else if (action === "replace-subgroup-mapping") {
      openCreateSubgroupMappingModal({
        product_subgroup_id: row.product_subgroup_id,
        replacementOf: row,
      });
    } else if (action === "inactivate-subgroup-mapping") {
      openInactivateSubgroupMappingModal(row);
    }
  }

  function openSubgroupMappingDetailModal(row) {
    const mapping = normalizePrmProductSubgroupMapping(row);
    const mappingId = normalizePrmIntegerId(mapping.mapping_id);
    if (mappingId == null) {
      showToast?.("Mapping details are unavailable.", "warning");
      return;
    }
    const { identity, approvedLabel } =
      resolveSubgroupMappingFamilyContext(mapping);
    const statusLabel =
      formatPrmAssignmentStatusLabel(mapping.status) ||
      formatPrmRouteStatusLabel(mapping.status) ||
      mapping.status ||
      "—";
    const subgroupName =
      mapping.product_subgroup_name ||
      `Product Subgroup ${mapping.product_subgroup_id || ""}`;
    const hierarchy = mapping.hierarchy_label || "";
    const actionsHtml = buildSubgroupRowActionsHtml(mapping);
    openModal({
      title: subgroupName,
      subtitle: identity.primaryLabel || "Product Subgroup mapping",
      html: `<div class="cp-prm-summary cp-prm-subgroup-detail" data-prm-subgroup-mapping-detail data-prm-subgroup-mapping-id="${text(mappingId)}">
        <div class="cp-prm-actions" style="margin-bottom:8px">
          ${chip(mapping.status)}
          <span class="cp-muted-text">${text(statusLabel)}</span>
        </div>
        <section class="cp-detail-section">
          <h3 class="cp-section-title">Identity</h3>
          <div class="cp-detail-grid cp-detail-grid--2col">
            <div><div class="cp-field-label">Mapping ID</div><div>${text(mappingId)}</div></div>
            <div><div class="cp-field-label">Product Subgroup</div><div class="cp-cell-primary">${text(subgroupName)}</div></div>
            <div><div class="cp-field-label">Product Group</div><div>${text(mapping.product_group_name)}</div></div>
            ${
              hierarchy
                ? `<div class="cp-detail-span-full"><div class="cp-field-label">Hierarchy</div><div class="cp-muted-text">${text(hierarchy)}</div></div>`
                : ""
            }
          </div>
        </section>
        <section class="cp-detail-section">
          <h3 class="cp-section-title">Assignment / Route context</h3>
          <div class="cp-detail-grid cp-detail-grid--2col">
            <div><div class="cp-field-label">Route Family</div><div class="cp-cell-primary" title="${text(identity.title, "")}">${text(identity.primaryLabel)}</div></div>
            <div><div class="cp-field-label">Route Family code</div><div>${text(identity.route_family_code)}</div></div>
            ${
              approvedLabel
                ? `<div class="cp-detail-span-full"><div class="cp-field-label">Approved Family Route</div><div data-prm-subgroup-detail-approved-route>${text(approvedLabel)}</div></div>`
                : ""
            }
          </div>
        </section>
        <section class="cp-detail-section">
          <h3 class="cp-section-title">Governance</h3>
          <div class="cp-detail-grid cp-detail-grid--2col">
            <div><div class="cp-field-label">Status</div><div>${chip(mapping.status)}</div></div>
            <div><div class="cp-field-label">Basis</div><div>${text(mapping.mapping_basis)}</div></div>
            <div><div class="cp-field-label">Effective From</div><div>${text(mapping.effective_from)}</div></div>
            <div><div class="cp-field-label">Effective To</div><div>${text(mapping.effective_to)}</div></div>
            <div class="cp-detail-span-full"><div class="cp-field-label">Mapping note</div><div>${text(mapping.mapping_note)}</div></div>
          </div>
        </section>
        <section class="cp-detail-section">
          <h3 class="cp-section-title">Approval</h3>
          <div class="cp-detail-grid cp-detail-grid--2col">
            <div class="cp-detail-span-full"><div class="cp-field-label">Approval Reference</div><div data-prm-subgroup-detail-approval-reference>${text(mapping.approval_reference)}</div></div>
          </div>
        </section>
        <section class="cp-detail-section" data-prm-subgroup-detail-actions-section>
          <h3 class="cp-section-title">Actions</h3>
          ${
            actionsHtml ||
            `<p class="cp-muted-text" data-prm-subgroup-detail-readonly>No lifecycle actions for this mapping status.</p>`
          }
        </section>
      </div>`,
      bind: (host) => {
        setSubgroupDetailWideModal(true);
        onModal(host, "click", (event) => {
          const btn = event.target.closest("[data-prm-subgroup-action]");
          if (!btn) return;
          event.preventDefault();
          event.stopPropagation();
          const action = btn.getAttribute("data-prm-subgroup-action");
          const id = normalizePrmIntegerId(
            btn.getAttribute("data-prm-subgroup-mapping-id"),
          );
          const current =
            (id != null &&
              subgroupMappingCache().find(
                (item) => normalizePrmIntegerId(item.mapping_id) === id,
              )) ||
            mapping;
          // Keep detail as owning modal; lifecycle opens nested (Assignment pattern).
          dispatchSubgroupMappingAction(action, current);
        });
      },
      cleanup: () => {
        setSubgroupDetailWideModal(false);
      },
    });
  }

  function renderSubgroupMappings() {
    const host = hosts();
    host.tableWrap?.classList.remove("hidden");
    const table = document.getElementById("mainTable");
    if (table) {
      table.style.display = "";
      table.setAttribute("data-prm-subgroup-mappings-table", "");
    }
    const colCount = 6;
    host.tableHead.innerHTML = `<tr>
      <th>Product Subgroup</th>
      <th>Product Group</th>
      <th>Route Family</th>
      <th>Status</th>
      <th>Effective From</th>
      <th>Basis</th>
    </tr>`;
    host.summary.classList.add("is-visible");
    host.summary.innerHTML = `<div class="cp-prm-actions">
      <div class="cp-muted-text">Product Subgroup → Route Family mappings · ${text(state.subgroupMappingTotalCount ?? 0)} records · Open a row for detail and actions</div>
      ${
        canEdit()
          ? `<button type="button" class="icon-btn icon-btn-primary" data-prm-create-subgroup-mapping>Create DRAFT</button>`
          : ""
      }
    </div>`;
    on(host.summary, "click", (event) => {
      if (event.target.closest("[data-prm-create-subgroup-mapping]")) {
        openCreateSubgroupMappingModal();
      }
    });
    if (state.subgroupMappingLoading) {
      host.tableBody.innerHTML = `<tr><td colspan="${colCount}"><div class="cost-sheet-explain-loading">Loading Subgroup Mappings…</div></td></tr>`;
      return;
    }
    if (state.subgroupMappingLoadError) {
      host.tableBody.innerHTML = `<tr><td colspan="${colCount}"><div class="status">${text(state.subgroupMappingLoadError)}</div></td></tr>`;
      return;
    }
    const rows = coercePrmList(state.subgroupMappingRows);
    if (!rows.length) {
      host.tableBody.innerHTML = `<tr><td colspan="${colCount}"><div class="status cp-prm-empty-state">${escapeHtml(PRM_EMPTY_STATES.subgroupMappings)}</div></td></tr>`;
      return;
    }
    host.tableBody.innerHTML = rows
      .map((row, index) => {
        const familyIdentity = resolvePrmRouteFamilyMasterIdentity(
          (state.routeFamilies || []).find(
            (item) =>
              normalizePrmIntegerId(item.route_family_id ?? item.id) ===
              row.route_family_id,
          ) || row,
        );
        const subgroupName =
          row.product_subgroup_name ||
          `Product Subgroup ${row.product_subgroup_id || ""}`;
        return `<tr class="cp-prm-row cp-prm-subgroup-mapping-row" tabindex="0" role="button" data-prm-subgroup-mapping-row="${index}" data-prm-subgroup-mapping-id="${text(row.mapping_id)}" title="Open mapping ${text(row.mapping_id, "")}" aria-label="Open Product Subgroup mapping ${text(subgroupName)}">
          <td><div class="cp-cell-primary">${text(subgroupName)}</div></td>
          <td>${text(row.product_group_name)}</td>
          <td title="${text(familyIdentity.title || `Route family ${row.route_family_id || ""}`, "")}"><div class="cp-cell-primary">${text(familyIdentity.primaryLabel)}</div></td>
          <td>${chip(row.status)}</td>
          <td>${text(row.effective_from)}</td>
          <td>${text(row.mapping_basis)}</td>
        </tr>`;
      })
      .join("");
    const openRow = (target) => {
      const tr = target.closest("[data-prm-subgroup-mapping-row]");
      if (!tr) return;
      const index = Number(tr.getAttribute("data-prm-subgroup-mapping-row"));
      const row = rows[index];
      if (row) openSubgroupMappingDetailModal(row);
    };
    on(host.tableBody, "click", (event) => {
      if (event.target.closest("button,a,input,select,textarea,label")) return;
      openRow(event.target);
    });
    on(host.tableBody, "keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target.closest("button,a,input,select,textarea,label")) return;
      const tr = event.target.closest("[data-prm-subgroup-mapping-row]");
      if (!tr) return;
      event.preventDefault();
      openRow(tr);
    });
  }

  function buildSubgroupSelectOptionsHtml(selectedId) {
    const selected = normalizePrmIntegerId(selectedId);
    const opts = buildPrmProductSubgroupMappingOptions(subgroupOptionsSource());
    return [
      `<option value="">Search or select Product Subgroup</option>`,
      ...opts.map((opt) => {
        const sel = selected === opt.product_subgroup_id ? " selected" : "";
        return `<option value="${escapeHtml(opt.product_subgroup_id)}" data-primary="${escapeHtml(opt.label)}" data-secondary="${escapeHtml(opt.secondary || "")}" data-search="${escapeHtml(opt.search || "")}" title="${escapeHtml(opt.secondary || opt.label)}"${sel}>${escapeHtml(opt.label)}</option>`;
      }),
    ].join("");
  }

  function buildRouteFamilySelectOptionsHtml(selectedId) {
    const selected = normalizePrmIntegerId(selectedId);
    const opts = buildPrmRouteFamilyMappingSelectOptions(state.routeFamilies);
    return [
      `<option value="">Search or select Route Family</option>`,
      ...opts.map((opt) => {
        const sel = selected === opt.route_family_id ? " selected" : "";
        return `<option value="${escapeHtml(opt.route_family_id)}" data-primary="${escapeHtml(opt.primary)}" data-secondary="${escapeHtml(opt.secondary || "")}" data-search="${escapeHtml(opt.search || "")}" data-prm-route-family-resolved="${opt.resolved ? "1" : "0"}" title="${escapeHtml(opt.title)}"${sel}>${escapeHtml(opt.label)}</option>`;
      }),
    ].join("");
  }

  function currentCreateSelectionGate(productSubgroupId, routeFamilyId) {
    return validatePrmSubgroupMappingCreateSelection({
      product_subgroup_id: productSubgroupId,
      route_family_id: routeFamilyId,
      productSubgroups: subgroupOptionsSource(),
      routeFamilies: state.routeFamilies || [],
      mappings: subgroupMappingCache(),
      approvedFamilyRoutes:
        state.approvedFamilyRoutes ||
        state.options?.approved_route_family_routes ||
        [],
    });
  }

  function renderRouteFamilySelectionContextHtml(gate) {
    const identity = gate?.identity;
    const fid = gate?.route_family_id;
    if (fid == null) return "";
    if (!identity?.resolved) {
      return `<div class="cp-prm-form-notice" data-prm-subgroup-family-unresolved title="${text(identity?.title || `Route family ${fid}`, "")}">${text(PRM_ROUTE_FAMILY_DETAILS_UNAVAILABLE)}</div>`;
    }
    const parts = [
      `<div class="cp-muted-text" data-prm-subgroup-family-identity title="${text(identity.title, "")}">
        <div class="cp-cell-primary">${text(identity.primaryLabel)}</div>
        ${
          identity.secondaryLabel
            ? `<div>${text(identity.secondaryLabel)}</div>`
            : ""
        }
      </div>`,
    ];
    const approvedLabel = gate.approvedRoute
      ? formatPrmApprovedFamilyRouteContextLabel(gate.approvedRoute)
      : "";
    if (approvedLabel) {
      parts.push(
        `<div class="cp-muted-text" data-prm-subgroup-approved-family-route data-prm-approved-family-route-id="${text(gate.approvedRoute.family_route_id, "")}">Approved Family Route:<br>${text(approvedLabel)}</div>`,
      );
    } else if (
      gate.reasons?.some((reason) => reason.code === "no_approved_family_route")
    ) {
      parts.push(
        `<div class="cp-prm-form-notice" data-prm-subgroup-no-approved-family-route>This Route Family has no approved Family Route. Mapping cannot be created until an approved Family Route exists.</div>`,
      );
    }
    const blocking = (gate.reasons || []).find(
      (reason) =>
        reason.blocksCreate &&
        reason.code !== "writable_exists" &&
        reason.code !== "missing_product_subgroup" &&
        reason.code !== "missing_route_family",
    );
    if (
      blocking &&
      blocking.code !== "no_approved_family_route" &&
      blocking.code !== "route_family_unresolved"
    ) {
      parts.push(
        `<div class="cp-prm-form-notice" data-prm-subgroup-family-create-block>${text(blocking.message)}</div>`,
      );
    }
    return parts.join("");
  }

  function renderApprovedMappingContextHtml(approved) {
    if (!approved) return "";
    return `<div class="cp-prm-form-notice" data-prm-subgroup-approved-context>
      <strong>Current approved mapping</strong><br>
      ${text(approved.route_family_name || approved.route_family_code || approved.route_family_id)}<br>
      Effective from ${text(formatPrmDayMonthYearLabel(approved.effective_from) || approved.effective_from)}<br>
      Approval reference ${text(approved.approval_reference)}
      <p class="cp-muted-text" style="margin:6px 0 0">Creating a replacement Draft does not change the current approved mapping. If the replacement is later approved, the current approved mapping will be superseded from the new effective date.</p>
    </div>`;
  }

  function renderWritableCandidateHtml(writable) {
    if (!writable) return "";
    return `<div class="cp-prm-form-notice" data-prm-subgroup-writable-context>
      A replacement mapping already exists.
      <div class="cp-prm-actions" style="margin-top:8px">
        <button type="button" class="icon-btn" data-prm-open-existing-subgroup-mapping="${text(writable.mapping_id)}">Open existing mapping</button>
      </div>
    </div>`;
  }

  async function openCreateSubgroupMappingModal(prefill = {}) {
    if (!canEdit()) {
      showToast?.("Edit permission required.", "warning");
      return;
    }
    await ensureMasterOptions();
    const preselect = normalizePrmIntegerId(prefill.product_subgroup_id);
    let approved = findPrmApprovedSubgroupMapping(
      subgroupMappingCache(),
      preselect,
    );
    let writable = findPrmWritableSubgroupMapping(
      subgroupMappingCache(),
      preselect,
    );
    openModal({
      title: "Create Product Subgroup mapping Draft",
      subtitle: "Explicit Create DRAFT only — no automatic mapping",
      html: formShell({
        notice:
          "Select a Product Subgroup and Route Family, then create a Draft. Selection alone never creates a mapping.",
        sectionTitle: "Mapping",
        fieldsHtml: [
          `<div id="prmSubgroupContextHost">${
            writable
              ? renderWritableCandidateHtml(writable)
              : renderApprovedMappingContextHtml(approved)
          }</div>`,
          formField({
            id: "prmMapSubgroupSelect",
            label: "Product Subgroup",
            type: "select",
            full: true,
            required: true,
            dataField: "product_subgroup_id",
            optionsHtml: buildSubgroupSelectOptionsHtml(preselect),
          }),
          formField({
            id: "prmMapSubgroupFamilySelect",
            label: "Route Family",
            type: "select",
            full: true,
            required: true,
            dataField: "route_family_id",
            optionsHtml: buildRouteFamilySelectOptionsHtml(
              prefill.route_family_id,
            ),
          }),
          `<div id="prmMapSubgroupFamilyContextHost" data-prm-subgroup-family-context></div>`,
          formField({
            id: "prmMapSubgroupEffectiveFrom",
            label: "Effective from",
            type: "date",
            value: getAsOfDate(),
            dataField: "effective_from",
          }),
          formField({
            id: "prmMapSubgroupBasis",
            label: "Mapping basis",
            type: "select",
            required: true,
            dataField: "mapping_basis",
            optionsHtml: buildPrmMappingBasisOptionsHtml("MANUAL"),
          }),
          formField({
            id: "prmMapSubgroupNote",
            label: "Mapping note",
            type: "textarea",
            rows: 2,
            full: true,
            dataField: "mapping_note",
            placeholder: "Optional governance note",
          }),
        ].join(""),
        actionsHtml: writable
          ? ""
          : `<button type="button" class="icon-btn icon-btn-primary" data-prm-map-subgroup-submit>Create DRAFT</button>`,
      }),
      bind: (host) => {
        const subgroupEl = host.querySelector("#prmMapSubgroupSelect");
        const familyEl = host.querySelector("#prmMapSubgroupFamilySelect");
        if (subgroupEl) {
          enhanceSearchableSelect(subgroupEl, {
            placeholder: "Search or select Product Subgroup",
            allowEmptyOption: true,
            openOnFocus: true,
            showAllWhenEmpty: true,
            clearSelectedOnBackspace: true,
            portalLayer: "modal",
          });
        }
        if (familyEl) {
          enhanceSearchableSelect(familyEl, {
            placeholder: "Search or select Route Family",
            allowEmptyOption: true,
            openOnFocus: true,
            showAllWhenEmpty: true,
            clearSelectedOnBackspace: true,
            portalLayer: "modal",
          });
        }
        const refreshContext = () => {
          const sid = normalizePrmIntegerId(subgroupEl?.value);
          const fid = normalizePrmIntegerId(familyEl?.value);
          const gate = currentCreateSelectionGate(sid, fid);
          approved = gate.approvedMapping;
          writable = gate.writable;
          const ctx = host.querySelector("#prmSubgroupContextHost");
          if (ctx) {
            ctx.innerHTML = writable
              ? renderWritableCandidateHtml(writable)
              : renderApprovedMappingContextHtml(approved);
          }
          const familyCtx = host.querySelector(
            "#prmMapSubgroupFamilyContextHost",
          );
          if (familyCtx) {
            familyCtx.innerHTML = renderRouteFamilySelectionContextHtml(gate);
          }
          const actions = host.querySelector(".cp-prm-form-actions");
          if (actions) {
            if (writable) {
              actions.innerHTML = "";
            } else {
              const disableCreate = gate.reasons.some(
                (reason) =>
                  reason.blocksCreate &&
                  reason.code !== "missing_product_subgroup" &&
                  reason.code !== "missing_route_family",
              );
              actions.innerHTML = `<button type="button" class="icon-btn icon-btn-primary" data-prm-map-subgroup-submit${disableCreate ? " disabled" : ""}>Create DRAFT</button>`;
            }
          }
        };
        refreshContext();
        onModal(host, "change", (event) => {
          if (event.target === subgroupEl || event.target === familyEl) {
            refreshContext();
          }
        });
        onModal(host, "click", async (event) => {
          const openExisting = event.target.closest(
            "[data-prm-open-existing-subgroup-mapping]",
          );
          if (openExisting) {
            const id = normalizePrmIntegerId(
              openExisting.getAttribute(
                "data-prm-open-existing-subgroup-mapping",
              ),
            );
            const existing =
              subgroupMappingCache().find((row) => row.mapping_id === id) ||
              null;
            closeModal({ restorePrevious: false });
            if (existing?.status === "DRAFT") {
              openEditSubgroupMappingModal(existing);
            } else if (existing?.status === "IN_REVIEW") {
              openApproveSubgroupMappingModal(existing);
            } else if (existing) {
              openEditSubgroupMappingModal(existing);
            }
            return;
          }
          const submit = event.target.closest("[data-prm-map-subgroup-submit]");
          if (!submit) return;
          await withMutation(submit, async () => {
            const product_subgroup_id = normalizePrmIntegerId(subgroupEl?.value);
            const route_family_id = normalizePrmIntegerId(familyEl?.value);
            const effective_from =
              host.querySelector("#prmMapSubgroupEffectiveFrom")?.value ||
              getAsOfDate();
            const mapping_basis = normalizePrmMappingBasis(
              host.querySelector("#prmMapSubgroupBasis")?.value,
            );
            const noteRaw = String(
              host.querySelector("#prmMapSubgroupNote")?.value || "",
            ).trim();
            if (product_subgroup_id == null || route_family_id == null) {
              showToast?.(
                "Product Subgroup and Route Family are required.",
                "warning",
              );
              return { ok: false };
            }
            if (!mapping_basis) {
              showToast?.("Mapping basis is required.", "warning");
              return { ok: false };
            }
            const gate = currentCreateSelectionGate(
              product_subgroup_id,
              route_family_id,
            );
            const earlyWritable = gate.writable;
            if (!gate.ok) {
              const first = gate.reasons[0];
              showToast?.(
                first?.message ||
                  "Selected Route Family cannot be used for mapping.",
                "warning",
              );
              refreshContext();
              return { ok: false };
            }
            if (earlyWritable) {
              showToast?.(
                "A replacement mapping already exists. Open the existing mapping.",
                "warning",
              );
              return { ok: false };
            }
            const response = await governed(
              RPC.mapSubgroup,
              buildMapProductSubgroupToRouteFamilyArgs({
                product_subgroup_id,
                route_family_id,
                effective_from,
                mapping_basis,
                mapping_note: noteRaw || null,
              }),
              "Unable to create Product Subgroup mapping Draft.",
            );
            if (!response.ok) {
              await loadSubgroupMappings({ resetOffset: false });
              refreshContext();
              return response;
            }
            showToast?.(
              "Product Subgroup mapping Draft created.",
              "success",
              4200,
            );
            closeModal({ restorePrevious: false });
            await refreshSubgroupMappingsAfterMutation({
              refreshFailureMessage:
                "Mapping created, but the register could not be refreshed.",
            });
            return response;
          });
        });
      },
      cleanup: () => {
        const content = document.getElementById("drawerContent");
        destroySearchableSelectsIn(content);
      },
    },
      subgroupLifecycleModalOpts(),
    );
  }

  function openEditSubgroupMappingModal(row) {
    if (!canEdit()) {
      showToast?.("Edit permission required.", "warning");
      return;
    }
    const mapping = normalizePrmProductSubgroupMapping(row);
    const mappingId = normalizePrmIntegerId(mapping.mapping_id);
    if (!mappingId || mapping.status !== "DRAFT") {
      showToast?.("Only DRAFT mappings can be edited.", "warning");
      return;
    }
    openModal({
      title: "Edit Subgroup mapping Draft",
      subtitle: `Mapping ID ${mappingId}`,
      html: formShell({
        notice: "Update draft fields, then submit for review when ready.",
        sectionTitle: "Pending mapping",
        fieldsHtml: [
          formField({
            id: "prmEditSubgroupEffectiveFrom",
            label: "Effective from",
            type: "date",
            value: mapping.effective_from || getAsOfDate(),
            dataField: "effective_from",
          }),
          formField({
            id: "prmEditSubgroupBasis",
            label: "Mapping basis",
            type: "select",
            required: true,
            dataField: "mapping_basis",
            optionsHtml: buildPrmMappingBasisOptionsHtml(
              normalizePrmMappingBasis(mapping.mapping_basis) || "MANUAL",
            ),
          }),
          formField({
            id: "prmEditSubgroupNote",
            label: "Mapping note",
            type: "textarea",
            rows: 3,
            full: true,
            value: mapping.mapping_note || "",
            dataField: "mapping_note",
          }),
        ].join(""),
        actionsHtml: `<button type="button" class="icon-btn icon-btn-primary" data-prm-edit-subgroup-submit>Save Draft</button>`,
      }),
      bind: (host) => {
        onModal(host, "click", async (event) => {
          const submit = event.target.closest("[data-prm-edit-subgroup-submit]");
          if (!submit) return;
          await withMutation(submit, async () => {
            const response = await governed(
              RPC.updateSubgroupDraft,
              buildUpdateProductSubgroupMappingDraftArgs({
                mapping_id: mappingId,
                patch: {
                  effective_from:
                    host.querySelector("#prmEditSubgroupEffectiveFrom")
                      ?.value || null,
                  mapping_basis: normalizePrmMappingBasis(
                    host.querySelector("#prmEditSubgroupBasis")?.value,
                  ),
                  mapping_note:
                    String(
                      host.querySelector("#prmEditSubgroupNote")?.value || "",
                    ).trim() || null,
                },
              }),
              "Unable to update Subgroup mapping Draft.",
            );
            if (!response.ok) return response;
            showToast?.("Subgroup mapping Draft saved.", "success", 3600);
            closeModal({ restorePrevious: false });
            await refreshSubgroupMappingsAfterMutation({
              refreshFailureMessage:
                "Mapping updated, but the register could not be refreshed.",
            });
            return response;
          });
        });
      },
    },
      subgroupLifecycleModalOpts(),
    );
  }

  function openSubmitSubgroupMappingModal(row) {
    if (!canEdit()) {
      showToast?.("Edit permission required.", "warning");
      return;
    }
    const mapping = normalizePrmProductSubgroupMapping(row);
    const mappingId = normalizePrmIntegerId(mapping.mapping_id);
    if (
      !mappingId ||
      mapping.status !== "DRAFT" ||
      !assignmentLifecycleIncludes(
        mapping.lifecycle_actions,
        "SUBMIT_FOR_REVIEW",
      )
    ) {
      showToast?.(
        "Submit is not available for this Subgroup mapping.",
        "warning",
      );
      return;
    }
    openModal(
      {
      title: "Submit Subgroup mapping for review",
      subtitle: "Does not approve automatically",
      html: formShell({
        notice: "This Draft will move to formal review.",
        sectionTitle: "Mapping",
        fieldsHtml: [
          formField({
            id: "prmSubmitSubgroupId",
            label: "Mapping ID",
            value: String(mappingId),
          }),
          formField({
            id: "prmSubmitSubgroupName",
            label: "Product Subgroup",
            value: mapping.product_subgroup_name,
            full: true,
          }),
          formField({
            id: "prmSubmitSubgroupFamily",
            label: "Route Family",
            value: resolvePrmRouteFamilyMasterIdentity(
              (state.routeFamilies || []).find(
                (item) =>
                  normalizePrmIntegerId(item.route_family_id ?? item.id) ===
                  mapping.route_family_id,
              ) || mapping,
            ).primaryLabel,
          }),
        ].join(""),
        actionsHtml: `<button type="button" class="icon-btn icon-btn-primary" data-prm-submit-subgroup-confirm>Submit for review</button>`,
      }),
      bind: (host) => {
        onModal(host, "click", async (event) => {
          const submit = event.target.closest(
            "[data-prm-submit-subgroup-confirm]",
          );
          if (!submit) return;
          await withMutation(submit, async () => {
            const response = await governed(
              RPC.submitSubgroup,
              buildSubmitProductSubgroupMappingArgs({
                mapping_id: mappingId,
              }),
              "Unable to submit Subgroup mapping for review.",
            );
            if (!response.ok) return response;
            showToast?.(
              "Subgroup mapping submitted for review.",
              "success",
              4200,
            );
            closeModal({ restorePrevious: false });
            await refreshSubgroupMappingsAfterMutation({
              refreshFailureMessage:
                "Mapping submitted, but the register could not be refreshed.",
            });
            return response;
          });
        });
      },
    },
      subgroupLifecycleModalOpts(),
    );
  }

  function openApproveSubgroupMappingModal(row) {
    if (!canEdit()) {
      showToast?.("Edit permission required.", "warning");
      return;
    }
    const mapping = normalizePrmProductSubgroupMapping(row);
    const mappingId = normalizePrmIntegerId(mapping.mapping_id);
    if (!mappingId) {
      showToast?.("Mapping id is required for approval.", "warning");
      return;
    }
    const family =
      findPrmRouteFamilyMasterById(
        state.routeFamilies || [],
        mapping.route_family_id,
      ) || null;
    const identity = resolvePrmProductSubgroupMappingApprovalIdentity({
      mapping,
      routeFamily: family,
      productSubgroupId: mapping.product_subgroup_id,
      routeFamilyCode:
        family?.route_family_code || mapping.route_family_code || null,
    });
    if (!identity.ok) {
      showToast?.(identity.error, "warning");
      return;
    }
    const generated = buildPrmProductSubgroupMappingApprovalReference({
      routeFamilyCode: identity.routeFamilyCode,
      productSubgroupId: identity.productSubgroupId,
      approvalDate: getPrmLocalIsoDate(),
    });
    if (!generated.ok) {
      showToast?.(generated.error, "warning");
      return;
    }
    const approved = findPrmApprovedSubgroupMapping(
      subgroupMappingCache(),
      mapping.product_subgroup_id,
    );
    const isReplacement =
      approved &&
      normalizePrmIntegerId(approved.mapping_id) !== mappingId;
    const warning = isReplacement
      ? `<div class="cp-prm-form-notice" data-prm-subgroup-replacement-warning>
          <strong>This approval will supersede the currently effective Product Subgroup mapping from the new effective date.</strong>
          <div class="cp-detail-grid cp-detail-grid--2col" style="margin-top:8px">
            <div><div class="cp-field-label">Current Route Family</div><div>${text(resolvePrmRouteFamilyMasterIdentity(approved).primaryLabel)}</div></div>
            <div><div class="cp-field-label">Replacement Route Family</div><div>${text(resolvePrmRouteFamilyMasterIdentity(mapping).primaryLabel)}</div></div>
            <div><div class="cp-field-label">Replacement Effective From</div><div>${text(mapping.effective_from)}</div></div>
          </div>
        </div>`
      : "";
    openModal({
      title: "Approve Subgroup mapping",
      subtitle: "Canonical approval reference",
      html: formShell({
        notice:
          warning ||
          "Approve this Product Subgroup → Route Family mapping — does not trigger costing refresh.",
        sectionTitle: "Approval",
        fieldsHtml: [
          formField({
            id: "prmApproveSubgroupRef",
            label: "Approval reference",
            required: true,
            full: true,
            readonly: true,
            value: generated.reference,
            hint: PRM_PRODUCT_SUBGROUP_MAPPING_APPROVAL_REFERENCE_HELPER_TEXT,
          }),
          formField({
            id: "prmApproveSubgroupEffective",
            label: "Effective from",
            type: "date",
            required: true,
            value: mapping.effective_from || getAsOfDate(),
          }),
          isReplacement
            ? `<label class="cp-prm-confirm-check"><input type="checkbox" id="prmApproveSubgroupConfirm"> I confirm this approval will supersede the currently effective Product Subgroup mapping from the new effective date.</label>`
            : "",
        ].join(""),
        actionsHtml: `<button type="button" class="icon-btn icon-btn-primary" data-prm-approve-subgroup-confirm>Approve mapping</button>`,
      }),
      bind: (host) => {
        host.querySelector("[data-prm-approve-subgroup-confirm]")?.focus();
        onModal(host, "click", async (event) => {
          const submit = event.target.closest(
            "[data-prm-approve-subgroup-confirm]",
          );
          if (!submit) return;
          if (isReplacement) {
            const confirmed = host.querySelector("#prmApproveSubgroupConfirm")
              ?.checked;
            if (!confirmed) {
              showToast?.(
                "Confirm supersession before approving the replacement mapping.",
                "warning",
              );
              return;
            }
          }
          await withMutation(submit, async () => {
            const currentMapping =
              normalizePrmProductSubgroupMapping(
                subgroupMappingCache().find(
                  (item) =>
                    normalizePrmIntegerId(item.mapping_id) === mappingId,
                ) || mapping,
              );
            const currentFamily =
              findPrmRouteFamilyMasterById(
                state.routeFamilies || [],
                currentMapping.route_family_id,
              ) || null;
            const currentIdentity =
              resolvePrmProductSubgroupMappingApprovalIdentity({
                mapping: currentMapping,
                routeFamily: currentFamily,
                productSubgroupId: currentMapping.product_subgroup_id,
                routeFamilyCode:
                  currentFamily?.route_family_code ||
                  currentMapping.route_family_code ||
                  null,
              });
            if (!currentIdentity.ok) {
              showToast?.(currentIdentity.error, "warning");
              return { ok: false, reason: currentIdentity.reason };
            }
            const approvalDate = getPrmLocalIsoDate();
            const recomputed = buildPrmProductSubgroupMappingApprovalReference({
              routeFamilyCode: currentIdentity.routeFamilyCode,
              productSubgroupId: currentIdentity.productSubgroupId,
              approvalDate,
            });
            if (!recomputed.ok) {
              showToast?.(recomputed.error, "warning");
              return { ok: false, reason: recomputed.reason };
            }
            const checked = validatePrmProductSubgroupMappingApprovalReference(
              recomputed.reference,
              {
                routeFamilyCode: currentIdentity.routeFamilyCode,
                productSubgroupId: currentIdentity.productSubgroupId,
                approvalDate,
              },
            );
            if (!checked.ok) {
              showToast?.(checked.error, "warning");
              return { ok: false, reason: checked.reason };
            }
            const response = await governed(
              RPC.approveSubgroup,
              buildApproveProductSubgroupMappingArgs({
                mapping_id: mappingId,
                approval_reference: recomputed.reference,
                effective_from: host.querySelector(
                  "#prmApproveSubgroupEffective",
                )?.value,
              }),
              "Unable to approve Subgroup mapping.",
            );
            if (!response.ok) return response;
            showToast?.("Subgroup mapping approved.", "success", 4200);
            closeModal({ restorePrevious: false });
            await refreshSubgroupMappingsAfterMutation({
              refreshFailureMessage:
                "Mapping approved, but the register could not be refreshed.",
            });
            return response;
          });
        });
      },
    },
      subgroupLifecycleModalOpts(),
    );
  }

  function openInactivateSubgroupMappingModal(row) {
    if (!canEdit()) {
      showToast?.("Edit permission required.", "warning");
      return;
    }
    const mapping = normalizePrmProductSubgroupMapping(row);
    openModal({
      title: "Inactivate Subgroup mapping",
      subtitle: "Ends the approved mapping — does not Archive",
      html: formShell({
        notice:
          "Inactivation end-dates this approved mapping. Architectural retirement uses Archive separately and is not available here.",
        sectionTitle: "Inactivation",
        fieldsHtml: [
          formField({
            id: "prmInactivateSubgroupEffectiveTo",
            label: "Effective to",
            type: "date",
            required: true,
            value: getAsOfDate(),
          }),
          formField({
            id: "prmInactivateSubgroupReason",
            label: "Reason",
            type: "textarea",
            rows: 2,
            full: true,
            required: true,
          }),
        ].join(""),
        actionsHtml: `<button type="button" class="icon-btn icon-btn-primary" data-prm-inactivate-subgroup-confirm>Inactivate mapping</button>`,
      }),
      bind: (host) => {
        onModal(host, "click", async (event) => {
          const submit = event.target.closest(
            "[data-prm-inactivate-subgroup-confirm]",
          );
          if (!submit) return;
          await withMutation(submit, async () => {
            const response = await governed(
              RPC.inactivateSubgroup,
              buildInactivateProductSubgroupMappingArgs({
                mapping_id: mapping.mapping_id,
                effective_to: host.querySelector(
                  "#prmInactivateSubgroupEffectiveTo",
                )?.value,
                inactivation_reason: host.querySelector(
                  "#prmInactivateSubgroupReason",
                )?.value,
              }),
              "Unable to inactivate Subgroup mapping.",
            );
            if (!response.ok) return response;
            showToast?.("Subgroup mapping inactivated.", "success", 4200);
            closeModal({ restorePrevious: false });
            await refreshSubgroupMappingsAfterMutation({
              refreshFailureMessage:
                "Mapping inactivated, but the register could not be refreshed.",
            });
            return response;
          });
        });
      },
    },
      subgroupLifecycleModalOpts(),
    );
  }

  async function loadArchivedRoutes({ resetOffset = false, search } = {}) {
    if (!canView()) {
      state.permissionDenied = true;
      state.archivedRouteRows = [];
      state.archivedRouteTotalCount = 0;
      return { ok: false, permissionDenied: true };
    }
    const current = ++state.archivedRouteGeneration;
    state.archivedRouteLoading = true;
    state.archivedRouteLoadError = null;
    if (resetOffset) {
      state.page = 1;
      state.offset = 0;
    }
    if (search != null) state.search = String(search || "").trim();
    const response = await invoke(
      RPC.archivedRoutes,
      buildArchivedRoutesRpcArgs({
        search: state.search || null,
        entity_type: state.archived_entity_type || null,
        limit: state.limit,
        offset: state.offset,
      }),
      "Unable to load archived route architecture.",
    );
    if (current !== state.archivedRouteGeneration) {
      return { ok: false, stale: true };
    }
    state.archivedRouteLoading = false;
    if (!response.ok) {
      state.archivedRouteRows = [];
      state.archivedRouteTotalCount = 0;
      state.archivedRouteLoadError =
        response.error?.message || "Archived Routes failed to load.";
      return response;
    }
    const normalized = normalizePrmArchivedRoutesPayload(response.data);
    state.archivedRouteRows = normalized.rows;
    state.archivedRouteTotalCount = normalized.total_count;
    const page = clampPrmPagination({
      total: state.archivedRouteTotalCount,
      offset: state.offset,
      limit: state.limit,
      page: state.page,
    });
    state.page = page.page;
    state.offset = page.offset;
    return { ok: true, data: normalized };
  }

  function buildArchivedMetadataDetailHtml(row) {
    const entityLabel = formatPrmArchivedEntityTypeLabel(row.entity_type);
    const period = formatPrmArchivedEffectivePeriod(row);
    const fields = [
      ["Type", entityLabel],
      ["Name / Identity", row.name || row.code],
      ["Parent / Route Family", row.parent_name || row.route_family_name],
      [
        "Original status",
        formatPrmRouteStatusLabel(row.original_status) ||
          formatPrmAssignmentStatusLabel(row.original_status) ||
          row.original_status,
      ],
      ["Effective period", period],
      ["Approval reference", row.approval_reference],
      ["Archived at", row.archived_at],
      ["Archived by", row.archived_by],
      ["Archive reason", row.archive_reason],
      ["Route version", row.route_version],
      ["Family Route step count", row.family_route_step_count],
      ["Product Route override count", row.product_route_override_count],
      ["Mapping basis", row.mapping_basis],
      ["Product", row.product_name],
      ["Product Group", row.product_group_name],
      ["Product Subgroup", row.product_subgroup_name],
    ]
      .filter(([, value]) => !isBlankPrmValue(value))
      .map(
        ([label, value]) =>
          `<div><div class="cp-field-label">${text(label)}</div><div>${text(value)}</div></div>`,
      )
      .join("");
    return `<div class="cp-prm-archived-detail" data-prm-archived-detail>
      <div class="cp-prm-actions" style="margin-bottom:8px">
        <span class="cp-prm-badge">Archived</span>
        ${
          row.original_status
            ? `<span class="cp-prm-badge">${text(
                formatPrmRouteStatusLabel(row.original_status) ||
                  formatPrmAssignmentStatusLabel(row.original_status) ||
                  row.original_status,
              )}</span>`
            : ""
        }
      </div>
      <div class="cp-detail-grid cp-detail-grid--2col">${fields}</div>
      ${
        row.archive_reason
          ? `<p class="cp-prm-form-notice" data-prm-archive-reason><strong>Archive reason</strong><br>${text(row.archive_reason)}</p>`
          : ""
      }
    </div>`;
  }

  async function openArchivedDetail(row) {
    const entity = normalizePrmCode(row.entity_type).toUpperCase();
    let richHtml = "";
    if (entity === "FAMILY_ROUTE" && row.family_route_id != null) {
      const detail = await invoke(
        RPC.familyDetail,
        buildRouteFamilyRouteDetailArgs({
          family_route_id: row.family_route_id,
        }),
        "Unable to load archived Family Route detail.",
      );
      if (detail.ok) {
        const normalized = normalizeRouteFamilyRouteDetail(detail.data);
        const steps = coercePrmList(
          normalized?.steps || normalized?.route_steps,
        );
        richHtml = `<h4 class="cp-section-title">Family Route (read-only)</h4>
          <div class="cp-muted-text">${text(normalized?.route_name || row.name)}</div>
          ${
            typeof buildEffectiveStepsTableHtml === "function" && steps.length
              ? buildEffectiveStepsTableHtml(steps)
              : steps.length
                ? `<p class="cp-muted-text">${text(steps.length)} steps</p>`
                : `<p class="cp-muted-text">No steps in detail payload.</p>`
          }`;
      }
    } else if (entity === "PRODUCT_ROUTE" && row.product_route_id != null) {
      const detail = await invoke(
        RPC.productDetail,
        buildProductRouteDetailArgs({
          product_route_id: row.product_route_id,
        }),
        "Unable to load archived Product Route detail.",
      );
      if (detail.ok) {
        const normalized = normalizeProductRouteDetail(detail.data);
        const overrides = coercePrmList(
          normalized?.overrides || normalized?.product_overrides,
        );
        richHtml = `<h4 class="cp-section-title">Product Route (read-only)</h4>
          <div class="cp-detail-grid cp-detail-grid--2col">
            <div><div class="cp-field-label">Product</div><div>${text(row.product_name || normalized?.product_name)}</div></div>
            <div><div class="cp-field-label">Override count</div><div>${text(
              row.product_route_override_count ?? overrides.length,
            )}</div></div>
          </div>`;
      }
    }
    openModal({
      title: `${formatPrmArchivedEntityTypeLabel(entity)} — archived`,
      subtitle: "Read-only historical architecture",
      html: `${buildArchivedMetadataDetailHtml(row)}${richHtml}
        <p class="cp-muted-text">Archived Routes are read-only. Validate, Clone, Edit, Submit, Approve, Delete, and Archive actions are not available here.</p>`,
    });
  }

  function renderArchivedRoutes() {
    const host = hosts();
    host.tableWrap?.classList.remove("hidden");
    const table = document.getElementById("mainTable");
    if (table) table.style.display = "";
    const colCount = 8;
    host.tableHead.innerHTML = `<tr>
      <th>Type</th>
      <th>Name / Identity</th>
      <th>Parent / Route Family</th>
      <th>Original Status</th>
      <th>Effective Period</th>
      <th>Approval Reference</th>
      <th>Archived At</th>
      <th>Archive Reason</th>
    </tr>`;
    const entityOptions = PRM_ARCHIVED_ENTITY_TYPES.map((code) => {
      const label = code
        ? formatPrmArchivedEntityTypeLabel(code)
        : "All";
      const selected =
        String(state.archived_entity_type || "") === String(code)
          ? " selected"
          : "";
      return `<option value="${escapeHtml(code)}"${selected}>${escapeHtml(label)}</option>`;
    }).join("");
    host.summary.classList.add("is-visible");
    host.summary.innerHTML = `<div class="cp-prm-actions cp-prm-archived-toolbar">
      <label class="cp-field-label" for="prmArchivedEntityType">Entity type</label>
      <select id="prmArchivedEntityType" class="cp-period-select" aria-label="Archived entity type">${entityOptions}</select>
      <div class="cp-muted-text">Archived architecture · ${text(state.archivedRouteTotalCount ?? 0)} records</div>
    </div>`;
    on(host.summary, "change", async (event) => {
      const select = event.target.closest("#prmArchivedEntityType");
      if (!select) return;
      state.archived_entity_type = select.value || "";
      await loadArchivedRoutes({ resetOffset: true });
      renderArchivedRoutes();
    });
    if (state.archivedRouteLoading) {
      host.tableBody.innerHTML = `<tr><td colspan="${colCount}"><div class="cost-sheet-explain-loading">Loading Archived Routes…</div></td></tr>`;
      return;
    }
    if (state.archivedRouteLoadError) {
      host.tableBody.innerHTML = `<tr><td colspan="${colCount}"><div class="status">${text(state.archivedRouteLoadError)}</div></td></tr>`;
      return;
    }
    const rows = coercePrmList(state.archivedRouteRows);
    if (!rows.length) {
      host.tableBody.innerHTML = `<tr><td colspan="${colCount}"><div class="status cp-prm-empty-state">${escapeHtml(PRM_EMPTY_STATES.archivedRoutes)}</div></td></tr>`;
      return;
    }
    host.tableBody.innerHTML = rows
      .map((row, index) => {
        const original =
          formatPrmRouteStatusLabel(row.original_status) ||
          formatPrmAssignmentStatusLabel(row.original_status) ||
          row.original_status ||
          "—";
        return `<tr class="cp-prm-row" data-prm-archived-index="${index}" tabindex="0">
          <td><div class="cp-cell-primary">${text(formatPrmArchivedEntityTypeLabel(row.entity_type))}</div><span class="cp-prm-badge">Archived</span></td>
          <td><div class="cp-cell-primary">${text(row.name || row.code)}</div></td>
          <td>${text(row.parent_name || row.route_family_name)}</td>
          <td><span class="cp-prm-badge">${text(original)}</span></td>
          <td>${text(formatPrmArchivedEffectivePeriod(row))}</td>
          <td>${text(row.approval_reference)}</td>
          <td>${text(row.archived_at)}</td>
          <td>${text(row.archive_reason)}</td>
        </tr>`;
      })
      .join("");
    on(host.tableBody, "click", (event) => {
      const tr = event.target.closest("[data-prm-archived-index]");
      if (!tr) return;
      const index = Number(tr.getAttribute("data-prm-archived-index"));
      const row = rows[index];
      if (row) void openArchivedDetail(row);
    });
  }

  return {
    loadSubgroupMappings,
    renderSubgroupMappings,
    openSubgroupMappingDetailModal,
    openCreateSubgroupMappingModal,
    loadArchivedRoutes,
    renderArchivedRoutes,
    openArchivedDetail,
  };
}
