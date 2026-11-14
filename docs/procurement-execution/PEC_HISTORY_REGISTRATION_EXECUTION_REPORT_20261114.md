# PEC history-only registration — execution report

Date: 14 November 2026 | Project: `qhmoqtxpeasamtlxaoak` (sasv-workspace) | Governance issue #388 | Frozen source: staging head `397dbef4b2a49b9580d912c7819873d7b3607437`
Authority: owner decision recorded in `PEC_HISTORY_REGISTRATION_OWNER_DECISION_PACKET_20261114.md` (ten named versions, `20261112143000` excluded, conditional on execution-time verification). The GitHub #388 comment `6873762955` could not be read directly (`gh` not authenticated on the execution machine); the in-repo packet was used as the authority record.

**RESULT: 10 of 10 approved versions registered as applied in `supabase_migrations.schema_migrations` (history only, no SQL replayed). `20261112143000` and the three R10 versions remain absent. No business data, ACL or function change observed.**

## Method and safety controls
- Supabase CLI 2.48.3 (v3.1.0 available; not upgraded). Target proven as `qhmoqtxpeasamtlxaoak` by `supabase projects list` (linked marker), the linked project-ref file, and `current_database()` queried in the same project's SQL editor.
- `supabase migration repair --help` verified: `migration repair [version] --status applied --linked` (updates the history table only).
- Repair was run from a dedicated scratch working directory containing exactly the ten approved source files copied from the frozen SHA, so history rows carry the original version, file-derived name and statements. The scratch directory contained no other migration files (not 143000, not R10).
- One `repair <version> --status applied --linked` per version, ascending order, with a `migration list --linked` check after each; the loop was set to stop on any non-zero exit, missing "Repaired migration history" message or missing remote row. It did not stop.
- NOT used: `db push`, `migration up`, `db reset`, `--include-all`, direct INSERT into `schema_migrations`, any DDL/DML/GRANT, MCP migration tools. No credentials or tokens were handled or logged; the CLI uses its own session login (it creates a temporary `cli_login_*` role while connecting).

## Source files (frozen at 397dbef4; git blob SHA-1)
| Version | File | Blob |
|---|---|---|
| 20261112110000 | pec_four_gram_material_bom_normalization | 0c2e5f3e30c038639cc0dde4e303d9227d32a000 |
| 20261112114000 | pec_uom_and_internal_pr_guard | 36ef98249953479423cb40520b54252654b8571e |
| 20261112122500 | pec_revision_and_manual_indent_internal_guard | dfafbac830c4ae1b2db26dbc3086b1b48211c783 |
| 20261112133000 | pec_manual_pr_internal_item_guards | 928910a75384c7b14242bd8611e0faebabe95fb9 |
| 20261112150000 | pec_mrp_uom_factor_auth_rbac | b3bd8ae986e20be4d13d0829ecd0c328789a8684 |
| 20261112152000 | pec_mrp_rollup_use_strict_factor | 9fbec18768b2da3d52e7dab1b8bd949f79a29738 |
| 20261112170000 | pec_g1_five_paged_read_contracts | 2555bf1850722fc81ad254e510211243f78063d2 |
| 20261112173000 | pec_g1_filtered_paged_read_contracts | e310f8cdfccf8bf3eb419fd56930038912e6ce6b |
| 20261112174500 | pec_g1_vendor_operational_paging | 218424161e739236479ab658d7513823c5f2a566 |
| 20261112220000 | pec_r2_add_line_new_row_status_guard | 319e517092e5fb115616eb79366c971f06864d75 |

