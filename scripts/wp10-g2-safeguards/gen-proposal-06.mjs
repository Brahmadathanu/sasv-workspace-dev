// Generates docs/master-data-costing/WP10_G2_UNAPPLIED_SQL_PROPOSALS/06_subgroup_impact_preview.sql MECHANICALLY from the committed live definitions
// (independent-live-catalog + independent-route-callee-catalog). The context-aware helpers are NOT re-implementations: each is the captured
// pg_get_functiondef text with a small, named, count-asserted set of substitutions. draft-sql-static.test.mjs regenerates the text and requires the
// committed file to be byte-identical, so the file cannot drift from the derivation, and a change to a captured definition makes the generator throw.
// Usage: node scripts/wp10-g2-safeguards/gen-proposal-06.mjs        (rewrites the SQL file)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { liveFn2, read } from "../wp10-g1-safeguard-audit/lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const OUT = "docs/master-data-costing/WP10_G2_UNAPPLIED_SQL_PROPOSALS/06_subgroup_impact_preview.sql";
const ROUTE_CAT = JSON.parse(read("docs/master-data-costing/WP10_G2_EVIDENCE/independent-route-callee-catalog-2026-11-15.json"));
const routeDef = (n) => ROUTE_CAT.functions.find((f) => f.proname === n).definition;
const md5 = (t) => crypto.createHash("md5").update(t).digest("hex");

/** Captured definitions this proposal is derived from or reuses unchanged (md5 of the captured pg_get_functiondef text). */
export const SOURCES = {
  fn_resolve_route_family_for_product: { sig: "costing.fn_resolve_route_family_for_product(integer, date)", def: liveFn2("costing", "fn_resolve_route_family_for_product"), use: "derived" },
  fn_resolve_effective_route_family_route: { sig: "costing.fn_resolve_effective_route_family_route(integer, date)", def: routeDef("fn_resolve_effective_route_family_route"), use: "derived" },
  fn_validate_product_process_route: { sig: "costing.fn_validate_product_process_route(bigint)", def: routeDef("fn_validate_product_process_route"), use: "derived" },
  fn_validate_effective_product_process_route: { sig: "costing.fn_validate_effective_product_process_route(integer, date)", def: liveFn2("costing", "fn_validate_effective_product_process_route"), use: "derived" },
  fn_resolve_effective_product_process_route: { sig: "costing.fn_resolve_effective_product_process_route(integer, date)", def: routeDef("fn_resolve_effective_product_process_route"), use: "reused unchanged (no subgroup input)" },
  fn_validate_route_family_route: { sig: "costing.fn_validate_route_family_route(bigint)", def: routeDef("fn_validate_route_family_route"), use: "reused unchanged (no subgroup/date input)" },
  fn_effective_product_process_route_steps: { sig: "costing.fn_effective_product_process_route_steps(bigint)", def: routeDef("fn_effective_product_process_route_steps"), use: "reused unchanged (reads route, base steps, overrides only)" },
};
for (const v of Object.values(SOURCES)) { v.md5 = md5(v.def); if (!v.def) throw new Error("captured definition missing: " + v.sig); }

/** Replace `from`->`to` exactly `count` times or throw (a drifted capture must never silently produce a different function). */
function sub(text, from, to, count, what) {
  const n = text.split(from).length - 1;
  if (n !== count) throw new Error(`derivation '${what}': expected ${count} occurrence(s) of ${JSON.stringify(from)}, found ${n}`);
  return text.split(from).join(to);
}
function rename(def, oldName, newName, newArgs) {
  const re = new RegExp(`^CREATE OR REPLACE FUNCTION costing\\.${oldName}\\([^)]*\\)`);
  if (!re.test(def)) throw new Error("header not recognised for " + oldName);
  let out = def.replace(re, `CREATE FUNCTION costing.${newName}(${newArgs})`);
  // the captured resolver lacks pg_temp in its search_path; a SECURITY DEFINER copy gets it appended (header-only, reviewed change)
  out = out.replace("SET search_path TO 'costing', 'public'\n", "SET search_path TO 'costing', 'public', 'pg_temp'\n");
  return out.trimEnd() + ";\n";
}

