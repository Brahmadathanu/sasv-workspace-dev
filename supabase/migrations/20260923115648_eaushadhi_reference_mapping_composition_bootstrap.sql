begin;

alter table regulatory.eaushadhi_line_review
  add column if not exists suggested_reference_work_term_id bigint
    references regulatory.controlled_term(id),
  add column if not exists selected_reference_work_term_id bigint
    references regulatory.controlled_term(id);

alter table regulatory.term_portal_mapping
  add column if not exists match_basis text,
  add column if not exists comparison_evidence jsonb not null default '{}'::jsonb;

insert into regulatory.controlled_term (
  domain_code, code, label, description, is_active
)
select
  'REFERENCE_WORK',
  'SAHASRAYOGAM',
  'Sahasrayōgam',
  'Canonical internal reference work corresponding to source citations such as "Sahasrayōgam - Sujanapriya".',
  true
where not exists (
  select 1 from regulatory.controlled_term
  where domain_code = 'REFERENCE_WORK' and code = 'SAHASRAYOGAM'
);

update regulatory.controlled_term
set label = 'Sahasrayōgam',
    description = 'Canonical internal reference work corresponding to source citations such as "Sahasrayōgam - Sujanapriya".',
    is_active = true
where domain_code = 'REFERENCE_WORK' and code = 'SAHASRAYOGAM';

with captured(external_id, label) as (values
  ('48','Abhinavachintamani'), ('2','Arka Prakasha'), ('1','Arogya Kalpadruma'),
  ('3','Arya Bhishak'), ('4','Ashtanga Haridaya'), ('5','Ashtanga Samgraha'),
  ('47','Ayurvedachintamani'), ('6','Ayurveda Kalpadruma'), ('7','Ayurveda Prakasha'),
  ('49','Ayurveda-ratnakar'), ('8','Ayurveda Samgraha'), ('91','Ayurveda Sara Sangraha'),
  ('90','Ayurvedic Formulary of India'), ('142','Ayurvedic Formulary of India and its Parts'),
  ('92','Ayurvedic Pharmacopoeia of india'), ('143','Ayurvedic Pharmacopoeia of India and its Parts'),
  ('54','Bangasena'), ('39','Basava Rajeeyam'), ('9','Bhaishajya Ratnavali'),
  ('10','Bhart Bhaishajya Ratnakara'), ('11','Bhava Prakasha'), ('44','Bhelasamhita'),
  ('12','Brihat Nighantu Ratnakara'), ('162','Bureau of Indian Standard'),
  ('14','Chakra Datta'), ('13','Charaka Samhita'), ('52','Dravyagunanighantu'),
  ('163','FSSAI'), ('15','Gada Nigraha'), ('164','Indian Pharmacopoeia'),
  ('43','Kashyapasamhita'), ('16','Kupi Pakva Rasayana'), ('131','N/A'),
  ('17','Nighanttu Ratnakara'), ('18','Rasa Chandanshu'), ('53','Rasamanjari'),
  ('51','Rasamrita'), ('27','Rasa Pradipika'), ('19','Rasa Raja Sundara'),
  ('20','Rasaratna Samuchaya'), ('21','Rasatantra Sara Va Siddha Prayoga Samgraha (Part I)'),
  ('22','Rasa Tarangini'), ('24','Rasa Yoga Ratnakara'), ('23','Rasa Yoga Sagara'),
  ('25','Rasa Yoga Samgraha'), ('26','Rasendra Sara Samgraha'),
  ('89','Rastantra Sar Va Siddha Prayog Samgraha Part II'), ('28','Sahasrayoga'),
  ('29','Sarvaroga Chikitsa Ratnam'), ('30','Sarvayoga Chikitsa Ratnam'),
  ('31','Sharangadhara Samhita'), ('32','Siddha Bhaishajya Manimala'),
  ('33','Siddha Yoga Samgraha'), ('34','Sushruta Samhita'), ('35','Vaidya Chintamani'),
  ('38','Vaidya Jiwan'), ('37','Vaidyaka Chikitsa Sara'), ('36','Vaidyaka Shabda Sindu'),
  ('45','Vishwanathachikitsa'), ('46','Vrindachikitsa'), ('42','Yoga Chintamani'),
  ('40','Yoga Ratnakara'), ('50','Yoga ratnasangraha'), ('41','Yoga Tarangini')
), source as (
  select external_id, label,
    jsonb_build_object(
      'source', 'authenticated_live_portal_capture',
      'dom_select', '#referenceId',
      'ingredientTypeId', '1',
      'endpoint', '/admin/getreference',
      'capture_date', '2026-09-23',
      'capture_complete', true
    ) source_context
  from captured
)
insert into regulatory.portal_option (
  portal_code, domain_code, external_id, label,
  parent_domain_code, parent_external_id, is_active, source_context
)
select 'E_AUSHADHI', 'REFERENCE', s.external_id, s.label, '', '', true, s.source_context
from source s
where s.external_id <> '-1'
  and not exists (
    select 1 from regulatory.portal_option po
    where po.portal_code = 'E_AUSHADHI'
      and po.domain_code = 'REFERENCE'
      and po.external_id = s.external_id
      and coalesce(po.parent_domain_code, '') = ''
      and coalesce(po.parent_external_id, '') = ''
  );

