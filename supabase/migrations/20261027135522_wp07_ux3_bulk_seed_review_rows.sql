-- WP-07 UX3: one-time BULK seed of pre-entry review rows
-- STATUS: DRAFT. NOT APPLIED. Apply only with owner approval, after pinging Aryabhatta.
-- Project: qhmoqtxpeasamtlxaoak
-- Authorised: owner Dr. Brahmadathan (dff17104-c02a-4bca-95b1-e8ddff46a9b6), 2026-10-27.
--
-- Target set (computed live 2026-10-27, SELECT only): 358 products with
--   product_dossier.scope_decision = 'IN_SCOPE' and dossier_status = 'RECONCILIATION_PENDING'
--   and NO eaushadhi_product_workflow row. All 358 have a VERIFIED source_product_resolution.
--   313 of them have 4608 composition lines (one import each, 2026-10-24, AUTO_MATCHED, none reviewed);
--   45 have no composition lines (composition step will show NO_DATA, as it does today).
--   The 440 SOURCE_MATCH_PENDING products and the 2 BLOCKED products are excluded. Product 262 is
--   already seeded and is excluded by construction (and asserted).
--
-- Rows created (expected): workflow +358, product_review +358, classification_review +358,
--   line_review +4608. Every new row: review_status PENDING, row_version 1, updated_by NULL,
--   reviewed_by NULL, created_by = owner. Four-eyes guards are BEFORE UPDATE only, so they do not
--   fire here; because updated_by stays NULL nobody can approve until someone saves for review.
-- Seed tag (used by verify and rollback): suggestion_basis->>'seeded_from' = 'wp07_ux3_bulk_seed_20261027'
--   (workflow has no suggestion_basis: tagged by workflow_notes = the seed note).
-- Triggers that fire on INSERT:
--   workflow, product_review, line_review: trg_audit_row -> one regulatory.audit_event row each
--     (actor_user_id = auth.uid(), NULL when applied as postgres; application_name set below).
--   product_review: portal projection (diseases text NULL -> portal fields NULL / PENDING).
--   line_review: option-domain validator (all suggested ids are checked to be in the right domain).
--   classification_review has no audit trigger: an explicit audit_event row is written per row.
-- Expected audit_event rows: 358 + 358 + 358 + 4608 = 5682.

begin;

set local application_name = 'wp07_ux3_bulk_seed_20261027';
set local lock_timeout = '10s';

lock table regulatory.eaushadhi_product_workflow, regulatory.eaushadhi_product_review,
           regulatory.eaushadhi_product_classification_review, regulatory.eaushadhi_line_review
  in share row exclusive mode;

create temp table _seed_target on commit drop as
select d.product_id
  from regulatory.product_dossier d
 where d.scope_decision = 'IN_SCOPE'
   and d.dossier_status = 'RECONCILIATION_PENDING'
   and not exists (select 1 from regulatory.eaushadhi_product_workflow w where w.product_id = d.product_id)
   and not exists (select 1 from regulatory.eaushadhi_product_review r where r.product_id = d.product_id)
   and not exists (select 1 from regulatory.eaushadhi_product_classification_review c where c.product_id = d.product_id)
   and not exists (select 1 from regulatory.eaushadhi_line_review l where l.product_id = d.product_id);

create temp table _seed_lines on commit drop as
select l.id as source_composition_line_id, l.matched_product_id as product_id,
       l.source_import_id, upper(btrim(l.raw_part_used)) as part_u, upper(btrim(l.raw_unit_text)) as unit_u
  from regulatory.source_composition_line l
  join _seed_target t on t.product_id = l.matched_product_id
 where l.match_status = 'AUTO_MATCHED'
   and not exists (select 1 from regulatory.eaushadhi_line_review r where r.source_composition_line_id = l.id);

