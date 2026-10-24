-- backfilled from live schema_migrations on 2026-10-24, CI-016
create table public.industries_installed_capacity (
    id bigint generated always as identity primary key,
    reporting_product_group text not null,
    uom_base text not null check (uom_base in ('Kg','L','Nos')),
    annual_installed_capacity numeric not null check (annual_installed_capacity > 0),
    capacity_pool_code text not null check (capacity_pool_code in ('SHARED_KG','SHARED_LIQUID','FERMENTATION_LIQUID','SHARED_COUNT')),
    capacity_basis text not null,
    effective_from date not null,
    effective_to date null,
    is_active boolean not null default true,
    notes text null,
    created_at timestamptz not null default now(),
    created_by uuid null default auth.uid(),
    updated_at timestamptz not null default now(),
    updated_by uuid null default auth.uid(),
    constraint industries_installed_capacity_effective_dates_ck check (effective_to is null or effective_to >= effective_from),
    constraint industries_installed_capacity_natural_uq unique (reporting_product_group, uom_base, effective_from)
);

create unique index industries_installed_capacity_one_active_uq
    on public.industries_installed_capacity (reporting_product_group, uom_base)
    where is_active and effective_to is null;

comment on table public.industries_installed_capacity is
'Governed Industries Department installed-capacity register at reporting product-group + UOM grain. Repeated values may reference one shared capacity pool and are not additive across product groups.';

comment on column public.industries_installed_capacity.capacity_pool_code is
'Shared physical capacity pool. Rows carrying the same pool code are alternative users of the same installed capacity and must not be summed as independent factory capacity.';

alter table public.industries_installed_capacity enable row level security;
revoke all on table public.industries_installed_capacity from anon, authenticated;
grant all on table public.industries_installed_capacity to service_role;

create table public.industries_installed_capacity_product_group_map (
    capacity_id bigint not null references public.industries_installed_capacity(id) on delete restrict,
    product_group_id integer not null references public.product_groups(id) on delete restrict,
    mapping_basis text not null default 'REPORTING_GROUP_RESOLUTION',
    created_at timestamptz not null default now(),
    created_by uuid null default auth.uid(),
    primary key (capacity_id, product_group_id)
);

comment on table public.industries_installed_capacity_product_group_map is
'Many-to-many bridge from Industries reporting capacity rows to canonical product_group IDs. Reporting labels may aggregate several canonical groups or category-derived groups.';

alter table public.industries_installed_capacity_product_group_map enable row level security;
revoke all on table public.industries_installed_capacity_product_group_map from anon, authenticated;
grant all on table public.industries_installed_capacity_product_group_map to service_role;

