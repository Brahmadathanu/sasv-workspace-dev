# R6 — Complete Sales Viewer retirement

Owner direction, 25 November 2026: once Sales Viewer replacement is finally accepted and the legacy module is deprecated/removed, promptly retire its exclusive database elements as well as client elements. This is mandatory R6 scope, not authorization to delete anything now.

## Preconditions
- Accepted R3 functional parity/improvement, source coverage, performance and access segregation; authenticated PWA practical acceptance and compatible supported Electron release under R5. Verify that remaining supported older clients no longer depend on legacy endpoints.
- Preserve access for existing Sales Viewer users without granting unrelated MIS lenses. Verify actual role and route acceptance before retiring the old permission target.
- Inventory exclusive and shared objects using live catalog dependency graph (including function bodies, dynamic SQL, grants, cron/ETL jobs, views/materialized views, triggers), repository references and known external consumers. Classify each object exclusive/shared/uncertain. Uncertain dependencies block deletion of the relevant object.

## Retirement package
- Remove obsolete HTML/JS/CSS, routes/aliases, navigation and cache references, registry entries and exclusive permission assignments/target only after governed transition. Retain historical migration files and applied migration history.
- Audit v_sdv_sales_enriched, v_sdv_freshness, v_sdv_dim_* and sdv_zero_sellers_abs as candidate legacy objects; remove only those with no surviving consumers after migration/replacement. Audit other exclusive functions, jobs and supporting objects. Do not infer exclusivity from naming alone.
- Preserve app_private.sales_monthly, public.v_sales_daily_normalized, underlying Tally sales data and all shared costing/reporting authorities, including refresh infrastructure necessary for surviving consumers. If new analytics need a legacy helper, migrate it to the canonical shared contract before retiring it or explicitly retain it as shared.
- Prepare exact dependency-ordered forward migration using DROP ... RESTRICT (no CASCADE); capture definitions, ACLs, owners, schedules and reversible recovery plan. No historical migration deletion/replay. Require explicit owner approval of the exact removal manifest and migration. No business data deletion merely because a reporting UI is retired.
- Verify R3/R5 replacement, permission boundaries, shared costing/reporting regressions, refresh jobs and absence of orphan legacy elements/references after installation. Record live migration identity and receipts; then R7 closure.

Current state: R6 queued; no deletion or retirement performed. R3 remains active; no interruption to current server contract work. G7 7/11; G8 parked; PWL independent.
