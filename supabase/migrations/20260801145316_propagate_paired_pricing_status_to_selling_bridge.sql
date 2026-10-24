-- backfilled from live schema_migrations on 2026-10-24, CI-016
begin;

alter table costing.sku_selling_price_bridge_snapshot
    add column if not exists pricing_bridge_status_ik text,
    add column if not exists pricing_bridge_status_ok text,
    add column if not exists pricing_bridge_note_ik text,
    add column if not exists pricing_bridge_note_ok text,
    add column if not exists selling_price_bridge_status_ik text,
    add column if not exists selling_price_bridge_status_ok text,
    add column if not exists selling_price_bridge_note_ik text,
    add column if not exists selling_price_bridge_note_ok text;

do $patch$
declare
    v_oid oid;
    v_def text;
    v_anchor text := E'\n\n    return query';
    v_pos integer;
    v_injection text := E'\n\n    -- Regional status propagation from the exact Pricing Bridge tuple.\n    update costing.sku_selling_price_bridge_snapshot s\n    set\n        pricing_bridge_status_ik = pb.pricing_bridge_status_ik,\n        pricing_bridge_status_ok = pb.pricing_bridge_status_ok,\n        pricing_bridge_note_ik = pb.pricing_bridge_note_ik,\n        pricing_bridge_note_ok = pb.pricing_bridge_note_ok,\n\n        selling_price_bridge_status_ik = case\n            when pb.pricing_bridge_status_ik = ''BLOCKED'' then ''BLOCKED''\n            when s.policy_resolution_status in (''MISSING'', ''AMBIGUOUS'') then ''BLOCKED''\n            when s.gst_percent is null or s.gst_percent < 0 then ''BLOCKED''\n            when pb.pricing_bridge_status_ik = ''REVIEW_REQUIRED'' then ''REVIEW_REQUIRED''\n            else ''READY''\n        end,\n\n        selling_price_bridge_status_ok = case\n            when pb.pricing_bridge_status_ok = ''BLOCKED'' then ''BLOCKED''\n            when s.policy_resolution_status in (''MISSING'', ''AMBIGUOUS'') then ''BLOCKED''\n            when s.gst_percent is null or s.gst_percent < 0 then ''BLOCKED''\n            when pb.pricing_bridge_status_ok = ''REVIEW_REQUIRED'' then ''REVIEW_REQUIRED''\n            else ''READY''\n        end,\n\n        selling_price_bridge_note_ik = case\n            when pb.pricing_bridge_status_ik = ''BLOCKED'' then\n                ''IK selling price bridge is blocked because the IK Pricing Bridge is blocked.''\n            when s.policy_resolution_status = ''MISSING'' then\n                ''IK selling price bridge is blocked because no active selling-price policy is effective on the frozen valuation date.''\n            when s.policy_resolution_status = ''AMBIGUOUS'' then\n                ''IK selling price bridge is blocked because multiple active selling-price policies overlap on the frozen valuation date.''\n            when s.gst_percent is null then\n                ''IK selling price bridge is blocked because GST percentage is missing.''\n            when s.gst_percent < 0 then\n                ''IK selling price bridge is blocked because GST percentage is invalid.''\n            when pb.pricing_bridge_status_ik = ''REVIEW_REQUIRED'' then\n                ''IK selling price bridge is calculable but requires review because the IK Pricing Bridge requires review.''\n            else ''IK selling price bridge is ready.''\n        end,\n\n        selling_price_bridge_note_ok = case\n            when pb.pricing_bridge_status_ok = ''BLOCKED'' then\n                ''OK selling price bridge is blocked because the OK Pricing Bridge is blocked.''\n            when s.policy_resolution_status = ''MISSING'' then\n                ''OK selling price bridge is blocked because no active selling-price policy is effective on the frozen valuation date.''\n            when s.policy_resolution_status = ''AMBIGUOUS'' then\n                ''OK selling price bridge is blocked because multiple active selling-price policies overlap on the frozen valuation date.''\n            when s.gst_percent is null then\n                ''OK selling price bridge is blocked because GST percentage is missing.''\n            when s.gst_percent < 0 then\n                ''OK selling price bridge is blocked because GST percentage is invalid.''\n            when pb.pricing_bridge_status_ok = ''REVIEW_REQUIRED'' then\n                ''OK selling price bridge is calculable but requires review because the OK Pricing Bridge requires review.''\n            else ''OK selling price bridge is ready.''\n        end,\n\n        selling_price_bridge_status = case\n            when pb.pricing_bridge_status_ik = ''BLOCKED''\n              or pb.pricing_bridge_status_ok = ''BLOCKED''\n              or s.policy_resolution_status in (''MISSING'', ''AMBIGUOUS'')\n              or s.gst_percent is null\n              or s.gst_percent < 0\n                then ''BLOCKED''\n            when pb.pricing_bridge_status_ik = ''REVIEW_REQUIRED''\n              or pb.pricing_bridge_status_ok = ''REVIEW_REQUIRED''\n                then ''REVIEW_REQUIRED''\n            else ''READY''\n        end,\n\n        selling_price_bridge_note = case\n            when pb.pricing_bridge_status_ik = ''BLOCKED''\n              or pb.pricing_bridge_status_ok = ''BLOCKED'' then\n                ''Selling price bridge is blocked because at least one regional Pricing Bridge is blocked.''\n            when s.policy_resolution_status = ''MISSING'' then\n                ''Selling price bridge is blocked because no active selling-price policy is effective on the frozen valuation date.''\n            when s.policy_resolution_status = ''AMBIGUOUS'' then\n                ''Selling price bridge is blocked because multiple active selling-price policies overlap on the frozen valuation date.''\n            when s.gst_percent is null or s.gst_percent < 0 then\n                ''Selling price bridge is blocked because GST percentage is missing or invalid.''\n            when pb.pricing_bridge_status_ik = ''REVIEW_REQUIRED''\n              or pb.pricing_bridge_status_ok = ''REVIEW_REQUIRED'' then\n                ''Selling price bridge is calculable but requires review because at least one regional Pricing Bridge requires review.''\n            else ''Selling price bridge is ready for both IK and OK.''\n        end\n    from costing.sku_pricing_bridge_snapshot pb\n    where s.refresh_run_id = p_refresh_run_id\n      and pb.id = s.pricing_bridge_snapshot_id\n      and pb.refresh_run_id = s.refresh_run_id\n      and pb.sku_id = s.sku_id;';
