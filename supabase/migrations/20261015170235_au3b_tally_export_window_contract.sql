-- AU-3b: explicit Tally export window contract (D-018). Approved for live apply 2026-10-15 22:26 IST (D-023), mode OFF. Additive (D-020):
-- no consumer is switched; enforcement mode defaults to OFF so the current ETL keeps working unchanged.
-- Contract: every expense export carries requested AND returned period_from/period_to; the DB classifies the window
-- (FYTD / MTD) and REJECTS ambiguous or inconsistent exports before they reach tally_expenses_snapshot.

-- 1. Settings (single row) -------------------------------------------------------------------------
create table if not exists public.tally_export_contract_setting (
  id boolean primary key default true check (id),
  enforcement_mode text not null default 'OFF' check (enforcement_mode in ('OFF','WARN','ENFORCE')),
  consistency_drop_ratio numeric not null default 0.5,
  consistency_head_share numeric not null default 0.6,
  changed_by text not null default 'migration',
  changed_at timestamptz not null default now()
);
insert into public.tally_export_contract_setting(id) values (true) on conflict do nothing;

-- 2. Export batches (one per Tally export file) and staged rows -----------------------------------------
create table if not exists public.tally_expense_export_batch (
  id bigserial primary key,
  as_of_date date not null,
  expense_group text not null,
  source_key text not null,
  etl_job_id uuid,
  requested_from date, requested_to date,
  returned_from date, returned_to date,
  declared_basis text check (declared_basis in ('FYTD','MTD')),
  window_basis text,                    -- classifier result: FYTD | MTD | FYTD_AND_MTD (April 1..x) | null
  status text not null default 'STAGED' check (status in ('STAGED','ACCEPTED','REJECTED_AMBIGUOUS','REJECTED_INCONSISTENT','SUPERSEDED')),
  status_reason text,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source_key, etl_job_id)
);
create table if not exists public.tally_expense_export_staging (
  batch_id bigint not null references public.tally_expense_export_batch(id),
  head_name text not null,
  debit_amount_value numeric, credit_amount_value numeric, net_cb_value numeric,
  primary key (batch_id, head_name)
);
create table if not exists public.tally_expense_contract_violation (
  id bigserial primary key, as_of_date date, expense_group text, head_name text, source_key text,
  reason text not null, mode text not null, logged_at timestamptz not null default now()
);

-- 3. Lineage columns on the snapshot (nullable, so the current loader is unaffected) ----------------------
alter table public.tally_expenses_snapshot
  add column if not exists period_from date,
  add column if not exists period_to date,
  add column if not exists window_basis text,
  add column if not exists export_batch_id bigint references public.tally_expense_export_batch(id);

-- 4. Pure window classifier (the truth table the ETL mirrors) -------------------------------------------
create or replace function public.fn_tally_classify_export_window(
  p_as_of_date date, p_requested_from date, p_requested_to date, p_returned_from date, p_returned_to date, p_declared_basis text)
returns table(window_basis text, status text, reason text) language plpgsql immutable as $$
declare v_fy date; v_ms date; v_basis text;
begin
  if p_returned_from is null or p_returned_to is null then
    return query select null::text, 'REJECTED_AMBIGUOUS', 'returned period_from/period_to missing: the window cannot be proven'; return;
  end if;
  if p_requested_from is null or p_requested_to is null then
    return query select null::text, 'REJECTED_AMBIGUOUS', 'requested period_from/period_to missing'; return;
  end if;
  if p_returned_from > p_returned_to then
    return query select null::text, 'REJECTED_INCONSISTENT', 'returned period_from is after period_to'; return;
  end if;
  if p_returned_from <> p_requested_from or p_returned_to <> p_requested_to then
    return query select null::text, 'REJECTED_INCONSISTENT', format('returned range %s..%s differs from requested %s..%s', p_returned_from, p_returned_to, p_requested_from, p_requested_to); return;
  end if;
  if p_returned_to <> p_as_of_date then
    return query select null::text, 'REJECTED_INCONSISTENT', format('period_to %s does not equal as_of_date %s', p_returned_to, p_as_of_date); return;
  end if;
  v_fy := case when extract(month from p_returned_to) >= 4 then make_date(extract(year from p_returned_to)::int,4,1)
               else make_date(extract(year from p_returned_to)::int-1,4,1) end;
  v_ms := date_trunc('month', p_returned_to)::date;
  if p_returned_from < v_fy then
    return query select null::text, 'REJECTED_INCONSISTENT', format('window %s..%s crosses the financial-year start %s', p_returned_from, p_returned_to, v_fy); return;
  end if;
  v_basis := case when p_returned_from = v_fy and p_returned_from = v_ms then 'FYTD_AND_MTD'
                  when p_returned_from = v_fy then 'FYTD'
                  when p_returned_from = v_ms then 'MTD' end;
  if v_basis is null then
    return query select null::text, 'REJECTED_AMBIGUOUS', format('window starts %s: neither FY start %s nor month start %s', p_returned_from, v_fy, v_ms); return;
  end if;
  if p_declared_basis is not null and not (v_basis = p_declared_basis or v_basis = 'FYTD_AND_MTD') then
    return query select v_basis, 'REJECTED_INCONSISTENT', format('declared %s but dates prove %s', p_declared_basis, v_basis); return;
  end if;
  return query select v_basis, 'ACCEPTED', 'window proven by explicit dates';
