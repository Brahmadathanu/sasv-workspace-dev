# PEC #400 security correction — production deployment decision packet

Date: 14 November 2026 | Draft PR #419 | Head `642147a725e4677fe9b13f9224b39b0de8e827c6` | Branch `claude/pec-400-dml-hardening-20261114` | **PROPOSAL ONLY: the SQL below is not applied anywhere; separate owner approval of this exact file is required.** CI evidence: see section 5.

## 1. Recommendation
**Approve for a separate production step** (small, forward-only, reversible by a forward migration, no data change). It removes a demonstrated way for any signed-in account to rewrite procurement link and policy rows, without changing reads, views, SECURITY DEFINER workflows or `service_role`. Read exposure is deliberately **not** changed here (section 4) and is an owner decision.

## 2. What is wrong today (live catalog, read-only, 14 Nov 2026)
Four tables carry a `FOR ALL` RLS policy `auth.uid() IS NOT NULL` for the `authenticated` role together with INSERT/UPDATE/DELETE grants, so any signed-in user — including an account with **no PEC permission** — can insert, update and delete rows through the API:
| Table | Role in the system | Rows today |
|---|---|---|
| `proc_pr_to_indent_map` | PR → indent link history (`is_active`, `linked_at`, `note`); read by audit views, written by PEC SECURITY DEFINER internals | 7 |
| `proc_item_criticality_policy` | item priority policy | 0 |
| `proc_item_lead_time_policy` | item lead-time policy | 0 |
| `proc_item_production_urgency` | item production urgency | 0 |
Verified: no application code references these tables directly (only the generated types file); no function writes the three policy tables; the link table is written only by `proc_indent_create_from_pr_pec_internal`, `proc_indent_resync_from_pr_pec_internal`, `proc_indent_delete_draft_pec_internal` and `proc_indent_set_source_pr_pec_internal` — all SECURITY DEFINER, not executable by `authenticated`. `anon` has no effective access to any PEC table. Write access was shown on the disposable fixture with the live policies replicated (G7c, G9a); **no production write was attempted**. `proc_pr_indent_line_map` and `proc_pr_revision_map` are already denied to client roles by RLS with no policy, but still carry broad table privileges (including TRUNCATE, which ignores RLS).

## 3. The correction (exact file)
`supabase/migrations/20261114160000_pec_revoke_authenticated_dml_policy_link_tables.sql`, SHA-256 (LF) `068710bf9eafe6745bf214c95ed2e0315dc1819757d23bfb53a4392037080f20` (pinned in the protected-path guard to its own branch and the staging branch).
1. Drop the four `*_authenticated_crud` policies; create one `FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL)` policy per table (same predicate, so reads and security-invoker views are unchanged).
2. `REVOKE INSERT, UPDATE, DELETE` on the four tables from `authenticated` and `anon`.
3. Hygiene with zero effective change: `REVOKE ALL` from `anon`, and `REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER` from `authenticated`, on `proc_pr_indent_line_map` and `proc_pr_revision_map` (SELECT kept: security-invoker views read them and currently return 0 rows under RLS; revoking SELECT would make them error).
Unchanged by design: `service_role` and `postgres`, every function and its ACL, all other tables, and the read policies on indent/PR tables.

## 4. Read exposure — not changed (owner decision)
Any signed-in user can read all indent/PR rows (confirmed with a genuine no-access session: counts only, 48 / 1,598 / 7 / 3,272). The `SELECT` policies are load-bearing: many security-invoker views read these tables as the caller (for example `v_proc_indent_line_balance`, `v_proc_indent_header_balance`, `v_proc_pr_lines`, `v_proc_indent_open_lines`, the three `v_proc_item_*_effective` views). Restricting reads by PEC permission would break other modules' screens for users without PEC access, so it needs a deliberate permission design, not a patch. **Decision:** accept the internal read exposure for this release and schedule a designed fix, or commission that design now.

## 5. Evidence on the disposable PG17 fixture (negative roles; synthetic data; live policies replicated)
CI on head `642147a725e4677fe9b13f9224b39b0de8e827c6`: [PG17 suite 43604051507](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43604051507) **success**; [Integrated Browser Acceptance 43604051374](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43604051374) **success**. Whole suite green: guarded sources FAILS=0 (existing regression, matrix, roles, risk), negative controls fail where required, repeat run identical, 0 leftover databases, guard mutation test 13/13, protected-path guard 46/46. Tests (all in `scripts/pec-r10/roles-acl.sh`, guarded mode):
| Test | Proves |
|---|---|
| G9a (CONFIRMED, before) | a signed-in user with no PEC grant updates, deletes and inserts rows in the three policy tables |
| G7c (CONFIRMED, before) | the same user rewrites the link table |
| G9 | after the real migration file: no-access, View-only, Editor and anon cannot insert/update/delete on any of the four tables (48 attempts, all `42501`); rows unchanged |
| G10 | reads unchanged: policy and link tables readable; security-invoker views still return rows; line-map view still returns 0 rows and does not error |
| G11 | required workflows preserved: the SECURITY DEFINER set-source wrapper still writes the link table for an Editor; `service_role` still writes policy and link tables |
| G12 | `anon` holds no privilege on the six tables; `authenticated` keeps SELECT only |
| G13 | ACLs of every other function, table and view unchanged; policy count unchanged; each table has exactly one `FOR SELECT` policy |
Limits: the fixture models the live policies, grants and invoker views but not the live balance views' internals; the three policy tables are empty in production, so their behaviour is shown on synthetic rows.

## 6. Production gate (only after separate owner approval of this exact file)
Pre-checks, all or STOP: blob/SHA-256 equal section 3; project `qhmoqtxpeasamtlxaoak`; history 698 rows, version `20261114160000` absent; the four `*_authenticated_crud` policies present with the recorded predicate and no other policy on the four tables; table ACLs as recorded; baseline counts (48 headers, 1,598 lines, 1,023 line maps, 7 PR-indent links, 3,272 PR lines) and data fingerprint; all functions' combined definition md5 and ACL fingerprint recorded (the migration touches no function).
Apply: the exact file text in its own transaction through the hash-verified SQL editor method (editor SHA-256 equal to section 3 before running), then `supabase migration repair 20261114160000 --status applied --linked` for that single version. No `db push`, `migration up`, `--include-all`.
Post-checks: four tables each have exactly one `FOR SELECT` policy; `has_table_privilege` for `authenticated` = SELECT only (no INSERT/UPDATE/DELETE/TRUNCATE) and `anon` = none on the six tables; all functions' md5 and ACL fingerprint unchanged; counts and data fingerprint unchanged; history 699. Smoke (read-only, existing sessions): the PEC console loads for Editor and View-only; no write probe against production.
Rollback: a separately approved forward migration re-creating the `FOR ALL` policies and re-granting INSERT, UPDATE, DELETE (this restores the exposure).
Expected behaviour change: none for the application; direct API writes to the four tables by signed-in users start failing with `42501`.

## 7. Owner decisions
1. Approve or decline the exact migration in section 3 for production (or record an explicit risk acceptance for the write exposure).
2. Read exposure (section 4): accept for this release, or commission a designed permission model.
3. Keep `service_role` / definer-only writes as the only write path for these tables (assumed; say if another module legitimately writes the policy tables as a signed-in user).
