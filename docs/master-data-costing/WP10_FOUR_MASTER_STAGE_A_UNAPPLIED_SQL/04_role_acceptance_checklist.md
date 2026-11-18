# Stage A real-session acceptance checklist (PROCEDURE ONLY — NOT EXECUTED; no results are claimed here)

Run after `02_stage_a_apply.sql` + `03_postflight_readonly.sql PASS`, using genuine signed-in sessions (real JWT through PostgREST/the app), never `SET ROLE` as a substitute and never against live master rows
(use a disposable/non-production project, or exactly one pre-agreed, reversible, owner-approved test row if the owner explicitly authorises a production check). Record outcomes privately; GitHub receives PASS/FAIL only, no identities.

For each module M in {categories, sub_categories, product_groups, sub_groups} and actor A in {Editor(M), View-only(M), No-access, Editor of a different module}:

| # | Check | Editor(M) | View-only | No-access | Other-module Editor |
|---|---|---|---|---|---|
| 1 | Page loads, hierarchy list populated (SELECT) | PASS expected | PASS | PASS (read) / page gated by client | PASS |
| 2 | Client edit controls | visible | hidden | hidden | hidden |
| 3 | Governed `rpc_wp10_create_*` | succeeds | denied | denied | denied |
| 4 | Governed `rename` / `delete` | succeeds | denied | denied | denied |
| 5 | Direct REST `POST/PATCH/DELETE /rest/v1/M` (legacy-binary equivalent) | succeeds (compat only) | 42501 / 0 rows | 42501 / 0 rows | 42501 / 0 rows |
| 6 | Dependent reads (products, BMR, lab, stock screens) | unchanged | unchanged | unchanged | unchanged |

Rev 2 note: Editor(M) means canonical can_view = true AND can_edit = true. If the owner can provision a disposable identity with can_edit = true and can_view = false (anomalous), it must be denied rows 3-5 like View-only; no such identity is assumed to exist and none was created.

Stop and consider rollback only if an authorised Editor is wrongly denied (1–4) or any RPC fails.
