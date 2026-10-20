
create or replace function public.trg_guard_active_bmr_override_identity()
returns trigger language plpgsql set search_path='pg_catalog','public','pg_temp' as $$
begin
 if tg_op='UPDATE' and (new.product_id,new.bn,new.batch_size,new.uom) is not distinct from (old.product_id,old.bn,old.batch_size,old.uom) then return new;end if;
 if not exists (select 1 from public.bmr_details b where b.product_id=new.product_id and b.bn=new.bn and b.batch_size=new.batch_size and b.uom=new.uom and b.lifecycle_status='ACTIVE') then
 raise exception using errcode='23514',message='Production override cannot reference a non-ACTIVE BMR identity';
 end if;
 return new;
end $$;
drop trigger if exists trg_active_bmr_override on public.production_batch_overrides;
create trigger trg_active_bmr_override before insert or update on public.production_batch_overrides for each row execute function public.trg_guard_active_bmr_override_identity();
drop trigger if exists trg_active_bmr_override_staging on public.production_batch_overrides_staging;
create trigger trg_active_bmr_override_staging before insert or update on public.production_batch_overrides_staging for each row execute function public.trg_guard_active_bmr_override_identity();
create or replace view public.v_batch_overrides_effective as
select o.product_id,o.month_start,o.bn,o.batch_size,o.uom,o.op_type,o.override_qty,o.note,o.created_by,o.created_at,o.updated_at
from public.production_batch_overrides o
where o.is_active=true and exists(select 1 from public.bmr_details b where b.product_id=o.product_id and b.bn=o.bn and b.batch_size=o.batch_size and b.uom=o.uom and b.lifecycle_status='ACTIVE');
