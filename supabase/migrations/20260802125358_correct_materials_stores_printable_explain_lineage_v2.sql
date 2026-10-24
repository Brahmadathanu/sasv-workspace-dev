-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $do$
declare
    v_def text;
    v_new text;
begin
    select pg_get_viewdef('public.v_costing_pricing_printable_cost_sheet_lines'::regclass, true)
    into v_def;

    v_new := replace(
        v_def,
        $old$'Materials and stores handling overhead allocated to the SKU.'::text,'Materials/stores overhead pool allocated by product sales share and SKU pack quantity.'::text,b.materials_stores_overhead_cost_per_sku,NULL::text,'currency'::text,'Source: exact overhead allocation snapshot.'::text$old$,
        $new$'Materials and stores handling overhead absorbed by the SKU from the frozen monthly Stores pool.'::text,'Frozen Materials / Stores pool × governed SKU RM/PM workload share; monthly SKU allocation ÷ governed monthly SKU units.'::text,b.materials_stores_overhead_cost_per_sku,NULL::text,'currency'::text,'Source: canonical exact-run Materials / Stores workload and monetary allocation snapshots.'::text$new$
    );

    if v_new = v_def then
        raise exception 'Materials / Stores printable wording target was not found';
    end if;

    execute 'create or replace view public.v_costing_pricing_printable_cost_sheet_lines as ' || v_new;
end
$do$;

create or replace function costing.fn_cost_sheet_trace_source_snapshot(
    p_section_code text,
    p_line_label text
)
returns text
language sql
stable
as $function$
    select
        case
            when p_line_label in (
                'Raw Material Cost (RM)',
                'Packing & Labelling Material Cost (PM)',
                'Total Material Cost'
            ) then
                'costing.v_sku_material_cost_build'

            when p_line_label = 'Direct Labour (DL)' then
                'costing.v_staff_cost_pool_monthly / costing.v_sku_detailed_cost_sheet'

            when p_line_label = 'Materials / Stores Overhead' then
                'costing.sku_materials_stores_workload_snapshot / costing.sku_materials_stores_allocation_snapshot / costing.sku_overhead_allocation_snapshot'

            when p_line_label in (
                'Production Overhead',
                'Quality Control Overhead',
                'Administrative Overhead',
                'Finance Admin Overhead',
                'Marketing Expense'
            ) then
                'public.v_costing_cost_pool_monthly_summary / costing.v_sku_detailed_cost_sheet'

            when p_line_label in (
                'Manufacturing COP',
                'Internal Loaded Cost'
            ) then
                'costing.v_sku_detailed_cost_sheet'

            when p_section_code in ('C_IK_PRICING', 'D_OK_PRICING')
                 and (
                        p_line_label ilike 'MRP:%'
                     or p_line_label ilike 'GST Rate%'
                     or p_line_label ilike 'Discount:%'
                     or p_line_label ilike 'Contingency / Other Expense:%'
                     or p_line_label ilike 'Selected Scheme:%'
                 ) then
                'public.v_costing_policy_manager_sku_overview'

            when p_section_code in ('C_IK_PRICING', 'D_OK_PRICING')
                 and (
                        p_line_label ilike 'Basic Price:%'
                     or p_line_label ilike 'Discount Value:%'
                     or p_line_label ilike 'Selling Price:%'
                     or p_line_label ilike 'Contingency / Other Expense Value:%'
                 ) then
                'costing.v_sku_detailed_cost_sheet'

            when p_section_code in ('C_IK_PRICING', 'D_OK_PRICING')
                 and (
                        p_line_label ilike 'Scheme Value:%'
                     or p_line_label ilike 'Sales Realisation:%'
                 ) then
                'costing.v_sku_scheme_comparison'

            when p_section_code = 'E_PROFIT' then
                'costing.v_sku_scheme_comparison / costing.v_sku_detailed_cost_sheet'

            when p_section_code = 'Z_STATUS' then
                'costing.v_sku_costing_control_status'

            else
                'public.v_costing_pricing_printable_cost_sheet_lines'
        end;
$function$;

comment on function costing.fn_cost_sheet_trace_source_snapshot(text,text) is
'Canonical Cost Sheet trace source resolver. Materials / Stores resolves to exact-run workload, allocation and combined-overhead snapshots.';