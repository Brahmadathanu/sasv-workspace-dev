# SASV Manufacturing Costing, COP & Board Price Revision — Independent Programme

## Programme identity and isolation
**This is NOT the Master Data / Costing Suite UX Consolidation programme.** This programme concerns manufacturing cost of production, cost absorption, standard manufacturing rates, packing labour, financial integrity and the Board's 509-SKU price revision.

**Sole documentation root:** `docs/manufacturing-costing-price-revision/`.

The distinct `docs/master-data-costing/` directory owns Product/SKU master-data governance, costing *user interface* rationalisation and WP05 onward. It does **not** govern the execution gates of this manufacturing costing/price revision sprint. Never write this programme's ledger or handovers inside `docs/master-data-costing/`, never increment or reopen its work packs, and never infer a shared programme from a shared application or Supabase database. The other programme may be consulted only for an explicit cross-programme interface dependency; those are not authority to alter it.

## Read-first sequence (every new chat)
1. This README.
2. `IMPLEMENTATION_RULES.md` (this directory only).
3. `MASTER_PROGRAMME.md` (this directory only).
4. `SPRINT_EVIDENCE_HANDOVER_2026-10-15.md` **in full**.
5. `CHANGELOG_DECISIONS.md` and `WORKPACK_HANDOVER_TEMPLATE.md` here.
6. Live repository branch/main, Supabase project `qhmoqtxpeasamtlxaoak` and immutable historic run 119; identify any changes since the handover.
Do not default to `docs/master-data-costing/MASTER_PROGRAMME.md` or its WP05.

## Execution model
ChatGPT owns server examination, server changes after appropriate governance, and live verification. Separate client work follows existing isolated feature-branch audit/merge discipline. No unapproved financial classification, rate cutover, historical rewrite or production refresh. Documentation updates use the dedicated programme directory only. Keep completed decisions locked; move one gate at a time, at sprint pace.

## Programme output
A reproducible, financial-source-reconciled, production-output-driven manufacturing COP and Board 509-SKU price proposal, with effective-dated source authority, explicit exceptions, independent audit and production-ready governed cutover.
