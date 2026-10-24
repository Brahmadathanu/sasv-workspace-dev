-- backfilled from live schema_migrations on 2026-10-24, CI-016
insert into public.user_permissions_canonical(user_id,target,can_view,can_edit,meta,updated_at)
select u.id,'module:production-route-manager',true,true,jsonb_build_object('granted_by_migration','grant_production_route_manager_to_costing_admin'),now()
from auth.users u
where lower(u.email)=lower('drbrahmadathanu@gmail.com')
on conflict(user_id,target) do update set can_view=true,can_edit=true,meta=coalesce(public.user_permissions_canonical.meta,'{}'::jsonb)||excluded.meta,updated_at=now();