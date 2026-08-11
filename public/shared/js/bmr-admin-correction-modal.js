/**
 * Shared Administrative Correction modal controller.
 * Used by Manage BMR and Supply Batch Plan — one workflow, two entry points.
 *
 * ERP layout: compact identity strip + tabs (Correct / Details / History).
 */
import {
  CLIENT_SUPPORTED_OPERATIONS,
  COPY,
  OPERATION_LABELS,
  OPERATION_TYPES,
  createCorrectionSession,
  describeOperationResult,
  executeAdminCorrection,
  formatHistoryOldNew,
  getAdminCorrectionHistory,
  labelForOperationType,
  loadRemapCandidates,
  mapAdminCorrectionError,
  previewAdminCorrection,
  previewSizeOutcome,
  validateCorrectionForm,
} from "./bmr-admin-correction.js";

const STYLE_ID = "bac-admin-correction-styles";
const ROOT_ID = "bacAdminCorrectionRoot";
const UI_VERSION = "5";

let _session = null;
let _options = null;
let _preview = null;
let _candidates = [];
let _submitting = false;
let _wired = false;
let _activeTab = "correct";

function esc(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dash(v) {
  return v == null || v === "" ? "—" : String(v);
}

function ensureStyles() {
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = `
    #${ROOT_ID}.bac-overlay {
      position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45);
      display: flex; align-items: center; justify-content: center;
      z-index: 2400; padding: 12px;
      font-size: 12.5px; line-height: 1.35; color: #0f172a;
    }
    #${ROOT_ID}.bac-overlay.hidden { display: none; }
    #${ROOT_ID} .bac-window {
      background: #fff; border-radius: 10px;
      box-shadow: 0 18px 48px rgba(0,0,0,.28);
      width: min(860px, 96vw); max-height: min(92vh, 880px);
      display: flex; flex-direction: column; overflow: hidden;
    }
    @media (max-width: 520px) {
      #${ROOT_ID}.bac-overlay {
        padding: 0; align-items: stretch; justify-content: stretch;
      }
      #${ROOT_ID} .bac-window {
        width: 100%;
        max-width: 100%;
        height: 100%;
        max-height: 100%;
        border-radius: 0;
        box-shadow: none;
      }
      #${ROOT_ID} .bac-identity {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      #${ROOT_ID} .bac-form-grid {
        grid-template-columns: 1fr;
      }
      #${ROOT_ID} .bac-op {
        min-width: 50%;
        flex: 1 1 45%;
      }
      #${ROOT_ID} .bac-footer {
        padding-bottom: calc(9px + env(safe-area-inset-bottom, 0px));
      }
      #${ROOT_ID} .bac-header {
        padding-top: calc(10px + env(safe-area-inset-top, 0px));
      }
    }

    /* Title bar */
    #${ROOT_ID} .bac-header {
      display: flex; justify-content: space-between; align-items: center;
      gap: 10px; padding: 10px 14px; border-bottom: 1px solid #e2e8f0;
      background: #f8fafc;
    }
    #${ROOT_ID} .bac-header-left {
      display: flex; align-items: center; gap: 8px; min-width: 0; flex-wrap: wrap;
    }
    #${ROOT_ID} .bac-title { margin: 0; font-size: 14px; font-weight: 600; }
    #${ROOT_ID} .bac-badge {
      display: inline-flex; align-items: center;
      padding: 2px 7px; border-radius: 999px; font-size: 10px; font-weight: 500;
      background: #fffbeb; color: #92400e; border: 1px solid #fde68a;
      white-space: nowrap;
    }
    #${ROOT_ID} .bac-badge.danger {
      background: #fef2f2; color: #991b1b; border-color: #fecaca;
    }
    #${ROOT_ID} .bac-badge.ok {
      background: #f0fdf4; color: #166534; border-color: #86efac;
    }
    #${ROOT_ID} .bac-close {
      width: 28px; height: 28px; border: 1px solid #e2e8f0; border-radius: 6px;
      background: #fff; cursor: pointer; color: #64748b; font-size: 12px; flex-shrink: 0;
    }

    /* Identity strip — dense ERP meta */
    #${ROOT_ID} .bac-identity {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0;
      border-bottom: 1px solid #e2e8f0;
      background: #fff;
    }
    @media (max-width: 720px) {
      #${ROOT_ID} .bac-identity { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    #${ROOT_ID} .bac-id-cell {
      padding: 7px 12px; border-right: 1px solid #eef2f7; min-width: 0;
    }
    #${ROOT_ID} .bac-id-cell:last-child { border-right: none; }
    #${ROOT_ID} .bac-id-k {
      display: block; font-size: 9.5px; font-weight: 500; letter-spacing: .04em;
      text-transform: uppercase; color: #94a3b8; margin-bottom: 1px;
    }
    #${ROOT_ID} .bac-id-v {
      display: block; font-size: 12.5px; font-weight: 400; color: #0f172a;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    #${ROOT_ID} .bac-id-v.muted { font-weight: 400; color: #475569; font-size: 12px; }

    /* Status chips under identity */
    #${ROOT_ID} .bac-status-row {
      display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
      padding: 7px 14px; border-bottom: 1px solid #e2e8f0; background: #fafbfc;
    }

    /* Tabs */
    #${ROOT_ID} .bac-tabs {
      display: flex; gap: 0; border-bottom: 1px solid #e2e8f0;
      padding: 0 10px; background: #fff; flex-shrink: 0;
    }
    #${ROOT_ID} .bac-tab {
      border: none; background: transparent; cursor: pointer;
      padding: 8px 12px; font-size: 12px; font-weight: 500; color: #64748b;
      border-bottom: 2px solid transparent; margin-bottom: -1px; font-family: inherit;
    }
    #${ROOT_ID} .bac-tab:hover { color: #0f172a; }
    #${ROOT_ID} .bac-tab.active {
      color: #005a8d; border-bottom-color: #005a8d; font-weight: 600;
    }

    #${ROOT_ID} .bac-body {
      padding: 12px 14px; overflow: auto; flex: 1; min-height: 0;
      display: flex; flex-direction: column; gap: 10px;
    }
    #${ROOT_ID} .bac-footer {
      padding: 9px 14px; border-top: 1px solid #e2e8f0;
      display: flex; justify-content: space-between; align-items: center;
      gap: 8px; flex-wrap: wrap; background: #f8fafc;
    }
    #${ROOT_ID} .bac-footer-actions {
      display: flex; gap: 8px; flex-wrap: wrap; margin-left: auto;
    }
    #${ROOT_ID} .bac-footer-hint {
      font-size: 11px; color: #64748b;
    }

    /* Dense definition list for Details tab */
    #${ROOT_ID} .bac-dl {
      width: 100%; border-collapse: collapse; font-size: 12px;
    }
    #${ROOT_ID} .bac-dl th, #${ROOT_ID} .bac-dl td {
      padding: 6px 8px; border-bottom: 1px solid #eef2f7; vertical-align: top;
      text-align: left;
    }
    #${ROOT_ID} .bac-dl th {
      width: 38%; color: #64748b; font-weight: 500; font-size: 11.5px;
      background: #f8fafc;
    }
    #${ROOT_ID} .bac-dl td { font-weight: 400; color: #0f172a; word-break: break-word; }
    #${ROOT_ID} .bac-dl-group {
      font-size: 10px; font-weight: 600; text-transform: uppercase;
      letter-spacing: .04em; color: #94a3b8; margin: 10px 0 4px;
    }
    #${ROOT_ID} .bac-dl-group:first-child { margin-top: 0; }

    #${ROOT_ID} .bac-banner {
      border-radius: 6px; padding: 7px 9px; font-size: 12px; white-space: pre-line;
      border: 1px solid #fde68a; background: #fffbeb; color: #92400e;
    }
    #${ROOT_ID} .bac-banner.danger {
      border-color: #fecaca; background: #fef2f2; color: #991b1b;
    }
    #${ROOT_ID} .bac-banner.ok {
      border-color: #bbf7d0; background: #f0fdf4; color: #166534;
    }
    #${ROOT_ID} .bac-banner.info {
      border-color: #bfdbfe; background: #eff6ff; color: #1e40af;
    }

    /* Segmented operation control */
    #${ROOT_ID} .bac-ops {
      display: flex; flex-wrap: wrap; gap: 0; border: 1px solid #cbd5e1;
      border-radius: 7px; overflow: hidden; background: #fff;
    }
    #${ROOT_ID} .bac-op {
      display: flex; gap: 5px; align-items: center;
      padding: 6px 10px; cursor: pointer; font-size: 11.5px; line-height: 1.25;
      font-weight: 400; color: #334155; border-right: 1px solid #e2e8f0;
      background: #fff; margin: 0; flex: 1 1 auto; min-width: 120px;
    }
    #${ROOT_ID} .bac-op:last-child { border-right: none; }
    #${ROOT_ID} .bac-op:hover { background: #f8fafc; }
    #${ROOT_ID} .bac-op.is-selected {
      background: #eff6ff; color: #0c4a6e; font-weight: 500;
    }
    #${ROOT_ID} .bac-op input[type="radio"] {
      margin: 0; width: 13px; height: 13px; accent-color: #005a8d; flex: 0 0 auto;
    }
    #${ROOT_ID} .bac-op.disabled { opacity: .5; cursor: not-allowed; }

    #${ROOT_ID} .bac-work {
      display: flex; flex-direction: column; gap: 10px;
    }
    #${ROOT_ID} .bac-card {
      border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px;
      background: #fff;
    }
    #${ROOT_ID} .bac-card-title {
      font-size: 10px; font-weight: 600; text-transform: uppercase;
      letter-spacing: .04em; color: #94a3b8; margin: 0 0 8px;
    }

    #${ROOT_ID} label.bac-form-label {
      display: block; font-size: 11px; font-weight: 500; margin-bottom: 3px; color: #475569;
    }
    #${ROOT_ID} .bac-input, #${ROOT_ID} .bac-select, #${ROOT_ID} .bac-textarea {
      width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1;
      border-radius: 6px; padding: 6px 8px; font-size: 12.5px; line-height: 1.35;
      background: #fff; font-family: inherit;
    }
    #${ROOT_ID} .bac-textarea { min-height: 58px; resize: vertical; }
    #${ROOT_ID} .bac-form-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
    }
    @media (max-width: 640px) {
      #${ROOT_ID} .bac-form-grid { grid-template-columns: 1fr; }
    }
    #${ROOT_ID} .bac-readonly {
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;
      padding: 6px 8px; font-size: 12.5px; font-weight: 400;
    }
    #${ROOT_ID} .bac-check {
      display: grid; grid-template-columns: 16px 1fr; column-gap: 8px;
      align-items: start; font-size: 11.5px; line-height: 1.4; color: #334155;
      cursor: pointer;
    }
    #${ROOT_ID} .bac-check input[type="checkbox"] {
      width: 14px; height: 14px; margin: 2px 0 0; padding: 0;
      accent-color: #005a8d; cursor: pointer;
    }
    #${ROOT_ID} .bac-check > span { min-width: 0; display: block; }

    #${ROOT_ID} .bac-error {
      border: 1px solid #fecaca; background: #fef2f2; color: #991b1b;
      border-radius: 6px; padding: 7px 9px; font-size: 12px;
    }
    #${ROOT_ID} .bac-success {
      border: 1px solid #bbf7d0; background: #f0fdf4; color: #166534;
      border-radius: 6px; padding: 8px 10px; font-size: 12px;
      display: flex; flex-direction: column; gap: 4px;
    }
    #${ROOT_ID} .bac-muted { color: #64748b; font-size: 11.5px; }
    #${ROOT_ID} .bac-history-table {
      width: 100%; border-collapse: collapse; font-size: 11.5px;
    }
    #${ROOT_ID} .bac-history-table th, #${ROOT_ID} .bac-history-table td {
      border-bottom: 1px solid #e2e8f0; padding: 6px 5px; text-align: left; vertical-align: top;
    }
    #${ROOT_ID} .bac-history-table th {
      font-size: 10.5px; text-transform: uppercase; letter-spacing: .03em;
      color: #64748b; background: #f8fafc; position: sticky; top: 0; font-weight: 500;
    }
    #${ROOT_ID} .bac-history-table td { font-weight: 400; }
    #${ROOT_ID} .bac-success-title { font-weight: 600; }
    #${ROOT_ID} .bac-success-key { font-weight: 600; }
    #${ROOT_ID} .bac-banner { font-weight: 400; }
    #${ROOT_ID} .bac-table-wrap { overflow: auto; max-height: 360px; border: 1px solid #e2e8f0; border-radius: 7px; }

    #${ROOT_ID} .bac-btn {
      border: 1px solid #d1d5db; border-radius: 6px; padding: 6px 11px;
      background: #fff; cursor: pointer;
      font-size: 12px; line-height: 1.3; font-weight: 500; font-family: inherit;
    }
    #${ROOT_ID} .bac-btn.warn {
      background: #fef3c7; border-color: #f59e0b; color: #92400e; font-weight: 600;
    }
    #${ROOT_ID} .bac-btn:disabled { opacity: .55; cursor: not-allowed; }
    #${ROOT_ID} .bac-panel.hidden, #${ROOT_ID} .bac-tabpanel.hidden,
    #${ROOT_ID} .hidden { display: none !important; }

    /* Nested confirm — always above the correction window */
    #${ROOT_ID} .bac-confirm-layer {
      position: absolute; inset: 0; z-index: 5;
      display: flex; align-items: center; justify-content: center;
      background: rgba(15, 23, 42, 0.45); padding: 16px;
    }
    #${ROOT_ID} .bac-confirm-layer.hidden { display: none !important; }
    #${ROOT_ID} .bac-confirm-card {
      background: #fff; border-radius: 10px; width: min(420px, 100%);
      box-shadow: 0 16px 40px rgba(0,0,0,.28); overflow: hidden;
    }
    #${ROOT_ID} .bac-confirm-head {
      padding: 10px 14px; border-bottom: 1px solid #e2e8f0; background: #f8fafc;
      font-size: 13px; font-weight: 600; color: #0f172a;
    }
    #${ROOT_ID} .bac-confirm-body {
      padding: 12px 14px; font-size: 12.5px; font-weight: 400;
      color: #334155; white-space: pre-line; line-height: 1.4;
    }
    #${ROOT_ID} .bac-confirm-actions {
      padding: 10px 14px; border-top: 1px solid #e2e8f0;
      display: flex; justify-content: flex-end; gap: 8px; background: #f8fafc;
    }
  `;
}

function destroyRootIfStale() {
  const existing = document.getElementById(ROOT_ID);
  if (existing && existing.dataset.uiVersion !== UI_VERSION) {
    existing.remove();
    _wired = false;
  }
}

function ensureRoot() {
  ensureStyles();
  destroyRootIfStale();
  let root = document.getElementById(ROOT_ID);
  if (root) return root;

  root = document.createElement("div");
  root.id = ROOT_ID;
  root.className = "bac-overlay hidden";
  root.dataset.uiVersion = UI_VERSION;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-labelledby", "bacTitle");
  root.innerHTML = `
    <div class="bac-window">
      <div class="bac-header">
        <div class="bac-header-left">
          <h2 id="bacTitle" class="bac-title">Administrative Correction</h2>
          <span class="bac-badge">Exceptional</span>
          <span id="bacHeaderStatusBadge" class="bac-badge hidden"></span>
        </div>
        <button type="button" class="bac-close" id="bacCloseBtn" aria-label="Close">✕</button>
      </div>

      <div id="bacIdentity" class="bac-identity hidden"></div>
      <div id="bacStatusRow" class="bac-status-row hidden"></div>

      <div id="bacTabs" class="bac-tabs hidden" role="tablist">
        <button type="button" class="bac-tab active" data-tab="correct" role="tab">Correct</button>
        <button type="button" class="bac-tab" data-tab="details" role="tab">Record details</button>
        <button type="button" class="bac-tab" data-tab="history" role="tab">History</button>
      </div>

      <div class="bac-body" id="bacBody">
        <div id="bacLoading" class="bac-muted">Loading correction preview…</div>
        <div id="bacError" class="bac-error hidden"></div>
        <div id="bacSuccess" class="bac-success hidden"></div>

        <div id="bacForm" class="hidden">
          <div id="bacBlockedBanner" class="bac-banner danger hidden"></div>

          <div id="bacTabCorrect" class="bac-tabpanel bac-work" data-panel="correct">
            <div class="bac-card">
              <p class="bac-card-title">Operation</p>
              <div class="bac-ops" id="bacOps"></div>
            </div>

            <div id="bacPanelRemap" class="bac-panel bac-card hidden">
              <p class="bac-card-title">Remap target</p>
              <div id="bacRemapBlockedNotice" class="bac-banner danger hidden"></div>
              <div id="bacRemapFields">
                <label class="bac-form-label" for="bacTargetBmr">Potentially eligible BMR</label>
                <select id="bacTargetBmr" class="bac-select"></select>
                <p class="bac-muted" style="margin:6px 0 0">Same product and exact planned size. Server validation is final.</p>
              </div>
            </div>
            <div id="bacPanelUnlink" class="bac-panel bac-card hidden">
              <p class="bac-card-title">Remove mapping</p>
              <div class="bac-banner" id="bacUnlinkNotice"></div>
            </div>
            <div id="bacPanelSize" class="bac-panel bac-card hidden">
              <p class="bac-card-title">Correct BMR size</p>
              <div class="bac-form-grid">
                <div>
                  <label class="bac-form-label">Current BMR size</label>
                  <div class="bac-readonly" id="bacOldSize">—</div>
                </div>
                <div>
                  <label class="bac-form-label">Planned batch size</label>
                  <div class="bac-readonly" id="bacPlannedSize">—</div>
                </div>
              </div>
              <div style="margin-top:8px">
                <label class="bac-form-label" for="bacNewSize">Proposed corrected BMR size</label>
                <input id="bacNewSize" class="bac-input" type="number" step="any" min="0" />
              </div>
              <div id="bacSizeOutcome" class="bac-banner" style="margin-top:8px"></div>
              <div class="bac-banner info" id="bacSizeSyncNotice" style="margin-top:8px"></div>
            </div>

            <div class="bac-card" id="bacCreateRemapGuide">
              <p class="bac-card-title">Different BMR number?</p>
              <div class="bac-banner info" id="bacCreateRemapNotice"></div>
            </div>

            <div class="bac-card">
              <p class="bac-card-title">Submission</p>
              <div style="margin-bottom:8px">
                <label class="bac-form-label" for="bacReason">Reason (minimum 10 characters)</label>
                <textarea id="bacReason" class="bac-textarea" maxlength="2000"></textarea>
              </div>
              <div style="margin-bottom:8px">
                <label class="bac-form-label" for="bacReference">Supporting reference (optional)</label>
                <input id="bacReference" class="bac-input" type="text" maxlength="500" />
              </div>
              <label class="bac-check">
                <input type="checkbox" id="bacImpactAck" />
                <span>I acknowledge the impact of this administrative correction, including any automatic unlink when corrected BMR size differs from the planned batch size. The planned batch size will remain unchanged.</span>
              </label>
            </div>
          </div>

          <div id="bacTabDetails" class="bac-tabpanel hidden" data-panel="details">
            <div id="bacDetailsBody"></div>
          </div>

          <div id="bacTabHistory" class="bac-tabpanel hidden" data-panel="history">
            <div id="bacHistoryBody" class="bac-muted">No history loaded.</div>
          </div>
        </div>
      </div>

      <div class="bac-footer">
        <span class="bac-footer-hint" id="bacFooterHint">Governed correction — planned batch size is immutable</span>
        <div class="bac-footer-actions">
          <button type="button" class="bac-btn" id="bacCancelBtn">Close</button>
          <button type="button" class="bac-btn warn" id="bacSubmitBtn">Confirm correction</button>
        </div>
      </div>
    </div>

    <div id="bacConfirmLayer" class="bac-confirm-layer hidden" role="alertdialog" aria-modal="true" aria-labelledby="bacConfirmTitle">
      <div class="bac-confirm-card">
        <div class="bac-confirm-head" id="bacConfirmTitle">Confirm administrative correction</div>
        <div class="bac-confirm-body" id="bacConfirmMessage"></div>
        <div class="bac-confirm-actions">
          <button type="button" class="bac-btn" id="bacConfirmCancelBtn">Cancel</button>
          <button type="button" class="bac-btn warn" id="bacConfirmOkBtn">Confirm</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(root);
  $("bacUnlinkNotice").textContent = COPY.unlinkNotice;
  $("bacCreateRemapNotice").textContent = COPY.createAndRemapGuidance;
  $("bacSizeSyncNotice").textContent = COPY.sizeSnapshotSyncNotice;
  $("bacRemapBlockedNotice").textContent = COPY.remapBlockedEvidence;
  return root;
}

function $(id) {
  return document.getElementById(id);
}

function setHidden(el, hidden) {
  if (!el) return;
  el.classList.toggle("hidden", !!hidden);
}

function setActiveTab(tab) {
  _activeTab = tab;
  document.querySelectorAll(`#${ROOT_ID} .bac-tab`).forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  document.querySelectorAll(`#${ROOT_ID} .bac-tabpanel`).forEach((panel) => {
    setHidden(panel, panel.dataset.panel !== tab);
  });
  const submitVisible = tab === "correct" && !$("bacForm")?.classList.contains("hidden");
  setHidden($("bacSubmitBtn"), !submitVisible || !!_session?.lastResult);
}

