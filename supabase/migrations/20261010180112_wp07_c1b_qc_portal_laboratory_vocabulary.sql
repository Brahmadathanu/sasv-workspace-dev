-- WP-07 C1b M-LAB: e-Aushadhi QC portal laboratory vocabulary (reference only).
-- Pattern: regulatory.portal_vocabulary_snapshot + regulatory.portal_option (as QC_PROTOCOL / PRODUCT_CATEGORY).
-- external_id = portal LaboratoryList id; label = portal option value (the name SaveQCData sends as labName), byte-exact.
-- No Form-48, approved_laboratory or eaushadhi_qc_laboratory_mapping authority. No new tables, no write RPCs.

do $pre$
begin
  if exists (select 1 from regulatory.portal_option where portal_code='E_AUSHADHI' and domain_code='QC_LABORATORY') then
    raise exception 'M-LAB preflight: QC_LABORATORY options already exist';
  end if;
  if exists (select 1 from regulatory.portal_vocabulary_snapshot where portal_code='E_AUSHADHI' and domain_code='QC_LABORATORY') then
    raise exception 'M-LAB preflight: QC_LABORATORY snapshot already exists';
  end if;
  if to_regprocedure('public.rpc_eaushadhi_qc_portal_laboratory_options_v1()') is not null then
    raise exception 'M-LAB preflight: lookup RPC already exists';
  end if;
  if to_regprocedure('public.rpc_eaushadhi_require_permission(boolean)') is null then
    raise exception 'M-LAB preflight: permission helper missing';
  end if;
end
$pre$;

