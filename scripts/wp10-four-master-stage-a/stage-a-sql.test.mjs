// WP10 four-master Stage A — behavioural + procedural tests of the UNAPPLIED SQL package on a DISPOSABLE local PostgreSQL (fixture.mjs: STAND-INS, labelled).
// Run: node --test scripts/wp10-four-master-stage-a/stage-a-sql.test.mjs   (skips with an explicit SKIPPED if no local PostgreSQL binaries)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { startCluster, pgAvailable, newFixture, as, dml, parseChecks, runFile, rowsHash, policySnapshot, grantSnapshot, TABLES, RPC_CALLS, ACTORS, OWN_EDITOR, SQL_DIR, FILES } from "./fixture.mjs";

const skip = pgAvailable() ? false : "SKIPPED: no local PostgreSQL binaries";
let cluster;
test.before(() => { if (!skip) cluster = startCluster(); });
test.after(() => { cluster?.stop(); });

const preflight = (db) => parseChecks(runFile(cluster, db, "pre").out);
const postflight = (db) => parseChecks(runFile(cluster, db, "post").out);
const apply = (db) => runFile(cluster, db, "apply", { stopOnError: true });
const rollback = (db) => runFile(cluster, db, "rollback", { stopOnError: true });
const applied = () => { const db = newFixture(cluster); const r = apply(db); assert.equal(r.code, 0, r.err); return db; };

test("S01 preflight on the ORIGINAL state: RESULT PASS, zero FAIL, all 12 RPC checks PASS", { skip }, () => {
  const db = newFixture(cluster); const p = preflight(db);
  assert.equal(p.result?.status, "PASS", JSON.stringify(p.fails));
  assert.equal(p.fails.length, 0);
  assert.equal(p.rows.filter((r) => /^P14 rpc_wp10_/.test(r.id) && r.status === "PASS").length, 12);
  assert.equal(p.rows.filter((r) => /^P13 rpc_wp10_/.test(r.id) && r.status === "PASS").length, 12);
});

test("S02 baseline gap reproduced: on the original policies EVERY signed-in actor (even No-access/View-only) can write all four tables directly", { skip }, () => {
  for (const t of TABLES) {
    for (const actor of ["noAccess", "viewer"]) {
      const db = newFixture(cluster); // fresh database per actor (unique-name constraints)
      assert.equal(dml(cluster, db, actor, t.ins), 1, `${t.tbl} insert as ${actor}`);
      assert.equal(dml(cluster, db, actor, t.upd), 1, `${t.tbl} update as ${actor}`);
      assert.equal(dml(cluster, db, actor, t.del), 1, `${t.tbl} delete as ${actor}`);
    }
  }
});

test("S03 Stage A applies cleanly, in one transaction, without touching data or grants", { skip }, () => {
  const db = newFixture(cluster); const rows0 = rowsHash(cluster, db), grants0 = grantSnapshot(cluster, db);
  const r = apply(db); assert.equal(r.code, 0, r.err);
  assert.equal(rowsHash(cluster, db), rows0, "business rows unchanged");
  assert.equal(grantSnapshot(cluster, db), grants0, "GRANTs unchanged (no Stage B)");
  assert.equal(cluster.sql(db, "select count(*) from pg_policies where schemaname='public' and tablename in ('categories','sub_categories','product_groups','sub_groups')"), "16");
});