function selectedOperation() {
  const checked = document.querySelector("#bacOps input[name='bacOp']:checked");
  return checked ? checked.value : null;
}

function planBatch() {
  return _preview?.plan_batch || {};
}

function evidence() {
  return _preview?.operational_evidence || {};
}

function renderIdentityStrip() {
  const pb = planBatch();
  const ev = evidence();
  const sizeUom = `${pb.bmr_batch_size ?? "—"} ${pb.uom ?? ""}`.trim();

  $("bacIdentity").innerHTML = [
    ["Product", pb.product_name],
    ["BMR number", pb.bn],
    ["BMR size", sizeUom],
    ["Planned size", pb.planned_batch_size],
    ["Plan", pb.plan_title],
    ["Month", pb.month_start],
    ["Status", pb.header_status],
    ["Seq", pb.batch_no_seq],
  ]
    .map(
      ([k, v]) => `
      <div class="bac-id-cell">
        <span class="bac-id-k">${esc(k)}</span>
        <span class="bac-id-v" title="${esc(dash(v))}">${esc(dash(v))}</span>
      </div>`,
    )
    .join("");
  setHidden($("bacIdentity"), false);

  const chips = [];
  chips.push(
    `<span class="bac-badge${pb.bmr_id != null ? "" : " ok"}">${
      pb.bmr_id != null ? "Mapped" : "Unmapped"
    }</span>`,
  );
  if (ev.correction_blocked) {
    chips.push(`<span class="bac-badge danger">Correction blocked</span>`);
  } else {
    chips.push(`<span class="bac-badge ok">Correction eligible</span>`);
  }
  chips.push(
    `<span class="bac-badge">Work-log: ${esc(ev.work_log_count ?? 0)}</span>`,
  );
  chips.push(
    `<span class="bac-badge">Lab: ${esc(ev.lab_analysis_count ?? 0)}</span>`,
  );
  if (pb.bmr_linked_at) {
    chips.push(
      `<span class="bac-muted">Linked ${esc(pb.bmr_linked_at)}${
        pb.bmr_linked_by ? ` · ${esc(pb.bmr_linked_by)}` : ""
      }</span>`,
    );
  }
  $("bacStatusRow").innerHTML = chips.join("");
  setHidden($("bacStatusRow"), false);

  const headerBadge = $("bacHeaderStatusBadge");
  if (ev.correction_blocked) {
    headerBadge.textContent = "Blocked";
    headerBadge.className = "bac-badge danger";
    setHidden(headerBadge, false);
  } else {
    headerBadge.textContent = String(pb.header_status || "").toUpperCase() || "";
    headerBadge.className = "bac-badge";
    setHidden(headerBadge, !pb.header_status);
  }
}

