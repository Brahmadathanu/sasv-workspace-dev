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
  nextActionDecision,
  normalizeWorklistRow,
  placeTechnicalDrawer,
  progressDotsHtml,
  signedInRoleLabel,
  whoCanActText,
  worklistEmptyHtml,
  classificationGroup,
  classificationPath,
  worklistLevelChoices,
  worklistModalHtml,
  worklistRowHtml,
  worklistTabsHtml,
  workspaceTabForStage,
} from "../public/shared/js/eaushadhi-review-worklist.js";
import { nextQueueRenderCount, resetQueueRenderCount } from "../public/shared/js/eaushadhi-review-helpers.js";

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
const toVerify = filterWorklistRows(rawRows, { queue: "TO_VERIFY", group: "all", query: "" });
const done = filterWorklistRows(rawRows, { queue: "DONE", group: "all", query: "" });
check(toVerify.length === 1 && toVerify[0].product_id === 11, "To verify keeps the unfinished row");
check(done.length === 1 && done[0].product_id === 262, "Product 262 is in Done");

const groups = worklistLevelChoices(rawRows, "group");
check(groups[1]?.value === "Churna" && groups.some((choice) => choice.value === "Ghrita") && groups.some((choice) => choice.value === "Taila"), "groups are sorted");
check(filterWorklistRows(rawRows, { queue: "TO_VERIFY", group: "Churna", query: "" }).length === 0, "group filter");
check(filterWorklistRows(rawRows, { group: "all", query: "beta" }).length === 1, "search by name");
check(filterWorklistRows(rawRows, { group: "all", query: "14" })[0].product_name === "Delta Ghrita", "search by id");

const dots = progressDotsHtml(rawRows.find((row) => row.product_id === 12));
check((dots.match(/worklist-dot/g) || []).length === 8, "eight dots");
check(dots.includes("is-fix") && dots.includes('title="Composition: needs fix"'), "needs-fix dot and tooltip");
check(dots.includes("is-todo"), "todo dot");
const doneDots = progressDotsHtml(done[0]);
check((doneDots.match(/is-done/g) || []).length === 8 && !doneDots.includes("is-todo"), "Product 262 has eight green dots");

const portalRow = worklistRowHtml(rawRows.find((row) => row.product_id === 15));
check(portalRow.includes('data-next-stage="qc"') && portalRow.includes(">Fill portal<") && !portalRow.includes("<button"), "portal next step is plain text for the QC tab");
check(portalRow.indexOf(">15<") >= 0 && portalRow.indexOf(">15<") < portalRow.indexOf("Epsilon") && !portalRow.includes(" · "), "id is its own column before the product name");
const doneRow = worklistRowHtml(done[0]);
check(doneRow.includes(">View<") && doneRow.includes('data-next-stage="overview"') && doneRow.includes('class="queue-row"'), "Done row reads View on one queue row");
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

