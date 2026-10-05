# WP04-G4 — CSE compatibility read-only reassessment

2026-10-05. **PASS — C does not change commercial-sales row authority.**

## Scope

This was a bounded read-only source/catalog compatibility check only. It did not execute the commercial-sales resolver, canonical readiness, portfolio reader, V3, or any candidate function. It performed no DDL or DML.

The purpose was to answer one remaining G4 question: whether the frozen C package changes, batches, reorders, bypasses, or otherwise invents a new selection rule for commercial-sales evidence while CSE-P01 remains unresolved.

## Fresh evidence

Live catalog identities:

- `costing.fn_resolve_sku_commercial_sales_basis_point(bigint,date,date)` MD5 = `68bd9325062299eb8af1291bf4d9393b`
- `costing.v_sku_commercial_sales_basis` view MD5 = `1327ae5236481295aff6aa27d311f440`

Both match the frozen C guards.

Mechanical frozen-source comparison:

- current canonical definition contains exactly:
  `select * into v_sales from costing.fn_resolve_sku_commercial_sales_basis_point(p_sku_id, v_period, v_val) limit 1;`
- frozen C private live core contains the same exact call;
- candidate private core contains exactly one commercial point-helper invocation;
- candidate private core contains no direct `FROM costing.v_sku_commercial_sales_basis`;
- candidate private core contains no alternate ORDER BY or replacement row-selection clause around the commercial helper;
- the only direct view-name occurrence in the private core is the existing evidence authority label, not a query source;
- frozen C forward guards bind both the helper and underlying view identities.

## Disposition

**CSE compatibility proof: PASS at source/catalog level.**

The C package preserves the pre-existing commercial-sales selection authority and semantics. It does not batch commercial evidence, choose among multiple candidate rows, or introduce a new commercial row authority.

This does **not** resolve or waive CSE-P01. Any ambiguity/multiple-row business-authority issue remains exactly as it existed before C and stays parked. No performance benefit is claimed from this result.

No production mutation, substantial read load, portfolio/performance test, full C application, deployment, G5 or client work occurred.
