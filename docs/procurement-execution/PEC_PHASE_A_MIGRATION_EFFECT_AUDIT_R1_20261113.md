# PEC Phase A — migration-effect audit R1 (read-only)

**13 November 2026 | GitHub source #317/#323/#374 against SASV live PostgreSQL**  
**Authority:** evidence collection only, not approval to register, rerun or reconcile SQL. No production writes.

## Scope / method

Fetched the exact 7 files of PR #317 at `ca1d9a01f891ee480068f7964c56d4863a457c39`, 3 files of PR #323 at `359de7a287ca345fc2f27391f2e557911aadd2de`, and the existing #374 wrapper at the reviewed head. Used independent read-only `pg_proc`, `pg_get_functiondef`, `has_function_privilege`, and exact nonmutating `inv_uom`/`rm_bom_line` selects against live Supabase. **Function existence and superficial guard presence are not source-body equivalence.** Full hash, object/owner/grant, transactional regression, and role-token testing are separate work.

## Evidence ledger

| Migration | Independently verified effect | R1 disposition |
|---|---|---|
| 20261112110000 four-material g correction | Governed Kg→g factor=1000: 1; stock masters 64,291,424,517 in g: **4/4**; thirteen exact BOM id/item/quantity/uom targets in g: **13/13**; other BOM UOMs among those stock items: **0** | **Targeted live data parity PASS**, historical migration unregistered |
| 20261112114000 UOM/internal PR guard | Six named server functions present, unique signatures | **Function presence only**; body/parity not established |
| 20261112122500 revision/manual indent guard | Two expected internal writer functions present, unique signatures | **Function presence only** |
| 20261112133000 manual PR guards | Two expected internal writer functions present, unique signatures | **Function presence only** |
| 20261112143000 SAFE resync | Target function present | **Function presence only**; SAFE/RESET functional invariants NOT TESTED in this pass |
| 20261112150000 strict factor RBAC | `mrp_uom_factor_strict(bigint,bigint)` is SECURITY DEFINER | **Selected metadata observed**; full grants and definition parity NOT TESTED |
| 20261112152000 strict-factor rollup | `mrp_rm_plan_rebuild_month_active(date,text,text)` present | **Function presence only**; no MRP rebuild executed |
| 20261112170000 five paged reads | Five functions present; each unique signature, SECURITY DEFINER, authenticated EXECUTE yes, anon/PUBLIC EXECUTE no, visible PEC permission check in definition | **Selected signature/ACL/guard parity PASS**; body/result equivalence and genuine JWT call NOT TESTED |
| 20261112173000 three filtered paged reads | Three functions with same read-side ACL/permission conditions | **Selected signature/ACL/guard parity PASS**; filtered result equivalence NOT TESTED |
| 20261112174500 two operational vendor reads | Two functions with same read-side ACL/permission conditions | **Selected signature/ACL/guard parity PASS**; live full-export concurrency and paged equivalence NOT TESTED |
| 20261112220000 Add Line writer | Production wrapper MD5 `a19fabfd29ffba4d937df1bbf09453c2`, expected draft-manual/non-PR guard present; authenticated wrapper EXECUTE yes, anon wrapper EXECUTE no, authenticated internal EXECUTE no; PG17 isolated fixture PASS | **Deployed function/ACL check PASS**; authentic role & concurrency negative tests NOT TESTED |

**Version tracking:** all eleven PEC versions above have zero entries in `supabase_migrations.schema_migrations`. This is a distinct governance gap, not evidence that every effect is absent. The unrelated 20261112 lab migration is not part of PEC.

**Function inventory:** the twenty expected legacy/paged function names plus the Add Line wrapper all exist in `public` with **one overload each**. This is necessary but insufficient for full migration parity.

## Release implications and negative tests

