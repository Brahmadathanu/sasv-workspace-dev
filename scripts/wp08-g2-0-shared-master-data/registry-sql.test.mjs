// WP08 G2-0 registry SQL tests against an ISOLATED throw-away PostgreSQL (unix socket, temp dir). No Supabase, no network.
// Scenarios: initially absent, existing identical, conflicting, partial, repeat execution, rollback provenance, gate token.
//   node --test scripts/wp08-g2-0-shared-master-data/registry-sql.test.mjs      (skips with a reason if PostgreSQL is not installed)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pgAvailable, startCluster } from "./pg-harness.mjs";
import { repoRoot, localManifest, tokenOf } from "./deploy-gate.mjs";

const DIR = path.join(repoRoot, "docs/master-data-costing/WP08_G2_0_REGISTRY_PROPOSAL_UNAPPLIED");
const sqlFile = (f) => fs.readFileSync(path.join(DIR, f), "utf8");
const A = sqlFile("02_apply_pwa_client_rows.sql");
const B = sqlFile("03_optional_repoint_electron_routes.sql");
const PRE = sqlFile("01_preflight_and_before_select.sql");
const RB_B = sqlFile("98_rollback_step_b_electron.sql");
const RB_A = sqlFile("99_rollback_step_a_pwa.sql");
const TOKEN = tokenOf(localManifest());

const KEYS = ["manage-products", "manage-rm-bom", "manage-sp-bom", "pm-templates"];
const LEGACY = { "manage-products": "manage-products.html", "manage-rm-bom": "manage-rm-bom.html", "manage-sp-bom": "manage-sp-bom.html", "pm-templates": "manage-pm-bom.html" };
const NEW = Object.fromEntries(KEYS.map((k) => [k, `public/shared/${path.basename(LEGACY[k])}`]));

const withToken = (sql) => sql.replace("<<PASTE_GATE_TOKEN_FROM_deploy-gate.mjs_verify>>", TOKEN);
const withTs = (sql, placeholder, ts) => sql.replace(placeholder, ts);

let pg;
const skip = !pgAvailable();
test.before(() => { if (!skip) pg = startCluster(); });
test.after(() => { pg?.stop(); });

function freshDb(extra = "") {
  const db = pg.newDb();
  pg.sql(db, `
    create table public.app_modules (module_key text primary key, target_key text not null, label text, section_key text, sort_order int, min_nav_mode text);
    create table public.app_module_clients (module_key text not null references public.app_modules(module_key), client_key text not null,
      route_path text, nav_enabled boolean not null default true, launch_mode text, updated_at timestamptz not null default now(), primary key (module_key, client_key));
    create view public.v_app_module_registry as select m.module_key, m.target_key, m.label, m.section_key, m.sort_order, m.min_nav_mode, c.client_key, c.route_path, c.nav_enabled from public.app_modules m join public.app_module_clients c using (module_key);
    insert into public.app_modules values
      ('manage-products','module:manage-products','Products','product-reference-master',10,'view'),
      ('manage-rm-bom','module:manage-rm-bom','Manage RM BOM','inventory-sales',40,'view'),
      ('manage-sp-bom','module:manage-sp-bom','Manage SP BOM','inventory-sales',50,'view'),
      ('pm-templates','module:pm-templates','PM Templates','inventory-sales',60,'view');
    insert into public.app_module_clients(module_key, client_key, route_path, nav_enabled, launch_mode, updated_at) values
      ('manage-products','electron','manage-products.html',true,'direct','2026-01-01 00:00:00+00'),
      ('manage-rm-bom','electron','manage-rm-bom.html',true,'direct','2026-01-01 00:00:00+00'),
      ('manage-sp-bom','electron','manage-sp-bom.html',true,'direct','2026-01-01 00:00:00+00'),
      ('pm-templates','electron','manage-pm-bom.html',true,'direct','2026-01-01 00:00:00+00');
    ${extra}`);
  return db;
}
const snap = (db) => pg.sql(db, "select module_key||'|'||client_key||'|'||coalesce(route_path,'')||'|'||nav_enabled||'|'||coalesce(launch_mode,'')||'|'||updated_at from public.app_module_clients order by 1");
const modsSnap = (db) => pg.sql(db, "select md5(string_agg(t::text, ',' order by module_key)) from public.app_modules t");
const pwaRows = (db) => pg.sql(db, "select module_key||'|'||route_path from public.app_module_clients where client_key='pwa' order by 1");
const receipt = (out, name) => new RegExp(`${name}\\|(?:[^|]*\\|)?([0-9-]+ [0-9:.]+\\+00)`).exec(out)?.[1];

