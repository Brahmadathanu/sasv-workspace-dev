# WP05 R58 — PPM Stage 4 recovered PASS and six-module test baseline restored (12 November 2026)

**Owner-observed PPM-only Stage 4 signed-in PWA retest PASS. Guarded original permission baseline RESTORED AND VERIFIED.** This is scoped functional positive evidence; no staff impersonation, privileged read pretending to be actual signed-in user, or direct negative-role SQL proof was claimed.

## Stage 4 acceptance

Following exact owner-approved production R57 Scheme Master Register PPM-only reader correction (catalogue MD5 `903cb8eae3702bf72e41213ec2c89c6e`), owner confirmed on the actual designated test account:
- Scheme Master list: **POPULATED / PASS**.
- Scheme Master History: **POPULATED / PASS**.
- Previously recorded R53/R54 PPM navigation restriction: **PASS** (other five costing module screens restricted).
- Previously recorded other PPM policy read: **POPULATED / PASS**.
- The earlier R54/R55 Scheme Master list EMPTY and inability to validate History remain as historically observed pre-correction failures. R57 fixes the Register predicate, owner R58 PWA retest confirms recovery. Do not delete the failure.

This closes the **bounded four-stage normal PWA positive/route acceptance sequence**:
1. CSR-only: owner positive screen results PASS (R48/R49).
2. CCC-only: navigation, dashboard/SKU control, workbench, and Readiness PASS; Readiness initially failed `READINESS_BUILD_STALE`, recovered via approved governed build #7 and owner PWA retest (R50–R52).
3. MCM-only: navigation restricted, Manual Rate Register and Rate History populated; conditional Material Review Acceptance information **NOT OBSERVED**, not PASS/FAIL (R53).
4. PPM-only: nav/policy read PASS, Scheme Master and History populated after R57 (R58).

## Stage 5 decision

A further **CBM-only or PRM-only navigation test is NOT REQUIRED for this bounded browser series**, as it would only repeat absence-of-navigation signals without proving a direct authenticated SQL denial in the source views. There remains a **separate open negative-role authenticated view read security acceptance** for any selected D-2/scheme readers; do not silently credit it from UI absence. D-1 writer denial remained deliberately **NOT TESTED** under the no-call policy. Owner asked when to restore: the end of successful Stage 4 was the right point, and restoration was performed now. Stage 5 not activated, not a missing failure.

## Exact guarded original baseline restoration

Preflight `public.user_permissions_canonical` for the pre-existing designated acceptance identity: exactly 6 Costing module rows, `module:pricing-policy-manager` View=true only, other five View=false, all six Edit=false. Each row's original `meta` had owner approval `owner via ChatGPT 2026-11-07` and scope `six costing modules only`. No other rows found for this identity; no account identifiers or token data copied here.

One guarded `BEGIN/COMMIT` transaction under `lock_timeout=3s`, `statement_timeout=20s` uniquely matched the identity, required exact six-row PPM-only pre-state, all Edit=false and untouched provenance metadata, then updated **can_view=true on the exact same six rows only**, preserving `can_edit=false` and every `meta` value. Postcondition failure would have rolled back.

Separate post-write reads:
- `public.v_user_permissions_effective`: **all six Costing targets View=true/Edit=false**.
- `public.user_permissions_canonical`: exactly **6 rows**, all **6 View=true and Edit=false**, all **6 original owner/scope metadata values preserved**.
- Live Scheme Master Register MD5 `903cb8eae3702bf72e41213ec2c89c6e` and Scheme Master Audit MD5 `e2b9eb3c1b86d073183cd376f704cf58` unchanged.
- No other account, new Edit grants, table, view, permission function, client module or business data touched by restoration.

## Programme governance

Six chosen D-2 view catalogue SQL corrections and extra Scheme Master Register correction installed and verified; **this does not by itself close W5-06**. Bounded signed-in PWA four-stage positive test finished, with documented outstanding in-context Material Acceptance and direct authenticated negative-role view response proof. Broader WP05 W5-03/04/06/07/08/09 unresolved evidence and W5-10 owner final signoff still required. **W5-06 OPEN, formal WP05 6/13**; retain accepted scoped exceptions and original no-writer-call safety decision. No premature 7/13 claim.
