-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $migration$
declare
  v_def text;
  v_old_decl text := 'declare r costing.product_process_route%rowtype; v_id bigint; v_op text; v_base_step_id bigint; v_override_reason text; v_base_allows_skip boolean; v_base_family_route_id bigint;';
  v_new_decl text := 'declare r costing.product_process_route%rowtype; v_id bigint; v_op text; v_base_step_id bigint; v_override_reason text; v_base_allows_skip boolean; v_base_family_route_id bigint; v_base_route_step_scope text;';
  v_old_block text := $old$
    select s.allows_skip_with_approval,s.family_route_id into v_base_allows_skip,v_base_family_route_id from costing.production_route_family_route_step s where s.id=v_base_step_id;
    if v_base_family_route_id is null then raise exception 'Base Route Family step % not found',v_base_step_id; end if;
    if v_base_family_route_id<>r.base_route_family_route_id then raise exception 'Bypass step does not belong to the Product route base family route'; end if;
    if not coalesce(v_base_allows_skip,false) then raise exception 'Base Route Family step % does not permit approved bypass',v_base_step_id; end if;
$old$;
  v_new_block text := $new$
    select s.allows_skip_with_approval,s.family_route_id,s.route_step_scope into v_base_allows_skip,v_base_family_route_id,v_base_route_step_scope from costing.production_route_family_route_step s where s.id=v_base_step_id;
    if v_base_family_route_id is null then raise exception 'Base Route Family step % not found',v_base_step_id; end if;
    if v_base_family_route_id<>r.base_route_family_route_id then raise exception 'Bypass step does not belong to the Product route base family route'; end if;
    if v_base_route_step_scope in ('BOUNDARY_RM_ISSUE','BOUNDARY_FG_TRANSFER') then raise exception 'RM issue and FG transfer boundaries cannot be bypassed'; end if;
$new$;
begin
  select pg_get_functiondef('public.rpc_upsert_product_route_override(bigint,bigint,jsonb)'::regprocedure) into v_def;
  if position(v_old_decl in v_def)=0 then
    raise exception 'Expected rpc_upsert_product_route_override declaration was not found; aborting migration';
  end if;
  if position(v_old_block in v_def)=0 then
    raise exception 'Expected legacy BYPASS_STEP guard was not found; aborting migration';
  end if;
  v_def := replace(v_def,v_old_decl,v_new_decl);
  v_def := replace(v_def,v_old_block,v_new_block);
  execute v_def;
end
$migration$;