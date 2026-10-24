-- PREPARED (not applied): W5 step 2, recorded fingerprint re-baseline of the two APPROVED runs.
-- Requires PREPARED_W5_fingerprint_fixed_columns.sql installed first. Apply only after explicit user approval, unchanged.
-- Run 122: the 17-Oct column addition (sku_sales_allocation_basis_snapshot.monthly_driver_plan_id, empty for run 122) caused a
--   false drift. The re-baseline hashes that table WITHOUT the added column and must reproduce the approved capture (id 4)
--   for all 50 tables byte for byte, otherwise it refuses. Nothing in run 122 is modified.
-- Run 128: no exclusions; must reproduce the approved capture (id 11) for all 51 tables. This only records the column lists
--   so future column additions cannot cause drift.
do $pre$
begin
  if not exists (select 1 from pg_proc where proname = 'rpc_rebaseline_run_fingerprint') then raise exception 'W5 step 2: install W5 first'; end if;
  if (select designation from costing.v_costing_run_effective_designation where refresh_run_id = 122) is distinct from 'APPROVED'
     or (select designation from costing.v_costing_run_effective_designation where refresh_run_id = 128) is distinct from 'APPROVED' then
    raise exception 'W5 step 2: runs 122/128 must be APPROVED'; end if;
end $pre$;

select costing.rpc_rebaseline_run_fingerprint(122, 4, '{"sku_sales_allocation_basis_snapshot": ["monthly_driver_plan_id"]}'::jsonb,
  'Dr. Brahmadathan U',
  'W5 re-baseline: false drift from nullable column monthly_driver_plan_id added 17-Oct (20261017235758); values proven identical to approved capture 4',
  'USER-APPROVAL-W5-REBASELINE');
select costing.rpc_rebaseline_run_fingerprint(128, 11, '{}'::jsonb,
  'Dr. Brahmadathan U',
  'W5 re-baseline: record fixed column lists for approved run 128; values proven identical to approved capture 11',
  'USER-APPROVAL-W5-REBASELINE');

do $post$
declare v_bad text[];
begin
  select array_agg(table_name) into v_bad from costing.fn_verify_run_fingerprint(122) where not matches;
  if v_bad is not null then raise exception 'W5 step 2 postcheck: run 122 drift %', v_bad; end if;
  select array_agg(table_name) into v_bad from costing.fn_verify_run_fingerprint(128) where not matches;
  if v_bad is not null then raise exception 'W5 step 2 postcheck: run 128 drift %', v_bad; end if;
end $post$;
