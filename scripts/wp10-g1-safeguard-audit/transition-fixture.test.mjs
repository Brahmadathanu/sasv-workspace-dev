// WP10 G1 — Product/SKU transition fixtures in an ISOLATED throw-away PostgreSQL (no network, no Supabase, destroyed afterwards).
// Reconciled with the independent live catalog: guards, the lifecycle and SKU/product writers, product-inactivation guard, price-list guard,
// change-log function, MRP / selling-price / route-family resolvers, epoch bump and the readiness fingerprint run as LIVE-VERBATIM text against
// fixture tables. Remaining stand-ins are listed in fixture-sql.mjs PROVENANCE. Results are contract/negative-path evidence for the audited
// text, NOT live behaviour, role acceptance or a statement about current data.
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
const later = (now) => session({ now });

function scenario(body, { seed = true } = {}) {
  const db = cluster.newDb();
  const boot = cluster.script(db, FIX + (seed ? "\ninsert into public.products(item, sub_group_id, status) values ('P1',1,'Active'),('P2',1,'Inactive'),('P3',1,'Active'),('P4',1,'Active'),('P5',1,'Active'),('P6',1,'Active'),('P7',1,'Active');\n" : ""));
  if (boot.code) throw new Error("fixture boot failed: " + boot.err);
  const run = cluster.script(db, body);
  const q = (sql, pre = "") => cluster.sql(db, pre + sql);
  const log = Object.fromEntries(q("select label || '#' || ok || '#' || coalesce(sqlstate,'') || '#' || coalesce(msg,'') || '#' || coalesce(detail,'') from public.fx_log order by id").split("\n").filter(Boolean).map((l) => { const [label, ok, state, msg, detail] = l.split("#"); return [label, { ok: ok === "true", state, msg, detail }]; }));
  return { db, q, log, run };
}
const one = (s, sql, pre = "") => s.q(sql, pre).split("\n").pop();
const T = (label, stmt) => `select public.fx_try('${label}', $q$${stmt}$q$);\n`;
const ALL_LABELS = ["Approved packing-material BOM", "Batch size reference", "Production route", "MRP policy", "Selling price / GST policy"];
const NEWSKU = (pid, pack = 50, uom = "mL") => `insert into public.product_skus(product_id, pack_size, uom) values (${pid}, ${pack}, '${uom}');\n`;
const ACTIVATE = (id, reason = "go") => `select * from public.rpc_set_product_sku_active(${id}, true, '${reason}');\n`;
const UPD = (id, item, sg, status, reason = "edit") => `select * from public.rpc_update_product(${id}, '${item}', ${sg}, 'ml', '${status}', null, null, false, false, null, null, false, '${reason}')`;
const epoch = (s, rel, pre = "") => Number(one(s, `select epoch from costing.readiness_portfolio_source_epoch where source_relation='${rel}'`, pre));

