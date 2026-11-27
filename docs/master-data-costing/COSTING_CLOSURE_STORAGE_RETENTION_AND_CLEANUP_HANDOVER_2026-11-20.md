# SASV — Costing Closure, Storage Retention and Cleanup: Controlled Handover
Prepared: 20 November 2026 (IST). Status: READ-ONLY / PROPOSAL; NO PRODUCTION MUTATION.
Repository: Brahmadathanu/sasv-workspace-dev. Supabase project: qhmoqtxpeasamtlxaoak (PG 17.4).
Owner remains final approval authority. This document coordinates three parallel programmes without merging their scopes.

## 1. Priority and execution discipline
A. Finish WP10 and WP12 formally, without restarting completed work or expanding scope.
B. Resolve the Supabase storage warning through evidence-based retention and selective retirement of Scheme Comparison.
C. Continue GitHub/local post-release cleanup; never hinder A/B or independent Executive MIS development.

Every assistant reply should show a compact progress indicator for A/B/C. Use existing verified positive acceptance evidence; collect only missing evidence. No automatic execution authority is granted by this document.

## 2. Costing Suite — remaining 2 of 13
Authoritative WP11 owner closure on 17 Nov means 11/13 formally CLOSED, WP10 and WP12 OPEN. Read docs/master-data-costing/MASTER_PROGRAMME.md TOP BANNER; WP11_OWNER_APPROVED_FORMAL_CLOSURE_2026-11-17.md; COSTING_FINAL_ACCEPTANCE_ACCESS_AND_CLOSURE_MATRIX_2026-11-17.md; COSTING_ACCEPTANCE_REMAINING_CAPABILITY_RECEIPT_2026-11-17.md; issue #440; PRs #465, #472, #473, #476, #477, #479 and #471. Lower 10/13 historical banners are stale.

SASV Workspace v6.2.0 was subsequently published and owner-tested on a Windows office fresh-install pilot. Publication is REAL but is not formal WP10/WP12 closure. Older documents stating Electron HOLD precede this release. Do not reinterpret them as cancellation of v6.2.0, and do not reopen the waived upgrade-from-6.1.0 rehearsal without new cause.

### WP10 — four-master security and legacy fleet
Four public classification masters (categories, sub_categories, product_groups, sub_groups) were confirmed to allow broad authenticated direct DML and permissive identity-only RLS. Newer clients use 12 governed RPC writers, but earlier installed Electron versions wrote directly; actual fleet upgrade status was unknown at formal gate. Thus direct DML revocation remains a substantive unresolved security/compatibility risk. Stage A RLS proposal #477 and Stage B REVOKE in staged plan #476 are separate owner decisions. SELECT-hardening proposal #479 is distinct and cannot substitute for write hardening. Optional #463 is separate.

Close WP10 with a bounded, ordered package: (1) fresh read-only ACL/RLS/RPC and installed-client inventory; (2) explicit owner policy decision about Stage A Edit versus View+Edit, legacy support, Stage B timing, SELECT scope, rollback and any accepted bounded security residual; (3) staging/disposable proof; (4) owner-approved production action only if authorised, then canonical existing-role Editor/View-only/No-access positive/negative testing; (5) formal owner closure receipt or explicit hold. Do not fabricate accounts, grant bypasses or deploy unapproved SQL.

### WP12 — only residual acceptance
Preserve credited previous passes: populated six Costing modules, actual 390px PM BOM and Deactivate visual (without action), 74/74 source parity, mocked flag-matrix evidence, prior legitimate role tests in their proven scope, owner acceptance of packaged v6.2.0 and office pilot. Never repeat those wholesale without build/session drift.

Reconcile the remaining actual gaps only: final canonical role/negative-view tests not already evidenced, active PWA controller/cache/default-OFF flags where supported, ordinary Cost Comparison endpoint/status/duration metadata, performance concern, and final integrated receipt. Mark PASS, FAIL, NOT TESTED or OWNER-ACCEPTED RESIDUAL, not false PASS. Offline keyset candidate #473 proves parity in fixtures but NOT a production speed benefit; optimisation should not hold closure without a demonstrated problem. Obtain separate WP10 then WP12 owner sign-offs; update master status in a reviewed documentation PR.

## 3. Supabase storage — owner proposal, NOT an approved retention rule
Owner suggests: on a new month delete prior-month unapproved draft runs promptly, and retain detailed approved run data only for the current month plus previous THREE months. Example November 2026: keep detailed August/September/October plus November; July and earlier outside this detail window. Preserve irreversible approved valuation and audit evidence even if old detailed snapshots are compacted. Never equate a SUCCESS execution to an approved run.

Read-only live baseline 20 Nov 2026:
- Healthy Supabase project PG 17.4; approximately 18 GB allocated user relations in costing+public (not all database/physical disk).
- costing.costing_refresh_run has 124 rows July-Nov. July 56 SUCCESS/3 FAILED; Aug 4 SUCCESS/1 CANCELLED; Sep 28 SUCCESS/10 FAILED; Oct 16 SUCCESS/2 FAILED; Nov 3 SUCCESS/1 FAILED.
- Canonical costing.v_costing_period_run_status: September approved run 122, October approved run 143; July/August/November approved_run_id NULL at inspection. Approval status is separate from SUCCESS.
- Largest allocated relations: costing.cost_sheet_line_traceability_snapshot 3546 MB; marketing_regional_sales_evidence_snapshot 3114 MB; marketing_signed_billed_sales_evidence_snapshot 2732 MB; cost_sheet_line_monthly_snapshot 1314 MB; sku_rm_material_cost_line_snapshot 679 MB; cost_sheet_rm_line_traceability_snapshot 655 MB. Public tally_group_outstanding_snapshot 884 MB is a separate significant table.
- Scheme Comparison backing costing.sku_scheme_viability_snapshot 477 MB, about 240k estimated rows. Exact rows per period: Jul 33,905 (10 runs, 5 schemes, 679 SKUs); Aug 14,244 (4, 6, 679); Sep 119,328 (30, 6, 686); Oct 60,294 (16, 6, 637); Nov 12,574 (3, 7, 630). Multiple snapshots magnify SKU-by-scheme expansion.
- Client public/shared/js/costing-suite-scheme-comparison.js uses public.v_costing_pricing_sku_scheme_comparison; this chains through costing.v_sku_scheme_comparison_current and costing.v_sku_scheme_comparison to the snapshot table. Two overloads named costing.rpc_refresh_sku_scheme_viability_snapshot exist. Do NOT confuse this all-scheme lens with actual selected-scheme pricing policies, promotional viability or Scheme Master.

