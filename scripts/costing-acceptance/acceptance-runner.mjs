// Operator-guided, READ-ONLY authenticated acceptance runner for the six Costing modules (40 lenses/workspaces).
//
// SAFETY MODEL
//  * It NEVER clicks, types, submits or presses anything. It only navigates by URL, sets temporary localStorage flag overrides and selects a period in
//    the existing period selector. Mutating-looking controls are only OBSERVED (present / enabled).
//  * Every browser request is classified (lib/allowlist.mjs) and anything that is not provably a read is ABORTED before it leaves the browser. The
//    first such attempt stops the run (FAILED_SECURITY). Only get_user_permissions and rpc_get_* RPCs, REST GET/HEAD and token refresh are allowed.
//  * It accepts NO credentials. Authentication comes only from a Playwright storage-state file the operator produced by logging in themselves
//    (capture-storage-state.mjs). That file must live OUTSIDE the repository.
//  * FAIL CLOSED: no verified build, no proven identity (session read AND owner-supplied canonical extract agree, zero edit grants), unsafe paths, or
//    a loopback target without the explicit self-test flag => NOT_TESTED, exit 3, never a pass.
//  * Output is scrubbed (lib/redact.mjs); no tokens, emails or user ids are written. Screenshots may show real data: keep them outside the repository.
//
//   node scripts/costing-acceptance/acceptance-runner.mjs --base https://<host> --sha <40-hex> --identity ID-V --storage-state <file> --canonical-proof <file> --out <dir>
//        [--matrix standard|minimal] [--screenshots] [--build-proof provenance.json] [--backend-origin https://<ref>.supabase.co]
//
// Exit: 0 COMPLETED_CLEAN (hosted only) | 1 findings / render-only | 2 usage | 3 NOT_TESTED | 4 FAILED_SECURITY
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync, execFile } from "node:child_process";
import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const verifyScript = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "verify-served-assets.mjs");
// ASYNC child process on purpose: the verifier fetches with synchronous curl calls, which would freeze this process (and any in-process local test server).
const verifyAsync = ({ base, sha, allowLocalSelfTest }) => new Promise((resolve) => {
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "accept-verify-")), "v.json");
  execFile("node", [verifyScript, base, sha, "--json", tmp, ...(allowLocalSelfTest ? ["--allow-local-self-test"] : [])], { maxBuffer: 64 * 1024 * 1024 }, () => {
    try { resolve(JSON.parse(fs.readFileSync(tmp, "utf8"))); } catch { resolve({ verdict: "NOT_VERIFIED", reasons: ["verification produced no report"] }); }
    fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
  });
});
import { classifyRequest, FORBIDDEN_UI_VERBS, appDocumentedReadRpcs } from "./lib/allowlist.mjs";
import { evaluateIdentity } from "./lib/identity.mjs";
import { redact, safeUrl } from "./lib/redact.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const PRODUCTION_BACKEND = "https://qhmoqtxpeasamtlxaoak.supabase.co";
export const FLAGS = Object.freeze(["COSTING_RECALC_WITH_DATE_V1", "COSTING_APPROVAL_SCREEN_V1", "COSTING_LOCK_SCREEN_V1", "COSTING_RUN_STATUS_V1", "COSTING_UX_CONSISTENCY_V1", "COSTING_DIALOGS_V1",
  "COSTING_TABLE_TOOLS_V1", "COSTING_REVIEW_WORKLIST_V1", "COSTING_NAV_GROUPS_V1", "COSTING_PRM_CORRECTIONS_V1", "COSTING_PRM_NAV_CONTEXT_V1"]);