end $$;

-- 5. Value-consistency check: a batch claiming the same window start as the previous accepted batch of this
--    group must not look like a reset (most heads falling sharply). Catches a source that silently changed window.
create or replace function public.fn_tally_batch_consistency(p_batch_id bigint)
returns table(ok boolean, reason text, evidence jsonb) language plpgsql stable as $$
declare b public.tally_expense_export_batch%rowtype; p public.tally_expense_export_batch%rowtype; s public.tally_export_contract_setting%rowtype;
  v_ratio numeric; v_share numeric; v_common int;
begin
  select * into b from public.tally_expense_export_batch where id = p_batch_id;
  select * into s from public.tally_export_contract_setting;
  select * into p from public.tally_expense_export_batch x
   where x.expense_group = b.expense_group and x.status = 'ACCEPTED' and x.returned_from = b.returned_from
     and x.as_of_date < b.as_of_date order by x.as_of_date desc limit 1;
  if not found then return query select true, 'no earlier accepted batch with the same window start', '{}'::jsonb; return; end if;
  select count(*), sum(abs(coalesce(c.net_cb_value,0)))/nullif(sum(abs(coalesce(o.net_cb_value,0))),0),
         avg((abs(coalesce(c.net_cb_value,0)) < abs(coalesce(o.net_cb_value,0)) - 0.005)::int)
    into v_common, v_ratio, v_share
    from public.tally_expense_export_staging c
    join public.tally_expenses_snapshot o on o.export_batch_id = p.id and o.head_name = c.head_name
   where c.batch_id = b.id;
  if v_common > 0 and coalesce(v_ratio,1) < s.consistency_drop_ratio and coalesce(v_share,0) >= s.consistency_head_share then
    return query select false, format('values fell like a reset vs accepted batch %s (%s) under the same window start %s', p.id, p.as_of_date, b.returned_from),
      jsonb_build_object('previous_batch',p.id,'common_heads',v_common,'total_ratio',round(v_ratio,4),'share_heads_fell',round(v_share,4)); return;
  end if;
  return query select true, 'consistent with previous accepted batch', jsonb_build_object('previous_batch',p.id,'common_heads',v_common,'total_ratio',round(v_ratio,4),'share_heads_fell',round(v_share,4));
end $$;

