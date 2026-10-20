do $$
declare v text; target text; needle text; replacement text;
begin
foreach target in array array['v_mrp_rm_by_batch','v_mrp_rm_trace_batch'] loop
 select pg_get_viewdef(('public.'||target)::regclass,true) into v;
 needle:=case when target='v_mrp_rm_by_batch' then 'FROM combined;' else 'FROM combined c;' end;
 replacement:=case when target='v_mrp_rm_by_batch' then 'FROM combined WHERE NOT EXISTS (SELECT 1 FROM public.bmr_details x WHERE x.id=combined.batch_id AND x.lifecycle_status<>''ACTIVE'');'
 else 'FROM combined c WHERE NOT EXISTS (SELECT 1 FROM public.bmr_details x WHERE x.id=c.batch_id AND x.lifecycle_status<>''ACTIVE'');' end;
 if position(needle in v)=0 then raise exception 'final combined source changed for %',target;end if;
 execute format('create or replace view public.%I as %s',target,replace(v,needle,replacement));
end loop;
end $$;