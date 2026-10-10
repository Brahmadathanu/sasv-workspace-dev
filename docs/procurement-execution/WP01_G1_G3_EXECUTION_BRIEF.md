# PEC WP01 — G1–G3 implementation execution brief
Status: G3 client merged in PR #49 to main at 19:38 IST on 2026-10-09, before the independent audit this brief required. Post-merge audit PASS WITH NOTES. Out-of-order merge accepted by user 2026-10-09 (DEC-009). The workflow below is the recorded brief; it was not followed for this merge. See WP01_TRACEABILITY_ACCESS_CORRECTION.md.
Base: merge `0d004779f7e928b855b18d1d90b3eddd262050b4`. Always check fresh main before beginning.
Branch: `feat/pec-wp01-traceability-access`.
Read `docs/procurement-execution/{README,MASTER_PROGRAMME,IMPLEMENTATION_RULES,WP01_TRACEABILITY_ACCESS_CORRECTION,CHANGELOG_DECISIONS}.md` first.

## Server authority — ChatGPT (do NOT implement via Cursor)
The live filtered SQL function `public.proc_vendorwise_buylist_filtered_pec_internal` was corrected by ChatGPT on 2026-10-09 and now includes `indent_line_sort_no` in the filtered JSON. **Verified source detail:** `public.v_proc_indent_line_buylist_base` does NOT carry serial; `public.v_proc_indent_lines_console_ordered` does. The deployed function now sources canonical serial by the exact `indent_line_id` relationship (no positional numbering or guessed default). The function is postgres-owned SECURITY DEFINER, search_path=public; authenticated may execute the public `proc_vendorwise_buylist_filtered` wrapper but NOT the internal routine. Do not change grants or security posture. Server G2 is already applied and independently verified; client executors must not reapply or replace it.

## Client executor — Cursor/Codex only
G3 is an already bounded and authorized client contract. Inspect exact current files, internally plan, then autonomously implement, test, self-review, fix and retest within that contract. Stop for a separate plan audit only if authentication/security implementation requires a materially new contract:
- `public/shared/js/procurement-execution-console.js`: `renderIndentLines` currently uses `idx + 1`; appended path uses `startAt + idx + 1`. Replace both **display** sources with validated `row.indent_line_sort_no`, retaining actual record ID/actions.
- `normalizeVwlBreakdown` presently omits the serial. Retain canonical JSON field; add a single safe display formatter for indent + serial, e.g. `193 (15)`; use it in the Indents modal and any directly related compact reference that has canonical serial.
- No absent serial may be synthesized. No quantity/rate/assignment/indent historical changes.
- Study `public/utilities-hub/js/hub-auth.js`, `public/shared/js/module-registry.js`, `public/sw.js` and PWA registration history. Hub ALREADY rerenders on visibilitychange and pageshow, and `loadUtilities()` reloads registry and `get_user_permissions`; current registry has read-mode PWA route. Service worker at cache v343 uses cache-first for `module-registry.js` while Hub auth JS is network-fetched. **Cache is hypothesis, not proven root cause**. Before any PWA code edit, present deployment/cache/permission evidence and the smallest correction; do NOT add redundant listeners or broaden grants.
- Scope only these features. Do not touch unrelated modules, WIP, server SQL, migration source or protected checkouts.
- For the canonical serial display fixes, proceed autonomously through code, tests, self-review, corrections, commit, push and a PR to `main` from this branch. If a PWA security-sensitive change is needed beyond the frozen contract, stop that subtask for ChatGPT review; do not block independently safe traceability work. Do not merge, deploy or publish until ChatGPT independently audits the actual PR and returns PASS and explicit clearance.
- Report exact head SHA, files changed, all tests, pre/post behaviour and remaining real-account verification gaps.

## Required acceptance
- Indent 193 / 28 MM ROPP Cap displays `193 (15)` from canonical data.
- Indent search returning only serial 15 displays `# = 15`, never `1`; append paths preserve serial.
- Existing buying-list totals and security unchanged.
- Both affected read-only accounts see/access only their authorized module; unauthorised users remain denied. Do not claim success without real authenticated proof.
- Pause before application merge/deploy and any expanded permission/security changes.

