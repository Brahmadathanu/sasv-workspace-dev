// PRM Cost Centres: view-only users can read the register and detail; every mutation stays behind the edit gate.
// Chromium + the REAL Production Route Manager page and shell against an inert in-memory backend: no Supabase, no network,
// no writes, no flag change. The server permits read-only list/detail RPCs to view users; the client used the edit-gated
// helper for them (found in the authenticated PWA test, 5 Nov 2026) and now uses the unprivileged invoke() for reads only.
//
// Test seam (documented, asserted): to simulate losing the edit grant AFTER a modal is open, the served shell is patched in
// the test's own browser context so that canEditProductionRouteActions() also honours window.__prmEdit !== false. The patch
// is asserted to apply exactly once, so drift in the shell fails loudly instead of silently disabling the seam.
//
// Mock proof of client behaviour only; the live server permission contract is not exercised here.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { startServer } from "../costing-responsive/responsive-audit.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SHELL_JS = "public/shared/js/costing-suite-shell.js";
const SEAM_FROM = "function canEditProductionRouteActions() {\n  return PERM_CAN_EDIT === true;\n}";
const SEAM_TO = "function canEditProductionRouteActions() {\n  return PERM_CAN_EDIT === true && window.__prmEdit !== false;\n}";

const READ = ["rpc_get_production_cost_centres", "rpc_get_production_cost_centre_detail"];
const WRITE = {
  create: "rpc_create_production_cost_centre_draft",
  update: "rpc_update_production_cost_centre_draft",
  validate: "rpc_validate_production_cost_centre",
  approve: "rpc_approve_production_cost_centre",
  inactivate: "rpc_inactivate_production_cost_centre",
};
const WRITE_NAMES = Object.values(WRITE);
const WRITE_LIKE = /^rpc_(create|update|upsert|delete|submit|approve|accept|close|supersede|clone|set|apply|archive|retire|import|map|unmap|inactivate|cancel|correct|request|refresh|recalc|finali|lock|decide|generate|adjust|validate)/;

const stub = (canEdit) => `
const user = { id: "00000000-0000-0000-0000-000000000000", email: "mock@example.invalid" };
const session = { access_token: "stub", user };
const mock = (window.__mock = { rpc: [], mutations: [] });
const TARGETS = ["module:costing-control-center","module:material-cost-manager","module:cost-build-manager","module:pricing-policy-manager","module:cost-sheet-review","module:production-route-manager"];
const row = (id, code, status, valid) => ({ cost_centre_id: id, cost_centre_code: code, cost_centre_name: "Centre " + code, cost_centre_type: "PRODUCTION", status,
  validation: { valid, errors: valid ? [] : ["missing"] }, effective_from: "2026-11-01", default_resource_class_code: "LABOUR", pool_scope: "SECTION", description: "d" });
const ROWS = [row(11, "CC_DRAFT", "DRAFT", true), row(12, "CC_APPROVED", "APPROVED", true)];
function result(name, args) {
  if (name === "get_user_permissions") return TARGETS.map((target) => ({ target, can_view: true, can_edit: ${canEdit} }));
  if (name === "rpc_get_production_cost_centres") return { as_of_date: "2026-11-05", cost_centres: ROWS };
  if (name === "rpc_get_production_cost_centre_detail") return { cost_centre: ROWS.find((r) => r.cost_centre_id === Number(args?.p_cost_centre_id)) || ROWS[0] };
  if (name === "rpc_validate_production_cost_centre") return { valid: true, errors: [] };
  if (/^rpc_(approve|inactivate|create|update)_production_cost_centre/.test(name)) return { ok: true };
  return null;
}
function chain(view) {
  const proxy = new Proxy(function () {}, { get(_t, p) {
    if (p === "then") return (res, rej) => Promise.resolve({ data: [], error: null }).then(res, rej);
    if (p === "catch" || p === "finally") return () => proxy;
    if (["insert", "update", "upsert", "delete"].includes(p)) return () => { mock.mutations.push({ view, verb: p }); return proxy; };
    return () => proxy; }, apply: () => proxy });
  return proxy;
}
export function createClient() {
  const client = {
    auth: { getSession: async () => ({ data: { session }, error: null }), getUser: async () => ({ data: { user }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), refreshSession: async () => ({ data: { session }, error: null }), signOut: async () => ({ error: null }) },
    from: (view) => chain(view),
    rpc: (name, args) => {
      mock.rpc.push({ name, args: JSON.parse(JSON.stringify(args ?? {})) });
      const p = Promise.resolve({ data: result(name, args), error: null });
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
  if (process.env.COSTING_WP12_SKIP_BROWSER === "1") { t.skip("COSTING_WP12_SKIP_BROWSER=1"); return null; }
  if (env) return env;
  let chromium;
  try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { t.skip("playwright not available"); return null; }
  const server = await startServer();
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  env = { browser, base: `http://127.0.0.1:${server.address().port}`, close: async () => { await browser.close(); server.close(); } };
  return env;
}
test.after(async () => { await env?.close(); });

