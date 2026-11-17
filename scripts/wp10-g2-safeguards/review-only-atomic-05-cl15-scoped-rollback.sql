-- REVIEW ONLY — scoped rollback of a hypothetically installed combined 05+CL15 package.
-- This file is NOT authorized for production execution. It never drops applied WP10 01/02/03/06.
-- All six functions/triggers must carry exact origin+definition receipts; fail closed on drift.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $check$
declare rec record; v oid; c text;
begin
 for rec in select * from (values
  ('public.fn_wp10_product_route_impact_before()','WP10-G2 05_product_route_impact_guard.sql md5:'),
  ('public.fn_wp10_product_route_impact_after()','WP10-G2 05_product_route_impact_guard.sql md5:'),
  ('public.fn_wp10_activation_parent_lock()','WP10-CL15 activation-parent-lock md5:')
 ) as x(sig,receipt) loop
  v:=to_regprocedure(rec.sig);
  if v is null then raise exception 'rollback fail closed: function % absent',rec.sig; end if;
  c:=obj_description(v,'pg_proc');
  if c is null or left(c,length(rec.receipt))<>rec.receipt or
    substring(c from length(rec.receipt)+1)<>md5(pg_get_functiondef(v))
  then raise exception 'rollback fail closed: receipt drift %',rec.sig; end if;
 end loop;
 for rec in select * from (values
  ('public.products','trg_wp10_product_route_impact_before','WP10-G2 05_product_route_impact_guard.sql md5:'),
  ('public.products','trg_wp10_product_route_impact_after','WP10-G2 05_product_route_impact_guard.sql md5:'),
  ('public.product_skus','trg_aa_wp10_activation_parent_lock','WP10-CL15 activation-parent-lock md5:')
 ) as x(tbl,tg,receipt) loop
  select t.oid into v from pg_trigger t where t.tgrelid=rec.tbl::regclass and
    t.tgname=rec.tg and not t.tgisinternal;
  if v is null then raise exception 'rollback fail closed: trigger % missing',rec.tg; end if;
  c:=obj_description(v,'pg_trigger');
  if c is null or left(c,length(rec.receipt))<>rec.receipt or
    substring(c from length(rec.receipt)+1)<>md5(pg_get_triggerdef(v))
  then raise exception 'rollback fail closed: trigger receipt drift %',rec.tg; end if;
 end loop;
end $check$;

drop trigger trg_aa_wp10_activation_parent_lock on public.product_skus;
drop trigger trg_wp10_product_route_impact_after on public.products;
drop trigger trg_wp10_product_route_impact_before on public.products;
drop function public.fn_wp10_activation_parent_lock();
drop function public.fn_wp10_product_route_impact_after();
drop function public.fn_wp10_product_route_impact_before();
commit;