### Storage work programme (distinct authorisations)
S0 Read-only: confirm actual Supabase storage warning/plan threshold and growth, table/index/TOAST/dead tuples. Map all run-linked snapshot tables, retention dependencies, foreign keys, functions/views/client/export consumers, cron job 66/67/68 and affected Tally tables. Avoid costly full scans; measure row/byte estimates per run and approval category.
S1 Decision: explicit retention matrix for current-month drafts, previous-month drafts, failed runs, formally approved/locked runs, historical approved compact audit summaries, exceptions/hold and signed pricing/financial references. Decide grace period; do not silently purge a month merely because calendar advanced.
S2 Dry run: exact run-ID / table / row / byte preview, downstream-reference and restoration proof, immutable approved summaries/fingerprints, recovery and audit ledger, all on read-only database or staging.
S3 Owner-approved pilot only: safe per-run pruning and online maintenance, before/after counts, query parity and actual space measurement. PostgreSQL DELETE leaves reusable dead space; it does not necessarily return physical disk to Supabase. Assess VACUUM/autovacuum, partitioning, maintenance locks, WAL and headroom separately.
S4 Automated monthly retention only after verified pilot: idempotent dry-run-first scheduler, exclusion list, escalation on failed/running runs, signed deletion ledger, monitoring and rollback. No destructive cron presently authorised.

### Scheme Comparison proposed retirement
Owner wishes to retire low-value all-SKU x all-scheme comparison lens and unnecessary multiplied server snapshot. First enumerate every dependent RPC, view, refresh stage, client lens/routes, policy, pricing workbook, export and test. Establish whether the 477 MB snapshot also contributes to selected-scheme viability, official pricing, profitability or historical audit. If it does, split/rewrite those dependents first. Preferred staged approach: prove selected-scheme and IK/OK pricing parity; retire UI and deep links with safe handling; stop redundant all-scheme generation if independent; only later authorise backend functions/views/table and indexed storage reclamation. Quantify savings and query effects; avoid dropping Scheme Master, selected-scheme policy or necessary profitability features. Separate client PR, backend SQL approval and production acceptance.

No production data purge, snapshot drop, permission edit, function drop, UI removal or scheduler change is authorised by this handover.

## 4. GitHub and local cleanup (independent lower priority)
Control doc: docs/POST_620_CLEANUP_INVENTORY_AND_PLAN_2026-11-20.md and PR #490.
Local worktrees: 63 to 18; roughly 8.9 GB recovered. Remote branches: 365 to 215 (three 50-branch batches deleted). Batch 4 of 50 refs approved in #7042001370 but NOT executed: cloud Claude had proxy HTTP 403, nothing deleted; recovery table in #7042200875. Re-run only from authorised office PC session with locally archived manifest and per-ref revalidation. Batch 5 NOT APPROVED.
Cloud read-only inventory: 42 open PRs. Two independent Executive MIS PRs #485/#486 PROTECTED; 11 Costing WP10/WP12; 7 PEC; 3 e-Aushadhi; 4 old Tally; 14 historical Costing/CSR; 1 cleanup. Comments #7042750640 and #7042771678. Ten older documentation-only Costing PRs are first closure-review candidates (#150,#148,#147,#145,#143,#142,#141,#137,#119,#114); NO closure until unique-content review and owner approval. Old Tally SQL PRs #92/#93/#94/#97 need live migration parity; #315/#275/#274/#116 contain potential unique SQL/tests, so NOT automatic closure. Leave 5 CRLF-only PEC migration changes untouched. Do not allow C to interrupt A or independent MIS work.

## 5. New-chat entry actions
1. Pin actual latest main and read this handover, MASTER_PROGRAMME top, WP10/WP12 ledgers, #440, #465, #472, #476, #477, #479, and PR #490. Summarise exact remaining gate, existing positive evidence and owner decisions in plain English.
2. Prioritise defensible WP10 closure path. Audit only necessary live security facts, fleet compatibility and bounded acceptance. No production writer/SQL until separately approved.
3. In parallel make storage S0 dependency and per-run retention preview; show a proposed one-month-rollover example and explicit preservation of approved 122/143. No retention DML.
4. Inspect Scheme Comparison downstream consumers and propose KEEP/RETIRE map, differentiating Scheme Master/selected-scheme pricing from redundant cross-product comparison.
5. Continue PR triage only when A/B do not need attention; do not touch MIS or execute blocked Batch 4 in cloud.
6. Each reply include compact A/B/C progress, checked facts and next action; explain changes without assuming coding expertise.

Owner approvals must be separate for security cutover, production SQL, data deletion, monthly purge cron, feature retirement, PR closure/merge, branch/worktree deletion and releases. Preserve historical approvals and evidence, avoid overengineering, and never represent an estimation as space already reclaimed.