-- Preflight: refuse unless the world still looks exactly as reviewed on 2026-10-27.
do $$
declare v_t int; v_l int; v_lp int; v_reg bigint; v_owner int;
begin
  select count(*) into v_t from _seed_target;
  select count(*), count(distinct product_id) into v_l, v_lp from _seed_lines;
  if v_t <> 358 then raise exception 'UX3 seed preflight: expected 358 target products, found %', v_t; end if;
  if v_l <> 4608 or v_lp <> 313 then
    raise exception 'UX3 seed preflight: expected 4608 lines for 313 products, found % for %', v_l, v_lp; end if;
  if exists (select 1 from _seed_target where product_id = 262) then
    raise exception 'UX3 seed preflight: product 262 must not be in the target set'; end if;
  if exists (select 1 from _seed_target t where not exists (select 1 from regulatory.source_product_resolution r
              where r.product_id = t.product_id and r.resolution_status = 'VERIFIED')) then
    raise exception 'UX3 seed preflight: a target product has no VERIFIED source resolution'; end if;
  if exists (select 1 from regulatory.source_composition_line l join _seed_target t on t.product_id = l.matched_product_id
              where l.match_status <> 'AUTO_MATCHED') then
    raise exception 'UX3 seed preflight: a target product has non AUTO_MATCHED lines; owner decision needed'; end if;
  if (select count(*) from (select product_id from _seed_lines group by product_id having count(distinct source_import_id) > 1) x) > 0 then
    raise exception 'UX3 seed preflight: a target product has lines from more than one import; current set is ambiguous'; end if;
  select ct.id into v_reg from regulatory.controlled_term ct
   where ct.domain_code = 'PERMISSION_PURPOSE' and ct.code = 'REGULAR' and coalesce(ct.is_active, true);
  if v_reg is null then raise exception 'UX3 seed preflight: PERMISSION_PURPOSE REGULAR term missing'; end if;
  select count(*) into v_owner from auth.users where id = 'dff17104-c02a-4bca-95b1-e8ddff46a9b6';
  if v_owner <> 1 then raise exception 'UX3 seed preflight: owner user not found'; end if;
  if (select count(*) from regulatory.portal_option where is_active and
        ((domain_code = 'INGREDIENT_TYPE' and label in ('ACTIVE INGREDIENTS', 'EXCIPIENTS'))
      or (domain_code = 'INGREDIENT_FORM' and label = 'AS PER TEXT')
      or (domain_code = 'PART_USED' and label = 'AS PER TEXT')
      or (domain_code = 'MEASUREMENT_UNIT' and label in ('GM', 'MG', 'ML', 'NOS.')))) <> 8 then
    raise exception 'UX3 seed preflight: default portal options are missing or duplicated'; end if;
end $$;

-- 1. workflow rows (table defaults: PENDING / NOT_STARTED / row_version 1)
insert into regulatory.eaushadhi_product_workflow (product_id, workflow_notes, created_by)
select t.product_id, 'WP-07 bulk seed authorised by owner 2026-10-27', 'dff17104-c02a-4bca-95b1-e8ddff46a9b6'::uuid
  from _seed_target t
on conflict (product_id) do nothing;

-- 2. product details review, same organisational prefill as the 2026-09 seed
insert into regulatory.eaushadhi_product_review (
  product_id, suggested_permission_purpose_term_id, selected_permission_purpose_term_id,
  selected_contains_bhang, selected_contains_opium, selected_contains_other_narcotic,
  selected_contains_schedule_e1, selected_contains_self_generated_alcohol,
  suggestion_basis, review_notes, created_by)
select t.product_id, ct.id, ct.id, false, false, false, false, false,
       jsonb_build_object(
         'seeded_at', now(), 'seeded_from', 'wp07_ux3_bulk_seed_20261027',
         'seed_reason', 'WP-07 bulk seed authorised by owner 2026-10-27',
         'permission_purpose', jsonb_build_object('mode', 'ORGANISATIONAL_RULE_PREFILL',
             'rule', 'ALL_EAUSHADHI_SCOPE_PRODUCTS_REGULAR', 'value', 'Regular', 'applied_at', now()),
         'restricted_ingredient_declaration', jsonb_build_object('mode', 'ORGANISATIONAL_RULE_PREFILL',
             'rule', 'COMBINED_EAUSHADHI_DECLARATION_NO_FOR_ALL_SCOPE_PRODUCTS', 'value', 'No', 'applied_at', now(),
             'portal_question', 'Contains Bhang/Apheem(Opium)/Other Narcotics Ingredients/Schedule E-1 Ingredients/Self Generated Alcohol?')),
       'Organisational e-Aushadhi prefill: Permission Purpose = Regular; combined restricted-ingredient/Schedule E-1/self-generated-alcohol declaration = No. Remains subject to explicit Product Details verification.',
       'dff17104-c02a-4bca-95b1-e8ddff46a9b6'::uuid
  from _seed_target t
  cross join (select id from regulatory.controlled_term
               where domain_code = 'PERMISSION_PURPOSE' and code = 'REGULAR' and coalesce(is_active, true)) ct