with captured(external_id, label) as (values
  ('48','Abhinavachintamani'), ('2','Arka Prakasha'), ('1','Arogya Kalpadruma'), ('3','Arya Bhishak'),
  ('4','Ashtanga Haridaya'), ('5','Ashtanga Samgraha'), ('47','Ayurvedachintamani'),
  ('6','Ayurveda Kalpadruma'), ('7','Ayurveda Prakasha'), ('49','Ayurveda-ratnakar'),
  ('8','Ayurveda Samgraha'), ('91','Ayurveda Sara Sangraha'), ('90','Ayurvedic Formulary of India'),
  ('142','Ayurvedic Formulary of India and its Parts'), ('92','Ayurvedic Pharmacopoeia of india'),
  ('143','Ayurvedic Pharmacopoeia of India and its Parts'), ('54','Bangasena'), ('39','Basava Rajeeyam'),
  ('9','Bhaishajya Ratnavali'), ('10','Bhart Bhaishajya Ratnakara'), ('11','Bhava Prakasha'),
  ('44','Bhelasamhita'), ('12','Brihat Nighantu Ratnakara'), ('162','Bureau of Indian Standard'),
  ('14','Chakra Datta'), ('13','Charaka Samhita'), ('52','Dravyagunanighantu'), ('163','FSSAI'),
  ('15','Gada Nigraha'), ('164','Indian Pharmacopoeia'), ('43','Kashyapasamhita'),
  ('16','Kupi Pakva Rasayana'), ('131','N/A'), ('17','Nighanttu Ratnakara'),
  ('18','Rasa Chandanshu'), ('53','Rasamanjari'), ('51','Rasamrita'), ('27','Rasa Pradipika'),
  ('19','Rasa Raja Sundara'), ('20','Rasaratna Samuchaya'),
  ('21','Rasatantra Sara Va Siddha Prayoga Samgraha (Part I)'), ('22','Rasa Tarangini'),
  ('24','Rasa Yoga Ratnakara'), ('23','Rasa Yoga Sagara'), ('25','Rasa Yoga Samgraha'),
  ('26','Rasendra Sara Samgraha'), ('89','Rastantra Sar Va Siddha Prayog Samgraha Part II'),
  ('28','Sahasrayoga'), ('29','Sarvaroga Chikitsa Ratnam'), ('30','Sarvayoga Chikitsa Ratnam'),
  ('31','Sharangadhara Samhita'), ('32','Siddha Bhaishajya Manimala'), ('33','Siddha Yoga Samgraha'),
  ('34','Sushruta Samhita'), ('35','Vaidya Chintamani'), ('38','Vaidya Jiwan'),
  ('37','Vaidyaka Chikitsa Sara'), ('36','Vaidyaka Shabda Sindu'), ('45','Vishwanathachikitsa'),
  ('46','Vrindachikitsa'), ('42','Yoga Chintamani'), ('40','Yoga Ratnakara'),
  ('50','Yoga ratnasangraha'), ('41','Yoga Tarangini')
)
update regulatory.portal_option po
set label = c.label,
    is_active = true,
    source_context = jsonb_build_object(
      'source', 'authenticated_live_portal_capture', 'dom_select', '#referenceId',
      'ingredientTypeId', '1', 'endpoint', '/admin/getreference',
      'capture_date', '2026-09-23', 'capture_complete', true
    )
