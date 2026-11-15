// WP10 G2 — read-only counterfactual subgroup-impact PREVIEW (UNAPPLIED proposal 06) in an isolated PostgreSQL fixture.
// Live-verbatim route chain (independent catalogs) + the proposal text exactly as generated. Nothing here touches Supabase.
// Run: node scripts/wp10-g2-safeguards/preview.test.mjs [resultsJson]
import fs from "node:fs";
import { pgAvailable, startPg, g2FixtureSql, makeRunner, session, T, NEWSKU } from "./fixture.mjs";
import { makeResults } from "../wp10-g1-safeguard-audit/lib.mjs";

const { results, check, classify, failed } = makeResults();
if (!pgAvailable()) { classify("W0", "SKIPPED", "PostgreSQL unavailable — preview fixtures SKIPPED (not PASS)"); if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ results }, null, 2) + "\n"); process.exit(2); }
const cluster = startPg();
const VIEW = session({ perms: "module:manage-products:view" });
const NOVIEW_ = session({ perms: "module:costing-control-center:view" });
const NOUID = "select set_config('fixture.uid','',false), set_config('fixture.perms','module:manage-products:view',false), set_config('fixture.now','2026-11-15 10:00:00+05:30',false);\n";
const PREVIEW = (p, sg) => `select public.rpc_wp10_preview_product_subgroup_impact(${p}, ${sg})`;
const call = (s, p, sg, pre = VIEW) => JSON.parse(s.one(PREVIEW(p, sg), pre));

// ---- data builders (all dates 2026; "today" = 2026-11-15 IST) ----
const d = (x) => (x ? `date '${x}'` : "null");
const FAM = (id, from = "2026-01-01", to = null) => `insert into costing.production_route_family(id, status, effective_from, effective_to) values (${id}, 'APPROVED', ${d(from)}, ${d(to)});\n`;
const FR = (fam, from = "2026-01-01", to = null, status = "APPROVED") => `insert into costing.production_route_family_route(route_family_id, status, effective_from, effective_to) values (${fam}, '${status}', ${d(from)}, ${d(to)});\n`;
const FAMR = (id) => FAM(id) + FR(id);
const MAPP = (p, fam, from = "2026-01-01", to = null) => `insert into costing.production_route_family_product_map(product_id, route_family_id, status, effective_from, effective_to) values (${p}, ${fam}, 'APPROVED', ${d(from)}, ${d(to)});\n`;
const MAPS = (sg, fam, from = "2026-01-01", to = null) => `insert into costing.production_route_family_product_subgroup_map(product_subgroup_id, route_family_id, status, effective_from, effective_to) values (${sg}, ${fam}, 'APPROVED', ${d(from)}, ${d(to)});\n`;
const MAPG = (g, fam, from = "2026-01-01", to = null) => `insert into costing.production_route_family_product_group_map(product_group_id, route_family_id, status, effective_from, effective_to) values (${g}, ${fam}, 'APPROVED', ${d(from)}, ${d(to)});\n`;
const BATCH = (p) => `insert into public.production_batch_size_ref(product_id, effective_from) values (${p}, date '2026-01-01');\n`;
const FRID = (fam) => `(select id from costing.production_route_family_route where route_family_id = ${fam} order by id limit 1)`;
const PROUTE = (p, fam, from, to = null) => `select public.fx_product_route(${p}, ${d(from)}, ${d(to)}, ${FRID(fam)});\n`;
const ACTIVE_SKU = (p, n = 1) => Array.from({ length: n }, (_, i) => NEWSKU(p, 70 + i)).join("") + "alter table public.product_skus disable trigger trg_sku_activation_completeness_guard;\nupdate public.product_skus set is_active = true where product_id = " + p + ";\nalter table public.product_skus enable trigger trg_sku_activation_completeness_guard;\n";
const SG4 = "insert into public.sub_groups values (4, 3);\n"; // a third group
// base world: product 1 (sg1) routes via sub-group map; sub-group 3 is in group 2 which has a GROUP map
const WORLD = SG4 + FAMR(11) + MAPS(1, 11) + FAMR(12) + MAPG(2, 12);
const stateOf = (r, k) => r[k].state;

