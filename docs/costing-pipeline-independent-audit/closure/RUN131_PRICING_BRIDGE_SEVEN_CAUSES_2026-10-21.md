# Run 131 — pricing bridge regional root causes (21 Oct 2026)

Read-only live Supabase inspection; no refresh, source writes, acceptance, pricing release or Sheets integration.

627 pricing-bridge SKU snapshots: 15 READY and 612 REVIEW_REQUIRED. All 627 have mrp_resolution_status RESOLVED. 555 of 612 reviewed have allocation_resolution_status READY, 57 REVIEW_REQUIRED. 605 reviewed SKUs have internal_loaded_cost_status REVIEW_REQUIRED, leaving exactly seven pricing bridge review SKUs whose internal_loaded_cost_status is READY.

Seven independent pricing-review SKUs:
489 Peenasakesari 5000 mL — OK REVIEW (actual signed billed sales monetary numerator paired with governed assumed/default or scaled regional physical allocation basis).
491 Siromukhi 100 mL — IK and OK REVIEW (actual signed billed value with assumed/default/scaled basis).
867 Sudhi Avanakkenna 100 mL — OK REVIEW (GOVERNED_REGIONAL_DEFAULT where higher-priority usable commercial evidence is absent or net signed actual billed value nonpositive).
935 Vallarai Tablet 20 Nos — IK and OK REVIEW (actual monetary + assumed/default/scaled physical basis).
1149 Hridayasudhi 200 mL — IK and OK REVIEW (actual monetary + assumed/default/scaled physical basis).
1229 Amukkura Lehyam 100 g — IK and OK REVIEW (actual monetary + assumed/default/scaled physical basis).
1783 Arkkadi Thailam 450 mL — IK REVIEW (GOVERNED_REGIONAL_DEFAULT).

Each has resolved MRP and computable regional marketing cost, but review flags are substantive evidence-quality issues rather than missing costing arithmetic. Do not blanket-clear. Corrected canonical acceptance and internal source resolvers are already live, but historical run131 snapshots remain frozen. Next governed run to verify actual reviewed status counts only after remaining cost reconciliation and gate review. G6 remains open.
