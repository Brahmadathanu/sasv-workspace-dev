-- backfilled from live schema_migrations on 2026-10-24, CI-016
create table if not exists costing.qc_workload_policy (
    id bigserial primary key,
    policy_code text not null,
    version_no integer not null,
    formula_type text not null,
    method_base_units numeric not null,
    additional_parameter_units numeric not null,
    effective_from date not null,
    effective_to date,
    policy_status text not null,
    approval_reference text not null,
    approved_by uuid,
    approved_at timestamptz not null default clock_timestamp(),
    remarks text not null default '',
    created_at timestamptz not null default clock_timestamp(),
    constraint qc_workload_policy_code_version_uq unique(policy_code, version_no),
    constraint qc_workload_policy_formula_chk check (formula_type in ('METHOD_BASE_PLUS_INCREMENT')),
    constraint qc_workload_policy_units_chk check (method_base_units > 0 and additional_parameter_units >= 0),
    constraint qc_workload_policy_dates_chk check (effective_to is null or effective_to >= effective_from),
    constraint qc_workload_policy_status_chk check (policy_status in ('DRAFT','ACTIVE','SUPERSEDED','RETIRED'))
);

create or replace function costing.fn_guard_qc_workload_policy()
returns trigger
language plpgsql
set search_path = 'costing','public','pg_temp'
as $$
begin
    if tg_op = 'DELETE' then
        raise exception 'QC workload policies are append-only and cannot be deleted';
    end if;

    if new.policy_code is distinct from old.policy_code
       or new.version_no is distinct from old.version_no
       or new.formula_type is distinct from old.formula_type
       or new.method_base_units is distinct from old.method_base_units
       or new.additional_parameter_units is distinct from old.additional_parameter_units
       or new.effective_from is distinct from old.effective_from
       or new.approval_reference is distinct from old.approval_reference
       or new.approved_by is distinct from old.approved_by
       or new.approved_at is distinct from old.approved_at then
        raise exception 'Approved QC workload policy core fields are immutable; supersede with a new version';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_guard_qc_workload_policy on costing.qc_workload_policy;
create trigger trg_guard_qc_workload_policy
before update or delete on costing.qc_workload_policy
for each row execute function costing.fn_guard_qc_workload_policy();

insert into costing.qc_workload_policy (
    policy_code,
    version_no,
    formula_type,
    method_base_units,
    additional_parameter_units,
    effective_from,
    effective_to,
    policy_status,
    approval_reference,
    approved_by,
    approved_at,
    remarks
)
select
    'QC_METHOD_BASE_PLUS_INCREMENT_V1',
    1,
    'METHOD_BASE_PLUS_INCREMENT',
    1.00,
    0.25,
    date '2026-07-01',
    null,
    'ACTIVE',
    'EVP-3I2C12C.5.11BS-QC.5',
    null,
    clock_timestamp(),
    'Approved provisional QC workload model for July 2026 costing: one base unit per distinct analytical method plus 0.25 unit for each additional required effective-spec line under that method.'
where not exists (
    select 1
    from costing.qc_workload_policy p
    where p.policy_code='QC_METHOD_BASE_PLUS_INCREMENT_V1'
      and p.version_no=1
);

create or replace function costing.fn_resolve_qc_workload_policy(p_as_of_date date)
returns costing.qc_workload_policy
language plpgsql
security definer
set search_path = 'costing','public','pg_temp'
as $$
declare
    v_policy costing.qc_workload_policy%rowtype;
    v_count integer;
begin
    if p_as_of_date is null then
        raise exception 'as_of_date is required';
    end if;

    select count(*)::integer
    into v_count
    from costing.qc_workload_policy p
    where p.policy_status='ACTIVE'
      and p.effective_from <= p_as_of_date
      and (p.effective_to is null or p.effective_to >= p_as_of_date);

    if v_count <> 1 then
        raise exception 'Exactly one active QC workload policy must resolve for %, found %', p_as_of_date, v_count;
    end if;

    select p.*
    into v_policy
    from costing.qc_workload_policy p
    where p.policy_status='ACTIVE'
      and p.effective_from <= p_as_of_date
      and (p.effective_to is null or p.effective_to >= p_as_of_date)
    order by p.effective_from desc, p.version_no desc, p.id desc
    limit 1;

    return v_policy;
