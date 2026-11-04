// WP12 console + load-time RPC allowlist regression (test-only; extends the eleven-flag sweep, which is unchanged).
// Real six Costing pages in Chromium against an inert in-memory backend: no Supabase, no network, no writes.
// Flags exist only in each test context's own localStorage. Asserts, at 1280 px and 390 px, for all-OFF and all-ON:
//   * no console.error, console.warn, uncaught page error or unhandled rejection (except DOCUMENTED_CONSOLE_EXCEPTIONS, empty today);
//   * no failed request and no request to a host outside the stubbed CDN list;
//   * the load-time RPC names of every module equal an independent literal, per state (order-insensitive, exact set);
//   * rpc_costing_health_check is called ONLY by the Costing Control Center, ONLY when COSTING_RUN_STATUS_V1 is on;
//   * every load-time RPC that is not a getter is explicitly justified; anything else (e.g. an approve/lock/set/close RPC) fails.
// Mock proof only: it does not show what the real server does with rpc_costing_health_check (live definition unverified).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { startServer } from "../costing-responsive/responsive-audit.mjs";
import { COSTING_ROUTE_CONFIG } from "../../public/shared/js/costing-route-config.js";

const FLAGS = [
  "COSTING_RECALC_WITH_DATE_V1", "COSTING_APPROVAL_SCREEN_V1", "COSTING_LOCK_SCREEN_V1", "COSTING_RUN_STATUS_V1",
  "COSTING_UX_CONSISTENCY_V1", "COSTING_DIALOGS_V1", "COSTING_TABLE_TOOLS_V1", "COSTING_REVIEW_WORKLIST_V1",
  "COSTING_NAV_GROUPS_V1", "COSTING_PRM_CORRECTIONS_V1", "COSTING_PRM_NAV_CONTEXT_V1",
];
const MODULES = Object.keys(COSTING_ROUTE_CONFIG);
const WIDTHS = [1280, 390];

// Same inert backend as the sweep (read from that file so the two harnesses cannot drift apart).
const sweepSource = fs.readFileSync(fileURLToPath(new URL("./flag-sweep-browser.test.mjs", import.meta.url)), "utf8").replace(/\r\n/g, "\n");
const STUB = sweepSource.match(/const STUB = `([\s\S]*?)`;\n/)?.[1];

// ---- independent literals (NOT derived from the files under test). A change must update them on purpose. -------------
const PERMISSIONS_RPC = "get_user_permissions";
const LOAD_RPCS = {
  "costing-control-center": { off: [PERMISSIONS_RPC, "rpc_get_cost_period_valuation_context"], extraAllOn: ["rpc_costing_health_check"] },
  "material-cost-manager": { off: [PERMISSIONS_RPC], extraAllOn: [] },
  "cost-build-manager": { off: [PERMISSIONS_RPC], extraAllOn: [] },
  "pricing-policy-manager": { off: [PERMISSIONS_RPC], extraAllOn: [] },
  "cost-sheet-review": { off: [PERMISSIONS_RPC], extraAllOn: [] },
  "production-route-manager": { off: [PERMISSIONS_RPC, "rpc_get_production_route_master_options", "rpc_get_production_route_manager_readiness"], extraAllOn: [] },
};
// The only load-time RPC that is not a getter, with the reason it is tolerated. Its live definition is NOT in this repository.
const NON_GETTER_JUSTIFIED = {
  rpc_costing_health_check: "called by costing-run-status-screen.js / costing-approval-screen.js for the run-status chip; name reads as a check, side effects unverified server-side",
};
const HEALTH_CHECK = "rpc_costing_health_check";
const HEALTH_CHECK_FLAGS = ["COSTING_RUN_STATUS_V1"]; // observed: this flag alone triggers it on the Control Center
const DOCUMENTED_CONSOLE_EXCEPTIONS = []; // [{ pattern: RegExp, reason: string }]; empty: none observed, none permitted
const ALLOWED_HOSTS = new Set(["cdnjs.cloudflare.com", "esm.sh", "fonts.googleapis.com", "fonts.gstatic.com", "cdn.jsdelivr.net"]);

