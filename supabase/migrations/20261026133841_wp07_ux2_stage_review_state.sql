-- WP-07 UX-2 stage review state (DRAFT 2026-10-26 IST, NOT APPLIED, rollback-tested 2026-10-26 19:2x IST).
-- One additive read-only RPC. Tells the screen, per stage of one product, who last saved it for review
-- (the person the four-eyes trigger will compare against: OLD.updated_by) and when, with a display name
-- from public.profiles.full_name (present for all 4 active role holders on 2026-10-26).
-- No table, trigger, or existing function is changed.

create or replace function public.rpc_eaushadhi_stage_review_state_v1(p_product_id integer)
returns table(stage text, item_key text, review_status text, saved_by uuid, saved_by_name text,
              saved_at timestamptz, saved_by_me boolean, can_approve boolean, block_code text)
language sql stable security definer set search_path to 'public','regulatory','pg_temp' as $f$
  with me as (
    select auth.uid() uid,
           coalesce(regulatory.eaushadhi_has_role_v1(auth.uid(),'APPROVER'), false) is_approver
    where auth.uid() is not null
      and exists(select 1 from public.user_permissions_canonical up
                 where up.user_id=auth.uid() and up.target='module:e-aushadhi-automation'
                   and (up.can_view or up.can_edit))
  ), s as (
    select 'details'::text stage, null::text item_key, pr.review_status, pr.updated_by, pr.updated_at
      from regulatory.eaushadhi_product_review pr where pr.product_id=p_product_id
    union all
    select 'classification', null, c.review_status, c.updated_by, c.updated_at
      from regulatory.eaushadhi_product_classification_review c where c.product_id=p_product_id
    union all
    select 'line', l.source_composition_line_id::text, l.review_status, l.updated_by, l.updated_at
      from regulatory.eaushadhi_line_review l where l.product_id=p_product_id
    union all
    -- actions are saved as a set; one actor pair for the set (latest row wins)
    select 'actions', null, a.review_status, a.updated_by, a.updated_at
      from (select distinct on (product_id) * from regulatory.eaushadhi_product_action_review
            where product_id=p_product_id order by product_id, updated_at desc nulls last, sequence_no) a
    union all
    select 'qc', q.preparation_id::text, q.preparation_status, q.updated_by, q.updated_at
      from regulatory.eaushadhi_qc_preparation q where q.product_id=p_product_id
  )
  select s.stage, s.item_key, s.review_status, s.updated_by, p.full_name, s.updated_at,
         coalesce(s.updated_by = me.uid, false),
         (s.review_status <> 'VERIFIED' and me.is_approver and s.updated_by is not null and s.updated_by <> me.uid),
         case when s.review_status = 'VERIFIED' then null
              when not me.is_approver then 'APPROVER_ROLE_REQUIRED'
              when s.updated_by is null then 'FOUR_EYES_NOT_SAVED_FOR_REVIEW'
              when s.updated_by = me.uid then 'FOUR_EYES_SAME_PERSON' end
  from s cross join me
  left join public.profiles p on p.id = s.updated_by;
$f$;

revoke all on function public.rpc_eaushadhi_stage_review_state_v1(integer) from public, anon;
grant execute on function public.rpc_eaushadhi_stage_review_state_v1(integer) to authenticated;