export const DERIVED = {};
{ // 1 family resolver: the two queries that read the product's sub-group from public.products now read the (product, proposed sub-group) pair; group still comes from public.sub_groups.
  let t = SOURCES.fn_resolve_route_family_for_product.def;
  t = sub(t, "from public.products p\n", "from (select p_product_id as id, p_sub_group_id as sub_group_id) p\n", 2, "family resolver: products -> explicit pair");
  DERIVED.resolve_family = rename(t, "fn_resolve_route_family_for_product", "fn_wp10_resolve_route_family_ctx", "p_product_id integer, p_as_of_date date, p_sub_group_id integer");
}
{ // 2 family route: the one call to the family resolver becomes the context-aware one
  let t = SOURCES.fn_resolve_effective_route_family_route.def;
  t = sub(t, "costing.fn_resolve_route_family_for_product(p_product_id,p_as_of_date)", "costing.fn_wp10_resolve_route_family_ctx(p_product_id,p_as_of_date,p_sub_group_id)", 1, "family route: ctx family");
  DERIVED.resolve_family_route = rename(t, "fn_resolve_effective_route_family_route", "fn_wp10_resolve_effective_route_family_route_ctx", "p_product_id integer, p_as_of_date date, p_sub_group_id integer");
}
{ // 3 product-route validator: ONLY the nested family lookup at the route's own effective-from date is made context-aware
  let t = SOURCES.fn_validate_product_process_route.def;
  t = sub(t, "costing.fn_resolve_route_family_for_product(v_route.product_id,coalesce(v_route.effective_from,current_date))", "costing.fn_wp10_resolve_route_family_ctx(v_route.product_id,coalesce(v_route.effective_from,current_date),p_sub_group_id)", 1, "product validator: nested family lookup");
  DERIVED.validate_product_route = rename(t, "fn_validate_product_process_route", "fn_wp10_validate_product_process_route_ctx", "p_product_route_id bigint, p_sub_group_id integer");
}
{ // 4 effective validator: family, family route and the product-route validator are context-aware; product-route selection and the family-route validator are the canonical ones
  let t = SOURCES.fn_validate_effective_product_process_route.def;
  t = sub(t, "costing.fn_resolve_route_family_for_product(p_product_id,v_date)", "costing.fn_wp10_resolve_route_family_ctx(p_product_id,v_date,p_sub_group_id)", 1, "effective validator: family");
  t = sub(t, "costing.fn_resolve_effective_route_family_route(p_product_id,v_date)", "costing.fn_wp10_resolve_effective_route_family_route_ctx(p_product_id,v_date,p_sub_group_id)", 1, "effective validator: family route");
  t = sub(t, "costing.fn_validate_product_process_route(v_product_route_id)", "costing.fn_wp10_validate_product_process_route_ctx(v_product_route_id,p_sub_group_id)", 1, "effective validator: product route validator");
  DERIVED.validate_effective = rename(t, "fn_validate_effective_product_process_route", "fn_wp10_validate_effective_product_process_route_ctx", "p_product_id integer, p_as_of_date date, p_sub_group_id integer");
}

export const FUNCS_06 = [
  "costing.fn_wp10_resolve_route_family_ctx(integer, date, integer)",
  "costing.fn_wp10_resolve_effective_route_family_route_ctx(integer, date, integer)",
  "costing.fn_wp10_validate_product_process_route_ctx(bigint, integer)",
  "costing.fn_wp10_validate_effective_product_process_route_ctx(integer, date, integer)",
  "costing.fn_wp10_route_state_ctx(integer, date, integer)",
  "public.rpc_wp10_preview_product_subgroup_impact(integer, integer)",
];
const F01 = ["costing.fn_wp10_today_ist()", "costing.fn_wp10_batch_size_state_as_of(bigint, date)"];
const arr = (xs) => "array[" + xs.map((x) => `'${x}'`).join(", ") + "]";
const FILE = "06_subgroup_impact_preview.sql";

