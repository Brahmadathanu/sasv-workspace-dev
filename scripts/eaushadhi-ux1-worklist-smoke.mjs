import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import {
  REASONS,
  WORKLIST_FALLBACK_TEXT,
  WORKLIST_QUEUES,
  actionDecision,
  decorateWorkspace,
  filterWorklistRows,
  issuesReason,
  linesReason,
  normalizeWorklistRow,
  placeTechnicalDrawer,
  progressDotsHtml,
  signedInRoleLabel,
  worklistFamilies,
  worklistRowHtml,
  worklistTabsHtml,
  workspaceTabForStage,
} from "../public/shared/js/eaushadhi-review-worklist.js";

const require = createRequire(import.meta.url);
const root = join(import.meta.dirname, "..");
const read = (path) => readFileSync(join(root, path), "utf8");
let failed = 0;
const check = (ok, label) => {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${label}`);
  } else {
    console.log(`OK ${label}`);
  }
};

const stage = (status) => ({
  stage_overview: status,
  stage_details: status,
  stage_composition: status,
  stage_actions: status,
  stage_qc: status,
  stage_evidence: status,
  stage_readiness: status,
  stage_portal: status,
});

const rawRows = [
  { product_id: 11, product_name: "Alpha Taila", family: "Taila", queue: "TO_VERIFY", ...stage("TODO"), next_action: "Start verification", next_stage: "overview", blocking_reason: "Sheet data is linked, but verification has not been started.", last_changed_at: "2026-10-24T06:30:00Z" },
  { product_id: 12, product_name: "Beta Churna", family: "Churna", queue: "NEEDS_FIX", ...stage("TODO"), stage_composition: "NEEDS_FIX", next_action: "Fix composition issues", next_stage: "composition", blocking_reason: "2 composition issue(s) need fixing.", last_changed_at: "2026-10-23T06:30:00Z" },
  { product_id: 13, product_name: "Gamma", family: "Taila", queue: "NEEDS_DATA", ...stage("NO_DATA"), next_action: "Add sheet data", next_stage: "overview", blocking_reason: "No sheet data is linked to this product yet.", last_changed_at: "2026-10-22T06:30:00Z" },
  { product_id: 14, product_name: "Delta Ghrita", family: "Ghrita", queue: "AWAITING_APPROVAL", ...stage("TODO"), stage_details: "IN_REVIEW", next_action: "Approve details", next_stage: "details", blocking_reason: null, last_changed_at: "2026-10-21T06:30:00Z" },
  { product_id: 15, product_name: "Epsilon", family: "Taila", queue: "READY_FOR_PORTAL", ...stage("DONE"), stage_portal: "NOT_STARTED", next_action: "Fill portal", next_stage: "portal", blocking_reason: null, last_changed_at: "2026-10-20T06:30:00Z" },
  { product_id: 262, product_name: "Karpooradi Thailam", family: "Taila", queue: "TO_VERIFY", ...stage("TODO"), next_action: "Verify details", next_stage: "details", blocking_reason: "Sheet data is linked, but verification has not been started.", last_changed_at: "2026-10-24T09:26:00Z" },
].map(normalizeWorklistRow);

check(WORKLIST_QUEUES.map((item) => item.label).join(" · ") === "To verify · Needs fix · Needs data · Awaiting approval · Ready for portal · Done", "queue tab order");
const tabs = worklistTabsHtml(rawRows, "TO_VERIFY");
check(tabs.includes('data-worklist-queue="TO_VERIFY"') && tabs.includes(">1<") && tabs.includes('data-worklist-queue="DONE"'), "queue tabs and counts from six rows");
check((tabs.match(/data-worklist-queue="/g) || []).length === 6, "six queue tabs");
const toVerify = filterWorklistRows(rawRows, { queue: "TO_VERIFY", family: "all", query: "" });
const done = filterWorklistRows(rawRows, { queue: "DONE", family: "all", query: "" });
check(toVerify.length === 1 && toVerify[0].product_id === 11, "To verify keeps the unfinished row");
check(done.length === 1 && done[0].product_id === 262, "Product 262 is in Done");

const families = worklistFamilies(rawRows);
check(families[0] === "Churna" && families.includes("Ghrita") && families.includes("Taila"), "families are sorted");
check(filterWorklistRows(rawRows, { queue: "TO_VERIFY", family: "Churna", query: "" }).length === 0, "family filter");
check(filterWorklistRows(rawRows, { family: "all", query: "beta" }).length === 1, "search by name");
check(filterWorklistRows(rawRows, { family: "all", query: "14" })[0].product_name === "Delta Ghrita", "search by id");

const dots = progressDotsHtml(rawRows.find((row) => row.product_id === 12));
check((dots.match(/worklist-dot/g) || []).length === 8, "eight dots");
check(dots.includes("is-fix") && dots.includes('title="Composition: needs fix"'), "needs-fix dot and tooltip");
check(dots.includes("is-todo"), "todo dot");
const doneDots = progressDotsHtml(done[0]);
check((doneDots.match(/is-done/g) || []).length === 8 && !doneDots.includes("is-todo"), "Product 262 has eight green dots");

const portalRow = worklistRowHtml(rawRows.find((row) => row.product_id === 15));
check(portalRow.includes('data-next-stage="qc"') && portalRow.includes(">Fill portal<"), "portal next step opens the QC tab");
const doneRow = worklistRowHtml(done[0]);
check(doneRow.includes(">View<") && doneRow.includes('data-next-stage="overview"'), "Done row button reads View");
check(workspaceTabForStage("portal") === "qc" && workspaceTabForStage("evidence") === "evidence", "stage mapping");

class TextNode {
  constructor(text) {
    this.nodeType = 3;
    this.textContent = text;
    this.parentElement = null;
  }
}
class MiniElement {
  constructor(doc, tag) {
    this.nodeType = 1;
    this.ownerDocument = doc;
    this.tagName = String(tag).toUpperCase();
    this.id = "";
    this.className = "";
    this.attrs = {};
    this.disabled = false;
    this.title = "";
    this.childNodes = [];
    this.children = [];
    this.parentElement = null;
  }
  sync() { this.children = this.childNodes.filter((node) => node.nodeType === 1); }
  get textContent() {
    return this.childNodes.map((node) => node.textContent || "").join("");
  }
  set textContent(value) {
    const text = new TextNode(String(value));
    text.parentElement = this;
    this.childNodes = [text];
    this.sync();
  }
  get nextElementSibling() {
    if (!this.parentElement) return null;
    const index = this.parentElement.children.indexOf(this);
    return index >= 0 ? this.parentElement.children[index + 1] || null : null;
  }
  get classList() {
    const self = this;
    return {
      contains(name) { return self.className.split(/\s+/).filter(Boolean).includes(name); },
    };
  }
  setAttribute(name, value) {
    if (name === "id") this.id = String(value);
    if (name === "class") this.className = String(value);
    if (name === "disabled") this.disabled = true;
    this.attrs[name] = String(value);
  }
  getAttribute(name) {
    if (name === "id") return this.id || null;
    return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
  }
  removeAttribute(name) {
    delete this.attrs[name];
    if (name === "title") this.title = "";
    if (name === "disabled") this.disabled = false;
  }
  hasAttribute(name) { return this.getAttribute(name) != null; }
  append(...nodes) {
    nodes.forEach((node) => {
      if (node.parentElement) node.remove();
      node.parentElement = this;
      this.childNodes.push(node);
    });
    this.sync();
  }
  insertBefore(node, before) {
    if (node.parentElement) node.remove();
    node.parentElement = this;
    const index = before ? this.childNodes.indexOf(before) : -1;
    if (index < 0) this.childNodes.push(node);
    else this.childNodes.splice(index, 0, node);
    this.sync();
  }
  insertAdjacentElement(where, node) {
    if (where === "afterend" && this.parentElement) {
      const index = this.parentElement.childNodes.indexOf(this);
      if (node.parentElement) node.remove();
      node.parentElement = this.parentElement;
      this.parentElement.childNodes.splice(index + 1, 0, node);
      this.parentElement.sync();
    }
    return node;
  }
  remove() {
    const parent = this.parentElement;
    if (!parent) return;
    parent.childNodes = parent.childNodes.filter((node) => node !== this);
    this.parentElement = null;
    parent.sync();
  }
  contains(node) {
    if (node === this) return true;
    return this.childNodes.some((child) => child.nodeType === 1 && child.contains(node));
  }
  querySelectorAll(selector) {
    const found = [];
    const visit = (node) => {
      node.children.forEach((child) => {
        if (matches(child, selector)) found.push(child);
        visit(child);
      });
    };
    visit(this);
    return found;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}
function matches(element, selector) {
  if (selector.startsWith("#")) return element.id === selector.slice(1);
  return selector.split(",").map((part) => part.trim().toUpperCase()).includes(element.tagName);
}
function createDoc() {
  return {
    createElement(tag) { return new MiniElement(this, tag); },
  };
}
function button(doc, id, label, { disabled = false, title = "" } = {}) {
  const node = doc.createElement("button");
  node.id = id;
  node.textContent = label;
  node.disabled = disabled;
  node.title = title;
  return node;
}

const doc = createDoc();
const verifierPanel = doc.createElement("div");
["btnVerifyProduct", "btnVerifyDetails", "btnVerifyClassification", "btnPromote", "btnVerifyActions", "btnQcMappingVerify", "btnQcFillArm", "btnQcNativeSave", "btnQcFillFound", "btnQcFillMissing", "btnQcFillUnknown"].forEach((id) => {
  verifierPanel.append(button(doc, id, {
    btnVerifyProduct: "Verify Product internally",
    btnVerifyDetails: "Verify Product Details",
    btnVerifyClassification: "Verify Portal Classification",
    btnPromote: "Promote Verified Formulation",
    btnVerifyActions: "Verify Actions",
    btnQcMappingVerify: "Verify",
    btnQcFillArm: "Arm filling",
    btnQcNativeSave: "Save to portal (one row)",
    btnQcFillFound: "Found on the list",
    btnQcFillMissing: "Not on the list",
    btnQcFillUnknown: "Record unknown result",
  }[id]));
});
decorateWorkspace(verifierPanel, { isApprover: false, selfApproval: false, productId: 11 });
const verifierButtons = verifierPanel.querySelectorAll("button");
check(verifierButtons.every((node) => node.disabled && node.getAttribute("data-requires-role") === "APPROVER"), "verifier approval buttons stay visible and disabled");
check(verifierButtons.every((node) => node.nextElementSibling && node.nextElementSibling.classList.contains("why-disabled") && node.nextElementSibling.textContent === REASONS.approver), "verifier reason is the approver sentence");

const selfPanel = doc.createElement("div");
selfPanel.append(button(doc, "btnVerifyDetails", "Verify Product Details"));
decorateWorkspace(selfPanel, { isApprover: true, selfApproval: true, productId: 11 });
check(selfPanel.querySelector("button").disabled && selfPanel.querySelector("button").nextElementSibling.textContent === REASONS.self, "self-approval reason");

const approverPanel = doc.createElement("div");
approverPanel.append(button(doc, "btnVerifyDetails", "Verify Product Details"));
approverPanel.append(button(doc, "btnQcFillDryRun", "Dry run (no Save)", { disabled: true, title: "Check portal page first." }));
decorateWorkspace(approverPanel, { isApprover: true, selfApproval: false, productId: 11 });
const approverVerify = approverPanel.querySelector("#btnVerifyDetails");
check(approverVerify.disabled !== true && approverVerify.getAttribute("data-requires-role") === "APPROVER" && !approverVerify.nextElementSibling?.classList.contains("why-disabled"), "approver button is enabled when the other conditions are met");
const dry = approverPanel.querySelector("#btnQcFillDryRun");
check(dry.disabled && dry.nextElementSibling.textContent === REASONS.checkPage, "check portal page reason");

const reasons = doc.createElement("div");
reasons.append(button(doc, "btnQcNativeSave", "Save to portal (one row)", { disabled: true, title: "" }));
reasons.append(button(doc, "btnQcFillArm", "Arm filling", { disabled: true, title: "Tick both acknowledgements." }));
reasons.append(button(doc, "btnUpload", "Upload", { disabled: true, title: "Upload the QC report first." }));
reasons.append(button(doc, "btnWorkerCompositionVerifyStage", "Verify Composition stage", { disabled: true }));
reasons.append(button(doc, "btnNav", "Overview"));
reasons.querySelector("#btnNav").setAttribute("data-workflow-tab", "overview");
const unclassified = decorateWorkspace(reasons, { isApprover: true, selfApproval: false, productId: 11, openIssues: 2, unverifiedLines: 3, lineCount: 4 });
check(reasons.querySelectorAll("button").filter((node) => node.id !== "btnNav" && node.disabled).every((node) => node.nextElementSibling && node.nextElementSibling.classList.contains("why-disabled") && node.nextElementSibling.textContent), "every disabled workspace button has a reason");
check(reasons.querySelector("#btnQcNativeSave").nextElementSibling.textContent === REASONS.saveOff, "save switched off sentence");
check(reasons.querySelector("#btnWorkerCompositionVerifyStage").nextElementSibling.textContent === issuesReason(2), "composition issue sentence");
check(linesReason(3) === "Verify all ingredient lines first (3 left).", "ingredient line sentence");
check(unclassified.length === 0, "the sample buttons were classified");
check(actionDecision({ id: "btnQcFillDryRun", label: "Dry run (no Save)", disabled: true, title: "Run the dry run first.", isApprover: true }).reason === REASONS.dryRun, "dry run sentence");
check(actionDecision({ id: "btnQcNativeSave", label: "Save to portal (one row)", disabled: true, title: "Save already done for this run.", isApprover: true }).reason === REASONS.saveDone, "save already done sentence");
check(signedInRoleLabel({ is_verifier: true, is_approver: true }) === "Signed in as Verifier · Approver", "both roles");
check(signedInRoleLabel({ is_verifier: false, is_approver: false }) === "Signed in as View only", "view only");

function technicalPanel(approver) {
  const panel = doc.createElement("section");
  const build = doc.createElement("p");
  build.id = "qcFillBuild";
  build.textContent = "UI build UX-1";
  const run = doc.createElement("p");
  run.textContent = "run fc0cd11f-f844-4f2b-a225-070321849788 sha256 " + "a".repeat(64);
  const probe = button(doc, "btnQcPreparationRead", "QC preparation read probe");
  const recover = button(doc, "btnWorkerRecoverExactOneIdentity", "Recover Saved Portal Identity");
  const visible = button(doc, "btnVerifyDetails", "Verify Product Details");
  panel.append(build, run, probe, recover, visible);
  placeTechnicalDrawer(panel, { isApprover: approver, cacheName: "hub-cache-v374" });
  return panel;
}
const verifierTech = technicalPanel(false);
const approverTech = technicalPanel(true);
check(!verifierTech.querySelector("#techDrawer") && !verifierTech.textContent.includes("UI build") && !/fc0cd11f/.test(verifierTech.textContent), "drawer and internals are absent for a verifier");
const drawer = approverTech.querySelector("#techDrawer");
check(!!drawer && drawer.querySelector("summary").textContent === "Technical details", "drawer is present for an approver");
const outside = approverTech.childNodes.filter((node) => node.id !== "techDrawer").map((node) => node.textContent || "").join(" ");
check(!/UI build|[0-9a-f]{8}-[0-9a-f]{4}-|sha256|hub-cache-v374/.test(outside) && /UI build UX-1/.test(drawer.textContent) && /hub-cache-v374/.test(drawer.textContent), "no UUID, SHA, or UI build outside the drawer");
check(approverTech.querySelector("#btnVerifyDetails") && !drawer.textContent.includes("Verify Product Details"), "ordinary actions stay outside the drawer");

const closed = doc.createElement("div");
closed.append(button(doc, "btnQcNativeSave", "Save to portal (one row)"));
closed.append(button(doc, "btnQcFillArm", "Arm filling"));
closed.append(button(doc, "btnQcFillDryRun", "Dry run (no Save)"));
closed.append(button(doc, "btnQcPrepSave", "Save draft"));
decorateWorkspace(closed, { isApprover: true, selfApproval: false, productId: 262 });
check(closed.querySelectorAll("button").every((node) => node.disabled && node.nextElementSibling.textContent === REASONS.portal), "Product 262 save, arm, and dry run stay off");

const html = read("public/shared/e-aushadhi-review-control.html");
const control = read("public/shared/js/eaushadhi-review-control.js");
const api = read("public/shared/js/eaushadhi-review-api.js");
const sw = read("public/sw.js");
const client = read("public/shared/js/eaushadhi-review-worker-client.js");
const contract = read("electron/eaushadhi-worker/qc-register-portal-contract.js");
const executor = read("electron/eaushadhi-worker/qc-prep-run-executor.js");
check(html.includes(WORKLIST_FALLBACK_TEXT) && html.includes('id="worklistRefresh"'), "error fallback banner and Refresh");
check(api.includes("fetchWorklist") && api.includes("rpc_eaushadhi_worklist_v1") && api.includes("fetchMyRoles") && api.includes("rpc_eaushadhi_my_roles_v1"), "worklist and roles fetches");
check(/const CACHE_NAME = "hub-cache-v374"/.test(sw) && sw.includes("// WP-07 UX-1 worklist, roles, why-disabled"), "cache v374");
check(control.includes("UI build UX-1") && control.includes('data-build="UX-1"') && control.includes("createDocumentFragment"), "marker UX-1 and one fragment");
check(/const NATIVE_SAVE_AUTHORIZED = false/.test(contract), "build flag stays off");
check(executor.includes("ALREADY_CLICKED") && control.includes('typed.value === "SAVE 262"'), "SAVE phrase and ALREADY_CLICKED remain");
check(contract.includes('selector: "#save_btn"') && !executor.includes("submitProduct"), "no Submit selector");
check(client.includes('command?.action') && client.includes("Already saved and confirmed on the portal."), "product 262 does not call arm or save");

if (failed) {
  console.error(`UX-1 smoke failed ${failed}`);
  process.exit(1);
}
console.log("UX-1 smoke passed");
