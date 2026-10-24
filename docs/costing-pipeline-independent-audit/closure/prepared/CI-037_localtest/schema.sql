create schema costing;
create table costing.costing_refresh_run (
 "id" bigint not null,
 "period_start" date not null,
 "requested_scope" text not null,
 "source_trigger" text not null,
 "request_note" text,
 "requested_by" uuid,
 "requested_at" timestamp with time zone not null,
 "started_at" timestamp with time zone,
 "finished_at" timestamp with time zone,
 "overall_status" text not null,
 "current_stage_code" text,
 "error_stage_code" text,
 "error_message" text,
 "latest_stage_order" integer,
 "material_snapshot_status" text,
 "cost_build_status" text,
 "cost_sheet_status" text,
 "control_status" text,
 "final_snapshot_status" text,
 "final_blocked_count" bigint,
 "final_review_required_count" bigint,
 "final_ready_count" bigint,
 "created_at" timestamp with time zone not null,
 "updated_at" timestamp with time zone not null,
 "valuation_date" date not null,
 "period_status_at_request" text not null,
 "valuation_date_status_at_request" text not null,
 "valuation_context_source" text not null,
 "valuation_context_captured_at" timestamp with time zone not null);
alter table costing.costing_refresh_run add primary key (id);
create table costing.sku_internal_loaded_cost_snapshot (
 "id" bigint not null,
 "period_start" date not null,
 "sku_id" bigint not null,
 "product_id" bigint not null,
 "product_name" text,
 "pack_size" numeric,
 "pack_uom" text,
 "material_cost_per_sku" numeric,
 "direct_labour_cost_per_sku" numeric,
 "production_overhead_cost_per_sku" numeric,
 "quality_control_overhead_cost_per_sku" numeric,
 "materials_stores_overhead_cost_per_sku" numeric,
 "prime_cost_per_sku" numeric,
 "manufacturing_cop_per_sku" numeric,
 "admin_overhead_cost_per_sku" numeric,
 "finance_admin_overhead_cost_per_sku" numeric,
 "internal_loaded_cost_per_sku" numeric,
 "manufacturing_cop_status" text,
 "admin_overhead_allocation_status" text,
 "finance_admin_overhead_allocation_status" text,
 "internal_loaded_cost_status" text,
 "internal_loaded_cost_note" text,
 "refreshed_at" timestamp with time zone not null,
 "valuation_date" date,
 "refresh_run_id" bigint,
 "allocation_basis_snapshot_id" bigint,
 "allocation_basis_source" text,
 "allocation_resolution_status" text,
 "allocation_resolution_note" text);
alter table costing.sku_internal_loaded_cost_snapshot add primary key (id);
create table costing.sku_internal_material_conversion_snapshot (
 "id" bigint not null,
 "period_start" date not null,
 "valuation_date" date not null,
 "refresh_run_id" bigint not null,
 "sku_id" bigint not null,
 "product_id" bigint not null,
 "product_name" text,
 "pack_size" numeric,
 "pack_uom" text,
 "sku_base_qty_per_unit" numeric,
 "internal_source_line_count" bigint not null,
 "internal_conversion_cost_per_product_base_uom" numeric,
 "internal_conversion_cost_per_sku" numeric,
 "conversion_status" text not null,
 "conversion_reason_code" text,
 "conversion_note" text,
 "evidence_json" jsonb not null,
 "refreshed_at" timestamp with time zone not null);
