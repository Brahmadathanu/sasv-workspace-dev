/**
 * UX-1 worklist, role copy, and why-disabled decisions.
 * Rendering stays in the review page. This module does not call the network.
 */

export const WORKLIST_TAB_KEY = "sasv.eaushadhi.worklistQueue";
export const WORKLIST_FALLBACK_TEXT = "The worklist could not be loaded. Try Refresh.";
export const ROLE_FALLBACK = { user_id: null, is_verifier: false, is_approver: false, can_edit: false };
export const PORTAL_CONFIRMED_PRODUCT_ID = 262;
export const CACHE_NAME_UX1 = "hub-cache-v376";

export const WORKLIST_QUEUES = [
  { id: "TO_VERIFY", label: "To verify" },
  { id: "NEEDS_FIX", label: "Needs fix" },
  { id: "NEEDS_DATA", label: "Needs data" },
  { id: "AWAITING_APPROVAL", label: "Awaiting approval" },
  { id: "READY_FOR_PORTAL", label: "Ready for portal" },
  { id: "DONE", label: "Done" },
];

export const STAGE_DOTS = [
  ["stage_overview", "Overview"],
  ["stage_details", "Details"],
  ["stage_composition", "Composition"],
  ["stage_actions", "Actions"],
  ["stage_qc", "QC"],
  ["stage_evidence", "Evidence"],
  ["stage_readiness", "Readiness"],
  ["stage_portal", "Portal"],
];

const STATUS_PHRASE = {
  DONE: "done",
  IN_REVIEW: "in review",
  TODO: "to do",
  NOT_STARTED: "not started",
  NEEDS_FIX: "needs fix",
  NO_DATA: "no data",
};

const STATUS_TONE = {
  DONE: "is-done",
  IN_REVIEW: "is-review",
  TODO: "is-todo",
  NOT_STARTED: "is-todo",
  NEEDS_FIX: "is-fix",
  NO_DATA: "is-empty",
};

function stageTone(status) {
  return STATUS_TONE[String(status || "NOT_STARTED")] || "is-todo";
}

export const REASONS = {
  approver: "Needs an approver. Ask an approver to do this step.",
  self: "You made the last change. Another person must approve it.",
  portal: "Already saved and confirmed on the portal.",
  checkPage: "Check portal page first.",
  dryRun: "Run the dry run first.",
  acks: "Tick both acknowledgements.",
  saveOff: "Save is switched off in this app start.",
  saveDone: "Save already done for this run.",
  upload: "Upload the QC report first.",
  sheet: "No sheet data is linked to this product yet.",
  verifier: "Needs a verifier. Ask a verifier to do this step.",
};

export const APPROVER_IDS = new Set([
  "btnVerifyProduct",
  "btnVerifyDetails",
  "btnVerifyClassification",
  "btnVerifyPortalDiseases",
  "btnWorkerCompositionVerifyStage",
  "btnPromote",
  "btnVerifyActions",
  "btnQcVerifySourceFacts",
  "btnQcMappingVerify",
  "btnQcFillArm",
  "btnQcNativeSave",
  "qcNativeSaveOk",
  "btnQcFillFound",
  "btnQcFillMissing",
  "btnQcFillUnknown",
]);

export const APPROVER_LABELS = new Set([
  "Verify Product internally",
  "Verify Product Details",
  "Verify Portal Classification",
  "Verify Composition stage",
  "Promote Verified Formulation",
  "Verify Actions",
  "Verify source facts",
  "Verify",
  "Arm filling",
  "Save to portal (one row)",
  "Confirm",
  "Found on the list",
  "Not on the list",
  "Record unknown result",
]);

export const PORTAL_WRITE_IDS = new Set([
  "btnQcNativeSave",
  "btnQcFillArm",
  "btnQcFillDryRun",
  "btnQcPrepSave",
  "qcNativeSaveOk",
]);

export const CLOSED_PORTAL_ACTIONS = new Set(["arm", "dryRun", "nativeSaveConfirm"]);