with payload as (
  select '{"options": [{"label": "Bio-Lab (Biosourcing.com Pvt. Ltd.)", "value": "Bio-Lab (Biosourcing.com Pvt. Ltd.)", "portal_lab_id": "1177"}, {"label": "ASTHAGIRI HERBAL RESEARCH FOUNDATION", "value": "ASTHAGIRI HERBAL RESEARCH FOUNDATION", "portal_lab_id": "1214"}, {"label": "Altra Analytical Laboratories LLP", "value": "Altra Analytical Laboratories LLP", "portal_lab_id": "1397"}, {"label": "CONFEDERATION FOR AYURVEDIC RENAISSANCE KERALAM LIMITED(CARe KERALAM)", "value": "CONFEDERATION FOR AYURVEDIC RENAISSANCE KERALAM LIMITED(CARe KERALAM)", "portal_lab_id": "2072"}, {"label": "Aerrion Research Labs Pvt Ltd", "value": "Aerrion Research Labs Pvt Ltd", "portal_lab_id": "2079"}, {"label": "SITARAM AYURVEDA PRIVATE LIMITED", "value": "SITARAM AYURVEDA PRIVATE LIMITED", "portal_lab_id": "2081"}, {"label": "Quality Control Laboratory", "value": "Quality Control Laboratory", "portal_lab_id": "2182"}, {"label": "SREEDHAREEYAM FARMHERBS INDIA PVT.LTD.", "value": "SREEDHAREEYAM FARMHERBS INDIA PVT.LTD.", "portal_lab_id": "2251"}, {"label": "Vasu Research Centre (A Division of Vasu Healthcare Pvt. Ltd.)", "value": "Vasu Research Centre (A Division of Vasu Healthcare Pvt. Ltd.)", "portal_lab_id": "2334"}, {"label": "AMOL PHARMACEUTICALS PVT. LTD.", "value": "AMOL PHARMACEUTICALS PVT. LTD.", "portal_lab_id": "2381"}, {"label": "S.R. Labs and Research Centre", "value": "S.R. Labs and Research Centre", "portal_lab_id": "2422"}, {"label": "AYUSHRAJ ENTERPRISES PVT. LTD.", "value": "AYUSHRAJ ENTERPRISES PVT. LTD.", "portal_lab_id": "2434"}, {"label": "KARNANI PHARMACEUTICALS PVT. LTD.", "value": "KARNANI PHARMACEUTICALS PVT. LTD.", "portal_lab_id": "2451"}, {"label": "TEAM TEST HOUSE", "value": "TEAM TEST HOUSE", "portal_lab_id": "2459"}, {"label": "Ananta Medicare Limited", "value": "Ananta Medicare Limited", "portal_lab_id": "2486"}, {"label": "CULTIVATOR PHYTO LAB PRIVATE LIMITED", "value": "CULTIVATOR PHYTO LAB PRIVATE LIMITED", "portal_lab_id": "2534"}, {"label": "JAGDAMBA LABORATORIES (OPC) PVT LTD", "value": "JAGDAMBA LABORATORIES (OPC) PVT LTD", "portal_lab_id": "2588"}, {"label": "Ayurved Evam Herbal Vikas Sansthan Udaipur", "value": "Ayurved Evam Herbal Vikas Sansthan Udaipur", "portal_lab_id": "2642"}, {"label": "LILABA ANALYTICAL LABORATORIES LLP", "value": "LILABA ANALYTICAL LABORATORIES LLP", "portal_lab_id": "2678"}, {"label": "AUM RESEARCH LABS PVT. LTD.", "value": "AUM RESEARCH LABS PVT. LTD.", "portal_lab_id": "2747"}, {"label": "CHENNAI METTEX LAB PRIVATE LIMITED", "value": "CHENNAI METTEX LAB PRIVATE LIMITED", "portal_lab_id": "2800"}, {"label": "Pious Laboratories pvt ltd", "value": "Pious Laboratories pvt ltd", "portal_lab_id": "2817"}, {"label": "QUALITY CARE LABORATORIES AND RESEARCH CENTER", "value": "QUALITY CARE LABORATORIES AND RESEARCH CENTER", "portal_lab_id": "2959"}, {"label": "Accuprec Research Labs Private Limited", "value": "Accuprec Research Labs Private Limited", "portal_lab_id": "2978"}, {"label": "AMSAR PRIVATE LIMITED", "value": "AMSAR PRIVATE LIMITED", "portal_lab_id": "3100"}, {"label": "RMD RESEARCH AND DEVELOPMENT CENTER", "value": "RMD RESEARCH AND DEVELOPMENT CENTER", "portal_lab_id": "3108"}, {"label": "PARISHIL LABORATORIES PVT LTD", "value": "PARISHIL LABORATORIES PVT LTD", "portal_lab_id": "3193"}, {"label": "DEVANSH TESTING AND RESEARCH LABORATORY PVT LTD", "value": "DEVANSH TESTING AND RESEARCH LABORATORY PVT LTD", "portal_lab_id": "3540"}, {"label": "SREEVEEKA DRUG TESTING AND RESEARCH LAB", "value": "SREEVEEKA DRUG TESTING AND RESEARCH LAB", "portal_lab_id": "3596"}, {"label": "SELQUET TESTING AND RESEARCH LABORATORY PVT LTD", "value": "SELQUET TESTING AND RESEARCH LABORATORY PVT LTD", "portal_lab_id": "3619"}, {"label": "ANUSANDHAN ANALYTICAL AND BIOCHEMICAL RESEARCH LABORATORIES PVT LTD", "value": "ANUSANDHAN ANALYTICAL AND BIOCHEMICAL RESEARCH LABORATORIES PVT LTD", "portal_lab_id": "3662"}, {"label": "HARIDEV FORMULATIONS", "value": "HARIDEV FORMULATIONS", "portal_lab_id": "3980"}, {"label": "Multani Pharmaceuticals Limited Analytical Division", "value": "Multani Pharmaceuticals Limited Analytical Division", "portal_lab_id": "4135"}, {"label": "Centre for Advanced Research in Indian System of Medicine SASTRA Deemed University Thanjavur", "value": "Centre for Advanced Research in Indian System of Medicine SASTRA Deemed University Thanjavur", "portal_lab_id": "4303"}, {"label": "SHRIRAM INSTITUTE FOR INDUSTRIAL RESEARCH", "value": "SHRIRAM INSTITUTE FOR INDUSTRIAL RESEARCH", "portal_lab_id": "4755"}, {"label": "SHREE KRISHNA ANALYTICAL SERVICES", "value": "SHREE KRISHNA ANALYTICAL SERVICES", "portal_lab_id": "4949"}, {"label": "HUMONGOUS LABS (OPC) PVT. LTD.", "value": "HUMONGOUS LABS (OPC) PVT. LTD.", "portal_lab_id": "4965"}, {"label": "GREEN LAB ANALYSIS RESEARCH CENTRE PVT. LTD", "value": "GREEN LAB ANALYSIS RESEARCH CENTRE PVT. LTD", "portal_lab_id": "4997"}, {"label": "SHAGUN MEDI TESTING PVT. LTD.", "value": "SHAGUN MEDI TESTING PVT. LTD.", "portal_lab_id": "5609"}, {"label": "Amar Pharmaceuticals And Labs India Pvt Ltd", "value": "Amar Pharmaceuticals And Labs India Pvt Ltd", "portal_lab_id": "5788"}, {"label": "SRM Institute of Science and Technology", "value": "SRM Institute of Science and Technology", "portal_lab_id": "5821"}, {"label": "Sanskar Ayush Medicare Pvt. Ltd.", "value": "Sanskar Ayush Medicare Pvt. Ltd.", "portal_lab_id": "6041"}, {"label": "Vardan Envirolab LLP", "value": "Vardan Envirolab LLP", "portal_lab_id": "6111"}, {"label": "Vaidyaratnam P.S. Variers Arya Vaidya Sala, Kottakkal", "value": "Vaidyaratnam P.S. Variers Arya Vaidya Sala, Kottakkal", "portal_lab_id": "6257"}, {"label": "Tamilnadu Test House Private Limited", "value": "Tamilnadu Test House Private Limited", "portal_lab_id": "6274"}, {"label": "D N Laboratory", "value": "D N Laboratory", "portal_lab_id": "6276"}, {"label": "Interstellar Testing Centre Private Limited", "value": "Interstellar Testing Centre Private Limited", "portal_lab_id": "6356"}, {"label": "Sophisticated Industrial Materials Analytic Labs Pvt. Ltd.", "value": "Sophisticated Industrial Materials Analytic Labs Pvt. Ltd.", "portal_lab_id": "6365"}, {"label": "CATTS LABS AND RESEARCH PVT. LTD.", "value": "CATTS LABS AND RESEARCH PVT. LTD.", "portal_lab_id": "6446"}, {"label": "SANJEEV BIOMEDICAL RESEARCH CENTRE", "value": "SANJEEV BIOMEDICAL RESEARCH CENTRE", "portal_lab_id": "6492"}, {"label": "Delhi Analytical Research Laboratory", "value": "Delhi Analytical Research Laboratory", "portal_lab_id": "6581"}, {"label": "TIFAC CORE in Herbal Drugs JSS College of Pharmacy Ooty", "value": "TIFAC CORE in Herbal Drugs JSS College of Pharmacy Ooty", "portal_lab_id": "6643"}, {"label": "BIOTECHAYUR PRIVATE LIMITED ", "value": "BIOTECHAYUR PRIVATE LIMITED ", "portal_lab_id": "6697"}, {"label": "SATIATE RESEARCH AND ANATECH PVT LTD", "value": "SATIATE RESEARCH AND ANATECH PVT LTD", "portal_lab_id": "6789"}, {"label": "Cholayil Private Limited", "value": "Cholayil Private Limited", "portal_lab_id": "7215"}, {"label": "AGSS Analytical and Research Lab Pvt Ltd", "value": "AGSS Analytical and Research Lab Pvt Ltd", "portal_lab_id": "7232"}, {"label": "NAGARJUNA HERBAL CONCENTRATES LTD", "value": "NAGARJUNA HERBAL CONCENTRATES LTD", "portal_lab_id": "7683"}, {"label": "Eureka Analytical Services Pvt Ltd", "value": "Eureka Analytical Services Pvt Ltd", "portal_lab_id": "7929"}, {"label": "J.R.D. Tata Foundation for Research In Ayurved and Yoga Science Deendayal Research Institute Chitrkoot Satna", "value": "J.R.D. Tata Foundation for Research In Ayurved and Yoga Science Deendayal Research Institute Chitrkoot Satna", "portal_lab_id": "8601"}]}'::jsonb as p
), snap as (
  insert into regulatory.portal_vocabulary_snapshot
    (portal_code, domain_code, context_json, source_endpoint, captured_at, payload_json, payload_sha256, notes)
  select 'E_AUSHADHI', 'QC_LABORATORY',
    jsonb_build_object(
      'capture_id','2d2840d0-e708-4000-9096-18d8ccf7e4d3',
      'provenance','authenticated_live_portal_capture',
      'captured_at','2026-10-10T17:49:24.728Z',
      'source_route','/admin/addQCRegister',
      'source_control','DOM:select#lab_name',
      'option_source_endpoint','/admin/getLaboratroyName',
      'option_value_semantics','portal option value and SaveQCData labName = laboratory name (label); external_id = LaboratoryList portal id',
      'id_source','operator_supplied_getLaboratroyName_list',
      'capture_complete',true,
      'placeholder_excluded',true,
      'synthetic_other_excluded',true,
      'observed_actual_option_count',59,
      'id_list_count',59,
      'name_reconciliation','all 59 DOM names matched the 59 getLaboratroyName entries byte-exact'),
    'DOM:select#lab_name', '2026-10-10T17:49:24.728Z'::timestamptz, p,
    encode(extensions.digest(convert_to(p::text,'UTF8'),'sha256'),'hex'),
    'WP-07 C1b authenticated live QC laboratory dropdown capture with portal ids; reference vocabulary only, confers no Form-48 approval or laboratory mapping.'
  from payload
  returning id, payload_json
)
insert into regulatory.portal_option
  (portal_code, domain_code, external_id, label, snapshot_id, source_context, is_active, notes, parent_domain_code, parent_external_id)
