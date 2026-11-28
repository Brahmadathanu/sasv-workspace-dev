-- DR5: receivables reporting, no modification of original v6.6.1 functions.
-- Use existing bill detail and one company-wide polarity; no loss through classification.
create function public.ei_debtor_bills_v1(p_region integer default null,p_godown integer default null,p_district bigint default null,p_area bigint default null,p_type bigint default null,p_incomplete boolean default false,p_party text default null)
returns table(report_date date,party_name text,debtor_id bigint,region_id integer,godown_id integer,district_id bigint,area_id bigint,type_id bigint,kyc_status text,bill_date_text text,bill_ref text,signed_amount numeric,amount numeric)
language sql stable security invoker set search_path=pg_catalog,public as $$
 with raw as materialized(select d.*,case when sum(d.outstanding_amount_tally_value) over()<0 then -1 else 1 end polarity from public.v_mis_finance_outstanding_detail d where group_name='Sundry Debtors'),
 mapped as materialized(select r.*,a.debtor_id,c.region_id,c.godown_id,c.district_id,c.area_id,c.type_id,
 case when a.debtor_id is null then 'UNMAPPED' when public.ei_debtor_status_v1(a.debtor_id)='ACTIVE' and not public.ei_debtor_classification_valid(a.debtor_id) then 'INVALID' else public.ei_debtor_status_v1(a.debtor_id) end kyc
 from raw r left join public.ei_debtor_alias a on a.party_key=lower(btrim(r.party_name)) left join public.ei_debtor_classification c on c.debtor_id=a.debtor_id)
 select m.report_date,m.party_name,m.debtor_id,m.region_id,m.godown_id,m.district_id,m.area_id,m.type_id,m.kyc,m.bill_date_text,m.bill_ref,m.outstanding_amount_tally_value,m.outstanding_amount_tally_value*m.polarity
 from mapped m where (p_region is null or m.region_id=p_region) and (p_godown is null or m.godown_id=p_godown) and (p_district is null or m.district_id=p_district) and (p_area is null or m.area_id=p_area) and (p_type is null or m.type_id=p_type) and (not coalesce(p_incomplete,false) or m.kyc<>'ACTIVE') and (p_party is null or m.party_name=p_party)
$$;
create function public.ei_debtor_summary_v1(p_region integer default null,p_godown integer default null,p_district bigint default null,p_area bigint default null,p_type bigint default null,p_incomplete boolean default false)
returns jsonb language sql stable security invoker set search_path=pg_catalog,public as $$
 select jsonb_build_object('report_date',max(report_date),'party_count',count(distinct party_name),'bill_count',count(*),'amount',coalesce(sum(amount),0),'signed_amount',coalesce(sum(signed_amount),0),'incomplete_party_count',count(distinct party_name) filter(where kyc_status<>'ACTIVE'),'incomplete_amount',coalesce(sum(amount) filter(where kyc_status<>'ACTIVE'),0))
 from public.ei_debtor_bills_v1(p_region,p_godown,p_district,p_area,p_type,p_incomplete,null)
$$;
create function public.ei_debtor_party_page_v1(p_region integer default null,p_godown integer default null,p_district bigint default null,p_area bigint default null,p_type bigint default null,p_incomplete boolean default false,p_search text default '',p_limit integer default 50,p_offset integer default 0)
returns table(party_name text,debtor_id bigint,region_id integer,godown_id integer,district_id bigint,area_id bigint,type_id bigint,kyc_status text,bill_count bigint,amount numeric,total_rows bigint)
language plpgsql stable security invoker set search_path=pg_catalog,public as $$
begin
 if p_limit is null or p_limit not between 1 and 200 or p_offset is null or p_offset<0 then raise exception 'Invalid pagination' using errcode='22023'; end if;
 return query select b.party_name,b.debtor_id,b.region_id,b.godown_id,b.district_id,b.area_id,b.type_id,b.kyc_status,count(*),sum(b.amount),count(*) over()
 from public.ei_debtor_bills_v1(p_region,p_godown,p_district,p_area,p_type,p_incomplete,null)b
 where coalesce(b.party_name,'') ilike '%'||coalesce(btrim(p_search),'')||'%'
 group by b.party_name,b.debtor_id,b.region_id,b.godown_id,b.district_id,b.area_id,b.type_id,b.kyc_status order by sum(b.amount) desc,b.party_name limit p_limit offset p_offset;
end $$;
-- Separate alert payload, no contact data.
create function public.ei_debtor_alert_v1() returns jsonb language sql stable security invoker set search_path=pg_catalog,public as $$
 select jsonb_build_object('code','DEBTOR_KYC_INCOMPLETE','count',count(distinct party_name),'amount',coalesce(sum(amount),0),'bill_count',count(*),'report_date',max(report_date)) from public.ei_debtor_bills_v1(null,null,null,null,null,true,null)
$$;
do $$
declare sig text;
begin
 foreach sig in array array['public.ei_debtor_bills_v1(integer,integer,bigint,bigint,bigint,boolean,text)','public.ei_debtor_summary_v1(integer,integer,bigint,bigint,bigint,boolean)','public.ei_debtor_party_page_v1(integer,integer,bigint,bigint,bigint,boolean,text,integer,integer)','public.ei_debtor_alert_v1()'] loop
 execute 'revoke all on function '||sig||' from public,anon,authenticated';
 execute 'grant execute on function '||sig||' to authenticated';
 end loop;
end $$;
