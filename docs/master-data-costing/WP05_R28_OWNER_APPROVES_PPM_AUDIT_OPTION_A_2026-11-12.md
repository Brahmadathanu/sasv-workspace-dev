> **R30 ISOLATED PG17 EVIDENCE — 12 NOV 2026:** [R30 PostgreSQL 17.11 verification](WP05_R30_OPTION_A_ISOLATED_PG17_VERIFICATION_2026-11-12.md) records 9/9 synthetic database tests and safe rollback, including PPM positive / CCC-CBM-CSR-MCM negative, 20-column and ACL/owner retention, exact original/candidate view fingerprints. Draft PR #311 NOT MERGED, production SQL NOT APPLIED, effective authenticated real-user behaviour NOT TESTED; separate execution approval still required. W5-06 OPEN, programme 6/13.

# WP05 R28 — owner approves Q-R27-PPM-AUDIT Option A (12 November 2026)

**AUTHORITATIVE OWNER DECISION, narrowly scoped.** Owner explicitly selected **Option A** in chat following R27's plain-English explanation. This approves **business access policy**, *not a live schema change, production test, account adjustment or deployment*. Supersedes R27's Q-R27-PPM-AUDIT *pending* status only; no other R27 reader-policy suggestions are approved.

## Exact approved policy

For `public.v_costing_scheme_master_audit` (Scheme Master History):

1. An ordinary authenticated user with **Pricing Policy Manager (PPM) View** permission may read the Scheme Master audit history; **PPM Edit is not required**.
2. An ordinary user with **only** Costing Control Centre (CCC), Cost Build Manager (CBM), Cost Sheet Review (CSR) and/or Material Cost Manager (MCM) View permission **must not** be given Scheme Master audit access by those permissions alone.
3. A user with PPM View **and** other module permissions remains an authorised PPM reader. This is not a denial of legitimate multiscope users.
4. Existing explicitly privileged database support roles `postgres`/`service_role` are considered a technical continuity allowance **for the proposed candidate only**; no expansion of browser/public grants or new user privileges is approved.
5. This rule applies **only to the Scheme Master audit-history view**, not general schemes, the Scheme Master register, price/discount policies, scheme-comparison outputs or the other five D-2 candidate views.
6. View and Edit stay distinct. No additional ability to create, change, deactivate, approve or close schemes follows from this approval.

## Verification and proposed implementation

R23/R27 observed the public audit view with authenticated SQL SELECT, anon SELECT denied, postgres owner, default owner-rights execution, and a `fn_costing_view_allowed()` outer predicate which tests **CCC/CBM/CSR/MCM**, not PPM. The underlying audit table is `costing.scheme_master_audit` without RLS. This is a **source-level role-policy mismatch**; real signed-in exposure/denial remains **NOT TESTED** and no historical confidentiality breach is claimed.

Candidate must replace **only that one view's outer predicate** with an exact PPM View check and retained privileged-service technical branch; preserve all 20 output columns, the underlying table source, SQL ACLs, owner, comment and client reader. Do **not** rewrite global `fn_costing_view_allowed`, add SELECT grants to base table, introduce a broad SECURITY DEFINER helper or modify other D-2 views.

The existing #303 Actor rendering fix (merged #306) remains separate and unaffected. The candidate must include:
- A precondition checking live audit view definition fingerprint against R27 (`001024540bdeab9f2e5aa4ec2a6f6c53`) and stable current 20-column contract.
- An isolated, synthetic, positive/negative permission matrix: PPM View, PPM Edit-only, CCC/CBM/CSR/MCM-only, mixed PPM+other, unauthenticated, privileged service. Include source/SQL checks that the four-module helper is not used in the rewritten view.
- Safe rollback under a precondition, exact original view SQL and post-application verification plan without extracting actor/vendor records.
- A separate owner **production execution approval** after independent review. This R28 decision **is not permission to run** the migration, role impersonation, live sensitive row SELECT, writer denial or test-user provisioning.

**Owner decision status:** Q-R27-PPM-AUDIT **OPTION A APPROVED**. Other five view policies: **NOT APPROVED / still to be decided separately**. Effective signed-in security verification: **NOT TESTED**. W5-06, W5-04, W5-10 OPEN; WP05 programme **6/13**. D-1 writer behavioural denial NOT TESTED and D-4 four-second p95 HOLD unchanged.
