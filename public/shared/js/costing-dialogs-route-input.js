/**
 * CW-06 — in-page text prompts for Production Route Manager (replaces the native browser prompt).
 * Used only when COSTING_DIALOGS_V1 is ON; flag OFF keeps the legacy native prompts in production-route.js.
 *
 * Scope: presentation only. The submitted value goes through the SAME editor/candidates calls as before
 * (editor.supersedeProduct, candidates.createRouteFamily), whose RPC argument builders, permission checks and
 * server validation are unchanged and remain authoritative. Client checks here only stop obviously wrong input.
 *
 * Dialog contract: labelled field, inline validation (role="alert", aria-invalid), Cancel / Escape / backdrop
 * before the write resolve without calling onSubmit, Enter submits, one in-flight submit (withMutation + settled
 * latch), stale-state guard before the write, cleanup always resolves.
 *
 * While the write is pending: the Cancel button is disabled (aria-disabled) and ignored; if the modal is closed
 * anyway (Escape / backdrop) the write cannot be cancelled, so the dialog never touches the modal stack again
 * (no second closeModal, which could close or restore someone else's modal), the promise resolves only after the
 * write settles with dismissed: true, and a late failure is reported through notify() instead of the gone DOM.
 * A failed request is reported with non-committal wording: the server may or may not have committed.
 */

export const SUPERSEDE_DIALOG_TITLE = "Supersede Product route";
export const FAMILY_DIALOG_TITLE = "Create Manufacturing Route Family";
export const STALE_ROUTE_MESSAGE =
  "The selected route changed while this dialog was open. Close it and try again.";
// A thrown or rejected request does not prove the server made no change (the response may have been lost after
// the commit), so this wording never claims "nothing changed" and tells the user to check before retrying.
export const GENERIC_SUBMIT_ERROR =
  "Unable to confirm whether the request completed. Refresh or check the current route or family state before retrying.";

/** Reason text for a returned { ok: false }: the server/builder message as given, else a neutral line. */
export function failureReason(result) {
  const message =
    (typeof result?.error?.message === "string" && result.error.message) ||
    (Array.isArray(result?.errors) && result.errors.filter(Boolean).join("; ")) ||
    "";
  return message || "The request was not completed. Check the message shown on screen before retrying.";
}

/** New approved draft route id: required positive whole number, not the route being superseded. */
export function validateSupersedeRouteId(raw, { currentRouteId = null } = {}) {
  const value = String(raw ?? "").trim();
  if (!value) return { ok: false, error: "Enter the new route ID." };
  if (!/^[1-9]\d{0,17}$/.test(value)) {
    return { ok: false, error: "Route ID must be a positive whole number." };
  }
  if (currentRouteId !== null && currentRouteId !== undefined && String(currentRouteId).trim() === value) {
    return { ok: false, error: "The new route must be different from the route being superseded." };
  }
  return { ok: true, value };
}

/** Manufacturing Route Family name: required, not blank. The server stays authoritative for everything else. */
export function validateRouteFamilyName(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return { ok: false, error: "Enter a Route Family name." };
  return { ok: true, value };
}

/**
 * Opens a single-field prompt in the PRM details modal.
 * Resolves { submitted: true, result } after onSubmit ran once, or { submitted: false } on cancel/escape/backdrop,
 * stale refusal closed by the user, or when the dialog could not open.
 */
