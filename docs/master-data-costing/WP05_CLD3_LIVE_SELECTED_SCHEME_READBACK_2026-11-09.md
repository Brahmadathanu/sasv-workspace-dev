# WP05-CLD3-LR1 — Selected-scheme live readback supplement (9 November 2026)

**Status: owner-authorised, SELECT-only verification supplement to merged CLD3 PR #244.** No application RPC invoked, data modified, auth identity used, permission altered, flag switched, or build deployed. WP05 OPEN; programme **6/13**; no B1 approval or 40-lens ledger promotion.

## 1. Live source availability and provenance

Live database contains both `costing.v_sku_selected_scheme_policy` (view-definition MD5 `9778d7d497e58a850cc046cdd4848d5f`) and `costing.v_costing_policy_manager_sku_overview` (view-definition MD5 `ded6fe135fe9d2cf32022230f30f3fd2`). The selected-scheme context writer `costing.rpc_refresh_sku_selected_scheme_policy_context_snapshot` exists, definition MD5 `ea9949960ed388fafee4bdc40f6999cc`. **These are catalogued definitions and fingerprints, not proof of semantic equivalence, side-effect safety or successful run execution.** Function was not invoked. CLD3's statement that their bodies are missing from the *repository* remains true, but they are available from the *live catalogue*; any follow-up comparison must read and analyse their text without invoking them.

The live snapshot `costing.sku_selected_scheme_policy_context_snapshot` has a unique constraint on `(refresh_run_id,sku_id,region_code)`, region CHECK IK/OK, status CHECK `RESOLVED_POLICY / DEFAULT_NO_SCHEME / BLOCKED`, and lineage CHECK separating resolved from default. The presence of a non-null `scheme_id` is **not a valid proxy for resolved selection**: default rows in all inspected runs have non-null scheme ID.

## 2. Historical per-region resolution distribution

Only bounded aggregated SELECTs were executed, without product/SKU-level disclosure.

| Frozen run | Context | IK RESOLVED | IK DEFAULT | OK RESOLVED | OK DEFAULT | SKU count | Exactly one IK + one OK | Both regions RESOLVED |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| **143** | Oct 2026, valuation 2026-10-22 | 600 | 27 | 600 | 27 | 627 | **627** | **600** |
| **149** | Nov 2026, valuation 2026-11-02 | 601 | 27 | 601 | 27 | 628 | **628** | **601** |
| **151** | Nov 2026, valuation 2026-11-09 | 601 | 28 | 601 | 28 | 629 | **629** | **601** |

No `BLOCKED` resolution rows appeared in this distribution. The one-IK/one-OK invariant is **verified by data** for run 143 (including before CI-037) as well as 149 and 151: zero invalid pairs. The per-SKU bilateral resolved count is computed on the same `(refresh_run_id,sku_id)` grouping, not by separately assuming IK and OK aggregates select identical SKUs.

At read time, `public.v_costing_policy_manager_sku_overview` returned **629 current rows**, **601** with both current IK/OK selected IDs non-null (28 missing). Thus **run 151 S-A bilateral RESOLVED = 601 equals the contemporaneous current overview numerator 601**. This is meaningful parity evidence supporting the S-A candidate definition, but is **not yet a proof of identical algorithm/selection-priority semantics**: definitions remain to be compared and policies can change after frozen valuation.

## 3. Live F1 wrapper/internal properties (catalogue only)

| Function | Volatility | Security | Anonymous EXECUTE | Authenticated EXECUTE | Definition MD5 |
|---|---|---|---|---|---|
| `public.rpc_preview_route_family_route_steps(bigint,date,date)` | VOLATILE | SECURITY DEFINER | no | yes | `4ff8d1f4e17520de59ab744196d83ba7` |
| `costing.fn_preview_route_family_route_steps(bigint,date,date)` | STABLE | SECURITY DEFINER | no | yes | `3f694a889c1d69d4a2dd563b28419356` |

The public wrapper's live body was separately read in CLD2: `require_permission('module:production-route-manager', false)`, then calls the internal function. **No preview RPC executed.** Volatility, ACLs and fingerprints alone do not prove that the internal call chain is side-effect-free. F1 stays outside any expanded runner allowlist pending independently reviewed live-body/callee text and explicit owner approval. This supplement does not approve negative-identity behavioural testing.

## 4. Corrected decision position

- **Q-L1 / historical scheme numerator:** the frozen bilateral `RESOLVED_POLICY` count (S-A) is now a **strong, live-data-supported candidate** for historical policy coverage: Oct run 143 **600/627**; Nov run 149 **601/628**; Nov current-successful 151 **601/629**. It is **not yet authorised as the new KPI**. Owner must confirm that coverage should mean explicit IK+OK policies resolved as of the frozen valuation date, not mere availability of default/no-scheme context or current as-of policy. Assess selection logic equivalence from live view and writer definitions, then prepare a separate governed server migration with tests and rollback.
- **Q-F1:** LIVE_CATALOGUE_OBSERVED for wrapper/internal metadata only; **no behavioural/side-effect PASS** and no allowlist change.
- **Q-C5, Q-SEC, Q-B1:** unchanged. Historical PRM source filter still needs reconciliation; W5-06 negative identities untested; original shared §8 remains binding.

No new costing refresh was launched. These SELECT-only results must not be confused with the distinct historical PAR1 UI S2/S9 acceptance on run 149 or interpreted as WP05 formal closure.

**WP05 OPEN; programme 6/13; AE1 13 P / 4 historic F / 2 NA / 21 NT unchanged.**
