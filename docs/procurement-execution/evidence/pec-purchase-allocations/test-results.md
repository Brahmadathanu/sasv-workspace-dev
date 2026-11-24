# Client PR B test results (offline; synthetic contract-shaped fixtures)

## Branch (full PEC suite, same runner as the PR A comparison)
- pec-erp-c1-layout-smoke exit=1
- pec-erp-c1-static-smoke exit=1
- pec-erp-c2-vendor-selection-smoke exit=0
- pec-r2-ui-smoke exit=1
- pec-r2b-ui-smoke exit=0
- pec-r2c-ui-smoke exit=0
- pec-wp01-indent-serial-smoke exit=0
- pec-c1-five-lens-fasttrack-smoke exit=1
- pec-paging-contract-smoke exit=0
- pec-resync-mode-contract-smoke exit=0
- pec-r12-resync-collision-ux-smoke exit=0
- pec-vwl-search-reliability-smoke exit=0
- pec-plm-pm-canonical-smoke exit=0
- pec-modal-stack-smoke exit=0
- pec-purchase-allocations-ui-smoke exit=0
- pec-pwa-cache-freshness.test exit=0
- pec-protected-path-guard.test exit=0
- pec-vwl-offset-export-integrity.test exit=0
- pec-operator-probe-contract.test exit=0
- DONE

Reruns after updating two pinned-lens assertions (see PR): pec-r2-ui-smoke exit 0, pec-c1-five-lens-fasttrack-smoke exit 0.

Failure lists of pec-erp-c1-layout-smoke (4 checkbox checks, 418 ok) and pec-erp-c1-static-smoke (protected-path check) are identical to unmodified main (pre-existing).
Unit tests: node --test scripts/pec-purchase-allocations-model.test.mjs -> 22 pass.
UI: node scripts/pec-purchase-allocations-ui-smoke.mjs -> PASS.
Lint: ESLint 9 with repository config; the new/changed lens, stack and script files are clean; the 16 pre-existing errors in procurement-execution-console.js are unchanged.
