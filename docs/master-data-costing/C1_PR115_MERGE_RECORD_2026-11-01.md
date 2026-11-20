# C1 PR #115 — Owner-approved squash merge (1 November 2026)

Owner explicitly approved: `Approved: squash-merge PR #115 into main.`

GitHub accepted the squash merge with expected PR head fb7e863b82eb571dd60cabdb335d237d859986f5. Result main commit 31d55c852f0f9f178766204ecb510e8e80759f82 (independently verified from branch main). PR #115 is merged. This merges the C1 run-context client foundation with its corrected status-fetch-error message. No service-worker cache bump and no feature flag enable was requested by this approval.

Dependent draft PR #117 remains open with head 7a8f9294ad0287ff7ce5d8b393725a14206cfb06 and base feat/costing-c1-run-context-diagnostics. Claude must rebase the C1B-only changes on new main after the squash, retarget the PR base to main, apply coordinated hub-cache-v388 pins, and rerun tests/smokes. The owner must separately approve #117 before merge. Jarvis confirmed v388 is free for Costing and e-Aushadhi will use the next free version when it merges.

Gate 1 browser acceptance remains pending. Historical draft per-line drawer evidence cannot be claimed as run-148 evidence, and 111/114 exception fix links are still unmapped. Programme: 3/10 acceptance gates passed.