try {
  const scenario = makeRunner(cluster);

  // ===== W1 stored-context parity with the live canonical logic (synthetic rows) =====
  {
    const world = WORLD + FAMR(13) + MAPP(3, 13) + FAMR(14) + MAPS(2, 14, "2026-01-01", "2026-11-14") + "update public.products set sub_group_id = 3 where id = 2;\nupdate public.products set sub_group_id = 2 where id = 3;\nupdate public.products set sub_group_id = 4 where id = 5;\n"
      + FAMR(21) + MAPP(6, 21) + BATCH(6) + PROUTE(6, 21, "2026-03-01", "2026-12-20") + "update public.products set sub_group_id = 2 where id = 4;\n" + FAMR(15) + MAPG(1, 15, "2026-01-01", "2026-06-30");
    const s = scenario(VIEW + world);
    const dates = ["2025-12-31", "2026-01-01", "2026-03-01", "2026-06-30", "2026-07-01", "2026-11-14", "2026-11-15", "2026-12-20", "2026-12-21"];
    const probes = [];
    for (const p of [1, 2, 3, 4, 5, 6, 7, 8]) for (const dt of dates) probes.push(`select (${p} || '@${dt}'), (costing.fn_wp10_validate_effective_product_process_route_ctx(${p}, date '${dt}', (select sub_group_id from public.products where id = ${p})) = costing.fn_validate_effective_product_process_route(${p}, date '${dt}')) and (costing.fn_wp10_resolve_route_family_ctx(${p}, date '${dt}', (select sub_group_id from public.products where id = ${p})) is not distinct from costing.fn_resolve_route_family_for_product(${p}, date '${dt}')) and (costing.fn_wp10_resolve_effective_route_family_route_ctx(${p}, date '${dt}', (select sub_group_id from public.products where id = ${p})) is not distinct from costing.fn_resolve_effective_route_family_route(${p}, date '${dt}'))`);
    const out = s.q(probes.join(";\n"), VIEW).split("\n").filter((l) => /@20\d\d-\d\d-\d\d\|/.test(l));
    const bad = out.filter((l) => !l.endsWith("|t"));
    check("W1.1", `stored-context parity: family resolver, family-route resolver and the full effective validator equal the LIVE canonical functions on ${out.length} product/date probes (8 products x 9 dates incl. window edges, product map, sub-group map, group map, product route, ended/superseded windows)`, out.length === 72 && bad.length === 0, bad.slice(0, 3).join(" ; "));
  }

  // ===== W2 proposed sub-group in a DIFFERENT product group =====
  {
    const s = scenario(VIEW + WORLD + BATCH(1));
    const r = call(s, 1, 3);
    check("W2.1", "proposed sub-group 3 lives in product group 2: the proposed family is the GROUP-2 family (12) while the stored sub-group-1 family is 11 - the group comes from the PROPOSED sub-group", r.before.family_id === 11 && r.proposed.family_id === 12 && stateOf(r, "before") === "VALID" && stateOf(r, "proposed") === "VALID" && r.impact_class === "VALID_TO_VALID" && r.stored_sub_group_id === 1 && r.proposed_sub_group_id === 3, JSON.stringify([r.before.family_id, r.proposed.family_id]));
    check("W2.2", "closed response contract: assessment kind, non-authoritative flag, IST evaluation date, no rejection when both routes are valid, digest present", r.assessment_kind === "PRODUCT_SUBGROUP_ROUTE_IMPACT" && r.authoritative_for_save === false && r.evaluated_on === "2026-11-15" && r.date_basis === "CURRENT_IST_DATE" && r.review_required === false && /^[0-9a-f]{32}$/.test(r.context_digest) && r.sub_group_changed === true);
  }

  // ===== W3 product-map precedence is independent of the sub-group =====
  {
    const s = scenario(VIEW + WORLD + FAMR(13) + MAPP(3, 13));
    const a = call(s, 3, 1), b = call(s, 3, 3), c = call(s, 3, 4);
    check("W3.1", "a product-level map wins for the stored AND every proposed sub-group (family 13 in all contexts), whatever sub-group or group is proposed", [a, b, c].every((r) => r.before.family_id === 13 && r.proposed.family_id === 13) && b.impact_class === "VALID_TO_VALID");
  }

  // ===== W4 sub-group map beats group map; falls back to group map =====
  {
    const s = scenario(VIEW + WORLD + FAMR(15) + MAPG(1, 15) + BATCH(1));
    const r = call(s, 1, 2);        // stored sg1 has a sub-group map (11) AND group1 has a group map (15); proposed sg2 (group 1) has only the group map
    check("W4.1", "stored sub-group 1: sub-group map (11) beats group map (15); proposed sub-group 2 has no sub-group map so the GROUP map (15) applies", r.before.family_id === 11 && r.proposed.family_id === 15);
    const r2 = call(s, 1, 1);
    check("W4.2", "proposing the SAME sub-group reports NO_SUBGROUP_CHANGE and identical before/proposed", r2.impact_class === "NO_SUBGROUP_CHANGE" && r2.sub_group_changed === false && JSON.stringify(r2.before) === JSON.stringify(r2.proposed));
  }

  // ===== W5 inclusive windows, superseded selection, missing mapping/route =====
  {
    const s = scenario(VIEW + WORLD + FAMR(31) + MAPS(2, 31, "2026-01-01", "2026-11-15") + FAMR(32) + MAPS(4, 32, "2026-01-01", "2026-11-14") + FAM(33) + MAPS(5 === 5 ? 4 : 4, 33, "2026-11-15") + "insert into public.sub_groups values (5, 1);\n" + FAM(34) + MAPS(5, 34) + FR(34, "2026-01-01", null, "SUPERSEDED"));
    const incl = call(s, 1, 2);
    check("W5.1", "an effective_to equal to TODAY (2026-11-15) is INCLUSIVE: the proposed sub-group-2 map still applies today (family 31, VALID)", incl.proposed.family_id === 31 && stateOf(incl, "proposed") === "VALID");
    const ended = call(s, 1, 4);
    check("W5.2", "an effective_to of yesterday has ended: sub-group 4 resolves via the later same-day map (33 has no route) - NO_APPROVED_ROUTE_FAMILY_ROUTE, INVALID, ROUTE_LOSS", stateOf(ended, "proposed") === "INVALID" && ended.proposed.reasons.includes("NO_APPROVED_ROUTE_FAMILY_ROUTE") && ended.impact_class === "ROUTE_LOSS");
    const sup = call(s, 1, 5);
    check("W5.3", "a SUPERSEDED family route is selected as the live resolver selects it (status APPROVED or SUPERSEDED): proposed VALID via ROUTE_FAMILY_INHERITED", stateOf(sup, "proposed") === "VALID" && sup.proposed.route_source === "ROUTE_FAMILY_INHERITED" && sup.proposed.family_id === 34);
    const none = call(scenario(VIEW + SG4 + FAMR(11) + MAPS(1, 11)), 1, 4);
    check("W5.4", "no mapping at all for the proposed sub-group: INVALID with NO_APPROVED_ROUTE_FAMILY_MAPPING and ROUTE_LOSS (not zero impact)", stateOf(none, "proposed") === "INVALID" && none.proposed.reasons.includes("NO_APPROVED_ROUTE_FAMILY_MAPPING") && none.proposed.family_id === null && none.impact_class === "ROUTE_LOSS");
  }

  // ===== W6 product routes: overlap -> UNKNOWN; nested lookup at the route's own date; overrides; inherited =====
  {
    const amb = scenario(VIEW + WORLD + BATCH(1) + PROUTE(1, 11, "2026-01-01") + PROUTE(1, 11, "2026-02-01") + ACTIVE_SKU(1));
    const r = call(amb, 1, 3);
    check("W6.1", "overlapping approved product routes: the canonical ambiguity raise is UNKNOWN with the coded reason (never VALID, never raw text), impact UNKNOWN, review required", stateOf(r, "proposed") === "UNKNOWN" && r.proposed.reasons.join() === "AMBIGUOUS_APPROVED_PRODUCT_ROUTE" && r.impact_class === "UNKNOWN" && r.review_required === true && r.active_sku_count === 1);

    // nested lookup: FA mapped to sg1 from 2026-01-01; FB mapped to sg2 only from 2026-06-01. Product route PR eff 2026-01-01 is based on FA.
    const nested = FAMR(41) + MAPS(1, 41) + FAMR(42) + MAPS(2, 42, "2026-06-01") + BATCH(1);
    const s1 = scenario(VIEW + SG4 + nested + PROUTE(1, 41, "2026-01-01"));
    const lost = call(s1, 1, 2);
    check("W6.2", "NESTED lookup at the route's OWN effective-from date: today the proposed family is 42, but the product route (effective 2026-01-01, base family 41) re-resolves its family at 2026-01-01 under the PROPOSED sub-group (no map yet) -> INVALID (NO_APPROVED_ROUTE_FAMILY_ASSIGNMENT); an outer-only change would call it VALID", lost.proposed.family_id === 42 && stateOf(lost, "before") === "VALID" && stateOf(lost, "proposed") === "INVALID" && lost.proposed.reasons.includes("NO_APPROVED_ROUTE_FAMILY_ASSIGNMENT") && lost.impact_class === "ROUTE_LOSS", JSON.stringify(lost.proposed));
    const s2 = scenario(VIEW + SG4 + nested + PROUTE(1, 42, "2026-07-01"));
    const gain = call(s2, 1, 2);
    check("W6.3", "converse: a product route (effective 2026-07-01) based on family 42 is INVALID under the stored sub-group (nested lookup resolves 41: ROUTE_FAMILY_ASSIGNMENT_MISMATCH) and VALID under the proposed one -> INVALID_TO_VALID", stateOf(gain, "before") === "INVALID" && gain.before.reasons.includes("ROUTE_FAMILY_ASSIGNMENT_MISMATCH") && stateOf(gain, "proposed") === "VALID" && gain.proposed.route_source === "PRODUCT_ROUTE" && gain.impact_class === "INVALID_TO_VALID", JSON.stringify([gain.before, gain.proposed]));
    // overrides + inherited
    const ov = scenario(VIEW + WORLD + BATCH(1) + PROUTE(1, 11, "2026-01-01") + `insert into costing.product_process_route_override(product_route_id, base_step_id, operation_type) select (select max(id) from costing.product_process_route where product_id = 1), s.id, 'BYPASS_STEP' from costing.production_route_family_route_step s where s.family_route_id = ${FRID(11)} and s.route_step_scope = 'PRODUCTION_PROCESS';\n`);
    const o = call(ov, 1, 1);
    check("W6.4", "a product route whose override bypasses the only production step is INVALID (REQUIRES_PRODUCTION_PROCESS_STEP) under the stored context - overrides/steps are evaluated by the canonical callees", stateOf(o, "before") === "INVALID" && o.before.reasons.includes("REQUIRES_PRODUCTION_PROCESS_STEP") && o.before.route_source === "PRODUCT_ROUTE" && o.before.product_route_id !== null);
    const inh = call(scenario(VIEW + WORLD + BATCH(1)), 1, 3);
    check("W6.5", "an inherited family route (no product route) is reported with route_source ROUTE_FAMILY_INHERITED and null product_route_id on both sides", inh.before.route_source === "ROUTE_FAMILY_INHERITED" && inh.proposed.route_source === "ROUTE_FAMILY_INHERITED" && inh.before.product_route_id === null);
  }

  // ===== W7 UNKNOWN: error / malformed =====
  {
    const base = VIEW + WORLD + ACTIVE_SKU(1);
    const err = call(scenario(base + "create or replace function costing.fn_validate_route_family_route(p_family_route_id bigint) returns jsonb language plpgsql as $$ begin raise exception 'boom <script>'; end $$;\n"), 1, 3);
    check("W7.1", "an evaluation EXCEPTION is UNKNOWN (EVALUATION_ERROR), review required, and raw exception text is never returned", stateOf(err, "proposed") === "UNKNOWN" && err.proposed.reasons.join() === "EVALUATION_ERROR" && err.review_required === true && !/boom|script/.test(JSON.stringify(err)));
    const mal = call(scenario(base + "create or replace function costing.fn_validate_route_family_route(p_family_route_id bigint) returns jsonb language sql as $$ select '{}'::jsonb $$;\n"), 1, 3);
    check("W7.2", "a MALFORMED validator result (no boolean 'valid') is UNKNOWN (MALFORMED_RESULT), never VALID", stateOf(mal, "proposed") === "UNKNOWN" && mal.proposed.reasons.join() === "MALFORMED_RESULT");
    const hostile = call(scenario(base + "create or replace function costing.fn_validate_route_family_route(p_family_route_id bigint) returns jsonb language sql as $$ select jsonb_build_object('valid', false, 'errors', jsonb_build_array('<img src=x>', 'lower_case', 'GOOD_CODE', repeat('A', 80))) $$;\n"), 1, 3);
    check("W7.3", "reason codes are bounded and sanitised server-side: only ^[A-Z][A-Z0-9_]{0,63}$ survives (hostile/lowercase/oversized entries are dropped)", hostile.proposed.reasons.join() === "GOOD_CODE" && stateOf(hostile, "proposed") === "INVALID");
    const unspec = call(scenario(base + "create or replace function costing.fn_validate_route_family_route(p_family_route_id bigint) returns jsonb language sql as $$ select jsonb_build_object('valid', false) $$;\n"), 1, 3);
    check("W7.4", "INVALID without any usable reason gets the explicit UNSPECIFIED_REASON (never an empty explanation)", unspec.proposed.reasons.join() === "UNSPECIFIED_REASON");
  }

  // ===== W8 classification table and active-child counts =====
  {
    const lossNoKids = call(scenario(VIEW + SG4 + FAMR(11) + MAPS(1, 11)), 1, 4);
    check("W8.1", "ROUTE_LOSS with NO active children states the observed count 0 and does not demand review (the count is data, not a guarantee)", lossNoKids.impact_class === "ROUTE_LOSS" && lossNoKids.active_sku_count === 0 && lossNoKids.review_required === false);
    const lossKids = call(scenario(VIEW + SG4 + FAMR(11) + MAPS(1, 11) + ACTIVE_SKU(1, 2)), 1, 4);
    check("W8.2", "ROUTE_LOSS with 2 active children: count 2 and review required", lossKids.active_sku_count === 2 && lossKids.review_required === true);
    const inv = call(scenario(VIEW + SG4 + "insert into public.sub_groups values (6, 2);\n" + FAMR(11) + MAPS(1, 11) + ACTIVE_SKU(2) + "update public.products set sub_group_id = 4 where id = 2;\n"), 2, 6);
    check("W8.3", "INVALID -> INVALID keeps both reason sets visible and is not described as ready or as new loss", inv.impact_class === "INVALID_TO_INVALID" && inv.before.reasons.length >= 1 && inv.proposed.reasons.length >= 1 && inv.review_required === false);
    const a = call(scenario(VIEW + WORLD + BATCH(1)), 1, 3), b = call(scenario(VIEW + WORLD + BATCH(1)), 1, 3);
    check("W8.4", "deterministic: identical snapshots give identical digests (the digest is a staleness aid, never an authorisation)", a.context_digest === b.context_digest);
  }

  // ===== W9 identity, permission, input errors =====
  {
    const s = scenario(VIEW + WORLD);
    const q = (pre, sql) => { try { s.q(sql, pre); return null; } catch (e) { return String(e.message); } };
    check("W9.1", "no signed-in identity -> 'Not authenticated'", /Not authenticated/.test(q(NOUID, PREVIEW(1, 3)) || ""));
    check("W9.2", "a caller without the existing Manage Products View permission (even with Costing Control Center view) -> 'Permission denied'", /Permission denied/.test(q(NOVIEW_, PREVIEW(1, 3)) || ""));
    check("W9.3", "missing product is an INPUT ERROR (P0002 WP10_PREVIEW_INPUT), not a zero-impact answer", /WP10_PREVIEW_INPUT: product 999 does not exist/.test(q(VIEW, PREVIEW(999, 3)) || ""));
    check("W9.4", "missing proposed sub-group is an INPUT ERROR, not a zero-impact answer", /WP10_PREVIEW_INPUT: sub-group 999 does not exist/.test(q(VIEW, PREVIEW(1, 999)) || ""));
    check("W9.5", "null inputs are rejected (22023)", /WP10_PREVIEW_INPUT: a product and a proposed sub-group are required/.test(q(VIEW, "select public.rpc_wp10_preview_product_subgroup_impact(null, 3)") || ""));
    check("W9.6", "the helpers are not executable by authenticated/anon (catalog ACL), only the preview RPC is granted to authenticated", s.one("select string_agg(p.proname || ':' || has_function_privilege('authenticated', p.oid, 'execute')::text, ',' order by p.proname) from pg_proc p where p.proname like 'fn_wp10_%_ctx'", VIEW) === "fn_wp10_resolve_effective_route_family_route_ctx:false,fn_wp10_resolve_route_family_ctx:false,fn_wp10_route_state_ctx:false,fn_wp10_validate_effective_product_process_route_ctx:false,fn_wp10_validate_product_process_route_ctx:false" && s.one("select has_function_privilege('authenticated', 'public.rpc_wp10_preview_product_subgroup_impact(integer,integer)', 'execute')::text || ':' || has_function_privilege('anon', 'public.rpc_wp10_preview_product_subgroup_impact(integer,integer)', 'execute')::text", VIEW) === "true:false");
  }

  // ===== W10 read-only: READ ONLY transaction succeeds; business, audit and epoch fingerprints unchanged by repeated previews =====
  {
    const s = scenario(VIEW + WORLD + BATCH(1) + ACTIVE_SKU(1));
    const FP = "select md5(concat_ws('|', (select coalesce(string_agg(t::text, ',' order by id), '') from public.products t), (select coalesce(string_agg(t::text, ',' order by id), '') from public.product_skus t), (select count(*) from public.product_master_audit), (select count(*) from public.product_sku_master_audit), (select coalesce(string_agg(epoch::text || source_relation, ',' order by source_relation), '') from costing.readiness_portfolio_source_epoch), (select count(*) from costing.production_route_family_route), (select count(*) from costing.product_process_route)))";
    const before = s.one(FP, VIEW);
    let ok = true;
    try { s.q("begin read only;\n" + PREVIEW(1, 3) + ";\n" + PREVIEW(1, 2) + ";\n" + PREVIEW(1, 4) + ";\ncommit", VIEW); } catch { ok = false; }
    check("W10.1", "the preview runs inside a READ ONLY transaction (it contains no write of any kind)", ok);
    for (let i = 0; i < 3; i++) s.q(PREVIEW(1, 3) + ";\n" + PREVIEW(1, 4), VIEW);
    check("W10.2", "repeated previews leave products, SKUs, product/SKU audit rows, the readiness source epochs and the route tables byte-identical (fingerprint unchanged)", s.one(FP, VIEW) === before);
    const prov = s.one("select provolatile::text || ':' || prosecdef::text from pg_proc where proname = 'rpc_wp10_preview_product_subgroup_impact'", VIEW);
    check("W10.3", "the endpoint is STABLE (one statement snapshot) and SECURITY DEFINER; the proposal contains no UPDATE/INSERT/DELETE/set_config/build/refresh call", prov === "s:true" && !/\b(insert\s+into|update\s+\w+\s+set|delete\s+from|set_config|fn_wp04_build|refresh)/i.test(fs.readFileSync(new URL("../../docs/master-data-costing/WP10_G2_UNAPPLIED_SQL_PROPOSALS/06_subgroup_impact_preview.sql", import.meta.url), "utf8").replace(/--.*$/gm, "").replace(/\$wp10_receipt\$[\s\S]*?\$wp10_receipt\$/, "")));
  }

  // ===== W11 mutation controls =====
  {
    const probe = (sql) => {
      const sc = makeRunner(cluster, { sql });
      const nested = FAMR(41) + MAPS(1, 41) + FAMR(42) + MAPS(2, 42, "2026-06-01");
      const s = sc(VIEW + SG4 + WORLD + FAMR(13) + MAPP(3, 13) + FAMR(15) + MAPG(1, 15) + nested + BATCH(1) + BATCH(4) + PROUTE(1, 41, "2026-01-01") + BATCH(5) + PROUTE(5, 42, "2026-07-01") + "update public.products set sub_group_id = 1 where id = 5;\n" + "create or replace function costing.fn_validate_route_family_route_x() returns int language sql as $$ select 1 $$;\n");
      const bad = [];
      const safe = (f) => { try { return f(); } catch { return null; } };
      const w2 = safe(() => call(s, 1, 3));        // different group
      if (!(w2 && w2.proposed.family_id === 12)) bad.push("proposed-subgroup-ignored-outer");
      const w3 = safe(() => call(s, 3, 3));        // product map precedence
      if (!(w3 && w3.proposed.family_id === 13 && w3.before.family_id === 13)) bad.push("precedence-changed");
      const w6 = safe(() => call(s, 1, 2));        // nested lookup
      if (!(w6 && w6.proposed.state === "INVALID")) bad.push("nested-validator-context-ignored");
      const w6b = safe(() => call(s, 5, 2));
      if (!(w6b && w6b.before.state === "INVALID" && w6b.proposed.state === "VALID")) bad.push("nested-validator-context-ignored");
      const w4 = safe(() => call(s, 4, 2));        // group of the proposed sub-group (group 1 map 15 vs stored sg1 route)
      if (!(w4 && w4.proposed.family_id !== null)) bad.push("group-from-stored");
      return bad;
    };
    const clean = probe(g2FixtureSql());
    check("W11.0", "the invariant probe is clean on the unmodified proposal", clean.length === 0, clean.join());
    const M = (from, to) => g2FixtureSql({ mutate: (n, t) => (n === "preview" ? (t.includes(from) ? t.replace(from, to) : (() => { throw new Error("mutation target missing: " + from); })()) : t) });
    const MALL = (from, to) => g2FixtureSql({ mutate: (n, t) => (n === "preview" ? (t.includes(from) ? t.split(from).join(to) : (() => { throw new Error("mutation target missing: " + from); })()) : t) });
    const mutants = {
      "RPC ignores the proposed sub-group (evaluates the stored one twice)": [M("v_prop := costing.fn_wp10_route_state_ctx(p_product_id, v_today, p_proposed_sub_group_id);", "v_prop := costing.fn_wp10_route_state_ctx(p_product_id, v_today, v_stored);"), "proposed-subgroup-ignored-outer"],
      "OUTER family selector ignores the proposed sub-group (live resolver in the effective validator)": [M("costing.fn_wp10_resolve_route_family_ctx(p_product_id,v_date,p_sub_group_id)", "costing.fn_resolve_route_family_for_product(p_product_id,v_date)"), "proposed-subgroup-ignored-outer"],
      "NESTED product-route validator ignores the proposed sub-group (stored context at the route's own date)": [M("costing.fn_wp10_resolve_route_family_ctx(v_route.product_id,coalesce(v_route.effective_from,current_date),p_sub_group_id)", "costing.fn_wp10_resolve_route_family_ctx(v_route.product_id,coalesce(v_route.effective_from,current_date),(select sub_group_id from public.products where id = v_route.product_id))"), "nested-validator-context-ignored"],
      "product-map precedence dropped (sub-group/group maps win over the product map)": [M("  if v_product_family is not null then\n    return v_product_family;\n  end if;\n", ""), "precedence-changed"],
      "group taken from the STORED sub-group (resolver reads public.products)": [MALL("from (select p_product_id as id, p_sub_group_id as sub_group_id) p\n", "from (select id, sub_group_id from public.products where id = p_product_id) p\n"), "proposed-subgroup-ignored-outer"],
      "an evaluation error falls back to VALID (error-to-valid)": [M("return jsonb_build_object('state', 'UNKNOWN', 'route_source', null, 'family_id', null, 'family_route_id', null, 'product_route_id', null,\n      'reasons', jsonb_build_array(case when sqlerrm", "return jsonb_build_object('state', 'VALID', 'route_source', null, 'family_id', null, 'family_route_id', null, 'product_route_id', null,\n      'reasons', jsonb_build_array(case when sqlerrm"), "error-to-valid"],
    };
    // error-to-valid needs its own probe: the validator raises
    const errProbe = (sql) => { const sc = makeRunner(cluster, { sql }); const s = sc(VIEW + WORLD + "create or replace function costing.fn_validate_route_family_route(p_family_route_id bigint) returns jsonb language plpgsql as $$ begin raise exception 'x'; end $$;\n"); const r = JSON.parse(s.one(PREVIEW(1, 3), VIEW)); return r.proposed.state === "UNKNOWN" ? [] : ["error-to-valid"]; };
    const malProbe = (sql) => { const sc = makeRunner(cluster, { sql }); const s = sc(VIEW + WORLD + "create or replace function costing.fn_validate_route_family_route(p_family_route_id bigint) returns jsonb language sql as $$ select '{}'::jsonb $$;\n"); const r = JSON.parse(s.one(PREVIEW(1, 3), VIEW)); return r.proposed.state === "UNKNOWN" ? [] : ["malformed-read-as-result"]; };
    mutants["malformed result (no boolean 'valid') is NOT classified UNKNOWN (NULL-logic regression found while building this suite)"] = [M("jsonb_typeof(v -> 'valid') is distinct from 'boolean'", "jsonb_typeof(v -> 'valid') <> 'boolean'"), "malformed-read-as-result"];
    check("W11.m0", "the malformed-result probe is clean on the unmodified proposal", malProbe(g2FixtureSql()).length === 0);
    check("W11.e0", "the error probe is clean on the unmodified proposal", errProbe(g2FixtureSql()).length === 0);
    let n = 0;
    for (const [name, [sql, expected]] of Object.entries(mutants)) {
      n++;
      let bad; try { bad = expected === "error-to-valid" ? errProbe(sql) : expected === "malformed-read-as-result" ? malProbe(sql) : probe(sql); } catch (e) { check(`W11.${n}`, `MUTANT '${name}' is DETECTED`, false, String(e.message).slice(0, 140)); continue; }
      check(`W11.${n}`, `MUTANT '${name}' is DETECTED`, bad.includes(expected), `violations=${bad.join(",") || "none"}`);
    }
  }
} finally { cluster.stop(); }
console.log(failed() ? `\n${failed()} FAILED` : "\nALL PASSED");
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ synthetic: "isolated PostgreSQL fixture; live-verbatim route chain + UNAPPLIED proposal 06 text", results }, null, 2) + "\n");
process.exit(failed() ? 1 : 0);
