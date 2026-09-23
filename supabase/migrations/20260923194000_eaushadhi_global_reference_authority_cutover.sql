begin;

create or replace function public.rpc_eaushadhi_reference_mapping_get(p_product_id integer)
returns table(
  canonical_term_id bigint,
  canonical_code text,
  canonical_label text,
  source_composition_line_ids bigint[],
  source_reference_examples text[],
  source_reference_by_line jsonb,
  mapping_id bigint,
  mapping_status text,
  portal_option_id bigint,
  portal_external_id text,
  portal_label text,
  mapping_reason text,
  match_basis text,
  comparison_evidence jsonb,
  verified_by uuid,
  verified_at timestamptz,
  reference_ready boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform public.rpc_eaushadhi_require_permission(false);

  return query
  with line_resolution as (
    select
      scl.id as source_line_id,
      scl.raw_reference_text,
      a.mapping_status as alias_status,
      ct.id as ct_id,
      ct.code as ct_code,
      ct.label as ct_label,
      ct.is_active as ct_active
    from regulatory.source_composition_line scl
    left join lateral (
      select ca.*
      from regulatory.controlled_term_alias ca
      where ca.domain_code='REFERENCE_WORK'
        and ca.alias_key=regulatory.normalize_controlled_term_alias(scl.raw_reference_text)
        and ca.mapping_status in ('DRAFT','VERIFIED')
        and (ca.effective_from is null or ca.effective_from <= now())
        and (ca.effective_to is null or ca.effective_to > now())
      order by (ca.mapping_status='VERIFIED') desc, ca.id desc
      limit 1
    ) a on true
    left join regulatory.controlled_term ct
      on ct.id=a.controlled_term_id
     and ct.domain_code='REFERENCE_WORK'
    where scl.matched_product_id=p_product_id
      and nullif(btrim(scl.raw_reference_text),'') is not null
  )
  select
    lr.ct_id,
    lr.ct_code,
    lr.ct_label,
    array_agg(distinct lr.source_line_id order by lr.source_line_id),
    array_agg(distinct lr.raw_reference_text order by lr.raw_reference_text),
    jsonb_object_agg(lr.source_line_id::text,lr.raw_reference_text),
    pm.id,
    pm.mapping_status,
    po.id,
    po.external_id,
    po.label,
    pm.mapping_reason,
    pm.match_basis,
    pm.comparison_evidence,
    pm.verified_by,
    pm.verified_at,
    (
      bool_and(lr.alias_status='VERIFIED' and lr.ct_active=true)
      and pm.mapping_status='VERIFIED'
      and (pm.effective_from is null or pm.effective_from <= now())
      and (pm.effective_to is null or pm.effective_to > now())
      and po.is_active=true
      and po.portal_code='E_AUSHADHI'
      and po.domain_code='REFERENCE'
      and po.external_id <> '-1'
    )
  from line_resolution lr
  left join lateral (
    select m.*
    from regulatory.term_portal_mapping m
    where m.controlled_term_id=lr.ct_id
      and m.portal_code='E_AUSHADHI'
      and m.mapping_status in ('DRAFT','VERIFIED')
      and (m.effective_from is null or m.effective_from <= now())
      and (m.effective_to is null or m.effective_to > now())
    order by (m.mapping_status='VERIFIED') desc,m.id desc
    limit 1
  ) pm on true
  left join regulatory.portal_option po on po.id=pm.portal_option_id
  where lr.ct_id is not null
  group by
    lr.ct_id,lr.ct_code,lr.ct_label,
    pm.id,pm.mapping_status,po.id,po.external_id,po.label,
    pm.mapping_reason,pm.match_basis,pm.comparison_evidence,
    pm.verified_by,pm.verified_at,pm.effective_from,pm.effective_to,
    po.is_active,po.portal_code,po.domain_code;
end
$function$;

comment on function public.rpc_eaushadhi_reference_mapping_get(integer) is
  'Product-scoped read projection of GLOBAL Reference alias and portal terminology governance. Per-line Reference review columns are non-authoritative.';

create or replace function public.rpc_eaushadhi_worker_payload_get(
  p_product_id integer,
  p_expected_workflow_row_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_payload jsonb;
  v_composition jsonb;
begin
  v_payload := public.rpc_eaushadhi_worker_payload_get_without_reference_20260923(
    p_product_id,
    p_expected_workflow_row_version
  );

  select coalesce(
    jsonb_agg(
      line.value || jsonb_build_object(
        'reference',
        jsonb_build_object(
          'source_text', scl.raw_reference_text,
          'canonical_term_id', case when ready.source_ready then ct.id end,
          'canonical_code', case when ready.source_ready then ct.code end,
          'canonical_label', case when ready.source_ready then ct.label end,
          'portal_option_id', case when ready.reference_ready then po.id end,
          'portal_value', case when ready.reference_ready then po.external_id end,
          'portal_label', case when ready.reference_ready then po.label end,
          'alias_mapping_status', coalesce(a.mapping_status,'UNMAPPED'),
          'portal_mapping_status',
            case
              when ready.source_ready then coalesce(pm.mapping_status,'UNMAPPED')
              else 'UNAVAILABLE'
            end,
          'source_to_canonical_ready', ready.source_ready,
          'canonical_to_portal_ready', ready.reference_ready,
          'reference_ready', ready.reference_ready
        )
      )
      order by line.ordinality
    ),
    '[]'::jsonb
  )
  into v_composition
  from jsonb_array_elements(coalesce(v_payload->'composition','[]'::jsonb))
       with ordinality line(value,ordinality)
  join regulatory.source_composition_line scl
    on scl.id=(line.value->>'source_composition_line_id')::bigint
  left join lateral (
    select ca.*
    from regulatory.controlled_term_alias ca
    where ca.domain_code='REFERENCE_WORK'
      and ca.alias_key=regulatory.normalize_controlled_term_alias(scl.raw_reference_text)
      and ca.mapping_status in ('DRAFT','VERIFIED')
      and (ca.effective_from is null or ca.effective_from <= now())
      and (ca.effective_to is null or ca.effective_to > now())
    order by (ca.mapping_status='VERIFIED') desc,ca.id desc
    limit 1
  ) a on true
  left join regulatory.controlled_term ct
    on ct.id=a.controlled_term_id
   and ct.domain_code='REFERENCE_WORK'
  left join lateral (
    select m.*
    from regulatory.term_portal_mapping m
    where m.controlled_term_id=ct.id
      and m.portal_code='E_AUSHADHI'
      and m.mapping_status in ('DRAFT','VERIFIED')
      and (m.effective_from is null or m.effective_from <= now())
      and (m.effective_to is null or m.effective_to > now())
    order by (m.mapping_status='VERIFIED') desc,m.id desc
    limit 1
  ) pm on true
  left join regulatory.portal_option po
    on po.id=pm.portal_option_id
   and po.portal_code='E_AUSHADHI'
   and po.domain_code='REFERENCE'
  cross join lateral (
    select
      (
        a.mapping_status='VERIFIED'
        and ct.id is not null
        and ct.is_active=true
      ) as source_ready,
      (
        a.mapping_status='VERIFIED'
        and ct.id is not null
        and ct.is_active=true
        and pm.mapping_status='VERIFIED'
        and (pm.effective_from is null or pm.effective_from <= now())
        and (pm.effective_to is null or pm.effective_to > now())
        and po.id is not null
        and po.is_active=true
        and po.external_id <> '-1'
      ) as reference_ready
  ) ready;

  return jsonb_set(v_payload,'{composition}',v_composition,true);
end
$function$;

comment on function public.rpc_eaushadhi_worker_payload_get(integer,bigint) is
  'Authoritative worker payload. Composition Reference authority resolves globally from raw source wording through controlled_term_alias and term_portal_mapping.';

revoke all on function public.rpc_eaushadhi_reference_mapping_get(integer) from public,anon;
grant execute on function public.rpc_eaushadhi_reference_mapping_get(integer) to authenticated,service_role;

revoke all on function public.rpc_eaushadhi_worker_payload_get(integer,bigint) from public,anon;
grant execute on function public.rpc_eaushadhi_worker_payload_get(integer,bigint) to authenticated,service_role;

alter function public.rpc_eaushadhi_reference_mapping_get(integer) owner to postgres;
alter function public.rpc_eaushadhi_worker_payload_get(integer,bigint) owner to postgres;

commit;