const insertPwa = (rows) => rows.map(([k, route, enabled = true]) => `insert into public.app_module_clients(module_key,client_key,route_path,nav_enabled,launch_mode,updated_at) values ('${k}','pwa','${route}',${enabled},'direct','2026-02-02 00:00:00+00');`).join("\n");

const apply = (db, opts) => pg.script(db, withToken(A), opts);

test("PG available (otherwise every SQL scenario is skipped with this reason)", (t) => { if (skip) t.skip("PostgreSQL server binaries not installed in this environment"); });

test("A: initially absent -> creates exactly the four PWA rows, copies launch_mode, leaves app_modules and Electron rows untouched, prints a receipt", { skip }, () => {
  const db = freshDb();
  const mods = modsSnap(db), before = snap(db).split("\n").filter((l) => /\|electron\|/.test(l));
  const r = apply(db);
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(pwaRows(db).split("\n"), KEYS.map((k) => `${k}|${NEW[k]}`).sort());
  assert.equal(pg.sql(db, "select count(*) from public.app_module_clients where client_key='pwa' and launch_mode='direct' and nav_enabled"), "4");
  assert.equal(modsSnap(db), mods, "app_modules untouched");
  assert.deepEqual(snap(db).split("\n").filter((l) => /\|electron\|/.test(l)), before, "Electron rows untouched");
  assert.ok(receipt(r.out, "APPLY_RECEIPT"), "apply receipt printed");
});

test("A: gate token missing/placeholder or wrong -> refused, nothing written", { skip }, () => {
  for (const sql of [A, A.replace("<<PASTE_GATE_TOKEN_FROM_deploy-gate.mjs_verify>>", "g2-0-" + "0".repeat(32))]) {
    const db = freshDb();
    const before = snap(db);
    const r = pg.script(db, sql);
    assert.notEqual(r.code, 0);
    assert.match(r.err, /deployment gate token/);
    assert.equal(snap(db), before);
  }
});

test("A: existing IDENTICAL row(s) -> fail closed, no row modified or added (incl. repeat execution)", { skip }, () => {
  const db = freshDb();
  assert.equal(apply(db).code, 0);
  const after1 = snap(db);
  const r = apply(db); // repeat
  assert.notEqual(r.code, 0);
  assert.match(r.err, /fail closed.*4 PWA registration\(s\) already exist/s);
  assert.equal(snap(db), after1, "repeat run changed nothing (updated_at included)");
});

test("A: CONFLICTING existing row (other route / disabled) -> fail closed, never overwritten", { skip }, () => {
  for (const row of [["manage-rm-bom", "public/shared/somewhere-else.html"], ["pm-templates", NEW["pm-templates"], false], ["manage-products", "manage-products.html"]]) {
    const db = freshDb(insertPwa([row]));
    const before = snap(db);
    const r = apply(db);
    assert.notEqual(r.code, 0, JSON.stringify(row));
    assert.match(r.err, /1 PWA registration\(s\) already exist/);
    assert.equal(snap(db), before, "conflicting row preserved byte-for-byte");
  }
});

test("A: PARTIAL states (1, 2 or 3 of 4 present) -> fail closed and the missing rows are NOT created", { skip }, () => {
  for (const n of [1, 2, 3]) {
    const db = freshDb(insertPwa(KEYS.slice(0, n).map((k) => [k, NEW[k]])));
    const before = snap(db);
    const r = apply(db);
    assert.notEqual(r.code, 0, `n=${n}`);
    assert.equal(snap(db), before, `n=${n}: atomic, no partial creation`);
    assert.equal(pwaRows(db).split("\n").length, n);
  }
});

test("A: missing/changed prerequisites -> refused with zero writes (atomic)", { skip }, () => {
  // missing Electron row for one module (insert would create only 3)
  let db = freshDb("delete from public.app_module_clients where module_key='manage-sp-bom' and client_key='electron';");
  let before = snap(db);
  let r = apply(db);
  assert.notEqual(r.code, 0);
  assert.match(r.err, /would create 3/);
  assert.equal(snap(db), before);
  // wrong permission target for PM BOM (must stay module:pm-templates)
  db = freshDb("update public.app_modules set target_key='module:manage-pm-bom' where module_key='pm-templates';");
  before = snap(db);
  r = apply(db);
  assert.notEqual(r.code, 0);
  assert.match(r.err, /module\/target pair/);
  assert.equal(snap(db), before);
});

