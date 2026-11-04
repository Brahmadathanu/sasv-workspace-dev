# SASV Master Data & Costing — new-chat execution handover (4 Nov 2026)

> **Status: draft programme handover in PR #165; NOT YET MERGED.** This checkpoint is for continuity, not a change to any Gate Status, policy, production flag, backend, deployment or release. At preparation, verified `main` = `18cee239b3f03ed6d1a60c7fe19d7d885ee3ae35`. Always re-fetch GitHub before acting; the PR head may advance with documentation amendments.

## 1. Authority and working rules

- Owner is final approval authority for any merge, Supabase write/migration, permission/grant change, feature-flag activation, PWA deployment/service-worker cache bump, Electron build/version/release, or formal WP closure.
- ChatGPT is programme orchestrator, independent GitHub reviewer and server-contract analyst; Claude Code is the bounded client/CI implementation worker. For a new ChatGPT project conversation, use this file and live repository evidence as the starting point.
- Default all eleven Costing flags OFF. Do not treat browser-local test flags as production activation. Do not expose monetary or sensitive costing snapshots directly to the browser.
- e-Aushadhi WP07 paused. Leave its PRs, Supabase migration history and audit evidence untouched. Separate Manage Activities #164, Tally PRs and storage retention #137 are not part of this Costing review.
- Maintain per-reply progress indicator, **formal closure versus current delivery milestone**, with one next actionable gate; do not invent an overall implementation percentage.

## 2. Verified programme checkpoint

**Formal closure: 5 / 13 substantive WP00–WP12 work packs (38%).** WP05 and WP06 remain OPEN; MDC-07 and WP12 not formally accepted. This count must not change without recorded owner Gate Status approval.

**Completed recent integration wave: 3 / 3 (100%)**:
- #156 historical guard repair; #153 CSA F-1/F-2; #154 default-policy Chromium; #155 MRP workflow tests;
- #161 F-7 concurrency (superseded #157); #162 F-9 MRP six-modal concurrency (superseded #158);
- #160 WP12 eleven-flag × six-page mock Chromium sweep; #163 F-8 CSS hidden-field correction (superseded #159).
- All above merged. PRs #157/#158/#159 closed unmerged, branches preserved.
- Final #163 merged `main` at `18cee239b3f03ed6d1a60c7fe19d7d885ee3ae35`. Claude's pre-merge combined-tree runs: LF 823/823, CRLF 823/823, Chromium 195/195 with 0 failed/skipped. Do not mislabel this as an independently executed post-merge run.

**Current draft #165**: `docs(costing): 4 Nov progress indicator, WP05/WP06 closure path, CDE-2 owner-review package`, branch `claude/epic-faraday-8qt8fa`. As checked before this handover addition, head `a3679191038dd46c4cc020a60c20cf51a448cbc4`, clean and draft. Three docs newly authored: `PROGRAMME_PROGRESS_AND_CLOSURE_PATH_2026-11-04.md`, `OWNER_ACCEPTANCE_RECORD_2026-11-04.md`, `CDE2_OWNER_REVIEW_PACKAGE_2026-11-04.md`, plus four top-of-file links in MASTER_PROGRAMME / WP05 / WP06 / WP12. Reviewer then amended the three new docs to require build provenance and proper gate deferrals. The original Claude LF 823/823 was on a prior docs head; Netlify preview green on amended head, but exact amended-head LF/CRLF not independently rerun. This handover file adds only docs.

## 3. What should happen next — immediate work

**First 15-minute target:** Read `main`, #165 head/diff/review comments, then the three #165 documents and this handover. Check for new PRs and current checks. Do not redo historical source audits.

**Gate A — Finish docs package:** Run markdown/link/relative-path sanity checks and a full-history LF test on latest #165 head; CRLF optional only if justified as documentation-only, explicitly label what was not executed. Ensure total PR scope stays documentation-only. Report exact new head, status and evidence. Recommend owner-controlled squash merge of #165, but do not merge until owner explicitly approves.

