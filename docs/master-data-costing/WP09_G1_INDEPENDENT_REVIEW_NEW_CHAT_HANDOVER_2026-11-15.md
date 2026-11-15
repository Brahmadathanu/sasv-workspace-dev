# SASV Costing Suite — WP09 G1 independent review and next-chat handover (15 November 2026)

**Authoritative handover, not a G2 design approval.** WP08 conditionally CLOSED, WP09 OPEN at G1, programme **9/13**. Repo `Brahmadathanu/sasv-workspace-dev`; original audited main `5735321c4524a9f93947435bd1eccb0f7d7cf9ae`. **Draft PR #434**, branch `claude/lucid-gates-6uwfvx`, was initially submitted by Claude at `4c5e114d00f0359a45787f705fd78e53f725021d`. Later ChatGPT read-only Supabase reconciliation added data/addendum to the **same PR branch**; refresh PR head before doing anything. Issue #432 owns G1.

## Completed and credible evidence
- WP09 G1 Claude source audit: 92 HTML pages, 77 candidate mapping rows (32 source-token based / 45 inferred), source and browser test reports **author-reported PASS 50/50 and 33/33**, with browser results **synthetic registry and grants**. Existing WP08 fail-closed **81/81 PASS**, historical G2-0 source 2 failures retained as baseline, not hidden. No app, SQL or permission change.
- Claude source observations: dense Product & Reference 15, Inventory & Sales 15, MRP & Procurement 12 Electron cards; legitimate specialised modules are **not** duplicates (six Costing entry tiles, RM/PM issues and rebuilds, stock positions, ETL read/control, WP08 redirect stubs). Label-only Electron search and Quick Access, no PWA search/Quick Access, hardcoded section keys/icons, potential fallback order issue, source-only season-profile two-writer overlap. Source-only `production-overrides.html` references missing JS/CSS and appears redundant with Supply Overrides **but it is NOT a currently registered module**.
- **Independent live metadata capture now COMPLETE:** On 15 Nov ChatGPT executed read-only SELECT via Supabase project `qhmoqtxpeasamtlxaoak` against `v_app_module_registry`, `app_modules`, `app_nav_sections`; committed exact metadata-only JSON to PR #434 at `docs/master-data-costing/WP09_G1_EVIDENCE/live-registry-snapshot-2026-11-15.json` and an authoritative addendum `WP09_G1_LIVE_REGISTRY_RECONCILIATION_ADDENDUM_2026-11-15.md`. **85 modules**, 6 inactive, **120 client registrations = 79 Electron + 41 PWA**, 11 active sections, no duplicate active client route and no orphan section; all PWA modules also on Electron. No private role/permission data collected.
- **Specific G1 blocker now identified (not Supabase access):** Claude's 77-row candidate mapping omits 7 *registered Electron* keys: `coa-print`, `edit-log-entry`, `lab-workflow-access-control-manager`, `sop-editor`, `sop-viewer`, `tally-inv-mapping`, `test-method-master-manager`. Five candidate keys have no active Electron counterpart: `production-overrides`, `manage-season-profiles`, `manage-tally-inv-mapping`, `lab-test-method-master`, `lab-workflow-access-control`. Three are clear page-name / registry-key aliases to rebind; others are source-only, not registered. Child pages `coa-print`, `edit-log-entry`, `sop-editor`, `sop-viewer` *are registered launcher modules*, regardless of their source-page audit categorisation.
- Live sort ties at MRP order 110 (`plant-occupancy`, `vendor-master`) and Product order 95 (`pricing-policy-manager`, `production-route-manager`) are deterministic by label, not proof of a bug.
- Live denied/view-only role acceptance, packaged Electron and installed-PWA acceptance **NOT TESTED**; reserved for later WP12. No live usage evidence. Synthetic browser heights cannot establish real UX performance.