end;
$$;

create table if not exists costing.product_qc_workload_snapshot (
    id bigserial primary key,
    period_start date not null,
    valuation_date date not null,
    refresh_run_id bigint not null references costing.costing_refresh_run(id),
    policy_id bigint not null references costing.qc_workload_policy(id),
    product_id bigint not null,
    product_name text,
    product_group_id bigint,
    protocol_category_id bigint,
    base_spec_profile_id bigint,
    required_line_count integer not null default 0,
    distinct_method_count integer not null default 0,
    workload_units numeric,
    workload_status text not null,
    workload_reason_code text not null,
    workload_note text not null,
    recipient_product_count integer not null,
    resolved_product_count integer not null,
    excluded_product_count integer not null,
    resolved_coverage_ratio numeric not null,
    refreshed_at timestamptz not null default clock_timestamp(),
    constraint product_qc_workload_snapshot_run_product_uq unique(refresh_run_id, product_id),
    constraint product_qc_workload_snapshot_status_chk check (workload_status in ('READY','REVIEW_REQUIRED','BLOCKED')),
    constraint product_qc_workload_snapshot_counts_chk check (
        required_line_count >= 0
        and distinct_method_count >= 0
        and recipient_product_count > 0
        and resolved_product_count >= 0
        and excluded_product_count >= 0
        and resolved_product_count + excluded_product_count = recipient_product_count
    ),
    constraint product_qc_workload_snapshot_ratio_chk check (resolved_coverage_ratio >= 0 and resolved_coverage_ratio <= 1),
    constraint product_qc_workload_snapshot_units_chk check (workload_units is null or workload_units > 0)
);

create index if not exists idx_product_qc_workload_snapshot_run_status
on costing.product_qc_workload_snapshot(refresh_run_id, workload_status);

create index if not exists idx_product_qc_workload_snapshot_run_group
on costing.product_qc_workload_snapshot(refresh_run_id, product_group_id);

create table if not exists costing.product_qc_method_workload_snapshot (
    id bigserial primary key,
    period_start date not null,
    valuation_date date not null,
    refresh_run_id bigint not null references costing.costing_refresh_run(id),
    policy_id bigint not null references costing.qc_workload_policy(id),
    product_workload_snapshot_id bigint not null references costing.product_qc_workload_snapshot(id) on delete cascade,
    product_id bigint not null,
    product_group_id bigint not null,
    protocol_category_id bigint not null,
    base_spec_profile_id bigint not null,
    method_id bigint not null,
    method_code text,
    method_name text,
    required_line_count integer not null,
    method_base_units numeric not null,
    additional_parameter_units numeric not null,
    method_workload_units numeric not null,
    effective_test_evidence jsonb not null,
    refreshed_at timestamptz not null default clock_timestamp(),
    constraint product_qc_method_workload_run_product_method_uq unique(refresh_run_id, product_id, method_id),
    constraint product_qc_method_workload_count_chk check (required_line_count >= 1),
    constraint product_qc_method_workload_units_chk check (
        method_base_units > 0
        and additional_parameter_units >= 0
        and method_workload_units = method_base_units + greatest(required_line_count - 1, 0) * additional_parameter_units
    ),
    constraint product_qc_method_workload_evidence_chk check (jsonb_typeof(effective_test_evidence)='array')
);

create index if not exists idx_product_qc_method_workload_snapshot_run_product
on costing.product_qc_method_workload_snapshot(refresh_run_id, product_id);

create trigger trg_product_qc_workload_snapshot_mutable_run
before insert or update or delete on costing.product_qc_workload_snapshot
for each row execute function costing.fn_enforce_mutable_refresh_run_snapshot();

create trigger trg_product_qc_method_workload_snapshot_mutable_run
before insert or update or delete on costing.product_qc_method_workload_snapshot
for each row execute function costing.fn_enforce_mutable_refresh_run_snapshot();