const isGetter = (name) => name === PERMISSIONS_RPC || /^rpc_(get|list|search)_/.test(name);
/** Returns the load-time RPC names that are neither getters nor individually justified. */
export function unjustifiedLoadRpcs(names) {
  return [...new Set(names)].filter((n) => !isGetter(n) && !(n in NON_GETTER_JUSTIFIED));
}
export function unexpectedConsole(events) {
  return events.filter((ev) => !DOCUMENTED_CONSOLE_EXCEPTIONS.some((x) => x.pattern.test(ev.text)));
}

const COLLECTOR = `
window.__rejections = [];
window.addEventListener("unhandledrejection", (e) => { window.__rejections.push(String(e.reason && e.reason.message || e.reason).slice(0, 200)); });
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

function attach(page, bucket) {
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") bucket.console.push({ type: m.type(), text: m.text().slice(0, 240) }); });
  page.on("pageerror", (x) => bucket.console.push({ type: "pageerror", text: String(x.message).slice(0, 240) }));
  page.on("requestfailed", (q) => bucket.failed.push(q.url().slice(0, 120)));
}

async function load(e, moduleKey, onFlags, width) {
  const context = await e.browser.newContext({ viewport: { width, height: 900 } });
  await context.addInitScript(COLLECTOR);
  await context.addInitScript((on) => { for (const f of on) localStorage.setItem(f, "1"); }, onFlags);
  await context.route(/cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net|esm\.sh/, (r) => {
    if (/esm\.sh\/@supabase\/supabase-js/.test(r.request().url())) return r.fulfill({ status: 200, contentType: "text/javascript", body: STUB });
    if (/\.css/.test(r.request().url())) return r.fulfill({ status: 200, contentType: "text/css", body: "" });
    return r.fulfill({ status: 200, contentType: "text/javascript", body: "" });
  });
  const page = await context.newPage();
  const bucket = { console: [], failed: [], hosts: new Set() };
  attach(page, bucket);
  page.on("request", (q) => { const u = new URL(q.url()); if (!/^(127\.0\.0\.1|localhost)$/.test(u.hostname)) bucket.hosts.add(u.hostname); });
  const route = COSTING_ROUTE_CONFIG[moduleKey].routePath.replace(/^public\//, "");
  await page.goto(`${e.base}/${route}`, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelector("#lensPills [data-lens], [data-pricing-policy-workspace]"), null, { timeout: 15000 });
  await page.waitForTimeout(1500); // let load-time (async) RPCs settle
  const snap = await page.evaluate(() => ({ rpc: window.__mock.rpc.map((x) => ({ name: x.name, args: x.args })), mutations: window.__mock.mutations, rejections: window.__rejections }));
  await context.close();
  return { ...snap, console: bucket.console, failed: bucket.failed, hosts: [...bucket.hosts] };
}

const STATES = [{ id: "all-off", on: [] }, { id: "all-on", on: FLAGS }];

test("harness: the inert backend stub was found in the sweep harness", () => {
  assert.ok(STUB && STUB.includes("export function createClient"), "STUB not found in flag-sweep-browser.test.mjs");
});

for (const state of STATES) {
  test(`load-time RPCs and console [${state.id}]: six modules x 1280/390 px match the literal, console is clean, no write, no foreign host`, async (t) => {
    const e = await getEnv(t); if (!e) return;
    const jobs = MODULES.flatMap((m) => WIDTHS.map((w) => ({ m, w })));
    const out = await Promise.all(jobs.map((j) => load(e, j.m, state.on, j.w)));
    out.forEach((s, i) => {
      const { m, w } = jobs[i];
      const where = `${state.id} ${m} @${w}`;
      const expected = [...LOAD_RPCS[m].off, ...(state.id === "all-on" ? LOAD_RPCS[m].extraAllOn : [])].sort();
      const actual = [...new Set(s.rpc.map((x) => x.name))].sort();
      assert.deepEqual(actual, expected, `${where}: load-time RPC set changed`);
      assert.deepEqual(unjustifiedLoadRpcs(s.rpc.map((x) => x.name)), [], `${where}: unexpected non-getter RPC during load`);
      assert.deepEqual(s.mutations, [], `${where}: table mutation during load`);
      assert.deepEqual(unexpectedConsole(s.console), [], `${where}: unexpected console error/warning/page error`);
      assert.deepEqual(s.rejections, [], `${where}: unhandled promise rejection`);
      assert.deepEqual(s.failed, [], `${where}: failed network request`);
      assert.deepEqual(s.hosts.filter((h) => !ALLOWED_HOSTS.has(h)), [], `${where}: request to an unexpected host`);
    });
  });
}

test("rpc_costing_health_check is accounted for: absent in all-OFF, present exactly once (no arguments) on the Control Center in all-ON, absent on the other five modules", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const off = await Promise.all(MODULES.map((m) => load(e, m, [], 1280)));
  const on = await Promise.all(MODULES.map((m) => load(e, m, FLAGS, 1280)));
  MODULES.forEach((m, i) => {
    assert.equal(off[i].rpc.filter((x) => x.name === HEALTH_CHECK).length, 0, `${m}: health check must not run with all flags OFF`);
    const calls = on[i].rpc.filter((x) => x.name === HEALTH_CHECK);
    if (m === "costing-control-center") { assert.equal(calls.length, 1, "Control Center all-ON: exactly one health check"); assert.deepEqual(calls[0].args, {}, "health check takes no arguments"); }
    else assert.equal(calls.length, 0, `${m}: health check must not run`);
  });
});

test("rpc_costing_health_check is gated by exactly COSTING_RUN_STATUS_V1 on the Control Center (each of the eleven flags alone)", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const snaps = await Promise.all(FLAGS.map((f) => load(e, "costing-control-center", [f], 1280)));
  FLAGS.forEach((f, i) => {
    const ran = snaps[i].rpc.some((x) => x.name === HEALTH_CHECK);
    assert.equal(ran, HEALTH_CHECK_FLAGS.includes(f), `${f}: health-check trigger changed`);
    assert.deepEqual(unjustifiedLoadRpcs(snaps[i].rpc.map((x) => x.name)), [], `${f}: unexpected non-getter RPC`);
    assert.deepEqual(unexpectedConsole(snaps[i].console), [], `${f}: console`);
  });
});

// ---- the detectors themselves (negative tests): they must fail when something bad happens -----------------------------
test("detector: classifier flags write-capable and unjustified load-time RPC names, tolerates getters and the justified health check", () => {
  for (const bad of ["rpc_costing_approve_run", "rpc_costing_lock_period", "rpc_set_sku_sales_assumption", "rpc_costing_request_recalculation",
    "rpc_costing_preview_approval_impact", "rpc_validate_product_route", "rpc_export_material_rate_pm_cost_trace", "rpc_refresh_cost", "rpc_costing_health_check_v2"]) {
    assert.deepEqual(unjustifiedLoadRpcs([bad]), [bad], bad);
  }
  assert.deepEqual(unjustifiedLoadRpcs([PERMISSIONS_RPC, "rpc_get_cost_period_valuation_context", "rpc_list_x", HEALTH_CHECK]), []);
});

test("detector: the page collector reports console.error, console.warn, uncaught errors and unhandled rejections (and nothing for log/info)", async (t) => {
  const e = await getEnv(t); if (!e) return;
  const context = await e.browser.newContext();
  await context.addInitScript(COLLECTOR);
  const page = await context.newPage();
  const bucket = { console: [], failed: [], hosts: new Set() };
  attach(page, bucket);
  await context.route("http://collector.invalid/", (r) => r.fulfill({ status: 200, contentType: "text/html", body: `<script>console.log("fine");console.info("fine");console.warn("w1");console.error("e1");setTimeout(()=>{throw new Error("boom")},0);Promise.reject(new Error("rej"));</script>` }));
  await page.goto("http://collector.invalid/");
  await page.waitForTimeout(300);
  const rejections = await page.evaluate(() => window.__rejections);
  await context.close();
  assert.deepEqual(bucket.console.map((c) => c.type).sort(), ["error", "pageerror", "pageerror", "warning"], "console.error, console.warn, the thrown error and (Chromium also surfaces the rejection as a page error)");
  assert.deepEqual(rejections, ["rej"]);
  assert.equal(unexpectedConsole(bucket.console).length, 4, "no exception is documented, so all are unexpected");
});

test("allowlist hygiene: every documented exception has a pattern and a reason; the literal covers exactly the six modules", () => {
  for (const x of DOCUMENTED_CONSOLE_EXCEPTIONS) assert.ok(x.pattern instanceof RegExp && String(x.reason || "").length > 10);
  for (const [name, why] of Object.entries(NON_GETTER_JUSTIFIED)) assert.ok(why.length > 10, name);
  assert.deepEqual(Object.keys(LOAD_RPCS).sort(), [...MODULES].sort());
});
