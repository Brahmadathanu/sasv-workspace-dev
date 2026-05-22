create or replace function lab.fn_get_lab_uom_picker()
returns table (
  id bigint,
  uom_code text,
  uom_name text,
  symbol text
)
language sql
security definer
set search_path = lab, public
as $$
  select
    u.id,
    u.uom_code,
    u.uom_name,
    u.symbol
  from lab.lab_uom u
  where u.is_active = true
  order by u.uom_code;
$$;

grant execute on function lab.fn_get_lab_uom_picker() to authenticated;
notify pgrst, 'reload schema';