1. Keep formal **G0–G5 = 0/6 closed**; no certification of complete PR #317/#323 effects.
2. The genuine-session non-mutating operator harness already exists at `scripts/pec-phase-a-operator-browser-check.mjs`, supports `--role=editor|view-only|no-access` with an interactive self-sign-in and no credential capture. This runbook does not claim to have executed it. Use only the known trusted staging host and capture sanitized observations.
3. A live approved/nonexistent-line call made with a genuine Edit-role JWT should fail `23514`; View-only should fail permission check; no-access reads must be denied. **Do not use an approved record with a real line identity or mutate quantity as a test.** One needs an authorized operator and non-mutating, uniquely nonexistent line identity. No live draft manual header exists in the observed inventory (45/45 approved); positive new-line testing needs a separately approved disposable fixture or actual draft business transaction.
4. For full #317/#323 migration equivalence, next compare normalized live function definitions against exact source plus source grants, verify internal RM exclusion and SAFE resync invariants, and conduct bounded real-role paged/filtered API reads. Differences or unavailable proof remain **UNVERIFIED**, not PASS.
5. Official migration repair, whether CLI repair marking already-applied versions or any alternate supported mechanism, requires a reviewed **per-version** effect ledger, clear owner signoff, and backup/recovery plan. **No direct history DML, blind SQL replay or silent migration-claim changes.**
6. Installed-PWA and packaged Windows Electron remain outside this database-only audit. Preserve evidence, old test snapshots and migration artifacts. No cleanup of historical rows or snapshots.

## Progress and decision register

- **Client UI:** R1–R2c owner visual PASS.
- **Live Add Line security:** deployed and independently read back PASS.
- **Migration source registration:** 0/11 registered; **remediation NOT AUTHORIZED**.
- **Selected migration effects:** #317 gram data target PASS, #323 selected read RPC ACL/guard checks PASS, remaining bodies NOT VERIFIED.
- **Real authenticated-role negative matrix:** NOT TESTED.
- **Formal release:** 0/6 signed closed, no merge to `main`.

This document deliberately maintains source/provenance and test distinctions. Future work should amend it with exact SHA and evidence for each remaining check instead of erasing the historical gaps.

## R2 addendum — independent function-body parity (13 November 2026)

**Method:** fetched source definitions verbatim from immutable GitHub PR heads #317 `ca1d9a01f891ee480068f7964c56d4863a457c39`, #323 `359de7a287ca345fc2f27391f2e557911aadd2de`, #374 `e2522775bb4cd328c8cdce25238c89ff7d45759d`; fetched live `pg_get_functiondef` via read-only SQL, extracted dollar-quoted `AS` bodies, normalized CRLF, SQL line comments, whitespace and casing, and compared body text. For functions defined twice in the #317 sequence, used the **last effective definition**. No `EXECUTE` of business functions, DML or history mutation.

| Source group | Body comparisons | Result |
|---|---:|---|
| #323 five baseline paged read functions | 5 | **5/5 MATCH** |
| #323 three filtered paged read functions | 3 | **3/3 MATCH** |
| #323 two vendor operational read functions | 2 | **2/2 MATCH** |
| #317 eight procurement internal writer/creation/revision/resync functions | 8 | **8/8 MATCH** |
| #317 strict factor helper and active month rebuild | 2 | **2/2 MATCH** |
| #374 Add Line public wrapper | 1 | **1/1 MATCH** |
| **Total** | **21** | **21/21 body-normalized MATCH** |

**Security metadata check:** the ten #323 paged read functions each have one live overload, SECURITY DEFINER, authenticated EXECUTE granted, anon/PUBLIC EXECUTE denied and `require_permission` visible. The eight #317 procurement internal writer/creation/resync functions all deny direct `authenticated`, `anon` and `PUBLIC` EXECUTE. The #374 Add Line wrapper retains authenticated EXECUTE, anonymous/PUBLIC denied and the explicit PEC Edit gate. The MRP strict-factor helper is SECURITY DEFINER with authenticated EXECUTE and anonymous/PUBLIC denied; `mrp_rm_plan_rebuild_month_active` has authenticated EXECUTE, anonymous/PUBLIC denied; its writer controls beyond function-body parity require their own governed review, **not a change authorized by this audit**.

**Interpretation:** source/body parity is a strong confirmation that reviewed function implementations are installed, **not** a statement that exact header metadata/defaults or all permission clauses of all migrations were compared byte-for-byte. A whitespace/comment/case normalization could hide differences in string literals in principle, so the normalized equality should not be promoted to an unqualified byte-identity claim. Non-function schema/data changes, four-item BOM data (previously targeted PASS), role-specific live JWT behavior, and migration registration still require separate evidence. All eleven PEC history versions remain NOT REGISTERED. The earlier R1 “function presence only” statuses above are superseded **for function bodies** by this R2 addendum; other R1 limitations remain.

**Scope conclusion:** no body divergence observed in 21 compared definitions. Genuine account Editor/View-only/denied-role execution, concurrent lifecycle tests, per-version header/DDL/data-effect parity, and official reconciliation are still OPEN; formal G0–G5 0/6 signed closed.