const portalSelf = doc.createElement("div");
portalSelf.append(button(doc, "btnQcNativeSave", "Save to portal (one row)"));
portalSelf.append(button(doc, "btnVerifyPortalDiseases", "Accept & Verify Portal Text"));
decorateWorkspace(portalSelf, { isApprover: true, selfApproval: true, productId: 11 });
check(portalSelf.querySelector("#btnQcNativeSave").disabled !== true, "portal save stays available to the same person");
check(portalSelf.querySelector("#btnVerifyPortalDiseases").disabled !== true, "portal text stays available to the same person");

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
  placeTechnicalDrawer(panel, { isApprover: approver, cacheName: "hub-cache-v375" });
  return panel;
}
const verifierTech = technicalPanel(false);
const approverTech = technicalPanel(true);
check(!verifierTech.querySelector("#techDrawer") && !verifierTech.textContent.includes("UI build") && !/fc0cd11f/.test(verifierTech.textContent), "drawer and internals are absent for a verifier");
const drawer = approverTech.querySelector("#techDrawer");
check(!!drawer && drawer.querySelector("summary").textContent === "Technical details", "drawer is present for an approver");
const outside = approverTech.childNodes.filter((node) => node.id !== "techDrawer").map((node) => node.textContent || "").join(" ");
check(!/UI build|[0-9a-f]{8}-[0-9a-f]{4}-|sha256|hub-cache-v375/.test(outside) && /UI build UX-1/.test(drawer.textContent) && /hub-cache-v375/.test(drawer.textContent), "no UUID, SHA, or UI build outside the drawer");
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
check(/const CACHE_NAME = "hub-cache-v376"/.test(sw) && sw.includes("// WP-07 UX-1.2 classification filters"), "cache v376");
check(control.includes("UI build UX-1") && control.includes('data-build="UX-1"') && control.includes("createDocumentFragment"), "marker UX-1 and one fragment");
check(/const NATIVE_SAVE_AUTHORIZED = false/.test(contract), "build flag stays off");
check(executor.includes("ALREADY_CLICKED") && control.includes('typed.value === "SAVE 262"'), "SAVE phrase and ALREADY_CLICKED remain");
check(contract.includes('selector: "#save_btn"') && !executor.includes("submitProduct"), "no Submit selector");
check(client.includes('command?.action') && client.includes("Already saved and confirmed on the portal."), "product 262 does not call arm or save");