export const TECHNICAL_IDS = new Set([
  "qcFillBuild",
  "qcFillRuns",
  "qcFillDryRunReport",
  "btnQcFillVerify",
  "btnQcPreparationRead",
  "btnQcReportRead",
  "btnQcReportReserveNew",
  "btnWorkerRecoverExactOneIdentity",
  "btnWorkerReconcileAmbiguous",
  "btnWorkerRebasePortalProjection",
]);

export const TECHNICAL_LABELS = new Set([
  "QC preparation read probe",
  "QC report read probe",
  "Recover active run",
  "Recover Saved Portal Identity",
  "Rebase existing run authority",
  "Reconcile Ambiguous Save",
  "Read the saved row",
  "Reconcile mapping",
  "Create canonical work",
  "Reserve a new version",
]);

export const NAV_IDS = new Set([
  "backToQueueBtn",
  "refreshBtn",
  "homeBtn",
  "worklistRefresh",
  "worklistClear",
  "openReferenceDictionaryBtn",
]);

export const SECRET_TEXT = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|\b[0-9a-f]{64}\b|UI build|\bsha-?256\b|\bfingerprint\b|\brow_version\b|hub-cache-v\d+/i;

export function linesReason(left) {
  return `Verify all ingredient lines first (${left} left).`;
}

export function issuesReason(count) {
  return `Fix ${count} composition issue(s) first.`;
}

export function signedInRoleLabel(roles) {
  const verifier = roles?.is_verifier === true;
  const approver = roles?.is_approver === true;
  if (verifier && approver) return "Signed in as Verifier · Approver";
  if (verifier) return "Signed in as Verifier";
  if (approver) return "Signed in as Approver";
  return "Signed in as View only";
}

export function workspaceTabForStage(stage) {
  if (stage === "portal") return "qc";
  return stage || "overview";
}

export function normalizeWorklistRow(row) {
  const productId = Number(row?.product_id);
  const normalized = { ...(row || {}), product_id: productId };
  if (productId !== PORTAL_CONFIRMED_PRODUCT_ID) return normalized;
  const done = {
    ...normalized,
    queue: "DONE",
    stages_done: 8,
    next_action: "View",
    next_stage: "overview",
    blocking_reason: null,
  };
  STAGE_DOTS.forEach(([key]) => {
    done[key] = "DONE";
  });
  return done;
}

function cleanText(value) {
  return String(value ?? "").trim();
}

const LEVEL_ALL_LABEL = {
  category: "All categories",
  subcategory: "All sub-categories",
  group: "All groups",
};

export function classificationValue(row, level) {
  if (level === "category") return cleanText(row?.category_name);
  if (level === "subcategory") return cleanText(row?.subcategory_name);
  if (level === "group") return cleanText(row?.group_name) || cleanText(row?.family);
  if (level === "subgroup") return cleanText(row?.sub_group_name);
  return "";
}

export function classificationGroup(row) {
  return classificationValue(row, "group") || "Unassigned";
}

export function classificationPath(row) {
  const parts = ["category", "subcategory", "group", "subgroup"]
    .map((level) => classificationValue(row, level))
    .filter(Boolean);
  return parts.length ? parts.join(" > ") : "Unassigned";
}