begin
    select p.oid, pg_get_functiondef(p.oid)
    into v_oid, v_def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'costing'
      and p.proname = 'rpc_refresh_sku_selling_price_bridge_snapshot'
      and pg_get_function_identity_arguments(p.oid) =
          'p_period_start date, p_valuation_date date, p_refresh_run_id bigint';

    if v_oid is null then
        raise exception 'Exact Selling Price Bridge writer not found.';
    end if;

    if v_def like '%selling_price_bridge_status_ik = case%' then
        return;
    end if;

    v_pos := strpos(v_def, v_anchor);
    if v_pos = 0 then
        raise exception 'Selling Price Bridge return-query anchor not found.';
    end if;

    v_def := overlay(v_def placing v_injection from v_pos for 0);
    execute v_def;
end;
$patch$;

alter function costing.rpc_refresh_sku_selling_price_bridge_snapshot(date,date,bigint)
    owner to postgres;

revoke all on function costing.rpc_refresh_sku_selling_price_bridge_snapshot(date,date,bigint)
    from public, anon, authenticated, service_role;

grant execute on function costing.rpc_refresh_sku_selling_price_bridge_snapshot(date,date,bigint)
    to postgres;

comment on column costing.sku_selling_price_bridge_snapshot.selling_price_bridge_status_ik is
'Canonical IK selling-price readiness derived from the exact paired IK Pricing Bridge and the frozen selling-price policy.';
comment on column costing.sku_selling_price_bridge_snapshot.selling_price_bridge_status_ok is
'Canonical OK selling-price readiness derived from the exact paired OK Pricing Bridge and the frozen selling-price policy.';

commit;