// Expected inventory: 6 modules, 40 lenses/workspaces (PPM counts its ten workspaces). Discovered ids are recorded; a count mismatch is a finding.
export const MODULES = Object.freeze([
  { key: "costing-control-center", page: "costing-control-center", expect: 4, param: "lens", defaultLens: "dashboard" },
  { key: "material-cost-manager", page: "material-cost-manager", expect: 3, param: "lens", defaultLens: "manual-rate-manager" },
  { key: "cost-build-manager", page: "cost-build-manager", expect: 4, param: "lens", defaultLens: "cost-governance" },
  { key: "pricing-policy-manager", page: "pricing-policy-manager", expect: 10, param: "workspace", defaultLens: null },
  { key: "cost-sheet-review", page: "cost-sheet-review", expect: 6, param: "lens", defaultLens: "sku-cost-sheet" },
  { key: "production-route-manager", page: "production-route-manager", expect: 13, param: "lens", defaultLens: "route-readiness" },
]);
const STATEMENT = "Runner output is evidence for the owner's acceptance record. It is not sign-off and closes no work pack.";
const sha12 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex").slice(0, 12);
const isLoopback = (h) => /^(localhost|127\.\d+\.\d+\.\d+|\[?::1\]?)$/i.test(h);
const insideRepo = (p) => { const r = path.resolve(p); return r === repoRoot || r.startsWith(repoRoot + path.sep); };
const gitIgnored = (p) => { try { execFileSync("git", ["check-ignore", "-q", p], { cwd: repoRoot, stdio: "ignore" }); return true; } catch { return false; } };