from captured c
where po.portal_code = 'E_AUSHADHI' and po.domain_code = 'REFERENCE'
  and po.external_id = c.external_id
  and coalesce(po.parent_domain_code, '') = ''
  and coalesce(po.parent_external_id, '') = '';

do $seed$
declare
  v_term_id bigint;
  v_option_id bigint;
begin
  select id into strict v_term_id from regulatory.controlled_term
  where domain_code = 'REFERENCE_WORK' and code = 'SAHASRAYOGAM' and is_active = true;
  select id into strict v_option_id from regulatory.portal_option
  where portal_code = 'E_AUSHADHI' and domain_code = 'REFERENCE'
    and external_id = '28' and is_active = true;

  if not exists (
    select 1 from regulatory.term_portal_mapping
    where controlled_term_id = v_term_id and portal_code = 'E_AUSHADHI' and is_active = true
  ) then
    insert into regulatory.term_portal_mapping (
      controlled_term_id, portal_code, portal_option_id, mapping_status,
      mapping_reason, match_basis, comparison_evidence, is_active
    ) values (
      v_term_id, 'E_AUSHADHI', v_option_id, 'DRAFT',
      'Parent-work/transliteration projection from source reference "Sahasrayōgam - Sujanapriya" to the portal-controlled parent-work option "Sahasrayoga". Source subsection remains retained separately.',
      'PARENT_WORK_TRANSLITERATION_MATCH',
      jsonb_build_object(
        'source_text', 'Sahasrayōgam - Sujanapriya',
        'canonical_text', 'Sahasrayōgam',
        'portal_text', 'Sahasrayoga',
        'normalized_canonical', 'sahasrayogam',
        'normalized_portal', 'sahasrayoga',
        'source_subsection', 'Sujanapriya'
      ),
      true
    );
  end if;

  update regulatory.eaushadhi_line_review
  set suggested_reference_work_term_id = v_term_id,
      selected_reference_work_term_id = v_term_id
  where product_id = 262 and source_composition_line_id in (929, 930, 931);
end
$seed$;

create or replace function public.rpc_eaushadhi_portal_options(p_domain_code text)
returns table(
  portal_option_id bigint, domain_code text, external_id text, label text, is_active boolean
)
language plpgsql security definer
set search_path to 'public', 'regulatory', 'extensions', 'pg_temp'
as $function$
begin
  perform public.rpc_eaushadhi_require_permission(false);
  p_domain_code := upper(btrim(coalesce(p_domain_code, '')));
  if p_domain_code not in ('INGREDIENT_TYPE','INGREDIENT_FORM','PART_USED','MEASUREMENT_UNIT','REFERENCE') then
    raise exception 'Unsupported portal option domain: %', p_domain_code using errcode = '22023';
  end if;
  return query
  select po.id, po.domain_code, po.external_id, po.label, po.is_active
  from regulatory.portal_option po
  where po.portal_code = 'E_AUSHADHI'
    and po.domain_code = p_domain_code
    and po.is_active = true
    and po.external_id <> '-1'
  order by lower(po.label), po.external_id;
end
$function$;

