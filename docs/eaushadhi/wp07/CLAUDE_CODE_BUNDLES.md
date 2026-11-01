# Claude Code bundle briefs (WP-07 e-Aushadhi client work)

Refreshed 1 Nov 2026 (IST). Roles per ADR-15: **ChatGPT** = orchestrator + server worker, **Claude Code** = client worker, **Jarvis (Grok Bot)** = audit/plan/status support. Codex and Cursor are retired from the default flow.

## Delivery model
- One brief → one Claude Code cloud session → **one draft PR** covering several related items. The session self-checks before reporting.
- The owner pastes the brief into Claude Code, then pastes Claude's report into ChatGPT. ChatGPT audits it with the checklist in [HANDOVER_TO_CHATGPT.md](HANDOVER_TO_CHATGPT.md) §6 and sends at most one consolidated correction. The owner does a short look-only screen check.
- **Usage awareness:** Claude Code cloud sessions count against the owner's Pro plan; ChatGPT and bot turns also use limits. Prefer fewer, larger, self-contained bundles with clear self-checks; batch low findings into the next bundle instead of one-line rounds.
- Branch naming: `feat/wp07-bundle-<letter>-<slug>`; draft PR base is the named base (today `feat/wp07-ux1-worklist`), never main unless the owner approved.
- Server/database work stays with the orchestrator (ChatGPT) and needs owner approval. Merges need owner approval.

## Standard safety preamble (paste at the top of every brief)
```
SAFETY RULES (non-negotiable):
1. No production writes of any kind. Do not run anything against Supabase or the e-Aushadhi portal.
2. No changes under supabase/ (migrations, functions, seeds), no server, worker-server, RPC-contract or SQL changes unless the brief says the owner approved them. If a fix seems to need one, stop and report it.
3. public/sw.js and cache pins: version-string changes only, and only if the brief asks. Never change cache logic.
4. Four-eyes stays intact: never let the saver approve their own step, never bypass APPROVER/VERIFIER checks, never weaken refusal codes.
5. Product 262 stays read-only/locked; the PKG3a portal-entry gate and the strict two-person Save authorization are unchanged. Never click or enable the portal final Submit; never auto-click portal Save.
6. No direct table writes to regulatory.* from the client; use only the existing RPCs. No automatic source verification (a person always verifies).
7. No merges. Work on the named branch; open a DRAFT PR only to the named base (never main unless the brief says owner-approved).
8. Do not commit supabase/migrations/20261015045233_ppm_inactive_sku_mrp_policy_governance.sql, .tmp-smoke-userdata/ or scratch files.
9. UI patterns to keep: icon-only funnel filter drawer left of search (amber dot when active, no separate Clear-filters button), fixed toolbar and sticky table header, ONE table-level vertical scroll bar only when needed, no duplicate global controls, designed .ea-btn buttons. Owner uses Windows at 125% scaling: test 1366 px and 683 px widths.
10. Run every listed smoke. Existing pass counts may only grow; 0 failures. Run node --check on each changed JS/MJS and git diff --check.
REPORT FORMAT: branch, PR link, commit hash(es), changed files, DOM IDs/classes added and removed, pass count per smoke, explicit "no supabase/, server, migration or cache-logic changes", anything not done and why.
```

## Smokes (WP-07 baselines at `c5821b1`)
`node scripts/<name>.mjs` for: eaushadhi-ux3-phase-a-smoke (34), eaushadhi-ux5-smoke (36), eaushadhi-ux1-worklist-smoke (91), eaushadhi-ux2-four-eyes-smoke (61), eaushadhi-ux6-layout-smoke (79), eaushadhi-ux61-portal-text-smoke (51), eaushadhi-ux61-card-colours-smoke (57), eaushadhi-ux62-controls-smoke (46), eaushadhi-ux7-composition-table-smoke (82), eaushadhi-ux9-source-reference-smoke (86), eaushadhi-ux91-composition-toolbar-smoke (86).

---

