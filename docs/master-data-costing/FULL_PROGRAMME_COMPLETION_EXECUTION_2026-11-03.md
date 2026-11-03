> **Integration reconciliation (3 Nov 2026, after U11 merge):** U11 PR #144 squash-merged to `main` `cf26ae5ed6c69b9e5f52e195f033cfb94e2e781b` (pre-merge final LF 610/610 and CRLF 610/610, 0 skipped; Chromium executed). The nine Costing flags remain default OFF. Subsequent client/server evidence design is now controlled by [CLIENT_DRAFT_RUN_EVIDENCE_IMPLEMENTATION_GATE_2026-11-03.md](CLIENT_DRAFT_RUN_EVIDENCE_IMPLEMENTATION_GATE_2026-11-03.md). Supporting, not-yet-merged historical audit PRs: #141 (live Supabase), #143 (Claude baseline/client), #145 (WP05–WP12 mapping). This branch’s original base SHA `4bbadf8` remains a historical provenance marker, not the current `main`. No work-pack closure or release was triggered by U11 integration.

# Master Data & Costing Suite — Full Programme Completion Before Electron Release
**Execution plan and Claude Cloud handover — 3 November 2026**

> **Owner direction:** Do **not** use navigation-wave completion or a reduced “Costing-only release subset” as a substitute for full workflow delivery. Finish the agreed master-data/Costing Suite programme, **WP00–WP12**, including the remaining WP05–WP12 scope and appropriately governed client-end costing reviews/approvals, then assess a new Electron release. The user is away from their Windows PC; exploit Claude Code Cloud for read-only research, scoped feature engineering, mock-browser tests, LF/CRLF regression and draft PR preparation. Preserve human/role-based signed-in approvals and Windows-native installer testing as explicit later gates. Quality and completeness over an artificial overnight deadline.

## Authority and execution invariants

- Git `main` after docs PR #140: `4bbadf8802b1f7a6df02d207b1a8e3cca117ca09`.
- Complete: prerequisite WP-1 and substantive WP00–WP04 (formal 5/13). Advanced but formally **OPEN**: WP05, WP06, MDC-07. Unstarted/remaining: WP08, WP09, WP10, WP11, WP12.
- Delivered to main: WP05-P01 #132 and P02 #131; N1 #133, N2 #136, N3 #134, N4 #135, W6 #139, guard repair #138. Final tested branch and merged `main` matched exactly; LF/CRLF 605/605 each, Chromium 61 each, zero skipped. **All new feature flags remain OFF.**
- Supabase project `qhmoqtxpeasamtlxaoak`: live verified 3 Nov: October OPEN, approved run 143 for pricing, newer draft 148 not approved; 148 counts **514 READY / 113 REVIEW / 1 BLOCKED** (110 prime cost, 2 material, 1 pricing bridge). November OPEN, draft 149 not approved, 121 / 506 / 1. Both blocked run snapshots name SKU 105 Kolakulathadi Choornam 1000 g with missing required PM rate as-of that run. A successful refresh is not an approved run. See draft CS-R3 PR #141; it is **independent evidence, not merged**.
- **Existing intended resolution of costing reviews/approvals is through the governed Costing client:** investigate causes, ensure the correct queue/action/detail, fix client defects and run mock tests; human authorised reviewers inspect, accept/reject/approve using *existing* server-governed workflows and actual evidence. Do **not** execute SQL updates or blanket server corrections to clear 110 prime-cost reviews. Do not treat a snapshot blocker as proof of a current master issue.
- Every code package: isolated branch, minimal scope, explicit acceptance tests, no surprise ownership conflict, draft PR, independent audit and **owner-specific approval before every merge**. No Claude merge, no forced pushes over unrelated branches, no release/version/tag, no deployment, no cache bump, no Supabase write, no feature ON. E-Aushadhi WP-07 stays paused; PR #122 migrations untouched; PR #137 retention remains parked; C9 and Tier-2 merges require separate governance.
- A full cloud build cannot prove a Windows installer in the absence of a Windows runner. Cloud can do most tests and collect evidence. Human/Windows and signed-in roles are **not waived** by the overnight goal.

