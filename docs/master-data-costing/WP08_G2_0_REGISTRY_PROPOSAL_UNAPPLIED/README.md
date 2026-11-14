# WP08 G2-0 — registry update proposal (**UNAPPLIED**)

Status: **UNAPPLIED proposal.** Nothing here has been run against any database, and it is deliberately **not** under
`supabase/migrations/`. Applying it needs (1) the G2-0 PR merged, (2) a PWA deployment whose `/shared/manage-*.html`,
JS and CSS are verified reachable, and (3) the owner's separate production-mutation approval. WP08 remains OPEN (8/13).

| Step | File | Effect | Required? |
|---|---|---|---|
| 0 | `01_preflight_and_before_select.sql` | read-only assertion + BEFORE select | yes, run first |
| A | `02_apply_pwa_client_rows.sql` | insert/refresh 4 `pwa` rows in `app_module_clients`, copied from the Electron rows | yes (enables PWA) |
| B | `03_optional_repoint_electron_routes.sql` | repoint Electron `route_path` to `public/shared/…` | **optional, last** — only after every installed Electron build contains the new path; root stubs keep the old value working |
| – | `99_rollback.sql` | undo B then A, guarded by exact key + route | on demand |

Guarantees (asserted by `scripts/wp08-g2-0-shared-master-data/source.test.mjs`): only `app_module_clients` is written;
`app_modules`, labels, sections, `sort_order`, `min_nav_mode`, permissions, grants and RLS are untouched; PM BOM keeps
registry key **`pm-templates`** / permission **`module:pm-templates`** (page file is `manage-pm-bom.html`); idempotent;
transactional; no `manage-pm-bom` key is introduced.

Ordering for rollout: deploy PWA → verify pages/assets/role gates → run 0 → A → verify PWA launcher; Electron release →
(later) B. Roll back with `99_rollback.sql`; stubs make rollback of B unnecessary for availability.

Column names (`module_key, client_key, route_path, nav_enabled, launch_mode, updated_at`) are taken from the repository's
own seed (`20260802150233_register_production_route_manager_app_module.sql`); the preflight asserts the live rows before
anything is written.
