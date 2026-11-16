# WP10 — Live trigger event matrix (2026-11-16)

Read-only `pg_get_triggerdef` inspection on production; no DML or DDL.

| Table | Live row-level guard events | Implication for WP10 review |
|---|---|---|
| `public.product_skus` | `trg_active_sku_requires_active_product`: BEFORE INSERT or UPDATE OF product_id,is_active; `trg_sku_activation_completeness_guard`: BEFORE INSERT or UPDATE OF is_active,product_id | Existing activation checks are present, but their inspected function bodies use ordinary parent SELECTs; candidate lock requires concurrency tests |
| `public.products` | `trg_product_inactivation_requires_no_active_skus`: BEFORE UPDATE OF status | No dedicated row-level route-impact trigger visible on subgroup change in this catalog snapshot; draft proposal 05 remains unapplied |
| `public.sub_groups` | No row-level route-impact guard; WP04 statement-level readiness epoch only | Reassigning subgroup to another group needs explicit route impact/dependency review |
| `costing.production_route_family_product_map` | BEFORE INSERT/DELETE/UPDATE assignment guard, plus BEFORE INSERT/UPDATE effective-date and approval-reference checks | Assignment changes are governed for lifecycle/validity, not thereby proven serialized against SKU activation |
| `costing.production_route_family_product_subgroup_map` | BEFORE DELETE/UPDATE immutability; BEFORE INSERT/UPDATE effective-date | INSERT of a mapping is not handled by immutability trigger; status transitions and impact require scenario review |
| `costing.production_route_family_product_group_map` | Same event coverage as subgroup mapping | Group-level route resolution changes need impact review |
| `costing.product_process_route_override` | BEFORE INSERT/DELETE/UPDATE approved-route override immutability | Approved-route protection exists; concurrency and draft-route mutation are separate questions |

**Important:** These are the observed trigger definitions, not a full assessment of FK constraints, RPC authorization, row locks or other SQL writers. In particular, absence of a named route-impact trigger is not by itself proof of an exploitable production defect. Do not apply proposals 04/05 or rollback 99 without independent review and exact owner approval. WP10 remains OPEN.
