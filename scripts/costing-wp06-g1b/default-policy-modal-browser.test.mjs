// WP06-G1b: Commercial Sales Assumptions - governed default-policy revision modal (company and IK/OK regional).
// Chromium + the REAL Pricing Policy Manager page against an inert in-memory backend: no Supabase, no network, no
// writes. Test-only: no source change. The only write RPC this page may send from these flows is
// rpc_set_sales_allocation_default_policies_scoped; every call is recorded and asserted.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { startServer } from "../costing-responsive/responsive-audit.mjs";
import { loadController } from "../costing-nav-mcm-cbm/load-controller.mjs";

const csa = await loadController("costing-suite-commercial-sales-assumptions.js");
const PERIOD = "2026-10-01";
const URL_PATH = `shared/pricing-policy-manager.html?workspace=commercial-sales-assumptions&period_start=${PERIOD}`;

const STUB = `
const user = { id: "00000000-0000-0000-0000-000000000000", email: "mock@example.invalid" };
const session = { access_token: "stub", user };
const mock = (window.__mock = window.__mock || { rpc: [], from: [], mutations: [] });
const policies = [
  { id: 1, scenario_code: "NEW_SKU_EXISTING_PRODUCT", status: "APPROVED", default_sales_units: 12, effective_from: "2026-01-01", effective_to: null, approval_reference: "AP-1", reason: "base" },
  { id: 2, scenario_code: "NEW_PRODUCT_NO_HISTORY", status: "APPROVED", default_sales_units: 30, effective_from: "2026-01-01", effective_to: null, approval_reference: "AP-2", reason: "base" },
];
const regional = [
  { id: 11, scenario_code: "NO_POSITIVE_REGIONAL_HISTORY", region_code: "OK", status: "APPROVED", default_sales_units: 7, effective_from: "2026-01-01", effective_to: null, approval_reference: "AP-3", reason: "base" },
  { id: 12, scenario_code: "NO_POSITIVE_REGIONAL_HISTORY", region_code: "IK", status: "APPROVED", default_sales_units: 9, effective_from: "2026-01-01", effective_to: null, approval_reference: "AP-4", reason: "base" },
];
const previewFor = (a, ok = true) => ({ commit_allowed: ok, scope: a.p_scope, proposed_units: a.p_default_sales_units, proposed_effective_from: a.p_effective_from, target_count: 1,
  targets: [{ target_kind: a.p_anchor_kind, scenario_code: a.p_scenario_code, region_code: a.p_region_code, current_units: 10, proposed_units: a.p_default_sales_units, validation_ok: ok, validation_error: ok ? null : "Units below the governed minimum" }], warnings: [] });
window.__h = {
  rpc_get_sales_allocation_default_policies: () => policies,
  rpc_get_regional_sales_allocation_default_policies: () => regional,
  rpc_preview_sales_allocation_default_policy_scope: (a) => previewFor(a, !window.__previewInvalid),
  rpc_set_sales_allocation_default_policies_scoped: () => (window.__saveError ? { __error: window.__saveError } : null),
};
function chain(view) {
  const eq = {}; let single = false; let offset = 0;
  const result = () => { let rows = (window.__views || {})[view] ?? []; for (const [k, v] of Object.entries(eq)) rows = rows.filter((r) => String(r[k]) === String(v)); if (offset > 0) rows = []; return { data: single ? (rows[0] ?? null) : rows, error: null }; };
  const proxy = new Proxy(function () {}, { get(_t, p) {
    if (p === "then") return (res, rej) => Promise.resolve(result()).then(res, rej);
    if (p === "catch" || p === "finally") return () => proxy;
    if (["insert", "update", "upsert", "delete"].includes(p)) return () => { mock.mutations.push({ view, verb: p }); return proxy; };
    if (p === "eq") return (c, v) => { eq[c] = v; return proxy; };
    if (p === "maybeSingle" || p === "single") return () => { single = true; return proxy; };
    if (p === "range") return (a) => { offset = Number(a) || 0; return proxy; };
    return () => proxy; }, apply: () => proxy });
  return proxy;
}
export function createClient() {
  const client = {
    auth: { getSession: async () => ({ data: { session }, error: null }), getUser: async () => ({ data: { user }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), refreshSession: async () => ({ data: { session }, error: null }), signOut: async () => ({ error: null }) },
    from: (view) => { mock.from.push(view); return chain(view); },
    rpc: (name, args) => {
      mock.rpc.push({ name, args: JSON.parse(JSON.stringify(args ?? {})) });
      let data = [];
      if (name === "get_user_permissions") data = ["module:costing-control-center","module:material-cost-manager","module:cost-build-manager","module:pricing-policy-manager","module:cost-sheet-review","module:production-route-manager"].map((target) => ({ target, can_view: true, can_edit: window.__canEdit === true }));
      else if (window.__h[name]) data = window.__h[name](args ?? {});
      const finish = (d) => (d && d.__error ? { data: null, error: { message: d.__error } } : { data: d, error: null });
      const gate = name === "rpc_set_sales_allocation_default_policies_scoped" ? window.__saveGate : null;
      const p = gate ? gate.then(() => finish(data)) : Promise.resolve(finish(data));
      const q = { then: (a, b) => p.then(a, b), catch: (b) => p.catch(b), range: () => q, select: () => q, single: () => q, maybeSingle: () => q };
      return q;
    },
    schema: () => client, channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
  };
  return client;
}
`;

