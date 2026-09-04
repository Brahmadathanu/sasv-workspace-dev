/**
 * Local fixture smoke for read-only e-Aushadhi portal contract capture.
 * Does not contact the live portal and does not launch Microsoft Edge.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
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
const loginHtml = readFileSync(join(fixtureDir, "login.html"), "utf8");
const authHtml = readFileSync(join(fixtureDir, "authenticated.html"), "utf8");
const ambiguousHtml = readFileSync(join(fixtureDir, "ambiguous.html"), "utf8");
const productHtml = readFileSync(join(fixtureDir, "product-form.html"), "utf8");

function createMockPage(startUrl = "about:blank") {
  let currentUrl = startUrl;
  let document = parseHtml("<html></html>");
  const extraFrames = [];
  const mainFrame = { url: () => currentUrl };
  const page = {
    url: () => currentUrl,
    mainFrame: () => mainFrame,
    frames: () => [mainFrame, ...extraFrames],
    on() {},
    off() {},
    async goto(next) {
      currentUrl = next;
      return null;
    },
    setHtml(html, url) {
      document = parseHtml(html);
      if (url) currentUrl = url;
    },
    addChildFrame(url) {
      extraFrames.push({ url: () => url });
    },
    async evaluate(fn) {
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
  const first = createMockPage("about:blank");
  const pages = [first];
  return {
    context: {
      pages: () => [...pages],
      on() {},
      off() {},
      async newPage() {
        const page = createMockPage("about:blank");
        pages.push(page);
        return page;
      },
      async close() {},
    },
    page: first,
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
authed.mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/Home/Dashboard");
const authResult = await authed.worker.capturePortalContract(TOKEN);
assert(authResult.auth_outcome === "AUTHENTICATED_CANDIDATE", "2: authenticated fixture is AUTHENTICATED_CANDIDATE");

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
assert(contractJson.completeness.authProbe === false, "authProbe completeness unchanged");
assert(contractJson.authProbe === null, "authProbe remains null");
assert(contractJson.completeness.saveUpdate === false, "saveUpdate completeness unchanged");

if (failed) {
  console.error(`\n${failed} capture assertion(s) failed`);
  process.exit(1);
}
console.log("\neaushadhi-worker-capture-smoke: all assertions passed");
