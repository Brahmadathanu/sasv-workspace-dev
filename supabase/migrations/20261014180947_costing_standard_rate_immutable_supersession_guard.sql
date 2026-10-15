create or replace function costing.fn_guard_manufacturing_standard_rate_policy()
returns trigger language plpgsql set search_path=costing,pg_temp as $$
begin
 if tg_op='DELETE' then
   raise exception 'Manufacturing standard-rate policy records cannot be deleted';
 end if;
 if tg_op='UPDATE' then
   if old.status in ('APPROVED','SUPERSEDED') then
     raise exception 'Approved/superseded standard-rate records are immutable; insert a new version';
   end if;
   new.updated_at:=clock_timestamp();
 end if;
 if new.status='APPROVED' and exists (
  select 1 from costing.manufacturing_standard_rate_policy p
   where p.id<>new.id and p.status='APPROVED'
   and p.allocation_pool=new.allocation_pool and p.component_code=new.component_code
   and p.effective_from=new.effective_from
 ) then
   raise exception 'Duplicate approved rate effective date for pool/component';
 end if;
 return new;
end $$;
comment on function costing.fn_resolve_manufacturing_standard_rate(text,text,date) is
'Approved as-of rate resolver. Latest effective_from wins, allowing immutable open-ended predecessor records to be superseded by later approved versions; no consumer cutover is performed by this function.';