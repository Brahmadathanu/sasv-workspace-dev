// WP10 G1 — Product/SKU transition fixtures in an ISOLATED throw-away PostgreSQL (no network, no Supabase, destroyed afterwards).
// LIVE-VERBATIM guard/RPC text from the committed catalog capture runs against fixture tables; STAND-IN objects model only documented contracts
// (see fixture-sql.mjs PROVENANCE). Results are contract/negative-path evidence for the audited text, NOT live behaviour or role acceptance.
// Run: node scripts/wp10-g1-safeguard-audit/transition-fixture.test.mjs [resultsJson]
import fs from "node:fs";
import { startCluster, pgAvailable } from "../wp08-g2-0-shared-master-data/pg-harness.mjs";
import { fixtureSql, session, PROVENANCE } from "./fixture-sql.mjs";
import { makeResults } from "./lib.mjs";

const { results, check, classify, failed } = makeResults();
if (!pgAvailable()) {
  classify("F0", "SKIPPED", "PostgreSQL binaries unavailable — all transition fixtures SKIPPED (not PASS)");
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ results }, null, 2) + "\n");
  process.exit(2);
}
const cluster = startCluster();
const FIX = fixtureSql();
const EDITOR = session();
const VIEWER = session({ perms: "module:manage-products:view" });
const NOAUTH = session({ uid: "" });

function scenario(body) {
  const db = cluster.newDb();
  const boot = cluster.script(db, FIX + "\ninsert into public.products(item, status) values ('P1','Active'),('P2','Inactive'),('P3','Active'),('P4','Active'),('P5','Active'),('P6','Active'),('P7','Active');\n");
  if (boot.code) throw new Error("fixture boot failed: " + boot.err);
  const run = cluster.script(db, body);
  const q = (sql, pre = "") => cluster.sql(db, pre + sql);
  const log = Object.fromEntries(q("select label || '#' || ok || '#' || coalesce(sqlstate,'') || '#' || coalesce(msg,'') || '#' || coalesce(detail,'') from public.fx_log order by id").split("\n").filter(Boolean).map((l) => { const [label, ok, state, msg, detail] = l.split("#"); return [label, { ok: ok === "true", state, msg, detail }]; }));
  return { db, q, log, run };
}
const one = (s, sql, pre = "") => s.q(sql, pre).split("\n").pop();
const T = (label, stmt) => `select public.fx_try('${label}', $q$${stmt}$q$);\n`;
const ALL_LABELS = ["Approved packing-material BOM", "Batch size reference", "Production route", "MRP policy", "Selling price / GST policy"];

