/* eslint-env node */

const { QC_PORTAL_CONTRACT } = require("./qc-register-portal-contract");

function decideSaveClick({ contract = QC_PORTAL_CONTRACT, control } = {}) {
  if (contract?.nativeSaveClickEnabled !== true) {
    return {
      allow: false,
      reason: contract?.nativeSaveBlockedReason || "SAVE_NOT_ENABLED",
      click: "not-clicked",
    };
  }
  const text = String(control?.text || "").replace(/\s+/g, " ").trim();
  const id = String(control?.id || "");
  if (!control || id !== contract.saveControlId) {
    return { allow: false, reason: "SAVE_CONTROL_MISSING", click: "not-clicked" };
  }
  if (text !== "Save" || /submit/i.test(text)) {
    return { allow: false, reason: "SUBMIT_TARGET", click: "not-clicked" };
  }
  return { allow: true, reason: "SAVE", click: "allowed" };
}

module.exports = {
  decideSaveClick,
};