function renderDetailsTab() {
  const pb = planBatch();
  const ev = evidence();
  const rules = _preview?.rules || {};
  const perms = _preview?.permissions || {};
  // Defensive compatibility reads — do not drive interactive ops from these.
  void rules.bmr_number_is_immutable;
  void rules.number_correction_replacement_workflow;
  void _preview?.operation_policy?.CORRECT_BMR_NUMBER;

  const groups = [
    {
      title: "BMR",
      rows: [
        ["Product", pb.product_name],
        ["Product ID", pb.product_id],
        ["BMR ID", pb.bmr_id],
        ["BMR number (immutable)", pb.bn],
        ["BMR size", pb.bmr_batch_size],
        ["UOM", pb.uom],
      ],
    },
    {
      title: "Plan batch",
      rows: [
        ["Plan title", pb.plan_title],
        ["Plan batch ID", pb.id],
        ["Header ID", pb.header_id],
        ["Plan status", pb.header_status],
        ["Plan month", pb.month_start],
        ["Batch sequence", pb.batch_no_seq],
        ["Line ID", pb.line_id],
        ["Planned batch size", pb.planned_batch_size],
      ],
    },
    {
      title: "Mapping",
      rows: [
        ["Linked at", pb.bmr_linked_at],
        ["Linked by", pb.bmr_linked_by],
      ],
    },
    {
      title: "Operational evidence",
      rows: [
        ["Work-log count", ev.work_log_count],
        ["Laboratory-analysis count", ev.lab_analysis_count],
        ["Correction blocked", ev.correction_blocked ? "Yes" : "No"],
      ],
    },
    {
      title: "Rules / permissions",
      rows: [
        ["BMR number immutable", rules.bmr_number_is_immutable === false ? "No" : "Yes"],
        ["Plan size immutable", rules.plan_batch_size_is_immutable ? "Yes" : "—"],
        [
          "Size mismatch auto-unlinks",
          rules.size_mismatch_auto_unlinks ? "Yes" : "—",
        ],
        [
          "Eligible plan statuses",
          Array.isArray(rules.eligible_plan_statuses)
            ? rules.eligible_plan_statuses.join(", ")
            : "—",
        ],
        ["Can view Manager BMR", perms.can_view_manager_bmr ? "Yes" : "No"],
        ["Can admin-correct", perms.can_admin_correct ? "Yes" : "No"],
      ],
    },
  ];

  const immutableNote = `<div class="bac-banner info" style="margin-bottom:10px">${esc(
    COPY.bmrNumberImmutable,
  )}</div>`;

  $("bacDetailsBody").innerHTML =
    immutableNote +
    groups
      .map(
        (g) => `
      <div class="bac-dl-group">${esc(g.title)}</div>
      <table class="bac-dl">
        <tbody>
          ${g.rows
            .map(
              ([k, v]) =>
                `<tr><th>${esc(k)}</th><td>${esc(dash(v))}</td></tr>`,
            )
            .join("")}
        </tbody>
      </table>`,
      )
      .join("");
}

