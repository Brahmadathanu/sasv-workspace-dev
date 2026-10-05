# WP04 G7 Track A — Governed Readiness Index Contract V1

Status: **FROZEN PACKAGE CONTRACT / NOT APPLIED**

This contract accompanies:

- `wp04-g7-track-a-forward-v1.sql`
- `wp04-g7-track-a-rollback-v1.sql`
- `wp04-g7-track-a-proof-v1.sql`

## Authority

The readiness builder does not implement readiness rules.

It calls the existing canonical helper:

`costing.fn_product_sku_readiness_live_core(bigint,date,date,bigint,jsonb,jsonb)`

That helper is already used by the canonical public single-SKU readiness path and delegates to the existing C live-core composition.

The package does not alter:
- governed-period reader;
- Product-gap reader;
- CSE-P01 commercial authority;
- route authority;
- canonical single-SKU readiness;
- permissions/RLS/Auth;
- source business/master data.

## Permanent objects

Private:

1. `costing.readiness_portfolio_source_epoch`
2. `costing.product_sku_readiness_portfolio_build`
3. `costing.product_sku_readiness_portfolio_item`
4. `costing.product_sku_readiness_portfolio_incidence`
5. `costing.fn_wp04_readiness_bump_source_epoch()`
6. `costing.fn_wp04_readiness_source_fingerprint(date)`
7. `costing.fn_wp04_build_readiness_portfolio(date)`
8. `costing.fn_wp04_readiness_portfolio_index_read(...)`
9. one statement-level source-epoch trigger on each of the 44 registered canonical source relations.

Public replacement only:

`public.rpc_get_product_sku_readiness_portfolio(...)`

Its signature and authenticated/Control Center permission model are unchanged.

## Source/freshness fingerprint

Fingerprint V1 combines:

- governed period;
- governed valuation date;
- latest SUCCESS evidence refresh run id;
- transactionally maintained epoch value for each of the 44 registered source relations;
- digest of the canonical helper/function definitions;
- digest of:
  - `costing.v_cost_driver_policy_registry`
  - `costing.v_sku_commercial_sales_basis`
  - `costing.v_regional_marketing_evidence_review_queue`
- source relation column-schema digest.

Any committed INSERT/UPDATE/DELETE/TRUNCATE on a registered source relation increments its epoch in the same transaction.

Any canonical helper/view definition change changes the definition digest.

The public portfolio reader binds fingerprint comparison, current-build selection and indexed read in one SQL statement/snapshot.

Therefore:
- source change committed before the request => stale detected;
- source change not yet committed => not visible to that request;
- source change committed after request snapshot => next request detects stale.

## Registered source relations

The forward package registers exactly 44 source relations covering:

- Product/SKU hierarchy and lifecycle;
- PM-BOM;
- batch-size authority;
- MRP;
- selling policy;
- commercial sales basis and assumptions/defaults;
- governed period/refresh-run identity;
- six driver snapshots;
- scheme snapshot;
- regional-marketing snapshot;
- final costing-control snapshot;
- driver policy/cutover authorities;
- specialised workload policies;
- route family/product/group/subgroup/route/step authorities and route policy inputs.

The exact list is in the forward SQL and was independently checked against the live catalog: 44/44 exist, no trigger-name collision.

## Build lifecycle

### BUILDING
A private build starts only after:

- governed period resolves;
- valuation date resolves;
- source fingerprint is captured;
- per-period advisory build lock is obtained.

Only one build for a period may run through this builder at a time.

### Canonical population

V1 builds **ALL_EXISTING SKUs** once.

Each item stores the exact canonical assessment returned by the existing canonical live-core helper.

OPERATIONAL is then a relational subset based on the stored canonical lifecycle fields:
- Product Active;
- SKU active;
- not sample.

This avoids maintaining two competing readiness builds.

### Validation

Before promotion the builder verifies:

- item count = current Product SKU count;
- context type LIVE_AS_OF;
- SKU/Product identity;
- period;
- valuation date;
- refresh-run context;
- severity vocabulary;
- route uniqueness.

### Promotion concurrency rule

