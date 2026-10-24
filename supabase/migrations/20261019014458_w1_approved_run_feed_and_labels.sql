-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- PREPARED (not applied): W1 approved-only selector, price-revision feed and run labels.
-- Build: local test only (18-19 Oct 2026). Apply only after explicit user approval via Supabase MCP apply_migration, unchanged.
-- Additive: creates 3 costing views + 3 public wrappers. Changes NO existing function or view.
-- Rule: a month's APPROVED run is the run the existing governed pointer (costing.v_current_successful_costing_refresh_run)
-- selects with selection_basis = 'APPROVED'. Drafts never enter the feed.

do $pre$
declare v text;
begin
  -- the source objects must be exactly the reviewed live definitions
  if md5(pg_get_viewdef('costing.v_current_successful_costing_refresh_run'::regclass)) <> '5cc25791985abf5d336fb9311da3d6f1' then raise exception 'W1 precheck: pointer view changed since review'; end if;
  if md5(pg_get_viewdef('costing.v_sku_detailed_cost_sheet'::regclass)) <> 'd20e3c3212c77496a9de29e92fc4036f' then raise exception 'W1 precheck: v_sku_detailed_cost_sheet changed since review'; end if;
  if md5(pg_get_viewdef('costing.v_cost_sheet_snapshot_sku_monthly_comparison'::regclass)) <> '7e3254c229aaec04e5467a6886584d60' then raise exception 'W1 precheck: monthly comparison view changed since review'; end if;
  if md5(pg_get_viewdef('public.v_cost_sheet_snapshot_sku_monthly_comparison'::regclass)) <> 'b20a9206d651ea3361a462fac8b069be' then raise exception 'W1 precheck: public monthly comparison view changed since review'; end if;
end $pre$;

-- 1. Approved-only price revision feed: one row per SKU of each month's APPROVED run.
create or replace view costing.v_price_revision_feed_approved as
with appr as (
  select r.period_start, r.refresh_run_id, r.valuation_date, e.designated_at, e.designated_by, e.designation_id
  from costing.v_current_successful_costing_refresh_run r
  join costing.v_costing_run_effective_designation e on e.refresh_run_id = r.refresh_run_id and e.designation = 'APPROVED'
  where r.selection_basis = 'APPROVED')
select a.period_start, a.valuation_date, a.refresh_run_id, ('Approved run '::text || a.refresh_run_id) as run_label,
       a.designated_at as approved_at, a.designated_by as approved_by, a.designation_id,
       (a.period_start = max(a.period_start) over ()) as is_latest_approved_period,
       d.sku_id, d.product_id, d.product_name, d.pack_size, d.pack_uom,
       d.mrp_ik, d.mrp_ok, d.material_cost_per_sku, d.direct_labour_cost_per_sku, d.manufacturing_cop_per_sku,
       d.internal_loaded_cost_per_sku, d.pricing_cost_per_sku, d.ik_selling_price, d.ok_selling_price,
       d.ik_margin_amount_before_scheme, d.ik_margin_percent_before_scheme,
       d.ok_margin_amount_before_scheme, d.ok_margin_percent_before_scheme,
       (d.ik_margin_amount_before_scheme < 0) as ik_negative_margin,
       (d.ok_margin_amount_before_scheme < 0) as ok_negative_margin,
       d.cost_sheet_status, d.refreshed_at
from appr a
join costing.v_sku_detailed_cost_sheet d
  on d.refresh_run_id = a.refresh_run_id and d.period_start = a.period_start and d.valuation_date = a.valuation_date;
comment on view costing.v_price_revision_feed_approved is 'W1: approved-only price revision feed (APPROVED run per month via the governed pointer). Drafts never appear. Sheets: filter is_latest_approved_period.';

-- 2. Per-month run status with display labels (approved vs latest draft).
create or replace view costing.v_costing_period_run_status as
with periods as (
  select period_start from costing.cost_periods
  union select period_start from costing.costing_refresh_run),
