# WP10 G1 — Final independent review and G2 decision package (15 November 2026)

**G1 READY FOR OWNER ACCEPTANCE; WP10 OPEN, programme 10/13.** Reviewed #439 at 53165435cd360156911ca056a0c810ba879e7694; base main 5ad28a87. Audit/test files only; no activation/readiness runtime, SQL application, permission, registry, flags, deployment or merge. Leave five CRLF-only migration differences untouched.

## Independent verification
ChatGPT freshly ran catalog parity: 48 PASS / 5 NOT PROVEN; client contract: 19 PASS / one pre-check finding, with the separately recorded lifecycle baseline 100 PASS / 2 FAIL. Fresh transition and mutation reruns here are SKIPPED because PostgreSQL binaries are unavailable; committed author results 56/56 and 9/9 were inspected, not relabelled as fresh local runs. Generated writer matrix (8 rows) and dependency trace (16 rows) reproduce byte-for-byte.

Fixture provenance is appropriately bounded: captured writer, product guard, price-list, change-log, MRP/selling/route-family resolver, epoch and fingerprint bodies are exercised against synthetic tables. Route validation and auth/permission/normalization stand-ins and the portfolio model remain explicit. These are not production transactions, actual roles, audit-table immutability acceptance or a tested production builder. Five NOT PROVEN results remain accepted audit limitations, not PASS.

F14 uses the captured supported product-update writer and route-family resolver; it demonstrates a subgroup change can remove a resolved route for an active SKU. The unavailable route-validation chain does not invalidate this no-family scenario, but alternate complex route validation remains unproven. Do not generalise it to all subgroup edits or silently impose a blanket master-data freeze.

P2 now correctly separates current-operational expiry from fixed governed-period readiness. G2 must inspect **all relevant effective boundaries inside the horizon**, not merely compare today with today+N: a gap or ambiguity can occur mid-window and recover before its end. Date-parameterised resolvers and a reviewed batch-size predicate must remain authoritative; do not alter CI-038a, LIVE_AS_OF, fingerprint or the five-essential list.

## Bounded live build metadata follow-up
ChatGPT read only the five latest build rows (four exist) from product_sku_readiness_portfolio_build. November build 7 is marked COMPLETED/current for period 2026-11-01 and valuation 2026-11-02; started 12 Nov 16:49:58 IST, completed/promoted 16:50:41 IST, about 43 seconds. This is history, not proof the source fingerprint still matches or a build-age SLA was breached. No current source fingerprint/readiness function or builder was called; no current affected-SKU count inferred. Raw metadata is committed separately.

## Business recommendations — pending owner
| Decision | Proposed initial disposition |
|---|---|
| O1 ownership | Programme owner is accountable until a named Costing Control Center operator is nominated; operator reviews and follows up, dependency owners remediate. No new access grants implied. |
| O2 cadence/target | Manual review each working day; unresolved stale state assigned/followed up by the next working day. Rebuild only through an exact owner-approved operational procedure. No scheduled builder in this package; measured history is insufficient to choose its frequency safely. |
| O3 expiry | 30-day current-operational horizon, inside existing surfaces. Each row identifies the responsible specialist screen/owner; no email/message or automated notification is authorised. Review all effective boundaries and ambiguous states within the window; preserve period semantics. |
| O4 drift | Reject unreviewed active-SKU re-parenting if prevention is approved. For supported route-changing product edits, require impact/remediation review; reject loss of mandatory essentials only under a reviewed server contract. Do not block every subgroup edit, auto-deactivate or change existing rules in the audit. |

O5 read-only authority is already satisfied and must not be requested again.

## One G2 draft implementation package, after approval
One branch/one draft PR, reusing #439 evidence and existing modules. Deliver:
1. Existing Readiness lens explains STALE/ABSENT/INCOMPLETE, governed period, accountable owner and manual runbook. Preserve fail-closed reads; propose a narrow read-only metadata endpoint only if necessary.
2. Manage Products activation pre-check uses existing RPC and renders missing codes/owner destinations plus structured rejection detail. Server remains authoritative; re-check on actual submission and handle time-of-check/time-of-use, cancellation, changing selection, unavailable checks and ambiguous PM BOM without false READY.
3. Design and implement the approved current-operational horizon in existing surfaces using canonical date-aware contracts, with bounded paging/query budgets and no side-effecting build calls. Include all in-window gaps/overlaps, future replacement coverage, today/future valuation distinction and batch-size contract. New SQL stays unapplied for independent review.
4. Implement only approved drift prevention/impact flow, with isolated fixtures for direct privileged re-parent and supported product reclassification; include normal edits unaffected, permissions, error rollback and audit semantics.
5. Product-without-SKU visibility may be included through existing read paths if available; no new launcher or duplicate readiness system.
6. Meaningful fixture/mutation/Chromium tests, real role acceptance NOT TESTED until separately executed. Preserve historical baseline failures and all WP11/WP12 cases. No source rewrite of live-only functions merely to create repository parity; snapshot provenance may document them without reapplying.

G2 approval would authorise a draft implementation and unapplied server proposals, not production SQL, cron, grants/RLS, feature activation, deployment, release or formal WP10 closure. No external messages or notifications. Independent ChatGPT review and owner exact production authority remain later gates.

## Gate verdict
All required G1 questions have evidence or explicit honest bounds. The audit can be accepted; there is no need for another G1 handover or blanket database-access permission. Owner decisions O1–O4, audit integration and draft G2 authority are still pending. Do not mark WP10 closed or advance 10/13.