test("A: without ON_ERROR_STOP the failure still writes nothing (COMMIT after an error is a rollback)", { skip }, () => {
  const db = freshDb(insertPwa([["manage-products", NEW["manage-products"]]]));
  const before = snap(db);
  const r = apply(db, { stopOnError: false });
  assert.equal(snap(db), before);
  assert.match(r.err, /fail closed/);
});

test("A: concurrent identical registration inserted after the check is still rejected by the primary key (no overwrite)", { skip }, () => {
  // The script has no ON CONFLICT; assert that statically as well as by behaviour above.
  assert.doesNotMatch(A, /on conflict/i);
  assert.doesNotMatch(A + B + RB_A + RB_B, /do update/i);
});

test("Rollback A: after a successful apply -> deletes exactly the four created rows; repeat is a no-op", { skip }, () => {
  const db = freshDb();
  const ts = receipt(apply(db).out, "APPLY_RECEIPT");
  const electron = snap(db).split("\n").filter((l) => /\|electron\|/.test(l));
  const rb = withTs(RB_A, "<<PASTE_APPLY_TS_FROM_STEP_A_RECEIPT>>", ts);
  let r = pg.script(db, rb);
  assert.equal(r.code, 0, r.err);
  assert.match(r.err, /deleted 4 row/);
  assert.equal(pwaRows(db), "");
  assert.deepEqual(snap(db).split("\n"), electron, "Electron rows untouched");
  r = pg.script(db, rb);
  assert.equal(r.code, 0);
  assert.match(r.err, /deleted 0 row/);
});

test("Rollback A: NEVER deletes a pre-existing registration (identical to ours, with any timestamp supplied)", { skip }, () => {
  const db = freshDb(insertPwa(KEYS.map((k) => [k, NEW[k]])));  // pre-existing, identical to what A would create
  const before = snap(db);
  // Only the exact stamp written by step A can match; a pre-existing row carries some other updated_at.
  for (const ts of ["2026-11-14 00:00:00+00", "2000-01-01 00:00:00+00", "2026-02-02 00:00:00.000001+00"]) {
    const r = pg.script(db, withTs(RB_A, "<<PASTE_APPLY_TS_FROM_STEP_A_RECEIPT>>", ts));
    assert.equal(r.code, 0);
    assert.match(r.err, /deleted 0 row/);
    assert.equal(snap(db), before);
  }
});

test("Rollback A: apply refused (pre-existing rows) then rollback with a guessed timestamp deletes nothing", { skip }, () => {
  const db = freshDb(insertPwa([["manage-rm-bom", NEW["manage-rm-bom"]]]));
  assert.notEqual(apply(db).code, 0);
  const before = snap(db);
  const r = pg.script(db, withTs(RB_A, "<<PASTE_APPLY_TS_FROM_STEP_A_RECEIPT>>", "2026-11-14 12:00:00+00"));
  assert.equal(r.code, 0);
  assert.equal(snap(db), before);
});

test("Rollback A: unreplaced placeholder fails closed; a row edited after apply is left alone", { skip }, () => {
  const db = freshDb();
  const ts = receipt(apply(db).out, "APPLY_RECEIPT");
  const before = snap(db);
  const bad = pg.script(db, RB_A);
  assert.notEqual(bad.code, 0);
  assert.equal(snap(db), before, "placeholder rollback deleted nothing");
  pg.sql(db, "update public.app_module_clients set updated_at = updated_at + interval '1 second' where module_key='manage-sp-bom' and client_key='pwa'");
  const r = pg.script(db, withTs(RB_A, "<<PASTE_APPLY_TS_FROM_STEP_A_RECEIPT>>", ts));
  assert.equal(r.code, 0);
  assert.match(r.err, /deleted 3 row/);
  assert.equal(pwaRows(db), `manage-sp-bom|${NEW["manage-sp-bom"]}`, "the edited row survives");
});

test("B: all legacy -> repoints all four atomically; repeat is a no-op; electron-only scope", { skip }, () => {
  const db = freshDb();
  const mods = modsSnap(db);
  let r = pg.script(db, B);
  assert.equal(r.code, 0, r.err);
  assert.equal(pg.sql(db, "select count(*) from public.app_module_clients where client_key='electron' and route_path like 'public/shared/%'"), "4");
  assert.equal(modsSnap(db), mods);
  const after = snap(db);
  r = pg.script(db, B);
  assert.equal(r.code, 0);
  assert.match(r.err, /already canonical; nothing changed/);
  assert.equal(snap(db), after, "repeat changed nothing (updated_at included)");
});

