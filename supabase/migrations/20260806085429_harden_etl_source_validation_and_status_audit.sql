-- backfilled from live schema_migrations on 2026-10-24, CI-016
create table if not exists public.etl_job_status_history (
    history_id bigint generated always as identity primary key,
    job_id uuid not null,
    job_type text not null,
    old_status public.job_status,
    new_status public.job_status not null,
    attempts integer,
    error_text text,
    validation_status text,
    changed_at timestamptz not null default clock_timestamp()
);

create index if not exists etl_job_status_history_job_id_changed_at_idx
    on public.etl_job_status_history (job_id, changed_at desc);

alter table public.etl_job_status_history enable row level security;
revoke all on table public.etl_job_status_history from public, anon, authenticated;
revoke all on sequence public.etl_job_status_history_history_id_seq from public, anon, authenticated;

create or replace function public.etl_is_known_tally_error_fingerprint(
    p_source_size_bytes bigint,
    p_source_hash text
)
returns boolean
language sql
immutable
parallel safe
as $function$
    select
        p_source_size_bytes = 234
        and lower(coalesce(p_source_hash, '')) =
            '4f76840aa1ed0389d125f2fd7f92b3f11d8cf3e046adda37b4d7b745d1cbd093';
$function$;

revoke execute on function public.etl_is_known_tally_error_fingerprint(bigint, text)
from public, anon, authenticated;

create or replace function public.etl_jobs_validate_terminal_state()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
    v_size bigint;
    v_hash text;
    v_is_fetch boolean;
    v_is_parser boolean;
begin
    new.params := coalesce(new.params, '{}'::jsonb);

    if new.status <> 'done'::public.job_status then
        return new;
    end if;

    v_is_fetch := new.job_type in ('FETCH_XML', 'FETCH_VREG_LOCAL');
    v_is_parser := new.job_type like 'PARSE_%';

    if coalesce(new.params ->> 'source_size_bytes', '') ~ '^\d+$' then
        v_size := (new.params ->> 'source_size_bytes')::bigint;
    else
        v_size := null;
    end if;

    v_hash := nullif(lower(btrim(new.params ->> 'source_hash')), '');

    if (v_is_fetch or v_is_parser)
       and public.etl_is_known_tally_error_fingerprint(v_size, v_hash)
    then
        new.status := 'error'::public.job_status;
        new.finished_at := coalesce(new.finished_at, clock_timestamp());
        new.error_text :=
            'TALLY_SOURCE_ERROR_RESPONSE: rejected known 234-byte Tally outage payload; downstream processing is blocked until a valid source is fetched';
        new.params := new.params || jsonb_build_object(
            'validation_status', 'SOURCE_ERROR_RESPONSE',
            'validation_code', 'KNOWN_TALLY_234_BYTE_OUTAGE_PAYLOAD',
            'validated_at', clock_timestamp()
        );
        return new;
    end if;

    -- A completed job must not continue displaying an error from an earlier attempt.
    new.error_text := null;
    new.params := new.params || jsonb_build_object(
        'validation_status', coalesce(nullif(new.params ->> 'validation_status', ''), 'ACCEPTED'),
        'validated_at', coalesce(new.params -> 'validated_at', to_jsonb(clock_timestamp()))
    );

    return new;
end;
$function$;

revoke execute on function public.etl_jobs_validate_terminal_state()
from public, anon, authenticated;

create or replace function public.etl_jobs_record_status_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
    if tg_op = 'INSERT' or old.status is distinct from new.status then
        insert into public.etl_job_status_history (
            job_id,
            job_type,
            old_status,
            new_status,
            attempts,
            error_text,
            validation_status,
            changed_at
        ) values (
            new.id,
            new.job_type,
            case when tg_op = 'INSERT' then null else old.status end,
            new.status,
            new.attempts,
            new.error_text,
            new.params ->> 'validation_status',
            clock_timestamp()
        );
    end if;

    return new;
end;
$function$;

revoke execute on function public.etl_jobs_record_status_history()
from public, anon, authenticated;

drop trigger if exists trg_etl_jobs_validate_terminal_state on public.etl_jobs;
create trigger trg_etl_jobs_validate_terminal_state
before insert or update of status, params, error_text, finished_at
on public.etl_jobs
for each row
execute function public.etl_jobs_validate_terminal_state();

drop trigger if exists trg_etl_jobs_record_status_history on public.etl_jobs;
create trigger trg_etl_jobs_record_status_history
after insert or update of status
on public.etl_jobs
for each row
execute function public.etl_jobs_record_status_history();

create or replace function public.fg_transfer_all_chunks_present(
    p_store text,
    p_as_of_date date,
    p_expected_keys jsonb
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
    select
        p_store is not null
        and btrim(p_store) <> ''
        and p_as_of_date is not null
        and jsonb_typeof(coalesce(p_expected_keys, '[]'::jsonb)) = 'array'
        and jsonb_array_length(coalesce(p_expected_keys, '[]'::jsonb)) > 0
        and not exists (
            select 1
            from jsonb_array_elements_text(
                coalesce(p_expected_keys, '[]'::jsonb)
            ) as expected(expected_key)
            where
                not exists (
                    select 1
                    from public.etl_jobs fetch_job
                    where fetch_job.job_type = 'FETCH_XML'
                      and fetch_job.status = 'done'
                      and fetch_job.params ->> 'save_key' = expected.expected_key
                      and not public.etl_is_known_tally_error_fingerprint(
                          case
                              when coalesce(fetch_job.params ->> 'source_size_bytes', '') ~ '^\d+$'
                              then (fetch_job.params ->> 'source_size_bytes')::bigint
                              else null
                          end,
                          fetch_job.params ->> 'source_hash'
                      )
                )
                or not exists (
                    select 1
                    from public.etl_jobs parse_job
                    where parse_job.job_type = 'PARSE_FG_TRANSFER_CHUNK'
                      and parse_job.status = 'done'
                      and parse_job.params ->> 'source_key' = expected.expected_key
                      and parse_job.params ->> 'as_of_date' = p_as_of_date::text
                      and upper(parse_job.params ->> 'store') = upper(p_store)
                      and upper(btrim(coalesce(parse_job.params ->> 'parse_status', ''))) = 'SUCCESS'
                      and not public.etl_is_known_tally_error_fingerprint(
                          case
                              when coalesce(parse_job.params ->> 'source_size_bytes', '') ~ '^\d+$'
                              then (parse_job.params ->> 'source_size_bytes')::bigint
                              else null
                          end,
                          parse_job.params ->> 'source_hash'
                      )
                )
        );
$function$;