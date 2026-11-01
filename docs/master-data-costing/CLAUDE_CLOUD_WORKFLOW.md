# Client coding workflow: Claude Code cloud packages (from 1 Nov 2026)

All client-end (screen) coding for the costing suite is now done by Claude Code cloud sessions, in **bulk packages**. Server/database work is not part of this workflow; it stays under separate owner approval.

## Roles
- **Owner** (Dr. Brahmadathan U): decides, relays briefs and results, gives the exact merge sentence.
- **Aryabhatta** (planning assistant): writes briefs, audits PRs, keeps the decision log, merges only after the owner's exact sentence (`Approved: squash-merge PR #N into main.`).
- **Claude Code cloud session**: implements one package per brief, opens one draft PR, stops.
- **ChatGPT**: independent reviewer of docs, workflow and risks.
- **Jarvis** (e-Aushadhi assistant): told first about any cache bump, because e-Aushadhi smoke tests pin the cache name.
- Codex was used earlier for some packages; no longer the default.

## Steps per package
1. Aryabhatta writes one self-contained brief: base SHA, branch name, next cache number, flag, scope IN / OUT with file and line ranges, baselines (unit count, smoke result), full cache-pin list, protected files, stop rules.
2. Owner pastes it into a Claude cloud session. The session works in a fresh worktree, opens **one draft PR**, reports SHA, tests, deviations, and stops.
3. Aryabhatta tells Jarvis about the cache bump and waits for his OK.
4. Aryabhatta audits (scope vs brief, diff, tests, smokes, flag-off identity) and writes an audit report.
5. Owner sends the exact merge sentence. Aryabhatta squash-merges with the audited head SHA, verifies main, tells Jarvis the new SHA, logs it.

## Why bulk packages
Fewer paste round trips and fewer re-reads of the same files, so fewer tokens/credits per change. One brief carries scope, baselines and pins, so the session does not need to ask questions; the audit compares against one written scope.

## Standing hard rules (every brief)
- No production writes or migrations without the owner's exact approval; packages are client-only.
- Never touch, stage, reset or re-apply migration `20261015045233`.
- New behaviour behind a flag, default off (exact value `1`). Lock flag not switched on for open months before CI-049.
- Never call the approval-preview RPC against production.
- Protected files and e-Aushadhi code: version-string pin changes only.
- Draft PR only; the session never merges.

Examples: PRs #108, #110, #111, #112 (1 Nov 2026).
