-- CI-037 v3 PREPARED, NOT APPLIED. Apply only after owner approval, via Supabase MCP apply_migration
-- (never supabase db push). Notify Jarvis first. Run CI-037_verify.sql BEFORE (must match the recorded baseline) and AFTER.
--
-- v2 change of design (fingerprint safety): run 119 (REFERENCE) has a legacy fingerprint capture without a column
-- list, so fn_verify_run_fingerprint re-hashes ALL current columns of sku_pricing_bridge_snapshot. Adding columns to
-- that table would therefore show drift on run 119. v2 leaves sku_pricing_bridge_snapshot's columns untouched
-- (comments only) and stores the profit chain in a new side table, sku_pricing_bridge_profit_snapshot (one row per
-- SKU and region). The new table matches fn_costing_run_scoped_tables() (name has 'snapshot', has refresh_run_id),
-- so future fingerprints cover it; for old runs it has 0 rows and is skipped by fn_verify_run_fingerprint.
-- Immutability: the existing trg_au2_designated_run_guard / fn_guard_designated_run_rows() (blocks INSERT/UPDATE/
-- DELETE for runs designated REFERENCE/APPROVED/REVOKED) and trg_au2_snapshot_truncate_guard are attached to the new
-- table; the helper also refuses those runs itself.
-- Order in the chain: pricing bridge -> selling price bridge -> scheme master -> selected scheme -> [CI-037 helper] -> scheme viability.

begin;

comment on column costing.sku_pricing_bridge_snapshot.ik_margin_amount_before_scheme is 'Legacy MRP-based cost difference — not profit';
comment on column costing.sku_pricing_bridge_snapshot.ok_margin_amount_before_scheme is 'Legacy MRP-based cost difference — not profit';
comment on column costing.sku_pricing_bridge_snapshot.ik_margin_percent_before_scheme is 'Legacy MRP-based cost difference — not profit (% of GST-inclusive MRP)';
comment on column costing.sku_pricing_bridge_snapshot.ok_margin_percent_before_scheme is 'Legacy MRP-based cost difference — not profit (% of GST-inclusive MRP)';

-- Governed contingency rate (no company-wide live source exists; per-SKU sku_selling_price_policy.contingency_percent
-- is the operational source and is cross-checked row by row against this policy).
create table costing.costing_contingency_rate_policy (
  id bigint generated always as identity primary key,
  rate_percent numeric not null check (rate_percent >= 0 and rate_percent < 100),
  basis text not null check (basis = 'POST_DISCOUNT_EX_GST_SELLING_PRICE'),
  effective_from date not null,
  effective_to date,
  status text not null check (status in ('APPROVED','RETIRED')),
  approved_by text not null,
  approval_reference text not null,
  created_at timestamptz not null default clock_timestamp(),
  check (effective_to is null or effective_to >= effective_from)
);
create unique index costing_contingency_rate_policy_one_open on costing.costing_contingency_rate_policy ((true)) where status = 'APPROVED' and effective_to is null;
alter table costing.costing_contingency_rate_policy enable row level security;
revoke all on costing.costing_contingency_rate_policy from public, anon, authenticated, service_role;
comment on table costing.costing_contingency_rate_policy is 'CI-037: governed company contingency rate and basis. Change only by owner-approved migration.';
insert into costing.costing_contingency_rate_policy (rate_percent, basis, effective_from, status, approved_by, approval_reference)
values (2, 'POST_DISCOUNT_EX_GST_SELLING_PRICE', date '2026-06-01', 'APPROVED', 'Dr. Brahmadathan U', 'CI-037 owner policy 24-Oct-2026: 2% of post-discount, GST-exclusive selling price');

