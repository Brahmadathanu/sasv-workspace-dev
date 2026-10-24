-- REVIEW ONLY, NOT DEPLOYED. Switch table is EMPTY.
CREATE OR REPLACE FUNCTION costing.fn_au9_g4_resolve_step_load(p_resource_class_code text, p_solid_kg numeric, p_output_qty numeric, p_output_uom text, p_valuation_date date, p_base_step_id bigint, p_override_id bigint, p_activity_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare
  d date := p_valuation_date;
  v_plant int; v_link text; v_act int; v_ok boolean;
  v_pr record; v_rule record; v_cls record; v_fb record; v_leg record;
  v_basis text; v_flags text[] := '{}'; v_qty numeric; v_cap numeric; v_unit text; v_cb text; v_loads numeric;
  v_profile bigint; v_rev bigint; v_eq text; v_rule_id bigint; v_fb_id bigint; v_leg_id bigint; v_prov boolean; v_n int;
  v_try_rule boolean := true;
begin
  if d is null or d < date '2026-10-23' then
    raise exception 'AU-9 G4: plant-aware loads are not available for valuation date % (effective from 23 Oct 2026 only)', d;
  end if;
  if p_resource_class_code is null then raise exception 'AU-9 G4: route step without a resource class'; end if;

  -- 1. machine link and activity from the governed route lineage (product override first, then route step)
  select coalesce(o.plant_id, b.plant_id),
         case when o.plant_id is not null then 'PRODUCT_OVERRIDE' when b.plant_id is not null then 'ROUTE_STEP' end,
         coalesce(o.activity_id, b.activity_id),
         (p_override_id is null or o.id is not null) and (p_base_step_id is null or b.id is not null)
    into v_plant, v_link, v_act, v_ok
    from (select 1) one
    left join costing.product_process_route_override o on o.id = p_override_id
    left join costing.production_route_family_route_step b on b.id = p_base_step_id;
  if not v_ok then
    raise exception 'AU-9 G4: route step lineage not found (route step %, override %)', p_base_step_id, p_override_id;
  end if;
  if p_activity_id is not null and v_act is not null and p_activity_id <> v_act then
    raise exception 'AU-9 G4: step evidence activity % differs from governed route activity %', p_activity_id, v_act;
  end if;
  v_act := coalesce(v_act, p_activity_id);

  if v_plant is not null then
    select p.*, pm.status::text plant_status, mac.participates_in_load_calc
      into v_pr
      from costing.plant_capacity_profile p
      join public.plant_machinery pm on pm.id = p.plant_id
      join costing.machine_applicability_class mac on mac.code = p.applicability_class
     where p.plant_id = v_plant and p.effective_from <= d and (p.effective_to is null or p.effective_to > d);
    if not found then
      raise exception 'AU-9 G4: route step names machine % but it has no capacity profile effective on % (fail-closed)', v_plant, d;
    end if;
    v_profile := v_pr.id; v_eq := v_pr.equipment_class_code; v_prov := v_pr.is_provisional;
    select max(r.id) into v_rev from costing.capacity_master_revision r
     where r.entity = 'plant_capacity_profile' and r.entity_id = v_pr.id and r.action in ('CREATE','SUPERSEDE');
    if v_pr.applicability_class = 'UNKNOWN' then
      raise exception 'AU-9 G4: machine % on the route is unclassified; classify it before costing (fail-closed)', v_plant;
    elsif not v_pr.participates_in_load_calc then
      v_flags := array_append(v_flags, 'LINKED_MACHINE_NOT_CAPACITY_LIMITING'::text);
    elsif v_pr.resource_class_code is distinct from p_resource_class_code then
      v_flags := array_append(v_flags, 'LINKED_MACHINE_OTHER_RESOURCE_CLASS'::text);
    elsif v_pr.plant_status <> 'O' then
      v_flags := array_append(v_flags, 'LINKED_MACHINE_NOT_OPERATIONAL'::text);
    elsif v_pr.capacity_mode = 'THROUGHPUT' then
      v_basis := 'THROUGHPUT_MACHINE_T1_CLASS_LOT'; v_try_rule := false;
      v_flags := array_append(v_flags, 'T1_RATED_THROUGHPUT_NOT_A_COSTING_BASIS'::text);
    elsif v_pr.capacity_mode = 'CHARGE' and v_pr.effective_capacity is not null and v_pr.physical_unit is not null then
      v_basis := 'EXPLICIT_MACHINE'; v_cap := v_pr.effective_capacity; v_unit := v_pr.physical_unit; v_cb := v_pr.charge_basis;
    else
      v_flags := array_append(v_flags, 'LINKED_MACHINE_CAPACITY_PENDING'::text);
    end if;
  end if;

  -- 2. approved step rule (activity) when no usable machine capacity
  if v_basis is null and v_try_rule and v_act is not null then
    select r.* into v_rule from costing.route_step_capacity_rule r
     where r.resource_class_code = p_resource_class_code and r.activity_id = v_act
       and r.effective_from <= d and (r.effective_to is null or r.effective_to > d);
    if found then
      v_rule_id := v_rule.id;
      if v_rule.resolution = 'EQUIPMENT_CLASS_CAPACITY' then
        select count(*) n, count(distinct p.effective_capacity) nc, min(p.effective_capacity) cap, min(p.id) pid,
               bool_or(p.is_provisional) prov, count(distinct p.charge_basis) ncb, min(p.charge_basis) cb,
               count(distinct p.physical_unit) nu, min(p.physical_unit) u
          into v_cls
          from costing.plant_capacity_profile p
          join public.plant_machinery pm on pm.id = p.plant_id and pm.status = 'O'
         where p.equipment_class_code = v_rule.equipment_class_code and p.capacity_mode = 'CHARGE'
           and p.effective_capacity is not null and p.effective_from <= d and (p.effective_to is null or p.effective_to > d);
        if v_cls.n = 0 then
          raise exception 'AU-9 G4: step rule % needs an operational % machine with capacity on % (fail-closed)', v_rule.rule_code, v_rule.equipment_class_code, d;
        elsif v_cls.nc > 1 or v_cls.ncb > 1 or v_cls.nu > 1 then
          raise exception 'AU-9 G4: step rule % is ambiguous: % machines of class % have different capacities; name the machine on the route', v_rule.rule_code, v_cls.n, v_rule.equipment_class_code;
        end if;
        v_basis := 'STEP_RULE_EQUIPMENT_CLASS'; v_cap := v_cls.cap; v_unit := v_cls.u; v_cb := v_cls.cb;
        v_profile := v_cls.pid; v_eq := v_rule.equipment_class_code; v_prov := v_cls.prov; v_n := v_cls.n; v_link := v_link || '_NOT_USABLE';
        select max(r.id) into v_rev from costing.capacity_master_revision r
         where r.entity = 'plant_capacity_profile' and r.entity_id = v_cls.pid and r.action in ('CREATE','SUPERSEDE');
      else
        v_basis := 'STEP_RULE_T1_CLASS_LOT';
      end if;
    end if;
  end if;

  -- 3a. machine or class capacity: loads = ceil(charge / capacity), at least 1 (no time element)
  if v_basis in ('EXPLICIT_MACHINE','STEP_RULE_EQUIPMENT_CLASS') then
    if v_cb = 'SOLID_CHARGE_KG' and v_unit = 'kg' then
      v_qty := coalesce(p_solid_kg, 0);
    elsif v_cb = 'OUTPUT_VOLUME_L' and v_unit = 'L' then
      if p_output_uom is distinct from 'L' then
        raise exception 'AU-9 G4: machine capacity is in litres but the batch output is in % (no conversion assumed)', p_output_uom;
      end if;
      v_qty := coalesce(p_output_qty, 0);
    else
      raise exception 'AU-9 G4: unsupported capacity basis % / % for loads', v_cb, v_unit;
    end if;
    if v_rev is null then raise exception 'AU-9 G4: capacity profile % has no revision journal entry', v_profile; end if;
    v_loads := greatest(1::numeric, ceil(v_qty / v_cap));
  else
    -- 3b. approved class fallback (T1 lot, or no usable machine/rule)
    v_basis := coalesce(v_basis, 'CLASS_FALLBACK');
    select f.* into v_fb from costing.capacity_fallback_policy f
     where f.resource_class_code = p_resource_class_code and (f.equipment_class_code is null or f.equipment_class_code = v_eq)
       and f.effective_from <= d and (f.effective_to is null or f.effective_to > d)
     order by (f.equipment_class_code is null), f.id limit 1;
    if not found then
      raise exception 'AU-9 G4: no usable capacity and no approved fallback for resource class % on % (fail-closed)', p_resource_class_code, d;
    end if;
    v_fb_id := v_fb.id; v_flags := array_append(v_flags, v_fb.review_flag);
    if not v_fb.fallback_allowed or v_fb.fallback_source = 'BLOCK' then
      raise exception 'AU-9 G4: fallback for resource class % is blocked; capacity required (fail-closed)', p_resource_class_code;
    elsif v_fb.fallback_source = 'NO_CAPACITY_ROW_SINGLE_LOAD' then
      v_loads := 1; v_cb := 'SINGLE_LOAD';
    else
      select c.* into v_leg from costing.route_equipment_load_capacity c
       where c.resource_class_code = p_resource_class_code and c.is_resource_class_default
         and c.effective_from <= d and (c.effective_to is null or c.effective_to >= d)
       order by c.effective_from desc limit 1;
      if not found or v_leg.id <> v_fb.legacy_capacity_id then
        raise exception 'AU-9 G4: fallback policy % points to class capacity % but the effective class default is % (re-approve)', v_fb.id, v_fb.legacy_capacity_id, v_leg.id;
      end if;
      v_leg_id := v_leg.id;
      if v_leg.load_basis = 'FIXED' then
        v_loads := 1; v_cb := 'FIXED';
      else
        v_cb := v_leg.charge_basis;
        v_qty := coalesce(case when v_leg.charge_basis = 'OUTPUT' then p_output_qty else p_solid_kg end, 0);
        v_cap := case when v_leg.charge_basis = 'OUTPUT' and p_output_uom = 'L' then coalesce(v_leg.capacity_l, v_leg.capacity_kg)
                      else coalesce(v_leg.capacity_kg, v_leg.capacity_l) end;
        v_unit := case when v_leg.charge_basis = 'OUTPUT' and p_output_uom = 'L' and v_leg.capacity_l is not null then 'L' else 'kg' end;
        v_loads := greatest(1::numeric, ceil(v_qty / v_cap));
      end if;
      v_prov := v_leg.is_provisional;
    end if;
  end if;

  return jsonb_build_object('loads', v_loads, 'resolution_basis', v_basis, 'machine_link_source', v_link, 'plant_id', v_plant,
    'equipment_class_code', v_eq, 'capacity_profile_id', v_profile, 'capacity_revision_id', v_rev, 'class_machine_count', v_n,
    'step_rule_id', v_rule_id, 'fallback_policy_id', v_fb_id, 'legacy_capacity_id', v_leg_id, 'charge_basis', v_cb,
    'charge_qty', v_qty, 'capacity', v_cap, 'capacity_unit', v_unit, 'is_provisional', v_prov, 'activity_id', v_act,
    'review_flags', to_jsonb(v_flags));
end $function$
;
