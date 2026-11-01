-- WP-07 UX-1 server part (APPLIED as wp07_ux1_roles_worklist). Roles, my-roles, grant/revoke, worklist RPC, seeds.
-- Adds: data-driven role grants (VERIFIER / APPROVER), "my roles" RPC, role grant/revoke RPC (four-eyes: nobody grants
-- themselves), and a read-only worklist RPC (one row per IN_SCOPE dossier product, all stages, queue, next action,
-- plain-language blocking reason). No data changes, no changes to existing RPCs/tables, no portal actions.
-- Four-eyes enforcement on existing approval paths is proposed SEPARATELY in UX1_FOUR_EYES.sql (riskier).

do $pre$
begin
  if to_regclass('regulatory.eaushadhi_qc_prep_run') is null then raise exception 'UX1 preflight: B5 missing'; end if;
  if to_regprocedure('public.rpc_eaushadhi_require_permission(boolean)') is null then raise exception 'UX1 preflight: permission helper missing'; end if;
  if to_regclass('regulatory.eaushadhi_role_grant') is not null then raise exception 'UX1 preflight: already applied'; end if;
end
$pre$;

-- 1. Role grants (append-style: revoke = set active false with who/when; never delete)
create table regulatory.eaushadhi_role_grant (
  grant_id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  role text not null check (role in ('VERIFIER','APPROVER')),
  active boolean not null default true,
  note text check (note is null or length(btrim(note)) between 3 and 500),
  granted_by uuid,                       -- null only for the seeded bootstrap owner row
  granted_at timestamptz not null default now(),
  revoked_by uuid,
  revoked_at timestamptz,
  constraint role_grant_revoke_ck check (active = (revoked_at is null) and (revoked_at is null) = (revoked_by is null)),
  constraint role_grant_not_self_ck check (granted_by is null or granted_by <> user_id)
);
create unique index eaushadhi_role_grant_active_uk on regulatory.eaushadhi_role_grant(user_id, role) where active;

do $sec$
begin
  alter table regulatory.eaushadhi_role_grant enable row level security;
  revoke all on table regulatory.eaushadhi_role_grant from public, anon, authenticated;
  create trigger eaushadhi_role_grant_no_delete before delete or truncate on regulatory.eaushadhi_role_grant
    for each statement execute function regulatory.eaushadhi_qc_evidence_binding_immutable();
end
$sec$;

-- 2. Internal helper
create function regulatory.eaushadhi_has_role_v1(p_user uuid, p_role text) returns boolean
language sql stable security definer set search_path to 'public','regulatory','pg_temp' as $f$
  select p_user is not null and exists(select 1 from regulatory.eaushadhi_role_grant g
    where g.user_id=p_user and g.role=p_role and g.active);
$f$;
revoke all on function regulatory.eaushadhi_has_role_v1(uuid,text) from public, anon, authenticated;
grant execute on function regulatory.eaushadhi_has_role_v1(uuid,text) to service_role;

-- 3. My roles
create function public.rpc_eaushadhi_my_roles_v1() returns jsonb
language plpgsql stable security definer set search_path to 'public','regulatory','pg_temp' as $f$
declare v_user uuid := public.rpc_eaushadhi_require_permission(false);
begin
  return jsonb_build_object(
    'user_id', v_user,
    'is_verifier', regulatory.eaushadhi_has_role_v1(v_user,'VERIFIER'),
    'is_approver', regulatory.eaushadhi_has_role_v1(v_user,'APPROVER'),
    'can_edit', exists(select 1 from public.user_permissions_canonical up where up.user_id=v_user
                       and up.target='module:e-aushadhi-automation' and up.can_edit));
end
$f$;
revoke all on function public.rpc_eaushadhi_my_roles_v1() from public, anon;
grant execute on function public.rpc_eaushadhi_my_roles_v1() to authenticated, service_role;

