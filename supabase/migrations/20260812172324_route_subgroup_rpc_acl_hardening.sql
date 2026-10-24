-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- Close anonymous/public execute on newly-added Product Subgroup route-mapping commands.
revoke all on function public.rpc_map_product_subgroup_to_route_family(bigint,integer,date,text,text) from public,anon;
revoke all on function public.rpc_submit_product_subgroup_route_family_mapping_for_review(bigint) from public,anon;
revoke all on function public.rpc_approve_product_subgroup_route_family_mapping(bigint,text,date) from public,anon;
revoke all on function public.rpc_update_product_subgroup_route_family_mapping_draft(bigint,jsonb) from public,anon;
revoke all on function public.rpc_inactivate_product_subgroup_route_family_mapping(bigint,date) from public,anon;

grant execute on function public.rpc_map_product_subgroup_to_route_family(bigint,integer,date,text,text) to authenticated;
grant execute on function public.rpc_submit_product_subgroup_route_family_mapping_for_review(bigint) to authenticated;
grant execute on function public.rpc_approve_product_subgroup_route_family_mapping(bigint,text,date) to authenticated;
grant execute on function public.rpc_update_product_subgroup_route_family_mapping_draft(bigint,jsonb) to authenticated;
grant execute on function public.rpc_inactivate_product_subgroup_route_family_mapping(bigint,date) to authenticated;