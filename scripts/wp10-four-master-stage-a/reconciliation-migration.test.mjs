// WP10 four-master Stage A — behavioural tests of the state-aware RECONCILIATION MIGRATION on DISPOSABLE local PostgreSQL (fixture.mjs: STAND-INS, see its PROVENANCE).
// Nothing here touches production. "Production evidence" referenced in names (58/58 postflight, 119/0/0 preflight) is quoted from the PR #477 receipt and is NOT re-tested here.
// Run: node --test scripts/wp10-four-master-stage-a/reconciliation-migration.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { startCluster, pgAvailable, newFixture, as, dml, parseChecks, runFile, rowsHash, policySnapshot, grantSnapshot, TABLES, RPC_CALLS, ACTORS, OWN_EDITOR, root, MIGRATION } from "./fixture.mjs";

const migText = () => fs.readFileSync(path.join(root, MIGRATION), "utf8");
const skip = pgAvailable() ? false : "SKIPPED: no local PostgreSQL binaries";
let cluster;
test.before(() => { if (!skip) cluster = startCluster(); });
test.after(() => { cluster?.stop(); });

const FOUR = "('categories','sub_categories','product_groups','sub_groups')";
const run = (db, sql) => cluster.script(db, sql, { stopOnError: true });
/** everything the migration must not disturb, INCLUDING policy OIDs (a drop/recreate changes them) */
const fullSnap = (db) => cluster.sql(db, `select md5(concat_ws('#',
  (select string_agg(p.oid::text || p.polname::text || p.polcmd::text || p.polpermissive::text || p.polroles::text || coalesce(pg_get_expr(p.polqual, p.polrelid), '') || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), ''), ';' order by p.oid) from pg_policy p where p.polrelid::regclass::text in ${FOUR}),
  (select string_agg(c.relname::text || coalesce(c.relacl::text, '') || c.relrowsecurity::text || c.relforcerowsecurity::text, ';' order by c.relname) from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'),
  (select string_agg(p.proname::text || md5(pg_get_functiondef(p.oid)), ';' order by p.proname) from pg_proc p where p.pronamespace = 'public'::regnamespace),
  (select string_agg(proacl::text, ';' order by proname) from pg_proc where pronamespace = 'public'::regnamespace)))`) + "|" + (() => { try { return rowsHash(cluster, db); } catch { return "data-n/a"; } })();
const baseline = () => newFixture(cluster);
const hardenedVia02 = () => { const db = baseline(); const r = runFile(cluster, db, "apply"); assert.equal(r.code, 0, r.err); return db; };

// ---- ad-hoc DDL used to build non-standard states ----
const pred = (key, modes = ["view", "edit"]) => modes.map((m) => `(select public.app_has_permission('${key}', '${m}'))`).join(" and ");
const hardenTable = (t, key = t.target, modes = ["view", "edit"]) => `
  drop policy if exists ${t.tbl}_authenticated_crud on public.${t.tbl}; drop policy if exists ${t.tbl}_authenticated_read on public.${t.tbl}; drop policy if exists ${t.tbl}_authenticated_insert on public.${t.tbl};
  drop policy if exists ${t.tbl}_authenticated_update on public.${t.tbl}; drop policy if exists ${t.tbl}_authenticated_delete on public.${t.tbl};
  create policy ${t.tbl}_authenticated_read on public.${t.tbl} for select to authenticated using ((select auth.uid()) is not null);
  create policy ${t.tbl}_authenticated_insert on public.${t.tbl} for insert to authenticated with check (${pred(key, modes)});
  create policy ${t.tbl}_authenticated_update on public.${t.tbl} for update to authenticated using (${pred(key, modes)}) with check (${pred(key, modes)});
  create policy ${t.tbl}_authenticated_delete on public.${t.tbl} for delete to authenticated using (${pred(key, modes)});`;
const revertTable = (t) => `
  drop policy ${t.tbl}_authenticated_read on public.${t.tbl}; drop policy ${t.tbl}_authenticated_insert on public.${t.tbl}; drop policy ${t.tbl}_authenticated_update on public.${t.tbl}; drop policy ${t.tbl}_authenticated_delete on public.${t.tbl};
  create policy ${t.tbl}_authenticated_crud on public.${t.tbl} for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);`;