let env;
async function getEnv(t) {
  if (process.env.COSTING_G1B_SKIP_BROWSER === "1") { t.skip("COSTING_G1B_SKIP_BROWSER=1"); return null; }
  if (env) return env;
  let chromium;
  try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { t.skip("playwright not available"); return null; }
  const server = await startServer();
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  env = { browser, base: `http://127.0.0.1:${server.address().port}`, close: async () => { await browser.close(); server.close(); } };
  return env;
}
test.after(async () => { await env?.close(); });

async function open(e, { canEdit = true, width = 1280 } = {}) {
  const context = await e.browser.newContext({ viewport: { width, height: 900 } });
  await context.addInitScript((edit) => { window.__canEdit = edit; }, canEdit);
  await context.route(/cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net|esm\.sh/, (r) => {
    if (/esm\.sh\/@supabase\/supabase-js/.test(r.request().url())) return r.fulfill({ status: 200, contentType: "text/javascript", body: STUB });
    if (/\.css/.test(r.request().url())) return r.fulfill({ status: 200, contentType: "text/css", body: "" });
    return r.fulfill({ status: 200, contentType: "text/javascript", body: "" });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (x) => errors.push(String(x.message).slice(0, 200)));
  await page.goto(`${e.base}/${URL_PATH}`, { waitUntil: "load" });
  await page.waitForSelector("#csaDefaultsManageBtn", { timeout: 10000 });
  return { context, page, errors };
}
const rpcs = (page, name) => page.evaluate((n) => window.__mock.rpc.filter((c) => c.name === n), name);
const SAVE = "rpc_set_sales_allocation_default_policies_scoped";
const PREVIEW = "rpc_preview_sales_allocation_default_policy_scope";
async function openHub(page) { await page.click("#csaDefaultsManageBtn"); await page.waitForSelector("#csaDefaultsHubBody [data-csa-revise-scenario], #csaDefaultsHubBody .cp-csa-hub-scenario", { timeout: 5000 }); }
async function revise(page, kind, scenario, region) {
  const sel = `[data-csa-revise-kind="${kind}"][data-csa-revise-scenario="${scenario}"]${region ? `[data-csa-revise-region="${region}"]` : ""}`;
  await page.click(sel);
  await page.waitForSelector("#csaDefaultPolicyModal:not(.hidden)");
}
async function fillAndPreview(page, { units = "25", from = "2026-11-01", reason = "Owner approved revision", approval = "" } = {}) {
  await page.fill("#csaDefaultPolicyUnits", units);
  await page.fill("#csaDefaultPolicyEffectiveFrom", from);
  await page.fill("#csaDefaultPolicyReason", reason);
  await page.fill("#csaDefaultPolicyApproval", approval);
  await page.waitForFunction(() => window.__mock.rpc.some((c) => c.name === "rpc_preview_sales_allocation_default_policy_scope"), null, { timeout: 4000 });
  await page.waitForTimeout(150);
}

test("view-only: 'View Defaults', hub lists current policies, no Revise controls, no preview/save RPC", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const { context, page, errors } = await open(e, { canEdit: false });
  assert.equal((await page.locator("#csaDefaultsManageBtn").innerText()).trim(), "View Defaults");
  await openHub(page);
  assert.equal((await page.locator("#csaDefaultsHubTitle").innerText()).trim(), "View Governed Defaults");
  assert.equal(await page.locator("[data-csa-revise-scenario]").count(), 0);
  assert.match(await page.locator("#csaDefaultsHubBody").innerText(), /Outside Kerala \(OK\)/);
  assert.equal((await rpcs(page, PREVIEW)).length + (await rpcs(page, SAVE)).length, 0);
  assert.deepEqual(errors, []);
  await context.close();
});