select 'E_AUSHADHI', 'QC_LABORATORY', o->>'portal_lab_id', o->>'label', s.id,
  jsonb_build_object('capture_id','2d2840d0-e708-4000-9096-18d8ccf7e4d3','captured_at','2026-10-10T17:49:24.728Z','source_route','/admin/addQCRegister',
                     'source_control','DOM:select#lab_name','snapshot_id',s.id,'portal_value',o->>'value')
  || case when o->>'label'='HARIDEV FORMULATIONS'
          then jsonb_build_object('portal_address','DOOR NO VI/478 AND 482NELLAD PO, MUVATTUPUZHAMAZHUVANOORErnakulamKerala686669')
          else '{}'::jsonb end,
  true, 'WP-07 C1b QC laboratory capture; reference only', '', ''
from snap s cross join lateral jsonb_array_elements(s.payload_json->'options') o;

create function public.rpc_eaushadhi_qc_portal_laboratory_options_v1()
returns jsonb
language plpgsql stable security definer
set search_path = public, regulatory, pg_temp
as $$
begin
  perform public.rpc_eaushadhi_require_permission(false);
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'portal_option_id', o.id,
      'external_id', o.external_id,
      'label', o.label,
      'portal_value', o.source_context->>'portal_value')
      order by lower(btrim(o.label)), o.id), '[]'::jsonb)
    from regulatory.portal_option o
    where o.portal_code='E_AUSHADHI' and o.domain_code='QC_LABORATORY' and o.is_active=true
  );
end;
$$;

revoke all on function public.rpc_eaushadhi_qc_portal_laboratory_options_v1() from public, anon;

grant execute on function public.rpc_eaushadhi_qc_portal_laboratory_options_v1() to authenticated;

grant execute on function public.rpc_eaushadhi_qc_portal_laboratory_options_v1() to service_role;
