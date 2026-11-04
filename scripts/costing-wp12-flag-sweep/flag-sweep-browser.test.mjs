// WP12 groundwork: combined eleven-feature-flag OFF/ON acceptance sweep for the six Costing modules.
// Chromium + the REAL pages and shell against an inert in-memory backend (no Supabase, no network, no writes).
// Flags are set ONLY in each test context's own localStorage; nothing here (or in the pages) activates a production
// flag. States: all OFF, each flag alone ON (11), all ON = 13 states x 6 modules, plus deep links under all-OFF and
// all-ON. This is mock-data proof only: signed-in role proof, populated data and the Windows package remain human gates.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { startServer } from "../costing-responsive/responsive-audit.mjs";
import * as flags from "../../public/shared/js/costing-feature-flags.js";
import * as prmCorr from "../../public/shared/js/costing-suite-production-route-corrections.js";
import * as prmNav from "../../public/shared/js/costing-suite-production-route-nav-context.js";
import { COSTING_ROUTE_CONFIG } from "../../public/shared/js/costing-route-config.js";

const FLAGS = [
  flags.COSTING_RECALC_WITH_DATE_V1, flags.COSTING_APPROVAL_SCREEN_V1, flags.COSTING_LOCK_SCREEN_V1, flags.COSTING_RUN_STATUS_V1,
  flags.COSTING_UX_CONSISTENCY_V1, flags.COSTING_DIALOGS_V1, flags.COSTING_TABLE_TOOLS_V1, flags.COSTING_REVIEW_WORKLIST_V1,
  flags.COSTING_NAV_GROUPS_V1, prmCorr.COSTING_PRM_CORRECTIONS_V1, prmNav.COSTING_PRM_NAV_CONTEXT_V1,
];
const MODULES = Object.keys(COSTING_ROUTE_CONFIG);
const WRITE = /^rpc_(create|update|upsert|delete|submit|approve|accept|close|supersede|clone|set|apply|archive|retire|import|map|unmap|inactivate|cancel|correct|request|refresh|recalc|finali|lock|decide|generate|adjust)/i;
const BASE_TABLES = /^costing\.|sku_direct_labour_allocation_snapshot|sku_prime_cost_snapshot|sku_regional_marketing_expense_allocation_snapshot/;
const STATES = [
  { id: "all-off", on: [] },
  ...FLAGS.map((f) => ({ id: `only-${f}`, on: [f] })),
  { id: "all-on", on: FLAGS },
];