test("editor: hub shows a Revise control for every company scenario and every regional scenario x IK/OK, with current units", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const { context, page } = await open(e);
  assert.equal((await page.locator("#csaDefaultsManageBtn").innerText()).trim(), "Manage Defaults");
  await openHub(page);
  assert.equal(await page.locator("[data-csa-revise-kind=company]").count(), csa.CSA_DEFAULT_SCENARIOS.length);
  assert.equal(await page.locator("[data-csa-revise-kind=regional]").count(), csa.CSA_REGIONAL_DEFAULT_SCENARIOS.length * csa.CSA_REGIONAL_DEFAULT_REGIONS.length);
  const text = await page.locator("#csaDefaultsHubBody").innerText();
  assert.match(text, /New SKU/);
  assert.match(text, /No positive regional sales quantity/);
  assert.match(text, /\b12\b/);
  assert.match(text, /No policy for this scenario\./, "scenarios without a policy are stated, not invented");
  await context.close();
});

test("company revise modal: title, hidden region, THIS_POLICY/ALL_COMPANY/ALL_LINKED scopes (first checked), Save disabled until a valid preview", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const { context, page } = await open(e);
  await openHub(page);
  await revise(page, "company", "NEW_PRODUCT_NO_HISTORY");
  assert.match(await page.locator("#csaDefaultPolicyTitle").innerText(), /Revise Default Policy — New Product/);
  assert.equal(await page.locator("#csaDefaultPolicyRegionWrap").evaluate((n) => n.hidden), true, "region wrapper is marked hidden for company policies (see F-8 for how it renders)");
  assert.equal(await page.locator("#csaDefaultPolicyRegion").inputValue(), "");
  assert.deepEqual(await page.locator('input[name="csaDefaultPolicyScope"]').evaluateAll((n) => n.map((x) => x.value)), csa.CSA_DEFAULT_POLICY_SCOPES_COMPANY);
  assert.equal(await page.locator('input[name="csaDefaultPolicyScope"]:checked').getAttribute("value"), "THIS_POLICY");
  assert.equal(await page.locator("#csaDefaultPolicySaveBtn").isDisabled(), true);
  assert.equal((await rpcs(page, PREVIEW)).length, 0, "no preview before units and date are valid");
  await context.close();
});

test("regional OK revise modal: title/region shown, four regional scopes, exact preview payload (REGIONAL, region OK) after debounce", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const { context, page } = await open(e);
  await openHub(page);
  await revise(page, "regional", "NO_POSITIVE_REGIONAL_HISTORY", "OK");
  assert.match(await page.locator("#csaDefaultPolicyTitle").innerText(), /Outside Kerala \(OK\)/);
  assert.equal(await page.locator("#csaDefaultPolicyRegion").inputValue(), "Outside Kerala (OK)");
  assert.deepEqual(await page.locator('input[name="csaDefaultPolicyScope"]').evaluateAll((n) => n.map((x) => x.value)), csa.CSA_DEFAULT_POLICY_SCOPES_REGIONAL);
  await fillAndPreview(page, { units: "25" });
  const previews = await rpcs(page, PREVIEW);
  assert.deepEqual(previews.at(-1).args, { p_anchor_kind: "REGIONAL", p_scenario_code: "NO_POSITIVE_REGIONAL_HISTORY", p_region_code: "OK", p_scope: "THIS_POLICY", p_default_sales_units: 25, p_effective_from: "2026-11-01" });
  assert.equal(await page.locator("#csaDefaultPolicySaveBtn").isDisabled(), false, "valid preview enables Save");
  assert.match(await page.locator("#csaDefaultPolicyImpactPreview").innerText(), /Impact preview/);
  await context.close();
});

