-- DRAFT (not applied). Universal standard-batch fallback hierarchy; frequency kept separate from cost.
create table if not exists costing.product_standard_batch_basis (
  id bigserial primary key,
  product_id bigint not null,
  basis_tier smallint not null check (basis_tier in (1,3)), -- 1 verified history, 3 evidence-derived provisional. Tier 2 (approved standard) = public.production_batch_size_ref (existing; not duplicated)
  batch_size numeric not null check (batch_size>0), batch_uom text not null,
  net_output_base numeric not null check (net_output_base>0), yield_pct numeric generated always as (round(100*net_output_base/batch_size,2)) stored,
  source_refs jsonb not null, rationale text not null, calc_sql text not null,
  version int not null default 1, effective_from date not null, effective_to date,
  confidence text not null check (confidence in ('HIGH','MEDIUM','LOW')),
  approval_status text not null default 'PROPOSED' check (approval_status in ('PROPOSED','APPROVED','REJECTED','SUPERSEDED')),
  approved_by text, approved_at timestamptz,
  unique (product_id,basis_tier,version)
);
-- frequency is separate (batches/period), never multiplied into cost/unit
create table if not exists costing.product_manufacturing_frequency (
  product_id bigint not null, effective_from date not null, batches_per_year numeric not null check (batches_per_year>=0),
  source text not null, approval_status text not null default 'PROPOSED', primary key(product_id,effective_from));

create or replace function costing.fn_resolve_standard_batch(p_product_id bigint, p_valuation_date date)
returns table(product_id bigint, status text, basis_tier smallint, basis_id bigint, batch_size numeric, net_output_base numeric, yield_pct numeric)
language sql stable set search_path to 'costing','public','pg_temp' as $f$
  with t1 as (select 1::smallint tier, b.id, b.batch_size, b.net_output_base, b.yield_pct, b.effective_from, b.version from costing.product_standard_batch_basis b
      where b.product_id=p_product_id and b.basis_tier=1 and b.approval_status='APPROVED'
        and b.effective_from<=p_valuation_date and (b.effective_to is null or b.effective_to>=p_valuation_date)),
  t2 as (select 2::smallint, r.id, r.preferred_batch_size, r.preferred_batch_size, null::numeric, r.effective_from, 1 from public.production_batch_size_ref r
      where r.product_id=p_product_id and r.is_active and r.preferred_batch_size>0
        and r.effective_from<=p_valuation_date and (r.effective_to is null or r.effective_to>=p_valuation_date)),
  t3 as (select 3::smallint, b.id, b.batch_size, b.net_output_base, b.yield_pct, b.effective_from, b.version from costing.product_standard_batch_basis b
      where b.product_id=p_product_id and b.basis_tier=3 and b.approval_status in ('PROPOSED','APPROVED')
        and b.effective_from<=p_valuation_date and (b.effective_to is null or b.effective_to>=p_valuation_date)),
  c as (select * from (select * from t1 union all select * from t2 union all select * from t3) u order by 1, effective_from desc, version desc, id desc limit 1)
  select p_product_id, coalesce((select case when tier=3 then 'PROVISIONAL' else 'RESOLVED' end from c),'UNRESOLVED_FAIL_CLOSED'),
    c.tier, c.id, c.batch_size, c.net_output_base, c.yield_pct from (select 1) d left join c on true
$f$;
-- Tier 2 net output = preferred batch size (yield unknown => yield_pct NULL, not assumed). Tier 2 reads the existing production_batch_size_ref; edits go through rpc_revise_supply_batch_size_reference.
