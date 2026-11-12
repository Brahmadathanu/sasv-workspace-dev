// #282 client-side contract checks (read-only; the client is NOT modified by this package). Offline, no DB.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { COMPARISON_ROW_LIMIT, readCostComparisonRows, COMPARISON_COLUMNS } from "../../public/shared/js/costing-cost-comparison-read.js";
import { isCostingCsrScopedComparisonRpcV1Enabled } from "../../public/shared/js/costing-feature-flags.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const raw = (p) => fs.readFileSync(join(root, p), "utf8");
const rd = (p) => raw(p).replace(/\r\n/g, "\n");
const ORIGIN = "https://hub.test";

function loadSw() {
  const listeners = {}, store = new Map(), net = { online: true, files: {} };
  const mk = (body) => ({ ok: true, body, clone() { return this; } });
  const ctx = {
    self: { addEventListener: (t, f) => (listeners[t] = f), skipWaiting() {}, clients: {} },
    location: { origin: ORIGIN },
    caches: { open: async () => ({ put: async (r, x) => store.set(r.url ?? r, x.body) }), match: async (r) => (store.has(r.url ?? r) ? mk(store.get(r.url ?? r)) : undefined), keys: async () => [], delete: async () => true },
    fetch: async (r) => { const u = typeof r === "string" ? r : r.url; if (!net.online) throw new TypeError("offline"); const p = new URL(u).pathname; return p in net.files ? mk(net.files[p]) : { ok: false, status: 404, clone() { return this; } }; },
    URL, console, Promise,
  };
  vm.runInNewContext(raw("public/sw.js"), ctx);
  const run = async (url, { method = "GET" } = {}) => {
    let out, handled = false;
    listeners.fetch({ request: { url, method, mode: "no-cors", headers: { get: () => "*/*" } }, respondWith: (x) => { handled = true; out = x; } });
    return { handled, body: handled ? (await out)?.body : undefined };
  };
  return { run, store, net };
}

