# WP04-G4 — C correctness correction V2 exact review

2026-10-05. Review target: `c-correctness-proposal-v2.sql` SHA-256 `3ed866cbfff9be29b251c17ddf163b12f159ee96cb70738b6e58d2919e15a69f`.

## Disposition

**SOURCE REVIEW PASS — C-R01/C-R02 PROPOSAL IS BOUNDED AND READY FOR A SEPARATE EXPLICIT OPERATION AUTHORIZATION. NOT AUTHORIZED / NOT RUN.**

This review does not claim SQL parser/runtime compilation, live correctness, performance, or G4 completion. Application remains HOLD and G5 remains blocked.

## Review findings

| Area | Review |
| --- | --- |
| Scope | PASS. Only C-R01/C-R02 are addressed. Frozen C SQL/source/manifests and historical results are not overwritten or rerun. |
| C-R01 provenance | PASS at source-review level. Original point predicates match the six CTE selection predicates in the captured original run-evidence helper; candidate predicates match the six LEFT JOIN predicates in the frozen C cohort design. |
| C-R01 population/context | PASS. Exact operational membership count/fingerprint and governed period/valuation/latest-success-run are guarded before comparison. |
| C-R01 completeness | PASS for the requested extracted-input proof. Complete selected composites are compared for all 611 x six source observations; row presence/null fields are included; table types are OID-bound; exact unique-index definitions bind multiplicity. |
| C-R01 evaluator load | PASS. No run-evidence, canonical, core, route/shared or portfolio evaluator is invoked. The proposal therefore does not conceal a 611-evaluator replay. |
| C-R02 boundary | PASS at source-review level. Eight pure-literal typed-record cases cover absence, each of six source-presence/null-status boundaries and all-six presence, with seven ordered drivers and complete JSON comparison. It is correctly labelled literal projection proof, not live-row proof. |
| Candidate scope | PASS. Only the frozen assembler is temporarily defined; no canonical/enrich/run-evidence replacement and no portfolio reader is installed. |
| Security | PASS at source-review level. Temporary assembler is owner-only with explicit revocation; no public/API permission expansion. |
| Restore | PASS at source-review level. One outer transaction, no COMMIT, temporary assembler drop, original helper identity recheck, final ROLLBACK. |
| Independent readback | PASS as a bound requirement. Existing frozen readback SHA-256 `690047294992cf19c31b57da9e075fd175bff458cdf404513fea584a0d9f16e6` remains the mandatory separate post-attempt readback. |
| Failure boundary | PASS. One attempt, no retry; timeout/error is a failed attempt followed by independent readback before further action. |
| Runtime | **NOT RUN.** SQL parse/compile/operator behavior and actual query load remain unproved until a separately authorized attempt. |

## Corrections made during review

Three repository-only defects were found and corrected before this review was frozen:

1. a formatting-based function identity check was replaced by the frozen assembler `prosrc` MD5;
2. six unique-index guards were strengthened from existence-only checks to exact index-definition guards, and composite type comparison was made OID-based;
3. the C-R02 expected-output expression was corrected to reference the loop record `r.case_name`.

These corrections changed only the new V2 proposal. No frozen C artifact or historical proof was changed, and no database operation occurred.

## What a successful authorized run would establish

A clean result plus independent readback would close **only** C-R01 and C-R02 at runtime: all-611 six-input extracted-selection parity and the literal typed-record present/null transformation boundary. It would not establish full-611 final readiness-output parity, production deployment safety as a whole, performance goals, API permissions, all filters/populations, or G4 completion.

## Exact next boundary

The correction is now frozen and source-reviewed. Do not execute it unless the user gives a fresh explicit authorization bound to:

- target Supabase project already governed for WP04;
- current main after a fresh moved-main reconciliation;
- script SHA-256 `3ed866cbfff9be29b251c17ddf163b12f159ee96cb70738b6e58d2919e15a69f`;
- one attempt/no retry/no COMMIT/final ROLLBACK;
- separate `c-independent-readback.sql` immediately afterward;
- no portfolio/performance/deployment/client work.

G4 remains incomplete/application HOLD until authorized runtime evidence is obtained and reviewed.
