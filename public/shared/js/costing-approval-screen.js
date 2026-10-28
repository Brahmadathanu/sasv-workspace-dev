// Costing Control Centre — Phase 1 approval / supersede / month-end finalise screen.
// Preview opens only on explicit button click. Never calls lock RPCs or the old approve routes.
// Production preview/approve/finalise must only be invoked from an authorized owner session.

import {
  ALREADY_DONE_RELOAD,
  REOPEN_PREVIEW,
  formatMappedErrorForDisplay,
  mapCostingApprovalError,
} from "./costing-approval-errors.js";
import {
  formatLatestDraftValuationDate,
  formatOfficialValuationDate,
  isDraftRunRow,
  pickPeriodDisplayLabel,
  pickPricingUseLabel,
  pickRunDisplayLabel,
  pickRunDisplayStatus,
} from "./costing-approval-labels.js";
import { formatIst } from "./costing-run-status-badge.js";

export const PERIOD_STATUS_VIEW = "v_costing_pricing_period_run_status";
export const RUN_DISPLAY_VIEW = "v_costing_pricing_run_display_status";

export const RPC = Object.freeze({
  preview: "rpc_costing_preview_approval_impact",
  approve: "rpc_costing_approve_run_with_preview",
  finalize: "rpc_costing_finalize_monthend_run_with_preview",
});

export const FORBIDDEN_RPCS = Object.freeze([
  "rpc_costing_approve_run",
  "rpc_costing_supersede_approved_run",
  "rpc_costing_finalize_monthend_run",
  "rpc_costing_authorise_supersession",
  "rpc_set_cost_period_valuation_date",
  "rpc_costing_lock_periods_for_close",
  "rpc_costing_lock_period",
  "rpc_costing_health_check",
]);

