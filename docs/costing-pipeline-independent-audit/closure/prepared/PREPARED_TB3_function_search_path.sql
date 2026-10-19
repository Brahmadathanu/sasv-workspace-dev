-- PREPARED (not applied). CI-018: 9 functions without a pinned search_path (advisor function_search_path_mutable).
-- None is SECURITY DEFINER and every body is either pure or fully schema-qualified, so pinning changes no behaviour.
-- Guards: stops if any body differs from the 19 Oct 2026 live baseline (md5 of pg_get_functiondef) or already has a search_path.
do $g$
declare v_bad text := ''; r record;
begin
  for r in select * from (values
    ('costing.fn_sales_allocation_quantity_driver_fingerprint(bigint,bigint,date,text,text,date,bigint,bigint,text,numeric,numeric)','5a70478908b1948424acf0f072fbc209'),
    ('costing.fn_au3_append_only()','14e011328c4f7a21e66e84276b904def'),
    ('costing.fn_fy_start(date)','7395e464350c6e9a6e06d254794edd67'),
    ('public.fn_tally_classify_export_window(date,date,date,date,date,text)','2a1705dbeafd91b74776c0fa60a32bee'),
    ('public.fn_tally_batch_consistency(bigint)','bacaf035257f923368596dac5e2c61b7'),
    ('costing.fn_enforce_prm_approval_reference()','e23274fa931f876033e91cd61bc88456'),
    ('costing.fn_regional_marketing_evidence_fingerprint(bigint,bigint,text,date,text,numeric,numeric,bigint,bigint,text,text,numeric,numeric)','efb984d40c84f26e8c19f1a82200e1ec'),
    ('costing.fn_apply_batch_true_standard(bigint)','23fb151d96b34e7fe9912cedcd0e8d1f'),
    ('costing.fn_w2_require_text(text,text)','d87575478c0ec9f57cfb663958632971')
  ) x(sig, m) loop
    if to_regprocedure(r.sig) is null then v_bad := v_bad||' missing:'||r.sig;
    elsif md5(pg_get_functiondef(r.sig::regprocedure)) <> r.m then v_bad := v_bad||' changed:'||r.sig;
    elsif exists (select 1 from pg_proc where oid=r.sig::regprocedure and (prosecdef or proconfig is not null)) then v_bad := v_bad||' secdef_or_config:'||r.sig;
    end if;
  end loop;
  if v_bad <> '' then raise exception 'TB3_GUARD: live differs from the 19 Oct baseline:%', v_bad; end if;
end $g$;

alter function costing.fn_sales_allocation_quantity_driver_fingerprint(bigint,bigint,date,text,text,date,bigint,bigint,text,numeric,numeric) set search_path = pg_catalog, pg_temp;
alter function costing.fn_au3_append_only() set search_path = pg_catalog, pg_temp;
alter function costing.fn_fy_start(date) set search_path = pg_catalog, pg_temp;
alter function public.fn_tally_classify_export_window(date,date,date,date,date,text) set search_path = pg_catalog, pg_temp;
alter function public.fn_tally_batch_consistency(bigint) set search_path = public, pg_temp;
alter function costing.fn_enforce_prm_approval_reference() set search_path = pg_catalog, pg_temp;
alter function costing.fn_regional_marketing_evidence_fingerprint(bigint,bigint,text,date,text,numeric,numeric,bigint,bigint,text,text,numeric,numeric) set search_path = pg_catalog, pg_temp;
alter function costing.fn_apply_batch_true_standard(bigint) set search_path = pg_catalog, pg_temp;
alter function costing.fn_w2_require_text(text,text) set search_path = pg_catalog, pg_temp;

do $p$
declare n int;
begin
  select count(*) into n from pg_proc p join pg_namespace s on s.oid=p.pronamespace
   where (s.nspname, p.proname) in (('costing','fn_sales_allocation_quantity_driver_fingerprint'),('costing','fn_au3_append_only'),('costing','fn_fy_start'),
     ('public','fn_tally_classify_export_window'),('public','fn_tally_batch_consistency'),('costing','fn_enforce_prm_approval_reference'),
     ('costing','fn_regional_marketing_evidence_fingerprint'),('costing','fn_apply_batch_true_standard'),('costing','fn_w2_require_text'))
     and not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%');
  if n <> 0 then raise exception 'TB3_POST: % functions still without search_path', n; end if;
end $p$;
