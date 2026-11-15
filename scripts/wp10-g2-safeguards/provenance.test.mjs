// WP10 G2 R5 — provenance, preflight and rollback safety of the UNAPPLIED proposals, in an isolated PostgreSQL fixture.
// Every scenario applies the proposal files EXACTLY as drafted (psql, one file at a time, like an operator) into a fresh database that holds only the
// live-verbatim dependencies. Nothing here touches Supabase. Run: node scripts/wp10-g2-safeguards/provenance.test.mjs [resultsJson]
import fs from "node:fs";
import { pgAvailable, startPg, g2FixtureSql, draft, DRAFTS, PRODUCTS_SEED } from "./fixture.mjs";
import { makeResults } from "../wp10-g1-safeguard-audit/lib.mjs";

const { results, check, classify, failed } = makeResults();
if (!pgAvailable()) { classify("V0", "SKIPPED", "PostgreSQL unavailable — provenance fixtures SKIPPED (not PASS)"); if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ results }, null, 2) + "\n"); process.exit(2); }
const cluster = startPg();
const ORDER = ["clock", "states", "horizon", "reparent", "route"];
const BASE = g2FixtureSql({ load: [] }) + PRODUCTS_SEED;
const fresh = () => { const db = cluster.newDb(); const r = cluster.script(db, BASE); if (r.code) throw new Error("base boot failed: " + r.err); return db; };
const apply = (db, key) => cluster.script(db, draft(DRAFTS[key]));
const applyAll = (db, keys = ORDER) => keys.map((k) => apply(db, k));
const q = (db, text) => cluster.sql(db, text);
const WP10_OBJECTS = "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where p.proname like 'fn_wp10_%' or p.proname = 'rpc_wp10_get_operational_expiry_horizon'";
const WP10_TRIGGERS = "select count(*) from pg_trigger where tgname like 'trg_wp10_%' and not tgisinternal";
const md5Of = (db, sig) => q(db, `select md5(pg_get_functiondef('${sig}'::regprocedure))`);
const ROLLBACK = () => draft(DRAFTS.rollback);
const LIVE_SIGS = ["costing.fn_resolve_sku_mrp_as_of(bigint, date)", "costing.fn_resolve_route_family_for_product(integer, date)", "costing.fn_validate_effective_product_process_route(integer, date)", "costing.fn_validate_route_family_route(bigint)"];