try {
  // ---------- F1 inactive incomplete creation ----------
  {
    const s = scenario(EDITOR + T("create_rpc", "select public.fx_standin_rpc_create_product_sku(1, 50, 'mL', false, false, 'new pack')") + T("create_direct", "insert into public.product_skus(product_id, pack_size, uom, is_active) values (1, 100, 'mL', false)"));
    check("F1.1", "inactive SKU with NONE of the five essentials can be created (RPC stand-in and direct insert)", s.log.create_rpc.ok && s.log.create_direct.ok && one(s, "select count(*) from public.product_skus") === "2");
    check("F1.2", "creation writes the create audit (stand-in contract) AND the verbatim change log row", one(s, "select count(*) from public.product_sku_master_audit where event_type='CREATE'") === "1" && one(s, "select count(*) from public.product_sku_change_log where op='INSERT'") === "2");
    check("F1.3", "creation bumps the product_skus source epoch (invalidation hook fires for a new inactive SKU)", Number(one(s, "select epoch from costing.readiness_portfolio_source_epoch where source_name='public.product_skus'")) >= 1);
    s.q("select 1");
  }
  // ---------- F2 rejected active creation ----------
  {
    const s = scenario(EDITOR + T("insert_active", "insert into public.product_skus(product_id, pack_size, uom, is_active) values (1, 50, 'mL', true)")
      + T("rpc_active", "select public.fx_standin_rpc_create_product_sku(1, 60, 'mL', true, false, 'active create')")
      + T("sample_active", "insert into public.product_skus(product_id, pack_size, uom, is_active, is_sample) values (1, 70, 'mL', true, true)"));
    const l = s.log;
    check("F2.1", "direct INSERT of an active SKU with no essentials is rejected (P0001) naming all five missing items with their owner screens", !l.insert_active.ok && l.insert_active.state === "P0001" && ALL_LABELS.every((x) => l.insert_active.msg.includes(x)) && /PM BOM Manager/.test(l.insert_active.msg) && /Pricing Policy Manager/.test(l.insert_active.msg), l.insert_active.msg.slice(0, 120));
    check("F2.2", "the create RPC with p_is_active=true is rejected identically and leaves no SKU and no audit row", !l.rpc_active.ok && l.rpc_active.state === "P0001" && one(s, "select count(*) from public.product_skus") === "0" && one(s, "select count(*) from public.product_sku_master_audit") === "0");
    check("F2.3", "a SAMPLE SKU gets no bypass: is_sample=true active insert is rejected with the same five items", !l.sample_active.ok && ALL_LABELS.every((x) => l.sample_active.msg.includes(x)));
    check("F2.4", "rejected creation rolls the epoch back too (no hook fired for a statement that failed)", one(s, "select count(*) from costing.readiness_portfolio_source_epoch where source_name='public.product_skus'") === "0");
  }
  // ---------- F3 rejected activation, each essential individually, no override ----------
  {
    let body = EDITOR;
    const skips = ["PM_BOM", "BATCH", "ROUTE", "MRP", "SELLING"];
    // product p+2 for each skip so product-level essentials are independent; SKU ids 1..5
    skips.forEach((k, i) => { body += `insert into public.product_skus(product_id, pack_size, uom) values (${i + 3}, 10, 'g');\nselect public.fx_complete(${i + 1}, ${i + 3}, '${k}');\n`; });
    skips.forEach((k, i) => { body += T(`act_${k}`, `select * from public.rpc_set_product_sku_active(${i + 1}, true, 'activate', 'APPROVAL-1')`); });
    const s = scenario(body);
    const expect = { PM_BOM: "Approved packing-material BOM", BATCH: "Batch size reference", ROUTE: "Production route", MRP: "MRP policy", SELLING: "Selling price / GST policy" };
    for (const k of skips) {
      const r = s.log[`act_${k}`];
      check(`F3.${k}`, `missing ONLY ${expect[k]} blocks activation (P0001, message lists exactly it) even with an approval reference`, !r.ok && r.state === "P0001" && r.msg === `This SKU cannot be made active yet. Missing: ${expect[k]}.`, r.msg);
    }
    check("F3.6", "no ACTIVATE audit row and no state change after five rejections; detail json carries code + owner screen", one(s, "select count(*) from public.product_sku_master_audit") === "0" && one(s, "select count(*) from public.product_skus where is_active") === "0" && /"code": "PM_BOM_REVISION"/.test(s.log.act_PM_BOM.detail) && /"where": "PM BOM Manager"/.test(s.log.act_PM_BOM.detail));
  }
  // ---------- F4 complete activation, roles, reason, same-state ----------
  {
    const s = scenario(EDITOR + "insert into public.product_skus(product_id, pack_size, uom) values (1, 50, 'mL'),(1, 100, 'mL'),(1, 200, 'mL');\nselect public.fx_complete(1,1);select public.fx_complete(2,1);select public.fx_complete(3,1);\n"
      + T("view_only", "select set_config('fixture.perms','module:manage-products:view',true); select * from public.rpc_set_product_sku_active(1, true, 'r')")
      + T("no_auth", "select set_config('fixture.uid','',true); select * from public.rpc_set_product_sku_active(1, true, 'r')")
      + T("blank_reason", "select * from public.rpc_set_product_sku_active(1, true, '   ')")
      + T("activate", "select * from public.rpc_set_product_sku_active(1, true, 'Go live', 'REF-9')")
      + T("again", "select * from public.rpc_set_product_sku_active(1, true, 'again')")
      + T("direct_trigger", "update public.product_skus set is_active = true where id = 2")
      + T("deactivate", "select * from public.rpc_set_product_sku_active(1, false, 'retire')"));
    const l = s.log;
    check("F4.1", "complete SKU activates through the RPC; audit holds reason, approval reference, actor and old/new snapshots", l.activate.ok && one(s, "select event_type||'|'||reason||'|'||approval_reference||'|'||(old_snapshot->>'is_active')||'|'||(new_snapshot->>'is_active')||'|'||(actor_user_id is not null) from public.product_sku_master_audit where event_type='ACTIVATE'") === "ACTIVATE|Go live|REF-9|false|true|true");
    check("F4.2", "a complete SKU also activates by direct UPDATE (trigger passes) — and no audit row is written on that path", l.direct_trigger.ok && one(s, "select count(*) from public.product_sku_master_audit where sku_id = 2") === "0");
    check("F4.3", "view-only editor, unauthenticated caller and blank reason are all refused", !l.view_only.ok && /Permission denied/.test(l.view_only.msg) && !l.no_auth.ok && /Not authenticated|Permission denied/.test(l.no_auth.msg) && !l.blank_reason.ok && /reason is required/.test(l.blank_reason.msg));
    check("F4.4", "already-active target is rejected; deactivation is allowed and audited DEACTIVATE (never blocked by the five-essential check)", !l.again.ok && /is already active/.test(l.again.msg) && l.deactivate.ok && one(s, "select count(*) from public.product_sku_master_audit where event_type='DEACTIVATE'") === "1");
    check("F4.5", "SKU created inactive then completed then activated = the supported path; the audit trail shows exactly ACTIVATE then DEACTIVATE for SKU 1", one(s, "select string_agg(event_type, ',' order by id) from public.product_sku_master_audit where sku_id = 1") === "ACTIVATE,DEACTIVATE");
  }
  // ---------- F5 parent-active guard ----------
  {
    const s = scenario(EDITOR + "insert into public.product_skus(product_id, pack_size, uom) values (2, 50, 'mL');\nselect public.fx_complete(1, 2);\n"
      + T("act_under_inactive_parent", "select * from public.rpc_set_product_sku_active(1, true, 'go')")
      + T("direct_under_inactive_parent", "update public.product_skus set is_active = true where id = 1"));
    check("F5.1", "a COMPLETE SKU under an Inactive product cannot be activated (RPC or direct); nothing is audited", !s.log.act_under_inactive_parent.ok && /inactive product/.test(s.log.act_under_inactive_parent.msg) && !s.log.direct_under_inactive_parent.ok && one(s, "select count(*) from public.product_sku_master_audit") === "0");
    check("F5.2", "Active is not Costing Ready: the activation check passes while only the five essentials are modelled (readiness dimensions beyond the five are NOT evaluated by the guard)", one(s, "select jsonb_array_length((costing.fn_sku_activation_missing_items(1))->'missing')") === "0");
  }
  // ---------- F6 later dependency deletion / expiry (row writes) ----------
  {
    const s = scenario(EDITOR + "insert into public.product_skus(product_id, pack_size, uom) values (1, 50, 'mL');\nselect public.fx_complete(1,1);\nselect * from public.rpc_set_product_sku_active(1, true, 'go');\nselect costing.fx_build_now('2026-09-01');\n"
      + T("fresh_before", "select costing.fx_read('2026-09-01')")
      + "delete from public.plm_bom_revision where sku_id = 1;\nupdate public.production_batch_size_ref set effective_to = date '2026-10-01' where product_id = 1;\n"
      + T("read_after_change", "select costing.fx_read('2026-09-01')") + T("read_again", "select costing.fx_read('2026-09-01')")
      + "create table public.fx_snap as select count(*) as n from costing.fx_build;\nselect costing.fx_build_now('2026-09-01');\n" + T("read_after_rebuild", "select costing.fx_read('2026-09-01')")
      + T("absent", "select costing.fx_read('2030-01-01')"));
    check("F6.1", "deleting the approved PM BOM revision and expiring the batch-size reference do NOT deactivate the active SKU (explicit existing boundary; no automatic deactivation)", one(s, "select is_active from public.product_skus where id=1") === "t");
    check("F6.2", "the SAME guard helper now reports both dependencies missing (detection source exists, evaluated on demand)", one(s, "select string_agg(m->>'code', ',' order by m->>'code') from jsonb_array_elements((costing.fn_sku_activation_missing_items(1))->'missing') m") === "BATCH_SIZE_REFERENCE,PM_BOM_REVISION");
    check("F6.3", "source-epoch hooks fire on both dependency writes; the (modelled) freshness read turns STALE, fail-closed, until a governed rebuild; absent build also fails closed", s.log.fresh_before.ok && !s.log.read_after_change.ok && /READINESS_BUILD_STALE/.test(s.log.read_after_change.msg) && s.log.read_after_rebuild.ok && !s.log.absent.ok && /READINESS_BUILD_ABSENT/.test(s.log.absent.msg));
    check("F6.4", "nothing in the model alerts anyone or rebuilds: STALE persists on repeated reads and the build count is unchanged until an explicit build call (matches the 12 Nov production recovery, which needed an owner-authorised one-off call)", !s.log.read_again.ok && /READINESS_BUILD_STALE/.test(s.log.read_again.msg) && one(s, "select n from public.fx_snap") === "1");
  }
  // ---------- F7 expiry by passage of time only ----------
  {
    const s = scenario(EDITOR + "insert into public.product_skus(product_id, pack_size, uom) values (1, 50, 'mL');\nselect public.fx_complete(1,1);\nupdate public.production_batch_size_ref set effective_to = date '2026-12-31' where product_id = 1;\nselect * from public.rpc_set_product_sku_active(1, true, 'go');\nselect costing.fx_build_now('2026-09-01');\n"
      + T("fresh_now", "select costing.fx_read('2026-09-01')"));
    const epochBefore = one(s, "select string_agg(source_name||':'||epoch, ',' order by source_name) from costing.readiness_portfolio_source_epoch");
    const later = session({ now: "2027-01-05 10:00:00+05:30" });
    const checkLater = one(s, "select (costing.fn_sku_activation_missing_items(1))->>'as_of_date' || '|' || coalesce((select string_agg(m->>'code', ',') from jsonb_array_elements((costing.fn_sku_activation_missing_items(1))->'missing') m), '')", later);
    const readLater = s.q("select costing.fx_read('2026-09-01')", later).split("\n").pop();
    const epochAfter = one(s, "select string_agg(source_name||':'||epoch, ',' order by source_name) from costing.readiness_portfolio_source_epoch", later);
    check("F7.1", "with the clock past effective_to and NO row written, the activation helper (as-of = today IST) reports BATCH_SIZE_REFERENCE missing for the already-active SKU", checkLater === "2027-01-05|BATCH_SIZE_REFERENCE", checkLater);
    check("F7.2", "…while NO epoch changes and the modelled freshness read still returns FRESH: write-triggered hooks cannot observe passage of time (structural property; the real fingerprint composition is NOT captured — catalog question Q5)", epochBefore === epochAfter && readLater === "FRESH", `epochs equal=${epochBefore === epochAfter} read=${readLater}`);
    check("F7.3", "the helper's as-of date (today IST, 2027-01-05) differs from the governed period valuation date (2026-09-10) that LIVE_AS_OF readiness is evaluated at — the activation guard and readiness evaluate different dates", one(s, "select valuation_date::text from costing.cost_periods where period_start='2026-09-01'") === "2026-09-10" && checkLater.startsWith("2027-01-05"));
  }
  // ---------- F8 active edits ----------
  {
    const s = scenario(EDITOR + "insert into public.product_skus(product_id, pack_size, uom) values (1, 50, 'mL');\nselect public.fx_complete(1,1);\nselect * from public.rpc_set_product_sku_active(1, true, 'go');\nselect costing.fx_build_now('2026-09-01');\n"
      + T("mrp_gone", "delete from costing.sku_mrp_policy where sku_id = 1")
      + T("edit_pack_active", "select public.fx_standin_rpc_update_product_sku(1, 75, 'mL', false, 'repack')")
      + T("edit_sample_active", "update public.product_skus set is_sample = true where id = 1")
      + T("reassign_to_incomplete_product", "update public.product_skus set product_id = 3 where id = 1")
      + T("reassign_to_inactive_product", "update public.product_skus set product_id = 2 where id = 1"));
    const l = s.log;
    check("F8.1", "editing pack/UOM/sample on an ACTIVE SKU is allowed even though its MRP policy is now missing (already-active boundary: essentials are not re-checked on edits)", l.edit_pack_active.ok && l.edit_sample_active.ok && one(s, "select pack_size||'|'||is_sample from public.product_skus where id=1") === "75|true", `${l.edit_pack_active.msg}|${l.edit_sample_active.msg}|${one(s, "select pack_size||'|'||is_sample from public.product_skus where id=1")}`);
    check("F8.2", "every active edit is recorded with exactly the changed columns by the verbatim change log", one(s, "select string_agg(changed_columns::text, ';' order by id) from public.product_sku_change_log where op='UPDATE' and changed_columns <> '{is_active}'::text[]").includes("{pack_size}") && one(s, "select count(*) from public.product_sku_change_log where changed_columns = '{is_sample}'") === "1");
    check("F8.3", "PROVEN PREVENTION GAP: re-parenting an ACTIVE SKU to an Active product that has NO batch size and NO route is accepted — the completeness trigger fires (UPDATE OF product_id) but returns early because the row was already active", l.reassign_to_incomplete_product.ok && one(s, "select product_id from public.product_skus where id=1") === "3");
    check("F8.4", "…detection still exists: the helper now lists the product-level essentials missing for the moved SKU and the product_skus epoch hook fired", one(s, "select string_agg(m->>'code', ',' order by m->>'code') from jsonb_array_elements((costing.fn_sku_activation_missing_items(1))->'missing') m").includes("BATCH_SIZE_REFERENCE") && one(s, "select string_agg(m->>'code', ',' order by m->>'code') from jsonb_array_elements((costing.fn_sku_activation_missing_items(1))->'missing') m").includes("MANUFACTURING_ROUTE") && l.reassign_to_incomplete_product.ok);
    check("F8.5", "re-parenting an active SKU to an INACTIVE product IS blocked by the parent-active guard", !l.reassign_to_inactive_product.ok && /inactive product/.test(l.reassign_to_inactive_product.msg));
    check("F8.6", "the freshness read goes STALE after these active edits (epoch bumped by the writes)", (() => { try { s.q("select costing.fx_read('2026-09-01')"); return false; } catch (e) { return /READINESS_BUILD_STALE/.test(String(e.message)); } })());
  }
  // ---------- F9 product deactivation interplay ----------
  {
    const s = scenario(EDITOR + "insert into public.product_skus(product_id, pack_size, uom) values (1, 50, 'mL');\nselect public.fx_complete(1,1);\nselect * from public.rpc_set_product_sku_active(1, true, 'go');\n"
      + T("deactivate_product_unguarded", "select public.fx_standin_rpc_update_product_status(1, 'Inactive')")
      + "select public.fx_standin_rpc_update_product_status(1, 'Active');\n"
      + "create trigger fx_standin_trg_product_inactivation before update of status on public.products for each row execute function public.fx_standin_guard_product_inactivation();\n"
      + T("deactivate_product_guarded", "select public.fx_standin_rpc_update_product_status(1, 'Inactive')")
      + "select * from public.rpc_set_product_sku_active(1, false, 'retire first');\n"
      + T("deactivate_product_after_sku", "select public.fx_standin_rpc_update_product_status(1, 'Inactive')")
      + T("reactivate_sku_under_inactive_product", "select * from public.rpc_set_product_sku_active(1, true, 'again')"));
    const l = s.log;
    check("F9.1", "the SKU-side triggers alone do NOT stop a product being set Inactive while an active SKU exists (leaves an active SKU under an inactive parent) — coverage rests on the product-side guard documented in WP-02 whose live definition is NOT captured", l.deactivate_product_unguarded.ok);
    check("F9.2", "STAND-IN of the documented product-side guard: product inactivation blocked while any SKU is active; allowed after the SKU is deactivated", !l.deactivate_product_guarded.ok && /active SKUs exist/.test(l.deactivate_product_guarded.msg) && l.deactivate_product_after_sku.ok);
    check("F9.3", "once the parent is Inactive, SKU reactivation is blocked by the verbatim parent guard (even though the five essentials are complete)", !l.reactivate_sku_under_inactive_product.ok && /inactive product/.test(l.reactivate_sku_under_inactive_product.msg));
  }
  // ---------- F10 ambiguous PM BOM / F11 as-of clock rules ----------
  {
    const s = scenario(EDITOR + "insert into public.product_skus(product_id, pack_size, uom) values (1, 50, 'mL');\nselect public.fx_complete(1,1);\ninsert into public.plm_bom_revision(sku_id, status, effective_from) values (1, 'APPROVED', date '2026-02-01');\n"
      + T("ambiguous_precheck", "select public.rpc_get_sku_activation_check(1)") + T("ambiguous_activate", "select * from public.rpc_set_product_sku_active(1, true, 'go')"));
    check("F10.1", "two overlapping approved PM BOM revisions make activation (and the pre-check) RAISE AMBIGUOUS_PM_BOM_REVISION — fail-closed, but as a raw exception rather than a listed 'missing' item", !s.log.ambiguous_activate.ok && /AMBIGUOUS_PM_BOM_REVISION/.test(s.log.ambiguous_activate.msg) && !s.log.ambiguous_precheck.ok && one(s, "select is_active from public.product_skus where id=1") === "f");
  }
  {
    const s = scenario(EDITOR + "insert into public.product_skus(product_id, pack_size, uom) values (1, 50, 'mL');\n");
    const asOf = (now) => one(s, "select (costing.fn_sku_activation_missing_items(1, 1))->>'as_of_date'", session({ now }));
    const r1 = asOf("2026-11-14 20:00:00+00");
    cluster.sql(s.db, "insert into costing.cost_periods values (date '2027-02-01', date '2027-02-15')");
    const r2 = asOf("2026-11-14 20:00:00+00");
    const r3 = asOf("2027-02-28 20:00:00+00");
    check("F11.1", "as-of uses the IST calendar day, not UTC (20:00 UTC on 14 Nov = 15 Nov IST) when it is later than the period valuation date", r1 === "2026-11-15", r1);
    check("F11.2", "a LATER governed valuation date beats today's IST date (greatest rule)", r2 === "2027-02-15", r2);
    check("F11.3", "once IST today passes the latest valuation date, today wins again (20:00 UTC 28 Feb = 1 Mar IST)", r3 === "2027-03-01", r3);
  }

  // ---------- F12 direct writers: forensic trail vs audit ----------
  {
    const s = scenario(EDITOR + "insert into public.product_skus(product_id, pack_size, uom) values (1, 50, 'mL');\nselect public.fx_complete(1,1);\nselect * from public.rpc_set_product_sku_active(1, true, 'go');\n"
      + "select set_config('fixture.uid','',false);\nupdate public.product_skus set is_active = false where id = 1;\n");
    check("F12.1", "a direct (non-RPC) deactivation leaves NO lifecycle audit event but IS captured in the change log with actor_user_id NULL (service/SQL-editor signature)", one(s, "select count(*) from public.product_sku_master_audit where event_type='DEACTIVATE'") === "0" && one(s, "select count(*) from public.product_sku_change_log where op='UPDATE' and changed_columns='{is_active}'::text[] and actor_user_id is null") === "1");
    check("F12.2", "audit rows are append-only in behaviour: later edits add rows and never rewrite earlier snapshots", one(s, "select (old_snapshot->>'is_active')||'>'||(new_snapshot->>'is_active') from public.product_sku_master_audit where event_type='ACTIVATE' order by id limit 1") === "false>true");
  }
  // ---------- provenance / honesty ----------
  check("F13.1", "every fixture object is classed LIVE-VERBATIM / REPO-VERBATIM / STAND-IN; the live-verbatim set equals the five captured functions + two triggers", Object.entries(PROVENANCE).filter(([, v]) => v.startsWith("LIVE-VERBATIM")).length === 7 && Object.entries(PROVENANCE).filter(([, v]) => v.startsWith("STAND-IN")).length >= 4);
} finally {
  cluster.stop();
}
console.log(failed() ? `\n${failed()} FAILED` : "\nALL PASSED");
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ synthetic: "isolated PostgreSQL fixture; live-verbatim guards, stand-in writers", provenance: PROVENANCE, results }, null, 2) + "\n");
process.exit(failed() ? 1 : 0);
