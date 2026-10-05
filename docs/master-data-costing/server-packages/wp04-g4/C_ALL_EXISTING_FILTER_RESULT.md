# WP04-G4 — ALL_EXISTING / filter behavior read-only proof

2026-10-05. **PASS AT SOURCE + LIVE-MEMBERSHIP LEVEL.**

## Scope

Bounded read-only proof only. No candidate portfolio RPC, canonical readiness RPC, cohort/helper/business resolver or candidate function was executed. No DDL/DML, V3 replay, performance test, deployment or application occurred.

The purpose was to prove that the frozen C portfolio source preserves the reviewed population and filter contract without relying on a runtime portfolio invocation.

## Live population membership

Current Product/SKU tables returned:

- ALL_EXISTING SKU count: 1793
- OPERATIONAL SKU count: 611
- inactive SKUs: 1156
- sample SKUs: 29
- active sample SKUs under Active Products: 26
- SKUs under non-Active Products: 424
- ALL_EXISTING membership MD5: `e6e0f1b808f8cc2b0af59ff9b4b2a3af`
- OPERATIONAL membership MD5: `eeba4bf20f54589fe5b037173a79ed82`

The operational fingerprint matches the previously frozen C context.

## Frozen source population contract

Mechanical source review confirms:

- accepted population scopes are exactly `OPERATIONAL` and `ALL_EXISTING`;
- `ALL_EXISTING` includes every existing SKU joined to its Product, with no Active/sample exclusion;
- `OPERATIONAL` is exactly Active Product + Active SKU + non-sample SKU;
- population is materialized before any severity/search/dependency/owner/route filtering;
- assessed rows are derived from that full selected population;
- full population statistics are calculated from assessed population `r`, not from the filtered/page subset.

## Filter validation

Mechanical source checks all PASS:

- supported overall severities: READY / REVIEW_REQUIRED / BLOCKER / UNKNOWN;
- filter arrays are one-dimensional, bounded to 32 values and reject null/blank/unsupported values;
- unsupported values raise an error rather than returning an empty-success result;
- UNKNOWN remains a valid unresolved overall/dependency state;
- dependency incidences include only applicable unresolved states using effective-status fallback to raw status;
- NOT_REQUIRED dependencies are excluded from remediation matching;
- shared issues match only BLOCKED/BLOCKER/REVIEW_REQUIRED/UNKNOWN states.

## Filter witness semantics

For dependency/owner/route filters:

- OR semantics apply within each supplied array through `= ANY(...)`;
- AND semantics apply across supplied categories;
- dependency code, owner and route constraints must all be satisfied by the **same incidence row** for that SKU;
- one dependency cannot satisfy the code filter while another unrelated dependency satisfies owner/route.

Overall severity and search are independent SKU-level predicates.

## Search and pagination

Source confirms:

- search is literal case-insensitive Product-name substring;
- exact decimal SKU ID or Product ID also matches;
- search does not inspect monetary/free-text evidence;
- keyset pagination is SKU ID ascending;
- candidate set uses `limit + 1` only to derive `has_more`;
- returned page uses the requested limit;
- `matched_count` is computed before pagination;
- `returned_count` is page count;
- full-population statistics remain independent of search/issue/page filtering.

## Response metadata

The source echoes:

- population scope;
- normalized filters;
- supported filter options;
- matched count;
- returned count;
- keyset boundary / has_more;
- full-population severity and unresolved incidence statistics.

Context validation rejects unexpected/null overall severity rather than silently coercing it.

## Disposition

**ALL_EXISTING / filter behavior: PASS at source + live-membership level.**

This establishes that the frozen C source implements the reviewed membership and filter semantics without redefining lifecycle/readiness authority.

It does not claim a runtime execution of the unapplied portfolio RPC, nor does it prove full-611 final-output parity, native Auth/API behavior, performance, or committed deployment/rollback.