create table costing.sku_pricing_bridge_profit_snapshot (
  id bigint generated always as identity primary key,
  period_start date not null,
  valuation_date date not null,
  refresh_run_id bigint not null references costing.costing_refresh_run(id),
  pricing_bridge_snapshot_id bigint not null references costing.sku_pricing_bridge_snapshot(id) on delete cascade,
  selling_price_bridge_snapshot_id bigint,
  selected_scheme_snapshot_id bigint,
  sku_id bigint not null,
  region_code text not null check (region_code in ('IK','OK')),
  mrp numeric, gst_percent numeric, basic_price numeric, discount_percent numeric, selling_price numeric,
  contingency_percent numeric, contingency_value numeric,
  scheme_id bigint, scheme_paid_qty numeric, scheme_free_qty numeric,
  regional_marketing_cost_per_sku numeric, internal_loaded_cost_per_sku numeric,
  scheme_effective_selling_price numeric,
  net_sales_realization_per_sku numeric,
  estimated_profit_per_sku numeric,
  estimated_profit_on_mrp_percent numeric,
  estimated_profit_on_selling_price_percent numeric,
  estimated_profit_on_realization_percent numeric,
  profit_calculation_status text not null,
  profit_calculation_basis text not null,
  contingency_rate_policy_id bigint references costing.costing_contingency_rate_policy(id),
  contingency_policy_rate_percent numeric,
  calculated_at timestamptz not null default clock_timestamp(),
  unique (refresh_run_id, sku_id, region_code),
  unique (pricing_bridge_snapshot_id, region_code),
  check (profit_calculation_status like 'CALCULATED%' or (scheme_effective_selling_price is null and net_sales_realization_per_sku is null and estimated_profit_per_sku is null))
);
alter table costing.sku_pricing_bridge_profit_snapshot enable row level security;
revoke all on costing.sku_pricing_bridge_profit_snapshot from public, anon, authenticated, service_role;
create trigger trg_au2_designated_run_guard before insert or delete or update on costing.sku_pricing_bridge_profit_snapshot
  for each row execute function costing.fn_guard_designated_run_rows();
create trigger trg_au2_snapshot_truncate_guard before truncate on costing.sku_pricing_bridge_profit_snapshot
  for each statement execute function costing.fn_guard_snapshot_truncate();
comment on table costing.sku_pricing_bridge_profit_snapshot is 'CI-037: per SKU and region (IK/OK) commercial profit chain, filled by fn_ci037_fill_pricing_bridge_profit inside the refresh chain. Estimated profit = scheme-adjusted selling price - contingency allowance - regional marketing - internal loaded cost, per delivered unit. Contingency is an allowance, not an incurred cost.';
comment on column costing.sku_pricing_bridge_profit_snapshot.profit_calculation_status is 'CALCULATED, CALCULATED_UPSTREAM_REVIEW, or an explicit error code (MISSING_*/INVALID_*/UPSTREAM_BLOCKED/SCHEME_BLOCKED_OR_MISSING/CONTINGENCY_NOT_ON_SELLING_PRICE...). Values are NULL unless CALCULATED*.';

create or replace function costing.fn_ci037_fill_pricing_bridge_profit(p_refresh_run_id bigint)
returns bigint
language plpgsql
security definer
set search_path to 'costing','public','pg_temp'
as $fn$
declare
  v_des text; v_rate numeric; v_rate_id bigint; v_rate_n int; v_vdate date; v_pb bigint; v_pb_sku bigint; v_sp bigint; v_sp_sku bigint; v_ss bigint; v_ss_bad bigint; v_ins bigint; v_missing bigint;