Immediately before promotion, the builder obtains row locks on the source-epoch registry and recomputes the fingerprint.

If the end fingerprint differs from the start fingerprint:

- build becomes FAILED;
- build is not current;
- old current build remains untouched.

If equal:

- previous current build is marked SUPERSEDED;
- new build becomes COMPLETED + current in the same transaction.

A source mutation already in progress either:
- commits before promotion lock acquisition and is detected, or
- waits briefly for promotion, then commits and bumps the epoch, making the just-promoted build stale for subsequent requests.

## Current-build selection

Exactly one current build may exist per period.

Public selection requires:

- matching governed period;
- matching valuation date;
- matching latest SUCCESS evidence refresh run id;
- status COMPLETED;
- is_current=true;
- build fingerprint digest = current live fingerprint digest.

If no current build:
- `READINESS_BUILD_ABSENT`.

If a current build exists but is not COMPLETED:
- `READINESS_BUILD_INCOMPLETE`.

If a completed current build exists but its fingerprint no longer matches:
- `READINESS_BUILD_STALE`.

Incomplete/BUILDING builds are never selected.

## Rebuild rule

The package intentionally does **not** rebuild synchronously from the user request.

Rebuild is performed by explicitly invoking:

`costing.fn_wp04_build_readiness_portfolio(<governed period>)`

Operationally, rebuild is required after any source mutation that makes the current build stale and after a new successful refresh run changes the governed evidence context.

V1 does not add a cron or automatic background worker. That is deliberate: the recovery package proves correctness/performance first before adding scheduling policy.

Until rebuild completes, the reader fails closed rather than serving old readiness.

## Retention

V1:
- no automatic deletion;
- one current build per period;
- previous completed current build becomes SUPERSEDED;
- retain current + at least two superseded completed builds until a separately reviewed prune operation exists;
- failed builds may be retained for diagnosis.

No DROP CASCADE is permitted.

## ACL model

Private relations/functions:
- owner postgres;
- no PUBLIC / anon / authenticated / service_role access.

Source epoch triggers:
- execute through a SECURITY DEFINER trigger function owned by postgres.

Public portfolio reader:
- owner postgres;
- EXECUTE only authenticated;
- requires `module:costing-control-center / view` in-body;
- no Manage Products widening.

## Fail-closed contract

The public reader never falls back to live full-611 evaluation.

It fails rather than serving:
- stale build;
- absent build;
- incomplete build;
- mismatched governed context.

This is intentional so performance recovery cannot weaken readiness authority.

## Production failure boundaries

### Failure before P1 COMMIT
No Track A infrastructure is committed.

### Failure after P1 COMMIT but before public cutover
Private infrastructure/build rows may exist.
The existing public C portfolio RPC remains authoritative and unchanged.
Stop. No blind retry.

### P3/P4 public cutover
Public replacement and its post-cutover identity guards run in one transaction.
If a guard fails, public cutover rolls back atomically.

### Post-cutover proof failure
Use only the reviewed Track A rollback package after explicit/conditional authorization.
Do not patch forward in production.

## Rollback

Rollback:
1. restores exact pre-recovery portfolio RPC identity;
2. restores exact authenticated ACL;
3. removes only Track A source triggers/private functions/private relations;
4. verifies CSE-P01 is unchanged;
5. uses no DROP CASCADE.

Canonical single-SKU readiness is never replaced by Track A, so rollback does not affect it.

## Proof gates

Production acceptance requires all of:

- full-611 OPERATIONAL canonical assessment equality;
- exact statistics equality;
- selected filter matched-count parity;
- first-page keyset parity;
- stale fail-closed;
- absent fail-closed;
- incomplete fail-closed;
- CSE-P01 function identity unchanged;
- private ACL proof;
- public ACL proof;
- two portfolio reads under `SET LOCAL statement_timeout='8s'` completing inside the real native-equivalent ceiling;
- final build freshness/current proof.

The 8-second proof clamp lowers the postgres proof transaction ceiling to the native authenticated ceiling. It does not increase any production role timeout.

## G7 re-entry

Even after server package success, G7 does not resume until Track B UI recovery is separately completed and reviewed.

G7 then restarts from the beginning.
