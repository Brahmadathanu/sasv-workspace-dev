-- DRAFT (not applied). Universal standard-batch fallback hierarchy; frequency kept separate from cost.
create table if not exists costing.product_standard_batch_basis (
  id bigserial primary key,
  product_id bigint not null,
  basis_tier smallint not null check (basis_tier in (1,2,3)), -- 1 verified history, 2 approved product standard, 3 evidence-derived provisional
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
language sql stable set search_path to 'costing','pg_temp' as $f$
  with c as (select b.* from costing.product_standard_batch_basis b
    where b.product_id=p_product_id and b.effective_from<=p_valuation_date and (b.effective_to is null or b.effective_to>=p_valuation_date)
      and ((b.basis_tier in (1,2) and b.approval_status='APPROVED') or (b.basis_tier=3 and b.approval_status in ('PROPOSED','APPROVED')))
    order by b.basis_tier, b.effective_from desc, b.version desc limit 1)
  select p_product_id, coalesce((select case when basis_tier=3 then 'PROVISIONAL' else 'RESOLVED' end from c),'UNRESOLVED_FAIL_CLOSED'),
    c.basis_tier,c.id,c.batch_size,c.net_output_base,c.yield_pct from (select 1) d left join c on true
$f$;
