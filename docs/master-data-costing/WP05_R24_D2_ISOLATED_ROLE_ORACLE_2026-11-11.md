# WP05 R24 — isolated D-2 role-oracle fixture (11 November 2026)

**Scoped test package, not an authenticated permission acceptance.** Issue #297, R21/R22/R23. The owner chose the D-2 closure-critical subset but has **not** approved a new PPM audit reader policy or production security change. W5-06 OPEN; WP05 OPEN, formal programme 6/13.

## Executable evidence

`node --test scripts/wp05-d2-role-contract/d2-role-contract.test.mjs`

Node 22.16.0 isolated equivalent test run on 11 November: **6 tests / 6 PASS / 0 FAIL**. Same logical cases were committed to the repository in this package. The fixture is based on the three live permission function definitions read using metadata only, and pinned to the observed `public.fn_costing_view_allowed` `md5(prosrc)=b7efb09b90fa3e9332915ba5d223568c`. **The fixture is not dynamically sourced from PostgreSQL; if that hash changes its assumptions require fresh review.** No database credentials or network runtime are involved in the tests.

Checks model a no-UID caller, View versus Edit bit, four distinct CCC/CBM/CSR/MCM View grants, PPM-only View, cross-module reader, and privileged database role exceptions. The second gate in the tests is named `proposedPpmAuditOuterGate` and is deliberately labelled **NOT OWNER APPROVED / NOT DEPLOYED**. It illustrates the impact of PPM-only audit access, **not a corrective implementation**.

## Interpretation

- The live **outer helper** grants one-of-four costing View access but not PPM-only View (R23 source proof; fixture reproduces it). It does **not** establish per-view effective SQL reachability, underlying RLS effects, actual rows, network response, user's business authorisation, or a confidentiality breach.
- Public Scheme Master audit is a non-invoker view over `costing.scheme_master_audit` (RLS disabled) with a four-module outer helper and a direct PPM client consumer. This is a **source-supported potential authorisation-design mismatch**; none of the six synthetic assertions is a real ID-V/ID-O/PPM authenticated negative-role pass.
- **No new owner permission decision:** whether PPM View should access historical actor/remarks and whether unrelated modules should be denied remains for explicit business approval. Do not silently equate frontend PPM screen ownership to approved SQL role policy.
- Full export/indirect call graph and sensitive-field minimisation remain open for six selected views. A later **separately approved** safe protocol can verify genuine read-only role results without changing user roles or retrieving row payloads. Do not run production writer denial.

## Disposition

D-1 bounded SEC writer source/metadata evidence accepted with behavioural writer denial **NOT TESTED**. D-2 isolated source-derived role model **PASS 6/6**, **effective signed-in security still NOT TESTED**. D-4 Cost Comparison functional recovery accepted with 4-second p95 **HOLD**. W5-04/W5-06/W5-10 remain OPEN and the AE1 13P/4F/2NA/21NT historical snapshot is untouched.