function renderCurrentState() {
  renderIdentityStrip();
  renderDetailsTab();

  const blocked = !!evidence().correction_blocked;
  const banner = $("bacBlockedBanner");
  if (blocked) {
    banner.textContent =
      "Correction is blocked because work-log or laboratory evidence exists for this BMR.";
    setHidden(banner, false);
  } else {
    setHidden(banner, true);
  }
}

function availableOperations() {
  const pb = planBatch();
  const blocked = !!evidence().correction_blocked;
  const mapped = pb.bmr_id != null;
  // Locked client allowlist only — never render CORRECT_BMR_NUMBER even if preview allows it.
  const ops = mapped ? [...CLIENT_SUPPORTED_OPERATIONS] : [];
  return { ops, blocked };
}

function renderOperations(preferredOp) {
  const { ops, blocked } = availableOperations();
  const wrap = $("bacOps");
  if (!ops.length) {
    wrap.innerHTML =
      '<div class="bac-banner danger">No administrative correction operations are available for the current mapping state.</div>';
    return;
  }
  const selected =
    preferredOp && ops.includes(preferredOp) ? preferredOp : ops[0];
  wrap.innerHTML = ops
    .map((op) => {
      const isSel = op === selected;
      return `
      <label class="bac-op${blocked ? " disabled" : ""}${
        isSel ? " is-selected" : ""
      }">
        <input type="radio" name="bacOp" value="${esc(op)}" ${
          isSel ? "checked" : ""
        } ${blocked ? "disabled" : ""} />
        <span>${esc(OPERATION_LABELS[op] || op)}</span>
      </label>`;
    })
    .join("");

  wrap.querySelectorAll("input[name='bacOp']").forEach((input) => {
    input.addEventListener("change", () => {
      wrap.querySelectorAll(".bac-op").forEach((lab) => {
        lab.classList.toggle(
          "is-selected",
          lab.querySelector("input")?.checked,
        );
      });
      syncOperationPanels().catch(console.error);
    });
  });
}

