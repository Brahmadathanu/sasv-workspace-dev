do $$
declare n int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub','dff17104-c02a-4bca-95b1-e8ddff46a9b6','role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub','dff17104-c02a-4bca-95b1-e8ddff46a9b6', true);
  if auth.uid() is distinct from 'dff17104-c02a-4bca-95b1-e8ddff46a9b6'::uuid then raise exception 'identity not set'; end if;
  select count(*) into n from (
    select costing.rpc_accept_material_review_action(date '2026-10-01', q.stock_item_id, q.material_area, 'REVIEW_REQUIRED', q.recommended_ui_route,
      q.issue_codes, q.warning_codes, q.action_required_summary,
      'User-confirmed true rate, R4 decision 2026-10-17',
      case q.stock_item_id when 190 then 'Chayilyam 32000/kg = known future purchase rate' when 584 then 'Mathalam (F) manual 240 = known future purchase rate'
        when 837 then 'Rasam manual 35000 = known future purchase rate' when 293 then 'Gorochanam 1679125/kg true past purchase; future higher'
        when 538 then 'Kuzhiyaana 30; BOM qty 59 Nos confirmed correct' end)
    from costing.material_costing_action_queue_snapshot q
    where q.period_start='2026-10-01' and upper(q.material_area)='RM' and q.stock_item_id in (190,584,837,293,538) and q.action_severity='REVIEW_REQUIRED'
      and not exists (select 1 from costing.material_review_acceptance_register a where a.period_start=q.period_start and a.stock_item_id=q.stock_item_id and a.material_area=q.material_area and a.acceptance_status='ACTIVE')) z;
  if n<>5 then raise exception 'accepted % <> 5', n; end if;
end $$;