insert into public.industries_installed_capacity
(reporting_product_group, uom_base, annual_installed_capacity, capacity_pool_code, capacity_basis, effective_from, notes)
values
('Anjanam','Kg',840000,'SHARED_KG','Provisional shared installed capacity based on maximum demonstrated daily finished-production throughput, annualised to 294 effective working days at 8 hours/day.',date '2026-04-01','Common shared Kg capacity; not additive across product groups.'),
('Arishtam / Asavam / Shuktham','L',630000,'FERMENTATION_LIQUID','Installed fermentation tankage 52,500 L; standard occupancy 30 days; 12 complete cycles/year.',date '2026-04-01','Dedicated fermentation capacity pool.'),
('Arkam / Theeneer / Dravakam','L',1480000,'SHARED_LIQUID','Provisional shared installed capacity based on maximum demonstrated daily finished-production throughput, annualised to 294 effective working days at 8 hours/day.',date '2026-04-01','Common shared liquid capacity; not additive across product groups.'),
('Avachurna','Kg',840000,'SHARED_KG','Provisional shared installed capacity based on maximum demonstrated daily finished-production throughput, annualised to 294 effective working days at 8 hours/day.',date '2026-04-01','Common shared Kg capacity; not additive across product groups.'),
('Bhasmam / Sindooram / Rasam / Louham / Mandoora / Ksharam','Kg',840000,'SHARED_KG','Provisional shared installed capacity based on maximum demonstrated daily finished-production throughput, annualised to 294 effective working days at 8 hours/day.',date '2026-04-01','Common shared Kg capacity; not additive across product groups.'),
('Capsule / Tablet','Nos',59000000,'SHARED_COUNT','Provisional shared installed capacity based on maximum demonstrated genuine count-based daily finished-production throughput, annualised to 294 effective working days at 8 hours/day.',date '2026-04-01','Common shared count capacity; not additive across product groups.'),
('Chendooram / Chunnam / Karuppu / Parpam','Kg',840000,'SHARED_KG','Provisional shared installed capacity based on maximum demonstrated daily finished-production throughput, annualised to 294 effective working days at 8 hours/day.',date '2026-04-01','Common shared Kg capacity; not additive across product groups.'),
('Choornam / Karpam','Kg',840000,'SHARED_KG','Provisional shared installed capacity based on maximum demonstrated daily finished-production throughput, annualised to 294 effective working days at 8 hours/day.',date '2026-04-01','Common shared Kg capacity; not additive across product groups.'),
('Choornam / Lepa Choornam / Khandam / Satva','Kg',840000,'SHARED_KG','Provisional shared installed capacity based on maximum demonstrated daily finished-production throughput, annualised to 294 effective working days at 8 hours/day.',date '2026-04-01','Common shared Kg capacity; not additive across product groups.'),
('Edible Oils','Kg',840000,'SHARED_KG','Provisional shared installed capacity based on maximum demonstrated daily finished-production throughput, annualised to 294 effective working days at 8 hours/day.',date '2026-04-01','Common shared Kg capacity; not additive across product groups.'),
('Enna / Thailam / Kuzhambu / Keram','Kg',840000,'SHARED_KG','Provisional shared installed capacity based on maximum demonstrated daily finished-production throughput, annualised to 294 effective working days at 8 hours/day.',date '2026-04-01','Common shared Kg capacity; not additive across product groups.'),
('Ennei / Thailam','Kg',840000,'SHARED_KG','Provisional shared installed capacity based on maximum demonstrated daily finished-production throughput, annualised to 294 effective working days at 8 hours/day.',date '2026-04-01','Common shared Kg capacity; not additive across product groups.'),
('Food Products','Kg',840000,'SHARED_KG','Provisional shared installed capacity based on maximum demonstrated daily finished-production throughput, annualised to 294 effective working days at 8 hours/day.',date '2026-04-01','Category-derived Industries reporting group using common shared Kg capacity.'),
('Ghritham','Kg',840000,'SHARED_KG','Provisional shared installed capacity based on maximum demonstrated daily finished-production throughput, annualised to 294 effective working days at 8 hours/day.',date '2026-04-01','Common shared Kg capacity; not additive across product groups.'),
('Gulika / Vatakam / Varthi','Nos',59000000,'SHARED_COUNT','Provisional shared installed capacity based on maximum demonstrated genuine count-based daily finished-production throughput, annualised to 294 effective working days at 8 hours/day.',date '2026-04-01','Common shared count capacity; not additive across product groups.'),
('Kashaya Choornam (Kvatha Choornam)','Kg',840000,'SHARED_KG','Provisional shared installed capacity based on maximum demonstrated daily finished-production throughput, annualised to 294 effective working days at 8 hours/day.',date '2026-04-01','Common shared Kg capacity; not additive across product groups.'),
('Kashayam – Concentrated','L',1480000,'SHARED_LIQUID','Provisional shared installed capacity based on maximum demonstrated daily finished-production throughput, annualised to 294 effective working days at 8 hours/day.',date '2026-04-01','Common shared liquid capacity; not additive across product groups.'),
('Kashayam – Regular','L',1480000,'SHARED_LIQUID','Provisional shared installed capacity based on maximum demonstrated daily finished-production throughput, annualised to 294 effective working days at 8 hours/day.',date '2026-04-01','Common shared liquid capacity; not additive across product groups.'),
('Kudineer – Prepared','L',1480000,'SHARED_LIQUID','Provisional shared installed capacity based on maximum demonstrated daily finished-production throughput, annualised to 294 effective working days at 8 hours/day.',date '2026-04-01','Common shared liquid capacity; not additive across product groups.'),
('Kudineer Choornam','Kg',840000,'SHARED_KG','Provisional shared installed capacity based on maximum demonstrated daily finished-production throughput, annualised to 294 effective working days at 8 hours/day.',date '2026-04-01','Common shared Kg capacity; not additive across product groups.'),
('Lehyam (Ilakam) / Rasayanam','Kg',840000,'SHARED_KG','Provisional shared installed capacity based on maximum demonstrated daily finished-production throughput, annualised to 294 effective working days at 8 hours/day.',date '2026-04-01','Common shared Kg capacity; not additive across product groups.'),
('Lehyam / Gudam / Rasayanam / Modakam','Kg',840000,'SHARED_KG','Provisional shared installed capacity based on maximum demonstrated daily finished-production throughput, annualised to 294 effective working days at 8 hours/day.',date '2026-04-01','Common shared Kg capacity; not additive across product groups.'),
('Lepam / Balm / Ointment','Kg',840000,'SHARED_KG','Provisional shared installed capacity based on maximum demonstrated daily finished-production throughput, annualised to 294 effective working days at 8 hours/day.',date '2026-04-01','Common shared Kg capacity; not additive across product groups.'),
('Lepam / Vennei / Pasai / Patru / Kalimbu / Mai / Balm','Kg',840000,'SHARED_KG','Provisional shared installed capacity based on maximum demonstrated daily finished-production throughput, annualised to 294 effective working days at 8 hours/day.',date '2026-04-01','Common shared Kg capacity; not additive across product groups.'),
('Manappaku / Thenooral / Syrup','Kg',840000,'SHARED_KG','Provisional shared installed capacity based on maximum demonstrated daily finished-production throughput, annualised to 294 effective working days at 8 hours/day.',date '2026-04-01','Common shared Kg capacity; not additive across product groups.'),
('Manappaku / Thenooral / Syrup','L',1480000,'SHARED_LIQUID','Provisional shared installed capacity based on maximum demonstrated daily finished-production throughput, annualised to 294 effective working days at 8 hours/day.',date '2026-04-01','Common shared liquid capacity; not additive across product groups.'),
('Mathirai / Vatakam','Nos',59000000,'SHARED_COUNT','Provisional shared installed capacity based on maximum demonstrated genuine count-based daily finished-production throughput, annualised to 294 effective working days at 8 hours/day.',date '2026-04-01','Common shared count capacity; not additive across product groups.'),
('Mezhuku / Kuzhambu / Kalimbu','Kg',840000,'SHARED_KG','Provisional shared installed capacity based on maximum demonstrated daily finished-production throughput, annualised to 294 effective working days at 8 hours/day.',date '2026-04-01','Common shared Kg capacity; not additive across product groups.'),
('Miscellaneous Items','Kg',840000,'SHARED_KG','Provisional shared installed capacity based on maximum demonstrated daily finished-production throughput, annualised to 294 effective working days at 8 hours/day.',date '2026-04-01','Common shared Kg capacity; not additive across product groups.'),
('Miscellaneous Items','L',1480000,'SHARED_LIQUID','Provisional shared installed capacity based on maximum demonstrated daily finished-production throughput, annualised to 294 effective working days at 8 hours/day.',date '2026-04-01','Common shared liquid capacity; not additive across product groups.'),
('Miscellaneous Items','Nos',59000000,'SHARED_COUNT','Provisional shared installed capacity based on maximum demonstrated genuine count-based daily finished-production throughput, annualised to 294 effective working days at 8 hours/day.',date '2026-04-01','Common shared count capacity; not additive across product groups.'),
('Ney (Ghritham)','Kg',840000,'SHARED_KG','Provisional shared installed capacity based on maximum demonstrated daily finished-production throughput, annualised to 294 effective working days at 8 hours/day.',date '2026-04-01','Common shared Kg capacity; not additive across product groups.'),
('Other Products','Kg',840000,'SHARED_KG','Provisional shared installed capacity based on maximum demonstrated daily finished-production throughput, annualised to 294 effective working days at 8 hours/day.',date '2026-04-01','Category-derived Industries reporting group using common shared Kg capacity.');

