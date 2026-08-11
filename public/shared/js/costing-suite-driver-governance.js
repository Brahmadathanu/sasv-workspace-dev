/**
 * Cost Build Manager — Driver Governance lens controller.
 * RPC-only reads + allowlisted lifecycle actions. No draft creation. No Stage 03 / refresh.
 */

import {
  DRIVER_GOVERNANCE_ACTION_CODES,
  DRIVER_GOVERNANCE_APPROVE_ACK_TEXT,
  DRIVER_GOVERNANCE_APPROVE_DISCLAIMER,
  DRIVER_GOVERNANCE_LENS_ID,
  DRIVER_GOVERNANCE_RPC_NAMES,
  DRIVER_GOVERNANCE_SUBMIT_WARNING,
  DRIVER_GOVERNANCE_TABLE_HEADERS,
  DRIVER_GOVERNANCE_UNREGISTERED_COPY,
  buildDriverGovernanceActionArgs,
  buildDriverGovernanceLogicSections,
  buildDriverGovernancePrmHandoffLinks,
  buildGetCostDriverGovernanceDetailArgs,
  buildGetCostDriverPolicyRegistryArgs,
  evaluateDriverGovernanceActionDispatch,
  filterVisibleDriverGovernanceActions,
  formatDriverGovernanceBadgeLabel,
  isDriverGovernanceLens,
  isMeaningfulDriverGovernanceApprovalReference,
  isPrmOwnedDriverCostElement,
  listHasItems,
  normalizeDriverGovernanceCode,
  pickDriverGovernanceCurrentRecord,
  unwrapDriverGovernanceDetailPayload,
  unwrapDriverGovernanceRegistryPayload,
} from "./costing-suite-driver-governance-helpers.js";

export { isDriverGovernanceLens, DRIVER_GOVERNANCE_LENS_ID };

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function text(value, fallback = "—") {
  if (value == null || String(value).trim() === "") return fallback;
  return escapeHtml(value);
}

function chip(value, tone = "") {
  const label = formatDriverGovernanceBadgeLabel(value);
  if (!label) return `<span class="cp-muted-text">—</span>`;
  const cls = tone ? `status-chip ${tone}` : "status-chip";
  return `<span class="${cls}">${escapeHtml(label)}</span>`;
}

function lifecycleTone(status) {
  const s = String(status || "").toUpperCase();
  if (s === "APPROVED") return "status-chip--ok";
  if (s === "DRAFT") return "status-chip--warn";
  if (s === "REVIEW_REQUIRED" || s === "IN_REVIEW") return "status-chip--warn";
  if (s.includes("BLOCK") || s.includes("FAIL")) return "status-chip--danger";
  return "";
}

function validationTone(status) {
  const s = String(status || "").toUpperCase();
  if (s.includes("PASS") || s === "VALID" || s === "OK") return "status-chip--ok";
  if (s.includes("FAIL") || s.includes("INVALID")) return "status-chip--danger";
  if (s.includes("PENDING") || s.includes("REVIEW")) return "status-chip--warn";
  return "";
}

function formatDate(value) {
  if (value == null || value === "") return "—";
  const raw = String(value).slice(0, 10);
  return raw || "—";
}

function formatPerson(value) {
  if (value == null || value === "") return "—";
  if (typeof value === "object") {
    return (
      value.display_name ||
      value.full_name ||
      value.name ||
      value.email ||
      (value.id ? String(value.id).slice(0, 8) : "—")
    );
  }
  const s = String(value);
  if (/^[0-9a-f-]{36}$/i.test(s)) return `${s.slice(0, 8)}…`;
  return s;
}

function kvRows(pairs) {
  return `<div class="cp-detail-grid cp-detail-grid--2col">${pairs
    .map(
      ([label, value]) =>
        `<div><div class="cp-field-label">${text(label)}</div><div>${value}</div></div>`,
    )
    .join("")}</div>`;
}

