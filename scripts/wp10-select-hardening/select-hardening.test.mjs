// WP10 classification SELECT hardening - offline verification on a DISPOSABLE PostgreSQL cluster (never Supabase) plus static guards.
// Evidence class: fixture/stand-in only. It proves the proposed SQL behaves as designed on a Stage-A-shaped schema with representative readers;
// it is NOT live evidence, real JWT/PostgREST behaviour, or proof that the installed Electron fleet is upgraded.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  startCluster, pgAvailable, newFixture, as, count, dml, asAnon, parseChecks, runFile, sqlFile, FILES, TABLES, READERS,
  policySnapshot, grantSnapshot, rowsHash, root
} from './fixture.mjs';
import { scanClientReaders } from './scan-readers.mjs';

const hasPg = pgAvailable();
const skip = hasPg ? false : 'PostgreSQL unavailable (the CI workflow refuses a skipped PASS)';

// ---------- static guards (always run) ----------
test('client direct-reader matrix is pinned: a new direct reader of the four tables must be reviewed here first', () => {
  const pinned = JSON.parse(fs.readFileSync(path.join(root, 'docs/master-data-costing/WP10_CLASSIFICATION_SELECT_HARDENING_UNAPPLIED_SQL/client_direct_readers.pinned.json'), 'utf8'));
  assert.deepEqual(scanClientReaders(root), pinned, 'direct classification readers changed: update the reader matrix and client_direct_readers.pinned.json after review');
});