test("invalid units never reach the server: empty, 0, 0.0 and negative produce no preview and keep Save disabled", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const { context, page } = await open(e);
  await openHub(page);
  await revise(page, "company", "NEW_SKU_EXISTING_PRODUCT");
  await page.fill("#csaDefaultPolicyEffectiveFrom", "2026-11-01");
  // The units field is <input type=number>: non-numeric text cannot be entered at all; the code path for NaN is covered by
  // the zero/negative/empty cases that reach the same guard.
  for (const bad of ["", "0", "-3", "0.0"]) {
    await page.fill("#csaDefaultPolicyUnits", bad);
    await page.dispatchEvent("#csaDefaultPolicyUnits", "input");
    await page.waitForTimeout(400);
    assert.equal(await page.locator("#csaDefaultPolicySaveBtn").isDisabled(), true, `units "${bad}"`);
  }
  assert.equal((await rpcs(page, PREVIEW)).length, 0);
  assert.equal((await rpcs(page, SAVE)).length, 0);
  await context.close();
});

test("scope change re-previews with the new scope; a preview that is not commit_allowed keeps Save disabled and shows the server validation error", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const { context, page } = await open(e);
  await openHub(page);
  await revise(page, "regional", "NO_POSITIVE_REGIONAL_HISTORY", "IK");
  await fillAndPreview(page);
  await page.check('input[name="csaDefaultPolicyScope"][value="ALL_REGIONAL"]');
  await page.waitForFunction(() => window.__mock.rpc.filter((c) => c.name === "rpc_preview_sales_allocation_default_policy_scope").length >= 2);
  const last = (await rpcs(page, PREVIEW)).at(-1).args;
  assert.equal(last.p_scope, "ALL_REGIONAL");
  assert.equal(last.p_region_code, "IK");
  await page.evaluate(() => { window.__previewInvalid = true; });
  await page.check('input[name="csaDefaultPolicyScope"][value="ALL_LINKED"]');
  await page.waitForFunction(() => window.__mock.rpc.filter((c) => c.name === "rpc_preview_sales_allocation_default_policy_scope").length >= 3);
  await page.waitForTimeout(150);
  assert.equal(await page.locator("#csaDefaultPolicySaveBtn").isDisabled(), true);
  assert.match(await page.locator("#csaDefaultPolicyImpactPreview").innerText(), /Units below the governed minimum/);
  assert.equal((await rpcs(page, SAVE)).length, 0);
  await context.close();
});

test("save (company): exact scoped payload (COMPANY, null region), the preview is re-run before commit, modal closes, hub stays, policies are re-read", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const { context, page, errors } = await open(e);
  await openHub(page);
  await revise(page, "company", "NEW_SKU_EXISTING_PRODUCT");
  await fillAndPreview(page, { units: "40", from: "2026-11-01", reason: "  Owner approved revision  ", approval: " AP-9 " });
  await page.check('input[name="csaDefaultPolicyScope"][value="ALL_COMPANY"]');
  await page.waitForTimeout(500);
  const previewsBefore = (await rpcs(page, PREVIEW)).length;
  const readsBefore = (await rpcs(page, "rpc_get_sales_allocation_default_policies")).length;
  await page.click("#csaDefaultPolicySaveBtn");
  await page.waitForSelector("#csaDefaultPolicyModal.hidden", { state: "attached" });
  await page.waitForTimeout(400);
  const saves = await rpcs(page, SAVE);
  assert.equal(saves.length, 1);
  assert.deepEqual(saves[0].args, { p_anchor_kind: "COMPANY", p_scenario_code: "NEW_SKU_EXISTING_PRODUCT", p_region_code: null, p_scope: "ALL_COMPANY", p_default_sales_units: 40, p_effective_from: "2026-11-01", p_reason: "Owner approved revision", p_approval_reference: "AP-9" });
  assert.equal((await rpcs(page, PREVIEW)).length, previewsBefore + 1, "preview re-run at commit time");
  assert.ok((await rpcs(page, "rpc_get_sales_allocation_default_policies")).length > readsBefore, "policies re-read after save");
  assert.equal(await page.locator("#csaDefaultsHubModal.hidden").count(), 0, "hub remains open");
  assert.equal((await page.evaluate(() => window.__mock.mutations)).length, 0);
  assert.deepEqual(errors, []);
  await context.close();
});

