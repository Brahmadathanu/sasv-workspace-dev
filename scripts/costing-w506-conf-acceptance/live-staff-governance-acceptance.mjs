// WP05 W5-06: operator-controlled, read-only live Staff Governance acceptance.
// Never accepts a password/JWT or logs row bodies. Captured Playwright storage-state + canonical proof MUST stay outside repo.
// Run one identity per invocation: --role cbm-view|csr-view|cbm-editor --storage-state FILE --canonical-proof FILE --out FILE
// Exit 0 clean | 1 failed checks | 2 usage | 3 not tested | 4 unsafe request.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { classifyRequest } from "../costing-acceptance/lib/allowlist.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BASE = "https://sasv-utilities-hub.netlify.app";
const BACKEND = "https://qhmoqtxpeasamtlxaoak.supabase.co";
const TARGET = "module:cost-build-manager";
const CSR = "module:cost-sheet-review";
const VIEWS = Object.freeze(["v_costing_staff_classification_register", "v_costing_unclassified_staff_for_costing"]);
const sha12 = s => crypto.createHash("sha256").update(s).digest("hex").slice(0, 12);
const outsideRepo = p => { const x = path.resolve(p); return x !== ROOT && !x.startsWith(ROOT + path.sep); };
const rowsKey = r => [r.target, r.can_view === true, r.can_edit === true].join("|");

export function verifyIdentity(role, sessionRows, canonicalRows) {
  if (!["cbm-view", "csr-view", "cbm-editor"].includes(role) ||
      !Array.isArray(sessionRows) || !Array.isArray(canonicalRows)) return false;
  const valid = xs => xs.every(x => x && typeof x.target === "string" &&
      typeof x.can_view === "boolean" && typeof x.can_edit === "boolean");
  if (!valid(sessionRows) || !valid(canonicalRows)) return false;
  const a = sessionRows.map(rowsKey).sort(), b = canonicalRows.map(rowsKey).sort();
  if (JSON.stringify(a) !== JSON.stringify(b)) return false;
  const can = (t, prop) => sessionRows.some(x => x.target === t && x[prop] === true);
  if (role === "cbm-view") return can(TARGET, "can_view") && !can(TARGET, "can_edit");
  if (role === "csr-view") return can(CSR, "can_view") && !can(TARGET, "can_view") && !can(TARGET, "can_edit");
  return can(TARGET, "can_view") && can(TARGET, "can_edit");
}

export function evaluateCounts(role, x) {
  if (!x || !Number.isInteger(x.register) || !Number.isInteger(x.review) ||
      !Number.isInteger(x.pool) || !Number.isInteger(x.details)) return false;
  if (role === "cbm-editor") return x.register > 0 && x.review >= 0 && x.pool > 0 && x.details > 0;
  return x.register === 0 && x.review === 0 && x.pool > 0 && x.details === 0;
}

export function evaluateUiRequests(role, urls) {
  if (!Array.isArray(urls)) return false;
  return urls.every(value => {
    let u; try { u = new URL(value); } catch { return false; }
    if (u.origin !== BACKEND) return false;
    const name = u.pathname.split("/").at(-1);
    if (!VIEWS.includes(name) && name !== "v_costing_staff_cost_pool_summary") return false;
    if (role !== "cbm-editor" && VIEWS.includes(name)) return false;
    const select = u.searchParams.get("select");
    if (select === null || select.includes("*")) return false;
    // Approved editor may request loaded total_salary_cost and salary_source_note; component salaries and nested details remain prohibited.
    if (/basic_salary|allowance_amount|employer_contribution|other_salary_cost|staff_details/i.test(select)) return false;
    if (role !== "cbm-editor" && /total_salary_cost|salary_source_note/i.test(select)) return false;
    return true;
  });
}

function opts(argv) {
  const read = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : ""; };
  return { role: read("--role"), storage: read("--storage-state"), proof: read("--canonical-proof"), out: read("--out") };
}
const inRepo = p => !outsideRepo(p);

