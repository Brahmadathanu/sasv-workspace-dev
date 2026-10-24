-- backfilled from live schema_migrations on 2026-10-24, CI-016
begin;

DROP FUNCTION IF EXISTS public.bmr_admin_assert_not_operational(integer);

create or replace function public.bmr_admin_assert_not_operational(p_bmr_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, lab, pg_temp
as $function$
declare
  v_bmr public.bmr_details%rowtype;
  v_work_log_count integer;
  v_analysis_count integer;
begin
  select * into v_bmr
  from public.bmr_details
  where id = p_bmr_id;

  if not found then
    raise exception using errcode='23514', message=format('BMR %s not found', p_bmr_id);
  end if;

  select count(*)::integer into v_work_log_count
  from public.daily_work_log d
  where lower(btrim(d.item)) = lower(btrim(v_bmr.item))
    and btrim(d.batch_number) = btrim(v_bmr.bn);

  select count(*)::integer into v_analysis_count
  from lab.analysis_record ar
  where ar.bmr_id = p_bmr_id;

  if v_work_log_count > 0 or v_analysis_count > 0 then
    raise exception using
      errcode = '23514',
      message = format(
        'BMR %s is operationally used; administrative identity/size/mapping correction is blocked (work_logs=%s, lab_analyses=%s)',
        p_bmr_id, v_work_log_count, v_analysis_count
      );
  end if;

  return jsonb_build_object(
    'work_log_count', v_work_log_count,
    'lab_analysis_count', v_analysis_count,
    'operationally_used', false
  );
end;
$function$;

revoke all on function public.bmr_admin_assert_not_operational(bigint) from public, anon, authenticated;

commit;