## Draft architecture options / current recommendation
- **A:** retain existing 11 sections and add client-side subgroup headings. Lowest registry risk.
- **C (after A):** optional collapsible module families. Claimed **30 top-level tiles** is **PROVISIONAL**, calculated from 77 page-mapping candidates and must be recalculated against all 79 live Electron registrations.
- **B:** domain re-sectioning with registry/section mutations and client icon/colour changes; high-cost, owner approval required.
- No choice is yet binding. First complete the exact live mapping and rerun the offline verifier; hold G2 design freeze. Six Costing modules should remain distinct permission/route targets even if grouped visually.

## Immediate next-chat execution instructions
1. **Fetch latest main and PR #434 head, issue #432, the G1 report, new live snapshot and addendum.** Read the actual files; do not treat this handover as a replacement for sources.
2. Independently verify the snapshot schema and exact mapped keys. Compare `module-group-mapping.csv` / `module-mapping.mjs` to all **79 active live Electron module keys** and 41 PWA. Correct seven missing keys, five candidate mismatches and any additional alias/route errors **inside PR #434**; keep source-only pages in a distinct legacy appendix. Prefer one bounded Claude bulk correction, not repeated handover requests.
3. In a full-history worktree, run `node scripts/wp09-g1-launcher-audit/registry-verify.mjs docs/master-data-costing/WP09_G1_EVIDENCE/live-registry-snapshot-2026-11-15.json`, source-contract tests and required mutation negatives. Fix verifier assumptions if needed without weakening them. Publish exact L1–L12 status, not guessed PASS.
4. Recompute Option A/B/C coverage and per-client top-level tile count from **actual live registered keys**. Confirm fallback injection for Product Shelf Life and Staff Directory based on the live snapshot (do not assert missing rows if present); confirm current production-overrides is unregistered.
5. Reconcile report's old no-DB/BLOCKED banner with the new independent capture while preserving the original session limitation as history. Update `WP-09-WIDER-APP-IA-AUDIT.md` and deliver one reviewable draft PR #434, **still unmerged** until independent review.
6. Once all mapping/verifier tests pass, propose owner decision on A→C, season-profile canonical writer, Costing six family, PWA search/Quick Access and legacy production-overrides (not a launcher removal). **Do not implement G2 until approved.**

## Scope and stop rules
No Supabase writes, registry `INSERT/UPDATE`, permissions/grants/RLS, SQL migration, global flags, launcher UI implementation, WP08 or PEC reopening, electron route Step B, deployment or closure. Do not touch five historical `supabase/migrations/20261112*` CRLF-only working-tree differences. Preserve existing WP08→WP12 receiving cases `W12-WP08-01…08`, PM BOM 390px FAIL (WP11), SKU Deactivate contrast #429 (WP11), Pricing unknown routes text-only. WP09 remains **OPEN**, programme **9/13**.

## Pointers
- [Issue #432](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/432) — bulk G1 mandate and baseline.
- [Draft PR #434](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/434) — source audit, synthetic tests, live snapshot/addendum and corrective review comment.
- `docs/master-data-costing/WP-09-WIDER-APP-IA-AUDIT.md` — WP09 authority.
- `docs/master-data-costing/WP09_G1_BULK_AUDIT_REPORT_2026-11-15.md` — source audit and options (draft PR).
- `docs/master-data-costing/WP09_G1_LIVE_REGISTRY_RECONCILIATION_ADDENDUM_2026-11-15.md` — authoritative live differences (draft PR).
- `docs/master-data-costing/WP09_G1_EVIDENCE/live-registry-snapshot-2026-11-15.json` — actual capture (draft PR).
- `scripts/wp09-g1-launcher-audit/registry-verify.mjs` — mapped-key acceptance gate.
- `docs/master-data-costing/WP08_OWNER_AUTHORISED_CONDITIONAL_CLOSURE_2026-11-15.md` and `WP08_WP12_OWNER_AUTHORISED_RECEIVING_LEDGER_2026-11-15.md` — prior closure and protected follow-ups.