test("save (regional OK): exact REGIONAL payload with region OK and the chosen scope; empty approval is null", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const { context, page } = await open(e);
  await openHub(page);
  await revise(page, "regional", "NO_POSITIVE_REGIONAL_HISTORY", "OK");
  await fillAndPreview(page, { units: "18", from: "2026-12-01", reason: "Regional planning fallback" });
  await page.check('input[name="csaDefaultPolicyScope"][value="SAME_REGION_LINKED"]');
  await page.waitForTimeout(500);
  await page.click("#csaDefaultPolicySaveBtn");
  await page.waitForSelector("#csaDefaultPolicyModal.hidden", { state: "attached" });
  const saves = await rpcs(page, SAVE);
  assert.equal(saves.length, 1);
  assert.deepEqual(saves[0].args, { p_anchor_kind: "REGIONAL", p_scenario_code: "NO_POSITIVE_REGIONAL_HISTORY", p_region_code: "OK", p_scope: "SAME_REGION_LINKED", p_default_sales_units: 18, p_effective_from: "2026-12-01", p_reason: "Regional planning fallback", p_approval_reference: null });
  await context.close();
});

test("a missing reason is refused client-side ('Reason is required.') and sends no write", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const { context, page } = await open(e);
  await openHub(page);
  await revise(page, "company", "NEW_SKU_EXISTING_PRODUCT");
  await fillAndPreview(page, { reason: "x" });
  await page.fill("#csaDefaultPolicyReason", "   ");
  await page.click("#csaDefaultPolicySaveBtn");
  await page.waitForTimeout(300);
  assert.equal((await page.locator("#csaDefaultPolicyError").innerText()).trim(), "Reason is required.");
  assert.equal((await rpcs(page, SAVE)).length, 0);
  assert.equal(await page.locator("#csaDefaultPolicyModal:not(.hidden)").count(), 1, "modal stays open for correction");
  await context.close();
});

test("if the commit-time preview is no longer commit_allowed the save is refused with the incomplete-preview message and nothing is written", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const { context, page } = await open(e);
  await openHub(page);
  await revise(page, "company", "NEW_SKU_EXISTING_PRODUCT");
  await fillAndPreview(page);
  await page.evaluate(() => { window.__previewInvalid = true; });
  await page.click("#csaDefaultPolicySaveBtn");
  await page.waitForTimeout(500);
  assert.match(await page.locator("#csaDefaultPolicyError").innerText(), /Impact preview is incomplete or invalid/);
  assert.equal((await rpcs(page, SAVE)).length, 0);
  await context.close();
});

test("server error on save: modal stays open with the server message, Save becomes usable again, a retry sends again", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const { context, page } = await open(e);
  await openHub(page);
  await revise(page, "regional", "NO_POSITIVE_REGIONAL_HISTORY", "OK");
  await fillAndPreview(page);
  await page.evaluate(() => { window.__saveError = "approval_reference required by policy"; });
  await page.click("#csaDefaultPolicySaveBtn");
  await page.waitForFunction(() => document.getElementById("csaDefaultPolicyError")?.textContent?.includes("approval_reference required"));
  assert.equal(await page.locator("#csaDefaultPolicyModal:not(.hidden)").count(), 1);
  assert.equal(await page.locator("#csaDefaultPolicySaveBtn").isDisabled(), false);
  await page.evaluate(() => { window.__saveError = null; });
  await page.click("#csaDefaultPolicySaveBtn");
  await page.waitForSelector("#csaDefaultPolicyModal.hidden", { state: "attached" });
  assert.equal((await rpcs(page, SAVE)).length, 2);
  await context.close();
});

test("double click while the save is pending sends exactly one write", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const { context, page } = await open(e);
  await openHub(page);
  await revise(page, "company", "NEW_SKU_EXISTING_PRODUCT");
  await fillAndPreview(page);
  await page.evaluate(() => { window.__saveGate = new Promise((r) => { window.__releaseSave = r; }); });
  await page.evaluate(() => { const b = document.getElementById("csaDefaultPolicySaveBtn"); b.click(); b.click(); });
  await page.waitForTimeout(500);
  assert.equal((await rpcs(page, SAVE)).length, 1);
  await page.evaluate(() => window.__releaseSave());
  await page.waitForSelector("#csaDefaultPolicyModal.hidden", { state: "attached" });
  assert.equal((await rpcs(page, SAVE)).length, 1);
  await context.close();
});

