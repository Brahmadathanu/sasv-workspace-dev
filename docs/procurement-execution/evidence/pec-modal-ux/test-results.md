# Client PR A test results (offline, synthetic fixtures)

## Unmodified main (clean worktree of origin/main 0b4ebbc)
- pec-erp-c1-layout-smoke exit=1
- pec-erp-c1-static-smoke exit=1
- pec-erp-c2-vendor-selection-smoke exit=0
- pec-r2-ui-smoke exit=0
- pec-r2b-ui-smoke exit=0
- pec-r2c-ui-smoke exit=0
- pec-wp01-indent-serial-smoke exit=0
- pec-c1-five-lens-fasttrack-smoke exit=0
- pec-paging-contract-smoke exit=0
- pec-resync-mode-contract-smoke exit=0
- pec-r12-resync-collision-ux-smoke exit=0
- pec-vwl-search-reliability-smoke exit=0
- pec-plm-pm-canonical-smoke exit=0
- pec-pwa-cache-freshness.test exit=0
- pec-protected-path-guard.test exit=0
- pec-vwl-offset-export-integrity.test exit=0
- pec-operator-probe-contract.test exit=0
- DONE

## This branch
- pec-erp-c1-layout-smoke exit=1
- pec-erp-c1-static-smoke exit=1
- pec-erp-c2-vendor-selection-smoke exit=0
- pec-r2-ui-smoke exit=0
- pec-r2b-ui-smoke exit=0
- pec-r2c-ui-smoke exit=0
- pec-wp01-indent-serial-smoke exit=0
- pec-c1-five-lens-fasttrack-smoke exit=0
- pec-paging-contract-smoke exit=0
- pec-resync-mode-contract-smoke exit=0
- pec-r12-resync-collision-ux-smoke exit=0
- pec-vwl-search-reliability-smoke exit=0
- pec-plm-pm-canonical-smoke exit=0
- pec-modal-stack-smoke exit=0
- pec-pwa-cache-freshness.test exit=0
- pec-protected-path-guard.test exit=0
- pec-vwl-offset-export-integrity.test exit=0
- pec-operator-probe-contract.test exit=0
- DONE

Pre-existing on main: pec-erp-c1-layout-smoke 4 checkbox-geometry checks (S4 UX / #500 reconcile, wide+mobile) and pec-erp-c1-static-smoke protected-path check (committed migration paths vs. fetched base). Failure lists are identical on main and on this branch; layout smoke passes 418 checks in both.

## pec-modal-stack-smoke against unmodified main (defect reproduction): 8 checks FAIL
- FAIL: all 870 ordered dialog pairs: later-opened dialog is visually on top and is the only one Escape closes (eAuditModalBackdrop>vwlSplitReviewModalBackdrop:false/eAuditModalBackdrop/ | eAuditModalBa
- FAIL: closed dialogs carry no inline z-index
- FAIL: held Escape (auto-repeat) dismisses exactly one layer
- FAIL: protected top dialog consumes Escape; nothing underneath closes
- FAIL: dynamic dialog joins the stack with an assigned z-index (0)
- FAIL: Escape dismisses the dynamic dialog only
- FAIL: Escape during IME composition is ignored
- FAIL: dialog above takes Escape first; lower drawer and indent modal untouched ({"drawer":false,"action":true,"indent":true})

## Review hardening re-run (branch after hardening)
All suites re-run: identical failure lists to unmodified main (layout smoke 418 ok, 4 pre-existing checkbox failures; static smoke protected-path check); `pec-modal-stack-smoke` PASS with the added same-turn order, hidden-focus, in-flight delete and drawer/menu stacking checks.