on conflict (product_id) do nothing;

-- 3. portal classification review: PENDING / UNRESOLVED, no suggestion
insert into regulatory.eaushadhi_product_classification_review (product_id, suggestion_basis, created_by)
select t.product_id,
       jsonb_build_object('seeded_at', now(), 'seeded_from', 'wp07_ux3_bulk_seed_20261027',
         'seed_reason', 'WP-07 bulk seed authorised by owner 2026-10-27',
         'product_type_basis', 'No suggestion seeded; Product Type must be chosen by the verifier.',
         'subtype_basis', 'Portal Sub Type is a separate classification dimension; no internal dosage subtype is reused.'),
       'dff17104-c02a-4bca-95b1-e8ddff46a9b6'::uuid
  from _seed_target t
on conflict (product_id) do nothing;

insert into regulatory.audit_event (entity_schema, entity_table, entity_key, action, old_data, new_data,
                                    actor_user_id, application_name)
select 'regulatory', 'eaushadhi_product_classification_review', c.product_id::text, 'INSERT', null, to_jsonb(c),
       'dff17104-c02a-4bca-95b1-e8ddff46a9b6'::uuid, 'wp07_ux3_bulk_seed_20261027'
  from regulatory.eaushadhi_product_classification_review c
 where c.suggestion_basis->>'seeded_from' = 'wp07_ux3_bulk_seed_20261027';

-- 4. line reviews for every current composition line of the 313 products with lines.
-- Suggestions use only the deterministic default rules recorded on the 2026-09 seed
-- (no historical portal mapping is available for these products):
--   ingredient type: EXCIPIENTS when raw part used is EXCIPIENT(S), else ACTIVE INGREDIENTS
--   ingredient form: AS PER TEXT (no source form available)
--   part used: exact PART_USED label match on raw part used, else AS PER TEXT
--   measurement unit: exact unit text (G -> GM, MG, ML, NOS/NOS. -> NOS.), else NULL
-- selected_* stay NULL; the verifier picks them.
with po as (
  select domain_code, upper(btrim(label)) lab, min(id) id
    from regulatory.portal_option where is_active group by 1, 2 having count(*) = 1)
insert into regulatory.eaushadhi_line_review (
  source_composition_line_id, product_id,
  suggested_ingredient_type_option_id, suggested_ingredient_form_option_id,
  suggested_part_used_option_id, suggested_measurement_option_id,
  suggestion_basis, created_by)
