-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function public.etl_recover_template_path_incident_internal(
  p_since timestamptz default date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'
)
returns table(fetch_requeued integer, downstream_requeued integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fetch integer := 0;
  v_downstream integer := 0;
begin
  update public.etl_jobs j
  set status = 'queued'::public.job_status,
      attempts = 0,
      started_at = null,
      finished_at = null,
      error_text = null,
      not_before = now()
  where j.created_at >= p_since
    and j.job_type = 'FETCH_XML'
    and j.status = 'error'::public.job_status
    and j.error_text like 'Template XML not found at C:\\tally-agent\\tally\\%';
  get diagnostics v_fetch = row_count;

  update public.etl_jobs j
  set status = 'queued'::public.job_status,
      attempts = 0,
      started_at = null,
      finished_at = null,
      error_text = null,
      not_before = now() + interval '2 minutes'
  where j.created_at >= p_since
    and j.status = 'error'::public.job_status
    and j.job_type in (
      'PARSE_FG_TRANSFER_CHUNK',
      'PARSE_GROUP_OUTSTANDING',
      'PARSE_MONTHLY_GROUP_SUMMARY',
      'PARSE_PLM_STOCK_SNAPSHOT',
      'PARSE_PURCHASE_ORDERS',
      'PARSE_CONSUMABLES_STOCK_SNAPSHOT',
      'PARSE_FUEL_STOCK_SNAPSHOT',
      'PARSE_EXPENSES_SNAPSHOT',
      'PARSE_STOCK',
      'PARSE_RM_STOCK_SNAPSHOT',
      'PARSE_RM_INWARD_SNAPSHOT'
    )
    and (
      j.error_text like 'No chunk found for base=%'
      or j.error_text like 'source_key not found:%'
    );
  get diagnostics v_downstream = row_count;

  return query select v_fetch, v_downstream;
end;
$$;

revoke all on function public.etl_recover_template_path_incident_internal(timestamptz) from public, anon, authenticated;
grant execute on function public.etl_recover_template_path_incident_internal(timestamptz) to service_role;
comment on function public.etl_recover_template_path_incident_internal(timestamptz) is
'Internal operator recovery for the 2026-08 template-path incident. Requeues only FETCH_XML jobs failed by obsolete C:\\tally-agent\\tally template resolution and directly dependent missing-source parser failures. Invoke only after the local agent path fix is deployed.';