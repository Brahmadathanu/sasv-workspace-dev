// WP10 G2 — active-SKU re-parent guard (proposal 04) and product route-impact guard (proposal 05), isolated PostgreSQL fixture.
// Live-verbatim writers/guards/resolvers from the G1 fixture; route VALIDATION is the labelled G1 stand-in. Proposal SQL loaded exactly as drafted.
// Run: node scripts/wp10-g2-safeguards/guards.test.mjs [resultsJson]
import fs from "node:fs";
import { spawn } from "node:child_process";
import { pgAvailable, startPg, g2FixtureSql, makeRunner, session, draft, DRAFTS, T, NEWSKU, ACTIVATE } from "./fixture.mjs";
import { makeResults } from "../wp10-g1-safeguard-audit/lib.mjs";

const { results, check, classify, failed } = makeResults();
if (!pgAvailable()) { classify("G0", "SKIPPED", "PostgreSQL unavailable — guard fixtures SKIPPED (not PASS)"); if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ results }, null, 2) + "\n"); process.exit(2); }
const cluster = startPg();
const EDITOR = session();
const UPD = (id, item, sg, status = "Active", reason = "edit") => `select * from public.rpc_update_product(${id}, '${item}', ${sg}, 'ml', '${status}', null, null, false, false, null, null, false, '${reason}')`;
const OPEN = (sku, product) => NEWSKU(product, 10 + sku) + `select public.fx_complete(${sku}, ${product});\n` + ACTIVATE(sku);
// route for product p valid ONLY through a SUBGROUP-level mapping (family 777 on subgroup 1)
const SUBGROUP_ROUTE = "insert into costing.production_route_family(id, status, effective_from) values (777, 'APPROVED', date '2026-01-01');\ninsert into costing.production_route_family_product_subgroup_map(product_subgroup_id, route_family_id, status, effective_from) values (1, 777, 'APPROVED', date '2026-01-01');\ninsert into costing.production_route_family_route(route_family_id, status, effective_from) values (777, 'APPROVED', date '2026-01-01');\n";
// product-level essentials (batch size + product-level route) for product p, WITHOUT touching SKU-level rows
const PRODUCT_LEVEL = (p) => `insert into public.production_batch_size_ref(product_id, effective_from) values (${p}, date '2026-01-01');\ninsert into costing.production_route_family(id, status, effective_from) values (${900 + p}, 'APPROVED', date '2026-01-01');\ninsert into costing.production_route_family_product_map(product_id, route_family_id, status, effective_from) values (${p}, ${900 + p}, 'APPROVED', date '2026-01-01');\ninsert into costing.production_route_family_route(route_family_id, status, effective_from) values (${900 + p}, 'APPROVED', date '2026-01-01');\n`;
const AMBIG = (p) => `select public.fx_product_route(${p}, date '2026-01-01', null, (select id from costing.production_route_family_route where route_family_id = ${900 + p} limit 1));\nselect public.fx_product_route(${p}, date '2026-02-01', null, (select id from costing.production_route_family_route where route_family_id = ${900 + p} limit 1));\n`;
const SUBGROUP_ACTIVE = (sku, product) => NEWSKU(product, 10 + sku) + `select public.fx_complete(${sku}, ${product}, 'ROUTE');\n` + ACTIVATE(sku);

