-- SEC-P01: shared master data ACL isolation (e-Aushadhi programme).
-- Deployment requires separate approval. No data DML. Idempotent.
-- Scope: exactly 5 public tables + their owned identity sequences.
-- Effect: anon/authenticated/PUBLIC lose all direct table & sequence access;
--         RLS ENABLED (not FORCED), no client policies;
--         owner (postgres) and service_role access preserved explicitly.
-- Readers that keep working: SECURITY DEFINER functions owned by postgres
-- (rpc_eaushadhi_source_issue_context) and postgres-owned views without
-- security_invoker (regulatory.v_source_line_material_resolution).

do $sec_p01$
declare
  v_tables constant text[] := array[
    'inv_material_identity',
    'inv_material_identity_name',
    'inv_material_identity_part',
    'inv_material_stock_item_map',
    'therapeutic_indication_lexicon_entry'
  ];
  v_t   text;
  v_oid oid;
  v_seq record;
begin
  -- Guard: every table must exist, be an ordinary table owned by postgres,
  -- must not have FORCE RLS, and must not already carry policies.
  foreach v_t in array v_tables loop
    v_oid := to_regclass(format('public.%I', v_t));
    if v_oid is null then
      raise exception 'SEC-P01 guard: table public.% not found', v_t;
    end if;
    if (select relkind from pg_class where oid = v_oid) <> 'r' then
      raise exception 'SEC-P01 guard: public.% is not an ordinary table', v_t;
    end if;
    if pg_get_userbyid((select relowner from pg_class where oid = v_oid)) <> 'postgres' then
      raise exception 'SEC-P01 guard: public.% is not owned by postgres', v_t;
    end if;
    if (select relforcerowsecurity from pg_class where oid = v_oid) then
      raise exception 'SEC-P01 guard: public.% unexpectedly has FORCE RLS', v_t;
    end if;
    if exists (select 1 from pg_policy where polrelid = v_oid) then
      raise exception 'SEC-P01 guard: public.% unexpectedly has policies', v_t;
    end if;
  end loop;

  foreach v_t in array v_tables loop
    -- Tables
    execute format('revoke all privileges on table public.%I from public, anon, authenticated', v_t);
    execute format('grant select, insert, update, delete, truncate, references, trigger on table public.%I to service_role', v_t);
    execute format('alter table public.%I enable row level security', v_t);

    -- Owned sequences (identity/serial)
    for v_seq in
      select s.oid::regclass as seq
      from pg_depend d
      join pg_class s on s.oid = d.objid and s.relkind = 'S'
      where d.refobjid = to_regclass(format('public.%I', v_t))
        and d.deptype in ('a','i')
    loop
      execute format('revoke all privileges on sequence %s from public, anon, authenticated', v_seq.seq);
      execute format('grant usage, select, update on sequence %s to service_role', v_seq.seq);
    end loop;
  end loop;
end
$sec_p01$;
