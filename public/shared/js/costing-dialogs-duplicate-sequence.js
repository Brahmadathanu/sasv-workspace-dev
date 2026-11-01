/**
 * CW-06 — in-page confirm for Family Route submit when duplicate step sequences exist.
 * Used only when COSTING_DIALOGS_V1 is ON. Flag-OFF keeps window.confirm in production-route.
 */

export function buildDuplicateFamilySequenceConfirmMessage(dupes = []) {
  return `Duplicate sequence number(s) within this route: ${dupes.join(", ")}. Server uniqueness remains authoritative. Continue submit?`;
}

/**
 * Opens the PRM details modal for duplicate-sequence confirmation.
 * Confirm runs onConfirmWrite once inside withMutation (double-click safe).
 * Cancel / Escape / backdrop: cleanup resolves without calling onConfirmWrite.
 */
export function openDuplicateFamilySequenceSubmitModal({
  dupes = [],
  openModal,
  closeModal,
  formShell,
  onModal,
  withMutation,
  isDetailsModalOpen = () => false,
  escapeHtml = (value) => String(value ?? ""),
  onConfirmWrite,
} = {}) {
  const message = buildDuplicateFamilySequenceConfirmMessage(dupes);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (confirmed) => {
      if (settled) return;
      settled = true;
      resolve(confirmed);
    };

    openModal(
      {
        title: "Duplicate sequence numbers",
        subtitle: "Confirmation required before submit",
        html: formShell({
          notice: escapeHtml(message),
          sectionTitle: "",
          fieldsHtml: "",
          actionsHtml: `<button type="button" class="icon-btn" data-prm-dup-seq-cancel>Cancel</button><button type="button" class="icon-btn icon-btn-primary" data-prm-dup-seq-confirm>Continue submit</button>`,
        }),
        bind: (host) => {
          onModal(host, "click", async (event) => {
            if (event.target.closest("[data-prm-dup-seq-cancel]")) {
              closeModal({ restorePrevious: true });
              finish(false);
              return;
            }
            const confirmBtn = event.target.closest(
              "[data-prm-dup-seq-confirm]",
            );
            if (!confirmBtn) return;
            await withMutation(confirmBtn, async () => {
              if (settled) return;
              settled = true;
              try {
                await onConfirmWrite?.();
              } finally {
                closeModal({ restorePrevious: true });
                resolve(true);
              }
            });
          });
        },
        cleanup: () => {
          finish(false);
        },
      },
      { nested: Boolean(isDetailsModalOpen?.()) },
    );
  });
}
