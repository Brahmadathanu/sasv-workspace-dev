# CDE-2 — live contract correction and pre-migration gate (6 November 2026)

**Status: DOCUMENTATION-ONLY, REVIEW REQUIRED.** This addendum corrects the merged proposal `CDE2_RPC_PROPOSED_SQL_FOR_SERVER_REVIEW_2026-11-06.md`; that proposal is **NOT executable as written**. Do not apply it, copy it into migrations, grant EXECUTE, or connect the inert CDE-1b adapter. No write, migration, deployment, cache bump, flag change, or formal work-pack closure is authorised. Costing closure remains **5/13**.

## Source of verification

Independent SELECT-only live Supabase checks on project `qhmoqtxpeasamtlxaoak` on 6 Nov 2026, following 5 Nov source audit and merged PR #201. See the 6 Nov independent review comment on PR #201. These are schema/aggregate observations **not** authenticated role-context proofs, compile tests, or mutation-free functional validation of a new RPC.

## Blockers in the present SQL draft (must fix before a compile test)

1. `public.require_permission` live signature is **`(p_target text, p_need_edit boolean)`**. The draft's `require_permission('module:costing-control-center','view')` is invalid. Proposed CCC VIEW check: `perform public.require_permission('module:costing-control-center', false);` — independently confirm function semantics and exception behavior via `pg_get_functiondef` before use.
2. `costing.costing_refresh_run` identifies the run by **`id`**, not `refresh_run_id`. Lookup must use `id = p_refresh_run_id`, constrained by `period_start` and governed run status/valuation source.
3. `v_eligible := false` is **intentional** and must remain fail-closed until D2/D3 eligibility is formally decided and a separately reviewed migration authorised. Never make the predicate `overall_status='SUCCESS'` alone.
4. The current draft returns `empty` for malformed inputs and `forbidden` for missing/ineligible runs. A common envelope for missing, wrong-period, approved/failed/ineligible run must be preserved; review whether malformed identifiers can safely be distinguished without an existence oracle. Avoid exception details that leak run/SKU existence.
5. The proposed regional duplicate query only guards duplicate region rows. Validate exact IK and OK membership, row period/valuation match, and the full set of source identity keys, not solely run+SKU. Treat inconsistent/multiple rows as error; legitimate missing region should be UNKNOWN only if policy allows it.

## Confirmed live source parity — runs 148 and 149

- Both runs are `SUCCESS`, with `valuation_context_source='CAPTURED_AT_REQUEST'`. Run 143 (October) is APPROVED; 148 is a newer successful but unapproved October draft; 149 is a successful unapproved November draft; 150 is FAILED and must not be selected. Both October and November periods were OPEN at verification.
- Across **628 SKUs per run**: prime/control/direct-labour/conversion joins have **zero missing source rows and zero period/valuation identity mismatches** (checked at run+SKU); prime and control `material_costing_status` agree **628/628** per run.
- `sku_prime_cost_snapshot.internal_material_conversion_status` matches `sku_internal_material_conversion_snapshot.conversion_status` per run: **625 READY, 3 REVIEW_REQUIRED**.
- Regional rows per run: **628 IK + 628 OK**; no other region codes observed. This is not a blanket assertion that all future or historical runs have matching coverage.
- Explicit authoritative field choices proposed: `material_costing_status` from prime (cross-check against control), `internal_material_conversion_status` from prime (cross-check against conversion), `first_control_status/control_severity` from control, direct labour fields from allocation, regional statuses from region snapshot. If parity fails in a requested run/SKU, fail closed rather than preferring one source.

## Timestamp semantics (D4)

On **all 628 SKUs of each run**, prime `refreshed_at` differs from control `snapshot_refreshed_at`: these are *stage timestamps*, not contradictory run identity. For 148, prime is around 20:46 UTC, control around 21:00 UTC, run finished 21:05 UTC; 149 shows the same stage order. For the UI wording **Frozen run**, propose projecting `costing_refresh_run.finished_at` as `refreshed_at` (JSON timestamp string), if verified nonnull for eligible completed runs. Do not pretend a stage's `refreshed_at` represents the final run completion.