-- 4. Grant / revoke (approver only; never for oneself)
create function public.rpc_eaushadhi_role_grant_set_v1(p_user_id uuid, p_role text, p_active boolean, p_note text)
returns jsonb language plpgsql security definer set search_path to 'public','regulatory','pg_temp' as $f$
declare v_actor uuid := public.rpc_eaushadhi_require_permission(true); v_id bigint;
begin
  if not regulatory.eaushadhi_has_role_v1(v_actor,'APPROVER') then
    raise exception using errcode='42501', message='APPROVER_ROLE_REQUIRED'; end if;
  if p_user_id is null or p_role not in ('VERIFIER','APPROVER') or p_active is null then
    raise exception using errcode='22023', message='User, role and active flag required'; end if;
  if p_user_id = v_actor then raise exception using errcode='42501', message='SELF_GRANT_NOT_ALLOWED'; end if;
  if p_active then
    insert into regulatory.eaushadhi_role_grant(user_id, role, note, granted_by)
    values (p_user_id, p_role, nullif(btrim(p_note),''), v_actor)
    on conflict (user_id, role) where active do nothing returning grant_id into v_id;
  else
    update regulatory.eaushadhi_role_grant set active=false, revoked_by=v_actor, revoked_at=now()
     where user_id=p_user_id and role=p_role and active returning grant_id into v_id;
  end if;
  return jsonb_build_object('ok', true, 'changed', v_id is not null, 'grant_id', v_id);
end
$f$;
revoke all on function public.rpc_eaushadhi_role_grant_set_v1(uuid,text,boolean,text) from public, anon;
grant execute on function public.rpc_eaushadhi_role_grant_set_v1(uuid,text,boolean,text) to authenticated, service_role;

-- 5. Worklist (read-only). Stage status vocabulary: DONE | IN_REVIEW | TODO | NEEDS_FIX | NO_DATA | NOT_STARTED
--    Queue: DONE | READY_FOR_PORTAL | AWAITING_APPROVAL | NEEDS_FIX | NEEDS_DATA | TO_VERIFY
create function public.rpc_eaushadhi_worklist_v1()
returns table(product_id integer, product_name text, family text, medicine_class text, queue text,
              stage_overview text, stage_details text, stage_composition text, stage_actions text,
              stage_qc text, stage_evidence text, stage_readiness text, stage_portal text,
              stages_done integer, next_action text, next_stage text, blocking_reason text,
              composition_lines integer, composition_verified integer, open_issues integer,
              therapeutic_links integer, last_changed_at timestamptz, last_changed_by uuid)
language plpgsql stable security definer set search_path to 'public','regulatory','pg_temp' as $f$
begin
  perform public.rpc_eaushadhi_require_permission(false);
  return query
  with d as (
    select pd.product_id, coalesce(nullif(btrim(pd.portal_product_name),''), p.item) as pname, p.item,
           df.label as dosage_label, mc.label as mclass, pd.dossier_status, pd.updated_at, pd.updated_by
      from regulatory.product_dossier pd
      join public.products p on p.id=pd.product_id
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
  select x.product_id, x.pname, coalesce(initcap(x.fam), x.dosage_label, 'Unassigned'), x.mclass,
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
    greatest(x.updated_at, x.wf_ts), coalesce(x.wf_by, x.updated_by)
  from st2 x
  order by x.pname;
end
$f$;
revoke all on function public.rpc_eaushadhi_worklist_v1() from public, anon;
grant execute on function public.rpc_eaushadhi_worklist_v1() to authenticated, service_role;

-- 6. Seeds (approved by Dr. Brahmadathan U, 24 Oct 2026 17:20 IST: both users VERIFIER + APPROVER).
--    Owner rows are the bootstrap (granted_by null = system seed); colleague rows granted by the owner.
insert into regulatory.eaushadhi_role_grant(user_id, role, note, granted_by) values
  ('dff17104-c02a-4bca-95b1-e8ddff46a9b6','VERIFIER','SYSTEM_SEED owner bootstrap (drbrahmadathanu@gmail.com)', null),
  ('dff17104-c02a-4bca-95b1-e8ddff46a9b6','APPROVER','SYSTEM_SEED owner bootstrap (drbrahmadathanu@gmail.com)', null),
  ('b8fd6239-cc4b-4123-87d0-0a89fc2c84bd','VERIFIER','SYSTEM_SEED colleague (draneeshsiddha72@gmail.com)','dff17104-c02a-4bca-95b1-e8ddff46a9b6'),
  ('b8fd6239-cc4b-4123-87d0-0a89fc2c84bd','APPROVER','SYSTEM_SEED colleague (draneeshsiddha72@gmail.com)','dff17104-c02a-4bca-95b1-e8ddff46a9b6');