async function ensureCandidatesLoaded() {
  const pb = planBatch();
  if (!pb.product_id || pb.planned_batch_size == null) {
    _candidates = [];
    return;
  }
  const monthFrom = _options?.monthFrom || null;
  const monthTo = _options?.monthTo || null;
  _candidates = await loadRemapCandidates({
    productId: pb.product_id,
    plannedBatchSize: pb.planned_batch_size,
    excludeBmrId: pb.bmr_id,
    monthFrom,
    monthTo,
    monthStart: monthFrom || monthTo ? null : pb.month_start,
  });
}

async function syncOperationPanels() {
  const op = selectedOperation();
  setHidden($("bacPanelRemap"), op !== OPERATION_TYPES.REMAP_BMR);
  setHidden($("bacPanelUnlink"), op !== OPERATION_TYPES.UNLINK_BMR);
  setHidden($("bacPanelSize"), op !== OPERATION_TYPES.CORRECT_BMR_SIZE);

  const pb = planBatch();
  const blocked = !!evidence().correction_blocked;
  $("bacOldSize").textContent =
    pb.bmr_batch_size != null
      ? `${pb.bmr_batch_size} ${pb.uom ?? ""}`.trim()
      : "—";
  $("bacPlannedSize").textContent =
    pb.planned_batch_size != null ? String(pb.planned_batch_size) : "—";

  if (op === OPERATION_TYPES.REMAP_BMR) {
    setHidden($("bacRemapBlockedNotice"), !blocked);
    setHidden($("bacRemapFields"), blocked);
    if (!blocked) {
      await ensureCandidatesLoaded();
      const sel = $("bacTargetBmr");
      if (!_candidates.length) {
        sel.innerHTML = `<option value="">No potentially eligible candidates found</option>`;
      } else {
        sel.innerHTML =
          `<option value="">— Select target BMR —</option>` +
          _candidates
            .map(
              (c) =>
                `<option value="${esc(c.bmr_id)}">${esc(c.label)}</option>`,
            )
            .join("");
      }
    }
  }

  if (op === OPERATION_TYPES.CORRECT_BMR_SIZE) {
    updateSizeOutcome();
  }

  const canMutate =
    !blocked &&
    !!_preview?.permissions?.can_admin_correct &&
    !!op &&
    !_session?.lastResult;
  $("bacSubmitBtn").disabled = !canMutate || _submitting;
  setHidden($("bacSubmitBtn"), _activeTab !== "correct" || !!_session?.lastResult);
}

