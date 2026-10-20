do $$
declare v text; target text;
begin
foreach target in array array['v_mrp_rm_by_batch','v_mrp_rm_trace_batch'] loop
select pg_get_viewdef(('public.'||target)::regclass,true) into v;
if position('FROM bmr_details b' in v)=0 then raise exception 'Expected source absent in %',target;end if;
v:=replace(v,'FROM bmr_details b','FROM (SELECT * FROM public.bmr_details WHERE lifecycle_status=''ACTIVE'') b');
execute format('create or replace view public.%I as %s',target,v);
end loop;
select pg_get_viewdef('public.bmr_card_not_initiated'::regclass,true) into v;
if position('WHERE dw.id IS NULL' in v)=0 then raise exception 'Expected not-initiated filter absent';end if;
v:=replace(v,'WHERE dw.id IS NULL','WHERE dw.id IS NULL AND bd.lifecycle_status=''ACTIVE''');
execute 'create or replace view public.bmr_card_not_initiated as '||v;
end $$;