begin
  if p_refresh_run_id is null then raise exception 'CI037: refresh run id is required'; end if;
  if not exists (select 1 from costing.costing_refresh_run r where r.id = p_refresh_run_id) then
    raise exception 'CI037: refresh run % does not exist', p_refresh_run_id;
  end if;
  -- Same designation set as trg_au2_designated_run_guard (fn_guard_designated_run_rows): REFERENCE/APPROVED/REVOKED.
  select designation into v_des from costing.v_costing_run_effective_designation where refresh_run_id = p_refresh_run_id;
  if v_des in ('REFERENCE','APPROVED','REVOKED') then
    raise exception 'CI037: run % is %; designated history is immutable', p_refresh_run_id, v_des using errcode = 'P0001';
  end if;

  -- Governed contingency rate: exactly one APPROVED row of costing.costing_contingency_rate_policy covering the run's valuation date.
  select valuation_date into v_vdate from costing.costing_refresh_run where id = p_refresh_run_id;
  select count(*), max(id), max(rate_percent) into v_rate_n, v_rate_id, v_rate
  from costing.costing_contingency_rate_policy
  where status = 'APPROVED' and effective_from <= v_vdate and (effective_to is null or effective_to >= v_vdate);
  if v_rate_n <> 1 then
    raise exception 'CI037: expected exactly one APPROVED contingency-rate policy for valuation date %, found %', v_vdate, v_rate_n;
  end if;

  -- Cardinality: one pricing-bridge row per SKU, one selling-price row per pricing-bridge row,
  -- exactly one IK and one OK selected-scheme row per SKU. Any breach aborts (no partial population).
  select count(*), count(distinct sku_id) into v_pb, v_pb_sku from costing.sku_pricing_bridge_snapshot where refresh_run_id = p_refresh_run_id;
  if v_pb = 0 then raise exception 'CI037: no pricing-bridge rows for run %', p_refresh_run_id; end if;
  if v_pb <> v_pb_sku then raise exception 'CI037: % pricing-bridge rows but % distinct SKUs for run % (duplicates)', v_pb, v_pb_sku, p_refresh_run_id; end if;

  select count(*), count(distinct sp.sku_id) into v_sp, v_sp_sku
  from costing.sku_selling_price_bridge_snapshot sp
  join costing.sku_pricing_bridge_snapshot pb on pb.id = sp.pricing_bridge_snapshot_id and pb.refresh_run_id = sp.refresh_run_id and pb.sku_id = sp.sku_id
  where sp.refresh_run_id = p_refresh_run_id;
  if v_sp <> v_pb or v_sp_sku <> v_pb then
    raise exception 'CI037: selling-price rows % (distinct SKUs %) do not match pricing-bridge rows % for run %', v_sp, v_sp_sku, v_pb, p_refresh_run_id;
  end if;

  select count(*) into v_ss from costing.sku_selected_scheme_policy_context_snapshot where refresh_run_id = p_refresh_run_id;
  select count(*) into v_ss_bad from (
    select pb.sku_id
    from costing.sku_pricing_bridge_snapshot pb
    left join costing.sku_selected_scheme_policy_context_snapshot s on s.refresh_run_id = pb.refresh_run_id and s.sku_id = pb.sku_id
    where pb.refresh_run_id = p_refresh_run_id
    group by pb.sku_id
    having count(*) filter (where s.region_code = 'IK') <> 1 or count(*) filter (where s.region_code = 'OK') <> 1 or count(s.id) <> 2
  ) x;
  if v_ss_bad > 0 or v_ss <> 2 * v_pb then
    raise exception 'CI037: selected-scheme rows incomplete or duplicated for run %: % SKUs without exactly one IK and one OK row; % rows for % SKUs', p_refresh_run_id, v_ss_bad, v_ss, v_pb;
  end if;

  delete from costing.sku_pricing_bridge_profit_snapshot where refresh_run_id = p_refresh_run_id;

  insert into costing.sku_pricing_bridge_profit_snapshot (
    period_start, valuation_date, refresh_run_id, pricing_bridge_snapshot_id, selling_price_bridge_snapshot_id, selected_scheme_snapshot_id,
    sku_id, region_code, mrp, gst_percent, basic_price, discount_percent, selling_price, contingency_percent, contingency_value,
    scheme_id, scheme_paid_qty, scheme_free_qty, regional_marketing_cost_per_sku, internal_loaded_cost_per_sku,
    scheme_effective_selling_price, net_sales_realization_per_sku, estimated_profit_per_sku,
    estimated_profit_on_mrp_percent, estimated_profit_on_selling_price_percent, estimated_profit_on_realization_percent,
    profit_calculation_status, profit_calculation_basis, contingency_rate_policy_id, contingency_policy_rate_percent)
  with src as (
    select pb.period_start, pb.valuation_date, pb.refresh_run_id, pb.id pb_id, sp.id sp_id, s.id ss_id, pb.sku_id, rg.r,
      case rg.r when 'IK' then pb.mrp_ik else pb.mrp_ok end mrp,
      sp.gst_percent gst,
      case rg.r when 'IK' then sp.ik_basic_price else sp.ok_basic_price end basic,
      case rg.r when 'IK' then sp.ik_discount_percent else sp.ok_discount_percent end disc,
      case rg.r when 'IK' then sp.ik_selling_price else sp.ok_selling_price end sell,
      sp.contingency_percent cpct, spp.id spp_id, spp.contingency_percent spp_cpct,
      case rg.r when 'IK' then sp.ik_contingency_value else sp.ok_contingency_value end cont,
      s.scheme_id, s.paid_qty pq, s.free_qty fq, s.total_qty tq, s.resolution_status ss_status,
      case rg.r when 'IK' then pb.marketing_expense_cost_per_sku_ik else pb.marketing_expense_cost_per_sku_ok end mkt,
      pb.internal_loaded_cost_per_sku ilc,
      case rg.r when 'IK' then pb.pricing_bridge_status_ik else pb.pricing_bridge_status_ok end pb_status,
      case rg.r when 'IK' then sp.selling_price_bridge_status_ik else sp.selling_price_bridge_status_ok end sp_status
    from costing.sku_pricing_bridge_snapshot pb
    cross join (values ('IK'),('OK')) rg(r)
    join costing.sku_selling_price_bridge_snapshot sp on sp.pricing_bridge_snapshot_id = pb.id and sp.refresh_run_id = pb.refresh_run_id and sp.sku_id = pb.sku_id
    join costing.sku_selected_scheme_policy_context_snapshot s on s.refresh_run_id = pb.refresh_run_id and s.sku_id = pb.sku_id and s.region_code = rg.r
    left join costing.sku_selling_price_policy spp on spp.id = sp.selling_price_policy_id
    where pb.refresh_run_id = p_refresh_run_id
  ), st as (
    select src.*,
      case
        when pb_status is null or sp_status is null then 'MISSING_UPSTREAM_STATUS'
        when pb_status = 'BLOCKED' or sp_status = 'BLOCKED' then 'UPSTREAM_BLOCKED'
        when pb_status not in ('READY','REVIEW_REQUIRED') or sp_status not in ('READY','REVIEW_REQUIRED') then 'UNKNOWN_UPSTREAM_STATUS'
        -- Live CHECK on sku_selected_scheme_policy_context_snapshot allows only RESOLVED_POLICY, DEFAULT_NO_SCHEME, BLOCKED.
        -- There is no REVIEW_REQUIRED (or equivalent) scheme status; anything else is treated as an error.
        when ss_status is null then 'SCHEME_STATUS_MISSING'
        when ss_status = 'BLOCKED' then 'SCHEME_BLOCKED'
        when ss_status not in ('RESOLVED_POLICY','DEFAULT_NO_SCHEME') then 'UNKNOWN_SCHEME_STATUS'
        when mrp is null then 'MISSING_MRP'
        when mrp <= 0 then 'INVALID_MRP'
        when gst is null then 'MISSING_GST'
        when gst < 0 or gst > 100 then 'INVALID_GST'
        when basic is null then 'MISSING_BASIC_PRICE'
        when basic <= 0 or abs(basic - mrp / (1 + gst / 100)) > 0.01 then 'INVALID_BASIC_PRICE'
        when disc is null then 'MISSING_DISCOUNT'
        when disc < 0 or disc >= 100 then 'INVALID_DISCOUNT'
        when sell is null then 'MISSING_SELLING_PRICE'
        when sell <= 0 or sell > basic + 0.01 or abs(sell - basic * (1 - disc / 100)) > 0.01 then 'INVALID_SELLING_PRICE'
        when pq is null or fq is null or tq is null then 'MISSING_SCHEME_QUANTITY'
        when pq <= 0 or fq < 0 or tq <> pq + fq or pq <> trunc(pq) or fq <> trunc(fq) then 'INVALID_SCHEME_QUANTITY'
        when cpct is null or cont is null then 'MISSING_CONTINGENCY'
        when spp_id is null then 'MISSING_CONTINGENCY_POLICY_SOURCE'
        when spp_cpct is distinct from cpct then 'CONTINGENCY_POLICY_SOURCE_MISMATCH'
        when cpct <> v_rate then 'CONTINGENCY_RATE_NOT_POLICY'
        when abs(cont - sell * v_rate / 100) > 0.01 then 'CONTINGENCY_NOT_ON_SELLING_PRICE'
        when mkt is null then 'MISSING_REGIONAL_MARKETING'
        when mkt < 0 then 'INVALID_REGIONAL_MARKETING'
        when ilc is null then 'MISSING_COST'
        when ilc <= 0 then 'INVALID_COST'
        when pb_status = 'REVIEW_REQUIRED' or sp_status = 'REVIEW_REQUIRED' then 'CALCULATED_UPSTREAM_REVIEW'
        else 'CALCULATED'
      end status
    from src
  ), v as (
    select st.*,
      case when status like 'CALCULATED%' then sell * pq / (pq + fq) end sch
    from st
  ), v2 as (
    select v.*, sch - cont - mkt nsr from v
  ), v3 as (
    select v2.*, nsr - ilc prof from v2
  )
  select period_start, valuation_date, refresh_run_id, pb_id, sp_id, ss_id, sku_id, r, mrp, gst, basic, disc, sell, cpct, cont,
    scheme_id, pq, fq, mkt, ilc, sch, nsr, prof,
    case when prof is not null and mrp  > 0 then prof / mrp  * 100 end,
    case when prof is not null and sell > 0 then prof / sell * 100 end,
    case when prof is not null and nsr  > 0 then prof / nsr  * 100 end,
    status,
    'CI-037 v3: contingency = governed policy rate x post-discount ex-GST selling price; scheme price per delivered unit; regional marketing; internal loaded cost',
    v_rate_id, v_rate
  from v3;
  get diagnostics v_ins = row_count;

  select count(*) into v_missing from (
    select pb.sku_id, rg.r from costing.sku_pricing_bridge_snapshot pb cross join (values ('IK'),('OK')) rg(r)
    where pb.refresh_run_id = p_refresh_run_id
    except
    select sku_id, region_code from costing.sku_pricing_bridge_profit_snapshot where refresh_run_id = p_refresh_run_id
  ) x;
  if v_ins <> 2 * v_pb or v_missing > 0 then
    raise exception 'CI037: partial population for run %: inserted %, expected %, missing SKU-region pairs %', p_refresh_run_id, v_ins, 2 * v_pb, v_missing;
  end if;
  return v_ins;