ptr as (select * from costing.v_current_successful_costing_refresh_run),
latest_success as (
  select distinct on (r.period_start) r.period_start, r.id, r.finished_at, e.designation
  from costing.costing_refresh_run r
  left join costing.v_costing_run_effective_designation e on e.refresh_run_id = r.id
  where r.overall_status = 'SUCCESS' and r.valuation_context_source = 'CAPTURED_AT_REQUEST'
  order by r.period_start, r.finished_at desc nulls last, r.id desc),
active as (
  select distinct on (r.period_start) r.period_start, r.id, r.overall_status, r.current_stage_code
  from costing.costing_refresh_run r where r.overall_status in ('QUEUED','RUNNING')
  order by r.period_start, r.requested_at desc, r.id desc),
base as (
  select p.period_start, cp.status as period_status, cp.valuation_date, cp.valuation_date_status,
         ptr.refresh_run_id as displayed_run_id, ptr.selection_basis as displayed_run_basis,
         case when ptr.selection_basis = 'APPROVED' then ptr.refresh_run_id end as approved_run_id,
         e.designated_at as approved_at, e.designated_by as approved_by,
         ls.id as latest_success_run_id, ls.finished_at as latest_success_finished_at,
         case when ptr.selection_basis = 'APPROVED' and ls.id is distinct from ptr.refresh_run_id
                   and coalesce(ls.designation,'') not in ('APPROVED','REFERENCE') then ls.id end as newer_draft_run_id,
         a.id as active_run_id, a.overall_status as active_run_status, a.current_stage_code as active_run_stage
  from periods p
  left join costing.cost_periods cp on cp.period_start = p.period_start
  left join ptr on ptr.period_start = p.period_start
  left join costing.v_costing_run_effective_designation e on e.refresh_run_id = ptr.refresh_run_id and ptr.selection_basis = 'APPROVED'
  left join latest_success ls on ls.period_start = p.period_start
  left join active a on a.period_start = p.period_start)
select b.*,
  case when b.displayed_run_id is null then 'NO_SUCCESSFUL_RUN'
       when b.displayed_run_basis = 'APPROVED' and b.newer_draft_run_id is not null then 'APPROVED_NEWER_DRAFT'
       when b.displayed_run_basis = 'APPROVED' then 'APPROVED'
       when b.displayed_run_basis = 'REFERENCE_FALLBACK' then 'REFERENCE_NOT_APPROVED'
       else 'DRAFT' end as display_state,
  case when b.displayed_run_id is null then 'No successful run'
       when b.displayed_run_basis = 'APPROVED' and b.newer_draft_run_id is not null
         then 'Approved run ' || b.displayed_run_id || ' (newer DRAFT run ' || b.newer_draft_run_id || ' - not approved)'
       when b.displayed_run_basis = 'APPROVED' then 'Approved run ' || b.displayed_run_id
       when b.displayed_run_basis = 'REFERENCE_FALLBACK' then 'Reference run ' || b.displayed_run_id || ' - not approved'
       else 'DRAFT run ' || b.displayed_run_id || ' - not approved' end as display_label,
  (b.approved_run_id is not null and b.period_start = max(b.period_start) filter (where b.approved_run_id is not null) over ()) as is_latest_approved_period
from base b;
comment on view costing.v_costing_period_run_status is 'W1: per-month governed run status and screen label (Approved run N / DRAFT run N - not approved).';

