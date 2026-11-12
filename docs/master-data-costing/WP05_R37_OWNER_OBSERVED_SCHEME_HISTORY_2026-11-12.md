# WP05 R37 — Owner-reported visible Scheme History after Option A production correction (12 November 2026)

**Owner observation recorded; not an independent authenticated session trace.** In response to R36's explicitly scoped procedure (normal SASV PWA → Pricing Policy Manager → Scheme Master → History, using an existing PPM View-only account and a scheme known to have previous changes), the owner reported: **“Confirmed scheme history appears. Proceed.”** This is a first-party owner report of **visible Scheme History** after the R34 live view correction. It is stronger than the earlier status of *no browser observation*, but the reply did not explicitly identify or independently attest the account's exact effective permission set, PWA version, specific history event count, or request trace. No private actor UUID, audit row, scheme name, JWT, screenshot or payload was requested or retained.

## Evidence classification

| Observation/gate | Evidence | Status |
|---|---|---|
| Owner manually sees Scheme History after R34 | Direct owner report in current conversation | **OWNER-REPORTED POSITIVE SCREEN OBSERVATION** |
| Scheme History UI and service request | R36 source: `fetchSchemeMasterAudit` selects from `v_costing_scheme_master_audit`; displayed table only when nonempty | **SOURCE CORRELATION**, not independent network trace |
| Real signed-in PPM View-only access | R36 procedure asked for PPM View-only account; current confirmation says history appears without independently restating the actual account/permission snapshot | **CONDITIONALLY POSITIVE; effective PPM-only classification NOT INDEPENDENTLY VERIFIED** |
| PPM+other Costing mixed role | No owner-reported specific test | **NOT TESTED** |
| Costing-only negative role with no PPM View | R35 live canonical permission groups: **0** matching existing users | **NOT TESTED / no suitable existing category** |
| Underlying SQL source-policy and view contract | R34 exact live view MD5 `e2b9eb3c1b86d073183cd376f704cf58`, 20 columns, original ACL and other views unchanged | **PRODUCTION DDL/CATALOGUE PASS** |
| Historical AE1/five other D-2 reader policies | Unchanged, owner has not approved blanket rewrite | **OPEN** |

**Conservative interpretation:** the owner has observed a working Scheme History in the actual interface, resolving the *absence of any browser-positive observation*; do not claim independently captured role proof, exact live session/JWT categorisation or a complete PPM-only positive/Costing-only negative authorisation matrix. This is **not** a general W5-06 closure or evidence of denied access to other modules. In particular, if the observed account has CCC/CBM/CSR/MCM View as well as PPM View, the observation still confirms ordinary history functionality but cannot establish *PPM-only* separately.

## Follow-on D-2 subset work (bounded, no policy change)

Six closure-critical views were selected under R21. The first Scheme Master audit view now has owner-approved Option A, actual one-view SQL applied and metadata verified (R34), an owner-reported positive screen observation (R37), and outstanding denied-role proof. The **remaining five** views retain their original predicates and consumer needs:

1. MCM manual rate register and history: vendor source/rate/MOQ/lead-time/remarks; intended reader roles and cross-module sensitive supplier origin need explicit owner classification.
2. CCC material review acceptance register: includes actor email and acceptance notes; distinguish read from write/close permission.
3. CSR SKU detailed Cost Sheet: includes pricing, labour, overhead; has `security_invoker=true` and independent source RLS/ACL constraints.
4. CSR line traceability: includes evidence/drill JSON; preserve existing line-explanation functionality.

No owner decision has been given for these five. **Do not** apply Option A's PPM-only policy to them or modify the shared `fn_costing_view_allowed` helper on the basis of this screen confirmation.

## Gate decision

- **R37 owner-reported Scheme History visible:** captured.
- **R28 policy and R34 production Scheme audit update:** already approved/applied; unchanged.
- **W5-06:** remains **OPEN**, pending effective-role negative and five-view scope as applicable. Owner has **not** explicitly closed the workpack.
- **WP05 formal owner-signed gates:** **6/13**, unchanged.
- D-1 writer-denial behaviour NOT TESTED (governed acceptance); D-4 Cost Comparison p95 4 seconds HOLD; frozen AE1 outcomes unchanged.

No new production SQL, account/role, permission, feature flag, app deployment or exposure of sensitive rows was undertaken for this R37 checkpoint.