export async function runAcceptance(o) {
  const started = new Date().toISOString(); const T0 = Date.now(); const dbg = (m) => { if (process.env.ACCEPT_DEBUG) console.error(`[${((Date.now() - T0) / 1000).toFixed(1)}s] ${m}`); };
  const report = { kind: "ACCEPTANCE_RUN", statement: STATEMENT, started_at: started, verdict: "NOT_TESTED", exit_code: 3, reasons: [], base: o.base, git_sha: o.sha, identity_label: o.identity,
    matrix: o.matrix ?? "standard", evidence_class: null, hosted_claims: "NOT TESTED", build: null, identity: null, flags_restored: null, violations: [], findings: [], requests: {}, console_errors: [], observations: [], inventory: {}, skipped: [] };
  const stop = (code, verdict, reason) => { report.exit_code = code; report.verdict = verdict; report.reasons.push(reason); return finish(report, o); };

  // ---- 1. static preconditions (no browser, no network)
  let url; try { url = new URL(o.base); } catch { return stop(2, "USAGE", "invalid --base"); }
  const loopback = isLoopback(url.hostname);
  if (loopback && !o.selfTest) return stop(2, "USAGE", "loopback --base refused: a local server is not a hosted target (self-tests only)");
  if (!loopback && url.protocol !== "https:") return stop(2, "USAGE", "a hosted target must be https");
  report.evidence_class = loopback ? "LOCAL_SELF_TEST" : "HOSTED";
  if (!/^[0-9a-f]{40}$/.test(String(o.sha))) return stop(2, "USAGE", "--sha must be the explicit full 40-hex commit under test");
  if (!o.out) return stop(2, "USAGE", "--out is required");
  const outAbs = path.resolve(o.out);
  if (insideRepo(outAbs) && !gitIgnored(outAbs + path.sep + "x")) return stop(3, "NOT_TESTED", "--out is inside the repository and not git-ignored: evidence (possibly real data) could be committed. Use a directory outside the repo or acceptance-*/");
  if (o.storageState) {
    const ss = path.resolve(o.storageState);
    if (insideRepo(ss)) return stop(3, "NOT_TESTED", "--storage-state is inside the repository: a session file must never sit in a worktree");
    if (!fs.existsSync(ss)) return stop(3, "NOT_TESTED", "--storage-state file not found");
    if ((fs.statSync(ss).mode & 0o077) !== 0 && process.platform !== "win32") return stop(3, "NOT_TESTED", "--storage-state is readable by group/others: chmod 600 it");
  } else if (!o.selfTest) return stop(3, "NOT_TESTED", "no authenticated session: --storage-state is required for a hosted run (this runner never accepts a password)");
  let canonical = null;
  if (o.canonicalProof) { try { canonical = JSON.parse(fs.readFileSync(o.canonicalProof, "utf8")); } catch { return stop(3, "NOT_TESTED", "--canonical-proof is not readable JSON"); } }
  else return stop(3, "NOT_TESTED", "--canonical-proof is required: the owner's SELECT-only extract of the identity's canonical permissions");

  // ---- 2. build identity (mandatory)
  let build;
  if (o.buildProof) {
    try { build = JSON.parse(fs.readFileSync(o.buildProof, "utf8")); } catch { return stop(3, "NOT_TESTED", "--build-proof is not readable JSON"); }
    const age = Date.now() - Date.parse(build.checked_at || 0);
    const ok = build.kind === "BUILD_VERIFICATION" && build.verdict === "VERIFIED" && build.git_sha === o.sha && build.origin === url.origin && build.evidence_class === report.evidence_class && build.mismatches === 0 && age >= 0 && age < 24 * 3600e3;
    if (!ok) return stop(3, "NOT_TESTED", "--build-proof does not prove this base and SHA (needs VERIFIED, same origin and SHA, same evidence class, 0 mismatches, under 24 h old)");
  } else build = await verifyAsync({ base: o.base, sha: o.sha, allowLocalSelfTest: !!o.selfTest });
  report.build = { verdict: build.verdict, evidence_class: build.evidence_class, files: build.files, served_cache_name: build.served_cache_name, expected_cache_name: build.expected_cache_name, served_bundle_digest: build.served_bundle_digest, hosted_proof: build.hosted_proof };
  if (build.verdict !== "VERIFIED") return stop(3, "NOT_TESTED", `build not verified (${build.verdict}): ${build.reasons?.join("; ") || "see verification"}`);

  dbg("build verified");
  let extraRead = new Set();
  try { extraRead = new Set(appDocumentedReadRpcs(execFileSync("git", ["show", `${o.sha}:public/shared/js/costing-run-status-screen.js`], { cwd: repoRoot, maxBuffer: 16 * 1024 * 1024 }).toString())); } catch { /* none documented */ }
  report.allowlist = { read_rpc_pattern: "get_user_permissions | rpc_get_*", app_documented_reads: [...extraRead].sort(), note: "app-documented reads are allowed but reported: their server-side read-only behaviour is not verifiable from the repository" };
  let where = { module: null, lens: null, flag_state: null };
  // ---- 3. browser
  let chromium; try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { return stop(3, "NOT_TESTED", "Playwright is not installed (npm i playwright && npx playwright install chromium)"); }
  const backendOrigin = o.backendOrigin || PRODUCTION_BACKEND;
  const browser = await chromium.launch({ args: process.getuid?.() === 0 || o.noSandbox ? ["--no-sandbox"] : [] });
  let aborted = false;
  const settle = o.selfTest ? { idle: 1200, wait: 250, ready: 6000 } : { idle: 8000, wait: 800, ready: 25000 };   // hosted pages need real settle time; the local fake does not
  const names = report.requests;
  const mkContext = async (flagsOn, width) => {
    const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, serviceWorkers: "block", ...(o.storageState ? { storageState: path.resolve(o.storageState) } : {}) });
    await context.addInitScript(({ on, all }) => { try { for (const k of Object.keys(localStorage)) if (/^COSTING_.*_V1$/.test(k) || all.includes(k)) localStorage.removeItem(k); for (const f of on) localStorage.setItem(f, "1"); } catch { /* storage unavailable */ } }, { on: flagsOn, all: FLAGS });
    await context.route("**/*", (route) => {
      const req = route.request();
      const c = classifyRequest({ method: req.method(), url: req.url() }, { baseOrigin: url.origin, backendOrigin, extraRead });
      if (c.allowed) { if (c.name) { const k = `${c.kind}:${c.name}`; names[k] = (names[k] ?? 0) + 1; if (c.kind === "rpc-read-app-documented" && !report.findings.some((f) => f.type === "APP_READ_RPC_UNVERIFIED_SERVER_SIDE" && f.name === c.name)) report.findings.push({ type: "APP_READ_RPC_UNVERIFIED_SERVER_SIDE", name: c.name, where: { ...where }, note: "allowed because the app documents it as a read RPC; confirm read-only by live read-back" }); } return route.continue(); }
      report.violations.push({ where: { ...where }, kind: c.kind, name: c.name ?? null, method: req.method(), target: safeUrl(req.url()), reason: c.reason, class: c.violation ? "VIOLATION" : "BLOCKED" });
      if (c.violation) aborted = true;
      return route.abort("blockedbyclient");
    });
    if (o.selfTest && o.testHooks?.onContext) await o.testHooks.onContext(context);
    return context;
  };
  try {
    // ---- 4. identity proof BEFORE any module is exercised
    where = { module: "costing-control-center", lens: "(identity proof)", flag_state: "OFF" };
    dbg("browser launched"); const ctx0 = await mkContext([], 1280); const p0 = await ctx0.newPage();
    await p0.goto(`${url.origin}/shared/costing-control-center.html`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await p0.waitForTimeout(1500);
    let proof = null;
    try {
      proof = await p0.evaluate(async () => { const m = await import("/shared/js/supabaseClient.js"); const s = (await m.supabase.auth.getSession())?.data?.session; if (!s?.user?.id) return { uid: null, rows: null };
        const r = await m.supabase.rpc("get_user_permissions", { p_user_id: s.user.id }); return { uid: s.user.id, rows: r?.data ?? null }; });
    } catch (e) { proof = { uid: null, rows: null, error: redact(e.message, 120) }; }
    await ctx0.close();
    if (aborted) { report.reasons.push("a non-read request was attempted during identity proof"); return finalise(4, "FAILED_SECURITY"); }
    const idv = evaluateIdentity({ label: o.identity, sessionRows: proof?.rows, canonicalRows: canonical?.rows });
    if (idv.ok && canonical?.user_id_sha256_12 && proof?.uid && canonical.user_id_sha256_12 !== sha12(proof.uid)) { idv.ok = false; idv.failures.push("canonical extract is for a different user than the signed-in session"); }
    report.identity = { label: o.identity, ok: idv.ok, user_ref: proof?.uid ? sha12(proof.uid) : null, summary: idv.summary, failures: idv.failures };
    if (!idv.ok) { report.reasons.push("identity not proven: " + idv.failures.join("; ")); return finalise(3, "NOT_TESTED"); }

    dbg("identity proven");
    // ---- 5. matrix
    const widths = o.widths ?? [1280, 390];
    const smoke = o.matrix === "smoke";   // test-sized: Control Center only (default lens OFF, then all eleven flags ON); never enough for acceptance
    const mods = smoke ? [MODULES[0]] : MODULES;
    const inventories = {};
    const observe = async (mod, lens, flagState, flagsOn, width, extra = {}) => {
      if (aborted) return null;
      const ctx = await mkContext(flagsOn, width); const page = await ctx.newPage();
      const pageErrors = []; page.on("pageerror", (e) => pageErrors.push(redact(e.message, 160))); page.on("console", (m) => { if (m.type() === "error") pageErrors.push(redact(m.text(), 160)); });
      const before = report.violations.length; const t0 = Date.now(); where = { module: mod.key, lens: lens ?? "(default)", flag_state: flagState };
      const q = lens ? `?${mod.param}=${encodeURIComponent(lens)}` : "";
      const ob = { module: mod.key, lens: lens ?? "(default)", flag_state: flagState, flags_on: flagsOn.length, width, ...extra, ready: false };
      try {
        await page.goto(`${url.origin}/shared/${mod.page}.html${q}`, { waitUntil: "domcontentloaded", timeout: 45000 });
        await page.waitForSelector("#lensPills [data-lens], [data-pricing-policy-workspace]", { state: "attached", timeout: settle.ready }); ob.ready = true;   // attached, not visible: at 390 px navigation collapses to a select
      } catch { /* recorded as not ready */ }
      await page.waitForLoadState("networkidle", { timeout: settle.idle }).catch(() => {}); await page.waitForTimeout(settle.wait);
      if (extra.selectPeriod && ob.ready) { const has = await page.evaluate((v) => !!document.querySelector(`#costingPeriodSelect option[value="${v}"]`), extra.selectPeriod).catch(() => false);
        const ok = has ? await page.locator("#costingPeriodSelect").selectOption(extra.selectPeriod, { timeout: 4000 }).then(() => true).catch(() => false) : false;
        ob.period_selected = ok; if (!ok) report.skipped.push(`${mod.key}: period ${extra.selectPeriod} not selectable (option absent or select failed): period-label evidence NOT TESTED`); await page.waitForLoadState("networkidle", { timeout: settle.idle }).catch(() => {}); await page.waitForTimeout(settle.wait); }
      const d = await page.evaluate((verbs) => {
        const re = new RegExp(verbs, "i"); const vis = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) && getComputedStyle(el).visibility !== "hidden";
        const rows = [...document.querySelectorAll("table tbody tr")].filter((tr) => tr.querySelectorAll("td").length > 1 && !/^\s*(No |0 rows|Loading)/i.test(tr.innerText)).length;
        return { h1: (document.querySelector("h1")?.textContent || "").trim().slice(0, 80), rows, flagKeys: Object.keys(localStorage).filter((k) => /^COSTING_.*_V1$/.test(k)).sort(),
          lensIds: [...document.querySelectorAll("#lensPills [data-lens]")].map((n) => n.dataset.lens).concat([...document.querySelectorAll("[data-pricing-policy-workspace]")].map((n) => n.dataset.pricingPolicyWorkspace)),
          banners: [...document.querySelectorAll('[role="alert"], .alert, .error-banner, .cp-error, .status-error, .notice-error')].map((n) => n.innerText).filter(Boolean).slice(0, 4),
          period: document.querySelector("#costingPeriodSelect")?.value ?? null, runChips: [...document.querySelectorAll(".sc-run-status")].map((n) => n.innerText).filter(Boolean).slice(0, 3),
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          controls: [...document.querySelectorAll("button, a[role=button], input[type=submit]")].map((el) => ({ text: (el.innerText || el.value || el.getAttribute("aria-label") || "").trim().slice(0, 50), disabled: !!(el.disabled || el.getAttribute("aria-disabled") === "true"), visible: vis(el) })).filter((c) => c.text && re.test(c.text)) };
      }, FORBIDDEN_UI_VERBS.source);
      Object.assign(ob, { h1: redact(d.h1, 80), rows: d.rows, banners: d.banners.map((b) => redact(b, 140)), period: d.period, run_labels: d.runChips.map((x) => redact(x, 160)), overflow_px: d.overflow,
        write_controls: d.controls.map((c) => ({ text: redact(c.text, 50), enabled: !c.disabled, visible: c.visible })), flags_read_back: d.flagKeys, console_errors: [...new Set(pageErrors)].slice(0, 6) });
      if (flagState === "OFF" && !extra.selectPeriod) inventories[mod.key] = [...new Set(d.lensIds)];
      ob.lens_ids = d.lensIds.length;
      if (o.screenshots && ob.ready) { fs.mkdirSync(path.join(outAbs, "shots"), { recursive: true }); const f = `${mod.key}-${lens ?? "default"}-${flagState}-${width}${extra.selectPeriod ? "-" + extra.selectPeriod : ""}.png`; await page.screenshot({ path: path.join(outAbs, "shots", f) }); ob.screenshot = "shots/" + f; }
      const sameFlags = JSON.stringify(d.flagKeys) === JSON.stringify([...flagsOn].sort());
      const enabledWrite = d.controls.filter((c) => c.visible && !c.disabled);
      const restricted = d.banners.some((b) => /restricted|not authori[sz]ed|permission/i.test(b));
      const newViol = report.violations.length - before;
      ob.claims = {
        host: report.build.verdict === "VERIFIED" && report.build.hosted_proof ? "PASS" : "NOT TESTED",
        // For ID-N a module that does not render is the CORRECT outcome (denied); chrome alone is never a data pass.
        flag: sameFlags ? "PASS" : "FAIL", module: ob.ready && d.h1 ? "PASS" : o.identity === "ID-N" ? "PASS (not rendered: denied)" : "FAIL",
        render: !ob.ready && o.identity === "ID-N" ? "NOT TESTED (not rendered)" : ob.ready && d.overflow <= 1 && !pageErrors.length ? "PASS" : "FAIL",
        data: o.identity === "ID-N" ? (d.rows === 0 ? "PASS (denied)" : "FAIL (data visible to ID-N)") : d.rows > 0 ? "PASS" : restricted ? "RESTRICTED (server role; not a pass)" : "NOT TESTED (no rows)",
        security: newViol === 0 && (o.identity === "ID-N" || enabledWrite.length === 0) ? "PASS" : "FAIL" };
      if (enabledWrite.length) report.findings.push({ type: "WRITE_CONTROL_ENABLED", module: mod.key, lens: ob.lens, flag_state: flagState, width, controls: enabledWrite.map((c) => redact(c.text, 40)).slice(0, 5) });
      if (process.env.ACCEPT_DEBUG) console.error(`[obs ${((Date.now() - t0) / 1000).toFixed(1)}s] ${mod.key} ${lens ?? "(default)"} ${flagState} ${width} ready=${ob.ready} rows=${d.rows}`);
      report.observations.push(ob); await ctx.close(); return ob;
    };
    const stateOff = (mod, lens, w, extra) => observe(mod, lens, "OFF", [], w, extra);
    // 5a. OFF: discover ids on the default page, then every lens/workspace at every width
    for (const mod of mods) {
      if (aborted) break;
      await stateOff(mod, mod.defaultLens, widths[0]);
      const ids = inventories[mod.key] ?? []; report.inventory[mod.key] = { expected: mod.expect, found: ids.length, ids };
      if (ids.length !== mod.expect) report.findings.push({ type: "LENS_INVENTORY_MISMATCH", module: mod.key, expected: mod.expect, found: ids.length });
      if (o.matrix === "minimal" || smoke) { report.skipped.push(`${mod.key}: lenses beyond the default (matrix=${o.matrix})`); continue; }
      for (const id of ids) for (const w of widths) { if (aborted) break; if (id === mod.defaultLens && w === widths[0]) continue; await stateOff(mod, id, w); }
    }
    // 5b. period switch (default lens, OFF)
    if (smoke) report.skipped.push("period switch (matrix=smoke)");
    else for (const mod of MODULES) for (const period of o.periods ?? ["2026-11-01", "2026-10-01"]) { if (aborted) break; await observe(mod, mod.defaultLens, "OFF", [], widths[0], { selectPeriod: period }); }
    // 5c. other flag states: NAV only, REVIEW_WORKLIST only, all eleven
    if (smoke) { await observe(MODULES[0], MODULES[0].defaultLens, "ALL_ON", [...FLAGS], widths[0]); report.skipped.push("flag states NAV_ONLY, WORKLIST_ONLY (matrix=smoke)"); }
    else if (o.matrix !== "minimal") {
      for (const [label, on] of [["NAV_ONLY", ["COSTING_NAV_GROUPS_V1"]], ["ALL_ON", [...FLAGS]]]) for (const mod of MODULES) for (const w of widths) { if (aborted) break; await observe(mod, mod.defaultLens, label, on, w); }
      for (const w of widths) { if (aborted) break; await observe(MODULES[0], "sku-control-status", "WORKLIST_ONLY", ["COSTING_REVIEW_WORKLIST_V1"], w); }
    } else report.skipped.push("flag states NAV_ONLY, WORKLIST_ONLY, ALL_ON (matrix=minimal)");
    // 5d. restoration proof: a context with the OFF init must show no Costing flag key
    const ctxR = await mkContext([], 1280); const pr = await ctxR.newPage(); await pr.goto(`${url.origin}/shared/costing-control-center.html`, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
    report.flags_restored = (await pr.evaluate(() => Object.keys(localStorage).filter((k) => /^COSTING_.*_V1$/.test(k)).length).catch(() => -1)) === 0; await ctxR.close();
  } catch (e) { report.reasons.push("runner error: " + redact(e.message, 200)); return finalise(3, "NOT_TESTED"); }
  finally { await browser.close().catch(() => {}); }   // every exit path, including early refusals, closes Chromium

  // ---- 6. verdict (truthful)
  const fails = report.observations.filter((x) => Object.values(x.claims).some((v) => String(v).startsWith("FAIL")));
  const noData = report.observations.filter((x) => String(x.claims.data).startsWith("NOT TESTED"));
  report.summary = { observations: report.observations.length, claim_failures: fails.length, no_data: noData.length, restricted: report.observations.filter((x) => String(x.claims.data).startsWith("RESTRICTED")).length, findings: report.findings.length, violations: report.violations.filter((v) => v.class === "VIOLATION").length, blocked: report.violations.filter((v) => v.class === "BLOCKED").length };
  if (report.summary.violations) return finalise(4, "FAILED_SECURITY");
  if (fails.length || report.findings.length || report.flags_restored === false) return finalise(1, "COMPLETED_WITH_FINDINGS");
  if (noData.length) return finalise(1, "COMPLETED_RENDER_ONLY");
  return finalise(0, "COMPLETED_CLEAN");

  function finalise(code, verdict) { report.exit_code = code; report.verdict = verdict; return finish(report, o); }
}