end $fn$;
revoke all on function costing.fn_ci037_fill_pricing_bridge_profit(bigint) from public, anon, authenticated, service_role;

-- Repeatable hook: 0 hooks -> insert; 1 correctly placed -> no-op; several or misplaced -> error.
do $do$
declare
  v_def text;
  v_anchor constant text := 'perform * from costing.rpc_refresh_sku_selected_scheme_policy_context_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);';
  v_hook constant text := 'perform costing.fn_ci037_fill_pricing_bridge_profit(p_refresh_run_id);';
  v_n_anchor int; v_n_hook int; v_pos_ok boolean;
begin
  v_def := pg_get_functiondef('costing.rpc_refresh_manufacturing_cop_chain(date,date,bigint)'::regprocedure);
  v_n_anchor := (length(v_def) - length(replace(v_def, v_anchor, ''))) / length(v_anchor);
  v_n_hook   := (length(v_def) - length(replace(v_def, v_hook, ''))) / length(v_hook);
  -- correctly positioned = anchor, then only whitespace, then hook
  v_pos_ok := position(v_anchor in v_def) > 0
              and ltrim(substr(v_def, position(v_anchor in v_def) + length(v_anchor)), E' \t\r\n') like v_hook || '%';
  if v_n_anchor <> 1 then
    raise exception 'CI037_HOOK: anchor (selected-scheme step) found % times, expected 1', v_n_anchor;
  elsif v_n_hook > 1 then
    raise exception 'CI037_HOOK: hook found % times, expected 0 or 1', v_n_hook;
  elsif v_n_hook = 1 and not v_pos_ok then
    raise exception 'CI037_HOOK: hook present but not immediately after the selected-scheme step';
  elsif v_n_hook = 1 then
    raise notice 'CI037_HOOK: already present and correctly positioned; no change';
  else
    execute replace(v_def, v_anchor, v_anchor || E'\n        ' || v_hook);
    raise notice 'CI037_HOOK: inserted';
  end if;