const queueCss = read("public/shared/css/sasv-eaushadhi-review.css");
check(queueCss.includes("#queueTableWrap[hidden]") && queueCss.includes("display: none !important"), "hidden legacy queue is display none");
const many = Array.from({ length: 438 }, (_, index) => normalizeWorklistRow({
  product_id: index + 1,
  product_name: `Bulk ${index + 1}`,
  family: index % 2 ? "Taila" : "",
  queue: "TO_VERIFY",
  ...stage("TODO"),
  next_action: "Start verification",
  next_stage: "overview",
  blocking_reason: index % 10 === 0 ? "This product is blocked in the product register." : null,
}));
check(resetQueueRenderCount(many.length) === 40, "first render is 40 rows of 438");
check(nextQueueRenderCount(40, 438) === 80, "scroll-near-bottom appends 40 more");
check(resetQueueRenderCount(filterWorklistRows(many, { queue: "TO_VERIFY", group: "Taila" }).length) === 40, "filter change resets to 40");
check(resetQueueRenderCount(440) === 40, "a 440-row queue also starts at 40");
check(control.includes("openWorklistModal(row.dataset.productId)") && control.includes('if (event.key === "Enter")'), "row click and Enter open the modal");
check(control.includes("primary.textContent = decision.buttonLabel || \"View\"") && control.includes('if (event.key === "Escape")'), "modal primary label comes from the step decision and Escape closes");
const modal = worklistModalHtml(rawRows[3], { is_verifier: true, is_approver: false });
check(modal.includes("Why it is here") && modal.includes("Approve details") === false && !modal.includes("worklistModalTech"), "modal keeps the reason and hides technical details from a verifier");
const approverModal = worklistModalHtml(rawRows[3], { is_approver: true });
check(approverModal.includes('<details id="worklistModalTech"') && !approverModal.includes("<button") && !control.includes("worklistModalOpen") && !control.includes("worklistCount"), "technical details stay inside the row window and the extra openers and count are gone");
check(nextActionDecision(rawRows[3], { is_approver: false }).reason === REASONS.approver, "approve next step stays disabled without an approver");
check(whoCanActText(roleSample("Verify details", "details", "TODO"), { is_verifier: true, is_approver: true }).includes("different approver"), "a verifier step says a different approver approves later");
const home = html.slice(html.indexOf('id="worklistHome"'), html.indexOf('id="legacyQueueControls"'));
const toolbar = home.slice(home.indexOf("worklist-toolbar"), home.indexOf('id="worklistFilterDrawer"'));
const card = toolbar.slice(toolbar.indexOf("worklist-search-card"));
check(card.indexOf('id="worklistFilterBtn"') >= 0 && card.indexOf('id="worklistFilterBtn"') < card.indexOf('id="worklistSearch"'), "filter button sits inside the search card, left of search");
check(toolbar.includes('aria-label="Filters"') && !/>\s*Filters\s*</.test(toolbar) && !toolbar.includes("worklistCategory"), "filter button is icon-only and classification filters are not on the home row");
check(home.includes(">Classification<") && home.includes('id="worklistCategory"') && home.includes('id="worklistSubcategory"') && home.includes('id="worklistGroup"') && home.includes("Only blocked") && !home.includes("worklistFamily") && !home.includes("Medicine class"), "drawer has Category, Sub-category, Group, and Only blocked");
const emptyRow = rawRows.find((row) => row.product_id === 13);
const emptyDots = progressDotsHtml(emptyRow);
const emptyModal = worklistModalHtml(emptyRow, { is_approver: false });
check((emptyDots.match(/is-empty/g) || []).length === 8, "no-data dots stay hollow");
check((emptyModal.match(/worklist-chip is-empty/g) || []).length === 8 && !emptyModal.includes("worklist-dot") && !emptyModal.includes("is-todo") && emptyModal.includes("worklist-modal-meta"), "modal pills carry the hollow colour and the family line is quiet text");
const portalModal = worklistModalHtml(rawRows.find((row) => row.product_id === 15), { is_approver: false });
check((portalModal.match(/worklist-chip is-done/g) || []).length === 7 && (portalModal.match(/worklist-chip is-todo/g) || []).length === 1, "modal pills match green and grey");
check(queueCss.includes(".worklist-chip-row") && queueCss.includes("flex-wrap: nowrap") && queueCss.includes("overflow-x: auto"), "eight status pills stay on one scrolling line");
check(worklistLevelChoices(many, "group").some((choice) => choice.label === "Unassigned"), "Group choices include Unassigned");
const classified = [
  { product_id: 31, product_name: "Path One", queue: "TO_VERIFY", category_name: "Classical", subcategory_name: "Taila", group_name: "Kalka", sub_group_name: "Sneha", family: "Kalka", source_sheet: "PROD ING - Kalka", ...stage("TODO") },
  { product_id: 32, product_name: "Path Two", queue: "TO_VERIFY", category_name: "Classical", subcategory_name: "Ghrita", group_name: "Sneha", sub_group_name: "", family: "Sneha", ...stage("TODO") },
  { product_id: 33, product_name: "Path Three", queue: "TO_VERIFY", category_name: "Proprietary", subcategory_name: "Taila", group_name: "Other", family: "Other", ...stage("TODO") },
  { product_id: 34, product_name: "Other queue", queue: "NEEDS_FIX", category_name: "Excluded", subcategory_name: "Taila", group_name: "Hidden", family: "Hidden", ...stage("TODO") },
  { product_id: 35, product_name: "Stale sheet", queue: "TO_VERIFY", family: "Taila", ...stage("TODO") },
  { product_id: 36, product_name: "Blank class", queue: "TO_VERIFY", category_name: "", family: "", ...stage("TODO") },
].map(normalizeWorklistRow);
const openQueue = classified.filter((row) => row.queue === "TO_VERIFY");
check(classificationGroup(classified[0]) === "Kalka" && classificationPath(classified[0]) === "Classical > Taila > Kalka > Sneha", "full path uses the four live fields");
check(classificationGroup(classified[4]) === "Taila" && classificationPath(classified[4]) === "Taila", "family is only the stale-server fallback");
check(classificationGroup(classified[5]) === "Unassigned" && classificationPath(classified[5]) === "Unassigned", "blank classification reads Unassigned");
const pathRow = worklistRowHtml(classified[0]);
check(pathRow.includes(">Kalka<") && pathRow.includes("Classical &gt; Taila &gt; Kalka &gt; Sneha") && !pathRow.includes("medicine_class"), "classification cell shows the group and the path tooltip");
const pathModal = worklistModalHtml(classified[0], { is_approver: false });
check(pathModal.includes("Classical &gt; Taila &gt; Kalka &gt; Sneha") && !pathModal.includes("No class") && !pathModal.includes("To verify") && !pathModal.includes("Source sheet"), "dialog line is the path only");
const sheetModal = worklistModalHtml(classified[0], { is_approver: true });
check(sheetModal.includes("Source sheet") && sheetModal.includes("PROD ING - Kalka"), "approver technical details show the source sheet");
const classical = openQueue.filter((row) => row.category_name === "Classical");
const taila = classical.filter((row) => row.subcategory_name === "Taila");
check(worklistLevelChoices(openQueue, "category").some((choice) => choice.value === "Classical") && worklistLevelChoices(openQueue, "category").every((choice) => choice.value !== "Excluded"), "category choices come from the open queue");
check(worklistLevelChoices(classical, "subcategory").some((choice) => choice.value === "Ghrita") && worklistLevelChoices(classical, "subcategory").every((choice) => choice.value !== "Other"), "sub-category choices narrow to the category");
check(worklistLevelChoices(taila, "group").some((choice) => choice.value === "Kalka") && worklistLevelChoices(taila, "group").every((choice) => choice.value !== "Sneha"), "group choices narrow to the sub-category");
check(filterWorklistRows(classified, { queue: "TO_VERIFY", category: "Classical", subcategory: "Taila", group: "Kalka" }).length === 1, "cascading filter keeps one product");
check(filterWorklistRows(classified, { queue: "TO_VERIFY", query: "ghrita" }).length === 1, "search matches a sub-category");
check(worklistLevelChoices([classified[5]], "category").some((choice) => choice.value === "Unassigned"), "blank category is Unassigned");
check(control.includes('$("worklistSearch")?.focus()'), "slash focuses the worklist search");
check(home.includes('class="worklist-filter-popover"') && control.includes("getBoundingClientRect"), "filter drawer opens beside the filter button");
check(queueCss.includes("white-space: nowrap") && queueCss.includes("height: 40px") && queueCss.includes("vertical-align: middle") && queueCss.includes("#worklistTabs.review-nav") && queueCss.includes("overflow: visible") && queueCss.includes("border-bottom: 0"), "rows stay centered and the line above the tabs is gone");
check(worklistRowHtml(rawRows[0]).includes('aria-label="Progress, 0 of 8 done"'), "progress summary for a new product");
check(worklistRowHtml(done[0]).includes('aria-label="Progress, 8 of 8 done"'), "progress summary for Product 262");
check(worklistEmptyHtml().includes("No products match.") && !worklistEmptyHtml().includes("queue-row"), "empty filter copy is not a product row");
check(home.includes('id="worklistFilteredCount"'), "quiet filtered count is in the toolbar");
check(control.includes("decision.buttonLabel || \"View\"") && control.includes("appendWorklistChunk({ force: true })") && control.includes('trapModalTab(event, "worklistFilterDrawer")') && control.includes('$("worklistCategory")?.focus()'), "keyboard chunk, filter focus trap, and button label");
const narrowCss = queueCss.slice(queueCss.indexOf("@media (max-width: 640px)"));
check(narrowCss.includes(".worklist-copy") && narrowCss.includes("grid-template-columns: 1fr;"), "dialog cards stack on a narrow window");