-- 3. Monthly comparison pinned to each month''s governed run (approved, else latest draft, labelled). Old view kept unchanged.
create or replace view costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed as
 WITH line_pivot AS (
         SELECT cost_sheet_line_monthly_snapshot.snapshot_period_start,
            cost_sheet_line_monthly_snapshot.product_id,
            cost_sheet_line_monthly_snapshot.product_name,
            cost_sheet_line_monthly_snapshot.category_name,
            cost_sheet_line_monthly_snapshot.subcategory_name,
            cost_sheet_line_monthly_snapshot.group_name,
            cost_sheet_line_monthly_snapshot.sub_group_name,
            cost_sheet_line_monthly_snapshot.sku_id,
            cost_sheet_line_monthly_snapshot.sku_column_label,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Raw Material Cost (RM)'::text)) AS rm_cost,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Packing & Labelling Material Cost (PM)'::text)) AS pm_cost,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Total Material Cost'::text)) AS total_material_cost,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Direct Labour (DL)'::text)) AS direct_labour_cost,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Manufacturing COP'::text)) AS manufacturing_cop,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Internal Loaded Cost'::text)) AS internal_loaded_cost,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'MRP: Inside Kerala (MRP IK)'::text)) AS mrp_ik,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'MRP: Outside Kerala (MRP OK)'::text)) AS mrp_ok,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Selling Price: IK'::text)) AS selling_price_ik,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Selling Price: OK'::text)) AS selling_price_ok,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Sales Realisation: IK'::text)) AS sales_realisation_ik,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Sales Realisation: OK'::text)) AS sales_realisation_ok,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Profit Value: IK'::text)) AS profit_value_ik,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Profit Value: OK'::text)) AS profit_value_ok,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Profit on Sales Realisation: IK (%)'::text)) AS profit_percent_ik,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Profit on Sales Realisation: OK (%)'::text)) AS profit_percent_ok,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'COP Percentage on MRP IK'::text)) AS cop_percent_mrp_ik,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'COP Percentage on MRP OK'::text)) AS cop_percent_mrp_ok,
            max(cost_sheet_line_monthly_snapshot.value_text) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Cost Sheet Status'::text)) AS cost_sheet_status,
            max(cost_sheet_line_monthly_snapshot.value_text) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Cost Sheet Note'::text)) AS cost_sheet_note,
            max(cost_sheet_line_monthly_snapshot.snapshot_refreshed_at) AS snapshot_refreshed_at,
            gr.refresh_run_id AS snapshot_refresh_run_id,
            gr.selection_basis AS snapshot_selection_basis
           FROM (costing.cost_sheet_line_monthly_snapshot
             JOIN costing.v_current_successful_costing_refresh_run gr ON (((gr.refresh_run_id = cost_sheet_line_monthly_snapshot.refresh_run_id) AND (gr.period_start = cost_sheet_line_monthly_snapshot.snapshot_period_start))))
          GROUP BY gr.refresh_run_id, gr.selection_basis, cost_sheet_line_monthly_snapshot.snapshot_period_start, cost_sheet_line_monthly_snapshot.product_id, cost_sheet_line_monthly_snapshot.product_name, cost_sheet_line_monthly_snapshot.category_name, cost_sheet_line_monthly_snapshot.subcategory_name, cost_sheet_line_monthly_snapshot.group_name, cost_sheet_line_monthly_snapshot.sub_group_name, cost_sheet_line_monthly_snapshot.sku_id, cost_sheet_line_monthly_snapshot.sku_column_label
        ), comparison AS (
         SELECT cur.snapshot_period_start,
            cur.product_id,
            cur.product_name,
            cur.category_name,
            cur.subcategory_name,
            cur.group_name,
            cur.sub_group_name,
            cur.sku_id,
            cur.sku_column_label,
            cur.rm_cost,
            cur.pm_cost,
            cur.total_material_cost,
            cur.direct_labour_cost,
            cur.manufacturing_cop,
            cur.internal_loaded_cost,
            cur.mrp_ik,
            cur.mrp_ok,
            cur.selling_price_ik,
            cur.selling_price_ok,
            cur.sales_realisation_ik,
            cur.sales_realisation_ok,
            cur.profit_value_ik,
            cur.profit_value_ok,
            cur.profit_percent_ik,
            cur.profit_percent_ok,
            cur.cop_percent_mrp_ik,
            cur.cop_percent_mrp_ok,
            cur.cost_sheet_status,
            cur.cost_sheet_note,
            cur.snapshot_refreshed_at,
            prev.snapshot_period_start AS previous_month_period_start,
            prev.manufacturing_cop AS previous_month_manufacturing_cop,
            prev.internal_loaded_cost AS previous_month_internal_loaded_cost,
            prev.selling_price_ik AS previous_month_selling_price_ik,
            prev.selling_price_ok AS previous_month_selling_price_ok,
            prev.profit_value_ik AS previous_month_profit_value_ik,
            prev.profit_value_ok AS previous_month_profit_value_ok,
            yoy.snapshot_period_start AS previous_year_period_start,
            yoy.manufacturing_cop AS previous_year_manufacturing_cop,
            yoy.internal_loaded_cost AS previous_year_internal_loaded_cost,
            yoy.selling_price_ik AS previous_year_selling_price_ik,
            yoy.selling_price_ok AS previous_year_selling_price_ok,
            yoy.profit_value_ik AS previous_year_profit_value_ik,
            yoy.profit_value_ok AS previous_year_profit_value_ok,
            cur.snapshot_refresh_run_id,
            cur.snapshot_selection_basis,
            prev.snapshot_refresh_run_id AS previous_month_refresh_run_id,
            prev.snapshot_selection_basis AS previous_month_selection_basis,
            yoy.snapshot_refresh_run_id AS previous_year_refresh_run_id,
            yoy.snapshot_selection_basis AS previous_year_selection_basis
           FROM ((line_pivot cur
             LEFT JOIN line_pivot prev ON (((prev.sku_id = cur.sku_id) AND (prev.snapshot_period_start = ((cur.snapshot_period_start - '1 mon'::interval))::date))))
             LEFT JOIN line_pivot yoy ON (((yoy.sku_id = cur.sku_id) AND (yoy.snapshot_period_start = ((cur.snapshot_period_start - '1 year'::interval))::date))))
        )
 SELECT snapshot_period_start,
    product_id,
    product_name,
    category_name,
    subcategory_name,
    group_name,
    sub_group_name,
    sku_id,
    sku_column_label,
    rm_cost,
    pm_cost,
    total_material_cost,
    direct_labour_cost,
    manufacturing_cop,
    internal_loaded_cost,
    mrp_ik,
    mrp_ok,
    selling_price_ik,
    selling_price_ok,
    sales_realisation_ik,
    sales_realisation_ok,
    profit_value_ik,
    profit_value_ok,
    profit_percent_ik,
    profit_percent_ok,
    cop_percent_mrp_ik,
    cop_percent_mrp_ok,
    cost_sheet_status,
    cost_sheet_note,
    snapshot_refreshed_at,
    previous_month_period_start,
    previous_month_manufacturing_cop,
    previous_month_internal_loaded_cost,
    previous_month_selling_price_ik,
    previous_month_selling_price_ok,
    previous_month_profit_value_ik,
    previous_month_profit_value_ok,
    previous_year_period_start,
    previous_year_manufacturing_cop,
    previous_year_internal_loaded_cost,
    previous_year_selling_price_ik,
    previous_year_selling_price_ok,
    previous_year_profit_value_ik,
    previous_year_profit_value_ok,
    (manufacturing_cop - previous_month_manufacturing_cop) AS manufacturing_cop_mom_change,
        CASE
            WHEN ((previous_month_manufacturing_cop IS NULL) OR (previous_month_manufacturing_cop = (0)::numeric)) THEN NULL::numeric
            ELSE (((manufacturing_cop - previous_month_manufacturing_cop) / previous_month_manufacturing_cop) * (100)::numeric)
        END AS manufacturing_cop_mom_change_percent,
    (internal_loaded_cost - previous_month_internal_loaded_cost) AS internal_loaded_cost_mom_change,
        CASE
            WHEN ((previous_month_internal_loaded_cost IS NULL) OR (previous_month_internal_loaded_cost = (0)::numeric)) THEN NULL::numeric
            ELSE (((internal_loaded_cost - previous_month_internal_loaded_cost) / previous_month_internal_loaded_cost) * (100)::numeric)
        END AS internal_loaded_cost_mom_change_percent,
    (profit_value_ik - previous_month_profit_value_ik) AS profit_value_ik_mom_change,
    (profit_value_ok - previous_month_profit_value_ok) AS profit_value_ok_mom_change,
    (manufacturing_cop - previous_year_manufacturing_cop) AS manufacturing_cop_yoy_change,
        CASE
            WHEN ((previous_year_manufacturing_cop IS NULL) OR (previous_year_manufacturing_cop = (0)::numeric)) THEN NULL::numeric
            ELSE (((manufacturing_cop - previous_year_manufacturing_cop) / previous_year_manufacturing_cop) * (100)::numeric)
        END AS manufacturing_cop_yoy_change_percent,
    (internal_loaded_cost - previous_year_internal_loaded_cost) AS internal_loaded_cost_yoy_change,
        CASE
            WHEN ((previous_year_internal_loaded_cost IS NULL) OR (previous_year_internal_loaded_cost = (0)::numeric)) THEN NULL::numeric
            ELSE (((internal_loaded_cost - previous_year_internal_loaded_cost) / previous_year_internal_loaded_cost) * (100)::numeric)
        END AS internal_loaded_cost_yoy_change_percent,
    (profit_value_ik - previous_year_profit_value_ik) AS profit_value_ik_yoy_change,
    (profit_value_ok - previous_year_profit_value_ok) AS profit_value_ok_yoy_change,
    snapshot_refresh_run_id,
    snapshot_selection_basis,
    CASE snapshot_selection_basis WHEN 'APPROVED'::text THEN ('Approved run '::text || snapshot_refresh_run_id) ELSE (('DRAFT run '::text || snapshot_refresh_run_id) || ' - not approved'::text) END AS snapshot_run_label,
    previous_month_refresh_run_id,
    previous_month_selection_basis,
    previous_year_refresh_run_id,
    previous_year_selection_basis
   FROM comparison;