const STATE_FN = `create function costing.fn_wp10_route_state_ctx(p_product_id integer, p_as_of_date date, p_sub_group_id integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = costing, public, pg_temp
as $fn$
declare
  v jsonb;
  v_state text;
  v_reasons jsonb;
  v_src text;
begin
  begin
    v := costing.fn_wp10_validate_effective_product_process_route_ctx(p_product_id, p_as_of_date, p_sub_group_id);
  exception when others then
    -- evaluation failure is UNKNOWN, never valid; only the canonical ambiguity code is surfaced, never raw exception text
    return jsonb_build_object('state', 'UNKNOWN', 'route_source', null, 'family_id', null, 'family_route_id', null, 'product_route_id', null,
      'reasons', jsonb_build_array(case when sqlerrm like 'AMBIGUOUS_APPROVED_PRODUCT_ROUTE%' then 'AMBIGUOUS_APPROVED_PRODUCT_ROUTE' else 'EVALUATION_ERROR' end));
  end;
  if v is null or jsonb_typeof(v) is distinct from 'object' or jsonb_typeof(v -> 'valid') is distinct from 'boolean' then
    return jsonb_build_object('state', 'UNKNOWN', 'route_source', null, 'family_id', null, 'family_route_id', null, 'product_route_id', null,
      'reasons', jsonb_build_array('MALFORMED_RESULT'));
  end if;
  v_state := case when (v ->> 'valid')::boolean then 'VALID' else 'INVALID' end;
  select coalesce(jsonb_agg(e), '[]'::jsonb) into v_reasons
  from (select e from jsonb_array_elements_text(case when jsonb_typeof(v -> 'errors') = 'array' then v -> 'errors' else '[]'::jsonb end) e
        where e ~ '^[A-Z][A-Z0-9_]{0,63}$' limit 12) q;
  if v_state = 'INVALID' and jsonb_array_length(v_reasons) = 0 then v_reasons := jsonb_build_array('UNSPECIFIED_REASON'); end if;
  v_src := v ->> 'route_source';
  return jsonb_build_object(
    'state', v_state,
    'route_source', case when v_src in ('PRODUCT_ROUTE', 'ROUTE_FAMILY_INHERITED') then v_src else null end,
    'family_id', case when (v ->> 'route_family_id') ~ '^[0-9]{1,18}$' then (v ->> 'route_family_id')::bigint else null end,
    'family_route_id', case when (v ->> 'family_route_id') ~ '^[0-9]{1,18}$' then (v ->> 'family_route_id')::bigint else null end,
    'product_route_id', case when (v ->> 'product_route_id') ~ '^[0-9]{1,18}$' then (v ->> 'product_route_id')::bigint else null end,
    'reasons', v_reasons);
end
$fn$;
`;

const RPC = `create function public.rpc_wp10_preview_product_subgroup_impact(p_product_id integer, p_proposed_sub_group_id integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, costing, pg_temp
as $fn$
declare
  v_today date;
  v_stored integer;
  v_found boolean;
  v_active integer;
  v_before jsonb;
  v_prop jsonb;
  v_changed boolean;
  v_class text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.app_has_permission('module:manage-products', 'view') then raise exception 'Permission denied'; end if;
  if p_product_id is null or p_proposed_sub_group_id is null then
    raise exception using errcode = '22023', message = 'WP10_PREVIEW_INPUT: a product and a proposed sub-group are required.';
  end if;
  select p.sub_group_id, true into v_stored, v_found from public.products p where p.id = p_product_id;
  if not coalesce(v_found, false) then
    raise exception using errcode = 'P0002', message = format('WP10_PREVIEW_INPUT: product %s does not exist.', p_product_id);
  end if;
  if not exists (select 1 from public.sub_groups g where g.id = p_proposed_sub_group_id) then
    raise exception using errcode = 'P0002', message = format('WP10_PREVIEW_INPUT: sub-group %s does not exist.', p_proposed_sub_group_id);
  end if;
  -- one STABLE function = one statement snapshot for every read below; today's IST date comes from the single clock function of proposal 01
  v_today := costing.fn_wp10_today_ist();
  select count(*)::integer into v_active from public.product_skus s where s.product_id = p_product_id and s.is_active;
  v_before := costing.fn_wp10_route_state_ctx(p_product_id, v_today, v_stored);
  v_prop := costing.fn_wp10_route_state_ctx(p_product_id, v_today, p_proposed_sub_group_id);
  v_changed := v_stored is distinct from p_proposed_sub_group_id;
  v_class := case
    when not v_changed then 'NO_SUBGROUP_CHANGE'
    when v_before ->> 'state' = 'UNKNOWN' or v_prop ->> 'state' = 'UNKNOWN' then 'UNKNOWN'
    when v_before ->> 'state' = 'VALID' and v_prop ->> 'state' = 'INVALID' then 'ROUTE_LOSS'
    when v_before ->> 'state' = 'VALID' then 'VALID_TO_VALID'
    when v_prop ->> 'state' = 'VALID' then 'INVALID_TO_VALID'
    else 'INVALID_TO_INVALID' end;
  return jsonb_build_object(
    'assessment_kind', 'PRODUCT_SUBGROUP_ROUTE_IMPACT',
    'authoritative_for_save', false,
    'product_id', p_product_id,
    'stored_sub_group_id', v_stored,
    'proposed_sub_group_id', p_proposed_sub_group_id,
    'sub_group_changed', v_changed,
    'evaluated_on', v_today,
    'date_basis', 'CURRENT_IST_DATE',
    'active_sku_count', v_active,
    'before', v_before,
    'proposed', v_prop,
    'impact_class', v_class,
    'review_required', (v_class = 'UNKNOWN') or (v_class = 'ROUTE_LOSS' and v_active > 0),
    'context_digest', md5(concat_ws('|', p_product_id, v_stored, p_proposed_sub_group_id, v_today, v_active, v_before::text, v_prop::text)));
end
$fn$;
`;