export async function run(o, dependencies = {}) {
  const result = { kind: "WP05_W506_AUTHENTICATED_ACCEPTANCE", verdict: "NOT_TESTED",
    role: o.role, timestamp: new Date().toISOString(), checks: {}, findings: [] };
  const save = code => {
    result.verdict = code === 0 ? "PASS" : code === 4 ? "FAILED_SECURITY" : code === 1 ? "FAIL" : "NOT_TESTED";
    if (o.out && outsideRepo(o.out)) {
      fs.mkdirSync(path.dirname(path.resolve(o.out)), { recursive: true });
      fs.writeFileSync(o.out, JSON.stringify(result, null, 2) + "\n", { mode: 0o600 });
    }
    return code;
  };
  if (!["cbm-view","csr-view","cbm-editor"].includes(o.role) || !o.storage || !o.proof || !o.out) return save(2);
  if ([o.storage,o.proof,o.out].some(inRepo)) return save(3);
  if (![o.storage,o.proof].every(f => fs.existsSync(f) &&
      (process.platform === "win32" || (fs.statSync(f).mode & 0o077) === 0))) return save(3);
  let canonical;
  try { canonical = JSON.parse(fs.readFileSync(o.proof, "utf8")); } catch { return save(3); }
  if (!canonical || !/^[0-9a-f]{12}$/.test(canonical.user_id_sha256_12 || "") ||
      !Array.isArray(canonical.rows)) return save(3);
  let browser;
  let unsafe = false;
  const uiViewCalls = [];
  const playwright = dependencies.playwright ?? createRequire(import.meta.url)("playwright");
  try {
    browser = await playwright.chromium.launch({ headless: true });
    const ctx = await browser.newContext({ storageState: path.resolve(o.storage), serviceWorkers: "block" });
    let phase = "ui";
    await ctx.route("**/*", route => {
      const req = route.request(), u = new URL(req.url());
      const allowed = classifyRequest({ method: req.method(), url: req.url() },
        { baseOrigin: BASE, backendOrigin: BACKEND });
      if (!allowed.allowed) {
        unsafe = true; result.findings.push("NON_READ_OR_UNRECOGNISED_REQUEST_BLOCKED");
        return route.abort("blockedbyclient");
      }
      if (phase === "ui" && u.origin === BACKEND && u.pathname.startsWith("/rest/v1/") &&
          VIEWS.concat("v_costing_staff_cost_pool_summary").includes(u.pathname.split("/").at(-1))) uiViewCalls.push(u.href);
      return route.continue();
    });
    const page = await ctx.newPage();
    const isCsr = o.role === "csr-view";
    const pageRoute = isCsr ? "/shared/cost-sheet-review.html" : "/shared/cost-build-manager.html?lens=staff-governance";
    await page.goto(BASE + pageRoute, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(2200);
    const hasPage = await page.evaluate(expected => document.body.textContent.includes(expected),
      isCsr ? "Cost Sheet Review" : "Staff Governance");
    result.checks.authorised_module_ui_visible = hasPage;
    phase = "probe";
    const proof = await page.evaluate(async () => {
      const m = await import("/shared/js/supabaseClient.js");
      const sess = (await m.supabase.auth.getSession())?.data?.session;
      if (!sess?.user?.id) return { signed: false };
      const p = await m.supabase.rpc("get_user_permissions", { p_user_id: sess.user.id });
      return { signed: p.error === null, uid: sess.user.id, rows: p.data };
    });
    if (unsafe) return save(4);
    if (!proof.signed || !verifyIdentity(o.role, proof.rows, canonical.rows) ||
        sha12(proof.uid) !== canonical.user_id_sha256_12) {
      result.findings.push("SESSION_OR_CANONICAL_IDENTITY_NOT_PROVEN"); return save(3);
    }
    result.checks.identity_verified = true;
    result.checks.ui_requests_safe = evaluateUiRequests(o.role, uiViewCalls);
    // All protected queries remain inside the browser and expose ONLY count/null booleans.
    const api = await page.evaluate(async role => {
      const m = await import("/shared/js/supabaseClient.js");
      const c = m.supabase, privileged = role === "cbm-editor";
      const head = async (view, col, nonNull = false) => {
        let q = c.from(view).select(col, { head: true, count: "exact" });
        if (nonNull) q = q.not(col, "is", null);
        const r = await q;
        return { ok: r.error === null, count: r.count };
      };
      const r = await head("v_costing_staff_classification_register", "staff_id");
      const v = await head("v_costing_unclassified_staff_for_costing", "staff_id");
      const p = await head("v_costing_staff_cost_pool_summary", "period_start");
      let d;
      if (privileged) d = await head("v_costing_staff_cost_pool_summary", "staff_details", true);
      else {
        const x = await c.from("v_costing_staff_cost_pool_summary").select("staff_details").limit(1);
        d = { ok: x.error === null && x.data?.length === 1 &&
                    x.data[0].staff_details === null, count: 0 };
      }
      return { ok: [r,v,p,d].every(x => x.ok), register: r.count, review: v.count,
        pool: p.count, details: d.count };
    }, o.role);
    if (unsafe) return save(4);
    result.checks.postgrest_head_and_masking = api.ok && evaluateCounts(o.role,api);
    result.checks.no_sensitive_body_export = true;
    return save(Object.values(result.checks).every(Boolean) ? 0 : 1);
  } catch {
    result.findings.push("BROWSER_OR_API_EXECUTION_FAILED");
    return save(unsafe ? 4 : 3);
  } finally {
    if (browser) await browser.close();
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run(opts(process.argv.slice(2))).then(c => { process.exitCode = c; }).catch(() => { process.exitCode = 3; });
}
