-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function public.etl_jobs_validate_terminal_state()
returns trigger
language plpgsql
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

        new.params := (new.params - 'validation_code') || jsonb_build_object(
            'validation_status', 'SOURCE_ERROR_RESPONSE',
            'validation_code', 'KNOWN_TALLY_234_BYTE_OUTAGE_PAYLOAD',
            'validated_at', clock_timestamp()
        );

        if v_is_fetch then
            new.params := new.params || jsonb_build_object('fetch_status', 'ERROR');
        end if;

        return new;
    end if;

    -- A genuine terminal success is the current truth. Never retain validation
    -- failure metadata from an earlier attempt on the same job row.
    new.error_text := null;
    new.params := (new.params - 'validation_code') || jsonb_build_object(
        'validation_status', 'ACCEPTED',
        'validated_at', clock_timestamp()
    );

    if v_is_fetch then
        new.params := new.params || jsonb_build_object('fetch_status', 'SUCCESS');
    end if;

    return new;
end;
$function$;

revoke all on function public.etl_jobs_validate_terminal_state() from public;
revoke all on function public.etl_jobs_validate_terminal_state() from anon;
revoke all on function public.etl_jobs_validate_terminal_state() from authenticated;