-- Costing Scheme Master register: replace the three correlated viability subqueries by ONE per-scheme LATERAL aggregate (issue #211 B, review PR #213).
-- PREPARED, NOT APPLIED. When applied to live Supabase, change this line to "Applied to live Supabase as migration <version>" in a follow-up commit.
-- Source: reviewed candidate docs/master-data-costing/scheme-master-perf-candidate/scheme_master_register_viability_lateral.candidate.sql at commit
--   e73e9e2bd716c7e01ae7fef05b31797a615abe7f (PR #213). The statement below is that candidate's DO block, BYTE FOR BYTE (sha256 pinned in the migration test).
-- Live pre-change fingerprint (captured independently by the reviewer): md5(pg_get_viewdef('public.v_costing_scheme_master_register'::regclass, true)) = a9f6a128427a704e9bea97fc01e7b5f3.
-- Atomic and fail closed: ONE DO statement = one transaction under any runner. It verifies the exact pre-change definition (34 column names in order, reloptions exactly
--   {security_invoker=true}, the fingerprint above, permission gate, 3 viability references), executes the CREATE OR REPLACE VIEW, then verifies the post-conditions
--   (same column names and types, reloptions, ACL; gate present; one lateral viability reference). Any failure raises and rolls everything back.
-- Unchanged: security_invoker=true, fn_costing_view_allowed() gate, the 34-column contract, grants (CREATE OR REPLACE VIEW keeps them), indexes, RLS, client code, flags.
-- Measured live (read-only, issue #211): warm 231.433 ms -> 124.916 ms, shared hits 206,906 -> 102,883; all 34 columns / 7 rows identical.
-- Rollback (recovery only, not a forward migration): supabase/rollback-evidence/20261108132312_costing_scheme_master_register_viability_lateral_pre.sql
-- Runbook and read-only pre/post verification: docs/master-data-costing/scheme-master-register-migration/
do $apply$
declare
  c_view constant regclass := 'public.v_costing_scheme_master_register'::regclass;
  c_expected_md5 constant text := 'a9f6a128427a704e9bea97fc01e7b5f3';
  c_expected_cols constant text[] := array['scheme_id', 'scheme_name', 'paid_qty', 'free_qty', 'total_qty', 'free_per_paid_ratio', 'effective_free_discount_percent', 'is_active', 'is_system_defined', 'remarks', 'approval_reference', 'direct_policy_count', 'active_direct_policy_count', 'hierarchy_rule_count', 'active_hierarchy_rule_count', 'replacement_reference_count', 'active_replacement_reference_count', 'viability_snapshot_count', 'viability_snapshot_period_count', 'latest_viability_snapshot_period', 'can_edit_metadata', 'can_deactivate', 'can_reactivate', 'created_at', 'created_by', 'updated_at', 'updated_by', 'metadata_update_reason', 'deactivated_at', 'deactivated_by', 'deactivation_reason', 'reactivated_at', 'reactivated_by', 'reactivation_reason'];
  v_cols text[]; v_types text[]; v_opts text[]; v_acl text; v_def text;
  v_cols2 text[]; v_types2 text[]; v_opts2 text[]; v_acl2 text; v_def2 text;
begin
  if c_expected_md5 !~ '^[0-9a-f]{32}$' then
    raise exception 'scheme-master candidate: pre-change definition fingerprint is not recorded (expected_pre_change_viewdef.md5); refusing to run';
  end if;
  select array_agg(a.attname::text order by a.attnum), array_agg(format_type(a.atttypid, a.atttypmod) order by a.attnum) into v_cols, v_types
    from pg_attribute a where a.attrelid = c_view and a.attnum > 0 and not a.attisdropped;
  select c.reloptions, c.relacl::text into v_opts, v_acl from pg_class c where c.oid = c_view;
  v_def := pg_get_viewdef(c_view, true);
  if v_cols is distinct from c_expected_cols then raise exception 'scheme-master candidate precondition: output columns differ from the reviewed 34-column contract'; end if;
  if v_opts is distinct from array['security_invoker=true']::text[] then raise exception 'scheme-master candidate precondition: reloptions must be exactly {security_invoker=true}, found %', v_opts; end if;
  if md5(v_def) <> c_expected_md5 then raise exception 'scheme-master candidate precondition: live definition differs from the reviewed pre-change definition (md5 %, expected %)', md5(v_def), c_expected_md5; end if;
  if v_def !~ 'fn_costing_view_allowed' then raise exception 'scheme-master candidate precondition: permission gate missing'; end if;
  if (select count(*) from regexp_matches(v_def, 'sku_scheme_viability_snapshot', 'g')) <> 3 then raise exception 'scheme-master candidate precondition: expected exactly 3 viability snapshot references (pre-change shape)'; end if;

  execute $view$
create or replace view public.v_costing_scheme_master_register with (security_invoker=true) as
select q.* from (
SELECT id AS scheme_id,
    scheme_name,
    paid_qty,
    free_qty,
    (paid_qty + free_qty) AS total_qty,
        CASE
            WHEN (paid_qty > (0)::numeric) THEN (free_qty / paid_qty)
            ELSE NULL::numeric
        END AS free_per_paid_ratio,
        CASE
            WHEN ((paid_qty + free_qty) > (0)::numeric) THEN ((free_qty / (paid_qty + free_qty)) * (100)::numeric)
            ELSE NULL::numeric
        END AS effective_free_discount_percent,
    is_active,
    is_system_defined,
    remarks,
    approval_reference,
    ( SELECT count(*) AS count
           FROM costing.sku_scheme_policy p
          WHERE (p.scheme_id = sm.id)) AS direct_policy_count,
    ( SELECT count(*) AS count
           FROM costing.sku_scheme_policy p
          WHERE ((p.scheme_id = sm.id) AND (p.is_active = true))) AS active_direct_policy_count,
    ( SELECT count(*) AS count
           FROM costing.scheme_policy_rules r
          WHERE (r.scheme_id = sm.id)) AS hierarchy_rule_count,
    ( SELECT count(*) AS count
           FROM costing.scheme_policy_rules r
          WHERE ((r.scheme_id = sm.id) AND (r.is_active = true))) AS active_hierarchy_rule_count,
    ( SELECT count(*) AS count
           FROM costing.scheme_policy_rules r
          WHERE (r.replace_from_scheme_id = sm.id)) AS replacement_reference_count,
    ( SELECT count(*) AS count
           FROM costing.scheme_policy_rules r
          WHERE ((r.replace_from_scheme_id = sm.id) AND (r.is_active = true))) AS active_replacement_reference_count,
    viab.vs_snapshot_count AS viability_snapshot_count,
    viab.vs_period_count AS viability_snapshot_period_count,
    viab.vs_latest_period AS latest_viability_snapshot_period,
    (NOT is_system_defined) AS can_edit_metadata,
    (is_active AND (NOT is_system_defined) AND (NOT (EXISTS ( SELECT 1
           FROM costing.sku_scheme_policy p
          WHERE ((p.scheme_id = sm.id) AND (p.is_active = true))))) AND (NOT (EXISTS ( SELECT 1
           FROM costing.scheme_policy_rules r
          WHERE ((r.scheme_id = sm.id) AND (r.is_active = true))))) AND (NOT (EXISTS ( SELECT 1
           FROM costing.scheme_policy_rules r
          WHERE ((r.replace_from_scheme_id = sm.id) AND (r.is_active = true)))))) AS can_deactivate,
    ((NOT is_active) AND (NOT is_system_defined)) AS can_reactivate,
    created_at,
    created_by,
    updated_at,
    updated_by,
    metadata_update_reason,
    deactivated_at,
    deactivated_by,
    deactivation_reason,
    reactivated_at,
    reactivated_by,
    reactivation_reason
   FROM costing.scheme_master sm
   LEFT JOIN LATERAL (
     SELECT count(*) AS vs_snapshot_count,
            count(DISTINCT s.period_start) AS vs_period_count,
            max(s.period_start) AS vs_latest_period
       FROM costing.sku_scheme_viability_snapshot s
      WHERE s.scheme_id = sm.id
   ) viab ON true
) q
where (select public.fn_costing_view_allowed());
$view$;

  select array_agg(a.attname::text order by a.attnum), array_agg(format_type(a.atttypid, a.atttypmod) order by a.attnum) into v_cols2, v_types2
    from pg_attribute a where a.attrelid = c_view and a.attnum > 0 and not a.attisdropped;
  select c.reloptions, c.relacl::text into v_opts2, v_acl2 from pg_class c where c.oid = c_view;
  v_def2 := pg_get_viewdef(c_view, true);
  if v_cols2 is distinct from v_cols or v_types2 is distinct from v_types then raise exception 'scheme-master candidate postcondition: column names or types changed'; end if;
  if v_opts2 is distinct from v_opts then raise exception 'scheme-master candidate postcondition: reloptions changed'; end if;
  if v_acl2 is distinct from v_acl then raise exception 'scheme-master candidate postcondition: ACL changed'; end if;
  if v_def2 !~ 'fn_costing_view_allowed' then raise exception 'scheme-master candidate postcondition: permission gate missing'; end if;
  if (select count(*) from regexp_matches(v_def2, 'sku_scheme_viability_snapshot', 'g')) <> 1 or v_def2 !~* 'LATERAL' then raise exception 'scheme-master candidate postcondition: expected one lateral viability aggregate'; end if;
end
$apply$;
