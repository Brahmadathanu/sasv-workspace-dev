# G2 dependency inventory — phase 1 (read-only, 20 October 2026)

Status: **VERIFIED for listed catalog facts; PARTIAL inventory, not retirement approval**. Source: live Supabase project qhmoqtxpeasamtlxaoak, pg_proc/pg_views/pg_class catalog read-only SELECT. PR #72 draft. No mutations.

## Exact executable reference graph

A scan of actual `pg_get_functiondef` source and `pg_views.definition` for named call tokens found:
- `costing.fn_au9_g4_load_mode(date)` (md5 ff1ec3442c488e567a23776b8afeee76) referenced by `fn_au9_g4_capture_provenance`, `fn_au9_g4_route_step_loads`, `rpc_refresh_production_overhead_workload_snapshot`, `rpc_refresh_sku_direct_labour_component_split_snapshot`.
- `costing.fn_au9_g4_resolve_step_load(...)` (md5 397f8965c3bf4f6d4f39aac9599dba23) referenced by `fn_au9_g4_capture_provenance` and `fn_au9_g4_route_step_loads`.
- `costing.fn_au9_g4_route_step_loads(...)` (md5 16136dd56f96a6d8be66298d556c7050) called by both direct-labour and production-overhead snapshot writers.
- `costing.fn_route_step_loads(...)` (md5 4ce19661b2e40ccf136617f97e6a2b9d) called by G4 wrapper AND both snapshot writers.
- `costing.fn_route_load_scaling_mode(date)` (md5 13a2dfd3bc054275b8a425aae0afa8e8) called by both snapshot writers.
- `costing.fn_au9_g4_capture_provenance(...)` (md5 2b0486752edca239855262d49694ecae) called by both snapshot writers.
- No direct references to these six names found in pg_views definitions in costing/public.

**Method limitation:** textual caller analysis establishes likely call relationships but does not certify all indirect, dynamic SQL, client or ETL references. These must be additionally checked before retirement. `pg_depend`, triggers, grants, cron, source repo and app consumers remain necessary.

## Initial disposition — conditional, not approved

| Item | Proposed classification | Basis / next verification |
| --- | --- | --- |
| `public.production_batch_size_ref` | KEEP | Authoritative standard batch source |
| Approved run 122/128 snapshots and fingerprint/audit history | HISTORICAL-PRESERVE | Immutable financial evidence |
| Product and family routes, route steps, approved overrides | KEEP | Actual operation mapping, including ADD/BYPASS |
| `rpc_refresh_sku_direct_labour_component_split_snapshot` | REPLACE calculation internals; KEEP governed writer contract | Financial writer; legacy and G4 references both live |
| `rpc_refresh_production_overhead_workload_snapshot` | REPLACE calculation internals; KEEP governed writer contract | Separate financial pool writer; must transition together |
| `fn_route_step_loads`, `fn_route_load_scaling_mode` | REPLACE then candidate HARD-RETIRE executable functions | Still referenced: unsafe to drop now |
| `fn_au9_g4_load_mode`, `fn_au9_g4_resolve_step_load`, `fn_au9_g4_route_step_loads`, `fn_au9_g4_capture_provenance` | REPLACE then candidate HARD-RETIRE | Existing dual-path architecture; require complete consumers and alternative |
| `plant_aware_load_switch`, `capacity_fallback_policy`, `route_step_capacity_rule` | Candidate HARD-RETIRE **only if** replacement eliminates their necessity | Do not remove before tests and dependency/security audit |
| `plant_capacity_profile`, `capacity_master_revision`, `v_plant_capacity_readiness`, `v_capacity_value_origin` | PLANNING-ONLY / KEEP pending cross-system consumer audit | Valid machine/planning data must not be destroyed |
| `route_equipment_load_capacity`, `route_batch_charge_unit_mass` | REVIEW; cannot yet classify finally | Legacy quantity drivers and legitimate unit conversions need evaluation |
| `route_step_load_provenance_snapshot`, `route_load_scaling_snapshot`, workload snapshots | HISTORICAL-PRESERVE for existing rows; prospective schema disposition OPEN | Historical explanation must remain valid |
| `production_route_behaviour`, route readiness and production route management RPCs | KEEP / REVIEW | Operational planning/management not solely financial costing |

Catalog also confirms related `costing` tables have RLS disabled and several have protective triggers (e.g. plant capacity profile 3, capacity fallback 3, route step capacity rule 3; direct-labour and OH snapshot tables each 3). Their grants and trigger definitions are not yet enumerated; absence of RLS alone does not establish an exposure because schema/API grants matter.

## Minimum design invariant before implementation

A product must receive shares of each eligible pool in proportion to a defensible manufacturing workload for its standard batch, not in proportion to sales; `share_i = workload_i / sum(workload_eligible)` and `allocation_i = pool * share_i`, with exact conservation before rounding and explicitly reconciled rounding thereafter. A verified physical charge may influence a genuinely repeating step; rated throughput does not become kg/charge. Fixed legitimate activities must not be scaled solely by a 50kg class default. No cost plug, unexplained fallbacks or mandatory inventory of 74 missing machine capacities.

**Not yet completed:** representative alternative scenario shares and differences, qualified per-step physical evidence, pg_depend/trigger/ACL/cron/ETL/client graph, deterministic isolated test harness, final retirement contract. No classification authorises a DROP or deployment. Existing G2 CI-032 remains HIGH and OPEN.

## Reproducible catalog inspection

```sql
SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS arguments,
       md5(pg_get_functiondef(p.oid)) AS definition_md5
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname = 'costing' AND p.prokind = 'f'
AND p.proname IN ('fn_au9_g4_capture_provenance','fn_au9_g4_load_mode',
'fn_au9_g4_resolve_step_load','fn_au9_g4_route_step_loads',
'fn_route_load_scaling_mode','fn_route_step_loads');
```

Follow-up: extract full writer definitions and identify source-to-snapshot fields before any scenario estimate. Audit actual static and dynamic dependencies, then prepare a consolidated change packet with tests. All live switches, cron, approved runs, periods, migrations and approved fingerprints remain untouched.
