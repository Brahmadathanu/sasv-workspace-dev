// Pure-logic tests for the acceptance runner's safety libraries: request allow-list, identity proof, redaction. No browser, no network.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyRequest, appDocumentedReadRpcs, READ_RPC, FORBIDDEN_UI_VERBS } from "./lib/allowlist.mjs";
import { evaluateIdentity, COSTING_TARGETS } from "./lib/identity.mjs";
import { redact, safeUrl, containsSecret } from "./lib/redact.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");
const B = "https://ref.supabase.co", A = "https://app.example";
const cls = (method, url, extra = {}) => classifyRequest({ method, url }, { baseOrigin: A, backendOrigin: B, ...extra });

test("allow-list: reads are allowed (permissions RPC, rpc_get_*, REST GET/HEAD, token refresh, static, CDN)", () => {
  for (const [m, u, kind] of [["POST", B + "/rest/v1/rpc/get_user_permissions", "rpc-read"], ["POST", B + "/rest/v1/rpc/rpc_get_cost_period_valuation_context", "rpc-read"], ["GET", B + "/rest/v1/rpc/rpc_get_x", "rpc-read"],
    ["GET", B + "/rest/v1/v_costing_pricing_sku_selector?select=*", "rest-read"], ["HEAD", B + "/rest/v1/v_x", "rest-read"], ["POST", B + "/auth/v1/token?grant_type=refresh_token", "auth-refresh"],
    ["GET", B + "/auth/v1/user", "auth-read"], ["GET", A + "/shared/js/x.js", "static"], ["GET", "https://esm.sh/@supabase/supabase-js@2", "cdn"], ["GET", "https://fonts.gstatic.com/x.woff2", "cdn"]]) {
    const c = cls(m, u); assert.equal(c.allowed, true, m + " " + u); assert.equal(c.kind, kind); assert.equal(c.violation, false);
  }
});
test("allow-list: every write-capable or unknown backend operation is denied AND counted as a violation", () => {
  const denied = [["POST", B + "/rest/v1/rpc/rpc_costing_approve_run"], ["POST", B + "/rest/v1/rpc/rpc_request_costing_refresh"], ["POST", B + "/rest/v1/rpc/rpc_costing_lock_period"], ["POST", B + "/rest/v1/rpc/rpc_costing_preview_approval_impact"],
    ["POST", B + "/rest/v1/rpc/rpc_accept_material_review_action"], ["POST", B + "/rest/v1/rpc/get_user_permissions_and_grant"], ["POST", B + "/rest/v1/rpc/rpc_getx"], ["POST", B + "/rest/v1/rpc/RPC_GET_X"], ["POST", B + "/rest/v1/rpc/rpc_get_x%2Fy"],
    ["PUT", B + "/rest/v1/rpc/rpc_get_x"], ["DELETE", B + "/rest/v1/rpc/rpc_get_x"], ["POST", B + "/rest/v1/some_table"], ["PATCH", B + "/rest/v1/some_table?id=eq.1"], ["DELETE", B + "/rest/v1/some_table"], ["PUT", B + "/rest/v1/some_table"],
    ["POST", B + "/auth/v1/logout"], ["POST", B + "/auth/v1/signup"], ["POST", B + "/auth/v1/token?grant_type=password"], ["PUT", B + "/auth/v1/user"], ["POST", B + "/storage/v1/object/x"], ["POST", B + "/functions/v1/anything"], ["GET", B + "/rest/v1/rpc/rpc_costing_approve_run"],
    ["POST", A + "/api/anything"], ["POST", "https://evil.example/collect"]];
  for (const [m, u] of denied) { const c = cls(m, u); assert.equal(c.allowed, false, m + " " + u); assert.equal(c.violation, true, "violation: " + m + " " + u); }
  assert.deepEqual([cls("GET", "https://evil.example/x").allowed, cls("GET", "https://evil.example/x").violation], [false, false], "an unexpected third-party GET is blocked but is a finding, not a write violation");
  assert.equal(cls("POST", "not a url").violation, true);
});
test("allow-list: the app's own FORBIDDEN_RPCS are all denied; the one documented run-status read is allowed ONLY through the documented list", () => {
  const forbidden = [...read("public/shared/js/costing-approval-screen.js").match(/FORBIDDEN_RPCS = Object\.freeze\(\[([\s\S]*?)\]\)/)[1].matchAll(/"([a-z0-9_]+)"/g)].map((m) => m[1]);
  assert.ok(forbidden.length >= 7 && forbidden.includes("rpc_costing_approve_run"));
  const documented = appDocumentedReadRpcs(read("public/shared/js/costing-run-status-screen.js"));
  assert.deepEqual(documented, ["rpc_get_costing_refresh_status", "rpc_costing_health_check"], "if this list changes the runner's reported exceptions must be re-reviewed");
  for (const n of forbidden) assert.equal(cls("POST", `${B}/rest/v1/rpc/${n}`).allowed, false, "default denies " + n);
  for (const n of forbidden.filter((x) => !documented.includes(x))) assert.equal(cls("POST", `${B}/rest/v1/rpc/${n}`, { extraRead: new Set(documented) }).allowed, false, "still denied with the documented list: " + n);
  const c = cls("POST", `${B}/rest/v1/rpc/rpc_costing_health_check`, { extraRead: new Set(documented) });
  assert.equal(c.allowed, true); assert.equal(c.kind, "rpc-read-app-documented");
  assert.equal(cls("PATCH", `${B}/rest/v1/rpc/rpc_costing_health_check`, { extraRead: new Set(documented) }).allowed, false, "only POST/GET");
  assert.deepEqual(appDocumentedReadRpcs("nothing here"), []);
});
test("allow-list: no rpc_get_* function in the repository's migrations writes (the pattern's premise)", () => {
  const dir = path.join(root, "supabase/migrations"); const pat = /create\s+(?:or\s+replace\s+)?function\s+(public\.rpc_get_[a-z0-9_]+)\s*\((.*?)\)\s*(.*?)\bas\s+(\$[a-z_]*\$)(.*?)\4/gis;
  let n = 0; const writers = [];
  for (const f of fs.readdirSync(dir)) for (const m of fs.readFileSync(path.join(dir, f), "utf8").matchAll(pat)) { n++; if (/\b(insert\s+into|update\s+[a-z_."]+\s+set|delete\s+from|truncate)\b/i.test(m[5])) writers.push(m[1] + " in " + f); }
  assert.ok(n >= 70, "definitions scanned: " + n); assert.deepEqual(writers, []);
  assert.ok(READ_RPC.test("rpc_get_x") && !READ_RPC.test("rpc_get") && !READ_RPC.test("xrpc_get_x") && !READ_RPC.test("rpc_get_x y"));
});
test("forbidden UI verbs: mutating labels are matched, read-only labels are not", () => {
  for (const t of ["Request draft", "Recalculate", "Refresh costing", "Close quarter (lock months)", "Lock period", "Apply", "Accept review", "Finalise", "Save", "Create scheme", "Delete", "Review for approval", "Approve", "Revoke"]) assert.match(t, FORBIDDEN_UI_VERBS, t);
  for (const t of ["Workload Preview", "Export PDF", "Explain line", "Search", "Load more", "Dashboard", "Close"]) assert.doesNotMatch(t, FORBIDDEN_UI_VERBS, t);
});

const V = COSTING_TARGETS.map((target) => ({ target, can_view: true, can_edit: false }));
test("identity: ID-V accepted only when session and canonical agree, all six targets are view-only and there is no edit grant anywhere", () => {
  assert.equal(evaluateIdentity({ label: "ID-V", sessionRows: V, canonicalRows: V }).ok, true);
  const bad = (name, over, expectMatch) => { const r = evaluateIdentity({ label: "ID-V", ...over }); assert.equal(r.ok, false, name); assert.match(r.failures.join(" | "), expectMatch, name); };
  bad("session has an edit grant", { sessionRows: V.map((r, i) => (i ? r : { ...r, can_edit: true })), canonicalRows: V }, /edit grants|disagree/);
  bad("canonical has an edit grant", { sessionRows: V, canonicalRows: V.map((r, i) => (i ? r : { ...r, can_edit: true })) }, /edit grants/);
  bad("an unrelated edit grant (the 52-grant account shape)", { sessionRows: [...V, { target: "module:other", can_view: true, can_edit: true }], canonicalRows: [...V, { target: "module:other", can_view: true, can_edit: true }] }, /edit grants/);
  bad("an unrelated VIEW grant", { sessionRows: [...V, { target: "module:other", can_view: true, can_edit: false }], canonicalRows: [...V, { target: "module:other", can_view: true, can_edit: false }] }, /only the six Costing grants/);
  bad("a target missing", { sessionRows: V.slice(1), canonicalRows: V }, /not can_view=true|disagree/);
  bad("a target not viewable", { sessionRows: V.map((r, i) => (i ? r : { ...r, can_view: false })), canonicalRows: V.map((r, i) => (i ? r : { ...r, can_view: false })) }, /not can_view=true/);
  bad("session and canonical disagree", { sessionRows: V, canonicalRows: V.slice(0, 5) }, /disagree/);
  bad("no canonical extract", { sessionRows: V, canonicalRows: null }, /no canonical/);
  bad("session read failed", { sessionRows: null, canonicalRows: V }, /no rows array/);
  bad("empty both", { sessionRows: [], canonicalRows: [] }, /not can_view/);
  assert.equal(evaluateIdentity({ label: "ID-X", sessionRows: V, canonicalRows: V }).ok, false);
});
test("identity: ID-N must hold no Costing permission", () => {
  assert.equal(evaluateIdentity({ label: "ID-N", sessionRows: [], canonicalRows: [] }).ok, true);
  assert.equal(evaluateIdentity({ label: "ID-N", sessionRows: [{ target: "module:other", can_view: true, can_edit: false }], canonicalRows: [{ target: "module:other", can_view: true, can_edit: false }] }).ok, true);
  assert.equal(evaluateIdentity({ label: "ID-N", sessionRows: V, canonicalRows: V }).ok, false);
  assert.equal(evaluateIdentity({ label: "ID-N", sessionRows: [], canonicalRows: V.slice(0, 1) }).ok, false);
});
test("redaction: tokens, JWTs, bearer headers, emails, user ids, API keys and canaries never survive; URLs lose query and fragment", () => {
  const dirty = "Authorization: Bearer abcdefghijkl1234 token=sup3rs3cr3tvalue eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sigsigsig me@corp.example 11111111-2222-4333-8444-555555555555 apikey=ANONKEY123456 CANARY-TOKEN-x";
  const clean = redact(dirty, 1000);
  for (const leak of ["abcdefghijkl1234", "sup3rs3cr3tvalue", "eyJhbGci", "me@corp.example", "11111111-2222", "ANONKEY123456", "CANARY-TOKEN"]) assert.ok(!clean.includes(leak), "leaked " + leak + " -> " + clean);
  assert.equal(safeUrl("https://x.example/a/b?access_token=SECRET#frag"), "https://x.example/a/b");
  assert.equal(safeUrl("::bad::"), "[unparseable-url]"); assert.equal(redact("x".repeat(500), 40).length, 40);
  assert.equal(containsSecret("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sigsigsig"), true); assert.equal(containsSecret("plain text"), false);
});
