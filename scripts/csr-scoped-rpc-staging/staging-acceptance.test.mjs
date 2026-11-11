// Offline tests for the staging acceptance runner against an in-process mock PostgREST. Nothing here touches Supabase.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertStagingTarget, makeClient, compareBags, percentile, summarisePerf, evaluateAuthorization, CONFIRM_PHRASE, PRODUCTION_PROJECT_REF, VIEW, RPC, expectedColumns } from "./lib.mjs";
import { runAcceptance } from "./staging-acceptance.mjs";
const COMPARISON_COLUMNS = expectedColumns();

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const mkRow = (i, extra = {}) => ({ ...Object.fromEntries(COMPARISON_COLUMNS.map((c) => [c, null])), sku_id: i, product_name: `Secret Product ${i}`, sku_column_label: `L${i}`, manufacturing_cop: 100 + i, ...extra });
const ROWS = [1, 2, 3, 4].map((i) => mkRow(i));

/** mock PostgREST. mode tweaks: dupe, order, dropcol, idnLeak, fail500 */
function startMock(mode = {}) {
  const seen = [];
  const server = http.createServer((req, res) => {
    let body = ""; req.on("data", (d) => (body += d)); req.on("end", () => {
      seen.push(`${req.method} ${req.url.split("?")[0]}`);
      const tok = (req.headers.authorization || "").replace("Bearer ", "");
      const send = (s, j) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(j)); };
      const isView = req.url.startsWith(`/rest/v1/${VIEW}`);
      const period = isView ? new URL("http://x" + req.url).searchParams.get("snapshot_period_start").replace("eq.", "") : JSON.parse(body || "{}").p_period_start;
      const data = period === "2025-11-01" ? [] : ROWS;
      if (mode.fail500 && !isView) return send(500, { code: "57014", message: "canceling statement due to statement timeout" });
      if (isView) return send(200, tok === "tok-idv" ? data : []);
      if (tok === "anon-key") return send(401, { code: "42501", message: "permission denied for function" });
      if (tok === "tok-idv") {
        let out = data.map((r) => ({ ...r }));
        if (mode.dupe && out.length > 1) out[1] = { ...out[0] };
        if (mode.order && out.length > 1) out = [...out].reverse();
        if (mode.dropcol && out.length) out = out.map(({ snapshot_run_label, ...r }) => r);
        return send(200, out);
      }
      return mode.idnLeak ? send(200, data) : send(403, { code: "42501", message: "permission denied for module" });
    });
  });
  return new Promise((r) => server.listen(0, "127.0.0.1", () => r({ server, seen, url: `http://127.0.0.1:${server.address().port}` })));
}
const env = (url, extra = {}) => ({ STAGING_URL: url, STAGING_CONFIRM: CONFIRM_PHRASE, STAGING_ANON_KEY: "anon-key", TOKEN_IDV: "tok-idv", TOKEN_IDN: "tok-idn", TOKEN_IDX: "tok-idx", PERF_ROUNDS: "2", PERF_GAP_MS: "0", ...extra });
const NOSLEEP = { sleepImpl: async () => {} };

test("guards: production ref, missing confirmation, http, missing keys, production-issued JWT are all refused; loopback allowed", () => {
  const base = { STAGING_CONFIRM: CONFIRM_PHRASE, STAGING_ANON_KEY: "a", TOKEN_IDV: "v" };
  assert.throws(() => assertStagingTarget({ ...base, STAGING_URL: `https://${PRODUCTION_PROJECT_REF}.supabase.co` }), /production project ref/);
  assert.throws(() => assertStagingTarget({ ...base, STAGING_URL: `https://${PRODUCTION_PROJECT_REF.toUpperCase()}.supabase.co` }), /production project ref/);
  assert.throws(() => assertStagingTarget({ ...base, STAGING_URL: "https://stg.supabase.co", STAGING_CONFIRM: "yes" }), /STAGING_CONFIRM/);
  assert.throws(() => assertStagingTarget({ ...base, STAGING_URL: "https://stg.supabase.co", STAGING_CONFIRM: undefined }), /STAGING_CONFIRM/);
  assert.throws(() => assertStagingTarget({ ...base, STAGING_URL: "http://stg.supabase.co" }), /https/);
  assert.throws(() => assertStagingTarget({ ...base, STAGING_URL: "" }), /required/);
  assert.throws(() => assertStagingTarget({ ...base, STAGING_URL: "not a url" }), /valid URL/);
  assert.throws(() => assertStagingTarget({ ...base, STAGING_URL: "https://stg.supabase.co", TOKEN_IDV: "" }), /TOKEN_IDV/);
  const prodJwt = `h.${Buffer.from(JSON.stringify({ ref: PRODUCTION_PROJECT_REF })).toString("base64url")}.s`;
  assert.throws(() => assertStagingTarget({ ...base, STAGING_URL: "https://stg.supabase.co", TOKEN_IDV: prodJwt }), /production project/);
  assert.throws(() => assertStagingTarget({ ...base, STAGING_URL: "https://stg.supabase.co", TOKEN_IDN: prodJwt }), /production project/);
  assert.equal(assertStagingTarget({ ...base, STAGING_URL: "https://stg.supabase.co/" }).base, "https://stg.supabase.co");
  assert.equal(assertStagingTarget({ ...base, STAGING_URL: "http://127.0.0.1:54321" }).local, true);
});

