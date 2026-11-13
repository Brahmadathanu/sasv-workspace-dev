# PEC Phase A — Post-R2c acceptance and security release gate audit

**13 November 2026 | Owner-approved visual UI | RESTRICTED RELEASE GATE**

## Verified immutable sources

- Staging integration branch `integration/pec-erp-staging-20261112` at `8cc89ec22cd7813fc5b63373c090eb815b79c30e` (before this documentation-only commit): 8/8 GitHub Actions SUCCESS, Netlify #347 deploy preview SUCCESS. Source PR #378 merged, owner personally passed the R2c mobile visual experience. **This acceptance is UX only**.
- Draft server #374 remains unmerged and not executed in production. Separate PostgreSQL 17 isolated fixture passed. Its generic integrated *client-only* SQL/SW guard rejects the intentional new migration: workflow failure is expected by scope, not a passing security permission test. Do not disable this guard or mark its workflow PASS.
- Live read-only `public.proc_indent_add_line` wrapper: `authenticated EXECUTE = true`, `anon EXECUTE = false`, `r2_guard_present = false` (observed via pg_get_functiondef on 13 November). This is the **remaining production writer loophole**; hiding Add Line in the client does not close it.
- Existing release readiness source: `PEC_ERP_RELEASE_READINESS_20261112.md`. Live migration history currently records `20261112042921` for an unrelated lab migration, but **none of the ten PEC Nov 12 migration versions** described in this programme. Direct production function object changes preceded version registration. Do not conflate registered migrations with effective objects.

## Gate disposition (do not silently promote)

| Gate | Verification basis | Current disposition |
|---|---|---|
| G0 — baseline/inventory | Existing client/server survey and staging source | Evidence available; gate not formally independently signed |
| G1 — contract/policy | Governed migration and pagination contracts | Evidence available; final server Add Line policy pending production decision |
| G2 — server correction | Ten PEC migration registrations and approved Add Line writer gate | **BLOCKED** — migration-history reconciliation and guarded live execution require explicit owner approval |
| G3 — client modernisation | R1→R2c staging, exact-head CI, source parity | Technically verified with owner mobile visual PASS; **not formally closed** |
| G4 — independent acceptance | Genuine Editor/View-only/denied RPCs, installed PWA online/offline, Windows Electron | **NOT TESTED / PARTIAL**, blocking full acceptance |
| G5 — owner final release | Latest build source/CI, production promotion, release sign-off | **NOT AUTHORIZED**; staging-only UI visual acceptance does not authorize `main` merge |

**Formal gate count remains 0/6 closed** pending named sign-offs; evidence below must not be relabeled PASS.

## Next bounded actions, ordered

1. Owner may authorize an exact scoped `#374` migration after independent review of function signature, ACL, concurrency, full key identity, compiled PG17 fixture and plan to obtain authenticated Editor/denied-role negative results. **No execution without a separate explicit approval**.
2. Official migration-history pipeline: first verify ten PEC versions and current effective function signatures/hashes against source; construct an idempotent, reversible guarded registration/reconciliation plan and present it for distinct approval. Never use ad-hoc `INSERT` into migration history or replay live DDL blindly.
3. Run authorized signed-in role acceptance on latest preview: Editor read/write eligibility; View-only no writer; denied no sensitive reads; no raw JWT or credentials in evidence. Use authentic accounts, not simulated role flags.
4. Installed-PWA online/offline/cache freshness with verified preview provenance, service-worker activation and restored baseline. Windows packaged Electron with source-byte parity; platform gaps stay NOT TESTED if devices are unavailable.
5. Confirm transient AQ→Excess failure diagnostics if it recurs; root cause remains unconfirmed despite bounded retry and improved classification. Never claim resolved on lack of reproduction.
6. Only after approved gate evidence: final integration promotion plan, approval and deploy. Then record hygiene ledger: delete disposable local screenshots duplicates/profiles/builds only after retained evidence inventory; preserve canonical screenshot set, immutable migration history, CI, issues and audit trail. No destructive production cleanup.

## Release safety and exact scope

- No production SQL/permissions/data mutations or migration-history edits were made during this audit.
- No new module release or `main` merge; no schema rewrites, no privileged previews.
- Stage R2c owner UX PASS is real and recorded, but formal G0–G5 not closed by this scoped pass.

**Reconcile against live GitHub/Supabase again before authorizing any later work.**