create or replace function regulatory.enforce_one_verified_reference_mapping()
returns trigger language plpgsql
set search_path to 'regulatory', 'pg_temp'
as $function$
begin
  if new.is_active = true and new.mapping_status = 'VERIFIED'
     and exists (select 1 from regulatory.controlled_term ct
                 where ct.id = new.controlled_term_id and ct.domain_code = 'REFERENCE_WORK')
     and exists (select 1 from regulatory.portal_option po
                 where po.id = new.portal_option_id and po.domain_code = 'REFERENCE')
     and exists (
       select 1 from regulatory.term_portal_mapping m
       where m.controlled_term_id = new.controlled_term_id
         and m.portal_code = 'E_AUSHADHI' and m.is_active = true
         and m.mapping_status = 'VERIFIED' and m.id <> new.id
     ) then
    raise exception 'Only one active VERIFIED E_AUSHADHI REFERENCE mapping is allowed per canonical term'
      using errcode = '23505';
  end if;
  return new;
end
$function$;

drop trigger if exists trg_one_verified_reference_mapping on regulatory.term_portal_mapping;
create trigger trg_one_verified_reference_mapping
before insert or update on regulatory.term_portal_mapping
for each row execute function regulatory.enforce_one_verified_reference_mapping();

create or replace function public.rpc_eaushadhi_reference_mapping_get(p_product_id integer)
returns table(
  canonical_term_id bigint, canonical_code text, canonical_label text,
  source_reference_examples text[], mapping_id bigint, mapping_status text,
  portal_option_id bigint, portal_external_id text, portal_label text,
  mapping_reason text, match_basis text, comparison_evidence jsonb,
  verified_by uuid, verified_at timestamptz, reference_ready boolean
)
language plpgsql security definer
set search_path to 'public', 'regulatory', 'extensions', 'pg_temp'
as $function$
begin
  perform public.rpc_eaushadhi_require_permission(false);
  return query
  select ct.id, ct.code, ct.label,
    array_agg(distinct scl.raw_reference_text order by scl.raw_reference_text)
      filter (where nullif(btrim(scl.raw_reference_text), '') is not null),
    m.id, m.mapping_status, po.id, po.external_id, po.label,
    m.mapping_reason, m.match_basis, m.comparison_evidence,
    m.verified_by, m.verified_at,
    (m.mapping_status = 'VERIFIED' and m.is_active and po.is_active
      and po.domain_code = 'REFERENCE' and po.portal_code = 'E_AUSHADHI')
  from regulatory.eaushadhi_line_review lr
  join regulatory.source_composition_line scl on scl.id = lr.source_composition_line_id
  join regulatory.controlled_term ct on ct.id = lr.selected_reference_work_term_id
  left join lateral (
    select candidate.*
    from regulatory.term_portal_mapping candidate
    where candidate.controlled_term_id = ct.id
      and candidate.portal_code = 'E_AUSHADHI' and candidate.is_active = true
    order by (candidate.mapping_status = 'VERIFIED') desc, candidate.id desc
    limit 1
  ) m on true
  left join regulatory.portal_option po on po.id = m.portal_option_id
  where lr.product_id = p_product_id and ct.domain_code = 'REFERENCE_WORK'
  group by ct.id, ct.code, ct.label, m.id, m.mapping_status, po.id, po.external_id,
    po.label, m.mapping_reason, m.match_basis, m.comparison_evidence,
    m.verified_by, m.verified_at, m.is_active, po.is_active, po.domain_code, po.portal_code;
end
$function$;

create or replace function public.rpc_eaushadhi_reference_mapping_verify(
  p_mapping_id bigint,
  p_expected_status text,
  p_portal_option_id bigint,
  p_mapping_reason text default null
)
returns table(
  mapping_id bigint, mapping_status text, portal_option_id bigint,
  portal_external_id text, portal_label text, verified_by uuid, verified_at timestamptz
)
language plpgsql security definer
set search_path to 'public', 'regulatory', 'extensions', 'pg_temp'
as $function$
declare
  v_actor uuid;
  v_mapping regulatory.term_portal_mapping%rowtype;
  v_option regulatory.portal_option%rowtype;