alter table costing.sku_internal_material_conversion_snapshot add primary key (id);
create table costing.sku_manufacturing_cop_snapshot (
 "id" bigint not null,
 "period_start" date not null,
 "sku_id" bigint not null,
 "product_id" bigint not null,
 "product_name" text,
 "pack_size" numeric,
 "pack_uom" text,
 "rm_cost_per_sku" numeric,
 "pm_cost_per_sku" numeric,
 "material_cost_per_sku" numeric,
 "direct_labour_cost_per_sku" numeric,
 "production_overhead_cost_per_sku" numeric,
 "quality_control_overhead_cost_per_sku" numeric,
 "materials_stores_overhead_cost_per_sku" numeric,
 "prime_cost_per_sku" numeric,
 "manufacturing_cop_per_sku" numeric,
 "material_costing_status" text,
 "direct_labour_allocation_status" text,
 "production_overhead_allocation_status" text,
 "quality_control_overhead_allocation_status" text,
 "materials_stores_overhead_allocation_status" text,
 "manufacturing_cop_status" text,
 "manufacturing_cop_note" text,
 "refreshed_at" timestamp with time zone not null,
 "valuation_date" date,
 "refresh_run_id" bigint,
 "allocation_basis_snapshot_id" bigint,
 "allocation_basis_source" text,
 "allocation_resolution_status" text,
 "allocation_resolution_note" text,
 "internal_material_conversion_cost_per_sku" numeric,
 "internal_material_conversion_status" text);
alter table costing.sku_manufacturing_cop_snapshot add primary key (id);
create table costing.sku_pricing_bridge_snapshot (
 "id" bigint not null,
 "period_start" date not null,
 "sku_id" bigint not null,
 "product_id" bigint not null,
 "product_name" text,
 "pack_size" numeric,
 "pack_uom" text,
 "mrp_ik" numeric,
 "mrp_ok" numeric,
 "manufacturing_cop_per_sku" numeric,
 "internal_loaded_cost_per_sku" numeric,
 "marketing_expense_cost_per_sku" numeric,
 "pricing_cost_per_sku" numeric,
 "ik_margin_amount_before_scheme" numeric,
 "ok_margin_amount_before_scheme" numeric,
 "ik_margin_percent_before_scheme" numeric,
 "ok_margin_percent_before_scheme" numeric,
 "internal_loaded_cost_status" text,
 "marketing_expense_allocation_status" text,
 "pricing_bridge_status" text,
 "pricing_bridge_note" text,
 "refreshed_at" timestamp with time zone not null,
 "valuation_date" date not null,
 "refresh_run_id" bigint not null,
 "mrp_policy_id" bigint,
 "mrp_policy_effective_from" date,
 "mrp_policy_effective_to" date,
 "mrp_resolution_status" text not null,
 "mrp_qualifying_policy_count" bigint not null,
 "mrp_resolution_note" text not null,
 "internal_loaded_cost_snapshot_id" bigint,
 "marketing_expense_allocation_snapshot_id" bigint,
 "allocation_basis_snapshot_id" bigint,
 "allocation_basis_source" text,
 "allocation_resolution_status" text,
 "allocation_resolution_note" text,
 "regional_marketing_allocation_snapshot_id_ik" bigint,
 "regional_marketing_allocation_snapshot_id_ok" bigint,
 "marketing_expense_cost_per_sku_ik" numeric,
 "marketing_expense_cost_per_sku_ok" numeric,
 "pricing_cost_per_sku_ik" numeric,
 "pricing_cost_per_sku_ok" numeric,
 "marketing_expense_allocation_status_ik" text,
 "marketing_expense_allocation_status_ok" text,
 "pricing_bridge_status_ik" text,
 "pricing_bridge_status_ok" text,
 "pricing_bridge_note_ik" text,
 "pricing_bridge_note_ok" text);
alter table costing.sku_pricing_bridge_snapshot add primary key (id);
create table costing.sku_selected_scheme_policy_context_snapshot (
 "id" bigint not null,
 "period_start" date not null,
 "valuation_date" date not null,
 "refresh_run_id" bigint not null,
 "sku_id" bigint not null,
 "product_id" bigint not null,
 "region_code" text not null,
 "scheme_master_context_snapshot_id" bigint not null,
 "scheme_id" bigint not null,
 "scheme_name" text not null,
 "paid_qty" numeric not null,
 "free_qty" numeric not null,
 "total_qty" numeric not null,
 "policy_rule_id" bigint,
 "policy_source" text not null,
 "policy_scope" text,
 "priority_sort" integer,
 "apply_mode" text,
 "replace_from_scheme_id" bigint,
 "effective_from" date,
 "effective_to" date,
 "policy_updated_at" timestamp with time zone,
 "resolution_status" text not null,
 "resolution_note" text not null,
 "qualifying_candidate_count" bigint not null,
 "captured_at" timestamp with time zone not null);
