import json
P='/workspace/sasv/docs/costing-pipeline-independent-audit/closure/prepared/'
L=json.load(open('/workspace/ci037/live.json')); L3=json.load(open('/workspace/ci037/live3.json'))
chain=L['chain']; vorig=L['view'].strip().rstrip(';')
# ---------- snapshots ----------
open(P+'CI-037_snapshot_chain_function_pre.sql','w').write("-- Live text of costing.rpc_refresh_manufacturing_cop_chain(date,date,bigint), captured read-only 24 Oct 2026 ~21:45 IST (pg_get_functiondef). Owner postgres, proacl {postgres=X/postgres}.\n"+chain+";\n")
open(P+'CI-037_snapshot_approved_master_view_pre.sql','w').write("-- Live text of costing.v_price_revision_current_approved_master, captured read-only 24 Oct 2026 (pg_get_viewdef). 64 columns. Owner postgres.\ncreate view costing.v_price_revision_current_approved_master as\n"+vorig+";\n")
meta={k:L[k] for k in ['ncols','owner','relacl','reloptions','privs','view_comment','col_comments','dependents','func_refs','chain_privs','designations']}
meta['note']="relacl NULL = owner default privileges only; effective privileges captured explicitly via has_table_privilege (anon/authenticated/service_role all false; postgres all true). No default ACLs in schema costing (pg_default_acl empty). No dependent views; no function bodies reference the view."
meta['fingerprint_baseline']={'aggregate_md5_runs_119_122_128_136_140_143':L3['agg_before'],'preexisting_mismatch':'run 119 (REFERENCE) sku_sales_allocation_basis_snapshot matches=false BEFORE CI-037; all other 302 table checks true','legacy_margin_md5':L3['legacy_before']}
json.dump(meta,open(P+'CI-037_snapshot_view_metadata_pre.json','w'),indent=1,ensure_ascii=False)
# ---------- view new ----------
k="to_char((d.refreshed_at AT TIME ZONE 'Asia/Kolkata'::text), 'DD Mon YYYY, FMHH12:MI AM'::text) || ' IST'::text AS refreshed_at_ist"
assert vorig.count(k)==1
pc=["scheme_effective_selling_price","net_sales_realization_per_sku","estimated_profit_per_sku","estimated_profit_on_mrp_percent","estimated_profit_on_selling_price_percent","estimated_profit_on_realization_percent","profit_calculation_status"]
add=",\n    ".join(f"p_{r}.{c} AS {r}_{c}" for r in ("ik","ok") for c in pc)+",\n    p_ik.profit_calculation_basis AS profit_calculation_basis"
vnew=vorig.replace(k,k+",\n    "+add)
anchor="JOIN costing.sku_selected_scheme_policy_context_snapshot so ON so.refresh_run_id = a.refresh_run_id AND so.sku_id = d.sku_id AND so.region_code = 'OK'::text"
assert vnew.count(anchor)==1
vnew=vnew.replace(anchor,anchor+"\n     LEFT JOIN costing.sku_pricing_bridge_profit_snapshot p_ik ON p_ik.refresh_run_id = a.refresh_run_id AND p_ik.sku_id = d.sku_id AND p_ik.region_code = 'IK'::text\n     LEFT JOIN costing.sku_pricing_bridge_profit_snapshot p_ok ON p_ok.refresh_run_id = a.refresh_run_id AND p_ok.sku_id = d.sku_id AND p_ok.region_code = 'OK'::text")
# ---------- hook ----------
HOOK="perform costing.fn_ci037_fill_pricing_bridge_profit(p_refresh_run_id);"
ANCH="perform * from costing.rpc_refresh_sku_selected_scheme_policy_context_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);"
hook_block=f"""do $do$
declare
  v_def text;
  v_anchor constant text := '{ANCH}';
  v_hook constant text := '{HOOK}';
  v_n_anchor int; v_n_hook int; v_pos_ok boolean;
begin
  v_def := pg_get_functiondef('costing.rpc_refresh_manufacturing_cop_chain(date,date,bigint)'::regprocedure);
  v_n_anchor := (length(v_def) - length(replace(v_def, v_anchor, ''))) / length(v_anchor);
  v_n_hook   := (length(v_def) - length(replace(v_def, v_hook, ''))) / length(v_hook);
  -- correctly positioned = anchor, then only whitespace, then hook
  v_pos_ok := position(v_anchor in v_def) > 0
              and ltrim(substr(v_def, position(v_anchor in v_def) + length(v_anchor)), E' \\t\\r\\n') like v_hook || '%';
  if v_n_anchor <> 1 then
    raise exception 'CI037_HOOK: anchor (selected-scheme step) found % times, expected 1', v_n_anchor;
  elsif v_n_hook > 1 then
    raise exception 'CI037_HOOK: hook found % times, expected 0 or 1', v_n_hook;
  elsif v_n_hook = 1 and not v_pos_ok then
    raise exception 'CI037_HOOK: hook present but not immediately after the selected-scheme step';
  elsif v_n_hook = 1 then
    raise notice 'CI037_HOOK: already present and correctly positioned; no change';
  else
    execute replace(v_def, v_anchor, v_anchor || E'\\n        ' || v_hook);
    raise notice 'CI037_HOOK: inserted';
  end if;
end $do$;"""
# ---------- helper ----------
helper=r"""create or replace function costing.fn_ci037_fill_pricing_bridge_profit(p_refresh_run_id bigint)
returns bigint
language plpgsql
security definer
set search_path to 'costing','public','pg_temp'
as $fn$
declare
  v_des text; v_pb bigint; v_pb_sku bigint; v_sp bigint; v_sp_sku bigint; v_ss bigint; v_ss_bad bigint; v_ins bigint; v_missing bigint;
begin
  if p_refresh_run_id is null then raise exception 'CI037: refresh run id is required'; end if;
  if not exists (select 1 from costing.costing_refresh_run r where r.id = p_refresh_run_id) then
    raise exception 'CI037: refresh run % does not exist', p_refresh_run_id;
  end if;
  -- Same designation set as trg_au2_designated_run_guard (fn_guard_designated_run_rows): REFERENCE/APPROVED/REVOKED.
  select designation into v_des from costing.v_costing_run_effective_designation where refresh_run_id = p_refresh_run_id;
  if v_des in ('REFERENCE','APPROVED','REVOKED') then
    raise exception 'CI037: run % is %; designated history is immutable', p_refresh_run_id, v_des using errcode = 'P0001';
  end if;

  -- Cardinality: one pricing-bridge row per SKU, one selling-price row per pricing-bridge row,
  -- exactly one IK and one OK selected-scheme row per SKU. Any breach aborts (no partial population).
  select count(*), count(distinct sku_id) into v_pb, v_pb_sku from costing.sku_pricing_bridge_snapshot where refresh_run_id = p_refresh_run_id;
  if v_pb = 0 then raise exception 'CI037: no pricing-bridge rows for run %', p_refresh_run_id; end if;
  if v_pb <> v_pb_sku then raise exception 'CI037: % pricing-bridge rows but % distinct SKUs for run % (duplicates)', v_pb, v_pb_sku, p_refresh_run_id; end if;

  select count(*), count(distinct sp.sku_id) into v_sp, v_sp_sku
  from costing.sku_selling_price_bridge_snapshot sp
  join costing.sku_pricing_bridge_snapshot pb on pb.id = sp.pricing_bridge_snapshot_id and pb.refresh_run_id = sp.refresh_run_id and pb.sku_id = sp.sku_id
  where sp.refresh_run_id = p_refresh_run_id;
  if v_sp <> v_pb or v_sp_sku <> v_pb then
    raise exception 'CI037: selling-price rows % (distinct SKUs %) do not match pricing-bridge rows % for run %', v_sp, v_sp_sku, v_pb, p_refresh_run_id;
  end if;

  select count(*) into v_ss from costing.sku_selected_scheme_policy_context_snapshot where refresh_run_id = p_refresh_run_id;
  select count(*) into v_ss_bad from (
    select pb.sku_id
    from costing.sku_pricing_bridge_snapshot pb
    left join costing.sku_selected_scheme_policy_context_snapshot s on s.refresh_run_id = pb.refresh_run_id and s.sku_id = pb.sku_id
    where pb.refresh_run_id = p_refresh_run_id
    group by pb.sku_id
    having count(*) filter (where s.region_code = 'IK') <> 1 or count(*) filter (where s.region_code = 'OK') <> 1 or count(s.id) <> 2
  ) x;
  if v_ss_bad > 0 or v_ss <> 2 * v_pb then
    raise exception 'CI037: selected-scheme rows incomplete or duplicated for run %: % SKUs without exactly one IK and one OK row; % rows for % SKUs', p_refresh_run_id, v_ss_bad, v_ss, v_pb;
  end if;

  delete from costing.sku_pricing_bridge_profit_snapshot where refresh_run_id = p_refresh_run_id;

  insert into costing.sku_pricing_bridge_profit_snapshot (
    period_start, valuation_date, refresh_run_id, pricing_bridge_snapshot_id, selling_price_bridge_snapshot_id, selected_scheme_snapshot_id,
    sku_id, region_code, mrp, gst_percent, basic_price, discount_percent, selling_price, contingency_percent, contingency_value,
    scheme_id, scheme_paid_qty, scheme_free_qty, regional_marketing_cost_per_sku, internal_loaded_cost_per_sku,
    scheme_effective_selling_price, net_sales_realization_per_sku, estimated_profit_per_sku,
    estimated_profit_on_mrp_percent, estimated_profit_on_selling_price_percent, estimated_profit_on_realization_percent,
    profit_calculation_status, profit_calculation_basis)
  with src as (
    select pb.period_start, pb.valuation_date, pb.refresh_run_id, pb.id pb_id, sp.id sp_id, s.id ss_id, pb.sku_id, rg.r,
      case rg.r when 'IK' then pb.mrp_ik else pb.mrp_ok end mrp,
      sp.gst_percent gst,
      case rg.r when 'IK' then sp.ik_basic_price else sp.ok_basic_price end basic,
      case rg.r when 'IK' then sp.ik_discount_percent else sp.ok_discount_percent end disc,
      case rg.r when 'IK' then sp.ik_selling_price else sp.ok_selling_price end sell,
      sp.contingency_percent cpct,
      case rg.r when 'IK' then sp.ik_contingency_value else sp.ok_contingency_value end cont,
      s.scheme_id, s.paid_qty pq, s.free_qty fq, s.total_qty tq, s.resolution_status ss_status,
      case rg.r when 'IK' then pb.marketing_expense_cost_per_sku_ik else pb.marketing_expense_cost_per_sku_ok end mkt,
      pb.internal_loaded_cost_per_sku ilc,
      case rg.r when 'IK' then pb.pricing_bridge_status_ik else pb.pricing_bridge_status_ok end pb_status,
      case rg.r when 'IK' then sp.selling_price_bridge_status_ik else sp.selling_price_bridge_status_ok end sp_status
    from costing.sku_pricing_bridge_snapshot pb
    cross join (values ('IK'),('OK')) rg(r)
    join costing.sku_selling_price_bridge_snapshot sp on sp.pricing_bridge_snapshot_id = pb.id and sp.refresh_run_id = pb.refresh_run_id and sp.sku_id = pb.sku_id
    join costing.sku_selected_scheme_policy_context_snapshot s on s.refresh_run_id = pb.refresh_run_id and s.sku_id = pb.sku_id and s.region_code = rg.r
    where pb.refresh_run_id = p_refresh_run_id
  ), st as (
    select src.*,
      case
        when pb_status is null or sp_status is null then 'MISSING_UPSTREAM_STATUS'
        when pb_status = 'BLOCKED' or sp_status = 'BLOCKED' then 'UPSTREAM_BLOCKED'
        when pb_status not in ('READY','REVIEW_REQUIRED') or sp_status not in ('READY','REVIEW_REQUIRED') then 'UNKNOWN_UPSTREAM_STATUS'
        when ss_status is null or ss_status = 'BLOCKED' then 'SCHEME_BLOCKED_OR_MISSING'
        when mrp is null then 'MISSING_MRP'
        when mrp <= 0 then 'INVALID_MRP'
        when gst is null then 'MISSING_GST'
        when gst < 0 or gst > 100 then 'INVALID_GST'
        when basic is null then 'MISSING_BASIC_PRICE'
        when basic <= 0 or abs(basic - mrp / (1 + gst / 100)) > 0.01 then 'INVALID_BASIC_PRICE'
        when disc is null then 'MISSING_DISCOUNT'
        when disc < 0 or disc >= 100 then 'INVALID_DISCOUNT'
        when sell is null then 'MISSING_SELLING_PRICE'
        when sell <= 0 or sell > basic + 0.01 or abs(sell - basic * (1 - disc / 100)) > 0.01 then 'INVALID_SELLING_PRICE'
        when pq is null or fq is null or tq is null then 'MISSING_SCHEME_QUANTITY'
        when pq <= 0 or fq < 0 or tq <> pq + fq or pq <> trunc(pq) or fq <> trunc(fq) then 'INVALID_SCHEME_QUANTITY'
        when cpct is null or cont is null then 'MISSING_CONTINGENCY'
        when cpct < 0 or cpct >= 100 or abs(cont - sell * cpct / 100) > 0.01 then 'CONTINGENCY_NOT_ON_SELLING_PRICE'
        when mkt is null then 'MISSING_REGIONAL_MARKETING'
        when mkt < 0 then 'INVALID_REGIONAL_MARKETING'
        when ilc is null then 'MISSING_COST'
        when ilc <= 0 then 'INVALID_COST'
        when pb_status = 'REVIEW_REQUIRED' or sp_status = 'REVIEW_REQUIRED' then 'CALCULATED_UPSTREAM_REVIEW'
        else 'CALCULATED'
      end status
    from src
  ), v as (
    select st.*,
      case when status like 'CALCULATED%' then sell * pq / (pq + fq) end sch
    from st
  ), v2 as (
    select v.*, sch - cont - mkt nsr from v
  ), v3 as (
    select v2.*, nsr - ilc prof from v2
  )
  select period_start, valuation_date, refresh_run_id, pb_id, sp_id, ss_id, sku_id, r, mrp, gst, basic, disc, sell, cpct, cont,
    scheme_id, pq, fq, mkt, ilc, sch, nsr, prof,
    case when prof is not null and mrp  > 0 then prof / mrp  * 100 end,
    case when prof is not null and sell > 0 then prof / sell * 100 end,
    case when prof is not null and nsr  > 0 then prof / nsr  * 100 end,
    status,
    'CI-037 v2: contingency on post-discount ex-GST selling price; scheme price per delivered unit; regional marketing; internal loaded cost'
  from v3;
  get diagnostics v_ins = row_count;

  select count(*) into v_missing from (
    select pb.sku_id, rg.r from costing.sku_pricing_bridge_snapshot pb cross join (values ('IK'),('OK')) rg(r)
    where pb.refresh_run_id = p_refresh_run_id
    except
    select sku_id, region_code from costing.sku_pricing_bridge_profit_snapshot where refresh_run_id = p_refresh_run_id
  ) x;
  if v_ins <> 2 * v_pb or v_missing > 0 then
    raise exception 'CI037: partial population for run %: inserted %, expected %, missing SKU-region pairs %', p_refresh_run_id, v_ins, 2 * v_pb, v_missing;
  end if;
  return v_ins;
end $fn$;
revoke all on function costing.fn_ci037_fill_pricing_bridge_profit(bigint) from public, anon, authenticated, service_role;"""
table=r"""create table costing.sku_pricing_bridge_profit_snapshot (
  id bigint generated always as identity primary key,
  period_start date not null,
  valuation_date date not null,
  refresh_run_id bigint not null references costing.costing_refresh_run(id),
  pricing_bridge_snapshot_id bigint not null references costing.sku_pricing_bridge_snapshot(id) on delete cascade,
  selling_price_bridge_snapshot_id bigint,
  selected_scheme_snapshot_id bigint,
  sku_id bigint not null,
  region_code text not null check (region_code in ('IK','OK')),
  mrp numeric, gst_percent numeric, basic_price numeric, discount_percent numeric, selling_price numeric,
  contingency_percent numeric, contingency_value numeric,
  scheme_id bigint, scheme_paid_qty numeric, scheme_free_qty numeric,
  regional_marketing_cost_per_sku numeric, internal_loaded_cost_per_sku numeric,
  scheme_effective_selling_price numeric,
  net_sales_realization_per_sku numeric,
  estimated_profit_per_sku numeric,
  estimated_profit_on_mrp_percent numeric,
  estimated_profit_on_selling_price_percent numeric,
  estimated_profit_on_realization_percent numeric,
  profit_calculation_status text not null,
  profit_calculation_basis text not null,
  calculated_at timestamptz not null default clock_timestamp(),
  unique (refresh_run_id, sku_id, region_code),
  unique (pricing_bridge_snapshot_id, region_code),
  check (profit_calculation_status like 'CALCULATED%' or (scheme_effective_selling_price is null and net_sales_realization_per_sku is null and estimated_profit_per_sku is null))
);
alter table costing.sku_pricing_bridge_profit_snapshot enable row level security;
revoke all on costing.sku_pricing_bridge_profit_snapshot from public, anon, authenticated, service_role;
create trigger trg_au2_designated_run_guard before insert or delete or update on costing.sku_pricing_bridge_profit_snapshot
  for each row execute function costing.fn_guard_designated_run_rows();
create trigger trg_au2_snapshot_truncate_guard before truncate on costing.sku_pricing_bridge_profit_snapshot
  for each statement execute function costing.fn_guard_snapshot_truncate();
comment on table costing.sku_pricing_bridge_profit_snapshot is 'CI-037: per SKU and region (IK/OK) commercial profit chain, filled by fn_ci037_fill_pricing_bridge_profit inside the refresh chain. Estimated profit = scheme-adjusted selling price - contingency allowance - regional marketing - internal loaded cost, per delivered unit. Contingency is an allowance, not an incurred cost.';
comment on column costing.sku_pricing_bridge_profit_snapshot.profit_calculation_status is 'CALCULATED, CALCULATED_UPSTREAM_REVIEW, or an explicit error code (MISSING_*/INVALID_*/UPSTREAM_BLOCKED/SCHEME_BLOCKED_OR_MISSING/CONTINGENCY_NOT_ON_SELLING_PRICE...). Values are NULL unless CALCULATED*.';"""
legacy_comments="""comment on column costing.sku_pricing_bridge_snapshot.ik_margin_amount_before_scheme is 'Legacy MRP-based cost difference — not profit';
comment on column costing.sku_pricing_bridge_snapshot.ok_margin_amount_before_scheme is 'Legacy MRP-based cost difference — not profit';
comment on column costing.sku_pricing_bridge_snapshot.ik_margin_percent_before_scheme is 'Legacy MRP-based cost difference — not profit (% of GST-inclusive MRP)';
comment on column costing.sku_pricing_bridge_snapshot.ok_margin_percent_before_scheme is 'Legacy MRP-based cost difference — not profit (% of GST-inclusive MRP)';"""
fix=f"""-- CI-037 v2 PREPARED, NOT APPLIED. Apply only after owner approval, via Supabase MCP apply_migration
-- (never supabase db push). Notify Jarvis first. Run CI-037_verify.sql BEFORE (must match the recorded baseline) and AFTER.
--
-- v2 change of design (fingerprint safety): run 119 (REFERENCE) has a legacy fingerprint capture without a column
-- list, so fn_verify_run_fingerprint re-hashes ALL current columns of sku_pricing_bridge_snapshot. Adding columns to
-- that table would therefore show drift on run 119. v2 leaves sku_pricing_bridge_snapshot's columns untouched
-- (comments only) and stores the profit chain in a new side table, sku_pricing_bridge_profit_snapshot (one row per
-- SKU and region). The new table matches fn_costing_run_scoped_tables() (name has 'snapshot', has refresh_run_id),
-- so future fingerprints cover it; for old runs it has 0 rows and is skipped by fn_verify_run_fingerprint.
-- Immutability: the existing trg_au2_designated_run_guard / fn_guard_designated_run_rows() (blocks INSERT/UPDATE/
-- DELETE for runs designated REFERENCE/APPROVED/REVOKED) and trg_au2_snapshot_truncate_guard are attached to the new
-- table; the helper also refuses those runs itself.
-- Order in the chain: pricing bridge -> selling price bridge -> scheme master -> selected scheme -> [CI-037 helper] -> scheme viability.

begin;

{legacy_comments}

{table}

{helper}

-- Repeatable hook: 0 hooks -> insert; 1 correctly placed -> no-op; several or misplaced -> error.
{hook_block}

-- Additive view change: 64 existing columns kept in order, 15 appended. CREATE OR REPLACE keeps owner, ACL,
-- reloptions and column comments.
create or replace view costing.v_price_revision_current_approved_master as
{vnew};

commit;
"""
open(P+'CI-037_profit_fix.sql','w').write(fix)
# ---------- rollback A ----------
cc="\n".join("comment on column costing.v_price_revision_current_approved_master.%s is %s;"%(k, "'"+v.replace("'","''")+"'") for d in L['col_comments'] for k,v in d.items())
unhook=f"""do $do$
declare v_def text; v_hook constant text := '{HOOK}'; v_n int;
begin
  v_def := pg_get_functiondef('costing.rpc_refresh_manufacturing_cop_chain(date,date,bigint)'::regprocedure);
  v_n := (length(v_def) - length(replace(v_def, v_hook, ''))) / length(v_hook);
  if v_n > 1 then raise exception 'CI037_UNHOOK: hook found % times; manual review needed', v_n; end if;
  if v_n = 1 then
    execute regexp_replace(v_def, E'\\n[ \\t]*' || replace(replace(v_hook, '(', '\\('), ')', '\\)'), '');
    if pg_get_functiondef('costing.rpc_refresh_manufacturing_cop_chain(date,date,bigint)'::regprocedure) like '%' || v_hook || '%' then
      raise exception 'CI037_UNHOOK: hook still present after removal';
    end if;
    raise notice 'CI037_UNHOOK: removed';
  else
    raise notice 'CI037_UNHOOK: not present; no change';
  end if;
end $do$;"""
privcheck="""do $do$
declare r record;
begin
  for r in select * from (values ('anon',false),('authenticated',false),('service_role',false),('postgres',true)) v(role, expected) loop
    if has_table_privilege(r.role,'costing.v_price_revision_current_approved_master','SELECT') is distinct from r.expected
       or has_table_privilege(r.role,'costing.v_price_revision_current_approved_master','INSERT') is distinct from r.expected
       or has_table_privilege(r.role,'costing.v_price_revision_current_approved_master','UPDATE') is distinct from r.expected
       or has_table_privilege(r.role,'costing.v_price_revision_current_approved_master','DELETE') is distinct from r.expected then
      raise exception 'CI037_ROLLBACK: privilege for % differs from captured baseline', r.role;
    end if;
  end loop;
  if (select pg_get_userbyid(relowner) from pg_class where oid='costing.v_price_revision_current_approved_master'::regclass) <> 'postgres' then raise exception 'CI037_ROLLBACK: owner differs'; end if;
  if (select reloptions from pg_class where oid='costing.v_price_revision_current_approved_master'::regclass) is not null then raise exception 'CI037_ROLLBACK: reloptions differ (expected none, i.e. no security_invoker)'; end if;
  if (select count(*) from pg_attribute where attrelid='costing.v_price_revision_current_approved_master'::regclass and attnum>0 and not attisdropped) <> 64 then raise exception 'CI037_ROLLBACK: view does not have 64 columns'; end if;
  if (select count(*) from pg_attribute where attrelid='costing.v_price_revision_current_approved_master'::regclass and attnum>0 and col_description(attrelid,attnum) is not null) <> NCC then raise exception 'CI037_ROLLBACK: column comment count differs'; end if;
end $do$;""".replace('NCC',str(len(L['col_comments'])))
rbA=f"""-- CI-037 ROLLBACK A — immediate structural rollback. PREPARED, NOT APPLIED.
-- Valid ONLY before any run holds CI-037 data. Refuses if sku_pricing_bridge_profit_snapshot has any row.
-- Restores: chain function text (hook removed), approved-master view (64 columns, from
-- CI-037_snapshot_approved_master_view_pre.sql), its owner, privileges, reloptions and column comments
-- (CI-037_snapshot_view_metadata_pre.json), drops the side table and helper, clears the legacy comments.
begin;
do $do$
begin
  if to_regclass('costing.sku_pricing_bridge_profit_snapshot') is not null
     and exists (select 1 from costing.sku_pricing_bridge_profit_snapshot) then
    raise exception 'CI037_ROLLBACK_A_REFUSED: CI-037 data exists for runs %; use CI-037_rollback_B_post_use.sql',
      (select string_agg(distinct refresh_run_id::text, ',') from costing.sku_pricing_bridge_profit_snapshot);
  end if;
end $do$;

{unhook}

drop view costing.v_price_revision_current_approved_master;
create view costing.v_price_revision_current_approved_master as
{vorig};
alter view costing.v_price_revision_current_approved_master owner to postgres;
-- Captured baseline: relacl NULL (owner-only); anon/authenticated/service_role have no privileges. Re-assert explicitly.
do $do$
begin
  -- Revoke only if a default privilege granted something; keeps relacl NULL exactly as captured when nothing was granted.
  if has_table_privilege('anon','costing.v_price_revision_current_approved_master','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or has_table_privilege('authenticated','costing.v_price_revision_current_approved_master','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or has_table_privilege('service_role','costing.v_price_revision_current_approved_master','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
    revoke all on costing.v_price_revision_current_approved_master from public, anon, authenticated, service_role;
  end if;
end $do$;
{cc}
{privcheck}

drop function if exists costing.fn_ci037_fill_pricing_bridge_profit(bigint);
drop table if exists costing.sku_pricing_bridge_profit_snapshot;
comment on column costing.sku_pricing_bridge_snapshot.ik_margin_amount_before_scheme is null;
comment on column costing.sku_pricing_bridge_snapshot.ok_margin_amount_before_scheme is null;
comment on column costing.sku_pricing_bridge_snapshot.ik_margin_percent_before_scheme is null;
comment on column costing.sku_pricing_bridge_snapshot.ok_margin_percent_before_scheme is null;
commit;
"""
open(P+'CI-037_rollback_A_structural.sql','w').write(rbA)
rbB=f"""-- CI-037 ROLLBACK B — non-destructive post-use rollback. PREPARED, NOT APPLIED.
-- Use once any run holds CI-037 data. Only unhooks the helper from the refresh chain, so future runs stop
-- producing CI-037 rows. Keeps the side table, its data (immutable for designated runs), the helper function,
-- the view columns and comments. Re-running CI-037_profit_fix.sql's hook block re-enables it.
begin;
{unhook}
commit;
"""
open(P+'CI-037_rollback_B_post_use.sql','w').write(rbB)
legacy_vals="('"+"'),('".join(f"{d['refresh_run_id']}','{d['n']}','{d['legacy_md5']}" for d in L3['legacy_before'])+"')"
ver=f"""-- CI-037 read-only verification. Run BEFORE and AFTER apply (and after either rollback). SELECT only.
-- Baseline captured read-only 24 Oct 2026 ~21:45 IST (see CI-037_snapshot_view_metadata_pre.json).

-- 1. Fingerprint drift, every designated run (119 REFERENCE, 122/143 APPROVED, 128/136/140 REVOKED).
--    Expected BEFORE and AFTER: exactly one row = the pre-existing mismatch (119, sku_sales_allocation_basis_snapshot).
select r.run, f.table_name, f.matches
from (select refresh_run_id run from costing.v_costing_run_effective_designation) r,
     lateral costing.fn_verify_run_fingerprint(r.run) f
where not f.matches order by 1,2;

-- 2. Zero drift: aggregate of all current table hashes for runs 119/122/128/136/140/143.
--    Expected: {L3['agg_before']} (identical before and after).
select md5(string_agg(r.run||':'||f.table_name||':'||coalesce(f.current_value->>'md5','')||':'||coalesce(f.current_value->>'rows',''),'|' order by r.run,f.table_name)) agg,
       md5(string_agg(r.run||':'||f.table_name||':'||coalesce(f.current_value->>'md5','')||':'||coalesce(f.current_value->>'rows',''),'|' order by r.run,f.table_name)) = '{L3['agg_before']}' as zero_drift
from unnest(array[119,122,128,136,140,143]::bigint[]) r(run), lateral costing.fn_verify_run_fingerprint(r.run) f;

-- 3. Legacy margin values unchanged (expected: all ok=true).
select b.run, b.n, x.n now_n, x.legacy_md5 = b.md5 and x.n = b.n::bigint ok
from (values {legacy_vals}) b(run,n,md5)
left join (select refresh_run_id::text run, count(*) n,
  md5(string_agg(concat_ws('|',sku_id,ik_margin_amount_before_scheme,ok_margin_amount_before_scheme,ik_margin_percent_before_scheme,ok_margin_percent_before_scheme),',' order by sku_id)) legacy_md5
  from costing.sku_pricing_bridge_snapshot where refresh_run_id in (119,122,128,136,140,143) group by 1) x on x.run = b.run order by 1;

-- 4. sku_pricing_bridge_snapshot structure unchanged (expected: 48 columns).
select count(*) from pg_attribute where attrelid='costing.sku_pricing_bridge_snapshot'::regclass and attnum>0 and not attisdropped;

-- 5. Immutability guard (cites costing.fn_guard_designated_run_rows: raises AU2_DESIGNATED_RUN_IMMUTABLE for
--    REFERENCE/APPROVED/REVOKED on INSERT/UPDATE/DELETE). Expected AFTER: both tables listed, enabled 'O'.
select tgrelid::regclass, tgname, tgenabled, pg_get_triggerdef(oid) like '%fn_guard_designated_run_rows%' uses_guard
from pg_trigger where tgname in ('trg_au2_designated_run_guard','trg_au2_snapshot_truncate_guard')
  and tgrelid in ('costing.sku_pricing_bridge_snapshot'::regclass, coalesce(to_regclass('costing.sku_pricing_bridge_profit_snapshot'),'costing.sku_pricing_bridge_snapshot'::regclass)) order by 1,2;

-- 6. No CI-037 rows for any designated run (expected: 0).
select count(*) from costing.sku_pricing_bridge_profit_snapshot p join costing.v_costing_run_effective_designation e using (refresh_run_id);

-- 7. Approved master: 627 rows on run 143, 64 legacy + 15 new columns (79 AFTER, 64 BEFORE / after rollback A),
--    new columns NULL for run 143; owner postgres; reloptions NULL; privileges unchanged.
select refresh_run_id, count(*) from costing.v_price_revision_current_approved_master group by 1;
select count(*) ncols from pg_attribute where attrelid='costing.v_price_revision_current_approved_master'::regclass and attnum>0 and not attisdropped;
select pg_get_userbyid(relowner) owner, relacl, reloptions from pg_class where oid='costing.v_price_revision_current_approved_master'::regclass;
select r, has_table_privilege(r,'costing.v_price_revision_current_approved_master','SELECT') sel
from unnest(array['anon','authenticated','service_role','postgres']) r;  -- expected f,f,f,t

-- 8. Hook: expected AFTER fix exactly 1 and correctly positioned; after either rollback 0.
select (length(d)-length(replace(d,'{HOOK}','')))/length('{HOOK}') hooks,
       d ~ 'rpc_refresh_sku_selected_scheme_policy_context_snapshot\\(v_period_start,p_valuation_date,p_refresh_run_id\\);\\s*perform costing\\.fn_ci037_fill_pricing_bridge_profit\\(p_refresh_run_id\\);' positioned
from (select pg_get_functiondef('costing.rpc_refresh_manufacturing_cop_chain(date,date,bigint)'::regprocedure) d) x;

-- 9. Legacy comments (expected AFTER: 'Legacy MRP-based cost difference — not profit' on the amount columns).
select attname, col_description(attrelid,attnum) from pg_attribute
where attrelid='costing.sku_pricing_bridge_snapshot'::regclass and attname like '%margin_%before_scheme' order by 1;

-- 10. First future run only (separately approved): status mix and completeness.
-- select profit_calculation_status, region_code, count(*) from costing.sku_pricing_bridge_profit_snapshot where refresh_run_id = <new run> group by 1,2;
"""
open(P+'CI-037_verify.sql','w').write(ver)
open('/workspace/ci037/gen/view_new.sql','w').write(vnew)
print('ok')
