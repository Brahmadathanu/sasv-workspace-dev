-- PREPARED (not applied). CI-010: "provisional" mixes values the user supplied with values that were assumed or estimated.
-- Both capacity tables are close-only/append-only, so origin is classified by a read view (no row edited, no switch changed):
--   USER_SUPPLIED            plant row evidence_type USER_DECLARED (approval USER-CORRECTED-20261018-AU9-R2), or class row stated as a user value
--   ASSUMED                  a USER_DECLARED row whose data_flags carry ASSUMPTION_*; a class value copied from another class
--                            ("... value applied"); a class with no capacity row (single load per batch)
--   ESTIMATED                plant row evidence_type NAME_DERIVED (rated capacity read from the machine name)
--   FIXED_RULE               class rows "Fixed: 1 per batch"
--   CLASS_DEFAULT:<origin>   plant row with no value (NONE) whose class falls back to the class row: inherits that row's origin
--   MISSING                  no value and no fallback
-- The October runs (122/128) use the 16 class rows (plant-aware loads switch off); plant rows apply only once the switch is approved.
do $g$
begin
  if to_regclass('costing.v_capacity_value_origin') is not null then raise exception 'TB7_GUARD: view already exists'; end if;
  if (select count(*) from costing.route_equipment_load_capacity) <> 16 then raise exception 'TB7_GUARD: class rows changed (expected 16)'; end if;
end $g$;

create view costing.v_capacity_value_origin with (security_invoker = true) as
with cls as (
  select 'CLASS'::text as source_table, r.id, null::int as plant_id, r.resource_class_code, r.equipment_class_code,
         coalesce(r.capacity_kg, r.capacity_l) as value, case when r.capacity_kg is not null then 'kg' when r.capacity_l is not null then 'L' end as unit,
         r.is_provisional, r.source_note as basis_note, r.approval_reference,
         case when r.source_note ilike 'Fixed:%' then 'FIXED_RULE'
              when r.source_note ilike '%value applied%' then 'ASSUMED'
              when r.source_note ilike '%user value%' and r.source_note ilike 'Evidence:%' then 'USER_SUPPLIED'
              when r.source_note ilike '%user value%' then 'USER_SUPPLIED'
              else 'ASSUMED' end as value_origin,
         r.effective_from, r.effective_to
    from costing.route_equipment_load_capacity r
), cls_default as (
  select f.resource_class_code, f.fallback_allowed, f.fallback_source, c.value_origin, c.value, c.unit
    from costing.capacity_fallback_policy f left join cls c on c.id = f.legacy_capacity_id
   where f.effective_to is null and f.equipment_class_code is null
)
select * from cls
union all
select 'PLANT', p.id, p.plant_id, p.resource_class_code, p.equipment_class_code,
       coalesce(p.effective_capacity, p.rated_capacity, d.value), coalesce(p.physical_unit, d.unit),
       p.is_provisional, concat_ws(' | ', p.evidence_type, p.evidence_reference, p.data_flags), p.approval_reference,
       case when p.evidence_type = 'USER_DECLARED' and coalesce(p.data_flags,'') ~ 'ASSUMPTION' then 'ASSUMED'
            when p.evidence_type = 'USER_DECLARED' then 'USER_SUPPLIED'
            when p.evidence_type = 'NAME_DERIVED' then 'ESTIMATED'
            when d.fallback_allowed and d.value_origin is not null then 'CLASS_DEFAULT:' || d.value_origin
            when d.fallback_allowed then 'ASSUMED'
            else 'MISSING' end,
       p.effective_from, p.effective_to
  from costing.plant_capacity_profile p
  left join cls_default d on d.resource_class_code = p.resource_class_code;
comment on view costing.v_capacity_value_origin is 'CI-010 (closure 2026-10): which capacity values the user supplied, assumed, estimated or missing';
revoke all on costing.v_capacity_value_origin from public, anon;
grant select on costing.v_capacity_value_origin to authenticated, service_role;