for (const t of TABLES) {
  test(`S04 ${t.tbl}: Stage A permission matrix (insert/update/delete/upsert allowed ONLY for the module Editor; reads open to all signed-in)`, { skip }, () => {
    const db = applied();
    const own = OWN_EDITOR[t.tbl];
    const denied = ["viewer", "noAccess", ...Object.values(OWN_EDITOR).filter((a) => a !== own)]; // View-only, No-access and Editors of the OTHER three modules
    for (const actor of denied) {
      const before = rowsHash(cluster, db);
      assert.equal(dml(cluster, db, actor, t.ins), "DENIED", `${t.tbl} insert as ${actor}`);
      assert.equal(dml(cluster, db, actor, t.upd), 0, `${t.tbl} update as ${actor} must affect 0 rows`);
      assert.equal(dml(cluster, db, actor, t.del), 0, `${t.tbl} delete as ${actor} must affect 0 rows`);
      assert.equal(dml(cluster, db, actor, t.ups), "DENIED", `${t.tbl} upsert as ${actor}`);
      assert.equal(rowsHash(cluster, db), before, `${t.tbl}: rows unchanged after denied attempts by ${actor}`);
    }
    // anonymous-style session: authenticated role but no uid
    assert.equal(dml(cluster, db, null, t.ins), "DENIED");
    // reads: hierarchy remains readable for every signed-in identity incl. No-access
    for (const actor of ["viewer", "noAccess", own, "editorAll"]) assert.equal(dml(cluster, db, actor, `select count(*) from public.${t.tbl}`), 3, `${t.tbl} read as ${actor}`);
    // legacy authorised Editor (old direct-writer binaries) keeps working
    for (const actor of [own, "editorAll"]) {
      const d2 = applied();
      assert.equal(dml(cluster, d2, actor, t.ins), 1, `${t.tbl} legacy insert as ${actor}`);
      assert.equal(dml(cluster, d2, actor, t.upd), 1, `${t.tbl} legacy update as ${actor}`);
      assert.equal(dml(cluster, d2, actor, t.ups), 1, `${t.tbl} legacy upsert as ${actor}`);
      assert.equal(dml(cluster, d2, actor, t.del), 1, `${t.tbl} legacy delete as ${actor}`);
    }
  });
}

test("S05 a View-only user can SEE rows (SELECT policy) but an UPDATE/DELETE of them affects 0 rows and a data-changing RETURNING path is not a bypass", { skip }, () => {
  const db = applied(); const before = rowsHash(cluster, db);
  assert.equal(dml(cluster, db, "viewer", "update public.categories set category_name = 'HACK' where true"), 0);
  assert.equal(dml(cluster, db, "viewer", "delete from public.sub_groups where true"), 0);
  assert.equal(dml(cluster, db, "noAccess", "update public.product_groups set group_name = 'HACK' where id in (select id from public.product_groups)"), 0);
  assert.equal(rowsHash(cluster, db), before);
});

for (const t of TABLES) {
  test(`S06 ${t.tbl}: governed RPCs keep working under Stage A and keep their own permission gate (Editor ok; View-only/No-access/other-module Editor denied)`, { skip }, () => {
    const db = applied(); const own = OWN_EDITOR[t.tbl];
    for (const call of RPC_CALLS[t.tbl]) {
      for (const actor of ["viewer", "noAccess", ...Object.values(OWN_EDITOR).filter((a) => a !== own)]) {
        const r = as(cluster, db, actor, call);
        assert.equal(r.ok, false, `${call} as ${actor} must be denied`);
        assert.match(r.err, /Permission denied/i);
      }
    }
    const before = rowsHash(cluster, db);
    for (const call of RPC_CALLS[t.tbl]) { const r = as(cluster, db, own, call); assert.equal(r.ok, true, `${call} as ${own}: ${r.err}`); }
    assert.notEqual(rowsHash(cluster, db), before, "RPC writes took effect");
    assert.equal(cluster.sql(db, `select count(*) from public.${t.tbl} where id = 3`), "0", "RPC delete took effect");
  });
}

test("S07 RPC independence from RLS: RPCs execute as the table owner (non-superuser, no BYPASSRLS) — a caller who passes the RPC gate is not blocked by the Stage A policies", { skip }, () => {
  const db = applied();
  assert.equal(cluster.sql(db, "select rolsuper::text || rolbypassrls::text from pg_roles where rolname = 'fx_owner'"), "falsefalse");
  const r = as(cluster, db, "editorAll", "select public.rpc_wp10_create_category('OWNER-PATH')"); assert.ok(r.ok, r.err);
  assert.equal(cluster.sql(db, "select count(*) from public.categories where category_name = 'OWNER-PATH'"), "1");
});

test("S08 postflight PASS after apply; every check PASS; preflight REFUSES the post-Stage-A state (re-run guard)", { skip }, () => {
  const db = applied(); const q = postflight(db);
  assert.equal(q.result?.status, "PASS", JSON.stringify(q.fails)); assert.equal(q.fails.length, 0);
  assert.ok(q.rows.filter((r) => r.status === "PASS").length >= 30);
  assert.equal(preflight(db).result.status, "FAIL");
});