try {
  // V1 clean first application + receipts
  {
    const db = fresh();
    const rs = applyAll(db);
    check("V1.1", "clean first application of 01..05 succeeds file by file (each file is one transaction)", rs.every((r) => r.code === 0), rs.map((r) => r.err.slice(0, 80)).join("|"));
    check("V1.2", "every created function and trigger carries a receipt 'WP10-G2 <file> md5:<md5 of its definition>' that matches the object", q(db, "select count(*) from pg_proc p where (p.proname like 'fn_wp10_%' or p.proname = 'rpc_wp10_get_operational_expiry_horizon') and obj_description(p.oid, 'pg_proc') ~ '^WP10-G2 0[1-5]_' and split_part(obj_description(p.oid, 'pg_proc'), 'md5:', 2) = md5(pg_get_functiondef(p.oid))") === "8" && q(db, "select count(*) from pg_trigger t where t.tgname like 'trg_wp10_%' and obj_description(t.oid, 'pg_trigger') ~ '^WP10-G2 0[1-5]_' and split_part(obj_description(t.oid, 'pg_trigger'), 'md5:', 2) = md5(pg_get_triggerdef(t.oid))") === "3");
  }
  // V2 re-run refuses and changes nothing
  {
    const db = fresh(); applyAll(db);
    const before = q(db, "select string_agg(p.proname || ':' || md5(pg_get_functiondef(p.oid)) || ':' || coalesce(obj_description(p.oid,'pg_proc'),''), ',' order by p.proname) from pg_proc p where p.proname like '%wp10%'");
    const rs = ORDER.map((k) => apply(db, k));
    const after = q(db, "select string_agg(p.proname || ':' || md5(pg_get_functiondef(p.oid)) || ':' || coalesce(obj_description(p.oid,'pg_proc'),''), ',' order by p.proname) from pg_proc p where p.proname like '%wp10%'");
    check("V2.1", "RE-RUN of every file is REFUSED at the preflight ('already exists; refusing to overwrite') with a non-zero exit, and no definition or receipt changed", rs.every((r) => r.code !== 0 && /already exists; refusing to overwrite/.test(r.err)) && before === after, rs.map((r) => r.code).join());
  }
  // V3 collision with a pre-existing function: refused, foreign object untouched
  {
    const db = fresh();
    q(db, "create function costing.fn_wp10_today_ist() returns date language sql as $$ select date '2000-01-01' $$");
    const foreign = md5Of(db, "costing.fn_wp10_today_ist()");
    const r = apply(db, "clock");
    check("V3.1", "a PRE-EXISTING object with a proposal name makes the first application fail closed; the foreign definition is NOT overwritten and no proposal object appears", r.code !== 0 && /already exists; refusing to overwrite or adopt/.test(r.err) && md5Of(db, "costing.fn_wp10_today_ist()") === foreign && q(db, "select count(*) from pg_proc where proname = 'fn_wp10_batch_size_state_as_of'") === "0");
  }
  // V4 pre-existing trigger of the same name
  {
    const db = fresh();
    q(db, "create function public.fx_foreign_trg() returns trigger language plpgsql as $$ begin return new; end $$; create trigger trg_wp10_active_sku_reparent_guard before update on public.product_skus for each row execute function public.fx_foreign_trg();");
    const r = apply(db, "reparent");
    check("V4.1", "a pre-existing TRIGGER with the proposal's name is refused (never replaced)", r.code !== 0 && /trigger trg_wp10_active_sku_reparent_guard on public.product_skus already exists/.test(r.err) && q(db, "select count(*) from pg_proc where proname = 'fn_wp10_guard_active_sku_reparent'") === "0");
  }
  // V5 partial apply / order
  {
    const db = fresh();
    const r1 = apply(db, "clock"); const r3 = apply(db, "horizon");
    check("V5.1", "partial apply: 03 before 02 is refused (prerequisite 02 missing); only 01's objects exist and 01 stays intact", r1.code === 0 && r3.code !== 0 && /prerequisite .* \(proposal 02\) is missing/.test(r3.err) && q(db, WP10_OBJECTS) === "2");
    const r2 = apply(db, "states"); const r3b = apply(db, "horizon");
    check("V5.2", "after 02 is applied, 03 succeeds (order is enforced by provenance, not by convention)", r2.code === 0 && r3b.code === 0);
  }
  // V6 prerequisite modified after apply
  {
    const db = fresh(); apply(db, "clock");
    q(db, "create or replace function costing.fn_wp10_today_ist() returns date language sql stable as $$ select date '2030-01-01' $$");
    const r = apply(db, "states");
    check("V6.1", "a prerequisite that was MODIFIED after its application (receipt md5 no longer matches) blocks the next proposal", r.code !== 0 && /prerequisite costing.fn_wp10_today_ist\(\) \(proposal 01\) is missing, not applied by this procedure, or modified since/.test(r.err));
  }
  // V7 live dependency drift
  {
    const db = fresh(); apply(db, "clock");
    q(db, "alter function costing.fn_resolve_sku_mrp_as_of(bigint, date) volatile"); // any definition change (here: volatility) changes pg_get_functiondef and so its md5
    const r = apply(db, "states");
    check("V7.1", "a live dependency that differs from the reviewed definition (md5 of pg_get_functiondef) blocks 02", r.code !== 0 && /live function costing.fn_resolve_sku_mrp_as_of\(bigint, date\) differs from the reviewed definition/.test(r.err));
    const db2 = fresh(); apply(db2, "clock");
    q(db2, "create or replace function costing.fn_validate_route_family_route(p_family_route_id bigint) returns jsonb language sql stable as $$ select jsonb_build_object('valid', true) $$");
    const r2 = apply(db2, "route");
    check("V7.2", "drift in a route-chain callee blocks 05 (the impact guard is only valid against the reviewed validator chain)", r2.code !== 0 && /live function costing.fn_validate_route_family_route\(bigint\) differs/.test(r2.err));
  }
  // V8 rollback after a clean apply
  {
    const db = fresh(); applyAll(db);
    const liveBefore = LIVE_SIGS.map((s) => md5Of(db, s)).join();
    const r = cluster.script(db, ROLLBACK());
    check("V8.1", "rollback of an intact application removes every proposal function and trigger (and their receipts) and leaves the live dependencies byte-identical", r.code === 0 && q(db, WP10_OBJECTS) === "0" && q(db, WP10_TRIGGERS) === "0" && LIVE_SIGS.map((s) => md5Of(db, s)).join() === liveBefore, r.err.slice(0, 100));
    const again = cluster.script(db, ROLLBACK());
    check("V8.2", "a second rollback is a no-op (objects absent are skipped with NOTICEs, exit 0)", again.code === 0 && /not present, skipped/.test(again.err));
    const re = applyAll(db);
    check("V8.3", "after rollback the proposals can be applied again from a clean state (no residue)", re.every((x) => x.code === 0));
  }
  // V9 modified before rollback: fail closed, nothing dropped
  {
    const db = fresh(); applyAll(db);
    q(db, "create or replace function public.fn_wp10_guard_active_sku_reparent() returns trigger language plpgsql as $$ begin return new; end $$");
    const countBefore = q(db, WP10_OBJECTS);
    const r = cluster.script(db, ROLLBACK());
    check("V9.1", "an object MODIFIED after application makes the rollback REFUSE and drop NOTHING (all other objects and triggers remain)", r.code !== 0 && /rollback refused \(nothing dropped\).*fn_wp10_guard_active_sku_reparent/.test(r.err) && q(db, WP10_OBJECTS) === countBefore && q(db, WP10_TRIGGERS) === "3");
  }
  // V10 unowned object with a proposal name
  {
    const db = fresh(); apply(db, "clock");
    q(db, "create function public.fn_wp10_product_route_impact_before() returns trigger language plpgsql as $$ begin return new; end $$");
    const r = cluster.script(db, ROLLBACK());
    check("V10.1", "an object with a proposal NAME but no receipt (created by someone else) makes the rollback refuse; the applied 01 objects are not dropped", r.code !== 0 && /fn_wp10_product_route_impact_before/.test(r.err) && q(db, "select count(*) from pg_proc where proname = 'fn_wp10_today_ist'") === "1");
  }
  // V11 partial rollback of a partial application
  {
    const db = fresh(); apply(db, "clock"); apply(db, "states");
    const r = cluster.script(db, ROLLBACK());
    check("V11.1", "rollback of a PARTIAL application removes exactly what exists and notes the rest as absent", r.code === 0 && q(db, WP10_OBJECTS) === "0" && /not present, skipped/.test(r.err));
  }
  // V12 rollback never touches a table or live object
  {
    const db = fresh(); applyAll(db);
    const tablesBefore = q(db, "select string_agg(relname, ',' order by relname) from pg_class where relkind = 'r' and relnamespace in ('public'::regnamespace, 'costing'::regnamespace)");
    cluster.script(db, ROLLBACK());
    check("V12.1", "rollback changes no table (no table is created by the proposals and none is dropped)", q(db, "select string_agg(relname, ',' order by relname) from pg_class where relkind = 'r' and relnamespace in ('public'::regnamespace, 'costing'::regnamespace)") === tablesBefore);
  }
  // V13 mutation controls: a weakened preflight / rollback is detected
  {
    const mutated = (file, from, to) => { const t = draft(DRAFTS[file]); if (!t.includes(from)) throw new Error("mutation target missing: " + from); return t.replace(from, to); };
    const db = fresh(); q(db, "create function costing.fn_wp10_today_ist() returns date language sql as $$ select date '2000-01-01' $$");
    const r = cluster.script(db, mutated("clock", "if to_regprocedure(t) is not null then", "if false then").replace(/create function/g, "create or replace function"));
    check("V13.1", "MUTANT 'preflight weakened + create or replace' silently overwrites a foreign object, and V3.1's assertion would catch it", r.code === 0 && md5Of(db, "costing.fn_wp10_today_ist()") !== q(db, "select md5(pg_get_functiondef('costing.fn_wp10_batch_size_state_as_of(bigint, date)'::regprocedure))") && /select \(now\(\)/.test(q(db, "select pg_get_functiondef('costing.fn_wp10_today_ist()'::regprocedure)")));
    const db2 = fresh(); applyAll(db2);
    q(db2, "create or replace function public.fn_wp10_guard_active_sku_reparent() returns trigger language plpgsql as $$ begin return new; end $$");
    const weakened = ROLLBACK().replace("or split_part(c, 'md5:', 2) <> md5(pg_get_functiondef(v))", "");
    const r2 = cluster.script(db2, weakened);
    check("V13.2", "MUTANT 'rollback without the md5 check' drops a MODIFIED object (so V9.1's refusal is meaningful)", r2.code === 0 && q(db2, "select count(*) from pg_proc where proname = 'fn_wp10_guard_active_sku_reparent'") === "0");
  }
} finally { cluster.stop(); }
console.log(failed() ? `\n${failed()} FAILED` : "\nALL PASSED");
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ synthetic: "isolated PostgreSQL fixture; UNAPPLIED proposal text applied file by file", results }, null, 2) + "\n");
process.exit(failed() ? 1 : 0);
