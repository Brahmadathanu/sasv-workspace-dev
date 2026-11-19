-- WP10 classification SELECT hardening - 04 COVERAGE REVIEW (READ-ONLY, counts only; no names, emails or ids are returned). PROPOSED / UNAPPLIED.
-- Question: which existing sign-in identities would LOSE direct classification reads under the provisioned-user gate?
-- Review every non-zero 'would_lose_reads' row with the owner BEFORE applying 02.
begin read only;
with prov as (
  select distinct c.user_id from public.user_permissions_canonical c where coalesce(c.can_view, false) or coalesce(c.can_edit, false)
)
select 'auth_identities_total' as metric, count(*)::text as value from auth.users
union all select 'provisioned_identities', count(*)::text from auth.users u join prov p on p.user_id = u.id
union all select 'would_lose_reads_total', count(*)::text from auth.users u where not exists (select 1 from prov p where p.user_id = u.id)
union all select 'would_lose_reads_signed_in_last_30d', count(*)::text from auth.users u where not exists (select 1 from prov p where p.user_id = u.id) and u.last_sign_in_at >= now() - interval '30 days'
union all select 'would_lose_reads_signed_in_last_90d', count(*)::text from auth.users u where not exists (select 1 from prov p where p.user_id = u.id) and u.last_sign_in_at >= now() - interval '90 days'
union all select 'would_lose_reads_never_signed_in', count(*)::text from auth.users u where not exists (select 1 from prov p where p.user_id = u.id) and u.last_sign_in_at is null;
rollback;