test('apply script touches only policies and the helper: no table grants, no DML, no write-policy change, no migration/permission DML', () => {
  const sql = sqlFile(FILES.apply).replace(/--.*$/gm, '');
  assert.doesNotMatch(sql, /\b(?:insert|update|delete|truncate)\b\s+(?:into|from|public|only)/i);
  assert.doesNotMatch(sql, /grant\s+(?:select|insert|update|delete|all)[^;]*\bon\s+(?:table\s+)?public\.(?:categories|sub_categories|product_groups|sub_groups)/i);
  assert.doesNotMatch(sql, /revoke\s+[^;]*\bon\s+(?:table\s+)?public\.(?:categories|sub_categories|product_groups|sub_groups)/i);
  assert.doesNotMatch(sql, /_authenticated_(?:insert|update|delete)/);
  assert.doesNotMatch(sql, /app_modules|schema_migrations/i);
  assert.doesNotMatch(sql, /(?:insert\s+into|update|delete\s+from)\s+public\.user_permissions/i, 'permission rows are read, never written');
  assert.match(sql, /app_is_provisioned_user/);
});
test('read-only scripts are wrapped in read only transactions that end in rollback', () => {
  for (const f of ['pre', 'post', 'coverage', 'deps']) {
    const sql = sqlFile(FILES[f]);
    assert.match(sql, /begin read only;/); assert.match(sql, /rollback;\s*$/);
    assert.doesNotMatch(sql.replace(/--.*$/gm, '').replace(/'[^']*'/g, "''"), /\b(?:insert|update|delete|create|drop|alter|grant|revoke)\b\s/i);
  }
});
test('coverage script returns counts only (no emails, ids or names)', () => {
  const sql = sqlFile(FILES.coverage).replace(/--.*$/gm, '');
  assert.doesNotMatch(sql, /\b(?:email|raw_user_meta_data|phone)\b/i);
  assert.doesNotMatch(sql, /select\s+(?:u\.)?id\b/i);
});

// ---------- disposable PostgreSQL scenarios ----------
let cluster;
test.before(() => { if (hasPg) cluster = startCluster(); });
test.after(() => { cluster?.stop(); });

const noAccessActors = ['noAccess', 'denyAll'];
const apply = (db) => { const r = runFile(cluster, db, 'apply'); assert.equal(r.code, 0, r.err); return r; };

test('baseline (Stage A): identity-only read lets identities with NO grants read every classification table (the hole)', { skip }, () => {
  const db = newFixture(cluster);
  for (const a of noAccessActors) for (const t of TABLES) assert.equal(count(cluster, db, a, `public.${t}`), 3, `${a} reads ${t} today`);
  assert.equal(count(cluster, db, 'viewer', 'public.categories'), 3);
});

test('preflight passes on the Stage A shape, postflight fails before apply and passes after; preflight then flags the changed read policy', { skip }, () => {
  const db = newFixture(cluster);
  const pre = parseChecks(runFile(cluster, db, 'pre').out); assert.deepEqual(pre.fails, []); assert.equal(pre.result.status, 'PASS');
  assert.equal(parseChecks(runFile(cluster, db, 'post').out).result.status, 'FAIL');
  apply(db);
  const post = parseChecks(runFile(cluster, db, 'post').out); assert.deepEqual(post.fails, []); assert.equal(post.result.status, 'PASS');
  assert.equal(parseChecks(runFile(cluster, db, 'pre').out).result.status, 'FAIL', 'preflight must not pass on an already-gated state');
});

test('after apply: no-grant identities read nothing; every representative provisioned reader still reads the taxonomy directly', { skip }, () => {
  const db = newFixture(cluster); apply(db);
  for (const a of noAccessActors) for (const t of TABLES) assert.equal(count(cluster, db, a, `public.${t}`), 0, `${a} must see no ${t}`);
  for (const a of ['editorAll', 'viewer', 'editNoView', ...READERS]) for (const t of TABLES) assert.equal(count(cluster, db, a, `public.${t}`), 3, `${a} must still read ${t}`);
});

test('after apply: shared invoker views keep working for every module-reader and return nothing for no-grant identities', { skip }, () => {
  const db = newFixture(cluster); apply(db);
  const views = ['v_product_details', 'v_stock_checker', 'bottled_stock_on_hand', 'v_costing_scheme_policy_scope_options'];
  for (const a of ['editorAll', 'viewer', ...READERS]) for (const v of views) assert.ok(count(cluster, db, a, `public.${v}`) >= 2, `${a} reads ${v}`);
  for (const a of noAccessActors) for (const v of views) assert.equal(count(cluster, db, a, `public.${v}`), 0, `${a} gets no rows from ${v}`);
  assert.equal(as(cluster, db, 'stockOnly', 'select public.fn_product_group_id_for_product(1)').out, '1', 'invoker helper function keeps working');
});

test('after apply: definer objects are unaffected by the read gate (they keep their own predicates)', { skip }, () => {
  const db = newFixture(cluster); apply(db);
  assert.equal(count(cluster, db, 'noAccess', 'public.v_definer_no_predicate'), 3, 'a definer view WITHOUT its own predicate still exposes rows: the read gate does not protect it');
  assert.equal(count(cluster, db, 'noAccess', 'public.v_definer_with_predicate'), 0);
  assert.equal(count(cluster, db, 'costingOnly', 'public.v_definer_with_predicate'), 3);
  assert.equal(as(cluster, db, 'routeOnly', 'select count(*) from public.rpc_get_production_route_master_options()').out, '3');
  assert.equal(as(cluster, db, 'noAccess', 'select count(*) from public.rpc_get_production_route_master_options()').ok, false, 'route RPC keeps its own module check');
});

test('write protection is byte-for-byte unchanged by the read gate (Editor / View-only / No-access / edit-without-view / other-module reader)', { skip }, () => {
  const run = (db) => {
    const out = {};
    const stmts = {
      upd: t => `update public.${t} set ${{ categories: 'category_name', sub_categories: 'subcategory_name', product_groups: 'group_name', sub_groups: 'sub_group_name' }[t]} = ${{ categories: 'category_name', sub_categories: 'subcategory_name', product_groups: 'group_name', sub_groups: 'sub_group_name' }[t]} where id = 1`,
      del: t => `delete from public.${t} where id = 999`,
      ins: t => ({ categories: "insert into public.categories(category_name) values ('X')", sub_categories: "insert into public.sub_categories(subcategory_name, category_id) values ('X', 1)", product_groups: "insert into public.product_groups(group_name, sub_category_id) values ('X', 1)", sub_groups: "insert into public.sub_groups(sub_group_name, product_group_id) values ('X', 1)" }[t])
    };
    for (const a of ['editorAll', 'viewer', 'noAccess', 'denyAll', 'editNoView', 'stockOnly', 'routeOnly']) for (const t of TABLES) for (const k of ['upd', 'del', 'ins']) out[`${a}/${t}/${k}`] = dml(cluster, db, a, stmts[k](t));
    return out;
  };
  const before = run(newFixture(cluster));
  const dbB = newFixture(cluster); apply(dbB);
  const after = run(dbB);
  assert.deepEqual(after, before);
  assert.equal(after['editorAll/categories/upd'], 1, 'legacy Editors can still direct-write (Stage B not applied)');
  assert.equal(after['viewer/categories/upd'], 0); assert.equal(after['viewer/categories/ins'], 'DENIED');
  assert.equal(after['noAccess/categories/ins'], 'DENIED'); assert.equal(after['editNoView/categories/ins'], 'DENIED'); assert.equal(after['stockOnly/categories/ins'], 'DENIED');
});

test('governed RPCs behave the same after apply (Editor allowed, View-only and No-access denied)', { skip }, () => {
  const db = newFixture(cluster); apply(db);
  assert.equal(as(cluster, db, 'editorAll', "select public.rpc_wp10_create_category('RPC-NEW')").ok, true);
  assert.equal(as(cluster, db, 'viewer', "select public.rpc_wp10_create_category('RPC-V')").ok, false);
  assert.equal(as(cluster, db, 'noAccess', "select public.rpc_wp10_rename_category(1, 'RPC-N')").ok, false);
  assert.equal(count(cluster, db, 'editorAll', 'public.categories'), 4);
});

test('anon cannot read the tables or execute the helper; authenticated can execute the helper', { skip }, () => {
  const db = newFixture(cluster); apply(db);
  assert.equal(asAnon(cluster, db, 'select count(*) from public.categories').ok, false);
  assert.equal(asAnon(cluster, db, 'select public.app_is_provisioned_user()').ok, false);
  assert.equal(as(cluster, db, 'noAccess', 'select public.app_is_provisioned_user()').out, 'f');
  assert.equal(as(cluster, db, 'stockOnly', 'select public.app_is_provisioned_user()').out, 't');
  assert.equal(as(cluster, db, 'denyAll', 'select public.app_is_provisioned_user()').out, 'f', 'explicit false/false rows do not count as provisioned');
});

test('apply is idempotent and state-aware; rollback restores the exact Stage A policy/grant/data state', { skip }, () => {
  const db = newFixture(cluster);
  const policies0 = policySnapshot(cluster, db), grants0 = grantSnapshot(cluster, db), rows0 = rowsHash(cluster, db);
  apply(db);
  const policies1 = policySnapshot(cluster, db); assert.notEqual(policies1, policies0);
  apply(db); assert.equal(policySnapshot(cluster, db), policies1, 'second apply is a no-op');
  assert.equal(grantSnapshot(cluster, db), grants0, 'no table grant changed');
  assert.equal(rowsHash(cluster, db), rows0, 'no data changed');
  const rb = runFile(cluster, db, 'rollback'); assert.equal(rb.code, 0, rb.err);
  assert.equal(policySnapshot(cluster, db), policies0, 'rollback restores the identical policy set');
  assert.equal(grantSnapshot(cluster, db), grants0); assert.equal(rowsHash(cluster, db), rows0);
  assert.equal(cluster.sql(db, "select to_regprocedure('public.app_is_provisioned_user()') is null"), 't');
  for (const t of TABLES) assert.equal(count(cluster, db, 'noAccess', `public.${t}`), 3, 'reads restored to the pre-change behaviour');
  const again = runFile(cluster, db, 'rollback', { stopOnError: true }); assert.notEqual(again.code, 0, 'rollback refuses when the gate is not applied');
});

test('apply refuses (and changes nothing) on mixed or unexpected states', { skip }, () => {
  const mixed = newFixture(cluster);
  cluster.sql(mixed, "drop policy categories_authenticated_read on public.categories; create policy categories_authenticated_read on public.categories for select to authenticated using (true)");
  const snap = policySnapshot(cluster, mixed);
  const r = runFile(cluster, mixed, 'apply'); assert.notEqual(r.code, 0); assert.match(r.err, /refused/);
  assert.equal(policySnapshot(cluster, mixed), snap); assert.equal(cluster.sql(mixed, "select to_regprocedure('public.app_is_provisioned_user()') is null"), 't', 'helper creation rolled back too');

  const partial = newFixture(cluster);
  cluster.sql(partial, "drop policy sub_groups_authenticated_insert on public.sub_groups");
  const r2 = runFile(cluster, partial, 'apply'); assert.notEqual(r2.code, 0); assert.match(r2.err, /refused/);

  const half = newFixture(cluster); apply(half);
  cluster.sql(half, "drop policy product_groups_authenticated_read on public.product_groups; create policy product_groups_authenticated_read on public.product_groups for select to authenticated using ((select auth.uid()) is not null)");
  const r3 = runFile(cluster, half, 'apply'); assert.notEqual(r3.code, 0); assert.match(r3.err, /mixed state/);
});

test('coverage query runs and reports counts only', { skip }, () => {
  const db = newFixture(cluster);
  const out = Object.fromEntries(cluster.script(db, sqlFile(FILES.coverage)).out.trim().split('\n').filter(l => l.includes('|')).map(l => l.split('|')));
  assert.equal(Number(out.auth_identities_total), 11);
  assert.equal(Number(out.provisioned_identities), 9, 'editorAll, viewer, editNoView and six readers hold a true grant');
  assert.equal(Number(out.would_lose_reads_total), 2, 'noAccess and denyAll');
});

test('live dependency catalog query lists dependent views (with security_invoker) and reader functions (definer vs invoker)', { skip }, () => {
  const db = newFixture(cluster);
  const r = cluster.script(db, sqlFile(FILES.deps)); assert.equal(r.code, 0, r.err);
  const rows = r.out.trim().split(/\r?\n/).filter(Boolean).map(l => l.split('|'));
  const mode = name => rows.find(x => x[1] === name)?.[2];
  assert.equal(mode('public.v_product_details'), 'security_invoker=true');
  assert.equal(mode('public.v_stock_checker'), 'security_invoker=true');
  assert.equal(mode('public.v_definer_no_predicate'), 'security_invoker=false');
  assert.equal(mode('public.rpc_get_production_route_master_options()'), 'SECURITY DEFINER');
  assert.equal(mode('public.fn_product_group_id_for_product(p_id integer)'), 'INVOKER');
});