select s.source_composition_line_id, s.product_id,
       case when s.part_u in ('EXCIPIENT', 'EXCIPIENTS') then ty_ex.id else ty_ac.id end,
       fm.id,
       coalesce(pu.id, pu_apt.id),
       mu.id,
       jsonb_build_object(
         'seeded_at', now(), 'seeded_from', 'wp07_ux3_bulk_seed_20261027',
         'seed_reason', 'WP-07 bulk seed authorised by owner 2026-10-27',
         'basis', 'deterministic_default_rules_no_historical_portal_mapping',
         'source_import_id', s.source_import_id,
         'ingredient_type', jsonb_build_object('mode', 'DUMMY_REVIEW_DEFAULT',
             'rule', case when s.part_u in ('EXCIPIENT', 'EXCIPIENTS') then 'EXCIPIENT_PART_USED_TEXT' else 'DEFAULT_ACTIVE_INGREDIENTS_WHEN_UNRESOLVED' end),
         'ingredient_form', jsonb_build_object('mode', 'DUMMY_REVIEW_DEFAULT', 'rule', 'AS_PER_TEXT_NO_SOURCE_FORM_AVAILABLE'),
         'part_used', jsonb_build_object('mode', case when pu.id is not null then 'EXACT_LABEL_MATCH' else 'DUMMY_REVIEW_DEFAULT' end,
             'rule', case when pu.id is not null then 'EXACT_RAW_PART_USED_TO_PORTAL_LABEL' else 'AS_PER_TEXT_WHEN_NO_CAPTURED_EXACT_PORTAL_PART' end),
         'measurement_unit', jsonb_build_object('mode', case when mu.id is not null then 'EXACT_UNIT_TEXT_MATCH' else 'UNRESOLVED' end,
             'raw_unit_text', s.unit_u)),
       'dff17104-c02a-4bca-95b1-e8ddff46a9b6'::uuid
  from _seed_lines s
  join po ty_ac on ty_ac.domain_code = 'INGREDIENT_TYPE' and ty_ac.lab = 'ACTIVE INGREDIENTS'
  join po ty_ex on ty_ex.domain_code = 'INGREDIENT_TYPE' and ty_ex.lab = 'EXCIPIENTS'
  join po fm on fm.domain_code = 'INGREDIENT_FORM' and fm.lab = 'AS PER TEXT'
  join po pu_apt on pu_apt.domain_code = 'PART_USED' and pu_apt.lab = 'AS PER TEXT'
  left join po pu on pu.domain_code = 'PART_USED' and pu.lab = s.part_u
  left join po mu on mu.domain_code = 'MEASUREMENT_UNIT'
        and mu.lab = case s.unit_u when 'G' then 'GM' when 'NOS' then 'NOS.' else s.unit_u end
on conflict (source_composition_line_id) do nothing;

-- Postflight: exact counts or abort the whole transaction.
do $$
declare v_wf int; v_pr int; v_cr int; v_lr int;
begin
  select count(*) into v_wf from regulatory.eaushadhi_product_workflow
   where workflow_notes = 'WP-07 bulk seed authorised by owner 2026-10-27' and product_id in (select product_id from _seed_target);
  select count(*) into v_pr from regulatory.eaushadhi_product_review where suggestion_basis->>'seeded_from' = 'wp07_ux3_bulk_seed_20261027';
  select count(*) into v_cr from regulatory.eaushadhi_product_classification_review where suggestion_basis->>'seeded_from' = 'wp07_ux3_bulk_seed_20261027';
  select count(*) into v_lr from regulatory.eaushadhi_line_review where suggestion_basis->>'seeded_from' = 'wp07_ux3_bulk_seed_20261027';
  if (v_wf, v_pr, v_cr, v_lr) <> (358, 358, 358, 4608) then
    raise exception 'UX3 seed postflight: counts wf % pr % cr % lr % (expected 358/358/358/4608)', v_wf, v_pr, v_cr, v_lr; end if;
  if exists (select 1 from regulatory.eaushadhi_product_workflow w join _seed_target t using (product_id)
              where w.updated_by is not null or w.row_version <> 1 or w.review_status <> 'PENDING' or w.entry_status <> 'NOT_STARTED')
  or exists (select 1 from regulatory.eaushadhi_product_review r join _seed_target t using (product_id)
              where r.updated_by is not null or r.reviewed_by is not null or r.review_status <> 'PENDING')
  or exists (select 1 from regulatory.eaushadhi_product_classification_review c join _seed_target t using (product_id)
              where c.updated_by is not null or c.reviewed_by is not null or c.review_status <> 'PENDING' or c.selected_subtype_mode <> 'UNRESOLVED')
  or exists (select 1 from regulatory.eaushadhi_line_review l join _seed_target t using (product_id)
              where l.updated_by is not null or l.reviewed_by is not null or l.review_status <> 'PENDING'
                 or l.selected_ingredient_type_option_id is not null or l.selected_part_used_option_id is not null) then
    raise exception 'UX3 seed postflight: a seeded row is not a clean PENDING row'; end if;
end $$;

commit;
