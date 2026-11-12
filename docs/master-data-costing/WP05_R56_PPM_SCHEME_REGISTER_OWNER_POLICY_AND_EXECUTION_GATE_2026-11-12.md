# WP05 R56 — R55 owner-approved PPM reader policy: execution-approval gate (12 November 2026)

**BUSINESS READER POLICY APPROVED. PRODUCTION EXECUTION NOT AUTHORISED.** Owner explicitly approved the Scheme Master Register's ordinary reader access as **PPM View only**, not implicit CCC/CBM/CSR/MCM View, preserving `security_invoker=true`, all existing 34 columns, existing SQL grants and source RLS, and all shared functions. Owner instructed preparation of the final production-execution gate from tested PR #351, but explicitly required **separate approval before any live SQL**. This document records that distinction.

## Live independent catalogue preflight

Read-only metadata checked after owner policy approval:
- `public.v_costing_scheme_master_register`: exact original MD5 **`8fdc0306bd2f1efbe0638c7c13ba4dda`**, 34 output name/type pairs, owner `postgres`, reloptions `{security_invoker=true}`, relacl `{postgres=arwdDxtm/postgres,authenticated=r/postgres}`, authenticated SELECT granted, anon SELECT denied. **Unchanged live; no production application**.
- `public.v_costing_scheme_master_audit`: original/current MD5 **`e2b9eb3c1b86d073183cd376f704cf58`**, 20 fields, original owner and grants, audit view already PPM-only. **Do not modify audit**.
- Privileged read-only row counts: Register **7**, Audit **7**, not a test of actual signed-in permissions.
- The designated existing test identity's six effective Costing permission records remain **PPM View=true only**, other five View=false, **all Edit=false**. No role/account/metadata changes.
- Unchanged shared function `md5(prosrc)`: `app_has_permission` `12727b365c1728d3830eeab039b6e344`, `app_has_permission_core` `b75d5b4ee5cc6c464149c5743e165b95`, `fn_costing_view_allowed` `b7efb09b90fa3e9332915ba5d223568c`.

## Final exact-head candidate

Old draft [#351](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/351) was one documentation commit behind `main` after R55 investigation record merge. To ensure the review candidate matches `main`, the six **exact unchanged tested blob contents** were replayed on the owner-policy main head into clean current-main **draft [#353](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/353)**, 0 behind `main`, with the original SQL unchanged.

- Exact guarded apply SQL: `docs/master-data-costing/candidates/WP05_R55_SCHEME_REGISTER_PPM_APPLY_REVIEW_ONLY.sql`, Git blob **`8e86c50e680287e9c0cb140b7afd273dfac6a9d5`**.
- Guarded rollback: `docs/master-data-costing/candidates/WP05_R55_SCHEME_REGISTER_PPM_ROLLBACK_REVIEW_ONLY.sql`, Git blob **`48a60d885c83024789af8309f2907024a116f676`**, only valid when the target candidate exact MD5 is `903cb8eae3702bf72e41213ec2c89c6e`; verifies original `8fdc0306bd2f1efbe0638c7c13ba4dda` after rollback.
- Exact source view SQL `CREATE OR REPLACE VIEW … WITH (security_invoker=true)`, substitutes only the ordinary reader WHERE predicate with privileged technical service branch plus `app_has_permission('module:pricing-policy-manager','view')`. No global `fn_costing_view_allowed()` mutation, table/role/GRANT/RLS/user/client changes. The owner accepted excluding CCC/CBM/CSR/MCM-only readers.
- The apply guards original fingerprint, column count 34, postgres owner, exact authenticated grant, invoker=true and anon denial inside a single `BEGIN/COMMIT`; postchecks reader predicate, source relation, column count and ACL/invoker preservation.
- [Exact-head isolated PG17 run **43213642112**](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43213642112) **8/8 PASS**. Synthetic PPM-only reader sees a populated Scheme Master after applying the candidate, CCC/CBM/CSR/MCM-only and PPM Edit-only denied; retains original 34 fields, owner, grants, invoker=true; repeated apply and drifted rollback refuse execution, exact original definition restored by guarded rollback. Test is isolated, not a substitute for production PWA.

## Required explicit production owner decision

**Hold until owner separately says to execute the specific reviewed R55 SQL from draft #353 in the live SASV Supabase database**, under its exact guard, and to verify candidate MD5 `903cb8eae3702bf72e41213ec2c89c6e` plus 34-column/invoker/owner/grant contract. Such a statement is not contained in the current owner approval; **do not infer or self-approve production execution**.

At execution time, revalidate live exact original MD5, 34 name/types, owner, ACL, invoker, source grants and policies, no module-role drift, and unchanged shared helper hashes; STOP on drift. Run only the reviewed SQL once under its atomic guards; then independently check actual catalogue MD5, original source/ACL/owner/invoker, unchanged Audit and shared helpers, and effective PPM-only test-user state. The SQL is a direct applied view replacement, **not an automatically recorded migration**: do not leave an executable unmerged draft to be silently replayed after live use. Guarded rollback must remain unexecuted absent new owner/incident approval.

## Owner browser re-acceptance after any later authorised execution

With the already existing PPM-only test account, sign out/in and clear search and filters. In `Pricing Policy Manager → Scheme Master`, expect **a populated Register**; open a scheme known to have history, then its **History** tab to verify audit populated. Record only populated/empty/error, no scheme rates, personnel identifiers, pricing data, account tokens or raw JSON. A PPM-only positive result, a negative-role authenticated test and the broader WP05 closure gates remain separate.

**Stage 4 presently incomplete (Scheme Master EMPTY, History inconclusive). Stage 5 and original six-module View-only baseline restoration NOT STARTED. W5-06 OPEN; WP05 formal 6/13.** No production SQL, user permissions, business records or app source changed in R56.
