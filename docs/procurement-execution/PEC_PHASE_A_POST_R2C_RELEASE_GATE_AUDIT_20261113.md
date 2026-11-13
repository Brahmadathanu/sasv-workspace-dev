# PEC Phase A — Post-R2c acceptance and security release gate audit

**13 November 2026 | Owner-approved visual UI | RESTRICTED RELEASE GATE**

> **Latest status takes precedence over earlier audit snapshots:** The owner authorized and the server-only Add Line wrapper was successfully deployed later on 13 November. Review the final dated deployment addendum below. Earlier statements that the production guard was absent are historical pre-deployment observations, not the current state. Historical migration registration and genuine-role tests remain open.

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

## 13 November 2026 — owner-authorized production Add Line restriction

- **Owner authorization:** after being explicitly asked for permission to execute the exact reviewed PR #374 Add Line security migration, owner replied "go ahead." This authorized the narrow production function replacement, not a migration-history repair, other historical SQL, permission broadening or main promotion.
- **Applied in live Supabase:** exact `CREATE OR REPLACE FUNCTION public.proc_indent_add_line(bigint,bigint,bigint,bigint,numeric,text)` definition from PR #374, inside a single transaction after the expected original `pg_get_functiondef` MD5 `cf6c1748d8cd50176c3bebe02263b21f` and ACL checks. Transactional postcondition checks passed.
- **Read-only postflight:** new function MD5 `a19fabfd29ffba4d937df1bbf09453c2`; `v_line_exists` and draft/non-PR new-row guard present; authenticated wrapper EXECUTE `true`, anon wrapper EXECUTE `false`, authenticated internal writer EXECUTE `false`; 45 header and 1,593 indent-line rows observed after deployment (postflight counts, **not** proof of unchanged row values). No application DML was performed in the deployment statement.
- **Migration tracking still separate:** `20261112220000` is **not registered** in `supabase_migrations.schema_migrations`. Only one non-PEC Nov 12 migration version is present; ten historical PEC Nov 12 entries remain unregistered. This is a known **function-present/history-missing** state, requiring governed official reconciliation to avoid repeat DDL.
- **Boundaries:** dedicated isolated PostgreSQL 17 negative-test suite PASS, but genuine signed-in Editor/View-only/no-access negative tests, concurrency and lifecycle proof are **NOT TESTED**. Draft PR #374 remains unmerged; general client-only static guard rejects SQL in the feature branch and must not be weakened. Do not count G0–G5 as closed.
- **No production data edits, broad grants, service-worker edits, main merge, migration-history writes, or cleanup deletions** were authorized or carried out in this operation.
