-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $do$
declare
  v_def text;
  v_new text;
  v_join_pattern text := E'\\n\\s*join costing\\.v_sku_detailed_cost_sheet d\\s*\\n\\s*on d\\.period_start = m\\.period_start\\s*\\n\\s*and d\\.valuation_date = m\\.valuation_date\\s*\\n\\s*and d\\.refresh_run_id = m\\.refresh_run_id\\s*\\n\\s*and d\\.sku_id = m\\.sku_id';
  v_status_case text := $status$case
                when il.internal_loaded_cost_status = 'BLOCKED'
                  or pb.pricing_bridge_status = 'BLOCKED'
                  or sp.selling_price_bridge_status = 'BLOCKED'
                    then 'BLOCKED'
                when il.internal_loaded_cost_status = 'REVIEW_REQUIRED'
                  or pb.pricing_bridge_status = 'REVIEW_REQUIRED'
                  or sp.selling_price_bridge_status = 'REVIEW_REQUIRED'
                    then 'REVIEW_REQUIRED'
                when il.internal_loaded_cost_status = 'READY'
                 and pb.pricing_bridge_status = 'READY'
                 and sp.selling_price_bridge_status = 'READY'
                    then 'READY'
                else 'BLOCKED'
            end as cost_sheet_status$status$;
  v_note_case text := $note$case
                when il.internal_loaded_cost_status = 'BLOCKED'
                    then coalesce(il.internal_loaded_cost_note,'Internal loaded cost is blocked.')
                when pb.pricing_bridge_status = 'BLOCKED'
                    then coalesce(pb.pricing_bridge_note,'Pricing Bridge is blocked.')
                when sp.selling_price_bridge_status = 'BLOCKED'
                    then coalesce(sp.selling_price_bridge_note,'Selling Price Bridge is blocked.')
                when il.internal_loaded_cost_status = 'REVIEW_REQUIRED'
                    then coalesce(il.internal_loaded_cost_note,'Internal loaded cost requires review.')
                when pb.pricing_bridge_status = 'REVIEW_REQUIRED'
                    then coalesce(pb.pricing_bridge_note,'Pricing Bridge requires review.')
                when sp.selling_price_bridge_status = 'REVIEW_REQUIRED'
                    then coalesce(sp.selling_price_bridge_note,'Selling Price Bridge requires review.')
                when il.internal_loaded_cost_status = 'READY'
                 and pb.pricing_bridge_status = 'READY'
                 and sp.selling_price_bridge_status = 'READY'
                    then 'Cost sheet is ready.'
                else 'Cost sheet is blocked because one or more exact-tuple source rows or statuses are missing.'
            end as cost_sheet_note$note$;
  v_analyze text := $analyze$

    analyze costing.sku_material_cost_snapshot;
    analyze costing.sku_prime_cost_snapshot;
    analyze costing.sku_manufacturing_cop_snapshot;
    analyze costing.sku_internal_loaded_cost_snapshot;
    analyze costing.sku_pricing_bridge_snapshot;
    analyze costing.sku_selling_price_bridge_snapshot;
    analyze costing.sku_scheme_viability_snapshot;
$analyze$;
begin
  select pg_get_functiondef('costing.rpc_refresh_exact_sku_control_snapshot(date,date,bigint)'::regprocedure)
    into v_def;

  if (length(v_def)-length(replace(v_def,'join costing.v_sku_detailed_cost_sheet d','')))/length('join costing.v_sku_detailed_cost_sheet d') <> 1 then
    raise exception 'Expected exactly one detailed cost sheet join';
  end if;
  if (length(v_def)-length(replace(v_def,'d.cost_sheet_status','')))/length('d.cost_sheet_status') <> 1
     or (length(v_def)-length(replace(v_def,'d.cost_sheet_note','')))/length('d.cost_sheet_note') <> 1 then
    raise exception 'Expected exactly one cost_sheet status/note reference';
  end if;
  if position('perform set_config(''costing.control_snapshot_stage05_validated'',''1'',true);' in v_def)=0 then
    raise exception 'Validated-context anchor not found';
  end if;

  v_new := replace(v_def,
    'perform set_config(''costing.control_snapshot_stage05_validated'',''1'',true);',
    'perform set_config(''costing.control_snapshot_stage05_validated'',''1'',true);' || v_analyze);

  v_new := replace(v_new,'d.cost_sheet_status',v_status_case);
  v_new := replace(v_new,'d.cost_sheet_note',v_note_case);
  v_new := regexp_replace(v_new,v_join_pattern,'','n');

  if position('join costing.v_sku_detailed_cost_sheet d' in v_new)<>0 then
    raise exception 'Detailed cost sheet join still present after rewrite';
  end if;
  if position('d.cost_sheet_status' in v_new)<>0 or position('d.cost_sheet_note' in v_new)<>0 then
    raise exception 'Detailed cost sheet references still present after rewrite';
  end if;
  if position('analyze costing.sku_scheme_viability_snapshot;' in v_new)=0 then
    raise exception 'ANALYZE block missing after rewrite';
  end if;

  execute v_new;
end $do$;