/**
 * Fail-closed auth probe. Does not launch Microsoft Edge or contact the portal.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import os from "node:os";
import { mkdtempSync } from "node:fs";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = join(root, "scripts/fixtures/eaushadhi-portal");
const { parseHtml } = require(join(fixtureDir, "mini-dom.cjs"));
const { collectAuthProbeSignals, evaluateAuthProbe } = require(
  join(root, "electron/eaushadhi-worker/auth-probe.js"),
);
const { createEaushadhiWorker } = require(join(root, "electron/eaushadhi-worker/index.js"));
const { STATES } = require(join(root, "electron/eaushadhi-worker/state.js"));
const { loadPortalContract } = require(join(root, "electron/eaushadhi-worker/contracts/portal-contract.js"));

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("OK", msg);
  }
}

const spec = loadPortalContract().authProbe;
const homepage = `<!DOCTYPE html><html><body><h1>e-Aushadhi</h1></body></html>`;
const logoutPlusPassword = `<!DOCTYPE html><html><body>
  <form id="logoutForm" action="/logout"></form>
  <a href="/admin/custom_dashboard1">Dashboard</a>
  <input type="password" name="password" />
</body></html>`;
const changePasswordOnly = `<!DOCTYPE html><html><body>
  <a href="/admin/changepassword">Change Password</a>
  <a href="/admin/custom_dashboard1">Dashboard</a>
</body></html>`;
const captchaOnly = `<!DOCTYPE html><html><body>
  <form id="logoutForm" action="/logout"></form>
  <input id="captcha" name="captcha" type="text" />
</body></html>`;
const otpOnly = `<!DOCTYPE html><html><body>
  <form id="logoutForm" action="/logout"></form>
  <input id="otp" name="otp" type="text" autocomplete="one-time-code" />
</body></html>`;

function probeHtml(html, href) {
  const prevDoc = global.document;
  const prevLoc = global.location;
  global.document = parseHtml(html);
  global.location = { href: href || "https://www.e-aushadhi.gov.in/" };
  try {
    return evaluateAuthProbe(collectAuthProbeSignals(spec), spec);
  } finally {
    global.document = prevDoc;
    global.location = prevLoc;
  }
}

const home = probeHtml(homepage);
assert(home.authenticated === false, "unauthenticated homepage is not authenticated");

const authHtml = readFileSync(join(fixtureDir, "authenticated.html"), "utf8");
const authed = probeHtml(authHtml, "https://www.e-aushadhi.gov.in/admin/addproductforlegacy");
assert(authed.authenticated === true, "logoutForm href=/logout is authenticated");
assert(authed.signals.dashboardPresent === true, "dashboard path is supporting evidence");

const loginHtml = readFileSync(join(fixtureDir, "login.html"), "utf8");
const login = probeHtml(loginHtml, "https://www.e-aushadhi.gov.in/Account/Login");
assert(login.authenticated === false, "password/OTP/CAPTCHA entry fails auth");
assert(login.signals.credentialEntries.some((row) => row.kind === "password_input"), "password input is recorded");

const mixed = probeHtml(logoutPlusPassword);
assert(mixed.authenticated === false, "password input overrides logout landmark");

const changeOnly = probeHtml(changePasswordOnly);
assert(changeOnly.authenticated === false, "Change Password nav is not authenticated evidence");
assert(changeOnly.signals.credentialEntries.length === 0, "Change Password is not a credential-entry control");

assert(probeHtml(captchaOnly).authenticated === false, "CAPTCHA entry fails auth");
assert(probeHtml(otpOnly).authenticated === false, "OTP entry fails auth");

const placeholderCaptcha = probeHtml(`<!DOCTYPE html><html><body>
  <form id="logoutForm" action="/logout"></form>
  <input id="x" type="text" placeholder="Enter Captcha" />
</body></html>`);
assert(
  placeholderCaptcha.signals.credentialEntries.some((row) => row.kind === "captcha_entry"),
  "placeholder Enter Captcha is captcha_entry",
);

const ariaOtp = probeHtml(`<!DOCTYPE html><html><body>
  <form id="logoutForm" action="/logout"></form>
  <input id="x" type="text" aria-label="OTP" />
</body></html>`);
assert(
  ariaOtp.signals.credentialEntries.some((row) => row.kind === "otp_entry"),
  "aria-label OTP is otp_entry",
);

const labelledCaptcha = probeHtml(`<!DOCTYPE html><html><body>
  <form id="logoutForm" action="/logout"></form>
  <label for="x">Enter CAPTCHA</label>
  <input id="x" type="text" />
</body></html>`);
assert(
  labelledCaptcha.signals.credentialEntries.some((row) => row.kind === "captcha_entry"),
  "associated label Enter CAPTCHA is captcha_entry",
);

const trailingSlash = probeHtml(`<!DOCTYPE html><html><body>
  <form id="logoutForm" action="/logout/"></form>
</body></html>`);
assert(trailingSlash.authenticated === true, "/logout/ normalizes to contract logoutPath");

function probeHtmlWithSpec(html, customSpec) {
  const prevDoc = global.document;
  const prevLoc = global.location;
  global.document = parseHtml(html);
  global.location = { href: "https://www.e-aushadhi.gov.in/" };
  try {
    return evaluateAuthProbe(collectAuthProbeSignals(customSpec), customSpec);
  } finally {
    global.document = prevDoc;
    global.location = prevLoc;
  }
}
const contractLogout = probeHtmlWithSpec(
  `<!DOCTYPE html><html><body><form id="logoutForm" action="/logout"></form></body></html>`,
  spec,
);
assert(contractLogout.authenticated === true, "spec.logoutPath=/logout authenticates /logout");
const differentSpec = { ...spec, logoutPath: "/different-logout" };
const wrongPath = probeHtmlWithSpec(
  `<!DOCTYPE html><html><body><form id="logoutForm" action="/logout"></form></body></html>`,
  differentSpec,
);
assert(wrongPath.authenticated === false, "/logout does not authenticate when contract wants /different-logout");
const matchingAlt = probeHtmlWithSpec(
  `<!DOCTYPE html><html><body><form id="logoutForm" action="/different-logout"></form></body></html>`,
  differentSpec,
);
assert(matchingAlt.authenticated === true, "spec.logoutPath=/different-logout requires that path");

const authSrc = readFileSync(join(root, "electron/eaushadhi-worker/auth-probe.js"), "utf8");
assert(!authSrc.includes('path === "/logout"') && !authSrc.includes("path === '/logout'"), "logout path is not hardcoded");
assert(authSrc.includes("logoutPath"), "probe reads contract logoutPath");
const indexSrc = readFileSync(join(root, "electron/eaushadhi-worker/index.js"), "utf8");
assert(!/\.click\s*\(/.test(authSrc), "auth probe does not click");
assert(!/\.fill\s*\(/.test(authSrc), "auth probe does not fill");
assert(!/captcha.*solve|solveCaptcha/i.test(authSrc + indexSrc), "no CAPTCHA/OTP automation");
assert(indexSrc.includes("probeAuthenticatedSession"), "connect uses the live probe");

function createMockPage(html) {
  let currentUrl = "about:blank";
  let document = parseHtml(html);
  const listeners = {};
  const mainFrame = { url: () => currentUrl };
  return {
    url: () => currentUrl,
    mainFrame: () => mainFrame,
    on(name, fn) {
      listeners[name] = listeners[name] || [];
      listeners[name].push(fn);
    },
    off() {},
    async goto(next) {
      currentUrl = next;
    },
    async evaluate(fn, arg) {
      const prevDoc = global.document;
      const prevLoc = global.location;
      global.document = document;
      global.location = { href: currentUrl };
      try {
        return fn(arg);
      } finally {
        global.document = prevDoc;
        global.location = prevLoc;
      }
    },
  };
}

function makeWorker(html) {
  const page = createMockPage(html);
  const context = {
    pages: () => [page],
    on() {},
    off() {},
    async newPage() {
      return page;
    },
    async close() {},
  };
  const tmp = mkdtempSync(join(os.tmpdir(), "ea-auth-"));
  const worker = createEaushadhiWorker({
    getUserDataPath: () => tmp,
    launchBrowser: async () => context,
  });
  return { worker, page };
}

const blank = makeWorker("<html></html>");
await blank.worker.connect();
assert(blank.worker.getStatus().state === STATES.AUTH_REQUIRED, "connect homepage/blank is AUTH_REQUIRED");

const ready = makeWorker(authHtml);
await ready.worker.connect();
assert(ready.worker.getStatus().state === STATES.READY, "connect authenticated logout page is READY");

const pwd = makeWorker(logoutPlusPassword);
await pwd.worker.connect();
assert(pwd.worker.getStatus().state === STATES.AUTH_REQUIRED, "connect with password input is AUTH_REQUIRED");

if (failed) {
  console.error(`\n${failed} auth-probe assertion(s) failed`);
  process.exit(1);
}
console.log("\neaushadhi-worker-auth-probe-smoke: all assertions passed");
