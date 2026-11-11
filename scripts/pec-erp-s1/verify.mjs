// PEC ERP-S1 isolated PostgreSQL 17.4 fixture verifier.
// Fails closed (exit 2) if exact runtime unavailable; NEVER connects to Supabase.
// Run: node scripts/pec-erp-s1/verify.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findPgBin, startCluster } from "../cde2-sql-candidate/pg-isolated.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const bin = findPgBin();
if (!bin) {
  console.error("PEC S1 FAIL CLOSED: PostgreSQL binaries missing; 17.4 fixture checks NOT RUN");
  process.exit(2);
}
let cluster;
const fixture = fs.readFileSync(path.join(here, "fixture.sql"), "utf8");
const candidate = fs.readFileSync(path.join(root, "docs/procurement-execution/ERP_S1_DRAFT_EDIT_SQL_CANDIDATE_20261111.sql"), "utf8");
let passed = 0;
const UID = "00000000-0000-4000-8000-000000000001";
const REV = "'2026-11-11 12:00:00+00'::timestamptz";
const call = (expr, { editor = true, role = "authenticated", extra = "" } = {}) => {
  const sql = `BEGIN;
SET LOCAL ROLE ${role};
SELECT set_config('request.jwt.claim.sub','${UID}',true);
SELECT set_config('pec.fixture.edit','${editor ? "yes" : "no"}',true);
${extra}
SELECT ${expr};
ROLLBACK;`;
  return cluster.run("s1", sql, { allowError: true });
};
const good = (name, expr, expected) => {
  const r = call(expr);
  assert.equal(r.status, 0, name + ": " + r.err);
  if (expected) assert.match(r.out, expected, name + " output: " + r.out);
  console.log("PASS", name); passed++;
};
const denied = (name, expr, err, opts = {}) => {
  const r = call(expr, opts);
  assert.notEqual(r.status, 0, name + " unexpectedly succeeded: " + r.out);
  assert.match(r.err, err, name + ": " + r.err);
  console.log("PASS", name); passed++;
};
const qty = (id, expectedQty = "10", newQty = "11", revision = REV, reason = "'fixture change'") =>
  `public.proc_indent_update_manual_draft_qty(${id},${revision},${expectedQty},${newQty},${reason})`;
const date = (id, next = "'2026-11-12'::date", revision = REV, reason = "'date correction'") =>
  `public.proc_indent_update_manual_draft_date(${id},${revision},${next},${reason})`;
try {
  cluster = startCluster(bin);
  const version = Number(cluster.run("postgres", "show server_version_num;").out);
  if (version !== 170004) {
    console.error(`PEC S1 FAIL CLOSED: server_version_num=${version}; exact PG 17.4 (170004) required`);
    process.exitCode = 2;
  } else {
    cluster.createDb("s1");
    cluster.run("s1", fixture);
    cluster.run("s1", candidate);
    // Assert permission grants from the installed candidate under the fixture.
    const acl = cluster.run("s1",
      "select has_function_privilege('authenticated','public.proc_indent_update_manual_draft_qty(bigint,timestamptz,numeric,numeric,text)','EXECUTE'),has_function_privilege('anon','public.proc_indent_update_manual_draft_qty(bigint,timestamptz,numeric,numeric,text)','EXECUTE');").out;
    assert.equal(acl, "t|f", "authenticated has EXECUTE and anon denied"); passed++; console.log("PASS ACL grants");

    good("standalone draft quantity edit", qty(11), /1\|11\|11\|/);
    good("standalone draft date edit", date(1), /1\|2026-11-12\|/);
    denied("approved indent refused", qty(12), /independent draft/i);
    denied("PR-linked draft refused", qty(13), /independent draft/i);
    denied("active mapping refused", qty(14), /active PR link/i);
    denied("vendor-selected draft refused", qty(16), /vendor assignment/i);
    denied("view-only refused", qty(11), /permission denied/i, { editor: false });
    denied("anon refused by ACL", qty(11), /permission denied for function/i, { role: "anon" });
    denied("stale parent revision", qty(11, "10", "11", "'2026-11-10'::timestamptz"), /changed since it was opened/i);
    denied("stale expected quantity", qty(11, "12"), /line quantity changed/i);
    denied("zero quantity", qty(11, "10", "0"), /finite positive/i);
    denied("negative quantity", qty(11, "10", "-5"), /finite positive/i);
    denied("NaN quantity", qty(11, "10", "'NaN'::numeric"), /finite positive/i);
    denied("missing reason", qty(11, "10", "11", REV, "null"), /edit reason/i);
    denied("date-coded month-change refused", date(5, "'2026-12-01'::date"), /another month/i);
    good("date-coded same-month correction", date(5, "'2026-11-12'::date"), /5\|2026-11-12/);
    good("numeric indent cross-month date correction", date(1, "'2026-12-01'::date"), /1\|2026-12-01/);
    denied("no-op date refused", date(1, "'2026-11-11'::date"), /date unchanged/i);
    denied("no-op quantity refused", qty(11, "10", "10"), /quantity unchanged/i);

    // Audit trigger and reason both present before the save transaction rolls back.
    const audit = call(`(select count(*) from public.pec_fixture_audit where event_type='INDENT_DRAFT_DATE_REASON')`, {
      extra: `SELECT public.proc_indent_update_manual_draft_date(1,${REV},'2026-11-12'::date,'explicit date reason');`
    });
    assert.equal(audit.status, 0, audit.err);
    assert.match(audit.out, /1\s*$/);
    passed++; console.log("PASS explicit date reason audit");
    console.log(`PEC ERP-S1 PG17.4 ISOLATED PASS: ${passed} checks. Synthetic fixture only; no production claim.`);
  }
} catch (e) {
  console.error("PEC ERP-S1 VERIFIER FAILED:", e.stack || String(e));
  process.exitCode = 1;
} finally {
  cluster?.stop();
}
