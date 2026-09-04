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
  const mainFrame = {
    url() {
      return currentUrl;
    },
  };
  const page = {
    url: () => currentUrl,
    mainFrame: () => mainFrame,
    frames: () => [mainFrame, ...extraFrames],
    on(name, fn) {
      listeners[name] = listeners[name] || [];
      listeners[name].push(fn);
    },
    off(name, fn) {
      listeners[name] = (listeners[name] || []).filter((handler) => handler !== fn);
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
    async evaluate(fn) {
      if (heldEvaluate) return heldEvaluate.promise;
      const prevDoc = global.document;
      const prevLoc = global.location;
      const prevCss = global.CSS;
      global.document = document;
      global.location = { href: currentUrl };
      global.CSS = {
        escape(value) {
          return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
        },
      };
      try {
        return fn();
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
    for (const handler of listeners.page || []) handler(page);
    return page;
  }

  const first = createMockPage("about:blank");
  pages.push(first);
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
  /\.(?:click|fill|type|press|goto|selectOption|setInputFiles)\s*\(|locator\.(?:click|fill|type|press)\s*\(|\.request\.post\s*\(|form\.submit\s*\(/;

for (const file of scanCaptureSources()) {
  assert(!forbiddenCall.test(file.src), `${file.name} does not invoke mutating Playwright/DOM actions`);
  assert(!/screenshot|page\.png|\.jpeg/i.test(file.src), `${file.name} does not take screenshots`);
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
legacy.mock.page.setHtml(legacyHtml, "https://www.e-aushadhi.gov.in/admin/addproductforlegacy");
const legacyResult = await legacy.worker.capturePortalContract(TOKEN);
assert(legacyResult.auth_outcome === "AUTHENTICATED_CANDIDATE", "legacy authenticated page is AUTHENTICATED_CANDIDATE");
const legacyJson = readCapture(legacyTmp);
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
foreign.mock.addPage("https://example.com/other?secret=test#fragment");
let foreignKind = null;
try {
  await foreign.worker.capturePortalContract(TOKEN);
} catch (error) {
  foreignKind = error.kind;
}
assert(foreignKind === ERROR_KINDS.DISALLOWED_ORIGIN, "enumeration: DISALLOWED_ORIGIN");
assert(foreign.worker.getStatus().state === STATES.FAILED, "enumeration: worker FAILED");
assert(foreign.worker.getStatus().lastErrorKind === ERROR_KINDS.DISALLOWED_ORIGIN, "enumeration: lastErrorKind DISALLOWED_ORIGIN");
assert(foreign.mock.isClosed() === true, "enumeration: context closed");
assert(existsSync(join(foreignTmp, "eaushadhi-contract-captures")) === false, "enumeration: no capture.json persisted");

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
const ready = makeWorker(readyTmp, {
  requireContract: (section) => {
    if (section === "authProbe") return { synthetic: true };
    return requireContract(section);
  },
});
await ready.worker.connect();
assert(ready.worker.getStatus().state === STATES.READY, "synthetic future contract reaches READY");
ready.mock.page.setHtml(productHtml, "https://www.e-aushadhi.gov.in/Product/AddUpdate");
await ready.worker.capturePortalContract(TOKEN);
assert(ready.worker.getStatus().state === STATES.READY, "23: capture from READY returns to READY");

const contractJson = JSON.parse(
  readFileSync(join(root, "electron/eaushadhi-worker/contracts/portal-contract.json"), "utf8"),
);
assert(contractJson.completeness.origins === true, "origins completeness unchanged");
assert(contractJson.completeness.authProbe === false, "authProbe completeness unchanged");
assert(contractJson.completeness.productLookup === false, "productLookup completeness unchanged");
assert(contractJson.completeness.productDetails === false, "productDetails completeness unchanged");
assert(contractJson.completeness.pharmacologicalActions === false, "pharmacologicalActions completeness unchanged");
assert(contractJson.completeness.composition === false, "composition completeness unchanged");
assert(contractJson.completeness.saveUpdate === false, "saveUpdate completeness unchanged");
assert(contractJson.completeness.reread === false, "reread completeness unchanged");
assert(contractJson.authProbe === null, "authProbe remains null");
assert(contractJson.productLookup === null, "productLookup remains null");
assert(contractJson.productDetails === null, "productDetails remains null");
assert(contractJson.pharmacologicalActions === null, "pharmacologicalActions remains null");
assert(contractJson.composition === null, "composition remains null");
assert(contractJson.saveUpdate === null, "saveUpdate remains null");
assert(contractJson.reread === null, "reread remains null");

if (failed) {
  console.error(`\n${failed} capture assertion(s) failed`);
  process.exit(1);
}
console.log("\neaushadhi-worker-capture-smoke: all assertions passed");
