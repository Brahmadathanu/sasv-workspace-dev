# WP10 RM1 — independent authorised Route Manager writer-path decision matrix

**17 November 2026 IST | read-only pg_proc / pg_trigger / pg_policy catalog | NO production DML**

This document protects the previously completed PRM lifecycle: explicit user approval and history preservation are retained. A boolean below means the exact live function body contains the indicated validation call, **not** that every downstream business rule is fully proven.

| Live public RPC | Live definition MD5 | Validates route directly? | Safety classification / candidate boundary |
|---|---|---|---|
| `rpc_approve_product_route(bigint,text)` | `d4dc989e28e8b096a9abb5300349965a` | `fn_validate_product_process_route` | Validates candidate and enforces meaningful approval reference and overlap. Not a substitute for proof of all downstream effective-as-of selections |
| `rpc_approve_route_family_route(bigint,text)` | `4f410336d48374f448c07eb29c917038` | `fn_validate_route_family_route` | Validates family-route candidate, strict review status and predecessor window. Preserve legitimate supersession |
| `rpc_approve_product_route_family_assignment(bigint,text,date)` | `11c3bad591333b9991c92c992af6c44f` | No canonical effective-route validation | **RM1 active-SKU shadowing risk.** Higher-precedence approved product mapping can displace viable subgroup route before family-route viability is established |
| `rpc_approve_product_subgroup_route_family_mapping(bigint,text,date)` | `aa730dd371974f479828c7974e2abb63` | No canonical effective-route validation | **RM1 subgroup promotion/impact.** Must permit valid atomic replacement and product override precedence |
| `rpc_approve_route_family_mapping(bigint,text,date)` | `afad5c67f5cef27700aafdee90f2416c` | No canonical effective-route validation | **RM1 group promotion/impact**; all group maps currently archived, so no present current-route incident |
| `rpc_inactivate_product_route_family_assignment(bigint,date)` | `a6ce1b4ba1bd009a7974eff63e74da17` | No | **RM1 active-route continuity risk**; marks approved map INACTIVE immediately |
| `rpc_inactivate_product_subgroup_route_family_mapping(bigint,date)` | `0e8f4efd43c3f527ddde5f9527e02391` | No | **RM1 active-route continuity + mismatched client reason RPC**; a future effective_to does not defer immediate INACTIVE status |
| `rpc_correct_product_route_family_assignment_effective_from(bigint,date,text,text)` | `20e2f052791b8f388bffde7e907b3115` | No | Route-effective date edit: mapping-table UPDATE candidate covers changed approved dates, but historical override policy and old-record immutability must be preserved |
| `rpc_supersede_product_route(bigint,bigint)` | `8b80bd77d82ad3a0158f797e93cd8326` | No, requires both APPROVED same-product versions | **G2/CI-032 historical selector** separate from RM1: old product route becomes SUPERSEDED; product-route resolver excludes superseded predecessor |
| `rpc_supersede_route_family_route(bigint,bigint)` | `a450c7e1300797271924c10321e66f55` | No, requires both APPROVED same-family versions | Family-route resolver *does* consider SUPERSEDED historical versions within effective periods; overlaps need G2 fail-closed historical policy |

**Cross-cutting facts:** all ten above are SECURITY DEFINER and contain `public.require_permission`; two inactivation RPCs and the explicit supersession RPCs do not themselves contain `FOR UPDATE`. A containing `FOR UPDATE` is evidence of some row-level locking, **not proof that it serializes with active-SKU product-row locks**. The candidate RM1 deferred trigger attempts post-transaction verification after acquiring affected products `FOR UPDATE`; prospective fan-out and lock ordering still require independent review.

**Direct data boundary:** `authenticated` lacks direct DML to route-mapping tables. `public.sub_groups` has an `authenticated` UPDATE grant including `product_group_id`, with RLS `auth.uid() IS NOT NULL`, and its only observed user trigger is WP04 readiness epoch invalidation. This is a prospective inheritance/permission gap if group route mapping resumes; **no change to permissions is authorised yet**.

## Distinct completion conditions

**RM1 current-route safety candidate:** `AFTER INSERT OR UPDATE` on product/subgroup/group mappings; test old approved demotion, newly-approved mapping, valid replacement, direct approved INSERT, override precedence, no-active-SKU, current and future effective dates, simultaneous SKU activation and product subgroup change. Work remains review-only; tests pass on isolated PG and do not replace real signed-in/JWT acceptance.

**G2/CI-032 historical policy:** live as-of Product Route resolver selects only APPROVED. Live 17 Nov audit: nine non-archived superseded product routes, seven with open-ended effective_to, seven overlaps against approved successors. Family: 19 superseded, one open-ended, ten overlaps. October 20 audit already recorded **historical route predecessor invisibility** and warned against a naive status broadening. Frozen run snapshot IDs are authoritative for historical run explanations. No unreviewed route resolver modification permitted by current PR.

