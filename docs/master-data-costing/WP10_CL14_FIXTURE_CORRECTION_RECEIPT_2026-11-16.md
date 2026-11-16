# WP10 — CL14 fixture correction and verification tracking (2026-11-16)

- Initial CL14 in [run #28](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43806131080) **FAIL**: fixture created second SKU with `NEWSKU(2,56)`, binding it to product 2, whereas the test expected two SKUs under product 1. Observed first activation success, inactivation refusal, second activation failure, one active sibling.
- Corrected to `NEWSKU(1,56)` in commit `c3ae21e1835e40e4b7f23a7742258248fc5a7d78`; no application SQL changed.
- [Run #29](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43806533283): isolated PostgreSQL fixtures/mutation-controls step **SUCCESS**; full workflow **IN PROGRESS** at time of capture (mocked Chromium running). CL14 individual log receipt to be captured after job completes.
- Previous CL12/CL13 individual receipts in `WP10_CL12_CL13_CI_RECEIPT_2026-11-16.md` remain valid.
- WP10 remains OPEN; no production SQL, deploy or flag changes.