test("Escape closes the revise modal first, then the hub; Cancel discards the form and sends nothing", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const { context, page } = await open(e);
  await openHub(page);
  await revise(page, "company", "NEW_SKU_EXISTING_PRODUCT");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#csaDefaultPolicyModal.hidden").count(), 1);
  assert.equal(await page.locator("#csaDefaultsHubModal:not(.hidden)").count(), 1);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#csaDefaultsHubModal.hidden").count(), 1);
  await openHub(page);
  await revise(page, "company", "NEW_SKU_EXISTING_PRODUCT");
  await page.fill("#csaDefaultPolicyUnits", "99");
  await page.click("#csaDefaultPolicyCancelBtn");
  await revise(page, "company", "NEW_SKU_EXISTING_PRODUCT");
  assert.equal(await page.locator("#csaDefaultPolicyUnits").inputValue(), "", "form is reset on reopen");
  assert.equal((await rpcs(page, SAVE)).length, 0);
  await context.close();
});

test("only the documented RPC families are used in these flows: reads, one preview, one scoped save; no approval/decision/acceptance RPC and no table mutation", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const { context, page } = await open(e);
  await openHub(page);
  await revise(page, "company", "NEW_SKU_EXISTING_PRODUCT");
  await fillAndPreview(page);
  await page.click("#csaDefaultPolicySaveBtn");
  await page.waitForSelector("#csaDefaultPolicyModal.hidden", { state: "attached" });
  const names = [...new Set((await page.evaluate(() => window.__mock.rpc.map((c) => c.name))))].filter((n) => n !== "get_user_permissions");
  assert.ok(names.includes(SAVE) && names.includes(PREVIEW));
  assert.ok(names.every((n) => !/approve|decide|accept|finali[sz]e|supersede_approved/.test(n)), names.join(","));
  const writeLike = names.filter((n) => /^rpc_(set|create|update|close|submit|delete|upsert)/.test(n));
  assert.deepEqual(writeLike, [SAVE]);
  assert.deepEqual(await page.evaluate(() => window.__mock.mutations), []);
  await context.close();
});

test("CHARACTERISATION F-7 (pins today's behaviour; flip when fixed): closing the revise modal while its save is pending clears the in-flight flag, so a second save can be sent for the same target", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const { context, page } = await open(e);
  await openHub(page);
  await revise(page, "company", "NEW_SKU_EXISTING_PRODUCT");
  await fillAndPreview(page);
  await page.evaluate(() => { window.__saveGate = new Promise((r) => { window.__releaseSave = r; }); });
  await page.click("#csaDefaultPolicySaveBtn");
  await page.waitForFunction(() => window.__mock.rpc.some((c) => c.name === "rpc_set_sales_allocation_default_policies_scoped"));
  await page.click("#csaDefaultPolicyCancelBtn");            // user closes while the first write is still pending
  await revise(page, "company", "NEW_SKU_EXISTING_PRODUCT");
  await fillAndPreview(page, { units: "41" });
  await page.waitForTimeout(300);
  await page.click("#csaDefaultPolicySaveBtn");
  await page.waitForTimeout(500);
  const saves = await rpcs(page, SAVE);
  assert.equal(saves.length, 2, "today: two writes are in flight (finding F-7; a fix must make this 1)");
  assert.notEqual(saves[0].args.p_default_sales_units, saves[1].args.p_default_sales_units);
  await page.evaluate(() => window.__releaseSave());
  await context.close();
});

test("CHARACTERISATION F-8 (pins today's rendering; flip when the CSS is fixed): for a COMPANY policy the 'Region' field is marked hidden but still displays, because `.sign-grid label { display:flex }` overrides the [hidden] attribute", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const { context, page } = await open(e);
  await openHub(page);
  await revise(page, "company", "NEW_SKU_EXISTING_PRODUCT");
  const m = await page.locator("#csaDefaultPolicyRegionWrap").evaluate((n) => ({ hiddenProp: n.hidden, display: getComputedStyle(n).display }));
  assert.equal(m.hiddenProp, true);
  assert.notEqual(m.display, "none", "today: an empty read-only Region field is visible in the company modal (a fix must make this 'none')");
  await context.close();
});
