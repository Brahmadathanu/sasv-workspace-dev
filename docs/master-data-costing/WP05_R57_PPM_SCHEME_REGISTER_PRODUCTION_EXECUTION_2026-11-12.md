# WP05 R57 — Owner-authorised Scheme Master Register reader correction executed (12 November 2026)

**PRODUCTION APPLIED, INDEPENDENT LIVE CATALOGUE PASS; AUTHENTICATED PWA RETEST PENDING.** Owner explicitly approved executing the exact guarded R55 SQL from draft PR #355 only for `public.v_costing_scheme_master_register`. This is distinct from the earlier business-policy approval R56; no other production policy was authorised.

## Exact executed source and prior tests

- Supabase project `qhmoqtxpeasamtlxaoak`.
- Reviewed current-main **draft [PR #355](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/355)**, apply file `docs/master-data-costing/candidates/WP05_R55_SCHEME_REGISTER_PPM_APPLY_REVIEW_ONLY.sql`, immutable Git blob **`8e86c50e680287e9c0cb140b7afd273dfac6a9d5`**. Source verified against expected SHA and full transaction/guard before execution; applied **exactly once**, no substitute/generated SQL.
- [Exact-head isolated PostgreSQL 17 workflow 43214235623](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43214235623): **8/8 PASS** including PPM View-only positive, CCC/CBM/CSR/MCM-only negative, original 34 columns/invoker/SQL grant/owner invariants and hash-guarded rollback restoration.
- Before execution live preflight: original view MD5 `8fdc0306bd2f1efbe0638c7c13ba4dda`, all 34 column names/types, owner `postgres`, SQL ACL `{postgres=arwdDxtm/postgres,authenticated=r/postgres}`, reloptions `{security_invoker=true}`, authenticated SELECT=true/anon SELECT=false. Source tables `costing.scheme_master`, `costing.scheme_policy_rules`, `costing.sku_scheme_policy`, `costing.sku_scheme_viability_snapshot`: original authenticated SELECT/schema USAGE/RLS enabled; untouched. Audit view and three permission helper body hashes matched retained baselines.
- The guarded file executed in a single `BEGIN/COMMIT` transaction with 3-second lock timeout and 45-second statement timeout; startup hash, columns, grants, owner, invoker and postconditions checked. This is a **direct production SQL change, not a Supabase migration-history entry**. Do not automatically replay the script as a new migration.

## Independently verified live post-deployment state

| Property | Previous live | New live |
|---|---|---|
| `md5(pg_get_viewdef(...,true))` | `8fdc0306bd2f1efbe0638c7c13ba4dda` | **`903cb8eae3702bf72e41213ec2c89c6e`** (exact isolated tested candidate) |
| Ordinary authenticated reader | shared CCC/CBM/CSR/MCM predicate | **PPM View only** |
| Output fields | 34 | **34, same source projection/type contract** |
| Owner | postgres | **postgres** |
| `relacl` | `{postgres=arwdDxtm/postgres,authenticated=r/postgres}` | **Unchanged** |
| reloptions | `{security_invoker=true}` | **Unchanged** |
| authenticated SELECT / anon SELECT | true / false | **true / false** |

Explicit WHERE ends with `app_has_permission('module:pricing-policy-manager','view')` for normal signed-in readers, preserving existing postgres/service_role technical support branch. No Edit authority is added, no grants broadened, no shared `fn_costing_view_allowed` altered.

**Other independently confirmed stable objects**:

- Scheme Master Audit MD5 `e2b9eb3c1b86d073183cd376f704cf58`.
- MCM History `01029a39e47a300aa7860d17b2f39cae`, MCM Register `38b4262bfae719ca3f736185784fd047`.
- CCC/MCM Acceptance Register `0dcc3db262a30a9b770720dcb48e6376`.
- Detailed SKU Cost Sheet `4faaae56558dddbc3b418146f2ab8c59`, full Line Traceability `800a546b711a9658e9f81a58b6e78303`.
- Shared function `md5(prosrc)`: `app_has_permission` `12727b365c1728d3830eeab039b6e344`, `app_has_permission_core` `b75d5b4ee5cc6c464149c5743e165b95`, `fn_costing_view_allowed` `b7efb09b90fa3e9332915ba5d223568c`.
- The designated existing test account still has **PPM View-only** among six Costing modules; five other Views false and **all six Edit=false**. No test-account update was executed.

## Rollback and draft lifecycle

Original exact guarded rollback, Git blob `48a60d885c83024789af8309f2907024a116f676`, remains in review PR #355 as evidence. It checks candidate view MD5 `903cb8eae3702bf72e41213ec2c89c6e` before restoring original `8fdc0306bd2f1efbe0638c7c13ba4dda`. **Rollback NOT executed.** The review-only draft must be **closed unmerged** to avoid accidental SQL replay. An actual rollback requires separate operational owner/incident approval and fresh catalogue verification.

## Owner browser validation still pending

Using the unchanged PPM-only test account, sign out fully and sign back into the normal PWA, navigate **Pricing Policy Manager → Scheme Master**, clear search and filters, and confirm the Scheme Master list is **populated** (formerly empty). Open a scheme that has audit history and check **History** (populated / empty / error / not observed). Do not share prices, actor names, tokens, source JSON, or raw data. The previous R54/R55 Stage 4 EMPTY result remains retained as **historical failure**; the post-fix owner test is **NOT YET EXECUTED**, thus Stage 4 is **NOT YET PASS**.

Stage 5 negative role testing and final restoration to the original six-module `can_view=true` / all six `can_edit=false` test-account baseline remain pending. No PWA release, client code, users' unrelated permissions, Costing run approvals, prices, or business data changed. **W5-06 OPEN, formal WP05 6/13**; no automatic increase in closure count.