begin
  v_actor := public.rpc_eaushadhi_require_permission(true);
  select * into strict v_mapping from regulatory.term_portal_mapping
  where id = p_mapping_id for update;
  if v_mapping.mapping_status is distinct from upper(btrim(coalesce(p_expected_status, ''))) then
    raise exception 'Reference mapping state changed; reload before verifying' using errcode = '40001';
  end if;
  if v_mapping.mapping_status <> 'DRAFT' then
    raise exception 'Only a DRAFT reference mapping may transition to VERIFIED' using errcode = '22023';
  end if;
  if v_mapping.portal_code <> 'E_AUSHADHI' or not v_mapping.is_active then
    raise exception 'Mapping is not an active E_AUSHADHI mapping' using errcode = '22023';
  end if;
  if not exists (select 1 from regulatory.controlled_term ct
                 where ct.id = v_mapping.controlled_term_id
                   and ct.domain_code = 'REFERENCE_WORK' and ct.is_active = true) then
    raise exception 'Mapping controlled term must be an active REFERENCE_WORK term' using errcode = '22023';
  end if;
  select * into strict v_option from regulatory.portal_option
  where id = p_portal_option_id;
  if v_option.portal_code <> 'E_AUSHADHI' or v_option.domain_code <> 'REFERENCE'
     or not v_option.is_active or v_option.external_id = '-1' then
    raise exception 'Selected portal option must be an active E_AUSHADHI REFERENCE option' using errcode = '22023';
  end if;
  update regulatory.term_portal_mapping m
  set portal_option_id = v_option.id,
      mapping_status = 'VERIFIED',
      mapping_reason = coalesce(nullif(btrim(p_mapping_reason), ''), m.mapping_reason),
      verified_by = v_actor,
      verified_at = now()
  where m.id = v_mapping.id;
  return query select v_mapping.id, 'VERIFIED'::text, v_option.id,
    v_option.external_id, v_option.label, v_actor, now();
end
$function$;

-- Keep the prior authoritative payload body intact and add reference authority in a wrapper.
alter function public.rpc_eaushadhi_worker_payload_get(integer, bigint)
  rename to rpc_eaushadhi_worker_payload_get_without_reference_20260923;

create function public.rpc_eaushadhi_worker_payload_get(
  p_product_id integer,
  p_expected_workflow_row_version bigint
)
returns jsonb language plpgsql security definer
set search_path to 'public', 'regulatory', 'extensions', 'pg_temp'
as $function$
declare
  v_payload jsonb;
  v_composition jsonb;
begin
  v_payload := public.rpc_eaushadhi_worker_payload_get_without_reference_20260923(
    p_product_id, p_expected_workflow_row_version
  );
  select coalesce(jsonb_agg(
    line.value || jsonb_build_object('reference', jsonb_build_object(
      'source_text', scl.raw_reference_text,
      'canonical_term_id', ct.id,
      'canonical_code', ct.code,
      'canonical_label', ct.label,
      'portal_option_id', case when m.mapping_status = 'VERIFIED' then po.id end,
      'portal_value', case when m.mapping_status = 'VERIFIED' and po.is_active then po.external_id end,
      'portal_label', case when m.mapping_status = 'VERIFIED' and po.is_active then po.label end,
      'mapping_status', coalesce(m.mapping_status, 'UNMAPPED'),
      'mapping_basis', m.match_basis
    )) order by line.ordinality
  ), '[]'::jsonb) into v_composition
  from jsonb_array_elements(coalesce(v_payload->'composition', '[]'::jsonb)) with ordinality line(value, ordinality)
  join regulatory.source_composition_line scl
    on scl.id = (line.value->>'source_composition_line_id')::bigint
  join regulatory.eaushadhi_line_review lr on lr.source_composition_line_id = scl.id
  left join regulatory.controlled_term ct on ct.id = lr.selected_reference_work_term_id
  left join lateral (
    select candidate.*
    from regulatory.term_portal_mapping candidate
    where candidate.controlled_term_id = ct.id
      and candidate.portal_code = 'E_AUSHADHI' and candidate.is_active = true
    order by (candidate.mapping_status = 'VERIFIED') desc, candidate.id desc
    limit 1
  ) m on true
  left join regulatory.portal_option po
    on po.id = m.portal_option_id and po.portal_code = 'E_AUSHADHI' and po.domain_code = 'REFERENCE';
  return jsonb_set(v_payload, '{composition}', v_composition, true);
