-- Live applied: 20261123120209_plm_rebuild_multiple_new_sku_overrides_unique_line_numbers
-- Prevent multiple SKU-level ADD/SET override materials from sharing the same
-- compiled PM BOM line_no. Existing lines retain their sequence; new ones
-- receive unique numbers above the current maximum. Fail closed on drift.
do $$
declare
  v_def text;
  v_old text := 'coalesce(l.line_no, (select coalesce(max(line_no),0)+1 from plm_bom_line where plm_bom_id = v_hdr_id))';
  v_new text := 'coalesce(l.line_no, (select coalesce(max(line_no),0) from plm_bom_line where plm_bom_id = v_hdr_id) + row_number() over (order by o.stock_item_id, o.uom_id))';
begin
  select pg_get_functiondef('public.fn_plm_rebuild_sku(bigint)'::regprocedure) into v_def;
  if position(v_old in v_def)=0 then
    if position(v_new in v_def)>0 then raise notice 'Already patched'; return; end if;
    raise exception 'Expected override line numbering expression missing';
  end if;
  if length(v_def)-length(replace(v_def,v_old,''))<>length(v_old) then
    raise exception 'Expected exactly one matching expression';
  end if;
  execute replace(v_def,v_old,v_new);
end $$;
