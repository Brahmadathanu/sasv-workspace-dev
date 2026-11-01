/**
 * CW-06 — in-page text prompts for Production Route Manager (replaces the native browser prompt).
 * Used only when COSTING_DIALOGS_V1 is ON; flag OFF keeps the legacy native prompts in production-route.js.
 *
 * Scope: presentation only. The submitted value goes through the SAME editor/candidates calls as before
 * (editor.supersedeProduct, candidates.createRouteFamily), whose RPC argument builders, permission checks and
 * server validation are unchanged and remain authoritative. Client checks here only stop obviously wrong input.
 *
 * Dialog contract: labelled field, inline validation (role="alert", aria-invalid), Cancel / Escape / backdrop
 * resolve without calling onSubmit, Enter submits, one in-flight submit (withMutation + settled latch),
 * stale-state guard before the write, safe inline error when the write throws, cleanup always resolves.
 */

export const SUPERSEDE_DIALOG_TITLE = "Supersede Product route";
export const FAMILY_DIALOG_TITLE = "Create Manufacturing Route Family";
export const STALE_ROUTE_MESSAGE =
  "The selected route changed while this dialog was open. Close it and try again.";
export const GENERIC_SUBMIT_ERROR =
  "Unable to complete the request. Nothing was changed from this dialog; check your connection and try again.";

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
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    let submitting = false;
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
          fieldsHtml:
            formField({ id: fieldId, label, type: inputType, required: true, full: true, hint }) +
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
          const submit = async (button) => {
            if (settled || submitting) return;
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
            try {
              const outcome = await withMutation(button, async () => {
                if (settled) return { skipped: true };
                try {
                  const result = await onSubmit(checked.value);
                  return { ran: true, result };
                } catch {
                  return { failed: true };
                }
              });
              if (outcome?.ran) {
                settled = true;
                closeModal({ restorePrevious: true });
                resolve({ submitted: true, result: outcome.result });
              } else if (outcome?.failed) {
                showError(GENERIC_SUBMIT_ERROR);
              }
              // busy / skipped: leave the dialog open; the shared mutation guard already told the user.
            } finally {
              submitting = false;
            }
          };
          onModal(host, "click", async (event) => {
            if (event.target.closest("[data-prm-prompt-cancel]")) {
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
          finish({ submitted: false });
        },
      },
      { nested: Boolean(isDetailsModalOpen?.()) },
    );
  });
}