function factorsTable(factors, emptyLabel) {
  if (!listHasItems(factors)) return "";
  const rows = factors
    .map((f) => {
      const r = f && typeof f === "object" ? f : {};
      const name =
        r.factor_name ||
        r.name ||
        r.code ||
        r.factor_code ||
        r.label ||
        "Factor";
      const value =
        r.factor_value ?? r.value ?? r.weight ?? r.multiplier ?? r.factor ?? "—";
      const note = r.note || r.description || r.scope || "";
      return `<tr><td>${text(name)}</td><td>${text(value)}</td><td>${text(
        note,
        "",
      )}</td></tr>`;
    })
    .join("");
  return `<div class="table-scroll"><table class="data-table"><thead><tr><th>Factor</th><th>Value</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function historyTable(rows) {
  if (!listHasItems(rows)) return "";
  const body = rows
    .map((item) => {
      const r = item && typeof item === "object" ? item : {};
      const id = r.policy_id ?? r.envelope_id ?? r.id ?? r.record_id ?? "—";
      const ver = r.policy_version ?? r.version ?? "—";
      const status = r.lifecycle_status || r.status || "—";
      const formula = r.formula_type || r.formula || "—";
      const from = formatDate(r.effective_from);
      const to = formatDate(r.effective_to);
      return `<tr>
        <td>${text(id)}</td>
        <td>${text(ver)}</td>
        <td>${chip(status, lifecycleTone(status))}</td>
        <td>${text(formula)}</td>
        <td>${text(from)}</td>
        <td>${text(to)}</td>
      </tr>`;
    })
    .join("");
  return `<div class="table-scroll"><table class="data-table"><thead><tr>
    <th>ID</th><th>Version</th><th>Status</th><th>Formula</th><th>From</th><th>To</th>
  </tr></thead><tbody>${body}</tbody></table></div>`;
}

function auditBlock(record) {
  if (!record || typeof record !== "object") return "";
  const pairs = [
    ["Created", `${formatDate(record.created_at)} · ${formatPerson(record.created_by || record.created_by_name)}`],
    ["Submitted", `${formatDate(record.submitted_at)} · ${formatPerson(record.submitted_by || record.submitted_by_name)}`],
    ["Approved", `${formatDate(record.approved_at)} · ${formatPerson(record.approved_by || record.approved_by_name)}`],
    ["Approval reference", record.approval_reference || "—"],
    ["Superseded", `${formatDate(record.superseded_at)} · ${formatPerson(record.superseded_by || record.superseded_by_name)}`],
    ["Effective range", `${formatDate(record.effective_from)} → ${formatDate(record.effective_to)}`],
    ["Lifecycle", record.lifecycle_status || record.status || "—"],
  ].filter(([, v]) => v && !String(v).startsWith("— · —"));
  if (!pairs.length) return "";
  return kvRows(
    pairs.map(([k, v]) => [k, text(v)]),
  );
}

export function createDriverGovernanceController(deps = {}) {
  const {
    costingRpc,
    showToast,
    text: shellText,
    statusChip,
    canView = () => true,
    canEditCbm = () => false,
    canEditPrm = () => false,
    navigateToCostingRoute,
    openDetails,
    closeDetails,
    setRowsAndView,
    renderTable,
    getCurrentLens,
    onAfterMutation = null,
  } = deps;

  const t = typeof shellText === "function" ? shellText : text;

  const state = {
    rows: [],
    loading: false,
    error: null,
    selectedCostElementCode: null,
    detail: null,
    detailLoading: false,
    detailError: null,
    detailRequestId: 0,
    detailActionToken: 0,
    pendingAction: null,
    lifecycleBusy: false,
  };

  let submitModalEl = null;
  let approveModalEl = null;

  function viewOnly() {
    return canView() === true && canEditCbm() !== true && canEditPrm() !== true
      ? canView() && !canEditCbm()
      : canView() === true && canEditCbm() !== true;
  }

  function isActiveLens() {
    return isDriverGovernanceLens(getCurrentLens?.() || "");
  }

  function clearPendingAction() {
    state.pendingAction = null;
  }

  function disableLifecycleControls() {
    clearPendingAction();
    state.detailActionToken += 1;
  }

  function getTableHeaders() {
    return [...DRIVER_GOVERNANCE_TABLE_HEADERS];
  }

  function getTableAlignments() {
    return DRIVER_GOVERNANCE_TABLE_HEADERS.map(() => "c-left");
  }

  function renderRegistryValidationCell(row) {
    // Never invent PASS from registry absence.
    if (row.validation_status == null || row.validation_status === "") {
      return `<span class="cp-muted-text">—</span>`;
    }
    return chip(row.validation_status, validationTone(row.validation_status));
  }

  function renderTableRow(row, trAttrs = "", idx = 0) {
    const selected =
      normalizeDriverGovernanceCode(state.selectedCostElementCode) ===
      normalizeDriverGovernanceCode(row.cost_element_code);
    const attrs = `${trAttrs} data-row-index="${idx}" data-dg-code="${escapeHtml(
      row.cost_element_code || "",
    )}" class="${selected ? "is-selected" : ""}"`.trim();
    return `<tr ${attrs}>
      <td class="c-left"><div class="cp-cell-primary">${t(
        row.cost_element_label,
      )}</div></td>
      <td class="c-left">${t(row.driver_domain)}</td>
      <td class="c-left">${t(row.formula_type)}</td>
      <td class="c-left">${chip(
        row.lifecycle_status,
        lifecycleTone(row.lifecycle_status),
      )}</td>
      <td class="c-left">${renderRegistryValidationCell(row)}</td>
      <td class="c-left">${t(formatDate(row.effective_from))}</td>
      <td class="c-left">${chip(row.maturity_status)}</td>
      <td class="c-left">${chip(row.client_status)}</td>
      <td class="c-left">${chip(row.data_quality_status)}</td>
      <td class="c-left">${chip(row.cutover_status)}</td>
      <td class="c-left">${t(row.owner_module)}</td>
    </tr>`;
  }

  async function loadRegistry({ preserveSelection = true } = {}) {
    if (!canView()) {
      state.rows = [];
      state.error = "View permission required.";
      return { ok: false, reason: "permission" };
    }
    state.loading = true;
    state.error = null;
    const built = buildGetCostDriverPolicyRegistryArgs({});
    if (!built.ok) {
      state.loading = false;
      state.error = built.errors.join("; ");
      return { ok: false, error: state.error };
    }
    try {
      const { data, error } = await costingRpc(
        DRIVER_GOVERNANCE_RPC_NAMES.registry,
        built.params,
      );
      if (error) throw error;
      state.rows = unwrapDriverGovernanceRegistryPayload(data);
      state.loading = false;
      if (typeof setRowsAndView === "function") {
        setRowsAndView({
          allRows: state.rows,
          view: state.rows,
          currentPage: 1,
        });
      }
      if (
        preserveSelection &&
        state.selectedCostElementCode &&
        !state.rows.some(
          (r) =>
            normalizeDriverGovernanceCode(r.cost_element_code) ===
            normalizeDriverGovernanceCode(state.selectedCostElementCode),
        )
      ) {
        state.selectedCostElementCode = null;
        state.detail = null;
      }
      return { ok: true, rows: state.rows };
    } catch (err) {
      console.error("[driver-governance] registry failed", err);
      state.loading = false;
      state.error = err?.message || "Unable to load driver policy registry.";
      state.rows = [];
      if (typeof setRowsAndView === "function") {
        setRowsAndView({ allRows: [], view: [], currentPage: 1 });
      }
      showToast?.(state.error, "error");
      return { ok: false, error: state.error };
    }
  }

  async function loadDetail(costElementCode) {
    const code = normalizeDriverGovernanceCode(costElementCode);
    if (!code) return { ok: false, reason: "missing_code" };
    if (!canView()) {
      state.detailError = "View permission required.";
      return { ok: false, reason: "permission" };
    }

    const requestId = ++state.detailRequestId;
    const selectedCode = code;
    state.selectedCostElementCode = code;
    state.detailLoading = true;
    state.detailError = null;
    state.detail = null;
    clearPendingAction();
    state.detailActionToken += 1;

    const built = buildGetCostDriverGovernanceDetailArgs({
      cost_element_code: code,
    });
    if (!built.ok) {
      if (
        requestId !== state.detailRequestId ||
        selectedCode !== state.selectedCostElementCode
      ) {
        return { ok: false, reason: "stale" };
      }
      state.detailLoading = false;
      state.detailError = built.errors.join("; ");
      return { ok: false, error: state.detailError };
    }

    try {
      const { data, error } = await costingRpc(
        DRIVER_GOVERNANCE_RPC_NAMES.detail,
        built.params,
      );
      if (
        requestId !== state.detailRequestId ||
        selectedCode !== state.selectedCostElementCode
      ) {
        return { ok: false, reason: "stale" };
      }
      if (error) throw error;
      const unwrapped = unwrapDriverGovernanceDetailPayload(data);
      state.detail = unwrapped;
      state.detailLoading = false;
      state.detailActionToken += 1;
      return { ok: true, detail: unwrapped, requestId };
    } catch (err) {
      if (
        requestId !== state.detailRequestId ||
        selectedCode !== state.selectedCostElementCode
      ) {
        return { ok: false, reason: "stale" };
      }
      console.error("[driver-governance] detail failed", err);
      state.detailLoading = false;
      state.detailError =
        err?.message || "Unable to load cost driver governance detail.";
      state.detail = null;
      showToast?.(state.detailError, "error");
      return { ok: false, error: state.detailError };
    }
  }

  function visibleActions() {
    if (
      state.detailLoading ||
      state.detailError ||
      !state.detail ||
      !state.selectedCostElementCode
    ) {
      return [];
    }
    // View-only CBM users (no CBM edit and no PRM edit) see no mutation controls.
    // Users with PRM edit may still see DL/POH actions; CBM edit sees envelope actions.
    if (canEditCbm() !== true && canEditPrm() !== true) {
      return [];
    }
    return filterVisibleDriverGovernanceActions(state.detail.actions || [], {
      canEditCbm: canEditCbm() === true,
      canEditPrm: canEditPrm() === true,
      viewOnly: false,
    });
  }

  function renderValidationSection(validation) {
    if (validation == null) return "";
    if (typeof validation !== "object") {
      return `<p>${chip(validation, validationTone(validation))}</p>`;
    }
    const status =
      validation.status ||
      validation.result ||
      validation.validation_status ||
      null;
    const messages = Array.isArray(validation.messages)
      ? validation.messages
      : Array.isArray(validation.errors)
        ? validation.errors
        : validation.message
          ? [validation.message]
          : [];
    return `${status ? `<div style="margin-bottom:8px">${chip(
      status,
      validationTone(status),
    )}</div>` : ""}${
      messages.length
        ? `<ul class="cp-prm-mapping-list">${messages
            .map((m) => `<li>${text(typeof m === "string" ? m : m.message || JSON.stringify(m))}</li>`)
            .join("")}</ul>`
        : ""
    }`;
  }

  function renderFormulaSection(formula) {
    if (formula == null || formula === "") return "";
    if (typeof formula === "string" || typeof formula === "number") {
      return `<p>${text(formula)}</p>`;
    }
    const label =
      formula.formula_type ||
      formula.display ||
      formula.label ||
      formula.code ||
      null;
    const explain = formula.explanation || formula.description || formula.note;
    return `${label ? `<p><strong>${text(label)}</strong></p>` : ""}${
      explain ? `<p class="cp-muted-text">${text(explain)}</p>` : ""
    }`;
  }

  function renderDriverLogicSteps(steps) {
    if (!Array.isArray(steps) || !steps.length) return "";
    return `<table class="generic-table" style="width:100%;margin:0">
      <tbody>
        ${steps
          .map(
            (step) => `<tr>
            <td class="c-center" style="width:36px">${text(step.order)}</td>
            <td class="c-left">${text(step.text)}</td>
          </tr>`,
          )
          .join("")}
      </tbody>
    </table>`;
  }

  function renderDriverLogicSection(explanation) {
    const blocks = buildDriverGovernanceLogicSections(explanation);
    if (!blocks.length) return "";
    const body = blocks
      .map((block) => {
        if (block.kind === "steps") {
          return `<div class="cp-detail-subsection" style="margin-top:10px">
            <div class="cp-field-label">${text(block.label)}</div>
            ${renderDriverLogicSteps(block.value)}
          </div>`;
        }
        return `<div class="cp-detail-subsection" style="margin-top:10px">
          <div class="cp-field-label">${text(block.label)}</div>
          <div style="font-size:13px;line-height:1.45">${text(block.value)}</div>
        </div>`;
      })
      .join("");
    return `<section class="cp-detail-section">
      <h3 class="cp-section-title">Driver Logic</h3>
      ${body}
    </section>`;
  }

  function renderPrmLinks(code) {
    if (!isPrmOwnedDriverCostElement(code)) return "";
    const links = buildDriverGovernancePrmHandoffLinks();
    return `<div class="cp-prm-actions" style="flex-wrap:wrap;gap:8px">${links
      .map(
        (link) =>
          `<button type="button" class="icon-btn" data-dg-prm-link="${escapeHtml(
            link.lens,
          )}">${text(link.label)}</button>`,
      )
      .join("")}</div>`;
  }

  function renderActionsHtml() {
    if (state.detailLoading) {
      return `<p class="cp-muted-text">Loading actions…</p>`;
    }
    if (state.detailError) {
      return `<p class="cp-muted-text">Actions unavailable while detail is in error.</p>`;
    }
    if (state.detail?.is_unregistered) {
      return `<p class="cp-muted-text">No enabled lifecycle actions.</p>
        <p class="cp-muted-text">${text(DRIVER_GOVERNANCE_UNREGISTERED_COPY)}</p>`;
    }
    const actions = visibleActions();
    if (!actions.length) {
      return `<p class="cp-muted-text">No enabled lifecycle actions.</p>`;
    }
    return `<div class="cp-prm-actions">${actions
      .map((action) => {
        const label =
          action.action_code === DRIVER_GOVERNANCE_ACTION_CODES.APPROVE
            ? "Approve Policy"
            : "Submit for Review";
        return `<button type="button" class="icon-btn icon-btn-primary" data-dg-action-code="${escapeHtml(
          action.action_code,
        )}" data-dg-action-rpc="${escapeHtml(action.rpc)}" data-dg-record-id="${escapeHtml(
          action.record_id,
        )}" ${state.lifecycleBusy ? "disabled" : ""}>${text(label)}</button>`;
      })
      .join("")}</div>`;
  }

  function buildDetailHtml() {
    const code = state.selectedCostElementCode;
    const registryRow =
      state.rows.find(
        (r) =>
          normalizeDriverGovernanceCode(r.cost_element_code) ===
          normalizeDriverGovernanceCode(code),
      ) || null;

    if (state.detailLoading) {
      return `<div class="cost-sheet-explain-loading">Loading governance detail…</div>`;
    }
    if (state.detailError) {
      return `<p class="cp-danger-text">${text(state.detailError)}</p>`;
    }
    if (!state.detail) {
      return `<p class="cp-muted-text">Select a cost element to inspect governance detail.</p>`;
    }

    const payload = state.detail;
    const d = payload.detail || {};
    const current = pickDriverGovernanceCurrentRecord(payload);
    const elementLabel =
      payload.cost_element?.label ||
      payload.cost_element?.name ||
      registryRow?.cost_element_label ||
      code;

    if (payload.is_unregistered) {
      const unregisteredLogic = renderDriverLogicSection(d.formula_explanation);
      return `
        <section class="cp-detail-section">
          <h3 class="cp-section-title">Policy not yet registered</h3>
          <p class="cp-muted-text">${text(DRIVER_GOVERNANCE_UNREGISTERED_COPY)}</p>
          ${kvRows([
            ["Cost element", text(elementLabel)],
            ["Code", text(code)],
            ["Driver domain", text(registryRow?.driver_domain || payload.cost_element?.driver_domain)],
            ["Canonical owner", text(payload.owner_module || registryRow?.owner_module)],
          ])}
        </section>
        ${unregisteredLogic}
        <section class="cp-detail-section">
          <h3 class="cp-section-title">Available Actions</h3>
          ${renderActionsHtml()}
        </section>`;
    }

    const sections = [];

    sections.push(`<section class="cp-detail-section">
      <h3 class="cp-section-title">Policy Summary</h3>
      ${kvRows([
        ["Cost element", text(elementLabel)],
        ["Policy / envelope code", text(current?.policy_code || current?.code || current?.envelope_code)],
        ["Version", text(current?.policy_version ?? current?.version)],
        ["Lifecycle", chip(current?.lifecycle_status || current?.status || registryRow?.lifecycle_status, lifecycleTone(current?.lifecycle_status || current?.status))],
        ["Effective from", text(formatDate(current?.effective_from))],
        ["Effective to", text(formatDate(current?.effective_to))],
        ["Record ID", text(current?.policy_id ?? current?.envelope_id ?? current?.id)],
        ["Owner module", text(payload.owner_module || d.canonical_source_module)],
      ])}
    </section>`);

    const validationHtml = renderValidationSection(d.validation);
    if (validationHtml) {
      sections.push(`<section class="cp-detail-section">
        <h3 class="cp-section-title">Validation</h3>
        ${validationHtml}
      </section>`);
    }

    const driverLogicHtml = renderDriverLogicSection(d.formula_explanation);
    if (driverLogicHtml) {
      sections.push(driverLogicHtml);
    } else {
      const formulaHtml = renderFormulaSection(
        d.formula_display || current?.formula_type || current?.formula,
      );
      if (formulaHtml) {
        sections.push(`<section class="cp-detail-section">
          <h3 class="cp-section-title">Formula</h3>
          ${formulaHtml}
        </section>`);
      }
    }

    if (listHasItems(d.scope_factors)) {
      sections.push(`<section class="cp-detail-section">
        <h3 class="cp-section-title">Scope Factors</h3>
        ${factorsTable(d.scope_factors)}
      </section>`);
    }
    if (listHasItems(d.behaviour_factors)) {
      sections.push(`<section class="cp-detail-section">
        <h3 class="cp-section-title">Behaviour Factors</h3>
        ${factorsTable(d.behaviour_factors)}
      </section>`);
    }
    if (listHasItems(d.resource_factors)) {
      sections.push(`<section class="cp-detail-section">
        <h3 class="cp-section-title">Resource Factors</h3>
        ${factorsTable(d.resource_factors)}
      </section>`);
    }

    const history =
      listHasItems(d.policy_rows) ? d.policy_rows : d.envelope_history;
    if (listHasItems(history)) {
      sections.push(`<section class="cp-detail-section">
        <h3 class="cp-section-title">Version History</h3>
        ${historyTable(history)}
      </section>`);
    }

    sections.push(`<section class="cp-detail-section">
      <h3 class="cp-section-title">Governance Status</h3>
      ${kvRows([
        ["Maturity", chip(registryRow?.maturity_status || current?.maturity_status)],
        ["Client", chip(registryRow?.client_status || current?.client_status)],
        ["Data quality", chip(registryRow?.data_quality_status || current?.data_quality_status)],
        ["Cutover", chip(registryRow?.cutover_status || current?.cutover_status)],
        ["Cutover authorised", text(payload.cutover_authorised === true ? "Yes" : "No")],
      ])}
      ${auditBlock(current)}
    </section>`);

    sections.push(`<section class="cp-detail-section">
      <h3 class="cp-section-title">Available Actions</h3>
      ${renderActionsHtml()}
    </section>`);

    sections.push(`<section class="cp-detail-section">
      <h3 class="cp-section-title">Canonical Source Module</h3>
      <p>${text(d.canonical_source_module || payload.owner_module || "—")}</p>
      ${renderPrmLinks(code)}
    </section>`);

    return sections.join("");
  }

  function getDrawerConfig(row) {
    const code =
      normalizeDriverGovernanceCode(row?.cost_element_code) ||
      state.selectedCostElementCode;
    const label =
      row?.cost_element_label ||
      state.rows.find(
        (r) =>
          normalizeDriverGovernanceCode(r.cost_element_code) === code,
      )?.cost_element_label ||
      code ||
      "Driver Governance";
    return {
      title: label,
      subtitle: "Cost driver policy governance",
      tabs: [{ id: "overview", label: "Overview" }],
      activeTab: "overview",
    };
  }

  function renderDrawerTab() {
    return buildDetailHtml();
  }

  function wireDrawerActions(host) {
    const root = host || document.getElementById("drawerContent");
    if (!root) return;

    root.querySelectorAll("[data-dg-prm-link]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const lens = btn.getAttribute("data-dg-prm-link");
        if (!lens || typeof navigateToCostingRoute !== "function") return;
        navigateToCostingRoute(
          "production-route-manager",
          { lens },
          { newTab: true },
        );
      });
    });

    root.querySelectorAll("[data-dg-action-code]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const actionCode = btn.getAttribute("data-dg-action-code");
        const rpc = btn.getAttribute("data-dg-action-rpc");
        const recordId = Number(btn.getAttribute("data-dg-record-id"));
        const source = (state.detail?.actions || []).find(
          (a) =>
            String(a.action_code).toUpperCase() ===
              String(actionCode).toUpperCase() &&
            String(a.rpc) === String(rpc) &&
            Number(a.record_id) === recordId,
        );
        if (!source) {
          showToast?.("Action is stale. Reload detail and try again.", "warning");
          return;
        }
        await beginAction(source);
      });
    });
  }

  function ensureSubmitModal() {
    if (submitModalEl) return submitModalEl;
    submitModalEl = document.getElementById("driverGovernanceSubmitModal");
    return submitModalEl;
  }

  function ensureApproveModal() {
    if (approveModalEl) return approveModalEl;
    approveModalEl = document.getElementById("driverGovernanceApproveModal");
    return approveModalEl;
  }

  function fillSummaryFields(prefix, record, elementLabel) {
    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value == null || value === "" ? "—" : String(value);
    };
    set(`${prefix}CostElement`, elementLabel);
    set(`${prefix}PolicyCode`, record?.policy_code || record?.code || record?.envelope_code);
    set(`${prefix}Version`, record?.policy_version ?? record?.version);
    set(`${prefix}Formula`, record?.formula_type || record?.formula);
    set(`${prefix}EffectiveFrom`, formatDate(record?.effective_from));
    set(`${prefix}EffectiveTo`, formatDate(record?.effective_to));
    set(`${prefix}Lifecycle`, record?.lifecycle_status || record?.status);
    set(
      `${prefix}Validation`,
      typeof state.detail?.detail?.validation === "object"
        ? state.detail.detail.validation.status ||
            state.detail.detail.validation.result ||
            "—"
        : state.detail?.detail?.validation || "—",
    );
    set(`${prefix}Owner`, state.detail?.owner_module);
    set(`${prefix}RecordId`, record?.policy_id ?? record?.envelope_id ?? record?.id);
  }

  async function beginAction(action) {
    const evalResult = evaluateDriverGovernanceActionDispatch(action, {
      canEditCbm: canEditCbm() === true,
      canEditPrm: canEditPrm() === true,
      selectedCostElementCode: state.selectedCostElementCode,
      actionCostElementCode: state.selectedCostElementCode,
      actionToken: state.detailActionToken,
      detailActionToken: state.detailActionToken,
      detailLoading: state.detailLoading,
      detailFailed: !!state.detailError,
    });
    if (!evalResult.ok) {
      showToast?.(evalResult.errors.join("; "), "warning");
      return;
    }

    state.pendingAction = {
      ...action,
      cost_element_code: state.selectedCostElementCode,
      actionToken: state.detailActionToken,
    };

    const current = pickDriverGovernanceCurrentRecord(state.detail);
    const elementLabel =
      state.rows.find(
        (r) =>
          normalizeDriverGovernanceCode(r.cost_element_code) ===
          normalizeDriverGovernanceCode(state.selectedCostElementCode),
      )?.cost_element_label || state.selectedCostElementCode;

    if (action.action_code === DRIVER_GOVERNANCE_ACTION_CODES.SUBMIT_FOR_REVIEW) {
      const modal = ensureSubmitModal();
      if (!modal) {
        showToast?.("Submit confirmation modal is missing.", "error");
        return;
      }
      fillSummaryFields("dgSubmit", current, elementLabel);
      const warn = document.getElementById("dgSubmitWarning");
      if (warn) warn.textContent = DRIVER_GOVERNANCE_SUBMIT_WARNING;
      const err = document.getElementById("dgSubmitError");
      if (err) {
        err.hidden = true;
        err.textContent = "";
      }
      modal.classList.remove("hidden");
      modal.setAttribute("aria-hidden", "false");
      return;
    }

    if (action.action_code === DRIVER_GOVERNANCE_ACTION_CODES.APPROVE) {
      const modal = ensureApproveModal();
      if (!modal) {
        showToast?.("Approve confirmation modal is missing.", "error");
        return;
      }
      fillSummaryFields("dgApprove", current, elementLabel);
      const disclaimer = document.getElementById("dgApproveDisclaimer");
      if (disclaimer) disclaimer.textContent = DRIVER_GOVERNANCE_APPROVE_DISCLAIMER;
      const ackLabel = document.getElementById("dgApproveAckLabel");
      if (ackLabel) ackLabel.textContent = DRIVER_GOVERNANCE_APPROVE_ACK_TEXT;
      const ref = document.getElementById("dgApproveReference");
      if (ref) ref.value = ref.value || "";
      const ack = document.getElementById("dgApproveAck");
      if (ack) ack.checked = false;
      const err = document.getElementById("dgApproveError");
      if (err) {
        err.hidden = true;
        err.textContent = "";
      }
      modal.classList.remove("hidden");
      modal.setAttribute("aria-hidden", "false");
      ref?.focus();
    }
  }

  function hideSubmitModal() {
    const modal = ensureSubmitModal();
    if (modal) {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
    }
  }

  function hideApproveModal() {
    const modal = ensureApproveModal();
    if (modal) {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
    }
  }

  function isGovernanceLifecycleModalOpen(modal) {
    if (!modal) return false;
    if (modal.classList.contains("hidden")) return false;
    if (modal.getAttribute("aria-hidden") === "true") return false;
    return true;
  }

  function handleEscapeKey() {
    const approve = ensureApproveModal();
    if (isGovernanceLifecycleModalOpen(approve)) {
      clearPendingAction();
      hideApproveModal();
      return true;
    }
    const submit = ensureSubmitModal();
    if (isGovernanceLifecycleModalOpen(submit)) {
      clearPendingAction();
      hideSubmitModal();
      return true;
    }
    return false;
  }

  function showModalError(id, message) {
    const err = document.getElementById(id);
    if (!err) {
      showToast?.(message, "error");
      return;
    }
    err.hidden = false;
    err.textContent = message;
  }

  async function executePendingAction({ approval_reference } = {}) {
    const action = state.pendingAction;
    if (!action) {
      showToast?.("No pending governance action.", "warning");
      return { ok: false };
    }

    const evalResult = evaluateDriverGovernanceActionDispatch(action, {
      canEditCbm: canEditCbm() === true,
      canEditPrm: canEditPrm() === true,
      selectedCostElementCode: state.selectedCostElementCode,
      actionCostElementCode: action.cost_element_code,
      actionToken: action.actionToken,
      detailActionToken: state.detailActionToken,
      detailLoading: state.detailLoading,
      detailFailed: !!state.detailError,
    });
    if (!evalResult.ok) {
      showModalError(
        action.action_code === DRIVER_GOVERNANCE_ACTION_CODES.APPROVE
          ? "dgApproveError"
          : "dgSubmitError",
        evalResult.errors.join("; "),
      );
      return { ok: false };
    }

    const built = buildDriverGovernanceActionArgs(action, {
      approval_reference,
    });
    if (!built.ok) {
      showModalError(
        action.action_code === DRIVER_GOVERNANCE_ACTION_CODES.APPROVE
          ? "dgApproveError"
          : "dgSubmitError",
        built.errors.join("; "),
      );
      return { ok: false };
    }

    state.lifecycleBusy = true;
    try {
      const { data, error } = await costingRpc(action.rpc, built.params);
      if (error) throw error;
      const selected = normalizeDriverGovernanceCode(
        state.selectedCostElementCode,
      );

      // Discard stale detail/actions before dual reload.
      clearPendingAction();
      state.detail = null;
      state.detailError = null;
      state.detailActionToken += 1;
      disableLifecycleControls();
      hideSubmitModal();
      hideApproveModal();
      showToast?.("Governance action completed successfully.", "success");

      await loadRegistry({ preserveSelection: true });
      if (selected) {
        state.selectedCostElementCode = selected;
      }

      const stillPresent =
        selected &&
        state.rows.some(
          (r) =>
            normalizeDriverGovernanceCode(r.cost_element_code) === selected,
        );

      if (stillPresent) {
        const detailResult = await loadDetail(selected);
        if (
          detailResult?.ok &&
          detailResult.requestId === state.detailRequestId &&
          normalizeDriverGovernanceCode(state.selectedCostElementCode) ===
            selected
        ) {
          if (typeof openDetails === "function") {
            const row = state.rows.find(
              (r) =>
                normalizeDriverGovernanceCode(r.cost_element_code) === selected,
            );
            if (row) openDetails(row, "overview");
          }
        }
      } else {
        state.selectedCostElementCode = null;
        state.detail = null;
      }

      if (typeof renderTable === "function") renderTable();
      if (typeof onAfterMutation === "function") await onAfterMutation();
      return { ok: true, data };
    } catch (err) {
      console.error("[driver-governance] action failed", err);
      const message =
        err?.message ||
        err?.error_description ||
        "Governance action failed.";
      showModalError(
        action.action_code === DRIVER_GOVERNANCE_ACTION_CODES.APPROVE
          ? "dgApproveError"
          : "dgSubmitError",
        message,
      );
      // Keep modal open; preserve reference.
      return { ok: false, error: message };
    } finally {
      state.lifecycleBusy = false;
    }
  }

  function bindModals() {
    document
      .getElementById("dgSubmitCancel")
      ?.addEventListener("click", () => {
        clearPendingAction();
        hideSubmitModal();
      });
    document
      .getElementById("dgSubmitClose")
      ?.addEventListener("click", () => {
        clearPendingAction();
        hideSubmitModal();
      });
    document
      .getElementById("dgSubmitConfirm")
      ?.addEventListener("click", async () => {
        await executePendingAction();
      });

    document
      .getElementById("dgApproveCancel")
      ?.addEventListener("click", () => {
        clearPendingAction();
        hideApproveModal();
      });
    document
      .getElementById("dgApproveClose")
      ?.addEventListener("click", () => {
        clearPendingAction();
        hideApproveModal();
      });
    document
      .getElementById("dgApproveConfirm")
      ?.addEventListener("click", async () => {
        const ref = document.getElementById("dgApproveReference")?.value;
        const ack = document.getElementById("dgApproveAck")?.checked === true;
        if (!isMeaningfulDriverGovernanceApprovalReference(ref)) {
          showModalError(
            "dgApproveError",
            "Approval reference is required (minimum 5 meaningful characters).",
          );
          return;
        }
        if (!ack) {
          showModalError(
            "dgApproveError",
            "Acknowledgement is required before approval.",
          );
          return;
        }
        await executePendingAction({ approval_reference: ref });
      });
  }

  async function handleRowClick(row) {
    const code = normalizeDriverGovernanceCode(row?.cost_element_code);
    if (!code) return;
    await loadDetail(code);
    if (typeof openDetails === "function") {
      openDetails(row, "overview");
    }
  }

  async function onLensLoad() {
    clearPendingAction();
    hideSubmitModal();
    hideApproveModal();
    const result = await loadRegistry({ preserveSelection: false });
    if (typeof renderTable === "function") renderTable();
    return result;
  }

  function onLensExit() {
    clearPendingAction();
    hideSubmitModal();
    hideApproveModal();
    state.selectedCostElementCode = null;
    state.detail = null;
    state.detailError = null;
    ++state.detailRequestId;
  }

  bindModals();

  return {
    isDriverGovernanceLens,
    getTableHeaders,
    getTableAlignments,
    renderTableRow,
    loadRegistry,
    loadDetail,
    onLensLoad,
    onLensExit,
    handleRowClick,
    getDrawerConfig,
    renderDrawerTab,
    wireDrawerActions,
    handleEscapeKey,
    getState: () => ({ ...state, rows: [...state.rows] }),
    getSelectedCode: () => state.selectedCostElementCode,
    getRows: () => state.rows,
  };
}
