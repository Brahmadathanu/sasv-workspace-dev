
alter table public.bmr_details add column if not exists lifecycle_status text not null default 'ACTIVE'
 constraint bmr_details_lifecycle_status_check check (lifecycle_status in ('ACTIVE','SUPERSEDED','CANCELLED'));
update public.bmr_details b set lifecycle_status='SUPERSEDED'
where exists (select 1 from public.bmr_administrative_corrections c
 where c.old_bmr_id=b.id and c.operation_type='REMAP_BMR' and c.status='COMPLETED' and c.new_bmr_id is not null);
create or replace function public.fn_bmr_is_operational(p_bmr_id integer)
returns boolean language sql stable security invoker set search_path='pg_catalog','public'
as $$ select exists(select 1 from public.bmr_details where id=p_bmr_id and lifecycle_status='ACTIVE') $$;
create or replace function public.trg_reject_nonactive_bmr_reference()
returns trigger language plpgsql set search_path='pg_catalog','public' as $$
declare v_id integer;
begin
 if tg_op='UPDATE' and new.bmr_id is not distinct from old.bmr_id then return new;end if;
 v_id:=new.bmr_id;
 if v_id is not null and not public.fn_bmr_is_operational(v_id) then
 raise exception using errcode='23514',message=format('BMR %s is not ACTIVE and cannot be assigned to new operational records',v_id);
 end if;
 return new;
end $$;
drop trigger if exists trg_active_bmr_batch_plan on public.batch_plan_batches;
create trigger trg_active_bmr_batch_plan before insert or update on public.batch_plan_batches
for each row execute function public.trg_reject_nonactive_bmr_reference();
drop trigger if exists trg_active_bmr_lab_analysis on lab.analysis_record;
create trigger trg_active_bmr_lab_analysis before insert or update on lab.analysis_record
for each row execute function public.trg_reject_nonactive_bmr_reference();
create or replace view lab.v_sample_receipt_fg_batch_picker as
select bd.id as bmr_id,bd.product_id,bd.bn as batch_no,bd.batch_size,bd.uom
from public.bmr_details bd where bd.lifecycle_status='ACTIVE' order by bd.product_id,bd.bn;
create or replace view public.v_bmr_batch_sizes as
select product_id,bn,batch_size,uom from public.bmr_details where lifecycle_status='ACTIVE';
create or replace view public.v_bmr_with_map_flag as
select d.id as bmr_id,d.item,d.bn,d.batch_size,d.uom,d.product_id,
exists(select 1 from public.batch_plan_batches b where b.bmr_id=d.id) as is_mapped,
(select b.header_id from public.batch_plan_batches b where b.bmr_id=d.id order by b.updated_at desc nulls last,b.id desc limit 1) as mapped_header_id,
(select b.id from public.batch_plan_batches b where b.bmr_id=d.id order by b.updated_at desc nulls last,b.id desc limit 1) as mapped_batch_plan_batch_id
from public.bmr_details d where d.lifecycle_status='ACTIVE';
