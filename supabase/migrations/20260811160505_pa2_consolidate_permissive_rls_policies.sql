-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- 1. hub_user_access: retain one identical authenticated self-read policy.
drop policy if exists "user reads own access rows" on public.hub_user_access;
drop policy if exists "users can read their own access" on public.hub_user_access;

-- 2. permission_targets: replace ALL admin policy with write-only command policies.
drop policy if exists "pt_write_admin_only" on public.permission_targets;
create policy "pt_insert_admin_only"
on public.permission_targets
for insert to authenticated
with check (is_admin());
create policy "pt_update_admin_only"
on public.permission_targets
for update to authenticated
using (is_admin())
with check (is_admin());
create policy "pt_delete_admin_only"
on public.permission_targets
for delete to authenticated
using (is_admin());

-- 3. PLM BOM header: preserve broad authenticated SELECT; split editor writes from ALL.
drop policy if exists "plm_bom_header_write" on public.plm_bom_header;
create policy "plm_bom_header_insert"
on public.plm_bom_header
for insert to authenticated
with check (can_edit_plm_bom());
create policy "plm_bom_header_update"
on public.plm_bom_header
for update to authenticated
using (can_edit_plm_bom())
with check (can_edit_plm_bom());
create policy "plm_bom_header_delete"
on public.plm_bom_header
for delete to authenticated
using (can_edit_plm_bom());

-- 4. PLM BOM line: same authorization algebra as header.
drop policy if exists "plm_bom_line_write" on public.plm_bom_line;
create policy "plm_bom_line_insert"
on public.plm_bom_line
for insert to authenticated
with check (can_edit_plm_bom());
create policy "plm_bom_line_update"
on public.plm_bom_line
for update to authenticated
using (can_edit_plm_bom())
with check (can_edit_plm_bom());
create policy "plm_bom_line_delete"
on public.plm_bom_line
for delete to authenticated
using (can_edit_plm_bom());

-- 5. tally_fg_transfer_snapshot: false ALL policy is redundant; absence of write policies remains deny-by-default under RLS.
drop policy if exists "fg_transfer_snapshot_no_write" on public.tally_fg_transfer_snapshot;

-- 6. user_permissions_canonical: split admin writes and consolidate SELECT algebra to one policy.
drop policy if exists "upc_admin_modify" on public.user_permissions_canonical;
drop policy if exists "upc_select_admin" on public.user_permissions_canonical;
drop policy if exists "upc_select_self" on public.user_permissions_canonical;

create policy "upc_select_admin_or_self"
on public.user_permissions_canonical
for select to authenticated
using (is_admin() or user_id = (select auth.uid()));

create policy "upc_admin_insert"
on public.user_permissions_canonical
for insert to authenticated
with check (is_admin());
create policy "upc_admin_update"
on public.user_permissions_canonical
for update to authenticated
using (is_admin())
with check (is_admin());
create policy "upc_admin_delete"
on public.user_permissions_canonical
for delete to authenticated
using (is_admin());