# PEC migration reconciliation — read-only findings for independent review
Date: 2026-11-14 | Repo: Brahmadathanu/sasv-workspace-dev | Supabase project: qhmoqtxpeasamtlxaoak (sasv-workspace, Mumbai) | Master issue #388
**Status: ANALYSIS ONLY. No production DDL/DML, no migration-history change, no permission change was made. 20261112143000 remains ON HOLD.**

## 1. Access and method
- Supabase CLI 2.48.3 installed (v3.1.0 available; not upgraded). Already logged in; project `qhmoqtxpeasamtlxaoak` visible.
- `gh` is NOT logged in, so GitHub issues/PRs (#388, #383, #317, #323, #374) were not read directly; their content was taken from PEC docs committed in the repo.
- Method: `supabase migration list --linked` (read-only listing) run from an empty scratch folder linked to the project; remote history saved and diffed against migration files in git (`origin/main` and `origin/claude/pec-r10-safe-resync-concurrency-20261113` @ fb64b3fe).
- Side effect to disclose: `supabase link` makes the CLI create a temporary `cli_login_*` database login role (CLI-managed, expires). No repo file was modified.
- Live function/ACL/data checks were NOT possible from the CLI (no `psql`/Docker; CLI 2.48.3 has no read-SQL command). They were later run as SELECT-only queries in the Supabase dashboard SQL editor (signed in by the owner in the in-app browser); see sections 8-11. Sections 3-5 were written before that and are superseded where sections 8-11 say so.
- Repo context found later: staging branch `integration/pec-erp-staging-20261112` @ d5910402 (14 Nov) already records an owner-bounded decision to accept the five legacy PR-indent mapping exceptions as an unchanged historical baseline (forensic follow-up #393), with #383 open for a per-version history decision and 20261112143000 still held. This report does not contradict or alter that.

## 2. Remote history facts (verified by me)
- Remote `schema_migrations` has 683 versions; latest is 20261112042921.
- **None of the 11 historical PEC versions is registered** (20261112110000, 114000, 122500, 133000, 143000, 150000, 152000, 170000, 173000, 174500, 220000). Confirms 0/11.
- **None of the 3 R10 versions is registered** (20261113170715, 20261113172424, 20261114013211).
- Branch layout: the first ten historical files exist on the R10 branch; 20261112220000 (#374 Add Line) exists only on `claude/pec-r13-addline-374-integration-20261114`, not on the R10 branch or main.
- Wider drift, pre-existing and NOT PEC: 32 files on the R10 branch have no matching remote version (incl. ~17 eaushadhi_*, 20260501094500, 20260519120000, 20260716150000, 20260910143000, and lab files 20261111060000 / 20261112050000, whose remote counterparts probably carry different timestamps 20261111054841 / 20261112042921), and 91 remote versions have no file on that branch. Consequence: **`db push` / `migration up` must not be used on this project at all** until this is reconciled.

## 3. What the files do (static read)
| Version | Content | DML | Funcs | ACL stmts |
|---|---|---|---|---|
| 20261112110000 gram/BOM normalization | data fix | yes | 0 | 0 |
| 114000 uom + internal PR guard | funcs + data | yes | 6 | 0 |
| 122500 revision/manual indent guard | funcs | some | 2 | 0 |
| 133000 manual PR internal guards | funcs | some | 2 | 0 |
| **143000 SAFE resync preserve manual lines** | func (resync) | yes | 1 | 0 |
| 150000 MRP uom factor RBAC | ACL only | no | 0 | 2 |
| 152000 MRP rollup strict factor | func | some | 1 | 0 |
| 170000 / 173000 / 174500 paged read RPCs | funcs + ACL | no | 5/3/2 | 10/6/4 |
| 220000 Add Line status guard (#374) | func | — | — | — |
| R10a 20261113170715 | **redefines** `proc_indent_resync_from_pr_pec_internal` (143000's function), `proc_pr_add_line_pec_internal`, `proc_pr_set_manual_delta_pec_internal` (133000's functions); no GRANT/REVOKE | | 3 | 0 |
| R10b 20261113172424 | new read-only preview RPC; REVOKE PUBLIC/anon, GRANT authenticated+service_role | | 1 | yes |
| R10c 20261114013211 | `proc_indent_set_source_pr` lock prelude; keeps existing ACL | | 1 | 0 |

## 4. Key risks found
1. **R10a supersedes the bodies of the held 143000 and of 133000.** If R10a is ever applied, live bodies no longer equal those two source files; registering them "as applied" must be judged against the body live at that moment. Order matters: decide 143000/133000 BEFORE R10a is touched.
2. **History gap risk.** Registering 150000+ while 143000 stays unregistered leaves an older unregistered version below newer registered ones. With the CLI, a later `db push --include-all` would replay 143000 (older body) over live. Reinforces: never push; repair only, per version.
3. **R10 files are drafts, "not applied"** per their own headers; remote history agrees they are unregistered, but I could not confirm live bodies are still the pre-R10 ones.
4. Non-PEC drift (section 2) makes any bulk CLI operation unsafe.
5. Issue #383 (5 historical PR→indent mapping anomalies; SAFE resync overwrites an unmapped line sharing item identity with its source PR) is the stated reason for the 143000 hold; policy not approved.

## 5. Recommendation (history-only `migration repair --status applied`, per version, NEVER replay SQL)
**HOLD (must not be registered):** `20261112143000`.
**Strongest candidates, register-eligible once live parity is re-confirmed at execution time:**
- 20261112170000, 20261112173000, 20261112174500 — pure function+ACL, docs report 10/10 bodies and ACL matching; no data effects.
- 20261112110000 — docs report 4/4 masters and 13/13 BOM lines at target state.
**Eligible only after an additional check (docs call effects PARTIAL/pending):**
- 20261112150000 (full grant analysis pending), 20261112152000 (definition checked only), 20261112114000, 20261112122500 (wider data/guard effects PARTIAL).
- 20261112133000 — additionally superseded by R10a; prefer to decide with R10 plan.
- 20261112220000 — wrapper body MD5 and ACL match, but source lives on the r13 branch and negative-role tests are NOT TESTED; needs source freeze/merge first.
**R10 (three files): keep unregistered and unapplied.** Not live history; separate release decision.
Net: at most 4 now-ish, 6 conditional, 1 held, 3 R10 out of scope. Nothing should be repaired until the live check below is done.

## 6. What ChatGPT should challenge / what is still unverified
- Live parity (function MD5, ACLs, data invariants) was not re-run by me; run the repo's read-only checks (`scripts/pec-g0-postmigration-contract-verify.sql`, `pec-g1-*-verify.sql`) in the Supabase SQL editor or via a SQL-capable tool and attach output.
- Whether R10 bodies are live (they should not be).
- #388/#383 text not read directly (gh not authenticated).
- Genuine Editor/View/no-access role tests: NOT TESTED; G0–G5 0/6 closed per repo docs.

## 7. Proposed next step (needs explicit owner approval; none taken)
1. Read-only live verification run (above) at a frozen commit SHA, saved as evidence.
2. Owner approves an exact version list; one `repair` per version with `migration list` before/after and halt-on-drift. 143000 excluded.

---
## 8. ADDENDUM — live read-only check (2026-11-14, Supabase SQL editor, SELECT only on pg_proc / schema_migrations)
Nothing was written. Two SELECTs were run in the dashboard SQL editor of project qhmoqtxpeasamtlxaoak (production).
- **History:** versions >= 20261112 in `supabase_migrations.schema_migrations`: only `20261112042921`. Confirms 0/11 PEC and 0/3 R10 registered (second, independent confirmation of the CLI listing).
- **27 PEC-related functions present**, all SECURITY DEFINER except the two `*_pec_internal` PR writers; `anon` has EXECUTE on none; `authenticated` has EXECUTE on all except the three `*_pec_internal` functions (resync internal, pr_add_line internal, pr_set_manual_delta internal) — consistent with the intended ACL design. All ten #323 paged-read RPCs exist with authenticated=yes/anon=no. `mrp_uom_factor_strict` exists, anon=no.
- **#374 Add Line wrapper** `proc_indent_add_line` live MD5 = `a19fabfd29ffba4d937df1bbf09453c2`, matching the value recorded in the repo docs.
- **R10 is NOT live:** `proc_indent_resync_collision_preview` does not exist (R10b absent); the live resync internal, set_source_pr, pr_add_line internal and pr_set_manual_delta internal bodies contain none of the R10 markers (collision guard text, FOR SHARE, lock-order). So R10a/R10b/R10c are unapplied, as their headers state.
- Live MD5s recorded for later parity use: resync_internal b4ca2525ead97eba685ff30ab50d4959; set_source_pr 5aa37e3f9d61fd4d2ac4b186a6e5d85c; pr_add_line_internal fb162de2ce115b2cc574996747e27c91; pr_set_manual_delta_internal 531dfd22b18829715140ece25dff4252.
- (First-pass addendum. Body-vs-source equality and data invariants were completed afterwards: sections 9-11. Real-role tests remain NOT TESTED.)

---
## 9. Function-body vs source parity (live, read-only) — 2026-11-14
Method: for each function, the **final** source body was extracted from the migration files (last `CREATE OR REPLACE` by version order; hist set = the 11 historical files, 10 from the R10 branch + 20261112220000 from `claude/pec-r13-addline-374-integration-20261114`; R10 set = the 3 R10 files). The MD5 of the verbatim text between the `$function$` delimiters (CR removed) was compared in SQL with `md5(prosrc)` of the live function in schema `public` (`prosrc` is the stored body, not reformatted). A second comparison collapsed whitespace runs.

**Historical set: 20 of 21 byte-identical (exact=true); 21 of 21 equal ignoring whitespace.**
- Exact match: create_pr_from_mrp_plan_pec_internal, mrp_uom_factor_strict, proc_indent_create_from_pr_pec_internal, proc_pr_rebuild_from_mrp_pec_internal (114000); proc_indent_add_line_pec_internal, proc_pr_create_revision_from_active_pec_internal (122500); proc_pr_add_line_pec_internal, proc_pr_set_manual_delta_pec_internal (133000); **proc_indent_resync_from_pr_pec_internal (143000 — live body equals the held migration's body)**; mrp_rm_plan_rebuild_month_active (152000); proc_pec_pr_headers_paged, proc_pec_indent_headers_paged, proc_pec_purchase_excess_paged, proc_pec_excess_acceptance_audit_paged (170000); the 3 filtered pagers (173000); the 2 operational vendor RPCs (174500); proc_indent_add_line (220000).
- One exception: `proc_vendorwise_buylist_filtered_paged` (170000) is not byte-identical, but equals the source once **all** whitespace is removed (MD5 acdb366819ed1cdbf1c51b30f743308a on both sides). The only difference is line-break/space placement inside the call parentheses of `proc_vendorwise_buylist_filtered_pec_internal(...)`; no semantic difference. So strict byte-identity is 20/21; semantic 21/21 (agrees with the repo's earlier 21/21 normalized claim).
- Not covered by this comparison: 150000 (ACL-only, no function body — see ACLs in section 8) and 110000 (data — section 10). Function-body parity does not prove DDL/grant/data effects of 114000/122500/133000 beyond the function bodies.

**R10 set: 0 of 5 match the live database, as intended (not applied).** Live bodies of proc_indent_resync_from_pr_pec_internal, proc_pr_add_line_pec_internal, proc_pr_set_manual_delta_pec_internal and proc_indent_set_source_pr differ from the R10 sources (the first three equal the historical sources instead), and `proc_indent_resync_collision_preview` does not exist. R10a/b/c are confirmed **not installed**.

## 10. Four gram masters and 13 BOM corrections (live, read-only)
Expected state from 20261112110000: the four stock masters (ids 64, 291, 424, 517) default to UOM `g`; 13 BOM lines each equal the old Kg quantity x 1000 in `g`; governed Kg->g factor 1000.
- Masters: 64 = g, 291 = g, 424 = g, 517 = g (all dimension 1). **4/4 at target.**
- BOM lines (id: item, uom, qty): 3769: 517 g 50; 5394: 64 g 10; 5405: 517 g 25; 5714: 517 g 150; 6586: 517 g 50; 7048: 517 g 100; 7777: 517 g 240; 8104: 517 g 10; 9183: 517 g 1; 9717: 424 g 75; 9718: 517 g 75; 10000: 517 g 100; 10749: 517 g 5. Compared with the migration's expected table (old_qty x 1000): **13/13 equal, item ids match.**
- Non-g BOM lines for the four items: **0**. Total BOM lines for the four items: 21 (the other 8 were already g).
- Kg->g conversion (dimension 1): factor 1000 present.
- Conclusion: the end state targeted by 20261112110000 is present (data EFFECT VERIFIED). Caveat: this shows the state, not who or when changed it.

## 11. Five historical PR-to-indent mapping exceptions (live, read-only; IDs only)
Summary re-confirmed: 45 indent headers, all `approved`; 6 PR-linked (indents 6, 8, 9, 15, 16, 17), each with exactly one active header map; 1,023 line-map rows; no duplicate (indent line) or (indent, PR line) maps; no orphan references.

| Exception | Indent line | Indent / source PR (PR status) | Observation |
|---|---|---|---|
| Mapped, item mismatch | 1177 -> pr_line 246 | 6 / 1 (active) | indent item 2697 vs PR item 543; class/UOM equal; created 2026-06-12, updated 2026-11-11 |
| Mapped, item mismatch | 1622 -> pr_line 776 | 9 / 3 (active) | item 2702 vs 1369; created and updated 2026-06-17 |
| Mapped, item mismatch | 1927 -> pr_line 2674 | 15 / 8 (active) | item 2694 vs 1289; created 2026-09-17, updated 2026-11-11 |
| Unmapped | 1700 | 9 / 3 (active) | qty 500, manual reason non-empty; created/updated 2026-06-20; same class/item/UOM as PR line 752 whose final qty (requested + manual delta) = 0 |
| Unmapped | 1701 | 9 / 3 (active) | qty 500, manual reason non-empty; created/updated 2026-06-20; same identity as PR line 839, final qty = 0 |

Dates are as returned by the SQL editor (UTC session not independently verified). Two exception lines were last updated on **2026-11-11**, before 12 Nov but within a day of deployment; none after. The repo audit's "all predate 12 Nov, no update on/after" holds, but "no recent update" would be too strong.

**Analysis against the live 20261112143000 body (analysis only, nothing executed; SAFE cannot run on these because every header is approved):**
- For all five lines, the number of **positive** same-class/item/UOM lines in the source PR is **0**.
- Unmapped 1700/1701: the function only considers PR lines with final qty > 0, so SAFE would **not** treat them as PR-controlled and would **preserve** them. The "unmapped line sharing identity with an eligible PR line is overwritten" behaviour seen in the R7 fixture does not apply to them in the current PR state because their matching PR lines are zero. This narrows, but does not remove, the #383 concern: it would change if those PR lines became positive.
- Mapped 1177/1622/1927: they are mapped and have no positive identity in the source PR, so the function's delete-on-no-match rule **would delete them** if SAFE or RESET ever ran on a draft in this state. They are approved today, so the function rejects the call.
- This is data analysis, not a policy decision. The owner has already accepted the five exceptions as an unchanged historical baseline (#393 forensic follow-up).

## 12. Updated recommendation (supersedes section 5 where different)
- **20261112143000 — HOLD, unchanged.** Live body equals source (body parity verified), but the hold rests on #383 policy, the mapped-line deletion exposure above, and R10 superseding its function. Nothing here lifts it.
- **Verified live:** 170000 (4 of 5 byte-identical, 1 whitespace-only), 173000, 174500, 110000 (data 4/4 and 13/13), 152000 (body), 114000 / 122500 / 133000 (bodies only).
- 150000: ACL-only; live ACLs are consistent (anon none, authenticated yes on `mrp_uom_factor_strict`), but the repo docs' "full grant analysis pending" is not discharged by this report.
- 220000: live wrapper body byte-identical to the r13-branch source and MD5 a19fabfd29ffba4d937df1bbf09453c2 matches the docs; the source is still not on staging/main and negative real-role tests are NOT TESTED.
- R10 (3 files): not installed; keep out of any repair.
- Candidate set for a **separate owner authorization only**: from 110000, 114000, 122500, 150000, 152000, 170000, 173000, 174500 (and 133000 / 220000 with the caveats above). No history change has been made. No repair, replay, DML, DDL or grant change occurred during any check in this report.

## 13. Evidence and limits
- Read-only SQL run in the dashboard SQL editor (production project): SELECTs on `pg_proc`, `information_schema.columns`, `supabase_migrations.schema_migrations`, `inv_stock_item`, `inv_uom`, `inv_uom_conversion`, `rm_bom_line` and `proc_*` tables. No INSERT/UPDATE/DELETE/DDL/GRANT executed. (The editor keeps an unsaved "Untitled query" entry in the dashboard's private query list; not a database change.)
- Source hashes computed locally from git objects: `origin/claude/pec-r10-safe-resync-concurrency-20261113` @ fb64b3fe and `origin/claude/pec-r13-addline-374-integration-20261114` @ f4fcaa5c.
- Still NOT tested: real Editor / View-only / no-access sessions, concurrency, installed PWA/Electron, SAFE/RESET execution on live data (deliberately not run).