test("default OFF: the flag reads exactly '1' only, and the shell's default branch is the original view read", () => {
  for (const v of [null, undefined, "", "0", "true", "on", " 1"]) assert.equal(isCostingCsrScopedComparisonRpcV1Enabled({ getItem: () => v }), false);
  assert.equal(isCostingCsrScopedComparisonRpcV1Enabled({ getItem: () => "1" }), true);
  assert.equal(isCostingCsrScopedComparisonRpcV1Enabled(undefined), false);
  const flags = rd("public/shared/js/costing-feature-flags.js");
  assert.doesNotMatch(flags, /COSTING_CSR_SCOPED_COMPARISON_RPC_V1\s*=\s*["']1["']/, "no hard-coded ON default");
  assert.equal((raw("public/shared/js/costing-suite-shell.js").match(/localStorage\.setItem\([^)]*COSTING_CSR_SCOPED/g) || []).length, 0, "shell never turns the flag on");
});

test("no fallback / no retry: one RPC call per load, error surfaces, view is never read after an RPC failure", async () => {
  const log = { from: 0, rpc: 0 };
  const supabase = { from: () => { log.from++; throw new Error("view must not be read"); }, rpc: async () => { log.rpc++; return { data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } }; } };
  await assert.rejects(readCostComparisonRows({ supabase, periodStart: "2026-11-01", scopedRpcEnabled: true }), /timed out/);
  assert.deepEqual(log, { from: 0, rpc: 1 });
  const mod = rd("public/shared/js/costing-cost-comparison-read.js");
  assert.equal((mod.match(/supabase\.rpc\(/g) || []).length, 1);
  assert.doesNotMatch(mod.replace(/\/\/.*$/gm, ""), /setTimeout|AbortController|retry\(|for \(let attempt|while \(/);
  const shell = rd("public/shared/js/costing-suite-shell.js");
  const block = shell.slice(shell.indexOf("// #273: flag-gated scoped read"), shell.indexOf("let query = costingFrom(viewName)"));
  assert.ok(block.length > 200 && !/catch|retry|costingFrom\(/.test(block), "flag-ON branch has no catch/retry/view fallback");
});

test("2000-row notice: RPC path flags truncation at exactly the cap and shell shows warning status + toast", async () => {
  const mkRows = (n) => Array.from({ length: n }, (_, i) => Object.fromEntries(COMPARISON_COLUMNS.map((c) => [c, c === "sku_id" ? i : null])));
  for (const [n, want] of [[1999, false], [2000, true]]) {
    const out = await readCostComparisonRows({ supabase: { rpc: async () => ({ data: mkRows(n), error: null }) }, periodStart: "2026-11-01", scopedRpcEnabled: true });
    assert.equal(out.truncated, want, String(n));
  }
  assert.equal(COMPARISON_ROW_LIMIT, 2000);
  const shell = rd("public/shared/js/costing-suite-shell.js");
  assert.match(shell, /Cost comparison reached the 2000-row limit; some rows may not be shown\./);
  assert.match(shell, /if \(truncated\) \{[\s\S]{0,300}setStatus\(truncatedMsg, "warning"\);[\s\S]{0,100}showToast\(truncatedMsg, "warning"/);
});

test("OBSERVATION F-2 (recorded, not fixed here): the original flag-OFF view path has limit(2000) but NO truncation notice", async () => {
  const shell = rd("public/shared/js/costing-suite-shell.js");
  const tail = shell.slice(shell.indexOf("let query = costingFrom(viewName)"), shell.indexOf("let query = costingFrom(viewName)") + 2600);
  assert.match(tail, /\.limit\(2000\)/);
  assert.doesNotMatch(tail, /2000-row limit/, "if this fails, someone added a notice to the legacy path: update R19 F-2");
  const out = await readCostComparisonRows({ supabase: { from: () => { const q = { select: () => q, eq: () => q, order: () => q, limit: async () => ({ data: Array(2000).fill({}), error: null }) }; return q; } }, periodStart: "2026-11-01", scopedRpcEnabled: false });
  assert.equal(out.truncated, false, "view helper never reports truncation");
});

test("service worker: Supabase / cross-origin API calls are never intercepted or cached (so no stale API data from the SW)", async () => {
  const h = loadSw();
  for (const u of ["https://abc.supabase.co/rest/v1/rpc/rpc_get_cost_sheet_sku_monthly_comparison_scoped", `${ORIGIN}/rest/v1/rpc/x`]) assert.equal((await h.run(u)).handled, false, u);
  assert.equal((await h.run(`${ORIGIN}/rest/v1/x`, { method: "POST" })).handled, false);
});

test("service worker: the shell script is network-first with offline cache fallback", async () => {
  const h = loadSw(); const P = "/shared/js/costing-suite-shell.js";
  h.store.set(ORIGIN + P, "OLD"); h.net.files[P] = "NEW";
  assert.equal((await h.run(ORIGIN + P)).body, "NEW");
  h.net.online = false;
  assert.equal((await h.run(ORIGIN + P)).body, "NEW", "offline serves the last fetched copy");
});

test("FIXED F-1 (#289): Cost Comparison child modules are network-first with offline cache fallback", async () => {
  for (const P of ["/shared/js/costing-cost-comparison-read.js", "/shared/js/costing-feature-flags.js"]) {
    const h = loadSw(); h.store.set(ORIGIN + P, "OLD"); h.net.files[P] = "NEW";
    assert.equal((await h.run(ORIGIN + P)).body, "NEW", `${P} must fetch current JS online`);
    h.net.online = false;
    assert.equal((await h.run(ORIGIN + P)).body, "NEW", `${P} must use updated cached JS offline`);
  }
  const h = loadSw(), P = "/shared/js/unrelated-static-file.js";
  h.store.set(ORIGIN + P, "OLD"); h.net.files[P] = "NEW";
  assert.equal((await h.run(ORIGIN + P)).body, "OLD", "unrelated static JS remains cache-first");
  assert.match(raw("public/sw.js"), /const CACHE_NAME = "hub-cache-v393"/, "no cache-version bump");
});

test("line endings: the client files in the Cost Comparison path are consistently LF or CRLF, and new verifier files are LF", () => {
  for (const p of ["public/sw.js", "public/shared/js/costing-cost-comparison-read.js", "public/shared/js/costing-feature-flags.js", "public/shared/js/costing-suite-shell.js", "supabase/migrations/20261111133505_csr_scoped_comparison_rpc_additive_20261111.sql"]) {
    const s = raw(p), crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length - crlf;
    assert.ok(crlf === 0 || lf === 0, `${p}: mixed endings crlf=${crlf} lf=${lf}`);
  }
  const dir = join(root, "scripts/csr-comparison-verifier");
  for (const f of fs.readdirSync(dir, { recursive: true })) { const full = join(dir, f); if (fs.statSync(full).isFile()) assert.ok(!/\r\n/.test(fs.readFileSync(full, "utf8")), `${f} must be LF`); }
});
