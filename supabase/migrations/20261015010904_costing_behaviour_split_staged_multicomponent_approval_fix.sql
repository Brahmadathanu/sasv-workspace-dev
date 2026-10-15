create or replace function costing.fn_guard_manufacturing_behaviour_split()
returns trigger language plpgsql security invoker set search_path=costing,public,pg_temp as $$
declare src numeric; total_split numeric; matches bigint;
begin
 if tg_op='DELETE' then raise exception 'Classification rows cannot be deleted; preserve audit trail'; end if;
 if tg_op='UPDATE' and old.status='APPROVED' then raise exception 'Approved classification immutable; use a new governed reference period'; end if;
 if tg_op='UPDATE' and (new.reference_refresh_run_id<>old.reference_refresh_run_id or new.source_component_code<>old.source_component_code or new.split_code<>old.split_code)
 then raise exception 'Classification identity immutable'; end if;
 select count(*),max(source_amount) into matches,src from costing.fn_preview_manufacturing_rate_approval_inputs(new.reference_refresh_run_id)
 where component_code=new.source_component_code;
 if matches<>1 or src is null then raise exception 'Unknown/ambiguous source component'; end if;
 if new.source_reference_amount>src+0.000001 then raise exception 'Split exceeds source component'; end if;
 select coalesce(sum(source_reference_amount),0) into total_split from costing.manufacturing_cost_behaviour_split
 where reference_refresh_run_id=new.reference_refresh_run_id and source_component_code=new.source_component_code
 and id is distinct from new.id;
 if total_split+new.source_reference_amount>src+0.000001 then raise exception 'Total split exceeds source component'; end if;
 if new.status='APPROVED' and abs(total_split+new.source_reference_amount-src)>0.000001
 then raise exception 'Approval requires all portions of source to be fully classified'; end if;
 return new;
end $$;