/* eslint-env node */

const { QC_PORTAL_CONTRACT } = require("./qc-register-portal-contract");

const ALLOWED_SAVE_LABELS = new Set(["Submit", "Update"]);

function assessSaveIdentity({ contract = QC_PORTAL_CONTRACT, control, page } = {}) {
  const text = String(control?.text || "").replace(/\s+/g, " ").trim();
  const id = String(control?.id || "");
  const route = String(page?.route || page?.pathname || "");
  const onclick = String(control?.onclick || "");
  const saveData = page?.saveData === true;
  const checks = {
    controlPresent: Boolean(control) && id === contract.saveControlId,
    routeExact: route === contract.route,
    handler: saveData === true && onclick.includes("SaveData()"),
    label: ALLOWED_SAVE_LABELS.has(text),
  };
  let identityReason = null;
  if (!checks.controlPresent) identityReason = "SAVE_CONTROL_MISSING";
  else if (!checks.routeExact) identityReason = "ROUTE_MISMATCH";
  else if (!checks.handler) identityReason = "HANDLER_MISMATCH";
  else if (!checks.label) identityReason = "LABEL_UNEXPECTED";
  return { checks, identityReason, text, id, route };
}

function decideSaveClick(args = {}) {
  const contract = args.contract || QC_PORTAL_CONTRACT;
  const identity = assessSaveIdentity({ ...args, contract });
  if (contract.nativeSaveClickEnabled !== true) {
    return {
      allow: false,
      reason: "SAVE_CONTROL_LABELLED_SUBMIT",
      click: "not-clicked",
      identity,
    };
  }
  if (identity.identityReason) {
    return {
      allow: false,
      reason: identity.identityReason,
      click: "not-clicked",
      identity,
    };
  }
  return { allow: true, reason: "SAVE", click: "allowed", identity };
}

module.exports = {
  ALLOWED_SAVE_LABELS,
  assessSaveIdentity,
  decideSaveClick,
};
