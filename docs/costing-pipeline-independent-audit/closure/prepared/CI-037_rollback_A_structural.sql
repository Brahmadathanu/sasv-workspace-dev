-- CI-037 ROLLBACK A — immediate structural rollback. PREPARED, NOT APPLIED.
-- Valid ONLY before any run holds CI-037 data. Refuses if sku_pricing_bridge_profit_snapshot has any row.
-- Restores: chain function text (hook removed), approved-master view (64 columns, from
-- CI-037_snapshot_approved_master_view_pre.sql), its owner, privileges, reloptions and column comments
-- (CI-037_snapshot_view_metadata_pre.json), drops the side table and helper, clears the legacy comments.
begin;
do $do$
begin
  if to_regclass('costing.sku_pricing_bridge_profit_snapshot') is not null
     and exists (select 1 from costing.sku_pricing_bridge_profit_snapshot) then
    raise exception 'CI037_ROLLBACK_A_REFUSED: CI-037 data exists for runs %; use CI-037_rollback_B_post_use.sql',
      (select string_agg(distinct refresh_run_id::text, ',') from costing.sku_pricing_bridge_profit_snapshot);
  end if;
end $do$;

do $do$
declare v_def text; v_hook constant text := 'perform costing.fn_ci037_fill_pricing_bridge_profit(p_refresh_run_id);'; v_n int;
begin
  v_def := pg_get_functiondef('costing.rpc_refresh_manufacturing_cop_chain(date,date,bigint)'::regprocedure);
  v_n := (length(v_def) - length(replace(v_def, v_hook, ''))) / length(v_hook);
  if v_n > 1 then raise exception 'CI037_UNHOOK: hook found % times; manual review needed', v_n; end if;
  if v_n = 1 then
    execute regexp_replace(v_def, E'\n[ \t]*' || replace(replace(v_hook, '(', '\('), ')', '\)'), '');
    if pg_get_functiondef('costing.rpc_refresh_manufacturing_cop_chain(date,date,bigint)'::regprocedure) like '%' || v_hook || '%' then
      raise exception 'CI037_UNHOOK: hook still present after removal';
    end if;
    raise notice 'CI037_UNHOOK: removed';
  else
    raise notice 'CI037_UNHOOK: not present; no change';
  end if;
end $do$;

drop view costing.v_price_revision_current_approved_master;
create view costing.v_price_revision_current_approved_master as
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
    to_char((d.refreshed_at AT TIME ZONE 'Asia/Kolkata'::text), 'DD Mon YYYY, FMHH12:MI AM'::text) || ' IST'::text AS refreshed_at_ist
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
     JOIN costing.sku_selected_scheme_policy_context_snapshot so ON so.refresh_run_id = a.refresh_run_id AND so.sku_id = d.sku_id AND so.region_code = 'OK'::text;