with mapping_spec(reporting_product_group, uom_base, canonical_group_name, category_name) as (
    values
    ('Anjanam','Kg','Anjanam','Ayurveda'),
    ('Arishtam / Asavam / Shuktham','L','Arishtam / Asavam / Shuktham','Ayurveda'),
    ('Arkam / Theeneer / Dravakam','L','Arkam / Theeneer / Dravakam',null),
    ('Avachurna','Kg','Avachurna','Siddha'),
    ('Bhasmam / Sindooram / Rasam / Louham / Mandoora / Ksharam','Kg','Bhasmam / Sindooram / Rasam / Louham / Mandoora / Ksharam','Ayurveda'),
    ('Capsule / Tablet','Nos','Capsule / Tablet',null),
    ('Chendooram / Chunnam / Karuppu / Parpam','Kg','Chendooram / Chunnam / Karuppu / Parpam','Siddha'),
    ('Choornam / Karpam','Kg','Choornam / Karpam','Siddha'),
    ('Choornam / Lepa Choornam / Khandam / Satva','Kg','Choornam / Lepa Choornam / Khandam / Satva','Ayurveda'),
    ('Edible Oils','Kg','Edible Oils','Food Products'),
    ('Enna / Thailam / Kuzhambu / Keram','Kg','Enna / Thailam / Kuzhambu / Keram','Ayurveda'),
    ('Ennei / Thailam','Kg','Ennei / Thailam','Siddha'),
    ('Food Products','Kg','XX','Food Products'),
    ('Ghritham','Kg','Ghritham','Ayurveda'),
    ('Gulika / Vatakam / Varthi','Nos','Gulika / Vatakam / Varthi','Ayurveda'),
    ('Kashaya Choornam (Kvatha Choornam)','Kg','Kashaya Choornam (Kvatha Choornam)','Ayurveda'),
    ('Kashayam – Concentrated','L','Kashayam – Concentrated','Ayurveda'),
    ('Kashayam – Regular','L','Kashayam – Regular','Ayurveda'),
    ('Kudineer – Prepared','L','Kudineer – Prepared','Siddha'),
    ('Kudineer Choornam','Kg','Kudineer Choornam','Siddha'),
    ('Lehyam (Ilakam) / Rasayanam','Kg','Lehyam (Ilakam) / Rasayanam','Siddha'),
    ('Lehyam / Gudam / Rasayanam / Modakam','Kg','Lehyam / Gudam / Rasayanam / Modakam','Ayurveda'),
    ('Lepam / Balm / Ointment','Kg','Lepam / Balm / Ointment','Ayurveda'),
    ('Lepam / Vennei / Pasai / Patru / Kalimbu / Mai / Balm','Kg','Lepam / Vennei / Pasai / Patru / Kalimbu / Mai / Balm','Siddha'),
    ('Manappaku / Thenooral / Syrup','Kg','Manappaku / Thenooral / Syrup','Siddha'),
    ('Manappaku / Thenooral / Syrup','L','Manappaku / Thenooral / Syrup','Siddha'),
    ('Mathirai / Vatakam','Nos','Mathirai / Vatakam','Siddha'),
    ('Mezhuku / Kuzhambu / Kalimbu','Kg','Mezhuku / Kuzhambu / Kalimbu','Siddha'),
    ('Miscellaneous Items','Kg','Miscellaneous Items',null),
    ('Miscellaneous Items','L','Miscellaneous Items',null),
    ('Miscellaneous Items','Nos','Miscellaneous Items',null),
    ('Ney (Ghritham)','Kg','Ney (Ghritham)','Siddha'),
    ('Other Products','Kg','XX','Other Products')
), resolved as (
    select distinct ic.id as capacity_id, pg.id as product_group_id
    from mapping_spec ms
    join public.industries_installed_capacity ic
      on ic.reporting_product_group = ms.reporting_product_group
     and ic.uom_base = ms.uom_base
     and ic.effective_from = date '2026-04-01'
    join public.product_groups pg on pg.group_name = ms.canonical_group_name
    join public.sub_categories sc on sc.id = pg.sub_category_id
    join public.categories c on c.id = sc.category_id
    where ms.category_name is null or c.category_name = ms.category_name
)
insert into public.industries_installed_capacity_product_group_map(capacity_id, product_group_id)
select capacity_id, product_group_id from resolved;

