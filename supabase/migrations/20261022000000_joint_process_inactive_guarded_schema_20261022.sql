-- SOURCE PARITY: apply_migration named joint_process_inactive_guarded_schema_20261022.
-- Repository filename timestamp is provisional; authoritative live version must be checked.
create table costing.joint_process_policy (
 id bigint generated always as identity primary key,
 process_code text not null,
 effective_from date not null,
 effective_to date,
 reference_output_qty numeric(18,6) not null check(reference_output_qty>0),
 output_uom text not null check(output_uom='Kg'),
 allocation_method text not null default 'OUTPUT_MASS' check(allocation_method='OUTPUT_MASS'),
 approval_reference text not null check(length(btrim(approval_reference))>0),
 created_at timestamptz not null default now(),
 constraint joint_process_dates check(effective_to is null or effective_to>effective_from),
 constraint joint_process_no_overlap exclude using gist
 (process_code with =, daterange(effective_from,coalesce(effective_to,'infinity'::date),'[)') with &&)
);
create table costing.joint_process_output(
 policy_id bigint not null references costing.joint_process_policy(id) on delete restrict,
 product_id integer not null references public.products(id) on delete restrict,
 output_qty numeric(18,6) not null check(output_qty>0),
 primary key(policy_id,product_id)
);
create table costing.joint_process_stage(
 policy_id bigint not null references costing.joint_process_policy(id) on delete restrict,
 base_step_id bigint not null references costing.production_route_family_route_step(id) on delete restrict,
 common_cycles numeric(18,6) not null check(common_cycles>=0),
 continuation_cycles numeric(18,6) not null check(continuation_cycles>=0),
 continuation_product_id integer not null references public.products(id) on delete restrict,
 primary key(policy_id,base_step_id)
);
create function costing.fn_joint_process_block_change() returns trigger language plpgsql
set search_path=pg_catalog,pg_temp as $$
begin
 raise exception 'JOINT_PROCESS_IMMUTABLE: controlled versioning required';
end $$;
create trigger joint_policy_block_change before update or delete on costing.joint_process_policy
for each row execute function costing.fn_joint_process_block_change();
create trigger joint_output_block_change before update or delete on costing.joint_process_output
for each row execute function costing.fn_joint_process_block_change();
create trigger joint_stage_block_change before update or delete on costing.joint_process_stage
for each row execute function costing.fn_joint_process_block_change();
create trigger joint_policy_forward_date before insert on costing.joint_process_policy
for each row execute function costing.fn_guard_effective_date_forward();
insert into costing.effective_date_guard_config(table_name,mode,note,approval_reference)
values ('costing.joint_process_policy'::regclass,'FORWARD_ONLY',
'Price revision joint process future-effective policies; inactive pending governed approval path',
'PRP_STEP72_USER_APPROVAL_20261022');
alter table costing.joint_process_policy enable row level security;
alter table costing.joint_process_output enable row level security;
alter table costing.joint_process_stage enable row level security;
revoke all on costing.joint_process_policy,costing.joint_process_output,costing.joint_process_stage from public,anon,authenticated;
revoke all on function costing.fn_joint_process_block_change() from public,anon,authenticated;