const replacePolicy = (t, suffix, ddl) => `drop policy ${t.tbl}_authenticated_${suffix} on public.${t.tbl}; ${ddl}`;
const allFourRevoke = "revoke insert, update, delete on table public.categories, public.sub_categories, public.product_groups, public.sub_groups from authenticated";

/** refusal check: migration must fail with the controlled message and change NOTHING (policies incl. OIDs, grants, functions, data) */
function expectRefused(sql, db, label, out) {
  const before = fullSnap(db); const r = run(db, sql);
  if (r.code === 0) out.push(`${label}: migration should have been REFUSED but succeeded`);
  else if (!/WP10 Stage A reconciliation REFUSED/.test(r.err)) out.push(`${label}: failed but not with the controlled refusal (${r.err.split("\n")[0].slice(0, 120)})`);
  if (fullSnap(db) !== before) out.push(`${label}: refusal CHANGED database state`);
}

// ================= scenarios (return failure strings; reused unchanged against mutated SQL) =================
export const SCENARIOS = [
  { id: "A1 original baseline -> correctly hardened; identical to the reviewed 02 result; postflight PASS 58; invariants hold", core: true, fn(sql) {
    const f = []; const db = baseline(); const r = run(db, sql);
    if (r.code !== 0 || !/STATE A/.test(r.err)) { f.push("baseline apply failed or not STATE A: " + r.err.slice(0, 200)); return f; }
    const ref = hardenedVia02();
    if (policySnapshot(cluster, db) !== policySnapshot(cluster, ref)) f.push("policies differ from the reviewed 02_stage_a_apply.sql result");
    if (grantSnapshot(cluster, db) !== grantSnapshot(cluster, baseline())) f.push("GRANTs changed");
    const q = parseChecks(runFile(cluster, db, "post").out); if (q.result?.status !== "PASS" || q.result?.detail !== "58 pass / 0 fail") f.push("03 postflight not 58 PASS: " + JSON.stringify(q.result));
    for (const t of TABLES) {
      const own = OWN_EDITOR[t.tbl];
      for (const a of ["editNoView", "viewer", "noAccess"]) { if (dml(cluster, db, a, t.ins) !== "DENIED") f.push(`${t.tbl}: ${a} insert not denied`); if (dml(cluster, db, a, t.upd) !== 0) f.push(`${t.tbl}: ${a} update not 0`); if (dml(cluster, db, a, t.del) !== 0) f.push(`${t.tbl}: ${a} delete not 0`); }
      if (dml(cluster, db, own, t.ins) !== 1) f.push(`${t.tbl}: view+edit editor insert not allowed`);
    }
    return f; } },
  { id: "A2 hierarchy SELECT unaffected for every signed-in identity; all 12 governed RPCs compatible (Editor ok; others denied by their own gate)", core: false, fn(sql) {
    const f = []; const db = baseline(); if (run(db, sql).code !== 0) return ["apply failed"];
    for (const t of TABLES) {
      for (const a of ["viewer", "noAccess", "editNoView", OWN_EDITOR[t.tbl], "editorAll"]) if (dml(cluster, db, a, `select count(*) from public.${t.tbl}`) !== 3) f.push(`${t.tbl} read as ${a}`);
      const own = OWN_EDITOR[t.tbl];
      for (const call of RPC_CALLS[t.tbl]) { for (const a of ["viewer", "noAccess", "editNoView"]) if (as(cluster, db, a, call).ok) f.push(`${call} should be denied for ${a}`); if (!as(cluster, db, own, call).ok) f.push(`${call} failed for ${own}`); }
    }
    return f; } },
  { id: "B1 already hardened (via reviewed 02) -> verified no-op: zero catalog change (policy OIDs, ACLs, functions, data); repeated runs stable", core: true, fn(sql) {
    const f = []; const db = hardenedVia02(); const s0 = fullSnap(db);
    for (let i = 1; i <= 3; i++) { const r = run(db, sql); if (r.code !== 0 || !/STATE B/.test(r.err)) f.push(`run ${i} not a successful STATE B no-op: ${r.err.slice(0, 160)}`); if (fullSnap(db) !== s0) f.push(`run ${i} changed state`); }
    return f; } },
  { id: "B2 migration-applied baseline is then stable on repeat (STATE B, OIDs unchanged)", core: false, fn(sql) {
    const f = []; const db = baseline(); if (run(db, sql).code !== 0) return ["first apply failed"]; const s1 = fullSnap(db);
    for (let i = 0; i < 2; i++) { const r = run(db, sql); if (r.code !== 0 || !/STATE B/.test(r.err)) f.push("repeat not STATE B"); if (fullSnap(db) !== s1) f.push("repeat changed state"); }
    return f; } },
  { id: "C1 mixed original/hardened (either direction, each table) -> refused, nothing changed", core: true, fn(sql) {
    const f = [];
    for (const t of TABLES) {
      let db = hardenedVia02(); cluster.sql(db, revertTable(t)); expectRefused(sql, db, `hardened with ${t.tbl} original`, f);
      db = baseline(); cluster.sql(db, hardenTable(t)); expectRefused(sql, db, `original with ${t.tbl} hardened`, f);
    }
    return f; } },
  { id: "C2 incorrect module permission key (insert/update/delete, any table) -> refused", core: true, fn(sql) {
    const f = [];
    for (const [i, t] of TABLES.entries()) { const other = TABLES[(i + 1) % 4].target; const db = hardenedVia02(); cluster.sql(db, hardenTable(t, other)); expectRefused(sql, db, `${t.tbl} policies gated by another module's key`, f); }
    for (const suffix of ["insert", "update", "delete"]) {
      const t = TABLES[2]; const db = hardenedVia02(); const wrong = pred(TABLES[0].target);
      cluster.sql(db, replacePolicy(t, suffix, suffix === "insert" ? `create policy ${t.tbl}_authenticated_insert on public.${t.tbl} for insert to authenticated with check (${wrong})` : suffix === "update" ? `create policy ${t.tbl}_authenticated_update on public.${t.tbl} for update to authenticated using (${pred(t.target)}) with check (${wrong})` : `create policy ${t.tbl}_authenticated_delete on public.${t.tbl} for delete to authenticated using (${wrong})`));
      expectRefused(sql, db, `${t.tbl} ${suffix} wrong key`, f);
    }
    return f; } },
  { id: "C3 Edit-only (no View) and View-only predicates, or UPDATE missing WITH CHECK -> refused", core: true, fn(sql) {
    const f = [];
    for (const [label, modes] of [["edit-only (rev 1 defect)", ["edit"]], ["view-only", ["view"]]]) { const db = hardenedVia02(); cluster.sql(db, hardenTable(TABLES[0], TABLES[0].target, modes)); expectRefused(sql, db, label, f); }
    const t = TABLES[1]; let db = hardenedVia02(); cluster.sql(db, replacePolicy(t, "update", `create policy ${t.tbl}_authenticated_update on public.${t.tbl} for update to authenticated using (${pred(t.target)})`)); expectRefused(sql, db, "update without WITH CHECK", f);
    db = hardenedVia02(); cluster.sql(db, replacePolicy(t, "read", `create policy ${t.tbl}_authenticated_read on public.${t.tbl} for select to authenticated using (true)`)); expectRefused(sql, db, "SELECT policy altered (true)", f);
    return f; } },
  { id: "C4 unexpected permissive / restrictive / PUBLIC-role / extra policy (on baseline AND hardened) -> refused", core: true, fn(sql) {
    const f = [];
    const extras = ["create policy extra on public.sub_groups for select to authenticated using (true)", "create policy extra on public.categories as restrictive for all to authenticated using (true)", "create policy extra on public.product_groups for all to public using (true) with check (true)", "create policy extra on public.sub_categories for insert to anon with check (true)"];
    for (const ddl of extras) for (const mk of [baseline, hardenedVia02]) { const db = mk(); cluster.sql(db, ddl); expectRefused(sql, db, `${mk === baseline ? "baseline" : "hardened"} + ${ddl.slice(0, 60)}`, f); }
    return f; } },
  { id: "C5 missing/altered dependency (helper, RPC, ownership, RLS flags, invoker writer) -> refused on baseline and hardened", core: false, fn(sql) {
    const f = [];
    const drifts = {
      "helper app_has_permission dropped": "drop function public.app_has_permission(text,text) cascade",
      "helper require_permission dropped": "drop function public.require_permission(text,boolean)",
      "helper core EXECUTE revoked from authenticated": "revoke execute on function public.app_has_permission_core(uuid,text,text) from authenticated",
      "app_has_permission EXECUTE revoked from authenticated": "revoke execute on function public.app_has_permission(text,text) from authenticated",
      "RPC missing": "drop function public.rpc_wp10_delete_subgroup(int)",
      "RPC made SECURITY INVOKER": "alter function public.rpc_wp10_rename_category(int,text) security invoker",
      "RPC body gated by wrong module": "create or replace function public.rpc_wp10_create_category(p_name text) returns void language plpgsql security definer as $$ begin perform public.require_permission('module:manage-subgroups', true); insert into public.categories(category_name) values (p_name); end $$",
      "RPC owner without bypass": "do $$ begin if not exists (select 1 from pg_roles where rolname = 'wp10_nobypass') then create role wp10_nobypass nologin; end if; end $$; alter function public.rpc_wp10_delete_category(int) owner to wp10_nobypass",
      "RPC loses authenticated EXECUTE": "revoke execute on function public.rpc_wp10_create_subcategory(int,text) from authenticated",
      "RPC gains PUBLIC EXECUTE": "grant execute on function public.rpc_wp10_create_product_group(int,text,int) to public",
      "FORCE RLS": "alter table public.product_groups force row level security",
      "RLS disabled": "alter table public.sub_groups disable row level security",
      "SECURITY INVOKER writer function": "create function public.legacy_invoker_writer() returns void language plpgsql as $$ begin update public.product_groups set group_name = group_name; end $$",
      "table missing": "drop table public.products; drop table public.sub_groups",
    };
    for (const [label, ddl] of Object.entries(drifts)) for (const mk of [baseline, hardenedVia02]) { const db = mk(); try { cluster.sql(db, ddl); } catch (e) { f.push(`fixture drift failed to build: ${label}: ${String(e).slice(0, 100)}`); continue; } expectRefused(sql, db, `${mk === baseline ? "baseline" : "hardened"}: ${label}`, f); }
    return f; } },
  { id: "C5b dependency drift that the core mutation set must catch: wrong-module RPC and extra privilege/grantee/PUBLIC/anon grants", core: true, fn(sql) {
    const f = [];
    const drifts = { "RPC body gated by wrong module": "create or replace function public.rpc_wp10_create_category(p_name text) returns void language plpgsql security definer as $$ begin perform public.require_permission('module:manage-subgroups', true); insert into public.categories(category_name) values (p_name); end $$",
      "authenticated TRUNCATE": "grant truncate on public.categories to authenticated", "PUBLIC grant": "grant select on public.sub_groups to public", "anon grant": "grant select on public.product_groups to anon",
      "unexpected grantee": "do $$ begin if not exists (select 1 from pg_roles where rolname = 'wp10_other') then create role wp10_other nologin; end if; end $$; grant select on public.sub_categories to wp10_other" };
    for (const [label, ddl] of Object.entries(drifts)) for (const mk of [baseline, hardenedVia02]) { const db = mk(); cluster.sql(db, ddl); expectRefused(sql, db, `${mk === baseline ? "baseline" : "hardened"}: ${label}`, f); }
    return f; } },
  { id: "D1 Stage B already applied (authenticated INSERT/UPDATE/DELETE revoked; all tables or just one) -> refused on baseline and hardened", core: true, fn(sql) {
    const f = [];
    for (const mk of [baseline, hardenedVia02]) {
      let db = mk(); cluster.sql(db, allFourRevoke); expectRefused(sql, db, "Stage B all four", f);
      db = mk(); cluster.sql(db, "revoke delete on public.product_groups from authenticated"); expectRefused(sql, db, "partial Stage B (one privilege, one table)", f);
      db = mk(); cluster.sql(db, "revoke select on public.categories from authenticated"); expectRefused(sql, db, "SELECT revoked", f);
    }
    return f; } },
  { id: "E1 rollback and recovery: 99 rollback restores the exact original policy set; migration re-hardens; rollback refused after Stage B", core: false, fn(sql) {
    const f = []; const orig = baseline(); const origSnap = policySnapshot(cluster, orig);
    const db = baseline(); if (run(db, sql).code !== 0) return ["apply failed"];
    const rb = runFile(cluster, db, "rollback"); if (rb.code !== 0) f.push("99 rollback failed: " + rb.err.slice(0, 160));
    if (policySnapshot(cluster, db) !== origSnap) f.push("rollback did not restore the exact original policies");
    if (parseChecks(runFile(cluster, db, "pre").out).result?.status !== "PASS") f.push("01 preflight not PASS after rollback");
    if (dml(cluster, db, "noAccess", TABLES[0].ins) !== 1) f.push("expected documented reopened exposure after rollback");
    const again = run(db, sql); if (again.code !== 0 || !/STATE A/.test(again.err)) f.push("recovery: migration did not re-harden after rollback"); else if (policySnapshot(cluster, db) !== policySnapshot(cluster, hardenedVia02())) f.push("recovery result differs from reviewed 02");
    const sb = hardenedVia02(); cluster.sql(sb, allFourRevoke); const s = policySnapshot(cluster, sb); const r2 = runFile(cluster, sb, "rollback");
    if (r2.code === 0 || !/Stage B/.test(r2.err)) f.push("rollback must be refused after Stage B"); if (policySnapshot(cluster, sb) !== s) f.push("refused rollback changed policies");
    return f; } },
  { id: "F1 atomicity: a failure part-way through the apply branch rolls ALL four tables back (event trigger injects a CREATE POLICY failure)", core: false, fn(sql) {
    const f = []; const db = baseline(); const s0 = fullSnap(db);
    cluster.sql(db, `create function public.wp10_inject() returns event_trigger language plpgsql as $$ declare r record; begin for r in select * from pg_event_trigger_ddl_commands() loop if r.object_identity like 'sub_groups_authenticated_delete%' then raise exception 'injected failure'; end if; end loop; end $$;
      create event trigger wp10_inject on ddl_command_end when tag in ('CREATE POLICY') execute function public.wp10_inject()`);
    const s1 = fullSnap(db); const r = run(db, sql);
    if (r.code === 0) f.push("injected failure did not stop the migration"); if (!/injected failure/.test(r.err)) f.push("failure not from the injection point (apply branch not reached?)");
    if (fullSnap(db) !== s1) f.push("partial change survived the failed transaction"); void s0;
    return f; } },
];

