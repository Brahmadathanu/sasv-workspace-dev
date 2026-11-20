-- WP-07 UX-1.2: worklist returns the canonical classification hierarchy (NOT applied; prepared 25 Oct 2026).
-- products.sub_group_id -> sub_groups -> product_groups -> sub_categories -> categories.
-- Adds output columns category_name, subcategory_name, group_name, sub_group_name, source_sheet (old sheet tab name).
-- family now = group_name (fallback to old logic); medicine_class = dossier class, else subcategory_name.
-- All earlier columns, order, queues, role gating (rpc_eaushadhi_require_permission(false)), SECURITY DEFINER,
-- search_path and grants unchanged. Read-only function; no data writes, no table changes.
-- The return type changes (new columns), so CREATE OR REPLACE alone is refused by Postgres (42P13):
-- drop and recreate; the migration runner wraps the file in one transaction (apply only via apply_migration or db push). No other object depends on this function (checked pre-apply).
do $pre$ begin
  if md5(pg_get_functiondef('public.rpc_eaushadhi_worklist_v1()'::regprocedure)) <> '5ccaaaad7e23421c32c8ab2b789fbd6e'
  then raise exception 'UX1.2 preflight: live worklist function differs from the audited version'; end if;
end $pre$;
drop function public.rpc_eaushadhi_worklist_v1();
CREATE OR REPLACE FUNCTION public.rpc_eaushadhi_worklist_v1()
 RETURNS TABLE(product_id integer, product_name text, family text, medicine_class text, queue text, stage_overview text, stage_details text, stage_composition text, stage_actions text, stage_qc text, stage_evidence text, stage_readiness text, stage_portal text, stages_done integer, next_action text, next_stage text, blocking_reason text, composition_lines integer, composition_verified integer, open_issues integer, therapeutic_links integer, last_changed_at timestamp with time zone, last_changed_by uuid, category_name text, subcategory_name text, group_name text, sub_group_name text, source_sheet text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'regulatory', 'pg_temp'
AS $function$
begin
  perform public.rpc_eaushadhi_require_permission(false);
  return query
  with d as (
    select pd.product_id, coalesce(nullif(btrim(pd.portal_product_name),''), p.item) as pname, p.item,
           df.label as dosage_label, mc.label as mclass, pd.dossier_status, pd.updated_at, pd.updated_by,
           c.category_name as h_cat, sc.subcategory_name as h_subcat, pg.group_name as h_group, sg.sub_group_name as h_subgroup
      from regulatory.product_dossier pd
      join public.products p on p.id=pd.product_id
      left join public.sub_groups sg on sg.id=p.sub_group_id
      left join public.product_groups pg on pg.id=sg.product_group_id
      left join public.sub_categories sc on sc.id=pg.sub_category_id
      left join public.categories c on c.id=sc.category_id
      left join regulatory.controlled_term df on df.id=pd.dosage_form_term_id
      left join regulatory.controlled_term mc on mc.id=pd.medicine_class_term_id
     where pd.scope_decision='IN_SCOPE'),
  src as (select r.product_id, true as matched from regulatory.source_product_resolution r
           where r.resolution_status='VERIFIED' group by r.product_id),
  scl as (select s.matched_product_id as product_id, count(*)::int n,
                 min(regexp_replace(si.file_name,'^PROD ING - ','')) filter (where si.file_name like 'PROD ING - %') fam
            from regulatory.source_composition_line s join regulatory.source_import si on si.id=s.source_import_id
           where s.match_status='AUTO_MATCHED' and s.matched_product_id is not null group by 1),
  lr as (select l.product_id, count(*)::int n, count(*) filter (where l.review_status='VERIFIED')::int v,
                count(*) filter (where l.review_status='IN_REVIEW')::int ir, max(l.updated_at) ts
           from regulatory.eaushadhi_line_review l group by 1),
  ri as (select i.product_id, count(*)::int n from regulatory.reconciliation_issue i where i.status='OPEN' group by 1),
  tg as (select t.product_id, count(*)::int n from public.product_therapeutic_indication t group by 1),
  ar as (select a.product_id, count(*)::int n, count(*) filter (where a.review_status='VERIFIED')::int v,
                count(*) filter (where a.review_status='IN_REVIEW')::int ir from regulatory.eaushadhi_product_action_review a group by 1),
  qp as (select q.product_id, max(q.preparation_status) st, bool_or(exists(select 1 from regulatory.eaushadhi_qc_evidence_binding b
                where b.preparation_id=q.preparation_id)) has_ev from regulatory.eaushadhi_qc_preparation q group by 1),
  qr as (select r.product_id, bool_or(r.run_status='SAVE_CONFIRMED') confirmed from regulatory.eaushadhi_qc_prep_run r group by 1),
  s as (
    select d.*, w.review_status wf_rs, w.entry_status wf_es, w.updated_at wf_ts, w.updated_by wf_by,
           pr.review_status pr_rs, pc.review_status pc_rs, cs.stage_status cs_st,
           coalesce(scl.n,0) scl_n, scl.fam, coalesce(lr.n,0) lr_n, coalesce(lr.v,0) lr_v, coalesce(lr.ir,0) lr_ir,
           coalesce(ri.n,0) ri_n, coalesce(tg.n,0) tg_n, coalesce(ar.n,0) ar_n, coalesce(ar.v,0) ar_v, coalesce(ar.ir,0) ar_ir,
           qp.st qp_st, coalesce(qp.has_ev,false) has_ev, coalesce(qr.confirmed,false) qc_saved,
           coalesce(src.matched,false) or coalesce(scl.n,0)>0 has_src
      from d
      left join regulatory.eaushadhi_product_workflow w on w.product_id=d.product_id
      left join regulatory.eaushadhi_product_review pr on pr.product_id=d.product_id
      left join regulatory.eaushadhi_product_classification_review pc on pc.product_id=d.product_id
      left join regulatory.eaushadhi_composition_stage cs on cs.product_id=d.product_id
      left join src on src.product_id=d.product_id left join scl on scl.product_id=d.product_id
      left join lr on lr.product_id=d.product_id left join ri on ri.product_id=d.product_id
      left join tg on tg.product_id=d.product_id left join ar on ar.product_id=d.product_id
      left join qp on qp.product_id=d.product_id left join qr on qr.product_id=d.product_id),
  st as (
    select s.*,
      case when s.dossier_status='BLOCKED' then 'NEEDS_FIX' when not s.has_src then 'NO_DATA'
           when s.wf_rs is null then 'TODO' else 'DONE' end ov,
      case when s.pr_rs is null then 'NOT_STARTED' when s.pr_rs='VERIFIED' and s.pc_rs='VERIFIED' then 'DONE'
           when s.pr_rs='IN_REVIEW' or s.pc_rs='IN_REVIEW' then 'IN_REVIEW' else 'TODO' end dt,
      case when s.cs_st='PORTAL_VERIFIED' or (s.lr_n>0 and s.lr_v=s.lr_n) then 'DONE' when s.ri_n>0 then 'NEEDS_FIX'
           when s.lr_n=0 and s.scl_n=0 then 'NO_DATA' when s.lr_n=0 then 'NOT_STARTED'
           when s.lr_ir>0 then 'IN_REVIEW' else 'TODO' end cp,
      case when s.ar_n>0 and s.ar_v=s.ar_n then 'DONE' when s.ar_ir>0 then 'IN_REVIEW' when s.ar_n>0 then 'TODO'
           when s.tg_n>0 then 'NOT_STARTED' else 'NO_DATA' end ac,
      case when s.qp_st='VERIFIED' then 'DONE' when s.qp_st is null then 'NO_DATA' else 'TODO' end qc,
      case when s.has_ev then 'DONE' when s.qp_st is null then 'NO_DATA' else 'TODO' end ev
    from s),
  st2 as (
    select st.*,
      case when st.dt='DONE' and st.cp='DONE' and st.ac='DONE' and st.qc='DONE' and st.ev='DONE' then 'DONE' else 'NOT_STARTED' end rd,
      case when st.wf_es='PORTAL_VERIFIED' and st.cs_st='PORTAL_VERIFIED' and st.qc_saved then 'DONE'
           when st.wf_es='PORTAL_VERIFIED' or st.cs_st='PORTAL_VERIFIED' or st.qc_saved then 'IN_REVIEW' else 'NOT_STARTED' end pt
    from st)
  select x.product_id, x.pname, coalesce(x.h_group, initcap(x.fam), x.dosage_label, 'Unassigned'), coalesce(x.mclass, x.h_subcat),
    case when x.pt='DONE' then 'DONE'
         when x.ov='NEEDS_FIX' or x.cp='NEEDS_FIX' then 'NEEDS_FIX'
         when x.ov='NO_DATA' then 'NEEDS_DATA'
         when x.rd='DONE' then 'READY_FOR_PORTAL'
         when 'IN_REVIEW' in (x.dt,x.cp,x.ac) then 'AWAITING_APPROVAL'
         else 'TO_VERIFY' end,
    x.ov, x.dt, x.cp, x.ac, x.qc, x.ev, x.rd, x.pt,
    ((x.ov='DONE')::int+(x.dt='DONE')::int+(x.cp='DONE')::int+(x.ac='DONE')::int+(x.qc='DONE')::int
      +(x.ev='DONE')::int+(x.rd='DONE')::int+(x.pt='DONE')::int),
    case when x.pt='DONE' then 'View'
         when x.ov='NEEDS_FIX' then 'Fix product record'
         when x.ov='NO_DATA' then 'Add sheet data'
         when x.ov='TODO' then 'Start verification'
         when x.dt<>'DONE' then case when x.dt='IN_REVIEW' then 'Approve details' else 'Verify details' end
         when x.cp='NEEDS_FIX' then 'Fix composition issues'
         when x.cp<>'DONE' then case when x.cp='IN_REVIEW' then 'Approve composition' else 'Verify composition' end
         when x.ac<>'DONE' then case when x.ac='IN_REVIEW' then 'Approve actions' else 'Verify actions' end
         when x.qc='NO_DATA' then 'Wait for QC report'
         when x.qc<>'DONE' then 'Verify QC values'
         when x.ev<>'DONE' then 'Upload report'
         else 'Fill portal' end,
    case when x.pt='DONE' then 'overview' when x.ov<>'DONE' then 'overview' when x.dt<>'DONE' then 'details'
         when x.cp<>'DONE' then 'composition' when x.ac<>'DONE' then 'actions' when x.qc<>'DONE' then 'qc'
         when x.ev<>'DONE' then 'evidence' else 'portal' end,
    case when x.pt='DONE' then null
         when x.dossier_status='BLOCKED' then 'This product is blocked in the product register. Ask the approver.'
         when x.ov='NO_DATA' then 'No sheet data is linked to this product yet.'
         when x.ov='TODO' then 'Sheet data is linked, but verification has not been started.'
         when x.cp='NEEDS_FIX' then x.ri_n||' composition issue(s) need fixing (for example a missing part used or quantity).'
         when x.cp='NO_DATA' then 'No ingredient lines are linked to this product yet.'
         when x.ac='NO_DATA' then 'No therapeutic data is linked to this product yet.'
         when x.qc='NO_DATA' then 'The QC test report has not been added yet.'
         else null end,
    x.scl_n, x.lr_v, x.ri_n, x.tg_n,
    greatest(x.updated_at, x.wf_ts), coalesce(x.wf_by, x.updated_by),
    x.h_cat, x.h_subcat, x.h_group, x.h_subgroup, initcap(x.fam)
  from st2 x
  order by x.pname;
end
$function$;
revoke all on function public.rpc_eaushadhi_worklist_v1() from public, anon;
grant execute on function public.rpc_eaushadhi_worklist_v1() to authenticated, service_role;