alter table costing.sku_selected_scheme_policy_context_snapshot add primary key (id);
create table costing.sku_selling_price_bridge_snapshot (
 "id" bigint not null,
 "period_start" date not null,
 "sku_id" bigint not null,
 "product_id" bigint not null,
 "product_name" text,
 "pack_size" numeric,
 "pack_uom" text,
 "mrp_ik" numeric,
 "mrp_ok" numeric,
 "gst_percent" numeric,
 "ik_basic_price" numeric,
 "ok_basic_price" numeric,
 "ik_discount_percent" numeric,
 "ok_discount_percent" numeric,
 "ik_discount_amount" numeric,
 "ok_discount_amount" numeric,
 "ik_selling_price" numeric,
 "ok_selling_price" numeric,
 "contingency_percent" numeric,
 "ik_contingency_value" numeric,
 "ok_contingency_value" numeric,
 "pricing_bridge_status" text,
 "selling_price_bridge_status" text,
 "selling_price_bridge_note" text,
 "refreshed_at" timestamp with time zone not null,
 "valuation_date" date not null,
 "refresh_run_id" bigint not null,
 "selling_price_policy_id" bigint,
 "policy_effective_from" date,
 "policy_effective_to" date,
 "policy_resolution_status" text not null,
 "qualifying_policy_count" bigint not null,
 "policy_resolution_note" text not null,
 "pricing_bridge_snapshot_id" bigint,
 "allocation_basis_snapshot_id" bigint,
 "allocation_basis_source" text,
 "allocation_resolution_status" text,
 "allocation_resolution_note" text,
 "mrp_policy_id" bigint,
 "mrp_policy_effective_from" date,
 "mrp_policy_effective_to" date,
 "mrp_resolution_status" text,
 "mrp_qualifying_policy_count" bigint,
 "mrp_resolution_note" text,
 "pricing_bridge_status_ik" text,
 "pricing_bridge_status_ok" text,
 "pricing_bridge_note_ik" text,
 "pricing_bridge_note_ok" text,
 "selling_price_bridge_status_ik" text,
 "selling_price_bridge_status_ok" text,
 "selling_price_bridge_note_ik" text,
 "selling_price_bridge_note_ok" text);
alter table costing.sku_selling_price_bridge_snapshot add primary key (id);
create table public.categories (
 "id" integer not null,
 "category_name" text not null);
alter table public.categories add primary key (id);
create table public.product_groups (
 "id" integer not null,
 "sub_category_id" integer not null,
 "group_name" text not null,
 "kind_id" integer not null);
alter table public.product_groups add primary key (id);
create table public.product_skus (
 "id" bigint not null,
 "product_id" bigint not null,
 "pack_size" numeric not null,
 "uom" text not null,
 "is_active" boolean not null,
 "is_sample" boolean not null,
 "price_list_ik" boolean not null,
 "price_list_ok" boolean not null);
alter table public.product_skus add primary key (id);
create table public.products (
 "id" integer not null,
 "item" text not null,
 "sub_group_id" integer not null,
 "malayalam_name" text,
 "status" text not null,
 "uom_base" text,
 "conversion_to_base" numeric,
 "is_seasonal" boolean,
 "is_llt" boolean,
 "manufacture_lead_time_months" integer,
 "season_profile_id" integer,
 "is_pto" boolean not null);
alter table public.products add primary key (id);
create table public.sub_categories (
 "id" integer not null,
 "category_id" integer not null,
 "subcategory_name" text not null);
alter table public.sub_categories add primary key (id);
create table public.sub_groups (
 "id" integer not null,
 "product_group_id" integer not null,
 "sub_group_name" text not null);
alter table public.sub_groups add primary key (id);
create table costing.costing_run_designation (
 "id" bigint not null,
 "refresh_run_id" bigint not null,
 "period_start" date not null,
 "designation" text not null,
 "designated_by" text not null,
 "designated_by_uid" uuid,
 "designated_at" timestamp with time zone not null,
 "reason" text not null,
 "fingerprint_id" bigint);
