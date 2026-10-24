-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter table public.inv_material_identity_name
  add constraint inv_material_identity_name_native_malayalam_script_chk
  check (
    name_type <> 'MALAYALAM_NATIVE'
    or name_value ~ '[ഀ-ൿ]'
  );