const rolePeople = {
  verifier: { is_verifier: true, is_approver: false },
  approver: { is_verifier: false, is_approver: true },
  both: { is_verifier: true, is_approver: true },
  view: { is_verifier: false, is_approver: false },
  self: { is_verifier: true, is_approver: true, selfApproval: true },
};
const roleSteps = [
  ["View", "overview", "DONE", "view", { queue: "DONE" }],
  ["Fix product record", "overview", "NEEDS_FIX", "verifier"],
  ["Add sheet data", "overview", "NO_DATA", "verifier"],
  ["Start verification", "overview", "TODO", "verifier"],
  ["Verify details", "details", "TODO", "verifier"],
  ["Approve details", "details", "IN_REVIEW", "approver"],
  ["Fix composition issues", "composition", "NEEDS_FIX", "verifier"],
  ["Verify composition", "composition", "TODO", "verifier"],
  ["Approve composition", "composition", "IN_REVIEW", "approver"],
  ["Verify actions", "actions", "TODO", "verifier"],
  ["Approve actions", "actions", "IN_REVIEW", "approver"],
  ["Wait for QC report", "qc", "NO_DATA", "wait"],
  ["Verify QC values", "qc", "TODO", "verifier"],
  ["Upload report", "evidence", "TODO", "verifier"],
  ["Fill portal", "portal", "NOT_STARTED", "verifier"],
];
function roleSample(label, nextStage, status, extra = {}) {
  const row = {
    product_id: 80,
    product_name: "Role sample",
    queue: "TO_VERIFY",
    ...stage("TODO"),
    next_action: label,
    next_stage: nextStage,
    ...extra,
  };
  row[`stage_${nextStage}`] = status;
  return row;
}
let roleMisses = 0;
roleSteps.forEach(([label, nextStage, status, kind, extra]) => {
  const row = roleSample(label, nextStage, status, extra);
  Object.entries(rolePeople).forEach(([person, roles]) => {
    const decision = nextActionDecision(row, roles);
    let enabled = false;
    let reason = "";
    let buttonLabel = label;
    if (kind === "view" || kind === "wait") {
      enabled = true;
      buttonLabel = "View";
    } else if (kind === "approver") {
      if (person === "self") reason = REASONS.self;
      else if (person === "approver" || person === "both") enabled = true;
      else reason = REASONS.approver;
    } else if (person === "verifier" || person === "both" || person === "self") {
      enabled = true;
    } else {
      reason = REASONS.verifier;
    }
    const card = whoCanActText(row, roles);
    const cardAgrees = decision.enabled ? card.length > 0 : card === decision.reason;
    if (decision.enabled !== enabled || decision.reason !== reason || decision.buttonLabel !== buttonLabel || !cardAgrees) {
      roleMisses += 1;
      console.error(`FAIL role ${label} / ${person}: enabled=${decision.enabled} reason=${decision.reason} button=${decision.buttonLabel} card=${card}`);
    }
  });
});
check(roleMisses === 0, "role matrix for verifier, approver, both, view-only, and self-changed");
const approveSample = roleSample("Approve details", "details", "IN_REVIEW");
const renamedApprove = roleSample("Send this upstairs", "details", "IN_REVIEW");
const approveVerifier = nextActionDecision(approveSample, rolePeople.verifier);
const renamedVerifier = nextActionDecision(renamedApprove, rolePeople.verifier);
check(approveVerifier.enabled === renamedVerifier.enabled && approveVerifier.reason === renamedVerifier.reason, "a renamed label does not change an approver decision");
const verifySample = roleSample("Verify details", "details", "TODO");
const renamedVerify = roleSample("Look at the record", "details", "TODO");
check(nextActionDecision(verifySample, rolePeople.self).enabled === true && nextActionDecision(renamedVerify, rolePeople.self).enabled === true && nextActionDecision(renamedVerify, rolePeople.view).reason === REASONS.verifier, "a renamed verifier step stays a verifier step");
const portal262 = roleSample("Fill portal", "portal", "NOT_STARTED", { product_id: 262, queue: "READY_FOR_PORTAL", ...stage("DONE"), stage_portal: "NOT_STARTED" });
check(nextActionDecision(portal262, rolePeople.both).reason === REASONS.portal && nextActionDecision({ ...portal262, next_action: "Ship it" }, rolePeople.both).reason === REASONS.portal, "Fill portal on Product 262 stays locked without reading the label");
const normalized262 = normalizeWorklistRow(portal262);
check(normalized262.queue === "DONE" && normalized262.next_action === "View" && nextActionDecision(normalized262, rolePeople.view).buttonLabel === "View" && workspaceTabForStage("portal") === "qc", "Product 262 opens as View and portal still maps to the qc tab");

if (failed) {
  console.error(`UX-1 smoke failed ${failed}`);
  process.exit(1);
}
console.log("UX-1 smoke passed");
