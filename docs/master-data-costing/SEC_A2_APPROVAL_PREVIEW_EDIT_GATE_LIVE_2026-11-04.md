# SEC-A2 — Approval-preview acknowledgement edit gate: live correction

**Date:** 4 November 2026 · **Status:** APPLIED; live source/ACL verification PASS; authenticated role behavioural acceptance still PENDING.

## Authority, scope and rationale

This correction advances the **existing** Costing Suite unified workflow. The owner requested to continue following SEC-A1, without a paid Supabase development branch. Do not mistake this record for formal closure of WP05, WP06, MDC-07 or WP12.

The `public.rpc_costing_preview_approval_impact(bigint)` RPC used to call `public.require_permission('module:costing-control-center', false)`, then **INSERT** into `costing.costing_approval_preview_ack`. The returned `preview_ack_id` is a mandatory input for current governed `rpc_costing_approve_run_with_preview` and `rpc_costing_finalize_monthend_run_with_preview` flows. Opening a preview thus creates a recorded token, not a pure read.

The client `public/shared/js/costing-approval-screen.js` calls this RPC **only on an explicit Review/Open-preview action**, not at page load. This change preserves that client flow for CCC editors. View-only users should not open this approval preview during acceptance and must not be treated as approval-preview authors.

## Applied governed migration

- **Target:** Supabase project `qhmoqtxpeasamtlxaoak` (live).
- **Migration:** `20261104160256`, named `sec_a2_costing_preview_ack_ccc_edit_gate_20261104`, confirmed in `supabase_migrations.schema_migrations`.
- **Applied by:** Supabase `apply_migration`, returned `success: true`.
- **Exact change:** in `public.rpc_costing_preview_approval_impact(p_refresh_run_id bigint)`, replace the sole occurrence of `public.require_permission('module:costing-control-center', false)` with `public.require_permission('module:costing-control-center', true)`. The rest of the live function body was retained from `pg_proc.prosrc` and used in a guarded dynamic `CREATE OR REPLACE FUNCTION`. The migration rejected unexpected source/attribute hashes and asserted the final expected body hash.
- **Body MD5 before:** `b6f826eba78d6cf25c1973f45ade158b`.
- **Expected and verified body MD5 after:** `9911a0c6f2b9c40f762059757e44560e`.
- **Function properties unchanged:** `public` signature `(bigint)` returning `jsonb`, `plpgsql`, VOLATILE, SECURITY DEFINER, owned by `postgres`, `search_path=public, costing, pg_temp`; `authenticated` EXECUTE retained, `anon` EXECUTE absent.
- **Data invariant:** the acknowledgement table had **0 rows before and 0 after**. No preview RPC or approval/finalisation RPC was executed, no approval history or costing run state was changed.
- **No paid branch:** none created. No user, permission record, feature flag, release, cache, or frontend source changed.

## Verification and remaining limitations

**PASS:** source hash, function security attributes, authenticated/anon EXECUTE grants, migration-history record, no acknowledgement table change.

**NOT TESTED:** real authenticated CCC-view-only denial and CCC-editor ability to open an actual populated preview. Do not use production business records to simulate approval or finalisation. No dedicated six-module view-only account has been established. A safe approved role-test strategy is still required.

**Client acceptance warning:** the approval screen may still surface a Review button to a view-only reader, because this change is server-side only. That would now yield a server permission error. Check actual client permission gating with focused tests and correct any confusing affordance in a separate client PR if necessary. A view-only acceptance session must not click it. Do not count UI rendering alone as functional authorisation verification.

**SEC-A1:** previously applied migration `20261104155525` remains installed (three material-review accept/close internal CCC-edit checks). **D3:** requiring MCM edit *in addition to* CCC edit remains an owner policy question. Do not silently add it.

## Programme consequence and next gates

- Server-side source/contract corrections **SEC-A1 and SEC-A2 applied**, not merely prepared.
- Formal closure **5/13 (38%)**, unchanged; WP05, WP06, MDC-07, WP12 still open.
- Next: inspect client preview affordance/read-only role handling, safely establish view-only permission evidence and denial tests, then authorised signed-in six-module and eleven-flag acceptance against proven integrated source/build identity.
- CDE-2 protected draft evidence, C5/D5 historical run selector, S2/S9 parity/performance and owner O-/D- decisions remain tracked under [programme progress](PROGRAMME_PROGRESS_AND_CLOSURE_PATH_2026-11-04.md).
- All flags remain default OFF; PWA cache and Electron release remain unchanged. No e-Aushadhi WP-07 or Manage Activities change.

This is the current SEC-A2 evidence; historic earlier security-audit statements that SEC-A2 was uncorrected are superseded.
