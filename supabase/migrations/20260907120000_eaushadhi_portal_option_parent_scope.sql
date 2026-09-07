-- Governed parent scope for portal_option.
-- Existing composition rows remain unscoped (empty parent keys).
-- Does not mutate product review / workflow / ENTERED records.

alter table regulatory.portal_option
  add column if not exists parent_domain_code text not null default '',
  add column if not exists parent_external_id text not null default '';

drop index if exists regulatory.portal_option_external_id_uidx;
drop index if exists regulatory.portal_option_label_uidx;

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
