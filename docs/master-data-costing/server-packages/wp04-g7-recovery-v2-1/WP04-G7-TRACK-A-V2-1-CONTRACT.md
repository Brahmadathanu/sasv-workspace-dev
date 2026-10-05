# WP04 G7 Track A V2.1 — Narrow PostgreSQL Compatibility Correction Contract

Status: **FROZEN / REVIEW ONLY / NOT EXECUTED**

## Purpose

V2.1 corrects one identified PostgreSQL compatibility defect in the already-installed V2 builder:

Unsupported V2 expression:

`jsonb_object_length(v_run_map)`

PostgreSQL 17.4 live catalog confirms:
- `jsonb_object_length(jsonb)` is unavailable;
- `jsonb_object_keys(jsonb)` is available.

V2.1 replaces only the builder cardinality check with:

`(SELECT count(*) FROM jsonb_object_keys(v_run_map))`

No other V2 builder logic is changed.

## Current pre-V2.1 state

- original public C portfolio RPC is still active;
- V2 fingerprint definition is installed;
- defective V2 builder definition is installed;
- V1 private substrate is installed;
- 44 source-epoch rows;
- 44 epoch triggers;
- build rows = 0;
- item rows = 0;
- incidence rows = 0;
- no current build.

## Preserved architecture

V2.1 preserves without redesign:

- V2 batched `fn_wp04_c_run_cohort(all_sku_ids,...)` strategy;
- unchanged `fn_wp04_c_live_core(...)` canonical composition;
- V2 freshness fingerprint contract `WP04_G7_TRACK_A_V2`;
- 44-source epoch registry and triggers;
- full ALL_EXISTING build;
- OPERATIONAL relational subset;
- pre-cutover full-611 JSONB parity against the still-active public C RPC;
- atomic public cutover;
- fail-closed indexed reader;
- unchanged CSE-P01 authority;
- unchanged route/readiness/business logic;
- unchanged proof semantics.

## Forward V2.1

Forward V2.1:

1. verifies exact current public/V2/private identities;
2. verifies empty pre-cutover substrate;
3. verifies `jsonb_object_keys(jsonb)` exists;
4. replaces only `costing.fn_wp04_build_readiness_portfolio(date)`;
5. performs one V2.1 build attempt;
6. requires fresh promoted build with OPERATIONAL=611;
7. captures all 611 OPERATIONAL assessments from the still-active public C RPC;
8. requires exact JSONB equality against V2.1 stored assessments;
9. only then performs the unchanged V2 public portfolio cutover and guards.

No timeout modification.

## Proof V2.1

The V2 proof is carried forward **byte-identically** as V2.1 because the compatibility correction does not change any post-cutover contract.

It retains the exact blob identity:

`e856b362442626844d80faa33782324fd186897d`

and verifies:
- current V2 build/freshness;
- ALL_EXISTING count;
- OPERATIONAL=611;
- direct canonical helper equality;
- statistics/filter/keyset behavior;
- stale/absent/incomplete fail-closed states;
- CSE-P01;
- ACLs;
- OPERATIONAL and ALL_EXISTING under an 8-second proof ceiling.

## Rollback V2.1

Rollback returns to the exact current pre-V2.1 state:

- restore original public C portfolio RPC;
- remove V2.1 build rows;
- restore the exact currently installed V2 builder definition;
- keep the V2 fingerprint definition;
- keep the 44-source V1 substrate intact;
- verify empty substrate and CSE-P01.

The restored V2 builder contains the known compatibility defect by design because rollback is an exact-state restoration. It remains private and inert while the public C reader is restored.

No DROP CASCADE.

## Failure boundaries

- builder replacement failure: transaction rolls back;
- build failure: public C reader unchanged; stop; no retry;
- pre-cutover parity failure: public C reader unchanged; stop; no retry;
- public cutover guard failure: cutover rolls back atomically;
- post-cutover proof failure: exact V2.1 rollback only under conditional authorization.

## Explicit non-scope

No changes to:
- governed-period reader;
- Product-gap reader;
- timeout settings;
- RLS/Auth/roles;
- Product/Manage Products;
- client code;
- Track B;
- route authority;
- CSE-P01;
- business/master data.

## Authorization boundary

This contract authorizes no production execution.
A fresh explicit V2.1 production authorization is required after independent exact review.
