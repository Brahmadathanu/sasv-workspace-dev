-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare
  v_name text;
  changed integer;
begin
  loop
    changed := 0;
    for v_name in
      with rem as (
        select c.oid, c.relname
        from pg_class c
        join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public'
          and c.relkind='v'
          and has_table_privilege('authenticated', c.oid, 'SELECT')
          and not coalesce(c.reloptions::text[] @> array['security_invoker=true'], false)
      ), dep as (
        select distinct r.relname as view_name, cb.relkind,
               case when cb.relkind='r' then cb.relrowsecurity else null end rls,
               has_table_privilege('authenticated', cb.oid, 'SELECT') auth_select,
               case when cb.relkind='v' then coalesce(cb.reloptions::text[] @> array['security_invoker=true'], false) else null end base_invoker
        from rem r
        join pg_rewrite rw on rw.ev_class=r.oid
        join pg_depend d on d.classid='pg_rewrite'::regclass and d.objid=rw.oid and d.refclassid='pg_class'::regclass
        join pg_class cb on cb.oid=d.refobjid
        where cb.oid<>r.oid and cb.relkind in ('r','v','m')
      ), eligible as (
        select r.relname
        from rem r
        left join dep d on d.view_name=r.relname
        group by r.relname
        having count(*) filter (
          where (d.relkind='r' and (coalesce(d.rls,false)=false or d.auth_select=false))
             or (d.relkind='v' and (d.auth_select=false or coalesce(d.base_invoker,false)=false))
             or d.relkind='m'
        ) = 0
      )
      select relname from eligible order by relname
    loop
      execute format('alter view public.%I set (security_invoker = true)', v_name);
      changed := changed + 1;
    end loop;
    exit when changed = 0;
  end loop;
end $$;