comment on view costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed is 'W1: same as v_cost_sheet_snapshot_sku_monthly_comparison but one governed run per month (no run mixing); snapshot_selection_basis/snapshot_run_label show APPROVED vs DRAFT.';

-- 4. Public wrappers for the client / Sheets (permission-filtered like other costing pricing views)
create or replace view public.v_costing_pricing_price_revision_feed_approved as
  select * from costing.v_price_revision_feed_approved where ((CURRENT_USER = ANY (ARRAY['service_role'::name, 'postgres'::name])) OR app_has_permission('module:costing-control-center'::text, 'view'::text));
create or replace view public.v_costing_pricing_period_run_status as
  select * from costing.v_costing_period_run_status where ((CURRENT_USER = ANY (ARRAY['service_role'::name, 'postgres'::name])) OR app_has_permission('module:costing-control-center'::text, 'view'::text));
create or replace view public.v_cost_sheet_snapshot_sku_monthly_comparison_governed as
  select snapshot_period_start,
    product_id,
    product_name,
    category_name,
    subcategory_name,
    group_name,
    sub_group_name,
    sku_id,
    sku_column_label,
    rm_cost,
    pm_cost,
    total_material_cost,
    direct_labour_cost,
    manufacturing_cop,
    internal_loaded_cost,
    mrp_ik,
    mrp_ok,
    selling_price_ik,
    selling_price_ok,
    sales_realisation_ik,
    sales_realisation_ok,
    profit_value_ik,
    profit_value_ok,
    profit_percent_ik,
    profit_percent_ok,
    cop_percent_mrp_ik,
    cop_percent_mrp_ok,
    cost_sheet_status,
    cost_sheet_note,
    snapshot_refreshed_at,
    previous_month_period_start,
    previous_month_manufacturing_cop,
    previous_month_internal_loaded_cost,
    previous_month_selling_price_ik,
    previous_month_selling_price_ok,
    previous_month_profit_value_ik,
    previous_month_profit_value_ok,
    previous_year_period_start,
    previous_year_manufacturing_cop,
    previous_year_internal_loaded_cost,
    previous_year_selling_price_ik,
    previous_year_selling_price_ok,
    previous_year_profit_value_ik,
    previous_year_profit_value_ok,
    manufacturing_cop_mom_change,
    manufacturing_cop_mom_change_percent,
    internal_loaded_cost_mom_change,
    internal_loaded_cost_mom_change_percent,
    profit_value_ik_mom_change,
    profit_value_ok_mom_change,
    manufacturing_cop_yoy_change,
    manufacturing_cop_yoy_change_percent,
    internal_loaded_cost_yoy_change,
    internal_loaded_cost_yoy_change_percent,
    profit_value_ik_yoy_change,
    profit_value_ok_yoy_change,
    snapshot_refresh_run_id, snapshot_selection_basis, snapshot_run_label,
    previous_month_refresh_run_id, previous_month_selection_basis, previous_year_refresh_run_id, previous_year_selection_basis
  from costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed where ((CURRENT_USER = ANY (ARRAY['service_role'::name, 'postgres'::name])) OR app_has_permission('module:costing-control-center'::text, 'view'::text));

