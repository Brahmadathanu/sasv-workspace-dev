# PEC S4 — End-to-end Hybrid Replenishment / Electron 6.3.0 Release Packet

**Date:** 22 November 2026 (IST). **Programme:** PEC S4, issue #305. **Implementation:** PR #496. **Release decision:** NOT YET ISSUED. Keep the current v6.2.0 release and its GitHub latest.yml intact until a separately approved v6.3.0 publication.

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

All six source migration filenames must exactly match the registered migration versions. New SQL is branch/SHA-pinned in the existing mutation-sensitive PEC protected-path guard. Never reapply migrations already in production.

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