test("allowlist: only the governed-view GET and the scoped-RPC POST can be sent", async () => {
  const sent = [];
  const c = makeClient({ base: "https://stg.example", anonKey: "a", fetchImpl: async (u, o) => { sent.push([o.method, u]); return { status: 200, json: async () => [] }; } });
  await c.view("2026-11-01", "t"); await c.rpc("2026-11-01", "t");
  assert.equal(sent.length, 2);
  // the client exposes no generic request method, and its internal guard rejects everything else
  assert.deepEqual(Object.keys(c).sort(), ["log", "rpc", "view"]);
  const src = readFileSync(join(root, "scripts/csr-scoped-rpc-staging/lib.mjs"), "utf8");
  assert.match(src, /REFUSED request outside the allowlist/);
  assert.doesNotMatch(src + readFileSync(join(root, "scripts/csr-scoped-rpc-staging/staging-acceptance.mjs"), "utf8"), /"(PATCH|PUT|DELETE)"|\.insert\(|rpc\/(?!\$\{RPC\})/);
});

test("happy path against the mock: PASS, 4 parity periods bag-equal, authorization ok, request count bounded", async () => {
  const m = await startMock();
  const r = await runAcceptance(env(m.url), NOSLEEP);
  m.server.close();
  assert.deepEqual(r.checks, { authorizationAllOk: true, parityAllBagEqual: true, performanceWithinProposedBudget: true, performanceOctNotWorseThanView: true });
  assert.match(r.verdict, /^PASS \(staging only; not a production approval\)/);
  for (const p of Object.values(r.steps.parity)) assert.ok(p.bagEqual && p.sameOrder && p.sameColumns && p.missingColumns.length === 0);
  assert.equal(r.steps.parity.absent.viewCount, 0);
  assert.equal(r.requests, 4 + 8 + 3 * 2 * 2, "4 authorization (anon, ID-V, ID-N, ID-X) + 8 parity + 3 periods x 2 rounds x 2 paths");
  assert.ok(m.seen.every((s) => s === `GET /rest/v1/${VIEW}` || s === `POST /rest/v1/rpc/${RPC}`), "mock saw only allowlisted requests");
});

test("report contains no tokens, no keys and no row contents (digests only)", async () => {
  const m = await startMock(); const r = await runAcceptance(env(m.url), NOSLEEP); m.server.close();
  const text = JSON.stringify(r);
  for (const s of ["tok-idv", "tok-idn", "tok-idx", "anon-key", "Secret Product"]) assert.ok(!text.includes(s), `report leaked ${s}`);
  assert.match(r.steps.parity.nov.viewDigest, /^[0-9a-f]{64}$/);
});

for (const [label, mode, check] of [
  ["a swapped duplicate row (same count, different multiset)", { dupe: true }, (r) => r.steps.parity.nov.bagEqual === false && r.steps.parity.nov.onlyView === 1 && r.steps.parity.nov.onlyRpc === 1],
  ["different row order", { order: true }, (r) => r.steps.parity.nov.bagEqual === true && r.steps.parity.nov.sameOrder === false],
  ["a missing column", { dropcol: true }, (r) => r.steps.parity.nov.missingColumns.includes("snapshot_run_label") && r.steps.parity.nov.sameColumns === false],
  ["ID-N receiving rows (authorization leak)", { idnLeak: true }, (r) => r.steps.authorization.some((x) => /ID-N/.test(x.identity) && !x.ok)],
]) {
  test(`mock fault: ${label} is detected and the verdict is FAIL`, async () => {
    const m = await startMock(mode); const r = await runAcceptance(env(m.url), NOSLEEP); m.server.close();
    assert.ok(check(r), JSON.stringify(r.steps.parity?.nov ?? r.steps.authorization));
    assert.match(r.verdict, /^FAIL/);
  });
}

test("first HTTP 5xx aborts the run immediately (staging protection) and cannot pass", async () => {
  const m = await startMock({ fail500: true }); const r = await runAcceptance(env(m.url), NOSLEEP); m.server.close();
  assert.match(r.aborted, /HTTP 500/); assert.equal(r.requests, 1, "stopped on the first 5xx"); assert.match(r.verdict, /^FAIL/);
});

test("PERF_ROUNDS outside 1..15 is refused", async () => {
  const m = await startMock();
  await assert.rejects(runAcceptance(env(m.url, { PERF_ROUNDS: "500" }), NOSLEEP), /PERF_ROUNDS/);
  m.server.close();
});

test("bag compare, percentile and summary helpers", () => {
  assert.equal(compareBags([{ a: 1 }, { a: 1 }], [{ a: 1 }, { a: 2 }]).bagEqual, false);
  assert.equal(compareBags([{ a: 1, b: 2 }], [{ b: 2, a: 1 }]).bagEqual, true, "key order is irrelevant");
  assert.equal(percentile([], 50), null);
  assert.equal(percentile([5, 1, 3, 2, 4], 50), 3); assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95), 10);
  const s = summarisePerf([{ status: 200, ms: 10 }, { status: 200, ms: 30 }, { status: 500, ms: 99 }]);
  assert.deepEqual([s.n, s.ok, s.failures, s.p50, s.max, s.first], [3, 2, 1, 10, 30, 10]);
  const a = evaluateAuthorization({ anon: { status: 401, json: {} }, idv: { status: 200, json: [1] }, idn: { status: 200, json: [1] } });
  assert.equal(a.find((x) => /ID-N/.test(x.identity)).ok, false);
});