end $do$;

-- Additive view change: 64 existing columns kept in order, 15 appended. CREATE OR REPLACE keeps owner, ACL,
-- reloptions and column comments.
create or replace view costing.v_price_revision_current_approved_master as
WITH approved_run AS (
         SELECT r.refresh_run_id,
            r.period_start,
            r.valuation_date
           FROM costing.v_current_successful_costing_refresh_run r
             JOIN costing.v_costing_run_effective_designation e ON e.refresh_run_id = r.refresh_run_id AND e.designation = 'APPROVED'::text
          WHERE r.selection_basis = 'APPROVED'::text
          ORDER BY r.period_start DESC, r.valuation_date DESC, r.refresh_run_id DESC
         LIMIT 1
        )
 SELECT a.refresh_run_id,
    a.period_start,
    a.valuation_date,
    d.sku_id,
    d.product_id,
    p.item,
    d.pack_size,
    d.pack_uom,
    pg.id AS product_group_id,
    pg.group_name AS product_group,
    sg.id AS product_subgroup_id,
    sg.sub_group_name AS product_subgroup,
    c.rm_cost_per_sku,
    c.pm_cost_per_sku,
    d.material_cost_per_sku,
    d.direct_labour_cost_per_sku,
    d.internal_material_conversion_cost_per_sku,
    d.prime_cost_per_sku,
    d.production_overhead_cost_per_sku,
    d.quality_control_overhead_cost_per_sku,
    d.materials_stores_overhead_cost_per_sku,
    d.manufacturing_cop_per_sku,
    d.admin_overhead_cost_per_sku,
    d.finance_admin_overhead_cost_per_sku,
    d.internal_loaded_cost_per_sku,
    pb.marketing_expense_cost_per_sku_ik,
    pb.marketing_expense_cost_per_sku_ok,
    pb.pricing_cost_per_sku_ik,
    pb.pricing_cost_per_sku_ok,
    d.mrp_ik,
    d.mrp_ok,
    d.gst_percent,
    d.ik_basic_price,
    d.ok_basic_price,
    d.ik_discount_percent,
    d.ok_discount_percent,
    d.ik_discount_amount,
    d.ok_discount_amount,
    d.ik_selling_price,
    d.ok_selling_price,
    d.contingency_percent,
    d.ik_contingency_value,
    d.ok_contingency_value,
    si.scheme_id AS ik_scheme_id,
    si.scheme_name AS ik_scheme_name,
    si.paid_qty AS ik_scheme_paid_qty,
    si.free_qty AS ik_scheme_free_qty,
    so.scheme_id AS ok_scheme_id,
    so.scheme_name AS ok_scheme_name,
    so.paid_qty AS ok_scheme_paid_qty,
    so.free_qty AS ok_scheme_free_qty,
    d.ik_margin_amount_before_scheme,
    d.ik_margin_percent_before_scheme,
    d.ok_margin_amount_before_scheme,
    d.ok_margin_percent_before_scheme,
    d.cost_sheet_status,
    d.refreshed_at,
    cat.id AS product_category_id,
    cat.category_name AS product_category,
    subcat.id AS product_subcategory_id,
    subcat.subcategory_name AS product_subcategory,
    sku.price_list_ik,
    sku.price_list_ok,
    to_char((d.refreshed_at AT TIME ZONE 'Asia/Kolkata'::text), 'DD Mon YYYY, FMHH12:MI AM'::text) || ' IST'::text AS refreshed_at_ist,
    p_ik.scheme_effective_selling_price AS ik_scheme_effective_selling_price,
    p_ik.net_sales_realization_per_sku AS ik_net_sales_realization_per_sku,
    p_ik.estimated_profit_per_sku AS ik_estimated_profit_per_sku,
    p_ik.estimated_profit_on_mrp_percent AS ik_estimated_profit_on_mrp_percent,
    p_ik.estimated_profit_on_selling_price_percent AS ik_estimated_profit_on_selling_price_percent,
    p_ik.estimated_profit_on_realization_percent AS ik_estimated_profit_on_realization_percent,
    p_ik.profit_calculation_status AS ik_profit_calculation_status,
    p_ok.scheme_effective_selling_price AS ok_scheme_effective_selling_price,
    p_ok.net_sales_realization_per_sku AS ok_net_sales_realization_per_sku,
    p_ok.estimated_profit_per_sku AS ok_estimated_profit_per_sku,
    p_ok.estimated_profit_on_mrp_percent AS ok_estimated_profit_on_mrp_percent,
    p_ok.estimated_profit_on_selling_price_percent AS ok_estimated_profit_on_selling_price_percent,
    p_ok.estimated_profit_on_realization_percent AS ok_estimated_profit_on_realization_percent,
    p_ok.profit_calculation_status AS ok_profit_calculation_status,
    p_ik.profit_calculation_basis AS profit_calculation_basis
   FROM approved_run a
     JOIN costing.v_sku_detailed_cost_sheet d ON d.refresh_run_id = a.refresh_run_id AND d.period_start = a.period_start AND d.valuation_date = a.valuation_date
     JOIN costing.sku_manufacturing_cop_snapshot c ON c.refresh_run_id = a.refresh_run_id AND c.sku_id = d.sku_id
     JOIN costing.sku_pricing_bridge_snapshot pb ON pb.refresh_run_id = a.refresh_run_id AND pb.sku_id = d.sku_id
     JOIN products p ON p.id = d.product_id
     JOIN product_skus sku ON sku.id = d.sku_id AND sku.product_id = d.product_id
     JOIN sub_groups sg ON sg.id = p.sub_group_id
     JOIN product_groups pg ON pg.id = sg.product_group_id
     LEFT JOIN sub_categories subcat ON subcat.id = pg.sub_category_id
     LEFT JOIN categories cat ON cat.id = subcat.category_id
     JOIN costing.sku_selected_scheme_policy_context_snapshot si ON si.refresh_run_id = a.refresh_run_id AND si.sku_id = d.sku_id AND si.region_code = 'IK'::text
     JOIN costing.sku_selected_scheme_policy_context_snapshot so ON so.refresh_run_id = a.refresh_run_id AND so.sku_id = d.sku_id AND so.region_code = 'OK'::text
     LEFT JOIN costing.sku_pricing_bridge_profit_snapshot p_ik ON p_ik.refresh_run_id = a.refresh_run_id AND p_ik.sku_id = d.sku_id AND p_ik.region_code = 'IK'::text
     LEFT JOIN costing.sku_pricing_bridge_profit_snapshot p_ok ON p_ok.refresh_run_id = a.refresh_run_id AND p_ok.sku_id = d.sku_id AND p_ok.region_code = 'OK'::text;

commit;
