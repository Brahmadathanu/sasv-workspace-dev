> **R32 EXECUTION-DECISION PREFLIGHT — 12 NOV 2026:** [R32 live metadata and deployment gate packet](WP05_R32_PPM_AUDIT_PRODUCTION_EXECUTION_DECISION_PACKET_2026-11-12.md) confirms unchanged original scheme audit view MD5, 20 columns, ACL owner/service_role denial, PPM target and permission-function hashes; **no execution authorised**. Draft #311 is now 2 commits behind current main and requires exact-head reconciliation/test before production approval. W5-06 OPEN, programme 6/13.

# WP05 R31 — independent Option A permission review; real SQL ACL parity (12 November 2026)

**Review gate, not an execution order.** User owner approved Option A for `public.v_costing_scheme_master_audit` under R28. This report reviews the **DRAFT / UNMERGED** implementation candidate [#311](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/311). No production view rewrite, SELECT from audit rows, role/session change, writer invocation, grant or deployment occurred. W5-06 OPEN, formal programme 6/13.

## Critical independent review finding and correction

The initial R30 isolated PostgreSQL fixture **incorrectly granted SQL SELECT on the audit view to `service_role`**, and therefore overstated its claimed privileged-service continuity. Live production **catalogue-only** review on 12 November establishes:

- `public.v_costing_scheme_master_audit` owner `postgres`, original definition MD5 `001024540bdeab9f2e5aa4ec2a6f6c53`, comment "Controlled read-only Scheme Master lifecycle history. Underlying audit table remains protected."
- Actual view `relacl` = `{postgres=arwdDxtm/postgres,authenticated=r/postgres}`. `has_table_privilege(...,'SELECT')`: `postgres=true`, `authenticated=true`, `anon=false`, **`service_role=false`**. PostgreSQL `rolbypassrls` for service_role does **not** override the missing SQL view SELECT grant.
- `permission_targets` confirms `module:pricing-policy-manager` is a module-level **assignable** key; `app_modules` confirms `pricing-policy-manager` is **active, assignable**, and its target is `module:pricing-policy-manager`. The policy references a real exact target key, not a guessed name.

Although the original and candidate **outer view predicates** include `service_role` as a privileged current-user exception, that branch **does not grant SQL SELECT** to the service role. Owner R28 Option A approved no service-role grant, and none is proposed. The correct candidate must preserve this pre-existing SQL-privilege boundary.

## Corrected candidate safety proof

Draft PR #311 now:

1. Gives its synthetic fixture **only `authenticated`** SQL SELECT (owner's implicit rights remain), *not* service_role; records service_role SELECT denial before the view change, after the candidate, and after rollback.
2. Includes view-specific precondition/postcondition that `service_role` has **no SQL SELECT**. A synthetic adversarial test grants SELECT to service_role and confirms the candidate **refuses to apply**; the fixture then revokes the test grant.
3. Retains the owner-approved Option A outer predicate: authenticated PPM View passes, CCC/CBM/CSR/MCM-only View does not; PPM Edit without View does not. The SQL does **not** modify `fn_costing_view_allowed`, base audit table permissions, 20 view columns, owner, PWA client, or any other five D-2 views.
4. Preserves the exact candidate definition MD5 `e2b9eb3c1b86d073183cd376f704cf58` as the guarded rollback's starting-state requirement; the rollback must not overwrite an intervening change.

**Latest exact-head CI:** [43164967909](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43164967909), PostgreSQL **17.11** isolated service, **10/10 database integration checks PASS**, parallel no-database structural suite **PASS**. Deliberate SQL errors (`permission denied`, drift guard, rollback guard) occur **inside expected-negative tests** and count as passing checks. All test rows/UIDs/permission entries were fabricated in the disposable database; the server is PostgreSQL 17.11 (the runner's `psql` client reports version 18.6, not the server version).

**R30 historical 9/9 remains a valid earlier log for its then-fixture but is superseded for any claim concerning service_role privileges.** R31 is the current independently reviewed evidence. The later draft PR #311 code has not been merged into main, and not run against the live Supabase instance.

## Residual checklist — exact state

| Gate | Status |
|---|---|
| Business access contract: Option A | **OWNER APPROVED** (R28) |
| Live permission target / original view metadata | **CATALOGUE VERIFIED** |
| PostgreSQL 17 candidate apply, role behaviour, rollback, drift denial | **ISOLATED PASS 10/10** |
| Protection of existing service_role SQL SELECT denial | **ISOLATED VERIFIED / LIVE CATALOG CHECKED** |
| Independent preflight of actual view and grants immediately before any execution | **REQUIRED AGAIN AT EXECUTION TIME** |
| Separate owner authority to apply this SQL in production | **NOT YET GRANTED** |
| Actual positive PPM / negative Costing-only signed-in users on hosted Supabase | **NOT TESTED** |
| Business policy and access review of the other five D-2 selected views | **OPEN** |
| Parent W5-06, W5-10 | **OPEN** |

### Go/no-go guidance

The candidate is **technically reviewable**, but **not cleared for unattended production execution**. A future owner production approval should be made against exact SQL files/PR #311 and the current view/ACL fingerprints, with a governed change window and rollback permission. Immediately before applying, re-query catalogue-only MD5, 20 column names/types, owner, `relacl`, PPM permission target, client import compatibility and absence of intervening migrations. If any drift, **STOP** and refresh the candidate. After any separately approved execution, do non-sensitive metadata checks and a separately approved, least-privilege authenticated role test without row exports. No global flags, cache bump or browser redeployment is part of the server view change.

**Formal truth unchanged:** WP05 OPEN, 6/13; W5-06 D-2 remaining five reader policies + production positive/negative proof pending; D-1 production writer-denial NOT TESTED by owner acceptance; Cost Comparison 4-second p95 HOLD.