## Gate discipline
G1 high-risk plan review; G2 server correction and live parity verification; G3 client execution; G4 independent acceptance; G5 merge authorization. No gate becomes DONE solely because a branch or file exists.

## G2 server execution evidence — 2026-10-09
**COMPLETED — LIVE (server); signed-in user acceptance is pending.**
- Applied migration: `pec_filtered_buylist_canonical_indent_line_sort_no` against `qhmoqtxpeasamtlxaoak`.
- Live internal function now joins `v_proc_indent_lines_console_ordered` by `indent_line_id`, carries canonical `indent_line_sort_no` and includes it in each JSON breakdown record.
- Unique IDs in ordered view: 1472/1472; unique base IDs: 1147/1147; join matches: 1147; missing serials: 0.
- Representative filtered lookup: Indent 193, 28 MM ROPP Cap → `indent_line_sort_no=15`.
- Result row/quantity/amount parity with base view: 769 rows; quantity `3141498.892228`; amount `53439863.525775243794`.
- Internal function still owned by `postgres`, `SECURITY DEFINER`, `search_path=public`, directly non-executable by `authenticated`.
- Public wrapper rejected unauthenticated invocation (`Not authenticated`) as expected; signed-in proof remains OPEN.
- No client code, PWA, grants, or indent source records were changed.
- Migration reversal must restore prior filtered function definition from verified prechange source, not delete serials or modify underlying indent rows.

## Locked workflow — 2026-10-09 user direction
```
CHATGPT: architecture + live server implementation + complete bounded client work-pack
  ↓
CURSOR/CODEX: analyze → implement → test → self-review → fix → retest → commit → push → PR
  ↓
CHATGPT: independently audit the actual pushed GitHub branch and PR
  ↓
IF PASS + explicit merge clearance: CURSOR/CODEX merges PR and cleans up only its own approved branch/worktree
  ↓
CHATGPT: independently verifies current main, merged scope, and post-merge result
```
No analysis-only handoff for already approved bounded work; no repeated permission requests at routine client steps. Unexpected server/auth/permissions architecture, destructive actions, unexplained failures or overlap are stop-and-report exceptions. Preserve unrelated worktrees and branches. Creating a PR is *not* merge authorization.

## Complete G3 acceptance and test matrix
1. Preserve `indent_line_sort_no` (integer, original value) in `normalizeVwlBreakdown()` for both object and serialized JSON input.
2. Render modal indent as `193 (15)` and similarly each breakdown line, HTML-escape dynamic text; preserve other modal cells and actions.
3. In opened indent, initial and append rendering both show canonical `row.indent_line_sort_no`, not search index. Missing/invalid serial must show a clear unavailable marker (not a number); never alter underlying row actions/identity.
4. Verify single-result filtered line serial 15, multiple hits, pagination/infinite-scroll append, filter clear, multiple indents, invalid/no serial, and no visual row duplication.
5. Preserve vendor totals, price/rate/quantity, procurement permissions and existing downstream formatting semantics; document any display-only compact export changes.
6. PWA: compare current deployed files and worker generation against repository and inspect registry/permission resolution. Existing Hub visibilitychange/pageshow and permission refetch must not be duplicated. Prove root cause first. For cache-specific correction, ensure fresh `module-registry.js` loading on grant changes and service-worker upgrade without weakening offline fallback or access checks; coordinate SW cache bump/deployment as a separate release/operational approval. Do not claim the two accounts PASS without signed-in evidence.
7. Run existing `scripts/pec-plm-pm-canonical-smoke.mjs`, `scripts/pec-pr-scope-smoke.mjs`, plus new focused regression tests, syntax checks, and any directly impacted Hub/module-registry tests; report exact commands and outcomes.
8. Output a PR audit packet: branch SHA, PR number/URL, changed files, test log, self-review findings/resolutions, live G2 contract dependency, residual risks and signed-in acceptance gaps.