for (const sc of SCENARIOS) test(`R ${sc.id}`, { skip }, () => assert.deepEqual(sc.fn(migText()), []));

// ---- mutation testing: each mutant of the real migration must be caught by the core scenarios ----
const MUTANTS = {
  "M1 drop View from the write predicate": [`'((select public.app_has_permission(%L, ''view'')) and (select public.app_has_permission(%L, ''edit'')))', p_key, p_key`, `'((select public.app_has_permission(%L, ''edit'')))', p_key`],
  "M2 accept mixed states": [`if v_state = 'C' then v_problems := v_problems ||`, `if false then v_problems := v_problems ||`],
  "M3 re-apply when already hardened (no no-op)": [`if v_state = 'B' then`, `if false then`],
  "M4 ignore Stage B (authenticated grants)": [`if v_n <> 4 then v_problems := v_problems || (v_t || ': authenticated does not hold`, `if false then v_problems := v_problems || (v_t || ': authenticated does not hold`],
  "M5 wrong module key for sub_groups": [`'module:manage-product-groups','module:manage-subgroups']`, `'module:manage-product-groups','module:manage-categories']`],
  "M6 ignore RPC permission target": [`if v_row.prosrc !~*`, `if false and v_row.prosrc !~*`],
  "M7 ignore extra policies": [`  if v_n <> 4 then return 'OTHER'; end if;\n`, ``],
  "M8 ignore unexpected grantees": [`elsif v_row.grantee not in`, `elsif false and v_row.grantee not in`],
};
for (const [name, [from, to]] of Object.entries(MUTANTS)) {
  test(`MUT ${name}: mutant is detected by the core scenarios`, { skip }, () => {
    const src = migText(); assert.equal(src.split(from).length, 2, "mutation anchor must occur exactly once"); const mutant = src.replace(from, to);
    const failures = SCENARIOS.filter((s) => s.core).flatMap((s) => s.fn(mutant)); assert.ok(failures.length > 0, name + " SURVIVED (not detected)");
  });
}