async function open(e, canEdit, width = 1280) {
  const context = await e.browser.newContext({ viewport: { width, height: 900 } });
  await context.route(/cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net|esm\.sh/, (r) => {
    if (/esm\.sh\/@supabase\/supabase-js/.test(r.request().url())) return r.fulfill({ status: 200, contentType: "text/javascript", body: stub(canEdit) });
    if (/\.css/.test(r.request().url())) return r.fulfill({ status: 200, contentType: "text/css", body: "" });
    return r.fulfill({ status: 200, contentType: "text/javascript", body: "" });
  });
  const src = fs.readFileSync(path.join(root, SHELL_JS), "utf8").replace(/\r\n/g, "\n");
  assert.equal(src.split(SEAM_FROM).length - 1, 1, "test seam anchor must occur exactly once in the shell");
  await context.route("**/js/costing-suite-shell.js", (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: src.replace(SEAM_FROM, SEAM_TO) }));
  const page = await context.newPage();
  const errors = [];
  const consoleBad = [];
  page.on("pageerror", (x) => errors.push(String(x.message).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") consoleBad.push(m.text().slice(0, 200)); });
  await page.goto(`${e.base}/shared/production-route-manager.html?lens=production-cost-centres`, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelectorAll("[data-prm-cost-centre-row]").length === 2, null, { timeout: 20000 });
  return { context, page, errors, consoleBad };
}
/** Fills the Create modal with the four fields the client requires, so an ungated call WOULD reach the server. */
async function fillCreate(page) {
  await page.fill("#prmCcCreateCode", "cc_new");
  await page.fill("#prmCcCreateName", "New centre");
  const value = await page.evaluate(() => [...document.querySelectorAll("#prmCcCreateType option")].map((o) => o.value).find((v) => v));
  assert.ok(value, "type options available");
  await page.selectOption("#prmCcCreateType", value);
}
const rpcNames = (page) => page.evaluate(() => window.__mock.rpc.map((x) => x.name));
const toasts = (page) => page.evaluate(() => [...document.querySelectorAll("[role=status], [role=alert], .toast, .sasv-toast")].map((n) => n.textContent.trim()).filter(Boolean));
const pageText = (page) => page.evaluate(() => document.body.innerText);

test("view-only: the register loads through the read gateway, detail opens, no write RPC, no edit-denied message, no mutation control", async (t) => {
  const e = await getEnv(t); if (!e) return;
  for (const width of [1280, 390]) {
    const { context, page, errors } = await open(e, "false", width);
    const afterList = await rpcNames(page);
    assert.ok(afterList.includes(READ[0]), `@${width}: list RPC called`);
    for (const id of [0, 1]) {
      await page.locator("[data-prm-cost-centre-row]").nth(id).click();
      await page.waitForSelector("[data-prm-cost-centre-detail]", { timeout: 10000 });
      assert.equal(await page.locator("[data-prm-cc-edit], [data-prm-cc-validate], [data-prm-cc-approve], [data-prm-cc-inactivate]").count(), 0, `@${width}: no mutation control in detail ${id}`);
      const title = await page.evaluate(() => document.querySelector("[data-prm-cost-centre-detail]").textContent);
      assert.match(title, /CC_(DRAFT|APPROVED)/);
      await page.keyboard.press("Escape");
      await page.waitForSelector("[data-prm-cost-centre-detail]", { state: "detached", timeout: 10000 });
    }
    const names = await rpcNames(page);
    const details = (await page.evaluate(() => window.__mock.rpc.filter((x) => x.name === "rpc_get_production_cost_centre_detail"))).map((x) => x.args.p_cost_centre_id);
    assert.deepEqual(details.sort(), [11, 12], `@${width}: detail RPC called for both rows`);
    assert.deepEqual(names.filter((n) => WRITE_NAMES.includes(n) || (WRITE_LIKE.test(n))), [], `@${width}: no write-like RPC`);
    assert.equal(await page.locator("[data-prm-create-cost-centre]").count(), 0, `@${width}: no Create control`);
    assert.doesNotMatch(await pageText(page), /Edit permission required|Unable to load Cost Centre/i, `@${width}`);
    assert.deepEqual(await page.evaluate(() => window.__mock.mutations), []);
    assert.deepEqual(errors, [], `@${width}: page errors`);
    await context.close();
  }
});

test("editor: detail shows the mutation controls, and create / validate / approve / inactivate each send exactly their one RPC", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const { context, page, errors } = await open(e, "true");
  // Create (all four required fields filled)
  await page.locator("[data-prm-create-cost-centre]").first().click();
  await page.waitForSelector("[data-prm-create-cost-centre-submit]");
  await fillCreate(page);
  await page.locator("[data-prm-create-cost-centre-submit]").click();
  await page.waitForFunction((n) => window.__mock.rpc.some((x) => x.name === n), WRITE.create, { timeout: 10000 });
  await page.waitForSelector("[data-prm-create-cost-centre-submit]", { state: "detached", timeout: 10000 });
  // DRAFT row: Edit, Validate, Approve
  await page.locator("[data-prm-cost-centre-row]").nth(0).click();
  await page.waitForSelector("[data-prm-cost-centre-detail]");
  for (const sel of ["[data-prm-cc-edit]", "[data-prm-cc-validate]", "[data-prm-cc-approve]"]) assert.equal(await page.locator(sel).count(), 1, sel);
  await page.locator("[data-prm-cc-validate]").click();
  await page.waitForFunction((n) => window.__mock.rpc.some((x) => x.name === n), WRITE.validate, { timeout: 10000 });
  await page.locator("[data-prm-cc-approve]").click();
  await page.waitForSelector("[data-prm-approve-cost-centre-submit]");
  await page.locator("[data-prm-approve-cost-centre-submit]").click();
  await page.waitForFunction((n) => window.__mock.rpc.some((x) => x.name === n), WRITE.approve, { timeout: 10000 });
  // APPROVED row: Inactivate
  await page.waitForTimeout(500);
  await page.locator("[data-prm-cost-centre-row]").nth(1).click();
  await page.waitForSelector("[data-prm-cc-inactivate]");
  await page.locator("[data-prm-cc-inactivate]").click();
  await page.waitForSelector("[data-prm-inactivate-cost-centre-submit]");
  await page.fill("#prmCcInactivateRef", "APPROVAL-REF-1");
  await page.locator("[data-prm-inactivate-cost-centre-submit]").click();
  await page.waitForFunction((n) => window.__mock.rpc.some((x) => x.name === n), WRITE.inactivate, { timeout: 10000 });
  const names = await rpcNames(page);
  for (const n of [WRITE.create, WRITE.validate, WRITE.approve, WRITE.inactivate]) assert.equal(names.filter((x) => x === n).length, 1, n);
  assert.deepEqual(errors, []);
  await context.close();
});