end
$function$;

create or replace function public.rpc_eaushadhi_worker_content_get(
  p_product_id integer,
  p_expected_workflow_row_version bigint
)
returns jsonb language plpgsql security definer
set search_path to 'public', 'regulatory', 'extensions', 'pg_temp'
as $function$
declare
  v_payload jsonb;
  v_hash_payload jsonb;
  v_hash text;
begin
  perform public.rpc_eaushadhi_require_permission(false);
  v_payload := public.rpc_eaushadhi_worker_payload_get(p_product_id, p_expected_workflow_row_version);
  select jsonb_set(v_payload, '{composition}', coalesce(jsonb_agg(
    (line.value - 'reference') || jsonb_build_object(
      'reference', jsonb_build_object('portal_value', line.value #>> '{reference,portal_value}')
    ) order by line.ordinality
  ), '[]'::jsonb), true)
  into v_hash_payload
  from jsonb_array_elements(coalesce(v_payload->'composition', '[]'::jsonb))
       with ordinality line(value, ordinality);
  v_hash := regulatory.eaushadhi_worker_content_hash(v_hash_payload);
  return jsonb_build_object('payload', v_payload, 'content_hash', v_hash);
end
$function$;

comment on function public.rpc_eaushadhi_reference_mapping_get(integer) is
  'Read-only governed Composition Reference mapping state for a product.';
comment on function public.rpc_eaushadhi_reference_mapping_verify(bigint,text,bigint,text) is
  'Permission-gated DRAFT to VERIFIED transition using server-owned term and portal labels.';

revoke all on function public.rpc_eaushadhi_portal_options(text) from public, anon;
grant execute on function public.rpc_eaushadhi_portal_options(text) to authenticated, service_role;
revoke all on function public.rpc_eaushadhi_reference_mapping_get(integer) from public, anon;
grant execute on function public.rpc_eaushadhi_reference_mapping_get(integer) to authenticated, service_role;
revoke all on function public.rpc_eaushadhi_reference_mapping_verify(bigint,text,bigint,text) from public, anon;
grant execute on function public.rpc_eaushadhi_reference_mapping_verify(bigint,text,bigint,text) to authenticated, service_role;
revoke all on function public.rpc_eaushadhi_worker_payload_get_without_reference_20260923(integer,bigint) from public, anon, authenticated;
grant execute on function public.rpc_eaushadhi_worker_payload_get_without_reference_20260923(integer,bigint) to service_role;
revoke all on function public.rpc_eaushadhi_worker_payload_get(integer,bigint) from public, anon;
grant execute on function public.rpc_eaushadhi_worker_payload_get(integer,bigint) to authenticated, service_role;
revoke all on function public.rpc_eaushadhi_worker_content_get(integer,bigint) from public, anon;
grant execute on function public.rpc_eaushadhi_worker_content_get(integer,bigint) to authenticated, service_role;

alter function public.rpc_eaushadhi_portal_options(text) owner to postgres;
alter function public.rpc_eaushadhi_reference_mapping_get(integer) owner to postgres;
alter function public.rpc_eaushadhi_reference_mapping_verify(bigint,text,bigint,text) owner to postgres;
alter function public.rpc_eaushadhi_worker_payload_get_without_reference_20260923(integer,bigint) owner to postgres;
alter function public.rpc_eaushadhi_worker_payload_get(integer,bigint) owner to postgres;
alter function public.rpc_eaushadhi_worker_content_get(integer,bigint) owner to postgres;

commit;
