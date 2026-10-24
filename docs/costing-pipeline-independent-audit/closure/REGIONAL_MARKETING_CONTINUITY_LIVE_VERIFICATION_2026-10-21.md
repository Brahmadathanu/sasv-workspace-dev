# Regional Marketing evidence-continuity deployment — 21 October 2026

User endorsed automatic continuity only if approved regional assumption, selected source classes, quantities and billed-sales evidence remain unchanged, while the allocated marketing cost may change from independently computed pool cost.

Prepared SQL: `closure/prepared/PREPARED_20261021_REGIONAL_EVIDENCE_CONTINUITY.sql`, commit `a0c3b65bd9e0328c66fff8506710b150ebdd4e2d`. Supabase `apply_migration` name `costing_regional_evidence_continuity_20261021` returned success. Only `costing.fn_regional_marketing_review_status(bigint)` changed; no table, allocation denominator, pool, price or snapshot arithmetic was modified.

Existing strict same-date + fingerprint acceptance still works. Cross-date approval reuse is now allowed only within the same cost period for ACTIVE prior acceptances, matching SKU, product, region, basis source, monetary value source, governed regional assumption/default IDs/scenario, resolved regional units/base quantity, and resolved product-region billed-sales value. Fingerprint cost component may differ due to pool recalculation. Later or changed evidence does not match; original raw REVIEW_REQUIRED status and estimated source labels remain unchanged. Review helper maps approved effective status to READY only.

Read-only live check against frozen run134 (200 raw regional REVIEW_REQUIRED rows): 117 effective READY via unchanged prior approval, **83 remain REVIEW_REQUIRED** due to changed quantity/input evidence. Before migration all 200 were effective REVIEW_REQUIRED. No new approvals were fabricated, no historical snapshot mutated and no costing refresh was requested.

Outstanding before final run: investigate 83 regional changed-evidence cases, verify downstream pricing bridge consumes effective (rather than raw) marketing review status, and perform needed permission/concurrency/negative regressions before G6 signoff. Material fresh calculation already 627 READY from separate valid-purchase age advisory. G2 prospective route attestation held; G6 and Sheets blocked.