try {
  const scenario = makeRunner(cluster);
  // ================= re-parent guard =================
  {
    const s = scenario(EDITOR + OPEN(1, 1)
      + T("reparent_active", "update public.product_skus set product_id = 3 where id = 1")
      + T("reparent_active_service", "set local role service_role; update public.product_skus set product_id = 3 where id = 1"));
    check("R1.1", "a PRIVILEGED direct re-parent of an ACTIVE SKU is rejected (P0001, WP10_ACTIVE_SKU_REPARENT_REJECTED) with the reviewed-path hint; the row is unchanged and nothing is logged", !s.log.reparent_active.ok && s.log.reparent_active.state === "P0001" && /WP10_ACTIVE_SKU_REPARENT_REJECTED: SKU 1 is active and cannot be moved from product 1 to product 3/.test(s.log.reparent_active.msg) && /rpc_set_product_sku_active/.test(s.log.reparent_active.detail || "") === false && one(s, "select product_id from public.product_skus where id=1") === "1" && one(s, "select count(*) from public.product_sku_change_log where changed_columns @> '{product_id}'") === "0");
    function one(sc, q) { return sc.one(q); }
    check("R1.2", "the rejection is not role-dependent: owner and a service-role session are both refused (the guard is a trigger, not a privilege check)", !s.log.reparent_active_service.ok);
  }
  {
    const s = scenario(EDITOR + NEWSKU(1) + "select public.fx_complete(1, 3);\n"
      + T("inactive_reparent", "update public.product_skus set product_id = 3 where id = 1")
      + "select * from public.rpc_set_product_sku_active(1, true, 'activate on product 3');\n"
      + T("deactivate_and_reparent_one_statement", "update public.product_skus set is_active = false, product_id = 1 where id = 1"));
    check("R2.1", "an INACTIVE SKU can still be re-parented (unchanged behaviour) and then activated under the new product through the live guard", s.log.inactive_reparent.ok && s.one("select product_id from public.product_skus where id=1") !== "x");
    check("R2.2", "a single UPDATE that deactivates AND re-parents is allowed (the row ends inactive; documented as a direct write without a lifecycle event)", s.log.deactivate_and_reparent_one_statement.ok);
  }
  {
    const s = scenario(EDITOR + OPEN(1, 1)
      + "select * from public.rpc_set_product_sku_active(1, false, 'move to product 3');\n"
      + "update public.product_skus set product_id = 3 where id = 1;\n"
      + T("activate_incomplete_product", "select * from public.rpc_set_product_sku_active(1, true, 'again')")
      + PRODUCT_LEVEL(3)
      + T("activate_complete_product", "select * from public.rpc_set_product_sku_active(1, true, 'again 2')"));
    check("R3.1", "REVIEWED PATH: deactivate (audited) → re-parent → the live five-essential guard BLOCKS re-activation while the new product lacks batch size/route → complete → activation succeeds", !s.log.activate_incomplete_product.ok && /Batch size reference|Production route/.test(s.log.activate_incomplete_product.msg) && s.log.activate_complete_product.ok);
    check("R3.2", "the reviewed path leaves the audit trail DEACTIVATE then ACTIVATE with reasons", s.one("select string_agg(event_type, ',' order by id) from public.product_sku_master_audit where sku_id=1") === "ACTIVATE,DEACTIVATE,ACTIVATE");
  }
  {
    const s = scenario(EDITOR + OPEN(1, 1)
      + T("edit_pack_active", "select * from public.rpc_update_product_sku(1, 75, 'mL', true, 'repack')")
      + T("edit_other_column", "update public.product_skus set price_list_ik = true where id = 1")
      + T("new_sku_same_product", "select * from public.rpc_create_product_sku(1, 500, 'mL', false, false, 'another pack')")
      + T("deactivate", "select * from public.rpc_set_product_sku_active(1, false, 'retire')"));
    check("R4.1", "NORMAL operations are unaffected: pack/sample edit on an active SKU, an unrelated column update, creating another SKU and deactivating all still succeed", s.log.edit_pack_active.ok && s.log.edit_other_column.ok && s.log.new_sku_same_product.ok && s.log.deactivate.ok);
  }
  {
    const s = scenario(EDITOR + OPEN(1, 1) + PRODUCT_LEVEL(2)
      + T("reparent_to_inactive_parent", "select * from public.rpc_set_product_sku_active(1, false, 'x'); update public.product_skus set product_id = 2 where id = 1; select * from public.rpc_set_product_sku_active(1, true, 'y')"));
    check("R5.1", "the live parent-active guard still governs the reviewed path (activation under an Inactive product is refused)", !s.log.reparent_to_inactive_parent.ok && /inactive product/.test(s.log.reparent_to_inactive_parent.msg));
  }
  // rollback restores G1 F8.3 behaviour exactly
  {
    const sql = g2FixtureSql();
    const sc = makeRunner(cluster, { sql: sql + "\n" + draft(DRAFTS.rollback) });
    const s = sc(EDITOR + OPEN(1, 1) + "select public.fx_complete(1, 3, 'PM_BOM');\n" + T("reparent_after_rollback", "update public.product_skus set product_id = 3 where id = 1"));
    check("R6.1", "99_rollback_all.sql removes every proposed object and restores the G1-proven behaviour (privileged active re-parent accepted again; no WP10 function/trigger remains)", s.log.reparent_after_rollback.ok && s.one("select count(*) from pg_proc where proname like '%wp10%'") === "0" && s.one("select count(*) from pg_trigger where tgname like '%wp10%'") === "0");
  }
  // ================= product route-impact guard =================
  {
    const s = scenario(EDITOR + SUBGROUP_ROUTE + SUBGROUP_ACTIVE(1, 1) + NEWSKU(1, 99) + "select public.fx_complete(2, 1, 'ROUTE');\n" + ACTIVATE(2) + "insert into costing.production_route_family_product_subgroup_map(product_subgroup_id, route_family_id, status, effective_from) values (2, 777, 'APPROVED', date '2026-01-01');\n"
      + "create table public.fx_snap_epoch as select epoch from costing.readiness_portfolio_source_epoch where source_relation = 'public.products';\n"
      + T("harmful", UPD(1, "P1", 3, "Active", "reclassify to 3")));
    // sub_group 3 has NO mapping -> route lost
    check("P1.1", "HARMFUL EDIT REJECTED: moving a product with 2 active SKUs to a sub-group with no approved route is rejected (P0001, WP10_PRODUCT_ROUTE_IMPACT) naming the SKU count and the remediation", !s.log.harmful.ok && s.log.harmful.state === "P0001" && /WP10_PRODUCT_ROUTE_IMPACT: moving product 1 to sub-group 3 would remove its valid production route while 2 active SKU\(s\) exist/.test(s.log.harmful.msg), s.log.harmful.msg);
    check("P1.2", "rejection rolls EVERYTHING back: the product row is unchanged, the live product_master_audit row is not written, the products epoch did not move", s.one("select sub_group_id from public.products where id=1") === "1" && s.one("select count(*) from public.product_master_audit") === "0" && s.one("select epoch from costing.readiness_portfolio_source_epoch where source_relation='public.products'") === s.one("select epoch from public.fx_snap_epoch"));
  }
  {
    const s = scenario(EDITOR + SUBGROUP_ROUTE + SUBGROUP_ACTIVE(1, 1) + "insert into costing.production_route_family_product_subgroup_map(product_subgroup_id, route_family_id, status, effective_from) values (2, 777, 'APPROVED', date '2026-01-01');\n"
      + T("rename_only", UPD(1, "P1 renamed", 1))
      + T("move_route_stays_valid", UPD(1, "P1 renamed", 2, "Active", "to sub-group 2 (mapped)"))
      + T("direct_move_route_stays_valid", "update public.products set sub_group_id = 1 where id = 1")
      + T("no_active_sku_move", UPD(3, "P3", 3, "Active", "no active sku on P3"))
      + T("direct_harmful", "update public.products set sub_group_id = 3 where id = 1"));
    check("P2.1", "NORMAL EDITS UNAFFECTED: rename without subgroup change, a subgroup move after which the route is STILL valid, and a move for a product with NO active SKU all succeed through the live writer", s.log.rename_only.ok && s.log.move_route_stays_valid.ok && s.log.direct_move_route_stays_valid.ok && s.log.no_active_sku_move.ok);
    check("P2.2", "the guard also applies to privileged DIRECT updates of sub_group_id (a trigger, not an RPC check)", !s.log.direct_harmful.ok && /WP10_PRODUCT_ROUTE_IMPACT/.test(s.log.direct_harmful.msg));
    check("P2.3", "an ALLOWED edit keeps the live audit semantics: product_master_audit records UPDATE events with old/new snapshots and the reason", s.one("select count(*) from public.product_master_audit where event_type = 'UPDATE' and reason like '%' and old_snapshot is not null and new_snapshot is not null") >= "2");
  }
  {
    const s = scenario(EDITOR + SUBGROUP_ACTIVE(1, 1) + "alter table public.product_skus disable trigger trg_sku_activation_completeness_guard;\nupdate public.product_skus set is_active = true where id = 1;\nalter table public.product_skus enable trigger trg_sku_activation_completeness_guard;\n"
      + T("route_already_invalid", UPD(1, "P1", 3, "Active", "route already missing")));
    check("P3.1", "when the route was ALREADY invalid before the edit, nothing is newly lost and the edit is allowed (the guard never blocks pre-existing drift)", s.log.route_already_invalid.ok);
  }
  // ================= R1: unresolved impact is REJECTED (distinct reason), never read as "no impact" =================
  // The validator is replaced by a branch-on-subgroup stand-in ONLY to force each evaluation outcome; the live chain is exercised separately (P6/P7).
  const VAL = (bySubgroup) => `create or replace function costing.fn_validate_effective_product_process_route(p_product_id integer, p_as_of_date date default current_date) returns jsonb language plpgsql as $$
    declare sg integer; begin select sub_group_id into sg from public.products where id = p_product_id;
    ${Object.entries(bySubgroup).map(([k, v]) => `if sg = ${k} then ${v}; end if;`).join(" ")} return jsonb_build_object('valid', true); end $$;\n`;
  const RAISE = "raise exception 'validator down'", INVALID = "return jsonb_build_object('valid', false)", MALFORMED = "return jsonb_build_object('errors', jsonb_build_array('x'))", VALID = "return jsonb_build_object('valid', true)";
  const R1CASE = (label, vals, move = 3) => {
    const s = scenario(EDITOR + OPEN(1, 1) + VAL(vals) + "create table public.fx_snap_epoch as select epoch from costing.readiness_portfolio_source_epoch where source_relation = 'public.products';\n" + T(label, UPD(1, "P1", move, "Active", "route change")));
    return { s, rejected: !s.log[label].ok, unresolved: /WP10_PRODUCT_ROUTE_IMPACT_UNRESOLVED/.test(s.log[label].msg || ""), rolledBack: s.one("select sub_group_id from public.products where id=1") === "1" && s.one("select count(*) from public.product_master_audit") === "0" };
  };
  {
    const c1 = R1CASE("after_error", { 3: RAISE });
    check("P4.1", "R1 AFTER-error (valid before, evaluation raises after): REJECTED with the distinct review-required reason WP10_PRODUCT_ROUTE_IMPACT_UNRESOLVED; product row and product_master_audit row rolled back", c1.rejected && c1.unresolved && c1.rolledBack, c1.s.log.after_error.msg);
    const c2 = R1CASE("before_error", { 1: RAISE, 3: INVALID });
    check("P4.2", "R1 BEFORE-error with invalid after: REJECTED as UNRESOLVED (cannot prove nothing was newly lost); fully rolled back", c2.rejected && c2.unresolved && c2.rolledBack, c2.s.log.before_error.msg);
    const c3 = R1CASE("before_error_after_valid", { 1: RAISE, 3: VALID });
    check("P4.3", "R1 BEFORE-error but the route is VALID after the move: allowed (nothing can be lost)", !c3.rejected);
    const c4 = R1CASE("malformed_after", { 3: MALFORMED });
    check("P4.4", "R1 MALFORMED result after the move (no boolean 'valid'): REJECTED as UNRESOLVED", c4.rejected && c4.unresolved && c4.rolledBack, c4.s.log.malformed_after.msg);
    const c5 = R1CASE("both_error", { 1: RAISE, 3: RAISE });
    check("P4.5", "R1 error before AND after: REJECTED as UNRESOLVED", c5.rejected && c5.unresolved && c5.rolledBack);
    const c6 = R1CASE("invalid_to_malformed", { 1: INVALID, 3: MALFORMED });
    check("P4.6", "R1 already-invalid before, malformed after: REJECTED as UNRESOLVED (unknown is never safe)", c6.rejected && c6.unresolved);
    const c7 = R1CASE("invalid_stays_invalid", { 1: INVALID, 3: INVALID });
    check("P4.7", "R1 preserved semantics: invalid -> invalid is NOT a new loss and stays allowed", !c7.rejected);
    const c8 = R1CASE("valid_stays_valid", { 1: VALID, 3: VALID });
    check("P4.8", "R1 preserved semantics: valid -> valid is allowed", !c8.rejected);
    const s9 = scenario(EDITOR + OPEN(1, 4) + VAL({ 3: INVALID }) + "alter table public.products disable trigger trg_wp10_product_route_impact_before;\n" + T("no_before_receipt", UPD(4, "P4", 3, "Active", "before trigger disabled")));
    check("P4.9", "R1 a missing BEFORE receipt (BEFORE trigger disabled) is UNKNOWN, never safe: the edit is rejected as UNRESOLVED", !s9.log.no_before_receipt.ok && /UNRESOLVED/.test(s9.log.no_before_receipt.msg || ""));
    const s10 = scenario(EDITOR + NEWSKU(3, 33) + VAL({ 1: RAISE, 3: RAISE }) + T("no_active_sku_error", UPD(3, "P3", 3, "Active", "no active SKU on P3")));
    check("P4.10", "R1 a product with NO active SKU is never blocked, even when route evaluation fails (ordinary edits unaffected)", s10.log.no_active_sku_error.ok);
    const s11 = scenario(EDITOR + OPEN(1, 1) + VAL({ 3: RAISE }) + T("rename_only_error", UPD(1, "P1 renamed", 1, "Active", "rename only")));
    check("P4.11", "R1 an edit that does not change sub_group_id is unaffected even when route evaluation would fail", s11.log.rename_only_error.ok);
  }
  // ================= R1/R2: the LIVE route chain (verbatim callees) as the evaluator =================
  {
    const s = scenario(EDITOR + SUBGROUP_ROUTE + SUBGROUP_ACTIVE(1, 1) + OPEN(2, 4) + AMBIG(4)
      + T("live_ambiguous_product_route", UPD(4, "P4", 3, "Active", "product route is ambiguous")));
    check("P6.1", "R1 with the LIVE chain: an AMBIGUOUS approved product route (overlap raises in the verbatim live resolver) makes the impact unresolved -> REJECTED, rolled back", !s.log.live_ambiguous_product_route.ok && /UNRESOLVED/.test(s.log.live_ambiguous_product_route.msg || "") && s.one("select sub_group_id from public.products where id=4") === "1");
  }
  // ================= concurrency: row lock serialises two subgroup edits; the second sees the first's committed state =================
  {
    const sc = scenario(EDITOR + SUBGROUP_ROUTE + SUBGROUP_ACTIVE(1, 1) + "insert into costing.production_route_family_product_subgroup_map(product_subgroup_id, route_family_id, status, effective_from) values (2, 777, 'APPROVED', date '2026-01-01');\n");
    const sock = sc.q("show unix_socket_directories"), port = sc.q("show port");
    const run = (sqlText) => new Promise((resolve) => { const c = spawn("psql", ["-X", "-q", "-h", sock, "-p", port, "-U", "postgres", "-d", sc.db, "-t", "-A", "-v", "ON_ERROR_STOP=0"], { stdio: ["pipe", "pipe", "pipe"] }); let out = "", err = ""; c.stdout.on("data", (d) => (out += d)); c.stderr.on("data", (d) => (err += d)); c.on("close", () => resolve({ out, err })); c.stdin.end(sqlText); });
    const pre = EDITOR;
    const A = run(pre + "begin;\nupdate public.products set sub_group_id = 2 where id = 1;\nselect pg_sleep(1.5);\ncommit;\n");
    await new Promise((r) => setTimeout(r, 500));
    const B = run(pre + "update public.products set sub_group_id = 3 where id = 1;\n");
    const [ra, rb] = await Promise.all([A, B]);
    check("P7.1", "CONCURRENCY: session B (moving to the unmapped sub-group) blocks on A's row lock, then evaluates against A's COMMITTED state (valid at sub-group 2) and is rejected for the harmful move; final state = A's", /WP10_PRODUCT_ROUTE_IMPACT: moving product 1 to sub-group 3/.test(rb.err) && sc.one("select sub_group_id from public.products where id=1") === "2", (rb.err || "").slice(0, 160));
    check("P7.2", "CONCURRENCY: the allowed session A committed normally (no error)", !/ERROR/.test(ra.err));
  }
  {
    const sql = g2FixtureSql();
    const sc = makeRunner(cluster, { sql: sql + "\n" + draft(DRAFTS.rollback) });
    const s = sc(EDITOR + SUBGROUP_ROUTE + SUBGROUP_ACTIVE(1, 1) + T("after_rollback", UPD(1, "P1", 3, "Active", "reclassify")));
    check("P5.1", "rollback restores G1 F14 behaviour (the harmful edit is accepted again); no WP10 trigger remains", s.log.after_rollback.ok && s.one("select count(*) from pg_trigger where tgname like '%wp10%'") === "0");
  }
  // ================= mutation controls =================
  {
    const probe = (sql) => {
      const sc = makeRunner(cluster, { sql });
      const s = sc(EDITOR + SUBGROUP_ROUTE + SUBGROUP_ACTIVE(1, 1) + OPEN(2, 4) + PRODUCT_LEVEL(3) + NEWSKU(5, 5) + PRODUCT_LEVEL(5)
        + "insert into costing.production_route_family_product_subgroup_map(product_subgroup_id, route_family_id, status, effective_from) values (2, 777, 'APPROVED', date '2026-01-01');\n"
        + "insert into public.sub_groups values (4, 2);\nupdate public.products set sub_group_id = 3 where id = 7;\n" + NEWSKU(7, 61) + "select public.fx_complete(4, 7, 'ROUTE');\nalter table public.product_skus disable trigger trg_sku_activation_completeness_guard;\nupdate public.product_skus set is_active = true where id = 4;\nalter table public.product_skus enable trigger trg_sku_activation_completeness_guard;\n"
        + NEWSKU(8, 88) + "select public.fx_complete(5, 8);\n" + ACTIVATE(5) + AMBIG(8)
        + T("active_reparent", "update public.product_skus set product_id = 3 where id = 2")
        + T("already_invalid", UPD(7, "P7", 4, "Active", "route already missing"))
        + T("inactive_reparent", "update public.product_skus set product_id = 6 where id = 3")
        + T("unknown_impact", UPD(8, "P8", 3, "Active", "route evaluation fails (ambiguous product route)"))
        + T("harmful", UPD(1, "P1", 3, "Active", "x"))
        + T("safe_move", UPD(4, "P4", 3, "Active", "no route lost for P4 (product-level map)"))
        + T("safe_stays_valid", "update public.products set sub_group_id = 2 where id = 1; update public.products set sub_group_id = 1 where id = 1"));
      const bad = [];
      if (s.log.active_reparent.ok) bad.push("active-reparent-accepted");
      if (!s.log.inactive_reparent.ok) bad.push("inactive-reparent-blocked");
      if (s.log.harmful.ok) bad.push("harmful-product-edit-accepted");
      if (!s.log.safe_move.ok || !s.log.safe_stays_valid.ok) bad.push("normal-subgroup-edit-blocked");
      if (!s.log.already_invalid.ok) bad.push("preexisting-drift-blocked");
      if (s.log.unknown_impact.ok) bad.push("unknown-impact-allowed");
      return bad;
    };
    const base = g2FixtureSql();
    const M = (file, from, to) => g2FixtureSql({ mutate: (n, t) => (n === file ? (t.includes(from) ? t.replace(from, to) : (() => { throw new Error("mutation target missing: " + from); })()) : t) });
    const clean = probe(base);
    check("M0", "invariant probe is clean on the unmodified proposals", clean.length === 0, clean.join());
    const mutants = {
      "re-parent trigger dropped": [M("reparent", "create trigger trg_wp10_active_sku_reparent_guard\n  before update of product_id on public.product_skus\n  for each row execute function public.fn_wp10_guard_active_sku_reparent();", ""), "active-reparent-accepted"],
      "re-parent guard rejects inactive SKUs too (over-broad)": [M("reparent", "if old.is_active is true and new.is_active is true and new.product_id", "if new.product_id"), "inactive-reparent-blocked"],
      "product route-impact AFTER trigger dropped": [M("route", "create trigger trg_wp10_product_route_impact_after\n  after update of sub_group_id on public.products\n  for each row execute function public.fn_wp10_product_route_impact_after();", ""), "harmful-product-edit-accepted"],
      "product guard blocks EVERY subgroup edit (blanket freeze)": [M("route", "if v_after = 'valid' or (v_before = 'invalid' and v_after = 'invalid') then return null; end if;", ""), "normal-subgroup-edit-blocked"],
      "'route already invalid' exemption removed (blocks pre-existing drift)": [M("route", "(v_before = 'invalid' and v_after = 'invalid')", "false"), "preexisting-drift-blocked"],
      "unknown impact treated as safe (R1 regression: fail-open)": [M("route", "  -- remaining combinations (after unknown; or before unknown with after invalid): the impact cannot be proven safe -> REVIEW REQUIRED\n", "  return null;\n"), "unknown-impact-allowed"],
    };
    let n = 0;
    for (const [name, [sql, expected]] of Object.entries(mutants)) {
      n++;
      let bad; try { bad = probe(sql); } catch (e) { check(`M${n}`, `MUTANT '${name}' is DETECTED`, false, String(e.message).slice(0, 120)); continue; }
      check(`M${n}`, `MUTANT '${name}' is DETECTED`, bad.includes(expected), `violations=${bad.join(",") || "none"}`);
    }
  }
} finally { cluster.stop(); }
console.log(failed() ? `\n${failed()} FAILED` : "\nALL PASSED");
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ synthetic: "isolated PostgreSQL fixture; live-verbatim guards/writers + UNAPPLIED proposal text", results }, null, 2) + "\n");
process.exit(failed() ? 1 : 0);
