// Office-PC TEST candidate: isolation, updater-off and baseline-preservation tests. Offline; no Electron, no network, no installs.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { REPO, CONFIG_REL, BASELINE_MAIN_SHA, identityProblems, asarContentProblems, packagedPkgProblems, scrubbedEnv, FORBIDDEN_ENV } from "./lib.mjs";
import { loadMain, VALID_MARKER } from "./main-harness.mjs";

const require = createRequire(import.meta.url);
const iso = require("../../electron/candidate/office-test-isolation.js");
const pkg = JSON.parse(fs.readFileSync(path.join(REPO, "package.json"), "utf8"));
const cfg = JSON.parse(fs.readFileSync(path.join(REPO, CONFIG_REL), "utf8"));
const PROD = { appId: "com.brahmadathanu.sasvworkspace", guid: "A3F5C8D2-14BE-4E7A-9B3C-6D0E2F1A4B87" };

test("baseline preservation: production package.json is untouched (no marker, same appId/GUID/version/publish/scripts)", () => {
  assert.equal(pkg.sasvOfficeTestCandidate, undefined);
  assert.equal(pkg.build.appId, PROD.appId); assert.equal(pkg.build.nsis.guid, PROD.guid); assert.equal(pkg.version, "6.1.0"); assert.equal(pkg.productName, "SASV Workspace");
  assert.deepEqual(pkg.build.publish, [{ provider: "github", owner: "Brahmadathanu", repo: "sasv-workspace-dev" }]);
  assert.equal(pkg.scripts.start, "electron ."); assert.equal(pkg.scripts.build, "electron-builder");
  const base = JSON.parse(execFileSync("git", ["show", `${BASELINE_MAIN_SHA}:package.json`], { cwd: REPO, encoding: "utf8" }));
  assert.deepEqual(pkg, base, "package.json is byte-semantically identical to the pinned baseline");
});