create or replace function costing.rpc_refresh_product_qc_workload_snapshot(
    p_period_start date,
    p_valuation_date date,
    p_refresh_run_id bigint
)
returns table(
    refreshed_period_start date,
    summary_row_count bigint,
    method_row_count bigint,
    blocked_count bigint,
    review_required_count bigint,
    ready_count bigint,
    resolved_coverage_ratio numeric
)
language plpgsql
security definer
set search_path = 'costing','lab','public','pg_temp'
as $$
declare
    v_period_start date := date_trunc('month', p_period_start)::date;
    v_run costing.costing_refresh_run%rowtype;
    v_policy costing.qc_workload_policy%rowtype;
    v_rec record;
    v_preview jsonb;
    v_summary_id bigint;
    v_required_line_count integer;
    v_distinct_method_count integer;
    v_workload_units numeric;
    v_recipient_count integer;
    v_resolved_count integer;
    v_excluded_count integer;
    v_coverage numeric;
    v_reason_code text;
    v_note text;
begin
    if p_period_start is null or p_valuation_date is null or p_refresh_run_id is null then
        raise exception 'period_start, valuation_date and refresh_run_id are required';
    end if;

    select * into v_run
    from costing.costing_refresh_run r
    where r.id=p_refresh_run_id;

    if not found then
        raise exception 'Costing refresh run % does not exist', p_refresh_run_id;
    end if;

    if v_run.period_start is distinct from v_period_start
       or v_run.valuation_date is distinct from p_valuation_date
       or v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then
        raise exception 'QC workload snapshot context does not match refresh run %', p_refresh_run_id;
    end if;

    v_policy := costing.fn_resolve_qc_workload_policy(p_valuation_date);

    select count(distinct b.product_id)::integer
    into v_recipient_count
    from costing.sku_sales_allocation_basis_snapshot b
    where b.period_start=v_period_start
      and b.valuation_date=p_valuation_date
      and b.refresh_run_id=p_refresh_run_id;

    if v_recipient_count <= 0 then
        raise exception 'No costing recipient Products found for refresh run %', p_refresh_run_id;
    end if;

    delete from costing.product_qc_method_workload_snapshot d
    where d.refresh_run_id=p_refresh_run_id;

    delete from costing.product_qc_workload_snapshot s
    where s.refresh_run_id=p_refresh_run_id;

    create temporary table tmp_qc_product_preview (
        product_id bigint primary key,
        product_name text,
        preview jsonb,
        is_resolved boolean not null
    ) on commit drop;

    for v_rec in
        select b.product_id, max(b.product_name) as product_name
        from costing.sku_sales_allocation_basis_snapshot b
        where b.period_start=v_period_start
          and b.valuation_date=p_valuation_date
          and b.refresh_run_id=p_refresh_run_id
        group by b.product_id
        order by b.product_id
    loop
        v_preview := lab.fn_preview_effective_fg_spec_for_product(v_rec.product_id, p_valuation_date);
        insert into tmp_qc_product_preview(product_id, product_name, preview, is_resolved)
        values (
            v_rec.product_id,
            v_rec.product_name,
            v_preview,
            coalesce((v_preview->>'ok')::boolean,false)
        );
    end loop;

    select count(*) filter (where is_resolved)::integer,
           count(*) filter (where not is_resolved)::integer
    into v_resolved_count, v_excluded_count
    from tmp_qc_product_preview;

    v_coverage := v_resolved_count::numeric / nullif(v_recipient_count,0)::numeric;

    for v_rec in
        select * from tmp_qc_product_preview order by product_id
    loop
        if not v_rec.is_resolved then
            v_reason_code := case
                when coalesce(v_rec.preview->>'message','') like 'No active FG protocol mapping found%' then 'BLOCKED_MISSING_FG_PROTOCOL_MAPPING'
                when coalesce(v_rec.preview->>'message','') like 'No active FG base spec found%' then 'BLOCKED_MISSING_EFFECTIVE_FG_BASE_SPEC'
                else 'BLOCKED_EFFECTIVE_SPEC_RESOLUTION_ERROR'
            end;
            v_note := coalesce(v_rec.preview->>'message','Effective FG specification could not be resolved.');

            insert into costing.product_qc_workload_snapshot (
                period_start, valuation_date, refresh_run_id, policy_id,
                product_id, product_name, product_group_id, protocol_category_id, base_spec_profile_id,
                required_line_count, distinct_method_count, workload_units,
                workload_status, workload_reason_code, workload_note,
                recipient_product_count, resolved_product_count, excluded_product_count, resolved_coverage_ratio,
                refreshed_at
            ) values (
                v_period_start, p_valuation_date, p_refresh_run_id, v_policy.id,
                v_rec.product_id, v_rec.product_name,
                nullif(v_rec.preview->>'product_group_id','')::bigint,
                nullif(v_rec.preview->>'protocol_category_id','')::bigint,
                nullif(v_rec.preview->>'base_spec_profile_id','')::bigint,
                0, 0, null,
                'BLOCKED', v_reason_code, v_note,
                v_recipient_count, v_resolved_count, v_excluded_count, v_coverage,
                clock_timestamp()
            );
            continue;
        end if;

        select count(*)::integer,
               count(distinct nullif(line->>'method_id','')::bigint)::integer
        into v_required_line_count, v_distinct_method_count
        from jsonb_array_elements(v_rec.preview->'lines') line
        where coalesce((line->>'is_required')::boolean,false)=true;

        if v_required_line_count=0 then
            insert into costing.product_qc_workload_snapshot (
                period_start, valuation_date, refresh_run_id, policy_id,
                product_id, product_name, product_group_id, protocol_category_id, base_spec_profile_id,
                required_line_count, distinct_method_count, workload_units,
                workload_status, workload_reason_code, workload_note,
                recipient_product_count, resolved_product_count, excluded_product_count, resolved_coverage_ratio,
                refreshed_at
            ) values (
                v_period_start, p_valuation_date, p_refresh_run_id, v_policy.id,
                v_rec.product_id, v_rec.product_name,
                nullif(v_rec.preview->>'product_group_id','')::bigint,
                nullif(v_rec.preview->>'protocol_category_id','')::bigint,
                nullif(v_rec.preview->>'base_spec_profile_id','')::bigint,
                0, 0, null,
                'BLOCKED', 'BLOCKED_NO_REQUIRED_EFFECTIVE_SPEC_LINES', 'Effective FG specification resolved but contains no required analytical lines.',
                v_recipient_count, v_resolved_count, v_excluded_count, v_coverage,
                clock_timestamp()
            );
            continue;
        end if;

        if exists (
            select 1
            from jsonb_array_elements(v_rec.preview->'lines') line
            where coalesce((line->>'is_required')::boolean,false)=true
              and nullif(line->>'method_id','') is null
        ) then
            insert into costing.product_qc_workload_snapshot (
                period_start, valuation_date, refresh_run_id, policy_id,
                product_id, product_name, product_group_id, protocol_category_id, base_spec_profile_id,
                required_line_count, distinct_method_count, workload_units,
                workload_status, workload_reason_code, workload_note,
                recipient_product_count, resolved_product_count, excluded_product_count, resolved_coverage_ratio,
                refreshed_at
            ) values (
                v_period_start, p_valuation_date, p_refresh_run_id, v_policy.id,
                v_rec.product_id, v_rec.product_name,
                nullif(v_rec.preview->>'product_group_id','')::bigint,
                nullif(v_rec.preview->>'protocol_category_id','')::bigint,
                nullif(v_rec.preview->>'base_spec_profile_id','')::bigint,
                v_required_line_count, v_distinct_method_count, null,
                'BLOCKED', 'BLOCKED_MISSING_QC_ANALYTICAL_METHOD', 'One or more required effective-specification lines do not resolve an analytical method.',
                v_recipient_count, v_resolved_count, v_excluded_count, v_coverage,
                clock_timestamp()
            );
            continue;
        end if;

        select sum(v_policy.method_base_units + greatest(x.line_count-1,0)*v_policy.additional_parameter_units)
        into v_workload_units
        from (
            select nullif(line->>'method_id','')::bigint as method_id, count(*)::integer as line_count
            from jsonb_array_elements(v_rec.preview->'lines') line
            where coalesce((line->>'is_required')::boolean,false)=true
            group by nullif(line->>'method_id','')::bigint
        ) x;

        insert into costing.product_qc_workload_snapshot (
            period_start, valuation_date, refresh_run_id, policy_id,
            product_id, product_name, product_group_id, protocol_category_id, base_spec_profile_id,
            required_line_count, distinct_method_count, workload_units,
            workload_status, workload_reason_code, workload_note,
            recipient_product_count, resolved_product_count, excluded_product_count, resolved_coverage_ratio,
            refreshed_at
        ) values (
            v_period_start, p_valuation_date, p_refresh_run_id, v_policy.id,
            v_rec.product_id, v_rec.product_name,
            nullif(v_rec.preview->>'product_group_id','')::bigint,
            nullif(v_rec.preview->>'protocol_category_id','')::bigint,
            nullif(v_rec.preview->>'base_spec_profile_id','')::bigint,
            v_required_line_count, v_distinct_method_count, v_workload_units,
            'READY', 'READY_EFFECTIVE_SPEC_WORKLOAD',
            format('Method 3 workload resolved from %s required effective-spec lines across %s distinct analytical methods.',v_required_line_count,v_distinct_method_count),
            v_recipient_count, v_resolved_count, v_excluded_count, v_coverage,
            clock_timestamp()
        ) returning id into v_summary_id;

        insert into costing.product_qc_method_workload_snapshot (
            period_start, valuation_date, refresh_run_id, policy_id, product_workload_snapshot_id,
            product_id, product_group_id, protocol_category_id, base_spec_profile_id,
            method_id, method_code, method_name, required_line_count,
            method_base_units, additional_parameter_units, method_workload_units,
            effective_test_evidence, refreshed_at
        )
        select
            v_period_start, p_valuation_date, p_refresh_run_id, v_policy.id, v_summary_id,
            v_rec.product_id,
            nullif(v_rec.preview->>'product_group_id','')::bigint,
            nullif(v_rec.preview->>'protocol_category_id','')::bigint,
            nullif(v_rec.preview->>'base_spec_profile_id','')::bigint,
            g.method_id,
            max(g.method_code),
            max(g.method_name),
            count(*)::integer,
            v_policy.method_base_units,
            v_policy.additional_parameter_units,
            v_policy.method_base_units + greatest(count(*)::integer-1,0)*v_policy.additional_parameter_units,
            jsonb_agg(jsonb_build_object(
                'seq_no',g.seq_no,
                'test_id',g.test_id,
                'test_code',g.test_code,
                'test_name',g.test_name,
                'source_type',g.source_type,
                'source_override_id',g.source_override_id
            ) order by g.seq_no),
            clock_timestamp()
        from (
            select
                nullif(line->>'method_id','')::bigint as method_id,
                line->>'method_code' as method_code,
                line->>'method_name' as method_name,
                nullif(line->>'seq_no','')::integer as seq_no,
                nullif(line->>'test_id','')::bigint as test_id,
                line->>'test_code' as test_code,
                line->>'test_name' as test_name,
                line->>'source_type' as source_type,
                nullif(line->>'source_override_id','')::bigint as source_override_id
            from jsonb_array_elements(v_rec.preview->'lines') line
            where coalesce((line->>'is_required')::boolean,false)=true
        ) g
        group by g.method_id;
    end loop;

    return query
    select
        v_period_start,
        count(*)::bigint,
        (select count(*)::bigint from costing.product_qc_method_workload_snapshot d where d.refresh_run_id=p_refresh_run_id),
        count(*) filter (where s.workload_status='BLOCKED')::bigint,
        count(*) filter (where s.workload_status='REVIEW_REQUIRED')::bigint,
        count(*) filter (where s.workload_status='READY')::bigint,
        max(s.resolved_coverage_ratio)
    from costing.product_qc_workload_snapshot s
    where s.refresh_run_id=p_refresh_run_id;
end;
$$;

revoke all on table costing.qc_workload_policy from public, anon, authenticated;
revoke all on table costing.product_qc_workload_snapshot from public, anon, authenticated;
revoke all on table costing.product_qc_method_workload_snapshot from public, anon, authenticated;
revoke all on function costing.fn_resolve_qc_workload_policy(date) from public, anon, authenticated, service_role;
revoke all on function costing.rpc_refresh_product_qc_workload_snapshot(date,date,bigint) from public, anon, authenticated, service_role;
grant execute on function costing.fn_resolve_qc_workload_policy(date) to postgres;
grant execute on function costing.rpc_refresh_product_qc_workload_snapshot(date,date,bigint) to postgres;