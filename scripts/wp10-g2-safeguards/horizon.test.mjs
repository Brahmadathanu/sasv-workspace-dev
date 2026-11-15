// WP10 G2 — operational expiry horizon (UNAPPLIED proposal 01-03) in an isolated PostgreSQL fixture.
// LIVE-VERBATIM resolvers/helper from the G1 fixture; the proposal SQL is loaded exactly as drafted; only the clock function is replaced (documented).
// Run: node scripts/wp10-g2-safeguards/horizon.test.mjs [resultsJson]
import fs from "node:fs";
import { pgAvailable, startPg, g2FixtureSql, makeRunner, session, T, NEWSKU, ACTIVATE, HORIZON } from "./fixture.mjs";
import { makeResults } from "../wp10-g1-safeguard-audit/lib.mjs";

const { results, check, classify, failed } = makeResults();
if (!pgAvailable()) { classify("H0", "SKIPPED", "PostgreSQL unavailable — horizon fixtures SKIPPED (not PASS)"); if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ results }, null, 2) + "\n"); process.exit(2); }
const cluster = startPg();
const EDITOR = session();           // today IST = 2026-11-15
const VIEW_ONLY = (p) => session({ perms: p });
const call = (s, sql = HORIZON(), pre = EDITOR) => JSON.parse(s.one(sql, pre));
const rowOf = (env, sku) => env.rows.find((r) => r.sku_id === sku);
const ess = (row, code) => row?.essentials.find((e) => e.code === code);
// one operational SKU on product p, all five essentials open-ended from 2026-01-01, activated
const OPEN = (sku, product) => NEWSKU(product, 10 + sku) + `select public.fx_complete(${sku}, ${product});\n` + ACTIVATE(sku);

function run(mutateOrSql) { return makeRunner(cluster, { sql: mutateOrSql }); }