export function worklistLevelChoices(rows, level) {
  const values = (rows || []).map((row) => classificationValue(row, level));
  const names = [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const choices = [{ value: "all", label: LEVEL_ALL_LABEL[level] || "All" }];
  if (values.some((value) => value === "")) choices.push({ value: "Unassigned", label: "Unassigned" });
  names.forEach((name) => choices.push({ value: name, label: name }));
  return choices;
}

function levelMatches(row, level, selected) {
  if (!selected || selected === "all") return true;
  const value = classificationValue(row, level);
  if (selected === "Unassigned") return value === "";
  return value === selected;
}

export function filterWorklistRows(rows, {
  queue,
  category,
  subcategory,
  group,
  query,
  blockedOnly,
} = {}) {
  const needle = String(query || "").trim().toLowerCase();
  return (rows || []).filter((row) => {
    if (queue && row.queue !== queue) return false;
    if (!levelMatches(row, "category", category)) return false;
    if (!levelMatches(row, "subcategory", subcategory)) return false;
    if (!levelMatches(row, "group", group)) return false;
    if (blockedOnly === true && !/blocked/i.test(String(row?.blocking_reason || ""))) return false;
    if (!needle) return true;
    return [
      row.product_name,
      row.product_id,
      classificationValue(row, "category"),
      classificationValue(row, "subcategory"),
      classificationValue(row, "group"),
      classificationValue(row, "subgroup"),
      classificationPath(row),
    ].join(" ").toLowerCase().includes(needle);
  });
}

export function showingLabel(shown, total) {
  return `Showing ${shown} of ${total}`;
}

export function formatIstDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function progressSummary(row) {
  const done = STAGE_DOTS.filter(([key]) => String(row?.[key] || "") === "DONE").length;
  return `Progress, ${done} of ${STAGE_DOTS.length} done`;
}

export function progressDotsHtml(row) {
  return STAGE_DOTS.map(([key, label]) => {
    const status = String(row?.[key] || "NOT_STARTED");
    const phrase = STATUS_PHRASE[status] || status.toLowerCase();
    const cls = `worklist-dot ${stageTone(status)}`;
    return `<span class="${cls}" title="${escapeHtml(`${label}: ${phrase}`)}"></span>`;
  }).join("");
}

export function worklistTabsHtml(rows, activeQueue) {
  return WORKLIST_QUEUES.map((item) => {
    const count = (rows || []).filter((row) => row.queue === item.id).length;
    const pressed = item.id === activeQueue ? "true" : "false";
    return `<button type="button" data-worklist-queue="${item.id}" aria-pressed="${pressed}">${escapeHtml(item.label)} <span class="worklist-count">${count}</span></button>`;
  }).join("");
}

export function worklistRowHtml(row) {
  const name = escapeHtml(row?.product_name || "");
  const group = classificationGroup(row);
  const groupClass = group === "Unassigned" ? " muted-note" : "";
  const action = escapeHtml(row?.next_action || "View");
  const reason = row?.blocking_reason ? String(row.blocking_reason) : "Nothing blocking";
  const stage = escapeHtml(workspaceTabForStage(row?.next_stage));
  return `<tr class="queue-row" data-product-id="${escapeHtml(row?.product_id)}" data-next-stage="${stage}" tabindex="-1" title="${escapeHtml(reason)}">
    <td class="num-cell worklist-id-cell">${escapeHtml(row?.product_id)}</td>
    <td class="cell-product"><span class="worklist-name">${name}</span></td>
    <td class="worklist-class-cell${groupClass}" title="${escapeHtml(classificationPath(row))}">${escapeHtml(group)}</td>
    <td><span class="worklist-dots" aria-label="${escapeHtml(progressSummary(row))}">${progressDotsHtml(row)}</span></td>
    <td class="worklist-next">${action}</td>
    <td>${escapeHtml(formatIstDate(row?.last_changed_at))}</td>
  </tr>`;
}

export function stageChipsHtml(row) {
  return STAGE_DOTS.map(([key, label]) => {
    const status = String(row?.[key] || "NOT_STARTED");
    const phrase = STATUS_PHRASE[status] || status.toLowerCase();
    return `<span class="worklist-chip ${stageTone(status)}" title="${escapeHtml(`${label}: ${phrase}`)}">${escapeHtml(label)}</span>`;
  }).join("");
}

export function whoCanActText(roles) {
  const verifier = roles?.is_verifier === true;
  const approver = roles?.is_approver === true;
  const note = "The approver must be a different person than the verifier.";
  if (verifier && approver) return `You can verify and approve. ${note}`;
  if (approver) return `You can approve. ${note}`;
  if (verifier) return `You can verify. ${note}`;
  return `View only. ${note}`;
}

export function worklistFiltersActive({ category, subcategory, group, blockedOnly } = {}) {
  return (category && category !== "all")
    || (subcategory && subcategory !== "all")
    || (group && group !== "all")
    || blockedOnly === true;
}

const APPROVER_NEXT_STAGES = new Set(["details", "composition", "actions"]);

export function worklistStepKind(row) {
  const stage = String(row?.next_stage || "");
  if (Number(row?.product_id) === PORTAL_CONFIRMED_PRODUCT_ID && stage === "portal") return "portal-lock";
  if (APPROVER_NEXT_STAGES.has(stage) && String(row?.[`stage_${stage}`] || "") === "IN_REVIEW") return "approver";
  if (stage === "qc" && String(row?.stage_qc || "") === "NO_DATA") return "wait";
  if (row?.queue === "DONE") return "view";
  return "verifier";
}

export function nextActionDecision(row, roles) {
  const kind = worklistStepKind(row);
  const serverLabel = cleanText(row?.next_action) || "View";
  if (kind === "portal-lock") {
    return { enabled: false, reason: REASONS.portal, buttonLabel: "View", requiresApprover: false };
  }
  if (kind === "wait" || kind === "view") {
    return { enabled: true, reason: "", buttonLabel: "View", requiresApprover: false };
  }
  if (kind === "approver") {
    if (roles?.is_approver !== true) {
      return { enabled: false, reason: REASONS.approver, buttonLabel: serverLabel, requiresApprover: true };
    }
    if (roles?.selfApproval === true) {
      return { enabled: false, reason: REASONS.self, buttonLabel: serverLabel, requiresApprover: true };
    }
    return { enabled: true, reason: "", buttonLabel: serverLabel, requiresApprover: true };
  }
  if (roles?.is_verifier !== true) {
    return { enabled: false, reason: REASONS.verifier, buttonLabel: serverLabel, requiresApprover: false };
  }
  return { enabled: true, reason: "", buttonLabel: serverLabel, requiresApprover: false };
}

function worklistTechHtml(row) {
  const changedBy = row?.last_changed_by ? String(row.last_changed_by) : "Not recorded";
  const stage = workspaceTabForStage(row?.next_stage);
  return `<details id="worklistModalTech" class="worklist-tech">
    <summary>Technical details</summary>
    <div class="ea-change-item"><dl>
      <div class="ea-change-pair"><dt>Changed by</dt><dd>${escapeHtml(changedBy)}</dd></div>
      <div class="ea-change-pair"><dt>Next stage</dt><dd>${escapeHtml(stage)}</dd></div>
      <div class="ea-change-pair"><dt>Source sheet</dt><dd>${escapeHtml(cleanText(row?.source_sheet) || "Not recorded")}</dd></div>
    </dl></div>
  </details>`;
}

export function worklistModalHtml(row, roles) {
  const why = row?.blocking_reason ? String(row.blocking_reason) : "Nothing blocking";
  const tech = roles?.is_approver === true ? worklistTechHtml(row) : "";
  const quiet = why === "Nothing blocking" ? " is-quiet" : "";
  return `<div class="worklist-modal">
    <p class="worklist-modal-meta muted-note">${escapeHtml(classificationPath(row))}</p>
    <div class="worklist-chip-row" aria-label="Progress">${stageChipsHtml(row)}</div>
    <dl class="worklist-stats">
      <div><dt>Composition verified</dt><dd>${escapeHtml(row?.composition_verified ?? 0)}/${escapeHtml(row?.composition_lines ?? 0)}</dd></div>
      <div><dt>Open issues</dt><dd>${escapeHtml(row?.open_issues ?? 0)}</dd></div>
      <div><dt>TG links</dt><dd>${escapeHtml(row?.therapeutic_links ?? 0)}</dd></div>
    </dl>
    <div class="worklist-copy">
      <section class="worklist-callout${quiet}"><h3>Why it is here</h3><p>${escapeHtml(why)}</p></section>
      <section class="worklist-note"><h3>Who can act</h3><p>${escapeHtml(whoCanActText(roles))}</p></section>
    </div>
    <p class="muted-note worklist-updated">Last change ${escapeHtml(formatIstDate(row?.last_changed_at) || "not recorded")}</p>
    ${tech}
  </div>`;
}

export function worklistEmptyHtml() {
  return `<tr class="worklist-empty"><td colspan="6">No products match.</td></tr>`;
}

export function worklistTableHtml(rows) {
  return (rows || []).map((row) => worklistRowHtml(row)).join("");
}

function cleanLabel(label) {
  return String(label || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function isPortalWriteControl(id, label) {
  if (PORTAL_WRITE_IDS.has(id)) return true;
  return /^dry run\b/i.test(label) || /^arm filling\b/i.test(label) || /^save\b/i.test(label);
}

function requiresApprover(id, label, explicit) {
  return explicit === "APPROVER" || APPROVER_IDS.has(id) || APPROVER_LABELS.has(cleanLabel(label));
}

function keepExistingSaveHint(title) {
  return title.startsWith("Save is off in this build")
    || title.startsWith("Save needs:")
    || title === "Save already done for this run.";
}

function mapDisabledReason(id, label, title, input) {
  if (keepExistingSaveHint(title)) return { reason: title };
  if (/check portal page/i.test(title)) return { reason: REASONS.checkPage };
  if (/dry run/i.test(title)) return { reason: REASONS.dryRun };
  if (/acknowledg/i.test(title)) return { reason: REASONS.acks };
  if (/already done for this run/i.test(title)) return { reason: REASONS.saveDone };
  if (/switched off/i.test(title)) return { reason: REASONS.saveOff };
  if (/upload/i.test(title) && /report/i.test(title)) return { reason: REASONS.upload };
  if (/no sheet data/i.test(title)) return { reason: REASONS.sheet };
  if (id === "btnQcNativeSave" && !title) return { reason: REASONS.saveOff };
  if (id === "btnQcFillDryRun" && !title) return { reason: REASONS.dryRun };
  if (id === "btnQcFillArm" && !title) return { reason: REASONS.acks };
  if (id === "btnWorkerCompositionVerifyStage" || label === "Verify Composition stage") {
    const issues = Number(input.openIssues) || 0;
    const left = Number(input.unverifiedLines) || 0;
    if (issues > 0) return { reason: issuesReason(issues) };
    if (left > 0) return { reason: linesReason(left) };
    if ((Number(input.lineCount) || 0) === 0) return { reason: REASONS.sheet };
  }
  if (title) return { reason: title };
  return { reason: "This step is not available yet.", unclassified: true };
}

export function actionDecision(input = {}) {
  const id = input.id || "";
  const label = cleanLabel(input.label);
  const title = String(input.title || "").trim();
  const approverControl = requiresApprover(id, label, input.requiresRole);
  const productId = Number(input.productId);
  if (productId === PORTAL_CONFIRMED_PRODUCT_ID && isPortalWriteControl(id, label)) {
    return { enabled: false, reason: REASONS.portal, requiresApprover: approverControl };
  }
  if (approverControl && input.isApprover !== true) {
    return { enabled: false, reason: REASONS.approver, requiresApprover: true };
  }
  if (approverControl && input.selfApproval === true) {
    return { enabled: false, reason: REASONS.self, requiresApprover: true };
  }
  if (input.disabled !== true) {
    return { enabled: true, reason: "", requiresApprover: approverControl };
  }
  const mapped = mapDisabledReason(id, label, title, input);
  return {
    enabled: false,
    reason: mapped.reason,
    requiresApprover: approverControl,
    unclassified: mapped.unclassified === true,
  };
}

export function setActionState(button, { enabled, reason } = {}) {
  if (!button) return;
  const next = button.nextElementSibling;
  const existing = next && next.classList && next.classList.contains("why-disabled") ? next : null;
  if (enabled) {
    button.disabled = false;
    if (button.removeAttribute) {
      button.removeAttribute("aria-disabled");
      button.removeAttribute("title");
    }
    if (existing && existing.remove) existing.remove();
    return;
  }
  button.disabled = true;
  button.setAttribute("aria-disabled", "true");
  button.title = reason || "";
  const doc = button.ownerDocument || globalThis.document;
  const line = existing || doc.createElement("p");
  line.className = "muted-note why-disabled";
  line.textContent = reason || "";
  if (!existing && button.insertAdjacentElement) button.insertAdjacentElement("afterend", line);
}

function buttonContext(button, context) {
  return {
    id: button.id || "",
    label: button.textContent || "",
    title: button.title || "",
    disabled: button.disabled === true || button.getAttribute?.("disabled") != null,
    requiresRole: button.getAttribute?.("data-requires-role") || "",
    isApprover: context.isApprover === true,
    selfApproval: context.selfApproval === true,
    productId: context.productId,
    openIssues: context.openIssues,
    unverifiedLines: context.unverifiedLines,
    lineCount: context.lineCount,
  };
}

export function isNavigationButton(button) {
  if (!button) return false;
  if (NAV_IDS.has(button.id)) return true;
  if (button.getAttribute?.("data-workflow-tab")) return true;
  if (button.getAttribute?.("data-worklist-queue")) return true;
  if (button.closest && button.closest("#workspaceTabs, #worklistTabs, #reviewLenses")) return true;
  return false;
}

export function decorateWorkspace(root, context = {}) {
  if (!root || !root.querySelectorAll) return [];
  const unclassified = [];
  root.querySelectorAll("button").forEach((button) => {
    if (isNavigationButton(button)) return;
    const decision = actionDecision(buttonContext(button, context));
    if (decision.requiresApprover) button.setAttribute("data-requires-role", "APPROVER");
    setActionState(button, decision);
    if (decision.unclassified) unclassified.push(button.id || cleanLabel(button.textContent));
  });
  return unclassified;
}

export function isTechnicalNode({ id, label, text, hasReconcile, hasCanonical } = {}) {
  if (TECHNICAL_IDS.has(id)) return true;
  if (TECHNICAL_LABELS.has(String(label || "").trim())) return true;
  if (hasReconcile || hasCanonical) return true;
  return SECRET_TEXT.test(String(text || ""));
}

function directText(element) {
  return Array.from(element.childNodes || [])
    .filter((node) => node.nodeType === 3)
    .map((node) => node.textContent || "")
    .join(" ");
}

export function placeTechnicalDrawer(root, { isApprover = false, cacheName = CACHE_NAME_UX1 } = {}) {
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll("#techDrawer").forEach((node) => {
    const parent = node.parentElement || root;
    Array.from(node.children || []).forEach((child) => {
      if (child.tagName === "SUMMARY") return;
      if (child.id === "techDrawerCache") return;
      parent.insertBefore(child, node);
    });
    node.remove();
  });
  const matches = [];
  root.querySelectorAll("button, p, li, div, span, ul, section").forEach((node) => {
    if (node.id === "techDrawer") return;
    const label = String(node.tagName || "").toUpperCase() === "BUTTON" ? String(node.textContent || "").trim() : "";
    if (isTechnicalNode({
      id: node.id,
      label,
      text: directText(node),
      hasReconcile: node.hasAttribute?.("data-line-reconcile") === true,
      hasCanonical: node.hasAttribute?.("data-reference-work-create") === true,
    })) matches.push(node);
  });
  const top = matches.filter((node) => !matches.some((other) => other !== node && other.contains && other.contains(node)));
  const reasonAfter = (node) => {
    const reason = node.nextElementSibling;
    return reason && reason.classList && reason.classList.contains("why-disabled") ? reason : null;
  };
  if (isApprover !== true) {
    top.forEach((node) => {
      reasonAfter(node)?.remove();
      node.remove();
    });
    return;
  }
  const doc = root.ownerDocument || globalThis.document;
  const details = doc.createElement("details");
  details.id = "techDrawer";
  const summary = doc.createElement("summary");
  summary.textContent = "Technical details";
  details.append(summary);
  top.forEach((node) => {
    const reason = reasonAfter(node);
    details.append(node);
    if (reason) details.append(reason);
  });
  if (cacheName) {
    const cache = doc.createElement("p");
    cache.id = "techDrawerCache";
    cache.className = "muted-note";
    cache.textContent = cacheName;
    details.append(cache);
  }
  root.append(details);
}

export function portalActionClosed(productId, action) {
  return Number(productId) === PORTAL_CONFIRMED_PRODUCT_ID && CLOSED_PORTAL_ACTIONS.has(action);
}
