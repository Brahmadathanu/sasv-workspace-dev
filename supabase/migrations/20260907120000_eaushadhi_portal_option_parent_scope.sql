-- Governed parent scope for portal_option.
-- Existing composition rows remain unscoped (empty parent keys).
-- Does not mutate product review / workflow / ENTERED records.

alter table regulatory.portal_option
  add column if not exists parent_domain_code text not null default '',
  add column if not exists parent_external_id text not null default '';

do $$
declare
  rec record;
begin
  for rec in
    select i.relname as idx
    from pg_index x
    join pg_class i on i.oid = x.indexrelid
    join pg_class t on t.oid = x.indrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'regulatory'
      and t.relname = 'portal_option'
      and x.indisunique
      and not x.indisprimary
  loop
    execute format('drop index if exists regulatory.%I', rec.idx);
  end loop;
end $$;

create unique index if not exists portal_option_scoped_external_uidx
  on regulatory.portal_option (
    portal_code,
    domain_code,
    parent_domain_code,
    parent_external_id,
    external_id
  )
  where external_id is not null;

create unique index if not exists portal_option_scoped_label_uidx
  on regulatory.portal_option (
    portal_code,
    domain_code,
    parent_domain_code,
    parent_external_id,
    lower(btrim(label))
  );

comment on column regulatory.portal_option.parent_domain_code is
  'Empty string for unscoped option sets. PRODUCT_CATEGORY / PRODUCT_SUBTYPE use PRODUCT_TYPE.';
comment on column regulatory.portal_option.parent_external_id is
  'Empty string for unscoped option sets. Native parent option value when scoped.';
