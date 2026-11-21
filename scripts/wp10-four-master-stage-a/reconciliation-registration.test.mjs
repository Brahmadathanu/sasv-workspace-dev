// WP10 Stage A reconciliation: tests of the read-only verification script R1 and of the ROLLED-BACK DRY-RUN technique, on DISPOSABLE PostgreSQL.
// The supabase_migrations.schema_migrations table here is a STAND-IN with synthetic rows. Nothing is registered anywhere real.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { startCluster, pgAvailable, newFixture, rowsHash, policySnapshot, root, MIGRATION } from "./fixture.mjs";

const R1 = path.join(root, "docs/master-data-costing/WP10_STAGE_A_RECONCILIATION_SQL/R1_reconciliation_verify_readonly.sql");
const mig = () => fs.readFileSync(path.join(root, MIGRATION), "utf8");
const VERSION = "20261118161406", NAME = "wp10_four_master_stage_a_state_reconciliation";
const skip = pgAvailable() ? false : "SKIPPED: no local PostgreSQL binaries";
let cluster;
test.before(() => { if (!skip) cluster = startCluster(); });
test.after(() => { cluster?.stop(); });

const withHistory = (db, n = 705) => cluster.sql(db, `create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key, name text, statements text[]);
  insert into supabase_migrations.schema_migrations select (20200101000000 + g)::text, 'synthetic_' || g, null from generate_series(1, ${n - 1}) g; insert into supabase_migrations.schema_migrations values ('20261116143310', 'synthetic_latest', null)`);
const r1 = (db) => { const r = cluster.script(db, fs.readFileSync(R1, "utf8")); assert.equal(r.code, 0, r.err); return Object.fromEntries(r.out.split("\n").filter((l) => l.includes("|")).map((l) => { const i = l.indexOf("|"); return [l.slice(0, i), l.slice(i + 1)]; })); };
const dryRun = (sql) => { assert.equal(sql.split(/^commit;$/m).length, 2); return sql.replace(/^commit;$/m, "rollback;"); };
const hardened = () => { const db = newFixture(cluster); assert.equal(cluster.script(db, mig(), { stopOnError: true }).code, 0); withHistory(db); return db; };
const stripVolatile = (m) => Object.fromEntries(Object.entries(m).filter(([k]) => !/^(history_|target_|registered_row|duplicate)/.test(k)));