test("B: partial / mixed / unexpected Electron routes -> fail closed, nothing written", { skip }, () => {
  for (const extra of [
    "update public.app_module_clients set route_path='public/shared/manage-products.html' where module_key='manage-products' and client_key='electron';",
    "update public.app_module_clients set route_path='custom.html' where module_key='pm-templates' and client_key='electron';",
    "delete from public.app_module_clients where module_key='manage-rm-bom' and client_key='electron';",
  ]) {
    const db = freshDb(extra);
    const before = snap(db);
    const r = pg.script(db, B);
    assert.notEqual(r.code, 0, extra);
    assert.equal(snap(db), before);
  }
});

test("Rollback B: reverts only rows stamped by step B; never reverts routes that were already canonical", { skip }, () => {
  let db = freshDb();
  const ts = receipt(pg.script(db, B).out, "REPOINT_RECEIPT");
  const r = pg.script(db, withTs(RB_B, "<<PASTE_REPOINT_TS_FROM_STEP_B_RECEIPT>>", ts));
  assert.equal(r.code, 0, r.err);
  assert.match(r.err, /reverted 4 row/);
  assert.equal(pg.sql(db, "select count(*) from public.app_module_clients where client_key='electron' and route_path like '%.html' and route_path not like 'public/%'"), "4");
  // pre-existing canonical (B was a no-op): rollback with any stamp changes nothing
  db = freshDb(`update public.app_module_clients set route_path='public/shared/'||route_path where client_key='electron';`);
  assert.equal(pg.script(db, B).code, 0);
  const before = snap(db);
  const r2 = pg.script(db, withTs(RB_B, "<<PASTE_REPOINT_TS_FROM_STEP_B_RECEIPT>>", "2026-11-14 12:00:00+00"));
  assert.equal(r2.code, 0);
  assert.equal(snap(db), before);
  // placeholder fails closed
  assert.notEqual(pg.script(db, RB_B).code, 0);
});

test("Preflight is read-only and reports the exact states the apply scripts enforce", { skip }, () => {
  const db = freshDb(insertPwa([["manage-rm-bom", NEW["manage-rm-bom"]], ["pm-templates", "x.html"]]));
  const before = snap(db);
  const r = pg.script(db, PRE);
  assert.equal(r.code, 0, r.err);
  assert.equal(snap(db), before, "preflight wrote nothing");
  assert.match(r.out, /manage-products\|ABSENT\|\|LEGACY/);
  assert.match(r.out, /manage-rm-bom\|IDENTICAL/);
  assert.match(r.out, /pm-templates\|CONFLICT\|x\.html\|LEGACY/);
  // contract violation surfaces in preflight exactly as in apply
  const bad = freshDb("update public.app_modules set target_key='module:manage-pm-bom' where module_key='pm-templates';");
  assert.notEqual(pg.script(bad, PRE).code, 0);
});

test("Static: gate token embedded in step A equals the token of the reviewed bytes; no DDL/permission writes in any script", () => {
  assert.ok(A.includes(`v_expected constant text := '${TOKEN}';`), `step A token is stale: run node scripts/wp08-g2-0-shared-master-data/deploy-gate.mjs stamp (expected ${TOKEN})`);
  const code = (s) => s.replace(/\r\n/g, "\n").split("\n").map((l) => l.replace(/--.*$/, "")).join("\n");
  for (const raw of [A, B, RB_A, RB_B]) {
    const sql = code(raw);
    assert.match(raw, /^\s*(?:--[^\n]*\n|\s)*begin;/i);
    assert.match(sql, /commit;\s*$/i);
    assert.match(sql, /lock table public\.app_module_clients/);
    assert.match(sql, /pg_advisory_xact_lock/);
    assert.match(sql, /lock_timeout/);
    assert.doesNotMatch(sql, /\b(grant|revoke|alter\s+(?:table|policy)|create\s+(?:policy|function|table|trigger)|drop\s|truncate)\b/i);
    assert.doesNotMatch(sql, /(?:insert\s+into|update|delete\s+from)\s+(?:public\.)?(?:app_modules|user_permissions\w*|role_permissions\w*|app_nav_sections|permissions\w*)\b/i);
  }
  assert.doesNotMatch(A + B + RB_A + RB_B + PRE, /manage-pm-bom'/, "no manage-pm-bom registry/permission key");
  assert.match(A + B + RB_A + RB_B + PRE, /UNAPPLIED/);
});