## Single closure inventory — no shorthand percentages

| Programme work pack | What actually completes it | Current state | Proposed next package |
|---|---|---|---|
| WP00–WP04 | Existing completion evidence stands unless regression appears | **DONE (5)** | Retest WP01–WP04 contracts in WP12 |
| WP05 Costing Suite rationalisation | Reconcile A1–A7, Tier-1 delivered features, outstanding defects/decisions, verify six modules and actual client user journeys; disposition Tier-2 explicitly | OPEN, substantial implementation merged | G05 closure gap and user-journey review |
| WP06 Pricing Policy Manager | W6 already merged; finish original task-based simplification objectives, governance/legacy link/period scope assessment; resolve/disposition C9, proposal flow, no premature maker-checker change | OPEN | G06 task-flow audit, bounded client corrections |
| MDC-07 Costing navigation | All N-packs and W6 merged; review permissions/deep links/context, U11 terminology, signed-in ON/OFF UX, old 32 lens IDs/10 workspaces | OPEN | N-final integration and U11 |
| WP08 Master-data navigation | Audit Product/SKU/BOM/route/policy hierarchy, launcher paths, NAV-P01/NAV-P02, implement accepted coherent navigation without breaking permissions/deep links | NOT STARTED | IA08 audit and owner-approved change package |
| WP09 Wider application launcher | Inventory app hub/sections including existing non-Costing modules; dependency/role evidence; implement accepted rationalisation, preserve e-Aushadhi freeze | NOT STARTED | IA09 audit, then bounded package |
| WP10 Prevent future incomplete SKUs | Verify live activation/completeness contract and existing WP03/04 safeguards; decide when warning vs blocking is valid; implement authorised server/client protections, test review/fail-closed paths | NOT STARTED | GOV10 policy-design gate FIRST |
| WP11 UX consistency | Cover labels/status glossary (U11), sort/dialog/readability/response width, Manage Products UX-P02 and remaining Costing visual issues; implement and test | NOT STARTED | UX11 inventory + U11 scoped PR |
| WP12 Integration, live proof, docs | Full LF/CRLF Node/Chromium tests without skip; classify legacy smokes, 32-lens/10-workspace navigation and roles; signed-in populated-data and governed decision workflows; production checks, final documents | NOT STARTED | QA12 test matrix NOW; execution after merges |

**Closure rule:** no WP goes to [x] merely by file presence or code merge. Document accepted output, regression, live/role evidence, owner decisions and residual parked items with explicit nonblocking rationale. For a *truly full programme release*, WP08–WP12 cannot simply be relabelled optional or deferred to make a progress meter green.

## Client-end costing approval lane — in parallel with feature work

1. Compare the read-only records for runs 143/148/149 and draft 148’s 110 prime-cost, 2 material and 1 pricing-bridge reviews plus SKU 105 blocker. Confirm *why* each class enters review (component provenance, effective dates, allocated costs, staging/thresholds, approval records); **not every review implies a bug**.
2. Map source evidence → current review worklist/screens → exact existing RPC and permission → user action → updated status. Verify that role-aware reviewer UI can surface all 114 non-ready 148 SKUs, paginate/filter/export without silently hiding any, and distinguish run-scoped draft from pricing-approved 143.
3. Build or correct **client UX only if evidence demonstrates a gap** (e.g. missing visibility, broken drilldown, misleading labels, stale selection, approval action payload or refresh). Add focused mock-backend tests for accurate review/approve/deny transitions, negative/permission cases, and no accidental or bulk approval.
4. No automated bulk accept/approve and **no live mutations from Claude**. Owner and authorised staff perform live governance decisions in the client after sign-in, individually or through existing explicitly governed operations. Assistant verifies the effects using READ ONLY Supabase; only approved changes move official run designation.
5. October finalisation, November draft acceptance, CI-048/049, current SKU105 master remediation and readiness rebuild are *separate approvals* requiring evidence. Do not make programme-code closure conditional on wrongly forcing the October draft green.

## Execution topology and dependencies