export function buildProposal06() {
  const live = ["fn_resolve_route_family_for_product", "fn_resolve_effective_route_family_route", "fn_validate_product_process_route", "fn_validate_effective_product_process_route", "fn_resolve_effective_product_process_route", "fn_validate_route_family_route", "fn_effective_product_process_route_steps"];
  const liveRows = live.map((n) => `    ('${SOURCES[n].sig}', '${SOURCES[n].md5}')`).join(",\n");
  const header = `-- WP10 G2 PROPOSAL 06 — UNAPPLIED. DO NOT RUN without separate, exact, owner-authorised operational approval. GENERATED FILE: do not edit by hand.
-- Regenerate with: node scripts/wp10-g2-safeguards/gen-proposal-06.mjs  (draft-sql-static.test.mjs requires this file to equal the generator output).
-- Read-only pre-submit subgroup-impact PREVIEW (counterfactual contract: WP10_G2_COUNTERFACTUAL_PREVIEW_CONTRACT_DRAFT_2026-11-15.md).
--   public.rpc_wp10_preview_product_subgroup_impact(p_product_id integer, p_proposed_sub_group_id integer) -> jsonb  (STABLE, one statement snapshot)
-- It answers "what would this product's production-route validity be if its sub-group were X?" WITHOUT any write, temporary row substitution, rollback-based
-- dry run, builder or writer call. It is NON-AUTHORITATIVE for the save ('authoritative_for_save': false): proposal 05's transactional guard still decides
-- inside the writer, there is no approval token, no override and no bypass.
-- No live function is replaced. The five context-aware helpers are the CAPTURED live definitions with named, count-asserted substitutions (see the generator):
--   fn_wp10_resolve_route_family_ctx            <- fn_resolve_route_family_for_product: the two queries that read the sub-group from public.products read the
--                                                 (product, sub-group) pair instead; the group comes from public.sub_groups for THAT sub-group; product-map
--                                                 first, sub-group map second, group map third; windows, inclusive ends and ordering are the captured text.
--   fn_wp10_resolve_effective_route_family_route_ctx <- fn_resolve_effective_route_family_route: the family comes from the context-aware resolver.
--   fn_wp10_validate_product_process_route_ctx  <- fn_validate_product_process_route: ONLY the nested family lookup at the route's OWN effective-from date
--                                                 becomes context-aware (an outer selector change alone would validate the proposed family against the old one).
--   fn_wp10_validate_effective_product_process_route_ctx <- fn_validate_effective_product_process_route: family, family route and the product-route validator
--                                                 are the context-aware ones; product-route selection (incl. AMBIGUOUS_APPROVED_PRODUCT_ROUTE), the family-route
--                                                 validator, effective steps and overrides are the canonical captured functions, reused unchanged.
-- Unknown is never safe: any exception or malformed result is state UNKNOWN (reason EVALUATION_ERROR / AMBIGUOUS_APPROVED_PRODUCT_ROUTE / MALFORMED_RESULT).
-- Input errors (missing product / sub-group) raise; they are never reported as zero impact.
-- Permission: existing module:manage-products View only (no new target). Proposed grant (TEXT ONLY, never executed here): EXECUTE on the preview to authenticated.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- PROVENANCE PREFLIGHT (R5): refuses to run when any object this file creates already exists (it never overwrites or adopts), when a live dependency
-- differs from the definition that was reviewed (md5 of pg_get_functiondef), or when a prerequisite proposal is missing or was modified after it was
-- applied. Re-running this file therefore FAILS at this block by design; a partial apply is impossible because the file is one transaction.
do $wp10_preflight$
declare t text; r record; v oid; c text;
begin
  foreach t in array ${arr(FUNCS_06)} loop
    if to_regprocedure(t) is not null then
      raise exception 'WP10-G2 preflight: % already exists; refusing to overwrite or adopt it (review the existing definition separately).', t;
    end if;
  end loop;
  foreach t in array array['public.products', 'public.sub_groups', 'public.product_skus', 'costing.product_process_route', 'costing.production_route_family_route'] loop
    if to_regclass(t) is null then raise exception 'WP10-G2 preflight: required table % is missing.', t; end if;
  end loop;
  if to_regprocedure('public.app_has_permission(text, text)') is null then raise exception 'WP10-G2 preflight: required function public.app_has_permission(text, text) is missing.'; end if;
  for r in select * from (values
${liveRows}
  ) as d(sig, expected_md5) loop
    v := to_regprocedure(r.sig);
    if v is null then raise exception 'WP10-G2 preflight: required live function % is missing.', r.sig; end if;
    if md5(pg_get_functiondef(v)) <> r.expected_md5 then
      raise exception 'WP10-G2 preflight: live function % differs from the reviewed definition (md5 %, reviewed %); re-review before applying.', r.sig, md5(pg_get_functiondef(v)), r.expected_md5;
    end if;
  end loop;
  foreach t in array ${arr(F01)} loop
    v := to_regprocedure(t);
    c := case when v is null then null else obj_description(v, 'pg_proc') end;
    if v is null or c is null or c not like 'WP10-G2 01\\_%' or split_part(c, 'md5:', 2) <> md5(pg_get_functiondef(v)) then
      raise exception 'WP10-G2 preflight: prerequisite % (proposal 01) is missing, not applied by this procedure, or modified since.', t;
    end if;
  end loop;
end $wp10_preflight$;

`;
  const body = [DERIVED.resolve_family, DERIVED.resolve_family_route, DERIVED.validate_product_route, DERIVED.validate_effective].map((t, i) => `-- derived helper ${i + 1} of 4 (captured text + named substitutions)\n${t}`).join("\n") + "\n" + STATE_FN + "\n" + RPC;
  const grants = `
revoke all on function costing.fn_wp10_resolve_route_family_ctx(integer, date, integer) from public, anon, authenticated;
revoke all on function costing.fn_wp10_resolve_effective_route_family_route_ctx(integer, date, integer) from public, anon, authenticated;
revoke all on function costing.fn_wp10_validate_product_process_route_ctx(bigint, integer) from public, anon, authenticated;
revoke all on function costing.fn_wp10_validate_effective_product_process_route_ctx(integer, date, integer) from public, anon, authenticated;
revoke all on function costing.fn_wp10_route_state_ctx(integer, date, integer) from public, anon, authenticated;
revoke all on function public.rpc_wp10_preview_product_subgroup_impact(integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.rpc_wp10_preview_product_subgroup_impact(integer, integer) to authenticated;

-- RECEIPT (R5): stamps each created function with this file name and the md5 of its definition as created. 99_rollback_all.sql removes ONLY objects
-- whose receipt is present and whose definition still matches; anything changed or unowned makes the rollback fail closed without dropping anything.
do $wp10_receipt$
declare t text; v oid;
begin
  foreach t in array ${arr(FUNCS_06)} loop
    v := to_regprocedure(t);
    execute format('comment on function %s is %L', v::regprocedure, 'WP10-G2 ${FILE} md5:' || md5(pg_get_functiondef(v)));
  end loop;
end $wp10_receipt$;
commit;
`;
  return header + body + grants;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fs.writeFileSync(path.join(root, OUT), buildProposal06());
  console.log("wrote", OUT);
}