## Bundle A — UX consistency, pre-merge polish and owner screen-check fixes (APPROVED by owner 1 Nov 2026: "Bundle A go")
```
<paste the SAFETY RULES block above>

TASK: WP-07 e-Aushadhi, Bundle A (amended 1 Nov 2026): UX consistency pass + pre-merge polish + owner screen-check fixes. Client-only.
Repo Brahmadathanu/sasv-workspace-dev. Base: feat/wp07-ux1-worklist at c5821b1 (NOT main).
Create branch feat/wp07-bundle-a-ux-polish from c5821b1. First report `git log -1 --oneline` (must be c5821b1).
Main files: public/shared/e-aushadhi-review-control.html, public/shared/css/sasv-eaushadhi-review.css,
public/shared/js/eaushadhi-review-control.js (+ helpers/worklist JS if needed), scripts/eaushadhi-ux*-smoke.mjs.
Read docs/eaushadhi/WP-07_OPERATOR_JOURNEY.md sections 6a, 6b, 9, 10 and docs/eaushadhi/CHANGELOG_DECISIONS.md ADR-11..ADR-15 first.

(a) Three low audit findings
 A1. The floating Composition helper tooltip (#compositionActionHint) must follow its "i" icon if the page or
     workspace scrolls or resizes while it is open (reposition on scroll/resize, capture phase, rAF-throttled), or hide on scroll.
     Keep: position fixed, inside viewport, pointer-events none, aria-describedby, hide on blur/mouseleave/Escape.
 A2. Replace the regex-only check for "state.verifyReviewed.running clears in finally" with a behavioural test:
     run submitVerifyReviewed with a mocked RPC that throws, then assert running === false and Approve re-enabled.
 A3. Tab-strip focus rings must not be clipped: give the tab strip enough padding / overflow-clip-margin or use an
     inset outline so :focus-visible rings show fully at 125% (1366 and 683 px). Add a smoke check.

(a2) Owner screen-check fixes (1 Nov 2026, at c5821b1)
 A4. Composition helper trigger and colour. The helper tooltip must ALSO show on hover and on keyboard focus of the
     Composition TAB NAVIGATOR BUTTON itself, not only on the "i" (same floating tooltip, same aria-describedby,
     same hide on mouseleave/blur/Escape, still never adds a scroll bar). Give the "i" a more visible colour with
     accessible contrast (e.g. a blue/teal accent, >= 3:1 against the tab background for the icon); keep the amber
     filter dot visually distinct. Smoke: hovering/focusing the tab button opens the tooltip; Escape closes it.
 A5. Narrow window horizontal scroll. When the Composition table is wider than its container (half-width window),
     a horizontal scroll bar must appear automatically, only when needed (no reserved gutter), on the SAME table
     scroller that owns the vertical scroll; the header stays sticky and there is still exactly ONE vertical scroll bar.
     If table-layout / min-width / overflow-x:hidden or clip is the cause, fix with overflow-x:auto on that scroller.
     Smoke at 125%, widths 683 px and 1366 px: at 683 the scroller has scrollWidth > clientWidth and computed
     overflow-x auto (horizontal bar present); at 1366 no horizontal bar if the table fits; one vertical scroller only.
 A6. Hover contrast bug. On hover / focus-visible / active of "Approve reviewed lines" (.ea-btn--primary, dark green
     background) the text turns dark and becomes unreadable. Text must stay white/light in every state (default, hover,
     focus-visible, active, disabled). Find the rule that overrides colour (e.g. a generic button:hover or a:hover)
     and fix it with scoped .ea-btn rules, not !important sprawl. Audit every .ea-btn variant (primary, soft, danger,
     ghost etc.) for the same problem and fix all. Smoke: computed text/background contrast in the hover and focus
     states >= 4.5:1 for each .ea-btn variant present.

(b) Consistency pass, NO behaviour change
 Extend the scoped .ea-btn button system (.ea-btn--primary, .ea-btn--soft, etc.) and, where the tab already has the
 equivalent elements, the Composition screen pattern (fixed toolbar, one inner scroll area only when needed with a
 sticky opaque header, filter drawer behind a funnel with an amber dot and "Filters (N)") to: Overview, Product Details,
 Pharmacological Action, QC Register, Evidence, Readiness tabs.
 Rules: restyle existing buttons only; keep every element ID, event handler, disabled logic, title/aria text and
 refusal message; do not add new filters or features; do not touch Fill on portal / gate / Save authorization
 behaviour; if a tab has no table or filters, only apply .ea-btn. List per tab what changed.
 Add smoke checks (125%, 1366 and 683 px): buttons on those tabs carry .ea-btn classes; only one vertical scroll bar
 per tab; Overview and QC still scroll.

(c) Legacy old-card render path (UX-7 finding 1)
 Find the old per-line card render path for composition lines superseded by the UX-7 table + line modal. Prove it is
 unused (no caller reachable; search all JS/HTML; the error fallback to the old worklist queue is NOT this path and
 must stay). If proven unused, remove it and its dead CSS; if anything still calls it, leave it and report the caller.

(d) Rebase prep notes ONLY
 Do NOT rebase, merge main, or change any cache string. In the PR description list the files you expect to
 conflict with main (main is hub-cache-v387 at 5c5b7ba; the next free number is decided at merge time by the
 orchestrator) and anything Bundle B must re-check.

SELF-CHECKS (all must pass before you report):
 - all 11 smokes at or above baseline with 0 failures (add new checks to ux91 or a new eaushadhi-ux10-consistency-smoke.mjs);
 - new checks for A3, A4, A5 (683 and 1366 px at 125%) and A6 (hover/focus contrast >= 4.5:1) exist and pass;
 - node --check on every changed JS/MJS; git diff --check clean;
 - `git diff --stat c5821b1` shows nothing under supabase/, public/sw.js unchanged, no worker/server/portal-automation file changed;
 - grep confirms no refusal code, four-eyes check, PKG3a gate or Product 262 lock was removed or weakened;
 - list DOM IDs/classes added and removed.
DELIVER: push feat/wp07-bundle-a-ux-polish and open a DRAFT PR with base feat/wp07-ux1-worklist (never main).
Report in the REPORT FORMAT, plus a short "owner screen check" list (max 8 look-only steps) for A4, A5, A6 and the restyled tabs.
```
**Why it is safe:** client-only presentation and test work on a branch off the unmerged feature branch; no server, migration, RPC, worker or cache change; no behaviour change (IDs, handlers, four-eyes, PKG3a gate and Product 262 lock kept and covered by the existing 11 smokes); A4 only adds a second trigger for an existing read-only tooltip; A5 only changes overflow on the existing table scroller; A6 only changes button colours (contrast checked by smoke); dead-code removal only after proof; draft PR into the feature branch, never main; no rebase.

