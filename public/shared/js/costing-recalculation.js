// Governed toolbar recalculation. Dates and eligibility belong to the server.
import { mapCostingApprovalError, formatMappedErrorForDisplay } from "./costing-approval-errors.js";
import { formatOfficialValuationDate, formatLatestDraftValuationDate } from "./costing-approval-labels.js";
import { RUN_STATUS_SELECT_APPROVAL_V1 } from "./costing-run-status-badge.js";

export const RECALCULATION_RPC = "rpc_costing_request_recalculation";
export const EMPTY_DATE_HELP = "The server chooses today (India date), or the month's last day if the month has ended.";
export const PERIOD_STATUS_SELECT = RUN_STATUS_SELECT_APPROVAL_V1;

export function periodDateLabels(row) {
  return [
    ["Official (approved) date", formatOfficialValuationDate(row)],
    ["Latest draft date", formatLatestDraftValuationDate(row)],
  ];
}

export function periodDateText(row) {
  return periodDateLabels(row).map(([label, value]) => `${label}: ${value}`).join(" \u00b7 ");
}

export function recalculationSuccessText(row) {
  const parts = [
    `Draft run ${row.refresh_run_id} requested for ${row.period_start} at ${row.valuation_date}.`,
  ];
  if (row.pricing_note != null && String(row.pricing_note).trim() !== "") {
    parts.push(String(row.pricing_note).trim());
  }
  if (row.action != null && String(row.action).trim() !== "") {
    parts.push(`Action: ${String(row.action).trim()}`);
  }
  return parts.join(" ");
}

// No settled-month cache: a newer draft can appear after an approved run.
export function createPeriodDateStatus({ supabase, getPeriod }) {
  let generation = 0;
  let row = null;
  return {
    get(period = getPeriod()) { return row?.period_start === period ? row : null; },
    async reload() {
      const mine = ++generation;
      const period = getPeriod();
      row = null;
      if (!period) return null;
      const { data, error } = await supabase.from("v_costing_pricing_period_run_status")
        .select(PERIOD_STATUS_SELECT).eq("period_start", period).maybeSingle();
      if (mine !== generation || period !== getPeriod()) return null;
      if (error) throw error;
      row = data;
      return row;
    },
  };
}

