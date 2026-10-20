create or replace function public.trg_bmr_admin_completed_remap_supersede() returns trigger language plpgsql set search_path='pg_catalog','public','pg_temp' as $$
declare old_product bigint; new_product bigint;
begin
 if new.status <> 'COMPLETED' or new.operation_type <> 'REMAP_BMR' or new.old_bmr_id is null or new.new_bmr_id is null or new.old_bmr_id=new.new_bmr_id then return new;end if;
 select product_id into old_product from public.bmr_details where id=new.old_bmr_id for update;
 select product_id into new_product from public.bmr_details where id=new.new_bmr_id;
 if old_product is null or new_product is null or old_product <> new_product or new.product_id is distinct from old_product then
 raise exception 'Cannot supersede BMR with mismatched product identities (old %, new %)',new.old_bmr_id,new.new_bmr_id;
 end if;
 if exists(select 1 from public.batch_plan_batches where bmr_id=new.old_bmr_id) then raise exception 'Cannot supersede BMR still assigned to a production batch plan';end if;
 if not exists(select 1 from public.bmr_details where id=new.new_bmr_id and lifecycle_status='ACTIVE') then raise exception 'Replacement BMR must be ACTIVE';end if;
 update public.bmr_details set lifecycle_status='SUPERSEDED' where id=new.old_bmr_id and lifecycle_status='ACTIVE';
 return new;
end $$;
drop trigger if exists trg_bmr_admin_completed_remap_supersede on public.bmr_administrative_corrections;
create trigger trg_bmr_admin_completed_remap_supersede after insert on public.bmr_administrative_corrections
for each row execute function public.trg_bmr_admin_completed_remap_supersede();