export function openRouteTextPromptModal({
  title,
  subtitle = "",
  fieldId,
  label,
  hint = "",
  inputType = "text",
  inputMode = "",
  notice = "", // opt-in: plain-text context line (escaped), e.g. which route is being superseded
  selectOptions = null, // opt-in: [{ value, label }] renders a labelled <select> instead of a text input
  selectPlaceholder = "Select…",
  keepOpenOnFailure = false, // opt-in: a returned { ok: false } keeps the dialog open and shows the reason
  submitLabel = "Submit",
  validate,
  isStale = () => false,
  onSubmit,
  openModal,
  closeModal,
  formShell,
  formField,
  onModal,
  withMutation,
  isDetailsModalOpen = () => false,
  escapeHtml = (value) => String(value ?? ""),
  notify = () => {},
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    let submitting = false;
    let dismissed = false; // the modal was closed (cancel, Escape, backdrop) - never touch the modal stack again
    const finish = (payload) => {
      if (settled) return;
      settled = true;
      resolve(payload);
    };
    const errId = `${fieldId}Error`;

    openModal(
      {
        title,
        subtitle,
        html: formShell({
          sectionTitle: "",
          notice: notice ? escapeHtml(notice) : "",
          fieldsHtml:
            (Array.isArray(selectOptions)
              ? formField({
                  id: fieldId,
                  label,
                  type: "select",
                  required: true,
                  full: true,
                  hint,
                  optionsHtml:
                    `<option value="">${escapeHtml(selectPlaceholder)}</option>` +
                    selectOptions
                      .map((o) => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`)
                      .join(""),
                })
              : formField({ id: fieldId, label, type: inputType, required: true, full: true, hint })) +
            `<div id="${escapeHtml(errId)}" class="cp-prm-field-error" style="color:var(--sasv-danger,#b91c1c);font-size:12px;grid-column:1/-1" role="alert" aria-live="assertive" hidden></div>`,
          actionsHtml: `<button type="button" class="icon-btn" data-prm-prompt-cancel>Cancel</button><button type="button" class="icon-btn icon-btn-primary" data-prm-prompt-submit>${escapeHtml(submitLabel)}</button>`,
        }),
        bind: (host) => {
          const input = host.querySelector?.(`#${fieldId}`);
          const errEl = host.querySelector?.(`#${errId}`);
          if (inputMode && input?.setAttribute) input.setAttribute("inputmode", inputMode);
          input?.setAttribute?.("aria-describedby", errId);
          input?.focus?.();
          const showError = (message) => {
            if (errEl) {
              errEl.textContent = message;
              errEl.hidden = !message;
            }
            if (input?.setAttribute) {
              if (message) input.setAttribute("aria-invalid", "true");
              else input.removeAttribute?.("aria-invalid");
            }
          };
          const cancelBtn = host.querySelector?.("[data-prm-prompt-cancel]");
          const setCancelLocked = (locked) => {
            if (!cancelBtn) return;
            cancelBtn.disabled = locked;
            if (locked) cancelBtn.setAttribute?.("aria-disabled", "true");
            else cancelBtn.removeAttribute?.("aria-disabled");
          };
          const submit = async (button) => {
            if (settled || submitting || dismissed) return;
            const checked = validate(input?.value ?? "");
            if (!checked.ok) {
              showError(checked.error);
              input?.focus?.();
              return;
            }
            if (isStale()) {
              showError(STALE_ROUTE_MESSAGE);
              return;
            }
            showError("");
            submitting = true;
            setCancelLocked(true);
            let outcome = null;
            try {
              outcome = await withMutation(button, async () => {
                if (settled || dismissed) return { skipped: true };
                try {
                  const result = await onSubmit(checked.value);
                  return { ran: true, result };
                } catch {
                  return { failed: true };
                }
              });
            } finally {
              submitting = false;
              if (!dismissed) setCancelLocked(false);
            }
            if (dismissed) {
              if (keepOpenOnFailure && outcome?.ran && outcome.result?.ok === false) {
                notify(failureReason(outcome.result), "warning");
              }
              // Closed while the write was pending: the write could not be cancelled. Do not close/restore any
              // modal again; report the outcome once it is known.
              if (outcome?.failed) notify(GENERIC_SUBMIT_ERROR, "warning");
              if (outcome?.ran) finish({ submitted: true, dismissed: true, result: outcome.result });
              else finish({ submitted: Boolean(outcome?.failed), dismissed: true, failed: Boolean(outcome?.failed) });
              return;
            }
            if (keepOpenOnFailure && outcome?.ran && outcome.result?.ok === false) {
              // The request was refused (nothing was reported as done): keep the dialog open with the reason,
              // never close it as if it had succeeded.
              showError(failureReason(outcome.result));
              return;
            }
            if (outcome?.ran) {
              settled = true;
              dismissed = true; // our own close below must not be treated as an external dismissal
              closeModal({ restorePrevious: true });
              resolve({ submitted: true, result: outcome.result });
            } else if (outcome?.failed) {
              showError(GENERIC_SUBMIT_ERROR);
            }
            // busy / skipped: leave the dialog open; the shared mutation guard already told the user.
          };
          onModal(host, "click", async (event) => {
            if (event.target.closest("[data-prm-prompt-cancel]")) {
              if (submitting) return; // write pending: Cancel is locked
              dismissed = true;
              closeModal({ restorePrevious: true });
              finish({ submitted: false });
              return;
            }
            const button = event.target.closest("[data-prm-prompt-submit]");
            if (button) await submit(button);
          });
          onModal(host, "keydown", async (event) => {
            if (event.key !== "Enter" || event.target?.id !== fieldId) return;
            event.preventDefault?.();
            const button = host.querySelector?.("[data-prm-prompt-submit]");
            await submit(button || null);
          });
        },
        cleanup: () => {
          dismissed = true;
          // While a write is pending the promise resolves after it settles (see submit); otherwise now.
          if (!submitting) finish({ submitted: false });
        },
      },
      { nested: Boolean(isDetailsModalOpen?.()) },
    );
  });
}