revoke all on costing.v_price_revision_feed_approved, costing.v_costing_period_run_status, costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed from public, anon, authenticated;
grant select on costing.v_price_revision_feed_approved, costing.v_costing_period_run_status, costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed to service_role;
revoke all on public.v_costing_pricing_price_revision_feed_approved, public.v_costing_pricing_period_run_status, public.v_cost_sheet_snapshot_sku_monthly_comparison_governed from public, anon;
grant select on public.v_costing_pricing_price_revision_feed_approved, public.v_costing_pricing_period_run_status, public.v_cost_sheet_snapshot_sku_monthly_comparison_governed to authenticated, service_role;

do $post$
declare n_appr int; n_feed int; n_bad int;
begin
  if md5(pg_get_viewdef('costing.v_cost_sheet_snapshot_sku_monthly_comparison'::regclass)) <> '7e3254c229aaec04e5467a6886584d60'
     or md5(pg_get_viewdef('costing.v_current_successful_costing_refresh_run'::regclass)) <> '5cc25791985abf5d336fb9311da3d6f1' then
    raise exception 'W1 postcheck: an existing view changed'; end if;
  -- every approved month in the feed has exactly the row count of its approved run's cost sheet
  select count(*) into n_bad from (
    select f.period_start, f.refresh_run_id, count(*) n from costing.v_price_revision_feed_approved f group by 1,2) f
    join (select d.period_start, d.refresh_run_id, count(*) n from costing.v_sku_detailed_cost_sheet d group by 1,2) d using (period_start, refresh_run_id)
    where f.n <> d.n;
  if n_bad > 0 then raise exception 'W1 postcheck: feed row counts differ from approved runs'; end if;
  -- the feed holds only APPROVED runs
  select count(*) into n_bad from costing.v_price_revision_feed_approved f
    left join costing.v_costing_run_effective_designation e on e.refresh_run_id = f.refresh_run_id
    where e.designation is distinct from 'APPROVED';
  if n_bad > 0 then raise exception 'W1 postcheck: non-approved run in feed'; end if;
  -- governed comparison holds one run per month
  select count(*) into n_bad from (select snapshot_period_start from costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed
    group by 1 having count(distinct snapshot_refresh_run_id) > 1) z;
  if n_bad > 0 then raise exception 'W1 postcheck: governed comparison mixes runs'; end if;
end $post$;
