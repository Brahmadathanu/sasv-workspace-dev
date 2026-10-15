do $$
declare ddl text;
begin
 ddl:=pg_get_functiondef('costing.fn_preview_standard_batch_workload(bigint)'::regprocedure);
 if strpos(ddl,'on b.product_id=c.product_id and b.is_active=true')=0 then
  raise exception 'Expected as-of predicate not found; migration stopped';
 end if;
 ddl:=replace(ddl,'on b.product_id=c.product_id and b.is_active=true','on b.product_id=c.product_id');
 execute ddl;
end $$;
comment on function costing.fn_preview_standard_batch_workload(bigint) is 'Read-only preferred-batch reference workload as of historical valuation date; effective_from/effective_to govern history, NOT current is_active. Never implies actual production or absorption.';