## Execution-time validation (before any repair)
- Remote history: 683 versions, latest `20261112042921`; none of the ten, nor 143000 or R10, present. Unrelated drift present as in the earlier report (local-file/remote mismatches outside PEC); untouched.
- Function bodies (`md5(prosrc)` live vs. final source body from the frozen files): 19 of 21 byte-identical. Two differ and were assessed rather than waved through:
  - `proc_vendorwise_buylist_filtered_paged` (170000): equal to source when all whitespace is removed (MD5 acdb366819ed1cdbf1c51b30f743308a both sides); whitespace-only difference.
  - `proc_indent_resync_from_pr_pec_internal` (defined in 114000): live body is the later body from the **held** 143000 (live md5 of its definition b4ca2525ead97eba685ff30ab50d4959, equal to the held file's body per the earlier parity check). So 114000's version of that one function is superseded, not missing. This is a known consequence of the 143000 hold, recorded here rather than treated as drift.
- Data: four gram masters 4/4 `g`; 13/13 BOM lines equal expected (item, `g`, old qty x 1000); 0 non-`g` BOM lines for the four items.
- ACL: `mrp_uom_factor_strict` ACL exactly `postgres`, `authenticated`, `service_role` (no anon); 0 anon EXECUTE across the PEC/vendorwise/add-line functions checked.
- 45 indent headers, all approved (0 drafts); R10 collision-preview function absent.

## Per-version outcome
| Version | Command | Result | Remote row verified after |
|---|---|---|---|
| 20261112110000 | `migration repair 20261112110000 --status applied --linked` | Repaired => applied | yes |
| 20261112114000 | same pattern | Repaired => applied | yes |
| 20261112122500 | same pattern | Repaired => applied | yes |
| 20261112133000 | same pattern | Repaired => applied | yes |
| 20261112150000 | same pattern | Repaired => applied | yes |
| 20261112152000 | same pattern | Repaired => applied | yes |
| 20261112170000 | same pattern | Repaired => applied | yes |
| 20261112173000 | same pattern | Repaired => applied | yes |
| 20261112174500 | same pattern | Repaired => applied | yes |
| 20261112220000 | same pattern | Repaired => applied | yes |
Statement counts stored per row (informational, from the file text; not executed): 1, 9, 4, 4, 6, 3, 17, 11, 8, 2.

## Before / after
- Before: 683 versions; latest `20261112042921`.
- After: **693 versions** (+10 exactly); versions greater than `20261112042921` are exactly the ten approved ones; `20261112143000` present = 0; R10 versions present = 0.

## Post-execution invariants (independent SQL read)
- Function definition MD5s unchanged from pre-state: `proc_indent_resync_from_pr_pec_internal` b4ca2525ead97eba685ff30ab50d4959, `proc_indent_add_line` a19fabfd29ffba4d937df1bbf09453c2, `proc_indent_set_source_pr` 5aa37e3f9d61fd4d2ac4b186a6e5d85c.
- 45 headers (45 approved), 1,593 indent lines, 1,023 line-map rows (unchanged from earlier snapshots).
- Gram masters 4/4, non-g BOM lines 0, `mrp_uom_factor_strict` ACL unchanged, anon EXECUTE count 0, collision-preview function absent.

## Unresolved blockers and cautions
1. `20261112143000` stays HOLD / NOT APPROVED (#383). Its registration gap now sits below newer registered PEC versions; the CLI could treat it as a pending older migration. **Do not run `db push`, `migration up` or `--include-all`** on this project.
2. Non-PEC history drift (local files without remote rows and remote rows without files) is unchanged and still blocks any bulk migration command.
3. R10 (`20261113170715`, `20261113172424`, `20261114013211`) not deployed, not approved here; they are present in the repo and supersede the 133000/143000 function bodies, so any R10 deployment needs its own approval and a decision on the 143000 gap first.
4. Registration records that these effects exist; it is not evidence of original chronological execution and does not close release gates. Genuine Editor / View-only / no-access JWT tests, concurrency tests, installed PWA and packaged Electron acceptance are NOT TESTED. G0-G5 remain 0/6 formally closed.
5. #388 comment: `gh` is not logged in on this machine, so the GitHub issue was **not** updated by this run. This report is the update; it can be posted to #388 or the machine can be logged in to `gh`.

## Next safe PEC release step
Owner decision on `20261112143000` (#383): either a separate, explicit history-only registration with its own evidence, or a documented decision to leave the gap and avoid CLI bulk commands. After that: genuine-role acceptance (Editor / View-only / no-access) on the staging build, then the formal G0-G5 closure review. No merge to `main`, frontend release or Electron deployment is part of this package.
