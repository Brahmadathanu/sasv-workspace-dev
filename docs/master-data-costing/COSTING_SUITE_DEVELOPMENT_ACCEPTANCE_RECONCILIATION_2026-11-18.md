# Costing Suite — development acceptance reconciliation (18 Nov 2026)
**REVIEW-READY EVIDENCE MATRIX, NOT FORMAL CLOSURE.** Owner directed separate application/server Costing Suite acceptance from combined Electron release, and suspend Bitdefender-blocked unsigned OFFICE TEST installation. Read-only synthesis of existing receipts; no new live signed-in access, production modification, SQL, permissions change, binary publication, installer execution or WP closure action.

## Scope separation
- **Development acceptance** covers merged server functions, shared client source, authorised live PWA use, governance rules, writer-guard static/contract checks and documented operator acceptance. It cannot be inferred from packaged-app source parity alone.
- **Electron distribution** covers Windows packaging/signing, Bitdefender compatibility, Electron-specific startup/IPC/userData, per-client updater/rollback, installed staff fleet and legacy classification-client compatibility. **DEFERRED; Electron release HOLD.**
- **Security cutover** is a material operational dependency of WP10, not a mere desktop UI test: four root classification tables retain authenticated INSERT/UPDATE/DELETE with identity-only RLS. App-level controls and governed RPCs do not eliminate direct-table exposure.
- **Labels:** PASS (actual accepted evidence), PARTIAL (narrowed genuine evidence), NOT TESTED (no eligible observation), CONFIRMED OPEN RISK, DEFERRED (owner-scoped out of immediate development receiving, not passed), and DECISION REQUIRED. A test waived by owner cannot be relabelled PASS.

## Positive evidence to preserve — no redundant rerun
| Area | Receiving label | Grounded existing evidence / limits |
|---|---|---|
| WP00–WP09 and WP11 | **CLOSED** | Owner decisions already recorded in master programme. Do not reopen absent regression. |
| WP11 mobile PM BOM, SKU Deactivate, deployed PWA | **PASS** | Actual 390px populated responsive proof, visible Deactivate label without activating, installed PWA v393→v394 activation; 74/74 hosted costing bytes match reviewed main. |
| Six Costing entrypoints in an existing signed-in account | **PASS — SINGLE-IDENTITY SCOPE** | Previously accepted populated read observations; not three independent roles. |
| Cost Comparison November 2026, installed mobile PWA | **PASS — OWNER-REPORTED VISIBLE FUNCTION** | After single-table approved ANALYZE, owner stated the table **loads seamlessly**. Do not infer 200 status, request latency, default-OFF flag state on that device, p95 or causation. |
| Comparison scoped RPC functional/denial probes | **PASS FOR PREVIOUS LIMITED CASES** | Previously accepted true RPC HTTP 200 and invalid/restricted-ID HTTP 400/P0001. Does not prove normal OFF-path p95. |
| Seven sensitive view definition/grant audit | **PASS — CATALOG ONLY** | Seven out of seven source definitions/invoker/SELECT policy checks; NOT live JWT negative GETs. |
| Offline 11-flag combinatorial source/client sweep | **PASS — MOCKED ONLY** | Inert Chromium 21/21 for 11 OFF, each individually ON, ALL ON, six pages; no production flags toggled. |
| New comparison candidate research | **PASS — OFFLINE PARITY ONLY** | PR #473 fixture/parity work; live governed SKU counts 627–634 are well below 2000 cap. Not the chosen performance fix; remains unapplied. |
| Stats maintenance | **PASS — OPERATION VERIFIED** | Owner-approved `ANALYZE` on `costing.cost_sheet_line_monthly_snapshot`, `last_analyze=2026-11-17 15:58:48 UTC`, modifications-since-analyse 0 at confirmation; mixed nonexecuting plan costs. Not a clinical performance or p95 result. |

## WP10 outstanding receiving gates (development/security)
| Gate | Status | Smallest valid next evidence or disposition |
|---|---|---|
| Four classification modules use governed create/rename/delete RPC | **PASS — MERGED SOURCE + RPC CATALOG** | Current source uses 12 named `rpc_wp10_*` writers; 12 function ACL/security properties previously accepted. Installed fleet and real editor transaction not implied. |
| Distinct existing Editor and View-only permissions, UI read-only behaviour on current build | **PARTIAL** | Legacy Costing view-only acceptance evidence exists for some modules; exact WP10 four-root-module real-identity receiving not fully certified. Existing signed-in identities only; no production mutation. |
| No-access role and seven sensitive view minimal denied HTTP GETs | **NOT TESTED** | Requires genuinely independent, authorised No-access/denied-role JWT and approved metadata-only request procedure. Catalogue parity cannot replace. |
| Four-table direct base-table DML | **CONFIRMED OPEN SECURITY RISK** | `public.categories`, `sub_categories`, `product_groups`, `sub_groups`: all 12 authenticated INSERT/UPDATE/DELETE grants; RLS identity-only ALL policy. No live writer probe. |
| Old Electron direct-DML client compatibility | **DEFERRED/NOT TESTED** | Pre-#445 source directly writes; installed staff versions unknown. Must inventory/upgrade before owner-approved ACL remediation; cannot safely revoke now. |
| Optional 04/05/CL15/other guards PR #463 | **DRAFT/UNAPPLIED** | Separate owner decision only; not a substitute for four-table DML cutover. |
| Final WP10 formal closure | **DECISION REQUIRED; NOT CLOSED** | Either meet exact role/security/client cutover gates, or write an explicit dated/owned temporary security exception (still not equivalent to completed remediation). Do not close solely through PWA UI parity. |