**Deployment stop gate:** one checksum-pinned atomic review package, complete writer bypass/privileged caller review, receipt-and-data-retention-aware rollback, fan-out deadlock tests, live permission negative roles, owner exact separate DDL approval. Keep issue #464 OPEN; WP10/WP11/WP12 OPEN, 10/13 formally closed.

See [historical reconciliation](WP10_RM1_G2_CI032_HISTORICAL_ROUTE_RECONCILIATION_2026-11-17.md) and [deep review](WP10_RM1_DEEP_EVALUATION_COMPLETED_PRM_2026-11-17.md). No production data, run, role or deploy changed.

## Live subgroup mapping fan-out / test target

Read-only live aggregate on 17 Nov 2026 shows **100** active products dependent on **12** effective approved subgroup mappings without an approved product override, **max 41 active dependent products in one subgroup** (mean 8.33). For the 12 mapped subgroups, the full set of active descendants in the read-only aggregate was likewise 100, max 41. A real lifecycle writer may lock **up to at least 41 product rows** in one reviewed subgroup transaction at today's distribution; this is a measured workload fixture bound, not a guaranteed future maximum.

`scripts/wp10-g2-safeguards/route-map-fanout-41.test.mjs` constructs **41 active products through the isolated SKU activation RPC**, then tests rejected harmful inactivation, valid replacement in one transaction, and 41 post-change canonical route validations. It prints elapsed times but explicitly **does not certify a production p95/p99 performance SLO**. Independent live contention, timeout, deadlock and owner UX acceptance remain required. No live DML.

## Future-approved precedence transition — narrow policy addition (17 Nov)

A currently valid subgroup route can remain valid on the **current** date even after a higher-precedence Product Route Family assignment is newly approved with `effective_from` in the future. If its target family has no effective route on that future date, the active product becomes invalid at the cutover. A guard validating only `costing.fn_wp10_today_ist()` cannot detect this.

The **review-only** RM1 candidate now checks `costing.fn_validate_effective_product_process_route(product_id,new.effective_from)` **in addition to current date** whenever a mapping has newly reached or changed APPROVED state and its effective_from is future dated. This is done inside the deferred final-transaction check and preserves valid future replacement if the target family has a valid effective route then.

`scripts/wp10-g2-safeguards/route-map-future-approval.test.mjs` builds a **baseline RED** example (future product map approved, present valid, future invalid), then requires **GREEN** unsafe future approval rejection, unchanged draft/current route and a valid future approval acceptance. Isolated PostgreSQL only; CI must be checked for this exact head. This safeguard is **not** a complete future-term horizon or arbitrary effective_to closure policy, which remains separately governed under the existing expiry/readiness workflow.

### Live future-map census (17 Nov IST)

A separate bounded read-only query counted currently non-archived APPROVED mappings by tier: **379 product, 16 subgroup and 0 group**, with **0 future-effective APPROVED records** in every tier. Therefore the new future-shadowing control is an isolated proof of a possible *future workflow transition*, not an observed problematic scheduled live mapping. The 455-product current/+7/+30 validator checks remain separate from this census. No production business mutation occurred.

## Existing protected route architecture — trigger inventory rechecked

A fresh read-only live trigger inventory confirms **pre-existing lifecycle protections**, not a blank or ungoverned routing schema. `production_route_family`, `production_route_family_route` and `product_process_route` each already have effective-date validation, approval-reference enforcement, approved-object immutability and WP04 epoch hooks (four triggers apiece). Family route steps and product-route overrides have dedicated immutability and epoch hooks (two apiece). The product mapping has an assignment guard plus effective-date/reference/epoch hooks (four). Subgroup and group mapping tables each have date-guard, immutability and epoch hooks (three). The WP04 source epoch trigger invalidates readiness evidence but does not itself veto an immediately route-breaking transition.

This corroborates the **minimal-change** strategy: the candidate RM1 active-product effective-route postcondition complements these safeguards and should not replace the already-completed route-family lifecycle or weaken the approval and history controls. The remaining edge cases are about cross-table downstream impact and effective-date precedence, not missing basic lifecycle governance. No triggers or records were changed in production.

### Security-definer schema CREATE preflight

A read-only live privilege check found `authenticated` and `anon` **cannot CREATE objects in public**, and `authenticated` **cannot CREATE objects in costing**, while `authenticated` may USAGE `public`. This reduces the particular search_path object-shadowing concern for the proposed `SECURITY DEFINER` review helper (`costing,public,pg_temp`), but is **not** a general security approval: the function's exact owner, grants, qualified callees, deferrable trigger semantics and future migration state still need independent inspection. No schema grants were changed.