test("W1 R1 is read-only: only a READ ONLY transaction, no DDL/DML/grant tokens", () => {
  const code = fs.readFileSync(R1, "utf8").split("\n").map((l) => l.replace(/--.*$/, "")).join("\n").replace(/'(?:[^']|'')*'/g, "''");
  assert.match(code, /begin transaction read only;/); assert.match(code, /rollback;\s*$/);
  for (const re of [/\binsert\b/i, /\bupdate\b/i, /\bdelete\b/i, /\bcreate\b/i, /\balter\b/i, /\bdrop\b/i, /\bgrant\b/i, /\brevoke\b/i, /\btruncate\b/i, /\bcommit\b/i]) assert.doesNotMatch(code, re, String(re));
});
test("W2 R1 on a hardened database reports the expected facts (12 RPCs, 16 policies, authenticated SELECT,INSERT,UPDATE,DELETE, version unused, later than all)", { skip }, () => {
  const db = hardened(); const m = r1(db);
  assert.equal(m["history_count"], "705"); assert.equal(m["history_max_version"], "20261116143310");
  assert.equal(m["target_version_unused (expect true BEFORE, false AFTER)"], "true"); assert.equal(m["target_version_later_than_all_other_registered"], "true");
  assert.equal(m["policy_count_on_four_tables (expect 16 when hardened)"], "16"); assert.equal(m["governed_rpc_count (expect 12)"], "12");
  assert.equal(m["duplicate_versions (expect 0)"], "0");
  for (const t of ["categories", "sub_categories", "product_groups", "sub_groups"]) { assert.equal(m[`authenticated_table_privileges ${t}`], "DELETE,INSERT,SELECT,UPDATE"); assert.equal(m[`rls_flags (enabled,forced) ${t}`], "true,false"); }
});
test("W3 rolled-back dry-run of the exact migration: on a hardened DB reports STATE B and changes nothing; on a baseline DB reports STATE A but persists NOTHING", { skip }, () => {
  const h = hardened(); const before = r1(h); let r = cluster.script(h, dryRun(mig()), { stopOnError: true });
  assert.equal(r.code, 0, r.err); assert.match(r.err, /STATE B/); assert.deepEqual(r1(h), before);
  const b = newFixture(cluster); withHistory(b); const snap = policySnapshot(cluster, b), fp = r1(b);
  r = cluster.script(b, dryRun(mig()), { stopOnError: true }); assert.equal(r.code, 0, r.err); assert.match(r.err, /STATE A/);
  assert.equal(policySnapshot(cluster, b), snap, "dry-run persisted nothing"); assert.deepEqual(r1(b), fp);
  assert.notDeepEqual(stripVolatile(fp), stripVolatile(before), "a baseline DB fingerprints differently from a hardened one (R1 can tell them apart)");
});
test("W4 registration exactly once (SIMULATED on stand-in history): table fingerprints identical before/after; history_count +1; one row with the exact version and name; duplicate refused by the PK", { skip }, () => {
  const db = hardened(); const before = r1(db); const dataBefore = rowsHash(cluster, db);
  cluster.sql(db, `insert into supabase_migrations.schema_migrations values ('${VERSION}', '${NAME}', null)`);
  const after = r1(db);
  assert.deepEqual(stripVolatile(after), stripVolatile(before), "policies, grants, RPC/helper definitions, row counts unchanged");
  assert.equal(after["history_count"], "706"); assert.equal(after["history_max_version"], VERSION);
  assert.equal(after["registered_row (version and name)"], `${VERSION} ${NAME}`); assert.equal(after["target_version_unused (expect true BEFORE, false AFTER)"], "false");
  assert.equal(after["target_name_registered_rows (expect 0 BEFORE, 1 AFTER)"], "1"); assert.equal(after["duplicate_versions (expect 0)"], "0");
  assert.throws(() => cluster.sql(db, `insert into supabase_migrations.schema_migrations values ('${VERSION}', '${NAME}', null)`), /duplicate key|already exists/);
  assert.equal(rowsHash(cluster, db), dataBefore);
  // the exact migration is still a verified no-op after registration (idempotent for any later deploy)
  const r = cluster.script(db, mig(), { stopOnError: true }); assert.equal(r.code, 0, r.err); assert.match(r.err, /STATE B/); assert.deepEqual(stripVolatile(r1(db)), stripVolatile(before));
});
test("W5 R1 is sensitive: policy, grant, RPC-definition and helper-definition changes each alter the corresponding fingerprint", { skip }, () => {
  const m0 = r1(hardened());
  const mut = (ddl) => { const db = hardened(); cluster.sql(db, ddl); return r1(db); };
  assert.notEqual(mut("drop policy categories_authenticated_delete on public.categories")["policy_fingerprint (names, cmd, roles, expressions; no OIDs)"], m0["policy_fingerprint (names, cmd, roles, expressions; no OIDs)"]);
  assert.notEqual(mut("revoke delete on public.sub_groups from authenticated")["table_acl_fingerprint"], m0["table_acl_fingerprint"]);
  assert.notEqual(mut("create or replace function public.rpc_wp10_rename_category(p_id int, p_name text) returns void language plpgsql security definer set search_path = public, pg_temp as $$ begin null; end $$")["governed_rpc_definition_fingerprint"], m0["governed_rpc_definition_fingerprint"]);
  assert.notEqual(mut("create or replace function public.require_permission(p_target text, p_edit boolean) returns void language plpgsql as $$ begin null; end $$")["helper_definition_fingerprint"], m0["helper_definition_fingerprint"]);
});