test("public/, js/, preload.js and the Supabase/SQL trees are identical to the pinned baseline (candidate touches only main.js + new candidate files)", () => {
  // committed (BASE..HEAD) + staged content only: unstaged checkout line-ending noise is not part of the candidate.
  const g = (a) => execFileSync("git", a, { cwd: REPO, encoding: "utf8" }).split("\n").filter(Boolean);
  const changed = [...new Set([...g(["diff", "--name-only", BASELINE_MAIN_SHA, "HEAD"]), ...g(["diff", "--name-only", "--cached"])])];
  const allowed = [/^main\.js$/, /^electron\/candidate\//, /^scripts\/office-test-candidate\//, /^docs\/master-data-costing\//];
  const stray = changed.filter((f) => !allowed.some((re) => re.test(f)));
  assert.deepEqual(stray, [], `unexpected changed paths: ${stray.join(", ")}`);
  assert.ok(changed.includes("main.js"));
});

test("activate(): normal app => null and NO side effects (also when package.json is unreadable)", () => {
  const calls = []; const app = { setPath: (...a) => calls.push(["setPath", ...a]), exit: (...a) => calls.push(["exit", ...a]), getPath: () => "/x" };
  assert.equal(iso.activate({ app, dialog: {}, readFileSync: () => JSON.stringify(pkg), appDir: "/app" }), null);
  assert.equal(iso.activate({ app, dialog: {}, readFileSync: () => { throw new Error("nope"); }, appDir: "/app" }), null);
  assert.deepEqual(calls, []);
});

test("activate(): valid candidate => separate userData under appData, frozen marker; never the production folder", () => {
  const calls = []; const app = { setPath: (...a) => calls.push(a), exit: () => assert.fail("must not exit"), getPath: (n) => (n === "appData" ? path.join("/r", "AppData") : "") };
  const m = iso.activate({ app, dialog: {}, readFileSync: () => JSON.stringify({ ...pkg, sasvOfficeTestCandidate: VALID_MARKER }), appDir: "/app" });
  assert.equal(m.appId, VALID_MARKER.appId); assert.ok(Object.isFrozen(m));
  assert.deepEqual(calls, [["userData", path.join("/r", "AppData", "SASV Workspace OFFICE TEST")]]);
  for (const prodDir of ["SASV Workspace", "daily-worklog-app"]) assert.notEqual(path.basename(calls[0][1]), prodDir);
});

test("activate(): a present-but-ambiguous marker FAILS CLOSED (exit 3, error box, throws, no userData set)", () => {
  const bad = {
    "production appId": { appId: PROD.appId }, "updater not disabled": { updaterDisabled: false }, "production data folder": { userDataDirName: "SASV Workspace" },
    "package-name data folder": { userDataDirName: "daily-worklog-app" }, "path separator": { userDataDirName: "..\\SASV Workspace" }, "dot dir": { userDataDirName: ".." },
    "bad sha": { sourceCommit: "UNSET" }, "no version": { candidateVersion: "" }, "wrong schema": { schema: 2 }, "appId not extending .officetest": { appId: "com.example.other" },
  };
  for (const [name, patch] of Object.entries(bad)) {
    const calls = []; const boxes = [];
    const app = { setPath: () => calls.push("setPath"), exit: (c) => calls.push(["exit", c]), getPath: () => "/x" };
    assert.throws(() => iso.activate({ app, dialog: { showErrorBox: (...a) => boxes.push(a) }, readFileSync: () => JSON.stringify({ ...pkg, sasvOfficeTestCandidate: { ...VALID_MARKER, ...patch } }), appDir: "/app" }), /marker invalid/, name);
    assert.deepEqual(calls, [["exit", 3]], name); assert.equal(boxes.length, 1, name);
  }
});

test("candidate builder config: every identity field differs from production; no publish feed; uninstall keeps data; guards detect a production-aliased config", () => {
  assert.deepEqual(identityProblems(cfg, pkg), []);
  const mut = (f) => { const c = structuredClone(cfg); f(c); return identityProblems(c, pkg); };
  assert.ok(mut((c) => { c.appId = PROD.appId; }).length);
  assert.ok(mut((c) => { c.nsis.guid = PROD.guid; }).some((x) => /GUID/.test(x)));
  assert.ok(mut((c) => { c.productName = "SASV Workspace"; }).length);
  assert.ok(mut((c) => { c.publish = [{ provider: "github" }]; }).some((x) => /publish/.test(x)));
  assert.ok(mut((c) => { c.extraMetadata.version = "6.1.0"; }).length);
  assert.ok(mut((c) => { c.nsis.deleteAppDataOnUninstall = true; }).length);
  assert.ok(mut((c) => { delete c.extraMetadata.sasvOfficeTestCandidate; }).length);
  assert.ok(mut((c) => { c.nsis.shortcutName = "SASV Workspace"; }).length);
  assert.equal(cfg.extraMetadata.sasvOfficeTestCandidate.sourceCommit, "UNSET", "committed config cannot masquerade as a stamped build: main.js refuses 'UNSET'");
  assert.equal(cfg.win.signAndEditExecutable, undefined, "exe resources are edited (default) so the .exe carries the test identity"); assert.equal(cfg.win.certificateFile, undefined); assert.deepEqual(cfg.win.target.map((t) => t.target), ["nsis", "zip"]);
});

test("ASAR/package checks: required routes present, forbidden trees/feeds absent, packaged package.json carries the exact SHA (mutants detected)", () => {
  const files = ["package.json", "main.js", "preload.js", "electron/candidate/office-test-isolation.js", "manage-categories.html", "manage-subcategories.html", "manage-product-groups.html", "manage-subgroups.html", "js/categories.js", "js/subcategories.js", "js/product-groups.js", "js/subgroups.js", "public/shared/js/wp10-safeguards.js", "public/shared/js/costing-cost-comparison-read.js", "public/shared/js/costing-feature-flags.js", "public/sw.js", "node_modules/x/docs/readme.md"];
  assert.deepEqual(asarContentProblems(files).problems, []);
  assert.ok(asarContentProblems(files.filter((f) => f !== "manage-subgroups.html")).problems.length);
  for (const bad of ["docs/a.md", "supabase/migrations/a.sql", "scripts/x.mjs", ".env", "resources/app-update.yml", "latest.yml", "electron/candidate/electron-builder.office-test.json", "a.pfx"]) assert.ok(asarContentProblems([...files, bad]).problems.some((x) => /forbidden/.test(x)), bad);
  const sha = "b".repeat(40); const p = { name: "sasv-workspace-office-test", productName: "SASV Workspace OFFICE TEST", version: "6.1.0-officetest.1", sasvOfficeTestCandidate: { ...VALID_MARKER, sourceCommit: sha } };
  assert.deepEqual(packagedPkgProblems(p, { sha, productionPkg: pkg }), []);
  assert.ok(packagedPkgProblems(p, { sha: "c".repeat(40), productionPkg: pkg }).length);
  assert.ok(packagedPkgProblems({ ...p, version: "6.1.0" }, { sha, productionPkg: pkg }).length);
});

test("build environment hygiene: publish/signing credentials are stripped from the build child", () => {
  const { env, removed } = scrubbedEnv({ PATH: "/bin", GH_TOKEN: "x", GITHUB_TOKEN: "y", CSC_LINK: "z", KEEP: "1" });
  assert.deepEqual(removed.sort(), ["CSC_LINK", "GH_TOKEN", "GITHUB_TOKEN"]); assert.equal(env.KEEP, "1"); for (const k of FORBIDDEN_ENV) assert.equal(env[k], undefined);
});

// ---- behavioural tests on the REAL main.js with Electron mocked ----
test("main.js NORMAL packaged app (no marker): production AppUserModelId, no userData override, GitHub feed + startup check + autoDownload exactly as before", async () => {
  const m = loadMain({ packaged: true }); assert.equal(m.rec.loadError, undefined);
  await m.ready();
  assert.deepEqual(m.rec.aumid, ["com.brahmadathanu.sasvworkspace"]); assert.deepEqual(m.rec.setPath, []);
  assert.equal(m.rec.updater.props.autoDownload, true); assert.equal(m.rec.updater.props.autoInstallOnAppQuit, true);
  assert.deepEqual(m.rec.updater.calls[0], ["setFeedURL", { provider: "github", owner: "Brahmadathanu", repo: "sasv-workspace-dev", private: false, token: null }]);
  assert.ok(m.rec.updater.calls.includes("checkForUpdates"), "startup check runs in the normal packaged app");
  assert.equal(m.rec.listenPort, 3000); assert.equal(m.server.listenerCount("error"), 0, "no new error handler in the normal app");
  assert.deepEqual((await m.rec.handlers["updater:restart"]()), { ok: true }); assert.ok(m.rec.updater.calls.includes("quitAndInstall"));
  m.close();
});

test("main.js NORMAL unpackaged (npm start): dev AppUserModelId, updater never checks, nothing candidate-related", async () => {
  const m = loadMain({ packaged: false }); await m.ready();
  assert.deepEqual(m.rec.aumid, ["com.brahmadathanu.sasvworkspace.dev"]); assert.deepEqual(m.rec.setPath, []); assert.ok(!m.rec.updater.calls.includes("checkForUpdates")); m.close();
});

test("main.js OFFICE TEST candidate: separate identity + userData BEFORE the single-instance lock, updater fully inert on every trigger", async () => {
  const m = loadMain({ packaged: true, marker: VALID_MARKER }); assert.equal(m.rec.loadError, undefined);
  assert.deepEqual(m.rec.setPath, [["userData", "/mock/AppData/Roaming/SASV Workspace OFFICE TEST"]]);
  assert.equal(m.rec.singleLock, 1); assert.equal(m.rec.lockedAfterSetPath, 1, "userData set before requestSingleInstanceLock");
  assert.deepEqual(m.rec.aumid, [VALID_MARKER.appId]);
  assert.equal(m.rec.updater.props.autoDownload, false); assert.equal(m.rec.updater.props.autoInstallOnAppQuit, false);
  await m.ready();
  for (const fn of m.rec.appOn["browser-window-focus"] || []) fn(); for (const fn of m.rec.appOn.resume || []) fn();
  assert.equal(await m.rec.handlers["updater:check"](), false);
  assert.deepEqual(await m.rec.handlers["updater:restart"](), { ok: false, error: "Updater disabled in the office test build" });
  assert.deepEqual(m.rec.updater.calls, [], "no setFeedURL, checkForUpdates or quitAndInstall on startup/focus/resume/manual/restart");
  assert.equal(m.rec.updater.props.autoDownload, false);
  const win = m.rec.windows[0]; win.emit("page-title-updated", { preventDefault() {} }, "Login"); assert.equal(win.title, "[OFFICE TEST] Login"); m.close();
});

test("main.js OFFICE TEST candidate: port 3000 already owned (normal app / npm start) => visible error and exit(2); never silently shares another app's server", () => {
  const m = loadMain({ packaged: true, marker: VALID_MARKER });
  assert.equal(m.server.listenerCount("error"), 1);
  m.server.emit("error", Object.assign(new Error("in use"), { code: "EADDRINUSE" }));
  assert.deepEqual(m.rec.exit, [2]); assert.match(m.rec.errorBoxes[0][1], /Port 3000 is unavailable \(EADDRINUSE\)/);
});

test("main.js with an invalid marker refuses to run (fail closed) and leaves the updater untouched", () => {
  const m = loadMain({ packaged: true, marker: { ...VALID_MARKER, sourceCommit: "UNSET" } });
  assert.match(m.rec.loadError, /marker invalid/); assert.deepEqual(m.rec.exit, [3]); assert.deepEqual(m.rec.updater.calls, []);
});

test("main.js source guards: candidate activation precedes the single-instance lock; no un-gated updater feed/check path was added", () => {
  const s = fs.readFileSync(path.join(REPO, "main.js"), "utf8");
  assert.ok(s.indexOf("office-test-isolation").valueOf() < s.indexOf("requestSingleInstanceLock"));
  assert.ok(s.indexOf("const OFFICE_TEST") < s.indexOf("setAppUserModelId"));
  assert.match(s, /function canCheckForUpdates\(\) \{\n {2}if \(OFFICE_TEST\) return false;/);
  const ready = s.slice(s.indexOf("app.whenReady()"), s.indexOf('app.on("browser-window-focus"'));
  assert.ok(ready.indexOf("if (OFFICE_TEST)") < ready.indexOf("setFeedURL") && /return;\n {2}\}\n {2}try \{/.test(ready));
  assert.equal((s.match(/setFeedURL\(/g) || []).length, 1); assert.equal((s.match(/quitAndInstall\(/g) || []).length, 1);
  const rest = s.slice(s.indexOf('ipcMain.handle("updater:restart"'), s.indexOf("quitAndInstall"));
  assert.match(rest, /if \(OFFICE_TEST\) return \{ ok: false/);
});

test("PE helpers: certificate-table size distinguishes signed from unsigned (PE32 and PE32+); UTF-16 string reader sees version-resource text", async () => {
  const { peCertificateTableSize, utf16Strings } = await import("./lib.mjs");
  const os = await import("node:os");
  const mk = (magic, certSize) => {
    const b = Buffer.alloc(4096); b.write("MZ", 0, "latin1"); b.writeUInt32LE(0x80, 0x3c); b.write("PE\0\0", 0x80, "latin1");
    const opt = 0x80 + 24; b.writeUInt16LE(magic, opt); const dirs = opt + (magic === 0x20b ? 112 : 96); b.writeUInt32LE(certSize, dirs + 4 * 8 + 4);
    const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "pe-")), "t.exe"); fs.writeFileSync(f, Buffer.concat([b, Buffer.from("S\0A\0S\0V\0 \0T\0E\0S\0T\0\0\0", "latin1")])); return f;
  };
  assert.equal(peCertificateTableSize(mk(0x20b, 0)), 0); assert.equal(peCertificateTableSize(mk(0x20b, 5120)), 5120);
  assert.equal(peCertificateTableSize(mk(0x10b, 0)), 0); assert.equal(peCertificateTableSize(mk(0x10b, 64)), 64);
  assert.ok(utf16Strings(mk(0x20b, 0)).has("SASV TEST"));
  const junk = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "pe-")), "j.bin"); fs.writeFileSync(junk, "hello"); assert.throws(() => peCertificateTableSize(junk), /not a PE/);
});