## R3 addendum — live read RPC header metadata (13 November 2026)

Independent read-only check of the ten #323 paged/filtered/vendor functions confirms **10/10** are owned by `postgres`, implemented in `plpgsql`, `STABLE` (`provolatile='s'`), `SECURITY DEFINER` and configured with `search_path=pg_catalog, public, pg_temp`. This corroborates the reviewed migration headers and previously recorded authenticated-only EXECUTE/PEC View gate evidence. It is read-only catalog verification, **not** authenticated-session execution or registered-migration verification. The genuine-session operator packet is `PEC_PHASE_A_AUTHENTICATED_ACCEPTANCE_OPERATOR_PACKET_20261113.md`; current harness does not directly challenge denied-role RPCs.

## R4 addendum — strict MRP conversion helper grant and table access audit (13 November 2026)

**Read-only verification of migration `20261112150000`:** independently queried live PostgreSQL catalog `pg_proc`, `has_function_privilege`, and `has_table_privilege`, then compared with the exact PR #317 file `supabase/migrations/20261112150000_pec_mrp_uom_factor_auth_rbac.sql` (source head `ca1d9a01f891ee480068f7964c56d4863a457c39`).

- `public.mrp_uom_factor_strict(bigint,bigint)` is `SECURITY DEFINER`; `search_path=pg_catalog, public`. **MATCH**.
- Function EXECUTE: `authenticated=true`, `service_role=true`, `anon=false`, `PUBLIC=false`. **MATCH**.
- Underlying `public.inv_uom_conversion` table SELECT: `authenticated=false`, `anon=false`, `PUBLIC=false`. **MATCH** the intended non-broadening.
- `public.inv_uom` SELECT: `authenticated=true`, `anon=false`. The migration does **not** instruct revoking the existing authenticated grant; do not characterize it as newly introduced by this migration.
- Supabase history `20261112150000` is **NOT REGISTERED**; across the eleven named PEC migration versions still **0/11 registered**.
- **Disposition:** `20261112150000` helper's **selected security metadata and grants VERIFIED**, but no true-JWT invocation, full dataset behavior or official history reconciliation was conducted. This result does not authorize history repair or a broad function grant.

The authenticated-role acceptance harness and operator packet are separately governed; running CI does not replace real account evidence.

## R5 addendum — historical internal-material procurement preservation (13 November 2026)

**Target migration group:** #317 `20261112122500` (revision and indent guard), `20261112133000` (manual PR guards), and associated UOM/internal PR guards. A read-only aggregate query linked current classified items in `public.v_inv_stock_item_with_class` to `proc_pr_line`/`proc_pr_header` and `proc_indent_line`/`proc_indent_header`, restricted to material class 1 and positive requested quantity. The classifications presently contain **186** `semifinished_goods` and **86** `finished_bulk_material` stock items.

| Observation | Active PR | Approved indent |
|---|---:|---:|
| Positive internal-material lines | 35 | 11 |
| Created before 2026-11-12 | 35 | 11 |
| Created on/after 2026-11-12 | 0 | 0 |
| Updated on/after 2026-11-12 | 0 | 0 |

There are additionally **63 nonpositive** internal-material PR lines, which are not categorized as positive external procurement commitments. Totals represent current-state records, not a transactional reconstruction of events. The creation/update cutoff is calendar 12 November, not the precise deployment timestamp; classify this as **bounded historical preservation evidence**, not proof that every new/increased writer route is secure. Date comparisons use the database timestamp interpretation as queried. The positive PR lines were all `active`, and positive indent lines all `approved`. Do **not** delete or rewrite these legacy business records or mislabel them as newly created violations.

**Disposition:** The observed legacy-positive records appear to predate the server guard corrections and have no updates on/after 12 Nov. This improves preservation evidence for #317 while **genuine JWT writer negative tests and concurrent lifecycle checks remain NOT TESTED**. The eleven PEC migration history registrations remain absent. No production DML, schema or grants were changed.

## R6 addendum — SAFE PR→Indent mapping integrity and historical exceptions (13 November 2026)

**Source under review:** PR #317 migration `20261112143000_pec_safe_resync_preserve_manual_lines.sql`. Source/body parity was previously established; this is an independent **read-only data-integrity audit**, not a SAFE/RESET execution or data fix.

