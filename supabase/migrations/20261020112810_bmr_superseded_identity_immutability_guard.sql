create or replace function public.trg_guard_bmr_historical_identity() returns trigger language plpgsql
set search_path='pg_catalog','public','pg_temp' as $$
begin
 if tg_op='DELETE' then
  if old.lifecycle_status<>'ACTIVE' then raise exception using errcode='23514',message='Historical BMR cannot be deleted';end if;
  return old;
 end if;
 if old.lifecycle_status in ('SUPERSEDED','CANCELLED') then
  if (new.item,new.bn,new.product_id,new.batch_size,new.uom,new.lifecycle_status)
     is distinct from (old.item,old.bn,old.product_id,old.batch_size,old.uom,old.lifecycle_status) then
    raise exception using errcode='23514',message='Historical BMR identity and lifecycle are immutable';
  end if;
 end if;
 return new;
end $$;
drop trigger if exists trg_bmr_historical_identity on public.bmr_details;
create trigger trg_bmr_historical_identity before update or delete on public.bmr_details
for each row execute function public.trg_guard_bmr_historical_identity();