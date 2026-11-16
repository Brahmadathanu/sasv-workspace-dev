# WP10 — CL15–CL17 verified CI receipt (2026-11-16)

## Provenance
- GitHub Actions [run #33](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43807718078), job `133102194641`: **COMPLETED SUCCESS**.
- Isolated disposable PostgreSQL fixtures and mocked Chromium; not production writer/role acceptance.

## Individual observed results
- **CL15_SETUP PASS** — negative mutation pause trigger installed.
- **CL15 PASS** — parent-lock-omitted negative mutation allowed activation and subgroup move to commit, leaving active SKU on subgroup 3 without the approved route: `activation=0, move=0, sku=true, subgroup=3`. This demonstrates the isolated unsafe schedule and guards against a false-positive safety fixture.
- **CL16 PASS** — two sibling SKU activations completed concurrently without timeout/deadlock in this bounded fixture; `a=0, b=0, active=2`.
- **CL17 PASS** — attempted active SKU reassignment rejected; `activated=0, moved=3, active=true, parent=1`. **Limitation:** the rejection was `Cannot activate SKU for inactive product 2`, so this is NOT proof that reparenting to a second ACTIVE product lacking a route is rejected. Add a separate fixture with active destination and no approved route.
- CL14 PASS independently in completed-success [run #29](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43806533283).

## Decision
All new CL15–CL17 fixtures are green, but WP10 remains OPEN: need active-destination reparent route case, remaining writer lock-order/impact cases, independent review of correction-only SQL and rollback, explicit owner authorization for any production change, and separate production/browser acceptance. No production SQL or flags applied.