export function createRecalculationController({
  costingRpc, getPeriod, canEdit, invalidateBadge, reloadStatus,
  showToast, doc = globalThis.document,
}) {
  let pending = false;
  let generation = 0;
  let period = null;
  let dialog = null;
  const el = (id) => doc?.getElementById(id);
  function syncPendingState() {
    if (el("recalcSubmit")) el("recalcSubmit").disabled = pending;
    if (el("recalcClose")) el("recalcClose").disabled = pending;
    if (el("recalcHeaderClose")) el("recalcHeaderClose").disabled = pending;
  }
  function onPeriodChange() {
    if (period !== getPeriod()) {
      ++generation;
      period = getPeriod();
      dialog?.close();
    }
  }
  async function submit({ reason, valuationDate = "", periodStart = period } = {}) {
    if (pending) return { ignored: true };
    if (!canEdit()) {
      showToast("You don't have edit permission for the Costing Control Centre.", "error");
      return { refused: true };
    }
    const mine = generation;
    pending = true;
    syncPendingState();
    if (el("recalcError")) el("recalcError").textContent = "";
    try {
      const args = { p_period_start: periodStart, p_reason: reason };
      if (valuationDate) args.p_valuation_date = valuationDate;
      const { data, error } = await costingRpc(RECALCULATION_RPC, args);
      if (error) throw error;
      // The route returns one jsonb object, not legacy refresh status rows.
      if (!data || Array.isArray(data) || typeof data !== "object") {
        throw new Error("Unexpected recalculation response.");
      }
      invalidateBadge();
      if (mine !== generation || periodStart !== getPeriod()) return { stale: true };
      const message = recalculationSuccessText(data);
      if (el("recalcResult")) el("recalcResult").textContent = message;
      showToast(message, "success", 12000);
      try {
        await reloadStatus();
      } catch {
        showToast("Draft requested. Status could not be reloaded; reload the screen to see the latest status.", "info");
      }
      return { data };
    } catch (error) {
      if (mine !== generation || periodStart !== getPeriod()) return { stale: true };
      const mapped = mapCostingApprovalError(error);
      const message = formatMappedErrorForDisplay(mapped);
      if (el("recalcError")) el("recalcError").textContent = message;
      if (el("recalcCopy")) el("recalcCopy").hidden = mapped.kind !== "unknown";
      showToast(message, "error", 9000);
      return { error };
    } finally {
      pending = false;
      syncPendingState();
    }
  }
  function open() {
    onPeriodChange();
    if (pending) return;
    if (!canEdit()) {
      showToast("You don't have edit permission for the Costing Control Centre.", "error");
      return;
    }
    if (!dialog) {
      dialog = doc.createElement("dialog");
      dialog.id = "costingRecalculationDialog";
      dialog.className = "costing-recalculation-dialog";
      dialog.setAttribute("aria-labelledby", "recalcTitle");
      dialog.innerHTML = `<form id="recalcForm" class="cost-sheet-sign-panel">
        <div class="cost-sheet-sign-header">
          <div>
            <span class="cp-modal-title" id="recalcTitle">Request a recalculation (draft)</span>
            <div class="peq-modal-subtitle" id="recalcPeriod"></div>
          </div>
          <button id="recalcHeaderClose" type="button" class="icon-btn" title="Close" aria-label="Close">&times;</button>
        </div>
        <div class="cost-sheet-sign-body">
          <div class="sign-grid">
            <label>Reason <textarea id="recalcReason" class="form-control" rows="3"></textarea></label>
            <label>Valuation date (optional) <input id="recalcDate" class="form-control" type="date" aria-describedby="recalcDateHelp"></label>
            <p id="recalcDateHelp" class="cp-muted-text recalc-full-row">${EMPTY_DATE_HELP}</p>
            <p id="recalcConfirmation" class="cp-prm-form-notice recalc-full-row"></p>
            <p id="recalcError" class="cas-danger recalc-full-row" role="alert"></p>
            <button id="recalcCopy" class="cas-linkish recalc-full-row" type="button" hidden>Copy details</button>
            <p id="recalcResult" class="cp-muted-text recalc-full-row" role="status"></p>
          </div>
        </div>
        <div class="cost-sheet-sign-actions">
          <button id="recalcClose" type="button" class="icon-btn">Close</button>
          <button id="recalcSubmit" type="submit" class="icon-btn icon-btn-primary">Request draft</button>
        </div>
      </form>`;
      doc.body.append(dialog);
      el("recalcForm").addEventListener("submit", (event) => {
        event.preventDefault();
        void submit({ reason: el("recalcReason").value, valuationDate: el("recalcDate").value });
      });
      const closeDialog = () => {
        if (!pending) dialog.close();
      };
      el("recalcClose").addEventListener("click", closeDialog);
      el("recalcHeaderClose").addEventListener("click", closeDialog);
      dialog.addEventListener("cancel", (event) => {
        if (pending) event.preventDefault();
      });
      el("recalcDate").addEventListener("input", () => {
        const selectedDate = el("recalcDate").value;
        el("recalcConfirmation").textContent = selectedDate
          ? `A new draft will be costed at ${selectedDate}. It is not used for pricing until approved.`
          : "A new draft will be costed at the date the server chooses (today, India date, or the month's last day if the month has ended). It is not used for pricing until approved.";
      });
      el("recalcCopy").addEventListener("click", async () => {
        try { await globalThis.navigator.clipboard.writeText(el("recalcError").textContent); }
        catch { showToast("Select and copy the displayed details.", "info"); }
      });
    }
    el("recalcForm").reset();
    el("recalcPeriod").textContent = `Period: ${period || "\u2014"}`;
    el("recalcError").textContent = "";
    el("recalcResult").textContent = "";
    el("recalcCopy").hidden = true;
    el("recalcConfirmation").textContent = "A new draft will be costed at the date the server chooses (today, India date, or the month's last day if the month has ended). It is not used for pricing until approved.";
    dialog.showModal();
  }
  return { open, submit, onPeriodChange };
}