alter table costing.costing_run_designation add primary key (id);
create table costing.costing_run_fingerprint (
 "id" bigint not null,
 "refresh_run_id" bigint not null,
 "purpose" text not null,
 "captured_by" text not null,
 "captured_at" timestamp with time zone not null,
 "fingerprint" jsonb not null,
 "algorithm_version" text,
 "scoped_table_set_md5" text);
alter table costing.costing_run_fingerprint add primary key (id);
alter table costing.costing_run_fingerprint alter column id add generated by default as identity; alter table costing.costing_run_designation alter column id add generated by default as identity; alter table costing.sku_pricing_bridge_snapshot alter column id add generated by default as identity;
CREATE OR REPLACE FUNCTION costing.fn_run_fingerprint_current_columns(p_table text)
 RETURNS text[]
 LANGUAGE sql
 STABLE
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
  select array_agg(a.attname::text order by a.attnum)
  from pg_attribute a where a.attrelid = format('costing.%I', p_table)::regclass and a.attnum > 0 and not a.attisdropped
$function$
;
CREATE OR REPLACE FUNCTION costing.fn_run_fingerprint_table_hash(p_table text, p_refresh_run_id bigint, p_cols text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare v_row text; v_n bigint; v_h text; v_missing text[];
begin
  select array_agg(c) into v_missing from unnest(p_cols) c where not (c = any (costing.fn_run_fingerprint_current_columns(p_table)));
  if v_missing is not null then
    raise exception 'W5_FINGERPRINT_COLUMNS_MISSING: costing.% no longer has column(s) %', p_table, v_missing;
  end if;
  v_row := 'row(' || (select string_agg(format('x.%I', c), ',' order by o) from unnest(p_cols) with ordinality u(c, o)) || ')::text';
  execute format('select count(*), md5(coalesce(string_agg(%s, %L order by %s), %L)) from costing.%I x where x.refresh_run_id = $1',
                 v_row, '|', v_row, '', p_table)
    into v_n, v_h using p_refresh_run_id;
  return jsonb_build_object('rows', v_n, 'md5', v_h, 'cols', to_jsonb(p_cols));
end $function$
;
CREATE OR REPLACE FUNCTION costing.fn_costing_run_scoped_tables()
 RETURNS SETOF text LANGUAGE sql STABLE SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
  select c.relname::text from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='costing' and c.relkind='r' and c.relname like '%snapshot%'
    and exists (select 1 from pg_attribute a where a.attrelid=c.oid and a.attname='refresh_run_id' and not a.attisdropped)
  order by 1
$function$;
CREATE OR REPLACE FUNCTION costing.fn_verify_run_fingerprint(p_refresh_run_id bigint)
 RETURNS TABLE(table_name text, captured jsonb, current_value jsonb, matches boolean)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare v_cap jsonb; k text; v_cols text[]; v_cur jsonb;
begin
  select f.fingerprint into v_cap from costing.costing_run_fingerprint f where f.refresh_run_id = p_refresh_run_id
   order by f.captured_at desc, f.id desc limit 1;
  if v_cap is null then return; end if;
  for k in select key from jsonb_object_keys(v_cap) key union select s from costing.fn_costing_run_scoped_tables() s order by 1 loop
    begin
      if v_cap ? k and v_cap->k ? 'cols' then
        select array_agg(c order by o) into v_cols from jsonb_array_elements_text(v_cap->k->'cols') with ordinality u(c, o);
      else
        v_cols := costing.fn_run_fingerprint_current_columns(k);   -- legacy capture: whole row, exactly as before
      end if;
      v_cur := costing.fn_run_fingerprint_table_hash(k, p_refresh_run_id, v_cols);
    exception when others then
      v_cur := jsonb_build_object('error', sqlerrm);
    end;
    continue when not (v_cap ? k) and (v_cur->>'rows')::bigint = 0;   -- scoped table with no rows for this run and not captured
    table_name := k; captured := v_cap->k; current_value := v_cur;
    matches := v_cap ? k and v_cur ? 'md5'
               and (v_cap->k->>'rows') is not distinct from (v_cur->>'rows') and (v_cap->k->>'md5') is not distinct from (v_cur->>'md5');
    return next;
  end loop;
end $function$
;
CREATE OR REPLACE FUNCTION costing.fn_compute_run_fingerprint(p_refresh_run_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare t text; v_e jsonb; v jsonb := '{}'::jsonb;
begin
  for t in select * from costing.fn_costing_run_scoped_tables() loop
    v_e := costing.fn_run_fingerprint_table_hash(t, p_refresh_run_id, costing.fn_run_fingerprint_current_columns(t));
    if (v_e->>'rows')::bigint > 0 then v := v || jsonb_build_object(t, v_e); end if;
  end loop;
  return v;
end $function$
;
create view costing.v_costing_run_effective_designation as  SELECT DISTINCT ON (refresh_run_id) refresh_run_id,
    period_start,
    designation,
    designated_by,
    designated_at,
    reason,
    fingerprint_id,
    id AS designation_id
   FROM costing.costing_run_designation d
  ORDER BY refresh_run_id, designated_at DESC, id DESC;
create view costing.v_current_successful_costing_refresh_run as  SELECT refresh_run_id,
    period_start,
    valuation_date,
    overall_status,
    valuation_context_source,
    source_trigger,
    requested_scope,
    requested_at,
    started_at,
    finished_at,
    selection_basis
   FROM ( SELECT r.id AS refresh_run_id,
            r.period_start,
            r.valuation_date,
            r.overall_status,
            r.valuation_context_source,
            r.source_trigger,
            r.requested_scope,
            r.requested_at,
            r.started_at,
            r.finished_at,
                CASE e.designation
                    WHEN 'APPROVED'::text THEN 'APPROVED'::text
                    WHEN 'REFERENCE'::text THEN 'REFERENCE_FALLBACK'::text
                    ELSE 'LATEST_SUCCESS'::text
                END AS selection_basis,
            row_number() OVER (PARTITION BY r.period_start ORDER BY (
                CASE e.designation
                    WHEN 'APPROVED'::text THEN 1
                    WHEN 'REFERENCE'::text THEN 3
                    ELSE 2
                END), r.finished_at DESC NULLS LAST, r.id DESC) AS governed_run_rank
           FROM costing.costing_refresh_run r
             LEFT JOIN costing.v_costing_run_effective_designation e ON e.refresh_run_id = r.id AND (e.designation = ANY (ARRAY['REFERENCE'::text, 'APPROVED'::text]))
          WHERE r.overall_status = 'SUCCESS'::text AND r.valuation_context_source = 'CAPTURED_AT_REQUEST'::text) ranked
  WHERE governed_run_rank = 1;
CREATE OR REPLACE FUNCTION costing.fn_guard_designated_run_rows()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare v_run bigint; v_des text;
begin
  v_run := case when tg_op='DELETE' then old.refresh_run_id else new.refresh_run_id end;
  if tg_op='UPDATE' and old.refresh_run_id is distinct from new.refresh_run_id then
    select designation into v_des from costing.v_costing_run_effective_designation where refresh_run_id=old.refresh_run_id;
    if v_des in ('REFERENCE','APPROVED','REVOKED') then
      raise exception 'AU2_DESIGNATED_RUN_IMMUTABLE: run % is %; % on costing.% prohibited', old.refresh_run_id, v_des, tg_op, tg_table_name using errcode='P0001';
    end if;
  end if;
  if v_run is not null then
    select designation into v_des from costing.v_costing_run_effective_designation where refresh_run_id=v_run;
    if v_des in ('REFERENCE','APPROVED','REVOKED') then
      raise exception 'AU2_DESIGNATED_RUN_IMMUTABLE: run % is %; % on costing.% prohibited', v_run, v_des, tg_op, tg_table_name using errcode='P0001';
    end if;
  end if;
  return case when tg_op='DELETE' then old else new end;
end $function$
;
CREATE OR REPLACE FUNCTION costing.fn_guard_snapshot_truncate()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
begin
  raise exception 'AU2_SNAPSHOT_TRUNCATE_PROHIBITED: TRUNCATE on costing.% would destroy run history', tg_table_name using errcode='P0001';
end $function$
;
create trigger trg_au2_designated_run_guard before insert or delete or update on costing.sku_pricing_bridge_snapshot for each row execute function costing.fn_guard_designated_run_rows();
create trigger trg_au2_snapshot_truncate_guard before truncate on costing.sku_pricing_bridge_snapshot for each statement execute function costing.fn_guard_snapshot_truncate();
create trigger trg_au2_designated_run_guard before insert or delete or update on costing.sku_selling_price_bridge_snapshot for each row execute function costing.fn_guard_designated_run_rows();
create trigger trg_au2_snapshot_truncate_guard before truncate on costing.sku_selling_price_bridge_snapshot for each statement execute function costing.fn_guard_snapshot_truncate();
create trigger trg_au2_designated_run_guard before insert or delete or update on costing.sku_selected_scheme_policy_context_snapshot for each row execute function costing.fn_guard_designated_run_rows();
create trigger trg_au2_snapshot_truncate_guard before truncate on costing.sku_selected_scheme_policy_context_snapshot for each statement execute function costing.fn_guard_snapshot_truncate();
create trigger trg_au2_designated_run_guard before insert or delete or update on costing.sku_internal_loaded_cost_snapshot for each row execute function costing.fn_guard_designated_run_rows();
create trigger trg_au2_snapshot_truncate_guard before truncate on costing.sku_internal_loaded_cost_snapshot for each statement execute function costing.fn_guard_snapshot_truncate();
create view costing.v_sku_detailed_cost_sheet as  SELECT pb.period_start,
    pb.sku_id,
    pb.product_id,
    pb.product_name,
    pb.pack_size,
    pb.pack_uom,
    pb.mrp_ik,
    pb.mrp_ok,
    ilc.material_cost_per_sku,
    ilc.direct_labour_cost_per_sku,
    ilc.prime_cost_per_sku,
    ilc.production_overhead_cost_per_sku,
    ilc.quality_control_overhead_cost_per_sku,
    ilc.materials_stores_overhead_cost_per_sku,
    ilc.manufacturing_cop_per_sku,
    ilc.admin_overhead_cost_per_sku,
    ilc.finance_admin_overhead_cost_per_sku,
    ilc.internal_loaded_cost_per_sku,
    pb.marketing_expense_cost_per_sku,
    pb.pricing_cost_per_sku,
    sp.gst_percent,
    sp.ik_basic_price,
    sp.ok_basic_price,
    sp.ik_discount_percent,
    sp.ok_discount_percent,
    sp.ik_discount_amount,
    sp.ok_discount_amount,
    sp.ik_selling_price,
    sp.ok_selling_price,
    sp.contingency_percent,
    sp.ik_contingency_value,
    sp.ok_contingency_value,
    pb.ik_margin_amount_before_scheme,
    pb.ik_margin_percent_before_scheme,
    pb.ok_margin_amount_before_scheme,
    pb.ok_margin_percent_before_scheme,
    ilc.internal_loaded_cost_status,
    pb.pricing_bridge_status,
    sp.selling_price_bridge_status,
        CASE
            WHEN ilc.internal_loaded_cost_status = 'BLOCKED'::text OR pb.pricing_bridge_status = 'BLOCKED'::text OR sp.selling_price_bridge_status = 'BLOCKED'::text THEN 'BLOCKED'::text
            WHEN ilc.internal_loaded_cost_status = 'REVIEW_REQUIRED'::text OR pb.pricing_bridge_status = 'REVIEW_REQUIRED'::text OR sp.selling_price_bridge_status = 'REVIEW_REQUIRED'::text THEN 'REVIEW_REQUIRED'::text
            WHEN ilc.internal_loaded_cost_status = 'READY'::text AND pb.pricing_bridge_status = 'READY'::text AND sp.selling_price_bridge_status = 'READY'::text THEN 'READY'::text
            ELSE 'BLOCKED'::text
        END AS cost_sheet_status,
        CASE
            WHEN ilc.internal_loaded_cost_status = 'BLOCKED'::text THEN COALESCE(ilc.internal_loaded_cost_note, 'Internal loaded cost is blocked.'::text)
            WHEN pb.pricing_bridge_status = 'BLOCKED'::text THEN COALESCE(pb.pricing_bridge_note, 'Pricing Bridge is blocked.'::text)
            WHEN sp.selling_price_bridge_status = 'BLOCKED'::text THEN COALESCE(sp.selling_price_bridge_note, 'Selling Price Bridge is blocked.'::text)
            WHEN ilc.internal_loaded_cost_status = 'REVIEW_REQUIRED'::text THEN COALESCE(ilc.internal_loaded_cost_note, 'Internal loaded cost requires review.'::text)
            WHEN pb.pricing_bridge_status = 'REVIEW_REQUIRED'::text THEN COALESCE(pb.pricing_bridge_note, 'Pricing Bridge requires review.'::text)
            WHEN sp.selling_price_bridge_status = 'REVIEW_REQUIRED'::text THEN COALESCE(sp.selling_price_bridge_note, 'Selling Price Bridge requires review.'::text)
            WHEN ilc.internal_loaded_cost_status = 'READY'::text AND pb.pricing_bridge_status = 'READY'::text AND sp.selling_price_bridge_status = 'READY'::text THEN 'Cost sheet is ready.'::text
            ELSE 'Cost sheet is blocked because one or more exact-tuple source rows or statuses are missing.'::text
        END AS cost_sheet_note,
    GREATEST(COALESCE(ilc.refreshed_at, '1970-01-01 00:00:00+00'::timestamp with time zone), COALESCE(pb.refreshed_at, '1970-01-01 00:00:00+00'::timestamp with time zone), COALESCE(sp.refreshed_at, '1970-01-01 00:00:00+00'::timestamp with time zone)) AS refreshed_at,
    pb.valuation_date,
    pb.refresh_run_id,
    ic.internal_conversion_cost_per_sku AS internal_material_conversion_cost_per_sku
   FROM costing.sku_pricing_bridge_snapshot pb
     LEFT JOIN costing.sku_internal_loaded_cost_snapshot ilc ON ilc.period_start = pb.period_start AND ilc.valuation_date = pb.valuation_date AND ilc.refresh_run_id = pb.refresh_run_id AND ilc.sku_id = pb.sku_id
     LEFT JOIN costing.sku_selling_price_bridge_snapshot sp ON sp.period_start = pb.period_start AND sp.valuation_date = pb.valuation_date AND sp.refresh_run_id = pb.refresh_run_id AND sp.sku_id = pb.sku_id
     LEFT JOIN costing.sku_internal_material_conversion_snapshot ic ON ic.period_start = pb.period_start AND ic.valuation_date = pb.valuation_date AND ic.refresh_run_id = pb.refresh_run_id AND ic.sku_id = pb.sku_id;
CREATE OR REPLACE FUNCTION costing.rpc_refresh_manufacturing_cop_chain(p_period_start date, p_valuation_date date, p_refresh_run_id bigint)
 RETURNS TABLE(refreshed_period_start date, inserted_row_count bigint, blocked_count bigint, review_required_count bigint, ready_count bigint, refresh_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare
    v_period_start date := date_trunc('month',p_period_start)::date;
    v_run costing.costing_refresh_run%rowtype;
    v_lock_key bigint;
    v_lock_acquired boolean := false;
    v_log_id bigint;
    v_result record;
begin
    if p_period_start is null then raise exception 'Costing period is required'; end if;
    if p_valuation_date is null then raise exception 'Valuation date is required'; end if;
    if p_refresh_run_id is null then raise exception 'Refresh run ID is required'; end if;

    select * into v_run from costing.costing_refresh_run r where r.id=p_refresh_run_id;
    if not found then raise exception 'Costing refresh run % does not exist',p_refresh_run_id; end if;

    if v_run.period_start is distinct from v_period_start
       or v_run.valuation_date is distinct from p_valuation_date then
        raise exception 'Stage 03 context does not match refresh run %',p_refresh_run_id;
    end if;
    if v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then
        raise exception 'Refresh run % is not based on captured valuation context',p_refresh_run_id;
    end if;

    v_lock_key:=hashtext('costing_stage03_'||p_refresh_run_id::text)::bigint;
    v_lock_acquired:=pg_try_advisory_xact_lock(v_lock_key);
    if not v_lock_acquired then
        return query select v_period_start,0::bigint,0::bigint,0::bigint,0::bigint,'SKIPPED'::text;
        return;
    end if;

    insert into costing.costing_refresh_log(period_start,status,refresh_scope)
    values(v_period_start,'RUNNING','COST_BUILD_TO_SCHEME') returning id into v_log_id;

    begin
        perform * from costing.rpc_ensure_cost_period(v_period_start);
        perform * from costing.rpc_refresh_sku_sales_allocation_basis_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
        perform * from costing.rpc_refresh_marketing_signed_billed_sales_evidence_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
        perform * from costing.rpc_refresh_marketing_regional_sales_evidence_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
        perform * from costing.rpc_refresh_sku_regional_marketing_allocation_basis_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
        perform * from costing.rpc_refresh_cost_pool_monthly_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
        perform * from costing.rpc_refresh_sku_direct_labour_allocation_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
        perform costing.rpc_refresh_production_overhead_workload_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
        

        -- Canonical QC chain: effective-spec workload, Product monetary allocation, SKU conversion.
        perform * from costing.rpc_refresh_product_qc_workload_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
        perform * from costing.rpc_refresh_qc_monetary_allocation_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);

        -- Canonical Materials / Stores chain: governed RM/PM workload and whole-pool monetary allocation.
        perform * from costing.rpc_refresh_materials_stores_workload_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
        perform * from costing.rpc_refresh_materials_stores_allocation_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);

        -- Combined overhead consumes canonical QC and Materials / Stores allocations.
        -- Production Overhead remains on its current provisional formula pending its own driver workstream.
        perform * from costing.rpc_refresh_sku_overhead_allocation_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);

        perform * from costing.rpc_refresh_sku_admin_finance_overhead_allocation_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
        perform * from costing.rpc_refresh_sku_marketing_expense_allocation_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
        perform * from costing.rpc_refresh_sku_regional_marketing_expense_allocation_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
        perform * from costing.rpc_refresh_sku_prime_cost_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
        perform * from costing.rpc_refresh_sku_manufacturing_cop_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
        perform * from costing.rpc_refresh_sku_internal_loaded_cost_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
        perform * from costing.rpc_refresh_sku_pricing_bridge_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
        perform * from costing.rpc_refresh_sku_selling_price_bridge_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
        perform * from costing.rpc_refresh_scheme_master_context_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
        perform * from costing.rpc_refresh_sku_selected_scheme_policy_context_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);

        select * into v_result
        from costing.rpc_refresh_sku_scheme_viability_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);

        update costing.costing_refresh_log
        set status='SUCCESS',refresh_finished_at=clock_timestamp(),
            inserted_row_count=v_result.inserted_row_count,
            blocked_count=v_result.blocked_count,
            review_required_count=v_result.review_required_count,
            ready_count=v_result.ready_count
        where id=v_log_id;
        return query select v_result.refreshed_period_start,v_result.inserted_row_count,
                            v_result.blocked_count,v_result.review_required_count,
                            v_result.ready_count,'SUCCESS'::text;
        return;
    exception when others then
        update costing.costing_refresh_log
        set status='FAILED',refresh_finished_at=clock_timestamp(),error_message=sqlerrm
        where id=v_log_id;
        raise;
    end;
end;
$function$
;
revoke all on function costing.rpc_refresh_manufacturing_cop_chain(date,date,bigint) from public;
-- Live text of costing.v_price_revision_current_approved_master, captured read-only 24 Oct 2026 (pg_get_viewdef). 64 columns. Owner postgres.
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
do $$ declare r record; begin
for r in select c.oid::regclass t from pg_class c join pg_attribute a on a.attrelid=c.oid and a.attname='id' join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in ('costing','public') and a.atttypid in ('int8'::regtype,'int4'::regtype) and a.attidentity='' loop
 execute format('alter table %s alter column id add generated by default as identity', r.t); end loop; end $$;
