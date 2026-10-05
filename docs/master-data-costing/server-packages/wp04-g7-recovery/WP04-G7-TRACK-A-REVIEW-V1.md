# WP04 G7 Track A — Independent Exact Package Review V1

2026-10-05. **PASS FOR EXPLICIT PRODUCTION AUTHORIZATION — NOT EXECUTED.**

## Exact reviewed identities

- forward SQL blob: `8c640d563b3a349a61c3b1e161875081823016c0`
- rollback SQL blob: `9130ba6be1b1b1b531557eded4743be2b4108cb3`
- proof SQL blob: `eccfc0ed7de4116f6b7227ee00dfe4a954b8bb86`
- contract blob: `50a3d7877f6609a1a1f161bdd7c4b5c462cdf4f1`

Any content change invalidates this review.

## Review scope

Reviewed against:
- frozen G7 recovery architecture;
- current committed C server authority;
- canonical live-core helper chain;
- native 8-second authenticated timeout evidence;
- source dependency closure;
- CSE-P01 locks;
- current live catalog identities.

No production SQL was executed.

## Freshness/source closure

PASS after one correction during review.

The first draft omitted the underlying regional-marketing snapshot relation used by the regional review queue. The package was corrected before freeze to include:

`costing.sku_regional_marketing_allocation_basis_snapshot`

and to fingerprint:

`costing.v_regional_marketing_evidence_review_queue`.

Final registry:
- 44 exact source relations;
- 44/44 exist in live catalog;
- zero proposed trigger-name collisions.

The fingerprint additionally covers canonical function/view definitions and relation column schemas.

## Builder authority

PASS.

The builder calls:

`costing.fn_product_sku_readiness_live_core(...)`

It does not copy readiness severity/business logic.

The package stores the resulting canonical assessment envelope and relational projections required for filtering/statistics.

CSE-P01 resolver definitions are guarded and unchanged.

## Build lifecycle/concurrency

PASS.

- per-period advisory build lock prevents duplicate builder execution;
- start fingerprint captured before build;
- full ALL_EXISTING build produced once;
- validation occurs before promotion;
- source-epoch rows are locked only at the final promotion boundary;
- end fingerprint must equal start fingerprint;
- promotion is atomic;
- a source mutation after promotion bumps epoch and makes the build stale on the next request;
- incomplete/failed builds are never selected.

## Public-read consistency

PASS after one correction during review.

The first draft checked freshness and performed the index read in separate SQL statements. It was corrected before freeze.

Final V1 binds:
- current fingerprint;
- current completed build selection;
- index read

inside one SQL statement/snapshot.

This removes the stale-read commit window.

## Fail-closed behavior

PASS.

Explicit outcomes:
- no current build → `READINESS_BUILD_ABSENT`;
- current build not COMPLETED → `READINESS_BUILD_INCOMPLETE`;
- completed current build with fingerprint mismatch → `READINESS_BUILD_STALE`.

No fallback to synchronous full-611 live evaluation exists.

## ACL/security boundary

PASS by source review.

Private Track A objects:
- postgres owner;
- no PUBLIC/anon/authenticated/service_role grants.

Public portfolio RPC:
- authenticated EXECUTE only;
- existing Control Center view permission remains mandatory.

No RLS/Auth/role change.

## Bounded server scope

PASS.

Changed public object:
- only `public.rpc_get_product_sku_readiness_portfolio(...)`.

Unchanged:
- governed-period reader;
- Product-gap reader;
- single-SKU canonical readiness;
- CSE-P01;
- route authority;
- timeout configuration.

Static package inspection confirms no governed-period/Product-gap reader statements in forward/rollback/proof files.

## Timeout discipline

PASS.

Forward and rollback contain no statement_timeout modification.

Proof uses:

`SET LOCAL statement_timeout='8s'`

only to lower the postgres proof transaction to the real native authenticated ceiling.

No role/platform timeout is increased.

## Rollback review

PASS after one correction during review.

An early rollback draft accidentally captured adjacent ALTER/GRANT statements while importing the old portfolio function. It was corrected before freeze.

Final rollback:
- restores only the exact prior portfolio RPC;
- removes only Track A triggers/private functions/private tables;
- no DROP CASCADE;
- verifies legacy function identity/ACL;
- verifies CSE-P01 unchanged.

## Proof package

PASS for authorized execution.

Required proof includes:
- full 611 OPERATIONAL canonical assessment equality;
- full statistics equality;
- filter matched-count cases;
- first-page keyset parity;
- stale/absent/incomplete fail-closed cases;
- CSE-P01 identity;
- private/public ACLs;
- two reads under 8-second native-equivalent ceiling;
- final current/fresh build proof.

Temporary negative tests modify only Track A private metadata inside savepoints and roll back.

No business/master data mutation is included.

## Retention

Acceptable for V1.

No automatic deletion is included.
Previous current builds become SUPERSEDED.
Current + at least two superseded builds are to be retained until a separately reviewed prune operation exists.

This favors auditability over early cleanup.

## Main production risk

The main risk is **availability after authoritative source changes**.

Any registered source mutation makes the current build stale immediately. Until the private builder completes and promotes a fresh build, the portfolio reader intentionally fails closed.

V1 does not add automatic scheduling. This is deliberate for the first recovery apply, but an operational rebuild trigger/schedule may later be needed after evidence from the deployed recovery.

This risk is preferable to silently serving stale readiness.

## Failure containment

- failure before private-infrastructure commit: no Track A apply;
- failure after private install but before cutover: old public C reader remains unchanged;
- public cutover + guards are one transaction;
- proof failure after successful cutover requires reviewed rollback;
- no blind retry.

## Review disposition

**PASS — RECOMMEND PROCEEDING ONLY WITH THE EXACT REVIEWED V1 PACKAGE UNDER EXPLICIT PRODUCTION AUTHORIZATION.**

Recommended execution order:
1. fresh source identity/target guards;
2. exact forward V1 once;
3. exact proof V1 once;
4. if proof PASS: stop with Track A server recovery applied; do not resume G7 yet;
5. if proof FAIL after cutover: execute exact rollback V1 once under the conditional rollback authorization;
6. independently verify rollback identity;
7. stop.

Track B remains separate and unstarted.
G7 remains blocked until both recovery tracks are completed and re-reviewed.
G8 remains closed.
