# Run 131 — internal overhead conservation (21 October 2026)

Read-only reconciliation of frozen run 131. No refresh, approval, pricing or Sheets changes.

Production overhead: pool INR 670935.04, saleable-SKU allocation INR 670863.07090838, internally consumed amount INR 71.96909162.
Quality-control overhead: pool INR 142241.67, saleable-SKU allocation INR 142205.79160127, internally consumed amount INR 35.87839873.
Materials/stores overhead: pool INR 260508.53, saleable-SKU allocation INR 260508.24668029, internal-product allocation INR 0.28331971.
Combined INR 108.13081006 residual is entirely attributed to internal-source products 260, 275, 277, 278 and 824. Internal demand computed recursively from costing.fn_internal_source_product_demand_as_of(2026-10-01,2026-10-20,131). The earlier manufacturing-labour amount INR 85.89408667 is likewise fully accounted for via direct and nested internal consumption. No balancing plug or allocation denominator repair indicated.

These checks cover the specified pools, not an assertion that every downstream ledger-to-SKU financial gate is closed. G2 attestation and G6 remain outstanding; run 131 remains SUCCESS and UNAPPROVED.
