# SEC-A1 — Live application and post-migration verification (4 Nov 2026)

> **Status: APPLIED TO PRODUCTION; static/catalogue verification PASS; real user role-path testing PENDING.** This record supersedes pre-application HOLD banners in the prepared SEC-A1 plan, without overwriting its historical plan or rollback evidence. Formal Costing programme closure remains **5/13 (38%)**.

## Authority, scope and provenance

- **Owner instruction:** 4 November 2026 — do not purchase a Supabase development branch; independently review and implement the correction in the existing database.
- **Target:** Supabase project `qhmoqtxpeasamtlxaoak`.
- **Migration:** `20261104155525` / `sec_a1_material_review_ccc_edit_permission_guard_20261104`, recorded in `supabase_migrations.schema_migrations`.
- **Applied through:** managed Supabase `apply_migration` tool. Response: `success: true`.
- **SQL source:** [captured guarded APPLY](prepared/SEC_A1_MATERIAL_REVIEW_EDIT_GATE_APPLY_20261104.sql), GitHub blob `e990bd3c8a2252f39b0d87fef55e2c04a07a2c0d`. [Exact pre-change ROLLBACK](prepared/SEC_A1_MATERIAL_REVIEW_EDIT_GATE_ROLLBACK_20261104.sql), blob `d6dfb3f4cc9a686e393d547f98be3028dcc47367`. Both are stored under `docs/` as provenance, **not an unapplied migration to run again**.
- Preflight re-read live functions immediately before applying; all three original `prosrc` MD5s, owners, `SECURITY DEFINER`, `search_path` and direct EXECUTE grants matched captured baseline.
- No branch, paid Supabase development environment, synthetic identity, new user, PWA/Electron client, feature flag, costing refresh or separate acceptance write was created.

## Exact live changes and verification

One first-statement check was added to each `costing` routine:
`perform public.require_permission('module:costing-control-center', true);`

| Internal function | MD5 before | Verified MD5 after |
|---|---|---|
| `costing.rpc_accept_material_review_action` 10-argument overload | `23d406a822ceb748f1ee272a48c2c589` | `50712d2cbbf09b1be0764966d604f092` |
| `costing.rpc_accept_material_review_action` 7-argument overload | `c2801c07767c615a1e46ca94b408cb0c` | `326211fd5e811bdab52aa6ce421d56b7` |
| `costing.rpc_close_material_review_acceptance` 2-argument | `a6b13f1c7b6a2b2ca04cb295f54ee03d` | `32077cdd5599de73d7d8867211820f24` |

**Post-apply catalogue check passed for all three:** new permission check present and before original actor validation; owner remains `postgres`; `SECURITY DEFINER=true`; VOLATILE unchanged; `search_path=costing, public`; no internal direct `authenticated` execute grants; public wrapper `authenticated` execute grants preserved, `anon` execute false. The prepared full-body diff was independently compared to rollback and had exactly one check inserted per function.

**Acceptance-register invariant (observed post-apply):** `costing.material_review_acceptance_register` = **1,701 rows**, **1,696 ACTIVE**; `max(updated_at)=2026-10-24 06:09:52.106579+00`, i.e. no new update timestamp from this deployment. A pre-apply aggregate baseline was not recorded, so do **not** claim formally proven row-by-row equality.

**Security advisor:** ran after migration. Project-wide legacy/general findings exist including 87 security-definer-view errors, 604 authenticated-executable security-definer-function warnings and other advisories. These findings are not evidence that SEC-A1 introduced new issues; a before/after advisor diff was not captured. Review separately; do not widen the SEC-A1 change scope.

## Current residual gates and limits

- **SEC-A1 live source gate: PASS.** Both acceptance overloads and closure now require CCC edit at internal function entry.
- **SEC-A1 real-role behaviour:** NOT TESTED; without an isolated environment or a verified six-module view-only account, no synthetic JWT impersonation or business-record mutation was performed on production. Need controlled view-only denial and legitimate editor regression tests without harming live records. The server source gate improves protection, but does not mean full WP signed-in acceptance is complete.
- **SEC-A2 is still OPEN:** `public.rpc_costing_preview_approval_impact` writes an acknowledgement after a CCC-view check; exclude from strictly read-only acceptance pending governance decision.
- **D3 remains a policy decision:** adding MCM-edit to CCC-edit was neither decided nor implemented.
- **View-only acceptance account:** no existing all-six view-only user established; creation/permission granting remains separately governed.
- **CDE-2, C5/D5, S2/S9, WP05/WP06/MDC-07/WP12:** open. All eleven feature flags remain default OFF; no deployment, PWA cache, Electron version or e-Aushadhi WP07 change.
- **Rollback:** the captured rollback SQL must not be run routinely. It would **remove this correction** and reopen SEC-A1. Requires explicit incident-level owner approval, expected post-patch fingerprints, and a plan for alternate exposure control.

## Programme closure interpretation

This is **one completed server remediation**, not a formal work-pack closure. Retain programme **5/13 (38%)** and the recent client wave **3/3 merged**. Next: safely design role-level acceptance and SEC-A2 disposition, then the signed-in WP05/WP06 matrix with verified source SHA and authorisation; do not mislabel 'source verified' as 'real user acceptance'.
