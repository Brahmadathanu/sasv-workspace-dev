-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function public.etl_jobs_validate_terminal_state()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
    v_size bigint;
    v_hash text;
    v_is_fetch boolean;
    v_is_parser boolean;
    v_as_of_date date;
    v_required_slots text[];
    v_missing_slots text[];
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

    -- Forecast jobs require concrete forecast_run evidence from this execution.
    if new.job_type in ('FORECAST_ALL', 'FORECAST_BASELINE', 'FORECAST_LLT', 'FORECAST_SEASONAL') then
        begin
            v_as_of_date := nullif(btrim(new.params ->> 'as_of_date'), '')::date;
        exception when others then
            v_as_of_date := null;
        end;

        if v_as_of_date is null then
            new.status := 'error'::public.job_status;
            new.finished_at := coalesce(new.finished_at, clock_timestamp());
            new.error_text := 'FORECAST_VALIDATION_ERROR: missing or invalid params.as_of_date';
            new.params := (new.params - 'validation_code') || jsonb_build_object(
                'validation_status', 'FORECAST_INCOMPLETE',
                'validation_code', 'INVALID_AS_OF_DATE',
                'validated_at', clock_timestamp()
            );
            return new;
        end if;

        v_required_slots := case new.job_type
            when 'FORECAST_ALL' then array['baseline','llt','seasonal']::text[]
            when 'FORECAST_BASELINE' then array['baseline']::text[]
            when 'FORECAST_LLT' then array['llt']::text[]
            when 'FORECAST_SEASONAL' then array['seasonal']::text[]
        end;

        select array_agg(req.slot order by req.slot)
          into v_missing_slots
        from unnest(v_required_slots) as req(slot)
        where not exists (
            select 1
            from public.forecast_run fr
            where fr.module_slot = req.slot
              and fr.as_of_date = v_as_of_date
              and fr.status = 'OK'
              and fr.created_at >= coalesce(new.started_at, new.created_at)
              and fr.created_at <= coalesce(new.finished_at, clock_timestamp()) + interval '5 seconds'
        );

        if coalesce(cardinality(v_missing_slots), 0) > 0 then
            new.status := 'error'::public.job_status;
            new.finished_at := coalesce(new.finished_at, clock_timestamp());
            new.error_text := 'FORECAST_VALIDATION_ERROR: missing successful run(s) for slot(s): ' || array_to_string(v_missing_slots, ', ');
            new.params := (new.params - 'validation_code') || jsonb_build_object(
                'validation_status', 'FORECAST_INCOMPLETE',
                'validation_code', 'MISSING_FORECAST_RUNS',
                'missing_slots', to_jsonb(v_missing_slots),
                'validated_at', clock_timestamp()
            );
            return new;
        end if;
    end if;

    -- A genuine terminal success is the current truth. Never retain validation
    -- failure metadata from an earlier attempt on the same job row.
    new.error_text := null;
    new.params := (new.params - 'validation_code' - 'missing_slots') || jsonb_build_object(
        'validation_status', 'ACCEPTED',
        'validated_at', clock_timestamp()
    );

    if v_is_fetch then
        new.params := new.params || jsonb_build_object('fetch_status', 'SUCCESS');
    end if;

    return new;
end;
$function$;