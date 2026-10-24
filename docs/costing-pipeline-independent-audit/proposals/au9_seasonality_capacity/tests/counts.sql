\pset format unaligned
\pset tuples_only on
select 'counts app='||(select count(*) from costing.machine_applicability_class)||' eq='||(select count(*) from costing.machine_equipment_class)||' profiles='||(select count(*) from costing.plant_capacity_profile)||' fallback='||(select count(*) from costing.capacity_fallback_policy)||' revisions='||(select count(*) from costing.capacity_master_revision)
 ||' state_md5='||md5((select string_agg((to_jsonb(p)-'created_at')::text,'|' order by id) from costing.plant_capacity_profile p)||(select string_agg((to_jsonb(f)-'created_at')::text,'|' order by id) from costing.capacity_fallback_policy f)||(select string_agg((to_jsonb(r)-'at')::text,'|' order by id) from costing.capacity_master_revision r));
select 'applicability '||applicability_class||'='||count(*) from costing.plant_capacity_profile group by applicability_class order by 1;
select 'readiness '||readiness||'='||count(*) from costing.v_plant_capacity_readiness group by readiness order by 1;
select 'fallback '||fallback_source||'='||count(*)||' ['||string_agg(resource_class_code||coalesce('#'||legacy_capacity_id,''),',' order by resource_class_code)||']' from costing.capacity_fallback_policy group by fallback_source;
select 'evidence '||evidence_type||' rated='||count(rated_capacity)||' n='||count(*) from costing.plant_capacity_profile group by evidence_type;
select 'effective_from='||string_agg(distinct effective_from::text,',')||' provisional_all='||bool_and(is_provisional) from costing.plant_capacity_profile;