test("edit grant lost after a modal is open: all five mutation submits are denied at the gate and send no RPC", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const flip = (page) => page.evaluate(() => { window.__prmEdit = false; });
  const mutationCalls = (page) => page.evaluate((names) => window.__mock.rpc.filter((x) => names.includes(x.name)).map((x) => x.name), WRITE_NAMES);
  const cases = [
    ["create", async (page) => {
      await page.locator("[data-prm-create-cost-centre]").first().click();
      await page.waitForSelector("[data-prm-create-cost-centre-submit]");
      await fillCreate(page);
      await flip(page);
      await page.locator("[data-prm-create-cost-centre-submit]").click();
    }],
    ["update", async (page) => {
      await page.locator("[data-prm-cost-centre-row]").nth(0).click();
      await page.waitForSelector("[data-prm-cc-edit]");
      await page.locator("[data-prm-cc-edit]").click();
      await page.waitForSelector("[data-prm-edit-cost-centre-submit]");
      await flip(page);
      await page.locator("[data-prm-edit-cost-centre-submit]").click();
    }],
    ["validate", async (page) => {
      await page.locator("[data-prm-cost-centre-row]").nth(0).click();
      await page.waitForSelector("[data-prm-cc-validate]");
      await flip(page);
      await page.locator("[data-prm-cc-validate]").click();
    }],
    ["approve", async (page) => {
      await page.locator("[data-prm-cost-centre-row]").nth(0).click();
      await page.waitForSelector("[data-prm-cc-approve]");
      await page.locator("[data-prm-cc-approve]").click();
      await page.waitForSelector("[data-prm-approve-cost-centre-submit]");
      await flip(page);
      await page.locator("[data-prm-approve-cost-centre-submit]").click();
    }],
    ["inactivate", async (page) => {
      await page.locator("[data-prm-cost-centre-row]").nth(1).click();
      await page.waitForSelector("[data-prm-cc-inactivate]");
      await page.locator("[data-prm-cc-inactivate]").click();
      await page.waitForSelector("[data-prm-inactivate-cost-centre-submit]");
      await page.fill("#prmCcInactivateRef", "APPROVAL-REF-1");
      await flip(page);
      await page.locator("[data-prm-inactivate-cost-centre-submit]").click();
    }],
  ];
  for (const [name, drive] of cases) {
    const { context, page, errors } = await open(e, "true");
    await drive(page);
    await page.waitForTimeout(800);
    assert.deepEqual(await mutationCalls(page), [], `${name}: no mutation RPC after the grant was lost`);
    assert.deepEqual(await page.evaluate(() => window.__mock.mutations), [], `${name}: no table mutation`);
    assert.deepEqual(errors, [], `${name}: page errors`);
    await context.close();
  }
});

test("harness: the served shell seam applies exactly once and the read RPC names are the two allowlisted getters", () => {
  const src = fs.readFileSync(path.join(root, SHELL_JS), "utf8").replace(/\r\n/g, "\n");
  assert.equal(src.split(SEAM_FROM).length - 1, 1);
  const rpc = fs.readFileSync(path.join(root, "public/shared/js/costing-suite-production-route-rpc.js"), "utf8");
  for (const n of READ) assert.ok(rpc.includes(`${n}: Object.freeze`), n);
});
