do $$
declare n int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub','dff17104-c02a-4bca-95b1-e8ddff46a9b6','role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub','dff17104-c02a-4bca-95b1-e8ddff46a9b6', true);
  if auth.uid() is distinct from 'dff17104-c02a-4bca-95b1-e8ddff46a9b6'::uuid then raise exception 'identity not set'; end if;
  select count(*) into n from (
    select costing.rpc_accept_material_review_action(date '2026-10-01', q.stock_item_id, q.material_area, 'REVIEW_REQUIRED', q.recommended_ui_route,
      q.issue_codes, q.warning_codes, q.action_required_summary, 'User confirmed BOM correct 2026-10-17', 'SRM002 11.25 g per 5 g (48% loss intended); Nandukkal 5.85 g per 5 g')
    from (values ('RM',880),('RM',649)) v(a,i)
    join costing.material_costing_action_queue_snapshot q on q.period_start='2026-10-01' and upper(q.material_area)=v.a and q.stock_item_id=v.i and q.action_severity='REVIEW_REQUIRED'
    where not exists (select 1 from costing.material_review_acceptance_register x where x.period_start=q.period_start and x.stock_item_id=q.stock_item_id and x.material_area=q.material_area and x.acceptance_status='ACTIVE')) z;
  if n<>2 then raise exception 'accepted % <> 2', n; end if;
end $$;
