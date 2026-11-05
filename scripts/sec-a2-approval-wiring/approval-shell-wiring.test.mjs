// SEC-A2 shell wiring (Chromium, real Control Center page, inert in-memory backend; no Supabase, no network, no writes).
// COSTING_APPROVAL_SCREEN_V1 is set only in the test context's own localStorage. A draft run is offered; the approval
// controller must be wired to the signed-in user's Costing Control Center edit grant:
//   view-only  -> no "Review for approval" button, an explanatory label, and NO preview RPC at all;
//   editor     -> the button is present and one click makes exactly one preview RPC (rpc_costing_preview_approval_impact);
//   non-boolean can_edit (e.g. the string "true") -> treated as view-only: only the boolean true grants.
// Mock proof of the client wiring only; the live server gate (SEC-A2 migration) is not exercised here.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { startServer } from "../costing-responsive/responsive-audit.mjs";

const PREVIEW = "rpc_costing_preview_approval_impact";
const stub = (canEdit) => `
const user = { id: "00000000-0000-0000-0000-000000000000", email: "mock@example.invalid" };
const session = { access_token: "stub", user };
const mock = (window.__mock = { rpc: [], mutations: [] });
const RUNS = [{ refresh_run_id: 151, period_start: "2026-11-01", display_status: "Draft", display_label: "Draft", overall_status: "SUCCESS" }];
function chain(view) {
  let single = false;
  const rows = () => view === "v_costing_pricing_run_display_status" ? RUNS : [];
  const proxy = new Proxy(function () {}, { get(_t, p) {
    if (p === "then") return (res, rej) => Promise.resolve({ data: single ? null : rows(), error: null }).then(res, rej);
    if (p === "catch" || p === "finally") return () => proxy;
    if (["insert", "update", "upsert", "delete"].includes(p)) return () => { mock.mutations.push({ view, verb: p }); return proxy; };
    if (p === "maybeSingle" || p === "single") return () => { single = true; return proxy; };
    return () => proxy; }, apply: () => proxy });
  return proxy;
}
export function createClient() {
  const client = {
    auth: { getSession: async () => ({ data: { session }, error: null }), getUser: async () => ({ data: { user }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), refreshSession: async () => ({ data: { session }, error: null }), signOut: async () => ({ error: null }) },
    from: (view) => chain(view),
    rpc: (name, args) => {
      mock.rpc.push({ name, args: JSON.parse(JSON.stringify(args ?? {})) });
      const data = name === "get_user_permissions"
        ? ["module:costing-control-center","module:material-cost-manager","module:cost-build-manager","module:pricing-policy-manager","module:cost-sheet-review","module:production-route-manager"].map((target) => ({ target, can_view: true, can_edit: ${canEdit} }))
        : null;
      const p = Promise.resolve({ data, error: null });
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
  await context.addInitScript(() => localStorage.setItem("COSTING_APPROVAL_SCREEN_V1", "1"));
  await context.route(/cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net|esm\.sh/, (r) => {
    if (/esm\.sh\/@supabase\/supabase-js/.test(r.request().url())) return r.fulfill({ status: 200, contentType: "text/javascript", body: stub(canEdit) });
    if (/\.css/.test(r.request().url())) return r.fulfill({ status: 200, contentType: "text/css", body: "" });
    return r.fulfill({ status: 200, contentType: "text/javascript", body: "" });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (x) => errors.push(String(x.message).slice(0, 160)));
  await page.goto(`${e.base}/shared/costing-control-center.html`, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelector("#casRunList .cas-run-row, #casRunList [data-cas-review], #casRunList .cas-muted, #casRunList *"), null, { timeout: 15000 });
  await page.waitForFunction(() => /Draft/.test(document.getElementById("casRunList")?.textContent || ""), null, { timeout: 15000 });
  return { context, page, errors };
}

test("view-only: no Review button, an explanatory label, and no preview RPC", async (t) => {
  const e = await getEnv(t); if (!e) return;
  for (const width of [1280, 390]) {
    const { context, page, errors } = await open(e, "false", width);
    const snap = await page.evaluate(() => ({ btn: document.querySelectorAll("[data-cas-review]").length, text: document.getElementById("casRunList").textContent, rpc: window.__mock.rpc.map((x) => x.name), mut: window.__mock.mutations }));
    await context.close();
    assert.equal(snap.btn, 0, `@${width}: no Review button`);
    assert.match(snap.text, /View only.*Costing Control Center edit permission/, `@${width}`);
    assert.equal(snap.rpc.filter((n) => n === PREVIEW).length, 0, `@${width}: no preview RPC`);
    assert.deepEqual(snap.mut, []);
    assert.deepEqual(errors, []);
  }
});

test("editor: Review button present; one click makes exactly one preview RPC", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const { context, page, errors } = await open(e, "true");
  assert.equal(await page.locator("[data-cas-review]").count(), 1);
  await page.locator("[data-cas-review]").click();
  await page.waitForFunction(() => window.__mock.rpc.some((x) => x.name === "rpc_costing_preview_approval_impact"), null, { timeout: 10000 });
  await page.waitForTimeout(300);
  const calls = await page.evaluate(() => window.__mock.rpc.filter((x) => x.name === "rpc_costing_preview_approval_impact"));
  const writes = await page.evaluate(() => window.__mock.rpc.map((x) => x.name).filter((n) => /approve_run|finalize|lock_period/.test(n)));
  await context.close();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].args.p_refresh_run_id, 151);
  assert.deepEqual(writes, [], "no approve/finalise/lock RPC from a preview");
  assert.deepEqual(errors, []);
});

test("a non-boolean can_edit (the string \"true\") does not grant approval preview", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const { context, page } = await open(e, '"true"');
  const snap = await page.evaluate(() => ({ btn: document.querySelectorAll("[data-cas-review]").length, rpc: window.__mock.rpc.map((x) => x.name) }));
  await context.close();
  assert.equal(snap.btn, 0);
  assert.equal(snap.rpc.filter((n) => n === PREVIEW).length, 0);
});