---

## Bundle B — merge-prep (REQUIRES OWNER APPROVAL AND A CACHE CHECK WITH THE COSTING ORCHESTRATOR BEFORE OPENING)
```
<paste the SAFETY RULES block above>
OWNER APPROVAL: <date/ref — fill in before sending>. Costing orchestration (ChatGPT) confirmed next free cache: v<N> (main is v387 on 1 Nov; v388 if still free).
TASK: Merge prep for feat/wp07-ux1-worklist (after Bundle A is merged into it). Create merge-prep/wp07 from it.
1. Rebase onto origin/main (or merge origin/main in if the owner prefers no force-push). Resolve conflicts.
2. Set hub-cache-v<N> in public/sw.js and the pins in eaushadhi-qc-preparation-workspace-smoke, eaushadhi-qc-b5-d7-smoke,
   eaushadhi-qc-b5-d7-2-2-smoke, eaushadhi-qc-b5-d7-3-smoke (and any other pin `git grep hub-cache-v3` finds). Version strings only.
3. Hand-merge docs/eaushadhi/CHANGELOG_DECISIONS.md keeping both sides.
4. Run all 11 WP-07 smokes + every touched smoke; node --check; git diff --check.
5. Push and open a DRAFT PR to main. Do NOT merge.
```
See [MERGE_PLAN.md](MERGE_PLAN.md).

## Bundle C candidates (blocked on owner decisions — do not brief yet)
- **B2 worker unlock** (worker beyond Product 262): needs the owner's three answers ([B2 sheet](../wp07-overnight-20261029/B2_DECISION_SHEET.md)) and likely server work by the orchestrator first.
- **Blank-reference clearing / "Reference needed before portal entry"**: needs the portal blank-reference answer; clearing needs an owner-approved server change.
- **Package D (QC across many products)**: needs QC server Part A approval and the COA file-naming convention.
- **ADR-08 both-Approvers-saved handling**: needs the owner's choice (third Approver vs reopen-and-re-save).
