# WP04-G4 — Committed C deployment / rollback review

2026-10-05. **PACKAGE FROZEN / SOURCE REVIEW PASS / PRODUCTION EXECUTION NOT AUTHORIZED.**

## Performance disposition prerequisite

Server performance feasibility is accepted by programme authority as **ACCEPTED WITH MEASURED LIMITATION**.

Exact retained observations:

- 6938.008 ms;
- 5084.304 ms;
- both full-611 OPERATIONAL/full-statistics;
- both above provisional 3s/5s engineering goals;
- goals remain UNMET / NON-BLOCKING;
- performance authorization consumed;
- restoration PASS.

No additional speculative G4 optimization is permitted. G7 retains mandatory signed-in/live performance verification.

## Permanent deployment artifact

File: `c-committed-deployment.sql`  
SHA-256: `cfc07ee0a731e11ba57e12d2edd3dea58c22bc05fc42c50446c9032a6132da12`  
Git blob: `6d0a5b229d98fd76206c4dcc77c26bdee0d3a16f`

Mechanical derivation check PASS: exact `c-forward-draft.sql` source with only:

1. deployment header changed; and
2. final outer transaction outcome changed from ROLLBACK to COMMIT.

No function body, ACL, owner, search_path, source guard, identity guard, context rule, authority rule, filter/statistics rule or business rule changed.

The deployment permanently installs the reviewed C contract:

### Existing replacements

- `public.rpc_get_product_sku_readiness(bigint,date,text,bigint)`
- `costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)`
- `costing.fn_product_sku_readiness_run_evidence(bigint,date,date,bigint)`

### New private/public functions

- `costing.fn_wp04_c_run_assemble(...)`
- `costing.fn_wp04_c_run_cohort(bigint[],date,date,bigint)`
- `costing.fn_wp04_c_enrich(...)`
- `costing.fn_product_sku_readiness_enrich_with_shared(...)`
- `costing.fn_wp04_c_live_core(...)`
- `costing.fn_product_sku_readiness_live_core(...)`
- `public.rpc_get_readiness_governed_periods(date,integer)`
- `public.rpc_get_readiness_product_gaps(text,text,text,bigint,integer)`
- `public.rpc_get_product_sku_readiness_portfolio(date,text,text[],text[],text[],text[],text,bigint,integer)`

Private C helpers remain non-frontend-callable per frozen ACL identities. The three public readers remain Control-Center-authorized authenticated readers as previously reviewed.

## Permanent rollback artifact

File: `c-committed-rollback.sql`  
SHA-256: `38024dab44f4bb513588142437e2f360fc90f35e4beb17437e3266faaa008d88`  
Git blob: `99fcf74bdbc063fd71a80c91988fd750ca225f29`

Mechanical derivation check PASS: exact reviewed `c-rollback-draft.sql` with only:

1. rollback header changed; and
2. final outer transaction outcome changed from ROLLBACK to COMMIT.

It first requires the exact candidate identities, restores the three original captured definitions/ACLs, drops all nine candidate/new functions, verifies original hashes/ACLs and candidate absence, verifies the event-trigger fingerprint, then commits.

## Independent post-deployment verification

File: `c-post-deployment-verification.sql`  
SHA-256: `35aba23abc2409a8c1bc9b434fbb36c337302e4883e1e4c1f811dff72b29658e`  
Git blob: `01c7cb3be9edff2f666075658d39a97eadf4af8d`

Read-only / final ROLLBACK.

It independently:

- verifies exact deployed identities/ACLs/attributes;
- uses the existing reviewed Control Center actor only by transaction-local SQL claim simulation;
- smoke-checks governed periods;
- smoke-checks Product gaps;
- smoke-checks canonical single-SKU LIVE_AS_OF;
- performs one OPERATIONAL portfolio limit1/full611 functional smoke and checks population/matched/severity totals;
- does not treat that call as a new performance benchmark;
- does not claim native Auth/API proof;
- performs no business mutation.

Native Auth/API runtime remains mandatory at G7.

## Old-state rollback verification

If conditional rollback is triggered, use the already frozen read-only `c-independent-readback-completion.sql`, SHA-256 `42ff34e909251f22938dbb971a65d232cdc9938cd3d2dcb643092e63c620fc02`, to verify all 22 original definitions/attributes/columns/event/callers, candidate absence and no idle WP04 transaction.

## Failure semantics

### Deployment statement fails before COMMIT

The transaction aborts; no committed C deployment should exist. Run old-state independent readback. Do not retry automatically.

### Deployment COMMIT succeeds but post-deployment verification fails

Trigger the exact committed rollback once. Then run old-state independent readback.

### Rollback script fails before COMMIT

Its transaction aborts. Do not guess cleanup or retry. Stop and report the exact failure and current independently observed state.

### Rollback COMMIT succeeds but old-state verification fails

Stop as a critical unresolved restoration state. No G5/client work, no new optimization, no silent repair.

## Review disposition

**RECOMMEND EXACT ONE COMMITTED DEPLOYMENT ATTEMPT WITH CONDITIONAL ONE-ATTEMPT ROLLBACK AUTHORITY.**

This is the final remaining G4 server gate.

A successful deployment + independent verification closes the server application portion of G4 and allows transition toward G5, while native authenticated/live permission and performance proof remains mandatory at G7.

No merge, client implementation, G5 action, native bearer/JWT test or architectural performance redesign is included in this authorization.