test("S09 postflight detects tampering: wrong module key, residual FOR ALL policy, revoked grant, forced RLS", { skip }, () => {
  let db = applied();
  cluster.sql(db, "drop policy categories_authenticated_update on public.categories; create policy categories_authenticated_update on public.categories for update to authenticated using ((select public.app_has_permission('module:manage-subgroups','edit'))) with check ((select public.app_has_permission('module:manage-subgroups','edit')))");
  assert.equal(postflight(db).result.status, "FAIL");
  db = applied(); cluster.sql(db, "create policy extra_all on public.sub_groups for all to authenticated using (true) with check (true)");
  assert.equal(postflight(db).result.status, "FAIL");
  db = applied(); cluster.sql(db, "revoke delete on public.product_groups from authenticated");
  assert.equal(postflight(db).result.status, "FAIL");
  db = applied(); cluster.sql(db, "alter table public.categories force row level security");
  assert.equal(postflight(db).result.status, "FAIL");
});

test("S10 apply REFUSES (no change) on drift: extra policy, missing original policy, forced RLS, missing helper", { skip }, () => {
  const cases = [
    ["extra permissive policy", "create policy extra on public.categories for select to authenticated using (true)"],
    ["original policy dropped", "drop policy sub_groups_authenticated_crud on public.sub_groups"],
    ["forced RLS", "alter table public.product_groups force row level security"],
    ["helper EXECUTE revoked", "revoke execute on function public.app_has_permission(text,text) from authenticated"],
  ];
  for (const [label, ddl] of cases) {
    const db = newFixture(cluster); cluster.sql(db, ddl);
    const snap = policySnapshot(cluster, db);
    const r = apply(db); assert.notEqual(r.code, 0, `${label}: apply must fail`);
    assert.match(r.err, /WP10 Stage A refused/, label);
    assert.equal(policySnapshot(cluster, db), snap, `${label}: policies unchanged`);
  }
});

test("S11 apply is not re-runnable: a second apply refuses and changes nothing", { skip }, () => {
  const db = applied(); const snap = policySnapshot(cluster, db);
  const r = apply(db); assert.notEqual(r.code, 0); assert.match(r.err, /refused/);
  assert.equal(policySnapshot(cluster, db), snap);
});

test("S12 rollback is independent and exact: policy/grant/data snapshot after rollback == original; legacy gap reopens; preflight PASS again; re-apply works", { skip }, () => {
  const db = newFixture(cluster); const pol0 = policySnapshot(cluster, db), gr0 = grantSnapshot(cluster, db), rows0 = rowsHash(cluster, db);
  assert.equal(apply(db).code, 0);
  const r = rollback(db); assert.equal(r.code, 0, r.err);
  assert.equal(policySnapshot(cluster, db), pol0, "policies restored exactly");
  assert.equal(grantSnapshot(cluster, db), gr0); assert.equal(rowsHash(cluster, db), rows0);
  assert.equal(preflight(db).result.status, "PASS");
  assert.equal(dml(cluster, db, "noAccess", TABLES[0].ins), 1, "documented consequence: exposure reopened");
  assert.equal(apply(db).code, 0, "re-apply after rollback"); assert.equal(postflight(db).result.status, "PASS");
});

test("S13 rollback REFUSES (no change) when: already at original state; policy set amended; Stage B applied; partial", { skip }, () => {
  let db = newFixture(cluster); let snap = policySnapshot(cluster, db);
  let r = rollback(db); assert.notEqual(r.code, 0); assert.equal(policySnapshot(cluster, db), snap, "original state: refused");
  db = applied(); cluster.sql(db, "create policy extra on public.sub_groups for select to authenticated using (true)"); snap = policySnapshot(cluster, db);
  r = rollback(db); assert.notEqual(r.code, 0); assert.match(r.err, /rollback refused/); assert.equal(policySnapshot(cluster, db), snap, "amended: refused");
  db = applied(); cluster.sql(db, "revoke insert, update, delete on table public.categories, public.sub_categories, public.product_groups, public.sub_groups from authenticated"); snap = policySnapshot(cluster, db);
  r = rollback(db); assert.notEqual(r.code, 0); assert.match(r.err, /Stage B/); assert.equal(policySnapshot(cluster, db), snap, "post-Stage-B: refused");
  db = applied(); cluster.sql(db, "drop policy categories_authenticated_delete on public.categories"); snap = policySnapshot(cluster, db);
  r = rollback(db); assert.notEqual(r.code, 0); assert.equal(policySnapshot(cluster, db), snap, "partial: refused");
});

