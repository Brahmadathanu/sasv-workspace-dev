# Cost Comparison scoped RPC — live migration synchronization (11 Nov 2026)

**Governance classification:** source-history reconciliation after owner-authorized live server installation; **not a request to reapply** the SQL. See [incident #273](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/273#issuecomment-6797319063).

## Exact already-applied migration

- Supabase project: `qhmoqtxpeasamtlxaoak` (SASV production).
- Applied Supabase migration version/name: `20261111133505_csr_scoped_comparison_rpc_additive_20261111`.
- Source: prepared SQL at PR #275 head `74d1e17967115b0cf799b4b26c8dc514c5d60c43`, original Git blob SHA `3d6b653c94ac34cb4cfc4b269465fa61eb73a51c`.
- Corresponding repository file: `supabase/migrations/20261111133505_csr_scoped_comparison_rpc_additive_20261111.sql`. The file contains **exactly the originally applied SQL text**, including historic “PREPARED, NOT APPLIED” comments that described its pre-install status; those comments are now superseded by this dated record. The file is deliberately not rewritten to keep provenance byte-identical.
- Production Supabase `apply_migration` returned success and `list_migrations` confirmed the version. SQL *must not* be replayed manually: its create-only guards reject an existing signature.
- Observed after application: exactly one `public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(date,integer)`; `postgres` owner; STABLE SECURITY DEFINER; pinned search path; `authenticated` may EXECUTE, `anon` and PUBLIC may not; source governed view MD5 remained `63adf7946b8d7f99a01a05e5e54d00be`; signed-out invocation returned `P0001 Not authenticated`.
- No view, table, snapshot, index, RLS, cost data, timeout, cache, flag, PWA or Electron change intended in that deployment.

## Remaining acceptance blockers

Function installation **does not** resolve the old client view load. #276 remains draft/default OFF and is **not deployed**. Real ID-V authenticated PostgREST read, ID-N/ID-X denial, observed RPC response times for Sep/Oct/Nov and October no-regression, result parity and controlled browser rollout remain open. Historical #24 D-7 FAIL retained, WP05 OPEN, formal Costing Programme 6/13.

## Release/process safeguard

Before merging this documentation synchronization, ensure migration runners recognize the same already-applied version and do not attempt a second execution. This PR adds the existing version to source history for future clean builds and auditability; it is **not a new production execution authorization**. The stacked #275 prepared file and #274 diagnosis remain evidence/review PRs. A later #276 client merge, PWA deployment and flag activation each require separate acceptance.