-- 6. Accept or reject a staged batch; only ACCEPTED batches reach tally_expenses_snapshot (with lineage).
create or replace function public.rpc_tally_validate_and_load_expense_batch(p_batch_id bigint)
returns table(batch_id bigint, status text, reason text, rows_loaded int) language plpgsql security definer
set search_path = public, pg_temp as $$
declare b public.tally_expense_export_batch%rowtype; c record; k record; v_n int := 0;
begin
  select * into b from public.tally_expense_export_batch where id = p_batch_id for update;
  if not found then raise exception 'TALLY_BATCH_NOT_FOUND: %', p_batch_id; end if;
  if b.status <> 'STAGED' then return query select b.id, b.status, coalesce(b.status_reason,'already validated'), 0; return; end if;
  select * into c from public.fn_tally_classify_export_window(b.as_of_date, b.requested_from, b.requested_to, b.returned_from, b.returned_to, b.declared_basis);
  if c.status = 'ACCEPTED' then
    if not exists (select 1 from public.tally_expense_export_staging where tally_expense_export_staging.batch_id = b.id) then
      c.status := 'REJECTED_AMBIGUOUS'; c.reason := 'batch has no rows (cannot distinguish empty export from failed export)';
    else
      select * into k from public.fn_tally_batch_consistency(b.id);
      if not k.ok then c.status := 'REJECTED_INCONSISTENT'; c.reason := k.reason; end if;
    end if;
  end if;
  update public.tally_expense_export_batch set status = c.status, status_reason = c.reason, window_basis = c.window_basis, validated_at = now() where id = b.id;
  if c.status = 'ACCEPTED' then
    perform set_config('tally.contract_batch', b.id::text, true);
    insert into public.tally_expenses_snapshot(as_of_date, expense_group, head_name, debit_amount_value, credit_amount_value, net_cb_value,
                                               source_key, period_from, period_to, window_basis, export_batch_id)
    select b.as_of_date, b.expense_group, s.head_name, s.debit_amount_value, s.credit_amount_value, s.net_cb_value,
           b.source_key, b.returned_from, b.returned_to, c.window_basis, b.id
      from public.tally_expense_export_staging s where s.batch_id = b.id
    on conflict (as_of_date, expense_group, head_name) do update
      set debit_amount_value = excluded.debit_amount_value, credit_amount_value = excluded.credit_amount_value,
          net_cb_value = excluded.net_cb_value, source_key = excluded.source_key, period_from = excluded.period_from,
          period_to = excluded.period_to, window_basis = excluded.window_basis, export_batch_id = excluded.export_batch_id;
    get diagnostics v_n = row_count;
    -- heads present in an earlier load of the same date/group but absent now are removed (Tally omits zero heads)
    delete from public.tally_expenses_snapshot t where t.as_of_date = b.as_of_date and t.expense_group = b.expense_group
       and not exists (select 1 from public.tally_expense_export_staging s where s.batch_id = b.id and s.head_name = t.head_name);
    update public.tally_expense_export_batch x set status = 'SUPERSEDED', status_reason = format('superseded by batch %s', b.id)
     where x.as_of_date = b.as_of_date and x.expense_group = b.expense_group and x.status = 'ACCEPTED' and x.id <> b.id;
    perform set_config('tally.contract_batch', '', true);
  end if;
  return query select b.id, c.status, c.reason, v_n;
end $$;

-- 6b. Regime detection honours validated, declared windows (same signature as AU-3; inference remains the fallback)
create or replace function costing.fn_tally_snapshot_regimes(p_drop_ratio numeric default 0.5, p_head_share numeric default 0.6)
returns table(as_of_date date, fy_start date, regime_seq int, basis text, window_start date,
              window_start_basis text, heads int, abs_total numeric, evidence jsonb)
language plpgsql stable set search_path = public, costing as $$
declare
  r record; v_prev date; v_fy date; v_seq int := 0; v_basis text; v_wstart date; v_fymax numeric := 0;
  v_ratio numeric; v_share numeric; v_common int; v_new boolean; v_ov date; v_pb text; v_pw date; v_db text;
