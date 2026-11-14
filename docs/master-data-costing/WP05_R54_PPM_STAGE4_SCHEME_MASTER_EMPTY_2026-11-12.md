# WP05 R54 — PPM-only Stage 4 partial acceptance: Scheme Master empty (12 November 2026)

**OWNER-OBSERVED STAGE 4: 2 PASS / 1 EMPTY / 1 NOT TESTED. HOLD TEST ACCOUNT IN PPM-ONLY MODE.** Owner PWA observations: PPM available with other five Costing modules restricted **YES**, Scheme Master list **EMPTY**, Scheme Master History **NOT TESTED**, another PPM policy read **POPULATED**. Do not call the Scheme Master or PPM Stage 4 a full pass; do not convert untested History to a negative role result.

## Read-only catalogue and source investigation

- Owner-designated existing test account's effective canonical record state unchanged: PPM View **true**, CBM/CSR/CCC/MCM/PRM View **false**; all six Edit **false**. No identity, permission, view, pricing, Costing data or code modified for R54.
- Production `public.v_costing_scheme_master_register` currently contains **7** rows; `public.v_costing_scheme_master_audit` contains **7** rows in privileged read-only SQL. These counts show data exists, **not** that the actual PPM-only authenticated browser can see it.
- Register definition MD5 `8fdc0306bd2f1efbe0638c7c13ba4dda`,  `security_invoker=true`, owner postgres, ACL `{postgres=arwdDxtm/postgres,authenticated=r/postgres}`, effective broad reader predicate `fn_costing_view_allowed()`. Source `costing.scheme_master` and `costing.sku_scheme_viability_snapshot` have `authenticated` SELECT and `costing` schema USAGE, RLS ON with authenticated SELECT policies requiring `auth.uid() IS NOT NULL`. The Audit view MD5 `e2b9eb3c1b86d073183cd376f704cf58` retains PPM View-only predicate; audit list cannot be tested through UI until a Scheme Master row can be opened.
- Client `public/shared/js/costing-suite-pricing-policy.js` `loadPolicyManagerRows` for the `scheme-master` tab uses `v_costing_scheme_master_register`, an explicit selective column list and 1000-row paging, then alphabetic `scheme_name`; client `fetchSchemeMasterAudit` reads `v_costing_scheme_master_audit` only after opening a scheme's **History**.
- Shared `public/shared/js/costing-suite-shell.js` applies residual status/issue/source filters and search to all `ALL_ROWS`, including policy-manager, so an existing search/filter can display an empty Scheme Master even when source returned data. A view could also be empty for a normal JWT due to RLS or error/fallback. **Exact root cause remains UNCONFIRMED.**
- No real signed-in JWT RPC query, service-role substitution or fake account/actor was performed. Do not use privileged 7-row count to claim normal-browser policy success.

## Safe owner retest

With current PPM-only normal PWA login, navigate **Pricing Policy Manager → Scheme Master**, clear the global search field and all filter chips, then reload once (a fresh sign-out/sign-in if necessary). Report whether the Scheme Master list is populated/empty/explicit error; capture the exact non-sensitive empty/error label if visible. Only if a row appears, open a scheme with known audit history and check the History drawer, returning populated/empty/error; no pricing/audit identities copied. A cropped screenshot of the empty-state text with no business values is sufficient if it persists. Do not use Save/Edit/reactivation or other writers.

## Stage 5 disposition and restoration

**Do not proceed to negative-role Stage 5 yet.** A populated PPM Scheme Master is required to complete the positive PPM policy/audit check; moving to CBM/PRM would destroy the current clean role context for retest. When PPM is resolved, evaluate whether CBM/PRM-only test adds meaningful negative-access evidence or merely absent-navigation proof, and obtain the owner's direction. Do not infer that other five module navigation restrictions prove the database view's negative permission matrix.

Original Stage 0 restoration target remains all six costing modules **View=true, Edit=false**; test account remains PPM-only until owner finishes this stage or approves a change.

## Formal governance

R48 Stage 1 CSR-only owner PASS. R52 Stage 2 CCC-only 4/4 owner PASS after retained Readiness error/recovery. R53 Stage 3 MCM-only required checks PASS; Material Review Acceptance in-context NOT OBSERVED. R54 Stage 4 PPM-only 2 PASS, Scheme Master EMPTY, History NT. W5-06 OPEN, WP05 formal 6/13; no security gate elevation, no production change.
