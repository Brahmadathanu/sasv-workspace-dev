# WP10 G1 — Product/SKU safeguard transition and recurrence audit (issue #438)

**Status: G1 AUDIT DELIVERED FOR INDEPENDENT REVIEW. No implementation, no change to activation/readiness logic, no database access, no migration, permission, registry, flag, deploy or closure.** WP10 remains OPEN; programme remains **10/13** (no count advance). WP09 closure, the default-off `LAUNCHER_PRESENTATION_V1` flag, WP11 defects (PM BOM 390px, #429) and every WP12 receiving case are preserved untouched.

## 0. Pins and evidence classes

| | |
|---|---|
| Base (`main` at refresh) | `5ad28a87dfbdaa5d311dbd505721eb308c732623` (WP09 closure + WP10 kickoff; kickoff was `6d934c67…`, the only drift is docs) |
| Branch / PR | `claude/lucid-gates-6uwfvx` restarted from that main; one draft PR (head SHA in the PR) |
| Live evidence used | only the committed catalog capture `WP10_G1_EVIDENCE/live-guard-catalog-2026-11-15.json` (5 function definitions, 5 `product_skus` triggers, 44 readiness-epoch triggers). **No new live query was run; none was possible** (this session has no database access). |

Every statement below carries one class: **PROVEN-LIVE** (captured live text), **PROVEN-REPO** (migration/client source), **DOC** (WP-01…04 records), **FIXTURE** (isolated throw-away PostgreSQL scenario), **MODEL** (fixture model of an uncaptured mechanism) or **NOT PROVEN** (needs a catalog question, §7). Nothing was inferred as a live fact without one of the first four.

## 1. Executive result

1. **Prevention at creation/activation is real and server-authoritative.** The live trigger rejects an *active* SKU create or an inactive→active transition unless all five essentials resolve; the same text runs for the RPC and for direct SQL; there is no sample, urgent or approval-reference bypass (FIXTURE F2–F4). Inactive incomplete drafts remain allowed by design (F1).
2. **Prevention stops at the moment of activation.** Already-active rows are deliberately not re-checked (live text). That boundary is confirmed, not a defect, but it has one concrete hole (G-4: re-parenting an active SKU) and relies entirely on **detection** afterwards.
3. **Detection is fail-closed but ownerless.** Source-epoch hooks invalidate the derived readiness build on every dependency *write*; a stale or absent build makes the portfolio read raise `READINESS_BUILD_STALE/ABSENT` instead of showing a status. Nothing in the repository or the captured catalog schedules the rebuild, alerts anyone or names an owner; production precedent (12 Nov: Readiness unavailable → owner-authorised one-off rebuild #7) shows the recovery is a manual database call (G-1).
4. **Passage of time is invisible to write-triggered hooks.** An effective-dated dependency that lapses with no row write leaves the build "fresh" while the activation helper (as-of = today IST) already reports it missing (FIXTURE F7). Activation evaluates *today*; LIVE_AS_OF readiness evaluates the governed *valuation date* (G-2).
5. **Product-side coverage is documented but not proven**, and the questions that would settle live parity (writer definitions, product-side guard, privileges, freshness composition, schedules) are listed as exact catalog queries in §7.

## 2. Exact writer / transition matrix (summary; full table `WP10_G1_EVIDENCE/writer-transition-matrix.csv`)

| Path | Client input | Server authority | Proven vs missing |
|---|---|---|---|
| `rpc_create_product` | name, subgroup, UOM pair, status Active\|Inactive (no default), reason… | DOC only | **Live text, ACL NOT PROVEN** (Q1). An Active product without SKU is accepted (DOC). |
| `rpc_update_product` (also product deactivation) | master fields | DOC only | **NOT PROVEN** (Q1). Inactivation guard while SKUs are active is DOC-only (`fn_guard_product_inactivation_requires_no_active_skus`) and **not in the catalog capture** (Q3). |
| `rpc_create_product_sku` | product, pack, UOM, `p_is_active` (client always `false`), sample, reason | DOC for the RPC; **trigger behaviour PROVEN-LIVE** | Active create rejected P0001 for RPC and direct INSERT (F2). RPC text/ACL NOT PROVEN (Q1/Q2). |
| `rpc_update_product_sku` | pack, UOM, sample, reason (no active flag) | DOC; trigger behaviour PROVEN-LIVE | Edits on an **active** SKU allowed without re-check (F8.1), logged with exact changed columns (F8.2). |
| `rpc_set_product_sku_active` | id, target, reason (required), approval reference (optional) | **PROVEN-LIVE, equals CI-038** (parity P1.4) | edit permission, auth, row lock, five-essential pre-check only when activating, parent guard, audit with old/new snapshots (F3–F5). ACL not captured (Q2). |
| Direct `product_skus` writes | any | PROVEN-LIVE triggers (5 enabled) | Covered for every writer at trigger level; **who holds direct table privileges NOT PROVEN** (Q4). |
| Direct `products.status` update | status | product-side guard not captured | SKU-side triggers do **not** cover it (F9.1). |

**Interactions proven in fixtures:** inactive creation with nothing complete (F1); active creation rejected incl. sample (F2); each of the five essentials individually blocks, with an approval reference changing nothing (F3); complete activation, role/reason/same-state refusals, deactivation never pre-checked (F4); parent must be Active even when everything else is complete (F5); later dependency deletion/expiry leaves the SKU active but changes the helper result (F6); active edits (F8); product deactivation (F9, stand-in guard clearly labelled); ambiguous PM BOM (F10); IST/period as-of rule (F11); direct writers leave a change-log row but no lifecycle audit event (F12).

## 3. WP01–WP04 contract reuse (no second readiness system)

| Contract | What G1 traced |
|---|---|
| **Five-essential guard** (CI-038, WP-10 design basis) | Live helper returns exactly `PM_BOM_REVISION, BATCH_SIZE_REFERENCE, MANUFACTURING_ROUTE, MRP_POLICY, SELLING_PRICE_POLICY`, in that order (P2.1); no sample/urgent/override parameter exists (P2.2). |
| **Latest-period valuation / current-IST rule (CI-038a)** | as-of = `greatest(coalesce(latest period valuation date, current_date), current IST date)`; live text equals the CI-038a migration and *differs* from the original CI-038 text (P1.1, P1.5); IST day not UTC day, later valuation date wins, then today wins again (F11). |
| **Parent-active guard** | Live trigger blocks activation under a missing or non-Active parent (P2.7, F5, F8.5, F9.3). Its function has **no creating migration in the repo** (SA1 only revokes ACL) — parity not provable (P1.6). |
| **Audit trail** | Lifecycle RPC writes `product_sku_master_audit` (old/new snapshots, reason, approval reference, actor); every row change writes `product_sku_change_log` (actor NULL for non-app writers). Direct writers get a change-log row but **no lifecycle event** (F12.1). Audit rows are append-only in behaviour (F12.2). |
| **Active ≠ Costing Ready** (WP-01/02) | The guard evaluates only the five essentials; the other WP-01 dependencies (scheme, commercial/regional basis, labour/overhead/QC/stores/admin/finance/marketing, material rate/evidence) are *not* activation prerequisites by owner decision (WP-10 design note E). The client states "Activating this SKU does not set costing readiness to READY" and passes the server severity through unchanged; only the exact string `READY` renders the pass badge (client C3.1, C4.1–C4.3, mutation CM.2). |
| **Fail-closed reads** | Client: a readiness error returns no payload and the row shows "Unavailable" (C4.4). Server: portfolio read raises `READINESS_BUILD_ABSENT/INCOMPLETE/STALE` (V2.2 text; modelled F6.3). |

## 4. Dependency change → epoch → freshness → readiness → visible remediation

Full per-dependency table: `WP10_G1_EVIDENCE/dependency-trace.csv` (16 rows; the "hooked / UNHOOKED" columns are *derived from the live catalog*).

```
write to a dependency table ──(AFTER statement trigger, 44+1 tables, shared bump function)──► source epoch
epoch / valuation date / refresh run ──► readiness_source_fingerprint(period) digest
stored portfolio build.digest ≠ current digest ──► portfolio read raises READINESS_BUILD_STALE (fail-closed)
READINESS_BUILD_STALE ──► Costing Control Center Readiness: "Readiness unavailable — READINESS_BUILD_STALE"
recovery ──► owner-authorised call of costing.fn_wp04_build_readiness_portfolio(period)   [manual: R51, 12 Nov 2026]
```

**Proven:** the five essentials' source tables are hooked (P4.4.*); product/subgroup/group/category tables are hooked (P4.5); hooks are AFTER-write triggers only (P4.3); STALE persists until an explicit build (F6.4, MODEL); the visible text for a stale portfolio is the generic readiness error (R50 evidence). **Not proven (no claim of a gap):** fingerprint composition and whether it includes today's date (Q5, Q9); the MRP / selling-price resolver tables (definitions absent from repo and catalog, Q8); whether any schedule/alert consumes the stale state (Q6, Q7); direct material-rate/valuation tables are **not** in the hooked set but are reached only indirectly via refresh runs and control-status snapshots (hooked) — whether that is sufficient is for Q8/Q9. `plm_bom_revision_line` is unhooked but approved revisions/lines are immutable by migration (gate A). The 44 hooks prove invalidation, **not** that alerting, refresh cadence or operator ownership are adequate (stated in the issue and unchanged).

Churn note (DOC, R51): the build went stale from changes to cost periods, refresh runs/stages and allocation snapshots — i.e. mostly *non-product* churn. A STALE state therefore cannot be read as "a SKU lost a dependency"; it only says "re-evaluate".

## 5. Tests and evidence (all offline; PostgreSQL fixtures run in a throw-away local cluster, never against Supabase)

| Suite | What it proves | Result |
|---|---|---|
| `catalog-parity.test.mjs` | live bodies == repo migrations (helper = CI-038a, completeness fn, pre-check RPC, lifecycle RPC); five essentials/order; as-of rule; boundary text; trigger inventory; 44 hooks; essential-source coverage | **PASS 29**, **NOT PROVEN 3** (parent-guard repo parity; two uncaptured trigger functions; adjacent unhooked tables) |
| `transition-fixture.test.mjs` (43 checks, scenarios F1–F13) | live-verbatim guard/RPC/trigger text against fixture tables; negatives for each essential, parent, roles, reason, same-state, sample, approval reference, ambiguity, IST/period, expiry by time, active edits, re-parenting, product deactivation, direct writers | **PASS 43/43** |
| `fixture-mutation.test.mjs` | the invariants fail when a safeguard is removed: completeness trigger, parent trigger, lifecycle pre-check, CI-038a, an epoch hook, an essential | **PASS 7/7** (clean fixture + 6 mutants each detected) |
| `client-contract.test.mjs` | no direct table writes; five RPCs; create sends `p_is_active:false`; update has no active flag; reason modal; severity pass-through with **real** badge functions executed; two source mutants detected | **PASS 19**, **FINDING CONFIRMED 1** (pre-check RPC unused by any client) |
| Existing `scripts/wp04-readiness-client-contract-smoke.mjs` | readiness client contract | PASS 36 |
| Existing `scripts/product-sku-lifecycle-smoke.mjs` | lifecycle smoke | **EXISTING BASELINE FAILURE: 100 PASS / 2 FAIL** — "service worker generation is hub-cache-v332" (stale after v393) and "in-module action does not invent route URLs" (WP08 resolver bridges added). Not caused or edited by WP10; reported, not fixed. |
| Existing `scripts/costing-readiness-usability/readiness-usability.test.mjs` | readiness remediation / export / LIVE_AS_OF clarity incl. fail-closed envelopes | **PASS 21/21** (0 skipped; mock data, no network) |

**Fixture provenance** (asserted by test F13.1): 7 objects are *live-verbatim* (helper — only `now()`→`fixture_now()` so time can be fixed —, completeness trigger function, parent guard function, lifecycle RPC, pre-check RPC, two trigger definitions); 2 are *repo-verbatim* (`plm_sku_bom_revision_as_of`, SKU change log); the rest are **stand-ins** for objects whose live text is not captured (writer RPCs, product-inactivation guard, route/MRP/selling resolvers, epoch bump, freshness fingerprint). Stand-in results show *contract interaction only*, never live behaviour. No role was impersonated against production; fixture roles are GUC stubs.

## 6. Gap ranking

| # | Severity | Gap | Prevention vs detection today | Evidence |
|---|---|---|---|---|
| **G-1** | High | **Readiness refresh has no named owner, schedule or alert.** A dependency write makes the build STALE (fail-closed, visible as an error) but recovery is a manual owner-authorised database call; recurrence is certain (high-churn sources are hooked). | Detection: yes (fail-closed). Visibility: generic error. Ownership/cadence: none found. | F6, DOC R50–R52, V2.2 reader text; schedule/alert absence **NOT PROVEN** (Q6, Q7) |
| **G-2** | High | **Time-expiry blind spot and date mismatch.** Write-triggered epochs cannot see an `effective_to` passing; the activation guard evaluates today-IST while LIVE_AS_OF evaluates the governed valuation date, so an active SKU can read READY in the build while its essentials already lapse today. | None for lapse-by-time until a new period/build. | F7.1–F7.3 (helper vs MODEL freshness); real fingerprint composition **NOT PROVEN** (Q5, Q9) |
| **G-3** | Medium | **Product-side coverage unproven.** SKU triggers do not stop product inactivation; the documented product guard is not captured. Active products with zero SKU / no active SKU (54 / 179 at WP-02) are invisible to a SKU-grained portfolio (1,793 SKU items). | Guard: documented only. Detection of product-without-SKU: none beyond WP03 creation guidance. | F9.1; DOC WP-02/03/04; Q3 |
| **G-4** | Medium | **Re-parenting an ACTIVE SKU bypasses the product-level essentials** (batch size, route): the completeness trigger fires on `UPDATE OF product_id` but returns early for already-active rows. Reachable only by direct writers (the RPC cannot change `product_id`, DOC). | Prevention: none. Detection: epoch → STALE → blocked on next build (F8.4, F8.6). | F8.3 (PROVEN at trigger level) |
| **G-5** | Medium | **Direct-writer visibility.** Direct SQL changes leave a change-log row (actor NULL) but no lifecycle audit event, and the log has no policy (visible only to privileged roles, repo text). Historical SKUs 17/114 went active→inactive with no audit. | Detection exists but not operator-visible. | F12; CI-038 repo text; Q4 |
| **G-6** | Medium (unproven) | **Epoch coverage completeness** for the MRP/selling-price resolvers and direct material-rate inputs cannot be confirmed: definitions are in neither repo nor catalog. | Unknown. Not a defect claim. | P4.6 NOT PROVEN; Q8 |
| **G-7** | Low | **Pre-activation UX gap.** `rpc_get_sku_activation_check` (five essentials + owner screen) is unused; the user sees only the severity notice and learns of missing essentials from the rejection toast; `error.detail` is not rendered. Server stays authoritative. | Prevention is server-side; guidance is late. | client C3.2 (finding), C3.3 |
| **G-8** | Low | **Ambiguous PM BOM** raises a raw exception from the guard/pre-check (fail-closed but opaque). | Fail-closed. | F10.1 |
| **G-9** | Info | **Source/live parity**: parent-guard function and the MRP/selling resolvers have no repo definition; the other four guard texts match repo exactly. | — | P1.1–P1.6 |
| **G-10** | Info | **Boundary, not defect:** already-active rows are not re-checked; deactivation is never blocked; historical active-but-incomplete SKUs (3 at the CI-038 analysis) remain by design. | — | P2.4, P2.6 |

## 7. Exact read-only catalog questions for ChatGPT (`WP10_G1_CATALOG_QUESTIONS_2026-11-15.sql`, `begin read only … rollback`)

| Q | Asks for | Settles |
|---|---|---|
| Q1 | definition, owner, SECURITY mode, `proconfig`, ACL, md5 of `rpc_create_product`, `rpc_update_product`, `rpc_create_product_sku`, `rpc_update_product_sku` | matrix W1–W4; whether any writer can create an active SKU or change `product_id` |
| Q2 | owner/ACL/SECURITY of the five captured functions | who can EXECUTE guard and lifecycle RPCs |
| Q3 | triggers on `products`, product/SKU audit tables; text of `fn_guard_product_inactivation_requires_no_active_skus`, `fn_product_skus_price_list_active_guard`, `fn_log_product_sku_change` | G-3, G-5 |
| Q4 | table privileges, RLS flags and policies for `products`, `product_skus`, audit tables, change log | direct-writer reach; change-log visibility (G-4, G-5) |
| Q5 | definitions of `fn_wp04_readiness_source_fingerprint`, `fn_wp04_readiness_bump_source_epoch`, `fn_wp04_build_readiness_portfolio`; substrate columns; build-history metadata (ids, status, timestamps only) | G-1, G-2 |
| Q6 | `cron.job` (name, schedule, active, command head), callers of the governed build, relevant extensions | G-1 owner/cadence |
| Q7 | alert/notification/outbox-like tables; functions referencing `READINESS_BUILD_STALE/ABSENT` | G-1 consumers |
| Q8 | definitions of `fn_resolve_sku_mrp_as_of`, `fn_resolve_sku_selling_price_policy_as_of`, route resolvers | G-6 |
| Q9 | whether the readiness RPCs reference "today" | G-2 |

No business-row completeness count is requested.

## 8. Minimal design proposal (proposal only; nothing implemented)

**Principle.** Keep prevention where it already is (creation/activation, server-authoritative). Add only: (a) an *owner* and *visible state* for staleness, (b) a read-only *expiry horizon* over the existing helper, (c) one narrow trigger decision, (d) client use of the existing pre-check. No second readiness calculator, no automatic deactivation, no new launcher, no permission change.

| # | Safeguard | Kind | Named owner | Trigger | Freshness rule | Action |
|---|---|---|---|---|---|---|
| P1 | **Readiness freshness status** — a read-only status (reusing the existing build/epoch tables) exposed in the existing Costing Control Center Readiness lens: *stale since*, changed source tables, last build, owner | detection + visible remediation | Costing Control Center operator (role to be named by the owner) | build digest ≠ current digest, or no build for the latest governed period | owner-set maximum stale age (decision O2) | governed rebuild via the **existing** `fn_wp04_build_readiness_portfolio`: manual runbook, or a scheduled server job **only if Q6 shows none exists and the owner approves** |
| P2 | **Expiry horizon** — read-only list of *active* SKUs whose five essentials are missing today or lapse within N days, computed by calling the existing helper at today and at today+N | detection (time-based) | dependency owner screens (PM BOM Manager, Supply/Batch Plan, Production Route Manager, Pricing Policy Manager) | daily and at costing-period open | evaluated live at call time (no stored copy) | owner fixes the effective dates in the specialist screen; nothing is deactivated |
| P3 | **Active re-parent guard** — when `product_id` changes on an already-active SKU, require the product-level essentials (batch size, route) or reject | prevention (narrow) | Product/SKU lifecycle owner | `UPDATE OF product_id` on an active row | as-of rule unchanged | server migration after review; owner decides prevention vs detection-only (O4) |
| P4 | **Pre-submit check in Manage Products** — call the existing `rpc_get_sku_activation_check` before Activate; render missing codes + owner screens; render `error.detail` on rejection | guidance | Manage Products | opening the Activate confirmation | live | none (server unchanged) |
| P5 | **Product-level visibility** — confirm the product-inactivation guard (Q3); show products with no SKU / no active SKU in the existing Product catalog lens | detection | Manage Products | catalog load | live | owner decides per product; no auto-repair |

**Before/after, concrete**

| Scenario | Today | With the proposal |
|---|---|---|
| Batch-size reference of an active SKU expires 31 Dec with no edit | no write → no epoch change → build stays "fresh"; nobody is told; the SKU would fail only if someone re-activated it (F7) | P2 on 1 Dec lists it ("BATCH_SIZE_REFERENCE expires in 30 days — Supply / Batch Plan"); P1 unchanged (no stale build) |
| PM BOM revision superseded on an active SKU | epoch bump → Readiness shows "unavailable — READINESS_BUILD_STALE" until an owner-authorised database call (R51) | P1 shows "stale since …, changed: plm_bom_revision, owner: Costing operator, action: rebuild"; a rebuild runs per the agreed cadence |
| Active SKU re-parented by SQL to a product with no route | accepted silently (F8.3); STALE later | P3 rejects (or flags, if detection-only is chosen) with the missing product-level essentials named |
| Planner activates a SKU missing MRP policy | rejection toast after submit: "…Missing: MRP policy." (F3.MRP) | P4 shows "Missing: MRP policy → Pricing Policy Manager > MRP" before submit; server rejection unchanged |

## 9. Recommended G2 implementation scope (not authorised)

* **Prerequisite:** ChatGPT runs Q1–Q9 (read-only) and returns the results; P1/P2/P3 designs are frozen only after Q5–Q9 and Q1/Q4.
* **Server (small, reviewable, owner-approved migrations only):** S-1 read-only freshness-status function over existing tables (P1); S-2 read-only expiry-horizon function reusing `costing.fn_sku_activation_missing_items` (P2); S-3 optional completeness-trigger extension for active re-parent (P3). Scheduler (if any) is a separate owner approval.
* **Client:** C-1 Costing Control Center Readiness banner/status (P1, reuses the existing lens); C-2 Manage Products pre-check + error-detail rendering (P4); C-3 product-without-SKU visibility (P5).
* **Out of scope:** automatic deactivation, new readiness calculator, new launcher or module, blanket permission changes, any change to the five-essential list or to the as-of rule.
* **Tests for G2:** reuse this package's fixtures as regression contracts (they already encode the negatives), add the new functions as live-verbatim text once reviewed.

## 10. Decisions required from the owner (essential only)

| # | Decision | Recommended |
|---|---|---|
| O1 | Who owns readiness rebuilds and stale-state follow-up (named role)? | Costing Control Center operator |
| O2 | Maximum acceptable stale age, and is a scheduled rebuild acceptable or must it stay a manual runbook? | Schedule only if Q6 shows none exists; otherwise runbook + P1 visibility |
| O3 | Expiry horizon N days and who is notified | 30 days; dependency owner screens |
| O4 | Active re-parent: prevent (reject) or detect-only (flag)? | Prevent (rare, direct-writer only) |
| O5 | Authorise ChatGPT to run catalog questions Q1–Q9 (read-only) | Yes |

## 11. Hard-stop compliance

No production SQL, migration, registry, permission/RLS/grant, flag, release, deployment or Electron change. No edit to existing activation/readiness logic or tests. WP08/PEC not reopened; WP09 closure and `LAUNCHER_PRESENTATION_V1` untouched; WP11 defects and WP12 cases (including `W12-WP08-01…08`) remain NOT TESTED/OPEN. The five historical `20261112*` migration CRLF-only worktree differences were left unstaged. WP10 authority document updated only to record G1 status; no formal closure.

## 12. Reproduce

```
node scripts/wp10-g1-safeguard-audit/catalog-parity.test.mjs
node scripts/wp10-g1-safeguard-audit/transition-fixture.test.mjs      # needs local PostgreSQL binaries; SKIPPED (not PASS) otherwise
node scripts/wp10-g1-safeguard-audit/fixture-mutation.test.mjs
node scripts/wp10-g1-safeguard-audit/client-contract.test.mjs
node scripts/wp10-g1-safeguard-audit/dependency-trace.mjs <out.csv>
node scripts/wp10-g1-safeguard-audit/build-matrix.mjs <out.csv>
```
