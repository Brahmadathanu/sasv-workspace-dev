begin;

create or replace function public.rpc_eaushadhi_reference_portal_mapping_draft_create(
  p_controlled_term_id bigint,
  p_portal_option_id bigint
)
returns table(
  mapping_id bigint,
  mapping_status text,
  canonical_term_id bigint,
  canonical_code text,
  canonical_label text,
  portal_option_id bigint,
  portal_external_id text,
  portal_label text,
  match_basis text,
  comparison_evidence jsonb
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_term regulatory.controlled_term%rowtype;
  v_option regulatory.portal_option%rowtype;
  v_existing_id bigint;
  v_id bigint;
  v_basis text;
  v_similarity double precision;
  v_evidence jsonb;
begin
  v_actor := public.rpc_eaushadhi_require_permission(true);

  select * into strict v_term
  from regulatory.controlled_term
  where id=p_controlled_term_id
    and domain_code='REFERENCE_WORK'
    and is_active=true;

  select * into strict v_option
  from regulatory.portal_option
  where id=p_portal_option_id
    and portal_code='E_AUSHADHI'
    and domain_code='REFERENCE'
    and is_active=true
    and external_id<>'-1';

  perform pg_catalog.pg_advisory_xact_lock(91723, p_controlled_term_id::integer);

  select m.id into v_existing_id
  from regulatory.term_portal_mapping m
  where m.controlled_term_id=v_term.id
    and m.portal_code='E_AUSHADHI'
    and m.mapping_status in ('DRAFT','VERIFIED')
    and (m.effective_from is null or m.effective_from <= current_date)
    and (m.effective_to is null or m.effective_to >= current_date)
  order by (m.mapping_status='VERIFIED') desc,m.id desc
  limit 1;

  if v_existing_id is not null then
    raise exception 'A current Reference portal mapping already exists for this canonical term'
      using errcode='23505';
  end if;

  v_similarity := extensions.similarity(
    regulatory.normalize_controlled_term_alias(v_term.label),
    regulatory.normalize_controlled_term_alias(v_option.label)
  );

  v_basis := case
    when v_term.label=v_option.label then 'EXACT'
    when regulatory.normalize_controlled_term_alias(v_term.label)
       = regulatory.normalize_controlled_term_alias(v_option.label)
      then 'NORMALIZED_EXACT'
    else 'MANUAL'
  end;

  v_evidence := jsonb_build_object(
    'canonical_term_id',v_term.id,
    'canonical_code',v_term.code,
    'canonical_label',v_term.label,
    'normalized_canonical',regulatory.normalize_controlled_term_alias(v_term.label),
    'portal_option_id',v_option.id,
    'portal_external_id',v_option.external_id,
    'portal_label',v_option.label,
    'normalized_portal',regulatory.normalize_controlled_term_alias(v_option.label),
    'similarity_score',v_similarity,
    'creation_mode','REVIEWER_SELECTION'
  );

  insert into regulatory.term_portal_mapping(
    controlled_term_id,portal_code,portal_option_id,mapping_status,
    mapping_reason,created_by,match_basis,comparison_evidence
  )
  values(
    v_term.id,'E_AUSHADHI',v_option.id,'DRAFT',
    'Global canonical Reference Work to e-Aushadhi Reference candidate.',
    v_actor,v_basis,v_evidence
  )
  returning id into v_id;

  return query
  select v_id,'DRAFT'::text,v_term.id,v_term.code,v_term.label,
         v_option.id,v_option.external_id,v_option.label,v_basis,v_evidence;
end
$function$;

revoke all on function public.rpc_eaushadhi_reference_portal_mapping_draft_create(bigint,bigint)
from public,anon;
grant execute on function public.rpc_eaushadhi_reference_portal_mapping_draft_create(bigint,bigint)
to authenticated,service_role;
alter function public.rpc_eaushadhi_reference_portal_mapping_draft_create(bigint,bigint) owner to postgres;

commit;