**Parallel research (no conflicts, cloud friendly):**
- Lane A: WP05/WP06/MDC-07 + client review/approval journey gap audit.
- Lane B: WP08/WP09 launcher/navigation architecture audit (NO edits to shared shell or hub until approval).
- Lane C: WP10 safeguards server-contract audit (READ ONLY) and WP12 full-suite/smoke baseline, with no server mutation.
- Lane D: WP11 UX/terminology audit and independent bounded U11 proposal.

**Implementation sequence:** First reconcile audit reports and authoritative contracts. Then (1) bounded high-confidence client correction and U11 PR; (2) accepted WP08 navigation changes; (3) accepted WP09 launcher changes; (4) owner-approved WP10 safeguards and dependent client surface; (5) WP11 polish; (6) WP12 final regression/live proof. Independent PRs may be built in parallel when file-disjoint, but merges occur sequentially against updated main with regression after each meaningful integration.

**Shared-file rule:** Shared `costing-suite-shell.js`, registry/route config, Utilities Hub, permission helpers and core Product/SKU pages each have one active writer at a time. No parallel overlapping PRs. Existing default-OFF code must remain byte/behaviour compatible until owner activates it.

**Critical dependencies:** WP10 policy (warn vs block; incomplete SKU criteria) cannot be invented by a client. WP08/WP09 layout decisions requiring consolidation depend on audited routing/permissions; no deletion of lenses, URLs or features on speculation. The review client must be checked against the database’s established contract, not allowed to fabricate approval or new RPC semantics. Run 80/82 historical route fixtures are not a “latest run” source.

## Night/cloud high-progress work order — no false asynchronous guarantee

**One initial self-contained Claude task prompt (in chat) authorises ANALYSE + TEST + DOCS ONLY for the first pass**. Claude should:
- Fetch `main` at the exact approved baseline and existing docs. Verify repository state, full git history and available Chromium.
- Run the complete current Node/Chromium suite; record exact counts and zero skip requirement. Diagnose only genuine failures; do not opportunistically modify unrelated code.
- Produce detailed gap/contract registers for WP05–WP12 and client review lane, with actual paths/functions/RPC names and evidence, separating implemented, required, optional, blocked by owner/policy.
- Create one docs-only draft PR with consolidated findings, priority/dependency plan, exhaustive acceptance matrix and **distinct bounded implementation briefs** for Claude’s next coding wave. Stop; no implementation of high-risk policy/permissions/navigation consolidation before approval.
- If existing tests reveal a narrow reproducible test-only bug, preserve reproduction and offer a minimal separate PR; avoid hiding failures, changing baseline historical pins or weakening guards.
- Report only on meaningful boundaries, not repeated “waiting for tests” messages. Keep execution in one session if practical; use compact summaries and linked documents, not dump all files into messages.

**Token budget/quality:** read authoritative documents first; use scoped `git grep`/file reads, not whole-repo dumps; batch test output into logs with exact summary; prefer one audit pass + one documentation PR; use branch-specific fixed SHA and incremental corrections. If context approaches limit, persist a short `SESSION_HANDOVER` in draft docs rather than repeated chat reorientation. Human sends one consolidated Claude brief, not per-test prompts. Never claim a continuous overnight session when none has actually been launched.

## Final release gate AFTER full programme closure

1. All substantive WP00–WP12 closed with evidence or owner explicitly changes the *programme definition* via a separate documented decision. A deferred Tier-2 optional finding is not a hidden unfinished accepted deliverable; explicitly document rationale.
2. Costing review workflows functional and approved runs clearly separate from drafts; authorised end-user reviews/approvals complete to the degree required by the governed period.
3. Regression: full-history LF + CRLF + Chromium, 0 skipped, old smoke triage, security/no-write protections, actual signed-in role and real-data proof. Any developer changes require final-head revalidation.
4. Electron new version and locally packaged Windows NSIS/ZIP, installer/reopen/updater/rollback, checksums and QA. No auto-publish.
5. Owner explicit final publishing approval; no conflict with paused e-Aushadhi migrations, PWA cache or colleagues’ existing installations.

**Metrics always shown separately:** 5/13 work packs formally complete; navigation wave 4/4 merged; client review/approval workflow acceptance pending; full-programme release gates not yet complete. Do **not** estimate a precise completion night/date from work-pack count.