try {
  const scenario = makeRunner(cluster);
  // ===== H1 clean SKU; H15 date basis =====
  {
    const s = scenario(EDITOR + OPEN(1, 1));
    const env = call(s);
    check("H1.1", "a fully covered open-ended SKU is NOT flagged (no row, flagged_count 0, scanned 1)", env.rows.length === 0 && env.statistics.flagged_count === 0 && env.statistics.scanned_count === 1);
    check("H15.1", "the context names its date basis: CURRENT_IST_DATE = today's IST date (2026-11-15), explicitly NOT the governed valuation date (2026-09-10); governed semantics flagged unchanged", env.context.date_basis === "CURRENT_IST_DATE" && env.context.evaluated_from === "2026-11-15" && env.context.evaluated_through === "2026-12-15" && env.context.is_governed_period_valuation === false && env.context.governed_period_semantics_unchanged === true);
    check("H15.2", "the context states effective_to is INCLUSIVE, amounts are not evaluated and route boundary coverage is limited to captured tables", /INCLUSIVE/.test(env.context.effective_to_semantics) && env.context.amounts_evaluated === false && env.context.route_boundary_coverage === "CAPTURED_TABLES_ONLY");
  }
  // ===== H2/H3 lapse and inclusive boundary at the window edge =====
  {
    const s = scenario(EDITOR + OPEN(1, 1) + OPEN(2, 3) + OPEN(3, 4) + "update public.production_batch_size_ref set effective_to = date '2026-12-01' where product_id = 1;\nupdate public.production_batch_size_ref set effective_to = date '2026-12-14' where product_id = 3;\nupdate public.production_batch_size_ref set effective_to = date '2026-12-15' where product_id = 4;\n");
    const env = call(s);
    const e1 = ess(rowOf(env, 1), "BATCH_SIZE_REFERENCE"), e2 = ess(rowOf(env, 2), "BATCH_SIZE_REFERENCE");
    check("H2.1", "batch reference with effective_to = 2026-12-01 (inclusive): first uncovered day is 2026-12-02, classified LAPSES_IN_WINDOW, no recovery, owner screen named", e1 && e1.first_issue_date === "2026-12-02" && e1.issue_state === "MISSING" && e1.classification === "LAPSES_IN_WINDOW" && e1.recovers_on === null && /Batch Sizes/.test(e1.owner_screen) && e1.today_state === "RESOLVED", JSON.stringify(e1));
    check("H3.1", "effective_to = today+29 (2026-12-14): first uncovered day = today+30 = the LAST window day → flagged", e2 && e2.first_issue_date === "2026-12-15" && e2.classification === "LAPSES_IN_WINDOW");
    check("H3.2", "effective_to = today+30 (2026-12-15): still covers the last window day, first uncovered day 2026-12-16 is OUTSIDE the window → NOT flagged (inclusive effective_to semantics)", !rowOf(env, 3));
  }
  // ===== H4 replacement coverage / gap recovery / gap beyond window =====
  {
    const s = scenario(EDITOR + OPEN(1, 1) + OPEN(2, 3) + OPEN(3, 4)
      + "update costing.sku_mrp_policy set effective_to = date '2026-12-01' where sku_id = 1;\ninsert into costing.sku_mrp_policy(sku_id, status, effective_from) values (1, 'APPROVED', date '2026-12-02');\n"
      + "update costing.sku_mrp_policy set effective_to = date '2026-11-30' where sku_id = 2;\ninsert into costing.sku_mrp_policy(sku_id, status, effective_from) values (2, 'APPROVED', date '2026-12-05');\n"
      + "update costing.sku_mrp_policy set effective_to = date '2026-11-30' where sku_id = 3;\ninsert into costing.sku_mrp_policy(sku_id, status, effective_from) values (3, 'APPROVED', date '2027-02-01');\n");
    const env = call(s);
    check("H4.1", "contiguous replacement (A ends 12-01 inclusive, B starts 12-02): NO gap, NOT flagged", !rowOf(env, 1));
    const g = ess(rowOf(env, 2), "MRP_POLICY");
    check("H4.2", "a gap INSIDE the window that recovers before day 30 (A ends 11-30, B starts 12-05) is reported: first issue 12-01, recovers_on 12-05, GAP_RECOVERS_IN_WINDOW — a today-vs-end comparison would miss it", g && g.first_issue_date === "2026-12-01" && g.recovers_on === "2026-12-05" && g.classification === "GAP_RECOVERS_IN_WINDOW", JSON.stringify(g));
    const l = ess(rowOf(env, 3), "MRP_POLICY");
    check("H4.3", "a gap whose replacement starts AFTER the window is LAPSES_IN_WINDOW with no recovery", l && l.first_issue_date === "2026-12-01" && l.recovers_on === null && l.classification === "LAPSES_IN_WINDOW");
    check("H4.4", "evaluated dates include today and every in-window boundary (not just the endpoints)", rowOf(env, 2).evaluated_dates.join() === "2026-11-15,2026-12-01,2026-12-05");
  }
  // ===== H5/H6 overlap and ambiguous PM BOM =====
  {
    const s = scenario(EDITOR + OPEN(1, 1) + OPEN(2, 3)
      + "insert into costing.sku_mrp_policy(sku_id, status, effective_from) values (1, 'APPROVED', date '2026-12-03');\n"
      + "insert into public.plm_bom_revision(sku_id, status, effective_from) values (2, 'APPROVED', date '2026-12-03');\n");
    const env = call(s);
    const a = ess(rowOf(env, 1), "MRP_POLICY"), b = ess(rowOf(env, 2), "PM_BOM_REVISION");
    check("H5.1", "overlapping MRP policies from 12-03 → AMBIGUOUS_IN_WINDOW at 2026-12-03 (resolver says AMBIGUOUS; never RESOLVED)", a && a.classification === "AMBIGUOUS_IN_WINDOW" && a.first_issue_date === "2026-12-03" && a.issue_state === "AMBIGUOUS" && a.today_state === "RESOLVED");
    check("H6.1", "overlapping approved PM BOM revisions: the canonical function RAISES AMBIGUOUS_PM_BOM_REVISION — the horizon catches it per date and reports AMBIGUOUS_IN_WINDOW instead of failing the whole call", b && b.classification === "AMBIGUOUS_IN_WINDOW" && b.first_issue_date === "2026-12-03");
  }
  // ===== H7 today-missing states with future recovery =====
  {
    const s = scenario(EDITOR + OPEN(1, 1) + "update costing.sku_selling_price_policy set effective_to = date '2026-10-31' where sku_id = 1;\ninsert into costing.sku_selling_price_policy(sku_id, is_active, effective_from) values (1, true, date '2026-11-20');\n");
    const e = ess(rowOf(call(s), 1), "SELLING_PRICE_POLICY");
    check("H7.1", "a dependency already lapsed TODAY is reported TODAY_MISSING with its recovery date inside the window", e && e.classification === "TODAY_MISSING" && e.today_state === "MISSING" && e.first_issue_date === "2026-11-15" && e.recovers_on === "2026-11-20");
  }
  // ===== H8 fail-closed UNKNOWN =====
  {
    const s = scenario(EDITOR + OPEN(1, 1) + "create or replace function public.plm_sku_bom_revision_as_of(p_sku_id bigint, p_as_of date) returns public.plm_bom_revision language plpgsql as $$ begin raise exception 'boom'; end $$;\n");
    const e = ess(rowOf(call(s), 1), "PM_BOM_REVISION");
    check("H8.1", "an evaluation error is reported as UNKNOWN (fail-closed): the SKU is flagged, never omitted and never RESOLVED", e && e.classification === "UNKNOWN" && e.today_state === "UNKNOWN" && e.issue_state === "UNKNOWN");
  }
  // ===== H9 route lapse (captured route tables) =====
  {
    const s = scenario(EDITOR + OPEN(1, 1) + "update costing.production_route_family_route set effective_to = date '2026-12-10' where route_family_id = 901;\n");
    const e = ess(rowOf(call(s), 1), "MANUFACTURING_ROUTE");
    check("H9.1", "an approved family route that ends 12-10 → MANUFACTURING_ROUTE lapses from 12-11 (canonical family + route validation evaluated at that date)", e && e.first_issue_date === "2026-12-11" && e.classification === "LAPSES_IN_WINDOW");
  }
  // ===== H10 population exclusions =====
  {
    const s = scenario(EDITOR + NEWSKU(1) + "select public.fx_complete(1,1);\n" + NEWSKU(1, 99) + "select public.fx_complete(2,1);\n" + ACTIVATE(2) + "update public.product_skus set is_sample = true where id = 2;\n"
      + NEWSKU(3, 77) + "select public.fx_complete(3,3, 'BATCH');\n"
      + NEWSKU(8, 55) + "select public.fx_complete(4,8);\n" + ACTIVATE(4) + "alter table public.products disable trigger trg_product_inactivation_requires_no_active_skus;\nupdate public.products set status='Inactive' where id = 8;\n");
    const env = call(s);
    check("H10.1", "inactive SKU, sample SKU and a SKU whose product is Inactive are never evaluated (OPERATIONAL population); scanned = 0 operational SKUs", env.rows.length === 0 && env.statistics.scanned_count === 0, JSON.stringify(env.statistics));
  }
  // ===== H11/H12 read-only, no writer, fixed-period semantics unchanged =====
  {
    const s = scenario(EDITOR + OPEN(1, 1) + "select costing.fx_build_now('2026-09-01');\nupdate public.production_batch_size_ref set effective_to = date '2026-12-01' where product_id = 1;\nselect costing.fx_build_now('2026-09-01');\n");
    const snap = () => [s.one("select string_agg(source_relation||':'||epoch, ',' order by source_relation) from costing.readiness_portfolio_source_epoch"), s.one("select digest from costing.fn_wp04_readiness_source_fingerprint('2026-09-01')"), s.one("select count(*) from public.product_sku_change_log") + "/" + s.one("select count(*) from public.product_sku_master_audit") + "/" + s.one("select count(*) from costing.fx_build"), s.one("select costing.fx_read('2026-09-01')"), s.one("select (costing.fn_sku_activation_missing_items(1))->>'as_of_date'", EDITOR)];
    const before = snap();
    const out = s.one(`begin read only; ${HORIZON()}; commit;`, EDITOR);
    const after = snap();
    check("H11.1", "the horizon runs inside a READ ONLY transaction (it writes nothing) and is declared STABLE", /assessment_kind/.test(out) && s.one("select provolatile::text from pg_proc where proname='rpc_wp10_get_operational_expiry_horizon'") === "s");
    check("H12.1", "fixed-period semantics unchanged by the call: epochs, live fingerprint digest, change-log/audit/build counts, portfolio read (FRESH) and the activation helper's as-of date are identical before and after", JSON.stringify(before) === JSON.stringify(after) && before[3] === "FRESH", JSON.stringify(before));
    check("H12.2", "the activation helper still evaluates greatest(valuation, today IST)=2026-11-15 while the horizon names today IST — two separately labelled contracts, neither redefined", before[4] === "2026-11-15");
  }
  // ===== H13 permissions =====
  {
    const s = scenario(EDITOR + OPEN(1, 1));
    const t = (label, pre) => { try { s.q(HORIZON(), pre); return null; } catch (e) { return String(e.message); } };
    check("H13.1", "no permission → denied; unauthenticated → denied; manage-products VIEW and costing-control-center VIEW (existing targets, no new target) → allowed", /Permission denied/.test(t("none", VIEW_ONLY(""))) && /Not authenticated/.test(t("noauth", session({ uid: "" }))) && t("mp", VIEW_ONLY("module:manage-products:view")) === null && t("ccc", VIEW_ONLY("module:costing-control-center:view")) === null && /Permission denied/.test(t("other", VIEW_ONLY("module:vendor-master:view"))));
    check("H13.2", "the proposal grants EXECUTE to authenticated only (revoked from public/anon/service_role) and its helpers to nobody", /revoke all on function public\.rpc_wp10_get_operational_expiry_horizon\(integer, bigint, integer\) from public, anon, authenticated, service_role;\s*grant execute on function public\.rpc_wp10_get_operational_expiry_horizon\(integer, bigint, integer\) to authenticated;/.test(fs.readFileSync(new URL("../../supabase/draft-proposals/wp10-g2-unapplied/03_operational_expiry_horizon_rpc.sql", import.meta.url), "utf8")));
  }
  // ===== H14 budgets and paging =====
  {
    let body = EDITOR + "insert into public.products(item, sub_group_id, status) select 'B' || g, 1, 'Active' from generate_series(1, 230) g;\n";
    body += "insert into public.product_skus(product_id, pack_size, uom, is_active) select id, 5, 'g', false from public.products where item like 'B%';\n";
    body += "insert into costing.production_route_family(id, status, effective_from) values (5000, 'APPROVED', date '2026-01-01');\ninsert into costing.production_route_family_product_subgroup_map(product_subgroup_id, route_family_id, status, effective_from) values (1, 5000, 'APPROVED', date '2026-01-01');\ninsert into costing.production_route_family_route(route_family_id, status, effective_from) values (5000, 'APPROVED', date '2026-01-01');\n";
    body += "insert into public.plm_bom_revision(sku_id, status, effective_from) select id, 'APPROVED', date '2026-01-01' from public.product_skus;\n";
    body += "insert into public.production_batch_size_ref(product_id, effective_from) select product_id, date '2026-01-01' from public.product_skus where id % 50 <> 0;\n";
    body += "insert into costing.sku_mrp_policy(sku_id, status, effective_from) select id, 'APPROVED', date '2026-01-01' from public.product_skus;\ninsert into costing.sku_selling_price_policy(sku_id, is_active, effective_from) select id, true, date '2026-01-01' from public.product_skus;\n";
    // fixture-only bulk activation (the budget test needs 230 operational rows; activation semantics are covered elsewhere)
    body += "alter table public.product_skus disable trigger trg_sku_activation_completeness_guard;\nupdate public.product_skus set is_active = true;\nalter table public.product_skus enable trigger trg_sku_activation_completeness_guard;\n";
    const s = scenario(body);
    const p1 = call(s, HORIZON(30, "null", 100));
    check("H14.1", "scan budget: one call scans at most 200 SKUs, reports budget_exhausted and a resumable cursor", p1.statistics.scanned_count === 200 && p1.statistics.budget_exhausted === true && p1.has_more === true && p1.next_after_sku_id === 200 && p1.rows.map((r) => r.sku_id).join() === "50,100,150,200", JSON.stringify(p1.statistics));
    const seen = new Set(p1.rows.map((r) => r.sku_id)); let cursor = p1.next_after_sku_id, pages = 1, dup = false, more = p1.has_more, scannedTotal = p1.statistics.scanned_count;
    while (more && pages < 10) { const p = call(s, HORIZON(30, String(cursor), 100)); p.rows.forEach((r) => { if (seen.has(r.sku_id)) dup = true; seen.add(r.sku_id); }); scannedTotal += p.statistics.scanned_count; cursor = p.next_after_sku_id; more = p.has_more; pages++; }
    check("H14.2", "keyset paging covers all 230 SKUs exactly once (no duplicate, no gap, terminates) and finds exactly the 4 flagged SKUs", scannedTotal === 230 && !dup && !more && pages === 2 && [...seen].sort((a, b) => a - b).join() === "50,100,150,200", `scanned=${scannedTotal} pages=${pages} seen=${[...seen]}`);
    const l2 = call(s, HORIZON(30, "null", 2));
    check("H14.3", "the flagged-row limit stops early with a resumable cursor: limit 2 → 2 rows, has_more, cursor = the last scanned SKU (the 2nd flagged)", l2.rows.length === 2 && l2.has_more && l2.next_after_sku_id === l2.rows[1].sku_id && l2.statistics.scanned_count === 100);
    const clamp = call(s, HORIZON(999, "null", 1000)), low = call(s, HORIZON(0, "null", 0));
    check("H14.4", "budgets clamp: limit ≤ 100, horizon 1..90 days", clamp.statistics.limit === 100 && clamp.context.horizon_days === 90 && low.statistics.limit === 1 && low.context.horizon_days === 1);
  }
  // ===== H16 mutation controls =====
  {
    const probe = (sql) => {
      const sc = run(sql);
      const s = sc(EDITOR + OPEN(1, 1) + OPEN(2, 3) + OPEN(3, 4)
        + "update public.production_batch_size_ref set effective_to = date '2026-12-01' where product_id = 1;\n"
        + "update costing.sku_mrp_policy set effective_to = date '2026-11-30' where sku_id = 2;\ninsert into costing.sku_mrp_policy(sku_id, status, effective_from) values (2, 'APPROVED', date '2026-12-05');\n"
        + "insert into public.plm_bom_revision(sku_id, status, effective_from) values (3, 'APPROVED', date '2026-12-03');\n");
      const bad = [];
      try {
        const env = call(s);
        const a = ess(rowOf(env, 1), "BATCH_SIZE_REFERENCE"), g = ess(rowOf(env, 2), "MRP_POLICY"), m = ess(rowOf(env, 3), "PM_BOM_REVISION");
        if (!(a && a.first_issue_date === "2026-12-02")) bad.push("inclusive-boundary");
        if (!(g && g.recovers_on === "2026-12-05" && g.classification === "GAP_RECOVERS_IN_WINDOW")) bad.push("mid-window-gap-recovery");
        if (!(m && m.classification === "AMBIGUOUS_IN_WINDOW")) bad.push("ambiguity");
      } catch { bad.push("call-failed"); }
      try { s.q(HORIZON(), VIEW_ONLY("")); bad.push("permission-bypassed"); } catch { /* denied as required */ }
      const s2 = sc(EDITOR + NEWSKU(1) + "select public.fx_complete(1,1);\n" + ACTIVATE(1) + "update public.product_skus set is_sample = true where id = 1;\nupdate public.production_batch_size_ref set effective_to = date '2026-11-01' where product_id = 1;\n");
      try { if (call(s2).rows.length !== 0) bad.push("sample-included"); } catch { bad.push("call-failed-2"); }
      return bad;
    };
    const baseSql = g2FixtureSql();
    check("H16.0", "invariant probe is clean on the unmodified proposal", probe(baseSql).length === 0, probe(baseSql).join());
    const M = (file, from, to) => g2FixtureSql({ mutate: (n, t) => (n === file ? (t.includes(from) ? t.replace(from, to) : (() => { throw new Error("mutation target missing: " + from); })()) : t) });
    const mutants = {
      "effective_to boundary off by one (d_to instead of d_to + 1)": [M("states", "union select d_to + 1 from edges", "union select d_to from edges"), "inclusive-boundary"],
      "effective_from boundaries dropped (gap recovery invisible)": [M("states", "select d_from as d from edges where d_from is not null\n    union ", "select d_to + 1 as d from edges where false\n    union "), "mid-window-gap-recovery"],
      "only today and window end compared (no boundary scan)": [M("horizon", "v_dates := array[v_today] || costing.fn_wp10_boundary_dates(rec.sku_id, rec.product_id, v_today, v_end);", "v_dates := array[v_today, v_end];"), "mid-window-gap-recovery"],
      "ambiguity mapped to UNKNOWN": [M("states", "s := case when sqlerrm like 'AMBIGUOUS_PM_BOM_REVISION%' then 'AMBIGUOUS' else 'UNKNOWN' end;", "s := 'UNKNOWN';"), "ambiguity"],
      "permission check removed": [M("horizon", "if not (public.app_has_permission('module:manage-products', 'view') or public.app_has_permission('module:costing-control-center', 'view')) then\n    raise exception 'Permission denied';\n  end if;", ""), "permission-bypassed"],
      "sample/inactive exclusions removed": [M("horizon", "where s.is_active and p.status = 'Active' and not coalesce(s.is_sample, false)\n      and (p_after_sku_id is null or s.id > p_after_sku_id)", "where (p_after_sku_id is null or s.id > p_after_sku_id)"), "sample-included"],
    };
    let n = 0;
    for (const [name, [sql, expected]] of Object.entries(mutants)) {
      n++;
      let bad;
      try { bad = probe(sql); } catch (e) { check(`H16.${n}`, `MUTANT '${name}' is DETECTED`, false, String(e.message).slice(0, 120)); continue; }
      check(`H16.${n}`, `MUTANT '${name}' is DETECTED`, bad.includes(expected) || (expected === "inclusive-boundary" && bad.length > 0), `violations=${bad.join(",") || "none"}`);
    }
  }
} finally { cluster.stop(); }
console.log(failed() ? `\n${failed()} FAILED` : "\nALL PASSED");
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ synthetic: "isolated PostgreSQL fixture; live-verbatim guards/resolvers + UNAPPLIED proposal text; clock function replaced", results }, null, 2) + "\n");
process.exit(failed() ? 1 : 0);
