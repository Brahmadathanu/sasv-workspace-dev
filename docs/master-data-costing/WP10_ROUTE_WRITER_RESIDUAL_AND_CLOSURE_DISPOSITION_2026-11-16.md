# WP10 — Route-writer residual audit and bounded closure disposition (2026-11-16)

## Verified production catalog — SELECT-only
- As of 2026-11-16, the route-map query returned **16 nonarchived APPROVED subgroup-to-route-family mappings**, covering 16 distinct subgroups. It returned **no nonarchived product-group map rows**.
- All 16 approved subgroup mappings are effective on the query date, with **253 associated product rows** and **109 associated active SKU rows**. These are *associated*, not proven exclusively dependent on the subgroup mapping: product-level routes may supersede/fallback. Do not state that 109 SKUs are currently invalid or would necessarily become invalid after a particular edit.
- Authenticated users have **no direct INSERT/UPDATE/DELETE privileges** on the costing route family, route, group-map and subgroup-map tables.
- The exposed Route Manager RPCs enforce `require_permission('module:production-route-manager',true)`. Of particular interest, `rpc_approve_product_subgroup_route_family_mapping` can supersede an approved mapping and `rpc_inactivate_product_subgroup_route_family_mapping` can inactivate one. Their inspected bodies do not call the WP10 activation-parent lock/recheck. The existing `costing.fn_route_parent_immutable` trigger explicitly permits approved→SUPERSEDED/INACTIVE and effective_to changes; it is **not** a route-validity recheck.
- The subgroup-to-group direct UPDATE route currently has authenticated DML grants, and the new four-level revoke proposal eliminates that path for authenticated users after compatibility acceptance. Review-only CRUD RPCs provide NO reparent operation; a privileged service-role bypass remains outside authenticated DML control.

## What the CL15 candidate actually proves
The exact guarded correction plus proposal 05 passes the isolated first-activation vs product `sub_group_id` update schedules, negative mutation, sibling activations and targeted rollback. The CI result is **not evidence of an equivalent lock for future Route Manager map replacement/inactivation** or privileged reassignment of `sub_groups.product_group_id`.

## Required disposition — no invented PASS
A. **Four-level authenticated hierarchy / SKU-product overlap**: review-only mitigations implemented; exact CI successful. Still needs independent review, live negative role checks, phased deployment and owner authorization.
B. **PRM approved map replacement/inactivation**: residual *open*, specifically potentially touching 109 associated active SKU rows at the current snapshot. Require a Route Manager impact/serialization proposal with an explicit functional owner, or an owner-approved bounded residual risk and a tracked follow-up. Do not silently mark as safe.
C. **Privileged subgroup reparent**: direct authenticated writes removable by the proposed four-level revoke; privileged service-role writes require existing operational governance. Do not claim universal prevention.
D. **Electron installed-client transition**: direct-authenticated DML revoke must be deferred until installed clients are compatible or an explicit support cutover is approved.

## Evidence links
- [GitHub Actions #43843464599](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43843464599): SUCCESS; original race witness blocked by the guarded correction, negative mutation unsafe state reproduced, CL15/CL16/CL18/CL19 and rollback checks pass in isolated PostgreSQL.
- [GitHub Actions #43841866157](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43841866157): SUCCESS; 59 existing + added mocked Chromium tests, plus standalone preview browser suite.
- `scripts/wp10-g2-safeguards/read-only-route-writer-residual-audit.sql`: reproducible read-only privilege and association counts.

No production SQL, permissions, deployment, merge or flags were changed. WP10 remains OPEN. This document is a disposition, not an acceptance sign-off.
