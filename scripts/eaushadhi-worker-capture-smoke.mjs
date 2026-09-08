/**
 * Local fixture smoke for read-only e-Aushadhi portal contract capture.
 * Does not contact the live portal and does not launch Microsoft Edge.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, readFileSync, readdirSync, existsSync } from "node:fs";
import os from "node:os";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = join(root, "scripts/fixtures/eaushadhi-portal");
const { parseHtml } = require(join(fixtureDir, "mini-dom.cjs"));
const { createEaushadhiWorker } = require(join(root, "electron/eaushadhi-worker/index.js"));
const { attachMockBrowserCdp } = require(join(fixtureDir, "mock-browser-cdp.cjs"));
const { STATES } = require(join(root, "electron/eaushadhi-worker/state.js"));
const { ERROR_KINDS, workerError } = require(join(root, "electron/eaushadhi-worker/errors.js"));
const { requireContract } = require(join(root, "electron/eaushadhi-worker/contracts/portal-contract.js"));
const { fingerprintsFor } = require(join(root, "electron/eaushadhi-worker/capture/fingerprint.js"));
const { isPlaceholderOption } = require(join(root, "electron/eaushadhi-worker/capture/index.js"));
const { isPathInsideRoot, capturesRoot } = require(join(root, "electron/eaushadhi-worker/capture/persist.js"));
const { CHANNELS } = require(join(root, "electron/eaushadhi-worker/ipc.js"));

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("OK", msg);
  }
}

const TOKEN = "a".repeat(24);
assert(isPlaceholderOption({ value: "-1", label: "--Select--" }), "-1/--Select-- is a placeholder");
assert(isPlaceholderOption({ value: "-1", label: "--Select Option--" }), "-1/--Select Option-- is a placeholder");
assert(isPlaceholderOption({ value: "0", label: "Select" }), "value=0 with Select remains a placeholder");
assert(isPlaceholderOption({ value: "", label: "Choose Option" }), "empty value with Choose Option is a placeholder");
assert(
  !isPlaceholderOption({ value: "-1", label: "Ayurveda Classical" }),
  "genuine -1 domain label is not a placeholder",
);
const loginHtml = readFileSync(join(fixtureDir, "login.html"), "utf8");
const authHtml = readFileSync(join(fixtureDir, "authenticated.html"), "utf8");
const ambiguousHtml = readFileSync(join(fixtureDir, "ambiguous.html"), "utf8");
const productHtml = readFileSync(join(fixtureDir, "product-form.html"), "utf8");
const legacyHtml = readFileSync(join(fixtureDir, "addproduct-legacy.html"), "utf8");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, timeoutMs = 1500) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return;
    await wait(15);
  }
  throw new Error("Timed out waiting for worker condition.");
}

function createMockPage(startUrl = "about:blank") {
  let currentUrl = startUrl;
  let document = parseHtml("<html></html>");
  const extraFrames = [];
  const listeners = {};
  let heldEvaluate = null;
  let closed = false;
  const mainFrame = {
    url() {
      return currentUrl;
    },
  };
  const page = {
    url: () => currentUrl,
    mainFrame: () => mainFrame,
    frames: () => [mainFrame, ...extraFrames],
    isClosed: () => closed,
    on(name, fn) {
      listeners[name] = listeners[name] || [];
      listeners[name].push(fn);
    },
    off(name, fn) {
      listeners[name] = (listeners[name] || []).filter((handler) => handler !== fn);
    },
    async close() {
      if (closed) return;
      closed = true;
      for (const handler of listeners.close || []) handler();
    },
    async goto(next) {
      currentUrl = next;
      for (const handler of listeners.framenavigated || []) handler(mainFrame);
      return null;
    },
    async navigateMainFrame(next) {
      currentUrl = next;
      for (const handler of listeners.framenavigated || []) handler(mainFrame);
    },
    setHtml(html, url) {
      document = parseHtml(html);
      if (url) currentUrl = url;
    },
    addChildFrame(url) {
      extraFrames.push({ url: () => url });
    },
    holdNextEvaluate() {
      heldEvaluate = {};
      heldEvaluate.promise = new Promise((resolve, reject) => {
        heldEvaluate.resolve = resolve;
        heldEvaluate.reject = reject;
      });
    },
    rejectHeldEvaluate(error) {
      if (heldEvaluate?.reject) heldEvaluate.reject(error);
    },
    async evaluate(fn, arg) {
      if (heldEvaluate) return heldEvaluate.promise;
      const prevDoc = global.document;
      const prevLoc = global.location;
      const prevCss = global.CSS;
      global.document = document;
      let pathname = "/";
      try {
        pathname = new URL(currentUrl).pathname || "/";
      } catch {
        pathname = "/";
      }
      global.location = { href: currentUrl, pathname };
      global.CSS = {
        escape(value) {
          return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
        },
      };
      try {
        return fn(arg);
      } finally {
        global.document = prevDoc;
        global.location = prevLoc;
        global.CSS = prevCss;
      }
    },
  };
  return page;
}

function createMockContext() {
  const pages = [];
  const listeners = {};
  let closed = false;
  const context = {
    pages() {
      return [...pages];
    },
    on(name, fn) {
      listeners[name] = listeners[name] || [];
      listeners[name].push(fn);
    },
    off(name, fn) {
      listeners[name] = (listeners[name] || []).filter((handler) => handler !== fn);
    },
    async newPage() {
      return openPage("about:blank");
    },
    async close() {
      closed = true;
    },
  };

  function openPage(url) {
    const page = createMockPage(url);
    pages.push(page);
    page.on("close", () => {
      const index = pages.indexOf(page);
      if (index >= 0) pages.splice(index, 1);
    });
    for (const handler of listeners.page || []) handler(page);
    return page;
  }

  const first = createMockPage("about:blank");
  pages.push(first);
  attachMockBrowserCdp(context, { getPages: () => pages.filter((page) => !page.isClosed()) });
  return {
    context,
    page: first,
    pages,
    isClosed: () => closed,
    addPage(url) {
      return openPage(url);
    },
  };
}

function makeWorker(tmp, options = {}) {
  const rpcCalls = [];
  const mock = createMockContext();
  const worker = createEaushadhiWorker({
    getUserDataPath: () => tmp,
    launchBrowser: async () => mock.context,
    callRpc: async (token, name, args) => {
      rpcCalls.push({ name, args, tokenLength: String(token || "").length });
      if (typeof options.callRpc === "function") return options.callRpc(token, name, args);
      if (name === "rpc_eaushadhi_require_permission") {
        assert(args?.p_edit === false, "permission RPC uses p_edit false");
        return null;
      }
      throw new Error(`unexpected rpc ${name}`);
    },
    requireContract: options.requireContract,
  });
  return { worker, mock, rpcCalls };
}

function readCapture(tmp) {
  const rootDir = join(tmp, "eaushadhi-contract-captures");
  const dirs = readdirSync(rootDir);
  assert(dirs.length >= 1, "capture directory was written");
  const json = JSON.parse(readFileSync(join(rootDir, dirs[dirs.length - 1], "capture.json"), "utf8"));
  return json;
}

function scanCaptureSources() {
  const dir = join(root, "electron/eaushadhi-worker/capture");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".js"))
    .map((name) => ({
      name,
      src: readFileSync(join(dir, name), "utf8"),
    }));
}

const forbiddenCall =
  /\.(?:click|fill|type|press|goto|selectOption|setInputFiles)\s*\(|locator\.(?:click|fill|type|press)\s*\(|\.request\.post\s*\(|form\.submit\s*\(|requestSubmit\s*\(|checkValidity\s*\(|reportValidity\s*\(|dispatchEvent\s*\(|\bfetch\s*\(|XMLHttpRequest/;

for (const file of scanCaptureSources()) {
  assert(!forbiddenCall.test(file.src), `${file.name} does not invoke mutating Playwright/DOM actions`);
  assert(!/screenshot|page\.png|\.jpeg/i.test(file.src), `${file.name} does not take screenshots`);
  if (file.name === "validation-evidence-in-page.js" || file.name === "validation-evidence.js") {
    assert(!/\.click\s*\(/.test(file.src), `${file.name} does not call click`);
    assert(!/selectedIndex\s*=(?!=)/.test(file.src), `${file.name} does not assign selectedIndex`);
  }
}
const idleTmp = mkdtempSync(join(os.tmpdir(), "ea-cap-idle-"));
const idle = makeWorker(idleTmp);
let idleKind = null;
try {
  await idle.worker.capturePortalContract(TOKEN);
} catch (error) {
  idleKind = error.kind;
}
assert(idleKind === ERROR_KINDS.CRASH, "21: capture from IDLE is rejected");

const loginTmp = mkdtempSync(join(os.tmpdir(), "ea-cap-login-"));
const login = makeWorker(loginTmp);
await login.worker.connect();
assert(login.worker.getStatus().state === STATES.AUTH_REQUIRED, "connect remains AUTH_REQUIRED");
login.mock.page.setHtml(loginHtml, "https://www.e-aushadhi.gov.in/Account/Login?secret=test-value#fragment");
const loginResult = await login.worker.capturePortalContract(TOKEN);
assert(loginResult.ok === true, "login capture returns ok");
assert(loginResult.auth_outcome === "AUTH_REQUIRED", "1: login fixture is AUTH_REQUIRED");
assert(login.worker.getStatus().state === STATES.AUTH_REQUIRED, "22: capture returns to AUTH_REQUIRED");
assert(login.rpcCalls.some((call) => call.name === "rpc_eaushadhi_require_permission"), "20: capture calls require_permission");
assert(!login.rpcCalls.some((call) => call.tokenLength < 16), "token is validated before RPC");
const loginJson = readCapture(loginTmp);
assert(loginJson.pages[0].path === "/Account/Login", "13: query/hash omitted from path");
assert(!JSON.stringify(loginJson).includes("secret-password"), "password values omitted");
assert(!JSON.stringify(loginJson).includes("123456"), "OTP values omitted");
assert(!JSON.stringify(loginJson).includes("hidden-csrf-token"), "11: hidden token values omitted");
assert(!JSON.stringify(loginJson).includes("should-not-capture"), "12: ordinary input values omitted");
assert(!JSON.stringify(loginJson).includes("test-value"), "13: query secret omitted");
assert(loginJson.mutated === false, "mutated is false");
assert(Array.isArray(loginJson.clicks_performed) && loginJson.clicks_performed.length === 0, "clicks_performed is empty");
assert(loginJson.worker_actions.goto === 0, "capture records no worker goto");

const unprovenTmp = mkdtempSync(join(os.tmpdir(), "ea-cap-unproven-"));
const unproven = makeWorker(unprovenTmp);
await unproven.worker.connect();
unproven.mock.page.setHtml(ambiguousHtml, "https://www.e-aushadhi.gov.in/Notice");
const unprovenResult = await unproven.worker.capturePortalContract(TOKEN);
assert(unprovenResult.auth_outcome === "AUTH_UNPROVEN", "3: ambiguous page is AUTH_UNPROVEN");

const authTmp = mkdtempSync(join(os.tmpdir(), "ea-cap-auth-"));
const authed = makeWorker(authTmp);
await authed.worker.connect();
authed.mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/admin/custom_dashboard1");
const authResult = await authed.worker.capturePortalContract(TOKEN);
assert(authResult.auth_outcome === "AUTHENTICATED_CANDIDATE", "2: authenticated fixture is AUTHENTICATED_CANDIDATE");
assert(authResult.auth_outcome !== "AUTH_REQUIRED", "Change Password nav is not AUTH_REQUIRED");

const legacyTmp = mkdtempSync(join(os.tmpdir(), "ea-cap-legacy-"));
const legacy = makeWorker(legacyTmp);
await legacy.worker.connect();
globalThis.__EA_CAPTURE_HANDLER_FIRED = false;
legacy.mock.page.setHtml(legacyHtml, "https://www.e-aushadhi.gov.in/admin/addproductforlegacy");
const legacyResult = await legacy.worker.capturePortalContract(TOKEN);
assert(legacyResult.auth_outcome === "AUTHENTICATED_CANDIDATE", "legacy authenticated page is AUTHENTICATED_CANDIDATE");
assert(globalThis.__EA_CAPTURE_HANDLER_FIRED !== true, "12: submit handler flags remain UNSET after capture");
const legacyJson = readCapture(legacyTmp);
assert(legacyJson.capture_schema_version === 1, "schema version remains 1");
const validation = legacyJson.classification_validation_evidence;
assert(validation && typeof validation === "object", "2: subtype validation evidence exists");
assert(validation.subtype_control?.control_found === true, "subtype control found");
assert(validation.subtype_control.selected_option_value === "-1", "3: selected_option_value survives redaction as -1");
assert(validation.subtype_control.selected_option_label === "--Select--", "4: selected_option_label survives");
assert(validation.subtype_control.required_property === true, "5: required_property is true");
assert(validation.subtype_control.required_attribute != null, "5: required_attribute present");
assert(String(validation.subtype_control.aria_required) === "true", "5: aria_required is true");
assert(validation.subtype_control.selected_index === 0, "6: selected_index is accurate");
assert(validation.subtype_control.will_validate === true, "7: will_validate is true");
assert(validation.subtype_control.validity && typeof validation.subtype_control.validity.valid === "boolean", "7: validity fields present");
assert(validation.subtype_control.validity.value_missing === false, "7: value_missing false for -1 selection");
assert(
  Array.isArray(validation.nearby_validation_elements) && validation.nearby_validation_elements.length <= 8,
  "9: nearby validation evidence is bounded",
);
const saveBtn = (validation.submit_controls || []).find((item) => item.id === "save_btn");
const saveRbtn = (validation.submit_controls || []).find((item) => item.id === "save_rbtn");
assert(saveBtn && saveBtn.control_found === true, "10: #save_btn observed");
assert(saveRbtn && saveRbtn.control_found === true, "10: #save_rbtn observed");
assert(saveBtn.activated === false && saveRbtn.activated === false, "11: activated remains false");
assert(saveBtn.onclick_property_is_function === true, "save_btn onclick property observed");
assert(typeof saveBtn.onclick_source_preview === "string" && saveBtn.onclick_source_preview.length <= 240, "handler preview bounded");
assert(typeof saveBtn.onclick_source_sha256 === "string" && saveBtn.onclick_source_sha256.length === 64, "Node-side handler sha256 present");
assert(
  (validation.script_matches || []).some(
    (match) =>
      match.source_kind === "inline" &&
      match.evidence_class === "subtype_validation_candidate" &&
      match.subtype_related === true &&
      match.direct_minus_one_comparison !== true,
  ),
  "A: generic subtype + required/valid context is subtype_validation_candidate only",
);
assert(
  (validation.script_matches || []).some(
    (match) => match.evidence_class === "unrelated_sentinel_candidate",
  ),
  "B: unrelated -1 classified separately",
);
assert(
  (validation.script_matches || []).some(
    (match) =>
      match.source_kind === "inline" &&
      (match.evidence_class === "subtype_minus_one_rejection_candidate" ||
        match.evidence_class === "explicit_subtype_minus_one_rejection_candidate") &&
      match.direct_minus_one_comparison === true,
  ),
  "C: direct subtype + -1 comparison produces rejection candidate evidence",
);
assert(validation.conclusion_inputs?.subtype_validation_candidate_observed === true, "subtype_validation_candidate_observed");
assert(
  validation.conclusion_inputs?.subtype_minus_one_rejection_candidate_observed === true,
  "subtype_minus_one_rejection_candidate_observed from direct comparison",
);
assert(
  validation.conclusion_inputs?.explicit_subtype_minus_one_rejection_observed === true,
  "explicit field true only when comparison + rejection messaging co-occur",
);
assert(
  !(
    validation.conclusion_inputs?.explicit_subtype_minus_one_rejection_observed === true &&
    validation.conclusion_inputs?.subtype_minus_one_rejection_candidate_observed !== true
  ),
  "explicit rejection implies candidate rejection",
);
assert(validation.conclusion_inputs?.evidence_complete === false, "evidence_complete remains false");
assert(!(JSON.stringify(validation).includes("blank_valid") || JSON.stringify(validation).includes("portal_accepts_blank")), "no blank_valid conclusion");
assert(
  (validation.script_matches || []).every(
    (match) => !match.context_snippet || match.context_snippet.length <= 160,
  ),
  "15: script snippets are bounded",
);
assert(
  (validation.script_matches || []).some(
    (match) => match.source_kind === "external_unresolved" && /product-validation\.js/.test(String(match.src_path || "")),
  ),
  "16: external script recorded unresolved without fetch",
);
assert(!JSON.stringify(legacyJson).includes("PLANTED_SECRET_TOKEN_SHOULD_NOT_PERSIST"), "17: planted secret does not survive capture");
assert(
  (validation.limitations || []).includes("external_script_bodies_not_fetched") &&
    (validation.limitations || []).includes("delegated_or_dynamic_listeners_not_enumerated") &&
    (validation.limitations || []).includes("checkValidity_and_reportValidity_not_called"),
  "limitations record unresolved enforcement surfaces",
);
assert(!JSON.stringify(legacyJson).includes("SYNTH_LICENSE_USER_999"), "synthetic profile identifier is absent");
assert(legacyJson.pages[0].buttons.some((btn) => btn.id === "profile" && btn.text == null), "profile chrome keeps id and drops display text");
assert(
  legacyJson.pages[0].anchors.some((anchor) => anchor.label === "Update Profile" || anchor.text === "Update Profile"),
  "generic Update Profile navigation label is retained",
);
const actionType = (legacyJson.pages[0].inputs || []).find((item) => item.id === "actiontype");
assert(actionType, "hidden actiontype is captured structurally");
assert(actionType.candidate_binding?.key !== "pharmacological_actions", "hidden #actiontype is not pharmacological_actions");
const indications = (legacyJson.pharmacological_actions || []).find((item) => item.select_id === "indications");
assert(indications, "select#indications is candidate pharmacological_actions");
assert(indications.multiple === true, "indications is multiple");
assert(indications.select2_linked === true, "indications Select2 linkage is recorded");
assert(
  indications.options.some((opt) => opt.value === "101" && opt.label === "Deepana"),
  "native indications option values remain captured",
);
assert(!JSON.stringify(legacyJson).includes("select2-indications-result-abcd-999"), "Select2 LI ids are not used as option values");
assert(legacyJson.pages[0].path === "/admin/addproductforlegacy", "legacy add-product path is recorded");
const categoryVocab = (legacyJson.vocabularies || []).find((item) => item.select_id === "categoryId");
assert(categoryVocab, "#categoryId is captured");
assert(categoryVocab.select2_linked === true, "#categoryId is Select2-backed");
assert(categoryVocab.options.some((opt) => opt.value === "-1" && opt.label === "--Select--"), "#categoryId placeholder option remains in evidence");
assert(categoryVocab.unresolved_async === true, "#categoryId placeholder-only is unresolved_async");
assert(categoryVocab.option_source === "unresolved-async", "#categoryId option_source is unresolved-async");
const subtypeVocab = (legacyJson.vocabularies || []).find((item) => item.select_id === "subTypeId");
assert(subtypeVocab, "#subTypeId is captured");
assert(subtypeVocab.select2_linked === true, "#subTypeId is Select2-backed");
assert(subtypeVocab.options.some((opt) => opt.value === "-1" && opt.label === "--Select--"), "#subTypeId placeholder option remains in evidence");
assert(subtypeVocab.unresolved_async === true, "#subTypeId placeholder-only is unresolved_async");
assert(subtypeVocab.option_source === "unresolved-async", "#subTypeId option_source is unresolved-async");
const typeVocab = (legacyJson.vocabularies || []).find((item) => item.select_id === "type");
assert(typeVocab?.options.some((opt) => opt.value === "-1" && opt.label === "Ayurveda Classical"), "genuine -1 domain value remains captured");
assert(typeVocab.unresolved_async !== true, "genuine -1 value is not treated as placeholder-only unresolved");
const countryVocab = (legacyJson.vocabularies || []).find((item) => item.select_id === "countryApplicable");
assert(countryVocab?.options.some((opt) => opt.value === "0" && opt.label === "--Select Option--"), "value=0 placeholder option remains in evidence");
assert(countryVocab.unresolved_async === true, "value=0 placeholder-only Select2 is unresolved_async");
assert(indications.unresolved_async === false, "populated #indications remains resolved");

const productTmp = mkdtempSync(join(os.tmpdir(), "ea-cap-product-"));
const product = makeWorker(productTmp);
await product.worker.connect();
product.mock.page.setHtml(productHtml, "https://www.e-aushadhi.gov.in/Product/AddUpdate");
product.mock.page.addChildFrame("https://example.com/embed?token=iframe-secret#frag");
const productResult = await product.worker.capturePortalContract(TOKEN);
assert(productResult.ok === true, "product capture ok");
const productJson = readCapture(productTmp);
assert(productJson.pages[0].child_frame_origins.includes("https://example.com"), "14: child-frame origin sanitized");
assert(!JSON.stringify(productJson).includes("iframe-secret"), "child-frame query omitted");
assert(!JSON.stringify(productJson).includes("select2-ddlActions-result-abcd-999"), "7: generated Select2 LI IDs ignored");
const actionVocab = productJson.pharmacological_actions.find((item) => item.select_id === "ddlActions");
assert(actionVocab, "6: pharmacological select discovered");
assert(actionVocab.multiple === true, "pharmacological select is multiple");
assert(actionVocab.select2_linked === true, "5: Select2 linkage recorded on underlying select");
assert(actionVocab.options.some((opt) => opt.value === "101" && opt.label === "Deepana"), "6: native action option values captured");
const nativePurpose = productJson.vocabularies.find((item) => item.select_id === "ddlPurpose");
assert(nativePurpose?.options.some((opt) => opt.value === "11"), "4: native select options captured");
const reference = productJson.reference.find((item) => item.select_id === "ddlReference");
assert(reference?.unresolved_async === true, "8: empty Select2 Reference is unresolved");
assert(productJson.composition_structure[0].tables.some((table) => table.id === "compositionTable"), "9: composition table structure captured");
assert(
  productJson.composition_structure[0].fields.some((field) => field.binding === "ingredient_type"),
  "composition ingredient type field identified",
);
assert(
  productJson.save_update_structure.some((item) => item.kind === "save" && item.activated === false),
  "10: Save identified but not activated",
);
assert(
  productJson.save_update_structure.some((item) => item.kind === "update" && item.activated === false),
  "10: Update identified but not activated",
);
assert(
  productJson.save_update_structure.some((item) => item.kind === "submit" && item.activated === false),
  "10: Submit identified but not activated",
);
assert(!JSON.stringify(productJson).includes("µL") && !JSON.stringify(productJson).includes("uL"), "µL is not invented");
assert(productJson.worker_state_before === STATES.AUTH_REQUIRED, "capture records prior AUTH_REQUIRED state");
assert(product.rpcCalls.every((call) => call.name === "rpc_eaushadhi_require_permission"), "26: no other Supabase RPC");

const again = fingerprintsFor(productJson);
assert(again.structure_sha256 === productJson.fingerprints.structure_sha256, "15: fingerprint is deterministic");
const drifted = structuredClone(productJson);
drifted.pages[0].inputs = drifted.pages[0].inputs.concat({ id: "extra", name: "extra", type: "text", tag: "input" });
assert(fingerprintsFor(drifted).structure_sha256 !== productJson.fingerprints.structure_sha256, "16: structure fingerprint changes on drift");
const optionDrift = structuredClone(productJson);
optionDrift.vocabularies[0].options = optionDrift.vocabularies[0].options.concat({
  value: "999",
  label: "extra",
});
assert(
  fingerprintsFor(optionDrift).option_sets_sha256 !== productJson.fingerprints.option_sets_sha256,
  "17: option fingerprint changes when option set changes",
);

const opened = [];
const folder = await product.worker.openLastCaptureFolder(TOKEN, {
  openPath: async (dir) => {
    opened.push(dir);
  },
});
assert(folder.ok === true, "open capture folder succeeds");
assert(opened.length === 1, "openPath received governed directory");
assert(isPathInsideRoot(opened[0], capturesRoot(productTmp)), "25: opened path stays in capture root");
assert(
  isPathInsideRoot(join(capturesRoot(productTmp), "..", "secrets"), capturesRoot(productTmp)) === false,
  "24: path traversal is not inside capture root",
);
let openFailKind = null;
try {
  await product.worker.openLastCaptureFolder(TOKEN, {
    openPath: async () => "The system cannot open the specified path.",
  });
} catch (error) {
  openFailKind = error.kind;
}
assert(openFailKind === ERROR_KINDS.CRASH, "shell.openPath error string is not reported as success");

const raceTmp = mkdtempSync(join(os.tmpdir(), "ea-cap-race-"));
const race = makeWorker(raceTmp);
await race.worker.connect();
race.mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/Home/Dashboard");
race.mock.page.holdNextEvaluate();
const raceCapture = race.worker.capturePortalContract(TOKEN);
await waitFor(() => race.worker.getStatus().state === STATES.RUNNING);
await race.mock.page.navigateMainFrame("https://example.com/escape?secret=test#fragment");
await waitFor(() => race.worker.getStatus().state === STATES.FAILED);
race.mock.page.rejectHeldEvaluate(new Error("Target closed"));
let raceKind = null;
try {
  await raceCapture;
} catch (error) {
  raceKind = error.kind;
}
assert(race.worker.getStatus().state === STATES.FAILED, "race: worker remains FAILED");
assert(race.worker.getStatus().state !== STATES.IDLE, "race: not IDLE");
assert(race.worker.getStatus().state !== STATES.AUTH_REQUIRED, "race: not AUTH_REQUIRED");
assert(race.worker.getStatus().state !== STATES.READY, "race: not READY");
assert(race.worker.getStatus().lastErrorKind === ERROR_KINDS.DISALLOWED_ORIGIN, "race: DISALLOWED_ORIGIN remains");
assert(raceKind === ERROR_KINDS.DISALLOWED_ORIGIN, "race: capture rejects as DISALLOWED_ORIGIN");
assert(race.mock.isClosed() === true, "race: dedicated context closed");
assert(existsSync(join(raceTmp, "eaushadhi-contract-captures")) === false, "race: no capture.json persisted");

const foreignTmp = mkdtempSync(join(os.tmpdir(), "ea-cap-foreign-"));
const foreign = makeWorker(foreignTmp);
await foreign.worker.connect();
foreign.mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/Home/Dashboard");
const foreignPage = foreign.mock.addPage("https://example.com/other?secret=test#fragment");
foreignPage.evaluate = async () => {
  throw new Error("external page was evaluated");
};
await waitFor(() => foreignPage.isClosed() === true);
assert(foreignPage.isClosed() === true, "enumeration: post-activation foreign page is contained by origin guard");
assert(foreign.worker.getStatus().state !== STATES.FAILED, "enumeration: secondary containment does not failClosed the worker");
assert(foreign.mock.isClosed() === false, "enumeration: controlled context remains open after secondary containment");
assert(existsSync(join(foreignTmp, "eaushadhi-contract-captures")) === false, "enumeration: no capture.json persisted before capture");
const foreignCapture = await foreign.worker.capturePortalContract(TOKEN);
assert(foreignCapture.ok === true, "enumeration: capture proceeds after foreign secondary was contained");
assert(foreign.worker.getStatus().lastErrorKind !== ERROR_KINDS.DISALLOWED_ORIGIN, "enumeration: DISALLOWED_ORIGIN cleared for surviving controlled session");

const ipcSrc = readFileSync(join(root, "electron/eaushadhi-worker/ipc.js"), "utf8");
assert(ipcSrc.includes(CHANNELS.CAPTURE_CONTRACT), "capture IPC channel exists");
assert(ipcSrc.includes("payload?.accessToken"), "capture IPC reads accessToken");
assert(!/CAPTURE_CONTRACT[\s\S]{0,400}payload\?\.path/.test(ipcSrc), "24: capture IPC does not take a renderer path");
assert(!/OPEN_CAPTURE_FOLDER[\s\S]{0,500}payload\?\.path/.test(ipcSrc), "24: open-folder IPC does not take a renderer path");

const denyTmp = mkdtempSync(join(os.tmpdir(), "ea-cap-deny-"));
const deny = makeWorker(denyTmp, {
  callRpc: async () => {
    throw workerError(ERROR_KINDS.AUTHORIZATION, "Not authorized for e-Aushadhi automation.");
  },
});
await deny.worker.connect();
deny.mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/Home/Dashboard");
let denyKind = null;
try {
  await deny.worker.capturePortalContract(TOKEN);
} catch (error) {
  denyKind = error.kind;
}
assert(denyKind === ERROR_KINDS.AUTHORIZATION, "20: capture IPC/worker requires server permission");

const readyTmp = mkdtempSync(join(os.tmpdir(), "ea-cap-ready-"));
const ready = makeWorker(readyTmp);
ready.mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/admin/addproductforlegacy");
await ready.worker.connect();
assert(ready.worker.getStatus().state === STATES.READY, "live logout probe reaches READY");
ready.mock.page.setHtml(productHtml, "https://www.e-aushadhi.gov.in/Product/AddUpdate");
await ready.worker.capturePortalContract(TOKEN);
assert(ready.worker.getStatus().state === STATES.READY, "23: capture from READY returns to READY");

const contractJson = JSON.parse(
  readFileSync(join(root, "electron/eaushadhi-worker/contracts/portal-contract.json"), "utf8"),
);
assert(contractJson.completeness.origins === true, "origins completeness unchanged");
assert(contractJson.completeness.authProbe === true, "authProbe completeness is true with runtime probe");
assert(contractJson.completeness.productLookup === false, "productLookup remains incomplete");
assert(contractJson.completeness.productDetails === false, "productDetails completeness remains false");
assert(contractJson.completeness.pharmacologicalActions === false, "pharmacologicalActions completeness remains false");
assert(contractJson.completeness.composition === false, "composition remains incomplete");
assert(contractJson.completeness.evidence === false, "evidence remains incomplete");
assert(contractJson.completeness.saveUpdate === false, "saveUpdate remains incomplete");
assert(contractJson.completeness.reread === false, "reread remains incomplete");
assert(contractJson.authProbe && contractJson.authProbe.logoutSelector === "#logoutForm", "authProbe definition is populated");
assert(contractJson.productLookup && contractJson.productLookup.completeness === false, "productLookup object stays incomplete");
assert(contractJson.productDetails && contractJson.productDetails.fields.type.selector === "#type", "productDetails fields are populated");
assert(contractJson.productDetails.fields.name.selector === "#name", "product name selector is recorded");
assert(
  contractJson.pharmacologicalActions && contractJson.pharmacologicalActions.selector === "select#indications",
  "pharmacologicalActions control is recorded",
);
assert(contractJson.composition && contractJson.composition.completeness === false, "composition stays incomplete");
assert(contractJson.evidence && contractJson.evidence.completeness === false, "evidence stays incomplete");
assert(contractJson.saveUpdate && contractJson.saveUpdate.completeness === false, "saveUpdate stays incomplete");
assert(contractJson.reread && contractJson.reread.completeness === false, "reread stays incomplete");

if (failed) {
  console.error(`\n${failed} capture assertion(s) failed`);
  process.exit(1);
}
console.log("\neaushadhi-worker-capture-smoke: all assertions passed");
