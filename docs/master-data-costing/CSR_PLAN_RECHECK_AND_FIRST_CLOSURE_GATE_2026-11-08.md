# 8 November 2026 — CSR two-timeout plan recheck and first 6/13 closure strategy

**Scope:** read-only public-view catalog and EXPLAIN (no ANALYZE), repository criteria audit. No data query scan, DDL, RPC call, statistics maintenance, index, grant, flag, deploy or approval/lock. **Formal closure remains 5/13.**

## A. The two authenticated historical errors remain distinct

On 5 November 2026, the signed-in PWA saw PostgreSQL 57014 timeouts (HTTP 500) for:
- `public.v_costing_pricing_printable_cost_sheet_product_summary`, period `2026-11-01`, sorted by product name/product ID, limit 1000.
- `public.v_cost_sheet_snapshot_sku_monthly_comparison_governed`, snapshot period `2026-11-01`, sorted by product name/SKU-column label, limit 2000.

Both public definitions are ordinary views owned by postgres, not materialised. The live view fingerprints at review:
- Printable: **`441bbc06003345b0b68d3468a2bfbec2`**, ~5,028-byte definition.
- Monthly comparison public wrapper: **`6ee1648b65833cff0d2f66eeda078ed4`**, ~2,024-byte definition. This is the **public wrapper**, not the separately recorded internal comparison view definition MD5 `63adf7946b8d7f99a01a05e5e54d00be`.

Nonexecuting `EXPLAIN (FORMAT JSON)` for the exact filtered/sorted/limited November shapes returned:
- Printable product summary top `Limit`: planner **Total Cost 137.34**, estimated **91 rows**.
- SKU monthly comparison top `Limit`: planner **Total Cost 6893.40**, estimated **9 rows** (wide **1788-byte** estimated row width), with sort/hash join under it.

These are **planner estimates, not latency measurements**. The current printable estimate is consistent with planner-statistics maintenance on 5 Nov, previously recorded as snapshot `ANALYZE`; it does **not** establish elimination of the historical 57014. The monthly comparison still has a heavier all-period pivot / cross-period join per prior independent EXPLAIN diagnostics, so November filtered request remains a candidate for scoped read optimisation.

Existing separate documents include [read-timeout diagnosis](CSR_READ_TIMEOUT_DIAGNOSIS_2026-11-05.md), [EXPLAIN-only gate](CSR_EXPLAIN_PLAN_GATE_2026-11-05.md), [post-ANALYZE verification](CSR_POST_ANALYZE_VERIFICATION_2026-11-05.md), [three-period planning variance](CSR_THREE_PERIOD_PLANNER_VARIANCE_AND_ISOLATION_GATE_2026-11-05.md) and [parameterised RPC design gate](CSR_PARAMETERIZED_RPC_DESIGN_GATE_2026-11-05.md). **Do not begin a fresh unbounded rewrite from scratch.** The pre-existing period-scoped candidate was not compiled, applied, authenticated, benchmarked or proved full 63-column parity; the October planner +1.7% case remains an explicit non-regression gate. No blanket statement_timeout increase to hide the defect.

### CSR next technical gate

1. Independently read and reconcile *all existing* CSR source/candidate packages against latest live function/view fingerprints (separating public wrapper from internal view); no catalog mutation.
2. Select safe, bounded real-data parity/sample windows for September, October, November and missing-history scenarios; choose isolation or owner-approved restricted SELECT-only trials with short timeout, no broad production count/aggregate scans.
3. Produce full 63-column, all-period run/valuation/selection-basis and permission parity; run genuine read-only ID-V after changes only.
4. If a specific minimum-risk candidate passes and removes the October regression, prepare a distinct reviewed migration/rollback PR, but **no apply/merge-before-approval assumption**.
5. Measure actual latency separately; only then resolve the 57014 findings.

## B. Why formal programme completion is still 5/13

The authoritative [programme completion matrix](PROGRAMME_COMPLETION_MATRIX_2026-11-06.md) and [work-pack acceptance package](WP05_WP06_WP12_AUTHENTICATED_ACCEPTANCE_EXECUTION_PACKAGE_2026-11-06.md) distinguish merged code, tests, real authenticated acceptance and owner-signed **work-pack closure**. Narrow solved findings do not increment a work-pack numerator.

Latest issue #211 and PR #214/#215/#217/#218 evidence **supersedes** the old 5–7 Nov assertion that no authenticated ID-V session was possible: served asset proof, verified six view/zero edit grants, genuine 1280/390 runs, Scheme Master, November governed Readiness, selector/subtab acceptance and security guard evidence now exist. These **must be credited** in the final work-pack closure audit, not ignored or rerun indiscriminately. But the acceptance package §8 still requires:
- authorised/pinned integrated build, real ID-V identity, a complete 40-lens P/F/NA/NT matrix without unexplained failures, real-data evidence, zero **server-delivered** mutating requests, and flag state restoration with evidence;
- each deferred finding to have a named milestone, residual risk, reason, identifier and explicit owner disposition;
- WP05/WP06 decisions including C6/C9/D3/D7 to be accepted or explicitly parked;
- work-pack **Gate Status** recorded with owner sign-off; WP12 has additional final-head regression and Windows A14 installer requirements.

A blocked client preview-name request must remain listed as a harness-contract observation, not be misrepresented as server-side write. The separately inspected Route Family preview call is view-permission-gated and has a read-only direct execution path; **do not change its allowlist without a separate reviewed approval**.

### Target the first legitimate 6/13

**Candidate: WP06**, subject to independent mandatory-gate enumeration; WP05 and WP12 may have additional cross-module / installer dependencies. Do NOT formally close WP06 yet. Make one small owner-decision/acceptance gap sheet that maps:
1. WP06's own declared mandatory gates (including G1/G1b–d, F7–F9, C9/D7/F4) to already merged source and current ID-V evidence;
2. Exactly which PPM workspaces, flag ON/OFF configurations, restricted server-denial cases and decision signatures remain *mandatory* vs explicitly deferrable;
3. A minimal safe owner acceptance session and exact tests for those outstanding gates;
4. Completion of a dated owner Gate Status entry **only when** every mandatory gate is evidenced.

This should be a **closure campaign**, not another open-ended UI improvement wave. Do not artificially move from 5/13 to 6/13 by relabeling isolated screen passes or suppressing blockers. WP12 Windows installer/11-flag acceptance is a separate later gate.

**Current programme score: 5/13 (38%)**, with significantly improved evidence coverage and narrower remaining acceptance questions. No reliable completion date can be inferred until the exact mandatory WP06 gate ledger is enumerated.

## C. Safe handover

- Backend/ChatGPT: continue CSR SELECT-only planning and WP06 requirements evidence reconciliation.
- Claude in a fresh isolated cloud or local repo-only session: prepare bounded WP06 closure ledger and test inventory against current `main`, **without app/DB writes**. Local authenticated/browser sessions stay local and never commit screenshots, tokens or identities.
- Windows C: reportedly full; D: can be used for temporary redacted evidence only; no automatic deletion.
- No migration, cost refresh, preview RPC allowlist expansion, permission/flag change, merge-dependent automatic deployment or Electron release without separate owner authorisation.