## Free text and monetary/PII risk

Aggregate screening of the 148/149 source rows (no note bodies retrieved in the review):
- `regional_basis_note` contains digits and finance-related keywords in **69 of 1,256 regional records per run**.
- `allocation_resolution_note` contains digits in **628/628** per run; finance keywords in **570/628** for run 148 and **571/628** for run 149.
- `control_note` is populated **628/628** per run; it contains finance-related keywords but no digits in the tested samples. Keyword screening is conservative, not proof that the text contains disclosed monetary amounts or PII.

**Safer v1 response:** return `null` for `allocation_resolution_note`, `blocker_note` and `regional.IK/OK.note`, unless a separately audited code-to-safe-message mapping is approved. Never pass raw free text through just because the JSON key is permitted. Preserve machine status codes for useful evidence; UNKNOWN remains UNKNOWN.

## D1–D5 decision register — proposed policy, NOT an owner approval

| Decision | Recommended bounded disposition |
|---|---|
| D1 | Single per-run/per-SKU CCC-VIEW, nonmonetary versioned read RPC, principle only |
| D2 | Explicitly reject approved runs from **draft** evidence RPC; use same outward denial for missing/unauthorised identities |
| D3 | Permit only an exact successful, *unapproved* run whose period/valuation/context and persisted snapshot integrity are verified under the server's authoritative eligibility contract. For v1, restrict to OPEN periods and selected, explicitly addressable draft runs; never infer permission from mere retention or SUCCESS. The exact eligibility predicate is **still unresolved** pending cross-run historical and permission review. Failed run 150, approved 143, foreign-period identities and unverified 80/82 must not become positive cases by accident |
| D4 | Use completed run `finished_at` as the UI frozen-run timestamp after contract verification |
| D5 | Investigate an existing read-audit mechanism and a defensible throttling option. If none exists, surface the residual risk for explicit owner decision; do not invent a new table or a hidden business write |

## Mandatory pre-migration verification

1. Read exact `pg_get_functiondef` of permission helper and the existing security-definer conventions; validate `search_path`, definer ownership, EXECUTE revocation for `PUBLIC`/anon, explicit authenticated grant, and no direct table grants.
2. Verify complete run-status/effective-designation logic including historical 80/82, run 143/148/149/150, later refresh behaviour, period OPEN/CLOSED transition, and whether snapshots are immutable after a subsequent refresh.
3. Prove complete source identity equality on `period_start, refresh_run_id, valuation_date, sku_id` wherever each field exists; reject missing, duplicate or mismatched rows, including exact IK/OK regions.
4. Use only explicit whitelisted SQL columns; no `SELECT *`, `row_to_json`, monetary values or raw free-text fields. Review numeric and nested JSON output; client reject-filter is defence in depth, never the primary data boundary.
5. Compile/test on an isolated PostgreSQL environment *before* production proposal; negative role-context tests: anon, authenticated lacking CCC, CCC-view, CCC-edit; failed/approved/missing/foreign/closed/stale run and nonexistent SKU; no existence leakage; 143/148/149/150/80/82 isolation.
6. Check the result does not change any business table, approval state, refresh pointer, or audit records other than separately approved security telemetry. Obtain explicit owner authorisation for any final migration, then separately authorise adapter wiring and authenticated acceptance.

## Implementation sequence

**Now:** this documentary correction + independent review only. **Next:** resolve D1–D5 and authoritative eligibility using further read-only checks, followed by an isolated compiled migration candidate and security tests. **Later:** explicitly approved server migration/read-back, independent client wiring PR, read-only authenticated acceptance with genuinely restricted account, and formal work-pack closure. Never use a production-linked Netlify preview with a highly privileged test login as proof of read-only access.

Reference: merged #201 (inert adapter + non-executable proposal), merged #202 completion matrix, `CDE2_LIVE_SOURCE_CONTRACT_AUDIT_2026-11-05.md`, `CDE2_OWNER_REVIEW_PACKAGE_2026-11-04.md`, and `COSTING_SUITE_UNIFIED_WORKFLOW_2026-11-02.md`.
