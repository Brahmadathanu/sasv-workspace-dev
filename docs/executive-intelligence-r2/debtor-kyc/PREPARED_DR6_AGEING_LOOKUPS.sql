-- DR6: ageing reuses bill-date semantics, company-wide polarity, filters.
create function public.ei_debtor_ageing_v1(p_as_of date default null,p_bounds integer[] default array[30,60,90],p_age_min integer default null,p_age_max integer default null,p_region integer default null,p_godown integer default null,p_district bigint default null,p_area bigint default null,p_type bigint default null,p_incomplete boolean default false,p_party text default null)
returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare v_date date; v_result jsonb;
begin
 if not public.ei_can_read_executive() then raise exception 'Access denied' using errcode='42501'; end if;
 if p_bounds is null or array_ndims(p_bounds) is distinct from 1 or array_lower(p_bounds,1)<>1 or cardinality(p_bounds) not between 1 and 5 or exists(select 1 from unnest(p_bounds) with ordinality u(v,i) where v is null or v not between 1 and 3650 or (i>1 and v<=p_bounds[(i-1)::int])) or coalesce(p_age_min,0)<0 or coalesce(p_age_max,0)<0 or p_age_min>p_age_max then raise exception 'Invalid ageing parameters' using errcode='22023'; end if;
 select coalesce(p_as_of,max(report_date)) into v_date from public.ei_debtor_bills_v1();
 if v_date is null or not isfinite(v_date) then raise exception 'Invalid date' using errcode='22023'; end if;
 with raw as materialized(select b.*,case when nullif(btrim(b.bill_ref),'') is not null and btrim(b.bill_ref)!~*'^on[ -]?account$' then regexp_match(lower(btrim(b.bill_date_text)),'^([0-9]{1,2})-([a-z]{3})-([0-9]{2}|[0-9]{4})$') end m from public.ei_debtor_bills_v1(p_region,p_godown,p_district,p_area,p_type,p_incomplete,p_party)b),
 parts as (select *,case when length(m[3])=2 then 2000+m[3]::int else m[3]::int end yr,array_position(array['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'],m[2]) mo,m[1]::int dy from raw),
 dates as (select *,case when yr between 1 and 9999 and mo between 1 and 12 and dy between 1 and 31 then make_date(yr,mo,1)+dy-1 end candidate from parts),
 aged as (select *,case when extract(month from candidate)=mo then v_date-candidate end age from dates),
 scoped as materialized(select *,case when age is not null then (select count(*)::int from unnest(p_bounds) b where age>b) end bi from aged where age is null or ((p_age_min is null or age>=p_age_min) and (p_age_max is null or age<=p_age_max))),
 buckets as(select bi,sum(amount) amt,count(*) cnt from scoped where bi is not null group by bi)
 select jsonb_build_object('as_of',v_date,'basis','bill_date','bounds',p_bounds,'total_amount',coalesce(sum(amount),0),'bill_count',count(*),'party_count',count(distinct party_name),'oldest_age_days',max(age),'weighted_avg_age_days',sum(age::numeric*amount) filter(where age is not null and amount>0)/nullif(sum(amount) filter(where age is not null and amount>0),0),'undated_amount',coalesce(sum(amount) filter(where age is null),0),'undated_bill_count',count(*) filter(where age is null),'bucket_amounts',array(select coalesce(b.amt,0) from generate_series(0,cardinality(p_bounds)) i left join buckets b on b.bi=i order by i),'bucket_bill_counts',array(select coalesce(b.cnt,0) from generate_series(0,cardinality(p_bounds)) i left join buckets b on b.bi=i order by i)) into v_result from scoped;
 return v_result;
end $$;
revoke all on function public.ei_debtor_ageing_v1(date,integer[],integer,integer,integer,integer,bigint,bigint,bigint,boolean,text) from public,anon;
grant execute on function public.ei_debtor_ageing_v1(date,integer[],integer,integer,integer,integer,bigint,bigint,bigint,boolean,text) to authenticated;
-- Master lookup uses report RLS; profiles remain separate.
create function public.ei_debtor_lookups_v1() returns jsonb language sql stable security invoker set search_path=pg_catalog,public as $$
 select case when public.ei_can_read_executive() then jsonb_build_object(
 'regions',(select coalesce(jsonb_agg(to_jsonb(r) order by r.code),'[]') from public.regions r),
 'godowns',(select coalesce(jsonb_agg(to_jsonb(g) order by g.code),'[]') from public.godowns g),
 'districts',(select coalesce(jsonb_agg(to_jsonb(d) order by d.state_name,d.district_name),'[]') from public.ei_debtor_district d),
 'coverage',(select coalesce(jsonb_agg(to_jsonb(c)),'[]') from public.ei_debtor_godown_district c),
 'areas',(select coalesce(jsonb_agg(to_jsonb(a) order by a.area_name),'[]') from public.ei_debtor_area a),
 'types',(select coalesce(jsonb_agg(to_jsonb(t) order by t.name),'[]') from public.ei_debtor_type t)) end
$$;
revoke all on function public.ei_debtor_lookups_v1() from public,anon;
grant execute on function public.ei_debtor_lookups_v1() to authenticated;
-- Dedicated profile getter: no privileged bypass.
create function public.ei_debtor_profile_v1(p_id bigint) returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare j jsonb;
begin
 if not (public.ei_can_access_debtor_kyc('view') or public.ei_can_access_debtor_kyc('edit')) then raise exception 'KYC access required' using errcode='42501'; end if;
 select jsonb_build_object('identity',to_jsonb(d),'classification',to_jsonb(c),'profile',to_jsonb(k),'revision',coalesce(k.revision,0),'status',coalesce(k.lifecycle_status,'DRAFT'),'classification_valid',public.ei_debtor_classification_valid(d.id)) into j from public.ei_debtor d left join public.ei_debtor_classification c on c.debtor_id=d.id left join public.ei_debtor_kyc k on k.debtor_id=d.id where d.id=p_id;
 return j;
end $$;
revoke all on function public.ei_debtor_profile_v1(bigint) from public,anon;
grant execute on function public.ei_debtor_profile_v1(bigint) to authenticated;
