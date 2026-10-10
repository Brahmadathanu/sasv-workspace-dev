-- SEC-P01: shared master data ACL isolation; deployment requires separate approval.
-- No data DML. Owner and service_role grants preserved.
-- Clients must use permission-gated RPCs. No client policies introduced.
revoke all privileges on table public.inv_material_identity from public, anon, authenticated;
alter table public.inv_material_identity enable row level security;
revoke all privileges on table public.inv_material_identity_name from public, anon, authenticated;
alter table public.inv_material_identity_name enable row level security;
revoke all privileges on table public.inv_material_identity_part from public, anon, authenticated;
alter table public.inv_material_identity_part enable row level security;
revoke all privileges on table public.inv_material_stock_item_map from public, anon, authenticated;
alter table public.inv_material_stock_item_map enable row level security;
revoke all privileges on table public.therapeutic_indication_lexicon_entry from public, anon, authenticated;
alter table public.therapeutic_indication_lexicon_entry enable row level security;
