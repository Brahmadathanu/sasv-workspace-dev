# WP04-G4 — Full-611 compositional final-output parity reassessment

2026-10-05. **READ-ONLY REASSESSMENT PASS — COMPOSITIONAL PROOF PATH IDENTIFIED.**

## Why the consumed runtime proof timed out

The consumed one-attempt package compared two full LIVE cores over 611 SKUs. Both arms independently executed unchanged base-readiness logic, including the existing commercial-sales point resolver.

The attempt timed out at the unchanged 15-second statement timeout inside:

`fn_resolve_sales_allocation_default_policy_as_of`
→ `fn_resolve_sku_commercial_sales_basis_point`
→ original proof core.

This was not a semantic mismatch. It showed that duplicating the unchanged base evaluator is too expensive for the bounded proof window.

It is also a weak oracle for C-specific parity because CSE-P01 remains parked: the existing commercial helper consumes an unordered `LIMIT 1` from multirow candidate sets. Re-evaluating that unchanged helper in two separate arms can produce observational differences unrelated to the C snapshot-cohort change. WP04 must not resolve that ambiguity by inventing an order/filter.

## Proof target

C changes only how governed run-backed allocation evidence is obtained and supplied to readiness enrichment. It does **not** change the canonical master/BOM/route/MRP/selling/commercial/control composition rules.

Therefore the correct full-population proof can be decomposed:

1. prove C selects the same changed run-evidence inputs for all 611 operational SKUs;
2. prove those inputs produce the same evidence JSON;
3. prove old and C enrichment apply the same transformation to equal base/evidence/shared inputs;
4. prove the common LIVE base composition is the same canonical LIVE composition except for the already-reviewed route prefetch substitution;
5. preserve the unchanged commercial resolver call rather than evaluating it twice as a parity oracle.

## Existing closed evidence reused — not rerun

### C-R01

PASS over all 611 operational SKUs × six snapshot sources:

- 3666 comparisons;
- 0 mismatches;
- 0 type mismatches;
- 0 multiplicity failures.

This establishes equality of the six changed snapshot-row selections, including presence/null/type/context/multiplicity.

### C-R02

PASS for the typed-row projection boundary:

- all six snapshot types;
- seven drivers;
- absent and present-null cases;
- complete JSON projection.

This establishes that equal selected snapshot rows map to the same driver-evidence JSON under the assembler.

These proofs remain closed and were not rerun.

## Fresh repository-only mechanical equivalence checks

Using the frozen C source and captured/live-bound original definitions:

### 1. Scheme evidence query

Original run-evidence `scheme` CTE and C assembler `scheme` CTE normalize to identical source text.

**Result: exact source equivalence.**

### 2. Regional Marketing evidence query

Original run-evidence `regional` CTE and C assembler `regional` CTE normalize to identical source text.

**Result: exact source equivalence.**

### 3. Run-evidence JSON composition

The original run-evidence JSON construction tail and C assembler JSON construction tail normalize identically.

**Result: exact source equivalence.**

Together with C-R01/C-R02, this proves the C cohort envelope's `evidence` value is the same governed evidence JSON that the original point helper would construct for each of the 611 bound members, without executing the point helper 611 more times.

### 4. Enrichment transformation

After removing only:

- original evidence acquisition via `fn_product_sku_readiness_run_evidence`;
- original shared-issues acquisition via `fn_product_sku_readiness_shared_issues`;
- C envelope validation/acquisition of those already-supplied equal values;

the enrichment transformation from `deps:=...` through returned JSON is mechanically identical.

**Result: exact source equivalence.**

Thus, for equal base JSON, equal run-evidence JSON and equal shared issues, original enrich and C enrich return equal complete JSON.

### 5. Canonical LIVE base composition

The canonical LIVE_AS_OF base-composition segment and C common LIVE-core base-composition segment normalize identically after one explicit substitution:

- canonical: obtains the Product route row by evaluating `fn_product_process_route_readiness(v_val)` and filtering the SKU's Product;
- C: consumes the corresponding prefetched row from the route map.

All other LIVE base reads and status/JSON construction—including BOM, MRP, selling policy, commercial point resolver, batch reference, control snapshot and summary/dependency composition—are textually identical.

The base JSON tail from `v_out:=...` through `v_base:=jsonb_build_object(...)` is exactly identical.

**Result: exact source equivalence apart from the reviewed route-row delivery mechanism.**

The C portfolio source builds that route map from the same `fn_product_process_route_readiness(v_val)` output and has an explicit count-vs-distinct-Product guard; it does not invent route evidence. The consumed proof progressed beyond this guard before timing out, so no route-uniqueness failure occurred in that authorized observation.

### 6. Shared issues

Original enrichment invokes the same unchanged shared-issues helper with valuation date. C evaluates that unchanged STABLE helper once for the response and supplies its result to each C enrichment.

No alternative shared-issue authority or rule is introduced.

## Commercial ambiguity and why it must not be part of the changed-layer parity oracle

The canonical and C LIVE base source both contain the exact same call:

`costing.fn_resolve_sku_commercial_sales_basis_point(p_sku_id, v_period, v_val) limit 1`

CSE compatibility is already PASS: C introduces no direct commercial view query, ordering, batching or source-selection rule.

Because CSE-P01 is a pre-existing unordered-source ambiguity, calling the unchanged resolver twice and requiring identical observed rows is not a valid way to prove whether C changed semantics. Resolving that ambiguity would require a separate authority decision and is explicitly parked.

The compositional proof therefore preserves commercial authority by proving the commercial call site is unchanged rather than silently ordering/filtering it.

## Formal implication for the 611-member bound population

For each of the 611 operational SKUs under the frozen September 2026 / valuation 2026-09-10 / SUCCESS115 context:

- changed six-source selections are equal by C-R01;
- typed projection of those equal rows is equal by C-R02;
- scheme/regional evidence construction is source-identical;
- full run-evidence JSON composition is source-identical;
- enrichment transformation is source-identical once supplied those equal values;
- canonical LIVE base composition is source-identical to C common LIVE composition apart from same-authority route prefetch;
- commercial/MRP/selling/BOM/batch/control authorities and call semantics are unchanged.

Therefore any final-output difference attributable to the C snapshot-cohort refactor is excluded by composition. A black-box two-arm rerun of unchanged nondeterministic authorities is not required to establish C-induced semantic preservation and may generate false disagreement unrelated to C.

## Disposition

**Recommended proof disposition: replace the unresolved "611 duplicated-runtime black-box parity" obligation with a formally reviewed "611 compositional semantic final-output parity" certificate, without weakening canonical authority, changing timeout, or resolving CSE-P01.**

This read-only reassessment itself does not deploy C, benchmark performance, invoke the portfolio RPC, test native Auth/API behavior, or authorize application.

The consumed runtime attempt remains exactly:

- authorization consumed;
- SQLSTATE 57014 at unchanged 15-second timeout;
- no semantic mismatch established;
- independent restoration readback PASS;
- no retry authorized.

No rerun of that package is recommended.
