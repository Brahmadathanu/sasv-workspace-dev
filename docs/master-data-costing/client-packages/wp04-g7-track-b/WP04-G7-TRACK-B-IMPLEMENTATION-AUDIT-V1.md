# WP04 G7 Track B — Independent Implementation Audit V1

2026-10-05.

Status: **CODE/CONTRACT PASS WITH ONE NARROW CLIENT FINDING; LIVE VISUAL PROOF STILL REQUIRED. G7 REMAINS BLOCKED.**

## Reconciled GitHub state

Recovery branch:
`fix/wp04-g7-track-b-readiness-ux`

Accepted base:
`db7544f2ebdf30f515f249ade9e12a660a364476`

Actual remote head:
`8878c70885e1f195070b5d5bdd72db649d15eadc`

GitHub compare:
- ahead 1
- behind 0
- merge base = exact accepted G5 base
- branch ref is identical to reported head

Exactly six changed files:

1. `public/shared/js/costing-suite-readiness.js`
2. `public/shared/js/costing-suite-shell.js`
3. `public/shared/costing-control-center.html`
4. `public/shared/css/sasv-costing.css`
5. `scripts/wp04-readiness-client-contract-smoke.mjs`
6. `public/sw.js`

No seventh file.

Unchanged by blob:
- `public/shared/js/costing-suite-registry.js`
- `public/shared/js/costing-route-config.js`

## Track A read-only freshness

PASS.

Production:
- indexed public portfolio MD5 `590a40c5a53949ca8e9f87dd54404947`
- ACL `{postgres=X/postgres,authenticated=X/postgres}`
- Build ID 4
- status `COMPLETED`
- current = true
- fresh = true
- period 2026-09-01
- valuation 2026-09-10
- run 115
- item count 1793
- operational count 611
- build/current digest `902a4c9d962237858480575895b6616f`
- CSE-P01 MD5 `68bd9325062299eb8af1291bf4d9393b`

Track A remains CLOSED.

## Frozen package compliance

### Compact governed controls

PASS.

Existing authoritative period/population controls are retained.
Raw permanent Dependency/Owner/Route multi-select blocks are removed.

### Filter drawer/chips

PASS.

Implementation adds:
- `readinessFilterBtn`
- `readinessFilterBadge`
- `readinessFilterDrawer`
- server-option checklist hosts
- `readinessAppliedFilters`
- Apply/Clear behavior
- outside-click close
- Escape close

Filter choices come from validated server `filter_options`.

Shell search remains the sole visible search authority; no `readinessSearch` exists.

### Live summary strip

PASS WITH ONE NARROW FINDING.

Population/matched/returned and severity counts are read directly from the server portfolio envelope.

Governed period and valuation are server-derived.

However the context badge currently computes:

`ctx.context_integrity_status || ctx.live_as_of || "LIVE_AS_OF"`

The validated envelope exposes `context_type`, not `live_as_of`.

The hard-coded final `"LIVE_AS_OF"` is a client assumption, whereas the frozen package requires the caption/badge to be derived from the server envelope and forbids new client readiness authority.

Required narrow correction:

use server fields only, for example:

`ctx.context_integrity_status || ctx.context_type || "—"`

No server change and no architecture change.

This finding is bounded to one display expression in `costing-suite-readiness.js`.

### Product-gap cards

PASS.

- exactly two summary cards
- collapsed preview uses `READINESS_GAP_PREVIEW_LIMIT = 3`
- detail uses only the already-returned bounded gap page
- no gap-page traversal
- `has_more` produces bounded-preview wording
- no gap-local search

### Full-width register / drawer detail

PASS.

- generic table card receives stable `genericTableCard`
- Readiness shell state hides generic table card
- Readiness register remains full width
- no Action column
- selected row/card reuses existing shell `openDetails`
- existing `#detailsModal`, `getDrawerConfig`, `renderDrawerTab` are retained
- no permanent second detail pane introduced

### Readiness shell chrome

PASS BY SOURCE REVIEW, pending live visual confirmation.

`syncReadinessShellChrome()`:
- toggles `cp-readiness-active`
- hides KPI strip
- hides `lastRefreshed`
- hides generic table card
- preserves readiness-owned governed period behavior
- restores KPI via existing `applyKpiStripVisibility()`
- restores generic/freshness chrome and period control when leaving

No snapshot KPI data is rendered inside the Readiness lens.

### States

PASS.

Source distinguishes:
- loading
- portfolio unavailable
- Product-gap unavailable
- empty matched result
- server UNKNOWN severity

Unavailable is not converted to UNKNOWN.

### Narrow-screen behavior

PASS BY CSS/source review, pending live visual confirmation.

At <=900px:
- gap cards stack
- filter drawer is viewport constrained
- desktop register hides
- card list becomes primary

Controls/chips use wrapping layouts.

### Client/server authority

PASS.

Readiness source contains exactly these RPC literals:
- `rpc_get_readiness_governed_periods`
- `rpc_get_readiness_product_gaps`
- `rpc_get_product_sku_readiness_portfolio`

No writer RPC literal was introduced.

No client severity precedence or canonical portfolio-total calculation was found.

### Service worker

PASS.

`hub-cache-v333` -> `hub-cache-v334`.

No unrelated SW behavior identified in the bounded diff.

## Reported command evidence

Implementer reports PASS:
- `node --check public/shared/js/costing-suite-readiness.js`
- `node --check public/shared/js/costing-suite-shell.js`
- `node scripts/wp04-readiness-client-contract-smoke.mjs`
- `git diff --check`

Updated smoke source was independently inspected and includes the frozen Track B structural assertions.

No GitHub-hosted CI evidence was supplied, so command execution evidence remains implementer-local.

## Visual proof disposition

**NOT YET SUFFICIENT FOR TRACK B ACCEPTANCE.**

The frozen Track B package required screenshots from the exact recovery branch/worktree representing the actual Control Center behavior. It explicitly permits a temporary mock/failure harness for the **unavailable-state screenshot**, but not as a substitute for the normal success/filter/detail/narrow/lens-exit UI proof.

Reported evidence was captured using an uncommitted structural harness rather than a live authenticated Costing Control Center session.

Those untracked screenshots are also not available in GitHub for independent review.

Therefore the following still require one signed-in exact-branch visual smoke pass:

1. desktop Readiness success
2. desktop filter drawer
3. selected details modal
4. portrait/narrow success
5. portrait filter/detail
6. Readiness -> Dashboard shell restoration

Unavailable-state proof may remain harness-based.

This is a Track B proof gap, not a code/server defect.

## Required correction before live visual pass

One narrow client correction is recommended before final Track B evidence capture:

In `renderSummary()`, replace the hard-coded context fallback:
`ctx.context_integrity_status || ctx.live_as_of || "LIVE_AS_OF"`

with a server-derived expression such as:
`ctx.context_integrity_status || ctx.context_type || "—"`.

Then:
- rerun the same targeted smoke / node checks / diff-check;
- keep changed-file allowlist at six or fewer;
- push one bounded correction commit to the same recovery branch;
- provide new head SHA.

No package rearchitecture is required.

## Current gate

Track B is **NOT YET ACCEPTED**.

Code/contract implementation is substantially compliant, but:
1. the one display-authority expression requires correction;
2. the exact-branch signed-in visual matrix must be completed.

G7 must not restart yet.

No merge.
No release/publish.
No G8.
No Track A reopen.
