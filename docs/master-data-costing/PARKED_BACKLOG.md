# Parked Backlog

| ID | Description | Source/context | Intended WP | Why parked | Dependencies | Priority | Status |
|---|---|---|---|---|---|---|---|
| SEC-P01 | Five previously identified RLS-disabled tables require policy analysis before any RLS change: `inv_material_identity`, `inv_material_identity_part`, `inv_material_stock_item_map`, `inv_material_identity_name`, `therapeutic_indication_lexicon_entry`. | Costing/database security hardening carry-forward | Future security hardening gate | Enabling RLS without policy/consumer analysis could break valid access; unrelated to WP01 completeness contract. | Explicit policy/consumer audit | Medium | [P] PARKED |
| UX-P01 | Server-governed regional Marketing evidence acceptance has no current-main client write/remediation surface found. | WP00/WP01 audit | WP04 / WP05–WP07 placement decision | Server authority exists; UI placement must follow readiness/control-centre and IA evidence rather than creating an ad-hoc surface now. | WP04 readiness design + later IA audit | Medium | [P] PARKED |

New ideas arising outside the active gate must be classified immediately. FUTURE DEPENDENCY and PARKED ENHANCEMENT items are recorded here; OUT OF SCOPE items are recorded with a reason when material.