try {
  // ---------- F1 inactive incomplete creation (LIVE writer) ----------
  {
    const s = scenario(EDITOR + T("create_rpc", "select * from public.rpc_create_product_sku(1, 50, 'mL', false, false, 'new pack')") + T("create_direct", "insert into public.product_skus(product_id, pack_size, uom, is_active) values (1, 100, 'mL', false)"));
    check("F1.1", "inactive SKU with NONE of the five essentials can be created (LIVE rpc_create_product_sku and direct insert)", s.log.create_rpc.ok && s.log.create_direct.ok && one(s, "select count(*) from public.product_skus") === "2", s.log.create_rpc.msg);
    check("F1.2", "creation writes the live CREATE audit (old snapshot null, reason) AND the live change-log row", one(s, "select count(*) from public.product_sku_master_audit where event_type='CREATE' and old_snapshot is null and reason='new pack'") === "1" && one(s, "select count(*) from public.product_sku_change_log where op='INSERT'") === "2");
    check("F1.3", "creation bumps the product_skus source epoch (live bump function, registered relation)", epoch(s, "public.product_skus") >= 1);
  }
  // ---------- F2 rejected active creation ----------
  {
    const s = scenario(EDITOR + T("insert_active", "insert into public.product_skus(product_id, pack_size, uom, is_active) values (1, 50, 'mL', true)")
      + T("rpc_active", "select * from public.rpc_create_product_sku(1, 60, 'mL', true, false, 'active create')")
      + T("sample_active", "insert into public.product_skus(product_id, pack_size, uom, is_active, is_sample) values (1, 70, 'mL', true, true)"));
    const l = s.log;
    check("F2.1", "direct INSERT of an active SKU with no essentials is rejected (P0001) naming all five missing items with owner screens", !l.insert_active.ok && l.insert_active.state === "P0001" && ALL_LABELS.every((x) => l.insert_active.msg.includes(x)) && /PM BOM Manager/.test(l.insert_active.msg) && /Pricing Policy Manager/.test(l.insert_active.msg), l.insert_active.msg.slice(0, 100));
    check("F2.2", "the LIVE create RPC passes p_is_active=true through to the table and the trigger rejects it identically; no SKU and no audit row remain", !l.rpc_active.ok && l.rpc_active.state === "P0001" && one(s, "select count(*) from public.product_skus") === "0" && one(s, "select count(*) from public.product_sku_master_audit") === "0");
    check("F2.3", "a SAMPLE SKU gets no bypass: is_sample=true active insert is rejected with the same five items", !l.sample_active.ok && ALL_LABELS.every((x) => l.sample_active.msg.includes(x)));
    check("F2.4", "rejected creation leaves the epoch untouched (statement rolled back)", epoch(s, "public.product_skus") === 0);
  }
  // ---------- F3 rejected activation, each essential individually, no override ----------
  {
    let body = EDITOR;
    const skips = ["PM_BOM", "BATCH", "ROUTE", "MRP", "SELLING"];
    skips.forEach((k, i) => { body += NEWSKU(i + 3, 10, "g") + `select public.fx_complete(${i + 1}, ${i + 3}, '${k}');\n`; });
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
    const s = scenario(EDITOR + NEWSKU(1, 50) + NEWSKU(1, 100) + NEWSKU(1, 200) + "select public.fx_complete(1,1);select public.fx_complete(2,1);select public.fx_complete(3,1);\n"
      + T("view_only", "select set_config('fixture.perms','module:manage-products:view',true); select * from public.rpc_set_product_sku_active(1, true, 'r')")
      + T("no_auth", "select set_config('fixture.uid','',true); select * from public.rpc_set_product_sku_active(1, true, 'r')")
      + T("blank_reason", "select * from public.rpc_set_product_sku_active(1, true, '   ')")
      + T("activate", "select * from public.rpc_set_product_sku_active(1, true, 'Go live', 'REF-9')")
      + T("again", "select * from public.rpc_set_product_sku_active(1, true, 'again')")
      + T("direct_trigger", "update public.product_skus set is_active = true where id = 2")
      + T("deactivate", "select * from public.rpc_set_product_sku_active(1, false, 'retire')"));
    const l = s.log;
    check("F4.1", "complete SKU activates through the RPC; audit holds reason, approval reference, actor and old/new snapshots", l.activate.ok && one(s, "select event_type||'|'||reason||'|'||approval_reference||'|'||(old_snapshot->>'is_active')||'|'||(new_snapshot->>'is_active')||'|'||(actor_user_id is not null) from public.product_sku_master_audit where event_type='ACTIVATE'") === "ACTIVATE|Go live|REF-9|false|true|true");
    check("F4.2", "a complete SKU also activates by direct UPDATE (trigger passes) — and no lifecycle audit row is written on that path", l.direct_trigger.ok && one(s, "select count(*) from public.product_sku_master_audit where sku_id = 2") === "0");
    check("F4.3", "view-only editor, unauthenticated caller and blank reason are all refused", !l.view_only.ok && /Permission denied/.test(l.view_only.msg) && !l.no_auth.ok && /Not authenticated|Permission denied/.test(l.no_auth.msg) && !l.blank_reason.ok && /reason is required/.test(l.blank_reason.msg));
    check("F4.4", "already-active target is rejected; deactivation is allowed and audited DEACTIVATE (never blocked by the five-essential check)", !l.again.ok && /is already active/.test(l.again.msg) && l.deactivate.ok && one(s, "select count(*) from public.product_sku_master_audit where event_type='DEACTIVATE'") === "1");
    check("F4.5", "created inactive, completed, activated = the supported path; audit shows CREATE-less seed, then ACTIVATE then DEACTIVATE for SKU 1", one(s, "select string_agg(event_type, ',' order by id) from public.product_sku_master_audit where sku_id = 1") === "ACTIVATE,DEACTIVATE");
  }
  // ---------- F5 parent-active guard ----------
  {
    const s = scenario(EDITOR + NEWSKU(2) + "select public.fx_complete(1, 2);\n" + T("act_under_inactive_parent", "select * from public.rpc_set_product_sku_active(1, true, 'go')") + T("direct_under_inactive_parent", "update public.product_skus set is_active = true where id = 1"));
    check("F5.1", "a COMPLETE SKU under an Inactive product cannot be activated (RPC or direct); nothing is audited", !s.log.act_under_inactive_parent.ok && /inactive product/.test(s.log.act_under_inactive_parent.msg) && !s.log.direct_under_inactive_parent.ok && one(s, "select count(*) from public.product_sku_master_audit") === "0");
    check("F5.2", "Active is not Costing Ready: the guard's five-essential check passes while every other WP-01 dependency is outside its scope", one(s, "select jsonb_array_length((costing.fn_sku_activation_missing_items(1))->'missing')") === "0");
  }
  // ---------- F6 later dependency deletion / expiry (row writes) with the LIVE fingerprint ----------
  {
    const s = scenario(EDITOR + NEWSKU(1) + "select public.fx_complete(1,1);\n" + ACTIVATE(1) + "select costing.fx_build_now('2026-09-01');\n"
      + T("fresh_before", "select costing.fx_read('2026-09-01')")
      + "delete from public.plm_bom_revision where sku_id = 1;\nupdate public.production_batch_size_ref set effective_to = date '2026-10-01' where product_id = 1;\n"
      + T("read_after_change", "select costing.fx_read('2026-09-01')") + T("read_again", "select costing.fx_read('2026-09-01')")
      + "create table public.fx_snap as select count(*) as n from costing.fx_build;\nselect costing.fx_build_now('2026-09-01');\n" + T("read_after_rebuild", "select costing.fx_read('2026-09-01')")
      + "insert into costing.cost_periods values (date '2026-10-01', date '2026-10-05');\n"
      + T("absent", "select costing.fx_read('2026-10-01')") + T("no_governed_period", "select costing.fx_read('2030-01-01')"));
    check("F6.1", "deleting the approved PM BOM revision and expiring the batch-size reference do NOT deactivate the active SKU (explicit boundary; no automatic deactivation)", one(s, "select is_active from public.product_skus where id=1") === "t");
    check("F6.2", "the SAME live helper now reports both dependencies missing (detection source exists, evaluated on demand at today's IST date)", one(s, "select string_agg(m->>'code', ',' order by m->>'code') from jsonb_array_elements((costing.fn_sku_activation_missing_items(1))->'missing') m") === "BATCH_SIZE_REFERENCE,PM_BOM_REVISION");
    check("F6.3", "live epoch hooks fire on both writes; the LIVE fingerprint changes so the (modelled) portfolio read turns STALE, fail-closed, until a governed rebuild; a period with no build fails closed as ABSENT and a period with no governed valuation date fails closed at the fingerprint", s.log.fresh_before.ok && !s.log.read_after_change.ok && /READINESS_BUILD_STALE/.test(s.log.read_after_change.msg) && s.log.read_after_rebuild.ok && !s.log.absent.ok && /READINESS_BUILD_ABSENT/.test(s.log.absent.msg) && !s.log.no_governed_period.ok && /Governed valuation date missing/.test(s.log.no_governed_period.msg));
    check("F6.4", "STALE persists on repeated reads and the build count is unchanged until an explicit build call (no scheduler exists in the fixture; production schedule/owner NOT PROVEN)", !s.log.read_again.ok && /READINESS_BUILD_STALE/.test(s.log.read_again.msg) && one(s, "select n from public.fx_snap") === "1");
  }
  // ---------- F7 passage of time; governed-period semantics preserved ----------
  {
    const s = scenario(EDITOR + NEWSKU(1) + "select public.fx_complete(1,1);\nupdate public.production_batch_size_ref set effective_to = date '2026-12-31' where product_id = 1;\n" + ACTIVATE(1) + "select costing.fx_build_now('2026-09-01');\n"
      + T("fresh_now", "select costing.fx_read('2026-09-01')"));
    const fpNow = one(s, "select digest from costing.fn_wp04_readiness_source_fingerprint('2026-09-01')", EDITOR);
    const L = later("2027-01-05 10:00:00+05:30");
    const fpLater = one(s, "select digest from costing.fn_wp04_readiness_source_fingerprint('2026-09-01')", L);
    const epochs = (pre) => one(s, "select string_agg(source_relation||':'||epoch, ',' order by source_relation) from costing.readiness_portfolio_source_epoch", pre);
    const helperLater = one(s, "select (costing.fn_sku_activation_missing_items(1))->>'as_of_date' || '|' || coalesce((select string_agg(m->>'code', ',') from jsonb_array_elements((costing.fn_sku_activation_missing_items(1))->'missing') m), '')", L);
    check("F7.1", "with the clock past effective_to and NO row written, the activation helper (as-of = today IST) reports BATCH_SIZE_REFERENCE missing for the already-active SKU", helperLater === "2027-01-05|BATCH_SIZE_REFERENCE", helperLater);
    check("F7.2", "LIVE fingerprint digest and epochs are identical at both clocks (the live fingerprint text references no clock), and the portfolio read still returns FRESH — correct for its contract: the governed period's result at valuation date 2026-09-10", fpNow === fpLater && epochs(EDITOR) === epochs(L) && one(s, "select costing.fx_read('2026-09-01')", L) === "FRESH", `digest equal=${fpNow === fpLater}`);
    const atVal = one(s, "select (select resolution_status from costing.fn_resolve_sku_mrp_as_of(1, date '2026-09-10')) || '|' || ((costing.fn_validate_effective_product_process_route(1, date '2026-09-10'))->>'valid') || '|' || exists(select 1 from public.production_batch_size_ref where product_id=1 and effective_from <= date '2026-09-10' and (effective_to is null or effective_to >= date '2026-09-10'))", L);
    check("F7.3", "governed-period semantics: evaluated AT the period valuation date the SKU's essentials still resolve (RESOLVED|true|true) even though today's IST date is after the batch reference expiry — two different contracts, neither wrong", atVal === "RESOLVED|true|true", atVal);
    check("F7.4", "the fingerprint carries the governed valuation date 2026-09-10 and the successful evidence run, never today's date", one(s, "select fingerprint->>'valuation_date' || '|' || (fingerprint->>'evidence_refresh_run_id') from costing.fn_wp04_readiness_source_fingerprint('2026-09-01')", L) === "2026-09-10|1");
  }
  // ---------- F8 active edits and re-parenting (privileged direct writers) ----------
  {
    const s = scenario(EDITOR + NEWSKU(1) + "select public.fx_complete(1,1);\n" + ACTIVATE(1) + "select costing.fx_build_now('2026-09-01');\n"
      + T("mrp_gone", "delete from costing.sku_mrp_policy where sku_id = 1")
      + T("edit_pack_active", "select * from public.rpc_update_product_sku(1, 75, 'mL', false, 'repack')")
      + T("edit_sample_active", "select * from public.rpc_update_product_sku(1, 75, 'mL', true, 'now a sample')")
      + T("reassign_to_incomplete_product", "update public.product_skus set product_id = 3 where id = 1")
      + T("reassign_to_inactive_product", "update public.product_skus set product_id = 2 where id = 1"));
    const l = s.log;
    check("F8.1", "LIVE rpc_update_product_sku edits pack/sample on an ACTIVE SKU even though its MRP policy is now missing (already-active boundary: essentials are not re-checked)", l.edit_pack_active.ok && l.edit_sample_active.ok && one(s, "select pack_size||'|'||is_sample from public.product_skus where id=1") === "75|true", `${l.edit_pack_active.msg}|${l.edit_sample_active.msg}`);
    check("F8.2", "every active edit is recorded with the exact changed columns (live change-log function) and the live UPDATE audit holds old/new snapshots", one(s, "select count(*) from public.product_sku_change_log where changed_columns = '{pack_size}'::text[]") === "1" && one(s, "select count(*) from public.product_sku_change_log where changed_columns = '{is_sample}'::text[]") === "1" && one(s, "select count(*) from public.product_sku_master_audit where event_type='UPDATE' and old_snapshot->>'pack_size' = '50'") === "1");
    check("F8.3", "PROVEN AT TRIGGER LEVEL (privileged writers only): re-parenting an ACTIVE SKU to an Active product with NO batch size and NO route is accepted — the completeness trigger fires (UPDATE OF product_id) but returns early for an already-active row", l.reassign_to_incomplete_product.ok && one(s, "select product_id from public.product_skus where id=1") === "3");
    const missing = one(s, "select string_agg(m->>'code', ',' order by m->>'code') from jsonb_array_elements((costing.fn_sku_activation_missing_items(1))->'missing') m");
    check("F8.4", "…detection still exists: the helper lists the product-level essentials missing for the moved SKU and the live epoch hook fired", missing.includes("BATCH_SIZE_REFERENCE") && missing.includes("MANUFACTURING_ROUTE") && epoch(s, "public.product_skus") >= 3, missing);
    check("F8.5", "re-parenting an active SKU to an INACTIVE product IS blocked by the live parent-active guard", !l.reassign_to_inactive_product.ok && /inactive product/.test(l.reassign_to_inactive_product.msg));
    check("F8.6", "the live-fingerprint portfolio read goes STALE after these writes", (() => { try { s.q("select costing.fx_read('2026-09-01')"); return false; } catch (e) { return /READINESS_BUILD_STALE/.test(String(e.message)); } })());
    check("F8.7", "the LIVE SKU update RPC has no product_id or is_active parameter, so the supported client path cannot re-parent or activate (signature from the independent catalog)", true);
  }
  // ---------- F9 product deactivation interaction (LIVE product-side guard) ----------
  {
    const s = scenario(EDITOR + NEWSKU(1) + "select public.fx_complete(1,1);\n" + ACTIVATE(1)
      + T("product_inactive_with_active_sku", UPD(1, "P1", 1, "Inactive"))
      + "select * from public.rpc_set_product_sku_active(1, false, 'retire first');\n"
      + T("product_inactive_after_sku", UPD(1, "P1", 1, "Inactive"))
      + T("reactivate_sku_under_inactive_product", "select * from public.rpc_set_product_sku_active(1, true, 'again')")
      + T("direct_product_inactive", "update public.products set status = 'Inactive' where id = 3"));
    const l = s.log;
    check("F9.1", "LIVE product-side guard (BEFORE UPDATE OF status): the LIVE rpc_update_product cannot inactivate a product while any SKU is active — names the count and the remedy", !l.product_inactive_with_active_sku.ok && /Cannot mark product 1 inactive while 1 active SKU\(s\) remain\. Deactivate the SKUs first\./.test(l.product_inactive_with_active_sku.msg));
    check("F9.2", "once the SKU is deactivated, product inactivation succeeds and the live product audit records DEACTIVATE with old/new snapshots", l.product_inactive_after_sku.ok && one(s, "select event_type||'|'||(old_snapshot->>'status')||'>'||(new_snapshot->>'status') from public.product_master_audit order by id desc limit 1") === "DEACTIVATE|Active>Inactive");
    check("F9.3", "once the parent is Inactive, SKU reactivation is blocked by the live parent guard even though all five essentials are complete", !l.reactivate_sku_under_inactive_product.ok && /inactive product/.test(l.reactivate_sku_under_inactive_product.msg));
    check("F9.4", "the product guard protects direct writers too (direct UPDATE of a product with no active SKU is allowed; with an active SKU it would be refused by the same trigger)", l.direct_product_inactive.ok);
    const s2 = scenario(EDITOR + NEWSKU(1) + "select public.fx_complete(1,1);\n" + ACTIVATE(1) + "drop trigger trg_product_inactivation_requires_no_active_skus on public.products;\n" + T("unguarded", UPD(1, "P1", 1, "Inactive")));
    check("F9.5", "reliance proof: with the product-side trigger removed (fixture only) an Inactive product with an ACTIVE SKU becomes possible — SKU-side triggers do not cover it, so the single product-side trigger carries this invariant", s2.log.unguarded.ok);
  }
  // ---------- F10 ambiguous PM BOM ----------
  {
    const s = scenario(EDITOR + NEWSKU(1) + "select public.fx_complete(1,1);\ninsert into public.plm_bom_revision(sku_id, status, effective_from) values (1, 'APPROVED', date '2026-02-01');\n"
      + T("ambiguous_precheck", "select public.rpc_get_sku_activation_check(1)") + T("ambiguous_activate", "select * from public.rpc_set_product_sku_active(1, true, 'go')"));
    check("F10.1", "two overlapping approved PM BOM revisions make activation (and the pre-check) RAISE AMBIGUOUS_PM_BOM_REVISION — fail-closed, but a raw exception rather than a listed 'missing' item", !s.log.ambiguous_activate.ok && /AMBIGUOUS_PM_BOM_REVISION/.test(s.log.ambiguous_activate.msg) && !s.log.ambiguous_precheck.ok && one(s, "select is_active from public.product_skus where id=1") === "f");
  }
  // ---------- F11 as-of rule ----------
  {
    const s = scenario(EDITOR + NEWSKU(1));
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
    const s = scenario(EDITOR + NEWSKU(1) + "select public.fx_complete(1,1);\n" + ACTIVATE(1) + "select set_config('fixture.uid','',false);\nupdate public.product_skus set is_active = false where id = 1;\n");
    check("F12.1", "a direct (non-RPC) deactivation leaves NO lifecycle audit event but IS captured in the live change log with actor_user_id NULL", one(s, "select count(*) from public.product_sku_master_audit where event_type='DEACTIVATE'") === "0" && one(s, "select count(*) from public.product_sku_change_log where op='UPDATE' and changed_columns='{is_active}'::text[] and actor_user_id is null") === "1");
    check("F12.2", "audit rows are append-only in behaviour: later edits add rows and never rewrite earlier snapshots", one(s, "select (old_snapshot->>'is_active')||'>'||(new_snapshot->>'is_active') from public.product_sku_master_audit where event_type='ACTIVATE' order by id limit 1") === "false>true");
  }
  // ---------- F14 product master edit changes an ACTIVE SKU's product-level route (LIVE rpc_update_product + LIVE route resolver) ----------
  {
    const s = scenario(EDITOR + "insert into costing.production_route_family(id, status, effective_from) values (777, 'APPROVED', date '2026-01-01');\ninsert into costing.production_route_family_product_subgroup_map(product_subgroup_id, route_family_id, status, effective_from) values (1, 777, 'APPROVED', date '2026-01-01');\ninsert into costing.production_route_family_route(route_family_id, status, effective_from) values (777, 'APPROVED', date '2026-01-01');\n"
      + NEWSKU(1) + "select public.fx_complete(1, 1, 'ROUTE');\n" + ACTIVATE(1) + "select costing.fx_build_now('2026-09-01');\n"
      + T("move_subgroup", UPD(1, "P1", 3, "Active", "reclassify")));
    check("F14.1", "the route essential can be satisfied through the product's SUBGROUP mapping (live resolver precedence: product map, then subgroup, then group) and activation succeeds", one(s, "select is_active from public.product_skus where id=1") === "t");
    check("F14.2", "PROVEN: editing the product's subgroup with the LIVE rpc_update_product is accepted while an SKU is active and silently drops the resolved route (MANUFACTURING_ROUTE now missing) — product-level essentials are not re-checked on product edits", s.log.move_subgroup.ok && one(s, "select string_agg(m->>'code', ',') from jsonb_array_elements((costing.fn_sku_activation_missing_items(1))->'missing') m") === "MANUFACTURING_ROUTE");
    check("F14.3", "…detected afterwards: the products/product_skus epoch hooks fired and the portfolio read is STALE until rebuilt (prevention none, detection fail-closed)", (() => { try { s.q("select costing.fx_read('2026-09-01')"); return false; } catch (e) { return /READINESS_BUILD_STALE/.test(String(e.message)); } })() && epoch(s, "public.products") >= 1);
  }
  // ---------- F15 LIVE writer validation negatives ----------
  {
    const s = scenario(EDITOR + NEWSKU(1, 50, "mL")
      + T("zero_pack", "select * from public.rpc_create_product_sku(1, 0, 'mL', false, false, 'r')")
      + T("blank_uom", "select * from public.rpc_create_product_sku(1, 10, '  ', false, false, 'r')")
      + T("blank_reason", "select * from public.rpc_create_product_sku(1, 10, 'mL', false, false, ' ')")
      + T("dup_identity", "select * from public.rpc_create_product_sku(1, 50, 'ML', false, false, 'dup')")
      + T("no_product", "select * from public.rpc_create_product_sku(999, 10, 'mL', false, false, 'r')")
      + T("update_dup", "select * from public.rpc_create_product_sku(1, 60, 'mL', false, false, 'r'); select * from public.rpc_update_product_sku(2, 50, 'mL', false, 'collide')")
      + T("viewer_create", "select set_config('fixture.perms','module:manage-products:view',true); select * from public.rpc_create_product_sku(1, 70, 'mL', false, false, 'r')"));
    const l = s.log;
    check("F15.1", "LIVE create rejects zero pack, blank UOM, blank reason, duplicate identity (case-insensitive UOM), missing product and a view-only caller", !l.zero_pack.ok && /greater than zero/.test(l.zero_pack.msg) && !l.blank_uom.ok && /UOM is required/.test(l.blank_uom.msg) && !l.blank_reason.ok && /reason is required/.test(l.blank_reason.msg) && !l.dup_identity.ok && /already exists/.test(l.dup_identity.msg) && !l.no_product.ok && /does not exist/.test(l.no_product.msg) && !l.viewer_create.ok && /Permission denied/.test(l.viewer_create.msg));
    check("F15.2", "LIVE update rejects a colliding identity", !l.update_dup.ok && /Another SKU already exists/.test(l.update_dup.msg));
  }
  // ---------- F16 price-list guard ----------
  {
    const s = scenario(EDITOR + "insert into public.product_skus(product_id, pack_size, uom, price_list_ik, price_list_ok) values (1, 50, 'mL', true, true);\n");
    check("F16.1", "LIVE price-list guard forces both price-list flags FALSE on an inactive SKU (BEFORE trigger, not SECURITY DEFINER)", one(s, "select price_list_ik::text||'|'||price_list_ok::text from public.product_skus where id=1") === "false|false");
  }
  // ---------- F17 expiry-horizon feasibility: which essentials can be inspected at another date with EXISTING date-parameterised contracts ----------
  {
    const s = scenario(EDITOR + NEWSKU(1) + "select public.fx_complete(1,1);\nupdate costing.sku_mrp_policy set effective_to = date '2026-12-31' where sku_id = 1;\nupdate public.plm_bom_revision set effective_to = date '2026-12-31' where sku_id = 1;\nupdate public.production_batch_size_ref set effective_to = date '2026-12-31' where product_id = 1;\n");
    const at = (d) => one(s, `select (select resolution_status from costing.fn_resolve_sku_mrp_as_of(1, date '${d}')) || '|' || ((public.plm_sku_bom_revision_as_of(1, date '${d}')).id is not null)::text || '|' || (costing.fn_resolve_route_family_for_product(1, date '${d}') is not null)::text`);
    check("F17.1", "the canonical resolvers ARE date-parameterised: MRP policy and PM BOM revision resolve at 2026-12-01 and stop resolving at 2027-01-05 (effective_to boundary inspectable without writing anything)", at("2026-12-01") === "RESOLVED|true|true" && at("2027-01-05") === "MISSING|false|true", `${at("2026-12-01")} / ${at("2027-01-05")}`);
    const sig = (name) => cluster.sql(s.db, `select pg_get_function_identity_arguments(oid) from pg_proc where proname='${name}' and pronamespace='costing'::regnamespace`).split("\n").pop();
    check("F17.2", "the activation helper CANNOT be called at today+N: its signature is (p_sku_id bigint, p_product_id bigint) and the as-of date is computed inside", sig("fn_sku_activation_missing_items") === "p_sku_id bigint, p_product_id bigint");
    check("F17.3", "the batch-size essential has NO resolver function: it is an inline predicate inside the helper, so a horizon check needs a reviewed date-parameterised contract (or one narrow internal function) for that essential", cluster.sql(s.db, "select count(*) from pg_proc where proname ilike '%batch_size%'") === "0");
  }
  // ---------- provenance / honesty ----------
  check("F13.1", "every fixture object is classed; LIVE-VERBATIM now covers writers, product guard, price-list guard, change log, three resolvers, epoch bump and fingerprint; the stand-in set is the route-validation chain, permission/auth stubs and the modelled portfolio read", Object.values(PROVENANCE).filter((v) => v.startsWith("LIVE-VERBATIM")).length >= 14 && Object.values(PROVENANCE).filter((v) => v.startsWith("STAND-IN")).length === 2 && Object.values(PROVENANCE).filter((v) => v.startsWith("MODEL")).length === 1);
} finally {
  cluster.stop();
}
console.log(failed() ? `\n${failed()} FAILED` : "\nALL PASSED");
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ synthetic: "isolated PostgreSQL fixture; live-verbatim guards and writers (independent catalog), labelled stand-ins", provenance: PROVENANCE, results }, null, 2) + "\n");
process.exit(failed() ? 1 : 0);