create view public.v_industries_monthly_submission
with (security_invoker = true)
as
with month_bounds as (
    select greatest(date '2026-04-01', min(month_start)) as min_month,
           max(month_start) as max_month
    from public.v_industries_monthly_product_group
), months as (
    select generate_series(min_month::timestamp, max_month::timestamp, interval '1 month')::date as month_start
    from month_bounds
    where max_month is not null
), capacity_months as (
    select
        m.month_start,
        ic.reporting_product_group as product_group,
        ic.uom_base,
        ic.annual_installed_capacity,
        ic.capacity_pool_code,
        ic.capacity_basis,
        ic.notes as capacity_notes
    from months m
    join public.industries_installed_capacity ic
      on ic.is_active
     and m.month_start >= date_trunc('month', ic.effective_from)::date
     and (ic.effective_to is null or m.month_start <= date_trunc('month', ic.effective_to)::date)
), base as (
    select
        cm.month_start,
        cm.product_group,
        cm.uom_base,
        cm.annual_installed_capacity,
        cm.capacity_pool_code,
        cm.capacity_basis,
        cm.capacity_notes,
        coalesce(pg.aggregated_quantity,0::numeric) as monthly_quantity,
        coalesce(pg.aggregated_value,0::numeric) as monthly_production_value,
        coalesce(pg.product_count,0::bigint) as product_count,
        coalesce(pg.sku_count,0::numeric) as sku_count,
        coalesce(pg.unresolved_sku_count,0::numeric) as unresolved_sku_count,
        coalesce(pg.valuation_status,'NO_PRODUCTION') as valuation_status,
        case when extract(month from cm.month_start) >= 4
             then make_date(extract(year from cm.month_start)::int,4,1)
             else make_date(extract(year from cm.month_start)::int-1,4,1)
        end as financial_year_start
    from capacity_months cm
    left join public.v_industries_monthly_product_group pg
      on pg.month_start = cm.month_start
     and pg.product_group = cm.product_group
     and pg.uom_base = cm.uom_base
)
select
    month_start,
    product_group,
    uom_base,
    annual_installed_capacity,
    capacity_pool_code,
    monthly_quantity,
    monthly_production_value,
    sum(monthly_quantity) over (
        partition by financial_year_start, product_group, uom_base
        order by month_start rows between unbounded preceding and current row
    ) as fy_cumulative_quantity,
    sum(monthly_production_value) over (
        partition by financial_year_start, product_group, uom_base
        order by month_start rows between unbounded preceding and current row
    ) as fy_cumulative_production_value,
    lag(monthly_quantity) over (
        partition by product_group, uom_base order by month_start
    ) as previous_month_quantity,
    case
      when lag(monthly_quantity) over (partition by product_group, uom_base order by month_start) is null then null
      when lag(monthly_quantity) over (partition by product_group, uom_base order by month_start) = 0 then null
      else round(
        ((monthly_quantity - lag(monthly_quantity) over (partition by product_group, uom_base order by month_start))
          / lag(monthly_quantity) over (partition by product_group, uom_base order by month_start)) * 100, 2)
    end as month_on_month_variation_pct,
    product_count,
    sku_count,
    unresolved_sku_count,
    valuation_status,
    capacity_basis,
    capacity_notes
from base;

revoke all on table public.v_industries_monthly_submission from anon, authenticated;
grant select on table public.v_industries_monthly_submission to service_role;

comment on view public.v_industries_monthly_submission is
'Monthly Industries Department reporting view from Apr-2026 onward: reporting group/UOM, governed installed capacity, monthly production quantity/value, FY cumulative quantity/value, prior-month quantity and variation. Zero-production months are materialised. Capacity pool values are shared and not additive across groups.';