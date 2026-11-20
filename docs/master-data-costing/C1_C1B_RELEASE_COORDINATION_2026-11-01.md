# C1/C1B release coordination — 1 Nov 2026

Status: PREPARED, not merged, feature OFF by default.

## Verified PR topology
- main: 5c5b7ba4b6370cece85796afd26423342c36eaf5.
- PR #115: draft, head fb7e863b82eb571dd60cabdb335d237d859986f5, base main.
- PR #117: draft, head 7a8f9294ad0287ff7ce5d8b393725a14206cfb06, base #115 branch.
- Backend diagnostic view is live. Run 148: 514 ready, 113 review, 1 blocked. Approved run remains 143.

## Jarvis cache reservation
Main remains hub-cache-v387. Do not assume v388 free; Jarvis WP07 branch may reserve it. Confirm version allocation and competing cache work before changing any files.
Message for Jarvis: Please confirm the next unallocated hub-cache version for SASV main and any pending WP07/e-Aushadhi cache changes. Costing review client PRs #115 and #117 are audited drafts, still unmerged. Has v388 been reserved? Please propose a nonconflicting next version, without merging or deploying.
Pin locations enumerated in PR #117: public/sw.js, costing approval, costing dialogs, costing review worklist, costing table tools, pricing dashboard smoke, WP04 smoke, PEC smokes, and e-Aushadhi smokes. Re-run git grep on fresh main for complete list and update every pin consistently.

## Controlled merge/release sequence
1. Coordinate cache version with Jarvis; keep flag off.
2. Obtain owner explicit exact approval to squash-merge PR #115 into main; do not merge otherwise.
3. Once #115 is merged, rebase stacked #117 on updated main and retarget main; verify resulting PR diff includes only C1B. Rerun test suites.
4. Obtain separate owner exact approval to merge #117; do not merge otherwise.
5. Apply allocated cache version and coordinated production client release with owner authority, not by assumption.
6. Controlled browser walkthrough: permitted and denied identities, October run 143 versus 148, 628 rows, 114 exceptions, return to default, period switch, fix navigation and drawer warning. Feature can be disabled using localStorage removal and reload.

## Known limitation
Draft drawer per-line evidence remains tied to governed run. COST_REVIEW_WORKBENCH fix link unmapped for 111 of 114 exceptions. Do not claim root-cause review completed.

## Governance
Do not enable costing lock, approve draft 148, alter approved pricing basis, merge PRs, or deploy on this preparation alone. PR #116 holds production server evidence. Overall programme remains 3/10 acceptance gates.