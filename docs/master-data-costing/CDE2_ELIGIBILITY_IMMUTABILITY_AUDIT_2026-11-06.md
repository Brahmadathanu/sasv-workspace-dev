# CDE-2 — run eligibility, immutability and privilege audit (6 November 2026)

**Scope: live SELECT-only catalog and governed-view inspection; NOT production migration authorization.** Follow-up to merged #203; all findings below are read-only. No RPC, grant, production writes, refresh, feature flag, client wiring or release. Formal programme closure remains **5/13**.

## 1. Verified permission helper

Live `public.require_permission(p_target text, p_need_edit boolean DEFAULT false)` is `SECURITY DEFINER`, checks `auth.uid() IS NOT NULL`, and requires matching `public.user_permissions_canonical` row with `can_view=true`; `can_edit=true` is additionally required only if `p_need_edit` is true. **The existing proposed SQL must pass boolean `false`**, not the text `'view'`. It raises on denied access; wrapper should return a constant, non-sensitive denial without disclosing run existence, while retaining a testable deny path. Exact role-context denial proof remains OPEN.

## 2. Actual governed selector and historical drafts

`costing.v_current_successful_costing_refresh_run` restricts candidates to `overall_status='SUCCESS'` and `valuation_context_source='CAPTURED_AT_REQUEST'`, then ranks approved runs above other successful runs for a period. `costing.v_costing_period_run_status` separately exposes `latest_success_run_id`, `newer_draft_run_id`, `latest_draft_run_id`, period status and effective designations.

| ID | Period | Run | Effective designation | Period | Selector context |
|---|---|---|---|---|---|
| 80 | 2026-07 | SUCCESS | none | OPEN | displayed/latest draft 80 |
| 82 | 2026-08 | SUCCESS | none | OPEN | displayed/latest draft 82 |
| 143 | 2026-10 | SUCCESS | APPROVED | OPEN | displayed approved 143; official pricing |
| 148 | 2026-10 | SUCCESS | none | OPEN | newer draft 148; official display still 143 |
| 149 | 2026-11 | SUCCESS | none | OPEN | displayed/latest draft 149; not for pricing |
| 150 | 2026-11 | FAILED | none | OPEN | not eligible |

**Important:** `SUCCESS + OPEN + not APPROVED` would also permit historical 80/82. The draft evidence RPC must not automatically treat every old retained successful snapshot as authorized. Conversely, the displayed official run for October is APPROVED 143, so filtering solely on `displayed_run_id` would incorrectly omit draft 148. A separate exact draft-review eligibility contract and owner decision D3 is necessary; no default eligibility predicate is authorized.

## 3. Snapshot mutation protection: NOT uniformly equivalent

Catalog lists AU-2 **designated-run row guards** (APPROVED / REFERENCE / REVOKED) and **TRUNCATE-denial** on all five snapshot sources:
- `sku_prime_cost_snapshot`, `sku_internal_material_conversion_snapshot` and `sku_regional_marketing_expense_allocation_snapshot` additionally use `fn_enforce_mutable_refresh_run_snapshot`. The function rejects row writes on refresh-run statuses other than QUEUED/RUNNING/FAILED; therefore it rejects `SUCCESS` mutation through those trigger paths.
- `sku_costing_control_status_snapshot` uses `fn_guard_stage05_exact_snapshot_write`, requiring matching writer-validated session context, but this function **does not independently assert that the referenced run status is mutable**. Its designated-run guard protects 143; for undesignated SUCCESS 148/149 its effective protection must be independently assessed in the full writer pipeline and privileges.
- `sku_direct_labour_allocation_snapshot` has designated-run and TRUNCATE guards, plus a lineage-stamp INSERT trigger; the inspected trigger list does **not** show the generic mutable-run guard. This is not proof that ordinary callers can mutate it; privilege/writer checks may exist elsewhere. It IS insufficient evidence to claim all five sources are immutable after a SUCCESS run.

**D3 conclusion:** prove snapshot integrity protections table by table, including direct-labour and control sources, before using retained-run immutability as an eligibility assumption. No test mutation should be attempted on production.

## 4. Live table privileges (catalog, not signed-in role test)

| Snapshot | authenticated SELECT | anon SELECT | RLS |
|---|---|---|---|
| prime cost | no | no | yes |
| direct labour allocation | yes | no | yes |
| internal material conversion | no | no | no |
| control status | yes | no | yes |
| regional marketing allocation | no | no | no |

No direct grants to protected tables are authorized. A controlled security-definer projection should enforce CCC-view inside the function, fix `search_path`, revoke `PUBLIC`/anon EXECUTE, use explicit non-monetary column lists and constant denial for missing/ineligible runs, and be tested as real authenticated and unauthorized users. The `authenticated` role's ability to SELECT a relation is not proof a particular user passes its RLS policy.

## 5. Recommended conservative v1 eligibility (PROPOSAL, D3 owner-gated)

- Exact `period_start`, run ID, valuation date and SKU; no implicit latest-run substitution.
- Run must have `SUCCESS` and `CAPTURED_AT_REQUEST`, completed non-null `finished_at`, and no effective APPROVED/REFERENCE/REVOKED designation; period OPEN.
- Restrict to an explicitly approved **draft review selection** from the canonical period/run status, allowing October's `newer_draft_run_id=148` and November's `latest_draft_run_id=149` in current evidence. Historical `80/82` need deliberate owner treatment, not accidental inclusion merely because their status columns currently resemble November.
- Fail closed on any source row identity, cardinality, privilege, or immutability uncertainty; return no raw notes, money, sales or PII.
- Re-evaluate eligibility at request time; use a narrow separate historical review route only if later expressly authorized.

This is a **decision proposal**, not a rule ready to encode. Determining a practical historical exclusion rule (which might be based on a formal active-review register, not calendar age) and full snapshot immutability remains outstanding.

## 6. Next engineering work (no production mutation)

1. Claude: prepare a corrected **unapplied** SQL candidate in a fresh isolated branch, never copy the old proposal verbatim. Unit/static negative tests for run lookup `r.id`, `require_permission(...,false)`, complete identity, null notes, explicit whitelist, denial parity and no caller wiring.
2. Server review: inspect writer functions, role grants, RLS and immutable-run enforcement for direct-labour and control snapshots; decide if an authoritative active-draft-review register already exists. Review existing read-audit mechanism (D5).
3. Designate D1/D2/D4 provisionally; D3 and D5 remain specifically unresolved until evidence and owner acceptance.
4. Compile in an isolated PostgreSQL instance, perform positive/negative role-context and run identity tests, then seek separate migration authorization. The CDE-1b adapter remains disconnected.

This document does not close WP05/WP06/WP12 or authorize a PWA/Electron release.