- Production inventory: **45 approved indent headers**, 39 manual (no source PR) and 6 PR-linked.
- All six PR-linked headers have **exactly one active header-level PR mapping**; no PR-linked header has zero or multiple active mappings.
- There are **1,023 PR→indent line mapping rows**. All references point to present header, indent-line, and PR-line records; no wrong linked PR source or indent ID; no duplicated (indent,indent-line) or (indent,PR-line) mapping.
- **Three mappings show a stock-item-identity mismatch** between the mapped indent line and its PR line, affecting three approved indents attached to active PRs. Material-class and UOM IDs match. All three predate 12 Nov 2026, with no indent or PR line update on/after that date. None matches an alternative current source-PR line identity, nor has another correctly mapped line.
- **Two PR-linked indent lines are unmapped**, both predating 12 Nov with nonempty manual reasons and no subsequent updates. Both *do* have the same class/stock-item/UOM identity in a current source-PR line. This means “unmapped” is an observed relationship; **manual intent is not conclusively proved** by a nonempty reason alone.
- All 45 headers are approved; no draft indent exists to safely exercise SAFE or RESET in live production. **Do not call the resync function or alter legacy approved records just to test it.**

**Disposition:** SAFE-resync function-body parity remains PASS (21/21 overall), but `20261112143000` functional/data integrity becomes **PARTIAL — REVIEW REQUIRED** for the five historical anomalies; opening [issue #383](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/383) for provenance and isolated fixture coverage. The anomalies are not proven to result from the 12 Nov function deployment and are not evidence of post-deployment new changes. No migration-history reconciliation for this version until case evidence is reviewed. No production DML, DDL, permission, or history changes performed.

**Formal effect-gate rule:** classify object presence/function source parity separately from historical mapping invariants and real signed-in operations. Genuine-role acceptance remains NOT TESTED; G0–G5 remain 0/6 closed.

## R7 addendum — exact SAFE/RESET function isolated PostgreSQL 17 acceptance (13 November 2026)

**Source gate:** [PR #384](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/384), branched from #317's immutable tested function source `ca1d9a01f891ee480068f7964c56d4863a457c39`. The CI fixture sources the actual `supabase/migrations/20261112143000_pec_safe_resync_preserve_manual_lines.sql` from that branch with `psql -f scripts/pec-g0-safe-resync-pg17-fixture.sql` in an isolated disposable **PostgreSQL 17** GitHub Actions service. No production connection or real user records. Exact-head CI on `a7433188af8957cbde00e9a82988fa1e659ce65e` **SUCCESS**, with explicit `PEC_G0_SAFE_RESYNC_PG17_FIXTURE_PASS` and zero failed assertions. Test-only PR #384 merged to **the unmerged #317 feature branch** at `eb39167151b02b80250d855b094db53ccf88a817`, not PEC staging or `main`.

**Fixture-proved behavior:**
- Draft linked to active PR permits SAFE/RESET; approved indent, missing source PR, inactive source PR and invalid mode reject with expected `P0001`.
- **SAFE:** source quantities update mapped matching lines; source-zero obsolete mapped lines delete; unrelated unmapped manual item is preserved; missing PR item inserts; mismatched mapped stock item without current PR identity is deleted. Finished-bulk material is excluded from generated external indent lines.
- **Important boundary:** when a formerly unmapped indent line has the same class/item/UOM as an eligible PR line, SAFE **overwrites its quantity/reason with the PR value and creates the PR mapping**, rather than preserving its manual state. This was observed in the fixture and may affect the two historical unmapped-but-matching records in issue #383. A documented policy decision is required; do not silently assume such lines are independent manual additions.
- Repeated SAFE preserves line-count/mapping invariants; RESET discards all existing manual lines, recreates only eligible PR positives, and retains one active header map. Mapping identities correct after both fixture operations.

**R7 disposition:** `20261112143000` *isolated SAFE/RESET function behaviour* = **PASS (disposable PG17)**, while historical live data/mapping provenance = **REVIEW REQUIRED**. Original issue #383 (three historical wrong-item maps plus two unmapped-but-matching lines) remains OPEN; do not run resync against any approved live indent, rewrite their mappings, or mark the migration version applied. Genuine account JWT acceptance remains NOT TESTED, formal G0–G5 0/6 closed, migration history 0/11 registered. Test fixture outcome is not permission to invoke an unsafe writer in production.