**Gate B — Build-provenance-aware owner acceptance:** The new changes exist on GitHub `main`, *not automatically on deployed assets*. Published Electron is v6.1.0 and PWA cache v390 (historical checkpoint). A signed-in test on those older clients must not certify the new work. Propose a separately owner-authorised isolated test/preview client matching source SHA and digest; real view-only role; no live approval/lock/recalculate/save/accept. Record source SHA, served bundle/build/cache identity, role, test environment, outcome and flag cleanup. Mark NOT TESTED rather than PASS where unavailable. No deployment or flag activation is implied by proposing this plan.

**Gate C — Formal WP05/WP06 closure only after owner record:** Walk all six Costing modules, ten PPM workspaces and eleven individual flags OFF/ON, plus all-OFF/all-ON smoke. Reconcile C1–C3, C5/D5 runs 80/82 server selector (still unresolved), C6/O-8 unmapped workbench destinations, C9 period metadata, D3 CCC/MCM rights, S2 printable Cost Sheet parity, S9 KPI requery measurement; WP06 D7 maker-checker and F-4 numeric units. Each item requires evidence or explicit deferral **with residual risk, owner decision and future gate**. The owner alone marks WP05/WP06 closed; no automatic closure based on merged code.

**Gate D — CDE-2 design review, not implementation yet:** Read `CDE2_OWNER_REVIEW_PACKAGE_2026-11-04.md`; protected non-monetary, per-period/run/SKU CCC-view-only RPC is a *proposal*. Five owner decisions CDE2-D1–D5. Need server-side live schema/permissions/key/read/immutability and draft-run eligibility verification before SQL. The merged CDE-1a UI has a null production provider and should show UNKNOWN/unavailable. CDE-1b provider, CDE-3 approval workflow and SQL migrations all separate owner gates.

## 4. Open decision register (do not choose implicitly)

- O-1 / CDE2-D1–D5: protected read design, approved-run treatment, draft/open-period eligibility, refreshed timestamp, audit/rate limitation.
- O-5: D3 review rights, D5 historic run 80/82 selector, D7 maker-checker, C9 period scope; F-4 integer/decimal unit contract.
- O-7: whether IA09 hub search/collapse is behind a **new default-OFF flag** (recommended), directly enabled, or declined. Do not implement a choice before authorisation.
- O-8: `COST_REVIEW_WORKBENCH` and `COST_APPROVAL_WORKBENCH` target route or explicitly none.
- O-2: read-only per-client registry export for WP08 navigation; **36 PWA + 79 Electron** entries, not 115 in one hub.
- Work-pack Gate Status sign-offs and non-production test-client provenance authorisation.

## 5. Other open draft PRs and consolidation

Docs-only drafts #141 (unique dated run audit), #142 (superseded plan), #143 (overlapping audit), #145 (WP12 matrix; correct nine → eleven flags), #147 (CDE-1a historical design), #148 (older CDE-2 proposal; reconcile with #165), #150 (trim unexecuted WP08/WP09 briefs; use 36/79 counts), older #114/#116/#119 (review before closing). None should merge or close without owner decision. #137 storage-retention audit parked; WP07 #59/#118/#122 paused; #164 separate Manage Activities; Tally #92–#94/#97 separate.

## 6. Quality and next-chat output contract

Start new chat by reading this handover and live repo; provide a short **verified checkpoint** (exact main/PR heads), a two-line progress indicator (5/13 formal, 3/3 integration), and the single next bounded task with owner gates. Then **execute** safe read-only checks and draft-branch docs/work, rather than asking the user to restate past requirements. Never claim an old test run applies to a newer head, or treat Netlify preview as full regression.

Related docs in this directory: `MASTER_PROGRAMME.md`, `PROGRAMME_PROGRESS_AND_CLOSURE_PATH_2026-11-04.md`, `OWNER_ACCEPTANCE_RECORD_2026-11-04.md`, `CDE2_OWNER_REVIEW_PACKAGE_2026-11-04.md`, `WP05_CL1_CLOSURE_EVIDENCE_2026-11-04.md`, `COSTING_SUITE_COMPLETION_TO_RELEASE_2026-11-03.md`.