const STUB = `
const user = { id: "00000000-0000-0000-0000-000000000000", email: "mock@example.invalid" };
const session = { access_token: "stub", user };
const mock = (window.__mock = window.__mock || { rpc: [], from: [], mutations: [] });
function chain(view) {
  const eq = {}; let single = false; let offset = 0;
  const result = () => { let rows = []; for (const [k, v] of Object.entries(eq)) rows = rows.filter((r) => String(r[k]) === String(v)); if (offset > 0) rows = []; return { data: single ? null : rows, error: null }; };
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
      const data = name === "get_user_permissions" ? ["module:costing-control-center","module:material-cost-manager","module:cost-build-manager","module:pricing-policy-manager","module:cost-sheet-review","module:production-route-manager"].map((target) => ({ target, can_view: true, can_edit: false })) : [];
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

/** Opens one module page with exactly the given flags ON in this context's localStorage; returns the observed state. */
async function observe(e, moduleKey, onFlags, query = "") {
  const context = await e.browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript((on) => { for (const f of on) localStorage.setItem(f, "1"); }, onFlags);
  await context.route(/cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net|esm\.sh/, (r) => {
    if (/esm\.sh\/@supabase\/supabase-js/.test(r.request().url())) return r.fulfill({ status: 200, contentType: "text/javascript", body: STUB });
    if (/\.css/.test(r.request().url())) return r.fulfill({ status: 200, contentType: "text/css", body: "" });
    return r.fulfill({ status: 200, contentType: "text/javascript", body: "" });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (x) => errors.push(String(x.message).slice(0, 160)));
  const route = COSTING_ROUTE_CONFIG[moduleKey].routePath.replace(/^public\//, "");
  await page.goto(`${e.base}/${route}${query}`, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelector("#lensPills [data-lens], [data-pricing-policy-workspace]"), null, { timeout: 15000 });
  await page.waitForTimeout(250);
  const snap = await page.evaluate(() => ({
    h1: document.querySelector("h1")?.textContent?.trim() || "",
    nav: [...document.querySelectorAll("#lensPills [data-lens]")].map((n) => n.dataset.lens),
    ws: [...document.querySelectorAll("[data-pricing-policy-workspace]")].map((n) => n.dataset.pricingPolicyWorkspace),
    active: document.querySelector("#lensPills .pill.active")?.dataset?.lens || document.querySelector("[data-pricing-policy-workspace].active")?.dataset?.pricingPolicyWorkspace || null,
    navHtml: document.getElementById("lensPills")?.innerHTML || "",
    groups: document.querySelectorAll("#lensPills .cp-nav-group").length,
    flagsSet: Object.keys(localStorage).filter((k) => /^COSTING_.*_V1$/.test(k)).sort(),
    mock: window.__mock,
  }));
  await context.close();
  return { ...snap, errors };
}
const norm = (html) => html.replace(/\s+/g, " ").trim();

// ---- independent inventory (NOT derived from the files under test): 30 lens entries + 2 legacy PPM lens aliases = the
// 32 lens ids, and 10 Pricing Policy workspaces, of the agreed programme. A change must update this literal on purpose.
const LENS_INVENTORY = {
  "costing-control-center": ["costing-review-workbench", "dashboard", "portfolio-readiness", "sku-control-status"],
  "material-cost-manager": ["manual-rate-manager", "pm-cost-trace", "rm-cost-trace"],
  "cost-build-manager": ["cost-governance", "driver-governance", "manual-provisions", "staff-governance"],
  "pricing-policy-manager": ["mrp-governance", "policy-manager"],
  "cost-sheet-review": ["cost-comparison", "materials-stores-action-queue", "printable-cost-sheet", "qc-action-queue", "scheme-comparison", "sku-cost-sheet"],
  "production-route-manager": ["archived-routes", "effective-route-viewer", "historical-candidate-review", "product-route-assignments", "product-route-editor", "product-subgroup-mappings", "production-cost-centres", "route-families", "route-family-foundation-review", "route-family-mapping-review", "route-family-route-editor", "route-readiness", "shared-workload-preview"],
};
const PPM_WORKSPACES = ["applied-proposal-history", "approved-for-application", "commercial-sales-assumptions", "mrp-proposals", "product-derivation-policies", "proposal-decisions", "scheme-master", "scheme-rule-register", "sku-mrp-policies", "sku-overview"];

test("inventory: six modules, 32 lens ids and 10 Pricing Policy workspaces exactly as agreed (route table equals the independent literal)", () => {
  assert.deepEqual(Object.keys(COSTING_ROUTE_CONFIG).sort(), Object.keys(LENS_INVENTORY).sort());
  for (const [m, lenses] of Object.entries(LENS_INVENTORY)) assert.deepEqual([...COSTING_ROUTE_CONFIG[m].allowedLensIds].sort(), lenses, m);
  assert.equal(Object.values(LENS_INVENTORY).flat().length, 32);
  assert.equal(PPM_WORKSPACES.length, 10);
});

// ---- sweep: 13 states x 6 modules (modules of one state run in parallel) ----------------------------------------------
const results = new Map(); // `${state}|${module}` -> snapshot
async function sweepState(e, state) {
  const snaps = await Promise.all(MODULES.map((m) => observe(e, m, state.on)));
  MODULES.forEach((m, i) => results.set(`${state.id}|${m}`, snaps[i]));
  return snaps;
}

for (const state of STATES) {
  test(`sweep [${state.id}]: all six modules load with exactly the requested flags, read-only, no page error, correct title`, async (t) => {
    const e = await getEnv(t); if (!e) return;
    const snaps = await sweepState(e, state);
    snaps.forEach((s, i) => {
      const m = MODULES[i];
      assert.deepEqual(s.errors, [], `${m}: page errors`);
      assert.equal(s.h1, COSTING_ROUTE_CONFIG[m].title, `${m}: title`);
      assert.deepEqual(s.flagsSet, [...state.on].sort(), `${m}: localStorage flags are exactly the requested set (nothing activated by the page)`);
      const rpcNames = s.mock.rpc.map((c) => c.name);
      assert.deepEqual(rpcNames.filter((n) => WRITE.test(n)), [], `${m}: write-like RPC`);
      assert.deepEqual(s.mock.mutations, [], `${m}: table mutation`);
      assert.deepEqual(s.mock.from.filter((v) => BASE_TABLES.test(v)), [], `${m}: costing base tables are never read by the browser`);
    });
  });
}

test("invariant: no flag state adds or removes a navigation entry - every module offers the same lens/workspace set as all-OFF", async (t) => {
  const e = await getEnv(t); if (!e) return;
  for (const state of STATES) if (!results.has(`${state.id}|${MODULES[0]}`)) await sweepState(e, state);
  for (const m of MODULES) {
    const off = results.get(`all-off|${m}`);
    const offSet = [...(m === "pricing-policy-manager" ? off.ws : off.nav)].sort();
    assert.ok(offSet.length > 0, `${m}: has navigation`);
    for (const state of STATES) {
      const s = results.get(`${state.id}|${m}`);
      const set = [...(m === "pricing-policy-manager" ? s.ws : s.nav)].sort();
      assert.deepEqual(set, offSet, `${m} [${state.id}]: same navigation entries as all-OFF`);
    }
    assert.deepEqual(offSet, m === "pricing-policy-manager" ? PPM_WORKSPACES : LENS_INVENTORY[m], `${m}: navigation equals the independent inventory`);
  }
});

test("independence: only COSTING_NAV_GROUPS_V1 (and W6's reuse of it on Pricing Policy) changes the navigation markup; every other flag leaves it byte-identical to all-OFF", async (t) => {
  const e = await getEnv(t); if (!e) return;
  for (const state of STATES) if (!results.has(`${state.id}|${MODULES[0]}`)) await sweepState(e, state);
  for (const m of MODULES) {
    const off = norm(results.get(`all-off|${m}`).navHtml);
    assert.ok(off.length > 0);
    for (const f of FLAGS) {
      const s = results.get(`only-${f}|${m}`);
      if (f === flags.COSTING_NAV_GROUPS_V1) {
        assert.notEqual(norm(s.navHtml), off, `${m}: NAV_GROUPS changes the navigation`);
        if (m !== "pricing-policy-manager") assert.ok(s.groups >= 2, `${m}: grouped navigation renders groups (${s.groups})`);
      } else {
        assert.equal(norm(s.navHtml), off, `${m}: ${f} alone must not change the navigation markup`);
        assert.equal(s.groups, 0, `${m}: ${f} alone renders no groups`);
      }
    }
  }
});

// ---- deep links: every allowed lens under all-OFF and all-ON ----------------------------------------------------------
for (const [label, on] of [["all-off", []], ["all-on", FLAGS]]) {
  test(`deep links [${label}]: ?lens=<id> opens that lens on its own module (every allowed lens of the five lens-based modules)`, async (t) => {
    const e = await getEnv(t); if (!e) return;
    const jobs = [];
    for (const m of MODULES.filter((k) => k !== "pricing-policy-manager")) {
      for (const lens of COSTING_ROUTE_CONFIG[m].allowedLensIds) jobs.push({ m, lens });
    }
    const out = [];
    for (let i = 0; i < jobs.length; i += 6) {
      out.push(...await Promise.all(jobs.slice(i, i + 6).map(async (j) => ({ ...j, snap: await observe(e, j.m, on, `?lens=${encodeURIComponent(j.lens)}`) }))));
    }
    assert.ok(out.length >= 26, `lens deep links covered: ${out.length}`);
    for (const { m, lens, snap } of out) {
      assert.deepEqual(snap.errors, [], `${m}?lens=${lens}: page errors`);
      assert.equal(snap.active, lens, `${m}?lens=${lens}: active lens`);
      assert.deepEqual(snap.mock.rpc.filter((c) => WRITE.test(c.name)), [], `${m}?lens=${lens}: writes`);
      assert.deepEqual(snap.mock.mutations, []);
    }
  });

  test(`deep links [${label}]: Pricing Policy Manager ?workspace=<id> opens that workspace for every workspace it lists`, async (t) => {
    const e = await getEnv(t); if (!e) return;
    const base = await observe(e, "pricing-policy-manager", on);
    const ids = [...new Set(base.ws)];
    assert.ok(ids.length >= 10, `workspaces listed: ${ids.length}`);
    const out = [];
    for (let i = 0; i < ids.length; i += 6) {
      out.push(...await Promise.all(ids.slice(i, i + 6).map(async (id) => ({ id, snap: await observe(e, "pricing-policy-manager", on, `?workspace=${encodeURIComponent(id)}`) }))));
    }
    for (const { id, snap } of out) {
      assert.deepEqual(snap.errors, [], `workspace ${id}: page errors`);
      assert.equal(snap.active, id, `workspace ${id}: active`);
      assert.deepEqual(snap.mock.rpc.filter((c) => WRITE.test(c.name)), [], `workspace ${id}: writes`);
    }
  });
}

test("unknown or foreign lens ids fall back to the module default without errors (flags OFF and ON)", async (t) => {
  const e = await getEnv(t); if (!e) return;
  for (const on of [[], FLAGS]) {
    for (const m of MODULES.filter((k) => k !== "pricing-policy-manager")) {
      const foreign = COSTING_ROUTE_CONFIG[MODULES.find((k) => k !== m && k !== "pricing-policy-manager")].defaultLens;
      for (const bad of ["not-a-lens", foreign]) {
        const s = await observe(e, m, on, `?lens=${encodeURIComponent(bad)}`);
        assert.deepEqual(s.errors, [], `${m}?lens=${bad}`);
        assert.ok(COSTING_ROUTE_CONFIG[m].allowedLensIds.includes(s.active), `${m}?lens=${bad}: falls back to an allowed lens (got ${s.active})`);
      }
    }
  }
});
