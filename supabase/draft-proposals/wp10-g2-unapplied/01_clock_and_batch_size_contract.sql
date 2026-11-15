-- WP10 G2 PROPOSAL 01 — UNAPPLIED. DO NOT RUN against any database without separate, exact, owner-authorised operational approval.
-- Lives outside supabase/migrations on purpose. Read-only helpers only: no table is created, altered or written.
--
-- (a) costing.fn_wp10_today_ist(): the ONE place the horizon reads the clock (so isolated tests can fix it).
-- (b) costing.fn_wp10_batch_size_state_as_of(product, date): the reviewed date-parameterised batch-size contract.
--     Predicate is IDENTICAL to the inline predicate in the live costing.fn_sku_activation_missing_items (live text, independent catalog):
--       exists(active row with effective_from <= date and (effective_to is null or effective_to >= date)).
--     The live helper, CI-038a as-of rule, LIVE_AS_OF, the fingerprint and the portfolio read are NOT changed or rewritten.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function costing.fn_wp10_today_ist()
returns date
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $fn$ select (now() at time zone 'Asia/Kolkata')::date $fn$;

create or replace function costing.fn_wp10_batch_size_state_as_of(p_product_id bigint, p_as_of date)
returns text
language sql
stable
security definer
set search_path = costing, public, pg_temp
as $fn$
  select case when exists (
    select 1 from public.production_batch_size_ref b
    where b.product_id = p_product_id
      and b.is_active
      and b.effective_from <= p_as_of
      and (b.effective_to is null or b.effective_to >= p_as_of)
  ) then 'RESOLVED' else 'MISSING' end
$fn$;

revoke all on function costing.fn_wp10_today_ist() from public, anon, authenticated;
revoke all on function costing.fn_wp10_batch_size_state_as_of(bigint, date) from public, anon, authenticated;
commit;