alter view costing.v_price_revision_current_approved_master owner to postgres;
-- Captured baseline: relacl NULL (owner-only); anon/authenticated/service_role have no privileges. Re-assert explicitly.
do $do$
begin
  -- Revoke only if a default privilege granted something; keeps relacl NULL exactly as captured when nothing was granted.
  if has_table_privilege('anon','costing.v_price_revision_current_approved_master','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or has_table_privilege('authenticated','costing.v_price_revision_current_approved_master','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or has_table_privilege('service_role','costing.v_price_revision_current_approved_master','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
    revoke all on costing.v_price_revision_current_approved_master from public, anon, authenticated, service_role;
  end if;
end $do$;
comment on column costing.v_price_revision_current_approved_master.material_cost_per_sku is 'Material Cost = RM Cost + PM Cost; approved per-SKU values.';
comment on column costing.v_price_revision_current_approved_master.internal_material_conversion_cost_per_sku is 'Additional conversion expenses of approved internally manufactured source materials: upstream direct labour, production overhead, QC overhead and incremental stores overhead (including recursive earlier stages), scaled by BOM consumption per finished SKU. Zero if no eligible source lineage. Source-material RM value is already in RM Cost.';
comment on column costing.v_price_revision_current_approved_master.prime_cost_per_sku is 'Prime Cost = Material Cost + Direct Labour + Internal Material Conversion Cost.';
comment on column costing.v_price_revision_current_approved_master.manufacturing_cop_per_sku is 'Manufacturing COP = Prime Cost + Production Overhead + QC Overhead + Materials/Stores Overhead.';
comment on column costing.v_price_revision_current_approved_master.internal_loaded_cost_per_sku is 'Internal Loaded Cost = Manufacturing COP + Administration Overhead + Finance Administration Overhead.';
comment on column costing.v_price_revision_current_approved_master.pricing_cost_per_sku_ik is 'IK Pricing Cost = Internal Loaded Cost + canonical IK Marketing Expense.';
comment on column costing.v_price_revision_current_approved_master.pricing_cost_per_sku_ok is 'OK Pricing Cost = Internal Loaded Cost + canonical OK Marketing Expense.';
comment on column costing.v_price_revision_current_approved_master.ik_basic_price is 'IK Basic Price = IK MRP / (1 + GST % / 100).';
comment on column costing.v_price_revision_current_approved_master.ok_basic_price is 'OK Basic Price = OK MRP / (1 + GST % / 100).';
comment on column costing.v_price_revision_current_approved_master.ik_discount_amount is 'IK Discount Amount = governed IK discount adjustment from approved selling-price policy.';
comment on column costing.v_price_revision_current_approved_master.ok_discount_amount is 'OK Discount Amount = governed OK discount adjustment from approved selling-price policy.';
comment on column costing.v_price_revision_current_approved_master.ik_selling_price is 'IK Selling Price = IK Basic Price - IK Discount Amount (before scheme/contingency).';
comment on column costing.v_price_revision_current_approved_master.ok_selling_price is 'OK Selling Price = OK Basic Price - OK Discount Amount (before scheme/contingency).';
comment on column costing.v_price_revision_current_approved_master.ik_contingency_value is 'IK Contingency Value = IK Basic Price × Contingency % / 100 under frozen pricing snapshot.';
comment on column costing.v_price_revision_current_approved_master.ok_contingency_value is 'OK Contingency Value = OK Basic Price × Contingency % / 100 under frozen pricing snapshot.';
comment on column costing.v_price_revision_current_approved_master.ik_margin_amount_before_scheme is 'IK Margin Before Scheme = IK MRP - IK Pricing Cost (approved pre-scheme pricing bridge; not net-realisation profit).';
comment on column costing.v_price_revision_current_approved_master.ik_margin_percent_before_scheme is 'IK Margin Before Scheme % = 100 × IK Margin Before Scheme / IK MRP. Not equivalent to proposed after-scheme Profit on MRP.';
comment on column costing.v_price_revision_current_approved_master.ok_margin_amount_before_scheme is 'OK Margin Before Scheme = OK MRP - OK Pricing Cost (approved pre-scheme pricing bridge; not net-realisation profit).';
comment on column costing.v_price_revision_current_approved_master.ok_margin_percent_before_scheme is 'OK Margin Before Scheme % = 100 × OK Margin Before Scheme / OK MRP. Not equivalent to proposed after-scheme Profit on MRP.';
comment on column costing.v_price_revision_current_approved_master.price_list_ik is 'IK price-list membership from public.product_skus; TRUE=included, FALSE=excluded, NULL=source SKU membership not yet verified.';
comment on column costing.v_price_revision_current_approved_master.price_list_ok is 'OK price-list membership from public.product_skus; TRUE=included, FALSE=excluded, NULL=source SKU membership not yet verified.';
comment on column costing.v_price_revision_current_approved_master.refreshed_at_ist is 'Human-readable last refresh timestamp in Indian Standard Time (Asia/Kolkata), derived from exact refreshed_at UTC timestamp. Display-only, canonical audit timestamp remains refreshed_at.';
do $do$
declare r record;
begin
  for r in select * from (values ('anon',false),('authenticated',false),('service_role',false),('postgres',true)) v(role, expected) loop
    if has_table_privilege(r.role,'costing.v_price_revision_current_approved_master','SELECT') is distinct from r.expected
       or has_table_privilege(r.role,'costing.v_price_revision_current_approved_master','INSERT') is distinct from r.expected
       or has_table_privilege(r.role,'costing.v_price_revision_current_approved_master','UPDATE') is distinct from r.expected
       or has_table_privilege(r.role,'costing.v_price_revision_current_approved_master','DELETE') is distinct from r.expected then
      raise exception 'CI037_ROLLBACK: privilege for % differs from captured baseline', r.role;
    end if;
  end loop;
  if (select pg_get_userbyid(relowner) from pg_class where oid='costing.v_price_revision_current_approved_master'::regclass) <> 'postgres' then raise exception 'CI037_ROLLBACK: owner differs'; end if;
  if (select reloptions from pg_class where oid='costing.v_price_revision_current_approved_master'::regclass) is not null then raise exception 'CI037_ROLLBACK: reloptions differ (expected none, i.e. no security_invoker)'; end if;
  if (select count(*) from pg_attribute where attrelid='costing.v_price_revision_current_approved_master'::regclass and attnum>0 and not attisdropped) <> 64 then raise exception 'CI037_ROLLBACK: view does not have 64 columns'; end if;
  if (select count(*) from pg_attribute where attrelid='costing.v_price_revision_current_approved_master'::regclass and attnum>0 and col_description(attrelid,attnum) is not null) <> 22 then raise exception 'CI037_ROLLBACK: column comment count differs'; end if;
end $do$;

drop function if exists costing.fn_ci037_fill_pricing_bridge_profit(bigint);
drop table if exists costing.sku_pricing_bridge_profit_snapshot;
comment on column costing.sku_pricing_bridge_snapshot.ik_margin_amount_before_scheme is null;
comment on column costing.sku_pricing_bridge_snapshot.ok_margin_amount_before_scheme is null;
comment on column costing.sku_pricing_bridge_snapshot.ik_margin_percent_before_scheme is null;
comment on column costing.sku_pricing_bridge_snapshot.ok_margin_percent_before_scheme is null;
commit;