function finish(report, o) {
  if (report.evidence_class === "LOCAL_SELF_TEST") report.verdict = "SELF_TEST_" + report.verdict;
  report.hosted_claims = report.evidence_class === "HOSTED" && report.build?.verdict === "VERIFIED" ? "EXERCISED" : "NOT TESTED";
  report.finished_at = new Date().toISOString();
  const outDirOk = o.out && !(insideRepo(path.resolve(o.out)) && !gitIgnored(path.resolve(o.out) + path.sep + "x"));   // never write evidence into a committable location, even when refusing
  if (!outDirOk && o.out) report.reasons.push("report NOT written: --out is inside the repository and not git-ignored");
  if (outDirOk) {
    const dir = path.resolve(o.out);
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "report.json"), JSON.stringify(report, null, 1));
      const lines = [`# Acceptance run: ${report.verdict}`, "", `**Evidence class: ${report.evidence_class}.** ${report.evidence_class === "LOCAL_SELF_TEST" ? "This is a runner self-test against a local fake backend. It is NOT acceptance evidence for any hosted build." : ""}`, "", STATEMENT, "",
        `- Target: ${report.base}`, `- Commit: ${report.git_sha}`, `- Identity: ${report.identity_label} (${report.identity?.ok ? "proven" : "NOT proven"})`, `- Build verification: ${report.build?.verdict ?? "not run"}; cache ${report.build?.served_cache_name ?? "?"}; bundle ${report.build?.served_bundle_digest?.slice(0, 16) ?? "?"}`,
        `- Hosted claims: ${report.hosted_claims}`, `- Flags restored: ${report.flags_restored}`, ...(report.reasons.length ? ["", "## Reasons", ...report.reasons.map((r) => "- " + r)] : []),
        ...(report.summary ? ["", "## Summary", "```", JSON.stringify(report.summary), "```"] : []), ...(report.violations.length ? ["", "## Blocked/violating requests", ...report.violations.map((v) => `- ${v.class} ${v.method} ${v.kind} ${v.name ?? ""} ${v.reason ?? ""}`)] : []),
        ...(report.findings.length ? ["", "## Findings", ...report.findings.map((f) => "- " + JSON.stringify(f))] : []), ...(report.skipped.length ? ["", "## Not run", ...report.skipped.map((s) => "- " + s)] : [])];
      fs.writeFileSync(path.join(dir, "report.md"), lines.join("\n") + "\n");
    } catch { /* report write failure must not mask the verdict */ }
  }
  return report;
}

function cli(argv) {
  const a = argv.slice(2); const opt = (n) => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : null; };
  runAcceptance({ base: opt("--base"), sha: opt("--sha"), identity: opt("--identity"), storageState: opt("--storage-state"), canonicalProof: opt("--canonical-proof"), out: opt("--out"), matrix: opt("--matrix") ?? "standard",
    buildProof: opt("--build-proof"), backendOrigin: opt("--backend-origin"), screenshots: a.includes("--screenshots"), selfTest: a.includes("--allow-local-self-test"), noSandbox: a.includes("--no-sandbox") })
    .then((r) => { console.log(`${r.verdict} [${r.evidence_class}] observations=${r.observations.length} violations=${r.violations.length}`); for (const x of r.reasons) console.log("  - " + x); process.exit(r.exit_code); });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) cli(process.argv);