begin
  for r in select s.as_of_date d, count(*)::int h, sum(abs(coalesce(s.net_cb_value,0))) t,
                  case when count(*) = count(s.period_from) and count(distinct s.period_from) = 1 then min(s.period_from) end declared_from,
                  case when count(*) = count(s.period_from) and count(distinct s.window_basis) = 1 then min(s.window_basis) end declared_basis
             from public.tally_expenses_snapshot s group by 1 order by 1 loop
    v_ratio := null; v_share := null; v_common := 0; v_new := false; v_pb := v_basis; v_pw := v_wstart;
    if v_fy is distinct from costing.fn_fy_start(r.d) then
      v_fy := costing.fn_fy_start(r.d); v_fymax := 0; v_new := true; v_basis := 'FYTD'; v_wstart := v_fy;
    else
      select count(*), sum(abs(coalesce(c.net_cb_value,0)))/nullif(sum(abs(coalesce(p.net_cb_value,0))),0),
             avg((abs(coalesce(c.net_cb_value,0)) < abs(coalesce(p.net_cb_value,0)) - 0.005)::int)
        into v_common, v_ratio, v_share
        from public.tally_expenses_snapshot c join public.tally_expenses_snapshot p
          on p.as_of_date = v_prev and p.expense_group = c.expense_group and p.head_name = c.head_name
       where c.as_of_date = r.d;
      if v_basis = 'RESET_WINDOW' and r.t >= p_drop_ratio * v_fymax then
        v_new := true; v_basis := 'FYTD'; v_wstart := v_fy;
      elsif coalesce(v_ratio,1) < p_drop_ratio and coalesce(v_share,0) >= p_head_share then
        v_new := true; v_basis := 'RESET_WINDOW'; v_wstart := r.d;
      end if;
    end if;
    -- AU-3b: an export that declares (and was validated for) its window overrides inference for that date.
    if r.declared_from is not null then
      v_db := case when r.declared_basis like 'FYTD%' then 'FYTD' else 'RESET_WINDOW' end;
      v_new := (v_pw is distinct from r.declared_from) or (v_pb is distinct from v_db);
      v_basis := v_db; v_wstart := r.declared_from;
    end if;
    if v_new then v_seq := v_seq + 1; end if;
    if v_basis = 'FYTD' then v_fymax := greatest(v_fymax, r.t); end if;
    select o.window_start into v_ov from costing.tally_snapshot_window_override o
     where r.d between o.as_of_date_from and o.as_of_date_to order by o.confirmed_at desc, o.id desc limit 1;
    as_of_date := r.d; fy_start := v_fy; regime_seq := v_seq; basis := v_basis; heads := r.h; abs_total := r.t;
    window_start := coalesce(v_ov, v_wstart);
    window_start_basis := case when r.declared_from is not null then 'EXPORT_DECLARED' when v_ov is not null then 'USER_CONFIRMED'
                               when v_basis='FYTD' then 'FY_START' else 'INFERRED_RESET_DATE' end;
    if r.declared_from is not null then window_start := r.declared_from; end if;
    evidence := jsonb_build_object('prev_date',v_prev,'common_heads',v_common,'total_ratio_vs_prev',round(v_ratio,4),
                                   'share_heads_fell',round(v_share,4),'opens_regime',v_new,
                                   -- AMBIGUOUS: exactly one of the two reset signals fired (or too few heads to judge a drop);
                                   -- months touching such a date can never be COMPLETE.
                                   'signal', case when v_new or v_prev is null or r.declared_from is not null then 'CLEAR'
                                                  when (coalesce(v_ratio,1) < p_drop_ratio) <> (coalesce(v_share,0) >= p_head_share) then 'AMBIGUOUS'
                                                  when coalesce(v_ratio,1) < p_drop_ratio and v_common < 3 then 'AMBIGUOUS'
                                                  else 'CLEAR' end);
    return next; v_prev := r.d;
  end loop;
end $$;

-- 7. Gate on direct writes (mode OFF by default: no effect; WARN logs; ENFORCE rejects writes not made by the RPC)
-- SECURITY DEFINER: the trigger fires for the ETL's service_role, which has no grant on the
-- settings/violation tables. Without this, even mode OFF would break the live loader (found 2026-10-15).
create or replace function public.fn_tally_expense_contract_gate() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_mode text; v_batch text;
begin
  select enforcement_mode into v_mode from public.tally_export_contract_setting;
  if coalesce(v_mode,'OFF') = 'OFF' then return new; end if;
  v_batch := nullif(current_setting('tally.contract_batch', true), '');
  if v_batch is not null and new.export_batch_id::text = v_batch then return new; end if;
  if v_mode = 'ENFORCE' then
    raise exception 'TALLY_CONTRACT_ENFORCED: expense rows must be loaded through rpc_tally_validate_and_load_expense_batch (explicit period_from/period_to)';
  end if;
  begin
    insert into public.tally_expense_contract_violation(as_of_date, expense_group, head_name, source_key, reason, mode)
    values (new.as_of_date, new.expense_group, new.head_name, new.source_key, 'direct write without validated export window', v_mode);
  exception when others then null;  -- WARN must never block the legacy loader
  end;
  return new;
end $$;
drop trigger if exists trg_tally_expense_contract_gate on public.tally_expenses_snapshot;
create trigger trg_tally_expense_contract_gate before insert or update on public.tally_expenses_snapshot
  for each row execute function public.fn_tally_expense_contract_gate();
revoke all on function public.fn_tally_expense_contract_gate() from public, anon, authenticated;

revoke all on public.tally_expense_export_batch, public.tally_expense_export_staging, public.tally_expense_contract_violation,
              public.tally_export_contract_setting from anon, authenticated;
grant select, insert on public.tally_expense_export_batch, public.tally_expense_export_staging to service_role;
grant usage on sequence public.tally_expense_export_batch_id_seq to service_role;
revoke all on function public.rpc_tally_validate_and_load_expense_batch(bigint) from public, anon, authenticated;
grant execute on function public.rpc_tally_validate_and_load_expense_batch(bigint) to service_role;
