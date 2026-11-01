# C1/C1B cache allocation and merge-order decision — 1 Nov 2026

Jarvis confirmed main hub-cache-v387, no existing WP07/e-Aushadhi reservation, and **v388 next conflict-free for Costing Suite**. E-Aushadhi will take the next free number at its own approved merge after a coordination ping.

## Decided sequence
1. PR #115 first, squash merge only after exact owner approval. Keep COSTING_REVIEW_WORKLIST_V1 OFF; no v388 bump in this first merge.
2. Rebase stacked PR #117 onto main after PR #115 squash, change base to main, verify C1B-only diff.
3. Reserve v388 for PR #117 client release: change public/sw.js and all version-asserting smoke/tests consistently on fresh base, do not omit e-Aushadhi test pins, rerun all unit tests and smoke scripts, and ensure production cache mechanics verified.
4. PR #117 requires separate exact owner approval to merge; no unilateral merges or deployments.
5. Notify Jarvis once v388 lands; WP07/e-Aushadhi chooses the next unallocated version at its own merge with approval.
6. Complete browser acceptance with permitted and denied identities; confirm run-148 groups, frozen-versus-current drawer warning and safe rollback before closing Gate 1.

No repository PR merged or production cache changed by this planning decision. Backend run-scoped read view remains deployed. Programme remains 3/10 accepted gates.