function $(id, doc = document) {
  return doc.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function unwrapRpcJson(value) {
  const row = Array.isArray(value) ? value[0] : value;
  if (row == null) return null;
  if (typeof row === "string") {
    try {
      return JSON.parse(row);
    } catch {
      return row;
    }
  }
  return row;
}

function formatInr(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function buildApprovePayload({
  refreshRunId,
  reason,
  approvalReference,
  previewAckId,
  acknowledgeStale,
}) {
  return {
    p_refresh_run_id: Number(refreshRunId),
    p_reason: String(reason || "").trim(),
    p_approval_reference: String(approvalReference || "").trim(),
    p_preview_ack_id: Number(previewAckId),
    p_acknowledge_stale: acknowledgeStale === true,
  };
}

export function isAlreadyApprovedFinalizeResult(payload) {
  const data = unwrapRpcJson(payload);
  if (!data || typeof data !== "object") return false;
  const approval = data.approval;
  return (
    approval === "already_approved" ||
    (approval && typeof approval === "object" && approval.already_approved != null) ||
    data.already_approved != null
  );
}

export function summarizeApprovalResult(payload, { monthEnd = false } = {}) {
  const data = unwrapRpcJson(payload) || {};
  if (monthEnd && isAlreadyApprovedFinalizeResult(data)) {
    return {
      title: "Run already approved.",
      detail: String(data.lock_note || "").trim(),
      alreadyApproved: true,
    };
  }
  const approval = monthEnd ? data.approval || data : data;
  const newRun = approval?.new_run ?? approval?.refresh_run_id ?? data.refresh_run_id;
  const oldRun = approval?.old_run;
  const superseded = approval?.superseded === true || Boolean(oldRun);
  const parts = [];
  if (newRun != null) parts.push(`Run ${newRun} approved`);
  else parts.push("Run approved");
  if (superseded && oldRun != null) parts.push(`run ${oldRun} superseded`);
  const auditId = approval?.audit_id ?? data.audit_id;
  const detailParts = [];
  if (auditId != null) detailParts.push(`Audit ${auditId}`);
  if (monthEnd && data.lock_note) detailParts.push(String(data.lock_note));
  return {
    title: parts.join("; ") + ".",
    detail: detailParts.join(" · "),
    alreadyApproved: false,
  };
}

export function createCostingApprovalScreenController(deps) {
  const {
    supabase,
    costingRpc,
    showToast,
    getActivePeriodStart,
    isControlCenterRoute,
    formatMoney = formatInr,
    doc = globalThis.document,
  } = deps;

  const state = {
    mounted: false,
    periodRows: [],
    runRows: [],
    selectedRunId: null,
    preview: null,
    previewAckId: null,
    inFlight: false,
    loadGeneration: 0,
  };

  function panel() {
    return $("costingApprovalPanel", doc);
  }
  function modal() {
    return $("costingApprovalModal", doc);
  }

  function setVisible(el, visible) {
    if (!el) return;
    el.hidden = !visible;
    el.setAttribute("aria-hidden", visible ? "false" : "true");
    el.classList.toggle("hidden", !visible);
  }

  function setInFlight(next) {
    state.inFlight = next === true;
    const approveBtn = $("casApproveBtn", doc);
    const finalizeBtn = $("casFinalizeBtn", doc);
    if (approveBtn) approveBtn.disabled = state.inFlight || !canSubmitApprove();
    if (finalizeBtn) finalizeBtn.disabled = state.inFlight || !canSubmitApprove();
  }

  function canSubmitApprove() {
    const preview = state.preview;
    if (!preview || !state.previewAckId) return false;
    if (preview.can_approve === false) return false;
    const reason = String($("casReason", doc)?.value || "").trim();
    const reference = String($("casApprovalReference", doc)?.value || "").trim();
    if (reason.length < 10 || !reference) return false;
    if (preview?.staleness?.acknowledgement_required) {
      if (!$("casStaleAck", doc)?.checked) return false;
    }
    return true;
  }

  function syncSubmitButtons() {
    if (state.inFlight) {
      setInFlight(true);
      return;
    }
    const ok = canSubmitApprove();
    const approveBtn = $("casApproveBtn", doc);
    const finalizeBtn = $("casFinalizeBtn", doc);
    if (approveBtn) approveBtn.disabled = !ok;
    if (finalizeBtn) finalizeBtn.disabled = !ok;
  }

  function showMappedError(err) {
    const mapped = mapCostingApprovalError(err);
    const host = $("casFormError", doc);
    if (host) {
      host.textContent = formatMappedErrorForDisplay(mapped);
      host.hidden = false;
    }
    showToast?.(mapped.title, "error", 5200);
    return mapped;
  }

  async function reloadLists() {
    const periodStart = getActivePeriodStart?.();
    if (!periodStart || !isControlCenterRoute?.()) {
      setVisible(panel(), false);
      return;
    }
    const generation = ++state.loadGeneration;
    setVisible(panel(), true);
    const periodHost = $("casPeriodSummary", doc);
    const runsHost = $("casRunList", doc);
    if (periodHost) periodHost.textContent = "Loading period status…";
    if (runsHost) runsHost.innerHTML = `<div class="cas-muted">Loading runs…</div>`;

    try {
      const [periodRes, runsRes] = await Promise.all([
        supabase
          .from(PERIOD_STATUS_VIEW)
          .select(
            "period_start,period_status,valuation_date,display_state,display_label,display_label_v2,pricing_use_label,official_valuation_date,latest_draft_valuation_date,latest_draft_run_id,approved_run_id,newer_draft_count,superseded_run_count,active_run_id,active_run_status",
          )
          .eq("period_start", periodStart)
          .maybeSingle(),
        supabase
          .from(RUN_DISPLAY_VIEW)
          .select(
            "refresh_run_id,period_start,valuation_date,overall_status,source_trigger,requested_at,finished_at,stored_designation,display_status,in_use_for_pricing,pricing_use_label,superseded_by_run_id,designated_at,designated_by,designation_reason,display_label",
          )
          .eq("period_start", periodStart)
          .order("refresh_run_id", { ascending: false }),
      ]);
      if (generation !== state.loadGeneration) return;
      if (periodRes.error) throw periodRes.error;
      if (runsRes.error) throw runsRes.error;
      state.periodRows = periodRes.data ? [periodRes.data] : [];
      state.runRows = Array.isArray(runsRes.data) ? runsRes.data : [];
      renderPeriodSummary(state.periodRows[0] || null);
      renderRunList(state.runRows);
    } catch (err) {
      if (generation !== state.loadGeneration) return;
      console.warn("[costing-approval] load failed", err);
      if (periodHost) periodHost.textContent = "Could not load period status.";
      if (runsHost) {
        runsHost.innerHTML = `<div class="cas-danger">${escapeHtml(err?.message || "Load failed")}</div>`;
      }
      showToast?.("Could not load approval status.", "error");
    }
  }

  function renderPeriodSummary(row) {
    const host = $("casPeriodSummary", doc);
    if (!host) return;
    if (!row) {
      host.innerHTML = `<div class="cas-muted">No period status for this month.</div>`;
      return;
    }
    const label = pickPeriodDisplayLabel(row) || "—";
    const pricing = pickPricingUseLabel(row) || "—";
    host.innerHTML = `
      <div class="cas-kv"><span>Status</span><strong>${escapeHtml(label)}</strong></div>
      <div class="cas-kv"><span>Pricing use</span><strong>${escapeHtml(pricing)}</strong></div>
      <div class="cas-kv"><span>Official (approved) date</span><strong>${escapeHtml(formatOfficialValuationDate(row))}</strong></div>
      <div class="cas-kv"><span>Latest draft date</span><strong>${escapeHtml(formatLatestDraftValuationDate(row))}</strong></div>
      <div class="cas-kv"><span>Stored month date (legacy)</span><strong>${escapeHtml(row.valuation_date || "—")}</strong></div>
    `;
  }

  function renderRunList(rows) {
    const host = $("casRunList", doc);
    if (!host) return;
    if (!rows.length) {
      host.innerHTML = `<div class="cas-muted">No runs for this month.</div>`;
      return;
    }
    host.innerHTML = rows
      .map((row) => {
        const id = row.refresh_run_id;
        const status = pickRunDisplayStatus(row) || "—";
        const label = pickRunDisplayLabel(row) || status;
        const pricing = pickPricingUseLabel(row);
        const draft = isDraftRunRow(row);
        const reviewBtn = draft
          ? `<button type="button" class="cas-action" data-cas-review="${escapeHtml(String(id))}">Review for approval</button>`
          : "";
        const superseded =
          row.superseded_by_run_id != null
            ? `<span class="cas-chip">by run ${escapeHtml(String(row.superseded_by_run_id))}</span>`
            : "";
        return `<article class="cas-run-card" data-run-id="${escapeHtml(String(id))}">
          <div class="cas-run-head">
            <strong>Run ${escapeHtml(String(id))}</strong>
            <span class="cas-chip">${escapeHtml(status)}</span>
            ${superseded}
          </div>
          <div class="cas-run-label">${escapeHtml(label)}</div>
          ${pricing ? `<div class="cas-muted">${escapeHtml(pricing)}</div>` : ""}
          <div class="cas-muted">Valuation ${escapeHtml(row.valuation_date || "—")}</div>
          <div class="cas-run-actions">${reviewBtn}</div>
        </article>`;
      })
      .join("");
  }

  function closeModal() {
    setVisible(modal(), false);
    state.preview = null;
    state.previewAckId = null;
    state.selectedRunId = null;
    state.inFlight = false;
    const err = $("casFormError", doc);
    if (err) {
      err.textContent = "";
      err.hidden = true;
    }
  }

  async function openPreviewForRun(runId) {
    // Preview is intentionally only reachable from the Review button click path.
    const numericId = Number(runId);
    if (!Number.isFinite(numericId)) return;
    state.selectedRunId = numericId;
    state.preview = null;
    state.previewAckId = null;
    setVisible(modal(), true);
    const body = $("casPreviewBody", doc);
    const formWrap = $("casApproveForm", doc);
    if (body) body.innerHTML = `<div class="cas-muted">Loading impact preview…</div>`;
    if (formWrap) formWrap.hidden = true;
    const err = $("casFormError", doc);
    if (err) {
      err.textContent = "";
      err.hidden = true;
    }

    try {
      const { data, error } = await costingRpc(RPC.preview, {
        p_refresh_run_id: numericId,
      });
      if (error) throw error;
      const preview = unwrapRpcJson(data);
      if (!preview || preview.preview_ack_id == null) {
        throw new Error("Preview did not return an acknowledgement.");
      }
      state.preview = preview;
      state.previewAckId = preview.preview_ack_id;
      renderPreview(preview);
      if (formWrap) formWrap.hidden = false;
      syncSubmitButtons();
    } catch (err) {
      console.warn("[costing-approval] preview failed", err);
      const mapped = showMappedError(err);
      if (body) {
        body.innerHTML = `<div class="cas-danger">${escapeHtml(formatMappedErrorForDisplay(mapped))}</div>`;
      }
    }
  }

  function renderPreview(preview) {
    const body = $("casPreviewBody", doc);
    const title = $("casModalTitle", doc);
    const subtitle = $("casModalSubtitle", doc);
    if (title) {
      title.textContent = `Approve run ${preview.run ?? state.selectedRunId} (dated ${preview.run_valuation_date || "—"})`;
    }
    if (subtitle) {
      subtitle.textContent =
        preview.action === "APPROVE_AND_SUPERSEDE"
          ? `This replaces approved run ${preview.current_approved_run} (dated ${preview.current_approved_valuation_date || "—"}). That run will be shown as Superseded and kept unchanged.`
          : "Ordinary approval for this draft run.";
    }

    const checks = Array.isArray(preview.checks) ? preview.checks : [];
    const counts = preview.counts || {};
    const cutoff = preview.cutoff || {};
    const staleness = preview.staleness || {};
    const skuChanges = Array.isArray(preview.sku_changes) ? preview.sku_changes : [];
    const approveBtn = $("casApproveBtn", doc);
    if (approveBtn) {
      approveBtn.textContent =
        preview.action === "APPROVE_AND_SUPERSEDE"
          ? `Approve and supersede run ${preview.current_approved_run}`
          : "Approve";
    }

    const staleWrap = $("casStaleAckWrap", doc);
    if (staleWrap) staleWrap.hidden = !staleness.acknowledgement_required;
    const staleAck = $("casStaleAck", doc);
    if (staleAck) staleAck.checked = false;

    const checkHtml = checks.length
      ? `<ul class="cas-check-list">${checks
          .map(
            (c) =>
              `<li class="${c.pass ? "cas-pass" : "cas-fail"}"><strong>${escapeHtml(c.code || "")}</strong> — ${escapeHtml(c.detail || (c.pass ? "Pass" : "Fail"))}</li>`,
          )
          .join("")}</ul>`
      : `<div class="cas-muted">No checks returned.</div>`;

    const skuHtml = skuChanges.length
      ? `<div class="cas-sku-tools"><input type="search" id="casSkuFilter" class="form-control" placeholder="Search SKU changes" aria-label="Search SKU changes" /></div>
         <div class="cas-table-wrap"><table class="cas-table" id="casSkuTable"><thead><tr><th>SKU</th><th>Change</th><th class="c-right">Amount</th></tr></thead><tbody>
         ${skuChanges
           .slice(0, 200)
           .map((row) => {
             const sku = row.sku_label || row.sku_id || row.product_name || "—";
             const change = row.change_summary || row.field || row.change || "—";
             const amount =
               row.delta != null
                 ? formatMoney(row.delta)
                 : row.amount != null
                   ? formatMoney(row.amount)
                   : "—";
             const hay = `${sku} ${change}`.toLowerCase();
             return `<tr data-cas-sku="${escapeHtml(hay)}"><td>${escapeHtml(String(sku))}</td><td>${escapeHtml(String(change))}</td><td class="c-right">${escapeHtml(String(amount))}</td></tr>`;
           })
           .join("")}
         </tbody></table></div>`
      : `<div class="cas-muted">No SKU-level changes listed.</div>`;

    if (!body) return;
    body.innerHTML = `
      <div class="cas-block ${cutoff.moves ? "cas-warn" : ""}">
        <div class="cas-block-title">Cut-off</div>
        <div>${escapeHtml(cutoff.message || "—")}</div>
      </div>
      <div class="cas-block">
        <div class="cas-block-title">Checks</div>
        ${preview.can_approve === false ? `<div class="cas-danger">Approval is blocked until the failing checks are resolved.</div>` : ""}
        ${checkHtml}
      </div>
      <div class="cas-counts">
        <span>READY ${escapeHtml(String(counts.ready ?? "—"))}</span>
        <span>REVIEW ${escapeHtml(String(counts.review_required ?? "—"))}</span>
        <span>BLOCKED ${escapeHtml(String(counts.blocked ?? "—"))}</span>
        <span>TOTAL ${escapeHtml(String(counts.total ?? "—"))}</span>
      </div>
      <div class="cas-block">
        <div class="cas-block-title">Impact</div>
        <div>${escapeHtml(preview.impact?.message || preview.impact?.summary || "See SKU changes below.")}</div>
      </div>
      ${
        staleness.is_stale
          ? `<div class="cas-block cas-warn">
              <div class="cas-block-title">Later entries</div>
              <div>${escapeHtml(staleness.message || "Later entries exist after this draft.")}</div>
              ${
                Array.isArray(staleness.items) && staleness.items.length
                  ? `<ul>${staleness.items
                      .slice(0, 20)
                      .map((item) => `<li>${escapeHtml(item.detail || item.table || JSON.stringify(item))}</li>`)
                      .join("")}</ul>`
                  : ""
              }
              ${
                Array.isArray(staleness.not_scannable_tables) &&
                staleness.not_scannable_tables.length
                  ? `<div class="cas-muted">Not scannable: ${escapeHtml(staleness.not_scannable_tables.join(", "))}</div>`
                  : ""
              }
            </div>`
          : ""
      }
      <div class="cas-block">
        <div class="cas-block-title">SKU changes</div>
        ${skuHtml}
      </div>
      <div class="cas-muted">Preview valid until ${escapeHtml(
        preview.ack_expires_at ? formatIst(preview.ack_expires_at) : "—",
      )}</div>
    `;

    const filter = $("casSkuFilter", doc);
    filter?.addEventListener("input", () => {
      const q = String(filter.value || "")
        .trim()
        .toLowerCase();
      doc.querySelectorAll("#casSkuTable tbody tr").forEach((tr) => {
        const hay = tr.getAttribute("data-cas-sku") || "";
        tr.hidden = Boolean(q) && !hay.includes(q);
      });
    });
  }

  async function submitDecision(kind) {
    if (state.inFlight) return;
    const preview = state.preview;
    if (!preview || state.previewAckId == null || state.selectedRunId == null) {
      showToast?.("Open the impact preview first.", "warn");
      return;
    }
    if (!canSubmitApprove()) {
      showToast?.("Enter reason, approval reference, and any required acknowledgement.", "warn");
      syncSubmitButtons();
      return;
    }

    const reason = String($("casReason", doc)?.value || "").trim();
    const reference = String($("casApprovalReference", doc)?.value || "").trim();
    const acknowledgeStale = $("casStaleAck", doc)?.checked === true;
    const payload = buildApprovePayload({
      refreshRunId: state.selectedRunId,
      reason,
      approvalReference: reference,
      previewAckId: state.previewAckId,
      acknowledgeStale,
    });

    const confirmText =
      kind === "finalize"
        ? `Finalise month-end for run ${state.selectedRunId} with this preview acknowledgement?`
        : preview.action === "APPROVE_AND_SUPERSEDE"
          ? `Approve run ${state.selectedRunId} and supersede run ${preview.current_approved_run}?`
          : `Approve run ${state.selectedRunId}?`;
    if (!globalThis.confirm?.(confirmText)) return;

    setInFlight(true);
    const errHost = $("casFormError", doc);
    if (errHost) {
      errHost.textContent = "";
      errHost.hidden = true;
    }

    try {
      const rpcName = kind === "finalize" ? RPC.finalize : RPC.approve;
      const { data, error } = await costingRpc(rpcName, payload);
      if (error) throw error;

      if (kind === "finalize" && isAlreadyApprovedFinalizeResult(data)) {
        const summary = summarizeApprovalResult(data, { monthEnd: true });
        showToast?.(summary.title, "success", 5200);
        closeModal();
        await reloadLists();
        return;
      }

      const summary = summarizeApprovalResult(data, { monthEnd: kind === "finalize" });
      showToast?.(
        summary.detail ? `${summary.title} ${summary.detail}` : summary.title,
        "success",
        6200,
      );
      closeModal();
      await reloadLists();
    } catch (err) {
      const mapped = showMappedError(err);
      if (mapped.action === ALREADY_DONE_RELOAD) {
        closeModal();
        await reloadLists();
        return;
      }
      if (mapped.action === REOPEN_PREVIEW) {
        // User must click Review again; do not auto-call preview.
        state.preview = null;
        state.previewAckId = null;
      }
    } finally {
      setInFlight(false);
      syncSubmitButtons();
    }
  }

  function onPanelClick(event) {
    const btn = event.target.closest?.("[data-cas-review]");
    if (!btn) return;
    event.preventDefault();
    void openPreviewForRun(btn.getAttribute("data-cas-review"));
  }

  function bind() {
    if (state.mounted) return;
    state.mounted = true;
    panel()?.addEventListener("click", onPanelClick);
    $("casModalClose", doc)?.addEventListener("click", () => closeModal());
    $("casCancelBtn", doc)?.addEventListener("click", () => closeModal());
    $("casApproveBtn", doc)?.addEventListener("click", () => void submitDecision("approve"));
    $("casFinalizeBtn", doc)?.addEventListener("click", () => void submitDecision("finalize"));
    $("casReason", doc)?.addEventListener("input", syncSubmitButtons);
    $("casApprovalReference", doc)?.addEventListener("input", syncSubmitButtons);
    $("casStaleAck", doc)?.addEventListener("change", syncSubmitButtons);
    $("casCopyErrorBtn", doc)?.addEventListener("click", async () => {
      const text = $("casFormError", doc)?.textContent || "";
      try {
        await navigator.clipboard.writeText(text);
        showToast?.("Details copied.", "info");
      } catch {
        showToast?.("Could not copy details.", "warn");
      }
    });
  }

  function mount() {
    if (!isControlCenterRoute?.()) {
      setVisible(panel(), false);
      closeModal();
      return;
    }
    bind();
    setVisible(panel(), true);
    void reloadLists();
  }

  function onRouteExit() {
    setVisible(panel(), false);
    closeModal();
  }

  return {
    mount,
    reload: reloadLists,
    onRouteExit,
    // Test seams (no production side effects)
    _openPreviewForRun: openPreviewForRun,
    _state: state,
  };
}
