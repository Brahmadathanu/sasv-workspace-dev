# PEC S4 — End-to-end Hybrid Replenishment / Electron 6.3.0 Release Packet

**Date:** 22 November 2026 (IST). **Programme:** PEC S4, issue #305. **Implementation:** PR #496. **Release decision:** NOT YET ISSUED. Keep the current v6.2.0 release and its GitHub latest.yml intact until a separately approved v6.3.0 publication.

## CURRENT HANDOVER STATE — 22 November 2026 (authoritative checkpoint)

**Stop unbounded iteration.** The user explicitly requested a clean transfer to a new project chat and an end-to-end finish without further cycling. Do not perform repetitive CI polling, reopen settled design questions, add minor enhancements, or silently rewrite draft PRs.

**Source-control boundary**
- Current implementation: [draft PR #496](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/496), head `53dbd2a339627530c759ebcf5ae3180a870c0c2c`, branch `feat/pec-s4-end-to-end-20261122` against `main` at `62ac12367486c6d270b6c4264f86bd10f01a2f3a`. PR is OPEN, DRAFT, mergeable. **NOT MERGED**, so its new UI is **not on main** or in the v6.2.0 installer.
- At this exact pinned head, **PEC Integrated Browser Acceptance #45004505941 = SUCCESS** and **PEC Vendor-wise Offset Export Integrity #45004505916 = SUCCESS**. Both completed. No need to rerun merely to reconfirm them unless source/build changes.
- The CI acceptance covers synthetic Chromium fixture controls and repository static/security regressions, **not independently authenticated production browser acceptance**.

**Live Supabase boundary — project `qhmoqtxpeasamtlxaoak`**
- Nine previously registered S4 migrations are applied and source-present in PR #496 (including the two earlier #495 migrations already on main). Source pins use branch/hash-checked migration guards; do not apply these migrations again.
- Latest installed S4 migration: `20261122084655_pec_s4_duplicate_pr_horizon_guard`.
- Rolled-back **server integration tests**: new PM generator for label #1638 (Label - Punarnavasavam 450 ML) produces **2,098 Nos** from original MRP **0 Nos** with frozen evidence; new and legacy RPC paths have been tested. PR-2026-08 legacy reconciliation dry-run: **719 candidates; 91 additional missing items; 7 review cases; 621 untouched existing lines update**, including label 0→2,098. PR-2026-07 dry-run: **502 candidates; 64 additional missing items; 30 review cases; 409 untouched lines update**. Neither reconciliation was committed; the real drafts and their purchasing quantities remain untouched.
- Canonical View-only session-claim can read 719 PM candidate rows; Edit denied; no-auth preview denied. Duplicate PR number, same-horizon duplicate PR, stale optimistic token, non-draft reconciliation and retired legacy CCF writer were tested to reject. A different horizon generated successfully inside a rolled-back transaction.
- **No real live PR activation, indent creation, purchase order, installer publication or full signed-in Editor pilot** has been performed. Do not portray rolled-back SQL test personas as authenticated operator acceptance.

**Residual work that actually prevents closure**
1. Review the *current* diff on PR #496 against the exact pinned head for severity-level contract issues only; avoid speculative refactoring. If unchanged and CI green, advance PR to ready for review and obtain/confirm owner merge authorization, then merge in one controlled operation. User's instruction is to complete this workflow, but release/publishing and production business-data changes must have distinct gates.
2. Verify PWA/Netlify published commit and a truly authenticated Editor plus View-only read-only preview on production, including 390px and expected review states. Never create real PRs just to test UI without authorization.
3. For the already-existing PR-2026-07/08: show final candidate counts and exception details to the owner, then request one explicit, consolidated approval to **reconcile both drafts**, preserving manual edits; use the guarded single-run reconciler only after approval. The user wants completion, but did not explicitly authorise modification of these specific production draft quantities.
4. Release new Electron UI as a **separate minor-version `v6.3.0` package** after merged client acceptance. v6.2.0 latest release was published 20 Nov 2026 and remains current. Bump `package.json` + `package-lock.json` on a separate release branch/PR; run Windows Electron tests and validate installer/ZIP/`latest.yml`/blockmap checksums and updater behavior. Require distinct user approval before public GitHub release/publishing or staff rollout. Do not assume PWA deployment updates installed Electron client.
5. Finish issue #305 and release documentation only **after** server, PR behavior, signed-in browser, installer and pilot acceptance evidence are assembled.

**Important semantics / caution**
- Consumption average: 12 **completed calendar months including zeros**; horizon 1–6 months. Demand alternative = max(stock-netted MRP, independently stock-netted consumption) minus approved/issued remaining indent balance; final eligible MOQ/Nos rounding. **Never sum both demand paths** and never count a newly created PR itself as an outstanding indent.
- New PRs: server auto-populates positive eligible recommendations; includes materials with consumption but absent from MRP; freezes per-line evidence. Ineligible/review states carry no automatic extra purchase quantity.
- The legacy v6.2.0 RPC now routes to the hybrid generator, and MRP-only rebuild on S4 PRs is blocked. A prior #495 single-line writer with inconsistent calculation has been retired; do not revive it.
- Source guard checked 9 planning-unit mismatches (MRP vs stock default) and added forward-only no-duplicate rule; review cases should not be silently forced.
- Avoid running future-horizon test PRs except within explicit `BEGIN … ROLLBACK`, and avoid repeated live queries after evidence is sufficient.

**Concise reporting rule:** Every continuation reply: `Server: PASS | Client: CI PASS, awaiting merge | Signed-in acceptance: PENDING | Legacy drafts: NOT RECONCILED | Electron v6.3.0: NOT PACKAGED`, updating only if evidence changes.

---

## Owner-approved objective

A PR must never omit a purchasable RM/PM material solely because production MRP suggests zero if historical consumption indicates a net procurement requirement. All sources must contribute to one auditable recommended quantity, not two quantities added together. Include valid consumption-only items missing from the MRP population; do not include internally produced finished-bulk/semifinished items. Keep manual corrections, permissions, origin provenance and audit history.

## Single calculation contract

1. Generate a 12-month consumption history from the **12 fully completed calendar months**, including zero-issue months. Denominator always 12, not number of nonzero months. Demand = (sum issues / 12) × inclusive selected planning months (1–6).
2. Existing `v_mrp_procurement_plan.procure_qty` is already stock-netted. Separately net the consumption demand against the **same authoritative current stock view**. Take the greater of these two *alternatives* — never add.
3. Subtract the **outstanding balances of approved or issued indents**, already net of FIFO allocated receipts, grouped by exact material class, item and UOM. No Tally purchase-order or ETA dependency. Never subtract the new candidate PR itself.
4. Clamp at zero, apply governed effective MOQ once, otherwise ceil indivisible `Nos` once. Kg/L retain permitted fractional precision.
5. **Fail closed per line** on stale or absent stock, incompatible source/UOM, negative stock, conflicting MOQ, incomplete MRP horizon. Show these as review-required in the PR, not a fabricated automatic increase. Never issue orders automatically.
6. Eligibility is RM/PM with active item/classification, RM scope (normal/JIT/all), and the existing internal FG-bulk/semi-finished restrictions. IND/other categories stay with legacy MRP only.
7. Freeze each PR's original MRP net quantity, historical usage, as-of stock/indent evidence, final system suggestion and review gate in an item-level protected audit row. All later revisions are separate and never rewrite historical evidence.

## Deployed SQL source of truth

| Production registered migration | Purpose |
|---|---|
| 20261122075009 | S4 read-only PR-line coverage preview from #495 |
| 20261122075447 | Single-line explicitly approved draft-only writer from #495 |
| 20261122082353 | Unified fresh PR hybrid planning preview |
| 20261122082532 | Atomic new PR generator + RLS-protected frozen evidence |
| 20261122082653 | Same-day, version-checked, exactly-once reconciliation of legacy drafts |
| 20261122083237 | Legacy Electron creation forwarded to hybrid generator; legacy S4-only MRP rebuild prohibited |
| 20261122083956 | Retire obsolete, differently calculated legacy single-line CCF writer; legacy CCF remains diagnostic only |
| 20261122084452 | Forward-only guard: never create default-UOM consumption-only duplicate when item is already in an MRP UOM |
| 20261122084655 | Transaction-locked guard against duplicate active/draft PR for the same class, scope and complete horizon |

All nine source migration filenames must exactly match the registered migration versions. New SQL is branch/SHA-pinned in the existing mutation-sensitive PEC protected-path guard. Never reapply migrations already in production.

## Acceptance receipts recorded so far

- Production inspection: 22-Nov-2026, label `Label - Punarnavasavam 450 ML` (stock item 1638), PM PR-2026-08 line 7044, old MRP zero, stock zero, 12 calendar months issues 12,587 Nos. Two-month recommended floor 2,098 Nos with zero outstanding eligible indent lines.
- In a **rolled-back test transaction**, new generator returned 2,098 Nos on the label and preserved 0 Nos MRP source in frozen audit; total candidate rows 719.
- In a separate **rolled-back test transaction**, PR-2026-08 reconciliation computed 719 candidates, 91 missing original PR lines, 7 review-required, and a proposed 2,098 Nos label; no live PR changes.
- Legacy Electron RPC compatibility exercised inside rollback: 2,098 Nos on label, 719 frozen evidence rows. No synthetic PR was retained.
- Existing real PR-2026-07 and PR-2026-08 remain draft; no automated modification, activation, indent or PO performed.

## Client contract

- Generate Draft PR from MRP → select horizon and RM/PM scope → **Preview MRP + Consumption Requirement** → see items requiring review and zero-MRP rescue count → explicitly acknowledge → **Generate** via `proc_pec_s4_generate_pr`. On any change to material class/horizon/scope, invalidate previous preview. Server recomputes on write. Old MRP-only client RPC no longer produces MRP-only PRs.
- PR detail → Review Consumption Coverage. For S4-generated PRs, show frozen source evidence; for old PRs, keep the read-only CCF diagnostic until reconciled.
- Eligible same-day legacy draft → Reconcile S4 (reason ≥20 chars + affirmative acknowledgement). The server checks updated_at, draft status, stock anchor and absence of previous reconciliation. Preserves all manual edits and includes absent items once. Rebuild from MRP must never destroy S4-sourced quantities.
- Review-required rows are not automatic recommendations and must be manually assessed before PR activation or indent. The PR lifecycle and existing permission rules remain authoritative.

## Regression and security acceptance

1. PostgreSQL 17 transactional/rollback tests for null inputs, length limits, UOM & count ceiling, MOQ duplicates, stale stock, conflicting indent allocations, simultaneous PR creation, duplicated PR number, protected internal material, inactive item, class/scope separation, output/ledger parity and evidence immutability.
2. Access: no-auth and no-access denied, View-only preview allowed but writers denied, PEC Editor allowed only within canonical guards. Ensure audit table cannot be selected or written directly by authenticated users. Test optimistic concurrency and same-day anchor rejection.
3. Chromium: 1440px and 390px, new preview, stale preview invalidation, explicit generation acknowledgement, no writes on preview, protected per-item review, existing-draft reconciliation, keyboard/escape, no horizontal clipping, no accidental second submission.
4. Integration: latest production main and PWA cache/controller, audited endpoint, 0 live writes during View-only acceptance, normal create PR read-only until owner decides to perform positive test.
5. Confirm two real draft PRs reflect correct *preview evidence* before any actual reconciliation; no owner draft mutation without explicit affirmative acceptance.

## Electron release — planned minor v6.3.0

Verified current latest release is [v6.2.0](https://github.com/Brahmadathanu/sasv-workspace-dev/releases/tag/v6.2.0), published 20 Nov 2026; current package version 6.2.0.

**Do not bump package.json/package-lock.json as part of #496.** After #496 CI PASS and merge to main, derive a clean **release/v6.3.0-pec-s4** branch from its exact main commit. Bump both root package version fields, update release notes, and open a dedicated release PR. Run the Windows GitHub Actions `Electron smoke (Windows, isolated profile, loopback)`, `npm ci`, Electron updater tests and the PEC integrated regression against the release candidate. Treat Netlify/PWA and packaged Electron as separate deployment channels; confirm the installer embeds exactly the accepted client commit.

After owner explicitly authorises publication, package NSIS setup and zip on a trusted Windows builder. Verify exact SHA-256 digests for `SASV-Workspace-Setup-6.3.0.exe`, `SASV-Workspace-6.3.0-win.zip`, `latest.yml` and blockmap. Publish GitHub release tag `v6.3.0` only once artifacts are verified and signed-off; never overwrite `latest.yml` or silently activate the updater before that gate. Install on the developer's PC or a pilot staff PC, verify authenticated Editor/View-only PR preview and creation against real Supabase (no forced writes), and then roll out to the remaining fewer-than-10 staff installations with rollback to v6.2.0 documented.

## Progress indicator instruction for continuation chats

Every material response on PEC S4 includes concise progress of: **SQL**, **client**, **CI**, **production acceptance**, **Electron release**, with explicit PASS/PENDING/BLOCKED; do not label workflow completed while any required gate remains open.

## Claude Code delegation option

If Claude Code is available on the user's development computer, assign one *bulk, self-contained package*: validate PR #496 frontend accessibility/responsiveness, write/extend 390px browser tests, run Electron Windows smoke and 6.3.0 release-readiness proof against exact pinned main commit. Do not allow Claude to merge, deploy migrations, modify production PRs, publish installers or alter server purchase authorization. Return a PR and a machine-verifiable test receipt; this assistant remains owner of server orchestration and integration.
