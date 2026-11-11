# WP05 R17 — authenticated CCC-scoped RPC identity matrix and performance gate (11 November 2026)

**Live factual checkpoint; W5-06 CCC-scoped read subgate PASS, overall W5-06 OPEN.** Owner and assistant performed the genuine signed-in PostgREST tests on the existing designated trial account, changing only its canonical costing-module grants between tests and restoring the original state immediately after each one. No JWT, password or response data is retained here.

## Authenticated evidence: precise scope

| Identity configuration | Live requested endpoint | Browser HTTP | Returned error and rows | Disposition |
|---|---|---|---|---|
| ID-V: CCC view=true, edit=false | `public.rpc_get_cost_sheet_sku_monthly_comparison_scoped`, monthly periods Nov/Oct/Sep | 3 data-path HTTP 200 in Supabase edge logs | Owner saw rows/render, no errors | **PASS**, functional positive |
| ID-X: CCC view=false, edit=true; five other modules view-only | same RPC, `p_period_start=2026-11-01,p_limit=1` | 400 | `P0001`, `denied:true`, rows 0 | **PASS**, server denial |
| ID-N: all six Costing modules view=false/edit=false | same RPC, period/limit as above | 400 | `P0001`, `denied:true`, rows 0 | **PASS**, server denial |
| ID-O: CSR view=true only; CCC view/edit=false | same RPC, period/limit as above | 400 | `P0001`, `denied:true`, rows 0 | **PASS**, exact CCC server denial |

Authenticated negatives are **actual owner-operated browser HTTP requests**, not only admin SQL simulations or tests inferred from hidden navigation. SQL rollback-only prechecks also passed separately, but they are not substituted for this evidence. The single reused account provides sequential permission-case coverage; it is not a test of simultaneous distinct accounts or of login/session revocation.

### Mandatory restoration and audit trail

After final ID-O test, assistant executed a guarded `UPDATE` inside a transaction to restore all six original `user_permissions_canonical` grants. An **independent subsequent `BEGIN READ ONLY`** checked: `grant_rows=6`, `restored_view_only=6`, `ccc_restored=1`, `edit_grants=0`. The dedicated trial account is back to its six-module view-only state. No other account, writer function, client flag, global deployment or schema was altered by the identity tests. Issue [#267 evidence](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/267#issuecomment-6799048413); [#273 scoped-RPC note](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/273#issuecomment-6799049227).

**Subgate decision:** **Cost Comparison CCC exact-module read authorization PASS** (positive ID-V + negative ID-N/X/O), with the authenticated HTTP boundary directly observed. **Do not** label parent W5-06 PASS solely on this test. Remaining parent obligations: SEC-A1/A2 server writer-denial (no production writer probes), shared-view 49-view policy and sensitive data classification, F1 unreviewed preview dependencies, and other retained restricted-identity coverage. ID-O's denial by THIS exact CCC-gated RPC is not an assertion that all shared Costing views prohibit CSR-only access.

## Cost Comparison timing — HOLD

Owner's first post-merge flag-ON ID-V browser reported **Nov 5.75, Oct 4.08, Sep 4.37** (interpreted as seconds; unit was not explicitly supplied). Supabase filtered API edge logs independently showed 3 substantive HTTP 200 RPC reads at **5386/3642/3970 milliseconds** origin, with a fourth 3ms lightweight request excluded from data reads. Period mapping to each edge log item was not independently proven; do not assign times by period from those logs alone. This is a successful functional read, **not p95**. Against the owner-requested **4000ms p95** target, single observed browser durations exceed target; one backend origin also exceeds it. No claim of p95 pass or October matched non-regression. Pre-existing view HTTP 500 at ~8s remains historical F; never erase frozen AE1 F.

**Next technical gate:** bounded read-only **EXPLAIN (not ANALYZE)** of the already-installed scoped function's inner plan and evidence-backed narrow tuning candidate, preferably isolated/offline regression, with full 63-column bag parity, negative-role guard retained, and matched 4-second sample before any new production DDL. Do not change statement timeout, create indexes, raise limits, add retries/fallback, or enable feature globally as workaround.

## WP05 programme status

W5-05 **PASS WITH RECORDED LIMITS** (separate [owner decision](WP05_W505_OWNER_CLOSURE_WITH_LIMITS_2026-11-11.md)). W5-06 **OPEN/PARTIAL** despite this completed read-only CCC RPC subgate. W5-04 **OPEN** (#24 functional recovery and authorization credited, timing HOLD). W5-03 partial; W5-07/08/09 partial; W5-10 open. AE1 frozen baseline 13 P / 4 historical F / 2 NA / 21 NT; no blanket status promotion. **WP05 OPEN and formal programme 6/13**, not 7/13.