test("S14 preflight FAIL negative controls: FORCE RLS, rogue FOR ALL policy, PUBLIC grant, RPC missing/INVOKER/wrong permission target, SECURITY INVOKER indirect writer", { skip }, () => {
  const mk = (ddl, id) => { const db = newFixture(cluster); cluster.sql(db, ddl); const p = preflight(db); assert.equal(p.result.status, "FAIL", ddl); assert.ok(p.fails.some((f) => f.id.startsWith(id)), `${id} expected in ${JSON.stringify(p.fails.map((f) => f.id))}`); };
  mk("alter table public.categories force row level security", "P03");
  mk("create policy rogue on public.sub_groups for all to public using (true) with check (true)", "P04");
  mk("grant select on public.categories to public", "P08");
  mk("drop function public.rpc_wp10_delete_subgroup(int)", "P11");
  mk("alter function public.rpc_wp10_rename_category(int,text) security invoker", "P12");
  mk("create or replace function public.rpc_wp10_create_category(p_name text) returns void language plpgsql security definer as $$ begin perform public.require_permission('module:manage-subgroups', true); insert into public.categories(category_name) values (p_name); end $$", "P14");
  mk("alter function public.rpc_wp10_delete_category(int) owner to postgres; alter table public.categories owner to fx_owner; revoke all on schema public from fx_owner; create role nobypass nologin; alter function public.rpc_wp10_delete_category(int) owner to nobypass", "P13");
  mk("create function public.legacy_invoker_writer() returns void language plpgsql as $$ begin update public.product_groups set group_name = group_name; end $$", "P17");
  mk("revoke execute on function public.require_permission(text,boolean) from authenticated", "P09");
});

test("S15 preflight WARN/INFO rows expose reviewer facts without identities", { skip }, () => {
  const db = newFixture(cluster); cluster.sql(db, "create function public.owner_definer_writer() returns void language plpgsql security definer as $$ begin delete from public.sub_groups where false; end $$");
  const p = preflight(db);
  assert.equal(p.result.status, "PASS");
  assert.ok(p.rows.some((r) => /^P17 owner_definer_writer/.test(r.id) && r.status === "WARN"));
  const edit = p.rows.find((r) => /^P19 categories/.test(r.id)); assert.match(edit.detail, /: 2/);
  assert.ok(!p.rows.some((r) => /00000000-0000-0000-0000/.test(r.detail)), "no user ids in output");
});

test("S16 Stage A package contains NO Stage B REVOKE and no GRANT/REVOKE/ALTER TABLE/data DML statements (comments stripped)", { skip: false }, () => {
  for (const f of Object.values(FILES)) {
    const code = fs.readFileSync(path.join(SQL_DIR, f), "utf8").split("\n").map((l) => l.replace(/--.*$/, "")).join("\n").replace(/'(?:[^']|'')*'/g, "''");  // comments and string literals stripped
    assert.doesNotMatch(code, /\brevoke\b/i, f + " must not REVOKE");
    assert.doesNotMatch(code, /\bgrant\b/i, f + " must not GRANT");
    assert.doesNotMatch(code, /\balter\s+table\b|\btruncate\b|\bdrop\s+table\b/i, f);
    assert.doesNotMatch(code, /\b(insert\s+into|delete\s+from|update)\s+(public\.)?(categories|sub_categories|product_groups|sub_groups)\b/i, f + " must not write master data");
  }
});

test("S17 each table is gated by its OWN module key and 'edit' (static check of the apply file)", { skip: false }, () => {
  const code = fs.readFileSync(path.join(SQL_DIR, FILES.apply), "utf8");
  for (const t of TABLES) {
    const section = code.slice(code.indexOf(`-- ${["categories", "sub_categories", "product_groups", "sub_groups"].indexOf(t.tbl) + 1}. ${t.tbl}`));
    const block = section.slice(0, section.indexOf("\n\n"));
    const keys = [...block.matchAll(/app_has_permission\('([^']+)', '([^']+)'\)/g)];
    assert.equal(keys.length, 4, t.tbl + ": insert check + update using/check + delete using = 4 gates, counted " + keys.length);
  }
  const all = [...code.matchAll(/app_has_permission\('([^']+)', '([^']+)'\)/g)];
  assert.ok(all.every((m) => m[2] === "edit"));
  assert.deepEqual([...new Set(all.map((m) => m[1]))].sort(), TABLES.map((t) => t.target).sort());
});
