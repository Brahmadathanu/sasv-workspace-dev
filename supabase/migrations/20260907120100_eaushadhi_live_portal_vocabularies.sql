-- Idempotent live vocabulary load from sanitized capture
-- 120e796d-9bb8-4d21-811f-a4cb5b908394 @ 2026-09-04T13:31:03.361Z
-- Does not apply product review / workflow / ENTERED mutation.
-- Author-only: do not apply from this gate unless separately authorized.

do $$
declare
  v_comp_before integer;
  v_review_before integer;
  v_line_before integer;
  v_action_review_before integer;
  v_ready_before integer;
  v_workflow_before integer;
  v_matched integer;
  rec record;
begin
  select count(*) into v_comp_before
  from regulatory.portal_option
  where portal_code = 'E_AUSHADHI'
    and domain_code in ('INGREDIENT_TYPE', 'INGREDIENT_FORM', 'PART_USED', 'MEASUREMENT_UNIT');
  if v_comp_before <> 109 then
    raise exception 'composition portal_option count before load is %, expected 109', v_comp_before;
  end if;

  select count(*) into v_review_before from regulatory.eaushadhi_product_review;
  select count(*) into v_line_before from regulatory.eaushadhi_line_review;
  select count(*) into v_action_review_before from regulatory.eaushadhi_product_action_review;
  select count(*) into v_workflow_before from regulatory.eaushadhi_product_workflow;
  select count(*) into v_ready_before from regulatory.v_eaushadhi_product_readiness;


  insert into regulatory.portal_vocabulary_snapshot (portal_code, domain_code, payload_sha256, payload_json, context_json)
  select
    'E_AUSHADHI',
    'PRODUCT_TYPE',
    'a915a3e281feb3ce89c20ced370cd33e2bbda9773caa066ebf48aef60f95df1b',
    '[{"external_id":"Ayurvedic Classical Medicine","label":"Ayurvedic Classical Medicine"},{"external_id":"Ayurvedic Proprietary Medicine","label":"Ayurvedic Proprietary Medicine"},{"external_id":"Siddha Classical Medicine","label":"Siddha Classical Medicine"},{"external_id":"Siddha Proprietary Medicine","label":"Siddha Proprietary Medicine"},{"external_id":"Sowa Rigpa Classical Medicine","label":"Sowa Rigpa Classical Medicine"},{"external_id":"Sowa Rigpa Proprietary Medicine","label":"Sowa Rigpa Proprietary Medicine"},{"external_id":"Unani Classical Medicine","label":"Unani Classical Medicine"},{"external_id":"Unani Proprietary Medicine","label":"Unani Proprietary Medicine"}]'::jsonb,
    '{"provenance":"authenticated_live_portal_capture","source_route":"/admin/addproductforlegacy","source_control":"DOM:#type","capture_id":"120e796d-9bb8-4d21-811f-a4cb5b908394","captured_at":"2026-09-04T13:31:03.361Z","parent_domain_code":null,"parent_external_id":null}'::jsonb
  where not exists (
    select 1
    from regulatory.portal_vocabulary_snapshot s
    where s.portal_code = 'E_AUSHADHI'
      and s.domain_code = 'PRODUCT_TYPE'
      and s.payload_sha256 = 'a915a3e281feb3ce89c20ced370cd33e2bbda9773caa066ebf48aef60f95df1b'
  );


  insert into regulatory.portal_vocabulary_snapshot (portal_code, domain_code, payload_sha256, payload_json, context_json)
  select
    'E_AUSHADHI',
    'PRODUCT_CATEGORY',
    '5bef9c0fabc65344c486dc84dede021e7fd2b77ec4714910bfcbbd163fa3623d',
    '[{"external_id":"Aerosol - For External Use","label":"Aerosol - For External Use"},{"external_id":"Anjana","label":"Anjana"},{"external_id":"Aristha","label":"Aristha"},{"external_id":"Ark","label":"Ark"},{"external_id":"Asava","label":"Asava"},{"external_id":"Aschyotan","label":"Aschyotan"},{"external_id":"Avaleh","label":"Avaleh"},{"external_id":"Bhasma","label":"Bhasma"},{"external_id":"Capsule - Hard","label":"Capsule - Hard"},{"external_id":"Capsule -Soft","label":"Capsule -Soft"},{"external_id":"Chenduram","label":"Chenduram"},{"external_id":"Churna (Powder) - For External Use","label":"Churna (Powder) - For External Use"},{"external_id":"Churna (Powder) - For Internal Use","label":"Churna (Powder) - For Internal Use"},{"external_id":"Dhoomravarti","label":"Dhoomravarti"},{"external_id":"Dhoopan","label":"Dhoopan"},{"external_id":"External Preparation","label":"External Preparation"},{"external_id":"Extract Dry","label":"Extract Dry"},{"external_id":"Extract Wet","label":"Extract Wet"},{"external_id":"Ghana","label":"Ghana"},{"external_id":"Ghrit","label":"Ghrit"},{"external_id":"Gummies","label":"Gummies"},{"external_id":"Gutika","label":"Gutika"},{"external_id":"Ilakam","label":"Ilakam"},{"external_id":"Kajal","label":"Kajal"},{"external_id":"Kalimapu","label":"Kalimapu"},{"external_id":"Kanmai","label":"Kanmai"},{"external_id":"Karn Bindu","label":"Karn Bindu"},{"external_id":"Karpu","label":"Karpu"},{"external_id":"Khand","label":"Khand"},{"external_id":"Ksara","label":"Ksara"},{"external_id":"Kshar Sutra","label":"Kshar Sutra"},{"external_id":"Kshar Varti","label":"Kshar Varti"},{"external_id":"Kulikai","label":"Kulikai"},{"external_id":"Kupi Pakva","label":"Kupi Pakva"},{"external_id":"Kuppi Centuram","label":"Kuppi Centuram"},{"external_id":"Kutinir ","label":"Kutinir"},{"external_id":"Kutinir Churanam","label":"Kutinir Churanam"},{"external_id":"Kwath Churna","label":"Kwath Churna"},{"external_id":"Lakayam","label":"Lakayam"},{"external_id":"Lavana","label":"Lavana"},{"external_id":"Lepa ","label":"Lepa"},{"external_id":"Lozenges","label":"Lozenges"},{"external_id":"Manapaku","label":"Manapaku"},{"external_id":"Manjan","label":"Manjan"},{"external_id":"Marham (Cream)","label":"Marham (Cream)"},{"external_id":"Mattirai","label":"Mattirai"},{"external_id":"Modak","label":"Modak"},{"external_id":"Nasa Bindu","label":"Nasa Bindu"},{"external_id":"Nasya","label":"Nasya"},{"external_id":"Netra Malham","label":"Netra Malham"},{"external_id":"Ney","label":"Ney"},{"external_id":"Ointment","label":"Ointment"},{"external_id":"Oral Drop","label":"Oral Drop"},{"external_id":"Oral Liquid","label":"Oral Liquid"},{"external_id":"Pacai","label":"Pacai"},{"external_id":"Pak","label":"Pak"},{"external_id":"Panak","label":"Panak"},{"external_id":"Panir","label":"Panir"},{"external_id":"Parpam","label":"Parpam"},{"external_id":"Parpati","label":"Parpati"},{"external_id":"Pasai","label":"Pasai"},{"external_id":"Pills","label":"Pills"},{"external_id":"Pisti","label":"Pisti"},{"external_id":"Pravahi Kwath","label":"Pravahi Kwath"},{"external_id":"Saram","label":"Saram"},{"external_id":"Sattu","label":"Sattu"},{"external_id":"Satva","label":"Satva"},{"external_id":"Shampoo","label":"Shampoo"},{"external_id":"Sindura","label":"Sindura"},{"external_id":"Single Drugs ","label":"Single Drugs"},{"external_id":"Soap","label":"Soap"},{"external_id":"Spray - For External Use","label":"Spray - For External Use"},{"external_id":"Sura","label":"Sura"},{"external_id":"Swarasa (Juice)","label":"Swarasa (Juice)"},{"external_id":"Syrup","label":"Syrup"},{"external_id":"Tablet","label":"Tablet"},{"external_id":"Tailam (Oil)","label":"Tailam (Oil)"},{"external_id":"Taila (Oil)","label":"Taila (Oil)"},{"external_id":"Tinir","label":"Tinir"},{"external_id":"Tiravakam","label":"Tiravakam"},{"external_id":"Toothpaste","label":"Toothpaste"},{"external_id":"Uppu","label":"Uppu"},{"external_id":"Vartti","label":"Vartti"},{"external_id":"Vati","label":"Vati"}]'::jsonb,
    '{"provenance":"authenticated_live_portal_capture","source_route":"/admin/addproductforlegacy","source_control":"DOM:#categoryId","capture_id":"120e796d-9bb8-4d21-811f-a4cb5b908394","captured_at":"2026-09-04T13:31:03.361Z","parent_domain_code":"PRODUCT_TYPE","parent_external_id":"Siddha Classical Medicine"}'::jsonb
  where not exists (
    select 1
    from regulatory.portal_vocabulary_snapshot s
    where s.portal_code = 'E_AUSHADHI'
      and s.domain_code = 'PRODUCT_CATEGORY'
      and s.payload_sha256 = '5bef9c0fabc65344c486dc84dede021e7fd2b77ec4714910bfcbbd163fa3623d'
  );


  insert into regulatory.portal_vocabulary_snapshot (portal_code, domain_code, payload_sha256, payload_json, context_json)
  select
    'E_AUSHADHI',
    'PRODUCT_SUBTYPE',
    'caf418018fc282f463b75bbfc02585629946f03aa0499decdf0b2049c45b1990',
    '[{"external_id":"19","label":"Regular"},{"external_id":"20","label":"Change in Dosage Form"},{"external_id":"21","label":"Used for new indication"},{"external_id":"32","label":"-"}]'::jsonb,
    '{"provenance":"authenticated_live_portal_capture","source_route":"/admin/addproductforlegacy","source_control":"DOM:#subTypeId","capture_id":"120e796d-9bb8-4d21-811f-a4cb5b908394","captured_at":"2026-09-04T13:31:03.361Z","parent_domain_code":"PRODUCT_TYPE","parent_external_id":"Siddha Classical Medicine"}'::jsonb
  where not exists (
    select 1
    from regulatory.portal_vocabulary_snapshot s
    where s.portal_code = 'E_AUSHADHI'
      and s.domain_code = 'PRODUCT_SUBTYPE'
      and s.payload_sha256 = 'caf418018fc282f463b75bbfc02585629946f03aa0499decdf0b2049c45b1990'
  );


  insert into regulatory.portal_vocabulary_snapshot (portal_code, domain_code, payload_sha256, payload_json, context_json)
  select
    'E_AUSHADHI',
    'PERMISSION_PURPOSE',
    '0f0f962b1a0cca6a403898830caafa93f1ced3265f79da63962dc4c825ae9972',
    '[{"external_id":"Regular","label":"Regular"},{"external_id":"Export Only","label":"Export Only"}]'::jsonb,
    '{"provenance":"authenticated_live_portal_capture","source_route":"/admin/addproductforlegacy","source_control":"DOM:#permissionPurpose","capture_id":"120e796d-9bb8-4d21-811f-a4cb5b908394","captured_at":"2026-09-04T13:31:03.361Z","parent_domain_code":null,"parent_external_id":null}'::jsonb
  where not exists (
    select 1
    from regulatory.portal_vocabulary_snapshot s
    where s.portal_code = 'E_AUSHADHI'
      and s.domain_code = 'PERMISSION_PURPOSE'
      and s.payload_sha256 = '0f0f962b1a0cca6a403898830caafa93f1ced3265f79da63962dc4c825ae9972'
  );


  insert into regulatory.portal_vocabulary_snapshot (portal_code, domain_code, payload_sha256, payload_json, context_json)
  select
    'E_AUSHADHI',
    'PHARMACOLOGICAL_ACTION',
    '02af3b79f55d3c25701c755184668fde6185744f4cf1fbe32640432f84cace69',
    '[{"external_id":"Nervous System Brains and Nerves","label":"Nervous System (Brains & Nerves)"},{"external_id":"Cardiovascular System Heart and Blood Vessels","label":"Cardiovascular System (Heart & Blood Vessels)"},{"external_id":"Respiratory System Lungs and Breathings","label":"Respiratory System (Lungs & Breathings)"},{"external_id":"Digestive system Stomach, Liver, Intestine","label":"Digestive system (Stomach, Liver, Intestine)"},{"external_id":"Musculoskeletal System Bones and Joints","label":"Musculoskeletal System (Bones &Joints)"},{"external_id":"Endocrine and Metabolic System","label":"Endocrine & Metabolic System"},{"external_id":"Immune System and General Wellness","label":"Immune System & General Wellness"},{"external_id":"Urinary System Kidney and Bladder","label":"Urinary System (Kidney & Bladder)"},{"external_id":"Skin Health","label":"Skin Health"},{"external_id":"Hair Health","label":"Hair Health"},{"external_id":"Reproductive System Male","label":"Reproductive System (Male)"},{"external_id":"Reproductive System Female","label":"Reproductive System (Female)"},{"external_id":"Weight management and Fitness","label":"Weight management & Fitness"},{"external_id":"Mental Wellness and Emotional Health","label":"Mental Wellness & Emotional Health"},{"external_id":"Detoxification and Cleansing","label":"Detoxification & Cleansing"},{"external_id":"Adaptogens and Energy Booster","label":"Adaptogens & Energy Booster"},{"external_id":"Antioxidants and Anti-agings","label":"Antioxidants & Anti-agings"},{"external_id":"Saundrya Prashadhak","label":"Saundrya Prashadhak"},{"external_id":"Oral Health","label":"Oral Health"},{"external_id":"Dental Health","label":"Dental Health"},{"external_id":"Infections and Inflammation Support","label":"Infections & Inflammation Support"},{"external_id":"Children''s Wellness","label":"Children''s Wellness"},{"external_id":"Lifestyle Supports","label":"Lifestyle Supports"},{"external_id":"Cognitive Performance and Nootropics","label":"Cognitive Performance & Nootropics"},{"external_id":"Blood Purification and Hematologic Support","label":"Blood Purification & Hematologic Support"},{"external_id":"Anti-Parasitic and Gut Cleanse","label":"Anti-Parasitic & Gut Cleanse"},{"external_id":"Cellular Health","label":"Cellular Health"},{"external_id":"Male vitality","label":"Male vitality"},{"external_id":"Female Vitality","label":"Female Vitality"},{"external_id":"Female Hormonal Balance","label":"Female Hormonal Balance"},{"external_id":"Liver and Enzyme Support","label":"Liver & Enzyme Support"},{"external_id":"Allergy and Autoimmune Modulation","label":"Allergy & Autoimmune Modulation"},{"external_id":"Sleep and Circadian Rhythm","label":"Sleep & Circadian Rhythm"},{"external_id":"Metabolism and Gut Health Support","label":"Metabolism & Gut Health Support"},{"external_id":"Antiviral and Antibacterial Support","label":"Antiviral & Antibacterial Support"},{"external_id":"Inflammation and Pain Management","label":"Inflammation & Pain Management"},{"external_id":"Cancer Support Adjunct and Preventive","label":"Cancer Support (Adjunct & Preventive)"},{"external_id":"Superfood Concentrates","label":"Superfood Concentrates"},{"external_id":"Eye Health","label":"Eye Health"},{"external_id":"Blood sugar Modulation","label":"Blood sugar Modulation"},{"external_id":"Sport Nutrition and Muscle Recovery","label":"Sport Nutrition & Muscle Recovery"},{"external_id":"Rejuvenation Therapies","label":"Rejuvenation Therapies"},{"external_id":"PCOD/PCOS and Menstrual Health","label":"PCOD/PCOS & Menstrual Health"},{"external_id":"Panchkarma Support","label":"Panchkarma Support"},{"external_id":"Nasya and Aroma Based Herabal Delivery","label":"Nasya & Aroma Based Herabal Delivery"},{"external_id":"Other","label":"Other"}]'::jsonb,
    '{"provenance":"authenticated_live_portal_capture","source_route":"/admin/addproductforlegacy","source_control":"DOM:select#indications","capture_id":"120e796d-9bb8-4d21-811f-a4cb5b908394","captured_at":"2026-09-04T13:31:03.361Z","parent_domain_code":null,"parent_external_id":null}'::jsonb
  where not exists (
    select 1
    from regulatory.portal_vocabulary_snapshot s
    where s.portal_code = 'E_AUSHADHI'
      and s.domain_code = 'PHARMACOLOGICAL_ACTION'
      and s.payload_sha256 = '02af3b79f55d3c25701c755184668fde6185744f4cf1fbe32640432f84cace69'
  );


  insert into regulatory.portal_vocabulary_snapshot (portal_code, domain_code, payload_sha256, payload_json, context_json)
  select
    'E_AUSHADHI',
    'RESTRICTED_INGREDIENT_CATEGORY',
    '629644f715740f2e06b1c67fd6472a2f4bb221791ecb810400fa175a146b3928',
    '[{"external_id":"Bhang/Apheem(Opium)/Other Narcotics Ingredients","label":"Bhang/Apheem(Opium)/Other Narcotics Ingredients"},{"external_id":"Schedule E-1 Ingredients","label":"Schedule E-1 Ingredients"},{"external_id":"Self Generated Alcohol","label":"Self Generated Alcohol"}]'::jsonb,
    '{"provenance":"authenticated_live_portal_capture","source_route":"/admin/addproductforlegacy","source_control":"DOM:#drugsValue","capture_id":"120e796d-9bb8-4d21-811f-a4cb5b908394","captured_at":"2026-09-04T13:31:03.361Z","parent_domain_code":null,"parent_external_id":null}'::jsonb
  where not exists (
    select 1
    from regulatory.portal_vocabulary_snapshot s
    where s.portal_code = 'E_AUSHADHI'
      and s.domain_code = 'RESTRICTED_INGREDIENT_CATEGORY'
      and s.payload_sha256 = '629644f715740f2e06b1c67fd6472a2f4bb221791ecb810400fa175a146b3928'
  );


  insert into regulatory.portal_option (
    portal_code, domain_code, external_id, label,
    parent_domain_code, parent_external_id, notes, source_context, is_active, snapshot_id
  )
  select
    x.portal_code, x.domain_code, x.external_id, x.label,
    x.parent_domain_code, x.parent_external_id, x.notes,
    jsonb_build_object(
      'provenance', 'authenticated_live_portal_capture',
      'source_route', '/admin/addproductforlegacy',
      'source_control', 'DOM:' || x.source_control,
      'capture_id', '120e796d-9bb8-4d21-811f-a4cb5b908394',
      'captured_at', '2026-09-04T13:31:03.361Z',
      'parent_domain_code', nullif(x.parent_domain_code, ''),
      'parent_external_id', nullif(x.parent_external_id, ''),
      'fill_eligible', case when x.external_id = '32' and x.label = '-' then false else true end
    ),
    true,
    (
      select s.id
      from regulatory.portal_vocabulary_snapshot s
      where s.portal_code = x.portal_code
        and s.domain_code = x.domain_code
      order by s.id desc
      limit 1
    )
  from (values
    ('E_AUSHADHI', 'PRODUCT_TYPE', 'Ayurvedic Classical Medicine', 'Ayurvedic Classical Medicine', '', '', null, '#type'),
    ('E_AUSHADHI', 'PRODUCT_TYPE', 'Ayurvedic Proprietary Medicine', 'Ayurvedic Proprietary Medicine', '', '', null, '#type'),
    ('E_AUSHADHI', 'PRODUCT_TYPE', 'Siddha Classical Medicine', 'Siddha Classical Medicine', '', '', null, '#type'),
    ('E_AUSHADHI', 'PRODUCT_TYPE', 'Siddha Proprietary Medicine', 'Siddha Proprietary Medicine', '', '', null, '#type'),
    ('E_AUSHADHI', 'PRODUCT_TYPE', 'Sowa Rigpa Classical Medicine', 'Sowa Rigpa Classical Medicine', '', '', null, '#type'),
    ('E_AUSHADHI', 'PRODUCT_TYPE', 'Sowa Rigpa Proprietary Medicine', 'Sowa Rigpa Proprietary Medicine', '', '', null, '#type'),
    ('E_AUSHADHI', 'PRODUCT_TYPE', 'Unani Classical Medicine', 'Unani Classical Medicine', '', '', null, '#type'),
    ('E_AUSHADHI', 'PRODUCT_TYPE', 'Unani Proprietary Medicine', 'Unani Proprietary Medicine', '', '', null, '#type'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Aerosol - For External Use', 'Aerosol - For External Use', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Anjana', 'Anjana', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Aristha', 'Aristha', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Ark', 'Ark', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Asava', 'Asava', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Aschyotan', 'Aschyotan', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Avaleh', 'Avaleh', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Bhasma', 'Bhasma', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Capsule - Hard', 'Capsule - Hard', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Capsule -Soft', 'Capsule -Soft', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Chenduram', 'Chenduram', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Churna (Powder) - For External Use', 'Churna (Powder) - For External Use', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Churna (Powder) - For Internal Use', 'Churna (Powder) - For Internal Use', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Dhoomravarti', 'Dhoomravarti', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Dhoopan', 'Dhoopan', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'External Preparation', 'External Preparation', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Extract Dry', 'Extract Dry', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Extract Wet', 'Extract Wet', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Ghana', 'Ghana', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Ghrit', 'Ghrit', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Gummies', 'Gummies', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Gutika', 'Gutika', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Ilakam', 'Ilakam', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Kajal', 'Kajal', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Kalimapu', 'Kalimapu', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Kanmai', 'Kanmai', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Karn Bindu', 'Karn Bindu', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Karpu', 'Karpu', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Khand', 'Khand', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Ksara', 'Ksara', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Kshar Sutra', 'Kshar Sutra', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Kshar Varti', 'Kshar Varti', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Kulikai', 'Kulikai', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Kupi Pakva', 'Kupi Pakva', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Kuppi Centuram', 'Kuppi Centuram', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Kutinir ', 'Kutinir', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Kutinir Churanam', 'Kutinir Churanam', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Kwath Churna', 'Kwath Churna', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Lakayam', 'Lakayam', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Lavana', 'Lavana', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Lepa ', 'Lepa', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Lozenges', 'Lozenges', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Manapaku', 'Manapaku', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Manjan', 'Manjan', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Marham (Cream)', 'Marham (Cream)', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Mattirai', 'Mattirai', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Modak', 'Modak', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Nasa Bindu', 'Nasa Bindu', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Nasya', 'Nasya', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Netra Malham', 'Netra Malham', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Ney', 'Ney', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Ointment', 'Ointment', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Oral Drop', 'Oral Drop', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Oral Liquid', 'Oral Liquid', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Pacai', 'Pacai', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Pak', 'Pak', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Panak', 'Panak', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Panir', 'Panir', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Parpam', 'Parpam', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Parpati', 'Parpati', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Pasai', 'Pasai', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Pills', 'Pills', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Pisti', 'Pisti', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Pravahi Kwath', 'Pravahi Kwath', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Saram', 'Saram', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Sattu', 'Sattu', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Satva', 'Satva', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Shampoo', 'Shampoo', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Sindura', 'Sindura', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Single Drugs ', 'Single Drugs', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Soap', 'Soap', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Spray - For External Use', 'Spray - For External Use', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Sura', 'Sura', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Swarasa (Juice)', 'Swarasa (Juice)', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Syrup', 'Syrup', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Tablet', 'Tablet', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Tailam (Oil)', 'Tailam (Oil)', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Taila (Oil)', 'Taila (Oil)', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Tinir', 'Tinir', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Tiravakam', 'Tiravakam', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Toothpaste', 'Toothpaste', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Uppu', 'Uppu', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Vartti', 'Vartti', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Vati', 'Vati', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_SUBTYPE', '19', 'Regular', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#subTypeId'),
    ('E_AUSHADHI', 'PRODUCT_SUBTYPE', '20', 'Change in Dosage Form', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#subTypeId'),
    ('E_AUSHADHI', 'PRODUCT_SUBTYPE', '21', 'Used for new indication', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#subTypeId'),
    ('E_AUSHADHI', 'PRODUCT_SUBTYPE', '32', '-', 'PRODUCT_TYPE', 'Siddha Classical Medicine', 'Captured domain sentinel. Not a fill target.', '#subTypeId'),
    ('E_AUSHADHI', 'PERMISSION_PURPOSE', 'Regular', 'Regular', '', '', null, '#permissionPurpose'),
    ('E_AUSHADHI', 'PERMISSION_PURPOSE', 'Export Only', 'Export Only', '', '', null, '#permissionPurpose'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Nervous System Brains and Nerves', 'Nervous System (Brains & Nerves)', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Cardiovascular System Heart and Blood Vessels', 'Cardiovascular System (Heart & Blood Vessels)', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Respiratory System Lungs and Breathings', 'Respiratory System (Lungs & Breathings)', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Digestive system Stomach, Liver, Intestine', 'Digestive system (Stomach, Liver, Intestine)', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Musculoskeletal System Bones and Joints', 'Musculoskeletal System (Bones &Joints)', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Endocrine and Metabolic System', 'Endocrine & Metabolic System', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Immune System and General Wellness', 'Immune System & General Wellness', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Urinary System Kidney and Bladder', 'Urinary System (Kidney & Bladder)', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Skin Health', 'Skin Health', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Hair Health', 'Hair Health', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Reproductive System Male', 'Reproductive System (Male)', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Reproductive System Female', 'Reproductive System (Female)', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Weight management and Fitness', 'Weight management & Fitness', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Mental Wellness and Emotional Health', 'Mental Wellness & Emotional Health', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Detoxification and Cleansing', 'Detoxification & Cleansing', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Adaptogens and Energy Booster', 'Adaptogens & Energy Booster', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Antioxidants and Anti-agings', 'Antioxidants & Anti-agings', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Saundrya Prashadhak', 'Saundrya Prashadhak', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Oral Health', 'Oral Health', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Dental Health', 'Dental Health', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Infections and Inflammation Support', 'Infections & Inflammation Support', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Children''s Wellness', 'Children''s Wellness', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Lifestyle Supports', 'Lifestyle Supports', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Cognitive Performance and Nootropics', 'Cognitive Performance & Nootropics', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Blood Purification and Hematologic Support', 'Blood Purification & Hematologic Support', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Anti-Parasitic and Gut Cleanse', 'Anti-Parasitic & Gut Cleanse', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Cellular Health', 'Cellular Health', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Male vitality', 'Male vitality', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Female Vitality', 'Female Vitality', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Female Hormonal Balance', 'Female Hormonal Balance', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Liver and Enzyme Support', 'Liver & Enzyme Support', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Allergy and Autoimmune Modulation', 'Allergy & Autoimmune Modulation', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Sleep and Circadian Rhythm', 'Sleep & Circadian Rhythm', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Metabolism and Gut Health Support', 'Metabolism & Gut Health Support', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Antiviral and Antibacterial Support', 'Antiviral & Antibacterial Support', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Inflammation and Pain Management', 'Inflammation & Pain Management', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Cancer Support Adjunct and Preventive', 'Cancer Support (Adjunct & Preventive)', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Superfood Concentrates', 'Superfood Concentrates', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Eye Health', 'Eye Health', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Blood sugar Modulation', 'Blood sugar Modulation', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Sport Nutrition and Muscle Recovery', 'Sport Nutrition & Muscle Recovery', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Rejuvenation Therapies', 'Rejuvenation Therapies', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'PCOD/PCOS and Menstrual Health', 'PCOD/PCOS & Menstrual Health', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Panchkarma Support', 'Panchkarma Support', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Nasya and Aroma Based Herabal Delivery', 'Nasya & Aroma Based Herabal Delivery', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Other', 'Other', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'RESTRICTED_INGREDIENT_CATEGORY', 'Bhang/Apheem(Opium)/Other Narcotics Ingredients', 'Bhang/Apheem(Opium)/Other Narcotics Ingredients', '', '', null, '#drugsValue'),
    ('E_AUSHADHI', 'RESTRICTED_INGREDIENT_CATEGORY', 'Schedule E-1 Ingredients', 'Schedule E-1 Ingredients', '', '', null, '#drugsValue'),
    ('E_AUSHADHI', 'RESTRICTED_INGREDIENT_CATEGORY', 'Self Generated Alcohol', 'Self Generated Alcohol', '', '', null, '#drugsValue')
  ) as x(portal_code, domain_code, external_id, label, parent_domain_code, parent_external_id, notes, source_control)
  where not exists (
    select 1
    from regulatory.portal_option po
    where po.portal_code = x.portal_code
      and po.domain_code = x.domain_code
      and po.parent_domain_code = x.parent_domain_code
      and po.parent_external_id = x.parent_external_id
      and po.external_id = x.external_id
  );

  update regulatory.portal_option po
  set
    label = x.label,
    notes = coalesce(x.notes, po.notes),
    source_context = jsonb_build_object(
      'provenance', 'authenticated_live_portal_capture',
      'source_route', '/admin/addproductforlegacy',
      'source_control', 'DOM:' || x.source_control,
      'capture_id', '120e796d-9bb8-4d21-811f-a4cb5b908394',
      'captured_at', '2026-09-04T13:31:03.361Z',
      'parent_domain_code', nullif(x.parent_domain_code, ''),
      'parent_external_id', nullif(x.parent_external_id, ''),
      'fill_eligible', case when x.external_id = '32' and x.label = '-' then false else true end
    ),
    is_active = true
  from (values
    ('E_AUSHADHI', 'PRODUCT_TYPE', 'Ayurvedic Classical Medicine', 'Ayurvedic Classical Medicine', '', '', null, '#type'),
    ('E_AUSHADHI', 'PRODUCT_TYPE', 'Ayurvedic Proprietary Medicine', 'Ayurvedic Proprietary Medicine', '', '', null, '#type'),
    ('E_AUSHADHI', 'PRODUCT_TYPE', 'Siddha Classical Medicine', 'Siddha Classical Medicine', '', '', null, '#type'),
    ('E_AUSHADHI', 'PRODUCT_TYPE', 'Siddha Proprietary Medicine', 'Siddha Proprietary Medicine', '', '', null, '#type'),
    ('E_AUSHADHI', 'PRODUCT_TYPE', 'Sowa Rigpa Classical Medicine', 'Sowa Rigpa Classical Medicine', '', '', null, '#type'),
    ('E_AUSHADHI', 'PRODUCT_TYPE', 'Sowa Rigpa Proprietary Medicine', 'Sowa Rigpa Proprietary Medicine', '', '', null, '#type'),
    ('E_AUSHADHI', 'PRODUCT_TYPE', 'Unani Classical Medicine', 'Unani Classical Medicine', '', '', null, '#type'),
    ('E_AUSHADHI', 'PRODUCT_TYPE', 'Unani Proprietary Medicine', 'Unani Proprietary Medicine', '', '', null, '#type'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Aerosol - For External Use', 'Aerosol - For External Use', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Anjana', 'Anjana', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Aristha', 'Aristha', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Ark', 'Ark', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Asava', 'Asava', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Aschyotan', 'Aschyotan', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Avaleh', 'Avaleh', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Bhasma', 'Bhasma', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Capsule - Hard', 'Capsule - Hard', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Capsule -Soft', 'Capsule -Soft', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Chenduram', 'Chenduram', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Churna (Powder) - For External Use', 'Churna (Powder) - For External Use', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Churna (Powder) - For Internal Use', 'Churna (Powder) - For Internal Use', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Dhoomravarti', 'Dhoomravarti', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Dhoopan', 'Dhoopan', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'External Preparation', 'External Preparation', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Extract Dry', 'Extract Dry', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Extract Wet', 'Extract Wet', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Ghana', 'Ghana', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Ghrit', 'Ghrit', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Gummies', 'Gummies', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Gutika', 'Gutika', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Ilakam', 'Ilakam', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Kajal', 'Kajal', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Kalimapu', 'Kalimapu', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Kanmai', 'Kanmai', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Karn Bindu', 'Karn Bindu', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Karpu', 'Karpu', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Khand', 'Khand', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Ksara', 'Ksara', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Kshar Sutra', 'Kshar Sutra', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Kshar Varti', 'Kshar Varti', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Kulikai', 'Kulikai', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Kupi Pakva', 'Kupi Pakva', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Kuppi Centuram', 'Kuppi Centuram', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Kutinir ', 'Kutinir', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Kutinir Churanam', 'Kutinir Churanam', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Kwath Churna', 'Kwath Churna', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Lakayam', 'Lakayam', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Lavana', 'Lavana', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Lepa ', 'Lepa', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Lozenges', 'Lozenges', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Manapaku', 'Manapaku', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Manjan', 'Manjan', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Marham (Cream)', 'Marham (Cream)', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Mattirai', 'Mattirai', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Modak', 'Modak', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Nasa Bindu', 'Nasa Bindu', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Nasya', 'Nasya', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Netra Malham', 'Netra Malham', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Ney', 'Ney', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Ointment', 'Ointment', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Oral Drop', 'Oral Drop', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Oral Liquid', 'Oral Liquid', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Pacai', 'Pacai', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Pak', 'Pak', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Panak', 'Panak', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Panir', 'Panir', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Parpam', 'Parpam', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Parpati', 'Parpati', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Pasai', 'Pasai', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Pills', 'Pills', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Pisti', 'Pisti', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Pravahi Kwath', 'Pravahi Kwath', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Saram', 'Saram', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Sattu', 'Sattu', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Satva', 'Satva', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Shampoo', 'Shampoo', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Sindura', 'Sindura', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Single Drugs ', 'Single Drugs', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Soap', 'Soap', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Spray - For External Use', 'Spray - For External Use', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Sura', 'Sura', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Swarasa (Juice)', 'Swarasa (Juice)', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Syrup', 'Syrup', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Tablet', 'Tablet', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Tailam (Oil)', 'Tailam (Oil)', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Taila (Oil)', 'Taila (Oil)', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Tinir', 'Tinir', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Tiravakam', 'Tiravakam', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Toothpaste', 'Toothpaste', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Uppu', 'Uppu', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Vartti', 'Vartti', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_CATEGORY', 'Vati', 'Vati', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#categoryId'),
    ('E_AUSHADHI', 'PRODUCT_SUBTYPE', '19', 'Regular', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#subTypeId'),
    ('E_AUSHADHI', 'PRODUCT_SUBTYPE', '20', 'Change in Dosage Form', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#subTypeId'),
    ('E_AUSHADHI', 'PRODUCT_SUBTYPE', '21', 'Used for new indication', 'PRODUCT_TYPE', 'Siddha Classical Medicine', null, '#subTypeId'),
    ('E_AUSHADHI', 'PRODUCT_SUBTYPE', '32', '-', 'PRODUCT_TYPE', 'Siddha Classical Medicine', 'Captured domain sentinel. Not a fill target.', '#subTypeId'),
    ('E_AUSHADHI', 'PERMISSION_PURPOSE', 'Regular', 'Regular', '', '', null, '#permissionPurpose'),
    ('E_AUSHADHI', 'PERMISSION_PURPOSE', 'Export Only', 'Export Only', '', '', null, '#permissionPurpose'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Nervous System Brains and Nerves', 'Nervous System (Brains & Nerves)', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Cardiovascular System Heart and Blood Vessels', 'Cardiovascular System (Heart & Blood Vessels)', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Respiratory System Lungs and Breathings', 'Respiratory System (Lungs & Breathings)', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Digestive system Stomach, Liver, Intestine', 'Digestive system (Stomach, Liver, Intestine)', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Musculoskeletal System Bones and Joints', 'Musculoskeletal System (Bones &Joints)', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Endocrine and Metabolic System', 'Endocrine & Metabolic System', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Immune System and General Wellness', 'Immune System & General Wellness', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Urinary System Kidney and Bladder', 'Urinary System (Kidney & Bladder)', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Skin Health', 'Skin Health', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Hair Health', 'Hair Health', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Reproductive System Male', 'Reproductive System (Male)', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Reproductive System Female', 'Reproductive System (Female)', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Weight management and Fitness', 'Weight management & Fitness', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Mental Wellness and Emotional Health', 'Mental Wellness & Emotional Health', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Detoxification and Cleansing', 'Detoxification & Cleansing', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Adaptogens and Energy Booster', 'Adaptogens & Energy Booster', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Antioxidants and Anti-agings', 'Antioxidants & Anti-agings', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Saundrya Prashadhak', 'Saundrya Prashadhak', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Oral Health', 'Oral Health', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Dental Health', 'Dental Health', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Infections and Inflammation Support', 'Infections & Inflammation Support', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Children''s Wellness', 'Children''s Wellness', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Lifestyle Supports', 'Lifestyle Supports', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Cognitive Performance and Nootropics', 'Cognitive Performance & Nootropics', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Blood Purification and Hematologic Support', 'Blood Purification & Hematologic Support', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Anti-Parasitic and Gut Cleanse', 'Anti-Parasitic & Gut Cleanse', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Cellular Health', 'Cellular Health', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Male vitality', 'Male vitality', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Female Vitality', 'Female Vitality', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Female Hormonal Balance', 'Female Hormonal Balance', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Liver and Enzyme Support', 'Liver & Enzyme Support', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Allergy and Autoimmune Modulation', 'Allergy & Autoimmune Modulation', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Sleep and Circadian Rhythm', 'Sleep & Circadian Rhythm', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Metabolism and Gut Health Support', 'Metabolism & Gut Health Support', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Antiviral and Antibacterial Support', 'Antiviral & Antibacterial Support', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Inflammation and Pain Management', 'Inflammation & Pain Management', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Cancer Support Adjunct and Preventive', 'Cancer Support (Adjunct & Preventive)', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Superfood Concentrates', 'Superfood Concentrates', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Eye Health', 'Eye Health', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Blood sugar Modulation', 'Blood sugar Modulation', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Sport Nutrition and Muscle Recovery', 'Sport Nutrition & Muscle Recovery', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Rejuvenation Therapies', 'Rejuvenation Therapies', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'PCOD/PCOS and Menstrual Health', 'PCOD/PCOS & Menstrual Health', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Panchkarma Support', 'Panchkarma Support', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Nasya and Aroma Based Herabal Delivery', 'Nasya & Aroma Based Herabal Delivery', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'PHARMACOLOGICAL_ACTION', 'Other', 'Other', '', '', null, 'select#indications'),
    ('E_AUSHADHI', 'RESTRICTED_INGREDIENT_CATEGORY', 'Bhang/Apheem(Opium)/Other Narcotics Ingredients', 'Bhang/Apheem(Opium)/Other Narcotics Ingredients', '', '', null, '#drugsValue'),
    ('E_AUSHADHI', 'RESTRICTED_INGREDIENT_CATEGORY', 'Schedule E-1 Ingredients', 'Schedule E-1 Ingredients', '', '', null, '#drugsValue'),
    ('E_AUSHADHI', 'RESTRICTED_INGREDIENT_CATEGORY', 'Self Generated Alcohol', 'Self Generated Alcohol', '', '', null, '#drugsValue')
  ) as x(portal_code, domain_code, external_id, label, parent_domain_code, parent_external_id, notes, source_control)
  where po.portal_code = x.portal_code
    and po.domain_code = x.domain_code
    and po.parent_domain_code = x.parent_domain_code
    and po.parent_external_id = x.parent_external_id
    and po.external_id = x.external_id;

  if (
    select count(*) from regulatory.portal_option
    where portal_code = 'E_AUSHADHI' and domain_code = 'PHARMACOLOGICAL_ACTION' and is_active
  ) <> 46 then
    raise exception 'expected 46 PHARMACOLOGICAL_ACTION portal_option rows';
  end if;

  select count(*) into v_matched
  from regulatory.portal_option po
  join public.therapeutic_action ta
    on lower(btrim(ta.canonical_label)) = lower(btrim(po.label))
   and ta.active
  join regulatory.eaushadhi_therapeutic_action_map m
    on m.action_id = ta.id
  where po.portal_code = 'E_AUSHADHI'
    and po.domain_code = 'PHARMACOLOGICAL_ACTION'
    and po.is_active;

  if v_matched <> 46 then
    raise exception 'pharmacological exact reconciliation is %, expected 46/46', v_matched;
  end if;

  update regulatory.eaushadhi_therapeutic_action_map m
  set
    mapping_status = 'VERIFIED',
    source_basis = 'Native select#indications option value on authenticated /admin/addproductforlegacy; exact normalized label match to therapeutic_action.canonical_label.'
  from public.therapeutic_action ta
  join regulatory.portal_option po
    on lower(btrim(po.label)) = lower(btrim(ta.canonical_label))
   and po.portal_code = 'E_AUSHADHI'
   and po.domain_code = 'PHARMACOLOGICAL_ACTION'
   and po.is_active
  where m.action_id = ta.id
    and ta.active
    and m.mapping_status = 'DRAFT';

  if (
    select count(*) from regulatory.eaushadhi_therapeutic_action_map where mapping_status = 'VERIFIED'
  ) <> 46 then
    raise exception 'expected 46 VERIFIED therapeutic action maps';
  end if;

  if (
    select count(*) from regulatory.portal_option
    where portal_code = 'E_AUSHADHI'
      and domain_code in ('INGREDIENT_TYPE', 'INGREDIENT_FORM', 'PART_USED', 'MEASUREMENT_UNIT')
  ) <> 109 then
    raise exception 'composition portal_option rows changed';
  end if;

  if (select count(*) from regulatory.eaushadhi_product_review) <> v_review_before then
    raise exception 'eaushadhi_product_review count changed';
  end if;
  if (select count(*) from regulatory.eaushadhi_line_review) <> v_line_before then
    raise exception 'eaushadhi_line_review count changed';
  end if;
  if (select count(*) from regulatory.eaushadhi_product_action_review) <> v_action_review_before then
    raise exception 'eaushadhi_product_action_review count changed';
  end if;
  if (select count(*) from regulatory.eaushadhi_product_workflow) <> v_workflow_before then
    raise exception 'eaushadhi_product_workflow count changed';
  end if;
  if (
    select count(*) from regulatory.v_eaushadhi_product_readiness
  ) <> v_ready_before then
    raise exception 'v_eaushadhi_product_readiness count changed';
  end if;
end $$;