## WP12 outstanding receiving gates (application/server versus release)
| Gate | Status | Smallest valid next evidence or disposition |
|---|---|---|
| Current installed mobile PWA Cost Comparison visible load | **PASS — ONE OBSERVATION** | Owner report preserved; no repeat required merely to restate it. |
| Normal comparison endpoint, HTTP status, duration and 4s p95 | **PARTIAL / p95 NOT TESTED** | A supported authorised browser/network observation, and a separately bounded measurement set for p95. A single successful UI load isn't p95. Track issue #273; decide whether p95 is a strict development closure contract or later monitored SLO. |
| Three-role final build Editor/View-only/No-access | **NOT TESTED AS COMPLETE MATRIX** | Independent actual identities and canonical grants, six Costing surfaces; no account creation or impersonation. |
| Seven sensitive-view negative HTTP reads with denied JWT | **NOT TESTED** | Seven named targets and safe procedure in `WP12_AUTHENTICATED_BROWSER_RECEIVING_HANDOFF_2026-11-17.md`; 200 empty isn't denial. |
| Browser-local flag defaults OFF and authenticated 11-flag ON/ALL-ON restore | **PARTIAL / LIVE ON NOT TESTED** | Prior OFF and v394 evidence on other browser; mocked 21/21 accepted. Live toggling not authorised. An owner may explicitly defer ON/ALL-ON rollout to a later feature enablement rather than silently PASS. |
| Platform source/hosted parity, SW v394, responsive | **PASS — prior accepted contexts** | Host and genuine prior PWA upgrade proofs. Cannot assert all client devices' active controller build. |
| Windows Electron installation, updater, installer rollback, Bitdefender compatibility | **DEFERRED/NOT TESTED** | Separate release milestone by owner decision; OFFICE TEST PR #475 source/build evidence remains but real Windows execution failed to reach acceptance due to endpoint protection blocking. Do not force install or widen antivirus exclusions. |
| WP12 formal closure | **DECISION REQUIRED; NOT CLOSED** | Requires security/role acceptance and an explicit scope decision on p95 and live ON flags. The Electron-only items can be documented as a different release gate but cannot be represented as tested. |

## Safe operating decisions recorded
1. **Stop OFFICE TEST attempts**. Retain PR #475 draft and unsigned local Windows build report as research; no further Bitdefender bypass/retries, no publication.
2. **Do not retry a successful PWA page merely for formality.** Actual functional test has passed for November 2026 on the installed mobile PWA.
3. **No keyset-first rollout**. PR #473 candidate is offline-only and lacks meaningful live pruning for 627–634 SKUs vs 2000 cap; neither STATISTICS ANALYZE nor source plan costs demonstrate 4s p95.
4. **No early four-table ACL/RLS revoke**. It risks older staff-installed direct writers. Record confirmed exposure and separately seek version inventory, cutover plan and precise security approval.
5. **No real JWT/session tests unless independently authorised accounts exist**. No invented No-access identity, tokens, user impersonation or live master-table write probes.
6. **No automatic closure from this assessment**. WP10/WP12 OPEN, WP11 CLOSED, **11/13 closed**. Electron release HOLD. No merge of draft PRs #463/#472/#473/#475 without approval.

## Owner decisions needed to actually advance formal development closure
- **D1 (security, highest priority):** maintain strict genuine three-role and seven-denial checks before WP12 closure, or explicitly adopt an owner-approved narrower receiving scope. Narrower scope remains incomplete security evidence, not proof of security.
- **D2 (performance):** determine whether comparison p95 ≤4s is a non-waivable acceptance requirement now, or a separately monitored reliability objective under issue #273. The PWA visible load is accepted but not a timing proof.
- **D3 (feature flags):** determine whether the 11-flag signed-in ON/restore acceptance is necessary for default-OFF development closure, or defer until each gated feature activation, retaining mock coverage.
- **D4 (WP10 security):** agree a separate staff-fleet cutover and four-table ACL remediation window, or document a short-lived named risk exception with owner and expiry. Neither action is implied by development acceptance.
- **D5 (Electron):** keep desktop verification and publication separate with HOLD; no further antivirus challenge.

**Suggested next action:** hold a compact owner decision review of D1–D4; then, and only then, prepare accurate WP10/WP12 closure recommendations describing evidence and explicit unresolved conditions. Without owner decisions, this matrix itself is the completed reconciliation deliverable, not closure.