function updateSizeOutcome() {
  const pb = planBatch();
  const proposed = $("bacNewSize").value;
  const el = $("bacSizeOutcome");
  if (proposed === "" || proposed == null) {
    el.className = "bac-banner";
    el.textContent =
      "Enter a proposed BMR size to preview the mapping outcome.";
    return;
  }
  const outcome = previewSizeOutcome(proposed, pb.planned_batch_size);
  if (outcome === "auto_unlink") {
    el.className = "bac-banner danger";
    el.textContent = COPY.sizeMismatchWarning;
  } else if (outcome === "retain") {
    el.className = "bac-banner ok";
    el.textContent = COPY.sizeMatchNotice;
  } else {
    el.className = "bac-banner";
    el.textContent = "Enter a valid numeric size.";
  }
}

function renderHistory(rows) {
  const body = $("bacHistoryBody");
  if (!rows?.length) {
    body.innerHTML = `<p class="bac-muted">No administrative corrections recorded for this scope.</p>`;
    return;
  }
  body.innerHTML = `
    <div class="bac-table-wrap">
      <table class="bac-history-table">
        <thead>
          <tr>
            <th>Correction</th>
            <th>When</th>
            <th>Operation</th>
            <th>Old</th>
            <th>New</th>
            <th>Planned</th>
            <th>Outcome</th>
            <th>Reason</th>
            <th>Reference</th>
            <th>Actor</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((row) => {
              const { oldValue, newValue } = formatHistoryOldNew(row);
              return `<tr>
                <td>${esc(row.correction_no)}</td>
                <td>${esc(row.executed_at)}</td>
                <td>${esc(labelForOperationType(row.operation_type))}</td>
                <td>${esc(oldValue)}</td>
                <td>${esc(newValue)}</td>
                <td>${esc(row.planned_batch_size)}</td>
                <td>${esc(row.operation_result)}</td>
                <td>${esc(row.reason)}</td>
                <td>${esc(row.supporting_reference || "—")}</td>
                <td>${esc(row.executed_by)}</td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>`;
}

async function loadScopedHistory() {
  const pb = planBatch();
  const batchId = _options?.batchPlanBatchId ?? pb.id ?? null;
  const bmrId = _options?.bmrId ?? pb.bmr_id ?? null;
  try {
    const rows = await getAdminCorrectionHistory({
      batchPlanBatchId: batchId,
      bmrId,
      limit: 50,
    });
    renderHistory(rows);
  } catch (err) {
    console.error("[bac] history load failed", err);
    $("bacHistoryBody").innerHTML =
      `<p class="bac-error">Failed to load correction history.</p>`;
  }
}

function renderSuccess(result) {
  const box = $("bacSuccess");
  const mappingNote = describeOperationResult(result);
  box.innerHTML = `
    <div class="bac-success-title">Correction completed${
      result.idempotent_replay ? " (idempotent replay)" : ""
    }</div>
    <div>Correction number: <span class="bac-success-key">${esc(result.correction_no)}</span></div>
    <div>Operation: ${esc(labelForOperationType(result.operation_type))}</div>
    <div>Outcome: ${esc(result.operation_result)}</div>
    <div>Old BN / size: ${esc(result.old_bn ?? "—")} / ${esc(
      result.old_batch_size ?? "—",
    )}</div>
    <div>New BN / size: ${esc(result.new_bn ?? "—")} / ${esc(
      result.new_batch_size ?? "—",
    )}</div>
    <div>Old BMR id → New BMR id: ${esc(result.old_bmr_id ?? "—")} → ${esc(
      result.new_bmr_id ?? "—",
    )}</div>
    <div>${esc(mappingNote)}</div>
    <div>${esc(COPY.plannedSizeUnchanged)} (planned size ${esc(
      result.planned_batch_size,
    )}).</div>
    <div class="bac-muted">Executed at ${esc(result.executed_at)}</div>
  `;
  setHidden(box, false);
  setHidden($("bacForm"), true);
  setHidden($("bacTabs"), true);
  $("bacSubmitBtn").disabled = true;
  setHidden($("bacSubmitBtn"), true);
}

function showBacConfirm(message, title = "Confirm administrative correction") {
  return new Promise((resolve) => {
    const layer = $("bacConfirmLayer");
    const titleEl = $("bacConfirmTitle");
    const msgEl = $("bacConfirmMessage");
    const okBtn = $("bacConfirmOkBtn");
    const cancelBtn = $("bacConfirmCancelBtn");
    if (!layer || !okBtn || !cancelBtn) {
      resolve(window.confirm(message));
      return;
    }

    titleEl.textContent = title || "Confirm administrative correction";
    msgEl.textContent = message;
    setHidden(layer, false);
    setTimeout(() => okBtn.focus(), 0);

    const finish = (result) => {
      setHidden(layer, true);
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      layer.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKey);
      resolve(result);
    };
    const onOk = () => finish(true);
    const onCancel = () => finish(false);
    const onBackdrop = (e) => {
      if (e.target === layer) finish(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        finish(false);
      }
    };

    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    layer.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKey);
  });
}

async function onSubmit() {
  if (_submitting || !_session) return;
  const pb = planBatch();
  const op = selectedOperation();
  const validation = validateCorrectionForm({
    operationType: op,
    reason: $("bacReason").value,
    supportingReference: $("bacReference").value,
    impactAcknowledged: $("bacImpactAck").checked,
    targetBmrId: $("bacTargetBmr")?.value,
    newBatchSize: $("bacNewSize")?.value,
    currentBatchSize: pb.bmr_batch_size,
    clientRequestId: _session.clientRequestId,
    batchPlanBatchId: _options.batchPlanBatchId,
  });

  const errEl = $("bacError");
  if (!validation.ok) {
    errEl.textContent = validation.message;
    setHidden(errEl, false);
    setActiveTab("correct");
    return;
  }
  setHidden(errEl, true);

  // Always use the in-modal confirm so it stacks above this overlay
  // (page-level confirm dialogs sit behind z-index 2400).
  const ok = await showBacConfirm(
    `Confirm administrative correction (${
      OPERATION_LABELS[op] || op
    })?\n\nThis is an exceptional governed action. The planned batch size will remain unchanged.`,
    "Confirm administrative correction",
  );
  if (!ok) return;

  _submitting = true;
  $("bacSubmitBtn").disabled = true;
  $("bacSubmitBtn").textContent = "Submitting…";

  try {
    const result = await executeAdminCorrection({
      ...validation.payload,
      p_client_request_id: _session.clientRequestId,
    });
    _session.lastResult = result;
    renderSuccess(result);
    try {
      window.dispatchEvent(
        new CustomEvent("bmr-admin-correction:completed", { detail: result }),
      );
    } catch (evtErr) {
      console.warn("[bac] completion event dispatch failed", evtErr);
    }
    try {
      if (typeof _options.onSuccess === "function") {
        await _options.onSuccess(result);
      }
    } catch (refreshErr) {
      console.error("[bac] onSuccess refresh failed", refreshErr);
    }
    try {
      await loadScopedHistory();
      _preview = await previewAdminCorrection(_options.batchPlanBatchId);
      renderIdentityStrip();
    } catch (e) {
      console.warn("[bac] post-success preview/history refresh failed", e);
    }
    _candidates = [];
  } catch (err) {
    const mapped = mapAdminCorrectionError(err);
    console.error("[bac] correction failed", mapped.diagnostic, err);
    errEl.textContent = `${mapped.userMessage} You may retry with the same request id.`;
    setHidden(errEl, false);
    $("bacSubmitBtn").disabled = false;
  } finally {
    _submitting = false;
    $("bacSubmitBtn").textContent = "Confirm correction";
  }
}

function closeModal() {
  const el = document.getElementById(ROOT_ID);
  if (el) el.classList.add("hidden");
  const confirmLayer = document.getElementById("bacConfirmLayer");
  if (confirmLayer) confirmLayer.classList.add("hidden");
  _session = null;
  _options = null;
  _preview = null;
  _candidates = [];
  _submitting = false;
  _activeTab = "correct";
}

function wireOnce() {
  if (_wired) return;
  _wired = true;
  const root = ensureRoot();
  $("bacCloseBtn").addEventListener("click", () => closeModal());
  $("bacCancelBtn").addEventListener("click", () => closeModal());
  $("bacSubmitBtn").addEventListener("click", () => {
    onSubmit().catch(console.error);
  });
  $("bacNewSize")?.addEventListener("input", updateSizeOutcome);
  $("bacTabs")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".bac-tab");
    if (!btn) return;
    setActiveTab(btn.dataset.tab);
  });
  root.addEventListener("click", (e) => {
    if (e.target === root) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || root.classList.contains("hidden")) return;
    const confirmLayer = $("bacConfirmLayer");
    if (confirmLayer && !confirmLayer.classList.contains("hidden")) return;
    closeModal();
  });
}

/**
 * Open the shared Administrative Correction workflow.
 * @param {object} options
 * @param {number} options.batchPlanBatchId
 * @param {number} [options.bmrId]
 * @param {string} [options.initialOperation]
 * @param {string} [options.monthFrom]
 * @param {string} [options.monthTo]
 * @param {(result: object) => Promise<void>|void} [options.onSuccess]
 */
export async function openBmrAdminCorrectionModal(options) {
  if (!options?.batchPlanBatchId) {
    throw new Error("batchPlanBatchId is required");
  }
  ensureStyles();
  wireOnce();
  const root = ensureRoot();

  _session = createCorrectionSession();
  _options = { ...options };
  _preview = null;
  _candidates = [];
  _submitting = false;
  _activeTab = "correct";

  root.classList.remove("hidden");
  setHidden($("bacLoading"), false);
  setHidden($("bacError"), true);
  setHidden($("bacSuccess"), true);
  setHidden($("bacForm"), true);
  setHidden($("bacIdentity"), true);
  setHidden($("bacStatusRow"), true);
  setHidden($("bacTabs"), true);
  $("bacError").textContent = "";
  $("bacSuccess").innerHTML = "";
  $("bacReason").value = "";
  $("bacReference").value = "";
  $("bacImpactAck").checked = false;
  $("bacNewSize").value = "";
  $("bacSubmitBtn").disabled = true;
  $("bacSubmitBtn").textContent = "Confirm correction";
  setHidden($("bacSubmitBtn"), false);
  $("bacHistoryBody").innerHTML = `<p class="bac-muted">Loading history…</p>`;
  setActiveTab("correct");

  try {
    _preview = await previewAdminCorrection(options.batchPlanBatchId);
    setHidden($("bacLoading"), true);
    setHidden($("bacForm"), false);
    setHidden($("bacTabs"), false);
    renderCurrentState();
    renderOperations(options.initialOperation || null);
    await syncOperationPanels();
    await loadScopedHistory();
    setActiveTab("correct");

    if (
      _preview?.permissions &&
      _preview.permissions.can_admin_correct === false
    ) {
      const errEl = $("bacError");
      errEl.textContent =
        "Insufficient permission for administrative correction.";
      setHidden(errEl, false);
      $("bacSubmitBtn").disabled = true;
    }
  } catch (err) {
    const mapped = mapAdminCorrectionError(err);
    console.error("[bac] preview failed", mapped.diagnostic, err);
    setHidden($("bacLoading"), true);
    const errEl = $("bacError");
    errEl.textContent = mapped.userMessage;
    setHidden(errEl, false);
    $("bacSubmitBtn").disabled = true;
  }

  return {
    getClientRequestId: () => _session?.clientRequestId ?? null,
    close: () => closeModal(),
  };
}

export function closeBmrAdminCorrectionModal() {
  closeModal();
}
